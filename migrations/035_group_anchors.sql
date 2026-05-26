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
-- the row stays for audit.
--
-- FK constraints DELIBERATELY OMITTED. The existing groups + team_events
-- schema in this repo doesn't use FKs into them from other tables (see
-- migrations 026-034), so we follow the convention and rely on app-layer
-- integrity:
--   * group archive → anchor stays in DB; dbGetActiveAnchor checks
--     groups.archived in callers, OR the anchor just keeps pointing
--     at the archived group with no behavioral effect.
--   * event delete → dbGetActiveAnchor does a LEFT JOIN on team_events;
--     a deleted event yields a NULL event_date row which the helper
--     treats as "no active anchor" (return null). The dbExpireOrphan-
--     Anchors cron sweeps these to active=0 within ~30 min.
--
-- Initial attempt with FOREIGN KEY constraints on groups(id) +
-- team_events(id) failed with errno 150 (column-type mismatch — the
-- existing PK types weren't BIGINT). Dropping the FK is the right
-- pattern for this codebase.
--
-- IDEMPOTENT: CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS `group_anchors` (
  `id`                BIGINT AUTO_INCREMENT PRIMARY KEY,
  `group_id`          BIGINT NOT NULL,
  `event_id`          BIGINT NULL,
  `set_by_coach_sub`  VARCHAR(255) NOT NULL,
  `active`            TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `cleared_at`        DATETIME NULL,
  UNIQUE KEY `uq_one_active_per_group` (`group_id`, `active`),  -- only one active row per group at a time
  INDEX `idx_event` (`event_id`),
  INDEX `idx_group` (`group_id`)
) ENGINE=InnoDB;
