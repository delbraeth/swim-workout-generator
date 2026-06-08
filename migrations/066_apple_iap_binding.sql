-- 066_apple_iap_binding.sql — CRITICAL IAP fix (security audit 2026-06-08).
-- /api/billing/apple/verify granted a paid tier from any valid signed StoreKit
-- receipt without binding it to the caller, so one receipt could be replayed to
-- self-grant tiers to unlimited accounts. The fix binds purchases two ways:
--   1. apple_app_account_token — a per-user UUID the app passes at purchase;
--      Apple bakes it into the receipt and /verify asserts it matches the caller.
--   2. apple_original_transaction_id made UNIQUE — one subscription entitles at
--      most one account (server also checks ownership before granting).
--
-- SELF-CONTAINED + IDEMPOTENT: prod was found NOT to have migration 043's Apple
-- columns (never applied, or a DB restore reverted them — #1054 on the orig-txn
-- column), so this migration also (re)creates that 043 schema with IF NOT EXISTS.
-- Safe to re-run. IAP is Sandbox-only today, so the dedupe touches only test rows.

-- ── 043 prerequisites (Apple IAP linkage + notification idempotency) ──────────
-- (No separate index on apple_original_transaction_id — the UNIQUE key added at
-- the end of this migration serves as its index.)
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `apple_original_transaction_id` VARCHAR(64) NULL;

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

-- ── New: per-user purchase-binding token ──────────────────────────────────────
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `apple_app_account_token` VARCHAR(36) NULL;

-- ── Enforce one-account-per-subscription on apple_original_transaction_id ──────
-- Normalize blanks to NULL so they don't collide under the UNIQUE key.
UPDATE `users` SET `apple_original_transaction_id` = NULL
WHERE `apple_original_transaction_id` = '';

-- Dedupe: if an originalTransactionId is linked to >1 user (the vuln's footprint),
-- keep the lexicographically-smallest sub and clear the rest.
UPDATE `users` u
JOIN (
  SELECT MIN(`sub`) AS keep_sub, `apple_original_transaction_id` AS txn
  FROM `users`
  WHERE `apple_original_transaction_id` IS NOT NULL
  GROUP BY `apple_original_transaction_id`
  HAVING COUNT(*) > 1
) d ON u.`apple_original_transaction_id` = d.txn AND u.`sub` <> d.keep_sub
SET u.`apple_original_transaction_id` = NULL;

-- One subscription → at most one account. (NULLs are allowed/ignored by UNIQUE.)
ALTER TABLE `users`
  ADD UNIQUE INDEX IF NOT EXISTS `uk_apple_orig_txn` (`apple_original_transaction_id`);
