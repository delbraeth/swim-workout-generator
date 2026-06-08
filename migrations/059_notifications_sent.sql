-- 059_notifications_sent.sql — notify-trigger dedup log (Phase 5 #5 notify half).
-- The push *infrastructure* (mig 056, lib/push.js, sw.js, opt-in UI) is already
-- live; this is the "notify triggers" layer wiring real events to pushes. Cron
-- sweeps (weather advisory, RSVP reminders) poll repeatedly, so they MUST record
-- what they've already sent to avoid re-pushing every tick. One row per
-- (kind, target, user); the UNIQUE key makes "send once" an INSERT IGNORE.
--
--   kind        e.g. 'weather_advisory' | 'rsvp_reminder' (event-driven sends
--               like cancellation fire on an explicit action and don't need this)
--   target_id   the thing the notice is about (ev_xxx event id, etc.)
--   user_sub    recipient
-- utf8mb4_unicode_ci declared explicitly (the utf8mb3-default join trap).
CREATE TABLE IF NOT EXISTS `notifications_sent` (
  `id`        BIGINT AUTO_INCREMENT PRIMARY KEY,
  `kind`      VARCHAR(40)  NOT NULL,
  `target_id` VARCHAR(64)  NOT NULL,
  `user_sub`  VARCHAR(255) NOT NULL,
  `sent_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_once` (`kind`, `target_id`, `user_sub`),
  INDEX `idx_target` (`kind`, `target_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
