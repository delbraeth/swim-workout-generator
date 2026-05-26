-- Migration 036 — group_anchors recreated with VARCHAR ids
--
-- Migration 035 declared `group_id` and `event_id` as BIGINT, which
-- was wrong: the existing `groups` and `team_events` tables use
-- prefixed string ids (gr_xxxxxx, ev_xxxxxx — see genGroupId /
-- genEventId in db.js). 035 actually created the table fine on the
-- second attempt (after dropping the FKs) but every write attempt
-- hit "event_id required" because client + server were Number()-ing
-- the strings, getting NaN, and rejecting at validation. Server
-- diagnostic confirmed the actual value was a "gr_xxxxx" string.
--
-- This migration drops the wrong-typed table and recreates it with
-- VARCHAR(32) ids. The table was empty in prod (no successful
-- anchor.set ever completed) so the DROP is safe.
--
-- IDEMPOTENT: DROP IF EXISTS + CREATE TABLE IF NOT EXISTS.

DROP TABLE IF EXISTS `group_anchors`;

CREATE TABLE `group_anchors` (
  `id`                BIGINT AUTO_INCREMENT PRIMARY KEY,
  `group_id`          VARCHAR(32) NOT NULL,
  `event_id`          VARCHAR(32) NULL,
  `set_by_coach_sub`  VARCHAR(255) NOT NULL,
  `active`            TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `cleared_at`        DATETIME NULL,
  UNIQUE KEY `uq_one_active_per_group` (`group_id`, `active`),
  INDEX `idx_event` (`event_id`),
  INDEX `idx_group` (`group_id`)
) ENGINE=InnoDB;
