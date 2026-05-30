# Pluggable Section Model + Dryland — Scope

**Status:** scope draft, 2026-05-30. No code yet. ROADMAP flags this v2-tier, "CONFIRMED IMPORTANT," L-cost (15–25h+), scope-first.

## Decisions locked (this session)
1. **Phasing: A first, then B.** Ship selectable/skippable swim sections (Part A) before dryland (Part B).
2. **Dryland integration: shared `blocks[]` + `kind` flag.** Dryland is a block in the same workout array (`kind: "dryland"`, `exercises[]` shape) with a dedicated renderer. One workout object, one save path. **No new DB table.**
3. **Part A control: include/skip toggles only.** Per-workout checkboxes to include/skip a section; keep the fixed order warmup → drill → main → cooldown. (Reorder + repeated sections explicitly deferred.)

---

## Current architecture (mapped from `public/index.html`)

**Good news — the payload is already generic.** A generated/saved workout is `blocks: [...]`, where each block is `{ name, section, sets, totalYards, ... }`, built at ~line 7733 from the four picks. The **render** (`blocks.map(WorkoutBlock)`), **save/load**, **history**, and **repeat-week** all iterate `blocks[]`. So **variable section counts need no payload or schema change** — the ROADMAP's "payload assumes all 4" is only true of generation, not storage/display.

**What IS hardcoded to the 4 sections** (the real work):
- `generateWorkout` (~7271): per-section budget vars `minWu/minDr/minMa/minCd`, `pinnedBlocks.{warmup,drill,main,cooldown}`, and the final assembly of exactly 4 blocks (7733–7736).
- Section-keyed maps: `SECTION_STYLES` (482), section-bias coefficients (`balanced/warmup_heavy/drill_heavy/long_main` at 7143, each summing the 4), PSC + lane-fit fallback maps (7323/7346), `SECTION_BANNED` (8314), `NAME_BY_SECTION` (7970), `CATALOG_SECTIONS` (15305), `SECTION_KEYS` (7750).
- `inferSetZone(set, sectionKey)` (565): branches on warmup/drill/cooldown/main.
- `getBankOptions(kind, ...)` (kind ∈ the 4) — bank is keyed by section "kind."
- Reports R1 "Programming Mix" groups by section.

