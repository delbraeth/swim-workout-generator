-- Migration 043 — Apple In-App Purchase (scaffold, parallel to 038 Stripe)
--
-- App Store policy requires IAP for digital subscriptions purchased inside the
-- iOS app. This adds the minimal schema so Apple receipts can drive the SAME
-- tier seam Stripe already uses (users.tier via grantTier/revokeTier). Web keeps
-- Stripe; iOS uses IAP; both resolve to users.tier. tier_source distinguishes
-- them ('stripe_sub_xxx' vs 'apple_iap_xxx').
--
-- IDEMPOTENT: every ALTER uses IF NOT EXISTS, every CREATE uses IF NOT EXISTS.
-- Safe to re-run. NOT auto-applied — apply manually to prod (this project has
-- no migration runner; see migrations 038-042 precedent).
--
-- Nothing here activates billing on its own; lib/appleIap.js stays inert until
-- APPLE_IAP_CONFIG env is set. These columns simply give the IAP path a home.

-- ── users: Apple IAP linkage ────────────────────────────────────────
-- apple_original_transaction_id is Apple's stable per-user-per-subscription key
-- (the originalTransactionId), the IAP analogue of stripe_customer_id. It's how
-- App Store Server Notifications map back to a user when a renewal/cancel fires.
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `apple_original_transaction_id` VARCHAR(64) NULL AFTER `stripe_customer_id`,
  ADD INDEX  IF NOT EXISTS `idx_apple_orig_txn` (`apple_original_transaction_id`);

-- ── apple_iap_events: idempotency for App Store Server Notifications V2 ──
-- Apple re-sends notifications on retry; key on the notification UUID so we
-- process each exactly once (mirrors stripe_webhook_events).
CREATE TABLE IF NOT EXISTS `apple_iap_events` (
  `notification_uuid` VARCHAR(128) PRIMARY KEY,
  `notification_type` VARCHAR(64) NOT NULL,
  `subtype`           VARCHAR(64) NULL,
  `original_txn_id`   VARCHAR(64) NULL,
  `received_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_status`  ENUM('pending','processed','failed') NOT NULL DEFAULT 'pending',
  `last_error`        TEXT NULL,
  `payload_json`      MEDIUMTEXT NOT NULL,
  INDEX `idx_status_received` (`processed_status`, `received_at`),
  INDEX `idx_orig_txn` (`original_txn_id`)
) ENGINE=InnoDB;

-- billing_history (from 038) is reused for IAP rows: stripe_invoice_id /
-- stripe_charge_id stay NULL and the apple transaction id goes in description
-- for v1. (A dedicated apple_transaction_id column can be added in v1.1 if the
-- in-app history view needs to distinguish channels precisely.)
