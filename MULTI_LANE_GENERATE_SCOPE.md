# Multi-Lane Multi-Pace Generate — Scope (v2.0)

**Status:** scope locked + built 2026-05-22 (commit + tag TBD on deploy).

Companion feature to N6 (multi-pace EXPORT shipped 2026-05-19, tag `n6-multipace-export-2026-05-19`). N6 takes an existing single workout and produces a per-lane print. v2.0 builds the generate-side: the picker considers the full pace range while choosing options, so the resulting workout fits every lane's pace.

## 1 — Locked decisions (2026-05-22)

| Aspect | Choice |
|---|---|
| Generation depth | **Pace-aware in the picker** — options scored against ALL lane paces, not a single canonical |
| Lane source | Anonymous slots by default; auto-prefill from `lanePlansForTarget` when group has a plan |
| UX entry | Toggle next to pace input area; ON expands single pace input to N lane rows |
| Output | After Generate succeeds, auto-open `MultiPacePrintView` with new workout + lane paces |
| Coach gate | Same as N6: `me?.is_coach` (no group requirement — coach can run anonymous lanes solo) |
| Storage | **Deferred to v2.1** — multi-lane workouts don't persist to history in v2.0. Single-pace history path unchanged. |
| Equipment per lane | **Deferred to v2.2** — current `equipment` stays single-shared across lanes |

## 2 — Constraint math (the new logic)

Each lane L has a pace `paceL` (seconds per 100, mode-aware).

For each candidate option O and each set S in O:
- `swimTime_L(S) = (paceL / PACE_BASELINE_SECS) * baseSwimTime(S)`
- `rest_L(S) = interval(S) - swimTime_L(S)`

Where `baseSwimTime(S)` is `parseIntervalSecs(set.interval) - baseRest` at the baseline pace. Reuse `scaleInterval` math.

**Option passes the lane filter IFF** for every set S in O and every lane L:
```
rest_L(S) >= MIN_REST   AND   rest_L(S) <= MAX_REST_RATIO * swimTime_L(S)
```

Default tunables:
- `MIN_REST = 5` seconds — slowest lane needs to breathe between reps
- `MAX_REST_RATIO = 1.5` — fastest lane shouldn't idle more than 1.5× its swim time

Sets without an interval (warmups, cooldowns, drill rest-defined-elsewhere) — `optionFitsAllLanes` SKIPS them (return true for that set). Only sets with parseable intervals are constrained.

## 3 — Integration points

- **`generateWorkout({ lanesPace, ...})`** — new optional param. If non-null & non-empty: insert `optionFitsAllLanes` filter into the `validAll = ...` step for each section. If filter empties the pool: graceful fallback (use unfiltered pool, attach a `__laneFitWarning` to the section output for UI surfacing).
- **`regenerateSection`** — same lanesPace param + filter.
- **`generateEngineForSection`** — engine output passes through validator. Add **rule V-Lane** to the validator: every set's interval must fit all lanes. If the engine output fails V-Lane: same retry-3 logic as other validator rules, ultimately falling back to bank.
- **`applyEngineOverrides`** — threads `lanesPace` through to validator.
- **UI — pace input area** — new toggle. When ON: render N rows (lane label + pace input). Prefill from `lanePlansForTarget?.[0]?.lanes` if available (use the default lane plan).
- **App state** — `multiLaneMode: boolean`, `lanesPace: Array<{ label, pace }>`.
- **handleGenerate** — when `multiLaneMode`, pass `lanesPace`; on success, `setMultiPaceLanes({ lanes: lanesPace, mode: "per-lane" })` to auto-open `MultiPacePrintView`.

## 4 — Risks

- **Empty-pool risk**: very wide lane ranges (e.g. 1:00–3:00/100) can empty the filter. Graceful fallback to unfiltered + warning. Tested at MIN_REST=5/MAX_REST_RATIO=1.5 with realistic ranges (1:30–2:30 typical).
- **Single-pace regression**: `lanesPace == null || lanesPace.length === 0` path must be byte-identical to current behavior. Smoke matrix must show 3450/3450 unchanged.
- **Engine compatibility**: validator V-Lane is a NEW rule — engine retry rate may go up on tight lane ranges. Acceptable per spec §9 ("loosen iteratively; goal is variety, not perfection").
- **History storage**: multi-lane workouts intentionally skip save-to-history in v2.0. If a coach generates and wants to revisit, they re-run with the same lane plan. Document this in v2.0 ship notes.

## 5 — Build slice for this session

1. Scope doc (this file) — DONE.
2. `optionFitsAllLanes(option, lanesPace, minRest, maxRestRatio)` helper near `scaleInterval`.
3. `generateWorkout` + `regenerateSection` signatures + filter wiring + warning attach.
4. Engine validator V-Lane rule.
5. App state + pace-input toggle + lane prefill from `lanePlansForTarget`.
6. handleGenerate auto-route to `MultiPacePrintView`.
7. Smoke (3450/3450) + manual e2e.

## 6 — Out of scope for v2.0 (deferred)

- **v2.1**: Persistence of multi-lane workouts to history (lane paces as side data alongside canonical workout).
- **v2.2**: Per-lane equipment (`lanesEquipment[]`).
- **v2.3**: Different rep counts per lane (lane 1 does 8×100, lane 2 does 6×100 in same time). Catalog memo flagged as significantly more complex.
- **v2.x**: Pace-range warning UI in the modal ("Your lane range is wide — fewer options will fit").
