// Swim Workout Generator — Node/Express server
//
// Single app served from one container on Hyperlift:
//   GET  /                       → static page (public/index.html)
//   GET  /api/workouts           → list all workouts (cached read from GitHub)
//   POST /api/log-workout        → append a workout, commit to workouts.json
//   PATCH  /api/workouts/:id     → update notes/dateCompleted
//   DELETE /api/workouts/:id     → remove an entry
//   GET  /healthz                → liveness probe
//
// Required env vars:
//   GITHUB_TOKEN      — fine-grained PAT, contents:write on the repo (REQUIRED)
//   GITHUB_OWNER      — repo owner       (default: delbraeth)
//   GITHUB_REPO       — repo name        (default: swim-workout-generator)
//   GITHUB_BRANCH     — branch           (default: main)
//   GITHUB_PATH       — path in repo     (default: workouts.json)
//   PORT              — listen port      (default: 8080, Hyperlift sets this)
//   ALLOW_NO_ORIGIN   — "true" to allow curl/local testing without Origin header

import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const PORT          = process.env.PORT          || 8080;
const GITHUB_TOKEN  = process.env.GITHUB_TOKEN  || "";
const GITHUB_OWNER  = process.env.GITHUB_OWNER  || "delbraeth";
const GITHUB_REPO   = process.env.GITHUB_REPO   || "swim-workout-generator";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";
const GITHUB_PATH   = process.env.GITHUB_PATH   || "workouts.json";

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

async function readWorkouts({ force = false } = {}) {
  if (!force && cache.json && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return { json: cache.json, sha: cache.sha };
  }
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}?ref=${GITHUB_BRANCH}`;
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`GitHub read ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  cache.json = JSON.parse(content);
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
  // Commit succeeded — refresh cache with the new sha so the next read doesn't 409
  cache.json = json;
  cache.sha = result.content.sha;
  cache.fetchedAt = Date.now();
  return result;
}

// ───── Same-origin guard for mutating routes ─────────────────────────
// Browsers always send Origin/Referer; checking that they match this host blocks
// random cross-site scripts. Curl with no Origin header is rejected unless
// ALLOW_NO_ORIGIN=true is set (useful for local testing).
function checkOrigin(req, res, next) {
  const origin = req.get("Origin") || req.get("Referer") || "";
  const host   = req.get("Host") || "";
  if (origin) {
    try {
      if (new URL(origin).host === host) return next();
    } catch { /* malformed Origin — fall through to reject */ }
  } else if (process.env.ALLOW_NO_ORIGIN === "true") {
    return next();
  }
  return res.status(403).json({ error: "forbidden: cross-origin request" });
}

// ───── API routes ────────────────────────────────────────────────────
app.get("/healthz", (req, res) => res.json({ ok: true, service: "swim-workout-generator" }));

app.get("/api/workouts", async (req, res) => {
  try {
    const { json } = await readWorkouts();
    res.json(json);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post("/api/log-workout", checkOrigin, async (req, res) => {
  try {
    const entry = req.body;
    if (!entry || !entry.id) return res.status(400).json({ error: "entry must include an id" });
    // Bypass cache: we need the latest sha to avoid a 409 on PUT
    const { json, sha } = await readWorkouts({ force: true });
    if (json.some(e => e.id === entry.id)) {
      return res.status(409).json({ error: "duplicate id", id: entry.id });
    }
    json.push(entry);
    const label = entry.typeLabel || entry.type || "workout";
    const date  = entry.dateCompleted || "";
    await writeWorkouts(json, sha, `Log ${label} workout (${date})`);
    res.json({ ok: true, id: entry.id });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.patch("/api/workouts/:id", checkOrigin, async (req, res) => {
  try {
    const { id } = req.params;
    const patch  = req.body || {};
    const { json, sha } = await readWorkouts({ force: true });
    const idx = json.findIndex(e => e.id === id);
    if (idx === -1) return res.status(404).json({ error: "not found", id });
    const allowed = ["notes", "dateCompleted"];
    for (const k of allowed) if (k in patch) json[idx][k] = patch[k];
    await writeWorkouts(json, sha, `Update workout ${id}`);
    res.json({ ok: true, entry: json[idx] });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.delete("/api/workouts/:id", checkOrigin, async (req, res) => {
  try {
    const { id } = req.params;
    const { json, sha } = await readWorkouts({ force: true });
    const idx = json.findIndex(e => e.id === id);
    if (idx === -1) return res.status(404).json({ error: "not found", id });
    const [removed] = json.splice(idx, 1);
    await writeWorkouts(json, sha, `Delete workout ${id}`);
    res.json({ ok: true, removed });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ───── Static files (the page itself) ────────────────────────────────
// Serve only the public/ directory, not the repo root — keeps server.js,
// package.json, .git etc. from being served by accident.
app.use(express.static(path.join(__dirname, "public"), {
  extensions: ["html"],
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".html") || filePath.endsWith(".json")) {
      res.setHeader("Cache-Control", "no-cache");
    }
  },
}));

// 404 for anything that isn't an API route or a static file
app.use((req, res) => res.status(404).send("Not found"));

app.listen(PORT, () => {
  console.log(`[swim-workout-generator] listening on :${PORT}`);
  if (!GITHUB_TOKEN) {
    console.warn("[swim-workout-generator] GITHUB_TOKEN not set — /api/* will fail until configured");
  }
});
