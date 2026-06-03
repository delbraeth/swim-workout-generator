# Phase 5 Scope — demand-gated feature set

**Status:** SPEC ONLY (2026-06-03). Phases 1–4 are engineering-complete; Phase 5 is
the post-end-game set. **No build clock.** Each item ships only when a specific
pilot, paying coach, or revenue signal pulls it forward — not on a schedule. This
doc captures what each item is, what it depends on (and whether that dep is already
satisfied by the Phase 1–4 work), a rough build shape, a cost band, and the open
questions that need a decision before coding.

Sources: `PHASED_PLAN_2026-05-25.md` §Phase 5, the three 2026-05-25 evaluations
(`docs/archive/COACH_EVALUATION_2026-05-25.md` + `…SWIMMER…` + `…TEAM…`), `PRICING.md`,
`IDENTITY_SCOPE.md`.

## What Phase 4 already gives Phase 5 (dependency bank)
- **Identity model** (persons + name split + guardians + `parent_contact_methods`) — done (I-A→I-H).
- **`person_external_ids`** table (keyed `person_id, system, external_id`) — created in migration 039, **empty**, purpose-built for MAAP (USA-S Member ID, SafeSport cert, BC ID).
- **Email infra** (Resend worker + templates + minor-bypass) — done. Unblocks lesson recap + any notify.
- **Guardians + parent portal** (read-only recap + weekly digest) — done. Lesson recap export reuses this contact model.
- **`benchmarks` table** (`user_sub`, `kind`, value, `recorded_at`) — already exists; the dashboard time-trial logger + PR store can build on it.
- **Reports R4 Program Recap** (solo training rollup) — the swimmer dashboard "reuses the R4 frame."
- **Two-deep gate** — IDENTITY fork 7 shipped the *soft warning*; MAAP is where the *hard block* was deliberately reserved.

---

## 1. Lesson tier ($5–7/mo)
**➡ Promoted to its own spec: `LESSON_TIER_SCOPE.md` (2026-06-03)** — full build
shape + the decisions to lock (price, replace-vs-additive managed swimmers, iOS
sequencing). Summary below.
**Trigger:** a private/individual-lesson coach asks, OR the first Coach-tier downgrade request.
**What:** a paid tier below Coach for 1-on-1 / small-lesson coaches who want more than
Free but don't need club infrastructure. Per `PRICING.md` §"Lesson tier" + coach-eval
Private persona ("Maybe at $10 *only* with per-swimmer equipment OR a Lesson type").
**Build shape:**
- **Lesson workout type** — 200–1200yd, no forced main set; structure Warm-Up / Skill
  Focus 1 / Skill Focus 2 / Send-off. New type in the section model (the flexible-section
  work from Phase 4 makes this cheaper than it would have been).
- **Parent recap export** — one-button branded one-pager to the swimmer's guardian
  contact (reuses guardians + email infra + the parent-digest template pattern).
- Tier plumbing already exists (`users.tier` + `tier_source` + grant/revoke); add
  `lesson` to the product map + entitlement gates.
**Deps:** identity ✓, email ✓, guardians ✓, billing rails ✓, flexible sections ✓ — **all satisfied.**
**Cost:** M.
**Open questions (from PRICING.md):** exact price ($5–7); **does Lesson REPLACE the
Managed Swimmers feature in Coach** (Coach becomes "full-account swimmers only", Lesson
adds the managed-swimmer suite) or is it purely additive? Grandfathering if it replaces.

## 2. Swimmer progress dashboard
**➡ Promoted to its own spec: `SWIMMER_DASHBOARD_SCOPE.md` (2026-06-03)** — lowest-
friction Phase 5 item (R4 report + `benchmarks` table already exist; mostly a
presentation layer + a logging form). Summary below.
**Trigger:** assigned-swimmer retention pain, OR a Solo/Masters user asks. (Swimmer eval:
single largest convergence — Solo + Masters + Teen all want it; the funnel leaks without it.)
**What:** swimmer-facing progress surface — yards/week, pace trend by stroke, time-trial
logger / PR list. The free-tier stickiness lever the pricing thesis depends on.
**Build shape:** reuse the R4 Program Recap query frame; add a per-stroke pace-trend
sparkline and a time-trial logger writing to the existing `benchmarks` table; surface on
Home for swimmers (not buried in Reports). Read-only, personal.
**Deps:** `benchmarks` table ✓, R4 frame ✓. **Satisfied.**
**Cost:** M.
**Open questions:** does this gate behind a tier or stay free (pricing thesis says free —
it's the funnel)? iOS parity (the app already has Home + history; dashboard would be a
new screen). Overlap with item 4 (PR store) — build the PR/event store once and share.

