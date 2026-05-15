// Swim Workout Generator — Node/Express server
//
// Reads/writes from MariaDB (vero_swimgen on the CyberPanel VM). All workout
// history, favorites, settings, sessions, audit events, and invite codes
// live in the database. See db.js for the schema and helpers.
//
// Endpoints:
//   GET  /                          → static page (public/index.html)
//   GET  /api/workouts              → list this user's workouts
//   POST /api/log-workout           → save a workout
//   PATCH  /api/workouts/:id        → update notes/dateCompleted/completed
//   DELETE /api/workouts/:id        → remove an entry
//   GET  /api/favorites             → list favorited main-set labels
//   POST /api/favorites             → add a label
//   DELETE /api/favorites/:label    → remove a label
//   GET  /api/favorite-sets         → list favorited set IDs (per-user)
//   POST /api/favorite-sets         → add a set ID
//   DELETE /api/favorite-sets/:id   → remove a set ID
//   GET  /api/settings              → user prefs (slider bounds, pace input)
//   POST /api/settings              → update prefs
//   GET  /healthz                   → liveness probe
//
//   GET  /api/auth/apple            → redirect to Apple sign-in
//                                     supports ?invite=CODE for new users
//   POST /api/auth/callback         → Apple posts back here (form_post)
//   POST /api/auth/native           → iOS native sign-in
//   GET  /api/auth/status           → { authenticated: bool }
//   GET  /api/auth/csrf             → returns CSRF token for current session
//   GET  /api/auth/sessions         → list this user's active sessions
//   POST /api/auth/signout-all-others → revoke all sessions except current
//   GET  /api/auth/signout          → revoke current session, redirect /
//
// Required env vars:
//   DB_HOST, DB_USER, DB_PASSWORD   — see db.js for the full list
//
// Apple Sign-In env vars (all required when Apple auth is active):
//   APPLE_TEAM_ID            — 10-char team ID from Apple Developer console
//   APPLE_CLIENT_ID          — Services ID you registered (e.g. com.example.swimapp)
//   APPLE_NATIVE_BUNDLE_ID   — iOS app bundle ID; falls back to APPLE_CLIENT_ID if not set.
//   APPLE_KEY_ID             — Key ID of the .p8 private key
//   APPLE_PRIVATE_KEY        — Contents of the .p8 file (newlines as \n or literal)
//
// Other env vars:
//   PORT             — listen port (default: 8080, Hyperlift sets this)
//   APP_URL          — Public HTTPS URL (default: https://veronicacassidy.com)
//   ALLOW_NO_ORIGIN  — "true" to allow curl/local testing without Origin header

import express   from "express";
import crypto    from "crypto";
import path      from "path";
import helmet    from "helmet";
import rateLimit from "express-rate-limit";
import { fileURLToPath } from "url";

import {
  dbActive, pingDb,
  dbListWorkouts, dbWorkoutExists, dbInsertWorkout, dbGetWorkout, dbPatchWorkout, dbDeleteWorkout,
  dbGetSettings, dbUpsertSettings, dbPatchSettingsExtra,
  dbListFavorites, dbAddFavorite, dbRemoveFavorite,
  dbListFavoriteSets, dbAddFavoriteSet, dbRemoveFavoriteSet,
  dbListGoals, dbSetGoal, dbDeleteGoal,
  dbInsertFeedback, dbAdminListFeedback, dbAdminUpdateFeedback,
  dbIsUser, dbIsAdmin, dbIsCoach, dbConsumeInviteCode, dbEnsureUser, dbAuditEvent, dbGetMe, dbUpdateMe,
  dbAdminListUsers, dbAdminSetUserFlag, dbAdminUpdateUser, dbAdminDeleteUser,
  dbAdminListInvites, dbAdminCreateInvite, dbAdminDeleteInvite,
  dbAdminListAuditEvents,
  dbCreateSession, dbGetSession, dbTouchSession,
  dbRevokeSession, dbRevokeSessionByPrefix, dbRevokeOthersByUser, dbListSessions,
  dbGetOrCreateCsrf, dbVerifyCsrf,
} from "./db.js";

