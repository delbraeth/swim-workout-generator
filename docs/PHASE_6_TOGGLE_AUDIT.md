# Phase 6 — Team Option Visibility: toggleable-surface audit

**Status:** AUDIT (2026-06-06). Feeds the eventual `TEAM_OPTION_VISIBILITY_SCOPE.md`.
Supersedes the stale "Candidate toggles" list in `PHASE_6_SCOPE.md`. Built from a
full code sweep of `src/App.jsx`, `src/components/**`, and `ios-app/**`.

## Purpose
Phase 6 lets a **team owner** hide surfaces their team doesn't use, to simplify the
app for a small/private/lesson team (progressive disclosure, opt-in complexity).
This audit enumerates every surface and classifies it.

## The one hard guardrail — free for swimmers
The swimmer **core training loop is NEVER gated**, now or ever: generate → run →
log, plus race-pace targets, PRs, goals, benchmarks, progress, and "Assigned to me."
Those are **CORE**. Toggles only ever hide coach-side power surfaces and non-core
"icing" (community/social). A toggle hides a surface for **swimmers** always and for
**coaches** optionally; it is a simplification affordance, **not** a permission
boundary (UI-hide; the API still works — v1 decision, see open Qs).

Classification used below: **CORE** (never gate) · **TOGGLE** (owner may hide) ·
**N/A** (child of a toggle / display-only / admin-internal).

---

## Toggle bundles (the recommended unit of control)

Per-surface toggles (~60 surfaces) are too granular. Group into **bundles**, each a
single owner switch, plus 3 presets. Ordered by how likely a small team turns it OFF.

| # | Bundle | What it hides | Audience | Notes |
|---|--------|---------------|----------|-------|
| 1 | **Events & meets** | TeamsView 📅 Events tab (create/edit/delete, status/cancel) | coach | The flagged one. A private/lesson coach runs no meets. |
| 2 | **RSVP** | swimmer `RsvpEventsPanel` + coach RSVP tally | both | Meaningless without events — bundle with #1 (or sub-toggle). |
| 3 | **Venues & weather** | `VenuePicker`, `WeatherChip`, venue field on events | both | Rides on events; outdoor-weather is niche. |
| 4 | **Calendar distribution** | `TeamCalendarFeed` (.ics live feed) + `TeamCalendarDownload` | both | No events → nothing to share. |
| 5 | **Meet-anchored taper** | 🎯 Anchor picker on events; group phase auto-suggest | coach | Advanced periodization; tied to events. |
| 6 | **Intent planning / week scheduling** | `IntentForm`, `IntentParserModal`, generate-from-intent, "+ Plan intent", intent rows in WeekView | coach | Private coaches repeat fixed sessions. Keep payload rows rendering (back-compat). |
| 7 | **Attendance / roll-call** | Mark-practice-done + `MarkPracticeDoneModal`, Attendance CSV | coach | Optional admin overhead. (iOS `PracticesView` too.) |
| 8 | **Reports suite** | ReportsView R1/R2/R3 (coach), export buttons | coach | **R4 Program Recap stays CORE for swimmers.** R5/R6 are admin-only (N/A). |
| 9 | **Catalog browser** | `CatalogView` (browse the set bank) | coach | Power-browse; small teams just generate. |
| 10 | **UGC / My Sets authoring** | `MySetsView` + `UgcFormModal` (+ Coach-home card) | coach | Authoring is advanced. |
| 11 | **Team curation tier** | TeamSettings favorites/disfavor/pace-base/disfavor-mode | coach(owner) | The "tune the engine" power surface. |
| 12 | **Per-swimmer constraints** | `ConstraintsPanel` (roster + managed-swimmer) | coach | Injury/gear/taper caps; advanced. |
| 13 | **Coach notes** | `CoachNotesPanel` / iOS `CoachNotesSheet` | coach | Per-swimmer narrative; optional. |
| 14 | **Lane plans / multi-lane** | `LanePlansPanel`, MultiLane control, multi-pace print | coach | Single-lane teams don't need it. |
| 15 | **Facilities** | `TeamFacilitiesSection` + map | coach(owner) | One-venue teams don't need a catalog. |
| 16 | **Roster onboarding tools** | Bulk import, join tokens, claim links, roster CSV / anon CSV | coach | Power onboarding; small teams add by hand. |
| 17 | **Compliance credentials** | `CompliancePanel` (SafeSport/bg-check/USA-S), team cert rollup | coach | Only matters for sanctioned/minor programs. |
| 18 | **Advanced generate options** | race-pace 🏁, recovery 🌿, mix-bias, section skip/add, equipment, dryland, source (Bank/Engine/Mix), Learn-to-Swim 🧒, multi-lane | both | "Simple generate": collapse to type+yardage+go. **CORE parts stay:** type, pool mode, yardage, generate-for. |
| 19 | **Community / social** | Discord link, Supporter tier button | both | "Icing, not cake." Pure engagement. |
| 20 | **Browser notifications** | `PushNotificationsPanel` opt-in | both | Optional; user already controls per-device. |
| 21 | **Engagement/UX chrome** | Feedback button, tour replay, report export buttons, quick-launch cards, copy/print/whiteboard | both | Minor niceties; lowest-value toggles. |

