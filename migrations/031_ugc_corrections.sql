-- Migration 031 — UGC schema corrections (Phase A of corrected UGC build)
--
-- Spec: UGC_COACH_SETS_SCOPE.md §2 (corrected JS-canonical / DB-UGC-only
-- architecture, locked 2026-05-25).
--
-- Background: migration 030 built the UGC tables under the wrong "hybrid
-- DB-canonical" architecture. The course-correction on 2026-05-25 swapped
-- the model: JS is canonical forever, DB holds UGC rows only, UGC graduates
-- into JS via a per-option admin tool and the DB row gets a promoted_at
-- timestamp (soft delete from the overlay). This migration brings the
-- schema in line.
--
-- IDEMPOTENT: written so it can be applied regardless of whether the
-- 030 FK-hotfix migration re-ran successfully (team_shares + reviews
-- may or may not exist in prod). Uses IF NOT EXISTS / IF EXISTS clauses
-- supported by MariaDB 10.0.2+.

-- ─── 1. bank_options corrections ─────────────────────────────────────────
-- Make author_sub NOT NULL. There should be zero rows yet (migration 030's
-- tables are empty in prod), so this is safe. New invariant going forward:
-- every row in bank_options is UGC (has an author_sub).
ALTER TABLE `bank_options`
  MODIFY COLUMN `author_sub` VARCHAR(64) NOT NULL;

-- Drop the in_export DRAFT/LIVE flag — meaningless with no canonical-in-DB.
ALTER TABLE `bank_options`
  DROP COLUMN IF EXISTS `in_export`;

-- Drop the canonical-export index — replaced by the overlay index below.
ALTER TABLE `bank_options`
  DROP INDEX IF EXISTS `idx_bank_export`;

-- Soft-delete timestamp for graduated rows. Overlay queries exclude
-- rows where promoted_at IS NOT NULL. Set by the graduation tool
-- (Phase F) after the admin commits the JS edit.
ALTER TABLE `bank_options`
  ADD COLUMN IF NOT EXISTS `promoted_at`     DATETIME    NULL,
  ADD COLUMN IF NOT EXISTS `promoted_by_sub` VARCHAR(64) NULL;

-- Promotion-aware overlay index. Picker/overlay query shape:
--   WHERE author_sub IN (...visible-to-caller...) AND promoted_at IS NULL
CREATE INDEX IF NOT EXISTS `idx_bank_overlay`
  ON `bank_options` (`author_sub`, `visibility`, `promoted_at`);

-- ─── 2. Ensure team_shares + reviews exist ───────────────────────────────
-- Re-run from 030's FK-hotfix definitions in case those didn't apply in
-- prod. Both are no-ops if the tables already exist.

CREATE TABLE IF NOT EXISTS `bank_option_team_shares` (
  `option_id`       VARCHAR(8)   NOT NULL,
  `team_id`         VARCHAR(16)  NOT NULL,
  `shared_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`option_id`, `team_id`),
  INDEX `idx_bots_team` (`team_id`),
  CONSTRAINT `fk_bots_option`
    FOREIGN KEY (`option_id`) REFERENCES `bank_options`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `bank_option_reviews` (
  `id`              BIGINT       AUTO_INCREMENT PRIMARY KEY,
  `option_id`       VARCHAR(8)   NOT NULL,
  `reviewer_sub`    VARCHAR(64)  NOT NULL,
  `decision`        VARCHAR(16)  NOT NULL,
  `reason`          TEXT         NULL,
  `reviewed_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_bor_option` (`option_id`),
  CONSTRAINT `fk_bor_option`
    FOREIGN KEY (`option_id`) REFERENCES `bank_options`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
