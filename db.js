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
      "SELECT `sub`, `email`, `email_verified`, `display_name`, `initials`, `dob`, `gender`, `is_admin`, `is_coach`, `created_at`, `last_login_at` FROM `users` WHERE `sub` = ?",
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
      // DOB returned only to the user themselves (this endpoint is always
      // self-scoped). Other endpoints expose only the derived `is_minor` to
      // protect the raw DATE per decision #27.
      dob:                     dateToYmd(u.dob),
      is_minor:                isMinor(u.dob),                                // null when DOB unset
      gender:                  u.gender,                                       // M/F/X/prefer_not_to_say/null
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

// List coaches for picker UIs (Teams / group_coaches add flow).
// Minimal info — no email, no DOB — to keep PII exposure low. Excludes the
// caller themselves so they can't try to add themselves to a team they
// already own.
// Privacy note: v1 lists ALL coaches system-wide. At multi-tenant scale this
// becomes PII leakage; scope down (e.g., "only coaches in teams I'm in") when
// the threat model warrants.
export async function dbListCoachesForPicker(excludeSub) {
  const rows = await pool.query(
    "SELECT `sub`, `display_name`, `initials` FROM `users` " +
    "WHERE (`is_coach` = 1 OR `is_admin` = 1) AND `is_disabled` = 0 AND `sub` != ? " +
    "ORDER BY `display_name` ASC, `initials` ASC",
    [excludeSub || ""]
  );
  return rows.map(r => ({
    sub:          r.sub,
    display_name: r.display_name,
    initials:     r.initials,
  }));
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
const GENDER_VALUES = ["M", "F", "X", "prefer_not_to_say"];
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
  // Gender is opt-in for the user; null means unset. Reject unknown values.
  if ("gender" in patch) {
    const g = patch.gender;
    if (g !== null && g !== "" && !GENDER_VALUES.includes(g)) {
      return { ok: false, reason: "bad_gender" };
    }
    sets.push("`gender` = ?");
    vals.push(g === "" ? null : g);
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
  // Gender is admin-editable too. Same enum validation as dbUpdateMe.
  if ("gender" in patch) {
    const g = patch.gender;
    if (g !== null && g !== "" && !GENDER_VALUES.includes(g)) {
      return { ok: false, reason: "bad_gender" };
    }
    sets.push("`gender` = ?");
    vals.push(g === "" ? null : g);
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
    "SELECT `id`, `owner_coach_sub`, `name`, `team_type`, `archived`, `created_at`, `updated_at` " +
    "FROM `teams` WHERE `id` = ?",
    [id]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id:              r.id,
    owner_coach_sub: r.owner_coach_sub,
    name:            r.name,
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

export async function dbUpdateTeam(id, { name }) {
  if (!id) return { ok: false, reason: "no_id" };
  // Only `name` is mutable (team_type is immutable per #25; owner change is
  // a separate flow not built in v1).
  if (typeof name !== "string" || !name.trim()) return { ok: false, reason: "bad_name" };
  if (name.length > 120) return { ok: false, reason: "name_too_long" };
  const r = await pool.query(
    "UPDATE `teams` SET `name` = ? WHERE `id` = ?",
    [name.trim(), id]
  );
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
  const rows = await pool.query(
    "SELECT tc.`coach_sub`, tc.`role`, tc.`added_at`, " +
    "       u.`display_name`, u.`initials`, u.`email` " +
    "FROM `team_coaches` tc " +
    "LEFT JOIN `users` u ON u.`sub` = tc.`coach_sub` " +
    "WHERE tc.`team_id` = ? AND tc.`removed_at` IS NULL " +
    "ORDER BY FIELD(tc.`role`, 'owner', 'admin', 'coach'), tc.`added_at` ASC",
    [teamId]
  );
  return rows.map(r => ({
    coach_sub:    r.coach_sub,
    role:         r.role,
    display_name: r.display_name,
    initials:     r.initials,
    email:        r.email,
    added_at:     dtToIso(r.added_at),
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
  const r = await pool.query(
    "UPDATE `team_coaches` SET `removed_at` = CURRENT_TIMESTAMP(3) " +
    "WHERE `team_id` = ? AND `coach_sub` = ? AND `removed_at` IS NULL",
    [teamId, coachSub]
  );
  return { ok: true, affected: Number(r.affectedRows || 0) };
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

function rowToManagedSwimmer(r) {
  return {
    id:                   r.id,
    owner_coach_sub:      r.owner_coach_sub,
    team_id:              r.team_id,
    display_name:         r.display_name,
    initials:             r.initials,
    dob:                  dateToYmd(r.dob),
    age:                  computeAge(r.dob),
    is_minor:             isMinor(r.dob),
    is_coppa_protected:   isCoppaProtected(r.dob),
    gender:               r.gender,
    parental_contact:     r.parental_contact,
    parent_managed_flag:  !!r.parent_managed_flag,
    pace_scy_100:         r.pace_scy_100,
    pace_scm_100:         r.pace_scm_100,
    pace_lcm_100:         r.pace_lcm_100,
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

export async function dbCreateManagedSwimmer({ ownerSub, display_name, dob, gender = null, team_id = null, initials = null, parental_contact = null, parent_managed_flag = false, pace_scy_100 = null, pace_scm_100 = null, pace_lcm_100 = null }) {
  if (!ownerSub) throw new Error("ownerSub required");
  if (!display_name || typeof display_name !== "string") throw new Error("display_name required");
  if (display_name.length > 120) throw new Error("display_name max 120 chars");
  const dobCheck = validateDob(dob);
  if (!dobCheck.ok) throw new Error(dobCheck.reason);
  if (initials && initials.length > 4) throw new Error("initials max 4 chars");
  if (parental_contact && parental_contact.length > 255) throw new Error("parental_contact max 255 chars");
  if (gender !== null && gender !== "" && !GENDER_VALUES.includes(gender)) throw new Error("bad gender");
  // team_id is OPTIONAL. If provided, verify the coach belongs to it.
  if (team_id) {
    const ok = await coachIsOnTeam(ownerSub, team_id);
    if (!ok) throw new Error("not a coach on this team");
  }
  await dbEnsureUser(ownerSub);
  const id = genManagedId();
  await pool.query(
    "INSERT INTO `coach_managed_swimmers` " +
    "(`id`, `owner_coach_sub`, `team_id`, `display_name`, `initials`, `dob`, `gender`, `parental_contact`, `parent_managed_flag`, " +
    " `pace_scy_100`, `pace_scm_100`, `pace_lcm_100`) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      id, ownerSub, team_id || null, display_name.trim(), initials || null, dob, gender || null,
      parental_contact || null, parent_managed_flag ? 1 : 0,
      pace_scy_100 || null, pace_scm_100 || null, pace_lcm_100 || null,
    ]
  );
  return { ok: true, id };
}

export async function dbGetManagedSwimmer(id) {
  if (!id || !MS_ID_RE.test(id)) return null;
  const rows = await pool.query(
    "SELECT `id`, `owner_coach_sub`, `team_id`, `display_name`, `initials`, `dob`, `gender`, `parental_contact`, `parent_managed_flag`, " +
    "       `pace_scy_100`, `pace_scm_100`, `pace_lcm_100`, `archived`, `created_at`, `updated_at` " +
    "FROM `coach_managed_swimmers`WHERE `id` = ?",
    [id]
  );
  if (!rows[0]) return null;
  return rowToManagedSwimmer(rows[0]);
}

export async function dbListManagedSwimmersForCoach(coachSub, { includeArchived = false } = {}) {
  if (!coachSub) return [];
  const whereArchived = includeArchived ? "" : "AND `archived` = 0 ";
  const rows = await pool.query(
    "SELECT `id`, `owner_coach_sub`, `team_id`, `display_name`, `initials`, `dob`, `gender`, `parental_contact`, `parent_managed_flag`, " +
    "       `pace_scy_100`, `pace_scm_100`, `pace_lcm_100`, `archived`, `created_at`, `updated_at` " +
    "FROM `coach_managed_swimmers`" +
    "WHERE `owner_coach_sub` = ? " + whereArchived +
    "ORDER BY `archived` ASC, `display_name` ASC",
    [coachSub]
  );
  return rows.map(rowToManagedSwimmer);
}

// Update allowed-fields whitelist. dob can be updated; same validation as create.
export async function dbUpdateManagedSwimmer(id, patch) {
  if (!id || !MS_ID_RE.test(id)) return { ok: false, reason: "bad_id" };
  const allowed = {
    display_name:        v => (typeof v === "string" && v.trim().length > 0 && v.length <= 120) ? v.trim() : null,
    initials:            v => (v == null || v === "") ? null : (typeof v === "string" && v.length <= 4) ? v : undefined,
    gender:              v => (v == null || v === "") ? null : (GENDER_VALUES.includes(v) ? v : undefined),
    parental_contact:    v => (v == null || v === "") ? null : (typeof v === "string" && v.length <= 255) ? v : undefined,
    parent_managed_flag: v => (typeof v === "boolean") ? (v ? 1 : 0) : (v === 0 || v === 1) ? v : undefined,
    pace_scy_100:        v => (v == null || v === "") ? null : (typeof v === "string" && v.length <= 8) ? v : undefined,
    pace_scm_100:        v => (v == null || v === "") ? null : (typeof v === "string" && v.length <= 8) ? v : undefined,
    pace_lcm_100:        v => (v == null || v === "") ? null : (typeof v === "string" && v.length <= 8) ? v : undefined,
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
  if ("dob" in patch) {
    const dobCheck = validateDob(patch.dob);
    if (!dobCheck.ok) return { ok: false, reason: dobCheck.reason };
    sets.push("`dob` = ?");
    vals.push(patch.dob);
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
  if (!sets.length) return { ok: true, affected: 0 };
  vals.push(id);
  const r = await pool.query(
    `UPDATE \`coach_managed_swimmers\` SET ${sets.join(", ")} WHERE \`id\` = ?`,
    vals
  );
  return { ok: true, affected: Number(r.affectedRows || 0) };
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
  const r = await pool.query(
    "UPDATE `users` SET `dob` = ? WHERE `sub` = ?",
    [dob, sub]
  );
  return { ok: true, affected: Number(r.affectedRows || 0) };
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
// the visibility gate. Joins both swimmer-side (users.dob) and managed-side
// (coach_managed_swimmers.dob); either polymorphic target is sufficient.
async function groupHasMinorMember(groupId) {
  if (!groupId) return false;
  const rows = await pool.query(
    "SELECT u.`dob` AS udob, m.`dob` AS mdob " +
    "FROM `group_members` gm " +
    "LEFT JOIN `users` u                  ON u.`sub` = gm.`member_swimmer_sub` " +
    "LEFT JOIN `coach_managed_swimmers` m ON m.`id`  = gm.`member_managed_id` " +
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
  const rows = await pool.query(
    "SELECT gc.`coach_sub`, gc.`role`, gc.`added_at`, " +
    "       u.`display_name`, u.`initials`, u.`email` " +
    "FROM `group_coaches` gc " +
    "LEFT JOIN `users` u ON u.`sub` = gc.`coach_sub` " +
    "WHERE gc.`group_id` = ? AND gc.`removed_at` IS NULL " +
    "ORDER BY FIELD(gc.`role`, 'primary', 'assistant'), gc.`added_at` ASC",
    [groupId]
  );
  return rows.map(r => ({
    coach_sub:    r.coach_sub,
    role:         r.role,
    display_name: r.display_name,
    initials:     r.initials,
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
  const rows = await pool.query(
    "SELECT gm.`id`, gm.`member_swimmer_sub`, gm.`member_managed_id`, gm.`role`, " +
    "       gm.`joined_at`, gm.`left_at`, gm.`reason`, " +
    "       COALESCE(m.`display_name`, u.`display_name`) AS display_name, " +
    "       COALESCE(m.`initials`, u.`initials`)         AS initials, " +
    "       COALESCE(m.`dob`, u.`dob`)                   AS dob, " +
    "       COALESCE(m.`gender`, u.`gender`)             AS gender " +
    "FROM `group_members` gm " +
    "LEFT JOIN `coach_managed_swimmers` m ON m.`id` = gm.`member_managed_id` " +
    "LEFT JOIN `users` u                  ON u.`sub` = gm.`member_swimmer_sub` " +
    "WHERE gm.`group_id` = ? AND gm.`left_at` IS NULL " +
    "ORDER BY display_name ASC",
    [groupId]
  );
  return rows.map(r => ({
    id:                  Number(r.id),
    member_swimmer_sub:  r.member_swimmer_sub,
    member_managed_id:   r.member_managed_id,
    role:                r.role,
    joined_at:           dtToIso(r.joined_at),
    display_name:        r.display_name,
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
  // Resolve the target group's primary coach (needed for #33 check).
  const grpRows = await pool.query(
    "SELECT `primary_coach_sub` FROM `groups` WHERE `id` = ? AND `archived` = 0 LIMIT 1",
    [groupId]
  );
  if (!grpRows[0]) return { ok: false, reason: "group_not_found_or_archived" };
  const primaryCoach = grpRows[0].primary_coach_sub;
  // For role='primary', check no other active primary membership for this
  // swimmer exists under the same coach's other groups.
  if (role === "primary") {
    const targetField = managedId ? "gm.`member_managed_id`" : "gm.`member_swimmer_sub`";
    const targetValue = managedId || swimmerSub;
    const conflicts = await pool.query(
      "SELECT gm.`group_id`, g.`name` AS group_name FROM `group_members` gm " +
      "JOIN `groups` g ON g.`id` = gm.`group_id` " +
      `WHERE gm.\`left_at\` IS NULL AND gm.\`role\` = 'primary' AND ${targetField} = ? ` +
      "AND g.`primary_coach_sub` = ? AND gm.`group_id` != ?",
      [targetValue, primaryCoach, groupId]
    );
    if (conflicts.length > 0) {
      return { ok: false, reason: "primary_in_other_group_same_coach", conflict_group_id: conflicts[0].group_id, conflict_group_name: conflicts[0].group_name };
    }
  }
  // Also block duplicate-active rows for the same (group, member).
  const dupField = managedId ? "`member_managed_id`" : "`member_swimmer_sub`";
  const dupVal = managedId || swimmerSub;
  const dups = await pool.query(
    `SELECT 1 FROM \`group_members\` WHERE \`group_id\` = ? AND ${dupField} = ? AND \`left_at\` IS NULL LIMIT 1`,
    [groupId, dupVal]
  );
  if (dups.length > 0) return { ok: false, reason: "already_active_member" };

  const r = await pool.query(
    "INSERT INTO `group_members` (`group_id`, `member_swimmer_sub`, `member_managed_id`, `role`) " +
    "VALUES (?, ?, ?, ?)",
    [groupId, swimmerSub || null, managedId || null, role]
  );
  return { ok: true, id: Number(r.insertId) };
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

export async function dbCreateTeamEvent({ teamId, name, date, createdByCoachSub }) {
  if (!teamId) throw new Error("teamId required");
  if (!name || typeof name !== "string") throw new Error("name required");
  if (name.length > 120) throw new Error("name max 120 chars");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) throw new Error("date must be YYYY-MM-DD");
  const id = genEventId();
  await pool.query(
    "INSERT INTO `team_events` (`id`, `team_id`, `name`, `date`, `created_by_coach_sub`) " +
    "VALUES (?, ?, ?, ?, ?)",
    [id, teamId, name.trim(), date, createdByCoachSub || null]
  );
  return { ok: true, id };
}

export async function dbGetTeamEvent(eventId) {
  if (!eventId) return null;
  const rows = await pool.query(
    "SELECT `id`, `team_id`, `name`, `date`, `created_by_coach_sub`, `created_at` " +
    "FROM `team_events` WHERE `id` = ?",
    [eventId]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id:        r.id,
    team_id:   r.team_id,
    name:      r.name,
    date:      dateToYmd(r.date),
    created_by_coach_sub: r.created_by_coach_sub,
    created_at: dtToIso(r.created_at),
  };
}

export async function dbDeleteTeamEvent(eventId) {
  if (!eventId) return { ok: false, reason: "no_id" };
  const r = await pool.query("DELETE FROM `team_events` WHERE `id` = ?", [eventId]);
  return { ok: true, affected: Number(r.affectedRows || 0) };
}

// Update name / date on an existing event. team_id and created_by_coach_sub
// are intentionally not editable — creator attribution is a tombstone.
export async function dbUpdateTeamEvent(eventId, { name, date } = {}) {
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
    "SELECT `id`, `team_id`, `name`, `date`, `created_by_coach_sub`, `created_at` " +
    "FROM `team_events` WHERE `team_id` = ? ORDER BY `date` ASC",
    [teamId]
  );
  return rows.map(r => ({
    id: r.id, team_id: r.team_id, name: r.name,
    date: dateToYmd(r.date),
    created_by_coach_sub: r.created_by_coach_sub,
    created_at: dtToIso(r.created_at),
  }));
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
    "SELECT DISTINCT te.`id`, te.`team_id`, t.`name` AS team_name, te.`name`, te.`date` " +
    "FROM `team_events` te " +
    "JOIN `teams` t ON t.`id` = te.`team_id` " +
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
    [userSub, userSub]
  );
  return rows.map(r => ({
    id: r.id, team_id: r.team_id, team_name: r.team_name,
    name: r.name, date: dateToYmd(r.date),
  }));
}
