# Phone UI Review — SetForge (target: iPhone 17)

**Date:** 2026-05-30 · **Reviewer:** static code audit of `public/index.html` (~28k lines)
**Target device:** iPhone 17 = **402 × 874 CSS px**, DPR 3 (Pro Max 440 × 956; 16/SE-class down to 375). Usable width after typical 24px side padding ≈ **354px**.

> **Method caveat:** this is a source audit, not a live-device render. I can't screenshot an actual iPhone 17 from here. Treat the P1 items as high-confidence (they're structural), but a 20-minute pass on a real device or Safari responsive mode at 402px will confirm severity and catch anything visual the code doesn't reveal. Where that matters most is called out per item.

---

## Status — worked through 2026-05-30 (index.html only, no migration)

| # | Item | Status |
|---|------|--------|
| Quick-launch | "Pick up where you left off" cards → compact single rows | ✅ shipped |
| #1 | Wide tables scroll on phone | ⏪ **reverted to baseline.** The `table{display:block}` rule broke `colSpan` rows on the workout-display + catalog tables and the sticky lane-plan header — too risky for the coach review. Proper fix = wrap only the genuinely-wide report/catalog tables in an `overflow-x:auto` div (keeps `display:table`). Deferred to after the demo. |
| #2 | Set-editor 7-col grid stacks | ✅ `.editor-row` → 2-col + full-width desc/interval/focus ≤640px |
| #3 | Tap targets | ✅ `.btn{min-height:40px}` under `pointer:coarse` + Quick-launch rows. ⚠ inline-styled (non-`.btn`) buttons still small — case-by-case later |
| #4 | Body overflow-x guard | ⏪ **reverted** alongside #1 — without the table-scroll solution it would *clip* wide report tables (unscrollable). Back to baseline page-scroll until the per-table wrappers land. |
| #5 | Safe-area / `viewport-fit=cover` | ⏸ **deliberately NOT enabled** — default keeps content inside the safe area already; enabling cover needs full top+bottom+overlay inset handling, net-negative without on-device testing. Revisit if you want edge-to-edge. |
| #6 | Header nav crowding | ✅ nav `flex-wrap:wrap` |
| #7 | Workout-type cards | ✅ `.type-card-grid` → 2-up ≤640px (3-up desktop preserved) |

All changes are gated to `@media (max-width:640px)` / `pointer:coarse`, so desktop is untouched. **Two things to eyeball on a real iPhone 17:** the report/catalog tables (the `display:block` trick is standard but content-dependent), and that nothing important now hides behind `overflow-x:hidden`.

---

## TL;DR

The engine and most card-based screens will be *usable* on a phone, but the app was clearly built desktop-first: **layout is ~99% inline styles with only 3 media queries in the whole file**, so almost nothing reflows by width. The phone pain concentrates in four places: **coach data tables (Reports/Catalog/Admin), the set-editor grid, tap-target sizes, and the absence of safe-area handling.** None are hard to fix; most are localized.

---

## P1 — Fix first (real usability blockers on a phone)

### 1. Coach data tables overflow horizontally
- **Evidence:** 27 `<table>` elements, but only **2** are wrapped in an `overflowX: auto` container. Multiple tables carry `minWidth: 126–272`. Reports R1–R6, the Workout Catalog, and the Admin audit log are multi-column.
- **Why it hurts:** a 4–6 column table can't fit in 354px; without a scroll wrapper it either clips or pushes the **whole page** into horizontal scroll (see #4).
- **Fix:** wrap every coach table in a `<div style={{overflowX:"auto", WebkitOverflowScrolling:"touch"}}>`, and give the table a sensible `minWidth` so columns stay readable while the *container* scrolls (not the page). One shared `<ScrollTable>` wrapper would cover all 27.

### 2. The 7-column set-editor grid is crushed
- **Evidence:** `gridTemplateColumns: "60px 60px 1fr 100px 1fr 90px 30px"` at **line ~22355** (the add-row set/interval editor). That's **340px of fixed columns** + 2 flexible columns + 6 gaps. At 402px the two `1fr` columns (description + interval) collapse to ~20–25px each.
- **Why it hurts:** the desc/interval fields — the ones you actually type into — become unusable on a phone.
- **Fix:** below ~640px, restructure each row as stacked label/field pairs (a `flex-direction: column` card per row) instead of a 7-col grid. This is the single most broken screen for phone.

### 3. Tap targets well below the 44px iOS minimum
- **Evidence:** heavy use of `padding: "3px 8/10px"` (×22), `"2px 8px"` (×22), `"1px 6px"` (×21), `"4px 8/10px"` (×55) with `fontSize: 11–13`. Effective button height ≈ **19–24px** vs Apple's recommended **44×44px**.
- **Worst offenders:** the intent-row `▶ Generate` / `✎ Edit intent` buttons, chips, and in-table action buttons.
- **Fix:** add a min tap size for interactive controls on touch — e.g. a `.btn` rule `@media (pointer:coarse){ min-height:40px; }` plus a bit more vertical padding. The button design system (`.btn`) already exists at line ~95, so this is one CSS block, not 200 edits.

