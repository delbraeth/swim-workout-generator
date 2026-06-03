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
// SPA-split Phase 2: the engine prelude's source-of-truth is moving from the
// inline <script> in public/index.html to src/app.jsx (the esbuild entry). This
// loader prefers app.jsx and falls back to index.html, so it works before, during,
// and after the cutover regardless of deploy order. (The vm approach is retained
// for now; a true `lib/engine.js` ESM module — no vm — is a later refinement.)
const APP_SRC    = path.join(__dirname, "..", "src", "app.jsx");
const INDEX_HTML = path.join(__dirname, "..", "public", "index.html");

let _generateWorkout = null;
let _regenerateSection = null;
let _WORKOUT_TYPES = null;
let _loadError = null;
let _engineSource = null;

// Extract the engine prelude (everything before `function EquipmentBadge`) from a
// source file. For src/app.jsx the prelude starts at line 0; for index.html it
// starts just after the `<script type="text/babel">` line. Returns null if the
// region can't be located.
function _extractEngineRegion(src, fromAppJsx) {
  const lines = src.split("\n");
  const end = lines.findIndex((l) => /^\s*function EquipmentBadge\b/.test(l));
  if (end < 0) return null;
  let start;
  if (fromAppJsx) {
    start = 0;                                   // app.jsx IS the script body
  } else {
    const s = lines.findIndex((l) => /<script\s+type="text\/babel">/.test(l));
    if (s < 0) return null;
    start = s + 1;
  }
  if (end <= start) return null;
  return _stripEsm(lines.slice(start, end).join("\n"));
}

// The engine prelude is eval'd with `vm.runInContext`, which does NOT accept ESM
// `import`/`export` syntax. As the SPA splits into modules (Phase 3), src/app.jsx
// gains top-of-file `import …` lines and `export` keywords on shared symbols. Strip
// both from the extracted region so the vm still evals the plain engine logic. This
// is a no-op until app.jsx actually has ESM syntax; the engine never references the
// imported UI-component bindings, so dropping the imports is always safe.
function _stripEsm(src) {
  return src
    // Drop whole `import …;` statement lines (component/module pulls the engine ignores).
    .replace(/^\s*import\b[^\n]*$/gm, "")
    // Strip the leading `export ` keyword from declarations: `export const X` → `const X`,
    // `export function X` / `export async function X` / `export let|class X` likewise.
    .replace(/^(\s*)export\s+(default\s+)?(const|let|var|function|class|async\s+function)\b/gm, "$1$3")
    // Drop bare aggregate `export { … };` / `export default …;` lines if ever present.
    .replace(/^\s*export\s*\{[^}]*\}\s*;?\s*$/gm, "")
    .replace(/^\s*export\s+default\b[^\n]*$/gm, "");
}

function loadEngine() {
  // Prefer src/app.jsx (post-split source of truth); fall back to the inline
  // script in index.html (pre-cutover / resilience).
  let extracted = null;
  let source = null;
  if (fs.existsSync(APP_SRC)) {
    extracted = _extractEngineRegion(fs.readFileSync(APP_SRC, "utf8"), true);
    if (extracted) source = "src/app.jsx";
  }
  if (!extracted && fs.existsSync(INDEX_HTML)) {
    extracted = _extractEngineRegion(fs.readFileSync(INDEX_HTML, "utf8"), false);
    if (extracted) source = "public/index.html";
  }
  if (!extracted) {
    throw new Error(
      "generator: could not locate the engine region in src/app.jsx or " +
        "public/index.html (the `function EquipmentBadge` marker or the " +
        "`<script type=\"text/babel\">` line moved — update lib/generator.js)."
    );
  }
  _engineSource = source;

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
  console.log(`[generator] engine loaded from ${_engineSource} — ${_WORKOUT_TYPES.length} workout types`);
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
