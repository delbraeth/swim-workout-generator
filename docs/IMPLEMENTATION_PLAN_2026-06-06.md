# Implementation plan — board feedback + remaining open items (2026-06-06)

Synthesizes: `docs/COACH_BOARD_2026-06-06_phase6-ios.md` (6-persona eval),
`docs/PHASE_6_TOGGLE_AUDIT.md`, and the open tails of Phase 5 #5 / notify / billing.

**Standing constraints (apply to every slice):**
- **Free for swimmers** — the swimmer core loop (generate→run→log, race-pace, PRs,
  goals, progress, assigned-to-me, R4 recap) is NEVER gated.
- **Deploys gated** (explicit "deploy" per deploy); **migrations applied manually** to
  prod before the dependent deploy; verify gate = freevars + build + smoke +
  **checkserver** + node --check.
- Effort bands: **S** ≈ hours · **M** ≈ a day or two · **L** ≈ multi-day.

---

## Workstream A — Phase 6 Team Option Visibility (web)
Promote `PHASE_6_TOGGLE_AUDIT.md` → `TEAM_OPTION_VISIBILITY_SCOPE.md` with the board's
7 locked fixes baked in, then build. **The 7 fixes are non-negotiable pre-build:**

| Fix | Change |
|---|---|
| F1 | **Race-pace is CORE** — carve out of bundle #18; never hideable (free-for-swimmers integrity bug). |
| F2 | **Learn-to-Swim out of #18** — always-on under Simple/Lesson preset. |
| F3 | **Print/whiteboard rides with Lane plans (#14)** or CORE — not #21 chrome. |
| F4 | **Granularity = team-only v1** (decision 1), but schema **reserves a nullable `group_id`** so team-default→group-override is a clean additive step later (clubs that need per-group come later, demand-gated). |
| F5 | **Compliance (#17) always-on for any team with minors** — never a toggle. |
| F6 | **Reports → sub-toggles**; R4 Program Recap stays CORE. |
| F7 | **Per-swimmer constraints (#12) default-ON**; presets server-set per tier (not hand-configured). |

| Slice | What | Effort | Deps / notes |
|---|---|---|---|
| A1 | **Data model** — migration: `team_feature_flags` (team_id, **group_id NULL reserved but unused in v1**, flag_key, enabled). Team-only resolution v1; group_id present so per-group override is additive (decision 1, F4). | M | manual migration |
| A2 | **Resolver + bootstrap** — server resolves effective flags (group override ⊃ team default; minors force compliance ON per F5; union for personal surfaces) and ships them in `me`/bootstrap. | M | A1 |
| A3 | **Owner config UI** — Team→Settings "Visible options": 3 presets (Simple/Standard/Full) + advanced expander of the ~18 bundles; per-group override picker. | M | A2 |
| A4 | **Render-gating sweep (web)** — gate each TOGGLE bundle's surfaces on the resolved flag; honor F1/F2/F3/F6/F7 (race-pace, LTS, print, R4, constraints stay regardless). | L | A2; touches many components |
| A5 | **Preset→tier wiring** — Lesson tier defaults to Simple; Program never auto-Standard. | S | A3 |
| A6 | **"Adult team / no-minors" flag** (Masters seat chip) — one switch that disables youth-compliance bundles as a group. | S | A1–A2 (already spun off as a task chip) |

---

## Workstream B — iOS app
Two layers: **B-core** (port the modes/surfaces the board ranked must-have) and
**B-native** (net-new device functions). Swift; separate skill track from web.

### B-core (parity the board demands)
| Slice | What | Effort | Notes |
|---|---|---|---|
| B1 | **Race-pace + Learn-to-Swim in the iOS generator** | M | **Board's unanimous #1** — a generate *mode* missing on iOS today. Do first. |
| B2 | **Run mode + history logging hardened native** | M | swimmer core; Individual's emphasis |
| B3 | **Generate-for → lane/group on deck** | S–M | every coach's mobile moment |
| B4 | **Lane-plan view + whiteboard** (feeds B-native #3) | M | HS + Summer deck deliverable |
| B5 | **Coach-notes capture** | S | individualizers |
| B6 | **Phase-6 flag gating on iOS** — read resolved flags from bootstrap; gate generate-for / roll-call / coach-notes | S | needs A2; tolerant decode (nil ⇒ allow) |

### B-native (net-new, device-only wins — `docs/COACH_BOARD` Task 2b)
| Slice | What | Native | Effort |
|---|---|---|---|
| B7 | **Offline generate→run→log** (on-device engine + queued sync) | local store | M — highest-leverage native win |
| B8 | **Deck/present mode** (giant-type, idle-off) + **AirPlay/AirPrint** lane plan | AirPlay/AirPrint | S–M |
| B9 | **Voice / Siri quick-generate** → on-device IntentParser | App Intents | S–M |
| B10 | **Live Activity / Dynamic Island** for the running set | ActivityKit | M |
| B11 | **Home/lock-screen widgets** (today's workout / quick-generate) | WidgetKit | M |
| B12 | **Native APNs push** (cancellation/RSVP/weather) | APNs | M — pairs with D-track |
| B13 | **Camera → stroke-video coach note** | AVFoundation | M |
| B14 | **HealthKit integration** (ELEVATED — Cap'n) — **(a) write** ✅ **SHIPPED build 12** (2026-06-07): `HealthKitManager` + "Save to Apple Health" on run-finish; entitlement + usage strings in source. **(b) read/import** Apple-Watch-auto-tracked pool swims → SetForge history — still DEFERRED (the partial-Watch substitute; share-usage string already in place). | HealthKit | (a) done · (b) M |

> **Why B14 is elevated:** the **read** half is a partial substitute for the deferred Watch app (B15) — Apple Watch's built-in swim mode already auto-tracks pool swims, so reading HealthKit lets a swimmer's wrist-tracked swim land in SetForge history with zero manual logging, no SetForge watchOS target needed. The **write** half closes the Activity-rings loop for the self-coached + Masters-fitness segments (the free-tier retention swimmers). High value-to-effort; promoted from Wave 5 into the iOS native set (Wave 3). Depends on B2 (hardened run/log) for the write hook + a history import path for the read side.
| B15 | **Apple Watch app** (wrist pace clock/lap/rest) | watchOS | **L** — DEFERRED (decision 3: phone now, watch later). **Design constraint (Cap'n):** in-pool interaction is the hard problem — wet hands, water-lock, mid-set. Must be near-ZERO interaction: **water-lock mode, haptic-driven send-off/rest cues, auto-advance through the set, at most one big-tap / Digital Crown lap.** Glanceable, not operable. |
| B16 | **On-deck roll-call (gated)** | native UI | M — club's divergent #1; gate via B6 |

**iOS "if only three":** B7 (offline) + B8 (deck/present + AirPrint) + B9 (voice) — make the phone beat a laptop on a wet deck. B15 (Watch) is the marquee later swing.

> **Related track (demand-gated): Apple TV deck display board** → `docs/APPLE_TV_DISPLAY_BOARD_NOTE.md`. A tiny tvOS app (pace clock + lane plan + current set on a pool-deck TV) = the premium version of B8. Ship B8 (iOS AirPlay/present-mode) first as the cheap MVP; the tvOS app (RFC-8628 device-code pairing, read-only display token reusing the calendar-feed pattern) is the L upgrade when demand appears. MVP-0 = a standalone giant pace clock (S–M).

---

## Workstream C — Finish the Phase 5 #5 calendar/RSVP family (web)
| Slice | What | Effort | Deps / notes |
|---|---|---|---|
| C1 | **.ics venue/time enrichment** (LOCATION + timed DTSTART) | S | **already spun off** as background task `task_68a8edc3` |
| C2 | **Practice RSVP** (extend RSVP to `scheduled_workouts`; server currently returns `practice_rsvp_not_yet`) | M | reuses event_rsvp polymorphic table |
| C3 | **Group-level events** (`team_events.group_id`; target a squad) | S–M | migration; pairs with A4 per-group |
| C4 | **Venue field-edit moderation** (admin candidate→approved; archive already exists) | M | scope §2 #4 |
| C5 | **Event recurrence** (RRULE; one-off today) | L | lower priority; field reserved |

---

## Workstream D — Notify layer completion
Push pipe + cancellation + weather-advisory cron already live. Remaining triggers:
| Slice | What | Effort | Deps |
|---|---|---|---|
| D1 | **RSVP reminders** ("you haven't responded") cron — roster-diff vs respondents, dedup via `notifications_sent` | M | needs roster enumeration |
| D2 | ~~Coach-note push to swimmer~~ — **DROPPED 2026-06-07.** Coach notes are coach-only (`private`/`group_coaches`/`team_coaches`); the swimmer never sees them, so there's no swimmer-facing event to push. (Considered re-aiming to assignment push — declined.) | — | n/a |
| D3 | **Native APNs path** (so iOS gets cancellation/RSVP/weather) | M | = B12; web Web-Push already done |

---

## Workstream E — Business / operator (no/low code)
| Slice | What | Effort |
|---|---|---|
| E1 | Stripe `price_id_supporter_monthly` (Supporter button) | **TBD — deferred** |
| E2 | Stripe lesson price (Lesson paywall button) | **TBD — deferred** |
| E3 | **Define the Program ($25) tier** — the club director's verdict: the Program win is **import/integrate (Hy-Tek/TeamUnify) + more surface, not subtraction.** Direction locked (decision 2); concrete pricing waits for E4. | decision, M |
| E4 | **Pricing + positioning review — GATES all price activation (Cap'n).** Hold E1/E2/E3 prices TBD until **feature-complete**, then run a full **market analysis + SWOT** and set all tier prices together as one deliberate decision. Code stays inert-until-configured, so this blocks nothing technical — buttons just stay dark until prices are set. | decision, M |

---

## Recommended sequence (waves)

**Wave 0 — ✅ CODE-COMPLETE 2026-06-06.**
- **C1 (.ics venue/time enrichment)** — DONE + verified: `lib/ics.js` emits timed VEVENTs (tz→UTC, DTEND+2h) + LOCATION; feed route passes venue + start_time (data already on `dbListTeamEvents`). Local test green (2pm EDT→18:00Z, all-day fallback intact). Web code on disk; deploys with next web push (or the spun-off chip session).
- **B1 (race-pace + Learn-to-Swim on iOS)** — ✅ **SHIPPED in build 11** (commit `ddd5f92`, pushed to `origin/build-3`; archived + uploaded to TestFlight). `GenerateRequest` sends `racePace`/`raceEvent`/`usrpt`/`youthMode`; UI = 🏁 Race-pace control (toggle + event picker + USRPT) + contextual 🧒 Learn-to-Swim toggle (lesson type).
- *(Stripe prices E1/E2 intentionally NOT here — deferred to E4, post-feature-complete pricing+SWOT.)*

**Wave 1 — integrity + cheap value:** ~~D2 (coach-note push)~~ DROPPED (coach notes
are coach-only). **C3 (group events) ✅ built 2026-06-07** (mig 060; needs prod apply +
deploy). B2/B3/B4/B5 (iOS core ports) → build 12.

**Wave 2 — Phase 6 foundation — ✅ FOUNDATION BUILT 2026-06-07 (mig 061):**
A1 registry `src/lib/featureFlags.js` (14 bundles + Simple/Standard/Full presets +
F1–F7 baked in) + mig 061 `team_feature_flags`. A2 db `dbGetTeamFlagsRow`/`dbSetTeamFlags`
+ server resolver `teamFeatureFlags()` (compliance force-ON for non-masters, F5) +
`feature_flags` on the team-detail payload + GET/PUT `/api/teams/:id/feature-flags`.
A3 `VisibleOptionsPanel` in Team→Settings (presets + per-bundle toggles, owner-write).
A4 render-gating — **✅ WEB SWEEP COMPLETE 2026-06-07: all 14 bundles gated + live.**
events (per-team) · catalog · ugc/my-sets · practices nav · community · notifications ·
reports (R1–R3 hidden, R4 stays CORE) · curation · constraints (managed + roster) ·
lane_plans (panel + multi-lane + whiteboard) · coach_notes · compliance · intent_planning
+ attendance (practices) · advanced_generate (recovery/mix/sections — race-pace 🏁,
Learn-to-Swim 🧒, basic equipment stay CORE per F1/F2 + board). Union `feature_flags` in
bootstrap drives nav/personal gates; per-team `detail.feature_flags` drives team-view gates.
**Phase 6 web COMPLETE 2026-06-07** (commit `f4d0e7c`, mig 062): A5 Lesson→Simple default,
A6 adult-team/no-minors flag (verified live), advanced_generate tails (dryland + section
source) all shipped. **Only remaining Phase 6 item: B6 iOS flag-gating** (read `feature_flags`
from bootstrap → gate generate-for / roll-call / coach-notes in the iOS app, build 13+).

**Wave 3 — iOS native wins:** B7 (offline) → B8 (deck/AirPrint) → B9 (voice) →
**B14 (HealthKit write+read — elevated; read = partial Watch substitute)**; then
B10/B11/B12 as appetite allows.

**Wave 4 — calendar/notify tail:** C2 (practice RSVP) + D1 (RSVP reminders) together;
C4 (venue moderation); then C5 (recurrence) and B16 (gated roll-call on iOS).

> **Status 2026-06-07 — C2 + D1 + C4 DEPLOYED (8b4cea1, bundle e09fea2b76d2)
> + live-verified.** New routes return 401/403 unauthed (exist + healthy);
> migration 063 applied to prod. C5 (recurrence) is the only Wave 4 item left.
>
> **C2 + D1** — no migration (event_rsvp + notifications_sent already exist); no new files.
> - **C2 practice RSVP**: `dbGetPracticeContext` + `dbListUpcomingPracticesForUser`
>   (db.js); PUT `/api/rsvp` practice branch (group-membership access), GET
>   `/api/rsvp/practice/:id` (coach/owner summary), GET `/api/me/practices/upcoming`;
>   `RsvpEventsPanel` gains a "🏊 Upcoming practices · RSVP" section.
> - **D1 RSVP reminders**: `runRsvpReminderSweep` (lib/notify.js) on the email-worker
>   cron — roster-diff (`dbListEventAudienceSubs`) vs respondents for both events
>   (`dbListUpcomingEventsForReminders`) and practices (`dbListUpcomingPracticesForReminders`),
>   one nudge per non-responder via `notifications_sent` (`rsvp_reminder` /
>   `rsvp_reminder_practice`). No-op unless push is configured.
> - Verify gate green: freevars · build · smoke · checkserver · node --check.
>
> **Status 2026-06-07 — C4 BUILT (pending migration 063 + gated deploy).**
> - **Migration 063** `venue_edit_proposals` (apply to prod by hand before deploy).
> - **C4 venue field-edit moderation**: coaches propose corrections to the shared
>   catalog (`dbProposeVenueEdit`); admins approve→apply or reject
>   (`dbListVenueEditProposals`, `dbReviewVenueEditProposal`). Routes: POST
>   `/api/venues/:id/propose-edit` (coach), GET `/api/admin/venue-edits` +
>   POST `/api/admin/venue-edits/:id/review` (admin). UI: "Suggest a correction"
>   in `VenuePicker` + new **Venue edits** admin tab (`AdminVenueEdits.jsx`).
>   Whitelist: name/indoor_outdoor/course/timezone/lat/lng. Verify gate green.
>
> **Status 2026-06-08 — C5 DEPLOYED (5039369, bundle 0060ba057d48) + live-verified;
> migration 064 applied. WAVE 4 COMPLETE & SHIPPED.** Event reads return 401 (healthy,
> no 500 — series_id column present); series-delete route returns 403 unauthed.
> - **Migration 064** `team_events.series_id` (apply to prod by hand before deploy).
> - **C5 event recurrence** = MATERIALIZED occurrences (each is a normal event →
>   RSVP/weather/feed/reminders/edit all work unchanged). `dbCreateTeamEventSeries`
>   (`_computeOccurrenceDates`: daily/weekly/monthly × interval, count|until, hard
>   cap 52) + `dbDeleteTeamEventSeries` (this-and-future or whole series). Create
>   route accepts `recurrence`; new DELETE `/api/events/:id/series?scope=future|all`.
>   UI: "Repeat" + occurrences in the create form, 🔁 series badge + "Delete series"
>   on occurrences. `series_id` surfaced on event reads. Verify gate green.
> - **Wave 4 complete**: C1 ✓ C2 ✓ C3 ✓ C4 ✓ C5 ✓ · D1 ✓ (D2 dropped).

**Wave 5 — big swings (demand-gated):** B15 (Apple Watch), E3 (Program tier
import/integrate), B13 (camera notes). *(B14 HealthKit promoted to Wave 3.)*

---

## Decisions — LOCKED 2026-06-06
1. **Phase 6 granularity → team-only v1.** Schema reserves a nullable `group_id`; per-group override is a later additive step (demand-gated). Drives A1/A2 (team-level resolver only for now).
2. **Program tier → integrate/import, times-first, file-based, demand-gated.** Explicitly NOT native system-of-record (don't fight TeamUnify/Hy-Tek/SWIMS). Program = "the training brain that ingests your meet times + roster." Highest-value first import = **meet times** (feeds the already-built race-pace/event-PR anchors); roster import second. No Program-only build until a paying club pilot.
3. **iOS → phone now, Watch later.** B-core (race-pace+LTS modes, run/log, generate-for) + B-native **if-only-three** (B7 offline · B8 deck/present+AirPrint · B9 voice). **Apple Watch (B15) deferred**; when built it must be near-ZERO interaction (water-lock, haptic cues, auto-advance, ≤1 tap) — in-pool operability is the hard constraint.
4. **Sequencing → follow the waves; no override.** No external driver forcing a jump; proceed Wave 0 → 5 as written. Re-sequence only if a pilot/demo/revenue lever appears.

---
*Plan only — nothing built or deployed. Each slice still goes through the gated
build→verify→deploy loop when started.*