## 3. MAAP / SafeSport compliance pack
**Trigger:** a Club-team pilot that needs to put SetForge in front of minors' parents
(coach eval Club persona: hard "no" until this ships).
**What:** the compliance posture a year-round club requires. Per coach eval top-5
"team-type-driven compliance posture" + `IDENTITY_SCOPE` MAAP notes.
**Build shape:**
- **`person_external_ids` UI** — record/display USA-S Member ID, SafeSport cert + expiry,
  background-check ID per person (table already exists, empty).
- **Two-deep hard block** — refuse to save a minor group with only one coach (the hard
  variant IDENTITY fork 7 reserved; soft warning already ships).
- **Parent-CC on coach notes / minor comms** — route minor-directed notes to a guardian
  contact (reuses guardians + email).
- **Team-type-driven posture** — Masters skips DOB, Club gets MAAP scaffolding,
  Summer-League can run rosterless; a `teams.team_type`-driven config, not a global toggle.
- **Anonymized + attendance-PDF exports** for safety logs.
**Deps:** identity ✓, `person_external_ids` ✓, guardians ✓, email ✓, attendance data ✓.
Two-deep soft-warning ✓ (hard block is the new work).
**Cost:** L. Needs a dedicated scope session (compliance correctness matters).
**Open questions:** how strict is the two-deep block (advisory vs hard-refuse per
team_type)? What exactly does "anonymized export" redact? SafeSport expiry → does it gate
anything or just display+warn? Is this Program-tier-gated?

