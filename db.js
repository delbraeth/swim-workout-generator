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
           u.is_admin, u.is_coach, u.is_disabled, u.support_role, u.created_at, u.last_login_at,
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
    support_role: !!r.support_role,
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
  // Mirror dbUpdateMe: if admin changes the email, clear the verified badge
  // so it doesn't keep claiming the old address is verified.
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
  // Gender is admin-editable too. Same enum validation as dbUpdateMe.
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
  return {
    labels:  labelRows.map(r => r.label),
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
  return {
    labels:  labelRows.map(r => r.label),
    set_ids: setRows.map(r => r.set_id),
    engine:  Array.from(engineMap.values()),
  };
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
  return { ok: true, affected: Number(r.affectedRows || 0) };
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
    "       g.`name` AS group_name, g.`primary_coach_sub` " +
    "FROM `group_join_tokens` t " +
    "LEFT JOIN `groups` g ON g.`id` = t.`group_id` " +
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
  const rows = await pool.query(
    "SELECT t.`token`, t.`managed_id`, t.`issued_by_coach`, t.`issued_at`, " +
    "       t.`expires_at`, t.`redeemed_at`, t.`redeemed_by_swimmer_sub`, " +
    "       m.`display_name` AS managed_name, m.`owner_coach_sub`, " +
    "       cu.`display_name` AS coach_name " +
    "FROM `managed_swimmer_claim_tokens` t " +
    "LEFT JOIN `coach_managed_swimmers` m ON m.`id` = t.`managed_id` " +
    "LEFT JOIN `users` cu ON cu.`sub` = t.`issued_by_coach` " +
    "WHERE t.`token` = ? LIMIT 1",
    [token]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    token:                   r.token,
    managed_id:              r.managed_id,
    managed_name:            r.managed_name,
    owner_coach_sub:         r.owner_coach_sub,
    coach_name:              r.coach_name,
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

    const msRows = await conn.query(
      "SELECT `id`, `owner_coach_sub`, `display_name`, `initials`, `dob`, `gender`, `parental_contact`, " +
      "       `pace_scy_100`, `pace_scm_100`, `pace_lcm_100` " +
      "FROM `coach_managed_swimmers` WHERE `id` = ? FOR UPDATE",
      [t.managed_id]
    );
    if (!msRows[0])                                   { await conn.rollback(); return { ok: false, reason: "managed_missing" }; }
    const ms = msRows[0];

    // ── Step 2: lock target swimmer row + capture diff ─────────────────
    const swRows = await conn.query(
      "SELECT `sub`, `display_name`, `initials`, `dob`, `gender` FROM `users` WHERE `sub` = ? FOR UPDATE",
      [swimmerSub]
    );
    if (!swRows[0])                                   { await conn.rollback(); return { ok: false, reason: "swimmer_missing" }; }
    const sw = swRows[0];
    // Diff: only fields where managed has a value AND it differs from current swimmer value
    const diff = [];
    const idChanges = {};
    function maybeChange(field, msVal, swVal) {
      if (msVal == null || msVal === "") return;
      const a = msVal instanceof Date ? msVal.toISOString().slice(0,10) : String(msVal);
      const b = swVal == null ? "" : (swVal instanceof Date ? swVal.toISOString().slice(0,10) : String(swVal));
      if (a !== b) { diff.push({ field, from: b || null, to: a }); idChanges[field] = msVal; }
    }
    maybeChange("display_name", ms.display_name, sw.display_name);
    maybeChange("initials",     ms.initials,     sw.initials);
    maybeChange("dob",          ms.dob,          sw.dob);
    maybeChange("gender",       ms.gender,       sw.gender);

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

    // ── Step 4: update user identity fields ────────────────────────────
    if (Object.keys(idChanges).length > 0) {
      const sets = Object.keys(idChanges).map(k => `\`${k}\` = ?`);
      const vals = Object.values(idChanges);
      vals.push(swimmerSub);
      await conn.query(
        `UPDATE \`users\` SET ${sets.join(", ")} WHERE \`sub\` = ?`,
        vals
      );
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
  return {
    id:                 Number(r.id),
    target_swimmer_sub: r.target_swimmer_sub,
    target_managed_id:  r.target_managed_id,
    author_coach_sub:   r.author_coach_sub,
    author_name:        r.author_name || null,
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
  const rows = await pool.query(
    "SELECT n.*, u.`display_name` AS author_name " +
    "FROM `coach_swimmer_notes` n " +
    "LEFT JOIN `users` u ON u.`sub` = n.`author_coach_sub` " +
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
  const rows = await pool.query(
    "SELECT n.*, u.`display_name` AS author_name " +
    "FROM `coach_swimmer_notes` n " +
    "LEFT JOIN `users` u ON u.`sub` = n.`author_coach_sub` " +
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
    notes:                 r.notes || null,
    created_at:            dtToIso(r.created_at),
    updated_at:            dtToIso(r.updated_at),
  };
}

function isYmd(s) { return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s); }

// Create a scheduled row in either payload mode (full pre-generated workout
// snapshot) OR intent mode (generator params only). Exactly one of payload /
// intentParams must be non-null — app-layer invariant per migration 025.
export async function dbCreateScheduledWorkout({ userSub, scheduledDate, payload = null, intentParams = null, notes = null }) {
  if (!userSub) return { ok: false, reason: "no_user" };
  if (!isYmd(scheduledDate)) return { ok: false, reason: "bad_date" };
  if ((payload == null) === (intentParams == null)) {
    return { ok: false, reason: "specify_exactly_one_of_payload_or_intent" };
  }
  if (payload != null && typeof payload !== "object") return { ok: false, reason: "bad_payload" };
  if (intentParams != null && typeof intentParams !== "object") return { ok: false, reason: "bad_intent_params" };
  if (notes && String(notes).length > 500) return { ok: false, reason: "notes_too_long" };
  const r = await pool.query(
    "INSERT INTO `scheduled_workouts` (`user_sub`, `scheduled_date`, `payload`, `intent_params`, `notes`) " +
    "VALUES (?, ?, ?, ?, ?)",
    [
      userSub, scheduledDate,
      payload != null ? JSON.stringify(payload) : null,
      intentParams != null ? JSON.stringify(intentParams) : null,
      notes || null,
    ]
  );
  return { ok: true, id: Number(r.insertId), mode: payload ? "payload" : "intent" };
}

export async function dbGetScheduledWorkout(id) {
  if (!id) return null;
  const rows = await pool.query(
    "SELECT * FROM `scheduled_workouts` WHERE `id` = ? LIMIT 1",
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
    "SELECT * FROM `scheduled_workouts` " +
    "WHERE `user_sub` = ? AND `scheduled_date` BETWEEN ? AND ? " +
    "ORDER BY `scheduled_date` ASC, `id` ASC",
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
  return rows.map(r => ({
    kind:           "group",
    id:             r.id,
    name:           r.name,
    current_phase:  r.current_phase,
    team_id:        r.team_id,
    team_name:      r.team_name,
    member_count:   Number(r.member_count),
  }));
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
  const rows = await pool.query(
    "SELECT wa.`id`, wa.`workout_id`, wa.`assigned_via_group_id`, wa.`assigned_via_lane_plan_id`, " +
    "       wa.`target_swimmer_sub`, wa.`target_managed_id`, wa.`lane_idx`, wa.`lane_label`, wa.`lane_pace`, " +
    "       wa.`assigned_at`, wa.`completion_state`, wa.`completed_at`, wa.`completed_by_coach_sub`, " +
    "       wa.`difficulty`, wa.`focus_note`, " +
    "       COALESCE(m.`display_name`, u.`display_name`) AS target_name, " +
    "       COALESCE(m.`initials`,     u.`initials`)     AS target_initials, " +
    "       g.`name`                                      AS group_name " +
    "FROM `workout_assignments` wa " +
    "LEFT JOIN `coach_managed_swimmers` m ON m.`id`  = wa.`target_managed_id` " +
    "LEFT JOIN `users` u                  ON u.`sub` = wa.`target_swimmer_sub` " +
    "LEFT JOIN `groups` g                 ON g.`id`  = wa.`assigned_via_group_id` " +
    "WHERE wa.`workout_id` = ? " +
    "ORDER BY target_name ASC",
    [String(workoutId)]
  );
  return rows.map(r => ({
    id:                       Number(r.id),
    workout_id:               r.workout_id,                                    // VARCHAR(32), keep as string
    assigned_via_group_id:    r.assigned_via_group_id,
    assigned_via_lane_plan_id: r.assigned_via_lane_plan_id,
    target_swimmer_sub:       r.target_swimmer_sub,
    target_managed_id:        r.target_managed_id,
    target_name:              r.target_name,
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
  const rows = await pool.query(
    "SELECT wa.`id`, wa.`workout_id`, wa.`assigned_via_group_id`, wa.`assigned_via_lane_plan_id`, " +
    "       wa.`lane_idx`, wa.`lane_label`, wa.`lane_pace`, wa.`assigned_at`, " +
    "       wa.`completion_state`, wa.`completed_at`, wa.`completed_by_coach_sub`, " +
    "       wa.`difficulty`, wa.`focus_note`, " +
    "       w.`saved_at`, w.`type`, w.`total_yards`, w.`pool_mode`, w.`payload`, " +
    "       w.`user_sub` AS coach_sub, " +
    "       g.`name`                                AS group_name, " +
    "       cu.`display_name`                       AS coach_name " +
    "FROM `workout_assignments` wa " +
    "JOIN `workouts` w  ON w.`id`  = wa.`workout_id` " +
    "LEFT JOIN `groups` g  ON g.`id`  = wa.`assigned_via_group_id` " +
    "LEFT JOIN `users` cu ON cu.`sub` = w.`user_sub` " +
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
    coach_name:               r.coach_name,
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
  const rows = await pool.query(
    "SELECT wa.`id`, wa.`workout_id`, wa.`assigned_via_lane_plan_id`, " +
    "       wa.`target_swimmer_sub`, wa.`target_managed_id`, " +
    "       wa.`lane_idx`, wa.`lane_label`, wa.`lane_pace`, " +
    "       wa.`assigned_at`, wa.`completion_state`, wa.`completed_at`, wa.`completed_by_coach_sub`, " +
    "       wa.`difficulty`, wa.`focus_note`, " +
    "       w.`type`, w.`total_yards`, w.`saved_at`, " +
    "       COALESCE(m.`display_name`, u.`display_name`) AS target_name " +
    "FROM `workout_assignments` wa " +
    "JOIN `workouts` w  ON w.`id`  = wa.`workout_id` " +
    "LEFT JOIN `coach_managed_swimmers` m ON m.`id`  = wa.`target_managed_id` " +
    "LEFT JOIN `users`                  u ON u.`sub` = wa.`target_swimmer_sub` " +
    "WHERE " + where.join(" AND ") + " " +
    "ORDER BY wa.`assigned_at` DESC, target_name ASC " +
    `LIMIT ${cap}`,
    vals
  );
  return rows.map(r => ({
    id:                       Number(r.id),
    workout_id:               r.workout_id,
    target_swimmer_sub:       r.target_swimmer_sub,
    target_managed_id:        r.target_managed_id,
    target_name:              r.target_name,
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
