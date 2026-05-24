-- Migration 030 — UGC bank extension (Phase A of UGC coach-authored sets)
--
-- Spec: UGC_COACH_SETS_SCOPE.md §2 (hybrid DB+JS-export architecture).
--
-- Scope locked 2026-05-23/24:
--   * Canonical bank moves from JS constants → DB rows. JS file
--     public/bank-generated.js becomes a generated artifact regenerated
--     by tools/sync_bank.mjs --export (Phase B).
--   * UGC adds the ability for coaches to author their own sets via DB
--     rows with author_sub IS NOT NULL. Visibility tiers gate distribution.
--   * `in_export` BOOLEAN on bank_options: DRAFT (false, default) vs LIVE
--     (true, included in next bank-generated.js export). Phase A's
--     sync_bank.mjs --import sets in_export=TRUE for the ~600 backfilled
--     canonical rows since they're already live in JS today.
--   * FKs ARE used here (deviation from codebase pattern of app-level
--     integrity) because bank_sets/team_shares/reviews have STRUCTURAL
--     parent-child relationships with bank_options where cascade-on-
--     delete is essential, not just convenient.
--   * `equipment_req` JSON column dropped from spec — option-level
--     equipment is JOIN-aggregated from set-level `eq` at picker time
--     (~600 options, no perf concern).
--
-- VARCHAR(64) for author_sub matches users.sub canonical width.
-- VARCHAR(8) for id columns matches the s_xxxxxx / o_xxxxxx convention.
-- This migration creates EMPTY tables. The one-time data backfill is a
-- separate step run via `node tools/sync_bank.mjs --import` after deploy.
--
-- Dependency: bank_option_team_shares has a FK to `teams(id)` which was
-- created in migration 011 (pre-consolidation; not in this folder but
-- live in prod). Fresh-DB bootstrap would need to recover the older
-- migrations first. Not a concern for production deploys.

-- 1. bank_options — one row per "option" (warm-up / drill / main / cooldown variant).
-- author_sub IS NULL → hardcoded canonical (imported from JS constants).
-- author_sub IS NOT NULL → UGC authored by that coach.
CREATE TABLE IF NOT EXISTS `bank_options` (
  `id`              VARCHAR(8)   PRIMARY KEY,                    -- "o_xxxxxx"
  `section`         VARCHAR(16)  NOT NULL,                       -- "warmup" | "drill" | "main" | "cooldown"
  `type_id`         VARCHAR(16)  NULL,                           -- "im" | "distance" | "sprint" | "endurance" | "mixed" | NULL for warmup/cooldown
  `stroke_id`       VARCHAR(16)  NULL,                           -- "back" | "breast" | "fly" | "free" | NULL
  `pool_mode`       VARCHAR(8)   NOT NULL DEFAULT '25y',         -- "25y" | "25m" | "50m"
  `label`           VARCHAR(120) NOT NULL,
  `total_yards`     INT          NOT NULL,
  `type_affinity`   JSON         NULL,                           -- ["sprint","distance"] etc. — only on warmup options today
  `author_sub`      VARCHAR(64)  NULL,                           -- NULL = canonical; non-null = UGC
  `visibility`      VARCHAR(16)  NOT NULL DEFAULT 'canonical',   -- "canonical" | "private" | "team" | "public" | "pending" | "rejected"
  `in_export`       BOOLEAN      NOT NULL DEFAULT FALSE,         -- canonical only: TRUE = goes into next bank-generated.js. UGC rows ignore.
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `version`        INT          NOT NULL DEFAULT 1,              -- bumped on edit (UGC versioning per spec §6)
  -- Lookup keys: picker queries by (section, pool_mode); admin filters by author/visibility;
  -- export job filters by (visibility='canonical' AND in_export=TRUE).
  INDEX `idx_bank_section_pool` (`section`, `pool_mode`),
  INDEX `idx_bank_author` (`author_sub`, `visibility`),
  INDEX `idx_bank_visibility_pending` (`visibility`),
  INDEX `idx_bank_export` (`visibility`, `in_export`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. bank_sets — one row per set within an option (replaces the JS `sets: [...]` array).
-- Cascading FK so deleting an option deletes all its sets atomically.
CREATE TABLE IF NOT EXISTS `bank_sets` (
  `id`              VARCHAR(8)   PRIMARY KEY,                    -- "s_xxxxxx" — reused from existing JS s_xxxxxx values for canonical
  `option_id`       VARCHAR(8)   NOT NULL,
  `seq`             INT          NOT NULL,                       -- order within option (0-indexed)
  `reps`            INT          NOT NULL,
  `dist`            INT          NOT NULL,
  `desc`            TEXT         NOT NULL,
  `interval`        VARCHAR(60)  NOT NULL,
  `focus`           VARCHAR(240) NULL,
  `stroke`          VARCHAR(16)  NULL,                           -- optional set-level stroke override
  `eq`              VARCHAR(16)  NULL,                           -- "pull" | "kick" | "snorkel" | "underkick" | NULL
  INDEX `idx_bank_sets_option` (`option_id`, `seq`),
  CONSTRAINT `fk_bank_sets_option`
    FOREIGN KEY (`option_id`) REFERENCES `bank_options`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. bank_option_team_shares — many-to-many for "team" visibility tier.
-- A UGC option shared to multiple teams gets one row per team.
-- NOTE: team_id has NO FK to teams(id) — matches codebase pattern
-- (favorites, impersonation, attendance all rely on app-level integrity
-- for cross-table sub references). Earlier attempt to add the FK hit
-- errno 150 ("FK incorrectly formed") because teams.id charset/collation
-- couldn't be matched without reading SHOW CREATE TABLE. App layer
-- (server.js handlers) enforces team_id validity at insert time.
-- The bank_sets → bank_options FK is KEPT because both tables live in
-- this migration and the cascade is structurally essential.
CREATE TABLE IF NOT EXISTS `bank_option_team_shares` (
  `option_id`       VARCHAR(8)   NOT NULL,
  `team_id`         VARCHAR(16)  NOT NULL,
  `shared_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`option_id`, `team_id`),
  INDEX `idx_bots_team` (`team_id`),
  CONSTRAINT `fk_bots_option`
    FOREIGN KEY (`option_id`) REFERENCES `bank_options`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. bank_option_reviews — moderation review log for public submissions.
-- One row per admin decision (approve / reject) for audit trail.
CREATE TABLE IF NOT EXISTS `bank_option_reviews` (
  `id`              BIGINT       AUTO_INCREMENT PRIMARY KEY,
  `option_id`       VARCHAR(8)   NOT NULL,
  `reviewer_sub`    VARCHAR(64)  NOT NULL,
  `decision`        VARCHAR(16)  NOT NULL,                       -- "approve" | "reject"
  `reason`          TEXT         NULL,                           -- shown to author on reject
  `reviewed_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_bor_option` (`option_id`),
  CONSTRAINT `fk_bor_option`
    FOREIGN KEY (`option_id`) REFERENCES `bank_options`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
