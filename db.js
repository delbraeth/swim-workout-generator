// db.js — MariaDB connection pool + per-table helpers for vero_swimgen.
//
// Connection config (pool fails to initialize if host/user/password missing):
//   Preferred: DB_CONFIG — a single JSON blob, e.g.
//     {"host":"…","user":"…","password":"…","port":3306,"name":"vero_swimgen","mode":"full"}
//   This collapses the DB_* vars into one env slot (the Hyperlift env cap is
//   tight). The legacy individual vars (DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME/
//   DB_MODE) still work as a fallback and override any unset blob key, so the cutover
//   is safe: set DB_CONFIG, verify boot, then remove the individual vars.
//
//   NOTE: DB_MODE ("full") is carried here so the var can be retired, but it is NOT
//   currently read by any app code — exported as `dbMode` for future use.
//
// TLS is required at the server (REQUIRE SSL on the user). The pool passes
// `ssl: { rejectUnauthorized: false }` — encrypted, no cert chain validation
// against the self-signed CA. Future hardening: pin the CA cert.

import { createPool } from "mariadb";
import crypto          from "crypto";
import { suggestedPhaseFromWeeksOut, weeksUntilEvent } from "./lib/season.js";
import { EVENT_KIND_VALUES, DEFAULT_EVENT_KIND } from "./src/lib/eventKinds.js";
import { RACE_EVENT_IDS, RACE_TIME_KINDS } from "./src/lib/raceEvents.js";

// Parse the optional DB_CONFIG JSON blob; malformed JSON is ignored (falls back
// to the individual vars) with a warning rather than crashing boot.
let _dbBlob = {};
if (process.env.DB_CONFIG) {
  try {
    const parsed = JSON.parse(process.env.DB_CONFIG);
    if (parsed && typeof parsed === "object") _dbBlob = parsed;
  } catch (e) {
    console.warn("[db] DB_CONFIG is not valid JSON — ignoring, using DB_* vars");
  }
}

// Individual vars take precedence when set (so an ops override always wins);
// otherwise fall back to the blob, then to defaults.
const DB_HOST     = process.env.DB_HOST     ?? _dbBlob.host;
const DB_PORT     = process.env.DB_PORT     ?? _dbBlob.port     ?? "3306";
const DB_USER     = process.env.DB_USER     ?? _dbBlob.user;
const DB_PASSWORD = process.env.DB_PASSWORD ?? _dbBlob.password;
const DB_NAME     = process.env.DB_NAME     ?? _dbBlob.name     ?? "vero_swimgen";
// Carried for env consolidation only — not consumed by the pool or app today.
export const dbMode = process.env.DB_MODE   ?? _dbBlob.mode     ?? null;

export const dbActive = Boolean(DB_HOST && DB_USER && DB_PASSWORD);

// One-line boot log of where each connection value resolved from (env var vs the
// DB_CONFIG blob) — no values printed. Lets the env cutover be verified from logs:
// after deleting the individual DB_* vars + restart, every key should read "blob".
{
  const src = (k) => (process.env[k] != null ? "env" : (_dbBlob[{
    DB_HOST: "host", DB_PORT: "port", DB_USER: "user",
    DB_PASSWORD: "password", DB_NAME: "name", DB_MODE: "mode",
  }[k]] != null ? "blob" : "default"));
  console.log(
    `[db] config sources — host=${src("DB_HOST")} port=${src("DB_PORT")} ` +
    `user=${src("DB_USER")} password=${src("DB_PASSWORD")} name=${src("DB_NAME")} ` +
    `mode=${src("DB_MODE")} (DB_CONFIG ${process.env.DB_CONFIG ? "present" : "absent"})`
  );
}

export const pool = dbActive
  ? createPool({
      host:            DB_HOST,
      port:            parseInt(DB_PORT, 10),
      user:            DB_USER,
      password:        DB_PASSWORD,
      database:        DB_NAME,
      connectionLimit: 10,
      ssl:             { rejectUnauthorized: false },
      bigIntAsNumber:  true,
    })
  : null;

// ─── boot-time ping ─────────────────────────────────────────────────────────
export async function pingDb() {
  if (!pool) return { configured: false };
  const conn = await pool.getConnection();
  try {
    const [row] = await conn.query(
      "SELECT 1 AS ok, @@have_ssl AS ssl_on, current_user() AS who"
    );
    return { configured: true, ok: row.ok, ssl: row.ssl_on, who: row.who };
  } finally {
    conn.release();
  }
}

// ─── shape conversions ──────────────────────────────────────────────────────
function dtToIso(d) {
  if (!d) return null;
  if (typeof d === "string") return d;
  if (d instanceof Date) return d.toISOString();
  return String(d);
}
function dateToYmd(d) {
  if (!d) return null;
  if (typeof d === "string") return d;
  if (d instanceof Date)    return d.toISOString().slice(0, 10);
  return String(d);
}
function isoToDt(iso) {
  if (!iso) return null;
  if (iso instanceof Date) iso = iso.toISOString();
  return String(iso).replace("T", " ").replace("Z", "");
}

function rowToWorkoutEntry(row) {
  const payload = typeof row.payload === "string" ? JSON.parse(row.payload) : (row.payload || {});
  // F4 — Spread payload FIRST, typed columns last. If a key ever exists in
  // both (e.g. an old payload still carrying a field that's since been promoted
  // to a typed column), the typed column wins. entryToWorkoutRow strips the
  // currently-typed keys before stashing payload, so today there's no overlap;
  // this ordering defends against future schema evolution.
  const e = {
    ...payload,
    id:            row.id,
    savedAt:       dtToIso(row.saved_at),
    type:          row.type,
    totalYards:    Number(row.total_yards),
    // F7 — `completed` is intentionally a client-computed value at write time
    // (the user's local calendar day decides whether the workout counts as
    // "done today"). The server stores whatever the client sent; this just
    // unpacks the TINYINT(1) column back to a boolean for the JS client.
    completed:     row.completed === 1 || row.completed === true,
    poolMode:      row.pool_mode,
  };
  if (row.user_sub)      e.sub          = row.user_sub;
  if (row.date_completed) e.dateCompleted = dateToYmd(row.date_completed);
  if (row.notes)         e.notes        = row.notes;
  if (row.initials)      e.userInitials = row.initials;
  if (row.difficulty != null) e.difficulty = Number(row.difficulty);
  if (row.focus_note)    e.focusNote    = row.focus_note;
  return e;
}

function entryToWorkoutRow(entry) {
  const { id, sub, savedAt, dateCompleted, type, totalYards, notes,
          userInitials, completed, poolMode, difficulty, focusNote,
          ...payload } = entry;
  return {
    id,
    user_sub:       sub || null,
    saved_at:       isoToDt(savedAt) || isoToDt(new Date()),
    date_completed: dateCompleted || null,
    type:           type || "mixed",
    pool_mode:      poolMode || "25y",
    total_yards:    Number(totalYards) || 0,
    notes:          notes || null,
    initials:       userInitials || null,
    // F7 — `completed` reflects the client's own "is the user's local calendar
    // day on/before dateCompleted?" check. The server intentionally does not
    // recompute against UTC: a user in PST swimming at 11pm should see the
    // workout count as "today," not "tomorrow." Default 1 (truthy) matches
    // the schema column default.
    completed:      (completed === false || completed === 0) ? 0 : 1,
    difficulty:     (difficulty == null || difficulty === "") ? null : Math.max(1, Math.min(5, Number(difficulty))),
    focus_note:     focusNote || null,
    payload:        JSON.stringify(payload),
  };
}

// ─── users ──────────────────────────────────────────────────────────────────
// Idempotent — call before any write that has a user_sub FK target.
export async function dbEnsureUser(userSub, initials = null, displayName = null) {
  if (!userSub) return;
  // Phase 4 Identity I-C: every users row must have a person_id once
  // migration 040 applies NOT NULL + FK. For NEW users we create a
  // persons row first then INSERT the users row with person_id set.
  // For RETURNING users (existing sub), we no-op — they already have
  // person_id from the I-B backfill or from a prior dbEnsureUser call.
  //
  // displayName defaulted from Google's `given_name` on first sign-up
  // per GOOGLE_OAUTH_SCOPE.md decision 11. Apple may not share a name
  // at all, in which case parseDisplayName returns first="(unknown)"
  // last="(unknown)" placeholders; user fixes via Profile later.
  //
  // Race note: two concurrent OAuth callbacks for the same new user
  // could both pass the existence check + try to INSERT. The second
  // hits ER_DUP_ENTRY on users.sub PK; we swallow it. The persons row
  // created by the loser is an orphan (no users row references it) —
  // cosmetic noise only, not harmful. Concurrent callbacks for the
  // same NEW user are vanishingly rare in practice.
  const existing = await pool.query(
    "SELECT 1 FROM `users` WHERE `sub` = ? LIMIT 1",
    [userSub]
  );
  if (existing.length > 0) return;

  const parse = parseDisplayName(displayName);
  const personId = genPersonId();
  const personInitials = initials || genInitialsFromParts(parse.first, parse.last);
  await pool.query(
    "INSERT INTO `persons` (`id`, `first_name`, `last_name`, `initials`) VALUES (?, ?, ?, ?)",
    [personId, parse.first, parse.last, personInitials]
  );
  try {
    // I-F: users no longer stores name/initials — persons (created above)
    // is the source of truth. Only sub + person_id go on the users row.
    await pool.query(
      "INSERT INTO `users` (`sub`, `person_id`) VALUES (?, ?)",
      [userSub, personId]
    );
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY" || /duplicate/i.test(e.message || "")) {
      // Lost a concurrent-insert race; the other callback's users row
      // wins. Orphan persons row stays behind (no FK from anywhere).
      return;
    }
    throw e;
  }
}

// ── OAuth provider mapping (GOOGLE_OAUTH_SCOPE.md §3.3) ───────────────
// Look up which SetForge user owns a given (provider, provider_sub) pair.
// Returns the user_sub string or null if no such mapping exists. Used by
// the Google callback to detect returning users (who get straight to
// session creation) vs new ones (who go through invite + link).
export async function dbGetUserSubByProvider(provider, providerSub) {
  if (!provider || !providerSub) return null;
  const rows = await pool.query(
    "SELECT `user_sub` FROM `user_oauth_providers` WHERE `provider` = ? AND `provider_sub` = ?",
    [provider, providerSub]
  );
  return rows[0]?.user_sub || null;
}

// Idempotent link: insert (provider, provider_sub, user_sub) if not present.
// Used both by the migration backfill conceptually and by the live Google
// callback when linking-by-verified-email succeeds.
export async function dbLinkOAuthProvider({ userSub, provider, providerSub }) {
  if (!userSub || !provider || !providerSub) {
    throw new Error("dbLinkOAuthProvider: userSub, provider, providerSub all required");
  }
  await pool.query(
    "INSERT IGNORE INTO `user_oauth_providers` (`provider`, `provider_sub`, `user_sub`) VALUES (?, ?, ?)",
    [provider, providerSub, userSub]
  );
}

// Find a user by their verified email (case-insensitive). ONLY returns a
// row when users.email_verified=1 — unverified emails are not trustworthy
// for the link-by-email path per scope decision 1. Used by the Google
// callback's link step.
//
// Apple-relay caveat: if the existing Apple row's email is the
// @privaterelay.appleid.com variant, Google's real email will never match
// it. That user ends up with two accounts per scope decision 3
// (documented limitation; manual operator merge).
export async function dbFindUserByVerifiedEmail(email) {
  if (!email) return null;
  const rows = await pool.query(
    "SELECT `sub`, `email`, `email_verified` FROM `users` WHERE LOWER(`email`) = LOWER(?) AND `email_verified` = 1 LIMIT 1",
    [email]
  );
  return rows[0] || null;
}

// ─── workouts ───────────────────────────────────────────────────────────────
// F5 — Filter is strictly `user_sub = ?` (the legacy `OR user_sub IS NULL`
// clause was dropped 2026-05-14 after a count confirmed zero orphan rows in
// prod). Session 1's /api/log-workout route also rejects writes without a
// userSub, so no new NULLs can appear. The schema still permits NULL on the
// column for forward-compat with one-off imports; if a NULL row ever appears
// it would be invisible here and would need an explicit migration to claim it.
export async function dbListWorkouts(userSub) {
  const sql = userSub
    ? "SELECT * FROM `workouts` WHERE `user_sub` = ? ORDER BY `saved_at` DESC"
    : "SELECT * FROM `workouts` ORDER BY `saved_at` DESC";
  const rows = await pool.query(sql, userSub ? [userSub] : []);
  return rows.map(rowToWorkoutEntry);
}

export async function dbWorkoutExists(id) {
  const rows = await pool.query("SELECT 1 FROM `workouts` WHERE `id` = ? LIMIT 1", [id]);
  return rows.length > 0;
}

export async function dbInsertWorkout(entry) {
  await dbEnsureUser(entry.sub, entry.userInitials);
  const row  = entryToWorkoutRow(entry);
  const cols = Object.keys(row);
  const ph   = cols.map(() => "?").join(", ");
  await pool.query(
    `INSERT INTO \`workouts\` (\`${cols.join("`, `")}\`) VALUES (${ph})`,
    cols.map(c => row[c])
  );
}

// Read a single workout by id. Returns null if not found. Used by the insert
// route to read-back the persisted entry so the client receives the DB's view
// (post-coercion, post-default) rather than its own optimistic payload.
export async function dbGetWorkout(id) {
  const rows = await pool.query("SELECT * FROM `workouts` WHERE `id` = ? LIMIT 1", [id]);
  return rows[0] ? rowToWorkoutEntry(rows[0]) : null;
}

export async function dbPatchWorkout(id, patch, userSub) {
  const cur = await pool.query("SELECT `user_sub` FROM `workouts` WHERE `id` = ?", [id]);
  if (cur.length === 0) return { ok: false, status: 404, reason: "not found" };
  if (userSub && cur[0].user_sub && cur[0].user_sub !== userSub)
    return { ok: false, status: 403, reason: "not authorized" };

  const map = {
    notes:         "notes",
    dateCompleted: "date_completed",
    completed:     "completed",
    difficulty:    "difficulty",
    focusNote:     "focus_note",
  };
  const sets = [], vals = [];
  for (const [k, col] of Object.entries(map)) {
    if (k in patch) {
      sets.push(`\`${col}\` = ?`);
      let v = patch[k];
      if (k === "completed")  v = v ? 1 : 0;
      if (k === "difficulty") v = (v == null || v === "") ? null : Math.max(1, Math.min(5, Number(v)));
      if (k === "focusNote")  v = v || null;
      vals.push(v);
    }
  }
  if (sets.length) {
    vals.push(id);
    await pool.query(`UPDATE \`workouts\` SET ${sets.join(", ")} WHERE \`id\` = ?`, vals);
  }
  const rows = await pool.query("SELECT * FROM `workouts` WHERE `id` = ?", [id]);
  return { ok: true, entry: rows[0] ? rowToWorkoutEntry(rows[0]) : null };
}

export async function dbDeleteWorkout(id, userSub) {
  const cur = await pool.query("SELECT * FROM `workouts` WHERE `id` = ?", [id]);
  if (cur.length === 0) return { ok: false, status: 404, reason: "not found" };
  if (userSub && cur[0].user_sub && cur[0].user_sub !== userSub)
    return { ok: false, status: 403, reason: "not authorized" };
  await pool.query("DELETE FROM `workouts` WHERE `id` = ?", [id]);
  return { ok: true, removed: rowToWorkoutEntry(cur[0]) };
}

// ─── settings ───────────────────────────────────────────────────────────────
export async function dbGetSettings(userSub) {
  if (!userSub) return {};
  const rows = await pool.query("SELECT * FROM `settings` WHERE `user_sub` = ?", [userSub]);
  if (!rows[0]) return {};
  const r = rows[0], out = {};
  if (r.slider_min != null) out.sliderMin = Number(r.slider_min);
  if (r.slider_max != null) out.sliderMax = Number(r.slider_max);
  if (r.pace_input != null) out.paceInput = r.pace_input;
  if (r.extra)              Object.assign(out, typeof r.extra === "string" ? JSON.parse(r.extra) : r.extra);
  // Merge per-user favorites and initials from their respective tables,
  // so the response shape matches what the client previously got from json.settings[sub].
  return out;
}

// Merge-patch the JSON `extra` column. Keys with value `null` are deleted.
// Used for ad-hoc per-user settings that don't merit dedicated columns
// (e.g. Q's `next_event`).
export async function dbPatchSettingsExtra(userSub, partial) {
  if (!userSub) return;
  if (!partial || typeof partial !== "object") return;
  await dbEnsureUser(userSub);
  const rows = await pool.query("SELECT `extra` FROM `settings` WHERE `user_sub` = ?", [userSub]);
  let current = {};
  if (rows[0]?.extra) {
    current = typeof rows[0].extra === "string" ? JSON.parse(rows[0].extra) : rows[0].extra;
  }
  const merged = { ...current };
  for (const [k, v] of Object.entries(partial)) {
    if (v === null || v === undefined) delete merged[k];
    else merged[k] = v;
  }
  await pool.query(
    "INSERT INTO `settings` (`user_sub`, `extra`) VALUES (?, ?) " +
    "ON DUPLICATE KEY UPDATE `extra` = VALUES(`extra`)",
    [userSub, JSON.stringify(merged)]
  );
}

export async function dbUpsertSettings(userSub, patch) {
  if (!userSub) return;
  await dbEnsureUser(userSub);
  const map = { sliderMin: "slider_min", sliderMax: "slider_max", paceInput: "pace_input" };
  // If patch carries `initials`, store on the person (I-F: not users.initials)
  if ("initials" in patch && patch.initials != null) {
    await dbUpdatePersonFromUserSub(userSub, { initials: patch.initials });
  }
  const cur = await dbGetSettings(userSub);
  const merged = { ...cur, ...patch };
  const cols = ["user_sub"], vals = [userSub], updates = [];
  for (const [k, col] of Object.entries(map)) {
    if (k in merged) {
      cols.push(col);
      vals.push(merged[k]);
      updates.push(`\`${col}\` = VALUES(\`${col}\`)`);
    }
  }
  if (cols.length === 1) return;
  const ph = cols.map(() => "?").join(", ");
  await pool.query(
    `INSERT INTO \`settings\` (\`${cols.join("`, `")}\`) VALUES (${ph})
     ON DUPLICATE KEY UPDATE ${updates.join(", ")}`,
    vals
  );
}

// ─── sessions ───────────────────────────────────────────────────────────────
const DEFAULT_SESSION_TTL_SEC = 60 * 60 * 24 * 30;   // 30 days

function newSessionId() {
  return crypto.randomBytes(32).toString("base64url");
}
function nowDt() {
  return new Date().toISOString().replace("T", " ").replace("Z", "");
}
function futureDt(secondsFromNow) {
  return new Date(Date.now() + secondsFromNow * 1000)
    .toISOString().replace("T", " ").replace("Z", "");
}

export async function dbCreateSession({ userSub, ip = null, userAgent = null, ttlSeconds = DEFAULT_SESSION_TTL_SEC }) {
  if (!userSub) throw new Error("userSub required");
  const id = newSessionId();
  await pool.query(
    "INSERT INTO `sessions` (`id`, `user_sub`, `created_at`, `expires_at`, `last_seen_at`, `ip`, `user_agent`) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, userSub, nowDt(), futureDt(ttlSeconds), nowDt(), ip, userAgent ? String(userAgent).slice(0, 255) : null]
  );
  // Stamp the user's last-login timestamp as a side effect.
  await pool.query("UPDATE `users` SET `last_login_at` = NOW(3) WHERE `sub` = ?", [userSub]);
  return id;
}

export async function dbGetSession(id) {
  if (!id) return null;
  const rows = await pool.query(
    `SELECT * FROM \`sessions\`
      WHERE \`id\` = ?
        AND \`revoked_at\` IS NULL
        AND \`expires_at\` > NOW()
      LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function dbTouchSession(id, ip = null) {
  if (!id) return;
  await pool.query(
    "UPDATE `sessions` SET `last_seen_at` = NOW(3), `ip` = COALESCE(?, `ip`) WHERE `id` = ? AND `revoked_at` IS NULL",
    [ip, id]
  );
}

export async function dbRevokeSession(id) {
  if (!id) return;
  await pool.query(
    "UPDATE `sessions` SET `revoked_at` = NOW(3) WHERE `id` = ? AND `revoked_at` IS NULL",
    [id]
  );
}

// Revoke a session by its id prefix, scoped to a specific user (so users can
// only revoke their own sessions). Returns { ok, revoked } or { ok: false, reason }.
export async function dbRevokeSessionByPrefix(userSub, prefix) {
  if (!userSub || !prefix || prefix.length < 6) return { ok: false, reason: "invalid_prefix" };
  // Use LIKE 'prefix%' to match the full session ID. base64url is safe (no SQL special chars),
  // but escape % and _ just in case.
  const safe = String(prefix).replace(/[\\%_]/g, "\\$&");
  const rows = await pool.query(
    "SELECT `id` FROM `sessions` WHERE `user_sub` = ? AND `id` LIKE CONCAT(?, '%') AND `revoked_at` IS NULL AND `expires_at` > NOW()",
    [userSub, safe]
  );
  if (rows.length === 0) return { ok: false, reason: "not_found" };
  if (rows.length > 1)  return { ok: false, reason: "ambiguous_prefix" };
  const id = rows[0].id;
  await pool.query("UPDATE `sessions` SET `revoked_at` = NOW(3) WHERE `id` = ?", [id]);
  return { ok: true, revoked: id };
}

export async function dbRevokeOthersByUser(userSub, exceptId = null) {
  if (!userSub) return 0;
  const sql = exceptId
    ? "UPDATE `sessions` SET `revoked_at` = NOW(3) WHERE `user_sub` = ? AND `id` <> ? AND `revoked_at` IS NULL"
    : "UPDATE `sessions` SET `revoked_at` = NOW(3) WHERE `user_sub` = ? AND `revoked_at` IS NULL";
  const args = exceptId ? [userSub, exceptId] : [userSub];
  const r = await pool.query(sql, args);
  return Number(r.affectedRows || 0);
}

// Lazy-generate and return the CSRF token for a session. Returns null if
// the session doesn't exist / is revoked / expired.
export async function dbGetOrCreateCsrf(sessionId) {
  if (!sessionId) return null;
  const rows = await pool.query(
    `SELECT \`csrf_token\` FROM \`sessions\`
      WHERE \`id\` = ? AND \`revoked_at\` IS NULL AND \`expires_at\` > NOW()
      LIMIT 1`,
    [sessionId]
  );
  if (!rows[0]) return null;
  if (rows[0].csrf_token) return rows[0].csrf_token;
  const token = crypto.randomBytes(24).toString("base64url");
  await pool.query(
    "UPDATE `sessions` SET `csrf_token` = ? WHERE `id` = ? AND `csrf_token` IS NULL",
    [token, sessionId]
  );
  return token;
}

// Constant-time compare of supplied CSRF header against the session's stored token.
export async function dbVerifyCsrf(sessionId, supplied) {
  if (!sessionId || !supplied) return false;
  const rows = await pool.query(
    `SELECT \`csrf_token\` FROM \`sessions\`
      WHERE \`id\` = ? AND \`revoked_at\` IS NULL AND \`expires_at\` > NOW()
      LIMIT 1`,
    [sessionId]
  );
  if (!rows[0] || !rows[0].csrf_token) return false;
  const a = Buffer.from(rows[0].csrf_token);
  const b = Buffer.from(supplied);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function dbListSessions(userSub) {
  if (!userSub) return [];
  const rows = await pool.query(
    `SELECT \`id\`, \`created_at\`, \`expires_at\`, \`last_seen_at\`, \`ip\`, \`user_agent\`
       FROM \`sessions\`
      WHERE \`user_sub\` = ? AND \`revoked_at\` IS NULL AND \`expires_at\` > NOW()
      ORDER BY \`last_seen_at\` DESC`,
    [userSub]
  );
  // Don't expose raw session IDs in the API response — that's the cookie value.
  // Replace with a short prefix so the user can tell sessions apart in UI.
  return rows.map(r => ({
    id_prefix:    String(r.id).slice(0, 8),
    created_at:   r.created_at,
    expires_at:   r.expires_at,
    last_seen_at: r.last_seen_at,
    ip:           r.ip,
    user_agent:   r.user_agent,
  }));
}

// ─── audit_events ───────────────────────────────────────────────────────────
// S5 S5 — CONTRACT: never throws, never rejects. Callers MUST NOT `.catch()`
// or `await` this for error handling — it's fire-and-forget by design so audit
// issues never affect user-facing requests. The function logs failures (DB
// down, JSON.stringify on a circular `details` object, etc.) and resolves.
// Pass `details` as a plain object; it'll be JSON-stringified.
export async function dbAuditEvent({ userSub = null, eventType, ip = null, userAgent = null, details = null, impersonatorSub = null }) {
  if (!pool) return;
  try {
    let detailsJson = null;
    if (details) {
      try {
        detailsJson = JSON.stringify(details);
      } catch (jsonErr) {
        console.warn("[audit] details JSON.stringify failed:", jsonErr.message, "eventType=", eventType);
        detailsJson = JSON.stringify({ __audit_error: "details_serialization_failed" });
      }
    }
    // v3 impersonation (2026-05-22): when the request is acting through
    // an active impersonation session, impersonatorSub carries the admin
    // who initiated. user_sub still records the TARGET — so a normal
    // audit query for "what happened to user X" surfaces impersonated
    // events too, while filtering by impersonator_sub answers "what did
    // admin A do while impersonating".
    await pool.query(
      "INSERT INTO `audit_events` (`user_sub`, `event_type`, `ip`, `user_agent`, `details`, `impersonator_sub`) VALUES (?, ?, ?, ?, ?, ?)",
      [userSub, eventType, ip, userAgent ? String(userAgent).slice(0, 255) : null, detailsJson, impersonatorSub]
    );
  } catch (err) {
    console.warn("[audit] insert failed:", err.message);
  }
}

// ─── profile / me ───────────────────────────────────────────────────────────
// Returns the user's identity + workout stats grouped by pool mode.
export async function dbGetMe(sub) {
  if (!sub) return null;
  const conn = await pool.getConnection();
  try {
    // Phase 4 Identity I-D: display_name + initials now computed from
    // persons via JOIN. users.display_name + users.initials remain as
    // legacy columns (dropped in I-F after 30-day soak). LEFT JOIN
    // (rather than INNER) is defensive — every user has person_id after
    // I-B backfill, but I-C hasn't applied yet so the FK isn't enforced.
    // If person row is missing for any reason, displayNameInline returns
    // "(unknown)" rather than crashing.
    const userRows = await conn.query(
      "SELECT u.`sub`, u.`email`, u.`email_verified`, " +
      "       u.`is_admin`, u.`is_coach`, u.`tier`, " +
      "       u.`created_at`, u.`last_login_at`, " +
      "       p.`first_name`, p.`last_name`, p.`preferred_name`, " +
      "       p.`initials` AS person_initials, " +
      "       p.`dob` AS person_dob, p.`gender` AS person_gender, p.`class_year` AS person_class_year, " +
      "       xe.`external_id` AS usa_swimming_id " +
      "  FROM `users` u " +
      "  LEFT JOIN `persons` p ON p.`id` = u.`person_id` " +
      "  LEFT JOIN `person_external_ids` xe ON xe.`person_id` = u.`person_id` AND xe.`system` = 'usa_swimming' " +
      " WHERE u.`sub` = ?",
      [sub]
    );
    if (!userRows[0]) return null;
    const u = userRows[0];
    const displayName = displayNameInline({ first_name: u.first_name, last_name: u.last_name, preferred_name: u.preferred_name });
    const initials = u.person_initials;
    const dob    = u.person_dob;
    const gender = u.person_gender;
    const statsRows = await conn.query(
      "SELECT `pool_mode`, COUNT(*) AS n, SUM(`total_yards`) AS total FROM `workouts` WHERE `user_sub` = ? GROUP BY `pool_mode`",
      [sub]
    );
    const stats = statsRows.map(r => ({ pool_mode: r.pool_mode, count: Number(r.n), total: Number(r.total) }));
    const workoutCount = stats.reduce((s, r) => s + r.count, 0);

    // Pending feedback count — admins only. Drives the count badge on the
    // 🛡 admin top-nav button so unreviewed feedback is visible at a glance.
    // Cheap query (indexed on (status, created_at DESC) per migration 007).
    let pendingFeedbackCount = 0;
    if (u.is_admin) {
      const fbRows = await conn.query(
        "SELECT COUNT(*) AS n FROM `feedback` WHERE `status` = 'new'"
      );
      pendingFeedbackCount = Number(fbRows[0]?.n || 0);
    }

    // OAuth providers linked to this user. Drives the banner provider-icon
    // tagline so the user can tell at a glance which OAuth account they're
    // signed in as (resolves dual-account confusion when someone has both
    // Apple + Google subs registered as separate users).
    const providerRows = await conn.query(
      "SELECT `provider`, `linked_at` FROM `user_oauth_providers` WHERE `user_sub` = ? ORDER BY `linked_at` ASC",
      [sub]
    );
    const providers = providerRows.map(r => ({ provider: r.provider, linked_at: r.linked_at }));

    // Parent Portal MVP: is_parent computed from existence of any active
    // guardians row pointing at this user's person_id. Drives the App
    // top-level branch to ParentDashboard when user is parent-only (not
    // also coach). Family-coach case (parent + coach) stays on App with
    // a "View as parent" toggle.
    let isParent = false;
    if (u.first_name) {  // implies persons row exists; FK target is valid
      const guardCheck = await conn.query(
        "SELECT 1 FROM `guardians` g JOIN `users` uu ON uu.`person_id` = g.`guardian_person_id` " +
        "WHERE uu.`sub` = ? AND g.`removed_at` IS NULL LIMIT 1",
        [sub]
      );
      isParent = guardCheck.length > 0;
    }

    // Parent Portal MVP: digest_paused lives on settings (per-parent
    // opt-out, default ON). Pulled here so ParentDashboard can render
    // the pause toggle without a second round-trip on mount.
    let digestPaused = false;
    if (isParent) {
      const sRows = await conn.query(
        "SELECT `digest_paused` FROM `settings` WHERE `user_sub` = ? LIMIT 1",
        [sub]
      );
      digestPaused = !!(sRows[0] && sRows[0].digest_paused);
    }

    return {
      sub:                     u.sub,
      email:                   u.email,
      email_verified:          !!u.email_verified,
      display_name:            displayName,
      initials:                initials,
      providers:               providers,
      // DOB returned only to the user themselves (this endpoint is always
      // self-scoped). Other endpoints expose only the derived `is_minor` to
      // protect the raw DATE per decision #27.
      dob:                     dateToYmd(dob),
      is_minor:                isMinor(dob),                                   // null when DOB unset
      gender:                  gender,                                          // M/F/X/prefer_not_to_say/null
      class_year:              u.person_class_year != null ? Number(u.person_class_year) : null,
      grade:                   gradeFromClassYear(u.person_class_year),         // derived; null if class_year unset
      usa_swimming_id:         u.usa_swimming_id || null,
      is_admin:                !!u.is_admin,
      // Coach is granted by either explicit is_coach flag OR is_admin (admin
      // implicitly has coach capability). Mirrors dbIsCoach's check.
      is_coach:                !!(u.is_coach || u.is_admin),
      // Billing tier (free/coach/lesson/program). Lesson tier (Phase 5) is
      // ADDITIVE: Coach/Program are a superset, so lesson surfaces also unlock
      // for coaches/admins. `can_lesson` is the single client-side gate for the
      // Lesson workout type, managed-swimmer roster, per-swimmer equipment, and
      // the parent-recap export. Mirrors the server-side dbHasLessonAccess check.
      tier:                    u.tier || "free",
      can_lesson:              !!(u.is_coach || u.is_admin) || ["lesson", "coach", "program"].includes(u.tier || "free"),
      created_at:              u.created_at,
      last_login_at:           u.last_login_at,
      workout_count:           workoutCount,
      stats_by_pool:           stats,
      pending_feedback_count:  pendingFeedbackCount,
      is_parent:               isParent,
      digest_paused:           digestPaused,
    };
  } finally {
    conn.release();
  }
}

// ─── bootstrap (composite endpoint) ─────────────────────────────────────────
// Fans out all the parallel reads the App fires on mount as a single
// in-process Promise.allSettled. Returns one payload with named sections
// so the client can populate ~13 separate React states from one HTTP
// round-trip. Per the 429 / fetch-storm investigation in [[swim-generator-roadmap-pointer]]
// backlog — the proper architectural fix for app-load chattiness, even
// though the rate-limit pressure itself was solved by bumping the
// writeLimiter ceiling.
//
// Promise.allSettled (not .all) so a single helper failure doesn't tank
// the whole bootstrap — affected sections come back as their fallback
// shape ([], {}, null) and the section name lands in _errors[]. Client
// can then decide per-section whether to retry or render degraded.
//
// NOT included (kept as separate endpoints):
//   - /api/auth/status, /api/auth/csrf — different lifecycle, run before
//     the user is even authenticated
//   - /api/billing/* — composed at the route layer (lib/billing.js
//     getBillingStatusFor isn't a db.js helper, doesn't belong here)
//   - sessions, coach-impact, view-specific reads — fetched lazily by
//     ProfileModal / TeamsView / AssignedToMe on their own mount
//   - /api/picker/coach-targets, /api/events/upcoming — view-specific
export async function dbGetBootstrapForUser(userSub) {
  if (!userSub) return null;
  const results = await Promise.allSettled([
    dbGetMe(userSub),                          // 0
    dbListWorkouts(userSub),                   // 1
    dbGetSettings(userSub),                    // 2
    dbListFavorites(userSub),                  // 3
    dbListDisfavorites(userSub),               // 4
    dbListFavoriteSets(userSub),               // 5
    dbListDisfavorSets(userSub),               // 6
    dbGetEffectiveFavorites(userSub),          // 7
    dbGetEffectiveDisfavorites(userSub),       // 8
    dbGetUgcOverlay(userSub),                  // 9
    dbListGoals(userSub),                      // 10
    dbListAnchorsForMemberSwimmer(userSub),    // 11
    dbListMyActiveConstraints(userSub),        // 12
    dbListSessions(userSub),                   // 13 — added in B for ProfileModal-open
    dbListTeamDefaultsForUser(userSub),        // 14 — added in B for ProfileModal-open
    (async () => {                             // 15 — pending parent invites (explicit-accept card)
      const ur = await pool.query("SELECT `email`, `email_verified` FROM `users` WHERE `sub` = ? LIMIT 1", [userSub]);
      const u = ur[0];
      if (!u || !u.email || !u.email_verified) return [];
      return dbListPendingInvitesForUser(userSub, u.email);
    })(),
  ]);
  const sectionNames = [
    "me", "workouts", "settings", "favorites", "disfavorites",
    "favoriteSets", "disfavorSets", "effectiveFavorites", "effectiveDisfavorites",
    "ugcOverlay", "goals", "groupAnchors", "myConstraints",
    "sessions", "teamDefaults", "pendingInvites",
  ];
  const fallbacks = [
    null, [], {}, [], [],
    [], [], null, null,
    {}, [], {}, { constraints: [] },
    [], [], [],
  ];
  const out = {};
  const errs = [];
  for (let i = 0; i < sectionNames.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      out[sectionNames[i]] = r.value;
    } else {
      out[sectionNames[i]] = fallbacks[i];
      errs.push({ section: sectionNames[i], error: r.reason?.message || String(r.reason) });
      console.warn(`[bootstrap] section '${sectionNames[i]}' failed for ${userSub}: ${r.reason?.message || r.reason}`);
    }
  }
  if (errs.length > 0) out._errors = errs;
  return out;
}

// ─── generation context (server-side curation rehydration) ──────────────────
// Assembles the curation inputs `generateWorkout` expects, loaded from the DB
// and merged own + coach-propagated exactly as the SPA's Generate handler does
// (public/index.html ~26850): own labels/set-ids/engine-tuples unioned with the
// effective (coach-inherited) sets. Returned pieces are spread into the engine
// opts by POST /api/generate, so the native client only sends FORM inputs
// (type, yardage, pool, equipment, bias) and never its own curation lists.
//
// Set-valued ids match the SPA: favoriteSetIds/disfavorSetIds are JS Sets (the
// engine uses `.has()`/`.size`). Resilient per-source: any failing query
// degrades to empty so a generate never 500s on a single curation read.
export async function dbGetGenerationContextForUser(userSub) {
  if (!userSub) return null;
  const safe = (p, fb) => p.catch(() => fb);
  const [favs, disfavs, favSets, disfavSets, effFav, effDis, ugc, constraints, settings] =
    await Promise.all([
      safe(dbListFavorites(userSub), []),
      safe(dbListDisfavorites(userSub), []),
      safe(dbListFavoriteSets(userSub), []),
      safe(dbListDisfavorSets(userSub), []),
      safe(dbGetEffectiveFavorites(userSub),    { labels: [], set_ids: [], engine: [] }),
      safe(dbGetEffectiveDisfavorites(userSub), { labels: [], set_ids: [], engine: [] }),
      safe(dbGetUgcOverlay(userSub), {}),
      safe(dbListMyActiveConstraints(userSub), { constraints: [] }),
      safe(dbGetSettings(userSub), {}),
    ]);

  const ownEngineFav = Array.isArray(settings.engine_favorites)    ? settings.engine_favorites    : [];
  const ownEngineDis = Array.isArray(settings.engine_disfavorites) ? settings.engine_disfavorites : [];
  const dedupeEngine = (arr) => {
    const seen = new Set();
    const out = [];
    for (const e of arr) {
      if (!e || e.template_id == null) continue;
      const k = `${e.template_id}:${e.stroke}`;
      if (!seen.has(k)) { seen.add(k); out.push({ template_id: e.template_id, stroke: e.stroke }); }
    }
    return out;
  };

  return {
    favorites:          Array.from(new Set([...(favs || []),    ...(effFav.labels  || [])])),
    disfavorites:       Array.from(new Set([...(disfavs || []), ...(effDis.labels  || [])])),
    favoriteSetIds:     new Set([...(favSets || []),    ...(effFav.set_ids || [])]),
    disfavorSetIds:     new Set([...(disfavSets || []), ...(effDis.set_ids || [])]),
    engineFavorites:    dedupeEngine([...ownEngineFav, ...(effFav.engine || [])]),
    engineDisfavorites: dedupeEngine([...ownEngineDis, ...(effDis.engine || [])]),
    ugcOverlay:         (ugc && Object.keys(ugc).length) ? ugc : null,
    myConstraints:      Array.isArray(constraints?.constraints) ? constraints.constraints : [],
    disfavorMode:       settings.disfavorMode || settings.disfavor_mode || "downweight",
  };
}

// ─── auth helpers ───────────────────────────────────────────────────────────
export async function dbIsUser(sub) {
  if (!sub) return false;
  const rows = await pool.query(
    "SELECT 1 FROM `users` WHERE `sub` = ? AND `is_disabled` = 0 LIMIT 1",
    [sub]
  );
  return rows.length > 0;
}

// v3 impersonation — grants impersonation rights without full admin.
// is_admin OR support_role both qualify (checked at the route layer).
export async function dbIsSupportRole(sub) {
  if (!sub) return false;
  const rows = await pool.query("SELECT `support_role` FROM `users` WHERE `sub` = ? LIMIT 1", [sub]);
  return rows.length > 0 && (rows[0].support_role === 1 || rows[0].support_role === true);
}

export async function dbIsAdmin(sub) {
  if (!sub) return false;
  const rows = await pool.query(
    "SELECT 1 FROM `users` WHERE `sub` = ? AND `is_admin` = 1 AND `is_disabled` = 0 LIMIT 1",
    [sub]
  );
  return rows.length > 0;
}

// Coach access tier — separate from admin. Used to gate the workout-bank
// catalog (Phase I read-only). Admins implicitly inherit coach capability,
// so this returns true when the user is admin OR coach. Disabled users
// always return false regardless of flags.
export async function dbIsCoach(sub) {
  if (!sub) return false;
  const rows = await pool.query(
    "SELECT 1 FROM `users` WHERE `sub` = ? AND (`is_coach` = 1 OR `is_admin` = 1) AND `is_disabled` = 0 LIMIT 1",
    [sub]
  );
  return rows.length > 0;
}

// List coaches for picker UIs (Teams / group_coaches add flow).
// Minimal info — no email, no DOB — to keep PII exposure low. Excludes the
// caller themselves so they can't try to add themselves to a team they
// already own.
// Privacy note: v1 lists ALL coaches system-wide. At multi-tenant scale this
// becomes PII leakage; scope down (e.g., "only coaches in teams I'm in") when
// the threat model warrants.
// Lesson tier (Phase 5) — entitlement check for lesson surfaces (Lesson workout
// type, managed-swimmer roster, per-swimmer equipment, parent-recap export).
// ADDITIVE: Coach/Program tiers + admins are a superset, so they pass too.
// Mirrors the `can_lesson` flag on the dbGetMe payload. Server-side gate for the
// recap route and lesson-tier managed-swimmer access.
export async function dbHasLessonAccess(sub) {
  if (!sub) return false;
  const rows = await pool.query(
    "SELECT 1 FROM `users` WHERE `sub` = ? AND `is_disabled` = 0 " +
    "  AND (`is_coach` = 1 OR `is_admin` = 1 OR `tier` IN ('lesson','coach','program')) LIMIT 1",
    [sub]
  );
  return rows.length > 0;
}

export async function dbListCoachesForPicker(excludeSub) {
  // Identity: name/initials come from persons (JOIN via person_id); sorted
  // by persons.last_name, first_name. Legacy users columns dropped in 044.
  const rows = await pool.query(
    "SELECT u.`sub`, " +
    "       p.`first_name`, p.`last_name`, p.`preferred_name`, p.`initials` AS person_initials " +
    "  FROM `users` u " +
    "  LEFT JOIN `persons` p ON p.`id` = u.`person_id` " +
    " WHERE (u.`is_coach` = 1 OR u.`is_admin` = 1) AND u.`is_disabled` = 0 AND u.`sub` != ? " +
    " ORDER BY p.`last_name` ASC, p.`first_name` ASC",
    [excludeSub || ""]
  );
  return rows.map(r => ({
    sub:          r.sub,
    display_name: displayNameInline({ first_name: r.first_name, last_name: r.last_name, preferred_name: r.preferred_name }),
    initials:     r.person_initials,
  }));
}

// ─── admin helpers ──────────────────────────────────────────────────────────
export async function dbAdminListUsers() {
  // Identity (display_name + initials) comes from persons via person_id.
  // Legacy users columns dropped in migration 044.
  const rows = await pool.query(`
    SELECT u.sub, u.email, u.email_verified,
           u.is_admin, u.is_coach, u.is_disabled, u.support_role, u.created_at, u.last_login_at,
           u.tier, u.tier_granted_at, u.tier_source, u.stripe_customer_id,
           p.first_name, p.last_name, p.preferred_name, p.initials AS person_initials,
           COALESCE(w.cnt, 0) AS workout_count
      FROM users u
      LEFT JOIN persons p ON p.id = u.person_id
      LEFT JOIN (SELECT user_sub, COUNT(*) AS cnt FROM workouts GROUP BY user_sub) w
        ON w.user_sub = u.sub
      ORDER BY u.created_at DESC
  `);
  return rows.map(r => ({
    sub: r.sub, email: r.email, email_verified: !!r.email_verified,
    display_name: displayNameInline({ first_name: r.first_name, last_name: r.last_name, preferred_name: r.preferred_name }),
    initials: r.person_initials,
    is_admin: !!r.is_admin, is_coach: !!r.is_coach, is_disabled: !!r.is_disabled,
    support_role: !!r.support_role,
    tier:                 r.tier || "free",
    tier_granted_at:      r.tier_granted_at,
    tier_source:          r.tier_source,
    has_stripe_customer:  !!r.stripe_customer_id,
    created_at: r.created_at, last_login_at: r.last_login_at,
    workout_count: Number(r.workout_count),
  }));
}

export async function dbAdminSetUserFlag(sub, field, value) {
  if (!sub) return { ok: false, reason: "no_sub" };
  // Whitelist of toggleable boolean fields. is_coach was added 2026-05-15
  // for the in-app catalog (coach access tier). is_admin already implies
  // coach via dbIsCoach, so explicit coach toggle is for non-admin users
  // who should be able to browse the catalog.
  // support_role added 2026-05-22 for view-as v3 impersonation (per
  // VIEW_AS_V3_SCOPE.md). Grants the right to start an impersonation
  // session without needing full admin privileges. Server route that
  // calls this must require is_admin (so support_role can't elevate).
  if (!["is_disabled", "is_admin", "is_coach", "support_role"].includes(field)) return { ok: false, reason: "bad_field" };
  await pool.query(`UPDATE \`users\` SET \`${field}\` = ? WHERE \`sub\` = ?`, [value ? 1 : 0, sub]);
  return { ok: true };
}

// ─── v3 impersonation (view-as v3) ──────────────────────────────────────────
// Customer-support feature per VIEW_AS_V3_SCOPE.md. Header-based: admin
// starts session, every API call sends X-Impersonate-Sub, server middleware
// validates against an active row in impersonation_sessions and rewrites
// req.userSub. Read-only enforced server-side.

const IMPERSONATION_CAP_MIN = 30; // hard cap per scope §1

// Start a new impersonation session for an admin acting as a target user.
// Idempotently ends any prior active session for this admin first — one
// admin can have AT MOST one active session at a time. Returns the new row.
export async function dbStartImpersonation(adminSub, targetSub) {
  if (!adminSub || !targetSub) return { ok: false, reason: "missing_sub" };
  if (adminSub === targetSub) return { ok: false, reason: "self_impersonation_forbidden" };
  // End any prior active session for this admin (one-at-a-time invariant).
  await pool.query(
    "UPDATE `impersonation_sessions` SET `ended_at` = NOW(), `end_reason` = 'admin_revoked' " +
    "WHERE `admin_sub` = ? AND `ended_at` IS NULL",
    [adminSub]
  );
  // Confirm target exists (defense — caller should already have validated).
  const targetRows = await pool.query("SELECT 1 FROM `users` WHERE `sub` = ? LIMIT 1", [targetSub]);
  if (!targetRows.length) return { ok: false, reason: "target_not_found" };
  // Insert new session.
  const result = await pool.query(
    "INSERT INTO `impersonation_sessions` (`admin_sub`, `target_sub`, `expires_at`) " +
    `VALUES (?, ?, NOW() + INTERVAL ${IMPERSONATION_CAP_MIN} MINUTE)`,
    [adminSub, targetSub]
  );
  // Read back to get authoritative timestamps.
  const rows = await pool.query(
    "SELECT `id`, `admin_sub`, `target_sub`, `started_at`, `expires_at` " +
    "FROM `impersonation_sessions` WHERE `id` = ?",
    [result.insertId]
  );
  if (!rows.length) return { ok: false, reason: "insert_readback_failed" };
  return { ok: true, session: rows[0] };
}

// End the admin's active impersonation session, if any. Idempotent.
// reason ∈ "exit" | "expired" | "admin_revoked". Returns count ended.
export async function dbEndImpersonation(adminSub, reason = "exit") {
  if (!adminSub) return { ok: false, reason: "missing_sub", ended: 0 };
  const valid = ["exit", "expired", "admin_revoked"];
  if (!valid.includes(reason)) reason = "exit";
  const result = await pool.query(
    "UPDATE `impersonation_sessions` SET `ended_at` = NOW(), `end_reason` = ? " +
    "WHERE `admin_sub` = ? AND `ended_at` IS NULL",
    [reason, adminSub]
  );
  return { ok: true, ended: Number(result.affectedRows || 0) };
}

// Return the admin's currently-active impersonation session, or null.
// "Active" = ended_at IS NULL AND expires_at > NOW().
// Also lazily marks any expired-but-not-yet-ended row as ended (cleanup).
export async function dbGetActiveImpersonation(adminSub) {
  if (!adminSub) return null;
  // Lazy expiry cleanup: end any expired sessions for this admin.
  await pool.query(
    "UPDATE `impersonation_sessions` SET `ended_at` = `expires_at`, `end_reason` = 'expired' " +
    "WHERE `admin_sub` = ? AND `ended_at` IS NULL AND `expires_at` <= NOW()",
    [adminSub]
  );
  const rows = await pool.query(
    "SELECT `id`, `admin_sub`, `target_sub`, `started_at`, `expires_at` " +
    "FROM `impersonation_sessions` " +
    "WHERE `admin_sub` = ? AND `ended_at` IS NULL " +
    "ORDER BY `id` DESC LIMIT 1",
    [adminSub]
  );
  return rows[0] || null;
}

// Validate that the admin's current impersonation session matches the
// header's claimed target_sub. Called by auth middleware on every request
// that carries X-Impersonate-Sub. Returns true iff the session exists,
// matches the header, and hasn't expired.
export async function dbValidateImpersonationHeader(adminSub, claimedTargetSub) {
  if (!adminSub || !claimedTargetSub) return false;
  const active = await dbGetActiveImpersonation(adminSub);
  if (!active) return false;
  return active.target_sub === claimedTargetSub;
}

// Admin edits to a user's display fields. Only allows email, initials, display_name.
// Self-serve profile update. Unlike dbAdminUpdateUser, this resets
// `email_verified` to 0 whenever the email value changes (the new
// address has not been verified through Apple's flow yet).
const GENDER_VALUES = ["M", "F", "X", "prefer_not_to_say"];
export async function dbUpdateMe(sub, patch) {
  if (!sub) return { ok: false, reason: "no_sub" };
  // I-F split: email + email_verified live on `users`; name/initials/gender/
  // class_year live on `persons` (routed through dbUpdatePersonFromUserSub).
  const sets = [], vals = [];
  // If email is changing, also blank `email_verified` so the UI badge
  // reflects reality. We have to read the current value to know if it
  // changed — comparing before/after avoids resetting verification
  // when the user submits without actually altering the field.
  let resetVerified = false;
  if ("email" in patch) {
    const current = await pool.query("SELECT `email` FROM `users` WHERE `sub` = ?", [sub]);
    const oldEmail = current[0]?.email || null;
    const newEmail = patch.email === "" ? null : patch.email;
    if (oldEmail !== newEmail) resetVerified = true;
    sets.push("`email` = ?");
    vals.push(newEmail);
  }
  if (resetVerified) sets.push("`email_verified` = 0");
  if (sets.length) {
    vals.push(sub);
    await pool.query(`UPDATE \`users\` SET ${sets.join(", ")} WHERE \`sub\` = ?`, vals);
  }
  // Person-side fields.
  const personPatch = {};
  for (const k of ["display_name", "initials", "gender", "class_year", "usa_swimming_id"]) {
    if (k in patch) personPatch[k] = patch[k];
  }
  if (Object.keys(personPatch).length) {
    const pr = await dbUpdatePersonFromUserSub(sub, personPatch);
    if (!pr.ok) return pr;
  }
  return { ok: true };
}

export async function dbAdminUpdateUser(sub, patch) {
  if (!sub) return { ok: false, reason: "no_sub" };
  // I-F split, mirror of dbUpdateMe: email/email_verified on `users`,
  // name/initials/gender/class_year on `persons`.
  const sets = [], vals = [];
  let resetVerified = false;
  if ("email" in patch) {
    const current = await pool.query("SELECT `email` FROM `users` WHERE `sub` = ?", [sub]);
    const oldEmail = current[0]?.email || null;
    const newEmail = patch.email === "" ? null : patch.email;
    if (oldEmail !== newEmail) resetVerified = true;
    sets.push("`email` = ?");
    vals.push(newEmail);
  }
  if (resetVerified) sets.push("`email_verified` = 0");
  if (sets.length) {
    vals.push(sub);
    await pool.query(`UPDATE \`users\` SET ${sets.join(", ")} WHERE \`sub\` = ?`, vals);
  }
  const personPatch = {};
  for (const k of ["display_name", "initials", "gender", "class_year", "usa_swimming_id"]) {
    if (k in patch) personPatch[k] = patch[k];
  }
  if (Object.keys(personPatch).length) {
    const pr = await dbUpdatePersonFromUserSub(sub, personPatch);
    if (!pr.ok) return pr;
  }
  return { ok: true };
}

// Phase 4 Identity I-G: tombstone a persons row. Anonymizes identity in place
// (Former / "Coach #N" | "Swimmer #N", PII nulled, tombstoned_at set) while the
// row + every operational FK that points at it stays intact. `kind` is "coach"
// or "swimmer". Runs on the supplied connection so the caller's transaction
// owns commit/rollback. The sequential N is stable for the life of the row.
export async function dbTombstonePerson(personId, { kind = "swimmer" } = {}, conn = pool) {
  if (!personId) return { ok: false, reason: "no_person" };
  const label = kind === "coach" ? "Coach" : "Swimmer";
  const cntRows = await conn.query(
    "SELECT COUNT(*) AS c FROM `persons` WHERE `last_name` LIKE ?",
    [label + " #%"]
  );
  const anonName = `${label} #${Number(cntRows[0]?.c || 0) + 1}`;
  await conn.query(
    "UPDATE `persons` SET `first_name` = 'Former', `last_name` = ?, " +
    "`preferred_name` = NULL, `pronouns` = NULL, `initials` = NULL, " +
    "`dob` = NULL, `gender` = NULL, `class_year` = NULL, " +
    "`tombstoned_at` = NOW(3) WHERE `id` = ?",
    [anonName, personId]
  );
  return { ok: true, personId, anonymizedAs: `Former ${anonName}` };
}

// Phase 4 Identity I-G: account "delete" = tombstone + disable, NOT cascade-wipe.
// Anonymizes the linked persons identity but KEEPS the users row (is_disabled=1)
// so every operational FK keyed on user_sub (workouts, attendance, assignments,
// audit trail) survives — the continuity guarantee from IDENTITY_SCOPE §3.C +
// the team-eval "don't destroy swimmers' history" finding. Live sessions are
// revoked so any active token dies immediately; requireAuth's dbIsUser
// (is_disabled=0) check blocks all future requests AND re-login.
// `{ hard: true }` is an explicit admin override that restores the old
// cascade-wipe (no UI surface in v1).
export async function dbAdminDeleteUser(sub, { hard = false } = {}) {
  if (!sub) return { ok: false, reason: "no_sub" };
  if (hard) {
    // Rare hard-delete override: FK CASCADE wipes workouts/favorites/settings/
    // sessions; audit_events + invite_codes SET NULL. Destroys history.
    const r = await pool.query("DELETE FROM `users` WHERE `sub` = ?", [sub]);
    return { ok: true, mode: "hard_delete", affected: Number(r.affectedRows || 0) };
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const urows = await conn.query(
      "SELECT `person_id`, `is_coach` FROM `users` WHERE `sub` = ? FOR UPDATE",
      [sub]
    );
    if (!urows[0]) { await conn.rollback(); return { ok: false, reason: "not_found" }; }
    const personId = urows[0].person_id;
    const kind = urows[0].is_coach ? "coach" : "swimmer";
    let tomb = null;
    if (personId) tomb = await dbTombstonePerson(personId, { kind }, conn);
    await conn.query("UPDATE `users` SET `is_disabled` = 1 WHERE `sub` = ?", [sub]);
    await conn.query(
      "UPDATE `sessions` SET `revoked_at` = NOW(3) WHERE `user_sub` = ? AND `revoked_at` IS NULL",
      [sub]
    );
    await conn.commit();
    return { ok: true, mode: "tombstone", affected: 1, person_id: personId, anonymizedAs: tomb?.anonymizedAs || null };
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    return { ok: false, reason: err.message || String(err) };
  } finally {
    conn.release();
  }
}

// Phase 4 / continuity commitment: self-serve full-account export. Aggregates
// every row keyed to this user (identity + operational + the roster they own)
// into one JSON object so a coach/club can leave with their data. Self-scoped:
// the caller's own account + the managed swimmers THEY own — never another
// coach's data. Each query is guarded so a schema surprise degrades that
// section to an error stub rather than failing the whole export.
export async function dbExportAccount(userSub) {
  if (!userSub) return { ok: false, reason: "no_sub" };
  const safe = async (sql, params = []) => {
    try { return await pool.query(sql, params); }
    catch (err) { return [{ _export_error: err.message }]; }
  };
  const one = async (sql, params = []) => { const r = await safe(sql, params); return r[0] || null; };

  const user = await one("SELECT * FROM `users` WHERE `sub` = ?", [userSub]);
  const personId = user && user.person_id ? user.person_id : null;

  const data = {
    exported_at: new Date().toISOString(),
    schema_note: "SetForge self-serve account export v1. Self-scoped: your account plus the managed swimmers you own.",
    account: {
      user,
      person:        personId ? await one("SELECT * FROM `persons` WHERE `id` = ?", [personId]) : null,
      external_ids:  personId ? await safe("SELECT * FROM `person_external_ids` WHERE `person_id` = ?", [personId]) : [],
      addresses:     personId ? await safe("SELECT * FROM `person_addresses` WHERE `person_id` = ?", [personId]) : [],
      guardian_of:   personId ? await safe("SELECT * FROM `guardians` WHERE `guardian_person_id` = ? AND `removed_at` IS NULL", [personId]) : [],
      oauth_providers: await safe("SELECT * FROM `user_oauth_providers` WHERE `user_sub` = ?", [userSub]),
      settings:        await one("SELECT * FROM `settings` WHERE `user_sub` = ?", [userSub]),
      sessions:        await safe("SELECT `id`, `created_at`, `expires_at`, `last_seen_at`, `ip`, `user_agent`, `revoked_at` FROM `sessions` WHERE `user_sub` = ?", [userSub]),
    },
    training: {
      workouts:           await safe("SELECT * FROM `workouts` WHERE `user_sub` = ?", [userSub]),
      scheduled_workouts: await safe("SELECT * FROM `scheduled_workouts` WHERE `user_sub` = ?", [userSub]),
      goals:              await safe("SELECT * FROM `goals` WHERE `user_sub` = ?", [userSub]),
      favorites:          await safe("SELECT * FROM `favorites` WHERE `user_sub` = ?", [userSub]),
      disfavorites:       await safe("SELECT * FROM `disfavorites` WHERE `user_sub` = ?", [userSub]),
      favorite_sets:      await safe("SELECT * FROM `user_favorite_sets` WHERE `user_sub` = ?", [userSub]),
      disfavor_sets:      await safe("SELECT * FROM `user_disfavor_sets` WHERE `user_sub` = ?", [userSub]),
      constraints:        await safe("SELECT * FROM `swimmer_constraints` WHERE `swimmer_sub` = ?", [userSub]),
    },
    coaching: {
      managed_swimmers:      await safe("SELECT * FROM `coach_managed_swimmers` WHERE `owner_coach_sub` = ?", [userSub]),
      teams_as_coach:        await safe("SELECT * FROM `team_coaches` WHERE `coach_sub` = ?", [userSub]),
      groups_as_coach:       await safe("SELECT * FROM `group_coaches` WHERE `coach_sub` = ?", [userSub]),
      bank_options_authored: await safe("SELECT * FROM `bank_options` WHERE `author_sub` = ?", [userSub]),
      group_anchors_set:     await safe("SELECT * FROM `group_anchors` WHERE `set_by_coach_sub` = ?", [userSub]),
      coach_notes_authored:  await safe("SELECT * FROM `coach_swimmer_notes` WHERE `author_coach_sub` = ?", [userSub]),
    },
    feedback:     await safe("SELECT * FROM `feedback` WHERE `user_sub` = ?", [userSub]),
    audit_events: await safe("SELECT `id`, `event_type`, `ip`, `user_agent`, `details`, `created_at` FROM `audit_events` WHERE `user_sub` = ? ORDER BY `created_at` DESC LIMIT 1000", [userSub]),
  };

  // Persons for the managed swimmers this coach owns (so names/DOB export too).
  const ms = data.coaching.managed_swimmers;
  const msPersonIds = Array.isArray(ms) ? ms.map(r => r && r.person_id).filter(Boolean) : [];
  if (msPersonIds.length) {
    const ph = msPersonIds.map(() => "?").join(",");
    data.coaching.managed_swimmer_persons = await safe("SELECT * FROM `persons` WHERE `id` IN (" + ph + ")", msPersonIds);
  } else {
    data.coaching.managed_swimmer_persons = [];
  }

  return { ok: true, data };
}

export async function dbAdminListInvites() {
  // Identity (initials) comes from persons via person_id; legacy users column
  // dropped in migration 044.
  const rows = await pool.query(`
    SELECT ic.code, ic.note, ic.max_uses, ic.times_used,
           ic.expires_at, ic.created_at, ic.created_by,
           p.initials AS person_initials
      FROM invite_codes ic
      LEFT JOIN users u   ON u.sub = ic.created_by
      LEFT JOIN persons p ON p.id  = u.person_id
      ORDER BY ic.created_at DESC
  `);
  return rows.map(r => ({
    code: r.code, note: r.note,
    max_uses: Number(r.max_uses), times_used: Number(r.times_used),
    expires_at: r.expires_at, created_at: r.created_at,
    created_by: r.created_by,
    created_by_initials: r.person_initials,
    status: r.expires_at && new Date(r.expires_at) < new Date() ? "expired"
          : Number(r.times_used) >= Number(r.max_uses) ? "exhausted"
          : "active",
  }));
}

export async function dbAdminCreateInvite({ note, maxUses = 1, expiresAt = null, createdBy = null }) {
  const code = crypto.randomBytes(8).toString("base64url");
  await pool.query(
    "INSERT INTO `invite_codes` (`code`, `note`, `max_uses`, `expires_at`, `created_by`) VALUES (?, ?, ?, ?, ?)",
    [code, note || null, maxUses, expiresAt || null, createdBy]
  );
  return code;
}

export async function dbAdminDeleteInvite(code) {
  if (!code) return { ok: false, reason: "no_code" };
  const r = await pool.query("DELETE FROM `invite_codes` WHERE `code` = ?", [code]);
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

// Event groups for the admin UI's checkbox filter. Each key maps to a SQL
// LIKE pattern matched against event_type. "other" is everything not
// covered by the named groups (computed via NOT LIKE chain at query time).
const AUDIT_EVENT_GROUPS = {
  auth:          ["auth.%"],
  admin:         ["admin.%"],
  impersonation: ["impersonation.%"],
  coach:         ["coach.%"],
  rate_limit:    ["rate_limit.%"],
  csrf:          ["csrf.%"],
  // "other" is built in dbAdminListAuditEvents — NOT LIKE the union of above.
};
const _AUDIT_NAMED_PATTERNS = Object.values(AUDIT_EVENT_GROUPS).flat();

export async function dbAdminListAuditEvents({ limit = 500, offset = 0, eventType = null, eventTypeGroups = null, userSub = null } = {}) {
  const where = [];
  const args  = [];
  if (eventType) { where.push("`event_type` = ?"); args.push(eventType); }
  // Group filter: each requested group contributes its LIKE patterns. "other"
  // becomes a NOT LIKE chain against every named pattern. Combined via OR.
  if (eventTypeGroups && Array.isArray(eventTypeGroups) && eventTypeGroups.length > 0) {
    const ors = [];
    for (const g of eventTypeGroups) {
      if (g === "other") {
        const nots = _AUDIT_NAMED_PATTERNS.map(() => "`event_type` NOT LIKE ?").join(" AND ");
        ors.push(`(${nots})`);
        args.push(..._AUDIT_NAMED_PATTERNS);
      } else if (AUDIT_EVENT_GROUPS[g]) {
        for (const pat of AUDIT_EVENT_GROUPS[g]) {
          ors.push("`event_type` LIKE ?");
          args.push(pat);
        }
      }
      // Unknown group names are silently ignored — client/server enum drift safe.
    }
    if (ors.length > 0) where.push(`(${ors.join(" OR ")})`);
  }
  if (userSub)   { where.push("`user_sub` = ?");   args.push(userSub); }
  const wh = where.length ? `WHERE ${where.join(" AND ")}` : "";
  args.push(Number(limit), Number(offset));
  const rows = await pool.query(
    `SELECT id, user_sub, event_type, ip, user_agent, details, created_at, impersonator_sub
       FROM audit_events ${wh}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
    args
  );
  return rows.map(r => ({
    id: Number(r.id), user_sub: r.user_sub, event_type: r.event_type,
    ip: r.ip, user_agent: r.user_agent,
    details: r.details, created_at: r.created_at,
    impersonator_sub: r.impersonator_sub || null,
  }));
}

// Atomically validate and consume an invite code.
// Returns { ok: true } or { ok: false, reason: "invalid" | "expired" | "exhausted" | "no_code" }.
export async function dbConsumeInviteCode(code) {
  if (!code) return { ok: false, reason: "no_code" };
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const rows = await conn.query(
      "SELECT * FROM `invite_codes` WHERE `code` = ? FOR UPDATE",
      [code]
    );
    if (!rows[0]) {
      await conn.rollback();
      return { ok: false, reason: "invalid" };
    }
    const inv = rows[0];
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
      await conn.rollback();
      return { ok: false, reason: "expired" };
    }
    if (Number(inv.times_used) >= Number(inv.max_uses)) {
      await conn.rollback();
      return { ok: false, reason: "exhausted" };
    }
    await conn.query(
      "UPDATE `invite_codes` SET `times_used` = `times_used` + 1 WHERE `code` = ?",
      [code]
    );
    await conn.commit();
    return { ok: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ─── favorites ──────────────────────────────────────────────────────────────
export async function dbListFavorites(userSub) {
  if (!userSub) return [];
  const rows = await pool.query(
    "SELECT `label` FROM `favorites` WHERE `user_sub` = ? ORDER BY `created_at`",
    [userSub]
  );
  return rows.map(r => r.label);
}

export async function dbAddFavorite(userSub, label) {
  if (!userSub || !label) return;
  await dbEnsureUser(userSub);
  // v1.2 — mutex with disfavorites. Adding a favorite removes any matching
  // disfavor for the same label (and vice versa via dbAddDisfavorite below).
  // Keeps the two states truly opposite: a label is either neutral, favorited,
  // or disfavored — never both.
  await pool.query(
    "DELETE FROM `disfavorites` WHERE `user_sub` = ? AND `label` = ?",
    [userSub, label]
  );
  await pool.query(
    "INSERT IGNORE INTO `favorites` (`user_sub`, `label`) VALUES (?, ?)",
    [userSub, label]
  );
}

export async function dbRemoveFavorite(userSub, label) {
  if (!userSub) return;
  await pool.query(
    "DELETE FROM `favorites` WHERE `user_sub` = ? AND `label` = ?",
    [userSub, label]
  );
}

// ─── disfavorites (v1.2) ────────────────────────────────────────────────────
// Mirror of `favorites` with opposite weight in the picker. Per migration
// 026_disfavorites.sql. Mutex with favorites — adding to one removes from
// the other.
export async function dbListDisfavorites(userSub) {
  if (!userSub) return [];
  const rows = await pool.query(
    "SELECT `label` FROM `disfavorites` WHERE `user_sub` = ? ORDER BY `created_at`",
    [userSub]
  );
  return rows.map(r => r.label);
}

export async function dbAddDisfavorite(userSub, label) {
  if (!userSub || !label) return;
  await dbEnsureUser(userSub);
  // Mutex: clear any favorite for the same label
  await pool.query(
    "DELETE FROM `favorites` WHERE `user_sub` = ? AND `label` = ?",
    [userSub, label]
  );
  await pool.query(
    "INSERT IGNORE INTO `disfavorites` (`user_sub`, `label`) VALUES (?, ?)",
    [userSub, label]
  );
}

export async function dbRemoveDisfavorite(userSub, label) {
  if (!userSub) return;
  await pool.query(
    "DELETE FROM `disfavorites` WHERE `user_sub` = ? AND `label` = ?",
    [userSub, label]
  );
}

// ── Per-user favorited SETS (set-level, by stable set ID) ─────────────
// Parallel to label-favorites above but keys on the `id` field that
// `tools/assign_set_ids.py` injected into every bank set. Used by the
// generator to multiply pick weight of any option whose sets contain a
// favorited set ID. Cross-pool isolation is automatic since each pool's
// bank has independent IDs.
export async function dbListFavoriteSets(userSub) {
  if (!userSub) return [];
  const rows = await pool.query(
    "SELECT `set_id` FROM `user_favorite_sets` WHERE `user_sub` = ? ORDER BY `created_at`",
    [userSub]
  );
  return rows.map(r => r.set_id);
}

export async function dbAddFavoriteSet(userSub, setId) {
  if (!userSub || !setId) return;
  // Sanity-bound the format we accept — IDs are `s_<6 base36>` from
  // assign_set_ids.py. Reject anything else to keep the table clean.
  if (!/^s_[a-z0-9]{4,16}$/.test(setId)) throw new Error("bad set_id format");
  await dbEnsureUser(userSub);
  // v1.5 — mutex with user_disfavor_sets (mirrors label-level mutex)
  await pool.query(
    "DELETE FROM `user_disfavor_sets` WHERE `user_sub` = ? AND `set_id` = ?",
    [userSub, setId]
  );
  await pool.query(
    "INSERT IGNORE INTO `user_favorite_sets` (`user_sub`, `set_id`) VALUES (?, ?)",
    [userSub, setId]
  );
}

export async function dbRemoveFavoriteSet(userSub, setId) {
  if (!userSub) return;
  await pool.query(
    "DELETE FROM `user_favorite_sets` WHERE `user_sub` = ? AND `set_id` = ?",
    [userSub, setId]
  );
}

// ─── disfavored SETS (v1.5) ─────────────────────────────────────────
// Mirror of user_favorite_sets above. 0.25× pick weight per matching
// disfavored set in an option (vs favorite-sets' 3×). Mutex enforced
// here — adding to either clears the opposite.
export async function dbListDisfavorSets(userSub) {
  if (!userSub) return [];
  const rows = await pool.query(
    "SELECT `set_id` FROM `user_disfavor_sets` WHERE `user_sub` = ? ORDER BY `created_at`",
    [userSub]
  );
  return rows.map(r => r.set_id);
}

export async function dbAddDisfavorSet(userSub, setId) {
  if (!userSub || !setId) return;
  if (!/^s_[a-z0-9]{4,16}$/.test(setId)) throw new Error("bad set_id format");
  await dbEnsureUser(userSub);
  // Mutex: clear any favorite-set for this same set_id
  await pool.query(
    "DELETE FROM `user_favorite_sets` WHERE `user_sub` = ? AND `set_id` = ?",
    [userSub, setId]
  );
  await pool.query(
    "INSERT IGNORE INTO `user_disfavor_sets` (`user_sub`, `set_id`) VALUES (?, ?)",
    [userSub, setId]
  );
}

export async function dbRemoveDisfavorSet(userSub, setId) {
  if (!userSub) return;
  await pool.query(
    "DELETE FROM `user_disfavor_sets` WHERE `user_sub` = ? AND `set_id` = ?",
    [userSub, setId]
  );
}

// v1.7 — Coach-group propagation. For a given swimmer, compute the
// EFFECTIVE disfavorites = union of (their own) + (any primary coach
// whose group includes them). Three flavors merged:
//   - bank labels (disfavorites table)
//   - set IDs (user_disfavor_sets table)
//   - engine (template_id, stroke) tuples (settings.extra.engine_disfavorites JSON)
//
// Used by the picker. The user's audit panel continues to read OWN-ONLY
// lists via the existing dbList* helpers, so coach contributions are
// applied silently (per Cap'n's "invisible" scope choice).
//
// Edge cases:
//   - User in no groups → returns own list only
//   - User in multiple groups → union all primary coaches (distinct)
//   - Coach is also a swimmer in someone else's group → does NOT recurse
//     (one-way: coach → swimmer, not swimmer → coach)
//   - Archived groups excluded (g.archived = 0)
//   - User self in coach list is harmless (already in allSubs); UNION
//     dedupes automatically
export async function dbGetEffectiveDisfavorites(userSub) {
  if (!userSub) return { labels: [], set_ids: [], engine: [] };
  // Find all coaches (primary AND assistant) whose group this user
  // belongs to. v1.9 expanded from primary-only to all active coaches —
  // group_coaches table holds both roles; removed_at IS NULL filters
  // soft-deleted entries. Real users (member_swimmer_sub) only —
  // managed swimmers don't have their own auth and don't call this
  // endpoint.
  const coachRows = await pool.query(
    "SELECT DISTINCT gc.`coach_sub` AS coach " +
    "FROM `group_members` gm " +
    "JOIN `groups` g          ON g.`id`        = gm.`group_id` " +
    "JOIN `group_coaches` gc  ON gc.`group_id` = g.`id` AND gc.`removed_at` IS NULL " +
    "WHERE gm.`member_swimmer_sub` = ? " +
    "  AND gm.`left_at` IS NULL " +
    "  AND g.`archived` = 0",
    [userSub]
  );
  const allSubs = [userSub];
  for (const r of coachRows) {
    if (r.coach && r.coach !== userSub) allSubs.push(r.coach);
  }
  const placeholders = allSubs.map(() => "?").join(",");
  // Labels
  const labelRows = await pool.query(
    `SELECT DISTINCT \`label\` FROM \`disfavorites\` WHERE \`user_sub\` IN (${placeholders})`,
    allSubs
  );
  // Set IDs
  const setRows = await pool.query(
    `SELECT DISTINCT \`set_id\` FROM \`user_disfavor_sets\` WHERE \`user_sub\` IN (${placeholders})`,
    allSubs
  );
  // Engine disfavorites — pull settings.extra rows and union the JSON arrays
  const settingsRows = await pool.query(
    `SELECT \`extra\` FROM \`settings\` WHERE \`user_sub\` IN (${placeholders})`,
    allSubs
  );
  const engineMap = new Map();  // key = `${template_id}:${stroke}`
  for (const r of settingsRows) {
    if (!r.extra) continue;
    let extra;
    try {
      extra = typeof r.extra === "string" ? JSON.parse(r.extra) : r.extra;
    } catch (_) { continue; }
    if (!extra || !Array.isArray(extra.engine_disfavorites)) continue;
    for (const e of extra.engine_disfavorites) {
      if (e && typeof e.template_id === "string" && typeof e.stroke === "string") {
        engineMap.set(`${e.template_id}:${e.stroke}`, { template_id: e.template_id, stroke: e.stroke });
      }
    }
  }
  // Phase 4 Team Curation slice 3 (2026-05-27): third tier of cascade.
  // Pull team_disfavorites for any team the user is in (via group_members
  // → groups → teams). Union labels into the existing set. Set-level +
  // engine team disfavorites are v1.1 per TEAM_CURATION_SCOPE.md §5;
  // v1 is label-level only.
  const teamLabelRows = await pool.query(
    "SELECT DISTINCT td.`label` " +
    "  FROM `team_disfavorites` td " +
    "  JOIN `groups` g          ON g.`team_id`  = td.`team_id` " +
    "  JOIN `group_members` gm  ON gm.`group_id` = g.`id` " +
    " WHERE gm.`member_swimmer_sub` = ? " +
    "   AND gm.`left_at` IS NULL " +
    "   AND g.`archived` = 0",
    [userSub]
  );
  const labelSet = new Set(labelRows.map(r => r.label));
  for (const r of teamLabelRows) labelSet.add(r.label);
  return {
    labels:  Array.from(labelSet),
    set_ids: setRows.map(r => r.set_id),
    engine:  Array.from(engineMap.values()),
  };
}

// v3.0 — Coach curation impact (2026-05-22). For a coach, fetch the union
// of their own labels/set_ids/engine tuples (favorites + disfavorites) and
// scan the last 30 days of workouts from every swimmer in every group they
// coach. Per curated item, count:
//   reach: number of unique swimmers (in coach's groups) who had at least
//          one workout containing the curated item
//   effectiveness: total number of workouts containing the curated item
//                  (counted per-block, not per-rep)
//
// Disfavor semantics: same numbers, opposite intent — high reach + high
// effectiveness on a disfavored item means the picker's downweight didn't
// keep it out (could be expected at 0.25× weight; could be exclude-mode
// fallback firing). UI tags with kind: "favorite" | "disfavor" so the
// coach can interpret.
//
// All numbers privacy-preserving (no swimmer names in return shape).
// Coach themselves IS counted if they're in their own group (they're a
// swimmer-coach in that case).
export async function dbGetCoachImpact(coachSub) {
  if (!coachSub) return { windowDays: 30, groupCount: 0, swimmerCount: 0, swimmersWithActivity: 0, workoutCount: 0, labels: [], sets: [], engine: [] };

  // 1. Coach's active groups
  const groups = await pool.query(
    "SELECT DISTINCT gc.`group_id` AS gid FROM `group_coaches` gc " +
    "JOIN `groups` g ON g.`id` = gc.`group_id` " +
    "WHERE gc.`coach_sub` = ? AND gc.`removed_at` IS NULL AND g.`archived` = 0",
    [coachSub]
  );
  const groupIds = groups.map(r => r.gid);
  if (!groupIds.length) return { windowDays: 30, groupCount: 0, swimmerCount: 0, swimmersWithActivity: 0, workoutCount: 0, labels: [], sets: [], engine: [] };

  // 2. Swimmers in those groups (real users only)
  const groupPh = groupIds.map(() => "?").join(",");
  const swimmers = await pool.query(
    `SELECT DISTINCT \`member_swimmer_sub\` AS sub FROM \`group_members\` ` +
    `WHERE \`group_id\` IN (${groupPh}) AND \`left_at\` IS NULL AND \`member_swimmer_sub\` IS NOT NULL`,
    groupIds
  );
  const swimmerSubs = swimmers.map(r => r.sub);
  if (!swimmerSubs.length) return { windowDays: 30, groupCount: groupIds.length, swimmerCount: 0, swimmersWithActivity: 0, workoutCount: 0, labels: [], sets: [], engine: [] };

  // 3. Coach's own curation: labels, set_ids, engine tuples (own only, NOT
  //    the propagated union — the question is "what did I curate?")
  const [favLabels, disfavLabels, favSets, disfavSets, settingsRow] = await Promise.all([
    pool.query("SELECT `label` FROM `favorites` WHERE `user_sub` = ?",         [coachSub]),
    pool.query("SELECT `label` FROM `disfavorites` WHERE `user_sub` = ?",      [coachSub]),
    pool.query("SELECT `set_id` FROM `user_favorite_sets` WHERE `user_sub` = ?", [coachSub]),
    pool.query("SELECT `set_id` FROM `user_disfavor_sets` WHERE `user_sub` = ?", [coachSub]),
    pool.query("SELECT `extra` FROM `settings` WHERE `user_sub` = ?",          [coachSub]),
  ]);
  let engineFav = [], engineDis = [];
  if (settingsRow[0] && settingsRow[0].extra) {
    try {
      const extra = typeof settingsRow[0].extra === "string" ? JSON.parse(settingsRow[0].extra) : settingsRow[0].extra;
      if (Array.isArray(extra.engine_favorites))    engineFav = extra.engine_favorites;
      if (Array.isArray(extra.engine_disfavorites)) engineDis = extra.engine_disfavorites;
    } catch (_) {}
  }

  const favLabelSet  = new Set(favLabels.map(r => r.label));
  const favSetIdSet  = new Set(favSets.map(r => r.set_id));
  const favEngineSet = new Set(engineFav.map(e => `${e.template_id}:${e.stroke}`));
  const allLabels = new Set([...favLabelSet, ...disfavLabels.map(r => r.label)]);
  const allSetIds = new Set([...favSetIdSet, ...disfavSets.map(r => r.set_id)]);
  const allEngine = new Set([...favEngineSet, ...engineDis.map(e => `${e.template_id}:${e.stroke}`)]);

  if (!allLabels.size && !allSetIds.size && !allEngine.size) {
    return { windowDays: 30, groupCount: groupIds.length, swimmerCount: swimmerSubs.length, swimmersWithActivity: 0, workoutCount: 0, labels: [], sets: [], engine: [] };
  }

  // 4. Last 30 days of workouts from those swimmers
  const swimmerPh = swimmerSubs.map(() => "?").join(",");
  const workouts = await pool.query(
    `SELECT \`user_sub\`, \`payload\` FROM \`workouts\` ` +
    `WHERE \`user_sub\` IN (${swimmerPh}) AND \`saved_at\` >= (NOW() - INTERVAL 30 DAY)`,
    swimmerSubs
  );

  // 5. Aggregate. Per curated item, track unique-swimmer Set + workout count.
  const labelAgg = new Map();
  const setAgg   = new Map();
  const engAgg   = new Map();
  for (const v of allLabels) labelAgg.set(v, { reach: new Set(), eff: 0 });
  for (const v of allSetIds) setAgg.set(v,   { reach: new Set(), eff: 0 });
  for (const v of allEngine) engAgg.set(v,   { reach: new Set(), eff: 0 });
  const activeSwimmers = new Set();

  for (const w of workouts) {
    activeSwimmers.add(w.user_sub);
    let payload;
    try { payload = typeof w.payload === "string" ? JSON.parse(w.payload) : w.payload; } catch (_) { continue; }
    if (!payload || !Array.isArray(payload.blocks)) continue;
    for (const block of payload.blocks) {
      // Bank label hit (counts once per block, not per workout)
      if (block && block.label && allLabels.has(block.label)) {
        const a = labelAgg.get(block.label);
        a.reach.add(w.user_sub);
        a.eff += 1;
      }
      // Set ID hits (count once per matching set in this block)
      if (block && Array.isArray(block.sets)) {
        for (const s of block.sets) {
          if (s && s.id && allSetIds.has(s.id)) {
            const a = setAgg.get(s.id);
            a.reach.add(w.user_sub);
            a.eff += 1;
          }
        }
      }
      // Engine tuple hit
      if (block && block.__engineMeta && block.__engineMeta.template_id) {
        const key = `${block.__engineMeta.template_id}:${block.__engineMeta.stroke || ""}`;
        if (allEngine.has(key)) {
          const a = engAgg.get(key);
          a.reach.add(w.user_sub);
          a.eff += 1;
        }
      }
    }
  }

  return {
    windowDays: 30,
    groupCount:           groupIds.length,
    swimmerCount:         swimmerSubs.length,
    swimmersWithActivity: activeSwimmers.size,
    workoutCount:         workouts.length,
    labels: [...labelAgg.entries()].map(([label, a]) => ({
      label, kind: favLabelSet.has(label) ? "favorite" : "disfavor",
      reach: a.reach.size, effectiveness: a.eff,
    })),
    sets: [...setAgg.entries()].map(([set_id, a]) => ({
      set_id, kind: favSetIdSet.has(set_id) ? "favorite" : "disfavor",
      reach: a.reach.size, effectiveness: a.eff,
    })),
    engine: [...engAgg.entries()].map(([key, a]) => {
      const [template_id, stroke] = key.split(":");
      return { template_id, stroke, kind: favEngineSet.has(key) ? "favorite" : "disfavor",
        reach: a.reach.size, effectiveness: a.eff };
    }),
  };
}

// v1.13 — Mirror of dbGetEffectiveDisfavorites for the favorite side.
// Returns the union of the user's own favorites (labels + set IDs + engine
// tuples) plus every favorite from every coach (primary OR assistant) of
// every group the user is in. Same coach-resolution query as v1.9, same
// JSON-array merge for engine_favorites in settings.extra. Caller is
// responsible for any precedence rules (the universal "favorite wins over
// disfavor" rule lives in the client picker, not here).
export async function dbGetEffectiveFavorites(userSub) {
  if (!userSub) return { labels: [], set_ids: [], engine: [] };
  const coachRows = await pool.query(
    "SELECT DISTINCT gc.`coach_sub` AS coach " +
    "FROM `group_members` gm " +
    "JOIN `groups` g          ON g.`id`        = gm.`group_id` " +
    "JOIN `group_coaches` gc  ON gc.`group_id` = g.`id` AND gc.`removed_at` IS NULL " +
    "WHERE gm.`member_swimmer_sub` = ? " +
    "  AND gm.`left_at` IS NULL " +
    "  AND g.`archived` = 0",
    [userSub]
  );
  const allSubs = [userSub];
  for (const r of coachRows) {
    if (r.coach && r.coach !== userSub) allSubs.push(r.coach);
  }
  const placeholders = allSubs.map(() => "?").join(",");
  // Labels (table: favorites)
  const labelRows = await pool.query(
    `SELECT DISTINCT \`label\` FROM \`favorites\` WHERE \`user_sub\` IN (${placeholders})`,
    allSubs
  );
  // Set IDs (table: user_favorite_sets)
  const setRows = await pool.query(
    `SELECT DISTINCT \`set_id\` FROM \`user_favorite_sets\` WHERE \`user_sub\` IN (${placeholders})`,
    allSubs
  );
  // Engine favorites — pull settings.extra rows, union the JSON arrays
  const settingsRows = await pool.query(
    `SELECT \`extra\` FROM \`settings\` WHERE \`user_sub\` IN (${placeholders})`,
    allSubs
  );
  const engineMap = new Map();
  for (const r of settingsRows) {
    if (!r.extra) continue;
    let extra;
    try {
      extra = typeof r.extra === "string" ? JSON.parse(r.extra) : r.extra;
    } catch (_) { continue; }
    if (!extra || !Array.isArray(extra.engine_favorites)) continue;
    for (const e of extra.engine_favorites) {
      if (e && typeof e.template_id === "string" && typeof e.stroke === "string") {
        engineMap.set(`${e.template_id}:${e.stroke}`, { template_id: e.template_id, stroke: e.stroke });
      }
    }
  }
  // Phase 4 Team Curation slice 3 (2026-05-27): third tier of cascade,
  // favorite side. Pull team_favorites for any team the user is in.
  // Universal favorite-wins precedence (v1.13) still applies: any
  // favorite (own/coach/team) wins over any disfavor at any tier.
  const teamLabelRows = await pool.query(
    "SELECT DISTINCT tf.`label` " +
    "  FROM `team_favorites` tf " +
    "  JOIN `groups` g          ON g.`team_id`  = tf.`team_id` " +
    "  JOIN `group_members` gm  ON gm.`group_id` = g.`id` " +
    " WHERE gm.`member_swimmer_sub` = ? " +
    "   AND gm.`left_at` IS NULL " +
    "   AND g.`archived` = 0",
    [userSub]
  );
  const labelSet = new Set(labelRows.map(r => r.label));
  for (const r of teamLabelRows) labelSet.add(r.label);
  return {
    labels:  Array.from(labelSet),
    set_ids: setRows.map(r => r.set_id),
    engine:  Array.from(engineMap.values()),
  };
}

// ── UGC bank overlay (Phase B of UGC coach-authored sets) ──────────────
// See UGC_COACH_SETS_SCOPE.md §7. Returns the caller's UGC overlay shaped
// to match the 12 JS bank constants exactly, so the client picker can
// merge with a single `[...JS_CONST, ...overlay[KEY]]` (or per-sub-key
// for drill/main).
//
// Visibility scoping:
//   - own UGC (any visibility, including private)
//   - admin-approved public UGC (any author)
//   - team-shared UGC where caller is in the team — either as a coach
//     (team_coaches row) OR as a swimmer in a group belonging to the
//     team (group_members → groups.team_id)
//   - in all cases, exclude promoted_at IS NOT NULL (graduated to JS)
//
// Each option carries metadata (_ugc, _author_sub, _visibility) so the
// client can render the right indicator badge (📝 own / 👥 team / 🌐 public).
const SECTION_KEY_BY_POOL = {
  warmup:   { "25y": "WARMUP_OPTIONS",   "25m": "WARMUP_OPTIONS_SCM",   "50m": "WARMUP_OPTIONS_50M"   },
  cooldown: { "25y": "COOLDOWN_OPTIONS", "25m": "COOLDOWN_OPTIONS_SCM", "50m": "COOLDOWN_OPTIONS_50M" },
  drill:    { "25y": "DRILL_OPTIONS",    "25m": "DRILL_OPTIONS_SCM",    "50m": "DRILL_OPTIONS_50M"    },
  main:     { "25y": "MAIN_OPTIONS",     "25m": "MAIN_OPTIONS_SCM",     "50m": "MAIN_OPTIONS_50M"     },
};

export async function dbGetUgcOverlay(userSub) {
  // Always return the full 12-key shape (empty arrays/objects when no
  // UGC visible). Lets the client merge unconditionally without null
  // checks per section.
  const empty = {
    WARMUP_OPTIONS:        [],
    COOLDOWN_OPTIONS:      [],
    DRILL_OPTIONS:         {},
    MAIN_OPTIONS:          {},
    WARMUP_OPTIONS_50M:    [],
    COOLDOWN_OPTIONS_50M:  [],
    DRILL_OPTIONS_50M:     {},
    MAIN_OPTIONS_50M:      {},
    WARMUP_OPTIONS_SCM:    [],
    COOLDOWN_OPTIONS_SCM:  [],
    DRILL_OPTIONS_SCM:     {},
    MAIN_OPTIONS_SCM:      {},
    _meta: { fetched_at: new Date().toISOString(), rowCount: 0 },
  };
  if (!userSub) return empty;

  // Visibility-scoped query: own + admin-approved public + team-shared
  // (team membership via team_coaches OR via group_members→groups.team_id).
  // DISTINCT because a team-shared option could match via multiple paths.
  const optionRows = await pool.query(
    "SELECT DISTINCT bo.`id`, bo.`section`, bo.`type_id`, bo.`stroke_id`, " +
    "       bo.`type_ids`, bo.`stroke_ids`, " +
    "       bo.`pool_mode`, bo.`label`, bo.`total_yards`, bo.`type_affinity`, " +
    "       bo.`lesson_level`, bo.`author_sub`, bo.`visibility` " +
    "FROM `bank_options` bo " +
    "WHERE bo.`promoted_at` IS NULL " +
    "  AND ( " +
    "    bo.`author_sub` = ? " +
    "    OR bo.`visibility` = 'public' " +
    "    OR ( " +
    "      bo.`visibility` = 'team' AND EXISTS ( " +
    "        SELECT 1 FROM `bank_option_team_shares` ts " +
    "        WHERE ts.`option_id` = bo.`id` " +
    "          AND ( " +
    "            ts.`team_id` IN ( " +
    "              SELECT tc.`team_id` FROM `team_coaches` tc " +
    "              WHERE tc.`coach_sub` = ? AND tc.`removed_at` IS NULL " +
    "            ) " +
    "            OR ts.`team_id` IN ( " +
    "              SELECT g.`team_id` FROM `groups` g " +
    "              JOIN `group_members` gm ON gm.`group_id` = g.`id` " +
    "              WHERE gm.`member_swimmer_sub` = ? " +
    "                AND gm.`left_at` IS NULL " +
    "                AND g.`archived` = 0 " +
    "            ) " +
    "          ) " +
    "      ) " +
    "    ) " +
    "  )",
    [userSub, userSub, userSub]
  );
  if (optionRows.length === 0) return empty;

  // Fetch all sets for the matched options in a single query.
  const optionIds = optionRows.map(r => r.id);
  const setPlaceholders = optionIds.map(() => "?").join(",");
  const setRows = await pool.query(
    `SELECT \`id\`, \`option_id\`, \`seq\`, \`reps\`, \`dist\`, \`desc\`, ` +
    `       \`interval\`, \`focus\`, \`stroke\`, \`eq\` ` +
    `FROM \`bank_sets\` WHERE \`option_id\` IN (${setPlaceholders}) ` +
    `ORDER BY \`option_id\`, \`seq\``,
    optionIds
  );
  // Group sets by option_id.
  const setsByOption = new Map();
  for (const s of setRows) {
    if (!setsByOption.has(s.option_id)) setsByOption.set(s.option_id, []);
    setsByOption.get(s.option_id).push({
      id:       s.id,
      reps:     s.reps,
      dist:     s.dist,
      desc:     s.desc,
      interval: s.interval,
      ...(s.focus  ? { focus:  s.focus  } : {}),
      ...(s.stroke ? { stroke: s.stroke } : {}),
      ...(s.eq     ? { eq:     s.eq     } : {}),
    });
  }

  // Project into the 12-key overlay shape.
  const overlay = { ...empty };
  for (const r of optionRows) {
    const key = SECTION_KEY_BY_POOL[r.section]?.[r.pool_mode];
    if (!key) continue;  // unknown section/pool_mode → skip silently
    let typeAffinity = null;
    if (r.type_affinity) {
      try {
        typeAffinity = typeof r.type_affinity === "string"
          ? JSON.parse(r.type_affinity)
          : r.type_affinity;
      } catch (_) { /* malformed JSON; skip */ }
    }
    const option = {
      label:       r.label,
      totalYards:  r.total_yards,
      ...(typeAffinity ? { typeAffinity } : {}),
      sets:        setsByOption.get(r.id) || [],
      // UGC-only metadata. Underscore-prefixed to signal "not part of
      // the canonical option contract; UI uses these for badges."
      _ugc:           true,
      _option_id:     r.id,
      _author_sub:    r.author_sub,
      _visibility:    r.visibility,
      _is_own:        r.author_sub === userSub,
      // Lesson ability level (Phase 5) — null = untagged (shows at any level).
      // The engine filters lesson overlay options by this (getBankOptions).
      ...(r.lesson_level ? { lesson_level: r.lesson_level } : {}),
    };
    if (r.section === "warmup" || r.section === "cooldown") {
      overlay[key].push(option);
    } else {
      // drill/main: project into EVERY type/stroke bucket the option
      // declares (multi-tag via type_ids + stroke_ids arrays). Falls
      // back to singleton type_id / stroke_id when arrays are missing
      // (pre-migration-032 rows, defensive only). The same option object
      // reference lives in multiple buckets — picker treats each bucket
      // independently, but identity is preserved so UI badges work.
      const parseArr = (val, fallback) => {
        if (val == null) return fallback;
        if (Array.isArray(val)) return val;
        if (typeof val === "string") {
          try { const j = JSON.parse(val); return Array.isArray(j) ? j : fallback; } catch (_) { return fallback; }
        }
        return fallback;
      };
      const typeIds   = parseArr(r.type_ids,   r.type_id   ? [r.type_id]   : []);
      const strokeIds = parseArr(r.stroke_ids, r.stroke_id ? [r.stroke_id] : []);
      const subKeys = Array.from(new Set([...typeIds, ...strokeIds]));
      if (subKeys.length === 0) continue;  // shouldn't happen with valid data
      for (const subKey of subKeys) {
        if (!overlay[key][subKey]) overlay[key][subKey] = [];
        overlay[key][subKey].push(option);
      }
    }
  }
  overlay._meta.rowCount = optionRows.length;
  return overlay;
}

// ── UGC bank authoring (Phase C of UGC coach-authored sets) ────────────
// CRUD on bank_options + bank_sets for coach-authored rows. All helpers
// gate on author_sub = caller for the edit/delete paths so a coach can
// only touch their own rows (admin override happens at the server layer).
// Spec: UGC_COACH_SETS_SCOPE.md §4 + §5.

const UGC_SECTIONS    = new Set(["warmup", "drill", "main", "cooldown"]);
const UGC_POOL_MODES  = new Set(["25y", "25m", "50m"]);
// "lesson" (Phase 5) — coaches tag drill/main sets "lesson" so they route into the
// Lesson workout type (and NOT into IM/Sprint/Technique). See getBankOptions.
const UGC_TYPE_KEYS   = new Set(["im", "distance", "sprint", "endurance", "mixed", "technique", "lesson"]);
const UGC_STROKE_KEYS = new Set(["back", "breast", "fly", "free", "im"]);
// Lesson ability level (Phase 5) — cross-cutting scope for lesson content across
// the 4–80 age range. Applies to ANY section (incl. type-agnostic warmup/cooldown).
const LESSON_LEVELS   = new Set(["beginner", "intermediate", "advanced"]);
const UGC_VISIBILITY  = new Set(["private", "team", "public", "pending", "rejected"]);
const UGC_INTERVAL_RE = /^(On \d+:\d{2}|No interval.*)$/;
const UGC_QUOTA_PER_COACH = 50;  // counts unpromoted only

function genUgcOptionId() {
  // mirror sync_bank.mjs convention: o_ + 6 base36 chars
  const n = crypto.randomBytes(4).readUInt32BE(0);
  return "o_" + n.toString(36).padStart(6, "0").slice(-6);
}
function genUgcSetId() {
  // mirror tools/assign_set_ids.py: s_ + 6 base36 chars
  const n = crypto.randomBytes(4).readUInt32BE(0);
  return "s_" + n.toString(36).padStart(6, "0").slice(-6);
}

// Validate & normalize a UGC payload (option + sets). Throws on bad input.
// Returns a clean object ready for INSERT.
function validateUgcPayload(payload, { allowVisibility = ["private", "team", "public"] } = {}) {
  if (!payload || typeof payload !== "object") throw new Error("payload required");
  const { section, type_id, stroke_id, type_ids: rawTypeIds, stroke_ids: rawStrokeIds,
          pool_mode, label, total_yards, type_affinity, visibility, sets, team_ids,
          lesson_level: rawLessonLevel } = payload;
  // Lesson ability level (Phase 5) — optional; valid on any section. null = untagged.
  let lessonLevel = null;
  if (rawLessonLevel != null && rawLessonLevel !== "") {
    if (!LESSON_LEVELS.has(rawLessonLevel)) throw new Error(`bad lesson_level: ${rawLessonLevel}`);
    lessonLevel = rawLessonLevel;
  }
  // Phase H — array-form multi-tag. Singletons (type_id / stroke_id) are
  // accepted for backward compat and wrapped to length-1 arrays. Array
  // form is canonical going forward.
  let cleanTypeIds = [];
  let cleanStrokeIds = [];
  if (Array.isArray(rawTypeIds)) {
    for (const t of rawTypeIds) {
      if (typeof t !== "string" || !t.trim()) throw new Error("bad type_ids entry");
      const v = t.trim();
      if (!UGC_TYPE_KEYS.has(v)) throw new Error(`bad type_id: ${v}`);
      cleanTypeIds.push(v);
    }
    cleanTypeIds = Array.from(new Set(cleanTypeIds));  // dedup
  } else if (type_id) {
    if (!UGC_TYPE_KEYS.has(type_id)) throw new Error(`bad type_id: ${type_id}`);
    cleanTypeIds = [type_id];
  }
  if (Array.isArray(rawStrokeIds)) {
    for (const s of rawStrokeIds) {
      if (typeof s !== "string" || !s.trim()) throw new Error("bad stroke_ids entry");
      const v = s.trim();
      if (!UGC_STROKE_KEYS.has(v)) throw new Error(`bad stroke_id: ${v}`);
      cleanStrokeIds.push(v);
    }
    cleanStrokeIds = Array.from(new Set(cleanStrokeIds));  // dedup
  } else if (stroke_id) {
    if (!UGC_STROKE_KEYS.has(stroke_id)) throw new Error(`bad stroke_id: ${stroke_id}`);
    cleanStrokeIds = [stroke_id];
  }
  if (!UGC_SECTIONS.has(section))   throw new Error("bad section");
  if (!UGC_POOL_MODES.has(pool_mode)) throw new Error("bad pool_mode");
  // type_ids / stroke_ids only relevant for drill/main; both empty for warmup/cooldown
  if (section === "drill" || section === "main") {
    if (cleanTypeIds.length === 0 && cleanStrokeIds.length === 0) {
      throw new Error("drill/main require at least one type or stroke");
    }
  } else {
    // warmup/cooldown can't carry type/stroke tags — clear if any provided
    cleanTypeIds = [];
    cleanStrokeIds = [];
  }
  if (typeof label !== "string" || !label.trim() || label.length > 120) throw new Error("label 1-120 chars");
  if (!Number.isInteger(total_yards) || total_yards <= 0 || total_yards > 20000) throw new Error("total_yards out of range");
  if (type_affinity != null) {
    if (!Array.isArray(type_affinity)) throw new Error("type_affinity must be array");
    for (const t of type_affinity) if (typeof t !== "string") throw new Error("type_affinity items must be strings");
  }
  const v = visibility || "private";
  if (!allowVisibility.includes(v)) throw new Error(`visibility must be one of: ${allowVisibility.join(", ")}`);
  // team visibility requires a non-empty team_ids array. Other visibilities
  // ignore team_ids (the helper that writes shares clears the table anyway).
  let cleanTeamIds = [];
  if (v === "team") {
    if (!Array.isArray(team_ids) || team_ids.length === 0) {
      throw new Error("team visibility requires team_ids");
    }
    for (const id of team_ids) {
      if (typeof id !== "string" || !id.trim()) throw new Error("bad team_id in team_ids");
      cleanTeamIds.push(id.trim());
    }
    cleanTeamIds = Array.from(new Set(cleanTeamIds));  // dedup
  }
  if (!Array.isArray(sets) || sets.length === 0) throw new Error("at least 1 set required");
  if (sets.length > 24) throw new Error("max 24 sets per option");
  let computedTotal = 0;
  const cleanSets = [];
  for (const [i, s] of sets.entries()) {
    if (!s || typeof s !== "object") throw new Error(`set ${i}: not an object`);
    if (!Number.isInteger(s.reps) || s.reps <= 0)  throw new Error(`set ${i}: reps must be positive int`);
    if (!Number.isInteger(s.dist) || s.dist <= 0)  throw new Error(`set ${i}: dist must be positive int`);
    if (typeof s.desc !== "string" || !s.desc.trim() || s.desc.length > 500) throw new Error(`set ${i}: desc 1-500 chars`);
    if (typeof s.interval !== "string" || !UGC_INTERVAL_RE.test(s.interval)) throw new Error(`set ${i}: interval must match "On M:SS" or "No interval..."`);
    if (s.focus  != null && (typeof s.focus  !== "string" || s.focus.length  > 240)) throw new Error(`set ${i}: focus max 240 chars`);
    if (s.stroke != null && (typeof s.stroke !== "string" || s.stroke.length > 16))  throw new Error(`set ${i}: stroke max 16 chars`);
    if (s.eq     != null && (typeof s.eq     !== "string" || s.eq.length     > 16))  throw new Error(`set ${i}: eq max 16 chars`);
    computedTotal += s.reps * s.dist;
    cleanSets.push({
      reps:     s.reps,
      dist:     s.dist,
      desc:     s.desc.trim(),
      interval: s.interval,
      focus:    s.focus  ? String(s.focus).trim()  : null,
      stroke:   s.stroke ? String(s.stroke).trim() : null,
      eq:       s.eq     ? String(s.eq).trim()     : null,
    });
  }
  // Sanity check: author-provided total_yards must be within 10% of computed.
  const drift = Math.abs(computedTotal - total_yards) / total_yards;
  if (drift > 0.10) throw new Error(`total_yards (${total_yards}) drifts >10% from computed (${computedTotal})`);
  // Singleton type_id / stroke_id kept in sync with array form for
  // backward compat with code paths that haven't been switched yet
  // (snapshot pre-fill, dbGetUgcOverlay fallback during transition).
  // First-element-of-array becomes the singleton.
  return {
    section,
    type_id:       cleanTypeIds[0]   || null,
    stroke_id:     cleanStrokeIds[0] || null,
    type_ids:      cleanTypeIds,
    stroke_ids:    cleanStrokeIds,
    pool_mode,
    label:         label.trim(),
    total_yards,
    type_affinity: type_affinity ? JSON.stringify(type_affinity) : null,
    visibility:    v,
    team_ids:      cleanTeamIds,
    lesson_level:  lessonLevel,
    sets:          cleanSets,
  };
}

// Replace the team-share rows for a UGC option. Validates that the caller
// coaches every listed team (via dbGetTeamRole). Pass `conn` to participate
// in an existing transaction (used by dbCreateUgcOption / dbUpdateUgcOption);
// omit to run as a standalone transaction.
export async function dbSetUgcOptionTeamShares(authorSub, optionId, teamIds, conn = null) {
  if (!authorSub || !optionId) throw new Error("authorSub + optionId required");
  if (!Array.isArray(teamIds)) throw new Error("teamIds must be array");
  // Coach-of-team check: caller must have a non-removed role on every team.
  for (const tid of teamIds) {
    const role = await dbGetTeamRole(tid, authorSub);
    if (!role) throw new Error(`not_authorized: caller does not coach team ${tid}`);
  }
  const standalone = !conn;
  const c = conn || await pool.getConnection();
  try {
    if (standalone) await c.beginTransaction();
    // Clear existing shares + reinsert. With ~tens of teams per option
    // max, this is cheaper than diffing for inserts/deletes.
    await c.query("DELETE FROM `bank_option_team_shares` WHERE `option_id` = ?", [optionId]);
    for (const tid of teamIds) {
      await c.query(
        "INSERT INTO `bank_option_team_shares` (`option_id`, `team_id`) VALUES (?, ?)",
        [optionId, tid]
      );
    }
    if (standalone) await c.commit();
    return { ok: true, count: teamIds.length };
  } catch (err) {
    if (standalone) { try { await c.rollback(); } catch (_) {} }
    throw err;
  } finally {
    if (standalone) c.release();
  }
}

// Count caller's unpromoted UGC options (for quota check).
async function dbCountAuthorUgc(authorSub) {
  const rows = await pool.query(
    "SELECT COUNT(*) AS n FROM `bank_options` " +
    "WHERE `author_sub` = ? AND `promoted_at` IS NULL",
    [authorSub]
  );
  return Number(rows[0]?.n || 0);
}

// INSERT new UGC option + its sets in a transaction. Returns the new option_id.
// When visibility='team', also writes the bank_option_team_shares rows in
// the same transaction (with coach-of-team validation).
export async function dbCreateUgcOption(authorSub, payload) {
  if (!authorSub) throw new Error("authorSub required");
  const clean = validateUgcPayload(payload);  // throws on bad input
  const count = await dbCountAuthorUgc(authorSub);
  if (count >= UGC_QUOTA_PER_COACH) {
    throw new Error(`UGC quota reached (${UGC_QUOTA_PER_COACH} unpromoted options). Delete or get an option graduated before adding more.`);
  }
  // Coach-of-team pre-check before opening the transaction so we fail fast.
  if (clean.visibility === "team") {
    for (const tid of clean.team_ids) {
      const role = await dbGetTeamRole(tid, authorSub);
      if (!role) throw new Error(`not_authorized: caller does not coach team ${tid}`);
    }
  }
  const optionId = genUgcOptionId();
  // Author-requested 'public' is coerced to 'pending' until admin
  // approves (Phase E moderation flow). Mirrors dbSetUgcOptionVisibility.
  const storedVisibility = clean.visibility === "public" ? "pending" : clean.visibility;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      "INSERT INTO `bank_options` " +
      "(`id`, `section`, `type_id`, `stroke_id`, `type_ids`, `stroke_ids`, `lesson_level`, `pool_mode`, `label`, " +
      " `total_yards`, `type_affinity`, `author_sub`, `visibility`) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [optionId, clean.section, clean.type_id, clean.stroke_id,
       JSON.stringify(clean.type_ids), JSON.stringify(clean.stroke_ids), clean.lesson_level,
       clean.pool_mode, clean.label, clean.total_yards, clean.type_affinity,
       authorSub, storedVisibility]
    );
    for (const [i, s] of clean.sets.entries()) {
      await conn.query(
        "INSERT INTO `bank_sets` " +
        "(`id`, `option_id`, `seq`, `reps`, `dist`, `desc`, `interval`, `focus`, `stroke`, `eq`) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [genUgcSetId(), optionId, i, s.reps, s.dist, s.desc, s.interval, s.focus, s.stroke, s.eq]
      );
    }
    if (clean.visibility === "team" && clean.team_ids.length > 0) {
      for (const tid of clean.team_ids) {
        await conn.query(
          "INSERT INTO `bank_option_team_shares` (`option_id`, `team_id`) VALUES (?, ?)",
          [optionId, tid]
        );
      }
    }
    await conn.commit();
    return { ok: true, id: optionId, visibility: storedVisibility };
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    throw err;
  } finally {
    conn.release();
  }
}

// Fetch a single UGC option + its sets. Returns null if not found.
// Does NOT enforce visibility — caller (server route) is responsible
// for that (e.g., own-only for edit, broader for read).
export async function dbGetUgcOption(optionId) {
  if (!optionId) return null;
  const rows = await pool.query(
    "SELECT `id`, `section`, `type_id`, `stroke_id`, `type_ids`, `stroke_ids`, `lesson_level`, " +
    "       `pool_mode`, `label`, " +
    "       `total_yards`, `type_affinity`, `author_sub`, `visibility`, " +
    "       `created_at`, `updated_at`, `version`, `promoted_at`, `promoted_by_sub` " +
    "FROM `bank_options` WHERE `id` = ?",
    [optionId]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  const setRows = await pool.query(
    "SELECT `id`, `seq`, `reps`, `dist`, `desc`, `interval`, `focus`, `stroke`, `eq` " +
    "FROM `bank_sets` WHERE `option_id` = ? ORDER BY `seq`",
    [optionId]
  );
  const teamShareRows = await pool.query(
    "SELECT `team_id` FROM `bank_option_team_shares` WHERE `option_id` = ?",
    [optionId]
  );
  let typeAffinity = null;
  if (r.type_affinity) {
    try {
      typeAffinity = typeof r.type_affinity === "string" ? JSON.parse(r.type_affinity) : r.type_affinity;
    } catch (_) {}
  }
  // Parse JSON columns; backward-compat fall back to singleton wrapping.
  const parseJsonArr = (val, fallback) => {
    if (val == null) return fallback;
    if (Array.isArray(val)) return val;
    if (typeof val === "string") {
      try { const j = JSON.parse(val); return Array.isArray(j) ? j : fallback; } catch (_) { return fallback; }
    }
    return fallback;
  };
  const typeIds   = parseJsonArr(r.type_ids,   r.type_id   ? [r.type_id]   : []);
  const strokeIds = parseJsonArr(r.stroke_ids, r.stroke_id ? [r.stroke_id] : []);
  return {
    id:              r.id,
    section:         r.section,
    type_id:         r.type_id,    // singleton kept for backward-compat
    stroke_id:       r.stroke_id,
    type_ids:        typeIds,      // array form is canonical going forward
    stroke_ids:      strokeIds,
    lesson_level:    r.lesson_level || null,   // Lesson tier (Phase 5)
    pool_mode:       r.pool_mode,
    label:           r.label,
    total_yards:     r.total_yards,
    type_affinity:   typeAffinity,
    author_sub:      r.author_sub,
    visibility:      r.visibility,
    created_at:      r.created_at,
    updated_at:      r.updated_at,
    version:         r.version,
    promoted_at:     r.promoted_at,
    promoted_by_sub: r.promoted_by_sub,
    team_ids:        teamShareRows.map(t => t.team_id),
    sets:            setRows.map(s => ({
      id:       s.id,
      seq:      s.seq,
      reps:     s.reps,
      dist:     s.dist,
      desc:     s.desc,
      interval: s.interval,
      focus:    s.focus  || null,
      stroke:   s.stroke || null,
      eq:       s.eq     || null,
    })),
  };
}

// List all UGC options authored by caller. Used by the "My Sets" page.
// Returns lightweight rows (no sets) ordered by updated_at DESC.
// Includes latest_review_reason for rejected rows so MySetsView can
// surface the rejection reason without N+1 fetches.
export async function dbListUgcOptionsByAuthor(authorSub) {
  if (!authorSub) return [];
  const rows = await pool.query(
    "SELECT bo.`id`, bo.`section`, bo.`type_id`, bo.`stroke_id`, " +
    "       bo.`type_ids`, bo.`stroke_ids`, bo.`lesson_level`, bo.`pool_mode`, bo.`label`, " +
    "       bo.`total_yards`, bo.`visibility`, bo.`created_at`, bo.`updated_at`, " +
    "       bo.`version`, bo.`promoted_at`, " +
    // Latest review reason for rejected rows. NULL when no reviews exist
    // or row isn't rejected. Subquery picks the most recent review row.
    "       (SELECT `reason` FROM `bank_option_reviews` r " +
    "         WHERE r.`option_id` = bo.`id` AND bo.`visibility` = 'rejected' " +
    "         ORDER BY r.`reviewed_at` DESC LIMIT 1) AS latest_review_reason " +
    "FROM `bank_options` bo WHERE bo.`author_sub` = ? " +
    "ORDER BY bo.`updated_at` DESC",
    [authorSub]
  );
  const parseArr = (val, fallback) => {
    if (val == null) return fallback;
    if (Array.isArray(val)) return val;
    if (typeof val === "string") {
      try { const j = JSON.parse(val); return Array.isArray(j) ? j : fallback; } catch (_) { return fallback; }
    }
    return fallback;
  };
  return rows.map(r => ({
    id:                    r.id,
    section:               r.section,
    type_id:               r.type_id,    // singleton kept for compat
    stroke_id:             r.stroke_id,
    type_ids:              parseArr(r.type_ids,   r.type_id   ? [r.type_id]   : []),
    stroke_ids:            parseArr(r.stroke_ids, r.stroke_id ? [r.stroke_id] : []),
    lesson_level:          r.lesson_level || null,   // Lesson tier (Phase 5)
    pool_mode:             r.pool_mode,
    label:                 r.label,
    total_yards:           r.total_yards,
    visibility:            r.visibility,
    created_at:            r.created_at,
    updated_at:            r.updated_at,
    version:               r.version,
    promoted_at:           r.promoted_at,
    latest_review_reason:  r.latest_review_reason || null,
  }));
}

// Update a UGC option: replace sets + bump version. Optionally flips
// visibility back to 'pending' if the row was public (spec §6).
// Rejects if author_sub !== caller (admin override is in the route layer).
// Rejects if promoted_at IS NOT NULL (graduated rows are frozen).
export async function dbUpdateUgcOption(authorSub, optionId, payload) {
  if (!authorSub || !optionId) throw new Error("authorSub + optionId required");
  // Fetch current state to enforce ownership + frozen-when-promoted.
  const current = await dbGetUgcOption(optionId);
  if (!current) throw new Error("not_found");
  if (current.author_sub !== authorSub) throw new Error("not_authorized");
  if (current.promoted_at) throw new Error("frozen: row has been promoted to JS — edit the JS directly");
  // Allow same visibility as current OR private (downgrade is always fine).
  // If current was public and the edit is anything other than private,
  // it gets flipped to pending per §6.
  const clean = validateUgcPayload(payload, { allowVisibility: ["private", "team", "public", "pending"] });
  // Any author request for 'public' goes to 'pending' moderation queue,
  // regardless of current visibility. This handles both the
  // edit-reverts-public-approval case (current=public + new=public) and
  // the fresh-submission case (current=private + new=public).
  let newVisibility = clean.visibility;
  if (newVisibility === "public") {
    newVisibility = "pending";
  }
  // Coach-of-team pre-check before transaction (fail fast).
  if (newVisibility === "team") {
    for (const tid of clean.team_ids) {
      const role = await dbGetTeamRole(tid, authorSub);
      if (!role) throw new Error(`not_authorized: caller does not coach team ${tid}`);
    }
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      "UPDATE `bank_options` SET " +
      "  `section` = ?, `type_id` = ?, `stroke_id` = ?, " +
      "  `type_ids` = ?, `stroke_ids` = ?, `lesson_level` = ?, `pool_mode` = ?, " +
      "  `label` = ?, `total_yards` = ?, `type_affinity` = ?, `visibility` = ?, " +
      "  `version` = `version` + 1 " +
      "WHERE `id` = ?",
      [clean.section, clean.type_id, clean.stroke_id,
       JSON.stringify(clean.type_ids), JSON.stringify(clean.stroke_ids), clean.lesson_level,
       clean.pool_mode, clean.label, clean.total_yards, clean.type_affinity,
       newVisibility, optionId]
    );
    // Replace sets: delete then re-insert.
    await conn.query("DELETE FROM `bank_sets` WHERE `option_id` = ?", [optionId]);
    for (const [i, s] of clean.sets.entries()) {
      await conn.query(
        "INSERT INTO `bank_sets` " +
        "(`id`, `option_id`, `seq`, `reps`, `dist`, `desc`, `interval`, `focus`, `stroke`, `eq`) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [genUgcSetId(), optionId, i, s.reps, s.dist, s.desc, s.interval, s.focus, s.stroke, s.eq]
      );
    }
    // Replace team-share rows. Always clear; reinsert only if visibility='team'.
    // Switching away from team visibility (or to private) deletes all shares.
    await conn.query("DELETE FROM `bank_option_team_shares` WHERE `option_id` = ?", [optionId]);
    if (newVisibility === "team") {
      for (const tid of clean.team_ids) {
        await conn.query(
          "INSERT INTO `bank_option_team_shares` (`option_id`, `team_id`) VALUES (?, ?)",
          [optionId, tid]
        );
      }
    }
    await conn.commit();
    return { ok: true, id: optionId, visibility: newVisibility, reverted_to_pending: newVisibility === "pending" && clean.visibility === "public" };
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    throw err;
  } finally {
    conn.release();
  }
}

// List rows pending admin moderation (visibility='pending'). Phase E
// admin "Pending UGC" queue. Returns lightweight rows + author display
// name/initials/email for the queue listing.
export async function dbListPendingUgc({ limit = 100, offset = 0 } = {}) {
  // Phase 4 Identity I-D slice 5: JOIN persons for author display.
  const rows = await pool.query(
    "SELECT bo.`id`, bo.`section`, bo.`type_id`, bo.`stroke_id`, bo.`pool_mode`, " +
    "       bo.`label`, bo.`total_yards`, bo.`author_sub`, bo.`created_at`, bo.`updated_at`, " +
    "       u.`email` AS author_email, " +
    "       p.`first_name`, p.`last_name`, p.`preferred_name`, p.`initials` AS person_initials " +
    "FROM `bank_options` bo " +
    "LEFT JOIN `users` u   ON u.`sub` = bo.`author_sub` " +
    "LEFT JOIN `persons` p ON p.`id` = u.`person_id` " +
    "WHERE bo.`visibility` = 'pending' " +
    "ORDER BY bo.`updated_at` ASC " +  // FIFO: oldest pending reviewed first
    "LIMIT ? OFFSET ?",
    [Math.min(500, Math.max(1, limit)), Math.max(0, offset)]
  );
  return rows.map(r => ({
    id:               r.id,
    section:          r.section,
    type_id:          r.type_id,
    stroke_id:        r.stroke_id,
    pool_mode:        r.pool_mode,
    label:            r.label,
    total_yards:      r.total_yards,
    author_sub:       r.author_sub,
    author_name:      displayNameInline({ first_name: r.first_name, last_name: r.last_name, preferred_name: r.preferred_name }),
    author_initials:  r.person_initials,
    author_email:     r.author_email,
    created_at:       r.created_at,
    updated_at:       r.updated_at,
  }));
}

// Admin reviews a pending UGC option. INSERTs bank_option_reviews row +
// flips visibility to 'public' (approve) or 'rejected' (reject) atomically.
export async function dbReviewUgcOption(reviewerSub, optionId, { decision, reason = null }) {
  if (!reviewerSub || !optionId) throw new Error("reviewerSub + optionId required");
  if (decision !== "approve" && decision !== "reject") {
    throw new Error("decision must be 'approve' or 'reject'");
  }
  if (decision === "reject" && (!reason || typeof reason !== "string" || !reason.trim())) {
    throw new Error("reject requires a reason");
  }
  const current = await dbGetUgcOption(optionId);
  if (!current) throw new Error("not_found");
  if (current.visibility !== "pending") {
    throw new Error(`bad state: option is ${current.visibility}, not pending`);
  }
  const newVisibility = decision === "approve" ? "public" : "rejected";
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      "INSERT INTO `bank_option_reviews` (`option_id`, `reviewer_sub`, `decision`, `reason`) " +
      "VALUES (?, ?, ?, ?)",
      [optionId, reviewerSub, decision, decision === "reject" ? reason.trim() : null]
    );
    await conn.query(
      "UPDATE `bank_options` SET `visibility` = ? WHERE `id` = ?",
      [newVisibility, optionId]
    );
    await conn.commit();
    return { ok: true, id: optionId, visibility: newVisibility, decision };
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    throw err;
  } finally {
    conn.release();
  }
}

// Phase F — JS snippet builder. Converts a UGC option (with sets) into
// a JS literal matching the existing bank style. The admin pastes the
// returned snippet into public/index.html under the target constant
// (and sub-key for drill/main). Spec: UGC_COACH_SETS_SCOPE.md §3.F.

// Map (section, pool_mode) → JS constant name in public/index.html.
const UGC_GRADUATE_CONSTANTS = {
  warmup:   { "25y": "WARMUP_OPTIONS",   "25m": "WARMUP_OPTIONS_SCM",   "50m": "WARMUP_OPTIONS_50M"   },
  cooldown: { "25y": "COOLDOWN_OPTIONS", "25m": "COOLDOWN_OPTIONS_SCM", "50m": "COOLDOWN_OPTIONS_50M" },
  drill:    { "25y": "DRILL_OPTIONS",    "25m": "DRILL_OPTIONS_SCM",    "50m": "DRILL_OPTIONS_50M"    },
  main:     { "25y": "MAIN_OPTIONS",     "25m": "MAIN_OPTIONS_SCM",     "50m": "MAIN_OPTIONS_50M"     },
};

// Renders one set as a JS object literal one-liner. Order matches the
// existing bank's per-set field order: id, reps, dist, desc, interval,
// then optional focus/stroke/eq.
function _renderUgcSetLine(s) {
  const parts = [];
  parts.push(`id: ${JSON.stringify(s.id)}`);
  parts.push(`reps: ${s.reps}`);
  parts.push(`dist: ${s.dist}`);
  parts.push(`desc: ${JSON.stringify(s.desc)}`);
  parts.push(`interval: ${JSON.stringify(s.interval)}`);
  if (s.focus)  parts.push(`focus: ${JSON.stringify(s.focus)}`);
  if (s.stroke) parts.push(`stroke: ${JSON.stringify(s.stroke)}`);
  if (s.eq)     parts.push(`eq: ${JSON.stringify(s.eq)}`);
  return `{ ${parts.join(", ")} }`;
}

// Builds the full graduate package for a single UGC option. Returns
// { snippet, constantName, subKey, instructions }. Throws if the
// (section, pool_mode) tuple can't map to a known constant.
//
// Post-Phase-H Stage 2: canonical JS bank is FLAT arrays with types[] +
// strokes[] tags per option. Snippet emits the matching shape and points
// the admin at the top-level array — no more sub-bucket lookup. Multi-tag
// UGC options graduate cleanly (their full tag arrays land in the snippet).
// `subKey` is kept in the return shape for back-compat with callers (it's
// always null now; clients should ignore it).
export function buildUgcGraduateSnippet(option) {
  if (!option) throw new Error("option required");
  const constantName = UGC_GRADUATE_CONSTANTS[option.section]?.[option.pool_mode];
  if (!constantName) {
    throw new Error(`no constant for section=${option.section}, pool_mode=${option.pool_mode}`);
  }

  const isTyped = (option.section === "drill" || option.section === "main");
  // Resolve tag arrays. UGC author payload uses snake_case (type_ids /
  // stroke_ids); fall back to wrapping legacy singletons if arrays absent.
  const typeIds = Array.isArray(option.type_ids)
    ? option.type_ids
    : (option.type_id ? [option.type_id] : []);
  const strokeIds = Array.isArray(option.stroke_ids)
    ? option.stroke_ids
    : (option.stroke_id ? [option.stroke_id] : []);
  if (isTyped && typeIds.length === 0 && strokeIds.length === 0) {
    throw new Error(`${option.section} option needs at least one type or stroke tag`);
  }

  // Render the option literal. Indentation matches the converted bank
  // produced by tools/convert_canonical_bank.mjs: 6 spaces for the option
  // line inside a flat array, 10 for set lines inside the sets array.
  // The admin pastes verbatim just before the closing `]` of the constant.
  const lines = [];
  const headerParts = [];
  headerParts.push(`label: ${JSON.stringify(option.label)}`);
  if (Array.isArray(option.type_affinity) && option.type_affinity.length > 0) {
    headerParts.push(`typeAffinity: ${JSON.stringify(option.type_affinity)}`);
  }
  headerParts.push(`totalYards: ${option.total_yards}`);
  // Tags: both arrays always present (matches Stage 2 conversion output).
  headerParts.push(`types: ${JSON.stringify(typeIds)}`);
  headerParts.push(`strokes: ${JSON.stringify(strokeIds)}`);
  lines.push(`      { ${headerParts.join(", ")}, sets: [`);
  for (const s of (option.sets || [])) {
    lines.push(`          ${_renderUgcSetLine(s)},`);
  }
  lines.push(`        ]},`);
  const snippet = lines.join("\n");

  const instructions =
    `In public/index.html, find \`const ${constantName} = [\` and paste this ` +
    `option just before the closing \`]\` of that flat array. The new option ` +
    `inherits multi-tag membership from its types/strokes arrays — no sub-bucket lookup needed.`;

  // subKey stays in the return shape for back-compat with existing callers;
  // it's always null now (no sub-buckets in the flat-array canonical bank).
  return { snippet, constantName, subKey: null, instructions };
}

// Phase F — list public UGC options eligible for graduation into JS.
// visibility='public' AND promoted_at IS NULL. Ordered by the most
// recent approval timestamp (from the latest review row of decision='approve')
// so admin sees freshly-approved options at top.
export async function dbListPromotableUgc({ limit = 100, offset = 0 } = {}) {
  // Phase 4 Identity I-D slice 5: JOIN persons for author display.
  const rows = await pool.query(
    "SELECT bo.`id`, bo.`section`, bo.`type_id`, bo.`stroke_id`, bo.`pool_mode`, " +
    "       bo.`label`, bo.`total_yards`, bo.`author_sub`, bo.`created_at`, bo.`updated_at`, " +
    "       u.`email` AS author_email, " +
    "       p.`first_name`, p.`last_name`, p.`preferred_name`, p.`initials` AS person_initials, " +
    "       (SELECT MAX(`reviewed_at`) FROM `bank_option_reviews` r " +
    "          WHERE r.`option_id` = bo.`id` AND r.`decision` = 'approve') AS approved_at " +
    "FROM `bank_options` bo " +
    "LEFT JOIN `users` u   ON u.`sub` = bo.`author_sub` " +
    "LEFT JOIN `persons` p ON p.`id` = u.`person_id` " +
    "WHERE bo.`visibility` = 'public' AND bo.`promoted_at` IS NULL " +
    "ORDER BY approved_at DESC, bo.`updated_at` DESC " +
    "LIMIT ? OFFSET ?",
    [Math.min(500, Math.max(1, limit)), Math.max(0, offset)]
  );
  return rows.map(r => ({
    id:               r.id,
    section:          r.section,
    type_id:          r.type_id,
    stroke_id:        r.stroke_id,
    pool_mode:        r.pool_mode,
    label:            r.label,
    total_yards:      r.total_yards,
    author_sub:       r.author_sub,
    author_name:      displayNameInline({ first_name: r.first_name, last_name: r.last_name, preferred_name: r.preferred_name }),
    author_initials:  r.person_initials,
    author_email:     r.author_email,
    created_at:       r.created_at,
    updated_at:       r.updated_at,
    approved_at:      r.approved_at,
  }));
}

// Stamp a UGC option as promoted into JS. Two-step graduate flow: admin
// pastes the snippet locally + pushes, then confirms here. After this,
// the overlay endpoint stops returning the row (filtered by promoted_at
// IS NOT NULL); the JS file is now the authority.
export async function dbMarkUgcPromoted(reviewerSub, optionId) {
  if (!reviewerSub || !optionId) throw new Error("reviewerSub + optionId required");
  const current = await dbGetUgcOption(optionId);
  if (!current) throw new Error("not_found");
  if (current.visibility !== "public") {
    throw new Error(`bad state: option is ${current.visibility}, not public`);
  }
  if (current.promoted_at) throw new Error("already_promoted");
  await pool.query(
    "UPDATE `bank_options` SET `promoted_at` = CURRENT_TIMESTAMP, `promoted_by_sub` = ? WHERE `id` = ?",
    [reviewerSub, optionId]
  );
  return { ok: true, id: optionId, promoted_by_sub: reviewerSub };
}

// Fetch the latest review row for an option (used by MySetsView to
// show the rejection reason on rejected rows). Returns null when no
// reviews exist.
export async function dbGetLatestUgcReview(optionId) {
  if (!optionId) return null;
  const rows = await pool.query(
    "SELECT `id`, `option_id`, `reviewer_sub`, `decision`, `reason`, `reviewed_at` " +
    "FROM `bank_option_reviews` WHERE `option_id` = ? " +
    "ORDER BY `reviewed_at` DESC LIMIT 1",
    [optionId]
  );
  return rows[0] || null;
}

// Standalone visibility-change endpoint helper. Lighter than dbUpdate
// (no set rewrite, no version bump). Body: { visibility, team_ids? }.
export async function dbSetUgcOptionVisibility(authorSub, optionId, { visibility, team_ids = [] }) {
  if (!authorSub || !optionId) throw new Error("authorSub + optionId required");
  const current = await dbGetUgcOption(optionId);
  if (!current) throw new Error("not_found");
  if (current.author_sub !== authorSub) throw new Error("not_authorized");
  if (current.promoted_at) throw new Error("frozen: row has been promoted to JS");
  const allowed = ["private", "team", "public", "pending"];
  if (!allowed.includes(visibility)) throw new Error("bad visibility");
  // Public submission flips to pending until admin moderation. Phase E
  // will add the admin queue; for now this just records intent.
  let newVisibility = visibility;
  if (visibility === "public") newVisibility = "pending";
  // team requires non-empty team_ids + coach-of-team for each.
  if (newVisibility === "team") {
    if (!Array.isArray(team_ids) || team_ids.length === 0) {
      throw new Error("team visibility requires team_ids");
    }
    for (const tid of team_ids) {
      const role = await dbGetTeamRole(tid, authorSub);
      if (!role) throw new Error(`not_authorized: caller does not coach team ${tid}`);
    }
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      "UPDATE `bank_options` SET `visibility` = ? WHERE `id` = ?",
      [newVisibility, optionId]
    );
    await conn.query("DELETE FROM `bank_option_team_shares` WHERE `option_id` = ?", [optionId]);
    if (newVisibility === "team") {
      for (const tid of team_ids) {
        await conn.query(
          "INSERT INTO `bank_option_team_shares` (`option_id`, `team_id`) VALUES (?, ?)",
          [optionId, tid]
        );
      }
    }
    await conn.commit();
    return { ok: true, id: optionId, visibility: newVisibility };
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    throw err;
  } finally {
    conn.release();
  }
}

// DELETE a UGC option (and its sets via cascade FK). Owner-only.
// Promoted rows: refuse unless an admin override is requested at the
// route layer (this helper enforces author_sub gating).
export async function dbDeleteUgcOption(authorSub, optionId) {
  if (!authorSub || !optionId) throw new Error("authorSub + optionId required");
  const current = await dbGetUgcOption(optionId);
  if (!current) return { ok: true, deleted: 0 };  // idempotent
  if (current.author_sub !== authorSub) throw new Error("not_authorized");
  if (current.promoted_at) throw new Error("frozen: row has been promoted to JS — admin must hard-delete via separate path");
  const r = await pool.query("DELETE FROM `bank_options` WHERE `id` = ?", [optionId]);
  return { ok: true, deleted: Number(r.affectedRows || 0) };
}

// ── Goals ────────────────────────────────────────────────────────────
// Metric set is fixed; period_start/end are NULL for recurring goals
// (the only kind exposed by the UI in MVP). Multiple historical rows
// per (user, metric) are allowed by the schema, but `dbSetGoal` enforces
// "one active recurring goal per metric" by deleting prior NULL-period
// rows before inserting.

const GOAL_METRICS = ["workouts_per_week", "yards_per_week", "yards_per_month"];

export async function dbListGoals(userSub) {
  if (!userSub) return [];
  const rows = await pool.query(
    "SELECT `metric`, `target_value` FROM `goals` " +
    "WHERE `user_sub` = ? AND `period_start` IS NULL AND `period_end` IS NULL " +
    "ORDER BY `created_at` DESC",
    [userSub]
  );
  // Collapse duplicates defensively — keep newest per metric.
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    if (seen.has(r.metric)) continue;
    seen.add(r.metric);
    out.push({ metric: r.metric, target_value: Number(r.target_value) });
  }
  return out;
}

export async function dbSetGoal(userSub, metric, targetValue) {
  if (!userSub) throw new Error("userSub required");
  if (!GOAL_METRICS.includes(metric)) throw new Error("unknown metric");
  const v = Number(targetValue);
  if (!Number.isFinite(v) || v <= 0 || v > 1_000_000) throw new Error("invalid target_value");
  await dbEnsureUser(userSub);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      "DELETE FROM `goals` WHERE `user_sub` = ? AND `metric` = ? AND `period_start` IS NULL AND `period_end` IS NULL",
      [userSub, metric]
    );
    await conn.query(
      "INSERT INTO `goals` (`user_sub`, `metric`, `target_value`) VALUES (?, ?, ?)",
      [userSub, metric, Math.round(v)]
    );
    await conn.commit();
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    throw err;
  } finally {
    conn.release();
  }
}

export async function dbDeleteGoal(userSub, metric) {
  if (!userSub) return;
  if (!GOAL_METRICS.includes(metric)) return;
  await pool.query(
    "DELETE FROM `goals` WHERE `user_sub` = ? AND `metric` = ? AND `period_start` IS NULL AND `period_end` IS NULL",
    [userSub, metric]
  );
}

// ── Feedback (Session 5) ─────────────────────────────────────────────
// User submissions land in the `feedback` table (migration 007). Admins
// triage from a tab in the admin view.

// Cat Phase II (2026-05-15) added "catalog-flag" — coach-submitted reports
// from the in-app catalog browse (each option row has a 🚩 Flag button that
// opens the feedback modal prefilled). VARCHAR(32) on the column accommodates.
const FEEDBACK_CATEGORIES = ["bug", "idea", "praise", "other", "catalog-flag"];
const FEEDBACK_STATUSES   = ["new", "reviewed", "resolved", "dismissed"];

export async function dbInsertFeedback({ userSub, category, subject, body, page, userAgent }) {
  if (!category || !FEEDBACK_CATEGORIES.includes(category)) throw new Error("bad category");
  if (!subject || typeof subject !== "string") throw new Error("subject required");
  if (!body    || typeof body    !== "string") throw new Error("body required");
  if (subject.length > 255) throw new Error("subject max 255 chars");
  if (body.length    > 10000) throw new Error("body max 10000 chars");
  if (userSub) await dbEnsureUser(userSub);
  const r = await pool.query(
    "INSERT INTO `feedback` (`user_sub`, `category`, `subject`, `body`, `page`, `user_agent`) " +
    "VALUES (?, ?, ?, ?, ?, ?)",
    [
      userSub || null,
      category,
      subject.slice(0, 255),
      body.slice(0, 10000),
      page ? String(page).slice(0, 255) : null,
      userAgent ? String(userAgent).slice(0, 255) : null,
    ]
  );
  return { ok: true, id: Number(r.insertId) };
}

export async function dbAdminListFeedback({ status = null, userSub = null, limit = 200 } = {}) {
  const where = [];
  const args  = [];
  if (status) { where.push("f.`status` = ?"); args.push(status); }
  if (userSub) { where.push("f.`user_sub` = ?"); args.push(userSub); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const cap = Math.min(Math.max(1, Number(limit) || 200), 500);
  // Phase 4 Identity I-D slice 3: JOIN persons for submitter + reviewer.
  // Two person JOINs (pu for submitter, pr for reviewer). Submitter gets a
  // displayed name (computed via helper); reviewer is initials-only in the UI.
  const rows = await pool.query(
    "SELECT f.`id`, f.`user_sub`, f.`category`, f.`subject`, f.`body`, f.`page`, " +
    "       f.`user_agent`, f.`status`, f.`reviewed_by`, f.`reviewed_at`, f.`admin_note`, f.`created_at`, " +
    "       pu.`initials` AS submitter_initials, " +
    "       pu.`first_name` AS submitter_first, pu.`last_name` AS submitter_last, pu.`preferred_name` AS submitter_preferred, " +
    "       pr.`initials` AS reviewer_initials " +
    "FROM `feedback` f " +
    "LEFT JOIN `users` u    ON u.`sub` = f.`user_sub` " +
    "LEFT JOIN `users` r    ON r.`sub` = f.`reviewed_by` " +
    "LEFT JOIN `persons` pu ON pu.`id` = u.`person_id` " +
    "LEFT JOIN `persons` pr ON pr.`id` = r.`person_id` " +
    `${whereSql} ` +
    "ORDER BY f.`created_at` DESC " +
    `LIMIT ${cap}`,
    args
  );
  return rows.map(r => ({
    id:                 Number(r.id),
    user_sub:           r.user_sub,
    submitter_initials: r.submitter_initials,
    submitter_name:     displayNameInline({ first_name: r.submitter_first, last_name: r.submitter_last, preferred_name: r.submitter_preferred }),
    category:           r.category,
    subject:            r.subject,
    body:               r.body,
    page:               r.page,
    user_agent:         r.user_agent,
    status:             r.status,
    reviewed_by:        r.reviewed_by,
    reviewer_initials:  r.reviewer_initials,
    reviewed_at:        dtToIso(r.reviewed_at),
    admin_note:         r.admin_note,
    created_at:         dtToIso(r.created_at),
  }));
}

export async function dbAdminUpdateFeedback(id, { status, admin_note }, reviewerSub) {
  const setsArr = [], vals = [];
  if (status !== undefined) {
    if (status !== null && !FEEDBACK_STATUSES.includes(status)) throw new Error("bad status");
    setsArr.push("`status` = ?"); vals.push(status);
    // Stamp reviewer when transitioning out of `new`.
    if (status && status !== "new" && reviewerSub) {
      setsArr.push("`reviewed_by` = ?", "`reviewed_at` = CURRENT_TIMESTAMP(3)");
      vals.push(reviewerSub);
    }
  }
  if (admin_note !== undefined) {
    setsArr.push("`admin_note` = ?");
    vals.push(admin_note === "" ? null : admin_note);
  }
  if (!setsArr.length) return { ok: true, affected: 0 };
  vals.push(id);
  const r = await pool.query(
    `UPDATE \`feedback\` SET ${setsArr.join(", ")} WHERE \`id\` = ?`,
    vals
  );
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

// ── Teams (relationships scope, Stage 1 / R-A) ────────────────────────
// See RELATIONSHIPS_SCOPE.md at repo root. Tables: `teams`, `team_coaches`
// (migration 011). Per decision #11 the 3-tier role enum is owner/admin/coach;
// per #25 team_type ∈ {high_school, summer, club, masters}; per #23 coach
// removal is append-only via removed_at (no DELETE).

const TEAM_TYPES = ["high_school", "summer", "club", "masters"];
const TEAM_ROLES = ["owner", "admin", "coach"];

function genTeamId() {
  // 6 base36 chars → ~2.18B values; collision risk negligible at our scale.
  // Same convention as set IDs (tools/assign_set_ids.py: s_xxxxxx).
  const n = crypto.randomBytes(4).readUInt32BE(0);
  return "tm_" + n.toString(36).padStart(6, "0").slice(-6);
}

export async function dbCreateTeam({ ownerSub, name, teamType }) {
  if (!ownerSub) throw new Error("ownerSub required");
  if (!name || typeof name !== "string") throw new Error("name required");
  if (name.length > 120) throw new Error("name max 120 chars");
  if (!TEAM_TYPES.includes(teamType)) throw new Error("bad team_type");
  await dbEnsureUser(ownerSub);
  const id = genTeamId();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      "INSERT INTO `teams` (`id`, `owner_coach_sub`, `name`, `team_type`) VALUES (?, ?, ?, ?)",
      [id, ownerSub, name.trim(), teamType]
    );
    await conn.query(
      "INSERT INTO `team_coaches` (`team_id`, `coach_sub`, `role`) VALUES (?, ?, 'owner')",
      [id, ownerSub]
    );
    await conn.commit();
    return { ok: true, id };
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    throw err;
  } finally {
    conn.release();
  }
}

export async function dbGetTeam(id) {
  if (!id) return null;
  const rows = await pool.query(
    "SELECT `id`, `owner_coach_sub`, `name`, `team_code`, `team_type`, `archived`, `created_at`, `updated_at` " +
    "FROM `teams` WHERE `id` = ?",
    [id]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id:              r.id,
    owner_coach_sub: r.owner_coach_sub,
    name:            r.name,
    team_code:       r.team_code || null,
    team_type:       r.team_type,
    archived:        !!r.archived,
    created_at:      dtToIso(r.created_at),
    updated_at:      dtToIso(r.updated_at),
  };
}

export async function dbListTeamsForCoach(coachSub) {
  if (!coachSub) return [];
  // Active membership only (removed_at IS NULL). Sort: non-archived first, then newest.
  const rows = await pool.query(
    "SELECT t.`id`, t.`owner_coach_sub`, t.`name`, t.`team_type`, t.`archived`, " +
    "       t.`created_at`, t.`updated_at`, tc.`role` " +
    "FROM `teams` t " +
    "JOIN `team_coaches` tc ON tc.`team_id` = t.`id` " +
    "WHERE tc.`coach_sub` = ? AND tc.`removed_at` IS NULL " +
    "ORDER BY t.`archived` ASC, t.`created_at` DESC",
    [coachSub]
  );
  return rows.map(r => ({
    id:              r.id,
    owner_coach_sub: r.owner_coach_sub,
    name:            r.name,
    team_type:       r.team_type,
    archived:        !!r.archived,
    role:            r.role,                                                  // viewer's role in THIS team
    created_at:      dtToIso(r.created_at),
    updated_at:      dtToIso(r.updated_at),
  }));
}

export async function dbUpdateTeam(id, { name, team_code } = {}) {
  if (!id) return { ok: false, reason: "no_id" };
  // `name` and `team_code` are mutable (team_type is immutable per #25; owner
  // change is a separate flow not built in v1). Each is optional in a patch.
  const sets = [], vals = [];
  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) return { ok: false, reason: "bad_name" };
    if (name.length > 120) return { ok: false, reason: "name_too_long" };
    sets.push("`name` = ?"); vals.push(name.trim());
  }
  if (team_code !== undefined) {
    // null / "" clears the code; otherwise 1–6 alphanumeric chars, stored uppercased.
    if (team_code === null || team_code === "") {
      sets.push("`team_code` = NULL");
    } else {
      if (typeof team_code !== "string" || !/^[A-Za-z0-9]{1,6}$/.test(team_code.trim())) {
        return { ok: false, reason: "bad_team_code" };
      }
      sets.push("`team_code` = ?"); vals.push(team_code.trim().toUpperCase());
    }
  }
  if (!sets.length) return { ok: false, reason: "no_fields" };
  vals.push(id);
  const r = await pool.query(`UPDATE \`teams\` SET ${sets.join(", ")} WHERE \`id\` = ?`, vals);
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

export async function dbArchiveTeam(id, archived = true) {
  if (!id) return { ok: false, reason: "no_id" };
  const r = await pool.query(
    "UPDATE `teams` SET `archived` = ? WHERE `id` = ?",
    [archived ? 1 : 0, id]
  );
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

export async function dbGetTeamRole(teamId, coachSub) {
  if (!teamId || !coachSub) return null;
  const rows = await pool.query(
    "SELECT `role` FROM `team_coaches` " +
    "WHERE `team_id` = ? AND `coach_sub` = ? AND `removed_at` IS NULL LIMIT 1",
    [teamId, coachSub]
  );
  return rows[0]?.role || null;
}

export async function dbListTeamCoaches(teamId) {
  if (!teamId) return [];
  // Identity (display_name + initials) comes from persons via person_id.
  // Legacy users columns dropped in migration 044.
  const rows = await pool.query(
    "SELECT tc.`coach_sub`, tc.`role`, tc.`added_at`, " +
    "       u.`email`, " +
    "       p.`first_name`, p.`last_name`, p.`preferred_name`, p.`initials` AS person_initials, " +
    "       ss.`external_id` AS safesport_id, ss.`expires_at` AS safesport_expires " +
    "FROM `team_coaches` tc " +
    "LEFT JOIN `users` u ON u.`sub` = tc.`coach_sub` " +
    "LEFT JOIN `persons` p ON p.`id` = u.`person_id` " +
    "LEFT JOIN `person_external_ids` ss ON ss.`person_id` = u.`person_id` AND ss.`system` = 'safesport_cert' " +
    "WHERE tc.`team_id` = ? AND tc.`removed_at` IS NULL " +
    "ORDER BY FIELD(tc.`role`, 'owner', 'admin', 'coach'), tc.`added_at` ASC",
    [teamId]
  );
  return rows.map(r => ({
    coach_sub:    r.coach_sub,
    role:         r.role,
    display_name: displayNameInline({ first_name: r.first_name, last_name: r.last_name, preferred_name: r.preferred_name }),
    initials:     r.person_initials,
    email:        r.email,
    added_at:     dtToIso(r.added_at),
    // MAAP cert rollup (eval 2026-06-06 #3): SafeSport status for the coaches roster.
    safesport_on:      !!r.safesport_id,
    safesport_expires: r.safesport_expires ? dateToYmd(r.safesport_expires) : null,
  }));
}

export async function dbAddTeamCoach(teamId, coachSub, role = "coach") {
  if (!teamId || !coachSub) return { ok: false, reason: "missing_args" };
  if (!TEAM_ROLES.includes(role)) return { ok: false, reason: "bad_role" };
  if (role === "owner") return { ok: false, reason: "owner_set_at_create_only" };
  // Target user must exist AND be coach-flagged (gate matches dbIsCoach but
  // also accepts admins, since admins implicitly have coach capability).
  const userRows = await pool.query(
    "SELECT `is_coach`, `is_admin`, `is_disabled` FROM `users` WHERE `sub` = ?",
    [coachSub]
  );
  if (!userRows[0]) return { ok: false, reason: "user_not_found" };
  const u = userRows[0];
  if (u.is_disabled) return { ok: false, reason: "user_disabled" };
  if (!(u.is_coach || u.is_admin)) return { ok: false, reason: "user_not_coach" };
  // If a removed row exists, re-activate it (stamp removed_at NULL + bump role
  // + bump added_at). Otherwise INSERT. Owner row is never overwritten here.
  const existing = await pool.query(
    "SELECT `role`, `removed_at` FROM `team_coaches` WHERE `team_id` = ? AND `coach_sub` = ?",
    [teamId, coachSub]
  );
  if (existing[0]) {
    if (existing[0].role === "owner") return { ok: false, reason: "already_owner" };
    if (existing[0].removed_at === null) return { ok: false, reason: "already_active" };
    await pool.query(
      "UPDATE `team_coaches` SET `role` = ?, `removed_at` = NULL, `added_at` = CURRENT_TIMESTAMP(3) " +
      "WHERE `team_id` = ? AND `coach_sub` = ?",
      [role, teamId, coachSub]
    );
    return { ok: true, reactivated: true };
  }
  await pool.query(
    "INSERT INTO `team_coaches` (`team_id`, `coach_sub`, `role`) VALUES (?, ?, ?)",
    [teamId, coachSub, role]
  );
  return { ok: true };
}

export async function dbRemoveTeamCoach(teamId, coachSub) {
  if (!teamId || !coachSub) return { ok: false, reason: "missing_args" };
  // Owner cannot be removed via this endpoint (would orphan the team's
  // owner_coach_sub FK). Ownership transfer is its own flow (not v1).
  const role = await dbGetTeamRole(teamId, coachSub);
  if (role === null) return { ok: false, reason: "not_active" };
  if (role === "owner") return { ok: false, reason: "cannot_remove_owner" };
  // R-J: refuse to remove if this coach is still primary on any active
  // (non-archived) group in this team. Caller must transition primary first.
  // Returns the conflicting groups so the UI can prompt the user.
  const primaryGroups = await pool.query(
    "SELECT `id`, `name` FROM `groups` " +
    "WHERE `team_id` = ? AND `primary_coach_sub` = ? AND `archived` = 0",
    [teamId, coachSub]
  );
  if (primaryGroups.length > 0) {
    return {
      ok: false,
      reason: "primary_on_groups",
      groups: primaryGroups.map(g => ({ id: g.id, name: g.name })),
    };
  }
  const r = await pool.query(
    "UPDATE `team_coaches` SET `removed_at` = CURRENT_TIMESTAMP(3) " +
    "WHERE `team_id` = ? AND `coach_sub` = ? AND `removed_at` IS NULL",
    [teamId, coachSub]
  );
  // Continuity: the departing coach's team-shared UGC moves to the current
  // owner so it stays live. Public UGC keeps its author (moderation trail);
  // private stays theirs. (OWNERSHIP_TRANSFER_SCOPE §3.6 / decision 7.)
  let ugcReassigned = 0;
  if (Number(r.affectedRows)) {
    const ownerRows = await pool.query("SELECT `owner_coach_sub` FROM `teams` WHERE `id` = ?", [teamId]);
    const ownerSub = ownerRows[0]?.owner_coach_sub;
    if (ownerSub && ownerSub !== coachSub) {
      const ug = await dbReassignDepartingCoachUgc({ teamId, departingSub: coachSub, newOwnerSub: ownerSub, includePublic: false });
      ugcReassigned = ug.reassigned;
    }
  }
  return { ok: true, affected: Number(r.affectedRows || 0), ugc_reassigned: ugcReassigned };
}

// R-J: promote/demote between admin and coach. Owner unchanged here
// (ownership transfer is its own flow). Caller-side auth check: only team
// owner can call this.
export async function dbUpdateTeamCoachRole(teamId, coachSub, role) {
  if (!teamId || !coachSub) return { ok: false, reason: "missing_args" };
  if (role !== "admin" && role !== "coach") return { ok: false, reason: "bad_role" };
  const currentRole = await dbGetTeamRole(teamId, coachSub);
  if (currentRole === null) return { ok: false, reason: "not_active" };
  if (currentRole === "owner") return { ok: false, reason: "cannot_change_owner_role" };
  if (currentRole === role) return { ok: true, affected: 0, unchanged: true };
  const r = await pool.query(
    "UPDATE `team_coaches` SET `role` = ? WHERE `team_id` = ? AND `coach_sub` = ? AND `removed_at` IS NULL",
    [role, teamId, coachSub]
  );
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

// ─── Ownership transfer (Phase 4 / OWNERSHIP_TRANSFER_SCOPE.md) ───────
// A deliberate, reversible hand-off of a team's ownership. Owner is stored
// in TWO places — teams.owner_coach_sub AND team_coaches.role='owner' — and
// the swap updates both atomically. On accept / 30-day auto-complete, the
// departing owner's team-shared + public UGC reassigns to the new owner.

// Txn helper: flip both owner representations. Throws if the proposed owner is
// no longer an active member of the team (left during the cooldown).
async function _applyOwnershipSwap(conn, teamId, fromSub, toSub) {
  const up = await conn.query(
    "UPDATE `team_coaches` SET `role` = 'owner' WHERE `team_id` = ? AND `coach_sub` = ? AND `removed_at` IS NULL",
    [teamId, toSub]
  );
  if (!Number(up.affectedRows)) throw new Error("proposed owner is no longer an active team member");
  await conn.query("UPDATE `teams` SET `owner_coach_sub` = ? WHERE `id` = ?", [toSub, teamId]);
  await conn.query(
    "UPDATE `team_coaches` SET `role` = 'admin' WHERE `team_id` = ? AND `coach_sub` = ? AND `removed_at` IS NULL",
    [teamId, fromSub]
  );
}

// Reassign a departing coach's UGC so it stays live. `includePublic` is true
// for an ownership hand-off (the departing owner's public UGC moves too), false
// for a regular coach leaving (public keeps its author — moderation trail). Only
// the team-shared rows for THIS team move. Skips graduated (promoted_at) rows.
export async function dbReassignDepartingCoachUgc({ teamId, departingSub, newOwnerSub, includePublic = false }, conn = pool) {
  if (!teamId || !departingSub || !newOwnerSub || departingSub === newOwnerSub) return { reassigned: 0, ids: [] };
  const teamShared = await conn.query(
    "SELECT DISTINCT bo.`id` FROM `bank_options` bo " +
    "JOIN `bank_option_team_shares` ts ON ts.`option_id` = bo.`id` " +
    "WHERE bo.`author_sub` = ? AND bo.`visibility` = 'team' AND ts.`team_id` = ? AND bo.`promoted_at` IS NULL",
    [departingSub, teamId]
  );
  const ids = teamShared.map(r => r.id);
  if (includePublic) {
    const pub = await conn.query(
      "SELECT `id` FROM `bank_options` WHERE `author_sub` = ? AND `visibility` = 'public' AND `promoted_at` IS NULL",
      [departingSub]
    );
    for (const r of pub) ids.push(r.id);
  }
  if (!ids.length) return { reassigned: 0, ids: [] };
  const ph = ids.map(() => "?").join(",");
  await conn.query("UPDATE `bank_options` SET `author_sub` = ? WHERE `id` IN (" + ph + ")", [newOwnerSub, ...ids]);
  return { reassigned: ids.length, ids };
}

export async function dbGetPendingTransferForTeam(teamId) {
  if (!teamId) return null;
  const rows = await pool.query(
    "SELECT `id`, `team_id`, `from_sub`, `to_sub`, `proposed_at`, `auto_complete_at` " +
    "FROM `team_ownership_transfers` WHERE `team_id` = ? AND `state` = 'pending' " +
    "ORDER BY `proposed_at` DESC LIMIT 1",
    [teamId]
  );
  return rows[0] || null;
}

// Pending transfers proposed TO this coach — drives the accept/decline banner.
export async function dbListIncomingTransfersForCoach(coachSub) {
  if (!coachSub) return [];
  return await pool.query(
    "SELECT tot.`id`, tot.`team_id`, t.`name` AS team_name, tot.`from_sub`, " +
    "       tot.`proposed_at`, tot.`auto_complete_at` " +
    "FROM `team_ownership_transfers` tot JOIN `teams` t ON t.`id` = tot.`team_id` " +
    "WHERE tot.`to_sub` = ? AND tot.`state` = 'pending' ORDER BY tot.`proposed_at` DESC",
    [coachSub]
  );
}

export async function dbProposeOwnershipTransfer({ teamId, fromSub, toSub }) {
  if (!teamId || !fromSub || !toSub) return { ok: false, reason: "missing_args" };
  if (fromSub === toSub) return { ok: false, reason: "cannot_transfer_to_self" };
  if ((await dbGetTeamRole(teamId, fromSub)) !== "owner") return { ok: false, reason: "not_owner" };
  if ((await dbGetTeamRole(teamId, toSub)) !== "admin") return { ok: false, reason: "target_not_admin" };
  const existing = await pool.query(
    "SELECT `id` FROM `team_ownership_transfers` WHERE `team_id` = ? AND `state` = 'pending' LIMIT 1", [teamId]
  );
  if (existing.length) return { ok: false, reason: "already_pending" };
  const r = await pool.query(
    "INSERT INTO `team_ownership_transfers` (`team_id`, `from_sub`, `to_sub`, `auto_complete_at`) " +
    "VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))",
    [teamId, fromSub, toSub]
  );
  return { ok: true, id: Number(r.insertId), to_sub: toSub };
}

export async function dbCancelOwnershipTransfer({ teamId, byCoachSub, reason = null }) {
  const t = await dbGetPendingTransferForTeam(teamId);
  if (!t) return { ok: false, reason: "no_pending" };
  if (t.from_sub !== byCoachSub) return { ok: false, reason: "not_proposer" };
  await pool.query(
    "UPDATE `team_ownership_transfers` SET `state` = 'cancelled', `resolved_at` = NOW(), `cancel_reason` = ? WHERE `id` = ?",
    [reason ? String(reason).slice(0, 255) : null, t.id]
  );
  return { ok: true, transfer: t };
}

export async function dbDeclineOwnershipTransfer({ teamId, byCoachSub, reason = null }) {
  const t = await dbGetPendingTransferForTeam(teamId);
  if (!t) return { ok: false, reason: "no_pending" };
  if (t.to_sub !== byCoachSub) return { ok: false, reason: "not_proposed_owner" };
  await pool.query(
    "UPDATE `team_ownership_transfers` SET `state` = 'declined', `resolved_at` = NOW(), `cancel_reason` = ? WHERE `id` = ?",
    [reason ? String(reason).slice(0, 255) : null, t.id]
  );
  return { ok: true, transfer: t };
}

export async function dbAcceptOwnershipTransfer({ teamId, byCoachSub }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const rows = await conn.query(
      "SELECT * FROM `team_ownership_transfers` WHERE `team_id` = ? AND `state` = 'pending' ORDER BY `proposed_at` DESC LIMIT 1 FOR UPDATE",
      [teamId]
    );
    const t = rows[0];
    if (!t) { await conn.rollback(); return { ok: false, reason: "no_pending" }; }
    if (t.to_sub !== byCoachSub) { await conn.rollback(); return { ok: false, reason: "not_proposed_owner" }; }
    await _applyOwnershipSwap(conn, teamId, t.from_sub, t.to_sub);
    const ugc = await dbReassignDepartingCoachUgc({ teamId, departingSub: t.from_sub, newOwnerSub: t.to_sub, includePublic: true }, conn);
    await conn.query("UPDATE `team_ownership_transfers` SET `state` = 'accepted', `resolved_at` = NOW() WHERE `id` = ?", [t.id]);
    await conn.commit();
    return { ok: true, transfer: t, ugc_reassigned: ugc.reassigned };
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    return { ok: false, reason: err.message || String(err) };
  } finally { conn.release(); }
}

// Cron sweep (piggybacks the email worker tick). Completes transfers past their
// 30-day cooldown. Open-fork #1: if the proposed owner is gone (account disabled
// or no longer an active team member), cancel instead of completing. Returns
// per-row events so the caller (lib/email.js) can send emails + audit — keeps
// db.js free of email/audit-routing deps.
export async function dbAutoCompleteTransfers() {
  const due = await pool.query(
    "SELECT * FROM `team_ownership_transfers` WHERE `state` = 'pending' AND `auto_complete_at` <= NOW()"
  );
  const events = [];
  for (const row of due) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const locked = await conn.query("SELECT * FROM `team_ownership_transfers` WHERE `id` = ? AND `state` = 'pending' FOR UPDATE", [row.id]);
      const t = locked[0];
      if (!t) { await conn.rollback(); continue; }
      const stillActive = (await dbIsUser(t.to_sub)) && ((await dbGetTeamRole(t.team_id, t.to_sub)) !== null);
      if (!stillActive) {
        await conn.query(
          "UPDATE `team_ownership_transfers` SET `state` = 'cancelled', `resolved_at` = NOW(), `cancel_reason` = 'proposed owner no longer available' WHERE `id` = ?",
          [t.id]
        );
        await conn.commit();
        events.push({ type: "cancelled", transfer: t });
        continue;
      }
      await _applyOwnershipSwap(conn, t.team_id, t.from_sub, t.to_sub);
      const ugc = await dbReassignDepartingCoachUgc({ teamId: t.team_id, departingSub: t.from_sub, newOwnerSub: t.to_sub, includePublic: true }, conn);
      await conn.query("UPDATE `team_ownership_transfers` SET `state` = 'completed', `resolved_at` = NOW() WHERE `id` = ?", [t.id]);
      await conn.commit();
      events.push({ type: "completed", transfer: t, ugc_reassigned: ugc.reassigned });
    } catch (err) {
      try { await conn.rollback(); } catch (_) {}
    } finally { conn.release(); }
  }
  return { processed: due.length, events };
}

// ─── Team curation (Phase 4 / TEAM_CURATION_SCOPE.md) ─────────────────
// Third tier of the curation cascade: TEAM. Owners + admins write team-
// level favorites + disfavorites + defaults; all swimmers in any group
// under that team inherit via the cascade extension in dbGetEffective*.
//
// Authz pattern: helpers themselves return ok/reason; the route layer
// must check dbGetTeamRole(teamId, callerSub) ∈ ('owner','admin') for
// writes. dbAssertTeamWriter wraps that check for re-use.

const TEAM_DEFAULT_FIELDS = ["pace_base", "disfavor_mode", "equipment_modes"];
const TEAM_DISFAVOR_MODES = ["downweight", "exclude"];

// Authz helper used by all team-curation write routes. Returns the role
// string if the caller can write, or null. Mirrors dbGetTeamRole shape.
export async function dbAssertTeamWriter(teamId, callerSub) {
  const role = await dbGetTeamRole(teamId, callerSub);
  if (role === "owner" || role === "admin") return role;
  return null;
}

// Add/remove favorites. Mutex with team_disfavorites enforced at app
// layer (same label can't be in both at once for the same team).
export async function dbAddTeamFavorite({ teamId, label, byCoachSub }) {
  if (!teamId || !label || !byCoachSub) return { ok: false, reason: "missing_args" };
  const cleaned = String(label).trim();
  if (!cleaned) return { ok: false, reason: "empty_label" };
  if (cleaned.length > 255) return { ok: false, reason: "label_too_long" };
  // Mutex check: if the same label exists in team_disfavorites, the caller
  // must remove it from there first. Mirror of v1.5's per-user behavior.
  const conflict = await pool.query(
    "SELECT 1 FROM `team_disfavorites` WHERE `team_id` = ? AND `label` = ? LIMIT 1",
    [teamId, cleaned]
  );
  if (conflict.length > 0) return { ok: false, reason: "in_disfavorites" };
  try {
    await pool.query(
      "INSERT INTO `team_favorites` (`team_id`, `label`, `set_by_coach_sub`) VALUES (?, ?, ?)",
      [teamId, cleaned, byCoachSub]
    );
    return { ok: true };
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY" || /duplicate/i.test(e.message || "")) {
      return { ok: true, already: true };                                    // idempotent
    }
    throw e;
  }
}

export async function dbRemoveTeamFavorite({ teamId, label }) {
  if (!teamId || !label) return { ok: false, reason: "missing_args" };
  const r = await pool.query(
    "DELETE FROM `team_favorites` WHERE `team_id` = ? AND `label` = ?",
    [teamId, String(label).trim()]
  );
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

export async function dbAddTeamDisfavorite({ teamId, label, byCoachSub }) {
  if (!teamId || !label || !byCoachSub) return { ok: false, reason: "missing_args" };
  const cleaned = String(label).trim();
  if (!cleaned) return { ok: false, reason: "empty_label" };
  if (cleaned.length > 255) return { ok: false, reason: "label_too_long" };
  const conflict = await pool.query(
    "SELECT 1 FROM `team_favorites` WHERE `team_id` = ? AND `label` = ? LIMIT 1",
    [teamId, cleaned]
  );
  if (conflict.length > 0) return { ok: false, reason: "in_favorites" };
  try {
    await pool.query(
      "INSERT INTO `team_disfavorites` (`team_id`, `label`, `set_by_coach_sub`) VALUES (?, ?, ?)",
      [teamId, cleaned, byCoachSub]
    );
    return { ok: true };
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY" || /duplicate/i.test(e.message || "")) {
      return { ok: true, already: true };
    }
    throw e;
  }
}

export async function dbRemoveTeamDisfavorite({ teamId, label }) {
  if (!teamId || !label) return { ok: false, reason: "missing_args" };
  const r = await pool.query(
    "DELETE FROM `team_disfavorites` WHERE `team_id` = ? AND `label` = ?",
    [teamId, String(label).trim()]
  );
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

// Read both lists in one call. Used by Settings UI + the cascade
// extension reads the same rows via UNION ALL in dbGetEffective*.
export async function dbListTeamCuration(teamId) {
  if (!teamId) return { favorites: [], disfavorites: [] };
  const [favRows, disfavRows] = await Promise.all([
    pool.query(
      "SELECT `label`, `set_by_coach_sub`, `created_at` FROM `team_favorites` " +
      "WHERE `team_id` = ? ORDER BY `created_at` DESC",
      [teamId]
    ),
    pool.query(
      "SELECT `label`, `set_by_coach_sub`, `created_at` FROM `team_disfavorites` " +
      "WHERE `team_id` = ? ORDER BY `created_at` DESC",
      [teamId]
    ),
  ]);
  return {
    favorites:    favRows.map(r => ({ label: r.label, set_by_coach_sub: r.set_by_coach_sub, created_at: dtToIso(r.created_at) })),
    disfavorites: disfavRows.map(r => ({ label: r.label, set_by_coach_sub: r.set_by_coach_sub, created_at: dtToIso(r.created_at) })),
  };
}

// Team default settings. Read returns the three current defaults; write
// updates one field. Set value=null to clear a default.
export async function dbGetTeamSettings(teamId) {
  if (!teamId) return null;
  const rows = await pool.query(
    "SELECT `default_pace_base`, `default_disfavor_mode`, `default_equipment_modes` " +
    "FROM `teams` WHERE `id` = ? LIMIT 1",
    [teamId]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  let equipment = null;
  if (r.default_equipment_modes != null) {
    try { equipment = typeof r.default_equipment_modes === "string" ? JSON.parse(r.default_equipment_modes) : r.default_equipment_modes; }
    catch (_) { equipment = null; }
  }
  return {
    default_pace_base:        r.default_pace_base,
    default_disfavor_mode:    r.default_disfavor_mode,
    default_equipment_modes:  equipment,
  };
}

// ── Team practice facilities (Locations P1, LOCATIONS_SCOPE.md) ─────────
// A team's pool(s). Supersedes the old teams.school field (dropped in P5,
// migration 049). course mirrors pool_mode.
const _FACILITY_COURSES = ["25y", "25m", "50m"];

// Create/update the optional address row for a facility. Returns address_id
// (existing or new) or null when no address fields are provided.
async function _upsertFacilityAddress(addressId, a) {
  const has = a && (a.line1 || a.line2 || a.city || a.region || a.postal_code);
  if (!has) return addressId || null;
  const vals = [a.line1 || null, a.line2 || null, a.city || null, a.region || null, a.postal_code || null, a.country || "US"];
  if (addressId) {
    await pool.query(
      "UPDATE `addresses` SET `line1`=?,`line2`=?,`city`=?,`region`=?,`postal_code`=?,`country`=? WHERE `id`=?",
      [...vals, addressId]
    );
    return addressId;
  }
  const r = await pool.query(
    "INSERT INTO `addresses` (`line1`,`line2`,`city`,`region`,`postal_code`,`country`) VALUES (?,?,?,?,?,?)",
    vals
  );
  return Number(r.insertId);
}

// When a facility becomes the team's primary, clear other primaries.
// (teams.school mirror dropped in P5, migration 049.)
async function _setPrimaryFacility(teamId, facilityId) {
  await pool.query("UPDATE `team_facilities` SET `is_primary` = 0 WHERE `team_id` = ? AND `id` <> ?", [teamId, facilityId]);
  await pool.query("UPDATE `team_facilities` SET `is_primary` = 1 WHERE `id` = ?", [facilityId]);
}

export async function dbListTeamFacilities(teamId) {
  if (!teamId) return [];
  const rows = await pool.query(
    "SELECT f.`id`, f.`team_id`, f.`name`, f.`course`, f.`lanes`, f.`is_primary`, f.`address_id`, " +
    "       a.`line1`, a.`line2`, a.`city`, a.`region`, a.`postal_code`, a.`country` " +
    "  FROM `team_facilities` f LEFT JOIN `addresses` a ON a.`id` = f.`address_id` " +
    " WHERE f.`team_id` = ? AND f.`archived_at` IS NULL " +
    " ORDER BY f.`is_primary` DESC, f.`name` ASC",
    [teamId]
  );
  return rows.map(r => ({
    id: Number(r.id), team_id: r.team_id, name: r.name, course: r.course,
    lanes: r.lanes == null ? null : Number(r.lanes), is_primary: !!r.is_primary,
    address: r.address_id ? { line1: r.line1, line2: r.line2, city: r.city, region: r.region, postal_code: r.postal_code, country: r.country } : null,
  }));
}

export async function dbCreateTeamFacility({ teamId, name, course = null, lanes = null, is_primary = false, address = null }) {
  if (!teamId || !name || typeof name !== "string" || !name.trim()) return { ok: false, reason: "name_required" };
  if (name.length > 120) return { ok: false, reason: "name_too_long" };
  if (course !== null && course !== "" && !_FACILITY_COURSES.includes(course)) return { ok: false, reason: "bad_course" };
  const lanesVal = (lanes == null || lanes === "") ? null : (Number.isInteger(Number(lanes)) && Number(lanes) > 0 && Number(lanes) <= 127 ? Number(lanes) : undefined);
  if (lanesVal === undefined) return { ok: false, reason: "bad_lanes" };
  // First facility for a team is primary by default.
  const existing = await pool.query("SELECT COUNT(*) AS n FROM `team_facilities` WHERE `team_id` = ? AND `archived_at` IS NULL", [teamId]);
  const makePrimary = is_primary || Number(existing[0]?.n || 0) === 0;
  const addressId = await _upsertFacilityAddress(null, address || {});
  const r = await pool.query(
    "INSERT INTO `team_facilities` (`team_id`,`name`,`address_id`,`course`,`lanes`,`is_primary`) VALUES (?,?,?,?,?,?)",
    [teamId, name.trim(), addressId, course || null, lanesVal, makePrimary ? 1 : 0]
  );
  const id = Number(r.insertId);
  if (makePrimary) await _setPrimaryFacility(teamId, id);
  return { ok: true, id };
}

export async function dbUpdateTeamFacility(id, teamId, patch) {
  if (!id || !teamId) return { ok: false, reason: "missing_args" };
  const rows = await pool.query("SELECT `team_id`, `name`, `address_id`, `is_primary` FROM `team_facilities` WHERE `id` = ? AND `team_id` = ? AND `archived_at` IS NULL", [id, teamId]);
  if (!rows[0]) return { ok: false, reason: "not_found" };
  const cur = rows[0];
  const sets = [], vals = [];
  if ("name" in patch) {
    if (!patch.name || typeof patch.name !== "string" || !patch.name.trim() || patch.name.length > 120) return { ok: false, reason: "bad_name" };
    sets.push("`name` = ?"); vals.push(patch.name.trim());
  }
  if ("course" in patch) {
    if (patch.course !== null && patch.course !== "" && !_FACILITY_COURSES.includes(patch.course)) return { ok: false, reason: "bad_course" };
    sets.push("`course` = ?"); vals.push(patch.course || null);
  }
  if ("lanes" in patch) {
    const lv = (patch.lanes == null || patch.lanes === "") ? null : (Number.isInteger(Number(patch.lanes)) && Number(patch.lanes) > 0 && Number(patch.lanes) <= 127 ? Number(patch.lanes) : undefined);
    if (lv === undefined) return { ok: false, reason: "bad_lanes" };
    sets.push("`lanes` = ?"); vals.push(lv);
  }
  if ("address" in patch) {
    const addrId = await _upsertFacilityAddress(cur.address_id, patch.address || {});
    sets.push("`address_id` = ?"); vals.push(addrId);
  }
  if (sets.length) {
    vals.push(id);
    await pool.query(`UPDATE \`team_facilities\` SET ${sets.join(", ")} WHERE \`id\` = ?`, vals);
  }
  // Primary toggle (only setting TRUE is meaningful — one primary per team).
  if (patch.is_primary === true && !cur.is_primary) {
    await _setPrimaryFacility(cur.team_id, id);
  }
  return { ok: true };
}

export async function dbArchiveTeamFacility(id, teamId) {
  if (!id || !teamId) return { ok: false, reason: "missing_args" };
  const rows = await pool.query("SELECT `team_id`, `is_primary` FROM `team_facilities` WHERE `id` = ? AND `team_id` = ? AND `archived_at` IS NULL", [id, teamId]);
  if (!rows[0]) return { ok: false, reason: "not_found" };
  await pool.query("UPDATE `team_facilities` SET `archived_at` = NOW(), `is_primary` = 0 WHERE `id` = ?", [id]);
  // If we archived the primary, promote the next remaining facility (if any).
  if (rows[0].is_primary) {
    const next = await pool.query("SELECT `id` FROM `team_facilities` WHERE `team_id` = ? AND `archived_at` IS NULL ORDER BY `created_at` ASC LIMIT 1", [rows[0].team_id]);
    if (next[0]) await _setPrimaryFacility(rows[0].team_id, Number(next[0].id));
  }
  return { ok: true };
}

export async function dbSetTeamDefault({ teamId, field, value }) {
  if (!teamId || !field) return { ok: false, reason: "missing_args" };
  if (!TEAM_DEFAULT_FIELDS.includes(field)) return { ok: false, reason: "bad_field" };
  // Per-field validation. null clears the default.
  let stored = value;
  if (value !== null) {
    if (field === "pace_base") {
      if (typeof value !== "string" || !/^\d{1,2}:\d{2}$/.test(value)) return { ok: false, reason: "bad_pace_format" };
      if (value.length > 8) return { ok: false, reason: "pace_too_long" };
    } else if (field === "disfavor_mode") {
      if (!TEAM_DISFAVOR_MODES.includes(value)) return { ok: false, reason: "bad_disfavor_mode" };
    } else if (field === "equipment_modes") {
      // Accept any object/array; serialize to JSON. Client owns the shape.
      if (typeof value !== "object") return { ok: false, reason: "bad_equipment_shape" };
      try { stored = JSON.stringify(value); } catch (_) { return { ok: false, reason: "equipment_not_serializable" }; }
    }
  }
  const col = `default_${field}`;
  const r = await pool.query(
    `UPDATE \`teams\` SET \`${col}\` = ? WHERE \`id\` = ?`,
    [stored, teamId]
  );
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

// "Apply to current roster" — bulk-update settings.extra (or the
// corresponding column) for every swimmer in any group under this team.
// One-time push; not auto-applied on future default changes. Audit the
// count so the operator knows the blast radius.
//
// MVP: only pace_base is wired (most common pull). disfavor_mode +
// equipment_modes can extend the switch later when the UI surfaces them.
// For unsupported fields, returns 501-style ok:false reason.
export async function dbApplyTeamDefaultToRoster({ teamId, field }) {
  if (!teamId || !field) return { ok: false, reason: "missing_args" };
  if (field !== "pace_base") return { ok: false, reason: "field_not_apply_capable_yet" };
  const settings = await dbGetTeamSettings(teamId);
  if (!settings || settings.default_pace_base == null) return { ok: false, reason: "default_not_set" };
  const pace = settings.default_pace_base;
  // Collect all swimmer subs from any group under this team (active members).
  const swimmerRows = await pool.query(
    "SELECT DISTINCT gm.`member_swimmer_sub` AS sub " +
    "FROM `group_members` gm JOIN `groups` g ON g.`id` = gm.`group_id` " +
    "WHERE g.`team_id` = ? AND gm.`left_at` IS NULL AND gm.`member_swimmer_sub` IS NOT NULL",
    [teamId]
  );
  let updated = 0;
  for (const r of swimmerRows) {
    // Use existing user_settings update path. pace_base lives in
    // user_settings (pace column); update directly via UPSERT.
    const upd = await pool.query(
      "INSERT INTO `user_settings` (`user_sub`, `pace`) VALUES (?, ?) " +
      "ON DUPLICATE KEY UPDATE `pace` = VALUES(`pace`)",
      [r.sub, pace]
    );
    if (upd.affectedRows > 0) updated++;
  }
  return { ok: true, field, value: pace, count: updated };
}

// Team roster v1 (2026-05-27): grouped roster across every active group
// under a team. Per Cap'n's "all swimmers in any group under team X"
// gap. Returns array of group sections each with members[] from
// dbListGroupMembers (polymorphic swimmer + managed, dual person JOIN).
// Archived groups omitted from v1. Empty groups included so coaches see
// "Sprint Group (0)" rather than the group disappearing.
export async function dbGetTeamRoster(teamId) {
  if (!teamId) return [];
  const groups = await dbListGroupsForTeam(teamId, { includeArchived: false });
  const sections = [];
  for (const g of groups) {
    const members = await dbListGroupMembers(g.id);
    sections.push({
      group_id:     g.id,
      group_name:   g.name,
      pool_mode:    g.pool_mode_default,
      member_count: members.length,
      members,
    });
  }
  return sections;
}

// Phase 4 Team Curation slice 5 (2026-05-27): list ALL team defaults
// for any team the user is in. Used by /api/me/team-defaults for the
// ProfileModal inheritance disclosure. Per spec §6 fork 3: a coach in
// multiple teams gets defaults from BOTH teams; v1 surfaces them with
// team_name attribution so the user can see which team contributed
// what. Filter to teams where AT LEAST ONE default is set (no point
// showing teams that have no curation policy).
export async function dbListTeamDefaultsForUser(userSub) {
  if (!userSub) return [];
  const rows = await pool.query(
    "SELECT DISTINCT t.`id`, t.`name`, " +
    "       t.`default_pace_base`, t.`default_disfavor_mode`, t.`default_equipment_modes` " +
    "  FROM `group_members` gm " +
    "  JOIN `groups` g ON g.`id` = gm.`group_id` AND g.`archived` = 0 " +
    "  JOIN `teams`  t ON t.`id` = g.`team_id` " +
    " WHERE gm.`member_swimmer_sub` = ? " +
    "   AND gm.`left_at` IS NULL " +
    " ORDER BY t.`name` ASC",
    [userSub]
  );
  return rows
    .filter(r => r.default_pace_base != null || r.default_disfavor_mode != null || r.default_equipment_modes != null)
    .map(r => {
      let equipment = null;
      if (r.default_equipment_modes != null) {
        try { equipment = typeof r.default_equipment_modes === "string" ? JSON.parse(r.default_equipment_modes) : r.default_equipment_modes; }
        catch (_) { equipment = null; }
      }
      return {
        team_id:                  r.id,
        team_name:                r.name,
        default_pace_base:        r.default_pace_base,
        default_disfavor_mode:    r.default_disfavor_mode,
        default_equipment_modes:  equipment,
      };
    });
}

// Used by dbEnsureUser to seed a new user's settings row from the team
// defaults of whatever team they're in (if any). Returns the team's
// default values or null if no team / no defaults set.
export async function dbGetSeedingDefaultsForNewUser(userSub) {
  if (!userSub) return null;
  const rows = await pool.query(
    "SELECT t.`default_pace_base`, t.`default_disfavor_mode`, t.`default_equipment_modes` " +
    "  FROM `group_members` gm " +
    "  JOIN `groups` g ON g.`id` = gm.`group_id` " +
    "  JOIN `teams`  t ON t.`id` = g.`team_id` " +
    " WHERE gm.`member_swimmer_sub` = ? AND gm.`left_at` IS NULL " +
    " LIMIT 1",
    [userSub]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  if (r.default_pace_base == null && r.default_disfavor_mode == null && r.default_equipment_modes == null) return null;
  return {
    pace_base:        r.default_pace_base,
    disfavor_mode:    r.default_disfavor_mode,
    equipment_modes:  r.default_equipment_modes,
  };
}

// ─── Parent Portal MVP (Phase 4 / PARENT_PORTAL_MVP_SCOPE.md) ──────
// Coach invites parent via email → parent OAuth sign-in matches email →
// guardians row created → ParentDashboard renders. Migration 042 adds
// the parent_invites table; guardians + parent_contact_methods tables
// come from migration 039 (Identity I-A) and were sitting empty until
// now.
//
// All linking goes via persons.id (16-char px_xxxxxx). The
// helpers below resolve managed/real swimmers + parent users to their
// person_id consistently, since guardians.* columns are typed to
// persons.id.

const PARENT_INVITE_TTL_DAYS = 30;

// Resolve a swimmer reference (managed_id OR swimmer_sub) to their
// person_id. Returns null if not found. Used in invite + consume paths.
async function _swimmerPersonId({ managedId = null, swimmerSub = null }) {
  if (!managedId && !swimmerSub) return null;
  if (managedId) {
    const rows = await pool.query("SELECT `person_id` FROM `coach_managed_swimmers` WHERE `id` = ? LIMIT 1", [managedId]);
    return rows[0]?.person_id || null;
  }
  const rows = await pool.query("SELECT `person_id` FROM `users` WHERE `sub` = ? LIMIT 1", [swimmerSub]);
  return rows[0]?.person_id || null;
}

// Coach issues a parent invite for a specific swimmer. Authz: caller
// must already be coach-of-swimmer (server route verifies via
// dbAuthzCoachOfSwimmer). Idempotent on (parent_email, swimmer) — if a
// pending invite already exists, returns it rather than creating a dup.
// Email is lowercased for case-insensitive matching against OAuth
// verified email later.
export async function dbCreateParentInvite({ swimmerSub = null, managedId = null, parentEmail, byCoachSub }) {
  if ((swimmerSub == null) === (managedId == null)) return { ok: false, reason: "specify_exactly_one_target" };
  if (!parentEmail || !byCoachSub) return { ok: false, reason: "missing_args" };
  const email = String(parentEmail).trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, reason: "bad_email" };
  // Idempotent: existing pending invite for the same (email, swimmer) wins.
  const existing = await pool.query(
    "SELECT `id`, `state`, `expires_at` FROM `parent_invites` " +
    "WHERE `parent_email` = ? AND `state` = 'pending' " +
    "  AND " + (managedId ? "`swimmer_managed_id` = ?" : "`swimmer_sub` = ?") + " LIMIT 1",
    [email, managedId || swimmerSub]
  );
  if (existing[0]) {
    return { ok: true, id: Number(existing[0].id), already: true };
  }
  const expiresAt = new Date(Date.now() + PARENT_INVITE_TTL_DAYS * 86400 * 1000)
    .toISOString().slice(0, 19).replace("T", " ");
  const r = await pool.query(
    "INSERT INTO `parent_invites` (`swimmer_managed_id`, `swimmer_sub`, `parent_email`, `invited_by_coach_sub`, `expires_at`) " +
    "VALUES (?, ?, ?, ?, ?)",
    [managedId, swimmerSub, email, byCoachSub, expiresAt]
  );
  return { ok: true, id: Number(r.insertId), expires_at: expiresAt };
}

// Coach (or invite creator) revokes a pending invite before parent
// accepts it. State='revoked' rather than DELETE so audit + analytics
// preserve the attempt.
export async function dbRevokeParentInvite(inviteId, callerSub) {
  if (!inviteId || !callerSub) return { ok: false, reason: "missing_args" };
  // Ownership scope (Phase 5 hardening): the caller must coach the invite's
  // swimmer. Without this, any authed coach/lesson user could revoke ANY invite
  // by id (IDOR). Tightened when lesson tier widened who can reach this route.
  const inv = (await pool.query(
    "SELECT `swimmer_sub`, `swimmer_managed_id` FROM `parent_invites` WHERE `id` = ? LIMIT 1",
    [Number(inviteId)]
  ))[0];
  if (!inv) return { ok: false, reason: "not_found" };
  const authz = await dbAuthzCoachOfSwimmer(callerSub, {
    swimmerSub: inv.swimmer_sub || null,
    managedId:  inv.swimmer_managed_id || null,
  });
  if (!authz) return { ok: false, reason: "forbidden" };
  const r = await pool.query(
    "UPDATE `parent_invites` SET `state` = 'revoked' WHERE `id` = ? AND `state` = 'pending'",
    [Number(inviteId)]
  );
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

// Called from OAuth callbacks AFTER dbEnsureUser (so the parent's
// users + persons rows exist). Matches the user's verified email
// against pending invites + creates guardians rows for each match.
// Most users have no pending invites — fast no-op for them.
//
// Returns { accepted: N, errors: [...] } for the route to optionally
// surface "N invites accepted" UX (though spec v1 just silently goes
// to ParentDashboard on next page load).
export async function dbConsumePendingInvitesForUser(userSub, verifiedEmail) {
  if (!userSub || !verifiedEmail) return { accepted: 0, errors: [] };
  const email = String(verifiedEmail).trim().toLowerCase();
  const guardianPersonId = await _swimmerPersonId({ swimmerSub: userSub });   // parent's person_id = their users.person_id
  if (!guardianPersonId) return { accepted: 0, errors: ["parent_has_no_person"] };
  const pending = await pool.query(
    "SELECT `id`, `swimmer_managed_id`, `swimmer_sub`, `invited_by_coach_sub` " +
    "FROM `parent_invites` " +
    "WHERE `parent_email` = ? AND `state` = 'pending' AND `expires_at` > NOW()",
    [email]
  );
  if (pending.length === 0) return { accepted: 0, errors: [] };
  let accepted = 0;
  const errors = [];
  for (const inv of pending) {
    const swimmerPid = await _swimmerPersonId({ managedId: inv.swimmer_managed_id, swimmerSub: inv.swimmer_sub });
    if (!swimmerPid) { errors.push({ invite_id: Number(inv.id), reason: "swimmer_not_found" }); continue; }
    try {
      await pool.query(
        "INSERT INTO `guardians` (`swimmer_person_id`, `guardian_person_id`, `relationship`, `added_by_sub`) " +
        "VALUES (?, ?, 'guardian', ?)",
        [swimmerPid, guardianPersonId, inv.invited_by_coach_sub]
      );
    } catch (e) {
      // Duplicate guardians row → already linked, treat as success.
      if (e.code !== "ER_DUP_ENTRY" && !/duplicate/i.test(e.message || "")) {
        errors.push({ invite_id: Number(inv.id), reason: e.message || String(e) });
        continue;
      }
    }
    await pool.query(
      "UPDATE `parent_invites` SET `state` = 'accepted', `accepted_at` = CURRENT_TIMESTAMP WHERE `id` = ?",
      [inv.id]
    );
    accepted++;
  }
  return { accepted, errors };
}

// Light name lookup for a person behind a user sub (persons-derived).
async function _nameForUserSub(sub) {
  if (!sub) return null;
  const rows = await pool.query(
    "SELECT p.`first_name`, p.`last_name`, p.`preferred_name` FROM `users` u " +
    "LEFT JOIN `persons` p ON p.`id` = u.`person_id` WHERE u.`sub` = ? LIMIT 1",
    [sub]
  );
  return rows[0] ? displayNameInline(rows[0]) : null;
}
async function _nameForManagedId(id) {
  if (!id) return null;
  const rows = await pool.query(
    "SELECT p.`first_name`, p.`last_name`, p.`preferred_name` FROM `coach_managed_swimmers` m " +
    "LEFT JOIN `persons` p ON p.`id` = m.`person_id` WHERE m.`id` = ? LIMIT 1",
    [id]
  );
  return rows[0] ? displayNameInline(rows[0]) : null;
}

// Explicit parent-invite consent (replaces silent auto-consume). The
// parent sees pending invites and Accepts/Declines each. Match is on the
// invite's parent_email == the user's VERIFIED email (the security gate —
// only the invited address can act on an invite).
export async function dbListPendingInvitesForUser(userSub, verifiedEmail) {
  if (!userSub || !verifiedEmail) return [];
  const email = String(verifiedEmail).trim().toLowerCase();
  const rows = await pool.query(
    "SELECT `id`, `swimmer_managed_id`, `swimmer_sub`, `invited_by_coach_sub`, `created_at`, `expires_at` " +
    "FROM `parent_invites` WHERE `parent_email` = ? AND `state` = 'pending' AND `expires_at` > NOW() " +
    "ORDER BY `created_at` DESC",
    [email]
  );
  const out = [];
  for (const inv of rows) {
    const swimmerName = inv.swimmer_managed_id
      ? await _nameForManagedId(inv.swimmer_managed_id)
      : await _nameForUserSub(inv.swimmer_sub);
    const coachName = await _nameForUserSub(inv.invited_by_coach_sub);
    out.push({
      id:           Number(inv.id),
      swimmer_name: swimmerName || "your swimmer",
      coach_name:   coachName || "a coach",
      created_at:   dtToIso(inv.created_at),
      expires_at:   dtToIso(inv.expires_at),
    });
  }
  return out;
}

async function _loadInviteForActor(inviteId, verifiedEmail) {
  const email = String(verifiedEmail || "").trim().toLowerCase();
  const rows = await pool.query(
    "SELECT `id`, `swimmer_managed_id`, `swimmer_sub`, `parent_email`, `invited_by_coach_sub`, `state`, `expires_at` " +
    "FROM `parent_invites` WHERE `id` = ?",
    [Number(inviteId)]
  );
  const inv = rows[0];
  if (!inv) return { error: "not_found" };
  if (String(inv.parent_email).toLowerCase() !== email) return { error: "not_your_invite" };
  return { inv };
}

export async function dbAcceptParentInvite(inviteId, userSub, verifiedEmail) {
  if (!inviteId || !userSub || !verifiedEmail) return { ok: false, reason: "missing_args" };
  const { inv, error } = await _loadInviteForActor(inviteId, verifiedEmail);
  if (error) return { ok: false, reason: error };
  if (inv.state !== "pending") return { ok: false, reason: "not_pending" };
  if (inv.expires_at && new Date(inv.expires_at) < new Date()) return { ok: false, reason: "expired" };
  const guardianPersonId = await _swimmerPersonId({ swimmerSub: userSub });
  if (!guardianPersonId) return { ok: false, reason: "parent_has_no_person" };
  const swimmerPid = await _swimmerPersonId({ managedId: inv.swimmer_managed_id, swimmerSub: inv.swimmer_sub });
  if (!swimmerPid) return { ok: false, reason: "swimmer_not_found" };
  try {
    await pool.query(
      "INSERT INTO `guardians` (`swimmer_person_id`, `guardian_person_id`, `relationship`, `added_by_sub`) VALUES (?, ?, 'guardian', ?)",
      [swimmerPid, guardianPersonId, inv.invited_by_coach_sub]
    );
  } catch (e) {
    if (e.code !== "ER_DUP_ENTRY" && !/duplicate/i.test(e.message || "")) return { ok: false, reason: e.message || String(e) };
  }
  await pool.query("UPDATE `parent_invites` SET `state` = 'accepted', `accepted_at` = CURRENT_TIMESTAMP WHERE `id` = ?", [inv.id]);
  return { ok: true };
}

export async function dbDeclineParentInvite(inviteId, userSub, verifiedEmail) {
  if (!inviteId || !userSub || !verifiedEmail) return { ok: false, reason: "missing_args" };
  const { inv, error } = await _loadInviteForActor(inviteId, verifiedEmail);
  if (error) return { ok: false, reason: error };
  if (inv.state !== "pending") return { ok: false, reason: "not_pending" };
  // 'revoked' state reused for parent-declined (enum has no 'declined').
  await pool.query("UPDATE `parent_invites` SET `state` = 'revoked' WHERE `id` = ? AND `state` = 'pending'", [inv.id]);
  return { ok: true };
}

// List active guardians (parents) for a swimmer. Used by coach view to
// show "Parents/Guardians" list. Joins guardians → persons → users to
// project display_name + email. Both LEFT JOINs are defensive.
export async function dbListGuardiansForSwimmer({ managedId = null, swimmerSub = null }) {
  if ((managedId == null) === (swimmerSub == null)) return [];
  const swimmerPid = await _swimmerPersonId({ managedId, swimmerSub });
  if (!swimmerPid) return [];
  const rows = await pool.query(
    "SELECT g.`id`, g.`relationship`, g.`added_at`, g.`added_by_sub`, " +
    "       p.`first_name`, p.`last_name`, p.`preferred_name`, " +
    "       u.`sub` AS user_sub, u.`email` " +
    "  FROM `guardians` g " +
    "  JOIN `persons` p ON p.`id` = g.`guardian_person_id` " +
    "  LEFT JOIN `users` u ON u.`person_id` = p.`id` " +
    " WHERE g.`swimmer_person_id` = ? AND g.`removed_at` IS NULL " +
    " ORDER BY g.`added_at` ASC",
    [swimmerPid]
  );
  return rows.map(r => ({
    id:           Number(r.id),
    user_sub:     r.user_sub,
    display_name: displayNameInline({ first_name: r.first_name, last_name: r.last_name, preferred_name: r.preferred_name }),
    email:        r.email,
    relationship: r.relationship,
    added_at:     dtToIso(r.added_at),
    added_by_sub: r.added_by_sub,
  }));
}

// Coach lists pending invites for a swimmer (UI shows them alongside
// accepted guardians so coach knows "invite sent, awaiting response").
export async function dbListParentInvitesForSwimmer({ managedId = null, swimmerSub = null }) {
  if ((managedId == null) === (swimmerSub == null)) return [];
  const where = managedId ? "`swimmer_managed_id` = ?" : "`swimmer_sub` = ?";
  // Only PENDING, non-expired invites — this feeds the coach's "Pending
  // invites" section. Accepted invites surface as guardians; revoked/expired
  // shouldn't linger (otherwise a revoked row reappears and revoke looks
  // broken). State filter lives here, the section's single consumer.
  const rows = await pool.query(
    "SELECT `id`, `parent_email`, `invited_by_coach_sub`, `state`, " +
    "       `created_at`, `expires_at`, `accepted_at` " +
    "  FROM `parent_invites` WHERE " + where + " AND `state` = 'pending' AND `expires_at` > NOW() " +
    "ORDER BY `created_at` DESC",
    [managedId || swimmerSub]
  );
  return rows.map(r => ({
    id:                   Number(r.id),
    parent_email:         r.parent_email,
    invited_by_coach_sub: r.invited_by_coach_sub,
    state:                r.state,
    created_at:           dtToIso(r.created_at),
    expires_at:           dtToIso(r.expires_at),
    accepted_at:          dtToIso(r.accepted_at),
  }));
}

// Coach removes a parent (tombstones the guardians row). Parent's
// ParentDashboard no longer shows this swimmer next load. Audit-logged
// at the route layer.
export async function dbRemoveGuardian(guardianId, callerSub) {
  if (!guardianId || !callerSub) return { ok: false, reason: "missing_args" };
  // Ownership scope (Phase 5 hardening): the caller must coach the swimmer this
  // guardian belongs to. Previously unscoped ("v1.1 hardening" TODO) — closed now
  // that lesson tier widened route access (was an IDOR on a FERPA-sensitive link).
  const g = (await pool.query(
    "SELECT `swimmer_person_id` FROM `guardians` WHERE `id` = ? AND `removed_at` IS NULL LIMIT 1",
    [Number(guardianId)]
  ))[0];
  if (!g) return { ok: false, reason: "not_found" };
  // Resolve the swimmer person → managed-swimmer or full-account ref for authz.
  const ms = (await pool.query("SELECT `id` FROM `coach_managed_swimmers` WHERE `person_id` = ? LIMIT 1", [g.swimmer_person_id]))[0];
  const usr = ms ? null : (await pool.query("SELECT `sub` FROM `users` WHERE `person_id` = ? LIMIT 1", [g.swimmer_person_id]))[0];
  const authz = await dbAuthzCoachOfSwimmer(callerSub, {
    managedId:  ms ? ms.id : null,
    swimmerSub: usr ? usr.sub : null,
  });
  if (!authz) return { ok: false, reason: "forbidden" };
  const r = await pool.query(
    "UPDATE `guardians` SET `removed_at` = CURRENT_TIMESTAMP WHERE `id` = ? AND `removed_at` IS NULL",
    [Number(guardianId)]
  );
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

// ── Person (home) addresses + consent (Locations P2, LOCATIONS_SCOPE.md) ─
// SENSITIVE (minor PII). Access enforced via dbCanAccessPersonAddress.
function _addrCols(a) {
  return [a.line1 || null, a.line2 || null, a.city || null, a.region || null, a.postal_code || null, a.country || "US"];
}
async function _writeAddress(addressId, a) {
  if (addressId) {
    await pool.query("UPDATE `addresses` SET `line1`=?,`line2`=?,`city`=?,`region`=?,`postal_code`=?,`country`=? WHERE `id`=?", [..._addrCols(a), addressId]);
    return addressId;
  }
  const r = await pool.query("INSERT INTO `addresses` (`line1`,`line2`,`city`,`region`,`postal_code`,`country`) VALUES (?,?,?,?,?,?)", _addrCols(a));
  return Number(r.insertId);
}

// Read/write authority for person P's addresses. self + guardians → r+w;
// coach-of-swimmer → r+w ONLY when home_addr_coach_visible (the recorded
// consent) is on. Default-deny. Returns { read, write, personId }.
export async function dbCanAccessPersonAddress(callerSub, { swimmerSub = null, managedId = null } = {}) {
  const deny = { read: false, write: false, personId: null };
  if (!callerSub) return deny;
  const personId = await _swimmerPersonId({ swimmerSub, managedId });
  if (!personId) return deny;
  const callerPid = await _swimmerPersonId({ swimmerSub: callerSub });
  if (callerPid && callerPid === personId) return { read: true, write: true, personId };       // self
  if (callerPid) {
    const g = await pool.query("SELECT 1 FROM `guardians` WHERE `swimmer_person_id` = ? AND `guardian_person_id` = ? AND `removed_at` IS NULL LIMIT 1", [personId, callerPid]);
    if (g.length) return { read: true, write: true, personId };                                 // guardian
  }
  const isCoach = await dbAuthzCoachOfSwimmer(callerSub, { swimmerSub, managedId });
  if (isCoach) {
    // MANAGED swimmer (coach-owned record, no real account/guardian yet):
    // the coach manages its address like dob/gender — no consent toggle.
    // REAL/claimed swimmer (swimmerSub): a person with a guardian/self who
    // controls consent → coach access requires the toggle.
    if (managedId) return { read: true, write: true, personId };
    const t = await pool.query("SELECT `home_addr_coach_visible` FROM `persons` WHERE `id` = ? LIMIT 1", [personId]);
    if (t[0] && (t[0].home_addr_coach_visible === 1 || t[0].home_addr_coach_visible === true)) {
      return { read: true, write: true, personId };                                             // coach + consent (real swimmer)
    }
  }
  return { ...deny, personId };
}

// Who may flip the consent toggle: self or guardian only (a coach can't
// self-authorize). Returns { ok:boolean, personId }.
export async function dbIsGuardianOrSelf(callerSub, { swimmerSub = null, managedId = null } = {}) {
  if (!callerSub) return { ok: false, personId: null };
  const personId = await _swimmerPersonId({ swimmerSub, managedId });
  if (!personId) return { ok: false, personId: null };
  const callerPid = await _swimmerPersonId({ swimmerSub: callerSub });
  if (callerPid && callerPid === personId) return { ok: true, personId };
  if (callerPid) {
    const g = await pool.query("SELECT 1 FROM `guardians` WHERE `swimmer_person_id` = ? AND `guardian_person_id` = ? AND `removed_at` IS NULL LIMIT 1", [personId, callerPid]);
    if (g.length) return { ok: true, personId };
  }
  return { ok: false, personId };
}

export async function dbListPersonAddresses(personId) {
  if (!personId) return [];
  const rows = await pool.query(
    "SELECT pa.`id`, pa.`kind`, pa.`is_primary`, a.`line1`, a.`line2`, a.`city`, a.`region`, a.`postal_code`, a.`country` " +
    "  FROM `person_addresses` pa JOIN `addresses` a ON a.`id` = pa.`address_id` " +
    " WHERE pa.`person_id` = ? AND pa.`removed_at` IS NULL " +
    " ORDER BY pa.`is_primary` DESC, pa.`added_at` ASC",
    [personId]
  );
  return rows.map(r => ({ id: Number(r.id), kind: r.kind, is_primary: !!r.is_primary, line1: r.line1, line2: r.line2, city: r.city, region: r.region, postal_code: r.postal_code, country: r.country }));
}

export async function dbAddPersonAddress(personId, { kind = "home", is_primary = true, address = {} } = {}) {
  if (!personId) return { ok: false, reason: "no_person" };
  if (!["home", "mailing", "other"].includes(kind)) return { ok: false, reason: "bad_kind" };
  const addressId = await _writeAddress(null, address || {});
  const r = await pool.query("INSERT INTO `person_addresses` (`person_id`,`address_id`,`kind`,`is_primary`) VALUES (?,?,?,?)", [personId, addressId, kind, is_primary ? 1 : 0]);
  if (is_primary) await pool.query("UPDATE `person_addresses` SET `is_primary` = 0 WHERE `person_id` = ? AND `id` <> ? AND `removed_at` IS NULL", [personId, Number(r.insertId)]);
  return { ok: true, id: Number(r.insertId) };
}

export async function dbUpdatePersonAddress(linkId, personId, patch = {}) {
  if (!linkId || !personId) return { ok: false, reason: "missing_args" };
  const rows = await pool.query("SELECT `address_id` FROM `person_addresses` WHERE `id` = ? AND `person_id` = ? AND `removed_at` IS NULL", [Number(linkId), personId]);
  if (!rows[0]) return { ok: false, reason: "not_found" };
  if ("address" in patch) await _writeAddress(rows[0].address_id, patch.address || {});
  if ("kind" in patch) {
    if (!["home", "mailing", "other"].includes(patch.kind)) return { ok: false, reason: "bad_kind" };
    await pool.query("UPDATE `person_addresses` SET `kind` = ? WHERE `id` = ?", [patch.kind, Number(linkId)]);
  }
  if (patch.is_primary === true) {
    await pool.query("UPDATE `person_addresses` SET `is_primary` = 1 WHERE `id` = ?", [Number(linkId)]);
    await pool.query("UPDATE `person_addresses` SET `is_primary` = 0 WHERE `person_id` = ? AND `id` <> ? AND `removed_at` IS NULL", [personId, Number(linkId)]);
  }
  return { ok: true };
}

export async function dbRemovePersonAddress(linkId, personId) {
  if (!linkId || !personId) return { ok: false, reason: "missing_args" };
  const r = await pool.query("UPDATE `person_addresses` SET `removed_at` = NOW() WHERE `id` = ? AND `person_id` = ? AND `removed_at` IS NULL", [Number(linkId), personId]);
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

// Household/siblings (Locations P3) — DERIVED, no stored flag. Other persons
// who share BOTH an active home address AND an active guardian with this
// person. (Shared guardian alone is unreliable — kinship/foster/coach-as-
// guardian; the shared address is what makes it a real household.) Caller
// must apply per-sibling address access gating (this returns the raw set).
export async function dbGetHouseholdSiblings(personId) {
  if (!personId) return [];
  const rows = await pool.query(
    "SELECT DISTINCT q.`id` AS person_id, q.`first_name`, q.`last_name`, q.`preferred_name`, " +
    "       u.`sub` AS swimmer_sub, m.`id` AS managed_id " +
    "  FROM `persons` q " +
    "  LEFT JOIN `users` u ON u.`person_id` = q.`id` " +
    "  LEFT JOIN `coach_managed_swimmers` m ON m.`person_id` = q.`id` AND m.`archived` = 0 " +
    " WHERE q.`id` <> ? " +
    "   AND EXISTS (SELECT 1 FROM `person_addresses` pap JOIN `person_addresses` paq ON pap.`address_id` = paq.`address_id` " +
    "               WHERE pap.`person_id` = ? AND paq.`person_id` = q.`id` AND pap.`removed_at` IS NULL AND paq.`removed_at` IS NULL) " +
    "   AND EXISTS (SELECT 1 FROM `guardians` gp JOIN `guardians` gq ON gp.`guardian_person_id` = gq.`guardian_person_id` " +
    "               WHERE gp.`swimmer_person_id` = ? AND gq.`swimmer_person_id` = q.`id` AND gp.`removed_at` IS NULL AND gq.`removed_at` IS NULL)",
    [personId, personId, personId]
  );
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    if (seen.has(r.person_id)) continue;
    seen.add(r.person_id);
    out.push({
      person_id: r.person_id,
      display_name: displayNameInline({ first_name: r.first_name, last_name: r.last_name, preferred_name: r.preferred_name }),
      swimmer_sub: r.swimmer_sub || null,
      managed_id: r.managed_id || null,
    });
  }
  return out;
}

export async function dbGetHomeAddrConsent(personId) {
  if (!personId) return false;
  const rows = await pool.query("SELECT `home_addr_coach_visible` FROM `persons` WHERE `id` = ? LIMIT 1", [personId]);
  return !!(rows[0] && (rows[0].home_addr_coach_visible === 1 || rows[0].home_addr_coach_visible === true));
}

export async function dbSetHomeAddrConsent(personId, visible) {
  if (!personId) return { ok: false, reason: "no_person" };
  await pool.query("UPDATE `persons` SET `home_addr_coach_visible` = ? WHERE `id` = ?", [visible ? 1 : 0, personId]);
  return { ok: true };
}

// Parent dashboard: list the swimmers this parent is linked to. Joins
// guardians → swimmer's person → back to either cms or users (the
// swimmer is one or the other). Returns shape consumable by the
// swimmer-selector + per-swimmer card.
export async function dbListSwimmersForParent(parentSub) {
  if (!parentSub) return [];
  const parentPid = await _swimmerPersonId({ swimmerSub: parentSub });
  if (!parentPid) return [];
  // Pull every active guardian row → swimmer_person_id list.
  const guardianRows = await pool.query(
    "SELECT `swimmer_person_id` FROM `guardians` " +
    "WHERE `guardian_person_id` = ? AND `removed_at` IS NULL",
    [parentPid]
  );
  if (guardianRows.length === 0) return [];
  const swimmerPids = guardianRows.map(r => r.swimmer_person_id);
  const ph = swimmerPids.map(() => "?").join(",");
  // Resolve each swimmer_person_id to either a cms row OR a users row.
  // Project minimal display info; per-swimmer detail comes from
  // dbGetWeeklyDigestPayload.
  const cmsRows = await pool.query(
    "SELECT m.`id` AS managed_id, m.`person_id`, p.`dob`, p.`gender`, " +
    "       p.`first_name`, p.`last_name`, p.`preferred_name`, p.`initials` " +
    "  FROM `coach_managed_swimmers` m " +
    "  JOIN `persons` p ON p.`id` = m.`person_id` " +
    " WHERE m.`person_id` IN (" + ph + ") AND m.`archived` = 0",
    swimmerPids
  );
  const userRows = await pool.query(
    "SELECT u.`sub` AS swimmer_sub, u.`person_id`, p.`dob`, p.`gender`, " +
    "       p.`first_name`, p.`last_name`, p.`preferred_name`, p.`initials` " +
    "  FROM `users` u " +
    "  JOIN `persons` p ON p.`id` = u.`person_id` " +
    " WHERE u.`person_id` IN (" + ph + ") AND u.`is_disabled` = 0",
    swimmerPids
  );
  const seen = new Set();
  const out = [];
  for (const r of cmsRows) {
    if (seen.has(r.person_id)) continue;
    seen.add(r.person_id);
    out.push({
      kind:         "managed",
      managed_id:   r.managed_id,
      swimmer_sub:  null,
      display_name: displayNameInline({ first_name: r.first_name, last_name: r.last_name, preferred_name: r.preferred_name }),
      initials:     r.initials,
      dob:          dateToYmd(r.dob),
      age:          computeAge(r.dob),
      gender:       r.gender,
    });
  }
  for (const r of userRows) {
    if (seen.has(r.person_id)) continue;
    seen.add(r.person_id);
    out.push({
      kind:         "user",
      managed_id:   null,
      swimmer_sub:  r.swimmer_sub,
      display_name: displayNameInline({ first_name: r.first_name, last_name: r.last_name, preferred_name: r.preferred_name }),
      initials:     r.initials,
      dob:          dateToYmd(r.dob),
      age:          computeAge(r.dob),
      gender:       r.gender,
    });
  }
  // Sort by name for stable selector ordering.
  out.sort((a, b) => (a.display_name || "").localeCompare(b.display_name || ""));
  return out;
}

// Per-swimmer digest payload: assigned/done/yardage + upcoming +
// attendance. weekStart = YYYY-MM-DD (Monday). Used by both the
// in-app /api/parent/digest and the Sunday cron.
export async function dbGetWeeklyDigestPayloadForSwimmer({ managedId = null, swimmerSub = null, weekStart }) {
  if (!weekStart) return null;
  // Compute week boundaries: weekStart 00:00 → weekStart+7d 00:00.
  // Spec uses the week that just ended for "done", week ahead for
  // "upcoming"; the caller supplies weekStart = Monday of the past
  // week. Upcoming window is then weekStart+7d → weekStart+14d.
  const ws = String(weekStart);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ws)) return null;
  const start = new Date(ws + "T00:00:00");
  const endOfWeek = new Date(start);  endOfWeek.setUTCDate(endOfWeek.getUTCDate() + 7);
  const endOfNext = new Date(start);  endOfNext.setUTCDate(endOfNext.getUTCDate() + 14);
  const wsStr   = ws;
  const eowStr  = endOfWeek.toISOString().slice(0, 10);
  const eonStr  = endOfNext.toISOString().slice(0, 10);

  // Assignments done + total + yardage in the week. Target is
  // polymorphic — match on swimmer_sub OR managed_id.
  const tgtCol = managedId ? "target_managed_id" : "target_swimmer_sub";
  const tgtVal = managedId || swimmerSub;
  const wkRows = await pool.query(
    "SELECT wa.`completion_state`, w.`total_yards` " +
    "  FROM `workout_assignments` wa " +
    "  JOIN `workouts` w ON w.`id` = wa.`workout_id` " +
    " WHERE wa.`" + tgtCol + "` = ? AND wa.`assigned_at` >= ? AND wa.`assigned_at` < ?",
    [tgtVal, wsStr + " 00:00:00", eowStr + " 00:00:00"]
  );
  const assigned = wkRows.length;
  const done     = wkRows.filter(r => r.completion_state === "complete").length;
  const yardage  = wkRows.filter(r => r.completion_state === "complete")
                         .reduce((s, r) => s + Number(r.total_yards || 0), 0);

  // Upcoming next week.
  const nextRows = await pool.query(
    "SELECT COUNT(*) AS n FROM `workout_assignments` " +
    "WHERE `" + tgtCol + "` = ? AND `assigned_at` >= ? AND `assigned_at` < ?",
    [tgtVal, eowStr + " 00:00:00", eonStr + " 00:00:00"]
  );
  const upcoming = Number(nextRows[0]?.n || 0);

  // Attendance — scheduled_workouts marked done in the week. Match
  // user_sub for full-account swimmers; managed swimmers don't have
  // scheduled_workouts of their own (those land on the coach's account).
  // Attendance = practice_attendance rows (present / total recorded) for
  // this swimmer in the week. Works for BOTH managed and full-account
  // swimmers — the table keys on swimmer_sub XOR managed_id — joined to
  // scheduled_workouts for the date window. (Previously this read the
  // swimmer's own scheduled_workouts, which managed swimmers don't have
  // and which measured self-scheduling, not attendance.)
  const attTgtCol = managedId ? "pa.`managed_id`" : "pa.`swimmer_sub`";
  const att = await pool.query(
    "SELECT COUNT(*) AS total, " +
    "       SUM(CASE WHEN pa.`present` = 1 THEN 1 ELSE 0 END) AS done " +
    "  FROM `practice_attendance` pa " +
    "  JOIN `scheduled_workouts` sw ON sw.`id` = pa.`scheduled_workout_id` " +
    " WHERE " + attTgtCol + " = ? AND sw.`scheduled_date` >= ? AND sw.`scheduled_date` < ?",
    [tgtVal, wsStr, eowStr]
  );
  const attendance = { done: Number(att[0]?.done || 0), total: Number(att[0]?.total || 0) };
  return { assigned, done, yardage, upcoming, attendance, weekStart: wsStr };
}

// Top-level helper: build the full digest payload for a parent (all
// their swimmers). Returns [{ swimmer, ...payload }] for the email
// renderer + the in-app dashboard fetch.
export async function dbGetWeeklyDigestPayload({ parentSub, weekStart }) {
  const swimmers = await dbListSwimmersForParent(parentSub);
  const blocks = [];
  for (const s of swimmers) {
    const payload = await dbGetWeeklyDigestPayloadForSwimmer({
      managedId:   s.managed_id,
      swimmerSub:  s.swimmer_sub,
      weekStart,
    });
    if (payload) blocks.push({ swimmer: s, ...payload });
  }
  return { parentSub, weekStart, swimmers: blocks };
}

// Sunday-evening cron sweep. For every parent with at least one active
// guardian row and digest_paused != 1, enqueue a digest email via the
// existing email worker. Idempotent on (parent, weekStart) via the
// enqueueEmail dedup_key — re-running the cron same week is a no-op.
//
// "weekStart" = the Monday-of-the-just-ended week (today is Sunday;
// the week we recap is Mon last → Sun today).
//
// Returns { queued: N, skipped: N } for logging.
export async function dbQueueWeeklyDigests({ weekStart, enqueueFn }) {
  if (!weekStart || typeof enqueueFn !== "function") {
    return { queued: 0, skipped: 0, error: "missing_args" };
  }
  // Parents = users that have ≥1 active guardian row pointing at them
  // AND aren't disabled AND aren't digest-paused.
  const parentRows = await pool.query(
    "SELECT DISTINCT u.`sub`, u.`email`, u.`person_id`, " +
    "       p.`first_name`, p.`last_name`, p.`preferred_name`, " +
    "       COALESCE(s.`digest_paused`, 0) AS paused " +
    "  FROM `users` u " +
    "  JOIN `persons` p ON p.`id` = u.`person_id` " +
    "  JOIN `guardians` g ON g.`guardian_person_id` = u.`person_id` AND g.`removed_at` IS NULL " +
    "  LEFT JOIN `settings` s ON s.`user_sub` = u.`sub` " +
    " WHERE u.`is_disabled` = 0 AND u.`email_verified` = 1"
  );
  let queued = 0, skipped = 0;
  for (const p of parentRows) {
    if (p.paused) { skipped++; continue; }
    if (!p.email) { skipped++; continue; }
    const payload = await dbGetWeeklyDigestPayload({ parentSub: p.sub, weekStart });
    if (!payload.swimmers || payload.swimmers.length === 0) { skipped++; continue; }
    const parentDisplayName = displayNameInline({ first_name: p.first_name, last_name: p.last_name, preferred_name: p.preferred_name });
    await enqueueFn({
      to:         p.email,
      template:   "parent-digest",
      payload:    { parentDisplayName, swimmers: payload.swimmers, weekStart },
      dedupKey:   `parent-digest:${p.sub}:${weekStart}`,
      userSub:    p.sub,
    });
    queued++;
  }
  return { queued, skipped };
}

// R-J: transfer a group's primary coach to a new sub. Used when removing a
// coach who's primary on groups (caller must specify the destination).
// Validates the new primary is an active coach on the team.
export async function dbTransferGroupPrimary(groupId, newPrimarySub) {
  if (!groupId || !newPrimarySub) return { ok: false, reason: "missing_args" };
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const grpRows = await conn.query(
      "SELECT `team_id`, `primary_coach_sub` FROM `groups` WHERE `id` = ? FOR UPDATE",
      [groupId]
    );
    if (!grpRows[0])               { await conn.rollback(); return { ok: false, reason: "group_not_found" }; }
    const grp = grpRows[0];
    if (grp.primary_coach_sub === newPrimarySub) {
      await conn.rollback();
      return { ok: true, affected: 0, unchanged: true };
    }
    // If the target group belongs to a team, the new primary must be an
    // active team coach. (Independent groups have no team validation.)
    if (grp.team_id) {
      const ok = await conn.query(
        "SELECT 1 FROM `team_coaches` WHERE `team_id` = ? AND `coach_sub` = ? AND `removed_at` IS NULL LIMIT 1",
        [grp.team_id, newPrimarySub]
      );
      if (ok.length === 0) {
        await conn.rollback();
        return { ok: false, reason: "new_primary_not_on_team" };
      }
    }
    // Demote old primary's group_coaches row to assistant (or insert if not present)
    await conn.query(
      "UPDATE `group_coaches` SET `role` = 'assistant' WHERE `group_id` = ? AND `coach_sub` = ? AND `removed_at` IS NULL",
      [groupId, grp.primary_coach_sub]
    );
    // Promote new primary: insert if missing, or update existing row
    const existing = await conn.query(
      "SELECT `role`, `removed_at` FROM `group_coaches` WHERE `group_id` = ? AND `coach_sub` = ?",
      [groupId, newPrimarySub]
    );
    if (existing[0]) {
      await conn.query(
        "UPDATE `group_coaches` SET `role` = 'primary', `removed_at` = NULL WHERE `group_id` = ? AND `coach_sub` = ?",
        [groupId, newPrimarySub]
      );
    } else {
      await conn.query(
        "INSERT INTO `group_coaches` (`group_id`, `coach_sub`, `role`) VALUES (?, ?, 'primary')",
        [groupId, newPrimarySub]
      );
    }
    // Update the denormalized pointer on groups
    await conn.query(
      "UPDATE `groups` SET `primary_coach_sub` = ? WHERE `id` = ?",
      [newPrimarySub, groupId]
    );
    await conn.commit();
    return { ok: true, prior_primary: grp.primary_coach_sub };
  } catch (e) {
    try { await conn.rollback(); } catch (_) {}
    throw e;
  } finally {
    conn.release();
  }
}

// ── Managed swimmers + DOB / minor framework (R-B) ────────────────────
// See RELATIONSHIPS_SCOPE.md. Tables: `coach_managed_swimmers` (migration
// 012), `users.dob` (migration 013). Per decision #27 DOB is collected on
// every athlete record; per #28 under-13 derives `is_coppa_protected` which
// gates claim flow and parts of roster visibility.
//
// Minor status is ALWAYS DERIVED, never stored — a swimmer's age changes
// silently as the calendar advances; caching is_minor would go stale.

const MS_ID_RE = /^ms_[a-z0-9]{4,16}$/;
function genManagedId() {
  const n = crypto.randomBytes(4).readUInt32BE(0);
  return "ms_" + n.toString(36).padStart(6, "0").slice(-6);
}

// ── Pure date helpers (exported for server.js + tests) ────────────────
// `asOf` defaults to today; passing it lets callers compute against a
// reference date (e.g., for tests or "as-of season start" queries).
export function computeAge(dob, asOf = new Date()) {
  if (!dob) return null;
  const d = (dob instanceof Date) ? dob : new Date(String(dob));
  if (Number.isNaN(d.getTime())) return null;
  let age = asOf.getFullYear() - d.getFullYear();
  const m = asOf.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && asOf.getDate() < d.getDate())) age--;
  return age;
}
export function isMinor(dob, asOf = new Date()) {
  const age = computeAge(dob, asOf);
  if (age === null) return null;                                             // unknown → caller decides
  return age < 18;
}
export function isCoppaProtected(dob, asOf = new Date()) {
  const age = computeAge(dob, asOf);
  if (age === null) return null;
  return age < 13;
}

// ── Discord feedback webhook (DISCORD_SCOPE.md §6) ────────────────────
// Best-effort fire-and-forget POST to a private Discord channel for
// triage. The DB write is the source of truth; this is observability,
// not durability. Minor-bypass + DOB-null-bypass is enforced by the
// caller in server.js (see /api/feedback route).
//
// Payload shape per scope §6:
//   [<category>] <subject>
//   by <display_name>
//   on <page>
//   ---
//   <body>
//
// Webhook URL is in process.env.DISCORD_FEEDBACK_WEBHOOK_URL. If unset
// (e.g. dev/test envs without Discord wired), the helper no-ops with a
// warn log. Webhook failures (Discord 4xx/5xx, network error, timeout)
// are logged but never bubble up — the user's /api/feedback request
// must not fail because of a third-party outage.
export async function postFeedbackToDiscord({ category, subject, body, page, displayName }) {
  const url = process.env.DISCORD_FEEDBACK_WEBHOOK_URL;
  if (!url) {
    console.warn("[discord] DISCORD_FEEDBACK_WEBHOOK_URL not set; skipping post");
    return { posted: false, reason: "no_url" };
  }
  // Discord max message length is 2000 chars; clip body to leave headroom.
  const safeBody = (body || "").slice(0, 1500);
  const safeSubject = (subject || "(no subject)").slice(0, 200);
  const safePage = (page || "(unknown page)").slice(0, 200);
  const safeName = (displayName || "(unknown user)").slice(0, 100);
  const safeCategory = (category || "feedback").slice(0, 32);

  const content =
    `[${safeCategory}] ${safeSubject}\n` +
    `by ${safeName}\n` +
    `on ${safePage}\n` +
    `---\n` +
    safeBody;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);  // 5s cap
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`[discord] webhook POST returned ${res.status}; feedback row remains in DB`);
      return { posted: false, reason: `http_${res.status}` };
    }
    return { posted: true };
  } catch (err) {
    console.warn(`[discord] webhook POST threw: ${err.message}; feedback row remains in DB`);
    return { posted: false, reason: err.name === "AbortError" ? "timeout" : "exception" };
  }
}

// DOB sanity bounds — reject obvious nonsense at insert/update time.
//   * Future dates → impossible (not born yet)
//   * Before 1900 → effectively impossible for an active swimmer
function validateDob(dob) {
  if (!dob) return { ok: false, reason: "dob_required" };
  const d = new Date(String(dob));
  if (Number.isNaN(d.getTime())) return { ok: false, reason: "bad_dob_format" };
  const now = new Date();
  if (d > now) return { ok: false, reason: "dob_in_future" };
  if (d.getFullYear() < 1900) return { ok: false, reason: "dob_too_old" };
  return { ok: true };
}

// Lesson tier (Phase 5) — normalize a coach_managed_swimmers.equipment_modes
// value to an object|null. MariaDB may return JSON columns pre-parsed (object)
// or as a string depending on driver/config; handle both. Undefined (column not
// selected) → null.
function parseEquipmentModes(v) {
  if (v == null) return null;
  if (typeof v === "object") return v;
  try { return JSON.parse(v); } catch (_) { return null; }
}

function rowToManagedSwimmer(r) {
  // Phase 4 Identity I-D slice 2: if the caller JOINed persons and
  // projected r.first_name, compute display_name from the helper.
  // Otherwise fall back to the legacy r.display_name column. Same
  // fallback shape as dbGetMe. Callers WITHOUT the JOIN (e.g., the
  // pre-claim diff path) still work because r.first_name is undefined.
  const displayName = displayNameInline({ first_name: r.first_name, last_name: r.last_name, preferred_name: r.preferred_name });
  const initials = r.person_initials;
  const dob    = r.person_dob;
  const gender = r.person_gender;
  return {
    id:                   r.id,
    owner_coach_sub:      r.owner_coach_sub,
    team_id:              r.team_id,
    display_name:         displayName,
    initials:             initials,
    dob:                  dateToYmd(dob),
    age:                  computeAge(dob),
    is_minor:             isMinor(dob),
    is_coppa_protected:   isCoppaProtected(dob),
    gender:               gender,
    class_year:           r.person_class_year != null ? Number(r.person_class_year) : null,
    grade:                gradeFromClassYear(r.person_class_year),
    usa_swimming_id:      r.usa_swimming_id || null,
    parental_contact:     r.parental_contact,
    parent_managed_flag:  !!r.parent_managed_flag,
    pace_scy_100:         r.pace_scy_100,
    pace_scm_100:         r.pace_scm_100,
    pace_lcm_100:         r.pace_lcm_100,
    // Lesson tier (Phase 5) — per-swimmer equipment profile (JSON, same shape as
    // user settings.equipment). Undefined when the caller's SELECT omits it.
    equipment_modes:      parseEquipmentModes(r.equipment_modes),
    // Lesson ability level (Phase 5) — beginner/intermediate/advanced|null. Drives
    // which lesson sets the generator offers for this swimmer.
    lesson_level:         r.lesson_level || null,
    archived:             !!r.archived,
    created_at:           dtToIso(r.created_at),
    updated_at:           dtToIso(r.updated_at),
  };
}

// Verify the coach has an active role on the team. Used at insert/update
// time when team_id is set on a managed swimmer to prevent a coach from
// attaching swimmers to teams they don't belong to.
async function coachIsOnTeam(coachSub, teamId) {
  if (!coachSub || !teamId) return false;
  const rows = await pool.query(
    "SELECT 1 FROM `team_coaches` WHERE `team_id` = ? AND `coach_sub` = ? AND `removed_at` IS NULL LIMIT 1",
    [teamId, coachSub]
  );
  return rows.length > 0;
}

export async function dbCreateManagedSwimmer({ ownerSub, display_name = null, first_name = null, last_name = null, preferred_name = null, dob, gender = null, team_id = null, initials = null, class_year = null, usa_swimming_id = null, parental_contact = null, parent_managed_flag = false, pace_scy_100 = null, pace_scm_100 = null, pace_lcm_100 = null }) {
  if (!ownerSub) throw new Error("ownerSub required");
  // I-H: accept explicit first/last name parts (preferred — avoids the lossy
  // split on multi-word names like "Mary Jo" / "van der Berg") OR a single
  // display_name that we split (legacy CSV + the single-create form).
  let first, last;
  if (first_name != null && String(first_name).trim()) {
    first = String(first_name).trim();
    last  = (last_name == null ? "" : String(last_name).trim());
    if (first.length > 80) throw new Error("first_name max 80 chars");
    if (last.length  > 80) throw new Error("last_name max 80 chars");
  } else {
    if (!display_name || typeof display_name !== "string") throw new Error("display_name or first_name required");
    if (display_name.length > 120) throw new Error("display_name max 120 chars");
    const parsed = parseDisplayName(display_name);
    first = parsed.first; last = parsed.last;
  }
  const pref = (preferred_name == null || String(preferred_name).trim() === "") ? null : String(preferred_name).trim();
  if (pref && pref.length > 80) throw new Error("preferred_name max 80 chars");
  const dobCheck = validateDob(dob);
  if (!dobCheck.ok) throw new Error(dobCheck.reason);
  if (initials && initials.length > 4) throw new Error("initials max 4 chars");
  if (parental_contact && parental_contact.length > 255) throw new Error("parental_contact max 255 chars");
  if (gender !== null && gender !== "" && !GENDER_VALUES.includes(gender)) throw new Error("bad gender");
  const cyChk = _normClassYear(class_year);
  if (!cyChk.ok) throw new Error("bad class_year");
  // team_id is OPTIONAL. If provided, verify the coach belongs to it.
  if (team_id) {
    const ok = await coachIsOnTeam(ownerSub, team_id);
    if (!ok) throw new Error("not a coach on this team");
  }
  await dbEnsureUser(ownerSub);
  const id = genManagedId();
  // I-F: persons is the source of truth for name/initials/dob/gender/
  // class_year. The cms row carries only the relationship/pace data + the
  // person_id FK — no legacy name columns.
  const personId = genPersonId();
  const personInitials = initials || genInitialsFromParts(first, last);
  await pool.query(
    "INSERT INTO `persons` (`id`, `first_name`, `last_name`, `preferred_name`, `initials`, `dob`, `gender`, `class_year`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [personId, first, last, pref, personInitials, dob, gender || null, cyChk.value]
  );
  await pool.query(
    "INSERT INTO `coach_managed_swimmers` " +
    "(`id`, `owner_coach_sub`, `team_id`, `parental_contact`, `parent_managed_flag`, " +
    " `pace_scy_100`, `pace_scm_100`, `pace_lcm_100`, `person_id`) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      id, ownerSub, team_id || null,
      parental_contact || null, parent_managed_flag ? 1 : 0,
      pace_scy_100 || null, pace_scm_100 || null, pace_lcm_100 || null,
      personId,
    ]
  );
  if (usa_swimming_id) {
    await pool.query(
      "INSERT INTO `person_external_ids` (`person_id`, `system`, `external_id`) VALUES (?, 'usa_swimming', ?)",
      [personId, String(usa_swimming_id).slice(0, 255)]
    );
  }
  return { ok: true, id };
}

export async function dbGetManagedSwimmer(id) {
  if (!id || !MS_ID_RE.test(id)) return null;
  // Phase 4 Identity I-D slice 2: LEFT JOIN persons. rowToManagedSwimmer
  // computes display_name from the projection.
  const rows = await pool.query(
    "SELECT m.`id`, m.`owner_coach_sub`, m.`team_id`, " +
    "       m.`parental_contact`, m.`parent_managed_flag`, " +
    "       m.`pace_scy_100`, m.`pace_scm_100`, m.`pace_lcm_100`, m.`equipment_modes`, m.`lesson_level`, " +
    "       m.`archived`, m.`created_at`, m.`updated_at`, " +
    "       p.`first_name`, p.`last_name`, p.`preferred_name`, p.`initials` AS person_initials, " +
    "       p.`dob` AS person_dob, p.`gender` AS person_gender, p.`class_year` AS person_class_year, " +
    "       xe.`external_id` AS usa_swimming_id " +
    "  FROM `coach_managed_swimmers` m " +
    "  LEFT JOIN `persons` p ON p.`id` = m.`person_id` " +
    "  LEFT JOIN `person_external_ids` xe ON xe.`person_id` = m.`person_id` AND xe.`system` = 'usa_swimming' " +
    " WHERE m.`id` = ?",
    [id]
  );
  if (!rows[0]) return null;
  return rowToManagedSwimmer(rows[0]);
}

export async function dbListManagedSwimmersForCoach(coachSub, { includeArchived = false } = {}) {
  if (!coachSub) return [];
  const whereArchived = includeArchived ? "" : "AND m.`archived` = 0 ";
  // Phase 4 Identity I-D slice 2: LEFT JOIN persons; sort key stays on
  // legacy m.display_name (in sync with persons-derived inline name).
  const rows = await pool.query(
    "SELECT m.`id`, m.`owner_coach_sub`, m.`team_id`, " +
    "       m.`parental_contact`, m.`parent_managed_flag`, " +
    "       m.`pace_scy_100`, m.`pace_scm_100`, m.`pace_lcm_100`, m.`equipment_modes`, m.`lesson_level`, " +
    "       m.`archived`, m.`created_at`, m.`updated_at`, " +
    "       p.`first_name`, p.`last_name`, p.`preferred_name`, p.`initials` AS person_initials, " +
    "       p.`dob` AS person_dob, p.`gender` AS person_gender, p.`class_year` AS person_class_year, " +
    "       xe.`external_id` AS usa_swimming_id " +
    "  FROM `coach_managed_swimmers` m " +
    "  LEFT JOIN `persons` p ON p.`id` = m.`person_id` " +
    "  LEFT JOIN `person_external_ids` xe ON xe.`person_id` = m.`person_id` AND xe.`system` = 'usa_swimming' " +
    " WHERE m.`owner_coach_sub` = ? " + whereArchived +
    " ORDER BY m.`archived` ASC, p.`last_name` ASC, p.`first_name` ASC",
    [coachSub]
  );
  return rows.map(rowToManagedSwimmer);
}

// Update allowed-fields whitelist. dob can be updated; same validation as create.
export async function dbUpdateManagedSwimmer(id, patch) {
  if (!id || !MS_ID_RE.test(id)) return { ok: false, reason: "bad_id" };
  // I-F: name/initials/gender/dob/class_year live on persons; only the
  // relationship + pace fields (and team_id) stay on coach_managed_swimmers.
  const cmsAllowed = {
    parental_contact:    v => (v == null || v === "") ? null : (typeof v === "string" && v.length <= 255) ? v : undefined,
    parent_managed_flag: v => (typeof v === "boolean") ? (v ? 1 : 0) : (v === 0 || v === 1) ? v : undefined,
    pace_scy_100:        v => (v == null || v === "") ? null : (typeof v === "string" && v.length <= 8) ? v : undefined,
    pace_scm_100:        v => (v == null || v === "") ? null : (typeof v === "string" && v.length <= 8) ? v : undefined,
    pace_lcm_100:        v => (v == null || v === "") ? null : (typeof v === "string" && v.length <= 8) ? v : undefined,
    // Lesson tier (Phase 5) — per-swimmer equipment profile. Object (settings.
    // equipment shape) → JSON string for the JSON column; null clears it.
    equipment_modes:     v => {
      if (v == null) return null;
      if (typeof v !== "object" || Array.isArray(v)) return undefined;
      try { return JSON.stringify(v); } catch (_) { return undefined; }
    },
    // Lesson ability level (Phase 5) — beginner/intermediate/advanced or null.
    lesson_level:        v => (v == null || v === "") ? null : (["beginner","intermediate","advanced"].includes(v) ? v : undefined),
  };
  const sets = [], vals = [];
  for (const [k, validator] of Object.entries(cmsAllowed)) {
    if (k in patch) {
      const cleaned = validator(patch[k]);
      if (cleaned === undefined) return { ok: false, reason: `bad_${k}` };
      sets.push(`\`${k}\` = ?`);
      vals.push(cleaned);
    }
  }
  // team_id needs the owning-coach-on-team check; we need the owner_sub from
  // the row to validate. Caller (server route) verifies ownership separately;
  // here we look up to validate the team relationship.
  if ("team_id" in patch) {
    const newTeamId = patch.team_id === "" ? null : patch.team_id;
    if (newTeamId) {
      const ownerRows = await pool.query(
        "SELECT `owner_coach_sub` FROM `coach_managed_swimmers` WHERE `id` = ? LIMIT 1",
        [id]
      );
      if (!ownerRows[0]) return { ok: false, reason: "not_found" };
      const ok = await coachIsOnTeam(ownerRows[0].owner_coach_sub, newTeamId);
      if (!ok) return { ok: false, reason: "not_on_team" };
    }
    sets.push("`team_id` = ?");
    vals.push(newTeamId);
  }
  if (sets.length) {
    vals.push(id);
    await pool.query(
      `UPDATE \`coach_managed_swimmers\` SET ${sets.join(", ")} WHERE \`id\` = ?`,
      vals
    );
  }
  // Person-side fields → persons via the managed row's person_id.
  const personPatch = {};
  if ("display_name" in patch) {
    const dn = patch.display_name;
    if (!(typeof dn === "string" && dn.trim().length > 0 && dn.length <= 120)) return { ok: false, reason: "bad_display_name" };
    personPatch.display_name = dn.trim();
  }
  if ("initials" in patch) {
    if (patch.initials != null && patch.initials !== "" && (typeof patch.initials !== "string" || patch.initials.length > 4)) return { ok: false, reason: "bad_initials" };
    personPatch.initials = patch.initials;
  }
  if ("gender" in patch)          personPatch.gender = patch.gender;          // helper validates enum
  if ("class_year" in patch)      personPatch.class_year = patch.class_year;  // helper validates range
  if ("usa_swimming_id" in patch) personPatch.usa_swimming_id = patch.usa_swimming_id;
  if ("dob" in patch) {
    const dobCheck = validateDob(patch.dob);
    if (!dobCheck.ok) return { ok: false, reason: dobCheck.reason };
    personPatch.dob = patch.dob;
  }
  if (Object.keys(personPatch).length) {
    const pr = await dbUpdatePersonFromManagedId(id, personPatch);
    if (!pr.ok) return pr;
  }
  return { ok: true };
}

export async function dbArchiveManagedSwimmer(id, archived = true) {
  if (!id || !MS_ID_RE.test(id)) return { ok: false, reason: "bad_id" };
  const r = await pool.query(
    "UPDATE `coach_managed_swimmers` SET `archived` = ? WHERE `id` = ?",
    [archived ? 1 : 0, id]
  );
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

// Lightweight ownership check for route gating.
export async function dbIsManagedSwimmerOwnedBy(id, coachSub) {
  if (!id || !coachSub) return false;
  const rows = await pool.query(
    "SELECT 1 FROM `coach_managed_swimmers` WHERE `id` = ? AND `owner_coach_sub` = ? LIMIT 1",
    [id, coachSub]
  );
  return rows.length > 0;
}

// Bulk create for the import flow (R-B'). Per-row atomic — a single bad row
// does NOT roll back the others; instead each row's outcome is returned for
// the UI to display. Caller (server.js route) is responsible for capping the
// array size to prevent runaway writes.
//
// `team_id` is batch-level: same team applied to every row. Validated ONCE
// before the loop to avoid 80 redundant team_coaches lookups for an 80-row
// import. If invalid, the whole batch is rejected before any insert.
export async function dbBulkCreateManagedSwimmers(ownerSub, rows, { team_id = null } = {}) {
  if (!ownerSub) throw new Error("ownerSub required");
  if (!Array.isArray(rows)) throw new Error("rows must be array");
  await dbEnsureUser(ownerSub);                                              // single ensure for all rows
  if (team_id) {
    const ok = await coachIsOnTeam(ownerSub, team_id);
    if (!ok) throw new Error("not a coach on this team");
  }
  const results = [];
  for (let i = 0; i < rows.length; i++) {
    try {
      // Pass team_id through; dbCreateManagedSwimmer will re-validate, which
      // is fine — coachIsOnTeam is cheap. We could skip the per-row check
      // since we already validated; not worth the optimization yet.
      const r = await dbCreateManagedSwimmer({ ownerSub, team_id, ...rows[i] });
      results.push({ row_idx: i, ok: true, id: r.id });
    } catch (err) {
      results.push({ row_idx: i, ok: false, error: err.message || String(err) });
    }
  }
  const inserted = results.filter(r => r.ok).length;
  const errors   = results.filter(r => !r.ok);
  return { inserted, errors, results };
}

// ── User DOB (R-B) ────────────────────────────────────────────────────
// Self-serve DOB write — soft-prompt at next login per decision #37, and
// also writable from the profile if the user wants to update it.
// Separate from dbUpdateMe (display fields) so it's clear in audit + UI.
export async function dbUpdateMeDob(sub, dob) {
  if (!sub) return { ok: false, reason: "no_sub" };
  const dobCheck = validateDob(dob);
  if (!dobCheck.ok) return { ok: false, reason: dobCheck.reason };
  // I-F: dob lives on persons now.
  return dbUpdatePersonFromUserSub(sub, { dob });
}

// ─── Groups (Stage 2 / R-C) ───────────────────────────────────────────
// See RELATIONSHIPS_SCOPE.md. Tables: `groups`, `group_coaches`,
// `group_members` (migration 016). Decisions embedded:
//   #13 archive cascade (members get left_at stamped on group archive)
//   #18 roster visibility minor gate (enforced in dbUpdateGroup)
//   #28 minor protections
//   #33 one PRIMARY group per coach per swimmer (enforced in dbAddGroupMember)
//   #39 group phase (current_phase + phase_set_at)

const GROUP_PHASES = ["base", "build", "peak", "taper", "recovery"];
const POOL_MODES   = ["25y", "25m", "50m"];
const GROUP_COACH_ROLES  = ["primary", "assistant"];
const GROUP_MEMBER_ROLES = ["primary", "secondary"];

function genGroupId() {
  const n = crypto.randomBytes(4).readUInt32BE(0);
  return "gr_" + n.toString(36).padStart(6, "0").slice(-6);
}
function genEventId() {
  const n = crypto.randomBytes(4).readUInt32BE(0);
  return "ev_" + n.toString(36).padStart(6, "0").slice(-6);
}
// Phase 4 Identity I-A locked decision 10: persons IDs are px_<base36>.
// Lives here next to the other gen*Id helpers. Exported so the I-B
// backfill script (tools/identity_backfill.mjs) reuses the same generator.
export function genPersonId() {
  const n = crypto.randomBytes(4).readUInt32BE(0);
  return "px_" + n.toString(36).padStart(6, "0").slice(-6);
}

// Phase 4 Identity name-split heuristic (shared with I-B backfill).
// Returns { first, last, reasons }. Same logic as tools/identity_backfill
// to keep live + backfilled rows consistent. See IDENTITY_SCOPE.md §5
// (locked decision 1) for the rules.
const _NAME_TITLES   = /^(dr|mr|mrs|ms|miss|mx|prof|rev|sir|sgt|capt|cmdr|hon|fr)\.?$/i;
const _NAME_SUFFIXES = /^(jr|sr|ii|iii|iv|v|phd|md|esq|dds|cpa|do|np|rn)\.?$/i;
const _NAME_PARTICLES = /^(van|von|de|della|del|du|le|la|el|al|bin|ibn|af|st|mc|mac|der|den|dos|das|do|da)$/i;
export function parseDisplayName(raw) {
  const norm = (raw || "").trim().replace(/\s+/g, " ");
  if (!norm) return { first: "(unknown)", last: "(unknown)", reasons: ["empty"] };
  if (norm.includes(",")) {
    const [lastPart, firstPart] = norm.split(",", 2).map(s => s.trim());
    if (lastPart && firstPart) return { first: firstPart, last: lastPart, reasons: ["comma_reversed"] };
  }
  const parts = norm.split(" ");
  if (parts.length === 1) return { first: norm, last: "(unknown)", reasons: ["single_word"] };
  const reasons = [];
  let first = parts.slice(0, -1).join(" ");
  let last  = parts[parts.length - 1];
  if (_NAME_TITLES.test(parts[0])) reasons.push("title_prefix");
  if (_NAME_SUFFIXES.test(last) && parts.length > 2) {
    const head = parts.slice(0, -1);
    first = head.slice(0, -1).join(" ");
    last  = head[head.length - 1] + " " + parts[parts.length - 1];
    reasons.push("suffix_attached");
  } else if (parts.length >= 3 && _NAME_PARTICLES.test(parts[parts.length - 2])) {
    let lastIdx = parts.length - 1;
    while (lastIdx > 1 && _NAME_PARTICLES.test(parts[lastIdx - 1])) lastIdx--;
    first = parts.slice(0, lastIdx).join(" ");
    last  = parts.slice(lastIdx).join(" ");
    reasons.push("compound_surname");
  }
  return { first, last, reasons };
}
export function genInitialsFromParts(first, last) {
  const f = (first && first[0] && first[0] !== "(") ? first[0] : "?";
  const l = (last  && last[0]  && last[0]  !== "(") ? last[0]  : "?";
  return (f + l).toUpperCase();
}

// Phase 4 Identity I-D: display_name read-side helpers.
// Per fork-3 resolution 2026-05-26: "First Last" in chrome contexts
// (cards, headers, dropdowns), "Last, First" in tables/rosters where
// sort-by-last is the user expectation.
//
// Input is a person-shaped object with first_name, last_name,
// preferred_name (any may be null/undefined). When preferred_name is set
// it overrides first_name in BOTH formats — that's the whole point of
// the field. Last name is never substituted.
//
// Falls back gracefully if person is null/undefined: returns "(unknown)"
// rather than throwing, so callers can safely use these on rows where
// the LEFT JOIN didn't match (which shouldn't happen after I-C but
// belt-and-braces for the I-D → I-C gap).
//
// Tombstone handling (I-G) will branch on person.tombstoned_at IS NOT
// NULL to return "(deleted user)" or similar; deliberately not added
// here so I-D ships without touching I-G's scope.
export function displayNameInline(person) {
  if (!person) return "(unknown)";
  const first = person.preferred_name || person.first_name || "";
  const last  = person.last_name || "";
  const joined = (first + " " + last).trim();
  return joined || "(unknown)";
}
export function displayNameSortable(person) {
  if (!person) return "(unknown)";
  const first = person.preferred_name || person.first_name || "";
  const last  = person.last_name || "";
  if (last && first) return last + ", " + first;
  return (last || first || "(unknown)").trim();
}

// Phase 4 Identity I-F / normalization. class_year is the SOURCE OF TRUTH;
// grade level is DERIVED so it never goes stale. US K-12 convention: a
// student graduates at the end of grade 12 in the spring. The academic
// year rolls over in August, so from Aug–Dec the "current senior" cohort
// is next calendar year. Returns an integer grade (may be <1 for
// pre-school-age or >12 for already-graduated — caller decides how to
// render those); null when class_year is unknown/non-numeric.
export function gradeFromClassYear(classYear, now = new Date()) {
  const cy = Number(classYear);
  if (!Number.isFinite(cy)) return null;
  const m = now.getMonth() + 1;                 // 1–12
  const seniorCohort = m >= 8 ? now.getFullYear() + 1 : now.getFullYear();
  const grade = 12 - (cy - seniorCohort);
  return Number.isFinite(grade) ? grade : null;
}

// Validate a class_year value for writes. Accepts null/"" (clear), or an
// integer in a sane graduation-year window. Returns { ok, value } or
// { ok:false }.
function _normClassYear(v) {
  if (v === null || v === "" || v === undefined) return { ok: true, value: null };
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1990 || n > 2100) return { ok: false };
  return { ok: true, value: n };
}

// Phase 4 Identity I-F: the single write path into `persons`. Every legacy
// writer routes name/initials/dob/gender/class_year here instead of the
// old users/coach_managed_swimmers columns. Accepts an optional `conn` so
// the claim/merge transaction can participate. `patch` keys:
//   display_name (parsed → first/last, regenerates initials unless initials
//   also given), first_name, last_name, preferred_name, initials, dob,
//   gender, class_year. Unknown keys ignored. Returns { ok, affected } or
//   { ok:false, reason }.
export async function dbUpdatePersonById(personId, patch, conn = pool) {
  if (!personId) return { ok: false, reason: "no_person" };
  const sets = [], vals = [];
  let initialsExplicit = false;
  if ("initials" in patch) {
    sets.push("`initials` = ?");
    vals.push(patch.initials === "" || patch.initials == null ? null : String(patch.initials).slice(0, 8));
    initialsExplicit = true;
  }
  if ("display_name" in patch && patch.display_name != null && patch.display_name !== "") {
    const parsed = parseDisplayName(patch.display_name);
    sets.push("`first_name` = ?", "`last_name` = ?");
    vals.push(parsed.first, parsed.last);
    if (!initialsExplicit) { sets.push("`initials` = ?"); vals.push(genInitialsFromParts(parsed.first, parsed.last)); }
  } else {
    if ("first_name" in patch) { sets.push("`first_name` = ?"); vals.push(patch.first_name || "(unknown)"); }
    if ("last_name"  in patch) { sets.push("`last_name` = ?");  vals.push(patch.last_name  || "(unknown)"); }
  }
  if ("preferred_name" in patch) { sets.push("`preferred_name` = ?"); vals.push(patch.preferred_name === "" ? null : patch.preferred_name); }
  if ("dob" in patch) { sets.push("`dob` = ?"); vals.push(patch.dob === "" ? null : patch.dob); }
  if ("gender" in patch) {
    const g = patch.gender;
    if (g !== null && g !== "" && !GENDER_VALUES.includes(g)) return { ok: false, reason: "bad_gender" };
    sets.push("`gender` = ?"); vals.push(g === "" ? null : g);
  }
  if ("class_year" in patch) {
    const cy = _normClassYear(patch.class_year);
    if (!cy.ok) return { ok: false, reason: "bad_class_year" };
    sets.push("`class_year` = ?"); vals.push(cy.value);
  }
  // USA-Swimming ID lives in person_external_ids (system='usa_swimming'),
  // not on the persons row. Upsert on value, delete on null/empty. Handled
  // before the empty-sets short-circuit so a USA-S-only patch still writes.
  if ("usa_swimming_id" in patch) {
    const v = patch.usa_swimming_id;
    if (v === null || v === "") {
      await (conn || pool).query("DELETE FROM `person_external_ids` WHERE `person_id` = ? AND `system` = 'usa_swimming'", [personId]);
    } else {
      await (conn || pool).query(
        "INSERT INTO `person_external_ids` (`person_id`, `system`, `external_id`) VALUES (?, 'usa_swimming', ?) " +
        "ON DUPLICATE KEY UPDATE `external_id` = VALUES(`external_id`)",
        [personId, String(v).slice(0, 255)]
      );
    }
  }
  if (sets.length) {
    vals.push(personId);
    await (conn || pool).query(`UPDATE \`persons\` SET ${sets.join(", ")} WHERE \`id\` = ?`, vals);
  }
  return { ok: true };
}

// Ensure a persons row exists for a given parent table (users /
// coach_managed_swimmers) and return its id. Self-heals two states that
// would otherwise make a write silently no-op: (a) person_id NULL (a
// pre-I-B backfill gap or a row created before the persons table), and
// (b) person_id pointing at a missing persons row (orphaned pointer).
// Creates a placeholder persons row in either case so the caller's UPDATE
// always lands. parentTable + idCol are server-side constants (never user
// input). Returns the resolved person id, or null if the parent row
// itself is missing.
async function _ensurePersonId(parentTable, idCol, idVal, conn) {
  const q = conn || pool;
  // Common path: just the person_id. No legacy columns touched, so this is
  // clean both before and after migration 044 drops them.
  const rows = await q.query("SELECT `person_id` FROM `" + parentTable + "` WHERE `" + idCol + "` = ?", [idVal]);
  if (!rows[0]) return null;                                  // parent row gone
  let pid = rows[0].person_id;
  if (pid) {
    const exists = await q.query("SELECT 1 FROM `persons` WHERE `id` = ? LIMIT 1", [pid]);
    if (exists.length) return pid;                            // healthy — the overwhelming common case
  }
  // Rare create/repair branch (missing or orphaned person_id). Best-effort
  // seed of name/initials from the legacy columns IF they still exist
  // (pre-044); post-drop this throws and we fall back to placeholders. By
  // then every row has a person_id so this branch effectively never fires.
  let legacyName = null, legacyInit = null;
  try {
    const lr = await q.query("SELECT `display_name`, `initials` FROM `" + parentTable + "` WHERE `" + idCol + "` = ?", [idVal]);
    legacyName = lr[0]?.display_name; legacyInit = lr[0]?.initials;
  } catch (_) { /* legacy columns dropped (post-044) — seed placeholders */ }
  if (!pid) pid = genPersonId();
  const parsed = parseDisplayName(legacyName);
  const init = (legacyInit && String(legacyInit).slice(0, 4)) || genInitialsFromParts(parsed.first, parsed.last);
  await q.query(
    "INSERT INTO `persons` (`id`, `first_name`, `last_name`, `initials`) VALUES (?, ?, ?, ?)",
    [pid, parsed.first, parsed.last, init]
  );
  await q.query("UPDATE `" + parentTable + "` SET `person_id` = ? WHERE `" + idCol + "` = ?", [pid, idVal]);
  return pid;
}

// Resolve a user's person_id then update the persons row. Used by the
// self/admin profile writers. Self-heals a missing/orphaned person_id.
export async function dbUpdatePersonFromUserSub(sub, patch, conn = pool) {
  if (!sub) return { ok: false, reason: "no_sub" };
  const pid = await _ensurePersonId("users", "sub", sub, conn);
  if (!pid) return { ok: false, reason: "no_user" };
  return dbUpdatePersonById(pid, patch, conn);
}

// Resolve a managed swimmer's person_id then update the persons row.
export async function dbUpdatePersonFromManagedId(managedId, patch, conn = pool) {
  if (!managedId) return { ok: false, reason: "no_managed" };
  const pid = await _ensurePersonId("coach_managed_swimmers", "id", managedId, conn);
  if (!pid) return { ok: false, reason: "not_found" };
  return dbUpdatePersonById(pid, patch, conn);
}

function rowToGroup(r) {
  return {
    id:                         r.id,
    team_id:                    r.team_id,
    primary_coach_sub:          r.primary_coach_sub,
    name:                       r.name,
    pool_mode_default:          r.pool_mode_default,
    roster_visible_to_members:  !!r.roster_visible_to_members,
    current_phase:              r.current_phase,
    phase_set_at:               dtToIso(r.phase_set_at),
    archived:                   !!r.archived,
    archived_at:                dtToIso(r.archived_at),
    created_at:                 dtToIso(r.created_at),
    updated_at:                 dtToIso(r.updated_at),
  };
}

// Detect whether any currently-active member of a group is a minor. Used by
// the visibility gate. Joins both polymorphic targets (full-account user and
// managed swimmer) to persons; either side carrying a minor DOB is sufficient.
async function groupHasMinorMember(groupId) {
  if (!groupId) return false;
  // DOB comes from persons (JOINed twice, one per polymorphic target).
  // Legacy users/cms dob columns dropped in migration 044.
  const rows = await pool.query(
    "SELECT up.`dob` AS udob, " +
    "       mp.`dob` AS mdob " +
    "FROM `group_members` gm " +
    "LEFT JOIN `users` u                  ON u.`sub` = gm.`member_swimmer_sub` " +
    "LEFT JOIN `coach_managed_swimmers` m ON m.`id`  = gm.`member_managed_id` " +
    "LEFT JOIN `persons` up               ON up.`id` = u.`person_id` " +
    "LEFT JOIN `persons` mp               ON mp.`id` = m.`person_id` " +
    "WHERE gm.`group_id` = ? AND gm.`left_at` IS NULL",
    [groupId]
  );
  for (const r of rows) {
    if (isMinor(r.udob) === true) return true;
    if (isMinor(r.mdob) === true) return true;
  }
  return false;
}

export async function dbCreateGroup({ teamId, primaryCoachSub, name, poolModeDefault = null }) {
  if (!primaryCoachSub) throw new Error("primaryCoachSub required");
  if (!name || typeof name !== "string") throw new Error("name required");
  if (name.length > 120) throw new Error("name max 120 chars");
  if (poolModeDefault && !POOL_MODES.includes(poolModeDefault)) throw new Error("bad pool_mode_default");
  // If a team is specified, the primary-coach must have an active role on
  // that team. Independent groups (team_id null) skip this check.
  if (teamId) {
    const ok = await coachIsOnTeam(primaryCoachSub, teamId);
    if (!ok) throw new Error("not a coach on this team");
  }
  await dbEnsureUser(primaryCoachSub);
  const id = genGroupId();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      "INSERT INTO `groups` (`id`, `team_id`, `primary_coach_sub`, `name`, `pool_mode_default`) " +
      "VALUES (?, ?, ?, ?, ?)",
      [id, teamId || null, primaryCoachSub, name.trim(), poolModeDefault || null]
    );
    await conn.query(
      "INSERT INTO `group_coaches` (`group_id`, `coach_sub`, `role`) VALUES (?, ?, 'primary')",
      [id, primaryCoachSub]
    );
    await conn.commit();
    return { ok: true, id };
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    throw err;
  } finally {
    conn.release();
  }
}

export async function dbGetGroup(id) {
  if (!id) return null;
  const rows = await pool.query(
    "SELECT `id`, `team_id`, `primary_coach_sub`, `name`, `pool_mode_default`, " +
    "       `roster_visible_to_members`, `current_phase`, `phase_set_at`, " +
    "       `archived`, `archived_at`, `created_at`, `updated_at` " +
    "FROM `groups` WHERE `id` = ?",
    [id]
  );
  if (!rows[0]) return null;
  return rowToGroup(rows[0]);
}

export async function dbListGroupsForTeam(teamId, { includeArchived = false } = {}) {
  if (!teamId) return [];
  const whereArch = includeArchived ? "" : "AND `archived` = 0 ";
  const rows = await pool.query(
    "SELECT `id`, `team_id`, `primary_coach_sub`, `name`, `pool_mode_default`, " +
    "       `roster_visible_to_members`, `current_phase`, `phase_set_at`, " +
    "       `archived`, `archived_at`, `created_at`, `updated_at` " +
    "FROM `groups` WHERE `team_id` = ? " + whereArch +
    "ORDER BY `archived` ASC, `name` ASC",
    [teamId]
  );
  return rows.map(rowToGroup);
}

export async function dbListGroupsForCoach(coachSub, { includeArchived = false } = {}) {
  if (!coachSub) return [];
  const whereArch = includeArchived ? "" : "AND g.`archived` = 0 ";
  const rows = await pool.query(
    "SELECT DISTINCT g.`id`, g.`team_id`, g.`primary_coach_sub`, g.`name`, g.`pool_mode_default`, " +
    "       g.`roster_visible_to_members`, g.`current_phase`, g.`phase_set_at`, " +
    "       g.`archived`, g.`archived_at`, g.`created_at`, g.`updated_at` " +
    "FROM `groups` g " +
    "JOIN `group_coaches` gc ON gc.`group_id` = g.`id` AND gc.`removed_at` IS NULL " +
    "WHERE gc.`coach_sub` = ? " + whereArch +
    "ORDER BY g.`archived` ASC, g.`name` ASC",
    [coachSub]
  );
  return rows.map(rowToGroup);
}

export async function dbUpdateGroup(id, patch) {
  if (!id) return { ok: false, reason: "no_id" };
  const allowed = {
    name:              v => (typeof v === "string" && v.trim().length > 0 && v.length <= 120) ? v.trim() : undefined,
    pool_mode_default: v => (v == null || v === "") ? null : (POOL_MODES.includes(v) ? v : undefined),
  };
  const sets = [], vals = [];
  for (const [k, validator] of Object.entries(allowed)) {
    if (k in patch) {
      const cleaned = validator(patch[k]);
      if (cleaned === undefined) return { ok: false, reason: `bad_${k}` };
      sets.push(`\`${k}\` = ?`);
      vals.push(cleaned);
    }
  }
  // Roster visibility — decision #18/#28 enforcement: cannot be turned ON
  // when any active member is a minor. Turning OFF is always allowed.
  if ("roster_visible_to_members" in patch) {
    const target = patch.roster_visible_to_members ? 1 : 0;
    if (target === 1) {
      const hasMinor = await groupHasMinorMember(id);
      if (hasMinor) return { ok: false, reason: "minors_present_visibility_locked_off" };
    }
    sets.push("`roster_visible_to_members` = ?");
    vals.push(target);
  }
  if (!sets.length) return { ok: true, affected: 0 };
  vals.push(id);
  const r = await pool.query(
    `UPDATE \`groups\` SET ${sets.join(", ")} WHERE \`id\` = ?`,
    vals
  );
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

export async function dbArchiveGroup(id, archived = true) {
  if (!id) return { ok: false, reason: "no_id" };
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      "UPDATE `groups` SET `archived` = ?, `archived_at` = " +
      (archived ? "CURRENT_TIMESTAMP(3)" : "NULL") + " WHERE `id` = ?",
      [archived ? 1 : 0, id]
    );
    if (archived) {
      // Decision #13: auto-stamp left_at on active members at archive time
      // (clean history snapshot). Reason left null — coach can review.
      await conn.query(
        "UPDATE `group_members` SET `left_at` = CURRENT_TIMESTAMP(3), `reason` = COALESCE(`reason`, 'group archived') " +
        "WHERE `group_id` = ? AND `left_at` IS NULL",
        [id]
      );
    }
    await conn.commit();
    return { ok: true };
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    throw err;
  } finally {
    conn.release();
  }
}

export async function dbSetGroupPhase(id, phase) {
  if (!id) return { ok: false, reason: "no_id" };
  if (phase !== null && phase !== "" && !GROUP_PHASES.includes(phase)) return { ok: false, reason: "bad_phase" };
  const r = await pool.query(
    "UPDATE `groups` SET `current_phase` = ?, `phase_set_at` = " +
    (phase ? "CURRENT_TIMESTAMP(3)" : "NULL") + " WHERE `id` = ?",
    [phase || null, id]
  );
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

export async function dbGetGroupRole(groupId, coachSub) {
  if (!groupId || !coachSub) return null;
  const rows = await pool.query(
    "SELECT `role` FROM `group_coaches` " +
    "WHERE `group_id` = ? AND `coach_sub` = ? AND `removed_at` IS NULL LIMIT 1",
    [groupId, coachSub]
  );
  return rows[0]?.role || null;
}

export async function dbListGroupCoaches(groupId) {
  if (!groupId) return [];
  // Identity (display_name + initials) comes from persons via person_id.
  // Legacy users columns dropped in migration 044.
  const rows = await pool.query(
    "SELECT gc.`coach_sub`, gc.`role`, gc.`added_at`, " +
    "       u.`email`, " +
    "       p.`first_name`, p.`last_name`, p.`preferred_name`, p.`initials` AS person_initials " +
    "FROM `group_coaches` gc " +
    "LEFT JOIN `users` u ON u.`sub` = gc.`coach_sub` " +
    "LEFT JOIN `persons` p ON p.`id` = u.`person_id` " +
    "WHERE gc.`group_id` = ? AND gc.`removed_at` IS NULL " +
    "ORDER BY FIELD(gc.`role`, 'primary', 'assistant'), gc.`added_at` ASC",
    [groupId]
  );
  return rows.map(r => ({
    coach_sub:    r.coach_sub,
    role:         r.role,
    display_name: displayNameInline({ first_name: r.first_name, last_name: r.last_name, preferred_name: r.preferred_name }),
    initials:     r.person_initials,
    email:        r.email,
    added_at:     dtToIso(r.added_at),
  }));
}

export async function dbAddGroupCoach(groupId, coachSub, role = "assistant") {
  if (!groupId || !coachSub) return { ok: false, reason: "missing_args" };
  if (!GROUP_COACH_ROLES.includes(role)) return { ok: false, reason: "bad_role" };
  if (role === "primary") return { ok: false, reason: "primary_set_at_create_only" };
  // Target must be coach-flagged.
  const userRows = await pool.query(
    "SELECT `is_coach`, `is_admin`, `is_disabled` FROM `users` WHERE `sub` = ?",
    [coachSub]
  );
  if (!userRows[0]) return { ok: false, reason: "user_not_found" };
  const u = userRows[0];
  if (u.is_disabled) return { ok: false, reason: "user_disabled" };
  if (!(u.is_coach || u.is_admin)) return { ok: false, reason: "user_not_coach" };
  const existing = await pool.query(
    "SELECT `role`, `removed_at` FROM `group_coaches` WHERE `group_id` = ? AND `coach_sub` = ?",
    [groupId, coachSub]
  );
  if (existing[0]) {
    if (existing[0].role === "primary") return { ok: false, reason: "already_primary" };
    if (existing[0].removed_at === null) return { ok: false, reason: "already_active" };
    await pool.query(
      "UPDATE `group_coaches` SET `role` = ?, `removed_at` = NULL, `added_at` = CURRENT_TIMESTAMP(3) " +
      "WHERE `group_id` = ? AND `coach_sub` = ?",
      [role, groupId, coachSub]
    );
    return { ok: true, reactivated: true };
  }
  await pool.query(
    "INSERT INTO `group_coaches` (`group_id`, `coach_sub`, `role`) VALUES (?, ?, ?)",
    [groupId, coachSub, role]
  );
  return { ok: true };
}

export async function dbRemoveGroupCoach(groupId, coachSub) {
  if (!groupId || !coachSub) return { ok: false, reason: "missing_args" };
  const role = await dbGetGroupRole(groupId, coachSub);
  if (role === null) return { ok: false, reason: "not_active" };
  if (role === "primary") return { ok: false, reason: "cannot_remove_primary" };
  const r = await pool.query(
    "UPDATE `group_coaches` SET `removed_at` = CURRENT_TIMESTAMP(3) " +
    "WHERE `group_id` = ? AND `coach_sub` = ? AND `removed_at` IS NULL",
    [groupId, coachSub]
  );
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

// ── Group members (R-C — managed-only; full-account in R-F) ──────────

export async function dbListGroupMembers(groupId) {
  if (!groupId) return [];
  // Join both polymorphic targets — null-coalesce in the projection.
  // JOIN persons twice (one per polymorphic target: managed-person mp +
  // user-person up). Project person columns from whichever side hit, then
  // compute display_name in JS via displayNameInline. Both sides are persons
  // rows — legacy users/cms identity columns dropped in migration 044.
  const rows = await pool.query(
    "SELECT gm.`id`, gm.`member_swimmer_sub`, gm.`member_managed_id`, gm.`role`, " +
    "       gm.`joined_at`, gm.`left_at`, gm.`reason`, " +
    "       COALESCE(mp.`initials`, up.`initials`) AS initials, " +
    "       COALESCE(mp.`first_name`, up.`first_name`)    AS first_name, " +
    "       COALESCE(mp.`last_name`, up.`last_name`)      AS last_name, " +
    "       COALESCE(mp.`preferred_name`, up.`preferred_name`) AS preferred_name, " +
    "       COALESCE(mp.`dob`, up.`dob`)             AS dob, " +
    "       COALESCE(mp.`gender`, up.`gender`) AS gender " +
    "FROM `group_members` gm " +
    "LEFT JOIN `coach_managed_swimmers` m ON m.`id` = gm.`member_managed_id` " +
    "LEFT JOIN `users` u                  ON u.`sub` = gm.`member_swimmer_sub` " +
    "LEFT JOIN `persons` mp               ON mp.`id` = m.`person_id` " +
    "LEFT JOIN `persons` up               ON up.`id` = u.`person_id` " +
    "WHERE gm.`group_id` = ? AND gm.`left_at` IS NULL " +
    "ORDER BY COALESCE(mp.`last_name`, up.`last_name`) ASC, COALESCE(mp.`first_name`, up.`first_name`) ASC",
    [groupId]
  );
  return rows.map(r => ({
    id:                  Number(r.id),
    member_swimmer_sub:  r.member_swimmer_sub,
    member_managed_id:   r.member_managed_id,
    role:                r.role,
    joined_at:           dtToIso(r.joined_at),
    display_name:        displayNameInline({ first_name: r.first_name, last_name: r.last_name, preferred_name: r.preferred_name }),
    initials:            r.initials,
    dob:                 dateToYmd(r.dob),
    age:                 computeAge(r.dob),
    is_minor:            isMinor(r.dob),
    is_coppa_protected:  isCoppaProtected(r.dob),
    gender:              r.gender,
  }));
}

// Decision #33 enforcement: a swimmer can be in at most ONE group as
// 'primary' per coach. Secondary memberships are unlimited.
// Caller must specify EITHER managedId OR swimmerSub (polymorphic target).
export async function dbAddGroupMember(groupId, { managedId = null, swimmerSub = null, role = "primary" } = {}) {
  if (!groupId) return { ok: false, reason: "no_group" };
  if (!GROUP_MEMBER_ROLES.includes(role)) return { ok: false, reason: "bad_role" };
  if ((managedId === null) === (swimmerSub === null)) return { ok: false, reason: "specify_exactly_one_target" };
  // Transaction + SELECT FOR UPDATE on the target group row so concurrent
  // adds serialize against this group. Mirrors dbRedeemGroupJoinToken's
  // pattern — without it, two parallel adds could both pass the #33 /
  // duplicate-active checks and both INSERT.
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Lock the group row to serialize concurrent adds to this group.
    const grpRows = await conn.query(
      "SELECT `primary_coach_sub`, `archived` FROM `groups` WHERE `id` = ? FOR UPDATE",
      [groupId]
    );
    if (!grpRows[0]) {
      await conn.rollback();
      return { ok: false, reason: "group_not_found_or_archived" };
    }
    if (grpRows[0].archived) {
      await conn.rollback();
      return { ok: false, reason: "group_not_found_or_archived" };
    }
    const primaryCoach = grpRows[0].primary_coach_sub;
    // For role='primary', check no other active primary membership for this
    // swimmer exists under the same coach's other groups.
    if (role === "primary") {
      const targetField = managedId ? "gm.`member_managed_id`" : "gm.`member_swimmer_sub`";
      const targetValue = managedId || swimmerSub;
      const conflicts = await conn.query(
        "SELECT gm.`group_id`, g.`name` AS group_name FROM `group_members` gm " +
        "JOIN `groups` g ON g.`id` = gm.`group_id` " +
        `WHERE gm.\`left_at\` IS NULL AND gm.\`role\` = 'primary' AND ${targetField} = ? ` +
        "AND g.`primary_coach_sub` = ? AND gm.`group_id` != ?",
        [targetValue, primaryCoach, groupId]
      );
      if (conflicts.length > 0) {
        await conn.rollback();
        return { ok: false, reason: "primary_in_other_group_same_coach", conflict_group_id: conflicts[0].group_id, conflict_group_name: conflicts[0].group_name };
      }
    }
    // Also block duplicate-active rows for the same (group, member).
    const dupField = managedId ? "`member_managed_id`" : "`member_swimmer_sub`";
    const dupVal = managedId || swimmerSub;
    const dups = await conn.query(
      `SELECT 1 FROM \`group_members\` WHERE \`group_id\` = ? AND ${dupField} = ? AND \`left_at\` IS NULL LIMIT 1`,
      [groupId, dupVal]
    );
    if (dups.length > 0) {
      await conn.rollback();
      return { ok: false, reason: "already_active_member" };
    }
    const r = await conn.query(
      "INSERT INTO `group_members` (`group_id`, `member_swimmer_sub`, `member_managed_id`, `role`) " +
      "VALUES (?, ?, ?, ?)",
      [groupId, swimmerSub || null, managedId || null, role]
    );
    await conn.commit();
    return { ok: true, id: Number(r.insertId) };
  } catch (e) {
    try { await conn.rollback(); } catch (_) {}
    throw e;
  } finally {
    conn.release();
  }
}

export async function dbRemoveGroupMember(memberId, { reason = null } = {}) {
  if (!memberId) return { ok: false, reason: "no_id" };
  const r = await pool.query(
    "UPDATE `group_members` SET `left_at` = CURRENT_TIMESTAMP(3), `reason` = ? " +
    "WHERE `id` = ? AND `left_at` IS NULL",
    [reason || null, Number(memberId)]
  );
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

// Lookup helper for member-detail endpoints (e.g., verify membership for
// authz before allowing edit / remove).
export async function dbGetGroupMember(memberId) {
  if (!memberId) return null;
  const rows = await pool.query(
    "SELECT `id`, `group_id`, `member_swimmer_sub`, `member_managed_id`, `role`, `joined_at`, `left_at`, `reason` " +
    "FROM `group_members` WHERE `id` = ? LIMIT 1",
    [Number(memberId)]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id:                  Number(r.id),
    group_id:            r.group_id,
    member_swimmer_sub:  r.member_swimmer_sub,
    member_managed_id:   r.member_managed_id,
    role:                r.role,
    joined_at:           dtToIso(r.joined_at),
    left_at:             dtToIso(r.left_at),
    reason:              r.reason,
  };
}

// ── Team events (decision #38) ────────────────────────────────────────

// Normalize an event start time: null/"" → null (date-only/all-day), a valid
// HH:MM[:SS] → "HH:MM:SS", anything else → undefined (signals "invalid" so the
// caller can reject). The time is the VENUE-local clock time (the instant for
// weather is resolved as date+start_time in the venue tz, MEET_SCHEDULE §3.3.2).
function _normEventTime(t) {
  if (t == null || t === "") return null;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(t).trim());
  if (!m) return undefined;
  const hh = Number(m[1]), mm = Number(m[2]), ss = m[3] ? Number(m[3]) : 0;
  if (hh > 23 || mm > 59 || ss > 59) return undefined;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export async function dbCreateTeamEvent({ teamId, name, date, kind = DEFAULT_EVENT_KIND, venueId = null, startTime = null, createdByCoachSub }) {
  if (!teamId) throw new Error("teamId required");
  if (!name || typeof name !== "string") throw new Error("name required");
  if (name.length > 120) throw new Error("name max 120 chars");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) throw new Error("date must be YYYY-MM-DD");
  const k = EVENT_KIND_VALUES.includes(kind) ? kind : DEFAULT_EVENT_KIND;
  const st = _normEventTime(startTime);
  if (st === undefined) throw new Error("start_time must be HH:MM");
  const id = genEventId();
  await pool.query(
    "INSERT INTO `team_events` (`id`, `team_id`, `name`, `kind`, `date`, `venue_id`, `start_time`, `created_by_coach_sub`) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [id, teamId, name.trim(), k, date, venueId || null, st, createdByCoachSub || null]
  );
  return { ok: true, id };
}

export async function dbGetTeamEvent(eventId) {
  if (!eventId) return null;
  const rows = await pool.query(
    "SELECT te.`id`, te.`team_id`, te.`name`, te.`kind`, te.`date`, te.`venue_id`, te.`start_time`, " +
    "       te.`status`, te.`status_note`, te.`created_by_coach_sub`, te.`created_at`, " +
    "       v.`name` AS venue_name, v.`latitude` AS venue_lat, v.`longitude` AS venue_lng, " +
    "       v.`indoor_outdoor` AS venue_io, v.`timezone` AS venue_tz " +
    "FROM `team_events` te LEFT JOIN `venues` v ON v.`id` = te.`venue_id` " +
    "WHERE te.`id` = ?",
    [eventId]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id:        r.id,
    team_id:   r.team_id,
    name:      r.name,
    kind:      r.kind || DEFAULT_EVENT_KIND,
    date:      dateToYmd(r.date),
    start_time: r.start_time ? String(r.start_time).slice(0, 5) : null,
    status:     r.status || "scheduled",
    status_note: r.status_note || null,
    venue:     _eventVenue(r),
    created_by_coach_sub: r.created_by_coach_sub,
    created_at: dtToIso(r.created_at),
  };
}

// Shape the venue columns hung off a team_events row (joined as venue_*).
function _eventVenue(r) {
  if (!r || !r.venue_id) return null;
  return {
    id: r.venue_id,
    name: r.venue_name || null,
    latitude:  r.venue_lat == null ? null : Number(r.venue_lat),
    longitude: r.venue_lng == null ? null : Number(r.venue_lng),
    indoor_outdoor: r.venue_io || "unknown",
    timezone: r.venue_tz || null,
  };
}

export async function dbDeleteTeamEvent(eventId) {
  if (!eventId) return { ok: false, reason: "no_id" };
  const r = await pool.query("DELETE FROM `team_events` WHERE `id` = ?", [eventId]);
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

// Update name / date on an existing event. team_id and created_by_coach_sub
// are intentionally not editable — creator attribution is a tombstone.
export async function dbUpdateTeamEvent(eventId, { name, date, kind, venueId, startTime } = {}) {
  if (!eventId) return { ok: false, reason: "no_id" };
  const sets = [], vals = [];
  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) return { ok: false, reason: "bad_name" };
    if (name.length > 120) return { ok: false, reason: "name_too_long" };
    sets.push("`name` = ?"); vals.push(name.trim());
  }
  if (date !== undefined) {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return { ok: false, reason: "bad_date" };
    sets.push("`date` = ?"); vals.push(date);
  }
  if (kind !== undefined) {
    if (!EVENT_KIND_VALUES.includes(kind)) return { ok: false, reason: "bad_kind" };
    sets.push("`kind` = ?"); vals.push(kind);
  }
  if (venueId !== undefined) {
    // null/"" clears the venue; a string sets it.
    sets.push("`venue_id` = ?"); vals.push(venueId || null);
  }
  if (startTime !== undefined) {
    const st = _normEventTime(startTime);
    if (st === undefined) return { ok: false, reason: "bad_time" };
    sets.push("`start_time` = ?"); vals.push(st);
  }
  if (!sets.length) return { ok: true, affected: 0 };
  vals.push(eventId);
  const r = await pool.query(
    `UPDATE \`team_events\` SET ${sets.join(", ")} WHERE \`id\` = ?`,
    vals
  );
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

export async function dbListTeamEvents(teamId) {
  if (!teamId) return [];
  const rows = await pool.query(
    "SELECT te.`id`, te.`team_id`, te.`name`, te.`kind`, te.`date`, te.`venue_id`, te.`start_time`, " +
    "       te.`status`, te.`status_note`, te.`rsvp_closes_at`, te.`created_by_coach_sub`, te.`created_at`, " +
    "       v.`name` AS venue_name, v.`latitude` AS venue_lat, v.`longitude` AS venue_lng, " +
    "       v.`indoor_outdoor` AS venue_io, v.`timezone` AS venue_tz " +
    "FROM `team_events` te LEFT JOIN `venues` v ON v.`id` = te.`venue_id` " +
    "WHERE te.`team_id` = ? ORDER BY te.`date` ASC",
    [teamId]
  );
  return rows.map(r => ({
    id: r.id, team_id: r.team_id, name: r.name,
    kind: r.kind || DEFAULT_EVENT_KIND,
    date: dateToYmd(r.date),
    start_time: r.start_time ? String(r.start_time).slice(0, 5) : null,
    venue: _eventVenue(r),
    status: r.status || "scheduled",
    status_note: r.status_note || null,
    rsvp_closes_at: dtToIso(r.rsvp_closes_at),
    created_by_coach_sub: r.created_by_coach_sub,
    created_at: dtToIso(r.created_at),
  }));
}

// ─── Event RSVP (Phase 5 #5 Slice B) ─────────────────────────────────────────
// Forward-looking attendance intent, polymorphic across meets + practices.
export const RSVP_STATUSES = ["going", "maybe", "out", "no_response"];
const RSVP_TARGET_KINDS = ["meet", "practice"];

function _rsvpOwner(swimmerSub, managedId) {
  return managedId != null
    ? { where: "`managed_id` = ?", val: managedId }
    : { where: "`swimmer_sub` = ?", val: swimmerSub };
}

export async function dbSetRsvp({ targetKind, targetId, swimmerSub = null, managedId = null, status, respondedBySub = null }) {
  if (!RSVP_TARGET_KINDS.includes(targetKind)) return { ok: false, reason: "bad_kind" };
  if (!targetId) return { ok: false, reason: "no_target" };
  if ((swimmerSub == null) === (managedId == null)) return { ok: false, reason: "bad_owner" };
  if (!RSVP_STATUSES.includes(status)) return { ok: false, reason: "bad_status" };
  const { where, val } = _rsvpOwner(swimmerSub, managedId);
  const existing = await pool.query(
    "SELECT `id` FROM `event_rsvp` WHERE `target_kind`=? AND `target_id`=? AND " + where + " LIMIT 1",
    [targetKind, String(targetId), val]
  );
  if (existing[0]) {
    await pool.query("UPDATE `event_rsvp` SET `status`=?, `responded_by_sub`=? WHERE `id`=?",
      [status, respondedBySub, Number(existing[0].id)]);
    return { ok: true, id: Number(existing[0].id), updated: true };
  }
  const r = await pool.query(
    "INSERT INTO `event_rsvp` (`target_kind`,`target_id`,`swimmer_sub`,`managed_id`,`status`,`responded_by_sub`) VALUES (?,?,?,?,?,?)",
    [targetKind, String(targetId), swimmerSub, managedId, status, respondedBySub]
  );
  return { ok: true, id: Number(r.insertId), created: true };
}

export async function dbGetMyRsvp({ targetKind, targetId, swimmerSub }) {
  if (!targetKind || !targetId || !swimmerSub) return null;
  const rows = await pool.query(
    "SELECT `status` FROM `event_rsvp` WHERE `target_kind`=? AND `target_id`=? AND `swimmer_sub`=? LIMIT 1",
    [targetKind, String(targetId), swimmerSub]
  );
  return rows[0]?.status || null;
}

// Coach view: tally + per-swimmer list (resolves names polymorphically).
export async function dbGetRsvpSummary(targetKind, targetId) {
  if (!RSVP_TARGET_KINDS.includes(targetKind) || !targetId) return { tally: {}, list: [] };
  const rows = await pool.query(
    "SELECT er.`status`, er.`swimmer_sub`, er.`managed_id`, " +
    "  COALESCE(up.`first_name`, mp.`first_name`) AS first_name, " +
    "  COALESCE(up.`last_name`, mp.`last_name`) AS last_name, " +
    "  COALESCE(up.`preferred_name`, mp.`preferred_name`) AS preferred_name, " +
    "  COALESCE(up.`initials`, mp.`initials`) AS initials " +
    "FROM `event_rsvp` er " +
    // event_rsvp.swimmer_sub may be utf8mb3 (new-table default) while users.sub is
    // utf8mb4 — CONVERT both to utf8mb4 so the join works regardless of charset.
    "LEFT JOIN `users` u ON CONVERT(u.`sub` USING utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(er.`swimmer_sub` USING utf8mb4) COLLATE utf8mb4_unicode_ci " +
    "LEFT JOIN `coach_managed_swimmers` m ON m.`id` = er.`managed_id` " +
    "LEFT JOIN `persons` up ON up.`id` = u.`person_id` " +
    "LEFT JOIN `persons` mp ON mp.`id` = m.`person_id` " +
    "WHERE er.`target_kind`=? AND er.`target_id`=?",
    [targetKind, String(targetId)]
  );
  const tally = { going: 0, maybe: 0, out: 0, no_response: 0 };
  const list = rows.map(r => {
    if (tally[r.status] != null) tally[r.status]++;
    return {
      name: displayNameInline({ first_name: r.first_name, last_name: r.last_name, preferred_name: r.preferred_name }) || r.initials || "(swimmer)",
      status: r.status,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return { tally, list };
}

export async function dbSetTeamEventStatus(eventId, status, note = null) {
  if (!eventId) return { ok: false, reason: "no_id" };
  if (!["scheduled", "cancelled", "postponed"].includes(status)) return { ok: false, reason: "bad_status" };
  const r = await pool.query(
    "UPDATE `team_events` SET `status`=?, `status_note`=? WHERE `id`=?",
    [status, note ? String(note).slice(0, 280) : null, String(eventId)]
  );
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

// ─── Venues (universal pool/location catalog — MEET_SCHEDULE_WEATHER_SCOPE §2) ──
// One row per physical place; team_facilities + team_events reference it so the
// geocode + indoor/outdoor + tz are defined ONCE (one team's home pool is
// another's away venue). Created lazily by coaches; dedup-on-create avoids the
// "Mason Rec Center" ×6 problem (scope §2 #3). v1 venues are usable immediately
// (moderation_status defaults 'approved'); edit-moderation is reserved (§2 #4).
const VENUE_INDOOR_OUTDOOR = ["indoor", "outdoor", "unknown"];
const VENUE_COURSES = ["SCY", "SCM", "LCM"];

function genVenueId() {
  const n = crypto.randomBytes(4).readUInt32BE(0);
  return "vn_" + n.toString(36).padStart(6, "0").slice(-6);
}

// Normalize a venue name for dedup matching (case/spacing/punctuation-insensitive).
function _normVenueName(s) {
  return String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

// Great-circle distance in meters (for proximity dedup, ~150m threshold).
function _haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000, toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function _venueRow(r) {
  if (!r) return null;
  return {
    id: r.id, name: r.name,
    latitude:  r.latitude  == null ? null : Number(r.latitude),
    longitude: r.longitude == null ? null : Number(r.longitude),
    indoor_outdoor: r.indoor_outdoor || "unknown",
    course: r.course || null,
    timezone: r.timezone || null,
    address: r.address_id ? { line1: r.line1, line2: r.line2, city: r.city, region: r.region, postal_code: r.postal_code, country: r.country } : null,
  };
}

export async function dbGetVenue(venueId) {
  if (!venueId) return null;
  const rows = await pool.query(
    "SELECT v.`id`, v.`name`, v.`address_id`, v.`latitude`, v.`longitude`, v.`indoor_outdoor`, v.`course`, v.`timezone`, " +
    "       a.`line1`, a.`line2`, a.`city`, a.`region`, a.`postal_code`, a.`country` " +
    "FROM `venues` v LEFT JOIN `addresses` a ON a.`id` = v.`address_id` " +
    "WHERE v.`id` = ? AND v.`archived_at` IS NULL",
    [venueId]
  );
  return _venueRow(rows[0]);
}

// Catalog search for the picker: name match, nearest-first when coords supplied.
export async function dbListVenues({ q = null, near = null, limit = 20 } = {}) {
  const where = ["v.`archived_at` IS NULL"]; const vals = [];
  if (q && String(q).trim()) { where.push("v.`name` LIKE ?"); vals.push("%" + String(q).trim() + "%"); }
  const rows = await pool.query(
    "SELECT v.`id`, v.`name`, v.`address_id`, v.`latitude`, v.`longitude`, v.`indoor_outdoor`, v.`course`, v.`timezone`, " +
    "       a.`line1`, a.`line2`, a.`city`, a.`region`, a.`postal_code`, a.`country` " +
    "FROM `venues` v LEFT JOIN `addresses` a ON a.`id` = v.`address_id` " +
    "WHERE " + where.join(" AND ") + " ORDER BY v.`name` ASC LIMIT 100",
    vals
  );
  let out = rows.map(_venueRow);
  if (near && Number.isFinite(near.latitude) && Number.isFinite(near.longitude)) {
    out = out
      .map(v => ({ v, d: (v.latitude != null && v.longitude != null) ? _haversineMeters(near.latitude, near.longitude, v.latitude, v.longitude) : Infinity }))
      .sort((a, b) => a.d - b.d)
      .map(x => x.v);
  }
  return out.slice(0, Math.min(Number(limit) || 20, 50));
}

// Create a venue, OR link to an existing near-identical one (dedup, scope §2 #3):
// same normalized name AND within ~150m by geo, else same normalized name + postal.
export async function dbCreateOrLinkVenue({ name, address = null, latitude = null, longitude = null, indoorOutdoor = "unknown", course = null, timezone = null, coachSub = null }) {
  if (!name || typeof name !== "string" || !name.trim()) return { ok: false, reason: "name_required" };
  if (name.length > 200) return { ok: false, reason: "name_too_long" };
  const io  = VENUE_INDOOR_OUTDOOR.includes(indoorOutdoor) ? indoorOutdoor : "unknown";
  const crs = (course && VENUE_COURSES.includes(course)) ? course : null;
  const lat = (latitude  == null || latitude  === "") ? null : Number(latitude);
  const lng = (longitude == null || longitude === "") ? null : Number(longitude);
  if (lat != null && !(lat >= -90  && lat <= 90))  return { ok: false, reason: "bad_lat" };
  if (lng != null && !(lng >= -180 && lng <= 180)) return { ok: false, reason: "bad_lng" };
  const norm = _normVenueName(name);

  const cands = await pool.query(
    "SELECT v.`id`, v.`name`, v.`latitude`, v.`longitude`, a.`postal_code` " +
    "FROM `venues` v LEFT JOIN `addresses` a ON a.`id` = v.`address_id` " +
    "WHERE v.`archived_at` IS NULL",
    []
  );
  const postal = address && address.postal_code ? String(address.postal_code).trim() : null;
  for (const c of cands) {
    if (_normVenueName(c.name) !== norm) continue;
    if (lat != null && lng != null && c.latitude != null && c.longitude != null) {
      if (_haversineMeters(lat, lng, Number(c.latitude), Number(c.longitude)) <= 150) return { ok: true, id: c.id, linked: true };
    } else if (postal && c.postal_code && String(c.postal_code).trim() === postal) {
      return { ok: true, id: c.id, linked: true };
    }
  }

  const addressId = await _upsertFacilityAddress(null, address || {});
  const id = genVenueId();
  await pool.query(
    "INSERT INTO `venues` (`id`,`name`,`address_id`,`latitude`,`longitude`,`indoor_outdoor`,`course`,`timezone`,`created_by_coach_sub`) " +
    "VALUES (?,?,?,?,?,?,?,?,?)",
    [id, name.trim(), addressId, lat, lng, io, crs, timezone || null, coachSub || null]
  );
  return { ok: true, id, created: true };
}

export async function dbSetEventVenue(eventId, venueId) {
  if (!eventId) return { ok: false, reason: "no_id" };
  const r = await pool.query("UPDATE `team_events` SET `venue_id` = ? WHERE `id` = ?", [venueId || null, String(eventId)]);
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

// ─── Weather forecast cache (one row per venue+day; TTL enforced by caller) ───
export async function dbGetWeatherCache(venueId, day) {
  if (!venueId || !day) return null;
  const rows = await pool.query(
    "SELECT `payload`, `fetched_at` FROM `weather_cache` WHERE `venue_id`=? AND `day`=?",
    [venueId, day]
  );
  if (!rows[0]) return null;
  let payload = rows[0].payload;
  if (typeof payload === "string") { try { payload = JSON.parse(payload); } catch (_) { payload = null; } }
  const ms = rows[0].fetched_at ? new Date(rows[0].fetched_at).getTime() : 0;
  return { payload, fetched_at: dtToIso(rows[0].fetched_at), fetched_ms: ms };
}

export async function dbPutWeatherCache(venueId, day, payload) {
  if (!venueId || !day) return { ok: false };
  await pool.query(
    "INSERT INTO `weather_cache` (`venue_id`,`day`,`payload`) VALUES (?,?,?) " +
    "ON DUPLICATE KEY UPDATE `payload`=VALUES(`payload`), `fetched_at`=CURRENT_TIMESTAMP",
    [venueId, day, JSON.stringify(payload || {})]
  );
  return { ok: true };
}

// ─── Export bridges (Phase 5 Slice A: team .ics feed + roster CSV) ───────────
// Per-team calendar feed token (the sole credential on the public
// /calendar/:token.ics route — random + revocable). Lazy-created on first read.
export async function dbGetOrCreateTeamCalendarToken(teamId) {
  if (!teamId) return null;
  const rows = await pool.query("SELECT `calendar_feed_token` FROM `teams` WHERE `id` = ?", [teamId]);
  if (!rows[0]) return null;
  if (rows[0].calendar_feed_token) return rows[0].calendar_feed_token;
  const token = crypto.randomBytes(24).toString("base64url");
  await pool.query("UPDATE `teams` SET `calendar_feed_token` = ? WHERE `id` = ?", [token, teamId]);
  return token;
}

// Rotate (revoke + reissue) the team feed token — invalidates any shared URL.
export async function dbRotateTeamCalendarToken(teamId) {
  if (!teamId) return null;
  const token = crypto.randomBytes(24).toString("base64url");
  const r = await pool.query("UPDATE `teams` SET `calendar_feed_token` = ? WHERE `id` = ?", [token, teamId]);
  return r.affectedRows ? token : null;
}

// Resolve a feed token → team (archived teams excluded). Used by the
// unauthenticated feed route; the token IS the authorization.
export async function dbGetTeamByCalendarToken(token) {
  if (!token || typeof token !== "string") return null;
  const rows = await pool.query(
    "SELECT `id`, `name` FROM `teams` WHERE `calendar_feed_token` = ? AND `archived` = 0 LIMIT 1",
    [token]
  );
  return rows[0] ? { id: rows[0].id, name: rows[0].name } : null;
}

// The group a scheduled practice belongs to lives in its JSON, not a column:
// intent_params/payload `.group_id` (or `.assignment_target.group_id`). Mirrors
// the inGroup logic in dbGetScheduleAdherence.
function schedRowGroupId(sw) {
  for (const f of ["intent_params", "payload"]) {
    let v = sw[f];
    if (typeof v === "string") { try { v = JSON.parse(v); } catch (_) { v = null; } }
    if (!v) continue;
    if (v.group_id) return v.group_id;
    if (v.assignment_target && v.assignment_target.group_id) return v.assignment_target.group_id;
  }
  return null;
}

// Feed contents for a TEAM: the team's events plus practices scheduled for any of
// the team's groups (practices→groups→teams). Practices live on each coach's
// account with the group_id embedded in the schedule JSON, so we pull scheduled
// rows for all the team's coaches in the window and keep those whose group_id is
// one of the team's groups. Deduped by scheduled_workouts.id. Window −60d…+365d.
export async function dbTeamCalendarFeedData(teamId) {
  if (!teamId) return { scheduled: [], events: [] };
  const today = new Date();
  const start = new Date(today); start.setUTCDate(start.getUTCDate() - 60);
  const end   = new Date(today); end.setUTCDate(end.getUTCDate() + 365);
  const startYmd = start.toISOString().slice(0, 10);
  const endYmd   = end.toISOString().slice(0, 10);

  // Team groups (include archived so older practices still resolve a group name).
  const groups = await dbListGroupsForTeam(teamId, { includeArchived: true });
  const groupName = new Map(groups.map(g => [g.id, g.name]));
  const groupIds  = new Set(groups.map(g => g.id));

  let scheduled = [];
  if (groupIds.size > 0) {
    const cc = await pool.query(
      "SELECT `coach_sub` FROM `team_coaches` WHERE `team_id` = ? AND `removed_at` IS NULL",
      [teamId]
    );
    const coachSubs = cc.map(r => r.coach_sub).filter(Boolean);
    if (coachSubs.length > 0) {
      const ph = coachSubs.map(() => "?").join(",");
      const rows = await pool.query(
        "SELECT sw.`id`, sw.`scheduled_date`, sw.`notes`, sw.`payload`, sw.`intent_params`, " +
        "       f.`name` AS facility_name " +
        "  FROM `scheduled_workouts` sw " +
        "  LEFT JOIN `team_facilities` f ON f.`id` = sw.`facility_id` " +
        ` WHERE sw.\`user_sub\` IN (${ph}) AND sw.\`scheduled_date\` BETWEEN ? AND ?`,
        [...coachSubs, startYmd, endYmd]
      );
      const seen = new Set();
      for (const r of rows) {
        const gid = schedRowGroupId(r);
        if (!gid || !groupIds.has(gid)) continue;
        const id = Number(r.id);
        if (seen.has(id)) continue;
        seen.add(id);
        let payload = r.payload;
        if (typeof payload === "string") { try { payload = JSON.parse(payload); } catch (_) { payload = null; } }
        scheduled.push({
          id,
          scheduled_date: dateToYmd(r.scheduled_date),
          notes:          r.notes || null,
          payload,
          facility_name:  r.facility_name || null,
          group_name:     groupName.get(gid) || null,
        });
      }
      scheduled.sort((a, b) =>
        a.scheduled_date < b.scheduled_date ? -1 :
        a.scheduled_date > b.scheduled_date ?  1 : a.id - b.id);
    }
  }

  const allEvents = await dbListTeamEvents(teamId);
  const events = allEvents.filter(e => e.date >= startYmd && e.date <= endYmd);
  return { scheduled, events };
}

// Teams whose calendar feed a user should be able to copy: teams they coach, OR
// are a swimmer in (group member), OR are a guardian of a swimmer in (managed or
// real). Returns [{ team_id, team_name, token }] with the token lazy-created. The
// feed itself carries no minor PII (titles/dates/facility only), so parent +
// swimmer exposure is MAAP-safe; only coaches can rotate the token.
export async function dbListTeamCalendarsForUser(userSub, { guardianOnly = false } = {}) {
  if (!userSub) return [];
  const parentPid = await _swimmerPersonId({ swimmerSub: userSub });
  const clauses = [];
  const params = [];
  if (!guardianOnly) {
    // The user's OWN teams (coach, or swimmer group-member). Excluded for the
    // parent portal, which should show only the kids' teams.
    clauses.push("t.`id` IN (SELECT `team_id` FROM `team_coaches` WHERE `coach_sub` = ? AND `removed_at` IS NULL)");
    params.push(userSub);
    clauses.push(
      "t.`id` IN (SELECT g.`team_id` FROM `group_members` gm JOIN `groups` g ON g.`id` = gm.`group_id` " +
      "WHERE gm.`member_swimmer_sub` = ? AND gm.`left_at` IS NULL AND g.`team_id` IS NOT NULL)"
    );
    params.push(userSub);
  }
  if (parentPid) {
    // Guardian → teams where a guardianed swimmer (managed OR real) is an ACTIVE
    // GROUP MEMBER. That's the real "my kid practices here" signal. We intentionally
    // do NOT use coach_managed_swimmers.team_id here — it's a looser roster
    // attachment that can point at a team the kid isn't actually grouped in, which
    // surfaced phantom calendars in the parent portal.
    clauses.push(
      "t.`id` IN (SELECT gr.`team_id` FROM `group_members` gm2 " +
      "JOIN `groups` gr ON gr.`id` = gm2.`group_id` AND gr.`team_id` IS NOT NULL " +
      "LEFT JOIN `coach_managed_swimmers` m2 ON m2.`id` = gm2.`member_managed_id` " +
      "LEFT JOIN `users` u2 ON u2.`sub` = gm2.`member_swimmer_sub` " +
      "WHERE gm2.`left_at` IS NULL AND COALESCE(m2.`person_id`, u2.`person_id`) IN " +
      "(SELECT `swimmer_person_id` FROM `guardians` WHERE `guardian_person_id` = ? AND `removed_at` IS NULL))"
    );
    params.push(parentPid);
  }
  if (clauses.length === 0) return [];
  const rows = await pool.query(
    "SELECT DISTINCT t.`id`, t.`name` FROM `teams` t " +
    "WHERE t.`archived` = 0 AND (" + clauses.join(" OR ") + ") ORDER BY t.`name` ASC",
    params
  );
  const out = [];
  for (const r of rows) {
    const token = await dbGetOrCreateTeamCalendarToken(r.id);
    out.push({ team_id: r.id, team_name: r.name, token });
  }
  return out;
}

// Roster for a team's CSV export, with the fields a Hy-Tek Meet Manager import
// needs (Swimming ID + DOB + names + gender). Sourced from the SAME group
// membership the roster tab shows (dbGetTeamRoster) — members are polymorphic
// (managed swimmer OR real user), both resolving to a person — so the CSV matches
// what the coach sees. DISTINCT dedupes athletes who belong to multiple groups.
export async function dbTeamRosterForExport(teamId) {
  if (!teamId) return [];
  const rows = await pool.query(
    "SELECT DISTINCT p.`id` AS person_id, p.`first_name`, p.`last_name`, " +
    "       p.`preferred_name`, p.`dob`, p.`gender`, xe.`external_id` AS usa_swimming_id " +
    "  FROM `group_members` gm " +
    "  JOIN `groups` g ON g.`id` = gm.`group_id` AND g.`archived` = 0 AND g.`team_id` = ? " +
    "  LEFT JOIN `coach_managed_swimmers` m ON m.`id` = gm.`member_managed_id` " +
    "  LEFT JOIN `users` u ON u.`sub` = gm.`member_swimmer_sub` " +
    "  JOIN `persons` p ON p.`id` = COALESCE(m.`person_id`, u.`person_id`) " +
    "  LEFT JOIN `person_external_ids` xe ON xe.`person_id` = p.`id` AND xe.`system` = 'usa_swimming' " +
    " WHERE gm.`left_at` IS NULL " +
    " ORDER BY p.`last_name` ASC, p.`first_name` ASC",
    [teamId]
  );
  return rows.map(r => ({
    first_name:      r.first_name || "",
    last_name:       r.last_name || "",
    preferred_name:  r.preferred_name || "",
    dob:             dateToYmd(r.dob),
    gender:          r.gender || null,
    usa_swimming_id: r.usa_swimming_id || null,
  }));
}

// ── Group anchors / meet-anchored taper (MEET_ANCHORED_TAPER_SCOPE) ───
// One active anchor per group; replacing → old row gets active=0
// stamped + cleared_at, new row inserted active=1. The UNIQUE
// (group_id, active) DB constraint forces the two-step.
//
// Authz lives at the route layer (coach-of-group check via dbGetGroupRole
// or equivalent). These helpers don't re-check; callers MUST gate.
// Pure helpers imported at the top of this file (suggestedPhaseFromWeeksOut,
// weeksUntilEvent) live in lib/season.js so client + server share them.

export async function dbSetGroupAnchor({ groupId, eventId, byCoachSub }) {
  if (!groupId || !eventId || !byCoachSub) {
    throw new Error("dbSetGroupAnchor: groupId, eventId, byCoachSub all required");
  }
  // group_id + event_id are VARCHAR strings (gr_xxx / ev_xxx).
  const groupIdStr = String(groupId);
  const eventIdStr = String(eventId);
  // Clear any existing active anchor first (replace semantics — one per group).
  await pool.query(
    "UPDATE `group_anchors` SET `active` = 0, `cleared_at` = NOW() WHERE `group_id` = ? AND `active` = 1",
    [groupIdStr]
  );
  const r = await pool.query(
    "INSERT INTO `group_anchors` (`group_id`, `event_id`, `set_by_coach_sub`) VALUES (?, ?, ?)",
    [groupIdStr, eventIdStr, byCoachSub]
  );
  return Number(r.insertId);
}

export async function dbClearGroupAnchor({ groupId, byCoachSub: _byCoachSub }) {
  if (!groupId) throw new Error("dbClearGroupAnchor: groupId required");
  // byCoachSub is captured in audit_events at the route layer; not stored here.
  const r = await pool.query(
    "UPDATE `group_anchors` SET `active` = 0, `cleared_at` = NOW() WHERE `group_id` = ? AND `active` = 1",
    [String(groupId)]
  );
  return { cleared: r.affectedRows > 0 };
}

// Returns the active anchor for a group with derived weeks_out + suggested_phase,
// or null if no anchor exists or the underlying event is gone. group_id +
// event_id are VARCHAR strings (gr_xxx, ev_xxx); only anchor_id is BIGINT.
export async function dbGetActiveAnchor(groupId) {
  if (!groupId) return null;
  const rows = await pool.query(
    "SELECT ga.`id` AS anchor_id, ga.`event_id`, te.`name` AS event_name, te.`date` AS event_date, " +
    "       ga.`set_by_coach_sub`, ga.`created_at` " +
    "FROM `group_anchors` ga " +
    "LEFT JOIN `team_events` te ON te.`id` = ga.`event_id` " +
    "WHERE ga.`group_id` = ? AND ga.`active` = 1 LIMIT 1",
    [String(groupId)]
  );
  const r = rows[0];
  if (!r) return null;
  if (!r.event_id || !r.event_date) return null;   // orphan (event deleted; cron will sweep)
  const eventDateYmd = dateToYmd(r.event_date);
  const weeksOut = weeksUntilEvent(eventDateYmd);
  return {
    anchor_id:        Number(r.anchor_id),
    event_id:         r.event_id,                  // STRING (ev_xxx)
    event_name:       r.event_name,
    event_date:       eventDateYmd,
    set_by_coach_sub: r.set_by_coach_sub,
    weeks_out:        weeksOut,
    suggested_phase:  suggestedPhaseFromWeeksOut(weeksOut),
  };
}

// Convenience wrapper used by the suggested-phase reads from the client.
export async function dbGetSuggestedPhaseForGroup(groupId) {
  const a = await dbGetActiveAnchor(groupId);
  return a ? a.suggested_phase : null;
}

// List active anchors for every group the user is a swimmer-member
// of. Returns an array of hydrated anchors with derived
// weeks_out + suggested_phase. Used by /api/me/group-anchors which
// powers the AssignedToMe countdown badge.
//
// Only includes anchors whose underlying event still exists
// (LEFT JOIN team_events + WHERE event.id IS NOT NULL).
export async function dbListAnchorsForMemberSwimmer(userSub) {
  if (!userSub) return [];
  const rows = await pool.query(
    "SELECT ga.`group_id`, ga.`event_id`, te.`name` AS event_name, te.`date` AS event_date " +
    "FROM `group_anchors` ga " +
    "JOIN `team_events`  te ON te.`id`        = ga.`event_id` " +
    "JOIN `group_members` gm ON gm.`group_id` = ga.`group_id` AND gm.`left_at` IS NULL " +
    "WHERE gm.`member_swimmer_sub` = ? AND ga.`active` = 1",
    [userSub]
  );
  return rows.map(r => {
    const eventDateYmd = dateToYmd(r.event_date);
    const weeksOut = weeksUntilEvent(eventDateYmd);
    return {
      group_id:         r.group_id,                // STRING (gr_xxx)
      event_id:         r.event_id,                // STRING (ev_xxx)
      event_name:       r.event_name,
      event_date:       eventDateYmd,
      weeks_out:        weeksOut,
      suggested_phase:  suggestedPhaseFromWeeksOut(weeksOut),
    };
  });
}

// Cron sweep — runs hourly via the email worker tick. Two ways an
// anchor becomes orphaned:
//   1. Underlying event was deleted (LEFT JOIN team_events yields NULL)
//   2. Underlying group was deleted (LEFT JOIN groups yields NULL)
// Either way, flip active=0 + stamp cleared_at. No FKs in migration 035
// (see file header for why) so this LEFT JOIN sweep IS the integrity
// mechanism. Returns count for logging.
export async function dbExpireOrphanAnchors() {
  const r = await pool.query(
    "UPDATE `group_anchors` ga " +
    "LEFT JOIN `team_events` te ON te.`id` = ga.`event_id` " +
    "LEFT JOIN `groups`      g  ON g.`id`  = ga.`group_id` " +
    "SET ga.`active` = 0, ga.`cleared_at` = NOW() " +
    "WHERE ga.`active` = 1 AND (te.`id` IS NULL OR g.`id` IS NULL)"
  );
  return { cleared: r.affectedRows || 0 };
}

// ── Per-Swimmer Constraints (PSC) ────────────────────────────────────
// Phase 3 · per PER_SWIMMER_CONSTRAINTS_SCOPE.md. The new TOP tier of
// the fav/disfavor cascade — hard exclude, not soft weight. Closed
// vocab of 14 constraint_type values across 4 categories (stroke /
// equipment / section / caps).
//
// Schema notes (migration 037):
//   - swimmer_sub XOR managed_id — exactly one populated per row.
//     Enforced here in helpers; not at the SQL layer.
//   - No FK constraints into users/managed_swimmers (legacy tables).
//     LEFT JOIN reads + cron sweep handle integrity.
//   - active=1 row + expires_at NULL = persistent. expires_at < NOW()
//     gets flipped to active=0 by dbExpirePastConstraints (cron).
//   - removed_at stamped when coach soft-deletes; row stays for audit.

// Closed vocab — keep in sync with migration 037's ENUM.
const PSC_TYPES = [
  'stroke_no_fly','stroke_no_breast','stroke_no_back','stroke_no_free',
  'equip_no_paddles','equip_no_fins','equip_no_snorkel','equip_no_kickboard','equip_no_buoy',
  'section_no_main','section_no_kick','section_no_drill',
  'cap_yardage','cap_intensity'
];

// Central authz: is coachSub an active coach (primary OR assistant)
// of any non-archived group containing this swimmer? Mirrors the
// dbGetEffectiveDisfavorites coach-lookup pattern. Returns boolean.
//
// Pass exactly one of { swimmerSub, managedId }. If both/neither,
// returns false (caller bug; surface via 400 at the route layer).
export async function dbAuthzCoachOfSwimmer(coachSub, { swimmerSub = null, managedId = null } = {}) {
  if (!coachSub) return false;
  const hasSub = !!swimmerSub;
  const hasMan = !!managedId;
  if (hasSub === hasMan) return false;  // XOR violated
  if (hasSub) {
    const rows = await pool.query(
      "SELECT 1 FROM `group_members` gm " +
      "JOIN `groups`         g  ON g.`id`         = gm.`group_id` " +
      "JOIN `group_coaches`  gc ON gc.`group_id`  = g.`id` AND gc.`removed_at` IS NULL " +
      "WHERE gm.`member_swimmer_sub` = ? AND gm.`left_at` IS NULL " +
      "  AND g.`archived` = 0 AND gc.`coach_sub` = ? LIMIT 1",
      [swimmerSub, coachSub]
    );
    return rows.length > 0;
  }
  // managed: coach can act if they OWN the managed swimmer OR if the
  // managed swimmer is in a group the coach is on. Owner check first
  // since it's the common case (managed swimmers usually have one coach).
  const ownRows = await pool.query(
    "SELECT 1 FROM `coach_managed_swimmers` WHERE `id` = ? AND `owner_coach_sub` = ? LIMIT 1",
    [String(managedId), coachSub]
  );
  if (ownRows.length > 0) return true;
  const grpRows = await pool.query(
    "SELECT 1 FROM `group_members` gm " +
    "JOIN `groups`         g  ON g.`id`         = gm.`group_id` " +
    "JOIN `group_coaches`  gc ON gc.`group_id`  = g.`id` AND gc.`removed_at` IS NULL " +
    "WHERE gm.`member_managed_id` = ? AND gm.`left_at` IS NULL " +
    "  AND g.`archived` = 0 AND gc.`coach_sub` = ? LIMIT 1",
    [String(managedId), coachSub]
  );
  return grpRows.length > 0;
}

// Validate type+value combination. Throws on bad input. cap_yardage
// requires a positive int in value_num; cap_intensity requires
// 'easy_only' in value_str; all other types have no value fields.
function validatePscTypeValue(constraintType, valueNum, valueStr) {
  if (!PSC_TYPES.includes(constraintType)) {
    throw new Error(`bad constraint_type: ${constraintType}`);
  }
  if (constraintType === 'cap_yardage') {
    if (!Number.isInteger(valueNum) || valueNum <= 0 || valueNum > 100000) {
      throw new Error("cap_yardage requires positive integer value_num");
    }
    if (valueStr != null) throw new Error("cap_yardage must not set value_str");
    return;
  }
  if (constraintType === 'cap_intensity') {
    if (valueStr !== 'easy_only') {
      throw new Error("cap_intensity requires value_str='easy_only'");
    }
    if (valueNum != null) throw new Error("cap_intensity must not set value_num");
    return;
  }
  // boolean-flag types: no value fields
  if (valueNum != null || valueStr != null) {
    throw new Error(`${constraintType} must not set value_num or value_str`);
  }
}

// Insert a new constraint row. Authz is the caller's responsibility
// (dbAuthzCoachOfSwimmer at the route layer); this helper enforces
// XOR + type/value invariants only. Returns the new row id.
export async function dbAddSwimmerConstraint({ swimmerSub = null, managedId = null, setByCoachSub, constraintType, valueNum = null, valueStr = null, expiresAt = null }) {
  if (!setByCoachSub) throw new Error("setByCoachSub required");
  const hasSub = !!swimmerSub;
  const hasMan = !!managedId;
  if (hasSub === hasMan) throw new Error("exactly one of swimmerSub or managedId required");
  validatePscTypeValue(constraintType, valueNum, valueStr);
  // expiresAt: null (persistent) or a Date / ISO string. Coerce to Date
  // and reject anything obviously in the past (24h grace for clock skew).
  let expDate = null;
  if (expiresAt) {
    expDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
    if (isNaN(expDate.getTime())) throw new Error("bad expires_at");
    if (expDate.getTime() < Date.now() - 24*60*60*1000) {
      throw new Error("expires_at is in the past");
    }
  }
  const r = await pool.query(
    "INSERT INTO `swimmer_constraints` " +
    "(`swimmer_sub`, `managed_id`, `set_by_coach_sub`, `constraint_type`, `value_num`, `value_str`, `expires_at`) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      hasSub ? swimmerSub : null,
      hasMan ? String(managedId) : null,
      setByCoachSub,
      constraintType,
      valueNum,
      valueStr,
      expDate,
    ]
  );
  return Number(r.insertId);
}

// Soft-delete a constraint. Sets active=0 + removed_at=NOW(). Returns
// { removed: true } if a row was flipped (active=1 → 0); { removed: false }
// if no matching active row. Authz check is caller's responsibility.
export async function dbRemoveSwimmerConstraint(id) {
  if (!id) throw new Error("id required");
  const r = await pool.query(
    "UPDATE `swimmer_constraints` SET `active` = 0, `removed_at` = NOW() " +
    "WHERE `id` = ? AND `active` = 1",
    [Number(id)]
  );
  return { removed: (r.affectedRows || 0) > 0 };
}

// Fetch one constraint row by id (for authz lookups + edit flows).
// Returns null if not found.
export async function dbGetSwimmerConstraintById(id) {
  if (!id) return null;
  const rows = await pool.query(
    "SELECT `id`, `swimmer_sub`, `managed_id`, `set_by_coach_sub`, `constraint_type`, " +
    "       `value_num`, `value_str`, `expires_at`, `active`, `created_at`, `removed_at` " +
    "FROM `swimmer_constraints` WHERE `id` = ? LIMIT 1",
    [Number(id)]
  );
  return rows[0] || null;
}

// List constraints for one swimmer. Pass exactly one of swimmerSub or
// managedId. Default: active rows only. { includeInactive: true } for
// audit panels.
export async function dbListConstraintsForSwimmer({ swimmerSub = null, managedId = null }, { includeInactive = false } = {}) {
  const hasSub = !!swimmerSub;
  const hasMan = !!managedId;
  if (hasSub === hasMan) throw new Error("exactly one of swimmerSub or managedId required");
  const where = hasSub ? "`swimmer_sub` = ?" : "`managed_id` = ?";
  const param = hasSub ? swimmerSub : String(managedId);
  const activeFilter = includeInactive ? "" : "AND `active` = 1 ";
  const rows = await pool.query(
    "SELECT `id`, `swimmer_sub`, `managed_id`, `set_by_coach_sub`, `constraint_type`, " +
    "       `value_num`, `value_str`, `expires_at`, `active`, `created_at`, `removed_at` " +
    `FROM \`swimmer_constraints\` WHERE ${where} ${activeFilter}` +
    "ORDER BY `active` DESC, `created_at` DESC",
    [param]
  );
  return rows;
}

// Group roll-up — returns { '<swimmerSub or ms_xxx>': [constraints...] }
// for every swimmer in the group with at least one active constraint.
// Used by the Generate-time per-practice checklist.
// Note: managed swimmers are keyed by their `ms_xxx` managed_id, real
// users by their `users.sub`. Caller can disambiguate by inspecting the
// row's swimmer_sub vs managed_id fields.
export async function dbGetActiveConstraintsForGroup(groupId) {
  if (!groupId) return {};
  const rows = await pool.query(
    "SELECT sc.* FROM `swimmer_constraints` sc " +
    "JOIN `group_members` gm ON " +
    "    (gm.`member_swimmer_sub` IS NOT NULL AND gm.`member_swimmer_sub` = sc.`swimmer_sub`) OR " +
    "    (gm.`member_managed_id`  IS NOT NULL AND gm.`member_managed_id`  = sc.`managed_id`) " +
    "WHERE gm.`group_id` = ? AND gm.`left_at` IS NULL AND sc.`active` = 1 " +
    "ORDER BY sc.`created_at` DESC",
    [String(groupId)]
  );
  const out = {};
  for (const r of rows) {
    const key = r.swimmer_sub || r.managed_id;
    if (!key) continue;
    if (!out[key]) out[key] = [];
    out[key].push(r);
  }
  return out;
}

// Cron sweep — runs hourly via the email worker tick alongside
// dbExpireOrphanAnchors. Flips active=0 on rows whose expires_at has
// passed. No audit log here (caller can fetch the list before sweep
// if it needs to emit psc.expire events). Returns count for logging.
export async function dbExpirePastConstraints() {
  const r = await pool.query(
    "UPDATE `swimmer_constraints` SET `active` = 0 " +
    "WHERE `active` = 1 AND `expires_at` IS NOT NULL AND `expires_at` < NOW()"
  );
  return { expired: r.affectedRows || 0 };
}

// Swimmer-side read: a real-user swimmer fetching their OWN active
// constraints for ProfileModal + AssignedToMe substitution rendering.
// No authz arg — caller is the swimmer themselves (sub === param).
export async function dbListMyActiveConstraints(userSub) {
  if (!userSub) return [];
  return dbListConstraintsForSwimmer({ swimmerSub: userSub }, { includeInactive: false });
}

// Swimmer-side: a real-user swimmer's effective constraints aggregated
// across every (swimmerSub) row + every managed_id where they later
// claim a managed swimmer. v1 = swimmerSub only. Managed-claim handoff
// is rare; revisit if Phase 4 surfaces it.
//
// Returns a flat array of active rows. Caller (picker integration in
// next slice) builds the per-option exclusion check.
export async function dbGetEffectiveConstraints(userSub) {
  return dbListMyActiveConstraints(userSub);
}

// Swimmer-side visibility check for team resources (events today; potentially
// more later). True if the swimmer is an active full-account member of any
// group whose `team_id` matches. Note: managed swimmers don't authenticate, so
// this only needs to check `member_swimmer_sub`.
export async function dbIsSwimmerInTeam(swimmerSub, teamId) {
  if (!swimmerSub || !teamId) return false;
  const rows = await pool.query(
    "SELECT 1 FROM `group_members` gm " +
    "JOIN `groups` g ON g.`id` = gm.`group_id` " +
    "WHERE gm.`member_swimmer_sub` = ? AND gm.`left_at` IS NULL AND g.`team_id` = ? LIMIT 1",
    [swimmerSub, teamId]
  );
  return rows.length > 0;
}

// ── Group join tokens (Stage 4 / R-F) ────────────────────────────────
// Per scope §11 + decision #6 (code-only, no email). Coach issues a token
// pinned to a group + role; swimmer redeems via the app (out-of-band hand-
// off — text, in person, etc.). 30-day default expiry. Decision #33
// enforcement (one PRIMARY per coach per swimmer) happens here at redeem
// time — surfaces conflict info if the swimmer is already a primary in
// another of this coach's groups.

function genJoinToken() {
  // 10 base36 chars = 36^10 ≈ 3.6e15 possibilities; collision risk
  // negligible even with millions of outstanding tokens. Lower-case + digits
  // is easy to share aloud.
  const bytes = crypto.randomBytes(8);
  const n     = BigInt("0x" + bytes.toString("hex"));
  return n.toString(36).padStart(10, "0").slice(0, 10);
}

const JOIN_TOKEN_DAYS = 30;

export async function dbCreateGroupJoinToken({ groupId, issuedByCoach, intendedRole = "primary" }) {
  if (!groupId || !issuedByCoach) throw new Error("groupId + issuedByCoach required");
  if (!GROUP_MEMBER_ROLES.includes(intendedRole)) throw new Error("bad intended_role");
  const token     = genJoinToken();
  const expiresAt = new Date(Date.now() + JOIN_TOKEN_DAYS * 86400 * 1000)
    .toISOString().slice(0, 19).replace("T", " ");
  await pool.query(
    "INSERT INTO `group_join_tokens` (`token`, `group_id`, `intended_role`, `issued_by_coach`, `expires_at`) " +
    "VALUES (?, ?, ?, ?, ?)",
    [token, groupId, intendedRole, issuedByCoach, expiresAt]
  );
  return { ok: true, token, expires_at: dtToIso(new Date(expiresAt + "Z")) };
}

export async function dbGetGroupJoinToken(token) {
  if (!token) return null;
  const rows = await pool.query(
    "SELECT t.`token`, t.`group_id`, t.`intended_role`, t.`issued_by_coach`, t.`issued_at`, " +
    "       t.`expires_at`, t.`redeemed_at`, t.`redeemed_by_swimmer_sub`, " +
    "       g.`name` AS group_name, g.`primary_coach_sub`, g.`team_id`, tm.`team_type` " +
    "FROM `group_join_tokens` t " +
    "LEFT JOIN `groups` g ON g.`id` = t.`group_id` " +
    "LEFT JOIN `teams` tm ON tm.`id` = g.`team_id` " +
    "WHERE t.`token` = ? LIMIT 1",
    [token]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    token:                    r.token,
    group_id:                 r.group_id,
    group_name:               r.group_name,
    primary_coach_sub:        r.primary_coach_sub,
    team_id:                  r.team_id || null,
    team_type:                r.team_type || null,
    intended_role:            r.intended_role,
    issued_by_coach:          r.issued_by_coach,
    issued_at:                dtToIso(r.issued_at),
    expires_at:               dtToIso(r.expires_at),
    redeemed_at:              dtToIso(r.redeemed_at),
    redeemed_by_swimmer_sub:  r.redeemed_by_swimmer_sub,
    is_expired:               r.expires_at ? new Date(r.expires_at) < new Date() : false,
    is_redeemed:              !!r.redeemed_at,
  };
}

export async function dbListGroupJoinTokens(groupId, { includeRedeemed = false, includeExpired = false } = {}) {
  if (!groupId) return [];
  let where = "`group_id` = ?";
  if (!includeRedeemed) where += " AND `redeemed_at` IS NULL";
  if (!includeExpired)  where += " AND `expires_at` > NOW()";
  const rows = await pool.query(
    "SELECT `token`, `group_id`, `intended_role`, `issued_by_coach`, `issued_at`, " +
    "       `expires_at`, `redeemed_at`, `redeemed_by_swimmer_sub` " +
    "FROM `group_join_tokens` " +
    "WHERE " + where + " " +
    "ORDER BY `issued_at` DESC LIMIT 50",
    [groupId]
  );
  return rows.map(r => ({
    token:           r.token,
    group_id:        r.group_id,
    intended_role:   r.intended_role,
    issued_by_coach: r.issued_by_coach,
    issued_at:       dtToIso(r.issued_at),
    expires_at:      dtToIso(r.expires_at),
    redeemed_at:     dtToIso(r.redeemed_at),
    redeemed_by_swimmer_sub: r.redeemed_by_swimmer_sub,
    is_expired:      r.expires_at ? new Date(r.expires_at) < new Date() : false,
    is_redeemed:     !!r.redeemed_at,
  }));
}

export async function dbDeleteGroupJoinToken(token) {
  if (!token) return { ok: false, reason: "no_token" };
  const r = await pool.query(
    "DELETE FROM `group_join_tokens` WHERE `token` = ? AND `redeemed_at` IS NULL",
    [token]
  );
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

// Atomic redeem: validate, enforce #33, insert group_members, stamp token.
// Returns rich response: success or specific failure reason (expired, already
// redeemed, #33 conflict with conflict_group_name, etc.).
export async function dbRedeemGroupJoinToken(token, swimmerSub) {
  if (!token || !swimmerSub) return { ok: false, reason: "missing_args" };
  await dbEnsureUser(swimmerSub);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // SELECT FOR UPDATE so concurrent redeems serialize and only one wins.
    const tokRows = await conn.query(
      "SELECT t.`token`, t.`group_id`, t.`intended_role`, t.`expires_at`, t.`redeemed_at`, " +
      "       g.`primary_coach_sub`, g.`archived`, g.`name` AS group_name " +
      "FROM `group_join_tokens` t " +
      "LEFT JOIN `groups` g ON g.`id` = t.`group_id` " +
      "WHERE t.`token` = ? FOR UPDATE",
      [token]
    );
    if (!tokRows[0]) {
      await conn.rollback();
      return { ok: false, reason: "invalid_token" };
    }
    const t = tokRows[0];
    if (t.redeemed_at) {
      await conn.rollback();
      return { ok: false, reason: "already_redeemed" };
    }
    if (t.expires_at && new Date(t.expires_at) < new Date()) {
      await conn.rollback();
      return { ok: false, reason: "expired" };
    }
    if (t.archived) {
      await conn.rollback();
      return { ok: false, reason: "group_archived" };
    }
    // Already an active member of this group?
    const existingMember = await conn.query(
      "SELECT 1 FROM `group_members` WHERE `group_id` = ? AND `member_swimmer_sub` = ? AND `left_at` IS NULL LIMIT 1",
      [t.group_id, swimmerSub]
    );
    if (existingMember.length > 0) {
      await conn.rollback();
      return { ok: false, reason: "already_in_group" };
    }
    // Decision #33: if intended_role='primary', check no other active primary
    // for this swimmer under the same coach's groups.
    if (t.intended_role === "primary") {
      const conflicts = await conn.query(
        "SELECT g.`id`, g.`name` FROM `group_members` gm " +
        "JOIN `groups` g ON g.`id` = gm.`group_id` " +
        "WHERE gm.`left_at` IS NULL AND gm.`role` = 'primary' AND gm.`member_swimmer_sub` = ? " +
        "AND g.`primary_coach_sub` = ? AND gm.`group_id` != ?",
        [swimmerSub, t.primary_coach_sub, t.group_id]
      );
      if (conflicts.length > 0) {
        await conn.rollback();
        return {
          ok: false,
          reason: "primary_in_other_group_same_coach",
          conflict_group_id:   conflicts[0].id,
          conflict_group_name: conflicts[0].name,
        };
      }
    }
    // Insert the membership row.
    const ins = await conn.query(
      "INSERT INTO `group_members` (`group_id`, `member_swimmer_sub`, `role`) VALUES (?, ?, ?)",
      [t.group_id, swimmerSub, t.intended_role]
    );
    // Stamp the token redeemed.
    await conn.query(
      "UPDATE `group_join_tokens` SET `redeemed_at` = CURRENT_TIMESTAMP(3), `redeemed_by_swimmer_sub` = ? WHERE `token` = ?",
      [swimmerSub, token]
    );
    await conn.commit();
    return {
      ok:           true,
      group_id:     t.group_id,
      group_name:   t.group_name,
      role:         t.intended_role,
      member_id:    Number(ins.insertId),
    };
  } catch (e) {
    try { await conn.rollback(); } catch (_) {}
    throw e;
  } finally {
    conn.release();
  }
}

// ── Managed-swimmer claim tokens (Stage 5 / R-I) ─────────────────────
// Per scope §10 + Flow J. Coach issues a token tied to a managed profile;
// swimmer (with their own SSO account) redeems it. Redemption is atomic:
// identity fields copied per #24 (coach prefers, captured as diff per #30),
// dependent rows repointed (workout_assignments, coach_swimmer_notes,
// group_members), managed row deleted. No historical stub. #28 gates apply
// at issue time (under-13 block, parent_managed_flag block).

function genClaimToken() {
  const bytes = crypto.randomBytes(8);
  const n     = BigInt("0x" + bytes.toString("hex"));
  return n.toString(36).padStart(10, "0").slice(0, 10);
}
const CLAIM_TOKEN_DAYS = 30;

export async function dbCreateClaimToken({ managedId, issuedByCoach }) {
  if (!managedId || !issuedByCoach) throw new Error("managedId + issuedByCoach required");
  // Verify the managed profile exists and that the coach owns it.
  const ms = await dbGetManagedSwimmer(managedId);
  if (!ms) throw new Error("managed swimmer not found");
  if (ms.owner_coach_sub !== issuedByCoach) throw new Error("not owner of this managed profile");
  // Decision #28 gates:
  //   - Under-13 (COPPA-protected) — claim is blocked entirely.
  //   - parent_managed_flag set (decision #25 club override) — claim blocked.
  if (ms.is_coppa_protected) throw new Error("claim_blocked_under_13");
  if (ms.parent_managed_flag) throw new Error("claim_blocked_parent_managed");
  const token     = genClaimToken();
  const expiresAt = new Date(Date.now() + CLAIM_TOKEN_DAYS * 86400 * 1000)
    .toISOString().slice(0, 19).replace("T", " ");
  await pool.query(
    "INSERT INTO `managed_swimmer_claim_tokens` (`token`, `managed_id`, `issued_by_coach`, `expires_at`) " +
    "VALUES (?, ?, ?, ?)",
    [token, managedId, issuedByCoach, expiresAt]
  );
  return { ok: true, token, expires_at: dtToIso(new Date(expiresAt + "Z")) };
}

export async function dbGetClaimToken(token) {
  if (!token) return null;
  // Phase 4 Identity I-D slice 6: JOIN persons twice — once via managed
  // swimmer's person_id (mp), once via coach's person_id (pc).
  const rows = await pool.query(
    "SELECT t.`token`, t.`managed_id`, t.`issued_by_coach`, t.`issued_at`, " +
    "       t.`expires_at`, t.`redeemed_at`, t.`redeemed_by_swimmer_sub`, " +
    "       m.`owner_coach_sub`, " +
    "       mp.`first_name` AS m_first, mp.`last_name` AS m_last, mp.`preferred_name` AS m_preferred, " +
    "       pc.`first_name` AS c_first, pc.`last_name` AS c_last, pc.`preferred_name` AS c_preferred " +
    "FROM `managed_swimmer_claim_tokens` t " +
    "LEFT JOIN `coach_managed_swimmers` m ON m.`id` = t.`managed_id` " +
    "LEFT JOIN `users` cu ON cu.`sub` = t.`issued_by_coach` " +
    "LEFT JOIN `persons` mp ON mp.`id` = m.`person_id` " +
    "LEFT JOIN `persons` pc ON pc.`id` = cu.`person_id` " +
    "WHERE t.`token` = ? LIMIT 1",
    [token]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    token:                   r.token,
    managed_id:              r.managed_id,
    managed_name:            displayNameInline({ first_name: r.m_first, last_name: r.m_last, preferred_name: r.m_preferred }),
    owner_coach_sub:         r.owner_coach_sub,
    coach_name:              displayNameInline({ first_name: r.c_first, last_name: r.c_last, preferred_name: r.c_preferred }),
    issued_by_coach:         r.issued_by_coach,
    issued_at:               dtToIso(r.issued_at),
    expires_at:              dtToIso(r.expires_at),
    redeemed_at:             dtToIso(r.redeemed_at),
    redeemed_by_swimmer_sub: r.redeemed_by_swimmer_sub,
    is_expired:              r.expires_at ? new Date(r.expires_at) < new Date() : false,
    is_redeemed:             !!r.redeemed_at,
  };
}

export async function dbListClaimTokensForManaged(managedId, { includeRedeemed = false, includeExpired = false } = {}) {
  if (!managedId) return [];
  let where = "`managed_id` = ?";
  if (!includeRedeemed) where += " AND `redeemed_at` IS NULL";
  if (!includeExpired)  where += " AND `expires_at` > NOW()";
  const rows = await pool.query(
    "SELECT `token`, `managed_id`, `issued_by_coach`, `issued_at`, `expires_at`, `redeemed_at`, `redeemed_by_swimmer_sub` " +
    "FROM `managed_swimmer_claim_tokens` " +
    "WHERE " + where + " " +
    "ORDER BY `issued_at` DESC LIMIT 50",
    [managedId]
  );
  return rows.map(r => ({
    token:                   r.token,
    managed_id:              r.managed_id,
    issued_by_coach:         r.issued_by_coach,
    issued_at:               dtToIso(r.issued_at),
    expires_at:              dtToIso(r.expires_at),
    redeemed_at:             dtToIso(r.redeemed_at),
    redeemed_by_swimmer_sub: r.redeemed_by_swimmer_sub,
    is_expired:              r.expires_at ? new Date(r.expires_at) < new Date() : false,
    is_redeemed:             !!r.redeemed_at,
  }));
}

export async function dbDeleteClaimToken(token) {
  if (!token) return { ok: false, reason: "no_token" };
  const r = await pool.query(
    "DELETE FROM `managed_swimmer_claim_tokens` WHERE `token` = ? AND `redeemed_at` IS NULL",
    [token]
  );
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

// Atomic claim migration per Flow J. Big transaction:
//   1. Validate token + lock
//   2. Check #21/#33 group conflicts before any writes
//   3. Capture identity diff per #24/#30
//   4. Update users row from managed (coach prefers per #24)
//   5. Repoint workout_assignments
//   6. Repoint coach_swimmer_notes (try/catch — R-H may not have shipped)
//   7. Repoint group_members
//   8. Delete managed row
//   9. Stamp token redeemed
//   10. Return diff payload for the post-claim review screen
export async function dbRedeemClaimToken(token, swimmerSub) {
  if (!token || !swimmerSub) return { ok: false, reason: "missing_args" };
  await dbEnsureUser(swimmerSub);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ── Step 1: lock & validate token + managed row ────────────────────
    const tokRows = await conn.query(
      "SELECT t.`token`, t.`managed_id`, t.`issued_by_coach`, t.`expires_at`, t.`redeemed_at` " +
      "FROM `managed_swimmer_claim_tokens` t " +
      "WHERE t.`token` = ? FOR UPDATE",
      [token]
    );
    if (!tokRows[0])                                  { await conn.rollback(); return { ok: false, reason: "invalid_token" }; }
    const t = tokRows[0];
    if (t.redeemed_at)                                { await conn.rollback(); return { ok: false, reason: "already_redeemed" }; }
    if (t.expires_at && new Date(t.expires_at) < new Date()) { await conn.rollback(); return { ok: false, reason: "expired" }; }

    // I-F: name/initials/dob/gender come from persons (JOINed via person_id),
    // not the legacy cms columns. FOR UPDATE locks both the cms + persons rows.
    const msRows = await conn.query(
      "SELECT m.`id`, m.`owner_coach_sub`, m.`parental_contact`, " +
      "       m.`pace_scy_100`, m.`pace_scm_100`, m.`pace_lcm_100`, " +
      "       p.`first_name`, p.`last_name`, p.`preferred_name`, p.`initials`, p.`dob`, p.`gender` " +
      "FROM `coach_managed_swimmers` m LEFT JOIN `persons` p ON p.`id` = m.`person_id` " +
      "WHERE m.`id` = ? FOR UPDATE",
      [t.managed_id]
    );
    if (!msRows[0])                                   { await conn.rollback(); return { ok: false, reason: "managed_missing" }; }
    const ms = msRows[0];
    const msName = displayNameInline(ms);

    // ── Step 2: lock target swimmer row + capture diff ─────────────────
    // I-F: target identity also comes from persons (via users.person_id).
    const swRows = await conn.query(
      "SELECT u.`sub`, u.`person_id`, p.`first_name`, p.`last_name`, p.`preferred_name`, " +
      "       p.`initials`, p.`dob`, p.`gender` " +
      "FROM `users` u LEFT JOIN `persons` p ON p.`id` = u.`person_id` WHERE u.`sub` = ? FOR UPDATE",
      [swimmerSub]
    );
    if (!swRows[0])                                   { await conn.rollback(); return { ok: false, reason: "swimmer_missing" }; }
    const sw = swRows[0];
    const swName = displayNameInline(sw);
    const targetPersonId = sw.person_id;
    // Diff: only fields where managed has a value AND it differs from current swimmer value
    const diff = [];
    const idChanges = {};
    function maybeChange(field, msVal, swVal) {
      if (msVal == null || msVal === "") return;
      const a = msVal instanceof Date ? msVal.toISOString().slice(0,10) : String(msVal);
      const b = swVal == null ? "" : (swVal instanceof Date ? swVal.toISOString().slice(0,10) : String(swVal));
      if (a !== b) { diff.push({ field, from: b || null, to: a }); idChanges[field] = msVal; }
    }
    maybeChange("display_name", msName,       swName);
    maybeChange("initials",     ms.initials,  sw.initials);
    maybeChange("dob",          ms.dob,       sw.dob);
    maybeChange("gender",       ms.gender,    sw.gender);

    // ── Step 3: check group conflicts (#21/#33) before repoint ─────────
    const conflictRows = await conn.query(
      "SELECT g.`id`, g.`name`, g.`primary_coach_sub` FROM `group_members` mgm " +
      "JOIN `groups` g ON g.`id` = mgm.`group_id` " +
      "WHERE mgm.`member_managed_id` = ? AND mgm.`left_at` IS NULL AND mgm.`role` = 'primary'",
      [t.managed_id]
    );
    for (const cg of conflictRows) {
      const dupes = await conn.query(
        "SELECT g.`name` FROM `group_members` sgm " +
        "JOIN `groups` g ON g.`id` = sgm.`group_id` " +
        "WHERE sgm.`member_swimmer_sub` = ? AND sgm.`left_at` IS NULL AND sgm.`role` = 'primary' " +
        "AND g.`primary_coach_sub` = ? AND g.`id` != ?",
        [swimmerSub, cg.primary_coach_sub, cg.id]
      );
      if (dupes.length > 0) {
        await conn.rollback();
        return {
          ok: false,
          reason: "group_conflict",
          conflict_managed_group_id:    cg.id,
          conflict_managed_group_name:  cg.name,
          conflict_swimmer_group_name:  dupes[0].name,
        };
      }
    }

    // ── Step 4: update target identity fields (I-F: on persons) ────────
    if (Object.keys(idChanges).length > 0 && targetPersonId) {
      // idChanges keys are display_name/initials/dob/gender; dbUpdatePersonById
      // parses display_name → first/last and writes the persons row inside
      // this transaction (conn).
      await dbUpdatePersonById(targetPersonId, idChanges, conn);
    }

    // ── Step 5: repoint workout_assignments ────────────────────────────
    const r1 = await conn.query(
      "UPDATE `workout_assignments` SET `target_swimmer_sub` = ?, `target_managed_id` = NULL " +
      "WHERE `target_managed_id` = ?",
      [swimmerSub, t.managed_id]
    );

    // ── Step 6: repoint coach_swimmer_notes (table may not exist yet) ──
    let r2 = { affectedRows: 0 };
    try {
      r2 = await conn.query(
        "UPDATE `coach_swimmer_notes` SET `target_swimmer_sub` = ?, `target_managed_id` = NULL " +
        "WHERE `target_managed_id` = ?",
        [swimmerSub, t.managed_id]
      );
    } catch (e) { /* R-H table not built yet — fine */ }

    // ── Step 7: repoint group_members (pre-checked in step 3) ──────────
    let r3 = { affectedRows: 0 };
    try {
      r3 = await conn.query(
        "UPDATE `group_members` SET `member_swimmer_sub` = ?, `member_managed_id` = NULL " +
        "WHERE `member_managed_id` = ? AND `left_at` IS NULL",
        [swimmerSub, t.managed_id]
      );
    } catch (e) {
      await conn.rollback();
      return { ok: false, reason: "group_membership_repoint_failed", error: e.message };
    }

    // ── Step 8: delete the managed row ─────────────────────────────────
    await conn.query("DELETE FROM `coach_managed_swimmers` WHERE `id` = ?", [t.managed_id]);

    // ── Step 9: stamp the token redeemed ───────────────────────────────
    await conn.query(
      "UPDATE `managed_swimmer_claim_tokens` SET `redeemed_at` = CURRENT_TIMESTAMP(3), `redeemed_by_swimmer_sub` = ? WHERE `token` = ?",
      [swimmerSub, token]
    );

    await conn.commit();

    return {
      ok:                  true,
      managed_id:          t.managed_id,
      coach_sub:           t.issued_by_coach,
      identity_diff:       diff,
      repointed: {
        workout_assignments:  Number(r1.affectedRows || 0),
        coach_swimmer_notes:  Number(r2.affectedRows || 0),
        group_memberships:    Number(r3.affectedRows || 0),
      },
    };
  } catch (e) {
    try { await conn.rollback(); } catch (_) {}
    throw e;
  } finally {
    conn.release();
  }
}

// ── Coach private notes journal (Stage 5 / R-H) ──────────────────────
// Per scope §15 (#15: journal model). Multiple timestamped notes per
// (coach, swimmer) pair. Visibility enum scopes who else can read.
// team_id / group_id snapshot the scope at create-time so retroactive
// group changes don't leak old notes.

const COACH_NOTE_VISIBILITIES = ["private", "group_coaches", "team_coaches"];
const COACH_NOTE_BODY_MAX = 5000;

function rowToCoachNote(r) {
  // Author display name comes from persons-derived columns the caller JOINs
  // and projects (first_name/last_name/preferred_name). All callers JOIN
  // persons; legacy users identity columns dropped in migration 044.
  const authorName = displayNameInline({ first_name: r.first_name, last_name: r.last_name, preferred_name: r.preferred_name });
  return {
    id:                 Number(r.id),
    target_swimmer_sub: r.target_swimmer_sub,
    target_managed_id:  r.target_managed_id,
    author_coach_sub:   r.author_coach_sub,
    author_name:        authorName,
    team_id:            r.team_id,
    group_id:           r.group_id,
    workout_id:         r.workout_id,
    visibility:         r.visibility,
    body:               r.body,
    created_at:         dtToIso(r.created_at),
    updated_at:         dtToIso(r.updated_at),
  };
}

export async function dbCreateCoachNote({
  authorCoachSub, swimmerSub = null, managedId = null,
  teamId = null, groupId = null, workoutId = null,
  visibility = "private", body = ""
}) {
  if (!authorCoachSub) throw new Error("author required");
  if ((swimmerSub == null) === (managedId == null)) {
    throw new Error("specify exactly one of swimmerSub / managedId");
  }
  if (!COACH_NOTE_VISIBILITIES.includes(visibility)) throw new Error("bad_visibility");
  const trimmed = String(body || "").trim();
  if (!trimmed)                          throw new Error("body_required");
  if (trimmed.length > COACH_NOTE_BODY_MAX) throw new Error("body_too_long");
  // Visibility scope sanity: group_coaches needs group_id; team_coaches
  // needs team_id. private allows either to be null.
  if (visibility === "group_coaches" && !groupId) throw new Error("group_coaches_requires_group");
  if (visibility === "team_coaches"  && !teamId)  throw new Error("team_coaches_requires_team");
  const r = await pool.query(
    "INSERT INTO `coach_swimmer_notes` " +
    "(`target_swimmer_sub`, `target_managed_id`, `author_coach_sub`, `team_id`, `group_id`, `workout_id`, `visibility`, `body`) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [swimmerSub, managedId, authorCoachSub, teamId, groupId, workoutId, visibility, trimmed]
  );
  return { ok: true, id: Number(r.insertId) };
}

export async function dbGetCoachNote(id) {
  if (!id) return null;
  // Phase 4 Identity I-D slice 7: JOIN persons for author display.
  const rows = await pool.query(
    "SELECT n.*, " +
    "       p.`first_name`, p.`last_name`, p.`preferred_name` " +
    "FROM `coach_swimmer_notes` n " +
    "LEFT JOIN `users` u   ON u.`sub` = n.`author_coach_sub` " +
    "LEFT JOIN `persons` p ON p.`id`  = u.`person_id` " +
    "WHERE n.`id` = ? AND n.`deleted_at` IS NULL LIMIT 1",
    [Number(id)]
  );
  return rows[0] ? rowToCoachNote(rows[0]) : null;
}

// List visible notes for a target. Visibility rules:
//   - caller is the author → always visible
//   - visibility=group_coaches → caller must be an active coach on the
//     note's group_id (group_coaches.removed_at IS NULL)
//   - visibility=team_coaches → caller must be an active coach on the
//     note's team_id (team_coaches.removed_at IS NULL)
// We build the visible-scope sets up front (cheap two-query lookup) and
// inline them into a single SELECT.
export async function dbListCoachNotesForTarget({
  swimmerSub = null, managedId = null, callerSub, limit = 100
}) {
  if (!callerSub) return [];
  if ((swimmerSub == null) === (managedId == null)) {
    throw new Error("specify exactly one of swimmerSub / managedId");
  }
  // Resolve caller's coaching scopes.
  const teamRows = await pool.query(
    "SELECT `team_id` FROM `team_coaches` WHERE `coach_sub` = ? AND `removed_at` IS NULL",
    [callerSub]
  );
  const groupRows = await pool.query(
    "SELECT `group_id` FROM `group_coaches` WHERE `coach_sub` = ? AND `removed_at` IS NULL",
    [callerSub]
  );
  const callerTeamIds  = teamRows.map(r => r.team_id);
  const callerGroupIds = groupRows.map(r => r.group_id);
  // Build WHERE for visibility.
  const visClauses = ["n.`author_coach_sub` = ?"];
  const visVals    = [callerSub];
  if (callerGroupIds.length) {
    visClauses.push(`(n.\`visibility\` = 'group_coaches' AND n.\`group_id\` IN (${callerGroupIds.map(() => "?").join(", ")}))`);
    visVals.push(...callerGroupIds);
  }
  if (callerTeamIds.length) {
    visClauses.push(`(n.\`visibility\` = 'team_coaches' AND n.\`team_id\` IN (${callerTeamIds.map(() => "?").join(", ")}))`);
    visVals.push(...callerTeamIds);
  }
  const targetClause = swimmerSub != null ? "n.`target_swimmer_sub` = ?" : "n.`target_managed_id` = ?";
  const targetVal    = swimmerSub != null ? swimmerSub : managedId;
  const cap = Math.min(500, Math.max(1, Number(limit) || 100));
  // Phase 4 Identity I-D slice 7: JOIN persons for author display.
  const rows = await pool.query(
    "SELECT n.*, " +
    "       p.`first_name`, p.`last_name`, p.`preferred_name` " +
    "FROM `coach_swimmer_notes` n " +
    "LEFT JOIN `users` u   ON u.`sub` = n.`author_coach_sub` " +
    "LEFT JOIN `persons` p ON p.`id`  = u.`person_id` " +
    `WHERE ${targetClause} AND n.\`deleted_at\` IS NULL AND (${visClauses.join(" OR ")}) ` +
    `ORDER BY n.\`created_at\` DESC LIMIT ${cap}`,
    [targetVal, ...visVals]
  );
  return rows.map(rowToCoachNote);
}

// Edit own note. Only author can call this — server enforces.
export async function dbUpdateCoachNote(id, callerSub, patch = {}) {
  if (!id || !callerSub) return { ok: false, reason: "missing_args" };
  const cur = await pool.query(
    "SELECT `author_coach_sub`, `team_id`, `group_id` FROM `coach_swimmer_notes` " +
    "WHERE `id` = ? AND `deleted_at` IS NULL LIMIT 1",
    [Number(id)]
  );
  if (!cur[0]) return { ok: false, reason: "not_found" };
  if (cur[0].author_coach_sub !== callerSub) return { ok: false, reason: "not_author" };
  const sets = [], vals = [];
  if ("body" in patch) {
    const trimmed = String(patch.body || "").trim();
    if (!trimmed)                            return { ok: false, reason: "body_required" };
    if (trimmed.length > COACH_NOTE_BODY_MAX) return { ok: false, reason: "body_too_long" };
    sets.push("`body` = ?"); vals.push(trimmed);
  }
  if ("visibility" in patch) {
    if (!COACH_NOTE_VISIBILITIES.includes(patch.visibility)) return { ok: false, reason: "bad_visibility" };
    // Re-check scope requirements against the note's stored scope fields.
    if (patch.visibility === "group_coaches" && !cur[0].group_id) return { ok: false, reason: "group_coaches_requires_group" };
    if (patch.visibility === "team_coaches"  && !cur[0].team_id)  return { ok: false, reason: "team_coaches_requires_team" };
    sets.push("`visibility` = ?"); vals.push(patch.visibility);
  }
  if (!sets.length) return { ok: true, affected: 0 };
  vals.push(Number(id));
  const r = await pool.query(
    `UPDATE \`coach_swimmer_notes\` SET ${sets.join(", ")} WHERE \`id\` = ?`,
    vals
  );
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

export async function dbSoftDeleteCoachNote(id, callerSub) {
  if (!id || !callerSub) return { ok: false, reason: "missing_args" };
  const cur = await pool.query(
    "SELECT `author_coach_sub` FROM `coach_swimmer_notes` WHERE `id` = ? AND `deleted_at` IS NULL LIMIT 1",
    [Number(id)]
  );
  if (!cur[0]) return { ok: false, reason: "not_found" };
  if (cur[0].author_coach_sub !== callerSub) return { ok: false, reason: "not_author" };
  const r = await pool.query(
    "UPDATE `coach_swimmer_notes` SET `deleted_at` = CURRENT_TIMESTAMP(3) WHERE `id` = ?",
    [Number(id)]
  );
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

// ── Benchmarks (N7) ──────────────────────────────────────────────────
// Per-user test-set log. v1 kinds: t30 (30-min swim), tt500 (500 time
// trial), broken500 (10×50 broken). pace_100_secs derived server-side at
// insert. Latest t30 or tt500 auto-fills generator paceInput on save
// (UI calls onPaceUpdate after server returns).

const BENCHMARK_KINDS = ["t30", "tt500", "broken500"];
const BENCHMARK_POOLS = ["25y", "25m", "50m"];
const T30_DURATION_SECS = 1800;  // 30 minutes
const TT500_DISTANCE_YDS = 500;

function rowToBenchmark(r) {
  let splits = r.splits;
  if (typeof splits === "string") {
    try { splits = JSON.parse(splits); } catch (_) { splits = null; }
  }
  return {
    id:             Number(r.id),
    user_sub:       r.user_sub,
    kind:           r.kind,
    pool_mode:      r.pool_mode,
    recorded_at:    dtToIso(r.recorded_at),
    total_yards:    Number(r.total_yards),
    total_secs:     Number(r.total_secs),
    pace_100_secs:  Number(r.pace_100_secs),
    splits:         splits || null,
    notes:          r.notes || null,
  };
}

export async function dbCreateBenchmark({
  userSub, kind, poolMode = "25y",
  totalYards = null, totalSecs = null, splits = null, notes = null,
}) {
  if (!userSub) return { ok: false, reason: "no_user" };
  if (!BENCHMARK_KINDS.includes(kind)) return { ok: false, reason: "bad_kind" };
  if (!BENCHMARK_POOLS.includes(poolMode)) return { ok: false, reason: "bad_pool_mode" };

  // Kind-specific normalization + derived pace.
  let yards, secs, pace100;
  if (kind === "t30") {
    if (!Number.isFinite(totalYards) || totalYards < 100 || totalYards > 5000) {
      return { ok: false, reason: "t30_distance_out_of_range" };
    }
    yards   = Math.round(totalYards);
    secs    = T30_DURATION_SECS;
    pace100 = Math.round(secs * 100 / yards);
  } else if (kind === "tt500") {
    if (!Number.isFinite(totalSecs) || totalSecs < 180 || totalSecs > 1800) {
      return { ok: false, reason: "tt500_time_out_of_range" };
    }
    yards   = TT500_DISTANCE_YDS;
    secs    = Math.round(totalSecs);
    pace100 = Math.round(secs * 100 / yards);
  } else { // broken500
    if (!Number.isFinite(totalSecs) || totalSecs < 180 || totalSecs > 1800) {
      return { ok: false, reason: "broken500_time_out_of_range" };
    }
    yards   = TT500_DISTANCE_YDS;
    secs    = Math.round(totalSecs);
    pace100 = Math.round(secs * 100 / yards);
    // Light-touch splits validation — array of {dist, secs} OR raw numbers.
    if (splits != null) {
      if (!Array.isArray(splits)) return { ok: false, reason: "splits_must_be_array" };
      if (splits.length > 20)     return { ok: false, reason: "too_many_splits" };
    }
  }
  if (notes && String(notes).length > 500) return { ok: false, reason: "notes_too_long" };

  const r = await pool.query(
    "INSERT INTO `benchmarks` " +
    "(`user_sub`, `kind`, `pool_mode`, `total_yards`, `total_secs`, `pace_100_secs`, `splits`, `notes`) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [userSub, kind, poolMode, yards, secs, pace100, splits ? JSON.stringify(splits) : null, notes || null]
  );
  return { ok: true, id: Number(r.insertId), pace_100_secs: pace100 };
}

export async function dbListBenchmarks(userSub, { kind = null, limit = 50 } = {}) {
  if (!userSub) return [];
  const cap = Math.min(200, Math.max(1, Number(limit) || 50));
  let sql, vals;
  if (kind) {
    if (!BENCHMARK_KINDS.includes(kind)) return [];
    sql  = "SELECT * FROM `benchmarks` WHERE `user_sub` = ? AND `kind` = ? ORDER BY `recorded_at` DESC LIMIT " + cap;
    vals = [userSub, kind];
  } else {
    sql  = "SELECT * FROM `benchmarks` WHERE `user_sub` = ? ORDER BY `recorded_at` DESC LIMIT " + cap;
    vals = [userSub];
  }
  const rows = await pool.query(sql, vals);
  return rows.map(rowToBenchmark);
}

// Used by the auto-fill path: latest aerobic-pace-relevant benchmark
// (t30 or tt500 — broken500 is sprint, not aerobic). Returns the row
// or null if none exists.
export async function dbGetLatestAerobicBenchmark(userSub) {
  if (!userSub) return null;
  const rows = await pool.query(
    "SELECT * FROM `benchmarks` " +
    "WHERE `user_sub` = ? AND `kind` IN ('t30','tt500') " +
    "ORDER BY `recorded_at` DESC LIMIT 1",
    [userSub]
  );
  return rows[0] ? rowToBenchmark(rows[0]) : null;
}

export async function dbDeleteBenchmark(id, callerSub) {
  if (!id || !callerSub) return { ok: false, reason: "missing_args" };
  const cur = await pool.query(
    "SELECT `user_sub` FROM `benchmarks` WHERE `id` = ? LIMIT 1",
    [Number(id)]
  );
  if (!cur[0]) return { ok: false, reason: "not_found" };
  if (cur[0].user_sub !== callerSub) return { ok: false, reason: "not_owner" };
  const r = await pool.query("DELETE FROM `benchmarks` WHERE `id` = ?", [Number(id)]);
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

// ─── Race event goal/PR times (Phase 5 #4 — HS race-pace Slice B) ─────────────
// Polymorphic owner: exactly one of userSub / managedId. One row per
// owner+event+course+kind (enforced here, not via SQL UNIQUE — nullable poly key).
function _eventTimeOwner(userSub, managedId) {
  return managedId != null
    ? { where: "`managed_id` = ?", val: managedId }
    : { where: "`user_sub` = ?",   val: userSub };
}

export async function dbListEventTimes({ userSub = null, managedId = null } = {}) {
  if (managedId == null && !userSub) return [];
  const { where, val } = _eventTimeOwner(userSub, managedId);
  const rows = await pool.query(
    "SELECT `id`,`event`,`course`,`kind`,`time_secs`,`updated_at` " +
    "FROM `swimmer_event_times` WHERE " + where + " ORDER BY `event` ASC, `kind` ASC",
    [val]
  );
  return rows.map(r => ({
    id: Number(r.id), event: r.event, course: r.course, kind: r.kind,
    time_secs: Number(r.time_secs), updated_at: dtToIso(r.updated_at),
  }));
}

export async function dbUpsertEventTime({ userSub = null, managedId = null, event, course = "25y", kind, timeSecs, skipHistory = false }) {
  if (managedId == null && !userSub) return { ok: false, reason: "no_owner" };
  if (!RACE_EVENT_IDS.includes(event)) return { ok: false, reason: "bad_event" };
  if (!["25y", "25m", "50m"].includes(course)) return { ok: false, reason: "bad_course" };
  if (!RACE_TIME_KINDS.includes(kind)) return { ok: false, reason: "bad_kind" };
  const t = Number(timeSecs);
  if (!Number.isFinite(t) || t <= 0 || t > 3600) return { ok: false, reason: "bad_time" };
  const { where, val } = _eventTimeOwner(userSub, managedId);
  const existing = await pool.query(
    "SELECT `id` FROM `swimmer_event_times` WHERE " + where + " AND `event`=? AND `course`=? AND `kind`=? LIMIT 1",
    [val, event, course, kind]
  );
  let savedId, flag;
  if (existing[0]) {
    savedId = Number(existing[0].id);
    await pool.query("UPDATE `swimmer_event_times` SET `time_secs`=? WHERE `id`=?", [t, savedId]);
    flag = { updated: true };
  } else {
    const r = await pool.query(
      "INSERT INTO `swimmer_event_times` (`user_sub`,`managed_id`,`event`,`course`,`kind`,`time_secs`) VALUES (?,?,?,?,?,?)",
      [userSub, managedId, event, course, kind, t]
    );
    savedId = Number(r.insertId);
    flag = { created: true };
  }
  // Eval #7 — auto-capture a dated PR point so the progression chart fills as
  // PRs move. Best-effort: a history failure must never block the PR save.
  if (kind === "pr" && !skipHistory) {
    try {
      await dbAddEventPrHistory({ userSub, managedId, event, course, timeSecs: t, achievedOn: dateToYmd(new Date()), source: "auto" });
    } catch (_) { /* ignore */ }
  }
  return { ok: true, id: savedId, ...flag };
}

// ─── Per-event PR history (eval 2026-06-06 #7 — progression) ──────────────────
// Append-only dated points behind the 📈 Progress per-event chart. One point per
// owner+event+course+day (best/lowest time wins on the same day).
export async function dbAddEventPrHistory({ userSub = null, managedId = null, event, course = "25y", timeSecs, achievedOn, note = null, source = "logged" }) {
  if (managedId == null && !userSub) return { ok: false, reason: "no_owner" };
  if (!RACE_EVENT_IDS.includes(event)) return { ok: false, reason: "bad_event" };
  if (!["25y", "25m", "50m"].includes(course)) return { ok: false, reason: "bad_course" };
  const t = Number(timeSecs);
  if (!Number.isFinite(t) || t <= 0 || t > 3600) return { ok: false, reason: "bad_time" };
  const day = dateToYmd(achievedOn);
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ok: false, reason: "bad_date" };
  const src = source === "auto" ? "auto" : "logged";
  const { where, val } = _eventTimeOwner(userSub, managedId);
  const existing = await pool.query(
    "SELECT `id`,`time_secs` FROM `swimmer_event_pr_history` WHERE " + where + " AND `event`=? AND `course`=? AND `achieved_on`=? LIMIT 1",
    [val, event, course, day]
  );
  if (existing[0]) {
    // Keep the day's best (lowest) time; only overwrite when faster.
    if (t < Number(existing[0].time_secs)) {
      await pool.query("UPDATE `swimmer_event_pr_history` SET `time_secs`=?,`note`=?,`source`=? WHERE `id`=?",
        [t, note, src, Number(existing[0].id)]);
      return { ok: true, id: Number(existing[0].id), updated: true };
    }
    return { ok: true, id: Number(existing[0].id), kept: true };
  }
  const r = await pool.query(
    "INSERT INTO `swimmer_event_pr_history` (`user_sub`,`managed_id`,`event`,`course`,`time_secs`,`achieved_on`,`note`,`source`) VALUES (?,?,?,?,?,?,?,?)",
    [userSub, managedId, event, course, t, day, note, src]
  );
  return { ok: true, id: Number(r.insertId), created: true };
}

export async function dbListEventPrHistory({ userSub = null, managedId = null } = {}) {
  if (managedId == null && !userSub) return [];
  const { where, val } = _eventTimeOwner(userSub, managedId);
  const rows = await pool.query(
    "SELECT `id`,`event`,`course`,`time_secs`,`achieved_on`,`note`,`source` " +
    "FROM `swimmer_event_pr_history` WHERE " + where + " ORDER BY `event` ASC, `course` ASC, `achieved_on` ASC",
    [val]
  );
  return rows.map(r => ({
    id: Number(r.id), event: r.event, course: r.course, time_secs: Number(r.time_secs),
    achieved_on: dateToYmd(r.achieved_on), note: r.note || null, source: r.source,
  }));
}

export async function dbDeleteEventPrHistory(id, { userSub = null, managedId = null } = {}) {
  if (!id) return { ok: false, reason: "no_id" };
  const { where, val } = _eventTimeOwner(userSub, managedId);
  const r = await pool.query("DELETE FROM `swimmer_event_pr_history` WHERE `id`=? AND " + where, [Number(id), val]);
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

// ─── Person compliance credentials (Phase 5 #3 MAAP, Slice A) ─────────────────
// person_external_ids (mig 039 + 055 expires_at) holds per-person credential IDs.
// MAAP credential systems = USA-Swimming Member ID + SafeSport cert + background
// check. Display + expiry warning only; nothing is gated on expiry (v1 decision).
export const CREDENTIAL_SYSTEMS = ["usa_swimming", "safesport_cert", "background_check"];

export async function dbGetPersonIdForUser(userSub) {
  if (!userSub) return null;
  const rows = await pool.query("SELECT `person_id` FROM `users` WHERE `sub` = ? LIMIT 1", [userSub]);
  return rows[0]?.person_id || null;
}

export async function dbListPersonCredentials(personId) {
  if (!personId) return [];
  const rows = await pool.query(
    "SELECT `system`,`external_id`,`expires_at`,`verified_at`,`added_at` " +
    "FROM `person_external_ids` WHERE `person_id` = ? AND `system` IN (?,?,?) ORDER BY `system` ASC",
    [personId, ...CREDENTIAL_SYSTEMS]
  );
  return rows.map(r => ({
    system: r.system, external_id: r.external_id,
    expires_at: r.expires_at ? dateToYmd(r.expires_at) : null,
    verified_at: dtToIso(r.verified_at), added_at: dtToIso(r.added_at),
  }));
}

export async function dbSetPersonCredential({ personId, system, externalId, expiresAt = null }) {
  if (!personId) return { ok: false, reason: "no_person" };
  if (!CREDENTIAL_SYSTEMS.includes(system)) return { ok: false, reason: "bad_system" };
  const ext = (externalId == null ? "" : String(externalId)).trim();
  if (!ext) return { ok: false, reason: "empty_id" };
  let exp = null;
  if (expiresAt) {
    exp = dateToYmd(expiresAt);
    if (!exp || !/^\d{4}-\d{2}-\d{2}$/.test(exp)) return { ok: false, reason: "bad_date" };
  }
  // UNIQUE(person_id, system) — upsert in place.
  await pool.query(
    "INSERT INTO `person_external_ids` (`person_id`,`system`,`external_id`,`expires_at`) VALUES (?,?,?,?) " +
    "ON DUPLICATE KEY UPDATE `external_id`=VALUES(`external_id`), `expires_at`=VALUES(`expires_at`)",
    [personId, system, ext, exp]
  );
  return { ok: true };
}

export async function dbDeletePersonCredential(personId, system) {
  if (!personId || !CREDENTIAL_SYSTEMS.includes(system)) return { ok: false, reason: "bad_request" };
  const r = await pool.query(
    "DELETE FROM `person_external_ids` WHERE `person_id` = ? AND `system` = ?",
    [personId, system]
  );
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

// ─── Web Push subscriptions (notification infra foundation) ───────────────────
// One row per browser endpoint. Upsert on endpoint so re-subscribing the same
// browser refreshes keys + owner rather than duplicating.
export async function dbAddPushSubscription({ userSub, endpoint, p256dh, auth, platform = null, userAgent = null }) {
  if (!userSub || !endpoint || !p256dh || !auth) return { ok: false, reason: "bad_request" };
  await pool.query(
    "INSERT INTO `push_subscriptions` (`user_sub`,`endpoint`,`p256dh`,`auth`,`platform`,`user_agent`) VALUES (?,?,?,?,?,?) " +
    "ON DUPLICATE KEY UPDATE `user_sub`=VALUES(`user_sub`), `p256dh`=VALUES(`p256dh`), `auth`=VALUES(`auth`), " +
    "`platform`=VALUES(`platform`), `user_agent`=VALUES(`user_agent`), `last_seen_at`=CURRENT_TIMESTAMP",
    [userSub, String(endpoint).slice(0, 512), String(p256dh).slice(0, 255), String(auth).slice(0, 255),
     platform ? String(platform).slice(0, 32) : null, userAgent ? String(userAgent).slice(0, 255) : null]
  );
  return { ok: true };
}

export async function dbListPushSubscriptionsForUser(userSub) {
  if (!userSub) return [];
  const rows = await pool.query(
    "SELECT `endpoint`,`p256dh`,`auth` FROM `push_subscriptions` WHERE `user_sub` = ?",
    [userSub]
  );
  return rows.map(r => ({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }));
}

export async function dbDeletePushSubscription(endpoint, userSub = null) {
  if (!endpoint) return { ok: false, reason: "no_endpoint" };
  // Scope to the owner when provided (user-initiated unsubscribe); allow
  // owner-less delete for dead-endpoint pruning (404/410 from the push service).
  const sql = userSub
    ? "DELETE FROM `push_subscriptions` WHERE `endpoint` = ? AND `user_sub` = ?"
    : "DELETE FROM `push_subscriptions` WHERE `endpoint` = ?";
  const r = await pool.query(sql, userSub ? [endpoint, userSub] : [endpoint]);
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

export async function dbDeleteEventTime(id, { userSub = null, managedId = null } = {}) {
  if (!id) return { ok: false, reason: "no_id" };
  const { where, val } = _eventTimeOwner(userSub, managedId);
  const r = await pool.query("DELETE FROM `swimmer_event_times` WHERE `id`=? AND " + where, [Number(id), val]);
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

// Goal-first (then PR) target time per event for one course → { event: secs }.
// Fed into the engine at generate time so raceAnchor sets resolve real targets.
export async function dbResolveRaceGoals({ userSub = null, managedId = null, course = "25y" } = {}) {
  if (managedId == null && !userSub) return {};
  const all = await dbListEventTimes({ userSub, managedId });
  const byEvent = {};
  for (const r of all) {
    if (r.course !== course) continue;
    (byEvent[r.event] ||= {})[r.kind] = r.time_secs;
  }
  const out = {};
  for (const ev of Object.keys(byEvent)) {
    out[ev] = byEvent[ev].goal ?? byEvent[ev].pr ?? null;
  }
  return out;
}

// ── Scheduled workouts (I — Week-view planning, Phase 1) ─────────────
// Per-user. payload is the full workout snapshot (same shape as a history
// entry); completed_workout_id is stamped when /api/log-workout fires with
// scheduled_id, linking the schedule row to the canonical workout record.
// Self-only in v1 — coach-for-group fanout deferred to Phase 2.

function rowToScheduledWorkout(r) {
  let payload = r.payload;
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch (_) { payload = null; }
  }
  let intent_params = r.intent_params;
  if (typeof intent_params === "string") {
    try { intent_params = JSON.parse(intent_params); } catch (_) { intent_params = null; }
  }
  return {
    id:                    Number(r.id),
    user_sub:              r.user_sub,
    scheduled_date:        dateToYmd(r.scheduled_date),
    payload,
    intent_params,
    mode:                  (intent_params && !payload) ? "intent" : "payload",  // derived
    completed_workout_id:  r.completed_workout_id,
    // Reporting Phase A — practice completion stamping (migration 029).
    // completed_at NULL = still scheduled or skipped; non-null = marked done.
    completed_at:          dtToIso(r.completed_at),
    completed_by_sub:      r.completed_by_sub || null,
    notes:                 r.notes || null,
    facility_id:           r.facility_id != null ? Number(r.facility_id) : null,
    facility_name:         r.facility_name || null,    // from LEFT JOIN team_facilities (list/get)
    facility_course:       r.facility_course || null,
    created_at:            dtToIso(r.created_at),
    updated_at:            dtToIso(r.updated_at),
  };
}

function isYmd(s) { return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s); }

// Create a scheduled row in either payload mode (full pre-generated workout
// snapshot) OR intent mode (generator params only). Exactly one of payload /
// intentParams must be non-null — app-layer invariant per migration 025.
export async function dbCreateScheduledWorkout({ userSub, scheduledDate, payload = null, intentParams = null, notes = null, facilityId = null }) {
  if (!userSub) return { ok: false, reason: "no_user" };
  if (!isYmd(scheduledDate)) return { ok: false, reason: "bad_date" };
  if ((payload == null) === (intentParams == null)) {
    return { ok: false, reason: "specify_exactly_one_of_payload_or_intent" };
  }
  if (payload != null && typeof payload !== "object") return { ok: false, reason: "bad_payload" };
  if (intentParams != null && typeof intentParams !== "object") return { ok: false, reason: "bad_intent_params" };
  if (notes && String(notes).length > 500) return { ok: false, reason: "notes_too_long" };
  const fid = (facilityId == null || facilityId === "") ? null : Number(facilityId);
  const r = await pool.query(
    "INSERT INTO `scheduled_workouts` (`user_sub`, `scheduled_date`, `payload`, `intent_params`, `notes`, `facility_id`) " +
    "VALUES (?, ?, ?, ?, ?, ?)",
    [
      userSub, scheduledDate,
      payload != null ? JSON.stringify(payload) : null,
      intentParams != null ? JSON.stringify(intentParams) : null,
      notes || null,
      Number.isFinite(fid) ? fid : null,
    ]
  );
  return { ok: true, id: Number(r.insertId), mode: payload ? "payload" : "intent" };
}

export async function dbGetScheduledWorkout(id) {
  if (!id) return null;
  const rows = await pool.query(
    "SELECT sw.*, f.`name` AS facility_name, f.`course` AS facility_course " +
    "  FROM `scheduled_workouts` sw LEFT JOIN `team_facilities` f ON f.`id` = sw.`facility_id` " +
    " WHERE sw.`id` = ? LIMIT 1",
    [Number(id)]
  );
  return rows[0] ? rowToScheduledWorkout(rows[0]) : null;
}

// List schedule rows for a user in a date range (inclusive). startDate +
// endDate must be YYYY-MM-DD. If endDate omitted, defaults to startDate + 7d.
export async function dbListScheduledWorkouts(userSub, { startDate, endDate = null } = {}) {
  if (!userSub) return [];
  if (!isYmd(startDate)) return [];
  if (!endDate) {
    const d = new Date(startDate + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 7);
    endDate = d.toISOString().slice(0, 10);
  }
  if (!isYmd(endDate)) return [];
  const rows = await pool.query(
    "SELECT sw.*, f.`name` AS facility_name, f.`course` AS facility_course " +
    "  FROM `scheduled_workouts` sw LEFT JOIN `team_facilities` f ON f.`id` = sw.`facility_id` " +
    " WHERE sw.`user_sub` = ? AND sw.`scheduled_date` BETWEEN ? AND ? " +
    " ORDER BY sw.`scheduled_date` ASC, sw.`id` ASC",
    [userSub, startDate, endDate]
  );
  return rows.map(rowToScheduledWorkout);
}

// Update fields on a schedule row. Supports converting between modes:
//   * Setting payload (non-null) clears intent_params.
//   * Setting intent_params (non-null) clears payload.
//   * Setting payload AND intent_params in one patch is rejected.
// This is how an intent row becomes a payload row when the user clicks
// "▶ Generate" and confirms — server can stamp payload + clear intent_params
// atomically. The hydration path may also be used by Phase 2b group fanout.
export async function dbUpdateScheduledWorkout(id, callerSub, patch = {}) {
  if (!id || !callerSub) return { ok: false, reason: "missing_args" };
  const cur = await pool.query(
    "SELECT `user_sub` FROM `scheduled_workouts` WHERE `id` = ? LIMIT 1",
    [Number(id)]
  );
  if (!cur[0]) return { ok: false, reason: "not_found" };
  if (cur[0].user_sub !== callerSub) return { ok: false, reason: "not_owner" };
  // Can't set both modes in one patch.
  if ("payload" in patch && "intent_params" in patch && patch.payload != null && patch.intent_params != null) {
    return { ok: false, reason: "cannot_set_both_modes" };
  }
  const sets = [], vals = [];
  if ("scheduled_date" in patch) {
    if (!isYmd(patch.scheduled_date)) return { ok: false, reason: "bad_date" };
    sets.push("`scheduled_date` = ?"); vals.push(patch.scheduled_date);
  }
  if ("payload" in patch) {
    if (patch.payload != null && typeof patch.payload !== "object") return { ok: false, reason: "bad_payload" };
    sets.push("`payload` = ?"); vals.push(patch.payload != null ? JSON.stringify(patch.payload) : null);
    // Setting payload clears intent_params (mode transition).
    if (patch.payload != null && !("intent_params" in patch)) {
      sets.push("`intent_params` = NULL");
    }
  }
  if ("intent_params" in patch) {
    if (patch.intent_params != null && typeof patch.intent_params !== "object") return { ok: false, reason: "bad_intent_params" };
    sets.push("`intent_params` = ?"); vals.push(patch.intent_params != null ? JSON.stringify(patch.intent_params) : null);
    // Setting intent_params clears payload (mode transition).
    if (patch.intent_params != null && !("payload" in patch)) {
      sets.push("`payload` = NULL");
    }
  }
  if ("notes" in patch) {
    const n = patch.notes;
    if (n != null && String(n).length > 500) return { ok: false, reason: "notes_too_long" };
    sets.push("`notes` = ?"); vals.push(n || null);
  }
  if ("facility_id" in patch) {
    const fid = (patch.facility_id == null || patch.facility_id === "") ? null : Number(patch.facility_id);
    if (fid !== null && !Number.isFinite(fid)) return { ok: false, reason: "bad_facility_id" };
    sets.push("`facility_id` = ?"); vals.push(fid);
  }
  if (!sets.length) return { ok: true, affected: 0 };
  vals.push(Number(id));
  const r = await pool.query(
    `UPDATE \`scheduled_workouts\` SET ${sets.join(", ")} WHERE \`id\` = ?`,
    vals
  );
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

// Phase 2a — bulk-copy a week's worth of scheduled rows forward by 7 days.
// Preserves mode (payload-mode rows copy their payload; intent-mode rows
// copy their intent_params). Skips target dates that already have at least
// one row (no duplicates by default). Both startDate and the +7d target are
// inclusive of the 7 days starting at startDate.
export async function dbRepeatWeek(userSub, startDate) {
  if (!userSub) return { ok: false, reason: "no_user" };
  if (!isYmd(startDate)) return { ok: false, reason: "bad_date" };
  // Compute the source-week range [startDate, startDate+6] and the target
  // week range [startDate+7, startDate+13].
  function addDays(ymd, n) {
    const d = new Date(ymd + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  const srcStart = startDate;
  const srcEnd   = addDays(startDate, 6);
  const tgtStart = addDays(startDate, 7);
  const tgtEnd   = addDays(startDate, 13);
  // Pull source rows.
  const srcRows = await pool.query(
    "SELECT `scheduled_date`, `payload`, `intent_params`, `notes` " +
    "FROM `scheduled_workouts` " +
    "WHERE `user_sub` = ? AND `scheduled_date` BETWEEN ? AND ?",
    [userSub, srcStart, srcEnd]
  );
  if (srcRows.length === 0) return { ok: true, copied: 0, skipped: 0, reason: "source_empty" };
  // Build the set of target dates that already have rows.
  const tgtRows = await pool.query(
    "SELECT DISTINCT `scheduled_date` " +
    "FROM `scheduled_workouts` " +
    "WHERE `user_sub` = ? AND `scheduled_date` BETWEEN ? AND ?",
    [userSub, tgtStart, tgtEnd]
  );
  const tgtDates = new Set(tgtRows.map(r => dateToYmd(r.scheduled_date)));
  // For each source row, compute its target date (+7d). Skip if target
  // date already has rows (per-day skip, not per-row — if Mon target has
  // an existing row, all source Mon rows are skipped).
  let copied = 0, skipped = 0;
  for (const r of srcRows) {
    const srcDate = dateToYmd(r.scheduled_date);
    const tgtDate = addDays(srcDate, 7);
    if (tgtDates.has(tgtDate)) { skipped++; continue; }
    await pool.query(
      "INSERT INTO `scheduled_workouts` " +
      "(`user_sub`, `scheduled_date`, `payload`, `intent_params`, `notes`) " +
      "VALUES (?, ?, ?, ?, ?)",
      [
        userSub, tgtDate,
        r.payload,           // already serialized in DB
        r.intent_params,
        r.notes || null,
      ]
    );
    copied++;
  }
  return { ok: true, copied, skipped, source_week_start: srcStart, target_week_start: tgtStart };
}

export async function dbDeleteScheduledWorkout(id, callerSub) {
  if (!id || !callerSub) return { ok: false, reason: "missing_args" };
  const cur = await pool.query(
    "SELECT `user_sub` FROM `scheduled_workouts` WHERE `id` = ? LIMIT 1",
    [Number(id)]
  );
  if (!cur[0]) return { ok: false, reason: "not_found" };
  if (cur[0].user_sub !== callerSub) return { ok: false, reason: "not_owner" };
  const r = await pool.query("DELETE FROM `scheduled_workouts` WHERE `id` = ?", [Number(id)]);
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

// Stamp the completed_workout_id link when /api/log-workout fires with a
// scheduled_id. Validates the schedule row is owned by the caller and
// that completed_workout_id wasn't already set (preventing accidental
// re-stamps from retried POSTs). Called from server.js inside the
// log-workout handler; not exposed as its own route.
//
// I Phase 2b: when the linked row is intent-mode (payload IS NULL, intent_params
// IS NOT NULL), the link also flips the row to payload-mode using the
// new workout's payload snapshot. Required for coach-group-fanout Run flow,
// where /api/log-workout is the single round-trip that creates the workout +
// fanout AND finalizes the schedule row in one shot. workoutPayload is the
// JSON-serialized payload of the new workout (server passes entry).
export async function dbLinkCompletedToSchedule({ scheduledId, callerSub, workoutId, workoutPayload = null }) {
  if (!scheduledId || !callerSub || !workoutId) return { ok: false, reason: "missing_args" };
  const cur = await pool.query(
    "SELECT `user_sub`, `completed_workout_id`, `payload`, `intent_params` FROM `scheduled_workouts` WHERE `id` = ? LIMIT 1",
    [Number(scheduledId)]
  );
  if (!cur[0]) return { ok: false, reason: "schedule_not_found" };
  if (cur[0].user_sub !== callerSub) return { ok: false, reason: "not_owner" };
  if (cur[0].completed_workout_id) {
    return { ok: true, already_linked: true, completed_workout_id: cur[0].completed_workout_id };
  }
  const isIntentMode = cur[0].payload == null && cur[0].intent_params != null;
  if (isIntentMode && workoutPayload != null) {
    // Atomic: link + flip intent→payload.
    await pool.query(
      "UPDATE `scheduled_workouts` SET `completed_workout_id` = ?, `payload` = ?, `intent_params` = NULL WHERE `id` = ?",
      [workoutId, JSON.stringify(workoutPayload), Number(scheduledId)]
    );
    return { ok: true, linked: true, mode_flipped: true };
  }
  await pool.query(
    "UPDATE `scheduled_workouts` SET `completed_workout_id` = ? WHERE `id` = ?",
    [workoutId, Number(scheduledId)]
  );
  return { ok: true, linked: true };
}

// ── Practice attendance (Reporting v1 Phase A — migration 029) ───────
// Spec: REPORTING_SCOPE.md §3. Lightweight default-present model. No-roster
// cases (solo / masters with no group) still stamp completed_at on the
// schedule row but write no attendance rows.

// Mark a scheduled workout as completed and upsert the attendance roster
// in one transaction. attendance is an array of:
//   { swimmer_sub OR managed_id, present (bool), notes (string|null) }
// Caller is the coach who owns the scheduled workout (authz checked at
// route level). Same row may already exist (re-edit) — we UPSERT.
// Single source of truth for "which group is this scheduled workout tied to?".
// The association lives in intent_params.group_id (Phase 2b coach-fanout) or,
// for group workouts committed via the log-workout fanout, in
// payload.assignment_target.group_id. Accepts intent_params/payload either as
// parsed objects (dbGetScheduledWorkout normalizes them) OR as raw JSON strings
// (raw SELECTs hand back strings) — so every caller gets identical results.
// Previously this lookup was open-coded in three places with subtle drift
// (one site omitted the assignment_target fallback entirely).
export function extractScheduledWorkoutGroupId(sw) {
  if (!sw) return null;
  const parse = (v) => {
    if (v == null) return null;
    if (typeof v === "object") return v;
    try { return JSON.parse(v); } catch (_) { return null; }
  };
  for (const raw of [sw.intent_params, sw.payload]) {
    const v = parse(raw);
    if (!v || typeof v !== "object") continue;
    if (typeof v.group_id === "string" && v.group_id.startsWith("gr_")) return v.group_id;
    if (v.assignment_target && typeof v.assignment_target.group_id === "string" &&
        v.assignment_target.group_id.startsWith("gr_")) {
      return v.assignment_target.group_id;
    }
  }
  return null;
}

export async function dbCompleteScheduledWorkout({ scheduledId, callerSub, completedAt = null, attendance = [] }) {
  if (!scheduledId || !callerSub) return { ok: false, reason: "missing_args" };
  // Validate authz: owner OR any active coach in the workout's associated
  // group. Group association lives in intent_params.group_id or
  // payload.group_id (set by Phase 2b coach-fanout). Owner check is fast;
  // group-coach check requires JSON parse + an extra query — only done
  // if caller isn't the owner.
  const cur = await pool.query(
    "SELECT `user_sub`, `intent_params`, `payload` FROM `scheduled_workouts` WHERE `id` = ? LIMIT 1",
    [Number(scheduledId)]
  );
  if (!cur[0]) return { ok: false, reason: "schedule_not_found" };
  if (cur[0].user_sub !== callerSub) {
    // Try the looser group-coach path. cur[0] carries raw JSON-string columns
    // (this is a bare SELECT, not dbGetScheduledWorkout) — the shared helper
    // handles that.
    const groupId = extractScheduledWorkoutGroupId(cur[0]);
    if (!groupId) return { ok: false, reason: "not_owner" };
    const gc = await pool.query(
      "SELECT 1 FROM `group_coaches` WHERE `group_id` = ? AND `coach_sub` = ? AND `removed_at` IS NULL LIMIT 1",
      [groupId, callerSub]
    );
    if (!gc[0]) return { ok: false, reason: "not_owner_not_coach" };
  }
  // completedAt defaults to NOW if not provided. Allow backdating to any
  // past datetime — server doesn't bound this; route layer can clamp.
  const stampedAt = completedAt || new Date();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // 1. Stamp completion on the schedule row.
    await conn.query(
      "UPDATE `scheduled_workouts` SET `completed_at` = ?, `completed_by_sub` = ? WHERE `id` = ?",
      [stampedAt, callerSub, Number(scheduledId)]
    );
    // 2. Upsert attendance rows. INSERT...ON DUPLICATE KEY UPDATE keys on
    //    the (scheduled_workout_id, swimmer_sub) or (..., managed_id) unique
    //    indexes from migration 029. Skip rows that lack both targets.
    let writtenCount = 0;
    for (const a of attendance) {
      if (!a || (a.swimmer_sub == null && a.managed_id == null)) continue;
      if (a.swimmer_sub != null && a.managed_id != null) continue;  // XOR
      const present = a.present !== false;  // default true
      const notes   = a.notes && String(a.notes).length <= 500 ? String(a.notes) : null;
      if (a.swimmer_sub) {
        await conn.query(
          "INSERT INTO `practice_attendance` " +
          "(`scheduled_workout_id`, `swimmer_sub`, `present`, `notes`, `recorded_by_sub`) " +
          "VALUES (?, ?, ?, ?, ?) " +
          "ON DUPLICATE KEY UPDATE `present` = VALUES(`present`), `notes` = VALUES(`notes`), " +
          "  `recorded_by_sub` = VALUES(`recorded_by_sub`), `recorded_at` = CURRENT_TIMESTAMP",
          [Number(scheduledId), String(a.swimmer_sub), present ? 1 : 0, notes, callerSub]
        );
      } else {
        await conn.query(
          "INSERT INTO `practice_attendance` " +
          "(`scheduled_workout_id`, `managed_id`, `present`, `notes`, `recorded_by_sub`) " +
          "VALUES (?, ?, ?, ?, ?) " +
          "ON DUPLICATE KEY UPDATE `present` = VALUES(`present`), `notes` = VALUES(`notes`), " +
          "  `recorded_by_sub` = VALUES(`recorded_by_sub`), `recorded_at` = CURRENT_TIMESTAMP",
          [Number(scheduledId), Number(a.managed_id), present ? 1 : 0, notes, callerSub]
        );
      }
      writtenCount++;
    }
    await conn.commit();
    // attendance_count reflects rows actually upserted (skipped/invalid rows
    // excluded) — not the raw input length, so audit logs are accurate.
    return { ok: true, completed_at: stampedAt, attendance_count: writtenCount };
  } catch (e) {
    try { await conn.rollback(); } catch (_) {}
    throw e;
  } finally {
    conn.release();
  }
}

// Read attendance rows for a scheduled workout — used to re-render the
// "Edit attendance" modal after first save. Returns one row per recorded
// swimmer; rows for swimmers not in the roster anymore are still returned
// (caller is expected to reconcile against the current roster).
export async function dbGetPracticeAttendance(scheduledId) {
  if (!scheduledId) return [];
  const rows = await pool.query(
    "SELECT `id`, `swimmer_sub`, `managed_id`, `present`, `notes`, " +
    "       `recorded_by_sub`, `recorded_at` " +
    "FROM `practice_attendance` " +
    "WHERE `scheduled_workout_id` = ? " +
    "ORDER BY `id` ASC",
    [Number(scheduledId)]
  );
  return rows.map(r => ({
    id:               Number(r.id),
    swimmer_sub:      r.swimmer_sub,
    // managed_id is a STRING (ms_xxxxxx). Do NOT Number() it — that yields NaN
    // → null, dropping the swimmer's identity (broke coach-notes/RSVP/roll-call
    // for managed swimmers). Keep as-is.
    managed_id:       r.managed_id != null ? String(r.managed_id) : null,
    present:          !!r.present,
    notes:            r.notes || null,
    recorded_by_sub:  r.recorded_by_sub,
    recorded_at:      dtToIso(r.recorded_at),
  }));
}

// Lightweight check: is this sub an ACTIVE coach (primary or assistant) of
// this group? Used by routes that need the looser "owner or coach" authz
// for practice attendance + future reporting endpoints.
export async function dbIsActiveGroupCoach(groupId, coachSub) {
  if (!groupId || !coachSub) return false;
  const rows = await pool.query(
    "SELECT 1 FROM `group_coaches` WHERE `group_id` = ? AND `coach_sub` = ? AND `removed_at` IS NULL LIMIT 1",
    [groupId, coachSub]
  );
  return !!rows[0];
}

// Point-in-time roster for a group on a specific YYYY-MM-DD. Used by the
// "Mark practice done" modal to pre-render the roster as it existed on the
// scheduled date (not today's roster — a swimmer who joined later shouldn't
// appear retroactively in an earlier workout's attendance). Filter:
//   joined_at <= scheduledDate AND (left_at IS NULL OR left_at > scheduledDate)
// Mirrors dbListGroupMembers shape so the UI consumer is consistent.
export async function dbGetGroupRosterAsOf(groupId, scheduledDate) {
  if (!groupId || !isYmd(scheduledDate)) return [];
  // Boundary: treat scheduledDate as end-of-day for the join check, so a
  // swimmer who joined ON the scheduled date counts as present.
  const eod = scheduledDate + " 23:59:59";
  // Phase 4 Identity I-D slice 6: dual person JOIN (polymorphic target),
  // mirror of dbListGroupMembers from slice 2.
  const rows = await pool.query(
    "SELECT gm.`id`, gm.`member_swimmer_sub`, gm.`member_managed_id`, gm.`role`, " +
    "       gm.`joined_at`, gm.`left_at`, " +
    "       COALESCE(mp.`initials`, up.`initials`) AS initials, " +
    "       COALESCE(mp.`first_name`, up.`first_name`)    AS first_name, " +
    "       COALESCE(mp.`last_name`, up.`last_name`)      AS last_name, " +
    "       COALESCE(mp.`preferred_name`, up.`preferred_name`) AS preferred_name " +
    "FROM `group_members` gm " +
    "LEFT JOIN `coach_managed_swimmers` m ON m.`id` = gm.`member_managed_id` " +
    "LEFT JOIN `users` u                  ON u.`sub` = gm.`member_swimmer_sub` " +
    "LEFT JOIN `persons` mp               ON mp.`id` = m.`person_id` " +
    "LEFT JOIN `persons` up               ON up.`id` = u.`person_id` " +
    "WHERE gm.`group_id` = ? AND gm.`joined_at` <= ? AND (gm.`left_at` IS NULL OR gm.`left_at` > ?) " +
    "ORDER BY COALESCE(mp.`last_name`, up.`last_name`) ASC, COALESCE(mp.`first_name`, up.`first_name`) ASC",
    [groupId, eod, eod]
  );
  return rows.map(r => ({
    id:                  Number(r.id),
    member_swimmer_sub:  r.member_swimmer_sub,
    // member_managed_id is a STRING (ms_xxxxxx). Number() would NaN→null it and
    // drop the swimmer's identity. Keep the string.
    member_managed_id:   r.member_managed_id != null ? String(r.member_managed_id) : null,
    role:                r.role,
    joined_at:           dtToIso(r.joined_at),
    display_name:        displayNameInline({ first_name: r.first_name, last_name: r.last_name, preferred_name: r.preferred_name }),
    initials:            r.initials,
  }));
}

// ── Reporting v1 Phase B (R1-R3 coach reports) ────────────────────────
// Spec: REPORTING_SCOPE.md §2. Self-only — caller must be req.userSub.
// Optional groupId narrows to workouts tied to that specific group via
// payload.assignment_target.group_id (Phase 2b coach-fanout convention)
// or intent_params.group_id.

// Pull all workouts in range, optionally filtered by group association.
// Returns raw rows; aggregation happens in JS for portability + clarity.
async function _getOwnWorkoutsInRange(userSub, startYmd, endYmd, groupId = null) {
  if (!userSub || !isYmd(startYmd) || !isYmd(endYmd)) return [];
  const rows = await pool.query(
    "SELECT `id`, `saved_at`, `date_completed`, `type`, `pool_mode`, `total_yards`, `payload` " +
    "FROM `workouts` WHERE `user_sub` = ? AND `date_completed` BETWEEN ? AND ?",
    [userSub, startYmd, endYmd]
  );
  return rows.map(r => {
    let p = r.payload;
    if (typeof p === "string") { try { p = JSON.parse(p); } catch (_) { p = {}; } }
    return { ...r, payload: p || {} };
  }).filter(r => {
    if (!groupId) return true;
    const at = r.payload.assignment_target;
    return at && at.group_id === groupId;
  });
}

// R1 — Programming Mix. Returns aggregated counts. Charts not generated
// here; client renders raw numbers + tables per Cap'n's call to defer charts.
export async function dbGetProgrammingMix(userSub, { startYmd, endYmd, groupId = null } = {}) {
  const ws = await _getOwnWorkoutsInRange(userSub, startYmd, endYmd, groupId);
  const out = {
    workoutCount:  ws.length,
    totalYards:    0,
    yardsByType:   {},   // { im: N, distance: N, ... } — keyed by WORKOUT_TYPES.id
    yardsByStroke: {},   // { free: N, back: N, breast: N, fly: N, IM: N, choice: N, kick: N }
    sectionYards:  {},   // { warmup: N, main: N, cooldown: N, drill: N, recovery: N }
    sourceCounts:  { bank: 0, engine: 0, mix: 0, unknown: 0 },  // per-section counts
    bankLabels:    [],   // distinct labels used (for diversity counter)
  };
  const labelSet = new Set();
  for (const w of ws) {
    const yards = Number(w.total_yards) || 0;
    out.totalYards += yards;
    if (w.type) out.yardsByType[w.type] = (out.yardsByType[w.type] || 0) + yards;
    // Walk blocks for section + source + stroke + label aggregation.
    const blocks = Array.isArray(w.payload.blocks) ? w.payload.blocks : [];
    for (const b of blocks) {
      // Section yardage. Sum sets in this block.
      let blockYards = 0;
      const sets = Array.isArray(b.sets) ? b.sets : [];
      for (const s of sets) {
        const repYards = (Number(s.reps) || 1) * (Number(s.dist) || 0);
        blockYards += repYards;
        if (s.stroke) out.yardsByStroke[s.stroke] = (out.yardsByStroke[s.stroke] || 0) + repYards;
      }
      if (b.section) out.sectionYards[b.section] = (out.sectionYards[b.section] || 0) + blockYards;
      // Source: per-block bank/engine/mix. Engine blocks carry __engineMeta
      // (set by template-engine renderer); mix blocks may have a source field.
      let source = "unknown";
      if (b.__engineMeta) source = "engine";
      else if (b.source === "mix" || b.mix) source = "mix";
      else if (b.label || b.bankLabel || b.section) source = "bank";  // best-effort fallback
      out.sourceCounts[source] = (out.sourceCounts[source] || 0) + 1;
      // Bank label tracking — only for bank-sourced blocks with a label.
      if (source === "bank" && b.label) labelSet.add(b.label);
    }
  }
  out.bankLabels = Array.from(labelSet).sort();
  return out;
}

// MAAP attendance log (eval 2026-06-06 #3) — per-swimmer present/absent across a
// team's completed practices in a date range, for a safety/attendance record.
// scheduled_workouts store group_id inside intent_params/payload JSON (not a
// column) and are per-coach, so we date-range scan + JSON-filter to the team's
// groups (mirrors dbGetScheduleAdherence), then join attendance + identity.
export async function dbGetTeamAttendanceLog(teamId, { startYmd, endYmd } = {}) {
  if (!teamId || !isYmd(startYmd) || !isYmd(endYmd)) return [];
  const groups = await dbListGroupsForTeam(teamId, { includeArchived: true });
  const groupName = new Map(groups.map(g => [g.id, g.name]));
  const groupIds = new Set(groups.map(g => g.id));
  if (!groupIds.size) return [];
  const scheduled = await pool.query(
    "SELECT `id`, `scheduled_date`, `intent_params`, `payload` FROM `scheduled_workouts` " +
    "WHERE `scheduled_date` BETWEEN ? AND ? AND `completed_at` IS NOT NULL",
    [startYmd, endYmd]
  );
  const swMeta = new Map(); // scheduled_workout_id → { gid, date }
  for (const sw of scheduled) {
    let gid = null;
    for (const f of ["intent_params", "payload"]) {
      let v = sw[f]; if (typeof v === "string") { try { v = JSON.parse(v); } catch (_) { v = null; } }
      if (!v) continue;
      const cand = v.group_id || (v.assignment_target && v.assignment_target.group_id) || null;
      if (cand && groupIds.has(cand)) { gid = cand; break; }
    }
    if (gid) swMeta.set(Number(sw.id), { gid, date: dateToYmd(sw.scheduled_date) });
  }
  if (!swMeta.size) return [];
  const ids = [...swMeta.keys()];
  const ph = ids.map(() => "?").join(",");
  const arows = await pool.query(
    "SELECT pa.`scheduled_workout_id`, pa.`present`, " +
    "  COALESCE(up.`first_name`, mp.`first_name`) AS first_name, " +
    "  COALESCE(up.`last_name`, mp.`last_name`) AS last_name, " +
    "  COALESCE(up.`preferred_name`, mp.`preferred_name`) AS preferred_name, " +
    "  COALESCE(up.`initials`, mp.`initials`) AS initials " +
    "FROM `practice_attendance` pa " +
    // swimmer_sub and users.sub were created with different collations; force an
    // explicit common collation on both operands so the join doesn't error.
    "LEFT JOIN `users` u ON u.`sub` COLLATE utf8mb4_unicode_ci = pa.`swimmer_sub` COLLATE utf8mb4_unicode_ci " +
    "LEFT JOIN `coach_managed_swimmers` m ON m.`id` = pa.`managed_id` " +
    "LEFT JOIN `persons` up ON up.`id` = u.`person_id` " +
    "LEFT JOIN `persons` mp ON mp.`id` = m.`person_id` " +
    `WHERE pa.\`scheduled_workout_id\` IN (${ph})`,
    ids
  );
  const out = [];
  for (const r of arows) {
    const meta = swMeta.get(Number(r.scheduled_workout_id));
    if (!meta) continue;
    out.push({
      date:     meta.date,
      group:    groupName.get(meta.gid) || "",
      name:     displayNameInline({ first_name: r.first_name, last_name: r.last_name, preferred_name: r.preferred_name }) || r.initials || "",
      initials: r.initials || "",
      present:  !!r.present,
    });
  }
  out.sort((a, b) => a.date.localeCompare(b.date) || a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
  return out;
}

// R2 — Schedule Adherence. Per-group completion stats joining
// scheduled_workouts + practice_attendance + group_members for roster trend.
export async function dbGetScheduleAdherence(userSub, { startYmd, endYmd, groupId = null } = {}) {
  if (!userSub || !isYmd(startYmd) || !isYmd(endYmd)) {
    return { scheduledCount: 0, completedCount: 0, completionPct: 0, withAttendance: 0, withoutAttendance: 0, avgAttendancePct: 0, rosterTrend: null };
  }
  // 1. Scheduled rows owned by caller in range. Optional groupId narrows.
  let sql = "SELECT `id`, `intent_params`, `payload`, `completed_at` FROM `scheduled_workouts` " +
            "WHERE `user_sub` = ? AND `scheduled_date` BETWEEN ? AND ?";
  const args = [userSub, startYmd, endYmd];
  const scheduled = await pool.query(sql, args);
  const inGroup = (sw) => {
    if (!groupId) return true;
    for (const f of ["intent_params", "payload"]) {
      let v = sw[f];
      if (typeof v === "string") { try { v = JSON.parse(v); } catch (_) { v = null; } }
      if (!v) continue;
      if (v.group_id === groupId) return true;
      if (v.assignment_target && v.assignment_target.group_id === groupId) return true;
    }
    return false;
  };
  const filtered = scheduled.filter(inGroup);
  const completedRows = filtered.filter(s => s.completed_at != null);
  const completedIds  = completedRows.map(r => Number(r.id));
  // 2. Attendance rows for completed workouts in range.
  let attendanceByWorkout = new Map();   // scheduled_workout_id → [rows]
  if (completedIds.length > 0) {
    const placeholders = completedIds.map(() => "?").join(",");
    const arows = await pool.query(
      `SELECT \`scheduled_workout_id\`, \`present\` FROM \`practice_attendance\` ` +
      `WHERE \`scheduled_workout_id\` IN (${placeholders})`,
      completedIds
    );
    for (const r of arows) {
      const k = Number(r.scheduled_workout_id);
      if (!attendanceByWorkout.has(k)) attendanceByWorkout.set(k, []);
      attendanceByWorkout.get(k).push(r);
    }
  }
  let withAttendance = 0, withoutAttendance = 0, sumAttendancePct = 0;
  for (const c of completedRows) {
    const rows = attendanceByWorkout.get(Number(c.id)) || [];
    if (rows.length === 0) { withoutAttendance++; continue; }
    withAttendance++;
    const present = rows.filter(r => r.present === 1 || r.present === true).length;
    sumAttendancePct += rows.length > 0 ? (present / rows.length) * 100 : 0;
  }
  // 3. Roster trend — only meaningful when groupId set.
  let rosterTrend = null;
  if (groupId) {
    const r = await pool.query(
      "SELECT " +
      "  SUM(CASE WHEN `joined_at` BETWEEN ? AND ? THEN 1 ELSE 0 END) AS added, " +
      "  SUM(CASE WHEN `left_at`   BETWEEN ? AND ? THEN 1 ELSE 0 END) AS removed " +
      "FROM `group_members` WHERE `group_id` = ?",
      [startYmd + " 00:00:00", endYmd + " 23:59:59", startYmd + " 00:00:00", endYmd + " 23:59:59", groupId]
    );
    rosterTrend = { added: Number(r[0]?.added || 0), removed: Number(r[0]?.removed || 0) };
  }
  return {
    scheduledCount:     filtered.length,
    completedCount:     completedRows.length,
    completionPct:      filtered.length > 0 ? (completedRows.length / filtered.length) * 100 : 0,
    withAttendance, withoutAttendance,
    avgAttendancePct:   withAttendance > 0 ? sumAttendancePct / withAttendance : 0,
    rosterTrend,
  };
}

// R5 — Platform Health (Reporting v1 Phase D, admin-gated). Active coaches
// by recency, workouts/week-per-team trended table, feature adoption %s,
// engine fallback rate trended weekly.
export async function dbGetPlatformHealth({ startYmd, endYmd, teamId = null } = {}) {
  if (!isYmd(startYmd) || !isYmd(endYmd)) {
    return { activeCoaches: { d7: 0, d14: 0, d30: 0 }, weeklyByTeam: [], featureAdoption: {}, fallbackTrend: [] };
  }
  const today = new Date();
  const cutoffYmd = (daysBack) => { const d = new Date(today); d.setUTCDate(d.getUTCDate() - daysBack); return d.toISOString().slice(0, 10); };
  // 1. Active coaches: distinct coach subs who generated a workout within
  //    7 / 14 / 30 days. Joins workouts to team_coaches to filter to actual
  //    coaches (not all users). Optional team filter narrows.
  const teamJoin = teamId ? "JOIN `team_coaches` tc ON tc.`coach_sub` = w.`user_sub` AND tc.`team_id` = ? AND tc.`removed_at` IS NULL " : "JOIN `team_coaches` tc ON tc.`coach_sub` = w.`user_sub` AND tc.`removed_at` IS NULL ";
  const teamArg = teamId ? [teamId] : [];
  const activeCoaches = {};
  for (const days of [7, 14, 30]) {
    const r = await pool.query(
      `SELECT COUNT(DISTINCT w.\`user_sub\`) AS n FROM \`workouts\` w ${teamJoin} WHERE w.\`date_completed\` >= ?`,
      [...teamArg, cutoffYmd(days)]
    );
    activeCoaches["d" + days] = Number(r[0]?.n || 0);
  }
  // 2. Workouts per week per team — bucket by ISO week (Mon start) over
  //    the selected range. Output: [{ weekStart: YYYY-MM-DD, teams: {teamId: count}, total }]
  const wRows = await pool.query(
    `SELECT w.\`date_completed\`, COALESCE(tc.\`team_id\`, '__none__') AS team_id, COUNT(*) AS n ` +
    `FROM \`workouts\` w ` +
    `LEFT JOIN \`team_coaches\` tc ON tc.\`coach_sub\` = w.\`user_sub\` AND tc.\`removed_at\` IS NULL ` +
    `WHERE w.\`date_completed\` BETWEEN ? AND ? ` +
    (teamId ? `AND tc.\`team_id\` = ? ` : ``) +
    `GROUP BY w.\`date_completed\`, tc.\`team_id\``,
    teamId ? [startYmd, endYmd, teamId] : [startYmd, endYmd]
  );
  // Bucket by week-start (Monday). Maintain insertion order.
  const weekBuckets = new Map();   // weekStart YMD -> { teams: {id:n}, total }
  const ymdToWeekStart = (d) => {
    const x = new Date(d + "T00:00:00Z");
    const day = x.getUTCDay();   // 0=Sun
    const diff = day === 0 ? -6 : 1 - day;
    x.setUTCDate(x.getUTCDate() + diff);
    return x.toISOString().slice(0, 10);
  };
  for (const r of wRows) {
    if (!r.date_completed) continue;
    const dateStr = (typeof r.date_completed === "string") ? r.date_completed : r.date_completed.toISOString().slice(0, 10);
    const wk = ymdToWeekStart(dateStr);
    if (!weekBuckets.has(wk)) weekBuckets.set(wk, { weekStart: wk, teams: {}, total: 0 });
    const b = weekBuckets.get(wk);
    b.teams[r.team_id] = (b.teams[r.team_id] || 0) + Number(r.n);
    b.total += Number(r.n);
  }
  const weeklyByTeam = Array.from(weekBuckets.values()).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  // 3. Feature adoption — counts over the whole range.
  //    Walk each workout's payload to detect engine/mix usage + multi-lane.
  const allW = await pool.query(
    "SELECT `payload` FROM `workouts` WHERE `date_completed` BETWEEN ? AND ?",
    [startYmd, endYmd]
  );
  let usedEngine = 0, usedMix = 0, usedMultiLane = 0, total = allW.length, withFallback = 0;
  for (const row of allW) {
    let p = row.payload;
    if (typeof p === "string") { try { p = JSON.parse(p); } catch (_) { p = {}; } }
    if (!p || typeof p !== "object") continue;
    const blocks = Array.isArray(p.blocks) ? p.blocks : [];
    let hasEngine = false, hasMix = false, hasFallback = false;
    for (const b of blocks) {
      if (b.__engineMeta) hasEngine = true;
      if (b.source === "mix" || b.mix) hasMix = true;
      if (b.__laneFitFallback) hasFallback = true;
    }
    if (hasEngine) usedEngine++;
    if (hasMix) usedMix++;
    if (p.multi_lane && p.multi_lane.enabled) usedMultiLane++;
    if (hasFallback) withFallback++;
  }
  // Has-favorites / has-disfavorites — count distinct user_subs in each table.
  const favU = await pool.query("SELECT COUNT(DISTINCT `user_sub`) AS n FROM `favorites`");
  const disU = await pool.query("SELECT COUNT(DISTINCT `user_sub`) AS n FROM `disfavorites`");
  const allUsers = await pool.query("SELECT COUNT(*) AS n FROM `users`");
  const featureAdoption = {
    totalWorkouts:     total,
    enginePct:         total > 0 ? (usedEngine    / total) * 100 : 0,
    mixPct:            total > 0 ? (usedMix       / total) * 100 : 0,
    multiLanePct:      total > 0 ? (usedMultiLane / total) * 100 : 0,
    fallbackPct:       total > 0 ? (withFallback  / total) * 100 : 0,
    usersWithFavs:     Number(favU[0]?.n || 0),
    usersWithDis:      Number(disU[0]?.n || 0),
    totalUsers:        Number(allUsers[0]?.n || 0),
  };
  // 4. Fallback trend — per week, fallback workouts / total workouts.
  const fallbackTrend = [];
  for (const b of weeklyByTeam) {
    // Don't have per-week fallback aggregated; recompute from the per-week
    // bucket by re-scanning workouts in that week. Cheap enough for the
    // small ranges we ship today (week/month/quarter/season).
    const fbRows = await pool.query(
      "SELECT `payload` FROM `workouts` WHERE `date_completed` BETWEEN ? AND DATE_ADD(?, INTERVAL 6 DAY)",
      [b.weekStart, b.weekStart]
    );
    let fb = 0;
    for (const r of fbRows) {
      let p = r.payload;
      if (typeof p === "string") { try { p = JSON.parse(p); } catch (_) { p = null; } }
      const blocks = p && Array.isArray(p.blocks) ? p.blocks : [];
      if (blocks.some(bl => bl.__laneFitFallback)) fb++;
    }
    fallbackTrend.push({ weekStart: b.weekStart, totalWorkouts: fbRows.length, fallbackCount: fb, fallbackPct: fbRows.length > 0 ? (fb / fbRows.length) * 100 : 0 });
  }
  return { activeCoaches, weeklyByTeam, featureAdoption, fallbackTrend };
}

// R6 — Curation & Support Activity (Reporting v1 Phase D, admin-gated).
// Simplified curation-health proxy: count propagating disfavor items per
// team. Plus impersonation activity rollup + per-team audit rollup.
export async function dbGetCurationSupport({ startYmd, endYmd } = {}) {
  if (!isYmd(startYmd) || !isYmd(endYmd)) {
    return { curationByTeam: [], impersonationByActor: [], auditByTeam: [] };
  }
  // 1. Per-team propagating disfavor count. Across all team's coaches,
  //    sum label-disfavorites + set-disfavorites + engine-disfavorites
  //    (engine_disfavorites lives in settings.extra JSON).
  // NOTE: team_coaches.coach_sub was created with collation utf8mb4_general_ci
  // (legacy migration default); disfavorites/user_disfavor_sets/settings/
  // audit_events all use user_sub utf8mb4_unicode_ci. Explicit COLLATE on
  // the team_coaches side prevents the "Illegal mix of collations" runtime
  // error. Fix applied 2026-05-27 after Cap'n hit it in R6 Curation Support.
  const teamCoachRows = await pool.query(
    "SELECT t.`id` AS team_id, t.`name` AS team_name, " +
    "       (SELECT COUNT(*) FROM `disfavorites` d JOIN `team_coaches` tc2 ON tc2.`coach_sub` COLLATE utf8mb4_unicode_ci = d.`user_sub` AND tc2.`team_id` = t.`id` AND tc2.`removed_at` IS NULL) AS label_count, " +
    "       (SELECT COUNT(*) FROM `user_disfavor_sets` ds JOIN `team_coaches` tc3 ON tc3.`coach_sub` COLLATE utf8mb4_unicode_ci = ds.`user_sub` AND tc3.`team_id` = t.`id` AND tc3.`removed_at` IS NULL) AS set_count, " +
    "       (SELECT COUNT(DISTINCT tc4.`coach_sub`) FROM `team_coaches` tc4 WHERE tc4.`team_id` = t.`id` AND tc4.`removed_at` IS NULL) AS coach_count " +
    "FROM `teams` t WHERE t.`archived` = 0"
  );
  // Engine disfavorites count requires per-coach JSON parse. Pull once.
  const allCoachSettings = await pool.query(
    "SELECT s.`user_sub`, s.`extra` FROM `settings` s " +
    "WHERE s.`user_sub` IN (SELECT DISTINCT `coach_sub` COLLATE utf8mb4_unicode_ci FROM `team_coaches` WHERE `removed_at` IS NULL)"
  );
  const engineDisCountBySub = new Map();
  for (const r of allCoachSettings) {
    let ex = r.extra;
    if (typeof ex === "string") { try { ex = JSON.parse(ex); } catch (_) { ex = null; } }
    if (ex && Array.isArray(ex.engine_disfavorites)) {
      engineDisCountBySub.set(r.user_sub, ex.engine_disfavorites.length);
    }
  }
  const teamCoachMap = await pool.query(
    "SELECT `team_id`, `coach_sub` FROM `team_coaches` WHERE `removed_at` IS NULL"
  );
  const engineByTeam = new Map();
  for (const r of teamCoachMap) {
    const n = engineDisCountBySub.get(r.coach_sub) || 0;
    engineByTeam.set(r.team_id, (engineByTeam.get(r.team_id) || 0) + n);
  }
  const curationByTeam = teamCoachRows.map(r => ({
    team_id:        r.team_id,
    team_name:      r.team_name,
    coach_count:    Number(r.coach_count),
    label_count:    Number(r.label_count),
    set_count:      Number(r.set_count),
    engine_count:   engineByTeam.get(r.team_id) || 0,
    total_propagating: Number(r.label_count) + Number(r.set_count) + (engineByTeam.get(r.team_id) || 0),
  })).sort((a, b) => b.total_propagating - a.total_propagating);
  // 2. Impersonation activity — sessions in range, grouped by admin_sub.
  const impRows = await pool.query(
    "SELECT `admin_sub`, COUNT(*) AS sessions, " +
    "       AVG(TIMESTAMPDIFF(MINUTE, `started_at`, COALESCE(`ended_at`, `expires_at`))) AS avg_min, " +
    "       COUNT(DISTINCT `target_sub`) AS distinct_targets " +
    "FROM `impersonation_sessions` WHERE `started_at` BETWEEN ? AND ? GROUP BY `admin_sub`",
    [startYmd + " 00:00:00", endYmd + " 23:59:59"]
  );
  const impersonationByActor = impRows.map(r => ({
    admin_sub:        r.admin_sub,
    sessions:         Number(r.sessions),
    avg_minutes:      Math.round(Number(r.avg_min || 0) * 10) / 10,
    distinct_targets: Number(r.distinct_targets),
  })).sort((a, b) => b.sessions - a.sessions);
  // 3. Per-team audit rollup. Map user_sub → team_id via team_coaches,
  //    then count audit_events for each. Limited to events with user_sub
  //    (anon events like rate_limit.hit pre-auth are excluded).
  const auditRows = await pool.query(
    "SELECT tc.`team_id`, ae.`event_type`, COUNT(*) AS n " +
    "FROM `audit_events` ae " +
    "JOIN `team_coaches` tc ON tc.`coach_sub` COLLATE utf8mb4_unicode_ci = ae.`user_sub` AND tc.`removed_at` IS NULL " +
    "WHERE ae.`created_at` BETWEEN ? AND ? " +
    "GROUP BY tc.`team_id`, ae.`event_type` " +
    "ORDER BY tc.`team_id`, n DESC",
    [startYmd + " 00:00:00", endYmd + " 23:59:59"]
  );
  const auditByTeamMap = new Map();
  for (const r of auditRows) {
    if (!auditByTeamMap.has(r.team_id)) auditByTeamMap.set(r.team_id, { team_id: r.team_id, events: [], total: 0 });
    const b = auditByTeamMap.get(r.team_id);
    b.events.push({ event_type: r.event_type, count: Number(r.n) });
    b.total += Number(r.n);
  }
  const auditByTeam = Array.from(auditByTeamMap.values()).sort((a, b) => b.total - a.total);
  return { curationByTeam, impersonationByActor, auditByTeam };
}

// R4 — Program Recap (Reporting v1 Phase C). Solo/masters report — no
// group dimension. Uses the same own-workouts-in-range query as R1 but
// adds template usage counts, multi-lane fit success rate, and a 30-day
// sliding window check for stroke gaps.
export async function dbGetProgramRecap(userSub, { startYmd, endYmd } = {}) {
  const ws = await _getOwnWorkoutsInRange(userSub, startYmd, endYmd, null);
  const out = {
    workoutCount:    ws.length,
    totalYards:      0,
    yardsByType:     {},
    yardsByStroke:   {},
    templateCounts:  {},   // { template_id: N } — engine templates only (bank labels in mostUsedLabels)
    labelCounts:     {},   // { label: N } — bank labels
    multiLane: { generated: 0, withoutFallback: 0, successPct: 0 },
    strokeGaps: [],        // list of {windowStart, windowEnd, missingStrokes: [...]} for 30-day windows
  };
  const STROKES_REQUIRED = ["free", "back", "breast", "fly"];
  // Workouts indexed by date for the sliding-window check below.
  const wsByDate = [];
  for (const w of ws) {
    const yards = Number(w.total_yards) || 0;
    out.totalYards += yards;
    if (w.type) out.yardsByType[w.type] = (out.yardsByType[w.type] || 0) + yards;
    // Track strokes touched by this workout — used for sliding-window gap check.
    const strokesInWorkout = new Set();
    const blocks = Array.isArray(w.payload.blocks) ? w.payload.blocks : [];
    let workoutUsedMultiLane = false;
    let workoutHadFallback   = false;
    for (const b of blocks) {
      const sets = Array.isArray(b.sets) ? b.sets : [];
      for (const s of sets) {
        const repYards = (Number(s.reps) || 1) * (Number(s.dist) || 0);
        if (s.stroke) {
          out.yardsByStroke[s.stroke] = (out.yardsByStroke[s.stroke] || 0) + repYards;
          strokesInWorkout.add(s.stroke);
        }
      }
      // Engine block? Capture template_id for usage counts.
      if (b.__engineMeta && b.__engineMeta.template_id) {
        const tid = b.__engineMeta.template_id;
        out.templateCounts[tid] = (out.templateCounts[tid] || 0) + 1;
      }
      // Bank block? Capture label.
      if (!b.__engineMeta && b.label) {
        out.labelCounts[b.label] = (out.labelCounts[b.label] || 0) + 1;
      }
      if (b.__laneFitFallback) workoutHadFallback = true;
    }
    if (w.payload.multi_lane && w.payload.multi_lane.enabled) {
      workoutUsedMultiLane = true;
      out.multiLane.generated++;
      if (!workoutHadFallback) out.multiLane.withoutFallback++;
    }
    wsByDate.push({ date: w.date_completed, strokes: strokesInWorkout });
  }
  out.multiLane.successPct = out.multiLane.generated > 0
    ? (out.multiLane.withoutFallback / out.multiLane.generated) * 100
    : 100;  // vacuous true when no multi-lane workouts
  // 4-stroke balance gap check. Slide a 30-day window through the range
  // in 7-day steps. For each window, union the strokes touched; report
  // windows that miss any of free/back/breast/fly.
  if (isYmd(startYmd) && isYmd(endYmd)) {
    const startD = new Date(startYmd + "T00:00:00Z");
    const endD   = new Date(endYmd   + "T00:00:00Z");
    const ymd    = (d) => d.toISOString().slice(0, 10);
    const addDays = (d, n) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };
    let cursor = new Date(startD);
    while (cursor <= endD) {
      const windowEnd   = addDays(cursor, 29);
      const windowEndYmd = ymd(windowEnd);
      const windowStartYmd = ymd(cursor);
      const strokes = new Set();
      for (const w of wsByDate) {
        if (!w.date) continue;
        const d = (typeof w.date === "string") ? w.date : (w.date.toISOString ? w.date.toISOString().slice(0, 10) : null);
        if (d && d >= windowStartYmd && d <= windowEndYmd) {
          for (const s of w.strokes) strokes.add(s);
        }
      }
      const missing = STROKES_REQUIRED.filter(s => !strokes.has(s));
      if (missing.length > 0) {
        out.strokeGaps.push({ windowStart: windowStartYmd, windowEnd: windowEndYmd, missingStrokes: missing });
      }
      cursor = addDays(cursor, 7);
      if (cursor > endD) break;
    }
  }
  // Sort template + label counts. Cap at top 10 + bottom 10 each for response size.
  const sortDesc = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]);
  out.mostUsedTemplates  = sortDesc(out.templateCounts).slice(0, 10);
  out.leastUsedTemplates = sortDesc(out.templateCounts).slice(-10).reverse();
  out.mostUsedLabels     = sortDesc(out.labelCounts).slice(0, 10);
  out.leastUsedLabels    = sortDesc(out.labelCounts).slice(-10).reverse();
  // Don't ship the raw count maps to the client — top/bottom slices suffice.
  delete out.templateCounts;
  delete out.labelCounts;
  return out;
}

// R3 — Curation Log. Bank labels + set IDs + engine tuples the user has
// touched in the range, with timestamps where available. Engine tuples
// live in settings.extra JSON without per-item timestamps — included as
// current state (no date filter on those).
export async function dbGetCurationLog(userSub, { startYmd, endYmd } = {}) {
  if (!userSub || !isYmd(startYmd) || !isYmd(endYmd)) {
    return { bankLabels: { favorites: [], disfavorites: [] }, sets: { favorites: [], disfavorites: [] }, engine: { favorites: [], disfavorites: [] }, psc: [] };
  }
  const range = [userSub, startYmd + " 00:00:00", endYmd + " 23:59:59"];
  const favLabels = await pool.query(
    "SELECT `label`, `created_at` FROM `favorites` WHERE `user_sub` = ? AND `created_at` BETWEEN ? AND ? ORDER BY `created_at` DESC",
    range
  );
  const disLabels = await pool.query(
    "SELECT `label`, `created_at` FROM `disfavorites` WHERE `user_sub` = ? AND `created_at` BETWEEN ? AND ? ORDER BY `created_at` DESC",
    range
  );
  const favSets = await pool.query(
    "SELECT `set_id`, `created_at` FROM `user_favorite_sets` WHERE `user_sub` = ? AND `created_at` BETWEEN ? AND ? ORDER BY `created_at` DESC",
    range
  );
  const disSets = await pool.query(
    "SELECT `set_id`, `created_at` FROM `user_disfavor_sets` WHERE `user_sub` = ? AND `created_at` BETWEEN ? AND ? ORDER BY `created_at` DESC",
    range
  );
  // Engine fav/disfav live in settings.extra JSON — current state only,
  // no per-item timestamps available. Return as-is for v1.
  const settings = await dbGetSettings(userSub);
  const engineFav = Array.isArray(settings?.engine_favorites) ? settings.engine_favorites : [];
  const engineDis = Array.isArray(settings?.engine_disfavorites) ? settings.engine_disfavorites : [];
  // Phase 3 PSC slice 2 — psc.set + psc.remove + psc.expire audit events
  // for the coach (events they set/removed). Auto-expiry rows have NULL
  // user_sub since the cron isn't an interactive user — captured at the
  // coach who SET the constraint via details.set_by_coach_sub (slice-3
  // todo: emit psc.expire with the original coach as user_sub).
  // v1 covers psc.set + psc.remove (both attribute to the actor).
  const pscRows = await pool.query(
    "SELECT `event_type`, `created_at`, `details` FROM `audit_events` " +
    "WHERE `user_sub` = ? AND `event_type` IN ('psc.set','psc.remove') " +
    "AND `created_at` BETWEEN ? AND ? ORDER BY `created_at` DESC",
    range
  );
  const psc = pscRows.map(r => {
    let d = r.details;
    if (typeof d === "string") { try { d = JSON.parse(d); } catch (_) { d = {}; } }
    return {
      event_type:      r.event_type,
      at:              dtToIso(r.created_at),
      constraint_id:   d?.constraint_id ?? null,
      swimmer_sub:     d?.swimmer_sub   ?? null,
      managed_id:      d?.managed_id    ?? null,
      constraint_type: d?.constraint_type ?? null,
      value_num:       d?.value_num     ?? null,
      value_str:       d?.value_str     ?? null,
      expires_at:      d?.expires_at    ?? null,
    };
  });
  // Team Curation v1 slice 6 (2026-05-27): team.* audit events for every
  // team the viewing coach is on. Per TEAM_CURATION_SCOPE.md §3.7. Scope
  // is "all team.* events on teams I'm a coach on" — not just events I
  // personally wrote — so co-owners + admins can see what each other
  // changed. Filter via JSON_EXTRACT on details.team_id.
  let team = [];
  const myTeamRows = await pool.query(
    "SELECT `team_id` FROM `team_coaches` WHERE `coach_sub` = ? AND `removed_at` IS NULL",
    [userSub]
  );
  if (myTeamRows.length > 0) {
    const teamIds = myTeamRows.map(r => r.team_id);
    const tPh = teamIds.map(() => "?").join(",");
    const TEAM_EVENT_TYPES = ["team.fav.add", "team.fav.remove", "team.disfav.add", "team.disfav.remove", "team.default.update", "team.default.apply_to_roster"];
    const ePh = TEAM_EVENT_TYPES.map(() => "?").join(",");
    const teamRows = await pool.query(
      `SELECT event_type, user_sub, created_at, details FROM audit_events ` +
      `WHERE event_type IN (${ePh}) ` +
      `AND created_at BETWEEN ? AND ? ` +
      `AND JSON_UNQUOTE(JSON_EXTRACT(details, '$.team_id')) IN (${tPh}) ` +
      `ORDER BY created_at DESC`,
      [...TEAM_EVENT_TYPES, startYmd + " 00:00:00", endYmd + " 23:59:59", ...teamIds]
    );
    team = teamRows.map(r => {
      let d = r.details;
      if (typeof d === "string") { try { d = JSON.parse(d); } catch (_) { d = {}; } }
      return {
        event_type: r.event_type,
        actor_sub:  r.user_sub,
        at:         dtToIso(r.created_at),
        team_id:    d?.team_id ?? null,
        label:      d?.label   ?? null,                                       // for fav.add/remove + disfav.add/remove
        field:      d?.field   ?? null,                                       // for default.update + apply_to_roster
        value:      d?.value   ?? null,                                       // for default.update + apply_to_roster
        count:      d?.count   ?? null,                                       // for apply_to_roster
        role:       d?.role    ?? null,                                       // actor's role at write-time
      };
    });
  }

  return {
    bankLabels: {
      favorites:    favLabels.map(r => ({ label: r.label, at: dtToIso(r.created_at) })),
      disfavorites: disLabels.map(r => ({ label: r.label, at: dtToIso(r.created_at) })),
    },
    sets: {
      favorites:    favSets.map(r => ({ set_id: r.set_id, at: dtToIso(r.created_at) })),
      disfavorites: disSets.map(r => ({ set_id: r.set_id, at: dtToIso(r.created_at) })),
    },
    engine: {
      favorites:    engineFav,   // [{ template_id, stroke }]
      disfavorites: engineDis,
    },
    psc,
    team,
  };
}

// ── Lane plans (Stage 3 / R-E) ────────────────────────────────────────
// Per scope §7 + decision #14. Persistent reusable per-group lane configs.
// plan_data JSON shape:
//   { lanes: [ { idx, label, target_pace_100, members: [{swimmer_sub|managed_id}, ...] } ] }
// Stale member refs tolerated; UI shows "(removed)" and fanout skips them.
// Plan is authoritative member list for generation — members not in plan = no assignment.

function genLanePlanId() {
  const n = crypto.randomBytes(4).readUInt32BE(0);
  return "lp_" + n.toString(36).padStart(6, "0").slice(-6);
}

function rowToLanePlan(r) {
  let plan_data = r.plan_data;
  // mariadb driver may return JSON column as parsed object OR as string;
  // normalize to object for consistent client/server consumption.
  if (typeof plan_data === "string") {
    try { plan_data = JSON.parse(plan_data); } catch (_) { plan_data = { lanes: [] }; }
  }
  return {
    id:         r.id,
    group_id:   r.group_id,
    name:       r.name,
    is_default: !!r.is_default,
    plan_data,
    archived:   !!r.archived,
    created_at: dtToIso(r.created_at),
    updated_at: dtToIso(r.updated_at),
  };
}

// Light shape-validation on plan_data. Doesn't deeply verify member refs
// (those are tolerated stale) — just structural sanity.
function validatePlanData(pd) {
  if (!pd || typeof pd !== "object") return "plan_data must be an object";
  if (!Array.isArray(pd.lanes)) return "plan_data.lanes must be an array";
  for (let i = 0; i < pd.lanes.length; i++) {
    const l = pd.lanes[i];
    if (!l || typeof l !== "object") return `lane[${i}] must be an object`;
    if (typeof l.label !== "string" || l.label.length > 40) return `lane[${i}].label must be a string ≤40 chars`;
    if (l.target_pace_100 && (typeof l.target_pace_100 !== "string" || l.target_pace_100.length > 8))
      return `lane[${i}].target_pace_100 must be a string ≤8 chars`;
    if (!Array.isArray(l.members)) return `lane[${i}].members must be an array`;
    for (let j = 0; j < l.members.length; j++) {
      const m = l.members[j];
      if (!m || typeof m !== "object") return `lane[${i}].members[${j}] must be an object`;
      if ((m.swimmer_sub == null) === (m.managed_id == null))
        return `lane[${i}].members[${j}] must specify exactly one of swimmer_sub or managed_id`;
    }
  }
  return null;
}

export async function dbCreateGroupLanePlan({ groupId, name, is_default = false, plan_data }) {
  if (!groupId) throw new Error("groupId required");
  if (!name || typeof name !== "string" || !name.trim()) throw new Error("name required");
  if (name.length > 120) throw new Error("name max 120 chars");
  const err = validatePlanData(plan_data);
  if (err) throw new Error(err);
  const id = genLanePlanId();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // If this plan is being created as default, clear any existing default
    // for the group first (only one default at a time).
    if (is_default) {
      await conn.query(
        "UPDATE `group_lane_plans` SET `is_default` = 0 WHERE `group_id` = ? AND `is_default` = 1",
        [groupId]
      );
    }
    await conn.query(
      "INSERT INTO `group_lane_plans` (`id`, `group_id`, `name`, `is_default`, `plan_data`) VALUES (?, ?, ?, ?, ?)",
      [id, groupId, name.trim(), is_default ? 1 : 0, JSON.stringify(plan_data)]
    );
    await conn.commit();
    return { ok: true, id };
  } catch (e) {
    try { await conn.rollback(); } catch (_) {}
    throw e;
  } finally {
    conn.release();
  }
}

export async function dbGetGroupLanePlan(id) {
  if (!id) return null;
  const rows = await pool.query(
    "SELECT `id`, `group_id`, `name`, `is_default`, `plan_data`, `archived`, `created_at`, `updated_at` " +
    "FROM `group_lane_plans` WHERE `id` = ?",
    [id]
  );
  if (!rows[0]) return null;
  return rowToLanePlan(rows[0]);
}

export async function dbListGroupLanePlans(groupId, { includeArchived = false } = {}) {
  if (!groupId) return [];
  const whereArch = includeArchived ? "" : "AND `archived` = 0 ";
  const rows = await pool.query(
    "SELECT `id`, `group_id`, `name`, `is_default`, `plan_data`, `archived`, `created_at`, `updated_at` " +
    "FROM `group_lane_plans` WHERE `group_id` = ? " + whereArch +
    "ORDER BY `is_default` DESC, `name` ASC",
    [groupId]
  );
  return rows.map(rowToLanePlan);
}

export async function dbUpdateGroupLanePlan(id, patch = {}) {
  if (!id) return { ok: false, reason: "no_id" };
  const sets = [], vals = [];
  if ("name" in patch) {
    if (typeof patch.name !== "string" || !patch.name.trim()) return { ok: false, reason: "bad_name" };
    if (patch.name.length > 120) return { ok: false, reason: "name_too_long" };
    sets.push("`name` = ?");
    vals.push(patch.name.trim());
  }
  if ("plan_data" in patch) {
    const err = validatePlanData(patch.plan_data);
    if (err) return { ok: false, reason: err };
    sets.push("`plan_data` = ?");
    vals.push(JSON.stringify(patch.plan_data));
  }
  // is_default handled via dbSetDefaultLanePlan (transactional clear+set).
  if (!sets.length) return { ok: true, affected: 0 };
  vals.push(id);
  const r = await pool.query(
    `UPDATE \`group_lane_plans\` SET ${sets.join(", ")} WHERE \`id\` = ?`,
    vals
  );
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

export async function dbArchiveGroupLanePlan(id, archived = true) {
  if (!id) return { ok: false, reason: "no_id" };
  // Archiving the default clears its default flag (a plan can't be the
  // default AND archived).
  const r = await pool.query(
    "UPDATE `group_lane_plans` SET `archived` = ?, `is_default` = CASE WHEN ? = 1 THEN 0 ELSE `is_default` END " +
    "WHERE `id` = ?",
    [archived ? 1 : 0, archived ? 1 : 0, id]
  );
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

export async function dbSetDefaultLanePlan(groupId, planId) {
  if (!groupId || !planId) return { ok: false, reason: "missing_args" };
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      "UPDATE `group_lane_plans` SET `is_default` = 0 WHERE `group_id` = ? AND `is_default` = 1",
      [groupId]
    );
    const r = await conn.query(
      "UPDATE `group_lane_plans` SET `is_default` = 1 WHERE `id` = ? AND `group_id` = ? AND `archived` = 0",
      [planId, groupId]
    );
    if (Number(r.affectedRows || 0) === 0) {
      await conn.rollback();
      return { ok: false, reason: "plan_not_found_or_archived" };
    }
    await conn.commit();
    return { ok: true };
  } catch (e) {
    try { await conn.rollback(); } catch (_) {}
    throw e;
  } finally {
    conn.release();
  }
}

// Compact "what can I generate for?" list for the generate-for picker.
// Returns active (non-archived) groups the coach is on, with member count
// and team name for grouping in the UI. Used to populate the picker per
// decision #35 (Private students = groups where count = 1, top-level
// section; Groups = count >= 2). Single query — picker shouldn't fan out.
export async function dbListCoachTargets(coachSub) {
  if (!coachSub) return [];
  const rows = await pool.query(
    "SELECT g.`id`, g.`name`, g.`current_phase`, g.`team_id`, t.`name` AS team_name, " +
    "       COUNT(gm.`id`) AS member_count " +
    "FROM `groups` g " +
    "JOIN `group_coaches` gc ON gc.`group_id` = g.`id` AND gc.`removed_at` IS NULL " +
    "LEFT JOIN `teams` t ON t.`id` = g.`team_id` " +
    "LEFT JOIN `group_members` gm ON gm.`group_id` = g.`id` AND gm.`left_at` IS NULL " +
    "WHERE gc.`coach_sub` = ? AND g.`archived` = 0 " +
    "GROUP BY g.`id`, g.`name`, g.`current_phase`, g.`team_id`, t.`name` " +
    "ORDER BY g.`name` ASC",
    [coachSub]
  );
  const targets = rows.map(r => ({
    kind:           "group",
    id:             r.id,
    name:           r.name,
    current_phase:  r.current_phase,
    team_id:        r.team_id,
    team_name:      r.team_name,
    member_count:   Number(r.member_count),
  }));
  // Meet-anchored taper (eval 2026-06-06): attach each group's active-anchor
  // suggested phase + countdown so the generator can offer an opt-in
  // "apply suggested phase" instead of the coach hand-flipping the pill each
  // week. Non-destructive — does NOT change the group's stored current_phase.
  for (const tg of targets) {
    try {
      const a = await dbGetActiveAnchor(tg.id);
      if (a && a.suggested_phase) {
        tg.suggested_phase   = a.suggested_phase;
        tg.anchor_weeks_out  = a.weeks_out;
        tg.anchor_event_name = a.event_name;
        tg.anchor_event_date = a.event_date;
      }
    } catch { /* anchor is optional; ignore lookup errors */ }
  }
  // Lesson tier (Phase 5) — expose INDIVIDUAL targets (kind:"managed") for direct
  // single-swimmer assignment (server assign_to:{managed_id} path), carrying each
  // swimmer's per-swimmer equipment profile. SCOPED to swimmers who are members of
  // one of the caller's LESSON groups (team-less groups) — so the lesson picker
  // shows only the people actually in your lessons, not your entire managed roster.
  // To make a 1-on-1 student assignable, put them in their own lesson group.
  const lessonGroupIds = targets.filter(g => g.team_id == null).map(g => g.id);
  if (lessonGroupIds.length) {
    const ph = lessonGroupIds.map(() => "?").join(",");
    const memRows = await pool.query(
      `SELECT DISTINCT \`member_managed_id\` FROM \`group_members\` ` +
      `WHERE \`group_id\` IN (${ph}) AND \`left_at\` IS NULL AND \`member_managed_id\` IS NOT NULL`,
      lessonGroupIds
    );
    const lessonMemberIds = new Set(memRows.map(r => r.member_managed_id));
    if (lessonMemberIds.size) {
      const managed = await dbListManagedSwimmersForCoach(coachSub, { includeArchived: false });
      for (const m of managed) {
        if (!lessonMemberIds.has(m.id)) continue;
        targets.push({
          kind:            "managed",
          id:              m.id,            // ms_… — distinct namespace from group ids
          managed_id:      m.id,
          name:            m.display_name,
          member_count:    1,
          equipment_modes: m.equipment_modes || null,
          lesson_level:    m.lesson_level || null,   // Phase 5 — defaults the lesson level picker
        });
      }
    }
  }
  return targets;
}

// ── Workout assignments (Stage 3 / R-D) ──────────────────────────────
// Per scope §8 / decisions #4, #34. Bulk-create at workout-save time; per-
// member fanout for groups OR single row for private-students/managed.
// completion_state defaults to 'not_started'; R-G writes splits/difficulty
// /completion via dbUpdateAssignmentCompletion.

const COMPLETION_STATES = ["not_started", "partial", "complete", "missed"];

// Resolve a target's pace for a given pool mode. Returns the swimmer's
// stored pace or null if missing. R-D uses managed paces (managed-only in
// Stage 3); R-F extends to full-account swimmers (their pace is single-
// valued in settings.pace_input — a different shape, addressed at R-F).
async function resolveManagedPace(managedId, poolMode) {
  if (!managedId || !poolMode) return null;
  const col = poolMode === "25y" ? "pace_scy_100"
            : poolMode === "25m" ? "pace_scm_100"
            : poolMode === "50m" ? "pace_lcm_100"
            : null;
  if (!col) return null;
  const rows = await pool.query(
    `SELECT \`${col}\` AS pace FROM \`coach_managed_swimmers\` WHERE \`id\` = ? LIMIT 1`,
    [managedId]
  );
  return rows[0]?.pace || null;
}

// Bulk insert assignments for a workout. Targets is an array of objects:
//   { swimmer_sub OR managed_id, lane_pace?, lane_idx?, lane_label?,
//     lane_interval_overrides? }
// All in a single transaction — if any insert fails, the whole batch rolls
// back. The caller has already validated the targets exist + caller has
// permission. group_id is shared across all rows in this batch.
export async function dbBulkCreateAssignments({ workoutId, groupId = null, lanePlanId = null, targets }) {
  if (!workoutId) throw new Error("workoutId required");
  if (!Array.isArray(targets) || targets.length === 0) throw new Error("targets required");
  const wid = String(workoutId);                                               // VARCHAR(32) in DB
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const inserted = [];
    for (const t of targets) {
      if ((t.swimmer_sub == null) === (t.managed_id == null)) {
        throw new Error("each target must specify exactly one of swimmer_sub or managed_id");
      }
      const r = await conn.query(
        "INSERT INTO `workout_assignments` " +
        "(`workout_id`, `assigned_via_group_id`, `assigned_via_lane_plan_id`, " +
        " `target_swimmer_sub`, `target_managed_id`, " +
        " `lane_idx`, `lane_label`, `lane_pace`, `lane_interval_overrides`) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          wid, groupId || null, lanePlanId || null,
          t.swimmer_sub || null, t.managed_id || null,
          t.lane_idx == null ? null : t.lane_idx,
          t.lane_label || null,
          t.lane_pace || null,
          t.lane_interval_overrides ? JSON.stringify(t.lane_interval_overrides) : null,
        ]
      );
      inserted.push(Number(r.insertId));
    }
    await conn.commit();
    return { ok: true, ids: inserted, count: inserted.length };
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    throw err;
  } finally {
    conn.release();
  }
}

// List assignments for a single workout with target identity surfaced.
// Used by the coach-side history badge + (future) the assigned-to-me view.
export async function dbListAssignmentsForWorkout(workoutId) {
  if (!workoutId) return [];
  // Phase 4 Identity I-D slice 6: polymorphic dual person JOIN, mirror of
  // dbListGroupMembers shape from slice 2.
  const rows = await pool.query(
    "SELECT wa.`id`, wa.`workout_id`, wa.`assigned_via_group_id`, wa.`assigned_via_lane_plan_id`, " +
    "       wa.`target_swimmer_sub`, wa.`target_managed_id`, wa.`lane_idx`, wa.`lane_label`, wa.`lane_pace`, " +
    "       wa.`assigned_at`, wa.`completion_state`, wa.`completed_at`, wa.`completed_by_coach_sub`, " +
    "       wa.`difficulty`, wa.`focus_note`, " +
    "       COALESCE(mp.`initials`, up.`initials`) AS target_initials, " +
    "       COALESCE(mp.`first_name`, up.`first_name`)    AS first_name, " +
    "       COALESCE(mp.`last_name`, up.`last_name`)      AS last_name, " +
    "       COALESCE(mp.`preferred_name`, up.`preferred_name`) AS preferred_name, " +
    "       g.`name`                                      AS group_name " +
    "FROM `workout_assignments` wa " +
    "LEFT JOIN `coach_managed_swimmers` m ON m.`id`  = wa.`target_managed_id` " +
    "LEFT JOIN `users` u                  ON u.`sub` = wa.`target_swimmer_sub` " +
    "LEFT JOIN `persons` mp               ON mp.`id` = m.`person_id` " +
    "LEFT JOIN `persons` up               ON up.`id` = u.`person_id` " +
    "LEFT JOIN `groups` g                 ON g.`id`  = wa.`assigned_via_group_id` " +
    "WHERE wa.`workout_id` = ? " +
    "ORDER BY COALESCE(mp.`last_name`, up.`last_name`) ASC, COALESCE(mp.`first_name`, up.`first_name`) ASC",
    [String(workoutId)]
  );
  return rows.map(r => ({
    id:                       Number(r.id),
    workout_id:               r.workout_id,                                    // VARCHAR(32), keep as string
    assigned_via_group_id:    r.assigned_via_group_id,
    assigned_via_lane_plan_id: r.assigned_via_lane_plan_id,
    target_swimmer_sub:       r.target_swimmer_sub,
    target_managed_id:        r.target_managed_id,
    target_name:              displayNameInline({ first_name: r.first_name, last_name: r.last_name, preferred_name: r.preferred_name }),
    target_initials:          r.target_initials,
    group_name:               r.group_name,
    lane_idx:                 r.lane_idx,
    lane_label:               r.lane_label,
    lane_pace:                r.lane_pace,
    assigned_at:              dtToIso(r.assigned_at),
    completion_state:         r.completion_state,
    completed_at:             dtToIso(r.completed_at),
    completed_by_coach_sub:   r.completed_by_coach_sub,
    difficulty:               r.difficulty,
    focus_note:               r.focus_note,
  }));
}

// Swimmer-side list (R-G "Assigned to me"). Joins workouts for payload,
// coach (workout owner) for attribution, and group/plan for context. Returns
// the full canonical workout payload alongside the assignment row so the
// swimmer-side viewer doesn't need a separate fetch per row.
export async function dbListAssignmentsForSwimmer(swimmerSub, { state = null, includeCompleted = true, limit = 100 } = {}) {
  if (!swimmerSub) return [];
  const where = ["wa.`target_swimmer_sub` = ?"];
  const vals  = [swimmerSub];
  if (state) {
    if (!COMPLETION_STATES.includes(state)) throw new Error("bad state");
    where.push("wa.`completion_state` = ?");
    vals.push(state);
  } else if (!includeCompleted) {
    where.push("wa.`completion_state` IN ('not_started','partial')");
  }
  const cap = Math.min(Math.max(1, Number(limit) || 100), 500);
  // Phase 4 Identity I-D slice 6: single coach JOIN to persons.
  const rows = await pool.query(
    "SELECT wa.`id`, wa.`workout_id`, wa.`assigned_via_group_id`, wa.`assigned_via_lane_plan_id`, " +
    "       wa.`lane_idx`, wa.`lane_label`, wa.`lane_pace`, wa.`assigned_at`, " +
    "       wa.`completion_state`, wa.`completed_at`, wa.`completed_by_coach_sub`, " +
    "       wa.`difficulty`, wa.`focus_note`, " +
    "       w.`saved_at`, w.`type`, w.`total_yards`, w.`pool_mode`, w.`payload`, " +
    "       w.`user_sub` AS coach_sub, " +
    "       g.`name`                                AS group_name, " +
    "       pc.`first_name` AS c_first, pc.`last_name` AS c_last, pc.`preferred_name` AS c_preferred " +
    "FROM `workout_assignments` wa " +
    "JOIN `workouts` w  ON w.`id`  = wa.`workout_id` " +
    "LEFT JOIN `groups` g  ON g.`id`  = wa.`assigned_via_group_id` " +
    "LEFT JOIN `users` cu ON cu.`sub` = w.`user_sub` " +
    "LEFT JOIN `persons` pc ON pc.`id` = cu.`person_id` " +
    "WHERE " + where.join(" AND ") + " " +
    "ORDER BY wa.`assigned_at` DESC " +
    `LIMIT ${cap}`,
    vals
  );
  return rows.map(r => ({
    id:                       Number(r.id),
    workout_id:               r.workout_id,
    assigned_via_group_id:    r.assigned_via_group_id,
    assigned_via_lane_plan_id: r.assigned_via_lane_plan_id,
    group_name:               r.group_name,
    coach_sub:                r.coach_sub,
    coach_name:               displayNameInline({ first_name: r.c_first, last_name: r.c_last, preferred_name: r.c_preferred }),
    lane_idx:                 r.lane_idx,
    lane_label:               r.lane_label,
    lane_pace:                r.lane_pace,
    assigned_at:              dtToIso(r.assigned_at),
    completion_state:         r.completion_state,
    completed_at:             dtToIso(r.completed_at),
    completed_by_coach_sub:   r.completed_by_coach_sub,
    difficulty:               r.difficulty,
    focus_note:               r.focus_note,
    // Workout payload — swimmer needs this to view/run the workout.
    workout: {
      id:           r.workout_id,
      savedAt:      dtToIso(r.saved_at),
      type:         r.type,
      totalYards:   Number(r.total_yards),
      poolMode:     r.pool_mode,
      ...(typeof r.payload === "string" ? JSON.parse(r.payload) : (r.payload || {})),
    },
  }));
}

// Coach-side list (R-G coach-mark-on-behalf). All assignments via a given
// group, with target identity surfaced. Used in GroupRow's "Recent
// assignments" panel.
export async function dbListAssignmentsForGroup(groupId, { state = null, limit = 100 } = {}) {
  if (!groupId) return [];
  const where = ["wa.`assigned_via_group_id` = ?"];
  const vals  = [groupId];
  if (state) {
    if (!COMPLETION_STATES.includes(state)) throw new Error("bad state");
    where.push("wa.`completion_state` = ?");
    vals.push(state);
  }
  const cap = Math.min(Math.max(1, Number(limit) || 100), 500);
  // Phase 4 Identity I-D slice 6: polymorphic dual person JOIN.
  const rows = await pool.query(
    "SELECT wa.`id`, wa.`workout_id`, wa.`assigned_via_lane_plan_id`, " +
    "       wa.`target_swimmer_sub`, wa.`target_managed_id`, " +
    "       wa.`lane_idx`, wa.`lane_label`, wa.`lane_pace`, " +
    "       wa.`assigned_at`, wa.`completion_state`, wa.`completed_at`, wa.`completed_by_coach_sub`, " +
    "       wa.`difficulty`, wa.`focus_note`, " +
    "       w.`type`, w.`total_yards`, w.`saved_at`, " +
    "       COALESCE(mp.`first_name`, up.`first_name`)    AS first_name, " +
    "       COALESCE(mp.`last_name`, up.`last_name`)      AS last_name, " +
    "       COALESCE(mp.`preferred_name`, up.`preferred_name`) AS preferred_name " +
    "FROM `workout_assignments` wa " +
    "JOIN `workouts` w  ON w.`id`  = wa.`workout_id` " +
    "LEFT JOIN `coach_managed_swimmers` m ON m.`id`  = wa.`target_managed_id` " +
    "LEFT JOIN `users`                  u ON u.`sub` = wa.`target_swimmer_sub` " +
    "LEFT JOIN `persons` mp               ON mp.`id` = m.`person_id` " +
    "LEFT JOIN `persons` up               ON up.`id` = u.`person_id` " +
    "WHERE " + where.join(" AND ") + " " +
    "ORDER BY wa.`assigned_at` DESC, COALESCE(mp.`last_name`, up.`last_name`) ASC, COALESCE(mp.`first_name`, up.`first_name`) ASC " +
    `LIMIT ${cap}`,
    vals
  );
  return rows.map(r => ({
    id:                       Number(r.id),
    workout_id:               r.workout_id,
    target_swimmer_sub:       r.target_swimmer_sub,
    target_managed_id:        r.target_managed_id,
    target_name:              displayNameInline({ first_name: r.first_name, last_name: r.last_name, preferred_name: r.preferred_name }),
    lane_idx:                 r.lane_idx,
    lane_label:               r.lane_label,
    lane_pace:                r.lane_pace,
    workout_type:             r.type,
    workout_total_yards:      Number(r.total_yards),
    workout_saved_at:         dtToIso(r.saved_at),
    assigned_at:              dtToIso(r.assigned_at),
    completion_state:         r.completion_state,
    completed_at:             dtToIso(r.completed_at),
    completed_by_coach_sub:   r.completed_by_coach_sub,
    difficulty:               r.difficulty,
    focus_note:               r.focus_note,
  }));
}

// Single-assignment fetch for R-G (auth checks before update). JOINs the
// source workout so the route can also authorize the workout owner — needed
// for managed-id assignments where neither target swimmer (no login) nor
// group coach (assigned_via_group_id is NULL for direct managed assigns) can
// satisfy the check on their own.
export async function dbGetAssignment(id) {
  if (!id) return null;
  const rows = await pool.query(
    "SELECT a.*, w.`user_sub` AS workout_user_sub " +
    "FROM `workout_assignments` a " +
    "LEFT JOIN `workouts` w ON w.`id` = a.`workout_id` " +
    "WHERE a.`id` = ? LIMIT 1",
    [Number(id)]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id:                       Number(r.id),
    workout_id:               r.workout_id,                                    // VARCHAR(32), keep as string
    workout_user_sub:         r.workout_user_sub,
    assigned_via_group_id:    r.assigned_via_group_id,
    assigned_via_lane_plan_id: r.assigned_via_lane_plan_id,
    target_swimmer_sub:       r.target_swimmer_sub,
    target_managed_id:        r.target_managed_id,
    completion_state:         r.completion_state,
  };
}

// Pre-built for R-G — swimmer-side completion logging AND coach-mark-on-
// behalf path. Allowed fields per scope: completion_state, completed_at,
// completed_by_coach_sub, splits_payload, difficulty, focus_note.
export async function dbUpdateAssignmentCompletion(id, patch = {}) {
  if (!id) return { ok: false, reason: "no_id" };
  const sets = [], vals = [];
  if ("completion_state" in patch) {
    if (!COMPLETION_STATES.includes(patch.completion_state)) return { ok: false, reason: "bad_state" };
    sets.push("`completion_state` = ?");
    vals.push(patch.completion_state);
    // Auto-stamp completed_at on terminal states unless caller provided one.
    if (!("completed_at" in patch) && (patch.completion_state === "complete" || patch.completion_state === "partial" || patch.completion_state === "missed")) {
      sets.push("`completed_at` = CURRENT_TIMESTAMP(3)");
    }
  }
  if ("completed_at" in patch) {
    sets.push("`completed_at` = ?");
    vals.push(patch.completed_at || null);
  }
  if ("completed_by_coach_sub" in patch) {
    sets.push("`completed_by_coach_sub` = ?");
    vals.push(patch.completed_by_coach_sub || null);
  }
  if ("splits_payload" in patch) {
    sets.push("`splits_payload` = ?");
    vals.push(patch.splits_payload ? JSON.stringify(patch.splits_payload) : null);
  }
  if ("difficulty" in patch) {
    sets.push("`difficulty` = ?");
    vals.push(patch.difficulty == null ? null : Number(patch.difficulty));
  }
  if ("focus_note" in patch) {
    sets.push("`focus_note` = ?");
    vals.push(patch.focus_note || null);
  }
  if (!sets.length) return { ok: true, affected: 0 };
  vals.push(Number(id));
  const r = await pool.query(
    `UPDATE \`workout_assignments\` SET ${sets.join(", ")} WHERE \`id\` = ?`,
    vals
  );
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

// For the pool-mode pill row: returns upcoming events across all teams the
// user has any role on (coach via team_coaches, or member via group_members).
// Future-dated only; sorted by nearest date first.
export async function dbListUpcomingEventsForUser(userSub) {
  if (!userSub) return [];
  // Two-leg UNION: teams via team_coaches (coach side) AND teams via groups
  // the user has a swimmer membership in. Dedupe by team_id implicitly via
  // DISTINCT on the outer query.
  const rows = await pool.query(
    "SELECT DISTINCT te.`id`, te.`team_id`, t.`name` AS team_name, te.`name`, te.`kind`, te.`date`, " +
    "       te.`start_time`, te.`venue_id`, v.`name` AS venue_name, v.`latitude` AS venue_lat, " +
    "       v.`longitude` AS venue_lng, v.`indoor_outdoor` AS venue_io, v.`timezone` AS venue_tz, " +
    "       te.`status`, te.`status_note`, er.`status` AS my_rsvp " +
    "FROM `team_events` te " +
    "JOIN `teams` t ON t.`id` = te.`team_id` " +
    "LEFT JOIN `venues` v ON v.`id` = te.`venue_id` " +
    // caller's own RSVP for the event (Slice B2). event_rsvp.swimmer_sub may be
    // utf8mb3 vs the param's utf8mb4 — CONVERT both so the join is charset-safe.
    "LEFT JOIN `event_rsvp` er ON er.`target_kind` = 'meet' AND er.`target_id` = te.`id` " +
    "  AND CONVERT(er.`swimmer_sub` USING utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci " +
    "WHERE te.`date` >= CURRENT_DATE " +
    "  AND ( " +
    "    te.`team_id` IN (SELECT `team_id` FROM `team_coaches` WHERE `coach_sub` = ? AND `removed_at` IS NULL) " +
    "    OR te.`team_id` IN ( " +
    "      SELECT g.`team_id` FROM `group_members` gm " +
    "        JOIN `groups` g ON g.`id` = gm.`group_id` " +
    "        WHERE gm.`member_swimmer_sub` = ? AND gm.`left_at` IS NULL AND g.`team_id` IS NOT NULL " +
    "    ) " +
    "  ) " +
    "ORDER BY te.`date` ASC LIMIT 20",
    [userSub, userSub, userSub]
  );
  return rows.map(r => ({
    id: r.id, team_id: r.team_id, team_name: r.team_name,
    name: r.name, kind: r.kind || DEFAULT_EVENT_KIND, date: dateToYmd(r.date),
    start_time: r.start_time ? String(r.start_time).slice(0, 5) : null,
    venue: _eventVenue(r),
    status: r.status || "scheduled", status_note: r.status_note || null,
    my_rsvp: r.my_rsvp || null,
  }));
}
