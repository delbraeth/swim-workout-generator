-- 053_swimmer_event_times.sql — Phase 5 #4 (HS race-pace, Slice B).
-- Per-swimmer race event goal/PR times that anchor race-pace set targets.
-- Polymorphic owner (exactly one of user_sub / managed_id), like benchmarks/
-- group_members. event = race-event id (e.g. 'free_200'); course is SCY by default
-- (HS); kind = goal | pr; time_secs to the hundredth. One row per
-- owner+event+course+kind is enforced in app code (dbUpsertEventTime) since a SQL
-- UNIQUE over a nullable polymorphic key treats NULLs as distinct.
CREATE TABLE IF NOT EXISTS `swimmer_event_times` (
  `id`         BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_sub`   VARCHAR(255) NULL,
  `managed_id` BIGINT NULL,
  `event`      VARCHAR(32) NOT NULL,
  `course`     ENUM('25y','25m','50m') NOT NULL DEFAULT '25y',
  `kind`       ENUM('goal','pr') NOT NULL,
  `time_secs`  DECIMAL(7,2) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_set_user`    (`user_sub`, `event`, `course`),
  INDEX `idx_set_managed` (`managed_id`, `event`, `course`)
);
