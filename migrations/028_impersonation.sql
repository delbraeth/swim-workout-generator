-- Migration 028 — Impersonation (view-as v3)
--
-- Customer-support feature: admins or users with the new `support_role`
-- flag can impersonate any other user for up to 30 minutes, read-only.
-- Spec: VIEW_AS_V3_SCOPE.md at repo root.
--
-- Scope locked 2026-05-22:
--   * Header-based auth (X-Impersonate-Sub on every API call)
--   * support_role boolean column (or is_admin) gates the ability
--   * Read-only enforced server-side
--   * 30-min hard cap
--   * Every API call during impersonation audit-logged
--   * No user notification (Cap'n's call against recommendation)
--
-- VARCHAR(64) for user_sub columns matches existing favorites + users tables.

-- 1. Grant gate — new column on users.
ALTER TABLE `users`
  ADD COLUMN `support_role` BOOLEAN NOT NULL DEFAULT 0;

CREATE INDEX `idx_users_support_role` ON `users` (`support_role`);

-- 2. Impersonation sessions — active + historical.
-- One row per impersonation session. ended_at NULL = still active (and
-- not yet expired). Lookup by (admin_sub, ended_at, expires_at) finds
-- the admin's currently-active session in one query.
CREATE TABLE IF NOT EXISTS `impersonation_sessions` (
  `id`          BIGINT       AUTO_INCREMENT PRIMARY KEY,
  `admin_sub`   VARCHAR(64)  NOT NULL,
  `target_sub`  VARCHAR(64)  NOT NULL,
  `started_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at`  DATETIME     NOT NULL,                  -- started_at + 30 min
  `ended_at`    DATETIME     NULL,                       -- NULL = active, set on explicit end or expiry-cleanup
  `end_reason`  VARCHAR(32)  NULL,                       -- "exit" | "expired" | "admin_revoked"
  INDEX `idx_impersonation_admin_active` (`admin_sub`, `ended_at`, `expires_at`),
  INDEX `idx_impersonation_target_history` (`target_sub`, `started_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Extend audit_events with impersonator_sub.
-- When a request happens during an active impersonation session, the
-- audit log row carries BOTH the impersonator (admin who did the action)
-- AND user_sub (the impersonated target on whose behalf the action ran).
-- For non-impersonated requests, impersonator_sub stays NULL.
ALTER TABLE `audit_events`
  ADD COLUMN `impersonator_sub` VARCHAR(64) NULL;

CREATE INDEX `idx_audit_impersonator` ON `audit_events` (`impersonator_sub`, `created_at`);
