# Meet-Anchored Taper — scope (cheap version)

**Status:** scope-only (2026-05-26). Implementation lives in PHASED_PLAN §3 Phase 3 — "First paying HS coach can sign, pay, and stick." Smaller deliverable than PSC. Cost band M (cheap) — explicit cap on what's in this scope vs the deferred full season planner (Phase 5+).

**Triple-cross-validated:** HS coach + Club coach + Summer-League coach personas all asked for "tie Training Phase to a date so I don't have to remember to flip it every Monday." Teen + Solo + Tri swimmer personas asked for "show me where I am in the season."

**Pattern source:** bridges two existing systems — `team_events` table (name + date calendar) and the Training Phase top-level filter (`base` / `build` / `peak` / `taper` at `public/index.html:471-483`).

---

## 1. Why

Every HS / Club / Summer-League season is built around one championship meet. Coaches manually flip Training Phase week-to-week using a mental calendar. The flips get missed; programming drifts toward whatever phase the coach picked last; "we're 4 weeks out and still in Build" is a real failure mode.

The fix is small: let the coach pick the championship meet from their event calendar, and SetForge does the math.

**The cheap version is bounded on purpose.** The full season planner (mesocycle templates, per-week phase auto-shift with macrocycle dashboards, per-swimmer PR-anchored race-pace targets, multi-event taper around dual meets) is a meaningfully bigger product — deferred to Phase 5 trigger-driven work. Cheap version delivers the 80% value (no missed phase flips) without the 80% cost.

---

