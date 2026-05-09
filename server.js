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
//   APPLE_TEAM_ID       — 10-char team ID from Apple Developer console
//   APPLE_CLIENT_ID     — Services ID you registered (e.g. com.example.swimapp)
//   APPLE_KEY_ID        — Key ID of the .p8 private key
//   APPLE_PRIVATE_KEY   — Contents of the .p8 file (newlines as \n or literal)
//   APPLE_ALLOWED_SUBS  — Comma-separated Apple sub values allowed to log in
//   SESSION_SECRET      — Random 32+ char string for signing session cookies
//   APP_URL             — Public HTTPS URL (default: https://veronicacassidy.com)

import express from "express";
import crypto  from "crypto";
import path    from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const PORT          = process.env.PORT          || 8080;
const GITHUB_TOKEN  = process.env.GITHUB_TOKEN  || "";
const GITHUB_OWNER  = process.env.GITHUB_OWNER  || "delbraeth";
const GITHUB_REPO   = process.env.GITHUB_REPO   || "swim-workout-generator";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";
const GITHUB_PATH   = process.env.GITHUB_PATH   || "workouts.json";
const ACCESS_CODE   = process.env.ACCESS_CODE   || "";
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
const SESSION_SECRET     = process.env.SESSION_SECRET     || "";

const APPLE_AUTH_ACTIVE = !!(APPLE_CLIENT_ID && APPLE_TEAM_ID && APPLE_KEY_ID && APPLE_PRIVATE_KEY && SESSION_SECRET);

const app = express();
app.use(express.json({ limit: "500kb" }));

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
  if (!Array.isArray(parsed.workouts))  parsed.workouts  = [];
  if (!Array.isArray(parsed.favorites)) parsed.favorites = [];
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

// ───── Session helpers (signed cookie, no server-side store) ─────────
const SESSION_COOKIE  = "swim_session";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

function signSession(sub) {
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(sub).digest("hex");
  return `${sub}.${sig}`;
}

