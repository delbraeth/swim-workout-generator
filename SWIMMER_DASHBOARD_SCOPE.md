# Swimmer Progress Dashboard — scope

**Status:** ✅ WEB v1 SHIPPED 2026-06-03 (📈 Progress top-nav view: 90-day training
volume from R4 + test-set PRs/trend from benchmarks + the embedded logger; free/
ungated; pure client assembly, no server/DB changes). **Deferred:** iOS parity;
per-event/per-stroke PRs (those ride the Phase 5 #4 race-pace PR store — current
benchmark kinds are test-sets: t30/tt500/broken500). Promoted from `PHASE_5_SCOPE.md` item 2. Demand-gated,
but the **lowest-friction Phase 5 item** — the data substrate already exists, so this
is largely a presentation layer + one logging form. Source: the swimmer evaluation
(`docs/archive/SWIMMER_EVALUATION_2026-05-25.md`) flagged this as the single largest
convergence across personas.

## Why
The pricing thesis is "coaches pay, swimmers free" — so the **free swimmer tier is the
funnel**, and it leaks: assigned swimmers ghost after ~week 2, and Solo/Tri drift to
MySwimPro/TrainingPeaks within ~60 days, because Run Mode + assignments are the only
sticky surfaces. The swimmer eval's top convergent ask (Solo + Masters + Teen) is a
**personal progress surface**: "am I getting better?" There is no comparison/PR/trend
view today; goals are coach-KPI-shaped (yards/week), not swimmer-shaped (my times).
This is the retention lever that makes the free tier a real funnel rather than a leak.

## What it is
A swimmer-facing, read-only progress surface (on Home, not buried in Reports):
1. **Training volume** — yards/week, workout count, recent-trend sparkline.
2. **Pace trend by stroke** — how the swimmer's pace is moving over time per stroke.
3. **Time-trial / PR logger + list** — log a time trial (distance, stroke, time,
   splits); see PRs (best per event) and history.

## What it reuses (deps already satisfied — this is the key finding)
- **R4 Program Recap** (`dbGetProgramRecap`, db.js ~7424) — already a per-user training
  rollup (yards, workout count, type/stroke breakdowns, stroke-gap detection) and the
  route `GET /api/reports/program-recap` is **already open to any authenticated user**
  (server.js ~2461). The dashboard's "training volume" block is largely a swimmer-facing
  re-presentation of this — no new query for the core numbers.
- **`benchmarks` table** — already stores time trials: `user_sub, kind, pool_mode,
  total_yards, total_secs, pace_100_secs, splits (JSON), notes, recorded_at`, with
  `dbListBenchmarks(userSub, {kind, limit})` and an insert helper + `BENCHMARK_KINDS`.
  The **logger write-path exists**; the PR list is a "best per kind" read over it. This
  table is also the natural shared **PR store** that the HS race-pace item (Phase 5 #4)
  reads — build the logger here as the canonical PR entry.
- Existing Home/history surfaces + the sparkline style already used in the stats panel.

So the net-new work is: a swimmer-facing dashboard view, a **pace-trend-by-stroke**
aggregation (derive from saved workouts/benchmarks — the one genuinely new query), and
a **time-trial entry form** wired to the existing benchmark insert.

## Decisions to lock
1. **Free vs gated.** **Recommend FREE** — it's the funnel; gating it defeats the
   retention purpose and contradicts the pricing thesis. (Confirm, since it's a pricing call.)
2. **iOS parity.** Recommend yes — the app already has Home + history; the dashboard is
   a new screen reading the same endpoints. Web first is fine if sequencing matters.
3. **PR-store sharing with race-pace (#4).** Treat `benchmarks` as the single PR store;
   the dashboard's logger is the canonical entry point, and the race-pace target engine
   (#4) reads PRs from it. Avoids building two PR stores. (No conflict — just sequence
   the logger here first.)

## Build shape
- **Web (`public/index.html`):** a Swimmer Dashboard view/card — training-volume block
  (from `/api/reports/program-recap`), a pace-trend-by-stroke chart, and a Time Trials
  section (PR list + "Log a time trial" form). Surface it on Home for swimmers; keep it
  out of the coach Reports nav.
- **Server/db:** add a pace-trend-by-stroke aggregation helper + route (the one new
  query); the benchmark insert + `dbListBenchmarks` already exist for the logger and PR
  list. A small "PRs" derivation (min `total_secs` / best `pace_100_secs` per kind).
- **iOS:** a new dashboard screen reading the same endpoints (tolerant Decodable idiom).

## Out of scope
Coach-side analytics (that's Reports R1–R3). Goal-setting changes. Charts beyond a
volume sparkline + a per-stroke pace line (richer viz is v1.1). PR-anchored race-pace
*targets* — that's Phase 5 #4 (this just provides the PR data it will read).

## Cost
M — and on the low end of M, since R4 + the benchmarks substrate already exist. Mostly
presentation + one aggregation query + one entry form (+ iOS screen). Cheaper still
after the SPA component split.

## Verification
`node --check` + babel-parse; dashboard renders for a swimmer account off
`/api/reports/program-recap` + benchmarks; logging a time trial writes a `benchmarks`
row and updates the PR list; pace-trend query returns sane per-stroke series; the view
is swimmer-visible and not gated (per decision 1); iOS screen reads the same data.

## Dependencies / sequencing
- R4 ✓, benchmarks table + helpers ✓, sparkline style ✓ — satisfied.
- Sequence **before** Phase 5 #4 (HS race-pace) so the shared PR store + logger land first.
- Pairs with Phase 6 Team Option Visibility (a simplified swimmer surface).
