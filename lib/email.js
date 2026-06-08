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
import { pool, isMinor, dbAuditEvent, dbInsertFeedback, dbExpireOrphanAnchors, dbExpirePastConstraints, dbQueueWeeklyDigests, dbAutoCompleteTransfers, dbGetTeam } from "../db.js";
import * as welcomeTemplate from "./email-templates/welcome.js";
import * as parentInviteTemplate from "./email-templates/parent-invite.js";
import * as parentDigestTemplate from "./email-templates/parent-digest.js";
import * as transferProposedTemplate from "./email-templates/transfer-proposed.js";
import * as transferAcceptedTemplate from "./email-templates/transfer-accepted.js";
import * as transferCancelledTemplate from "./email-templates/transfer-cancelled.js";
import * as transferDeclinedTemplate from "./email-templates/transfer-declined.js";
import * as transferCompletedAutoTemplate from "./email-templates/transfer-completed-auto.js";
import { runWeatherAdvisorySweep, runRsvpReminderSweep } from "./notify.js";
import * as lessonRecapTemplate from "./email-templates/lesson-recap.js";
import * as coachNoteGuardianTemplate from "./email-templates/coach-note-guardian.js";

// Lazy-load templates by id. New templates: add an export here.
const TEMPLATES = {
  "welcome":        welcomeTemplate.default,
  "parent-invite":  parentInviteTemplate.default,
  "parent-digest":  parentDigestTemplate.default,
  "lesson-recap":   lessonRecapTemplate.default,
  "coach-note-guardian": coachNoteGuardianTemplate.default,
  "transfer-proposed":       transferProposedTemplate.default,
  "transfer-accepted":       transferAcceptedTemplate.default,
  "transfer-cancelled":      transferCancelledTemplate.default,
  "transfer-declined":       transferDeclinedTemplate.default,
  "transfer-completed-auto": transferCompletedAutoTemplate.default,
};

