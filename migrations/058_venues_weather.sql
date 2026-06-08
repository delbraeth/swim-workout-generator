-- 058_venues_weather.sql — Phase 5 #5 Slice B (calendar/venue/weather), the
-- universal-pool + WeatherKit half. Per MEET_SCHEDULE_WEATHER_SCOPE.md §2–4.
--
-- The crux (scope §2): pool identity is UNIVERSAL, not team-scoped. One team's
-- home pool is another's away-meet venue. So a shared `venues` catalog carries
-- the geocode + indoor/outdoor + tz ONCE; team_facilities and team_events both
-- reference it. Weather is keyed off (venue lat/lng, event datetime in venue tz).
--
-- Decisions locked at build (scope §9):
--   #1 venue id = string vn_xxx (mirrors gr_/ev_).            (here)
--   #2 event model = Option A: extend team_events.             (here: venue_id + start_time)
--   #4 venue edits: v1 venues usable on create (moderation_status default
--      'approved'); the 'candidate' state + an admin moderation surface are
--      reserved for a later edit-moderation pass (gating visibility now would
--      break weather). Column reserved, not yet enforced.
--   #5 weather cache = dedicated table keyed (venue_id, day), TTL in app code.
--   #14 geocoder = MapKit JS client-side (browser-scoped token); the client
--       geocodes on venue create and POSTs lat/lng + tz — the server never
--       geocodes (the MapKit token can't be used server-side).
--
-- All tables/columns declare utf8mb4_unicode_ci explicitly to avoid the
-- utf8mb3-default collation trap that has bitten cross-table joins to
-- users.sub before (see db-infra notes).

-- 1. Universal venue/location catalog (one row per physical place).
CREATE TABLE IF NOT EXISTS `venues` (
  `id`                   VARCHAR(16)  NOT NULL,
  `name`                 VARCHAR(200) NOT NULL,
  `address_id`           BIGINT       NULL,
  `latitude`             DECIMAL(9,6) NULL,
  `longitude`            DECIMAL(9,6) NULL,
  `indoor_outdoor`       ENUM('indoor','outdoor','unknown') NOT NULL DEFAULT 'unknown',
  `course`               ENUM('SCY','SCM','LCM') NULL,
  `timezone`             VARCHAR(64)  NULL,
  `created_by_coach_sub` VARCHAR(255) NULL,
  `moderation_status`    ENUM('candidate','approved') NOT NULL DEFAULT 'approved',
  `created_at`           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `archived_at`          TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_geo`  (`latitude`, `longitude`),
  INDEX `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. team_facilities: a team's relationship TO a venue (their home pool).
--    Additive + nullable: existing facilities keep working (NULL venue → no
--    weather, no shared identity). Lazily linked when a coach next edits.
ALTER TABLE `team_facilities`
  ADD COLUMN `venue_id` VARCHAR(16) NULL AFTER `address_id`;

-- 3. team_events: a meet/event happens AT a venue, optionally at a time.
--    start_time is the venue-local clock time (date already on the row); the
--    instant for weather is resolved as (date + start_time) in the venue tz.
ALTER TABLE `team_events`
  ADD COLUMN `venue_id`   VARCHAR(16) NULL AFTER `date`,
  ADD COLUMN `start_time` TIME        NULL AFTER `venue_id`;

-- 4. Forecast cache — one row per (venue, day). WeatherKit bills per call, so a
--    meet with 50 swimmers viewing it must collapse to one fetch/day. App code
--    enforces a short TTL via fetched_at (refresh more often as the event nears).
CREATE TABLE IF NOT EXISTS `weather_cache` (
  `venue_id`   VARCHAR(16) NOT NULL,
  `day`        DATE        NOT NULL,
  `payload`    JSON        NOT NULL,
  `fetched_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`venue_id`, `day`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
