// Swim Workout Generator — Node/Express server
//
// Single app served from one container on Hyperlift:
//   GET  /                        → static page (public/index.html)
//   GET  /api/workouts            → list all workouts (cached read from GitHub)
//   POST /api/log-workout         → append a workout, commit to workouts.json
//   PATCH  /api/workouts/:id      → update notes/dateCompleted
//   DELETE /api/workouts/:id      → remove an entry
//   GET  /api/favorites           → list favorited main-set labels
//   POST /api/favorites           → add a label to favorites
//   DELETE /api/favorites/:label  → remove a label from favorites
//   GET  /healthz                 → liveness probe
//
//   GET  /auth/apple              → redirect to Apple sign-in
//   POST /auth/callback           → Apple posts back here (form_post)
//   GET  /auth/status             → { authenticated: bool }
//   GET  /auth/signout            → clear session cookie, redirect /
//
// Required env vars:
//   GITHUB_TOKEN        — fine-grained PAT, contents:write on the repo (REQUIRED)
//   GITHUB_OWNER        — repo owner       (default: delbraeth)
//   GITHUB_REPO         — repo name        (default: swim-workout-generator)
//   GITHUB_BRANCH       — branch           (default: main)
//   GITHUB_PATH         — path in repo     (default: workouts.json)
//   PORT                — listen port      (default: 8080, Hyperlift sets this)
//   ALLOW_NO_ORIGIN     — "true" to allow curl/local testing without Origin header
//
// Apple Sign-In env vars (all required when Apple auth is active):
//   APPLE_TEAM_ID            — 10-char team ID from Apple Developer console
//   APPLE_CLIENT_ID          — Services ID you registered (e.g. com.example.swimapp)
//   APPLE_NATIVE_BUNDLE_ID   — iOS app bundle ID (e.g. com.delbraeth.swimworkout); used to
//                              verify the 'aud' claim in tokens issued by the native iOS app.
//                              Falls back to APPLE_CLIENT_ID if not set.
//   APPLE_KEY_ID             — Key ID of the .p8 private key
//   APPLE_PRIVATE_KEY        — Contents of the .p8 file (newlines as \n or literal)
//   APPLE_ALLOWED_SUBS       — (deprecated, unused) was the static allowlist; now uses users table + invites
//   APP_URL                  — Public HTTPS URL (default: https://veronicacassidy.com)

import express   from "express";
import crypto    from "crypto";
import path      from "path";
import helmet    from "helmet";
import rateLimit from "express-rate-limit";
import { fileURLToPath } from "url";

