-- 054_swimmer_event_pr_history.sql — eval 2026-06-06 #7 (PR unification).
-- A dated, append-only history of per-event times so the swimmer (or a coach's
-- managed swimmer) can see a per-event progression ("am I getting faster?") in
-- 📈 Progress. Distinct from `swimmer_event_times` (053), which holds the single
-- CURRENT goal/PR per event+course that drives race-pace targets. Points are
-- captured two ways: auto (source='auto') whenever a PR is set/updated, and
-- manual (source='logged') via the "log a result" form (can backfill a date).
-- Polymorphic owner: exactly one of user_sub / managed_id (NULLs distinct, so
-- uniqueness is enforced in app code, mirroring 053).
CREATE TABLE IF NOT EXISTS `swimmer_event_pr_history` (
  `id`          BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_sub`    VARCHAR(255) NULL,
  `managed_id`  BIGINT NULL,
  `event`       VARCHAR(32) NOT NULL,
  `course`      ENUM('25y','25m','50m') NOT NULL DEFAULT '25y',
  `time_secs`   DECIMAL(7,2) NOT NULL,
  `achieved_on` DATE NOT NULL,
  `note`        VARCHAR(255) NULL,
  `source`      ENUM('logged','auto') NOT NULL DEFAULT 'logged',
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_prh_user`    (`user_sub`, `event`, `course`, `achieved_on`),
  INDEX `idx_prh_managed` (`managed_id`, `event`, `course`, `achieved_on`)
);