---

## CORE — never gate (explicit list)
Generator + History; the generate essentials (workout type, pool/course mode, max
yardage, "Generate for" target picker); Run mode (`PaceClockView`, lap, finish-log);
Log/Save-to-History; **Assigned to me**; Progress dashboard (volume, PRs, benchmarks);
Race goals / PR progression; Profile account (name/email/gender/class-year/goals/
phase/level), constraints **transparency** (swimmer sees what coach set), team-defaults
transparency, data export; subscription tier display + paywall buttons; **R4 Program
Recap** for swimmers; Parent dashboard. (iOS CORE: sign-in, run, profile, sessions.)

---

## iOS scope (parity)
iOS is a **thin swimmer-first subset** — only ~6 user surfaces, no feature-flag
mechanism yet. It reads `GET /api/me/bootstrap` (tolerant decode), so flags fold in
cleanly. Only **3 coach surfaces** exist to gate: **Generate-for**, **roll-call
(PracticesView)**, **Coach notes** — plus optional History/Assigned. Teams/roster/
reports/lessons/constraints/events **don't exist on iOS yet**, so Phase 6 iOS scope
is small. Recommended bootstrap shape: a per-team `optionVisibility` map (nil ⇒ allow,
so older clients degrade safe). Gating hooks: `HomeView` menu, `GenerateView` target
picker, `CoachNotesSheet`.

---

## Presets (one-click, then an "advanced" expander of the 21 bundles)
- **Simple** (private/lesson coach): everything in #1–#18 OFF; #19–#21 OFF. Net app =
  generate → (assign) → run → log. (This is the Lesson-tier default candidate.)
- **Standard** (small club): coach tools ON; OFF by default the heaviest — Reports (#8),
  Curation tier (#11), Lane plans (#14), Meet-anchored taper (#5). Events ON.
- **Full** (default today): all ON — **no behavior change for existing teams.**

---

## What the old `PHASE_6_SCOPE.md` list MISSED (reconciliation)
The stale list had generation toggles + (constraints · curation · catalog · UGC ·
reports · lane plans · meet anchors) + (intents/week · generate-for). This audit adds:
**Events/meets, RSVP, Venues & weather, Calendar distribution (.ics), Attendance/
roll-call, Facilities, Roster onboarding tools (bulk import/join tokens/claim/CSV),
Compliance credentials, Coach notes, Community/Discord, Supporter tier, Browser
notifications, Engagement chrome.** Also corrected: "training-phase picker" is a
**personal Profile setting, not a generate-screen toggle**; "Generate-for" is **CORE**
(coach workflow), not a toggle.

---

## Open decisions for the scope session (carry from PHASE_6_SCOPE §"Open questions")
1. Bundle granularity confirmed (21 bundles + 3 presets)? Or finer/coarser?
2. Storage: `teams.feature_flags` JSON column vs `team_feature_flags` table. Surface in
   `me`/bootstrap so web + iOS gate at render.
3. Multi-team users: union for personal surfaces, per-team-context for team surfaces.
4. UI-hide only (v1) vs server-enforce. (Lean: UI-hide.)
5. Lesson tier ships with the **Simple** preset by default.
6. Events bundle internal granularity — one switch for #1–#5, or sub-toggles?
7. Don't gate `R4 Program Recap` or any swimmer-core surface — enforce in code review.
