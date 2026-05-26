// lib/email.js — outbound email infrastructure
//
// Per EMAIL_INFRA_SCOPE.md §3.4. DB-backed queue (email_outbox table)
// + in-process setInterval worker + Resend provider. Solo-operator
// scale; don't reach for Redis/BullMQ until we genuinely need them.
//
// Pattern:
//   1. Route or handler calls enqueueEmail({ dedupKey, toUserSub, ... })
//   2. enqueueEmail checks minor-bypass (decision 12) and renders the
//      template, then INSERTs a row in email_outbox with status=pending
//      (or status=bypassed_minor if blocked)
//   3. The worker (started by startEmailWorker) polls every 30s,
//      claims up to 10 pending rows, sends each via Resend, updates
//      status to sent / failed
//   4. Retry up to 3x with exponential backoff (1m, 5m, 30m)
//   5. On exhausted retries, status=failed + synthetic admin feedback
//      row per decision 16

import { Resend } from "resend";
import { pool, isMinor, dbAuditEvent, dbInsertFeedback, dbExpireOrphanAnchors } from "../db.js";
import * as welcomeTemplate from "./email-templates/welcome.js";

// Lazy-load templates by id. New templates: add an export here.
const TEMPLATES = {
  welcome: welcomeTemplate.default,
};

const FROM     = process.env.EMAIL_FROM        || "SetForge <noreply@setforge.io>";
const REPLY_TO = process.env.EMAIL_REPLY_TO    || "hello@setforge.io";
const API_KEY  = process.env.RESEND_API_KEY    || "";
export const EMAIL_ACTIVE = !!API_KEY;

const resend = EMAIL_ACTIVE ? new Resend(API_KEY) : null;

// Exponential backoff schedule for retries. attempts 1 → +1m, 2 → +5m,
// 3 → +30m. After 3rd failure, status flips to failed.
const RETRY_BACKOFF_MS = [60 * 1000, 5 * 60 * 1000, 30 * 60 * 1000];
const MAX_ATTEMPTS = 3;

// Render a template by id with vars. Templates export a default function
// that takes vars + returns { subject, text, html }.
function renderTemplate(templateId, vars) {
  const tmpl = TEMPLATES[templateId];
  if (!tmpl) throw new Error(`unknown email template: ${templateId}`);
  const rendered = tmpl(vars || {});
  if (!rendered.subject || !rendered.text || !rendered.html) {
    throw new Error(`template ${templateId} missing subject/text/html`);
  }
  return rendered;
}

