-- Migration 042 — parent_invites + settings.digest_paused
-- (Phase 4 / Parent Portal MVP, per PARENT_PORTAL_MVP_SCOPE.md)
--
-- Parent-invite flow: coach types parent's email → row inserted with
-- state='pending' → invite email sent via lib/email.js worker → parent
-- signs in via Apple/Google OAuth → dbConsumePendingInvitesForUser
-- matches their verified email to pending invites → guardians row
-- created + invite state='accepted'.
--
-- swimmer_managed_id is VARCHAR(32) to match coach_managed_swimmers.id
-- pattern (ms_xxxxxx, per genManagedId). Spec drafted BIGINT but actual
-- column is VARCHAR — using actual type. Per
-- [[feedback-no-fk-into-legacy-tables]] no FK constraint into the
-- legacy cms or users tables; app layer integrity via LEFT JOIN reads.
--
-- IDENTITY assumption: every parent_invite targets EITHER a managed
-- swimmer (managed_id) OR a real-account swimmer (sub). XOR enforced
-- in db.js, not by DB constraint (MariaDB CHECK constraints didn't
-- exist in older versions; app-layer check is the pattern used
-- elsewhere in the codebase).
--
-- digest_paused: opt-OUT per spec decision 7. Default 0 = digest enabled.
-- Per-parent column lives on settings since each user has at most one
-- settings row.
--
-- IDEMPOTENT: CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS `parent_invites` (
  `id`                   BIGINT AUTO_INCREMENT PRIMARY KEY,
  `swimmer_managed_id`   VARCHAR(32)  NULL,                                   -- XOR with swimmer_sub
  `swimmer_sub`          VARCHAR(255) NULL,
  `parent_email`         VARCHAR(255) NOT NULL,
  `invited_by_coach_sub` VARCHAR(255) NOT NULL,
  `state`                ENUM('pending','accepted','expired','revoked') NOT NULL DEFAULT 'pending',
  `created_at`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `accepted_at`          DATETIME NULL,
  `expires_at`           DATETIME NOT NULL,
  INDEX `idx_email_state`        (`parent_email`, `state`),
  INDEX `idx_swimmer_managed`    (`swimmer_managed_id`),
  INDEX `idx_swimmer_sub`        (`swimmer_sub`),
  INDEX `idx_state_expires`      (`state`, `expires_at`)
) ENGINE=InnoDB;

-- Per-parent weekly digest opt-out toggle. Default ON; parent flips
-- in ProfileModal to pause delivery without losing in-app dashboard.
ALTER TABLE `settings`
  ADD COLUMN IF NOT EXISTS `digest_paused` TINYINT(1) NOT NULL DEFAULT 0 AFTER `extra`;
