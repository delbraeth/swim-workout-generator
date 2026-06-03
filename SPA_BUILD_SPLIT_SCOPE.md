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
