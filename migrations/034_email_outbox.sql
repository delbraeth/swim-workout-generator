-- Migration 034 — email_outbox (Phase 2 · Email Infra)
--
-- DB-backed outbound email queue per EMAIL_INFRA_SCOPE.md §3.3. Every
-- enqueueEmail() call inserts a row here BEFORE the provider is
-- contacted. An in-process worker poller (lib/email.js) picks up
-- pending rows every 30 seconds, sends via Resend, and updates the
-- status to sent/failed. Survives provider outages; audit trail lives
-- in audit_events keyed on email_outbox.id.
--
-- dedup_key prevents double-sends — every enqueue site supplies a
-- per-send identifier like "welcome:{userSub}" or
-- "feedback_ack:{feedbackId}". The UNIQUE constraint means a duplicate
-- enqueue ON DUPLICATE KEY no-ops (handled in app layer).
--
-- status enum:
--   pending          — queued, waiting for worker pick-up
--   sending          — claimed by a worker tick, send in flight
--   sent             — provider returned 2xx, provider_msg_id stored
--   failed           — exhausted 3 retries OR a non-retryable error
--   bypassed_minor   — minor-bypass per scope decision 12 (DOB <18 or NULL).
--                      Row inserted for audit but never sent.
--
-- IDEMPOTENT: CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS `email_outbox` (
  `id`              BIGINT AUTO_INCREMENT PRIMARY KEY,
  `dedup_key`       VARCHAR(255) NOT NULL UNIQUE,
  `to_email`        VARCHAR(255) NOT NULL,
  `to_user_sub`     VARCHAR(255) NULL,
  `template_id`     VARCHAR(64) NOT NULL,
  `subject`         VARCHAR(255) NOT NULL,
  `html_body`       MEDIUMTEXT NOT NULL,
  `text_body`       MEDIUMTEXT NOT NULL,
  `status`          ENUM('pending', 'sending', 'sent', 'failed', 'bypassed_minor') NOT NULL DEFAULT 'pending',
  `attempts`        INT NOT NULL DEFAULT 0,
  `last_error`      TEXT NULL,
  `provider_msg_id` VARCHAR(255) NULL,
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sent_at`         DATETIME NULL,
  `next_retry_at`   DATETIME NULL,
  INDEX `idx_status_retry` (`status`, `next_retry_at`),
  INDEX `idx_to_user_sub`  (`to_user_sub`)
) ENGINE=InnoDB;