// Public: queue an email for sending.
//
// Required: dedupKey (unique per send), templateId, ONE of toUserSub or toEmail
// Optional: any template vars
//
// If toUserSub provided, minor-bypass check happens:
//   - users.dob IS NULL → bypass (safer-side per scope decision 12)
//   - users.dob indicates under-18 → bypass
// If toUserSub not provided (one-off to external email), no bypass.
//
// Returns { id } on enqueue, { bypassed: 'minor' | 'dob_unknown' } on bypass,
// { skipped: 'inactive' } when EMAIL_ACTIVE=false (dev/test envs).
export async function enqueueEmail({ dedupKey, toUserSub, toEmail, templateId, ...vars }) {
  if (!EMAIL_ACTIVE) {
    console.warn(`[email] EMAIL_ACTIVE=false, skipping enqueue for ${dedupKey}`);
    return { skipped: "inactive" };
  }
  if (!dedupKey || !templateId) throw new Error("enqueueEmail: dedupKey + templateId required");
  if (!toUserSub && !toEmail)   throw new Error("enqueueEmail: toUserSub or toEmail required");

  // Minor-bypass check (decision 12). Default to bypass when DOB unknown.
  let resolvedEmail = toEmail || null;
  if (toUserSub) {
    const rows = await pool.query(
      "SELECT `email`, `dob` FROM `users` WHERE `sub` = ?",
      [toUserSub]
    );
    const u = rows[0];
    if (!u) {
      console.warn(`[email] enqueue for unknown user_sub ${toUserSub}; skipping`);
      return { skipped: "user_not_found" };
    }
    const minor = isMinor(u.dob);
    if (minor === null || minor === true) {
      // Insert row for audit but never send.
      const reason = minor === null ? "dob_unknown" : "minor";
      const rendered = renderTemplate(templateId, vars);
      await pool.query(
        "INSERT IGNORE INTO `email_outbox` " +
        "(`dedup_key`, `to_email`, `to_user_sub`, `template_id`, `subject`, `html_body`, `text_body`, `status`) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, 'bypassed_minor')",
        [dedupKey, u.email || "(no_email)", toUserSub, templateId, rendered.subject, rendered.html, rendered.text]
      );
      dbAuditEvent({
        userSub:   toUserSub,
        eventType: "email.enqueue",
        details:   { dedup_key: dedupKey, template_id: templateId, bypassed: reason },
      });
      return { bypassed: reason };
    }
    if (!resolvedEmail) resolvedEmail = u.email || null;
  }

  if (!resolvedEmail) {
    console.warn(`[email] no email for ${dedupKey}; skipping`);
    return { skipped: "no_email" };
  }

  // Render + insert.
  const rendered = renderTemplate(templateId, vars);
  try {
    const result = await pool.query(
      "INSERT INTO `email_outbox` " +
      "(`dedup_key`, `to_email`, `to_user_sub`, `template_id`, `subject`, `html_body`, `text_body`) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?)",
      [dedupKey, resolvedEmail, toUserSub || null, templateId, rendered.subject, rendered.html, rendered.text]
    );
    dbAuditEvent({
      userSub:   toUserSub || null,
      eventType: "email.enqueue",
      details:   { dedup_key: dedupKey, template_id: templateId, to_email: resolvedEmail },
    });
    return { id: Number(result.insertId) };
  } catch (err) {
    // Most likely duplicate dedup_key — silent no-op.
    if (err.code === "ER_DUP_ENTRY" || /duplicate/i.test(err.message || "")) {
      console.log(`[email] enqueue duplicate dedup_key ${dedupKey}; no-op`);
      return { skipped: "duplicate" };
    }
    throw err;
  }
}