**Dryland is genuinely different** (why it's Part B): exercises are reps×sets with **no distance / interval / pace**, need a **rep-counter renderer** (not the pace clock), and **do not fit the distance-based bank/engine**. They can't be "generated" by the yardage engine — they're picked from a small dryland bank or coach-authored.

---

## Part A — Selectable swim sections (include/skip)

**Goal:** let a coach/swimmer drop a section per workout (e.g. skip drill on a sprint day) without breaking the engine or the fixed order.

**Data model:** a per-generate `includedSections` set, default `["warmup","drill","main","cooldown"]`. `main` is **required** (can't be skipped — it's the workout). Carried in generate params and in `intent_params` for scheduled intents (additive — absent = all 4, so old intents are unchanged).

**Engine change (the crux):** refactor `generateWorkout`'s hardcoded 4-section budget into a loop over `includedSections`:
- Replace `minWu/minDr/minMa/minCd` + the 4 pools with a per-section `{ key → {pool, min, pinned} }` map built from `includedSections`.
- Skipped sections contribute 0 yardage and produce no block.
- **Section-bias renormalization:** when a section is skipped, redistribute its coefficient across the remaining sections (e.g. drill_heavy with drill skipped → renormalize so the weights still sum to 1). Without this, a skipped section silently shrinks total yardage.
- Assembly (7733) becomes `includedSections.map(buildBlock)` instead of 4 literals.

**Keyed maps:** keep them keyed by section name — they already have entries for all 4; generation just won't request the skipped ones. No change to `SECTION_STYLES`, `inferSetZone`, catalog.

**UI:** include/skip checkboxes in the generator controls (and in `IntentForm`). Default all on; `main` shown but locked on.

**Touch points (Part A):** `generateWorkout` budget+assembly · section-bias coefficient renormalization · generator UI · `IntentForm` + `intent_params` shape · R1 report (already groups by sections present — verify it tolerates <4) · `pinnedBlocks` interaction (a pinned section can't also be skipped). Catalog, save/load, history, print: **no change** (blocks[] already generic).

**Phasing within A:**
- **A1 — ✅ SHIPPED 2026-05-30.** `includedSections` threaded through `generateWorkout` → per-section minimums → `buildWorkout` (filters to included sections). Verified byte-identical across 324 configs via `tools/_a1_verify.mjs` (seeds Math.random, snapshots blocks).
- **A2 — ✅ SHIPPED 2026-05-30.** Include/skip toggles in the generator controls (Recovery/Mix row) + `IntentForm`; wired to the primary generate call and `intent_params` (additive — absent → all 4). `buildWorkout` total now reflects only included blocks (honest; byte-identical for all-4). Skipping a section yields a correspondingly **shorter** workout (freed yardage NOT yet redistributed). Verified: all-4 byte-identical; subsets honest (reported total === sum of blocks).
- **A3 — ✅ SHIPPED 2026-05-30.** Excluded sections are injected as **pinned EMPTY blocks** (0 yards, never picked; `applyEngineOverrides` skips 0-yard blocks; filtered by `buildWorkout`), so `freeBudget` is unchanged and flows to the remaining sections (main absorbs slack) — the workout holds its target. Plus **Mix-coefficient renormalization** over included sections (guarded to the skipped case so all-4 keeps the literal ratios — no float drift). Verified: all-4 byte-identical; skip cases now land within ~3% of target across all four Mix modes (e.g. drill_heavy + skip-drill: 2,850 → 2,979 of 3,000). **Part A (selectable swim sections) COMPLETE.** Part B (dryland) is next.

---

## Part B — Dryland as a new section type (deferred phase)

**Block shape** (same `blocks[]` array):
```
{ kind: "dryland", section: "dryland", name: "Pre-pool activation",
  placement: "pre" | "post",
  exercises: [ { name, sets, reps, rest_secs?, load?, notes? } ],
  totalYards: 0 }   // excluded from yardage math
```
Swim blocks implicitly remain `kind: "swim"` (default when absent — backward-compatible).

**Renderer:** `WorkoutBlock` dispatches on `block.kind` — existing swim renderer vs a new `DrylandBlock` (a sets×reps table, no intervals, no pace clock, no swap/interval-edit affordances).

**Where dryland comes from:** NOT the distance engine. Either a small curated **dryland exercise bank** (new constant, e.g. `DRYLAND_OPTIONS` — pure JS, same authoring model) the coach picks from, or coach-authored ad-hoc. Generation: a dryland section is *inserted/picked*, never yardage-generated.

**Placement:** `pre` (before warmup) or `post` (after cooldown) — fits the fixed-order model from Decision 3 without needing full reorder.

**Touch points (Part B):** `WorkoutBlock` kind-dispatch + new `DrylandBlock` · totalYards calc (exclude `kind==="dryland"`) · Run mode (rep-counter view vs pace clock — dryland skips the clock) · print/multi-pace layout (render exercises, no pace columns) · Reports R1 (exclude dryland from yardage mix; optionally count dryland minutes separately) · `inferSetZone`/zone math (skip — dryland has no zone) · UGC/catalog (dryland authoring is its own bucket if exposed) · save/load (already blocks[]; just carries the new fields).

**Decisions (locked 2026-05-30):** dryland source = **curated starter bank + ad-hoc authoring**; Run mode = **checklist / rep-counter** (no pace clock); Reports = **excluded from yardage mix**; `main` stays un-skippable.

**Phasing within B:**
- **B1 — ✅ SHIPPED 2026-05-30 (inert foundation).** `DrylandBlock` renderer (exercise list, no pace clock), `DRYLAND_OPTIONS` starter bank (5 presets: activation / core / shoulder prehab / strength / stretch), `makeDrylandBlock`, **call-site dispatch** (`b.kind === "dryland" ? <DrylandBlock> : <WorkoutBlock>`) at the 3 render sites (main display, history, assigned) — dispatch at the call site, NOT inside WorkoutBlock, to avoid hook-order errors when a dryland block shifts index keys. `calcEstimatedMin` skips non-`sets` blocks. Inert: nothing can create a dryland block yet, so prod is unchanged (engine byte-identical). Block shape: `{ kind:"dryland", section:"dryland", name, placement:"pre"|"post", exercises:[{name,sets,reps,rest}], totalYards:0 }`.
- **B2 (next) — insert UI + CRASH-GUARDS.** A "+ Add dryland" picker (preset + pre/post) inserting into `workout.blocks`. **CRITICAL:** ~8 places iterate `block.sets` and will crash on a dryland block — must guard each first: rescale-all pace (~26345), save-to-history (~25276), Run mode (~24164), copy-text + print (~13756/14005), plus any others (grep `\.sets\.` on block vars). Guard pattern: `if (!Array.isArray(b.sets)) skip/passthrough`. The insert UI without these guards CRASHES on save/rescale/run/print — do NOT ship insert before guards.
- **B3:** Run-mode rep-counter checklist for dryland + print rendering + (dryland already excluded from yardage reports via totalYards:0).

---

## Open decisions still needed (before Part B build)
1. **Dryland bank vs author-only for v1?** Curated starter bank (more value, more authoring) vs coach-authored-only (lean).
2. **Run mode for dryland:** simple checklist/rep-counter, or a per-exercise rest timer too?
3. **Reports:** does dryland show as a separate "minutes" line, or just excluded from the yardage mix?
4. **Does Part A's skip ever apply to `main`?** Recommended: no (main required). Confirm.

## Effort (rough)
- **Part A:** M (~8–12h). A1 refactor is the careful bit; A2/A3 are contained.
- **Part B:** L (~12–18h) across B1–B3, dominated by the dryland renderer + run-mode + reports.

## Non-breaking guarantees
- `includedSections` absent → all 4 (old intents/saves unchanged).
- `block.kind` absent → `"swim"` (every existing saved workout still renders).
- No DB migration for either part (payload is JSON `blocks[]`).