## 4. HS race-pace template pack + PR-anchored targets
**Trigger:** an HS coach pilot, OR swimmer demand for goal-time targets. (Coach eval: "no
HS-specific event/race templates." Swimmer eval: "race-pace 8×50 should show *my* :28, not
generic 2:00/100.")
**What:** two linked pieces —
- **Engine/bank templates keyed on HS events** — 50/100/200/500 free, 100 stroke, 200 IM,
  broken-200, relay-exchange. Wire as named bank labels so a coach can favorite + propagate.
- **PR-anchored race-pace targets** — a per-swimmer event→PR store (Profile = "my events
  with current PRs"); race-pace sets compute target splits from the swimmer's PR instead of
  the generic pace base. Also seeds a `tri` preset (1500/Oly/70.3 goal paces) + open-water
  set family (sighting ladders, broken 1500s, CSS).
**Deps:** template engine ✓, bank multi-tag model ✓, `benchmarks`/PR store (share with
item 2). Meet-anchored taper ✓ already gives the race-prep arc.
**Cost:** M (template pack alone) → L (with the PR-anchored target engine).
**Open questions:** PR store schema — extend `benchmarks` or a dedicated `swimmer_events`
table? How do PR targets compose with the existing pace-base + per-swimmer constraints +
multi-lane pace fitting? Split into "template pack" (cheap, ship first) vs "PR engine"
(bigger) as two sub-phases.

## 5. Team calendar + venues + weather + RSVP + one-way export
**(Merged 2026-06-03: the former #5 "one-way CSV/.ics export" and #6 "team calendar +
venues + weather + RSVP" are one feature family — the `.ics` feed is just the export
face of the calendar this item builds. They roll together; export ships as the cheap
early slice, the calendar/venue/weather/RSVP system as the heavy body.)**
**Detailed spec for the calendar/venue/weather/RSVP core:** `MEET_SCHEDULE_WEATHER_SCOPE.md`
(2026-06-01) — data model + decisions already worked out.
**Trigger:** a team asks to schedule meets/events with real locations/times; outdoor-season
weather/RSVP demand; OR a Team Manager / board secretary needs roster/schedule export (team
eval: data portability was a top-5 concern of 4/5 personas).

**Slice A — one-way export (cheap; deps met TODAY, can ship before Slice B):**
Explicitly export-only, NOT integrations.
- **Schedule `.ics`** — a read-only calendar feed of a group's scheduled practices + team
  events, subscribable in Apple/Google Calendar. Runs on today's `scheduled_workouts` +
  `team_events`; gets richer (times, venues) once Slice B lands.
- **Roster CSV** — active roster as a meet-entry-friendly file with an "expiring 30/60/90"
  filter. Pairs with **MAAP (#3)** — if MAAP ships first this can live there instead.
  - **Canonical target = Hy-Tek Meet Manager CSV roster import** (resolves the
    "which consumer format?" open question). Captured 2026-06-03 from the Hy-Tek/
    ActiveNetwork support article (`.../Importing-Rosters-from-a-CSV-file-into-Meet-Manager`):
    - **Required columns, in this order:** `Swimming ID` (USA-S/registration ID — MUST be
      first column) · `Date of Birth` · `First Name` · `Last Name` · `Gender` · `Team Name`
      (abbreviation).
    - **Optional columns:** `Middle Name` · `Preferred Name`.
    - **Gender must be spelled out** — `FEMALE` / `MALE` (NOT `F`/`M`). (Our internal model
      is `M`/`F`/`X`/`prefer_not_to_say` → map M→MALE, F→FEMALE on export; X/PNTS likely
      omit or leave blank, TBD.)
    - One athlete per row; first row is the header. Team must already exist in Meet Manager/
      Team Manager before import. Requires MM ≥ 8.0Cg (Dec 2020). DOB format not specified
      by the article → test with a sample import; likely `MM/DD/YYYY`.
  - Note our internal `Swimming ID` lives in `person_external_ids` (system='usa_swimming'),
    and gender/DOB on `persons` — so the export query is a `persons` + external-IDs join.
- Deps: roster + scheduled-workouts + team-events ✓; the self-serve JSON export (I-G)
  already proves the export pattern + route shape. Cost **S**.

**Slice B — calendar / venues / weather / RSVP (the heavy body):**
One coherent system bridging `team_facilities`, `team_events`, `scheduled_workouts`:
- **Shared `venues` catalog** — pool identity is **universal, not team-scoped** (one team's
  home pool is another's away-meet location). Geocode + indoor/outdoor + course; lazy
  create/geocode-on-use.
- **Generalized team-event calendar + pills** — meets, picture day, banquet, parent
  meeting (today `team_events` is just `{name, date}`, no time/location).
- **Outdoor-pool weather** — `venues.indoor_outdoor` is the only gate on a WeatherKit call.
- **Unified RSVP** across meets AND practices, composing with coach roll-call; cancellation
  first-class.
- Cost **L**.

**MISSING deps (the real gate for Slice B):** (1) **Apple WeatherKit key** + a **geocoder**;
(2) **push notification infrastructure does not exist** — RSVP reminders + cancellation
alerts need it (shared blocker for every notify feature). RSVP read/write + weather +
Slice A export can ship without push; the *notify* half waits on push infra.
**Open questions:** venue dedup heuristic; WeatherKit web-vs-native auth; RSVP-vs-roll-call
composition; push sequencing; `.ics` static-download vs tokenized live-subscribe URL.
(CSV canonical column set is **resolved** — Hy-Tek Meet Manager format, captured above;
open sub-question: how to emit X/prefer-not-to-say gender, which Hy-Tek doesn't define.)

---

## Recommended ordering (when Phase 5 opens)
Cheapest-first / highest-leverage-first, but each is **independently demand-gated** — build
the one a real user pulls forward, not this order for its own sake:
1. **Swimmer progress dashboard** (M, free-tier funnel fix, all deps met, reuses R4) — the
   item most likely to matter without a specific pilot, since it addresses the retention leak.
2. **Export bridges — CSV/.ics** (S, deps met now) — quick win for any team pilot; this is
   **Slice A of item #5** and can ship long before the calendar body.
3. **Lesson tier** (M, deps met) — when the pricing downgrade pressure is real.
4. **HS race-pace pack** (M→L) — template pack first, PR engine second; pairs with #2's PR store.
5. **MAAP pack** (L, scope session first) — heaviest; only for a club pilot that needs it.
6. **Calendar / venues / weather / RSVP** (L, spec ready) — **Slice B of item #5**; gated on a
   WeatherKit key + geocoder, notify half blocked on push infra. Build when an outdoor-season
   team asks.

## Permanently OUT of scope (do not relitigate — PHASED_PLAN §4)
TrainingPeaks / Garmin export · Meet Manager / Hy-Tek round-trip · SWIMS · `.hy3` / `.fit` /
`.tcx` · any *inbound* integration. CSV/.ics one-way (item #5, Slice A) is the only export concession.
Beginner/Summer-League content tier stays deferred (PHASED_PLAN decision #1).

## How to use this doc
When a trigger fires for one item, promote it: write a dedicated `<FEATURE>_SCOPE.md` with
locked decisions (resolving the open questions above), then build. This file stays the
index of the demand-gated set; update an item's status here when it graduates to its own scope.
