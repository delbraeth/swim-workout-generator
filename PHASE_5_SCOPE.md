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

## 5. One-way CSV / .ics export
**Trigger:** a Team Manager / board-secretary pilot asks (team eval: top concern of 4/5
personas was data portability).
**What:** **one-way, export-only** bridges. Explicitly NOT integrations.
- **Roster CSV** — active roster as a meet-entry-friendly file (name, DOB, USA-S ID, group),
  with an "expiring 30/60/90" filter for memberships/certs (pairs with MAAP item 3).
- **Schedule `.ics`** — a read-only calendar feed of a group's scheduled practices + team
  events, subscribable in Apple/Google Calendar.
**Deps:** roster + scheduled-workouts + team-events data ✓; the self-serve JSON export
(I-G) already proves the export pattern + route shape.
**Cost:** S–M.
**Open questions:** `.ics` as a static download vs a tokenized live-subscribe URL (live feed
needs an unauthenticated, unguessable token route). CSV column set per consumer
(TeamUnify/Hytek/SportsEngine shapes differ — pick one canonical, don't chase all).

## 6. Team calendar + venues + outdoor-pool weather + RSVP
**Trigger:** a team asks to schedule meets/events with real locations and times, OR
outdoor-season weather/RSVP demand. **Already has a full detailed spec:
`MEET_SCHEDULE_WEATHER_SCOPE.md` (2026-06-01)** — unlike items 1–5, this one is already
promoted to its own scope doc with the data model + decisions worked out.
**What:** one coherent system bridging three existing surfaces (`team_facilities`,
`team_events`, `scheduled_workouts`):
- **Shared `venues` catalog** — pool identity is **universal, not team-scoped** (one team's
  home pool is another's away-meet location). One row per physical location with geocode +
  indoor/outdoor + course; facilities and meet locations both reference it. Lazy
  create/geocode-on-use (no big backfill).
- **Generalized team-event calendar + pills** — meets, picture day, banquet, parent
  meeting, etc. (today `team_events` is just `{name, date}`, no time, no location).
- **Outdoor-pool weather** — `venues.indoor_outdoor` is the *only* gate on a WeatherKit
  call; indoor/venue-less events never hit it. Apple WeatherKit (iOS framework + REST for web).
- **Unified RSVP** across meets AND practices, composing with the existing coach roll-call;
  cancellation is first-class (struck-through, never silently disappears).
**Deps:** `team_facilities`/`team_events`/`scheduled_workouts` ✓ + the venue model is new.
**MISSING deps (the real gate):** (1) **Apple WeatherKit key** + a **geocoder**; (2) **push
notification infrastructure does not exist** — RSVP reminders + cancellation alerts (§7) need
it, and it's a shared blocker for every notify feature. RSVP can ship read/write without push;
the *notify* half waits on push infra.
**Cost:** L (shared venue model + new external API + first forward-looking attendance surface).
**Open questions:** see the scope doc — venue dedup heuristic, WeatherKit web-vs-native auth,
how RSVP composes with attendance roll-call, push-infra sequencing.

---

## Recommended ordering (when Phase 5 opens)
Cheapest-first / highest-leverage-first, but each is **independently demand-gated** — build
the one a real user pulls forward, not this order for its own sake:
1. **Swimmer progress dashboard** (M, free-tier funnel fix, all deps met, reuses R4) — the
   item most likely to matter without a specific pilot, since it addresses the retention leak.
2. **CSV/.ics export** (S–M, deps met, export pattern proven) — quick win for any team pilot.
3. **Lesson tier** (M, deps met) — when the pricing downgrade pressure is real.
4. **HS race-pace pack** (M→L) — template pack first, PR engine second; pairs with item 2's PR store.
5. **MAAP pack** (L, scope session first) — heaviest; only for a club pilot that needs it.
6. **Team calendar + venues + weather + RSVP** (L, spec ready) — gated on a WeatherKit key +
   geocoder, and the notify half is blocked on push infra not existing. RSVP read/write can
   precede push; weather can ship independently. Build when an outdoor-season team asks.

## Permanently OUT of scope (do not relitigate — PHASED_PLAN §4)
TrainingPeaks / Garmin export · Meet Manager / Hy-Tek round-trip · SWIMS · `.hy3` / `.fit` /
`.tcx` · any *inbound* integration. CSV/.ics one-way (item 5) is the only export concession.
Beginner/Summer-League content tier stays deferred (PHASED_PLAN decision #1).

## How to use this doc
When a trigger fires for one item, promote it: write a dedicated `<FEATURE>_SCOPE.md` with
locked decisions (resolving the open questions above), then build. This file stays the
index of the demand-gated set; update an item's status here when it graduates to its own scope.
