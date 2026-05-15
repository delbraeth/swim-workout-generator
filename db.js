// db.js — MariaDB connection pool + per-table helpers for vero_swimgen.
//
// Required env vars (pool fails to initialize if any are missing):
//   DB_HOST, DB_USER, DB_PASSWORD
//
// Optional:
//   DB_PORT (default 3306), DB_NAME (default vero_swimgen)
//
// TLS is required at the server (REQUIRE SSL on the user). The pool passes
// `ssl: { rejectUnauthorized: false }` — encrypted, no cert chain validation
// against the self-signed CA. Future hardening: pin the CA cert.

import { createPool } from "mariadb";
import crypto          from "crypto";

const {
  DB_HOST,
  DB_PORT     = "3306",
  DB_USER,
  DB_PASSWORD,
  DB_NAME     = "vero_swimgen",
} = process.env;

export const dbActive = Boolean(DB_HOST && DB_USER && DB_PASSWORD);

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
export async function dbEnsureUser(userSub, initials = null) {
  if (!userSub) return;
  await pool.query(
    "INSERT IGNORE INTO `users` (`sub`, `initials`) VALUES (?, ?)",
    [userSub, initials]
  );
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
  // If patch carries `initials`, store on users.initials (not settings)
  if ("initials" in patch && patch.initials != null) {
    await pool.query(
      "UPDATE `users` SET `initials` = ? WHERE `sub` = ?",
      [patch.initials, userSub]
    );
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
export async function dbAuditEvent({ userSub = null, eventType, ip = null, userAgent = null, details = null }) {
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
    await pool.query(
      "INSERT INTO `audit_events` (`user_sub`, `event_type`, `ip`, `user_agent`, `details`) VALUES (?, ?, ?, ?, ?)",
      [userSub, eventType, ip, userAgent ? String(userAgent).slice(0, 255) : null, detailsJson]
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
    const userRows = await conn.query(
      "SELECT `sub`, `email`, `email_verified`, `display_name`, `initials`, `is_admin`, `is_coach`, `created_at`, `last_login_at` FROM `users` WHERE `sub` = ?",
      [sub]
    );
    if (!userRows[0]) return null;
    const u = userRows[0];
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

    return {
      sub:                     u.sub,
      email:                   u.email,
      email_verified:          !!u.email_verified,
      display_name:            u.display_name,
      initials:                u.initials,
      is_admin:                !!u.is_admin,
      // Coach is granted by either explicit is_coach flag OR is_admin (admin
      // implicitly has coach capability). Mirrors dbIsCoach's check.
      is_coach:                !!(u.is_coach || u.is_admin),
      created_at:              u.created_at,
      last_login_at:           u.last_login_at,
      workout_count:           workoutCount,
      stats_by_pool:           stats,
      pending_feedback_count:  pendingFeedbackCount,
    };
  } finally {
    conn.release();
  }
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

// ─── admin helpers ──────────────────────────────────────────────────────────
export async function dbAdminListUsers() {
  const rows = await pool.query(`
    SELECT u.sub, u.email, u.email_verified, u.display_name, u.initials,
           u.is_admin, u.is_coach, u.is_disabled, u.created_at, u.last_login_at,
           COALESCE(w.cnt, 0) AS workout_count
      FROM users u
      LEFT JOIN (SELECT user_sub, COUNT(*) AS cnt FROM workouts GROUP BY user_sub) w
        ON w.user_sub = u.sub
      ORDER BY u.created_at DESC
  `);
  return rows.map(r => ({
    sub: r.sub, email: r.email, email_verified: !!r.email_verified,
    display_name: r.display_name, initials: r.initials,
    is_admin: !!r.is_admin, is_coach: !!r.is_coach, is_disabled: !!r.is_disabled,
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
  if (!["is_disabled", "is_admin", "is_coach"].includes(field)) return { ok: false, reason: "bad_field" };
  await pool.query(`UPDATE \`users\` SET \`${field}\` = ? WHERE \`sub\` = ?`, [value ? 1 : 0, sub]);
  return { ok: true };
}

// Admin edits to a user's display fields. Only allows email, initials, display_name.
// Self-serve profile update. Unlike dbAdminUpdateUser, this resets
// `email_verified` to 0 whenever the email value changes (the new
// address has not been verified through Apple's flow yet).
export async function dbUpdateMe(sub, patch) {
  if (!sub) return { ok: false, reason: "no_sub" };
  const allowed = { email: "email", display_name: "display_name", initials: "initials" };
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
  }
  for (const [k, col] of Object.entries(allowed)) {
    if (k in patch) {
      sets.push(`\`${col}\` = ?`);
      vals.push(patch[k] === "" ? null : patch[k]);
    }
  }
  if (resetVerified) sets.push("`email_verified` = 0");
  if (!sets.length) return { ok: true, affected: 0 };
  vals.push(sub);
  const r = await pool.query(`UPDATE \`users\` SET ${sets.join(", ")} WHERE \`sub\` = ?`, vals);
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

export async function dbAdminUpdateUser(sub, patch) {
  if (!sub) return { ok: false, reason: "no_sub" };
  const allowed = { email: "email", initials: "initials", display_name: "display_name" };
  const sets = [], vals = [];
  for (const [k, col] of Object.entries(allowed)) {
    if (k in patch) {
      sets.push(`\`${col}\` = ?`);
      vals.push(patch[k] === "" ? null : patch[k]);
    }
  }
  if (!sets.length) return { ok: true, affected: 0 };
  vals.push(sub);
  const r = await pool.query(`UPDATE \`users\` SET ${sets.join(", ")} WHERE \`sub\` = ?`, vals);
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

export async function dbAdminDeleteUser(sub) {
  if (!sub) return { ok: false, reason: "no_sub" };
  // FK CASCADE on workouts/favorites/settings/sessions wipes child rows.
  // audit_events and invite_codes use SET NULL — trail preserved.
  const r = await pool.query("DELETE FROM `users` WHERE `sub` = ?", [sub]);
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

export async function dbAdminListInvites() {
  const rows = await pool.query(`
    SELECT ic.code, ic.note, ic.max_uses, ic.times_used,
           ic.expires_at, ic.created_at, ic.created_by,
           u.initials AS created_by_initials
      FROM invite_codes ic
      LEFT JOIN users u ON u.sub = ic.created_by
      ORDER BY ic.created_at DESC
  `);
  return rows.map(r => ({
    code: r.code, note: r.note,
    max_uses: Number(r.max_uses), times_used: Number(r.times_used),
    expires_at: r.expires_at, created_at: r.created_at,
    created_by: r.created_by, created_by_initials: r.created_by_initials,
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

export async function dbAdminListAuditEvents({ limit = 100, offset = 0, eventType = null, userSub = null } = {}) {
  const where = [];
  const args  = [];
  if (eventType) { where.push("`event_type` = ?"); args.push(eventType); }
  if (userSub)   { where.push("`user_sub` = ?");   args.push(userSub); }
  const wh = where.length ? `WHERE ${where.join(" AND ")}` : "";
  args.push(Number(limit), Number(offset));
  const rows = await pool.query(
    `SELECT id, user_sub, event_type, ip, user_agent, details, created_at
       FROM audit_events ${wh}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
    args
  );
  return rows.map(r => ({
    id: Number(r.id), user_sub: r.user_sub, event_type: r.event_type,
    ip: r.ip, user_agent: r.user_agent,
    details: r.details, created_at: r.created_at,
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
  const rows = await pool.query(
    "SELECT f.`id`, f.`user_sub`, f.`category`, f.`subject`, f.`body`, f.`page`, " +
    "       f.`user_agent`, f.`status`, f.`reviewed_by`, f.`reviewed_at`, f.`admin_note`, f.`created_at`, " +
    "       u.`initials` AS submitter_initials, u.`display_name` AS submitter_name, " +
    "       r.`initials` AS reviewer_initials " +
    "FROM `feedback` f " +
    "LEFT JOIN `users` u ON u.`sub` = f.`user_sub` " +
    "LEFT JOIN `users` r ON r.`sub` = f.`reviewed_by` " +
    `${whereSql} ` +
    "ORDER BY f.`created_at` DESC " +
    `LIMIT ${cap}`,
    args
  );
  return rows.map(r => ({
    id:                 Number(r.id),
    user_sub:           r.user_sub,
    submitter_initials: r.submitter_initials,
    submitter_name:     r.submitter_name,
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
