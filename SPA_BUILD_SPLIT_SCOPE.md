# SPA Build Pipeline + Component Split — scope

**Status:** CUTOVER SHIPPED (2026-06-03) — Phases 1+2 + prod cutover live (build `991d73c`).
Phases 3 (component split) + 4 (router) remain. Promotes `CLEAN_SLATE_ANALYSIS.md` §2.2 + §4.1
into an executable, phased plan. Structural refactor — no user-facing feature change. Cost band
**L+ / multi-session**; risk **high** (entire web frontend). Phasing makes each step
independently shippable + verifiable. **Pipeline decision: option B (build locally, commit/
deploy the bundle) for the refactor; A+CI later.**

### Build progress
- ✅ **Phase 1 groundwork PROVEN (2026-06-03), no prod cutover yet.** esbuild added as a
  devDep + `npm run build` script. The full 29,560-line app extracts to `src/app.jsx` and
  **bundles in ~66ms → `public/assets/app.js` (1.2 MB minified)** with classic JSX
  (`React.createElement`, global React/ReactDOM kept from CDN). The core Phase-1 risk —
  "does esbuild transpile everything babel-standalone accepted?" — is **retired** (one
  warning only: a pre-existing **duplicate `className`** on a catalog element, index.html
  ~line 22833; babel silently kept the last; harmless, fix later). `src/app.jsx` +
  `public/assets/` are **gitignored during groundwork** (no committed duplicate of the
  still-live inline script); the bundle deploys from disk via `_deploy.py`.
- ⚠ **ENTANGLEMENT FOUND — Phase 1 cutover is coupled with Phase 2.** `lib/generator.js`
  finds the engine by text-slicing `index.html` between `<script type="text/babel">` and
  `function EquipmentBadge`. The moment the script body leaves `index.html` (cutover to the
  bundle), that extraction breaks → `/api/generate` (iOS) goes down. So the cutover MUST
  ship together with Phase 2 (engine → `lib/engine.js`, server imports it directly). They
  are one combined, carefully-verified step — not two.
- ✅ **Phase 2 DONE (2026-06-03) — engine source repointed, dual-source + resilient.**
  `lib/generator.js` now prefers `src/app.jsx` (engine prelude = lines 0→`function
  EquipmentBadge`) and **falls back to `public/index.html`** if app.jsx is absent — so it's
  correct before, during, and after cutover regardless of deploy order. Verified: engine
  loads from app.jsx (`generatorReady: true`, 9 types) AND the extracted region is
  **byte-identical (md5 match)** to the old index.html extraction → `/api/generate`
  unchanged. The vm is **retained, just repointed** (a true `lib/engine.js` ESM module
  with no vm is deferred — it needs enumerating every prelude symbol the UI imports,
  best done with CI/browser testing). Deploy-safe in isolation: in current prod (no `src/`
  in the container) it falls back to index.html → no behavior change.
- ✅ **Cutover SHIPPED (2026-06-03, build `991d73c`).** (1) `index.html` is now a 357-line
  shell (29,918→357) loading `/assets/app.js?v=__BUILD_SHA__` + `window.__BUILD_ID__`;
  babel-standalone CDN dropped (React/ReactDOM CDN kept). (2) `COPY src/ ./src/` added to
  the Dockerfile. (3) `src/app.jsx` un-gitignored (committed source of truth; BUILD_ID reads
  the window global) + `public/assets/app.js` added to `_deploy.py` FILES; `_deploy.py` also
  stamps `__BUILD_SHA__` for the bundle cache-bust. (4) Verified before deploy via a **jsdom
  render of the real bundle with real React → App mounts, 9,961 chars, 0 runtime errors**
  (the preview tool's headless renderer doesn't exec page scripts / reach the CDN, so jsdom
  was the trustworthy harness). Verified live: shell has no `text/babel`; `/assets/app.js`
  200 + byte-identical (1,289,908 B) to the tested local bundle; `/api/generate` 401 (route
  alive). Rollback path: revert `index.html` to inline + redeploy — the generator's
  dual-source fallback keeps `/api/generate` working throughout.

