-- Migration 041 — team_favorites + team_disfavorites tables + teams.default_* cols
-- (Phase 4 / Team Curation v1, per TEAM_CURATION_SCOPE.md)
--
-- Adds the third tier of the curation cascade: TEAM. Existing tiers are
-- own (per-user) + coach-propagated (own-coach → group swimmers). Team is
-- the new bottom tier: owners + admins set defaults; everyone in any group
-- under that team inherits via cascade extension in dbGetEffective*.
--
-- Per locked decisions in TEAM_CURATION_SCOPE.md §2:
--   - Two separate tables (not one with tier enum) — mirrors user_favorites
--     vs user_disfavorites pattern. Easier picker logic reuse.
--   - UNIQUE (team_id, label) on each table. Mutex across the two tables
--     is enforced at the app layer (dbAddTeamFavorite checks
--     team_disfavorites first, returns conflict; same in reverse).
--   - team_id is VARCHAR(32) to match teams.id pattern (tm_xxxxxx).
--   - No FOREIGN KEY into teams per [[feedback-no-fk-into-legacy-tables]]
--     convention from migrations-026+ — index + app-layer integrity via
--     LEFT JOIN reads + ON DELETE cleanup at the route layer.
--   - teams.default_* columns: pace baseline, disfavor mode, equipment
--     modes. Seed new-user settings rows from these on first dbEnsureUser.
--     Existing users untouched until owner clicks "Apply to all swimmers."
--
-- IDEMPOTENT: CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS `team_favorites` (
  `id`               BIGINT AUTO_INCREMENT PRIMARY KEY,
  `team_id`          VARCHAR(32)  NOT NULL,
  `label`            VARCHAR(255) NOT NULL,
  `set_by_coach_sub` VARCHAR(255) NOT NULL,
  `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_team_fav_label` (`team_id`, `label`),
  INDEX `idx_team` (`team_id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `team_disfavorites` (
  `id`               BIGINT AUTO_INCREMENT PRIMARY KEY,
  `team_id`          VARCHAR(32)  NOT NULL,
  `label`            VARCHAR(255) NOT NULL,
  `set_by_coach_sub` VARCHAR(255) NOT NULL,
  `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_team_disfav_label` (`team_id`, `label`),
  INDEX `idx_team` (`team_id`)
) ENGINE=InnoDB;

-- Team-level default settings — seed new users from these.
-- pace_base: VARCHAR(8) matches existing user pace fields (e.g. "2:00").
-- disfavor_mode: matches existing per-user settings.extra.disfavor_mode enum.
-- equipment_modes: JSON blob, structure matches user settings.equipment.
ALTER TABLE `teams`
  ADD COLUMN IF NOT EXISTS `default_pace_base`        VARCHAR(8)  NULL AFTER `name`,
  ADD COLUMN IF NOT EXISTS `default_disfavor_mode`    ENUM('downweight','exclude') NULL AFTER `default_pace_base`,
  ADD COLUMN IF NOT EXISTS `default_equipment_modes`  JSON        NULL AFTER `default_disfavor_mode`;

-- v1.1 candidates (NOT in this migration):
--   team_favorite_sets / team_disfavor_sets (set-id level, mirror of v1.5)
--   team_engine_disfavorites (per-template, per-stroke)
--   team_engine_favorites
--   per-group curation tier (between coach + team)
