// lib/generator.js — server-side access to the SPA's workout engine.
//
// The generator (`generateWorkout`) is defined inside the in-browser-Babel
// `<script type="text/babel">` block of public/index.html. There is no build
// step, so we don't move it out (that risks the SPA). Instead we extract the
// self-contained engine region — the prelude BEFORE `function EquipmentBadge`,
// which the _a1_verify harness proved evals standalone — and run it ONCE at
// module load inside an isolated `node:vm` context, capturing `generateWorkout`
// and `WORKOUT_TYPES`.
//
// Why a vm context and not globalThis stubs (as _a1_verify does): stubbing
// globalThis.fetch on the SERVER would clobber the real fetch the Apple/Google
// OAuth paths depend on. The vm context keeps the stubs isolated.
//
// Single source of truth: engine edits in index.html flow here automatically on
// the next boot — nothing to keep in sync. Coupled only to the same two markers
// the verify harness already depends on.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_HTML = path.join(__dirname, "..", "public", "index.html");

let _generateWorkout = null;
let _regenerateSection = null;
let _WORKOUT_TYPES = null;
let _loadError = null;

function loadEngine() {
  const html = fs.readFileSync(INDEX_HTML, "utf8");
  const lines = html.split("\n");
  const start = lines.findIndex((l) => /<script\s+type="text\/babel">/.test(l));
  const end = lines.findIndex((l) => /^\s*function EquipmentBadge\b/.test(l));
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(
      "generator: could not locate the engine region in public/index.html " +
        `(start=${start}, end=${end}). The <script type="text/babel"> or ` +
        "`function EquipmentBadge` marker moved — update lib/generator.js."
    );
  }
  const extracted = lines.slice(start + 1, end).join("\n");

  // Minimal browser stubs the engine prelude touches (same set the verify
  // harness uses). Isolated to this context — does NOT touch server globals.
  const sandbox = {
    console,
    React: {
      useState: () => [null, () => {}],
      useCallback: (f) => f,
      useMemo: (f) => f(),
      useEffect: () => {},
      useRef: () => ({ current: null }),
    },
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    __captured: {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  vm.runInContext(
    extracted +
      "\n;__captured.generateWorkout = generateWorkout;" +
      "\n;__captured.WORKOUT_TYPES = WORKOUT_TYPES;" +
      "\n;__captured.regenerateSection = regenerateSection;",
    sandbox,
    { filename: "index.html#engine" }
  );

  const { generateWorkout, WORKOUT_TYPES, regenerateSection } = sandbox.__captured;
  if (typeof generateWorkout !== "function" || !Array.isArray(WORKOUT_TYPES)) {
    throw new Error("generator: engine evaluated but generateWorkout/WORKOUT_TYPES not captured");
  }
  return { generateWorkout, WORKOUT_TYPES, regenerateSection };
}

try {
  const eng = loadEngine();
  _generateWorkout = eng.generateWorkout;
  _regenerateSection = eng.regenerateSection;
  _WORKOUT_TYPES = eng.WORKOUT_TYPES;
  console.log(`[generator] engine loaded — ${_WORKOUT_TYPES.length} workout types`);
} catch (err) {
  // Degrade gracefully: a generator-extraction failure must NOT take down the
  // whole backend (it serves the web app and every other API). generate()
  // surfaces this as a typed failure the route turns into a 503.
  _loadError = err;
  _regenerateSection = null;
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
 * Returns a plain (cross-realm-normalized) result: `{ blocks[], ... }` or the
 * engine's failure shape. Throws if the engine is disabled or the call throws.
 */
export function generate(opts = {}) {
  if (!_generateWorkout) {
    const e = new Error("generator_unavailable");
    e.cause = _loadError;
    throw e;
  }
  const res = _generateWorkout(opts);
  // Normalize across the vm realm boundary to main-realm plain objects (the
  // result is JSON-serialized to the client anyway; this also drops any funcs).
  return res == null ? res : JSON.parse(JSON.stringify(res));
}

/**
 * Re-roll a single section of an existing workout. `opts` is the engine's
 * regenerateSection options ({ workout, typeId, sectionKey, maxYards, ... }).
 * Returns `{ workout, error }` (cross-realm-normalized). Returns a typed
 * failure (not a throw) if the engine is disabled.
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