## Why
- `public/index.html` is **~29,800 lines** in a single `<script type="text/babel">` with
  **~85 top-level components**, transpiled **in the browser by Babel-standalone from CDN**
  (React 18 + ReactDOM + babel all `<script src>` from cdnjs).
- Costs: first-load perf (ship + parse babel + transpile 30k lines on every visit);
  no module boundaries (every component in one closure); editing pain (the
  [[editing-large-index-html]] "shell tools garble it" rule exists because of this); no
  real URLs / back-button (view switching is React state — refresh dumps you to the
  generator, per CLEAN_SLATE §4.1); syntax errors only catchable by a manual babel-parse
  step ([[feedback-jsx-parse-before-smoke-claim]]).
- It also blocks/raises the cost of **pluggable sections** (Phase 5/§5.1) and **Phase 6
  Team Option Visibility** — both are "touch many components" jobs that are far cheaper
  against a real module tree.

## THE linchpin constraint (read first)
`lib/generator.js` does **not** import the workout engine — it **reads `public/index.html`
as text**, slices the region between `<script type="text/babel">` and the line
`function EquipmentBadge`, and runs it in a `node:vm` with browser stubs to capture
`generateWorkout` / `WORKOUT_TYPES` / `regenerateSection`. The server-side `/api/generate`
(iOS's generation path) depends on this exact textual structure. **Any build step that
minifies/bundles/renames will break this extraction.** Retiring it cleanly is Phase 2 and
is the single most important part of this scope — get it wrong and iOS generation breaks.

## Tooling decision
- **Bundler: esbuild.** Single SPA, no SSR, no routing-server — esbuild is one tiny config,
  millisecond builds, JSX + minify + content-hash out of the box. (Vite is fine too and adds
  an HMR dev server; esbuild keeps the dep surface minimal, which fits the solo-operator
  model. Either works; esbuild recommended.)
- **React/ReactDOM:** bundled from npm (pin the same 18.2.0), CDN `<script>`s dropped.
- **Babel-standalone:** **deleted** — the build transpiles JSX ahead of time.

## Phased plan (each phase ships + verifies on its own)

### Phase 1 — Introduce the build; still one source file
- Move the entire `<script type="text/babel">` body verbatim into `src/app.jsx`.
- `public/index.html` becomes a **thin shell**: `<div id="root">` + `<script type="module"
  src="/assets/app.[hash].js">`, no CDN react/babel. Keep the `__BUILD_ID__` token (now
  injected at build time, see Deploy).
- esbuild config (`build.mjs` or npm script) → `public/assets/app.[hash].js` (+ css if extracted).
- **No component restructure yet** — byte-for-byte the same code, just bundled not
  CDN-transpiled. This isolates "did bundling change behavior?" from "did splitting?".
- **Verify:** app loads + renders identically; generate/edit/run/save all work; first-load
  network no longer pulls babel-standalone.

### Phase 2 — Engine → shared ES module (retire the vm extraction) ⚠ critical
- Extract the engine prelude (everything the vm region currently captures —
  `generateWorkout`, `regenerateSection`, `WORKOUT_TYPES`, the bank constants + helpers it
  closes over) into **`lib/engine.js`** (or `src/engine/`), as a pure, environment-agnostic
  ES module (it already runs under `vm` with only minimal stubs, so it's close).
- **Client:** `src/app.jsx` imports from `lib/engine.js`.
- **Server:** `lib/generator.js` **imports `lib/engine.js` directly** and deletes the
  `readFileSync` + `vm.runInContext` + browser-stub machinery and the `EquipmentBadge`/
  `<script>` marker dependency. One source of truth, no text slicing.
- **Verify (highest-stakes):** `/api/generate` returns byte-identical workouts before/after
  (diff a fixed seed set); `sim_template_engine.mjs` green; web generate unchanged; the
  `regenerateSection` path (web + `/api/regenerate-section`) unchanged. This is where iOS
  generation lives or dies — over-test it.

### Phase 3 — Component split (incremental)
- Carve `src/app.jsx` into a tree: `src/components/` (WorkoutBlock, EquipmentBadge, EditSheets,
  …), `src/views/` (Generate, Teams, Reports, Profile, Practices, ParentDashboard, …),
  `src/lib/` (formatting, api client, constants). Move a few per PR; the bundler verifies each.
- Kills the "single 30k file" editing pain and the garble rule.
- **Verify:** bundle builds clean after each move; smoke the moved surface.

- 🔧 **Session 1 IN PROGRESS (2026-06-03) — keystone + scaffold + first 2 leaves.**
  - **Keystone:** `lib/generator.js` now strips ESM `import`/`export` from the extracted
    engine prelude before `vm.runInContext` (`_stripEsm`). The vm can't eval ESM syntax, so
    without this the first `import` added to `src/app.jsx` would crash `/api/generate` (iOS).
    No-op on the import-free prelude → engine byte-identical (verified: loads 9 types).
  - **Boundary reminder:** the engine region is everything before `function EquipmentBadge`
    (now line 9761). That marker + the whole prelude stay in `src/app.jsx`; only components
    *after* it are carve-eligible.
  - **Harness:** `tools/jsdom_smoke.mjs` (`npm run smoke`) loads React UMD (devDep) + the built
    bundle into jsdom, mounts `<App/>`, asserts non-empty `#root` + 0 runtime errors. Added
    `jsdom`/`react`/`react-dom` devDeps (prod image is `--omit=dev`, so no bloat).
  - **First leaves extracted:** `Stat` → `src/components/Stat.jsx`, `StarRating` →
    `src/components/StarRating.jsx` (pure, props-only; `React` stays a runtime global → no
    React import). Pattern: `export function X(){…}` in the module, `import { X } from
    "./components/X.jsx"` at the top of `src/app.jsx`. Verified: build clean, engine 9 types,
    jsdom mount identical to baseline (9,961 chars, 0 errors).
  - Session 1 shipped in build `ed2597e` (deployed; live md5 match + `/api/generate` 401).

- 🔧 **Session 2 (2026-06-03) — Reports tabs subtree (`src/components/reports/`).**
  - Carved the 6 self-contained Reports sub-tabs `R1ProgrammingMixTab … R6CurationSupportTab`
    + the shared `_ReportTable` into `src/components/reports/`. Each tab defines its own
    `card`/`fmt`/`pct`/`Section` locals; only two cross refs needed wiring:
    `_ReportTable` (→ its own module, imported by R1+R4) and `setIdToName` (a UI helper that
    lives in the engine prelude but the engine never calls — `export`ed from `src/app.jsx`
    and imported by R3; the resulting app.jsx↔R3 cycle is runtime-safe since it's a
    render-time call, and the keystone strips the new `export` before vm-eval).
  - **Carve mechanics:** a throwaway `fs`-based node script (NOT shell text tools — preserves
    multibyte/emoji exactly) sliced functions on the `^    function X` / `^    }` boundaries.
  - **CRITICAL lesson — `npm run build` + the App smoke are NOT sufficient for view extraction.**
    esbuild leaves *unresolved* identifiers as runtime globals (no error), and the App smoke
    only renders the unauthenticated sign-in path — so a free reference like `_ReportTable`
    or `setIdToName` builds clean yet crashes the tab at render. Caught both only by a
    **render test**: bundle the extracted modules with `esbuild --global-name`, then
    `ReactDOMServer.renderToStaticMarkup` each component in jsdom with rich mock data (npm
    react/react-dom, `createRoot` stubbed so app.jsx loads without mounting). All 6 render,
    0 undefined free vars. **Every future view-extraction slice must do this** (not just the
    jsdom App smoke). Distinguish `ReferenceError` (real extraction bug) from `TypeError`
    (incomplete mock).
  - `_deploy.py` now auto-globs `src/components/**/*.jsx` (no manual FILES edit per file).
  - Session 2 shipped in build `e382c31` (deployed; live md5 match + `/api/generate` 401).

- 🔧 **Session 3 (2026-06-03) — Admin\* subtree (`src/components/admin/`) + static checker.**
  - Carved all 12 admin components (`AdminView` + `AdminPendingUgc`, `AdminPublicUgc`,
    `UgcGraduateModal`, `AdminFeedback`, `AdminUsers`, `EditUserModal`, `AdminInvites`,
    `AdminEmailTest`, `AdminBillingConfig`, `AdminVendorKit`, `AdminAudit`) into
    `src/components/admin/`. `AdminView` imports its 9 children; `AdminPublicUgc`→
    `UgcGraduateModal`, `AdminUsers`→`EditUserModal`. Shared prelude helpers `API_BASE` +
    `csrfHeaders` `export`ed from app.jsx (keystone strips for vm) and imported where used;
    `AUDIT_GROUP_CHIPS` (only AdminAudit) moved into that module; `Fragment` added to a
    React destructure. `app.jsx`: 28.9k → 27.75k lines.
  - **NEW TOOL — `tools/freevars.mjs` (`npm run freevars`):** a static free-variable checker
    (@babel/parser; collects declared+imported+global names, flags any referenced identifier
    — incl. uppercase JSX component names — that resolves to none). This is the **complete**
    catch for the extraction bug class (undefined refs esbuild silently leaves as globals) —
    it finds them on ALL code paths, unlike render tests / the App smoke which only cover
    executed/initial-render paths. **It supersedes the render test for free-var detection**
    and is now the per-slice verification of record: carve → `freevars` (drives exactly which
    imports each module needs) → `build` → engine check → App `smoke`.
  - Verified: freevars clean across all 28 modules; build clean; engine 9 types; App smoke
    9,961/0.
  - Session 3 shipped in build `2a429f3` (deployed; live md5 match + `/api/generate` 401).

- 🔧 **Session 4 (2026-06-03) — Team\* subtree (`src/components/teams/`).**
  - Carved `TeamRosterTab`, `TeamSettingsTab`, `TeamsView`, `TeamFacilitiesSection` into
    `src/components/teams/`. `TeamsView` imports `TeamRosterTab`/`TeamSettingsTab`/`GroupRow`;
    `TeamSettingsTab`→`TeamFacilitiesSection`. Subtree-only consts/helpers **moved into**
    their module (`TEAM_TYPE_LABELS`/`TEAM_TYPE_DESCRIPTIONS`→TeamsView; `FACILITY_COURSES`/
    `courseLabel`→TeamFacilitiesSection); `GroupRow` (still used elsewhere in app.jsx)
    `export`ed; `API_BASE`/`csrfHeaders` reused from the existing app.jsx exports; `Fragment`
    added to a destructure. `app.jsx`: 27.75k → 26.22k lines.
  - Workflow confirmed efficient: carve → `freevars` (named the 13 exact refs) → move-or-export
    → re-`freevars` clean → build/engine/smoke. **`src/lib/` still deferred** — the
    export-from-app.jsx pattern keeps working; stand up `src/lib/` (api client + formatters)
    once the export list grows enough to warrant moving them out of the prelude.
  - Verified: freevars clean across all 32 modules; build clean; engine 9 types; App smoke 9,961/0.
  - Session 4 shipped in build `b56634a` (deployed; live md5 match + `/api/generate` 401).

- 🔧 **Session 5 (2026-06-03) — Practices/scheduling subtree (`src/components/practices/`).**
  - Carved `IntentParserModal`, `IntentForm`, `IntentPreviewOverlay`, `PracticesView`,
    `MarkPracticeDoneModal`, `WeekView`, `AssignedToMeView` into `src/components/practices/`.
  - Bigger shared surface (freevars named 25 refs): exported 12 genuinely-shared symbols from
    app.jsx — the **engine API** `generateWorkout`/`WORKOUT_TYPES`/`parseIntent`/
    `computeSubstitutionsForSwimmer`/`poolModeLabel`/`makeEntryId` (prelude — keystone strips
    `export`; engine still captures them, 9 types) + shared components/consts `DrylandBlock`,
    `WorkoutBlock`, `DRYLAND_OPTIONS`, `makeDrylandBlock`, `COMPLETION_LABELS`, `PSC_LABEL_MAP`.
    `MIX_OPTIONS_INTENT` (subtree-only) moved into IntentForm. Sibling imports wired
    (`WeekView`→IntentForm/IntentPreviewOverlay/MarkPracticeDoneModal; `PracticesView`→
    MarkPracticeDoneModal). `app.jsx`: 26.22k → 24.68k lines.
  - **`src/lib/` now clearly warranted** — the app.jsx export hub is growing (engine API +
    shared UI helpers). Next architectural step: move the engine API into `src/lib/engine`
    (the deferred true ESM, retiring the vm) and shared formatters/consts into `src/lib/`,
    so modules import from `src/lib` instead of cycling through the app.jsx entry.
  - Verified: freevars clean across all 39 modules; build clean; engine 9 types; App smoke 9,961/0.
  - Session 5 shipped in build `bd6ab17` (deployed; live md5 match + `/api/generate` 401).

- ✅ **vm RETIRED (2026-06-03) — engine → `src/lib/engine.js` (the deferred Phase-2 endgame).**
  - A dependency-closure analysis (`tools/engine_closure.mjs`) proved the engine is a clean,
    **pure** 66-symbol closure (all in the prelude, 0 boundary crossings, 0 browser-global refs).
    Moved it verbatim (byte-identical by construction — assertion in the carve script) into
    `src/lib/engine.js`: type catalog, all option banks, `generateWorkout`/`regenerateSection`/
    `buildWorkout`/template engine/interval+unit helpers/`getBankOptions`/`calcEstimatedMin`.
  - `src/app.jsx` imports the 36-symbol subset it still uses from `./lib/engine.js` and
    re-exports `generateWorkout`+`WORKOUT_TYPES` (the only engine symbols components import).
    `app.jsx`: 24.68k → **16.2k lines** (engine is ~8.6k).
  - **`lib/generator.js` is now an ~80-line wrapper**: `await import("../src/lib/engine.js")`
    in a try/catch (degrades to 503 on failure), same public API + JSON-normalization +
    `Set`-coercion. Deleted `node:vm`, `_extractEngineRegion`, `_stripEsm` (the keystone), the
    `EquipmentBadge`/`<script>` marker dependency, and the `fs` reads. **Single engine source
    for browser + server.**
  - `_deploy.py` globs `src/lib/**/*.js`; `Dockerfile COPY src/` already ships it.
  - Verified: engine.js imports cleanly in Node (9 types, JSX-free/pure); `generator.js` loads
    with no vm and `generate()` returns a real 4-block workout; build/freevars/smoke clean;
    `node --check` server+generator.

- 🔧 **Session 6 (2026-06-03) — Profile cluster (`src/components/profile/`).**
  - Carved 10 profile components (`ProfileModal` + `ProfileGenderRow`, `EditableProfileField`,
    `GoalRow`, `PhaseRow`, `BenchmarksSection`, `LevelRow`, `NextEventRow`,
    `ProfileActiveConstraintsSection`, `JoinGroupSection`). With the vm retired, the
    EquipmentBadge boundary no longer constrains anything — all components are freely movable.
    Engine consts now imported from `../../lib/engine.js`; shared helpers exported from app.jsx
    (`GENDER_OPTIONS`, `genderLabel`, `GOAL_METRICS`, `LEVEL_PRESETS`, `formatPscRow`,
    `DOB_*`, + `AddressManager`/`ClaimManagedSection` pending their own carve); `LEVEL_ORDER`/
    `PHASE_ORDER` moved into their modules. `app.jsx`: 16.2k → **14.15k lines**.
  - Reusable carve tool (`tools/_carve.mjs`, ad-hoc) now drives slices; verified freevars clean
    (49 modules), build/engine/smoke green.
  - Shipped in build `d584f1b`.

- 🔧 **Session 7 (2026-06-03) — Workout-display/run cluster (`src/components/workout/`).**
  - Carved 10 components: `EquipmentBadge`, `SetRow`, `EquipmentPicker`, `RoundRestRow`,
    `DrylandBlock`, `WorkoutBlock`, `YardageSlider`, `PaceClockView`, `RestPickerModal`,
    `RunWorkoutOverlay`. First cross-module repoint: `AssignedToMeView` (practices/) now
    imports `DrylandBlock`/`WorkoutBlock` from `../workout/` (build caught the stale app.jsx
    import — esbuild errors on missing named exports, a nice safety net). Engine zone helpers
    from `lib/engine.js`; 15 shared helpers/consts exported from app.jsx (`fmtTime`,
    `playRestCue`, `primeAudioCtx`, `SECTION_STYLES/EMOJIS`, `EQUIPMENT_LIST`, `equipmentForSet`,
    `getEquivalents`, …). `app.jsx`: 14.15k → **12.2k lines**.
  - Verified: freevars clean (59 modules); build/engine/smoke green. Shipped in build `<pending>`.

### Phase 4 — React Router
- Replace state-based view switching (`view === …` / `activeTab`) with real routes so URLs
  are shareable, back-button works, and **refresh no longer dumps to the generator** (§4.1).
- Incremental: route the top-level views first, keep in-view tabs as-is initially.
- **Verify:** deep links + back/forward; refresh stays on the current view.

## Deploy / pipeline impact (the biggest open decision)
Today `_deploy.py` pushes individual files to GitHub `main`; Hyperlift builds the container
(`Dockerfile COPY public/`); `_deploy.py` stamps `__BUILD_ID__` into `index.html`. A bundle
needs a build somewhere. Two options:
- **(A — recommended) Build in the Dockerfile** (multi-stage: `npm ci` + `npm run build` →
  copy `public/assets/` into the image). Source (`src/`, shell `index.html`) is what's
  committed; the hashed bundle is produced at container build. This is the robust end-state,
  removes the artifact-in-git smell, and **aligns with the CLEAN_SLATE ops-hardening / CI
  item** (do them together). BUILD_ID is injected by the build (env/define), not by `_deploy.py`.
- **(B — interim) Build locally, commit `public/assets/*.[hash].js`** and add them to
  `_deploy.py` FILES. Lower pipeline change, but commits build artifacts and keeps `_deploy.py`.
**Lean A**, sequenced with the ops-hardening/CI work so the build + test pipeline land as one.

## Risks + mitigations
| Risk | Mitigation |
|---|---|
| **Server engine extraction breaks → iOS generation down** | Phase 2 isolated + over-verified with byte-diff on a fixed seed set before deploy; keep a tagged rollback. |
| Behavior drift from bundling | Phase 1 is byte-identical code (no restructure) to isolate the variable. |
| Deploy-pipeline change destabilizes releases | Option A behind the same CI work; verify on a staging build before main. |
| Big-bang temptation | Phasing is mandatory — each phase deploys + verifies before the next. |
| BUILD_ID stamping regression (bit us before) | Move stamping into the build with an explicit test that the live stamp == HEAD sha. |

## Out of scope
A framework migration (Next/Remix), SSR, a CSS framework swap, TypeScript conversion. This
is "same app, real build + modules + routes" — nothing more.

## Verification (end-to-end)
Local server isn't runnable (memory), so per phase: `npm run build` succeeds → load the
built `index.html` against prod API → exercise generate/edit/run/save + a coach surface;
Phase 2 additionally byte-diffs `/api/generate` output on fixed seeds + `sim_template_engine.mjs`.
Deploy via the chosen pipeline; poll BUILD_ID; smoke. iOS is unaffected except via
`/api/generate` (Phase 2 guards it).

## Dependencies / sequencing
- Pairs with **CLEAN_SLATE ops-hardening (CI + staging)** — do the build pipeline + CI together (Option A).
- **Unblocks/cheapens:** pluggable section model (Phase 5/§5.1) and **Phase 6 Team Option
  Visibility** — schedule this before those.