// Helper for audit events — pulls IP/UA off the request consistently
function reqMeta(req) {
  return {
    ip:        req.ip || req.get("X-Forwarded-For")?.split(",")[0]?.trim() || null,
    userAgent: req.get("User-Agent") || null,
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const PORT     = process.env.PORT     || 8080;
const APP_URL  = process.env.APP_URL  || "https://veronicacassidy.com";
// S5 S1 — when this is true the boot code refuses to start without Apple auth.
// Hyperlift's container build sets NODE_ENV=production; local dev usually leaves
// it unset / set to "development".
const IS_PROD  = process.env.NODE_ENV === "production";

// Apple Sign-In config — all empty until configured in Hyperlift
const APPLE_TEAM_ID      = process.env.APPLE_TEAM_ID      || "";
const APPLE_CLIENT_ID    = process.env.APPLE_CLIENT_ID    || "";
const APPLE_KEY_ID       = process.env.APPLE_KEY_ID       || "";
// .p8 files use literal newlines; some platforms encode them as \n
const APPLE_PRIVATE_KEY  = (process.env.APPLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

const APPLE_AUTH_ACTIVE = !!(APPLE_CLIENT_ID && APPLE_TEAM_ID && APPLE_KEY_ID && APPLE_PRIVATE_KEY);

const app = express();

// Trust Hyperlift's reverse proxy so req.ip resolves to the real client.
// '1' = trust the first hop only.
app.set("trust proxy", 1);

// Security headers. CSP is intentionally disabled — the app uses inline scripts
// throughout public/index.html, and a strict CSP needs careful crafting before
// it can be enabled. Other helmet defaults (HSTS, X-Frame-Options, X-Content-
// Type-Options, Referrer-Policy, etc.) are on.
app.use(helmet({
  contentSecurityPolicy: false,
}));

// S5 S6 — body limit. Workouts are typically <50kb (4 blocks × ~10 sets each
// + payload JSON); feedback / profile patches are <5kb. 100kb gives ~2× headroom
// without enabling pathological payloads. If a future feature needs more, raise
// it per-route rather than globally.
app.use(express.json({ limit: "100kb" }));

// ───── Rate limiters ──────────────────────────────────────────────────
// Auth: 10/min/IP. Catches brute-force probes against /api/auth/*.
const authLimiter = rateLimit({
  windowMs:         60 * 1000,
  limit:            10,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: "too many auth requests, try again later" },
  handler: (req, res, _next, options) => {
    dbAuditEvent({
      eventType: "rate_limit.hit",
      ...reqMeta(req),
      details:   { scope: "auth", path: req.path, limit: options.limit, window_ms: options.windowMs },
    });
    res.status(options.statusCode).json(options.message);
  },
});

// Writes: 30/min keyed on userSub (falls back to IP for pre-auth). Catches
// authenticated abuse without trying to police per-IP traffic.
const writeLimiter = rateLimit({
  windowMs:         60 * 1000,
  limit:            30,
  standardHeaders:  true,
  legacyHeaders:    false,
  keyGenerator:     (req) => req.userSub || req.ip,
  message:          { error: "too many requests, try again later" },
  handler: (req, res, _next, options) => {
    dbAuditEvent({
      userSub:   req.userSub || null,
      eventType: "rate_limit.hit",
      ...reqMeta(req),
      details:   { scope: "write", path: req.path, method: req.method, limit: options.limit, window_ms: options.windowMs },
    });
    res.status(options.statusCode).json(options.message);
  },
});

// ───── Cookie helper ─────────────────────────────────────────────────
function getCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const eq = part.trim().indexOf("=");
    if (eq === -1) continue;
    const k = part.trim().slice(0, eq);
    if (k === name) return decodeURIComponent(part.trim().slice(eq + 1));
  }
  return null;
}

// ───── Session helpers (stateful — sessions table is source of truth) ─────────
const SESSION_COOKIE  = "swim_session";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

// Resolve a cookie/Bearer value to an active session row.
// Returns { id, user_sub, ... } or null if the session is missing/expired/revoked.
async function resolveSession(value) {
  if (!value) return null;
  try {
    return await dbGetSession(value);
  } catch (err) {
    console.warn("[auth] dbGetSession failed:", err.message);
    return null;
  }
}

// ───── Apple Sign-In helpers ─────────────────────────────────────────
let appleJwksCache = { keys: null, fetchedAt: 0 };
const JWKS_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getApplePublicKey(kid) {
  if (!appleJwksCache.keys || Date.now() - appleJwksCache.fetchedAt > JWKS_TTL_MS) {
    const res = await fetch("https://appleid.apple.com/auth/keys");
    if (!res.ok) throw new Error("Failed to fetch Apple JWKS");
    appleJwksCache = { keys: (await res.json()).keys, fetchedAt: Date.now() };
  }
  const jwk = appleJwksCache.keys.find(k => k.kid === kid);
  if (!jwk) throw new Error(`Apple JWKS: no key with kid=${kid}`);
  return crypto.createPublicKey({ key: jwk, format: "jwk" })
    .export({ type: "spki", format: "pem" });
}

async function verifyAppleIdToken(idToken, expectedAud = APPLE_CLIENT_ID) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Malformed id_token");
  const [headerB64, payloadB64, sigB64] = parts;

  const header  = JSON.parse(Buffer.from(headerB64,  "base64url").toString());
  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());

  // Verify signature with Apple's public key
  const pem = await getApplePublicKey(header.kid);
  const ok  = crypto.createVerify("SHA256")
    .update(`${headerB64}.${payloadB64}`)
    .verify(pem, Buffer.from(sigB64, "base64url"));
  if (!ok) throw new Error("id_token signature invalid");

  // Verify standard claims
  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== "https://appleid.apple.com") throw new Error("Wrong issuer");
  if (payload.aud !== expectedAud)                 throw new Error("Wrong audience");
  if (payload.exp < now)                           throw new Error("Token expired");

  return payload;
}

