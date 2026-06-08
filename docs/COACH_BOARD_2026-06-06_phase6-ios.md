# Coaching board — Phase 6 (Team Option Visibility) eval + iOS priorities

**Date:** 2026-06-06. **Board:** HS SCY coach · Masters coach · Private/small-group
coach · Summer-league head coach · USA-S club director · Individual swimmer (the
6-persona panel from `docs/eval-2026-06-06/`). Each read `docs/PHASE_6_TOGGLE_AUDIT.md`
and answered in character. Raw seats below the synthesis.

---

## TASK 1 — Team Option Visibility: board verdict

**Scores (does it make SetForge better for me, would I configure it):**
HS 4 · Masters 4 · Private 4 (→2 if unfixed) · Summer 3 · Club 2 · Individual 4. **Avg ≈ 3.2 — net-positive concept, but it ships broken for the lesson/summer segment it's named for, and is near-irrelevant to the club.** Five design bugs surfaced, ranked by how many seats hit them:

### 🔴 Bug 1 — Bundle #18 "Advanced generate options" is mis-altitude (4 of 6 seats)
It lumps **race-pace 🏁** and **Learn-to-Swim 🧒** in with dryland/mix/equipment, and the **Simple** preset turns #18 OFF wholesale. Consequences:
- **Breaks the "free for swimmers" guarantee** — race-pace is promised CORE elsewhere in the audit, but #18 lets an owner hide it from swimmers (HS coach + Individual swimmer both flagged this as a contradiction).
- **Guts the Simple/Lesson persona** — Private + Summer coaches' entire product is Learn-to-Swim; the preset named for them hides their core content.
- **Fix:** carve **race-pace OUT of #18 and pin it CORE**; pull **Learn-to-Swim out of #18** (always-on under Simple/Lesson). Gate only the genuinely-advanced bits (dryland, mix-bias, recovery, source toggle, multi-lane). Keep basic equipment near-core.

