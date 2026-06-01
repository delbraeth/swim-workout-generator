# Meet/Practice Schedules + Outdoor-Pool Weather — scope (spec only)

**Status:** spec-only (2026-06-01). No implementation. Deferred future enhancement; sizing band L (touches a shared venue model + a new external API integration). This doc defines the data model, the "universal pool" decision, the outdoor tag, and the WeatherKit call so implementation is mechanical when prioritized.

**Pattern source:** bridges three existing systems — `team_facilities` (team-scoped pools + `addresses`), `team_events` (name + date meet calendar), and `scheduled_workouts` (practices, already FK `facility_id`). Adds a shared venue layer + a weather enrichment on top.

---

## 1. Why

Two distinct asks:

1. **Schedule meets by team/group** with a real location and time — today `team_events` is just `{name, date}` with no facility link and no time-of-day, and `scheduled_workouts` (practices) link a `facility_id` but no weather context.
2. **Outdoor events get weather.** When the venue is an outdoor pool, surface the forecast/conditions *at the time of the event* (meet warm-up call, or practice start) via Apple **WeatherKit**. Indoor venues never call weather.

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
-- migration: best-effort backfill venue_id by matching address → venue; NULL is fine
```

### 3.3 Meet scheduling
Two viable shapes — **decision needed at build time:**

- **Option A (extend `team_events`):** add `venue_id`, `start_time` (TIME/DATETIME), `kind ENUM('meet','practice','other')` to the existing meet calendar. Lowest churn; `team_events` already drives group-anchors. Practices stay in `scheduled_workouts`.
- **Option B (unified `events` table):** one schedule table for meets *and* practices with `venue_id` + `start_at` (DATETIME) + `team_id`/`group_id` + `kind`. Cleaner long-term (single weather path) but migrates two existing systems.

**Recommendation: Option A for v1** (extend `team_events` + keep `scheduled_workouts` for practices), because both already exist and group-anchors depend on `team_events`. The weather enrichment (below) keys off `venue_id` + a resolved start datetime, so it works for both event types regardless.

### 3.4 Group-level meets
`team_events` is team-scoped. To schedule by **group** (per the ask), either:
- add nullable `group_id` to `team_events` (a meet for one squad), OR
- keep team-scoped and let groups inherit (simpler).
v1: **nullable `group_id`** so a meet can target a squad; NULL = whole team.

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

---

## 6. Explicitly OUT of scope (v1)
- Full season/meet-management (heat sheets, entries, results, psych sheets) — that's a different product.
- Travel/lodging, multi-day meet sessions with per-session weather (v1: one start datetime per event).
- Historical weather backfill for completed events (forecast-only first).
- Crowd-sourced venue editing without moderation.
- Automatic meet import from USA Swimming / MeetMobile feeds.

---

## 7. Open decisions to lock before build
1. Venue id type: BIGINT vs string `vn_xxx` (match the `gr_`/`ev_` convention?).
2. Meet model: extend `team_events` (Option A, recommended) vs unified `events` (Option B).
3. Venue edit policy: admin-moderated vs copy-on-write candidate.
4. WeatherKit key provisioning (separate Apple key + capability) — prerequisite, like the IAP key.
5. Weather cache store: dedicated table vs reuse an existing kv/cache mechanism.
6. Dedup strictness for venue create (name+postal vs geo-proximity).

---

## 8. Why this is band L (cost honesty)
- New shared table + a backward-compatible migration of an existing team-scoped table (`team_facilities` → `venue_id`).
- Geocoding pipeline (address → lat/lng) is a new dependency.
- A second Apple service (WeatherKit) with its own key, entitlement, caching, and a web-vs-iOS split path — comparable in setup cost to the IAP integration.
- Moderation surface for universal venues.

The 80% value (schedule a meet at a real place + see outdoor weather) is achievable; the cost is the *shared identity* + *new external API*, not the UI.