// Internal: pull up to N pending rows whose next_retry_at is in the past
// (or null). Claims them by flipping status to 'sending' so a concurrent
// tick (or restart-overlap) can't double-process. Returns full rows.
async function claimPending(limit = 10) {
  // Two-step claim. SELECT FOR UPDATE then UPDATE — avoids the race where
  // two workers see the same pending row. MariaDB supports SELECT...FOR
  // UPDATE in InnoDB.
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const rows = await conn.query(
      "SELECT * FROM `email_outbox` " +
      "WHERE `status` = 'pending' AND (`next_retry_at` IS NULL OR `next_retry_at` <= NOW()) " +
      "ORDER BY `created_at` ASC LIMIT ? FOR UPDATE",
      [limit]
    );
    if (rows.length === 0) {
      await conn.commit();
      return [];
    }
    const ids = rows.map(r => r.id);
    const placeholders = ids.map(() => "?").join(",");
    await conn.query(
      `UPDATE \`email_outbox\` SET \`status\` = 'sending' WHERE \`id\` IN (${placeholders})`,
      ids
    );
    await conn.commit();
    return rows;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Internal: send one row via Resend. Updates the row to sent/pending(retry)/failed.
async function sendOne(row) {
  if (!resend) return; // EMAIL_ACTIVE=false; shouldn't happen since enqueue is gated
  try {
    const result = await resend.emails.send({
      from:    FROM,
      to:      row.to_email,
      replyTo: REPLY_TO,
      subject: row.subject,
      html:    row.html_body,
      text:    row.text_body,
    });
    if (result.error) {
      throw new Error(`Resend ${result.error.statusCode || ""}: ${result.error.message || "unknown"}`);
    }
    const providerId = result.data?.id || null;
    await pool.query(
      "UPDATE `email_outbox` SET `status` = 'sent', `sent_at` = NOW(), `provider_msg_id` = ? WHERE `id` = ?",
      [providerId, row.id]
    );
    dbAuditEvent({
      userSub:   row.to_user_sub,
      eventType: "email.send.result",
      details:   { outbox_id: row.id, dedup_key: row.dedup_key, posted: true, provider_msg_id: providerId },
    });
    console.log(`[email] sent ${row.dedup_key} (${row.template_id}) → ${row.to_email} id=${providerId}`);
  } catch (err) {
    const attempts = (row.attempts || 0) + 1;
    const finalFailure = attempts >= MAX_ATTEMPTS;
    const message = err.message || String(err);
    console.warn(`[email] send failed ${row.dedup_key} attempt ${attempts}/${MAX_ATTEMPTS}: ${message}`);

    if (finalFailure) {
      await pool.query(
        "UPDATE `email_outbox` SET `status` = 'failed', `attempts` = ?, `last_error` = ? WHERE `id` = ?",
        [attempts, message.slice(0, 1000), row.id]
      );
      dbAuditEvent({
        userSub:   row.to_user_sub,
        eventType: "email.send.result",
        details:   { outbox_id: row.id, dedup_key: row.dedup_key, posted: false, attempts, error: message },
      });
      // Hard-bounce surface per scope decision 16: synthetic admin feedback row.
      try {
        await dbInsertFeedback({
          userSub:   row.to_user_sub,
          category:  "email_bounce",
          subject:   `Hard bounce: ${row.dedup_key}`,
          body:      `Email send failed after ${attempts} attempts.\n\nTo: ${row.to_email}\nTemplate: ${row.template_id}\nError: ${message}\n\nOutbox id: ${row.id}`,
          page:      "lib/email.js#worker",
          userAgent: "system",
        });
      } catch (fbErr) {
        console.warn(`[email] failed to insert hard-bounce feedback row: ${fbErr.message}`);
      }
    } else {
      // Schedule retry.
      const backoffMs = RETRY_BACKOFF_MS[attempts - 1] || RETRY_BACKOFF_MS.at(-1);
      await pool.query(
        "UPDATE `email_outbox` SET `status` = 'pending', `attempts` = ?, `last_error` = ?, `next_retry_at` = DATE_ADD(NOW(), INTERVAL ? SECOND) WHERE `id` = ?",
        [attempts, message.slice(0, 1000), Math.floor(backoffMs / 1000), row.id]
      );
    }
  }
}

// Public: one worker tick. Exported for tests / one-shot manual triggering.
export async function processQueue() {
  if (!EMAIL_ACTIVE) return { processed: 0, skipped: "inactive" };
  const rows = await claimPending(10);
  if (rows.length === 0) return { processed: 0 };
  for (const row of rows) {
    await sendOne(row);
  }
  return { processed: rows.length };
}

// Public: start the periodic worker. Idempotent — calling twice does
// nothing (second call no-ops). Set up once at server boot.
//
// Piggybacks the same setInterval to run cron-like sweeps that don't
// need their own timer:
//   - dbExpireOrphanAnchors: every 60th tick (~30 min) to flip
//     anchors whose underlying event was deleted (Phase 3 / meet-
//     anchored taper). Lightweight UPDATE; safe to run frequently.
let _workerHandle = null;
let _tickCount    = 0;
export function startEmailWorker() {
  if (!EMAIL_ACTIVE) {
    console.log("[email] EMAIL_ACTIVE=false; worker not started");
    return;
  }
  if (_workerHandle) {
    console.log("[email] worker already running");
    return;
  }
  console.log("[email] starting worker (poll every 30s)");
  _workerHandle = setInterval(() => {
    _tickCount++;
    processQueue().catch(err => console.warn(`[email] worker tick threw: ${err.message}`));
    // Orphan-anchor cron: every 60 ticks (~30 min). Cheap UPDATE; the
    // worker's own load is whatever the prior processQueue is doing.
    if (_tickCount % 60 === 0) {
      dbExpireOrphanAnchors()
        .then(r => { if (r.cleared) console.log(`[anchors] cron cleared ${r.cleared} orphaned anchor(s)`); })
        .catch(err => console.warn(`[anchors] orphan sweep threw: ${err.message}`));
    }
  }, 30 * 1000);
  // Run one tick immediately so dev iteration doesn't wait 30s for the first.
  processQueue().catch(err => console.warn(`[email] initial worker tick threw: ${err.message}`));
}
