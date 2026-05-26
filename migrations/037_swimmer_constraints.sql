-- Migration 037 — swimmer_constraints (Phase 3 · Per-Swimmer Constraint Vector)
--
-- Per PER_SWIMMER_CONSTRAINTS_SCOPE.md §3.1. New TOP tier of the
-- fav/disfavor cascade: hard-exclude, not soft weight. Closed-vocab
-- enum of 14 constraint types across 4 categories (stroke / equipment
-- / section / caps). Persistent + time-bound + per-practice expiry
-- (per-practice never persists; only the first two land here).
--
-- Schema notes — types verified against existing tables (per the
-- "check gen<Foo>Id" rule in feedback memo):
--   * swimmer_sub  → VARCHAR(255) matches users.sub (sub.* tables)
--   * managed_id   → VARCHAR(32) matches managed_swimmers.id (ms_xxxxxx)
-- No FK constraints into the legacy users / managed_swimmers tables
-- (errno 150 risk per feedback memo); app-layer integrity instead:
-- LEFT JOIN reads + cron sweep for orphans.
--
-- swimmer_sub XOR managed_id enforced at app layer (see dbAddSwimmerConstraint).
-- Both columns indexed; one will be NULL per row by convention.
--
-- IDEMPOTENT: CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS `swimmer_constraints` (
  `id`               BIGINT AUTO_INCREMENT PRIMARY KEY,
  `swimmer_sub`      VARCHAR(255) NULL,                           -- target real-user swimmer
  `managed_id`       VARCHAR(32)  NULL,                           -- target managed swimmer (ms_xxxxxx)
  `set_by_coach_sub` VARCHAR(255) NOT NULL,                       -- audit: who created it
  `constraint_type`  ENUM(
                       'stroke_no_fly',
                       'stroke_no_breast',
                       'stroke_no_back',
                       'stroke_no_free',
                       'equip_no_paddles',
                       'equip_no_fins',
                       'equip_no_snorkel',
                       'equip_no_kickboard',
                       'equip_no_buoy',
                       'section_no_main',
                       'section_no_kick',
                       'section_no_drill',
                       'cap_yardage',
                       'cap_intensity'
                     ) NOT NULL,
  `value_num`        INT          NULL,                           -- cap_yardage uses this
  `value_str`        VARCHAR(32)  NULL,                           -- cap_intensity ('easy_only') uses this
  `expires_at`       DATETIME     NULL,                           -- NULL = persistent until removed
  `active`           TINYINT(1)   NOT NULL DEFAULT 1,             -- 0 = expired or removed; row stays for audit
  `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `removed_at`       DATETIME     NULL,
  INDEX `idx_swimmer_active`  (`swimmer_sub`, `active`, `constraint_type`),
  INDEX `idx_managed_active`  (`managed_id`,  `active`, `constraint_type`),
  INDEX `idx_expires_active`  (`expires_at`,  `active`)
) ENGINE=InnoDB;