function verifySession(cookie) {
  if (!cookie || !SESSION_SECRET) return null;
  const dot = cookie.lastIndexOf(".");
  if (dot === -1) return null;
  const sub = cookie.slice(0, dot);
  const sig = cookie.slice(dot + 1);
  let expected;
  try {
    expected = Buffer.from(
      crypto.createHmac("sha256", SESSION_SECRET).update(sub).digest("hex"),
      "hex"
    );
  } catch { return null; }
  const supplied = Buffer.from(sig.length === expected.length * 2 ? sig : "", "hex");
  if (supplied.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(supplied, expected)) return null;
  return sub;
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

async function verifyAppleIdToken(idToken) {
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
  if (payload.aud !== APPLE_CLIENT_ID)              throw new Error("Wrong audience");
  if (payload.exp < now)                            throw new Error("Token expired");

  return payload;
}

// ───── Auth middleware ───────────────────────────────────────────────
// When Apple auth is active: require a valid session cookie.
// When not active: open mode — writes are unrestricted (same-origin guard still applies).
function requireAuth(req, res, next) {
  if (!APPLE_AUTH_ACTIVE) return next();
  const sub = verifySession(getCookie(req, SESSION_COOKIE));
  if (!sub) return res.status(401).json({ error: "not authenticated" });
  if (APPLE_ALLOWED_SUBS.length > 0 && !APPLE_ALLOWED_SUBS.includes(sub)) {
    return res.status(403).json({ error: "not authorized" });
  }
  req.userSub = sub;
  next();
}

// ───── Legacy access-code guard (used when Apple auth is not configured) ─────
function checkCode(req, res, next) {
  if (!ACCESS_CODE) return next();
  const supplied = req.get("x-access-code") || "";
  if (supplied === ACCESS_CODE) return next();
  return res.status(401).json({ error: "invalid access code" });
}

// ───── Same-origin guard ─────────────────────────────────────────────
function checkOrigin(req, res, next) {
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

// Redirect user to Apple's authorization endpoint
app.get("/api/auth/apple", (req, res) => {
  if (!APPLE_AUTH_ACTIVE) return res.status(404).send("Apple auth not configured");
  const state = crypto.randomBytes(16).toString("hex");
  // Short-lived cookie to verify state on callback (CSRF protection)
  res.setHeader("Set-Cookie",
    `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=300; Path=/`
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
app.post("/api/auth/callback", express.urlencoded({ extended: false }), async (req, res) => {
  const fail = (reason) => res.redirect(`/?auth=error&reason=${encodeURIComponent(reason)}`);
  try {
    const { id_token, state, error } = req.body;
    if (error) return fail(error);

    // CSRF: verify state matches what we set in the oauth_state cookie
    const storedState = getCookie(req, "oauth_state");
    res.setHeader("Set-Cookie",
      `oauth_state=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/`
    );
    if (!storedState || storedState !== state) return fail("state_mismatch");
    if (!id_token) return fail("missing_id_token");

    // Verify id_token with Apple's public keys
    const payload = await verifyAppleIdToken(id_token);
    const sub = payload.sub;

    // Always log the sub — needed for bootstrapping APPLE_ALLOWED_SUBS
    console.log(`[auth] Apple login: sub=${sub}`);

    if (APPLE_ALLOWED_SUBS.length === 0) {
      console.warn(`[auth] APPLE_ALLOWED_SUBS is empty. Add this sub to allow login: ${sub}`);
    } else if (!APPLE_ALLOWED_SUBS.includes(sub)) {
      console.warn(`[auth] Rejected sub not in allowlist: ${sub}`);
      return fail("not_authorized");
    }

    // Set session cookie (30-day httpOnly)
    const session = signSession(sub);
    res.setHeader("Set-Cookie",
      `${SESSION_COOKIE}=${encodeURIComponent(session)}; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}; Path=/`
    );
    res.redirect("/");
  } catch (err) {
    console.error("[auth/callback]", err.message);
    fail("server_error");
  }
});

// Check whether the current request is authenticated
app.get("/api/auth/status", (req, res) => {
  if (!APPLE_AUTH_ACTIVE) return res.json({ authenticated: true, mode: "open" });
  const sub = verifySession(getCookie(req, SESSION_COOKIE));
  if (!sub) return res.json({ authenticated: false });
  if (APPLE_ALLOWED_SUBS.length > 0 && !APPLE_ALLOWED_SUBS.includes(sub)) {
    return res.json({ authenticated: false, reason: "not_authorized" });
  }
  res.json({ authenticated: true });
});

// Clear session and redirect home
app.get("/api/auth/signout", (req, res) => {
  res.setHeader("Set-Cookie",
    `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/`
  );
  res.redirect("/");
});

// ───── API routes ────────────────────────────────────────────────────
app.get("/healthz", (req, res) => res.json({ ok: true, service: "swim-workout-generator" }));

// Temporary debug — shows which Apple env vars are present (never logs values)
app.get("/api/auth/debug", (req, res) => {
  res.json({
    APPLE_AUTH_ACTIVE,
    vars: {
      APPLE_TEAM_ID:     !!APPLE_TEAM_ID,
      APPLE_CLIENT_ID:   !!APPLE_CLIENT_ID,
      APPLE_KEY_ID:      !!APPLE_KEY_ID,
      APPLE_PRIVATE_KEY: !!APPLE_PRIVATE_KEY,
      SESSION_SECRET:    !!SESSION_SECRET,
    },
    allowed_subs_count: APPLE_ALLOWED_SUBS.length,
    private_key_starts: APPLE_PRIVATE_KEY.slice(0, 27),
  });
});

// Legacy: verify an access code (kept for backward compat; not used when Apple auth is active)
app.post("/api/verify-code", (req, res) => {
  if (!ACCESS_CODE) return res.json({ ok: true });
  const { code } = req.body || {};
  res.json({ ok: code === ACCESS_CODE });
});

app.get("/api/workouts", async (req, res) => {
  try {
    const { json } = await readWorkouts();
    res.json(json.workouts);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post("/api/log-workout", checkOrigin, requireAuth, async (req, res) => {
  try {
    const entry = req.body;
    if (!entry || !entry.id) return res.status(400).json({ error: "entry must include an id" });
    const { json, sha } = await readWorkouts({ force: true });
    if (json.workouts.some(e => e.id === entry.id)) {
      return res.status(409).json({ error: "duplicate id", id: entry.id });
    }
    json.workouts.push(entry);
    const label = entry.typeLabel || entry.type || "workout";
    const date  = entry.dateCompleted || "";
    await writeWorkouts(json, sha, `Log ${label} workout (${date})`);
    res.json({ ok: true, id: entry.id });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.patch("/api/workouts/:id", checkOrigin, requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const patch  = req.body || {};
    const { json, sha } = await readWorkouts({ force: true });
    const idx = json.workouts.findIndex(e => e.id === id);
    if (idx === -1) return res.status(404).json({ error: "not found", id });
    const allowed = ["notes", "dateCompleted"];
    for (const k of allowed) if (k in patch) json.workouts[idx][k] = patch[k];
    await writeWorkouts(json, sha, `Update workout ${id}`);
    res.json({ ok: true, entry: json.workouts[idx] });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.delete("/api/workouts/:id", checkOrigin, requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { json, sha } = await readWorkouts({ force: true });
    const idx = json.workouts.findIndex(e => e.id === id);
    if (idx === -1) return res.status(404).json({ error: "not found", id });
    const [removed] = json.workouts.splice(idx, 1);
    await writeWorkouts(json, sha, `Delete workout ${id}`);
    res.json({ ok: true, removed });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ───── Favorites routes ───────────────────────────────────────────────
app.get("/api/favorites", async (req, res) => {
  try {
    const { json } = await readWorkouts();
    res.json(json.favorites);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post("/api/favorites", checkOrigin, requireAuth, async (req, res) => {
  try {
    const { label } = req.body || {};
    if (!label || typeof label !== "string") return res.status(400).json({ error: "label required" });
    const { json, sha } = await readWorkouts({ force: true });
    if (!json.favorites.includes(label)) {
      json.favorites.push(label);
      await writeWorkouts(json, sha, `Favorite: ${label}`);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.delete("/api/favorites/:label", checkOrigin, requireAuth, async (req, res) => {
  try {
    const label = decodeURIComponent(req.params.label);
    const { json, sha } = await readWorkouts({ force: true });
    const before = json.favorites.length;
    json.favorites = json.favorites.filter(f => f !== label);
    if (json.favorites.length < before) {
      await writeWorkouts(json, sha, `Unfavorite: ${label}`);
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
  if (APPLE_AUTH_ACTIVE)  console.log(`[auth] Apple Sign-In active. Allowed subs: ${APPLE_ALLOWED_SUBS.length || "none (bootstrap mode)"}`);
  else                    console.warn("[auth] Apple auth not configured — falling back to ACCESS_CODE");
});
