// lib/generator.js — server-side access to the SPA's workout engine.
//
// The engine now lives in src/lib/engine.js, a PURE ES module (no React/DOM/fetch)
// shared by the browser bundle (src/app.jsx) AND this server. We import it directly —
// no more node:vm, no text-slicing of index.html/app.jsx, no engine-region markers.
// (History: the engine used to be inline in the SPA's <script type="text/babel"> and
// was extracted at boot via vm.runInContext; that coupling is retired.)
//
// Single source of truth: engine edits in src/lib/engine.js flow to both the web app
// (via esbuild) and here automatically.

let _generateWorkout = null;
let _regenerateSection = null;
let _WORKOUT_TYPES = null;
let _loadError = null;

try {
  const eng = await import("../src/lib/engine.js");
  if (typeof eng.generateWorkout !== "function" || !Array.isArray(eng.WORKOUT_TYPES)) {
    throw new Error("engine module loaded but generateWorkout/WORKOUT_TYPES missing");
  }
  _generateWorkout = eng.generateWorkout;
  _regenerateSection = eng.regenerateSection || null;
  _WORKOUT_TYPES = eng.WORKOUT_TYPES;
  console.log(`[generator] engine loaded from src/lib/engine.js — ${_WORKOUT_TYPES.length} workout types`);
} catch (err) {
  // Degrade gracefully: a generator load failure must NOT take down the whole backend
  // (it serves the web app + every other API). generate() surfaces this as a typed
  // failure the route turns into a 503.
  _loadError = err;
  console.error("[generator] DISABLED — engine failed to load:", err.message);
}

/** True if the engine loaded and /api/generate can serve. */
export function generatorReady() {
  return _generateWorkout != null;
}

/** The workout-type catalog (id/label/…) the client form needs. [] if disabled. */
export function workoutTypes() {
  return _WORKOUT_TYPES || [];
}

/**
 * Run the engine. `opts` is generateWorkout's options object
 * ({ typeId, maxYards, equipment, poolMode, sectionBias, favorites, ... }).
 * Returns a plain (JSON-normalized) result: `{ blocks[], ... }` or the engine's
 * failure shape. Throws if the engine is disabled or the call throws.
 */
export function generate(opts = {}) {
  if (!_generateWorkout) {
    const e = new Error("generator_unavailable");
    e.cause = _loadError;
    throw e;
  }
  const res = _generateWorkout(opts);
  // Normalize to plain objects (drops any funcs; matches the JSON sent to the client).
  return res == null ? res : JSON.parse(JSON.stringify(res));
}

/**
 * Re-roll a single section of an existing workout. `opts` is the engine's
 * regenerateSection options ({ workout, typeId, sectionKey, maxYards, ... }).
 * Returns `{ workout, error }` (JSON-normalized). Returns a typed failure (not a
 * throw) if the engine is disabled.
 */
export function regenerateSection(opts = {}) {
  if (!_regenerateSection) {
    return { workout: null, error: _loadError ? _loadError.message : "engine unavailable" };
  }
  const opts2 = { ...opts };
  if (Array.isArray(opts.favoriteSetIds)) opts2.favoriteSetIds = new Set(opts.favoriteSetIds);
  if (Array.isArray(opts.disfavorSetIds)) opts2.disfavorSetIds = new Set(opts.disfavorSetIds);
  const out = _regenerateSection(opts2);
  return out ? JSON.parse(JSON.stringify(out)) : out;
}
