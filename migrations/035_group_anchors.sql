-- Migration 035 — group_anchors (Phase 3 · Meet-Anchored Taper, cheap version)
--
-- Per MEET_ANCHORED_TAPER_SCOPE.md §3.1. Bridges existing team_events
-- (name + date calendar) and the Training Phase top-level filter
-- (base/build/peak/taper) by letting a coach designate one event in
-- the calendar as the anchor for a group. The phase-roll formula
-- (≥12 wk = base / 8-12 = build / 4-8 = peak / 0-4 = taper) lives in
-- lib/season.js — pure JS, no DB knowledge required.
--
-- One active anchor per group is enforced at the DB layer via UNIQUE
-- (group_id, active). Old anchors get active=0 + cleared_at stamped;
-- the row stays for audit. Underlying team_events.delete cascades
-- event_id to NULL via FK; an hourly cron sweep
-- (dbExpireOrphanAnchors) flips orphaned rows to active=0.
--
-- IDEMPOTENT: CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS `group_anchors` (
  `id`                BIGINT AUTO_INCREMENT PRIMARY KEY,
  `group_id`          BIGINT NOT NULL,
  `event_id`          BIGINT NULL,                  -- FK to team_events; NULL when underlying event deleted
  `set_by_coach_sub`  VARCHAR(255) NOT NULL,
  `active`            TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `cleared_at`        DATETIME NULL,
  UNIQUE KEY `uq_one_active_per_group` (`group_id`, `active`),  -- only one active row per group at a time
  INDEX `idx_event` (`event_id`),
  CONSTRAINT `fk_group_anchors_group_id`
    FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`)       ON DELETE CASCADE,
  CONSTRAINT `fk_group_anchors_event_id`
    FOREIGN KEY (`event_id`) REFERENCES `team_events`(`id`)  ON DELETE SET NULL
) ENGINE=InnoDB;
