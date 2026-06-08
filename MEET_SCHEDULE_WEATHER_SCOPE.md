# Team Calendar (meets, events, practices) + Outdoor-Pool Weather + RSVP — scope (spec only)

> **✅ BUILT 2026-06-06 (web): RSVP (Slice B1/B2) + the universal venue catalog +
> WeatherKit weather.** Shipped: `venues` table (vn_xxx, dedup-on-create, §2),
> `team_events.venue_id`/`start_time` (Option A, §3.3), `weather_cache` (§4.2 #4),
> `lib/weather.js` (WeatherKit REST, ES256 JWT, inert-until-configured, §4.2),
> client `VenuePicker` (search/create + MapKit geocode, §7.2) + `WeatherChip` on
> coach event rows and the swimmer RSVP panel. Migration **058**. Decisions locked
> per §9: venue id `vn_xxx` (#1); extend `team_events` (#2); venues usable on
> create, edit-moderation reserved (#3/#4); dedicated `weather_cache` (#5); MapKit
> JS client-side geocode, server never geocodes (#14); daily forecast + hourly
> lightning/heat advisory when `start_time` set (#15). **Still deferred:** practice
> RSVP/weather; group-level events (§3.5); recurrence (§3.3.2); shared venue
> edit-moderation surface (§2 #4); all push/notify behaviors (§7.1); iOS parity.
> **✅ ACTIVATED in prod 2026-06-06** — WeatherKit live (selftest 200, real
> forecasts rendering). `sub` = bundle `com.delbraeth.swimworkout` (via
> `APPLE_NATIVE_BUNDLE_ID`/`APPLE_CLIENT_ID` fallback, no new env var); WeatherKit
> capability must be enabled on BOTH the key AND the App ID (the `NOT_ENABLED`
> gotcha). Admin `DELETE /api/venues/:id` archive route now exists (partially
> closes the §2 #4 edit-moderation gap — removal only; field edits still deferred).

**Status:** spec-only (2026-06-01). No implementation. Deferred future enhancement; sizing band L (shared venue model + a new external API + first forward-looking attendance surface). This doc defines the data model, the "universal pool" decision, the generalized team-event calendar + pills, the outdoor tag + WeatherKit call, and unified RSVP — so implementation is mechanical when prioritized.

> **Merged 2026-06-03:** the former separate Phase 5 item "one-way CSV/.ics export"
> rolls into this feature family — the schedule `.ics` feed is just the export face of
> the calendar defined here, and the roster CSV rides along (or lives with MAAP). In
> Phase-5 terms this doc is **Slice B** (the calendar/venue/weather/RSVP body, band L);
> the export bridges are **Slice A** (band S, deps met on today's
> `scheduled_workouts`/`team_events`/roster, shippable before Slice B). See
> `PHASE_5_SCOPE.md` item 5.

**Pattern source:** bridges three existing systems — `team_facilities` (team-scoped pools + `addresses`), `team_events` (name + date calendar, today meet-only, drives group-anchors), and `scheduled_workouts` (practices, already FK `facility_id`). Adds a shared venue layer, a generalized event calendar + pills, weather enrichment, and RSVP.

---

## 1. Why

Four related asks, one coherent system:

1. **Schedule meets by team/group** with a real location and time — today `team_events` is just `{name, date}` with no facility link and no time-of-day, and `scheduled_workouts` (practices) link a `facility_id` but no weather context.
2. **General team events, not just meets** — picture day, team meal/banquet, parent meeting, etc., on the same calendar and surfaced as pills (§3.3–3.4).
3. **Outdoor events get weather.** When the venue is an outdoor pool, surface the forecast/conditions *at the time of the event* via Apple **WeatherKit**. Indoor / venue-less events never call weather (§4).
4. **Expected attendance / RSVP** across meets AND practices, composing with the existing coach roll-call (§6).

The non-obvious requirement (stated by the user, and the reason this is band L not S): **pool identity is universal, not team-scoped.** One team's *home* pool is another team's *away-meet* location. If every team re-enters "Mason Rec Center" as its own row, weather lookups duplicate, geocodes drift, and cross-team meet scheduling can't agree on a location. So this scope introduces a **shared venue catalog** that team facilities and meet locations both reference.

---

## 2. The universal-pool decision (the crux)

**Today:** `team_facilities` is team-scoped — `(team_id, name, address_id, course, lanes, is_primary)` → `addresses(line1/2, city, region, postal_code, country)`. No lat/lng. No indoor/outdoor. Two teams at the same physical pool = two unrelated rows.

**Proposed:** introduce a shared **`venues`** table (the universal pool/location catalog). `team_facilities` becomes a team's *relationship to* a venue (their home pool(s)), and meet locations reference a venue directly. A venue is created once and reused by everyone.

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **New `venues` table is the universal catalog** | One row per physical location. Carries geocode + indoor/outdoor + course, so weather + identity are defined once, not per team. |
| 2 | **`team_facilities` keeps existing columns but gains `venue_id` (nullable FK)** | Backward-compatible. Existing team facilities migrate by matching/creating a venue from their `address_id`; un-migrated rows still work (venue_id NULL → no weather, no shared identity). Don't break what ships. |
| 3 | **Venues are global + dedup-on-create** | When a coach adds a venue, fuzzy-match existing venues by normalized name + proximity (lat/lng within ~150m) before creating a new one. Avoids the "Mason Rec Center" ×6 problem. v1 can be name+postal match; geo-dedup is the better version. |
| 4 | **Venue edits are NOT freely shared-mutable in v1** | A universal row edited by any coach is a vandalism/accuracy risk. v1: venues are create-or-link; edits to core fields (name, geo, indoor/outdoor) are admin-moderated OR copy-on-write (a coach's correction creates a candidate, not an in-place overwrite). Pick one at build time; default to **admin-moderated** mirroring the UGC bank graduate-to-canonical pattern. |
| 5 | **`indoor_outdoor` lives on the venue, not the event** | It's a physical property of the pool, so it belongs to the universal row. An event inherits it from its venue. (Edge case: a venue with both — rare; model as the dominant/competition surface in v1, revisit if it bites.) |

---

## 3. Data model (proposed schema)

### 3.1 `venues` (new — universal pool/location catalog)
```
id                BIGINT PK            (or string vn_xxx to match gr_/ev_ convention — pick one)
name              VARCHAR(200) NOT NULL
address_id        BIGINT NULL FK addresses(id)
latitude          DECIMAL(9,6) NULL    -- required for weather; geocoded from address on create
longitude         DECIMAL(9,6) NULL
indoor_outdoor    ENUM('indoor','outdoor','unknown') NOT NULL DEFAULT 'unknown'
course            ENUM('SCY','SCM','LCM') NULL   -- mirrors team_facilities.course
timezone          VARCHAR(64) NULL     -- IANA tz of the venue; needed to resolve "event time" → UTC for weather
created_by_coach_sub VARCHAR(255) NULL
moderation_status ENUM('candidate','approved') NOT NULL DEFAULT 'candidate'  -- per decision #4
created_at, updated_at, archived_at
INDEX (latitude, longitude)   -- proximity dedup
```

### 3.2 `team_facilities` (extend — additive, non-breaking)
```
ADD COLUMN venue_id BIGINT NULL FK venues(id)   -- a team's home pool = a link to a venue
-- existing columns (name, address_id, course, lanes, is_primary) unchanged
```
**Migration plan (don't hand-wave this — naive matching defeats the universal-pool point).** Existing `addresses` have **no lat/lng**, so free-text address matching is unreliable and would mint duplicate venues. Plan:
1. Leave `venue_id` **NULL** on migration — no auto-match. Existing facilities keep working exactly as today (NULL venue → no weather, no shared identity).
2. **Lazily create/link a venue** when a coach next edits a facility OR schedules an event at it: geocode the address then, run dedup (§2 #3), and link. This avoids a big risky backfill and only spends geocoding calls on venues actually used.
3. Optional later: an admin tool to batch-geocode + dedup historical facilities once the dedup heuristic is trusted.
Net: migration is a pure additive column; venue population is incremental and deliberate, not a best-effort guess.

### 3.3 Team events — general calendar, not just meets
`team_events` today is a bare `{id, team_id, name, date}` calendar that drives group-anchors. This scope generalizes it into the team's **whole event calendar**: meets AND non-competition team happenings (picture day, banquet/team meal, parent meeting, fundraiser, travel, etc.). Same row, distinguished by a `kind`.

Two viable shapes — **decision needed at build time:**
- **Option A (extend `team_events`):** add `venue_id`, `start_time` (TIME/DATETIME), and `kind` (enum below) to the existing calendar. Lowest churn; group-anchors already depend on it. Practices stay in `scheduled_workouts`.
- **Option B (unified `events` table):** one schedule table for everything (meets, team events, practices) with `venue_id` + `start_at` + `team_id`/`group_id` + `kind`. Cleaner long-term but migrates two existing systems.

**Recommendation: Option A for v1.** The weather enrichment (§4) and RSVP (§6) both key off `venue_id` + a resolved start datetime + `kind`, so they work across event kinds regardless.

#### 3.3.1 `kind` enum
```
kind ENUM('meet','picture_day','team_meal','team_meeting','fundraiser','travel','social','other')
     NOT NULL DEFAULT 'meet'
```
- **Existing rows migrate to `meet`** (default), so today's meet calendar + group-anchors are unaffected.
- `kind` drives the **pill emoji/label** (§3.4) and which behaviors apply:
  - **Weather** (§4): gated on the *venue* being outdoor, not on `kind`. A banquet at an outdoor venue could show weather; a `team_meeting` with no venue never does. So weather keys off `venue_id`/outdoor, and `kind` is orthogonal.
  - **Group-anchor / taper math** (existing MEET_ANCHORED_TAPER): only `kind='meet'` is anchor-eligible. Non-meet kinds never drive phase suggestions — important so a "team meal" can't accidentally become a taper anchor. (The anchor picker must filter to `kind='meet'`.)
  - **RSVP** (§6): applies to any kind a coach marks RSVP-able (a banquet wants a headcount as much as a meet).
- `venue_id` is **nullable** — a `team_meeting` may be virtual / no pool; a `meet` should have one.

#### 3.3.2 Event lifecycle fields (the part that makes it a usable calendar)
A bare `{name, date, kind, venue}` row isn't enough to run a season off. Add:
```
start_at      DATETIME NULL   -- instant (UTC). NULL = all-day/date-only (back-comat with today's date-only rows)
end_at        DATETIME NULL   -- optional; meets run hours, meals ~2h. Drives weather-over-range (§4) + display
venue_tz      VARCHAR(64) NULL -- snapshot of the venue's IANA tz at schedule time (see tz rule below)
status        ENUM('scheduled','cancelled','postponed') NOT NULL DEFAULT 'scheduled'
status_note   VARCHAR(280) NULL  -- "cancelled — lightning", "moved to Sunday"
recurrence    VARCHAR(255) NULL  -- iCal RRULE string, NULL = one-off (see recurrence decision)
```

**Timezone rule (locks the #1 real-world bug — "9am meet showed as 6am").** Store `start_at`/`end_at` as **UTC instants**, plus `venue_tz` (snapshot from the venue, or the team's tz if venue-less). **Always display in the venue's local time with an explicit tz label** ("Sat 9:00 AM PT"), NOT the viewer's device tz — an away team must see the meet in the meet's local time. Weather (§4.2 #3) already assumes venue-local; this makes display consistent with it. Date-only events (`start_at` NULL) render as a day with no time.

**Cancellation is first-class** because it's where weather + RSVP + events intersect: a coach cancels an outdoor meet for storms → `status='cancelled'` + note → every RSVP'd swimmer must see "CANCELLED" on the pill/event, and (when push exists, §7) gets notified. A cancelled event stays on the calendar struck-through, never silently disappears (swimmers need to know it *was* cancelled, not just find it gone).

**End time / weather-over-range:** for an outdoor `meet` spanning hours, weather "at start" is too thin — heat and storms build during the session. When `end_at` is set on an outdoor venue, fetch the forecast across the window (hourly) and surface the worst-case advisory (peak temp, any lightning probability in-window), not just the start conditions.

**Recurrence (decision required, §8):** practices already have copy-forward (`dbRepeatWeek`). Events don't. Two options: (a) **v1 = one-off events only**, lean on `dbRepeatWeek` for recurring practices, defer event recurrence; or (b) add an `RRULE` field now and expand occurrences at read time. Recommendation: **(a) for v1** — recurrence is a meaningful build (occurrence expansion, exception handling, "edit this vs all") and most non-practice events (picture day, banquet) are genuinely one-off. The field is reserved in schema so (b) is a later additive step.

### 3.4 Event pills (home/greeting surface)
There are already **two** pill sources today: the group-anchor countdown (`groupAnchors` → 🎯 "N wks to <event>") AND a "most-imminent team event" pill (decision #38, `public/index.html` ~28377; server returns upcoming team events). So this isn't net-new rendering — it's **generalizing the existing team-event pill** to style by `kind` and show more than one. Each styled by `kind`:

| kind | pill | notes |
|---|---|---|
| `meet` | 🏁 / 🎯 countdown | existing anchor behavior preserved for anchored meets |
| `picture_day` | 📸 | |
| `team_meal` | 🍝 | "banquet", "pasta dinner" |
| `team_meeting` | 📣 | often venue-less |
| `fundraiser` | 💰 | |
| `travel` | 🚌 | |
| `social` | 🎉 | |
| `other` | 📌 | fallback |

Pill rules:
- Show upcoming events within a window (e.g. next ~2 weeks) for the viewer's team/group, nearest first — mirroring how `upcomingAnchors` already filters/sorts on iOS.
- A `meet` with an active group-anchor keeps its countdown phrasing; other kinds show date/relative-day ("Sat", "in 3 days").
- **Cancelled events** render struck-through with the status note ("CANCELLED — lightning"), not hidden.
- iOS: extend the existing `GroupAnchor`/event-pill rendering on the greeting card to accept a `kind` + emoji + status rather than assuming an active meet. Web: same, generalizing the decision-#38 pill.

### 3.5 Group-level events
`team_events` is team-scoped. To target a **squad** (per the ask), add nullable `group_id` to `team_events`: a meet/meal/meeting can be for one group; NULL = whole team. (Same column serves all kinds.)

---

## 4. Outdoor tag + WeatherKit

### 4.1 The tag
`venues.indoor_outdoor`. An event "is outdoor" iff its venue is outdoor. The tag is the **only** gate on whether a weather call is made — indoor venues never hit WeatherKit (cost + irrelevance).

### 4.2 WeatherKit call (when, where, what)
| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Apple WeatherKit** (not OpenWeather/etc.) | iOS-native, generous free tier under the Apple Developer Program, no extra vendor. Web could use the WeatherKit REST API with the same key; iOS uses the WeatherKit framework. |
| 2 | **Trigger: outdoor venue + event within forecast horizon** | Only call when `venue.indoor_outdoor='outdoor'` AND the event start is within WeatherKit's forecast window (~10 days). Past events → historical (separate endpoint) or skip. |
| 3 | **Key = (venue lat/lng, event start datetime in venue tz)** | Weather is at the *time of the event*, so we need `venues.latitude/longitude` + `venues.timezone` to resolve the local start to an instant. Hence tz + geo are required venue fields. |
| 4 | **Cache aggressively** | Cache forecast per (venue, day) with a short TTL (e.g. hourly refresh as the event approaches). WeatherKit bills per call; a meet with 50 swimmers viewing it must not = 50 calls. Server-side cache table or in-memory with TTL. |
| 5 | **Server-mediated for web; framework for iOS** | iOS: `WeatherKit` framework (needs the WeatherKit capability + entitlement on the App ID). Web: server calls the WeatherKit REST API (JWT signed with the same .p8 key family as App Store Connect/Apple auth — note this is a *separate* WeatherKit key). Both write the same cache. |
| 6 | **Graceful degradation** | No geocode, outside forecast horizon, or API failure → show the event with no weather, never block. Mirrors the engine's silent-fallback ethos. |

### 4.3 What's shown
Forecast at event start: temp, conditions (sun/rain/wind), and a swimmer-relevant flag or two (e.g. "lightning risk" → many outdoor meets delay on thunder; "wind/chop" for open-ish venues). v1 can be temp + condition + precip chance; the lightning/heat advisory is the higher-value version.

---

## 5. Permissions / scope
- Creating/linking venues + scheduling meets: **coach-gated** (`requireCoach`), same as facilities/events today.
- Venue core-field edits: **admin-moderated** (decision §2 #4).
- Viewing an event's weather: any user who can see the event (swimmers in the group/team).
- RSVP (see §6): any swimmer who can see the event may set their own RSVP; coaches see the roster-wide tally.

---

## 6. Expected attendance / RSVP (meets AND practices)

**Net-new feature — does not exist today.** Current attendance is *coach-side roll-call after the fact* (`practice_attendance`, the iOS Practices screen). There is **no swimmer-facing "I'm going" RSVP anywhere** in web or iOS. RSVP is forward-looking *intent*; roll-call is recorded *actuals*. They coexist on a timeline: **RSVP before → roll-call after.**

**RSVP covers both event types, not just meets.** A swimmer RSVPing "out" for Thursday practice is the same primitive as RSVPing for a meet, and the coach wants both headcounts. So RSVP is **one unified system** spanning meets (`team_events`) and practices (`scheduled_workouts`), not a meet-only add-on.

### 6.1 Why it belongs in this scope
- **Headcount for planning** — coach sees expected turnout per meet *and* per practice before the day.
- **Practice RSVP → roll-call lifecycle** — a practice can show "9 expected" beforehand (RSVP), then the coach takes actual roll-call on the day in the existing Practices/attendance sheet. The attendance sheet can even pre-seed presence from RSVP "going" as a convenience (coach still confirms).
- **Weather relevance** — an outdoor forecast matters more when N have RSVP'd yes; the "going" list is who to notify if a heat/lightning advisory fires (ties to §4.3).

### 6.2 Data model (proposed) — polymorphic across event types
The wrinkle: meets live in `team_events` (string ids `ev_xxx`) and practices in `scheduled_workouts` (int ids). A unified RSVP table therefore needs a **polymorphic target**, not a single FK:
```
event_rsvp
  target_kind   ENUM('meet','practice') NOT NULL   -- which table target_id points at
  target_id     VARCHAR(64) NOT NULL               -- team_events.id (ev_xxx) | scheduled_workouts.id (int as string)
  swimmer_sub   -- full-account swimmer (XOR managed_id — mirrors practice_attendance identity)
  managed_id    -- coach-managed swimmer (RSVP'd on their behalf by coach/parent)
  status        ENUM('going','maybe','out','no_response') NOT NULL DEFAULT 'no_response'
  responded_at, responded_by_sub   -- who set it (self / coach / parent)
  UNIQUE (target_kind, target_id, swimmer_sub)
  UNIQUE (target_kind, target_id, managed_id)
  INDEX (target_kind, target_id)   -- tally per event
```
Mirror `practice_attendance`'s exactly-one-of-swimmer_sub/managed_id convention and reuse the roster/identity helpers already in `db.js` (`dbGetGroupRosterAsOf`, the `s:`/`m:` key scheme) so RSVP and roll-call share identity handling end-to-end. Polymorphic-FK precedent already exists in this codebase — `group_anchors` references `team_events` without a hard FK (migrations 035/036).

### 6.3 RSVP (intent) vs roll-call (actuals) — kept separate, by design
`event_rsvp` and `practice_attendance` are **two tables**, never merged. This is the original attendance-cleanup lesson: intent and actuals must not share a column (a coach taking roll must not clobber a swimmer's RSVP, and vice-versa). For a practice the two compose into one view: **"9 expected · 7 attended."** RSVP may *seed* the roll-call default, but they're stored independently.

### 6.4 Decisions to lock
| # | Decision | Note |
|---|----------|------|
| 1 | **RSVP spans meets + practices from v1** | One polymorphic `event_rsvp` table (§6.2). Practices are not deferred — the unified model is the point. |
| 2 | **Default status `no_response`, not `going`** | Expected attendance must reflect real intent, not assumed-yes. Tally distinguishes going / maybe / out / no-response. |
| 3 | **Who can RSVP for whom** | Self (full-account swimmer), coach-on-behalf (managed swimmers), parent-on-behalf if parent portal is in play (`responded_by_sub` records which). |
| 4 | **RSVP ≠ roll-call (separate tables)** | §6.3. Compose in the view ("expected / attended"); never overwrite one with the other. |
| 5 | **RSVP can seed roll-call default** | On the practice attendance sheet, pre-check swimmers who RSVP'd "going" — coach confirms. Convenience only; the written roll-call is authoritative for actuals. |
| 6 | **Notifications out of v1** | RSVP reminders / "you haven't responded" pushes are a follow-on (needs push infra — §7.1). v1 is set-and-view only. |
| 7 | **Optional RSVP deadline** | `team_events.rsvp_closes_at DATETIME NULL` — after it passes, swimmers can't change their RSVP (coach still can, for late changes). NULL = open until event start. Cheap to add; every real RSVP system has it. |
| 8 | **Cancelled event → RSVP frozen** | When `status='cancelled'`, RSVP is read-only and the event shows CANCELLED; existing RSVPs are retained (history/headcount of who *would* have come), not deleted. |

### 6.5 Surfaces
- **Swimmer:** an RSVP control (going / maybe / out) on each meet *and* practice in the schedule view, and on the iOS home/Assigned surfaces where practices already appear.
- **Coach:** an expected-headcount tally + per-swimmer RSVP list on meets and practices, alongside venue + weather, reusing the roster rendering from the existing Practices/attendance sheet. On a practice, the attendance sheet shows RSVP alongside the roll-call checkboxes.

---

## 7. Prerequisites & shared dependencies (acquire before / alongside build)

### 7.1 Notification infrastructure
> **✅ UPDATE 2026-06-06:** Web Push infra shipped (mig 056, `lib/push.js`, `sw.js`,
> opt-in UI; `PUSH_ACTIVE` true in prod). **Notify triggers — first cut shipped:**
> event-cancellation push + weather-advisory cron (`lib/notify.js`, mig 059
> `notifications_sent` dedup). **Still deferred:** RSVP "you haven't responded"
> reminders (needs roster-diff). The original "blocker" note below is historical.

**(historical) Notification infrastructure — DID NOT EXIST AT SPEC TIME (shared blocker)**
There is **no push/notification system** in the app today (grep confirms: no APNs, no web push, no FCM — the only "notifications" are Apple's *inbound* App Store Server Notifications for IAP). Multiple high-value behaviors in this scope all depend on it and are therefore **all deferred to a v1.1 that builds push first**:
- Weather advisory alerts (§4.3 — "notify the RSVP'd swimmers when lightning fires").
- RSVP reminders / "you haven't responded" nudges (§6.4 #6).
- Cancellation alerts (§3.3.2 — push "meet CANCELLED" to RSVP'd swimmers).

v1 of *this* feature is **pull, not push**: everything is visible when the user opens the app (pills, event status, weather, RSVP). The proactive/notify layer is a separate prerequisite project. Calling this out once so it isn't rediscovered three times.

### 7.2 Geocoding (address → lat/lng)
Required for weather (needs venue lat/lng). No geocoder wired today. **Recommended: Apple — `CLGeocoder` (iOS) / MapKit JS (web), or Apple's server-side geocoding** — you're already in Apple's ecosystem for WeatherKit + auth, so no new vendor relationship. Caveat: the web path can't use `CLGeocoder` (iOS-only), so the **server** needs either MapKit JS server token or a server geocoder; pick one. Geocode lazily (on venue create/link, §3.2), cache the result on the venue row forever (addresses rarely move).

### 7.3 Apple keys/capabilities (long-lead, like IAP)
- **WeatherKit:** separate key (.p8) + the WeatherKit capability/entitlement on the App ID (§4.2 #5).
- **MapKit (if used for geocoding/maps):** MapKit JS key for the web path.
Both provision the same way as the IAP key in `IAP_PLAN.md` — treat as a procurement step, not a coding step.

### 7.4 Existing systems this composes with
- **Reporting:** the Reports system already tracks attendance %. RSVP "going" vs roll-call "attended" is a natural new reliability metric (which swimmers flake) — feeds existing reporting, not a new surface.
- **Group-anchor / taper:** must stay `kind='meet'`-only (§3.3.1, decision §8 #10).
- **Practices `dbRepeatWeek`:** the recurrence story for practices already exists; events lean on it rather than reinventing (§3.3.2 recurrence).

---

## 8. Explicitly OUT of scope (v1)
- Full season/meet-management (heat sheets, entries, results, psych sheets) — that's a different product.
- **Any push/notify behavior** (weather alerts, RSVP reminders, cancellation pushes) — gated on §7.1; v1 is pull-only.
- **Event recurrence** (RRULE expansion) — field reserved, behavior deferred (§3.3.2); recurring *practices* use existing `dbRepeatWeek`.
- Travel/lodging, multi-day meet sessions with per-session weather (v1: single start/end window per event).
- Historical weather backfill for completed events (forecast-only first).
- Crowd-sourced venue editing without moderation.
- Automatic meet import from USA Swimming / MeetMobile feeds.
- Cross-team venue conflict detection ("the pool's already booked") — the universal venue model *enables* it, but it's a later feature.
- RSVP capacity caps / waitlists (a team headcount isn't capacity-limited like a clinic would be).

---

## 9. Open decisions to lock before build
1. Venue id type: BIGINT vs string `vn_xxx` (match the `gr_`/`ev_` convention?).
2. Meet model: extend `team_events` (Option A, recommended) vs unified `events` (Option B).
3. Venue edit policy: admin-moderated vs copy-on-write candidate.
4. WeatherKit key provisioning (separate Apple key + capability) — prerequisite, like the IAP key.
5. Weather cache store: dedicated table vs reuse an existing kv/cache mechanism.
6. Dedup strictness for venue create (name+postal vs geo-proximity).
7. RSVP target id encoding: confirm `team_events.id` (ev_xxx) and `scheduled_workouts.id` (int) coexist cleanly as a VARCHAR `target_id` keyed by `target_kind` (§6.2).
8. RSVP-on-behalf: include parent-portal RSVP in v1, or self + coach only (§6.4 #3).
9. RSVP→roll-call seeding: pre-check "going" RSVPs on the practice attendance sheet, or keep them fully independent (§6.4 #5).
10. Anchor eligibility: the group-anchor / taper picker MUST filter to `kind='meet'` so non-meet events (meal, meeting) can't become taper anchors (§3.3.1). Confirm + update the existing anchor query.
11. `team_events.kind` enum membership — lock the v1 list (§3.3.1); adding kinds later is a cheap enum extend.
12. **Time storage + display tz** — confirm UTC `start_at`/`end_at` + `venue_tz` snapshot, always displayed in venue-local with tz label, never viewer-device tz (§3.3.2).
13. **Recurrence** — v1 one-off events (recommended) vs RRULE now (§3.3.2). If deferred, confirm the `recurrence` column is still reserved.
14. **Geocoder choice** — Apple MapKit (server token for web + CLGeocoder iOS) vs a server-side geocoder; affects the web path (§7.2).
15. **Weather over a range** — for outdoor meets with `end_at`, fetch hourly across the window + surface worst-case, or just start-conditions in v1 (§3.3.2).
16. **RSVP deadline** — include `rsvp_closes_at` in v1 or defer (§6.4 #7).

---

## 10. Why this is band L (cost honesty)
- New shared table + a backward-compatible migration of an existing team-scoped table (`team_facilities` → `venue_id`).
- Generalizing `team_events` (kind enum + venue + time + group_id) and the pill renderer from "meet anchors only" to all event kinds — modest, but touches the existing group-anchor query (must stay meet-only for taper).
- Geocoding pipeline (address → lat/lng) is a new dependency.
- A second Apple service (WeatherKit) with its own key, entitlement, caching, and a web-vs-iOS split path — comparable in setup cost to the IAP integration.
- Moderation surface for universal venues.
- **RSVP is a net-new swimmer-facing feature spanning meets AND practices** (no prior intent-capture; only after-the-fact roll-call exists) — its own polymorphic table, write paths, and UI on both platforms, composing with the existing roll-call for practices.

The 80% value (schedule a meet at a real place + see outdoor weather + expected headcount for meets and practices) is achievable; the cost is the *shared venue identity*, *new external API*, and *first forward-looking attendance surface* — not the UI.