const FROM     = process.env.EMAIL_FROM        || "SetForge <noreply@setforge.io>";
const REPLY_TO = process.env.EMAIL_REPLY_TO    || "hello@competitionaquatics.com";
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
    // Stamp next_retry_at at claim time (it's otherwise unused while 'sending') so
    // recoverStaleSending() can detect rows orphaned by a crash mid-send.
    await conn.query(
      `UPDATE \`email_outbox\` SET \`status\` = 'sending', \`next_retry_at\` = NOW() WHERE \`id\` IN (${placeholders})`,
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

// Recover rows orphaned in 'sending' by a crash/restart between the claim commit
// and the send-result update (deploy, OOM, or the deliberate DB-down process.exit).
// Without this they'd never be reclaimed (claimPending only selects 'pending') and
// the email is silently lost forever. Reset to 'pending' after a 5-min grace.
async function recoverStaleSending() {
  try {
    const r = await pool.query(
      "UPDATE `email_outbox` SET `status` = 'pending' " +
      "WHERE `status` = 'sending' AND `next_retry_at` < (NOW() - INTERVAL 5 MINUTE)"
    );
    if (Number(r.affectedRows || 0) > 0) console.log(`[email] recovered ${r.affectedRows} stale 'sending' row(s) → pending`);
  } catch (e) { console.warn(`[email] stale-sending recovery failed: ${e.message}`); }
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
//   - dbExpirePastConstraints: every 60th tick (~30 min) to flip
//     swimmer_constraints rows whose expires_at has passed (Phase 3 /
//     per-swimmer constraint vector). Same shape: cheap UPDATE.
// Adapter so dbQueueWeeklyDigests (which uses {to, template, payload, ...})
// can call enqueueEmail (which uses {toEmail, templateId, ...vars}).
async function enqueueFromQueue({ to, template, payload, dedupKey, userSub }) {
  return enqueueEmail({
    dedupKey,
    toUserSub: userSub || null,
    toEmail:   to,
    templateId: template,
    ...(payload || {}),
  });
}

// Sunday 18:00 US-Eastern digest cron. Per PARENT_PORTAL_MVP_SCOPE.md
// §3.6 + Cap'n's "Sunday 18:00 ET" decision. We don't use a real cron
// library — the worker tick (every 30s) checks the current ET wall
// clock; when it's Sunday hour 18, we fire once per week (idempotent on
// weekStart + dedup keys at the enqueue layer).
let _lastDigestWeek = null;
function getEasternDateParts(now = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", weekday: "short", hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const m = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    ymd:     `${m.year}-${m.month}-${m.day}`,
    hour:    parseInt(m.hour, 10),
    weekday: weekdayMap[m.weekday],
  };
}
function mondayOfWeekContaining(sundayYmd) {
  // Sunday is the END of the Mon-Sun week we just lived through.
  // Monday = Sunday - 6 days.
  const d = new Date(sundayYmd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 6);
  return d.toISOString().slice(0, 10);
}
async function maybeFireDigestCron() {
  try {
    const et = getEasternDateParts();
    if (et.weekday !== 0 || et.hour !== 18) return;          // not Sun 18:xx ET
    const weekStart = mondayOfWeekContaining(et.ymd);
    if (_lastDigestWeek === weekStart) return;               // already fired this week
    _lastDigestWeek = weekStart;
    console.log(`[parent-digest] firing weekly cron for weekStart=${weekStart}`);
    const result = await dbQueueWeeklyDigests({ weekStart, enqueueFn: enqueueFromQueue });
    console.log(`[parent-digest] queued ${result.queued || 0}, skipped ${result.skipped || 0}`);
  } catch (err) {
    console.warn(`[parent-digest] cron threw: ${err.message}`);
  }
}

// Ownership-transfer auto-complete sweep (OWNERSHIP_TRANSFER_SCOPE §3.2). Runs
// dbAutoCompleteTransfers (which does the role swap + UGC reassignment in its own
// txn) and sends/audits the result here so db.js stays free of email deps.
async function maybeRunTransferSweep() {
  try {
    const res = await dbAutoCompleteTransfers();
    for (const ev of res.events) {
      const t = ev.transfer;
      if (ev.type === "completed") {
        dbAuditEvent({ userSub: t.from_sub, eventType: "team.transfer.completed", details: { team_id: t.team_id, transfer_id: t.id, to_sub: t.to_sub, ugc_reassigned: ev.ugc_reassigned, auto: true } });
        const team = await dbGetTeam(t.team_id).catch(() => null);
        const teamName = team?.name || "the team";
        enqueueEmail({ dedupKey: `transfer-auto-new:${t.id}`, toUserSub: t.to_sub,   templateId: "transfer-completed-auto", teamName, role: "new_owner" }).catch(() => {});
        enqueueEmail({ dedupKey: `transfer-auto-old:${t.id}`, toUserSub: t.from_sub, templateId: "transfer-completed-auto", teamName, role: "former_owner" }).catch(() => {});
      } else if (ev.type === "cancelled") {
        // Auto-cancelled because the proposed owner became unavailable (open-fork
        // #1). Audit only; the owner sees the team is still theirs in-app.
        dbAuditEvent({ userSub: t.from_sub, eventType: "team.transfer.cancelled", details: { team_id: t.team_id, transfer_id: t.id, reason: "proposed_owner_unavailable", auto: true } });
      }
    }
    if (res.events.length) console.log(`[transfer] cron processed ${res.events.length} transfer(s)`);
  } catch (err) {
    console.warn(`[transfer] auto-complete sweep threw: ${err.message}`);
  }
}

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
      dbExpirePastConstraints()
        .then(r => { if (r.expired) console.log(`[psc] cron expired ${r.expired} past constraint(s)`); })
        .catch(err => console.warn(`[psc] expire sweep threw: ${err.message}`));
      maybeRunTransferSweep();
      recoverStaleSending();   // reclaim emails orphaned in 'sending' by a crash
      // Weather-advisory push sweep (Phase 5 #5 notify half). No-op unless push
      // + WeatherKit are configured; dedups internally via notifications_sent.
      runWeatherAdvisorySweep()
        .catch(err => console.warn(`[notify] weather sweep threw: ${err.message}`));
      // RSVP-reminder sweep (D1). No-op unless push is configured; dedups
      // internally via notifications_sent so each non-responder is nudged once.
      runRsvpReminderSweep()
        .catch(err => console.warn(`[notify] rsvp-reminder sweep threw: ${err.message}`));
    }
    // Parent digest cron — every tick (cheap clock check; the real fire
    // happens at most once per Sun 18:00 ET hour).
    maybeFireDigestCron();
  }, 30 * 1000);
  // Run one tick immediately so dev iteration doesn't wait 30s for the first.
  // Recover crash-orphaned 'sending' rows at startup (a deploy is the likeliest cause).
  recoverStaleSending();
  processQueue().catch(err => console.warn(`[email] initial worker tick threw: ${err.message}`));
}