// ───── Auth middleware ───────────────────────────────────────────────
// When Apple auth is active: require a valid session cookie (web) or Bearer token (native).
// When not active: open mode — writes are unrestricted (same-origin guard still applies).
//
// With DB active, also verify the sub is in `users` and not disabled, so revoking
// access (setting users.is_disabled = 1) locks the user out within one request.
// Fails closed (503) on DB lookup error to avoid bypassing authz on transient DB issues.
async function requireAuth(req, res, next) {
  if (!APPLE_AUTH_ACTIVE) return next();
  const cookieVal  = getCookie(req, SESSION_COOKIE);
  const authHeader = req.get("Authorization") || "";
  const bearerVal  = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const sessionVal = cookieVal || bearerVal;

  const session = await resolveSession(sessionVal);
  if (!session) return res.status(401).json({ error: "not authenticated" });
  const sub = session.user_sub;

  if (dbActive) {
    try {
      const exists = await dbIsUser(sub);
      if (!exists) {
        dbAuditEvent({ userSub: sub, eventType: "auth.disabled_attempt", ...reqMeta(req), details: { path: req.path, method: req.method } });
        return res.status(403).json({ error: "not authorized" });
      }
    } catch (err) {
      console.warn("[auth] dbIsUser failed:", err.message);
      return res.status(503).json({ error: "auth backend unavailable" });
    }
  }

  // Refresh last_seen + ip; fire and forget (don't block the request)
  dbTouchSession(session.id, reqMeta(req).ip).catch(() => {});

  req.userSub    = sub;
  req.sessionId  = session.id;
  next();
}

// Admin middleware — requires the authenticated user to have is_admin = 1.
// Must be applied AFTER requireAuth (which sets req.userSub).
async function requireAdmin(req, res, next) {
  try {
    if (!(await dbIsAdmin(req.userSub))) {
      dbAuditEvent({ userSub: req.userSub, eventType: "admin.access_denied", ...reqMeta(req), details: { path: req.path, method: req.method } });
      return res.status(403).json({ error: "admin only" });
    }
  } catch (err) {
    return res.status(503).json({ error: "auth backend unavailable" });
  }
  next();
}

// Coach middleware — requires the authenticated user to have is_coach = 1
// OR is_admin = 1 (admins implicitly inherit coach access). Used to gate
// the in-app workout-bank catalog (Phase I read-only). Must be applied
// AFTER requireAuth.
async function requireCoach(req, res, next) {
  try {
    if (!(await dbIsCoach(req.userSub))) {
      dbAuditEvent({ userSub: req.userSub, eventType: "coach.access_denied", ...reqMeta(req), details: { path: req.path, method: req.method } });
      return res.status(403).json({ error: "coach access required" });
    }
  } catch (err) {
    return res.status(503).json({ error: "auth backend unavailable" });
  }
  next();
}

// CSRF middleware — required on cookie-authenticated writes.
// Bearer-token requests (native iOS) are CSRF-safe and skip the check.
async function requireCsrf(req, res, next) {
  const authHeader = req.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) return next();
  if (!req.sessionId) return res.status(403).json({ error: "no session" });
  const supplied = req.get("X-CSRF-Token");
  if (!supplied) {
    dbAuditEvent({ userSub: req.userSub, eventType: "csrf.reject", ...reqMeta(req), details: { path: req.path, method: req.method, reason: "missing_header" } });
    return res.status(403).json({ error: "csrf token required" });
  }
  try {
    if (!(await dbVerifyCsrf(req.sessionId, supplied))) {
      dbAuditEvent({ userSub: req.userSub, eventType: "csrf.reject", ...reqMeta(req), details: { path: req.path, method: req.method, reason: "mismatch" } });
      return res.status(403).json({ error: "invalid csrf token" });
    }
  } catch (err) {
    console.warn("[csrf] verify failed:", err.message);
    return res.status(503).json({ error: "auth backend unavailable" });
  }
  next();
}


// ───── Same-origin guard ─────────────────────────────────────────────
function checkOrigin(req, res, next) {
  // Native app requests carry a Bearer token and no Origin header. Browsers
  // don't auto-send Authorization headers cross-origin (CORS preflight is required),
  // so a request with a Bearer header didn't originate from a cross-site form/script
  // — no CSRF risk here. The bearer is then validated downstream by requireAuth.
  const authHeader = req.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) return next();

  const origin = req.get("Origin") || req.get("Referer") || "";
  const host   = req.get("Host") || "";
  if (origin) {
    try {
      if (new URL(origin).host === host) return next();
    } catch { /* malformed */ }
  } else if (process.env.ALLOW_NO_ORIGIN === "true") {
    return next();
  }
  return res.status(403).json({ error: "forbidden: cross-origin request" });
}

// ───── Apple auth routes ─────────────────────────────────────────────

// Redirect user to Apple's authorization endpoint.
// Optional ?invite=CODE is embedded in the OAuth state for new-user onboarding.
app.get("/api/auth/apple", authLimiter, (req, res) => {
  if (!APPLE_AUTH_ACTIVE) return res.status(404).send("Apple auth not configured");
  const csrf   = crypto.randomBytes(16).toString("hex");
  const invite = (req.query.invite || "").toString().trim().slice(0, 32);
  // Period separates csrf from invite — neither component contains '.'
  const state  = invite ? `${csrf}.${invite}` : csrf;
  res.setHeader("Set-Cookie",
    `oauth_state=${state}; HttpOnly; Secure; SameSite=None; Max-Age=300; Path=/`
  );
  const params = new URLSearchParams({
    client_id:     APPLE_CLIENT_ID,
    redirect_uri:  `${APP_URL}/api/auth/callback`,
    response_type: "code id_token",
    response_mode: "form_post",
    scope:         "email",
    state,
  });
  res.redirect(`https://appleid.apple.com/auth/authorize?${params}`);
});

