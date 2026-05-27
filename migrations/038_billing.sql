-- Migration 038 — billing (Phase 3 deliverable 4 of 4 · scaffold)
--
-- Per BILLING_SCOPE.md §3.2. Stripe-backed billing for Coach tier
-- ($10/mo monthly, optional $100/yr annual in v1.1). Program tier
-- ($300/yr) ships via manually-issued Stripe Invoices documented in
-- VENDOR_PAPER_KIT_SCOPE.md; no extra DB columns needed for that path.
--
-- Schema (per scope §3.2):
--   users.stripe_customer_id  VARCHAR(64) NULL  — link to Stripe Customer
--   users.tier                ENUM('free','coach','program') NOT NULL DEFAULT 'free'
--   users.tier_granted_at     DATETIME NULL
--   users.tier_source         VARCHAR(64) NULL   — 'stripe_sub_xyz' or 'admin_grant'
--   INDEX idx_stripe_customer (stripe_customer_id) — for legacy customer→user fallback
--
--   stripe_webhook_events    — idempotency table; Stripe re-sends on retry
--   billing_history          — at-a-glance in-app history (Stripe portal is canonical)
--
-- IDEMPOTENT: every ALTER uses IF NOT EXISTS, every CREATE uses IF NOT EXISTS.
-- Safe to run on a database where billing was already migrated.
--
-- Schema notes (per the no-FK-into-legacy-tables feedback memo):
--   billing_history.user_sub → VARCHAR(255). The FK to users(sub) IS
--   added here because users.sub is VARCHAR (not INT) and the FK clause
--   is allowed when types match. See migration 033 (user_oauth_providers)
--   for precedent — FKs into users(sub) are acceptable; FKs into legacy
--   INT-PK tables (groups, team_events, etc.) are the ones that error.
--
-- v1.1 followup (per scope update 2026-05-26):
--   Add CHECK or trigger enforcing the "tier='coach' implies is_coach=1"
--   invariant. v1 lives with a db-helper convention.

-- ── users: billing columns ──────────────────────────────────────────
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `stripe_customer_id` VARCHAR(64) NULL          AFTER `email_verified`,
  ADD COLUMN IF NOT EXISTS `tier`               ENUM('free','coach','program') NOT NULL DEFAULT 'free' AFTER `is_admin`,
  ADD COLUMN IF NOT EXISTS `tier_granted_at`    DATETIME NULL,
  ADD COLUMN IF NOT EXISTS `tier_source`        VARCHAR(64) NULL,
  ADD INDEX  IF NOT EXISTS `idx_stripe_customer` (`stripe_customer_id`);

-- ── stripe_webhook_events: idempotency for re-sent webhooks ─────────
CREATE TABLE IF NOT EXISTS `stripe_webhook_events` (
  `stripe_event_id`  VARCHAR(128) PRIMARY KEY,
  `event_type`       VARCHAR(64) NOT NULL,
  `received_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_status` ENUM('pending','processed','failed') NOT NULL DEFAULT 'pending',
  `last_error`       TEXT NULL,
  `payload_json`     MEDIUMTEXT NOT NULL,
  INDEX `idx_status_received` (`processed_status`, `received_at`)
) ENGINE=InnoDB;

-- ── billing_history: in-app at-a-glance invoice list ────────────────
-- Stripe customer portal is the canonical history view; this table is
-- a small mirror so ProfileModal can render "last 5 invoices" without
-- a round-trip to Stripe on every Profile open.
CREATE TABLE IF NOT EXISTS `billing_history` (
  `id`                BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_sub`          VARCHAR(255) NOT NULL,
  `stripe_invoice_id` VARCHAR(64) NULL,
  `stripe_charge_id`  VARCHAR(64) NULL,
  `amount_cents`      INT NOT NULL,
  `currency`          VARCHAR(3) NOT NULL DEFAULT 'USD',
  `status`            ENUM('paid','refunded','failed','disputed') NOT NULL,
  `description`       VARCHAR(255) NULL,
  `occurred_at`       DATETIME NOT NULL,
  INDEX `idx_user_occurred` (`user_sub`, `occurred_at`),
  FOREIGN KEY (`user_sub`) REFERENCES `users`(`sub`) ON DELETE CASCADE
) ENGINE=InnoDB;