## 2. Locked decisions (2026-05-26)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Fixed phase-roll formula** | Hardcoded: ≥12 weeks out = **Base** · 8-12 weeks = **Build** · 4-8 weeks = **Peak** · 0-4 weeks = **Taper** · past = no suggestion (anchor inactive). Configurable mesocycle lengths live in the full season planner; cheap version doesn't expose them. |
| 2 | **Per-group anchor, coach picks** | Coach picks one event from their group's event calendar as that group's anchor. All swimmers in the group inherit it. Matches "team aims at Sectionals" reality. Solo athletes (group of one with self-as-coach) work the same way. |
| 3 | **One active anchor per group at a time** | If a coach picks a new anchor, the old one is cleared. Enforced at DB level via UNIQUE on `group_anchors(group_id) WHERE active=1`. Prevents the "two anchors fighting" failure mode. |
| 4 | **Suggest + pin manual override** | The anchor computes a *suggested* phase. The Training Phase pill renders the suggestion with a 🎯 badge (e.g. `🌱 Base 🎯 — anchor: Sectionals · 14 wks`). Coach can manually pick a different phase; the manual choice **pins for the current session only** (localStorage flag `phase_manual_pin`). Next session reverts to the anchor's current suggestion. Anchor is never silently overridden; coach always sees what the anchor wants. |
| 5 | **Swimmer surface: countdown badge on Assigned-to-me cards** | Each assigned workout from an anchored group gets a header badge: `Week 6 of 14 toward Sectionals · 8 wks out`. No race-pace personalization (full version). No swimmer-side phase override (swimmers already don't have a Training Phase filter on their own generator — solo flow only). |
| 6 | **Past anchors and far-future anchors are inactive** | If anchor date is in the past → anchor inactive, no suggestion, no badge. If anchor is >20 weeks out → still active but suggestion is Base (the default; no value added until we cross the 12-wk threshold). Documented; not an edge-case error. |
| 7 | **Coach UX entry: "Set as anchor" button in event row** | Existing TeamsView event-management UI already lists events per team. Each event row gets a 🎯 button. Click → confirms "Set as anchor for [group]?" → if another anchor exists, "this replaces [prior anchor]". If event has no group context, ask coach to pick which of the team's groups. |
| 8 | **No reporting integration in cheap version** | R4 Program Recap already shows phase distribution. Adding "% of weeks in suggested vs override phase" is a Phase 5 metric. Cheap version doesn't surface anchor activity in reports. |
| 9 | **Audit: `anchor.set`, `anchor.clear`** | Two event types. Details: `{ group_id, event_id, event_date }`. R3 Curation Log doesn't need a new subsection; these are infrequent + low-volume. |
| 10 | **Anchor deletion cascades** | If the underlying `team_events` row is deleted, the anchor flips to inactive automatically (FOREIGN KEY with `ON DELETE SET NULL` on `event_id`, then a `dbExpireOrphanAnchors` cron sweep). Group reverts to manual Training Phase, no surprise behavior. |
| 11 | **No notification when anchor changes the suggestion week** | A coach who picks a 14-wk anchor doesn't get a weekly "you're now in Peak" email. The pill shows the new suggestion on next visit; that's the signal. Email noise risk too high for the value. |
| 12 | **Multi-team coach: anchor is per-group, not per-coach** | A coach with three teams sees three independent anchors, one per group (or per team for groups that share an event). No conflict. |

---

## 3. Implementation (Phase 3, ships alongside or after PSC)

### 3.1 New migration (036 — assumes PSC takes 035)

```sql
CREATE TABLE `group_anchors` (
  `id`              BIGINT AUTO_INCREMENT PRIMARY KEY,
  `group_id`        BIGINT NOT NULL,
  `event_id`        BIGINT NULL,                    -- FK to team_events; NULL = orphaned (event deleted)
  `set_by_coach_sub` VARCHAR(255) NOT NULL,
  `active`          TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `cleared_at`      DATETIME NULL,
  UNIQUE KEY `uq_one_active_per_group` (`group_id`, `active`),  -- only one active row per group
  INDEX `idx_event`  (`event_id`),
  FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`)        ON DELETE CASCADE,
  FOREIGN KEY (`event_id`) REFERENCES `team_events`(`id`)   ON DELETE SET NULL
) ENGINE=InnoDB;
```

The unique constraint enforces one-anchor-per-group at the DB level. `cleared_at` preserves history for audit; old rows just flip `active=0`.

### 3.2 New db.js helpers

- `dbSetGroupAnchor({ groupId, eventId, byCoachSub })` — clears existing active anchor (if any), inserts new active row. Returns new anchor id. Authz: coach-of-group.
- `dbClearGroupAnchor(groupId, byCoachSub)` — flips active=0 + stamps cleared_at. Authz check.
- `dbGetActiveAnchor(groupId)` — returns `{ anchor_id, event_id, event_name, event_date, weeks_out, suggested_phase }` or null.
- `dbGetSuggestedPhaseForGroup(groupId)` — calls `dbGetActiveAnchor` + computes suggested phase from `weeks_out` per §2 decision 1. Returns null if no active anchor or anchor is past.
- `dbExpireOrphanAnchors()` — cron sweep; finds rows where `event_id IS NULL AND active=1`, flips active=0. Runs hourly alongside `dbExpirePastConstraints` from PSC (same worker tick).

### 3.3 Phase computation (pure function, no DB)

```js
function suggestedPhaseFromWeeksOut(weeksOut) {
  if (weeksOut == null || weeksOut < 0) return null;  // past or no anchor
  if (weeksOut >= 12) return 'base';
  if (weeksOut >= 8)  return 'build';
  if (weeksOut >= 4)  return 'peak';
  return 'taper';  // 0-4 weeks
}
```

Lives in a shared file (`lib/season.js` new). Reused by db helper + client display + tests.

### 3.4 New server.js routes

- `GET /api/groups/:id/anchor` — read; auth: coach-of-group OR swimmer-in-group (swimmers need this for the countdown badge)
- `POST /api/groups/:id/anchor` — body: `{ event_id }`. Auth: coach-of-group. Audit `anchor.set`.
- `DELETE /api/groups/:id/anchor` — clear active anchor. Audit `anchor.clear`.

All write routes: `checkOrigin` + `requireCsrf` + `writeLimiter`.

### 3.5 Client: Training Phase pill rendering

Existing pill (~`public/index.html:471-483` constants, plus rendering elsewhere) shows current phase. Extended:

```
[🌱 Base ▾]              ← no anchor (today's UI, unchanged)

[🌱 Base 🎯 ▾]           ← anchor active, suggestion matches current selection
                          tooltip: "Suggested by anchor: Sectionals · 14 wks · base"

[🔨 Build 🎯̶ ▾]          ← anchor suggests Build but coach has manually pinned Base for this session
                          tooltip: "Anchor suggests build (Sectionals · 10 wks). Manual pin: base."
                          click pill → opens dropdown with anchor's suggestion at top + "Unpin (revert to anchor)"
```

Pin behavior: when coach manually picks a phase that differs from the anchor's suggestion, write `phase_manual_pin = true` to `localStorage`. On page load: if pin set AND anchor still suggests something different → keep the manual choice + show the 🎯̶ strikethrough variant. On unpin: clear the localStorage flag + adopt the anchor's suggestion.

### 3.6 Client: TeamsView event-management

Existing event list per team gets a 🎯 button per row. Click flow:

```
Coach clicks 🎯 on "Sectionals · 2026-08-15"
  → Confirm modal:
     ┌──────────────────────────────────────┐
     │ Set "Sectionals" as anchor for:      │
     │  ○ Senior Group                       │
     │  ○ JO Group                           │
     │  ● Sprint Group   (currently anchored │
     │                    to State Meets)    │
     │                                       │
     │ Setting will replace existing anchor. │
     │                  [Cancel]  [Set]      │
     └──────────────────────────────────────┘
```

Group dropdown defaults to "no selection" (forces a pick). If only one group exists, auto-fills. If event is in the past, button greyed-out with tooltip "event already passed."

### 3.7 Client: Assigned-to-me countdown badge

`AssignedToMeView` cards already render assigned workouts with metadata. New header line when the source group has an active anchor:

```
┌────────────────────────────────────────────────┐
│ 🏊 Coach Smith · Senior Group                  │
│ 🎯 Week 6 of 14 · 8 wks to Sectionals          │   ← new line
│ Distance · 3200 yd · ~52 min                   │
│ ...                                            │
└────────────────────────────────────────────────┘
```

Computation: `weekOf = mesocycleLength - weeksOut`, where `mesocycleLength` is fixed at 14 in cheap version (longest typical season). Cosmetic only — doesn't drive logic.

### 3.8 Picker/engine integration

**None required.** Training Phase already feeds the picker; the anchor just changes what Training Phase value the user sees suggested. Existing phase-filtering logic is unchanged.

This is what makes "cheap" cheap: no engine work, no picker work, no template work. Pure data-model + UI extension.

---

## 4. Smoke checklist

- Coach creates event "Sectionals · 2026-08-15" → clicks 🎯 → picks Senior Group → anchor row created → API returns anchor metadata.
- Coach navigates to Generator → Training Phase pill shows 🎯 badge with current suggestion (Base if today is 2026-05-26 = ~12 wks out; or Build/Peak/Taper if closer).
- Time progresses (mock the date for testing): 2026-06-23 (8 wks out) → suggestion flips to Build. 2026-07-21 (4 wks out) → Peak. 2026-08-08 (1 wk out) → Taper. 2026-08-16 (1 day past) → anchor inactive, no suggestion, pill reverts to ungated.
- Coach manually picks Base while anchor suggests Build → `localStorage.phase_manual_pin = "1"` → pill shows strikethrough 🎯̶ → reload → still Base (pin persists for session).
- Coach clicks "Unpin" → localStorage cleared → pill reverts to suggested Build.
- Coach deletes the underlying event in TeamsView → `event_id` flips to NULL via cascade → `dbExpireOrphanAnchors` cron run next hour → `active=0` → next reload, group has no anchor + manual phase wins.
- Coach sets a SECOND event as anchor for the same group → prior anchor row's `active` flips to 0 (via DELETE then INSERT), new row inserted → tooltip + confirm modal communicated the replacement.
- Swimmer in the anchored group → AssignedToMe cards show the countdown badge.
- Swimmer in a group with NO anchor → no badge.
- Authz: non-coach tries to POST `/api/groups/:id/anchor` → 403.

---

## 5. Out of scope (explicitly cut from cheap version; defer to full season planner Phase 5+)

- **Mesocycle template library.** "Standard 14-wk HS season template" prefilled with phase distributions. Out.
- **Macrocycle dashboards.** "Week 6 of 14 toward Sectionals · 7 wks of Build complete · 4 wks of Peak ahead" multi-phase rollup. Out.
- **Per-swimmer PR-anchored race-pace.** Cheap version uses generic `pace_base`; full version computes per-stroke race-pace from PR + anchor distance + phase. Out.
- **Multi-event taper.** Coach has dual meets every 2 weeks then Sectionals in 16 weeks — only championship is the anchor. Out.
- **Configurable phase boundaries per coach.** "I do 6-wk Peaks not 4-wk." Out.
- **Auto-shift settings (default pace, set bias) by phase.** "When in Peak, default pace tightens 5%." Out.
- **Reporting: anchor adherence.** "Coach overrode anchor 8 of 14 weeks." R4 Program Recap addition. Out.
- **Notifications on phase transition.** Weekly "you're now in Peak" email. Out (and decision 11 explicitly cuts).
- **Swimmer-side Training Phase filter.** Swimmers don't have one today; cheap version doesn't add. Out.
- **Cross-team anchor sharing.** If two teams converge at the same championship, anchor is set independently per team. Out.

---

## 6. Open Cap'n forks (none block v1)

1. **Pill color when anchor active.** Should the pill take the anchor color (e.g. amber for Taper) or stay neutral with just the 🎯 badge? Visual designer call (i.e. you). Cheap version ships neutral + badge; switch later if it doesn't read well.
2. **Past-anchor cleanup policy.** Today decision 6 says "past anchor = inactive, no suggestion." Should past anchors auto-clear after 30 days (purge from the per-group anchor history), or stay forever for audit? v1 keeps forever; tune later.
3. **Solo athlete UX.** A solo athlete is technically a group of one with self-as-coach. Anchor flow works mechanically but might benefit from a "your next race" simplified UI rather than the full group-anchor modal. v1 reuses the coach flow; if solo testers complain, simplify in v1.1.

---

## 7. Effort estimate

~6-10h. Cheap version is genuinely small because the heavy lifting (Training Phase logic, event calendar, group→swimmer fan-out) already exists.

- Migration 036 + db helpers + cron: 1.5h
- Server routes + authz: 1h
- `suggestedPhaseFromWeeksOut` + tests: 0.5h
- Pill UI extension (badge, tooltip, pin/unpin): 2h
- TeamsView event-row 🎯 button + confirm modal: 1.5h
- AssignedToMe countdown badge: 1h
- Smoke + manual update + ROADMAP: 1-2h

Single 8-10h session feasible. Could ship same day as PSC's Phase 3a (data model + server slice) and integrate together.

---

## 8. Dependencies

- **Phase 2 should ship first** (email worker hosts the `dbExpireOrphanAnchors` cron tick, piggybacking the same `setInterval` as PSC's `dbExpirePastConstraints`). Could ship before Phase 2 by adding its own timer; not recommended.
- **No new external services.**
- **No new Cap'n hand-work** beyond the existing Phase 2 dependencies.

---

## 9. Related

- [[swim-generator-relationships-scope]] — group/team_events data model
- `PER_SWIMMER_CONSTRAINTS_SCOPE.md` §3.5 — shares the cron worker tick
- [[swim-generator-architecture]] — Training Phase constants location (`public/index.html:471-483`)
- [[swim-generator-coach-evaluation-2026-05-25]] — coach personas surfacing "tie phase to a date"
- [[swim-generator-swimmer-evaluation-2026-05-25]] — swimmer personas surfacing "show me where I am in the season"
- PHASED_PLAN §3 Phase 3 — Phase 3 deliverables in order; this is the smaller of the two engineering items
- ROADMAP "Bigger threads" — full season planner deferred to Phase 5 trigger-driven
