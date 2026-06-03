-- Migration 045 — team ownership transfers (Phase 4 continuity)
--
-- Per OWNERSHIP_TRANSFER_SCOPE.md §3.1. A deliberate, reversible hand-off of a
-- team's ownership: owner proposes an existing team admin, who can Accept (early)
-- or Decline; the original owner can Cancel; after a 30-day cooldown with no
-- action the email-worker cron auto-completes it. Exactly one PENDING row per
-- team is enforced at the app layer (dbProposeOwnershipTransfer).
--
-- On accept / auto-complete the role swap updates BOTH owner representations
-- (teams.owner_coach_sub + team_coaches.role) in one transaction, and the
-- departing owner's team-shared + public UGC reassigns to the new owner.
--
-- Note: spec calls this "039" but that number (and 040-044) are taken; this is
-- the next free migration. Manual prod apply (no runner).
--
-- IDEMPOTENT: CREATE TABLE IF NOT EXISTS. Safe to re-run.

CREATE TABLE IF NOT EXISTS `team_ownership_transfers` (
  `id`               BIGINT AUTO_INCREMENT PRIMARY KEY,
  `team_id`          BIGINT NOT NULL,
  `from_sub`         VARCHAR(255) NOT NULL,      -- current owner at proposal time
  `to_sub`           VARCHAR(255) NOT NULL,      -- proposed new owner (a team admin)
  `state`            ENUM('pending','accepted','cancelled','declined','completed') NOT NULL DEFAULT 'pending',
  `proposed_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_at`      DATETIME NULL,              -- when it left 'pending'
  `auto_complete_at` DATETIME NOT NULL,          -- proposed_at + 30 days
  `cancel_reason`    VARCHAR(255) NULL,          -- stored for audit; not surfaced v1
  INDEX `idx_team_state`     (`team_id`, `state`),
  INDEX `idx_auto_complete`  (`auto_complete_at`, `state`),
  INDEX `idx_to_state`       (`to_sub`, `state`),
  FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;