// Apple posts form data here after user authenticates
app.post("/api/auth/callback", authLimiter, express.urlencoded({ extended: false }), async (req, res) => {
  const meta = reqMeta(req);
  const fail = (reason, userSub = null) => {
    dbAuditEvent({ userSub, eventType: "auth.login.reject", ...meta, details: { reason, channel: "web" } });
    res.redirect(`/?auth=error&reason=${encodeURIComponent(reason)}`);
  };
  try {
    const { id_token, state, error } = req.body;
    if (error) return fail(error);

    const storedState = getCookie(req, "oauth_state");
    res.setHeader("Set-Cookie",
      `oauth_state=; HttpOnly; Secure; SameSite=None; Max-Age=0; Path=/`
    );
    if (!storedState || storedState !== state) return fail("state_mismatch");
    if (!id_token) return fail("missing_id_token");

    const payload = await verifyAppleIdToken(id_token);
    const sub = payload.sub;
    console.log(`[auth] Apple login: sub=${sub}`);

    const dotIdx = state.indexOf(".");
    const invite = dotIdx > 0 ? state.slice(dotIdx + 1) : null;

    const isExisting = await dbIsUser(sub);
    if (!isExisting) {
      const result = await dbConsumeInviteCode(invite);
      if (!result.ok) {
        console.warn(`[auth] Reject new sub ${sub}: invite ${result.reason}`);
        return fail(`invite_${result.reason}`, sub);
      }
      await dbEnsureUser(sub);
      console.log(`[auth] New user created via invite: sub=${sub}`);
      dbAuditEvent({ userSub: sub, eventType: "invite.consume", ...meta, details: { code: invite, channel: "web" } });
      dbAuditEvent({ userSub: sub, eventType: "auth.signup",    ...meta, details: { channel: "web" } });
    }

    const sessionId = await dbCreateSession({
      userSub:    sub,
      ip:         meta.ip,
      userAgent:  meta.userAgent,
      ttlSeconds: SESSION_MAX_AGE,
    });
    res.setHeader("Set-Cookie",
      `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}; Path=/`
    );
    dbAuditEvent({ userSub: sub, eventType: "auth.login.success", ...meta, details: { channel: "web" } });
    res.redirect("/");
  } catch (err) {
    console.error("[auth/callback]", err.message);
    fail("server_error");
  }
});

// Check whether the current request is authenticated.
// Looks up the session in the sessions table + verifies user not disabled.
app.get("/api/auth/status", async (req, res) => {
  if (!APPLE_AUTH_ACTIVE) return res.json({ authenticated: true, mode: "open" });
  const session = await resolveSession(getCookie(req, SESSION_COOKIE));
  if (!session) return res.json({ authenticated: false });
  if (dbActive) {
    try {
      if (!(await dbIsUser(session.user_sub))) return res.json({ authenticated: false, reason: "not_authorized" });
    } catch (err) {
      console.warn("[auth/status] dbIsUser failed:", err.message);
      return res.json({ authenticated: false, reason: "auth_backend_error" });
    }
  }
  res.json({ authenticated: true });
});