import {
  dbActive, jsonActive, dbMode, pingDb,
  dbListWorkouts, dbWorkoutExists, dbInsertWorkout, dbPatchWorkout, dbDeleteWorkout,
  dbGetSettings, dbUpsertSettings,
  dbListFavorites, dbAddFavorite, dbRemoveFavorite,
  dbIsUser, dbConsumeInviteCode, dbEnsureUser, dbAuditEvent,
  dbCreateSession, dbGetSession, dbTouchSession,
  dbRevokeSession, dbRevokeOthersByUser, dbListSessions,
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

const PORT          = process.env.PORT          || 8080;
const GITHUB_TOKEN  = process.env.GITHUB_TOKEN  || "";
const GITHUB_OWNER  = process.env.GITHUB_OWNER  || "delbraeth";
const GITHUB_REPO   = process.env.GITHUB_REPO   || "swim-workout-generator";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";
const GITHUB_PATH   = process.env.GITHUB_PATH   || "workouts.json";
const APP_URL       = process.env.APP_URL        || "https://veronicacassidy.com";

// Apple Sign-In config — all empty until configured in Hyperlift
const APPLE_TEAM_ID      = process.env.APPLE_TEAM_ID      || "";
const APPLE_CLIENT_ID    = process.env.APPLE_CLIENT_ID    || "";
const APPLE_KEY_ID       = process.env.APPLE_KEY_ID       || "";
// .p8 files use literal newlines; some platforms encode them as \n
const APPLE_PRIVATE_KEY  = (process.env.APPLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
// Filter out placeholder values ("-", "--", "none") that platforms require instead of empty strings
const APPLE_ALLOWED_SUBS = (process.env.APPLE_ALLOWED_SUBS || "")
  .split(",").map(s => s.trim()).filter(s => s && !/^-+$|^none$/i.test(s));

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

app.use(express.json({ limit: "500kb" }));

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

// ───── GitHub helpers ─────────────────────────────────────────────────
function ghHeaders() {
  return {
    "Authorization":         `Bearer ${GITHUB_TOKEN}`,
    "Accept":                "application/vnd.github+json",
    "User-Agent":            "swim-workout-history",
    "X-GitHub-Api-Version":  "2022-11-28",
  };
}

// 30-second TTL cache to avoid hammering the GitHub API on rapid reads
const cache = { json: null, sha: null, fetchedAt: 0 };
const CACHE_TTL_MS = 30_000;

// Storage shape: { workouts: [...], favorites: [...] }
async function readWorkouts({ force = false } = {}) {
  if (!force && cache.json && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return { json: cache.json, sha: cache.sha };
  }
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}?ref=${GITHUB_BRANCH}`;
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`GitHub read ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  let parsed = JSON.parse(content);
  if (Array.isArray(parsed)) {
    parsed = { workouts: parsed, favorites: [] };
  }
  if (!Array.isArray(parsed.workouts))                   parsed.workouts  = [];
  if (!Array.isArray(parsed.favorites))                  parsed.favorites = [];
  if (!parsed.settings || typeof parsed.settings !== "object") parsed.settings = {};
  cache.json = parsed;
  cache.sha = data.sha;
  cache.fetchedAt = Date.now();
  return { json: cache.json, sha: cache.sha };
}

async function writeWorkouts(json, sha, message) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`;
  const text = JSON.stringify(json, null, 2) + "\n";
  const content = Buffer.from(text, "utf-8").toString("base64");
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...ghHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ message, content, sha, branch: GITHUB_BRANCH }),
  });
  if (!res.ok) throw new Error(`GitHub write ${res.status}: ${await res.text()}`);
  const result = await res.json();
  cache.json = json;
  cache.sha = result.content.sha;
  cache.fetchedAt = Date.now();
  return result;
}

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
app.get("/api/auth/csrf", checkOrigin, requireAuth, async (req, res) => {
  try {
    const token = await dbGetOrCreateCsrf(req.sessionId);
    if (!token) return res.status(401).json({ error: "no session" });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
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

// List the authenticated user's active sessions
app.get("/api/auth/sessions", checkOrigin, requireAuth, async (req, res) => {
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
app.get("/healthz", (req, res) => res.json({ ok: true, service: "swim-workout-generator" }));

// Best-effort JSON write — used in dual mode after DB has succeeded.
// In dual mode, JSON failure is logged but doesn't fail the request.
async function jsonWriteBestEffort(json, sha, msg, dbAlreadySucceeded) {
  try {
    await writeWorkouts(json, sha, msg);
  } catch (err) {
    if (dbAlreadySucceeded) {
      console.warn(`[dual-write] JSON write failed (DB has it): ${err.message}`);
    } else {
      throw err;
    }
  }
}

app.get("/api/workouts", checkOrigin, requireAuth, async (req, res) => {
  try {
    if (dbActive) {
      const entries = await dbListWorkouts(req.userSub);
      return res.json(entries);
    }
    const { json } = await readWorkouts();
    const entries = req.userSub
      ? json.workouts.filter(e => !e.sub || e.sub === req.userSub)
      : json.workouts;
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post("/api/log-workout", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const entry = req.body;
    if (!entry || !entry.id) return res.status(400).json({ error: "entry must include an id" });
    if (req.userSub) entry.sub = req.userSub;

    // DB-first: detect duplicate via DB if active, else via JSON.
    if (dbActive) {
      if (await dbWorkoutExists(entry.id)) {
        return res.status(409).json({ error: "duplicate id", id: entry.id });
      }
      await dbInsertWorkout(entry);
    }

    if (jsonActive) {
      const { json, sha } = await readWorkouts({ force: true });
      if (!dbActive && json.workouts.some(e => e.id === entry.id)) {
        return res.status(409).json({ error: "duplicate id", id: entry.id });
      }
      // In dual mode, JSON dedup happens here too — but if DB accepted, push regardless.
      if (!json.workouts.some(e => e.id === entry.id)) json.workouts.push(entry);
      const label = entry.typeLabel || entry.type || "workout";
      const date  = entry.dateCompleted || "";
      await jsonWriteBestEffort(json, sha, `Log ${label} workout (${date})`, dbActive);
    }

    res.json({ ok: true, id: entry.id, entry });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.patch("/api/workouts/:id", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const patch  = req.body || {};

    if (dbActive) {
      const r = await dbPatchWorkout(id, patch, req.userSub);
      if (!r.ok) return res.status(r.status).json({ error: r.reason, id });
      if (jsonActive) {
        try {
          const { json, sha } = await readWorkouts({ force: true });
          const idx = json.workouts.findIndex(e => e.id === id);
          if (idx !== -1) {
            const allowed = ["notes", "dateCompleted", "completed"];
            for (const k of allowed) if (k in patch) json.workouts[idx][k] = patch[k];
            await jsonWriteBestEffort(json, sha, `Update workout ${id}`, true);
          }
        } catch (jsonErr) {
          console.warn(`[dual-write] JSON patch failed (DB has it): ${jsonErr.message}`);
        }
      }
      return res.json({ ok: true, entry: r.entry });
    }

    // JSON-only path (DB_MODE=off)
    const { json, sha } = await readWorkouts({ force: true });
    const idx = json.workouts.findIndex(e => e.id === id);
    if (idx === -1) return res.status(404).json({ error: "not found", id });
    if (req.userSub && json.workouts[idx].sub && json.workouts[idx].sub !== req.userSub)
      return res.status(403).json({ error: "not authorized" });
    const allowed = ["notes", "dateCompleted", "completed"];
    for (const k of allowed) if (k in patch) json.workouts[idx][k] = patch[k];
    await writeWorkouts(json, sha, `Update workout ${id}`);
    res.json({ ok: true, entry: json.workouts[idx] });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.delete("/api/workouts/:id", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const { id } = req.params;

    if (dbActive) {
      const r = await dbDeleteWorkout(id, req.userSub);
      if (!r.ok) return res.status(r.status).json({ error: r.reason, id });
      dbAuditEvent({ userSub: req.userSub, eventType: "workout.delete", ...reqMeta(req), details: { id } });
      if (jsonActive) {
        try {
          const { json, sha } = await readWorkouts({ force: true });
          const idx = json.workouts.findIndex(e => e.id === id);
          if (idx !== -1) {
            json.workouts.splice(idx, 1);
            await jsonWriteBestEffort(json, sha, `Delete workout ${id}`, true);
          }
        } catch (jsonErr) {
          console.warn(`[dual-write] JSON delete failed (DB applied it): ${jsonErr.message}`);
        }
      }
      return res.json({ ok: true, removed: r.removed });
    }

    const { json, sha } = await readWorkouts({ force: true });
    const idx = json.workouts.findIndex(e => e.id === id);
    if (idx === -1) return res.status(404).json({ error: "not found", id });
    if (req.userSub && json.workouts[idx].sub && json.workouts[idx].sub !== req.userSub)
      return res.status(403).json({ error: "not authorized" });
    const [removed] = json.workouts.splice(idx, 1);
    await writeWorkouts(json, sha, `Delete workout ${id}`);
    res.json({ ok: true, removed });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ───── User settings routes ──────────────────────────────────────────
app.get("/api/settings", checkOrigin, requireAuth, async (req, res) => {
  try {
    if (dbActive) {
      return res.json(await dbGetSettings(req.userSub));
    }
    const { json } = await readWorkouts();
    const key = req.userSub || "default";
    res.json(json.settings[key] || {});
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post("/api/settings", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const patch = req.body || {};

    if (dbActive) await dbUpsertSettings(req.userSub, patch);

    if (jsonActive) {
      try {
        const { json, sha } = await readWorkouts({ force: true });
        const key = req.userSub || "default";
        json.settings[key] = { ...(json.settings[key] || {}), ...patch };
        await jsonWriteBestEffort(json, sha, `Update settings (${key.slice(0, 8)})`, dbActive);
      } catch (jsonErr) {
        if (!dbActive) throw jsonErr;
        console.warn(`[dual-write] JSON settings write failed (DB has it): ${jsonErr.message}`);
      }
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ───── Favorites routes (per-user, stored in settings[sub].favorites) ───
// Falls back to the legacy global favorites array on first load so existing
// favorites are not lost when a user logs in for the first time after this change.
function getUserFavorites(json, key) {
  const userFavs = json.settings[key]?.favorites;
  if (Array.isArray(userFavs)) return userFavs;
  // One-time migration: seed from global favorites if per-user list doesn't exist yet
  return Array.isArray(json.favorites) ? [...json.favorites] : [];
}

app.get("/api/favorites", checkOrigin, requireAuth, async (req, res) => {
  try {
    if (dbActive) {
      return res.json(await dbListFavorites(req.userSub));
    }
    const { json, sha } = await readWorkouts();
    const key = req.userSub || "default";
    const favs = getUserFavorites(json, key);
    if (!Array.isArray(json.settings[key]?.favorites) && favs.length > 0) {
      if (!json.settings[key]) json.settings[key] = {};
      json.settings[key].favorites = favs;
      await writeWorkouts(json, sha, `Migrate favorites → ${key.slice(0, 8)}`);
    }
    res.json(favs);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post("/api/favorites", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const { label } = req.body || {};
    if (!label || typeof label !== "string") return res.status(400).json({ error: "label required" });

    if (dbActive) await dbAddFavorite(req.userSub, label);

    if (jsonActive) {
      try {
        const { json, sha } = await readWorkouts({ force: true });
        const key = req.userSub || "default";
        if (!json.settings[key]) json.settings[key] = {};
        const favs = getUserFavorites(json, key);
        if (!favs.includes(label)) {
          favs.push(label);
          json.settings[key].favorites = favs;
          await jsonWriteBestEffort(json, sha, `Favorite: ${label} (${key.slice(0, 8)})`, dbActive);
        }
      } catch (jsonErr) {
        if (!dbActive) throw jsonErr;
        console.warn(`[dual-write] JSON favorite add failed (DB has it): ${jsonErr.message}`);
      }
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.delete("/api/favorites/:label", checkOrigin, requireAuth, requireCsrf, writeLimiter, async (req, res) => {
  try {
    const label = decodeURIComponent(req.params.label);

    if (dbActive) await dbRemoveFavorite(req.userSub, label);

    if (jsonActive) {
      try {
        const { json, sha } = await readWorkouts({ force: true });
        const key = req.userSub || "default";
        if (!json.settings[key]) json.settings[key] = {};
        const favs = getUserFavorites(json, key);
        const updated = favs.filter(f => f !== label);
        if (updated.length < favs.length) {
          json.settings[key].favorites = updated;
          await jsonWriteBestEffort(json, sha, `Unfavorite: ${label} (${key.slice(0, 8)})`, dbActive);
        }
      } catch (jsonErr) {
        if (!dbActive) throw jsonErr;
        console.warn(`[dual-write] JSON favorite delete failed (DB has it): ${jsonErr.message}`);
      }
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
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

app.listen(PORT, () => {
  console.log(`[swim-workout-generator] listening on :${PORT}`);
  if (!GITHUB_TOKEN)      console.warn("[swim-workout-generator] GITHUB_TOKEN not set");
  if (APPLE_AUTH_ACTIVE)  console.log(`[auth] Apple Sign-In active. Gate: existing user in DB OR valid invite code`);
  else                    console.warn("[auth] Apple auth not configured");
});

// Log container outbound IP at startup — Phase 0 verification of Hyperlift egress
// stability across deploys. See EXPANSION_ROADMAP.md, Section 3 open items.
fetch("https://api.ipify.org?format=json")
  .then(r => r.json())
  .then(d => console.log(`[egress-ip] ${d.ip}`))
  .catch(err => console.warn("[egress-ip] lookup failed:", err.message));

// Boot-time MariaDB ping. No-op if DB env vars aren't set on Hyperlift yet —
// the app keeps reading workouts.json. When env vars are configured, this
// logs the result of SELECT 1 + @@have_ssl so we can confirm the TLS path.
console.log(`[db] mode=${dbMode} active=${dbActive} jsonActive=${jsonActive}`);
pingDb()
  .then(r => console.log("[db]", r))
  .catch(err => console.warn("[db] ping failed:", err.message));
