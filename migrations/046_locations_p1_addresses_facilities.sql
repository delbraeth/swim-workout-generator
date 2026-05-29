-- Migration 046 — Locations P1: addresses + team_facilities.
-- Per LOCATIONS_SCOPE.md. Additive + safe. This phase covers TEAM PRACTICE
-- FACILITIES only (public pool locations — no sensitive minor PII; that's
-- P2 person_addresses). Generalizes the single `teams.school` field into
-- one-or-many named pools per team, each with course + lane info.
--
-- IDEMPOTENT: CREATE TABLE IF NOT EXISTS + a NOT-IN-guarded backfill.

-- ── addresses: shared postal record (reused by facilities now, persons in P2)
-- No owner column — ownership lives in the link tables (team_facilities now,
-- person_addresses in P2). lat/lng reserved for future distance/maps; unused.
CREATE TABLE IF NOT EXISTS `addresses` (
  `id`           BIGINT AUTO_INCREMENT PRIMARY KEY,
  `line1`        VARCHAR(160) NULL,
  `line2`        VARCHAR(160) NULL,
  `city`         VARCHAR(80)  NULL,
  `region`       VARCHAR(80)  NULL,            -- state / province
  `postal_code`  VARCHAR(20)  NULL,
  `country`      VARCHAR(2)   NULL DEFAULT 'US',
  `lat`          DECIMAL(9,6) NULL,
  `lng`          DECIMAL(9,6) NULL,
  `created_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── team_facilities: a team's practice pool(s). team_id is VARCHAR(32) to
-- match teams.id (tm_xxxxxx); NO FK into the legacy teams table (errno-150
-- rule — use column + index + app-layer integrity). address_id FKs the new
-- addresses table (both new → safe). course mirrors pool_mode values.
CREATE TABLE IF NOT EXISTS `team_facilities` (
  `id`           BIGINT AUTO_INCREMENT PRIMARY KEY,
  `team_id`      VARCHAR(32)  NOT NULL,
  `name`         VARCHAR(120) NOT NULL,
  `address_id`   BIGINT       NULL,
  `course`       ENUM('25y','25m','50m') NULL,
  `lanes`        TINYINT      NULL,
  `is_primary`   TINYINT(1)   NOT NULL DEFAULT 0,
  `archived_at`  TIMESTAMP    NULL,
  `created_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_team_facilities_team` (`team_id`, `archived_at`),
  FOREIGN KEY (`address_id`) REFERENCES `addresses`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Backfill: one primary facility per team that already set teams.school.
-- Guarded by NOT IN so re-running is a no-op. teams.school stays in place as
-- a mirror of the primary facility's name until P5 drops it.
INSERT INTO `team_facilities` (`team_id`, `name`, `is_primary`)
SELECT t.`id`, t.`school`, 1
  FROM `teams` t
 WHERE t.`school` IS NOT NULL AND t.`school` <> ''
   AND t.`id` NOT IN (SELECT `team_id` FROM `team_facilities`);
