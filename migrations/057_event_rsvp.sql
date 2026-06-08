-- 057_event_rsvp.sql — Phase 5 #5 Slice B (RSVP). Forward-looking attendance
-- intent, distinct from practice_attendance (after-the-fact roll-call). Per
-- MEET_SCHEDULE_WEATHER_SCOPE.md §6.2. Polymorphic target so one table covers
-- both meets (team_events.id, ev_xxx string) and practices (scheduled_workouts.id,
-- int as string), keyed by target_kind. Exactly one of swimmer_sub / managed_id
-- (mirrors practice_attendance). NULLs distinct, so uniqueness is enforced in
-- app code (a SQL UNIQUE over a nullable polymorphic key treats NULLs as
-- distinct) — same pattern as swimmer_event_times.
CREATE TABLE IF NOT EXISTS `event_rsvp` (
  `id`               BIGINT AUTO_INCREMENT PRIMARY KEY,
  `target_kind`      ENUM('meet','practice') NOT NULL,
  `target_id`        VARCHAR(64) NOT NULL,
  `swimmer_sub`      VARCHAR(255) NULL,
  `managed_id`       BIGINT NULL,
  `status`           ENUM('going','maybe','out','no_response') NOT NULL DEFAULT 'no_response',
  `responded_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `responded_by_sub` VARCHAR(255) NULL,
  INDEX `idx_target` (`target_kind`, `target_id`),
  INDEX `idx_swimmer` (`swimmer_sub`),
  INDEX `idx_managed` (`managed_id`)
);

-- Event lifecycle: cancellation is first-class (a cancelled meet must show
-- CANCELLED + freeze RSVP, never silently vanish). rsvp_closes_at is the
-- optional RSVP deadline (NULL = open until the event). Per §3.3.2 / §6.4.
ALTER TABLE `team_events`
  ADD COLUMN `status`         ENUM('scheduled','cancelled','postponed') NOT NULL DEFAULT 'scheduled' AFTER `kind`,
  ADD COLUMN `status_note`    VARCHAR(280) NULL AFTER `status`,
  ADD COLUMN `rsvp_closes_at` DATETIME NULL AFTER `status_note`;
