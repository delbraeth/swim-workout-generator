# HS Race-Pace Pack + PR-Anchored Targets — Scope

**Status:** scope-only (2026-06-06). No implementation. Promotes Phase 5 #4 from
`PHASE_5_SCOPE.md` / ROADMAP "Bigger threads" to a decision doc. Triple-cross-validated
in the 2026-05-25 evals (HS coach + swimmer). Cost band **M→L**, split into two slices.

## The two gaps (verified against current code)

1. **PR store is threshold-only.** `benchmarks` (db.js ~6845) holds `t30`/`tt500`/
   `broken500` → a derived **`pace_100_secs`** (training/threshold pace). There is **no
   per-event race-time store** (e.g. "100 free SCY = 52.3"). The swimmer dashboard
   shipped with per-event PRs explicitly deferred to THIS feature.
2. **Goals are volume-only.** `GOAL_METRICS` = workouts/yards per week/month. **No
   per-event time goals.**
3. **Engine race-pace is text, not computed.** Canonical templates already say "at race
   pace" (e.g. "IM Race Pace 100s"), but nothing derives an interval/target from a
   swimmer's time. "Race-pace target = my goal time, not a generic 2:00/100" (swimmer
   eval) is unbuilt.

## Slice A — HS Race-Pace Template Pack  (M, ships first, no new data model)

A curated set of **canonical** race-pace templates across HS events, authored into the
existing bank/engine machinery (same path as today's IM race-pace templates). Pure
content + light engine tagging — delivers value immediately and is independently
shippable.

- **Event coverage (SCY, HS):** 50/100/200/500 free, 100 back, 100 breast, 100 fly,
  200 IM. (Relays out.)
- **Template styles:** broken swims (e.g. broken 200 @ goal, :10 between 50s),
  goal-pace repeats (e.g. 8–16×50 @ 200-pace, short rest), descending-to-pace sets,
  and a USRPT-flavored option (decision below). Each carries a clear "this is race
  pace for event X" focus string.
- **Surfacing:** likely a **"Race Pace" focus/tag** (or a workout type) so a coach can
  ask for a race-pace session. Decision: new workout TYPE vs a focus/template-pack tag
  on existing types (lean: tag/pack, avoid a 10th-type-style change).
- **Deps:** none beyond the existing canonical bank + template engine. Pairs with the
  swimmer dashboard's existing benchmark PRs for context.

## Slice B — PR/Goal-Anchored Targets  (L, the hard half)

Compute and display the swimmer's **own** target time for race-pace reps, instead of a
generic pace.

- **New data model:** a per-swimmer **event-time store** — `swimmer_event_times`
  (polymorphic: `user_sub` OR `managed_id`, mirroring benchmarks/managed patterns),
  `event` (stroke+distance+course), `kind` (`goal` | `pr`), `time_secs`, `set_at`.
  Coaches enter for managed swimmers; swimmers enter their own.
- **Engine integration:** race-pace template sets gain a **pace-anchor descriptor**
  (e.g. `{ raceAnchor: { event: "free_200", per: 50 } }`). At generate time the engine
  resolves the swimmer's goal time for that event → per-rep target (and optionally a
  send-off interval = target + rest). Falls back to generic text when no goal is set.
- **Generate-for + group fanout:** per-swimmer goals mean each lane/member gets a
  different target — composes with the existing "Generate for" target + multi-lane
  fanout (each gets their own). This is the main complexity.
- **Rendering:** run/print/assigned views show the swimmer's number ("hold 27.8 / 50"),
  not a generic pace. Reuses the multi-pace print per-lane annotation pattern.
- **Deps:** Slice A (templates to anchor), the existing per-swimmer generate path, and
  the new event-time store + its entry UI.

## ✅ SHIPPED + LIVE-VERIFIED 2026-06-06 (commit 41d2fc6, migration 053 applied)
Live check passed end-to-end: entered a 200-free goal 1:52.34 → persisted via
`/api/me/event-times` → Race-Pace generate → main rendered "50 Free — 200 Free goal
pace @ 28.09 / hold 28.09 per 50". (Note: displayed send-off interval is app-scaled
post-engine; the per-rep TARGET is engine-exact.)

## ✅ BUILT 2026-06-06 (web)
Both slices, unified in the engine's `buildRacePaceMain()`:
- **Data:** migration `053_swimmer_event_times` (polymorphic goal/PR per event+course);
  `src/lib/raceEvents.js` taxonomy + time parse/format; db helpers
  (list/upsert/delete/`dbResolveRaceGoals` goal→PR).
- **Engine:** `racePace` swaps the MAIN block for goal/PR-anchored reps sized to the
  solver's main budget (existing 10 types byte-unaffected); `usrpt` flag → short
  reps + short rest + fail-out note; degrades to generic text when no time set.
  Verified: 1:52.34 200-free goal → 36×50 @ 28.09 on :45, total held.
- **Server:** event-time CRUD (self + managed, authz); native `/api/generate`
  threads + resolves goals.
- **UI:** `RaceGoalsPanel` (ProfileModal self + managed-swimmer detail); 🏁 Race-Pace
  toggle + event picker + USRPT in the generator's Advanced options; per-swimmer
  target renders via the set text in run/print/assigned views.
- **v1 limits:** group-target fanout uses generic text (per-member targets are a
  follow-up, like multi-lane); SCY-primary; iOS web-first.

## ✅ Decisions LOCKED 2026-06-06
- **Build both slices now** (template pack + event-time store + engine anchoring).
- **Anchor = goal, fall back to PR, then generic text.** Store both goal + pr.
- **Slice A surfacing = focus/pack tag** on existing types (no new workout type).
- **Include a USRPT-style template** alongside traditional broken/goal-pace sets.
- Course: SCY primary; store `course` on event times (default 25y), resolve against
  the generate pool mode. Swimmer self-entry + coach entry on managed swimmers.
  web-first.

## Open decisions (original — now resolved above)

1. **Anchor to GOAL or PR?** Race-pace training usually targets a **goal** time (what
   you're chasing), not current PR. Proposal: store both; **anchor on `goal`, fall back
   to `pr`, then generic.** Confirm.
2. **Event taxonomy / course.** HS is SCY. Lock the event list (the 8 above?) and
   whether SCM/LCM variants are in scope now or later. Reuse pool-mode? (Race pace is
   course-specific — a 200 free goal differs SCY vs LCM.)
3. **Who enters times + where.** Swimmer self-entry (Profile/dashboard) + coach entry on
   the managed-swimmer detail screen. Confirm both, and whether parents can.
4. **Surfacing in Slice A** — new workout **type** vs a **focus/pack tag** on existing
   types. (Lean: tag/pack.)
5. **USRPT?** Include a USRPT-style template (race-pace at volume, fixed short rest,
   fail-out rule) or keep to traditional broken/goal-pace sets for v1?
6. **Compose with taper phase?** Auto-scale race-pace volume by training phase
   (more near a meet)? Or leave manual for v1. (Lean: manual v1; the taper anchor
   already suggests phase.)
7. **iOS:** web-first (per project norm); iOS parity later.

## Recommended sequencing
- **Slice A first** (template pack) — cheap, demand-met, useful with existing PRs.
- **Slice B second** (event-time store → engine anchor → per-swimmer/group rendering)
  once a pilot actually wants computed targets. Decisions 1–3 gate Slice B.

## Out of scope (v1)
- Relays, splits-based PR auto-import from meet results, taper-phase auto-scaling,
  predictive goal-setting, iOS parity.