// Return the CSRF token bound to the current session. Frontend fetches this
// after auth and includes it as X-CSRF-Token on every write request.
// No checkOrigin: GET doesn't change state, and CORS/SOP prevents cross-origin
// reads of the response body. requireAuth is the gate.
app.get("/api/auth/csrf", requireAuth, async (req, res) => {
  try {
    const token = await dbGetOrCreateCsrf(req.sessionId);
    if (!token) return res.status(401).json({ error: "no session" });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Return the authenticated user's profile + workout stats. Used by the Profile UI.
// No checkOrigin: GET, no state change, CORS/SOP prevents cross-origin reads.
app.get("/api/me", requireAuth, async (req, res) => {
  try {
    const me = await dbGetMe(req.userSub);
    if (!me) return res.status(404).json({ error: "user not found" });
    res.json(me);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Self-serve profile editing — display_name, email, initials. Same
// validation rules as the admin path. Changing email also resets
// email_verified (handled in dbUpdateMe).
app.patch("/api/me", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const allowed = ["email", "display_name", "initials"];
    const patch = {};
    for (const k of allowed) if (k in (req.body || {})) patch[k] = req.body[k];
    if ("email" in patch && patch.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(patch.email)) {
      return res.status(400).json({ error: "bad email format" });
    }
    if ("display_name" in patch && patch.display_name && String(patch.display_name).length > 120) {
      return res.status(400).json({ error: "display_name max 120 chars" });
    }
    if ("initials" in patch && patch.initials && String(patch.initials).length > 8) {
      return res.status(400).json({ error: "initials max 8 chars" });
    }
    const r = await dbUpdateMe(req.userSub, patch);
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "user.profile.update",
      ...reqMeta(req),
      details:   { fields: Object.keys(patch) },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// ───── Admin routes ──────────────────────────────────────────────────
// All require: authenticated user with is_admin = 1.
// Writes additionally require CSRF token.

app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
  try { res.json(await dbAdminListUsers()); }
  catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.patch("/api/admin/users/:sub", checkOrigin, requireAuth, requireAdmin, requireCsrf, async (req, res) => {
  try {
    const allowed = ["email", "initials", "display_name"];
    const patch = {};
    for (const k of allowed) if (k in (req.body || {})) patch[k] = req.body[k];
    if ("email" in patch && patch.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(patch.email)) {
      return res.status(400).json({ error: "bad email format" });
    }
    if ("initials" in patch && patch.initials && String(patch.initials).length > 8) {
      return res.status(400).json({ error: "initials max 8 chars" });
    }
    if ("display_name" in patch && patch.display_name && String(patch.display_name).length > 120) {
      return res.status(400).json({ error: "display_name max 120 chars" });
    }
    const r = await dbAdminUpdateUser(req.params.sub, patch);
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "admin.user.update",
      ...reqMeta(req),
      details:   { target_sub: req.params.sub, fields: Object.keys(patch) },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.post("/api/admin/users/:sub/disable", checkOrigin, requireAuth, requireAdmin, requireCsrf, async (req, res) => {
  try {
    if (req.params.sub === req.userSub) return res.status(400).json({ error: "cannot disable self" });
    const r = await dbAdminSetUserFlag(req.params.sub, "is_disabled", true);
    dbAuditEvent({ userSub: req.userSub, eventType: "admin.user.disable", ...reqMeta(req), details: { target_sub: req.params.sub } });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.post("/api/admin/users/:sub/enable", checkOrigin, requireAuth, requireAdmin, requireCsrf, async (req, res) => {
  try {
    const r = await dbAdminSetUserFlag(req.params.sub, "is_disabled", false);
    dbAuditEvent({ userSub: req.userSub, eventType: "admin.user.enable", ...reqMeta(req), details: { target_sub: req.params.sub } });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Coach role toggle — body { granted: true|false }. Admins implicitly have
// coach capability via dbIsCoach, so toggling this is mainly for non-admin
// users who should be able to browse the workout-bank catalog.
app.post("/api/admin/users/:sub/coach", checkOrigin, requireAuth, requireAdmin, requireCsrf, async (req, res) => {
  try {
    const granted = !!(req.body && req.body.granted);
    const r = await dbAdminSetUserFlag(req.params.sub, "is_coach", granted);
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: granted ? "admin.user.coach.grant" : "admin.user.coach.revoke",
      ...reqMeta(req),
      details:   { target_sub: req.params.sub },
    });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.delete("/api/admin/users/:sub", checkOrigin, requireAuth, requireAdmin, requireCsrf, async (req, res) => {
  try {
    if (req.params.sub === req.userSub) return res.status(400).json({ error: "cannot delete self" });
    const r = await dbAdminDeleteUser(req.params.sub);
    dbAuditEvent({ userSub: req.userSub, eventType: "admin.user.delete", ...reqMeta(req), details: { target_sub: req.params.sub, affected: r.affected } });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.get("/api/admin/invites", requireAuth, requireAdmin, async (req, res) => {
  try { res.json(await dbAdminListInvites()); }
  catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.post("/api/admin/invites", checkOrigin, requireAuth, requireAdmin, requireCsrf, async (req, res) => {
  try {
    const { note = null, maxUses = 1, expiresAt = null } = req.body || {};
    const code = await dbAdminCreateInvite({ note, maxUses, expiresAt, createdBy: req.userSub });
    dbAuditEvent({ userSub: req.userSub, eventType: "admin.invite.create", ...reqMeta(req), details: { code, maxUses, expiresAt, note } });
    res.json({ ok: true, code });
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.delete("/api/admin/invites/:code", checkOrigin, requireAuth, requireAdmin, requireCsrf, async (req, res) => {
  try {
    const r = await dbAdminDeleteInvite(req.params.code);
    dbAuditEvent({ userSub: req.userSub, eventType: "admin.invite.delete", ...reqMeta(req), details: { code: req.params.code, affected: r.affected } });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.get("/api/admin/audit-events", requireAuth, requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit || "100", 10)));
    const offset = Math.max(0, parseInt(req.query.offset || "0", 10));
    const events = await dbAdminListAuditEvents({
      limit, offset,
      eventType: req.query.event_type || null,
      userSub:   req.query.user_sub   || null,
    });
    res.json(events);
  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Native iOS Sign in with Apple — accepts an identityToken from ASAuthorizationAppleIDCredential,
// verifies it, and returns a session token the app stores in Keychain and sends as Bearer.
app.post("/api/auth/native", authLimiter, async (req, res) => {
  if (!APPLE_AUTH_ACTIVE) return res.status(404).json({ error: "Apple auth not configured" });
  const meta = reqMeta(req);
  try {
    const { identityToken, inviteCode } = req.body || {};
    if (!identityToken || typeof identityToken !== "string")
      return res.status(400).json({ error: "identityToken required" });
    const nativeAud = process.env.APPLE_NATIVE_BUNDLE_ID || APPLE_CLIENT_ID;
    const payload = await verifyAppleIdToken(identityToken, nativeAud);
    const sub = payload.sub;
    console.log(`[auth/native] Apple login: sub=${sub}`);

    const isExisting = await dbIsUser(sub);
    if (!isExisting) {
      const result = await dbConsumeInviteCode(inviteCode);
      if (!result.ok) {
        console.warn(`[auth/native] Reject new sub ${sub}: invite ${result.reason}`);
        dbAuditEvent({ userSub: sub, eventType: "auth.login.reject", ...meta, details: { reason: `invite_${result.reason}`, channel: "native" } });
        return res.status(403).json({ error: `invite_${result.reason}` });
      }
      await dbEnsureUser(sub);
      console.log(`[auth/native] New user created via invite: sub=${sub}`);
      dbAuditEvent({ userSub: sub, eventType: "invite.consume", ...meta, details: { code: inviteCode, channel: "native" } });
      dbAuditEvent({ userSub: sub, eventType: "auth.signup",    ...meta, details: { channel: "native" } });
    }
    const token = await dbCreateSession({
      userSub:    sub,
      ip:         meta.ip,
      userAgent:  meta.userAgent,
      ttlSeconds: SESSION_MAX_AGE,
    });
    dbAuditEvent({ userSub: sub, eventType: "auth.login.success", ...meta, details: { channel: "native" } });
    res.json({ ok: true, token });
  } catch (err) {
    console.error("[auth/native]", err.message);
    res.status(401).json({ error: err.message });
  }
});

// Revoke current session and clear the cookie
app.get("/api/auth/signout", async (req, res) => {
  const cookieVal = getCookie(req, SESSION_COOKIE);
  const session = await resolveSession(cookieVal);
  if (session) {
    await dbRevokeSession(session.id);
    dbAuditEvent({ userSub: session.user_sub, eventType: "auth.signout", ...reqMeta(req) });
  }
  res.setHeader("Set-Cookie",
    `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/`
  );
  res.redirect("/");
});

// List the authenticated user's active sessions. No checkOrigin (GET, no state change, SOP protects response).
app.get("/api/auth/sessions", requireAuth, async (req, res) => {
  try {
    const sessions = await dbListSessions(req.userSub);
    const withCurrent = sessions.map(s => ({
      ...s,
      is_current: req.sessionId && req.sessionId.startsWith(s.id_prefix),
    }));
    res.json(withCurrent);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Revoke a single session by id prefix, scoped to the current user.
// Refuses to revoke the current session — use /api/auth/signout for that.
app.delete("/api/auth/sessions/:prefix", checkOrigin, requireAuth, requireCsrf, async (req, res) => {
  try {
    const prefix = String(req.params.prefix || "").trim();
    if (req.sessionId && req.sessionId.startsWith(prefix)) {
      return res.status(400).json({ error: "cannot revoke current session via this endpoint" });
    }
    const r = await dbRevokeSessionByPrefix(req.userSub, prefix);
    if (!r.ok) return res.status(404).json({ error: r.reason });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "auth.signout.session",
      ...reqMeta(req),
      details:   { prefix, revoked_id: r.revoked },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Revoke all other sessions for the current user (keeps current alive)
app.post("/api/auth/signout-all-others", checkOrigin, requireAuth, async (req, res) => {
  try {
    const count = await dbRevokeOthersByUser(req.userSub, req.sessionId);
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "auth.signout.others",
      ...reqMeta(req),
      details:   { revoked_count: count },
    });
    res.json({ ok: true, revoked: count });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ───── API routes ────────────────────────────────────────────────────
// S5 S2 — /healthz now probes the DB (when configured) so Hyperlift's health
// check distinguishes "Node process is alive" from "Node process is alive AND
// can serve API traffic." When DB is not configured (dev mode), returns ok with
// db: "not_configured" so local testing isn't blocked.
app.get("/healthz", async (req, res) => {
  const base = { ok: true, service: "swim-workout-generator" };
  if (!dbActive) return res.json({ ...base, db: "not_configured" });
  try {
    const r = await pingDb();
    return res.json({ ...base, db: r.ok ? "ok" : "unknown" });
  } catch (err) {
    return res.status(503).json({ ok: false, service: "swim-workout-generator", db: "unreachable", error: err.message || String(err) });
  }
});

app.get("/api/workouts", requireAuth, async (req, res) => {
  try {
    const entries = await dbListWorkouts(req.userSub);
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Allowed enum values for workout entries — kept here (not imported) because
// server.js is the validation boundary for /api/log-workout.
const VALID_WORKOUT_TYPES = new Set([
  "im", "distance", "sprint", "endurance", "technique", "mixed", "back", "breast", "fly",
]);
const VALID_POOL_MODES   = new Set(["25y", "25m", "50m"]);
const REQUIRED_SECTIONS  = ["warmup", "drill", "main", "cooldown"];

// Validate a workout entry's required shape. Extras are allowed (they get
// jammed into payload JSON by db.entryToWorkoutRow). Returns null on success
// or a string describing the first failure.
function validateWorkoutEntry(entry) {
  if (!entry || typeof entry !== "object")             return "entry must be an object";
  if (typeof entry.id !== "string" || !entry.id)       return "entry.id (string) required";
  if (!VALID_WORKOUT_TYPES.has(entry.type))            return `entry.type must be one of: ${[...VALID_WORKOUT_TYPES].join(", ")}`;
  if (!Number.isFinite(entry.totalYards) || entry.totalYards <= 0)
                                                       return "entry.totalYards must be a positive number";
  if (!VALID_POOL_MODES.has(entry.poolMode))           return `entry.poolMode must be one of: ${[...VALID_POOL_MODES].join(", ")}`;
  if (!Array.isArray(entry.blocks) || entry.blocks.length !== 4)
                                                       return "entry.blocks must be an array of 4 sections (warmup, drill, main, cooldown)";
  for (let i = 0; i < REQUIRED_SECTIONS.length; i++) {
    const b = entry.blocks[i];
    if (!b || typeof b !== "object")                   return `entry.blocks[${i}] must be an object`;
    if (b.section !== REQUIRED_SECTIONS[i])            return `entry.blocks[${i}].section must be "${REQUIRED_SECTIONS[i]}" (got "${b.section}")`;
    if (!Array.isArray(b.sets) || b.sets.length === 0) return `entry.blocks[${i}].sets must be a non-empty array`;
  }
  return null;
}

app.post("/api/log-workout", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const entry = req.body;
    // F3 — minimal-shape validation. Required fields must be present and well-typed.
    // Anything else is allowed and ends up in the payload JSON via entryToWorkoutRow.
    const validationError = validateWorkoutEntry(entry);
    if (validationError) return res.status(400).json({ error: validationError });
    // Per the user_sub policy: new writes must be attributed to a user.
    // Open-mode (APPLE_AUTH_ACTIVE=false) has no userSub and is rejected here.
    // Existing legacy rows with user_sub IS NULL are preserved by dbListWorkouts.
    if (!req.userSub) return res.status(401).json({ error: "user_sub required for new writes" });
    entry.sub = req.userSub;
    if (await dbWorkoutExists(entry.id)) {
      return res.status(409).json({ error: "duplicate id", id: entry.id });
    }
    await dbInsertWorkout(entry);
    // F1 — read-back: return the DB's view of the row, not the client's payload.
    // This ensures the client's optimistic state replacement reflects any
    // server-side coercion (defaults, JSON round-tripping, type narrowing).
    const stored = await dbGetWorkout(entry.id);
    res.json({ ok: true, id: entry.id, entry: stored || entry });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.patch("/api/workouts/:id", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const patch  = req.body || {};
    const r = await dbPatchWorkout(id, patch, req.userSub);
    if (!r.ok) return res.status(r.status).json({ error: r.reason, id });
    res.json({ ok: true, entry: r.entry });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.delete("/api/workouts/:id", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const r = await dbDeleteWorkout(id, req.userSub);
    if (!r.ok) return res.status(r.status).json({ error: r.reason, id });
    dbAuditEvent({ userSub: req.userSub, eventType: "workout.delete", ...reqMeta(req), details: { id } });
    res.json({ ok: true, removed: r.removed });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ───── User settings routes ──────────────────────────────────────────
app.get("/api/settings", requireAuth, async (req, res) => {
  try {
    res.json(await dbGetSettings(req.userSub));
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post("/api/settings", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    await dbUpsertSettings(req.userSub, req.body || {});
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Merge-patch `settings.extra` (JSON blob). Keys with null value are deleted.
// Currently used by item Q (next-event countdown).
app.post("/api/settings/extra", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const patch = req.body || {};
    if (typeof patch !== "object" || Array.isArray(patch)) {
      return res.status(400).json({ error: "object body required" });
    }
    // Validate next_event shape if present.
    if ("next_event" in patch && patch.next_event !== null) {
      const ev = patch.next_event;
      if (typeof ev !== "object" || typeof ev.name !== "string" || typeof ev.date !== "string") {
        return res.status(400).json({ error: "next_event must be { name, date }" });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ev.date)) {
        return res.status(400).json({ error: "next_event.date must be YYYY-MM-DD" });
      }
      if (ev.name.length > 80) {
        return res.status(400).json({ error: "next_event.name max 80 chars" });
      }
    }
    // Validate phase enum if present (N5).
    if ("phase" in patch && patch.phase !== null) {
      const allowed = ["base", "build", "peak", "taper", "recovery"];
      if (typeof patch.phase !== "string" || !allowed.includes(patch.phase)) {
        return res.status(400).json({ error: "phase must be one of: " + allowed.join(", ") });
      }
    }
    await dbPatchSettingsExtra(req.userSub, patch);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ───── Favorites routes (per-user) ───────────────────────────────────
app.get("/api/favorites", requireAuth, async (req, res) => {
  try {
    res.json(await dbListFavorites(req.userSub));
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post("/api/favorites", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const { label } = req.body || {};
    if (!label || typeof label !== "string") return res.status(400).json({ error: "label required" });
    await dbAddFavorite(req.userSub, label);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.delete("/api/favorites/:label", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const label = decodeURIComponent(req.params.label);
    await dbRemoveFavorite(req.userSub, label);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ───── Set-level favorites (set IDs from assign_set_ids.py) ────────────
app.get("/api/favorite-sets", requireAuth, async (req, res) => {
  try {
    res.json(await dbListFavoriteSets(req.userSub));
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post("/api/favorite-sets", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const { setId } = req.body || {};
    if (!setId || typeof setId !== "string") return res.status(400).json({ error: "setId required" });
    await dbAddFavoriteSet(req.userSub, setId);
    res.json({ ok: true });
  } catch (err) {
    // dbAddFavoriteSet throws on bad ID format; surface as 400 not 500.
    if (/bad set_id format/.test(err.message)) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.delete("/api/favorite-sets/:id", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const setId = decodeURIComponent(req.params.id);
    await dbRemoveFavoriteSet(req.userSub, setId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ───── Goals ──────────────────────────────────────────────────────────
// Recurring goals only (period_start = NULL). One active goal per metric.
// Allowed metrics: workouts_per_week | yards_per_week | yards_per_month.
app.get("/api/goals", requireAuth, async (req, res) => {
  try {
    res.json(await dbListGoals(req.userSub));
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post("/api/goals", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const { metric, target_value } = req.body || {};
    if (!metric || typeof metric !== "string") return res.status(400).json({ error: "metric required" });
    if (target_value == null) return res.status(400).json({ error: "target_value required" });
    await dbSetGoal(req.userSub, metric, target_value);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message || String(err) });
  }
});

app.delete("/api/goals/:metric", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const metric = decodeURIComponent(req.params.metric);
    await dbDeleteGoal(req.userSub, metric);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ───── Feedback (Session 5) ───────────────────────────────────────────
// User submission. category + subject + body required. page + user_agent
// auto-captured client-side. Logs a `feedback.submit` audit event.
app.post("/api/feedback", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const { category, subject, body, page, user_agent } = req.body || {};
    const r = await dbInsertFeedback({
      userSub:   req.userSub,
      category,
      subject,
      body,
      page,
      userAgent: user_agent || req.get("user-agent"),
    });
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "feedback.submit",
      ...reqMeta(req),
      details:   { feedback_id: r.id, category },
    });
    res.json({ ok: true, id: r.id });
  } catch (err) {
    res.status(400).json({ error: err.message || String(err) });
  }
});

// Admin: list feedback (default filter: status=new). Optional ?status= and ?user_sub=.
app.get("/api/admin/feedback", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status, user_sub } = req.query;
    res.json(await dbAdminListFeedback({ status, userSub: user_sub }));
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Admin: update status and/or admin_note. Stamps reviewer/reviewed_at when
// status transitions out of "new". Logs admin.feedback.update.
app.patch("/api/admin/feedback/:id", checkOrigin, requireAuth, requireAdmin, requireCsrf, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad id" });
    const { status, admin_note } = req.body || {};
    const r = await dbAdminUpdateFeedback(id, { status, admin_note }, req.userSub);
    dbAuditEvent({
      userSub:   req.userSub,
      eventType: "admin.feedback.update",
      ...reqMeta(req),
      details:   { feedback_id: id, status, has_note: admin_note != null },
    });
    res.json(r);
  } catch (err) {
    res.status(400).json({ error: err.message || String(err) });
  }
});

// ───── Static files ───────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public"), {
  extensions: ["html"],
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".html") || filePath.endsWith(".json")) {
      res.setHeader("Cache-Control", "no-cache");
    }
  },
}));

app.use((req, res) => res.status(404).send("Not found"));

// ─── Boot sequence ────────────────────────────────────────────────────
// S5 S1+S3 — Gate prod readiness before accepting traffic:
//   1. Refuse to start in NODE_ENV=production with Apple auth not configured.
//   2. Await the DB ping; exit non-zero if it fails (Hyperlift restart policy
//      will retry, which is the right behavior for transient DB-network issues).
// In dev (NODE_ENV !== production) both checks degrade to warnings so local
// testing without Apple/DB credentials still works.
async function boot() {
  // S5 S1 — prod-only auth requirement.
  if (IS_PROD && !APPLE_AUTH_ACTIVE) {
    console.error("[boot] FATAL: NODE_ENV=production but Apple Sign-In is not configured. " +
                  "Set APPLE_TEAM_ID, APPLE_CLIENT_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY in the environment, " +
                  "or unset NODE_ENV for local dev.");
    process.exit(1);
  }

  // S5 S3 — await pingDb before listening.
  if (dbActive) {
    try {
      const r = await pingDb();
      console.log("[db]", r);
    } catch (err) {
      if (IS_PROD) {
        console.error("[boot] FATAL: DB ping failed in production:", err.message);
        process.exit(1);
      }
      console.warn("[db] ping failed (dev mode — continuing):", err.message);
    }
  } else if (IS_PROD) {
    console.error("[boot] FATAL: NODE_ENV=production but DB env vars are missing.");
    process.exit(1);
  } else {
    console.warn("[db] not configured — DB env vars missing (dev mode)");
  }

  const server = app.listen(PORT, () => {
    console.log(`[swim-workout-generator] listening on :${PORT}`);
    if (APPLE_AUTH_ACTIVE)  console.log(`[auth] Apple Sign-In active. Gate: existing user in DB OR valid invite code`);
    else                    console.warn("[auth] Apple auth not configured (dev mode)");
  });

  // S5 S4 — Graceful shutdown on SIGTERM. Docker / Hyperlift send SIGTERM
  // before SIGKILL on container stop. server.close() stops accepting new
  // connections, finishes in-flight ones, then resolves; we exit cleanly.
  // 10-second hard timeout in case a request is hung.
  const shutdown = (signal) => {
    console.log(`[boot] ${signal} received — draining connections…`);
    const forceExit = setTimeout(() => {
      console.warn("[boot] graceful shutdown timed out after 10s; forcing exit");
      process.exit(1);
    }, 10000);
    forceExit.unref();
    server.close(() => {
      console.log("[boot] all connections closed; exiting cleanly");
      process.exit(0);
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));

  // Log container outbound IP at startup. Useful for confirming firewall
  // allow rules at the DB VM if egress ever changes. Fire-and-forget — this
  // is a diagnostic, not a readiness gate.
  fetch("https://api.ipify.org?format=json")
    .then(r => r.json())
    .then(d => console.log(`[egress-ip] ${d.ip}`))
    .catch(err => console.warn("[egress-ip] lookup failed:", err.message));
}

boot().catch(err => {
  console.error("[boot] unexpected boot error:", err);
  process.exit(1);
});
