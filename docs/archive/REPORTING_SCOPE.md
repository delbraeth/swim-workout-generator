# Reporting Engine — v1 Scope

**Status:** scope locked 2026-05-23. Build pending (Bigger thread on ROADMAP). Companion to relationships v1.1 (rosters / coaches / groups / lane plans) and coach-curation-impact v3.0 (single-pane reach × effectiveness, already shipped).

This doc is the planning-session output. After Cap'n signs off, it moves to Bigger threads → first paying-coach trigger to build.

---

## 1 — Locked decisions (2026-05-23)

| Aspect | Choice |
|---|---|
| **Audience (v1)** | Three: (a) **individual coach (self-only)**, (b) **SetForge admin (cross-team)**, (c) **Masters/solo coach with no roster** (program-level rollups, no swimmer dimension). Head-coach cross-coach-within-team **deferred to v2**. |
| **Attendance** | **Bundle a lightweight version into v1.** Default-present model: coach taps "Mark practice done" on a scheduled workout → roster pre-checked → uncheck absences → save. No-op when no roster is attached (Masters / solo). |
| **External artifact** | **Include weekly recap export in v1.** PDF (printable) + plain-text/markdown (paste-into-email). No SMTP infra; coach copies to their own tool. |
| **Permission model** | Self-only for coaches in v1. The data already supports cross-coach (coach-curation-impact aggregates across a coach's swimmers) but the *report views* are gated to `req.userSub` = report owner. Admin reports are gated to `is_admin`. |
| **Time grain** | All reports support: week / month / quarter / season-to-date / custom date range. Default = last 30 days, matching existing curation-impact pattern. |
| **Data model deltas** | One new table (`practice_attendance`). No schema change to `workouts`, `scheduled_workouts`, `group_members`. |
| **Where it lives in the app** | New top-nav "Reports" entry, admin/support-style toggleable button (per Cap'n's [[feedback-toggleable-nav-buttons]] preference). Sub-tabs per report category. |
| **What v1 does NOT include** | Cross-coach comparison (head coach view), meet/race outcomes, time trials, perceived effort/RPE, swimmer-facing reports, email delivery. All deferred or explicitly out of scope. |

---

## 2 — Report inventory (v1)

Six reports across three audiences. Each report has a single owner (read role), a time range selector, a data source (existing tables only except where attendance is needed), and an export format.

### Coach reports (self-only, gated to `req.userSub` as primary coach)

**R1 — Programming Mix** (Marcus persona, ask #1+2+3+5)
- For each of your groups, in selected range:
  - Total yardage, broken down by type (9 categories) × stroke (6 strokes)
  - Section mix: warmup % / main % / cooldown % / recovery %
  - Generation source mix: Bank % / Engine % / Mix %
  - Bank label diversity: distinct labels used vs. available in your enabled set (heatmap rows)
- Charts: stacked bar (yardage by type over time), pie (source mix), heatmap (label coverage)
- Source: `workouts` (payload JSON) + `group_members` join for group filter

**R2 — Schedule Adherence** (Dana ask #1, scaled down to self)
- For each of your groups, in selected range:
  - Scheduled practices vs. practices marked done (% completion)
  - Practices with attendance recorded vs. practices marked done without attendance
  - Average attendance % per scheduled workout (if attendance recorded)
  - Roster size trend (members added/removed in range)
- Source: `scheduled_workouts` + new `practice_attendance` + `group_members`

**R3 — Curation Log** (Marcus ask #4)
- All favorites + disfavorites you've set in selected range, with timestamps
- Coach-propagated items you inherited (read-only, from upstream coach)
- One-click jump-to-revisit in catalog
- Bank labels, set IDs, engine tuples — three subsections, mirrors existing audit panel
- Source: `favorites` + `disfavorites` + `user_favorite_sets` + `user_disfavor_sets` + `settings.extra.engine_*` JSON

### Solo/Masters report (no-roster fallback)

**R4 — Program Recap** (Jen persona, ask #1+2+3+4+5)
- Your selected range, no group/swimmer dimension:
  - Total yardage + per-stroke + per-type rollup
  - Most-used + least-used templates (top 10 / bottom 10)
  - Multi-lane fit success rate: of multi-lane workouts generated, what % had zero `__laneFitFallback` flags
  - 4-stroke balance check: any 30-day window in range that missed a stroke entirely
- Export: weekly-recap PDF (one page) + markdown (paste-into-email)
- Source: `workouts` (own only)

### SetForge admin reports (gated to `is_admin`)

**R5 — Platform Health** (Cap'n ask #1+2+5)
- For all teams (or filter to one team):
  - Active coaches last 7/14/30 days (last-generate timestamp)
  - Workouts/week per team, trended over selected range
  - Feature adoption %: Engine vs. Bank vs. Mix; Multi-lane; Has-favorites; Has-disfavorites
  - Engine fallback rate trended over time (continues the one-shot measurement from `tools/measure_fallback_rate.mjs`)
- Source: `workouts` + `users` + `teams` + `team_coaches` + `settings`

**R6 — Curation & Support Activity** (Cap'n ask #3+4+6)
- Curation health: any team where a propagating coach's disfavor reduces the effective bank by >30% for their downstream swimmers (early-warning of "app got boring")
- Impersonation activity: per support actor, count of sessions, mean duration, target teams. Filter by date range.
- Audit feed: filterable view of `audit_events` already exists; this report adds **per-team rollups** of the existing data.
- Source: existing tables; no new data

---

## 3 — Lightweight attendance — data model

### Migration 029
```sql
-- One row per (scheduled workout, swimmer) — present/absent
CREATE TABLE IF NOT EXISTS `practice_attendance` (
  `id`                   BIGINT       NOT NULL AUTO_INCREMENT,
  `scheduled_workout_id` BIGINT       NOT NULL,
  `swimmer_sub`          VARCHAR(64)  NULL,
  `managed_id`           BIGINT       NULL,
  `present`              BOOLEAN      NOT NULL DEFAULT TRUE,
  `notes`                TEXT         NULL,
  `recorded_by_sub`      VARCHAR(64)  NOT NULL,
  `recorded_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_swo_swimmer` (`scheduled_workout_id`, `swimmer_sub`),
  UNIQUE KEY `uq_swo_managed` (`scheduled_workout_id`, `managed_id`),
  KEY `idx_recorded_at` (`recorded_at`),
  CONSTRAINT `chk_one_target` CHECK (
    (`swimmer_sub` IS NOT NULL AND `managed_id` IS NULL) OR
    (`swimmer_sub` IS NULL AND `managed_id` IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Mark a scheduled workout as completed (vs. just scheduled / cancelled)
ALTER TABLE `scheduled_workouts`
  ADD COLUMN `completed_at` DATETIME NULL AFTER `scheduled_date`,
  ADD COLUMN `completed_by_sub` VARCHAR(64) NULL AFTER `completed_at`;
```

Two-target convention (`swimmer_sub` XOR `managed_id`) mirrors `workout_assignments` — same pattern, same reasons.

### UX

1. Coach opens a scheduled workout for a group → sees "Mark practice done" button.
2. Click opens modal: roster from `group_members` pre-rendered, all checked.
3. Coach unchecks absences (and optional per-swimmer notes).
4. Save → INSERT rows for all roster members + UPDATE `scheduled_workouts.completed_at`.
5. After save, "Mark practice done" replaced with "Edit attendance" (re-opens modal).

Edge cases:
- **No roster attached (solo, masters):** "Mark practice done" still works, just sets `completed_at`, no attendance rows. R2 surfaces this as "completed without attendance recorded."
- **Workout completed retroactively:** date selector in modal allows backdating up to 14 days (matches existing scheduled_workouts behavior).
- **Swimmer added to group after workout date:** they don't appear in that workout's roster, even if attendance is edited later. (Reports must use point-in-time roster snapshots.)

---

## 4 — Server routes

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/api/scheduled-workouts/:id/complete` | coach (owns scheduled workout) | Body: `{ completed_at, attendance: [{ swimmer_sub OR managed_id, present, notes }, ...] }`. Upserts attendance rows + stamps `completed_at`. |
| `GET`  | `/api/reports/programming-mix` | coach (self) | Query: `?range=30d&group_id=...`. Returns R1 data. |
| `GET`  | `/api/reports/schedule-adherence` | coach (self) | Query: `?range=30d&group_id=...`. Returns R2 data. |
| `GET`  | `/api/reports/curation-log` | coach (self) | Returns R3 data (uses existing fav/disfavor reads). |
| `GET`  | `/api/reports/program-recap` | any user with workouts | Returns R4 data. |
| `GET`  | `/api/reports/platform-health` | admin | Query: `?range=30d&team_id=...` (team_id optional). Returns R5 data. |
| `GET`  | `/api/reports/curation-support` | admin | Returns R6 data. |
| `GET`  | `/api/reports/:report_id/export` | matches read auth | Query: `?format=pdf|md`. Returns rendered report. |

**Performance:** Reports run on every load (no caching layer in v1). Acceptable up to ~1k workouts/team — we're well under that. If a single report query exceeds 500ms, add a materialized rollup table in v1.1, not v1.

---

## 5 — Client UI

New top-nav "Reports" toggleable button (admin/catalog pattern per [[feedback-toggleable-nav-buttons]]).

**Coach view (self):**
- Tabs: Programming Mix | Schedule Adherence | Curation Log
- Sticky range selector (week / month / quarter / season-to-date / custom)
- Group filter dropdown (when coach owns multiple groups)
- Export button per tab

**Solo view:**
- Single page: Program Recap
- Range selector + Export

**Admin view:**
- Tabs: Platform Health | Curation & Support
- Team filter dropdown (optional)
- Range selector

Charts: extend existing chart usage in `index.html` (no new lib unless needed; if needed, prefer Chart.js since it's already CDN-cleared for artifacts).

---

## 6 — Export format

### PDF
- One-page recap layout: title, date range, group/owner, 3-4 summary stats, single chart (when relevant), set list.
- Rendered server-side via existing print-view pattern (see `MultiPacePrintView` for reference).
- File served as `application/pdf`.

### Markdown
- Plain text dump suitable for paste into email/Slack/etc.
- Headers + bullet list + a small ASCII table.
- File served as `text/markdown`.

Both formats share one Renderer per report. No new server-side libraries.

---

## 7 — Phases & estimate

| Phase | What | ~Hours |
|---|---|---|
| **Phase A** — Attendance | Migration 029, `dbCompleteScheduledWorkout` + helpers, `/api/scheduled-workouts/:id/complete` route, "Mark practice done" modal in UI. Unblocks R2. | 6-8h |
| **Phase B** — Coach reports (R1-R3) | Three report endpoints + three UI tabs. R3 mostly reuses existing fav/disfavor helpers. | 6-8h |
| **Phase C** — Solo/Masters report (R4) | One endpoint + one UI page. Reuses Phase B chart components. | 2-3h |
| **Phase D** — Admin reports (R5-R6) | Two endpoints + admin Reports tab. R5 trends require date-bucket grouping. | 4-6h |
| **Phase E** — Export | PDF + markdown renderers per report, export route. Single shared renderer per report. | 4-6h |
| **Phase F** — Smoke, manual sweep, deploy | Test matrix, manual docs for each report, deploy. | 2-3h |

**Total: ~24-34h.** Reference: VIEW_AS_V3 (server + client) was ~12h combined; this is roughly 2-3× that, driven by attendance UX + export rendering + 6 distinct reports.

---

## 8 — Risks & open questions

**Honest gaps that will surface during build:**

- **Group roster at time-of-workout vs. now.** If a swimmer joined a group after a workout was scheduled, do they appear in attendance? Decision: roster snapshot at `scheduled_workouts.completed_at`. Need to verify `group_members.added_at` exists — if not, ALTER TABLE in migration 029.
- **Workouts that aren't tied to a scheduled_workout.** Lots of generation happens ad-hoc (Generate button → no save → no schedule row). R1 needs to include ad-hoc workouts in "programming mix" but R2 (adherence) only cares about scheduled. Two different queries.
- **Coach-of-record for multi-coach groups.** With assistant coaches (v1.9 propagation), who "owns" the workout's mix in R1? Decision: workout creator (`workouts.user_sub`) owns it; report filters by group via `workout_assignments` or section payload, not by coach attribution.
- **Privacy of attendance.** Coach sees absence reasons for their group; admin sees only aggregates. R5/R6 must roll up before serialization; never expose individual swimmer absence to admin.
- **Export of swimmer-identifying data.** R2 and R3 may name swimmers. If the coach exports + emails, that's their compliance. Should we add a "anonymize names" toggle? Defer to v1.1 unless first paying coach asks.

**Out of scope for v1 (recorded so we don't relitigate):**
- Cross-coach comparison within a team (Dana persona) → v2
- Meet times, time trials, race results → separate "Outcomes" scope
- RPE / swimmer feedback loops → separate "Subjective" scope
- Email delivery (vs. paste-into-email export) → never (per [[feedback-no-password-auth]] — same principle: don't own a new comms channel)
- Swimmer-facing reports → separate scope; would need swimmer-side UI work
- Live dashboards / real-time updates → reports are on-demand snapshots in v1

---

## 9 — Trigger to build

Same as Pricing — first paying coach who asks for any of: "how is my group doing", "what did I do this month", "weekly recap I can share". If they ask, v1 ships in one focused session-week.

Until then: this doc is the contract. ROADMAP entry under Bigger threads.
