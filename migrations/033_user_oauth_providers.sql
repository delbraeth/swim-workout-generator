-- Migration 033 — user_oauth_providers join table (Phase 2 · Google OAuth)
--
-- Adds a join table mapping (provider, provider_sub) → users.sub so a
-- single SetForge user can be authenticated via multiple OAuth providers
-- (Apple today, Google starting now). Per GOOGLE_OAUTH_SCOPE.md §3.2.
--
-- The composite primary key (provider, provider_sub) means each external
-- identity is owned by exactly one user. The users.sub stays as the
-- internal primary key everywhere else; account-linking by verified email
-- on Google sign-in (decision 1) writes a row here pointing at the
-- existing Apple-created users.sub.
--
-- Backfill: every existing users.sub gets a row with provider='apple',
-- provider_sub=sub. Idempotent — re-runnable. After backfill, lookups go
-- through dbGetUserSubByProvider(provider, providerSub) which is a
-- passthrough for Apple (provider_sub IS the user_sub today) and a
-- proper join for Google (looks up the linked user).
--
-- IDEMPOTENT: CREATE TABLE IF NOT EXISTS + INSERT IGNORE backfill.

CREATE TABLE IF NOT EXISTS `user_oauth_providers` (
  `provider`     ENUM('apple', 'google') NOT NULL,
  `provider_sub` VARCHAR(255) NOT NULL,
  `user_sub`     VARCHAR(255) NOT NULL,
  `linked_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`provider`, `provider_sub`),
  INDEX `idx_user_sub` (`user_sub`),
  CONSTRAINT `fk_user_oauth_providers_user_sub`
    FOREIGN KEY (`user_sub`) REFERENCES `users`(`sub`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Backfill every existing user as an apple provider. provider_sub = users.sub
-- because today's users.sub IS the Apple sub. Future Google additions will
-- have their own provider_sub distinct from user_sub.
INSERT IGNORE INTO `user_oauth_providers` (`provider`, `provider_sub`, `user_sub`, `linked_at`)
SELECT 'apple', `sub`, `sub`, COALESCE(`created_at`, CURRENT_TIMESTAMP)
  FROM `users`;