### 🔴 Bug 2 — Whiteboard/print stranded in #21 "chrome" (HS + Summer)
Copy/print/**whiteboard** is the *deliverable* of a lane plan, but it's bundled with feedback-button/tour chrome that Simple turns OFF — so deck coaches lose their whiteboard in the preset built for them. **Fix:** move print/whiteboard to ride with **#14 Lane plans** (or mark CORE). Summer coach's literal #1 need.

### 🟡 Bug 3 — Per-team granularity is wrong for multi-group clubs (Club director)
A senior group and an 8-&-under want different surfaces; one team-wide map forces exposing senior complexity to age-group coaches or starving senior staff. Groups already exist in the data model (GroupRow/LanePlans/GroupAssignments are group-scoped). **Fix:** visibility should be **team-default → group-override** (resolves audit Open-Q3 for the real club shape). This is the single change that moves the club director from 2 → 4.

### 🟡 Bug 4 — Compliance (#17) must NOT be hide-able for teams with minors (Club director)
UI-hide-only + a live API on a SafeSport/credential surface is a quiet liability for a sanctioned, minor-heavy club. **Fix:** compliance is **always-on for any team with minors**, never a toggle.

### 🟡 Bug 5 — Reports (#8) over-bundled; constraints (#12) shouldn't default-hide
- HS wants R2 (schedule adherence) but never R1/R3 — all-or-nothing forces the wrong call. **Split Reports into sub-toggles**; keep **R4 Program Recap CORE** (Individual held the line).
- **Per-swimmer constraints (#12)** is injury/level-bearing (Masters injuries, Private mixed-age) — it should **default ON**, not sit in the "advanced, may hide" pile.

### Presets verdict
- **Simple** genuinely fits Private + Summer — *after* Bugs 1–2 are fixed. Both said: **ship it pre-set (Lesson = Simple), don't make me spelunk 21 toggles.**
- **Standard** fits HS (он'd flip off curation/facilities/onboarding in the expander).
- **Full** for Club — but **do not default a club/Program tier into Standard** (it silently hides Reports/Curation/Taper → looks shallow on first run).
- **Masters ask:** a one-tap **"adult team / no minors"** profile flag that disables the youth-compliance bundles (#16 claim/onboarding, #17 SafeSport, DOB gates) as a group — escape the youth-club clutter without hunting toggles. (Masters seat spun this off as a build chip.)

### Net recommendation for `TEAM_OPTION_VISIBILITY_SCOPE.md`
Promote the audit to scope, but **lock these before building:** (1) race-pace CORE + LTS out of #18; (2) print/whiteboard with lane plans; (3) team-default→group-override granularity; (4) compliance always-on for minor teams; (5) Reports sub-toggles + R4 CORE; (6) constraints default-ON; (7) presets are server-set per tier, not hand-configured. The club director's deeper point stands: for the Program tier the win is **import/integrate (Hy-Tek/TeamUnify) + more surface**, not subtraction — Team Option Visibility is a *lesson/small-team* feature, scope it as such.

---

## TASK 2 — iOS: must-have / don't-want / doesn't-matter

Aggregated across seats (counts = how many of the 6 named it that way; coach-only
surfaces scored by the coaches who'd use them).

### ✅ MUST-HAVE on iOS — the deckside loop
| Function | Votes | Note |
|---|---|---|
| **Generate** (type+yardage+pool, **incl. race-pace + Learn-to-Swim**) | 6/6 | Unanimous #1. The reason anyone opens the app on deck. |
| **Run mode / pace clock** (lap, finish-log) | 4 must (Summer n/a — deck clock) | Swimmer core loop. |
| **Log / Save to history** | strong | Logging must happen in the moment or never. |
| **PRs / goals / benchmarks / progress glance** | Individual + swimmers | Check splits vs goal time between sets. |
| **Generate-for / assign to swimmer-or-lane** | 5 coaches | Deckside push to a lane is the coach mobile moment. |
| **Per-swimmer level / constraints visible** | Masters + Private | Without the kid's stage on-device, the generated set is wrong. |
| **Lane plan + whiteboard print/share** | HS + Summer | Deck coaches copy it to the whiteboard; Summer's #1. |
| **Coach notes capture** | Private + Masters + Club | Quick per-swimmer note at the wall while fresh. |
| **On-deck attendance / roll-call** | **Club only (#1)** | See divergence ↓ — must-have for the club segment, unwanted elsewhere. |

### ❌ DON'T-WANT on iOS — keep on web/desk
Reports suite R1/R2/R3 (Club wants read-only glance — the exception) · Events/meet
creation, RSVP, venues, calendar admin · Curation tier / engine tuning · Facilities ·
Roster onboarding / bulk import / join tokens · Intent & week-plan **authoring** ·
Lane-plan **authoring** (view-only OK). Rationale across seats: these are sit-down,
big-screen, error-prone-on-mobile config tasks.

### 🤷 DOESN'T-MATTER on iOS
Catalog browser / UGC authoring (not a phone task) · R4 Program Recap *reading* (web
fine) · browser/push notifications · Assigned-to-me for the solo swimmer.

### The one real divergence — on-deck roll-call
Club director's **#1 iOS must-have** ("attendance that writes back to training history —
the bridge that keeps me paying"); everyone else **don't-want / doesn't-matter** (HS
does it later at a desk; Masters/Summer/Private use a clipboard or don't take roll).
**Resolution:** this *is* the proof that Phase 6 visibility must reach iOS too — the iOS
must-have set is **segment-dependent**. Build roll-call on iOS but gate it behind the
same per-team/per-group flag so lesson/masters/summer users never see it.

### Recommended iOS build order (from the board)
1. **Race-pace + Learn-to-Swim in the iOS generate** (today's iOS generate lacks the modes that the whole board ranks #1).
2. **Run mode + history logging rock-solid native** (swimmer core; Individual's emphasis).
3. **Generate-for to a lane/group on deck** (every coach's mobile moment).
4. **Lane-plan view + whiteboard print/AirPrint/share** (HS + Summer deck deliverable).
5. **Coach notes capture** (individualizers).
6. **On-deck roll-call, gated** (club segment; the divergent one).
Explicitly NOT on iOS: reports authoring, event/curation/roster/facilities config.

---

## TASK 2b — Net-NEW iOS functions to ADD (device-native, not on web)

Task 2 was "which web functions must reach iOS." This is the inverse: functions the
iOS app should **gain** that exploit being a phone on a wet pool deck — things web
can't do well. Each grounded in a board seat's stated reality. Effort is rough
(S/M/L); note the engine already runs client-side (`src/lib/engine.js`), so on-device
generate/run is feasible.

**Prerequisite (not "new", but gates everything):** put **race-pace + Learn-to-Swim
generate modes** into the iOS generator. The board's unanimous #1 web function is a
*mode that's missing on iOS today* — close this before adding native flourish.

| # | New iOS function | Native capability | Serves (seat) | Effort | Why it's an iOS-only win |
|---|---|---|---|---|---|
| 1 | **Offline generate → run → log** (cache engine, queue logs, sync later) | on-device JS engine + local store | ALL deck seats | **M** | Pool buildings kill wifi/cell; web just fails. The single highest-leverage native win. |
| 2 | **Apple Watch app** — interval/pace clock, lap, rest countdown on the wrist | watchOS + haptics | Individual swimmer, HS kids | **L** | Swimmers leave the phone in the bag; a wrist clock is the dream deck tool. Haptic rest cues work underwater-adjacent. |
| 3 | **"Deck / present mode"** — giant-type, screen-stays-awake workout + **AirPlay/cast** the lane-plan whiteboard to a deck TV | AirPlay / external display / idle-timer off | Summer (#1) + HS | **S–M** | Summer/HS #1 need is "whiteboard on a phone." Big-type present mode + AirPlay to a pool TV beats a paper printout. |
| 4 | **Live Activity / Dynamic Island** for the running set (current rep, rest countdown on lock screen) | ActivityKit | Individual + swimmers | **M** | Glance at the set between reps without unlocking, phone propped on the blocks. |
| 5 | **Home-screen + lock-screen widgets** — today's assigned workout / next event / quick-generate | WidgetKit | swimmers, HS kids | **M** | Zero-tap "what am I swimming today." Drives daily open. |
| 6 | **Voice / Shortcuts quick-generate** ("Hey Siri, 3000 aerobic") → on-device IntentParser | App Intents / Siri | Masters + Summer (wet hands) | **S–M** | Coaches build practice with wet hands, 10 min before; voice beats typing on a wet screen. |
| 7 | **Camera → stroke-video note** attached to a coach note / swimmer | AVFoundation + existing coach-notes model | Private + Masters (stroke work) | **M** | A 5-sec stroke clip is worth more than typed notes for lesson/technique coaches; pure phone affordance. |
| 8 | **Native share-sheet export** of a workout / lane plan (Messages, AirPrint, Notes) | UIActivityViewController + AirPrint | HS + Summer | **S** | The deck print/whiteboard deliverable, native — AirPrint the lane plan straight from the deck. |
| 9 | **Native push (APNs)** for cancellation / RSVP / weather alerts | APNs | club, teams | **M** | The notify layer we just shipped is Web Push only; iOS users want real push (ties to lib/notify.js). |
| 10 | **HealthKit write** — log swims to Apple Health (distance, duration) | HealthKit | Individual, Masters fitness | **S–M** | Adult-fitness/self-coached swimmers live in the Activity rings; closes the loop. |
| 11 | **On-deck roll-call (gated)** — tap-the-roster attendance → training history | (native UI) | club (#1) | **M** | The divergent must-have; net-new on iOS (PracticesView is thin). Gate behind the Phase-6 flag. |

**If we only do three:** #1 offline loop, #3 deck/present-mode + AirPlay, #6 voice
quick-generate — together they make the phone genuinely better than a laptop on a wet
deck, which is the only place iOS wins. #2 (Watch) is the big swing for the swimmer
segment when there's appetite for an L.

**Out of scope as iOS-native:** anything authoring/config (curation, reports, roster,
events/venue creation) — the board put all of that firmly on web/desk.

## Cross-cutting takeaways
1. **Fix bundle #18 before anything** — it's both a free-for-swimmers integrity bug and the reason Simple fails its named persona. Every coach seat tripped on it.
2. **iOS gap = the modes, not the surfaces.** The board's top iOS needs (race-pace, Learn-to-Swim) are *generate modes missing on iOS today*, not coach panels. Closing that beats porting coach tooling.
3. **Two products, one app.** Lesson/small-team wants *less* (Team Option Visibility, Simple preset); the club wants *more + integration*. Don't let the "hide things" feature define the Program-tier roadmap.

---
*Raw persona responses retained in this session's transcript; this doc is the synthesis.*