---

## P2 — Should fix (noticeable, not blocking)

### 4. No global horizontal-overflow guard
- **Evidence:** `body` (line ~60) has no `overflow-x: hidden` and no max-width containment.
- **Effect:** any single overflowing element (a wide table, the 7-col grid, a long unbroken string) makes the entire page scroll/jiggle sideways — a classic "feels broken" phone tell.
- **Fix:** `html, body { overflow-x: hidden; }` as a backstop *after* the real overflow sources (#1, #2) are wrapped — not instead of them.

### 5. No safe-area handling (Dynamic Island / home indicator)
- **Evidence:** viewport meta is `width=device-width, initial-scale=1.0` with **no `viewport-fit=cover`**; **zero** `env(safe-area-inset-*)` usages in the file. One `position: sticky; bottom: 0` element (line ~23987).
- **Effect:** the sticky bottom bar and any full-screen overlay can sit under the home indicator; on the Dynamic Island phones the top edge isn't accounted for.
- **Fix:** add `viewport-fit=cover` to the meta tag, then pad fixed/sticky bottom bars with `env(safe-area-inset-bottom)` and full-screen overlays with `env(safe-area-inset-top)`. Confirm on-device — this is the one most worth eyeballing live.

### 6. Header nav crowds at 402px
- **Evidence:** the primary `<nav>` (line ~27222) is a `display:flex; gap:8` row with **no `flexWrap`**, holding up to **7** icon buttons (📥 assigned, 📅 week, 👪 parent, 🔧 coach menu, + history/stats/profile) next to a `flex:1` brand block, inside a header with **24px side padding**.
- **Effect:** for a coach+parent+swimmer account, 7 buttons + brand won't fit ~354px without squeezing the title or overflowing.
- **Fix:** `flex-wrap: wrap` on the nav (cheap), and/or reduce header side padding to ~12px under 640px. The coach-tools dropdown already does the right thing — extend that consolidation if the row still overflows.

### 7. Workout-type cards locked to 3 columns
- **Evidence:** `gridTemplateColumns: "repeat(3, 1fr)"` at line ~27653 — fixed 3-up regardless of width. At 354px that's ~100px cards holding emoji + label + a description line.
- **Fix:** `repeat(auto-fit, minmax(150px, 1fr))` so it drops to 2 columns on a phone and stays 3 on wider screens. (This pattern is already used elsewhere in the file — it's a one-line change, consistent with existing code.)

---

## P3 — Polish

### 8. Small type
- **Evidence:** **165** uses of `fontSize: 10` and **7** of `fontSize: 9`, mostly chips, captions, and badges.
- At DPR 3 it's sharp but physically small; fine for secondary labels, worth bumping any 9px that carries real information (not just decoration) to 11px.

### 9. Modals — already mostly good
- Modals use `maxWidth` + `maxHeight: 90vh` + `overflowY: auto` (e.g. IntentForm), which is the right pattern. Just verify the `maxWidth: 520`-class modals get full-width side padding on a 402px screen (they should, via `width:100%`), and that their internal grids (e.g. the 2-col date/name rows) collapse — most use `"2fr 1fr"` which shrinks acceptably.

---

## What's already right (don't regress)
- Coach tools (Teams / Swimmers / Catalog / My Sets) collapse into a **dropdown** instead of more top-level buttons — good phone instinct.
- Several grids already use `repeat(auto-fit, minmax(...))` and `minmax(0,1fr)` — the responsive pattern is in the codebase, just not applied everywhere.
- Run-mode / Pace Clock has a dedicated landscape rebuild (`PaceClockView`) — phone-first for the one screen used poolside.
- Modals cap height at `90vh` with internal scroll — no off-screen action buttons.

---

## Suggested order of attack (≈ half a day)
1. `<ScrollTable>` wrapper around the 27 tables (#1) — biggest coach win.
2. `.btn` coarse-pointer min-height + the set-editor row restructure (#3, #2).
3. Header `flex-wrap` + workout-card `auto-fit` + `body overflow-x` (#6, #7, #4) — all one-liners.
4. `viewport-fit=cover` + safe-area padding, then confirm on a real iPhone 17 (#5).

Everything here is localized; none of it requires a framework or a responsive rewrite. The highest-leverage structural move, if you ever want it, is extracting the most-reused inline layout blocks into a handful of real CSS classes so media queries can reach them — but that's optional and well beyond this pass.
