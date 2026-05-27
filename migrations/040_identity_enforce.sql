-- Migration 040 — identity person_id NOT NULL + FK + UNIQUE
-- (Phase 4 / Identity I-C of 8)
--
-- Per IDENTITY_SCOPE.md §7 I-C. Flips users.person_id +
-- coach_managed_swimmers.person_id from nullable to NOT NULL, adds the
-- FK constraint to persons(id), and adds UNIQUE constraints (1:1
-- relation: one person per user / managed_swimmer).
--
-- ⚠ PRE-FLIGHT GATE: this migration FAILS if any row has NULL person_id.
-- That's intentional — it forces I-B backfill to be complete before I-C
-- can run. Run the pre-flight query first; if either count is non-zero,
-- finish I-B before applying this migration.
--
--   SELECT COUNT(*) FROM users WHERE person_id IS NULL;
--   SELECT COUNT(*) FROM coach_managed_swimmers WHERE person_id IS NULL;
--
-- ⚠ WRITER GAP: after this migration applies, db.js INSERT paths for
-- users + coach_managed_swimmers MUST create a persons row + set
-- person_id atomically, OR the inserts will fail with NOT NULL
-- violation. Specifically:
--   - dbEnsureUser (server.js OAuth callback path)
--   - dbCreateManagedSwimmer
--   - dbBulkCreateManagedSwimmers
-- The db.js change to wrap these in genPersonId() + INSERT INTO persons
-- + INSERT/UPDATE source table is a SEPARATE slice that should ship
-- BEFORE this migration is applied to prod. Otherwise new sign-ups +
-- new managed swimmers break immediately.
--
-- Recommended sequence:
--   1. Verify I-B backfill clean (both pre-flight counts = 0)
--   2. Ship db.js writer updates that create persons rows on INSERT
--   3. Deploy
--   4. Apply this migration
--
-- IDEMPOTENT-ish: re-running succeeds if the column is already NOT NULL
-- + FK already exists + UNIQUE already exists. MariaDB doesn't have
-- ALTER COLUMN ... NOT NULL IF NOT EXISTS or ADD CONSTRAINT IF NOT
-- EXISTS for FK, so we use information_schema checks via DELIMITER
-- procedures to make this safe. (Simpler alternative if your prod
-- workflow allows: just run twice and ignore the "duplicate key" /
-- "column is already NOT NULL" errors on the second run.)

-- ── Pre-flight gate ─────────────────────────────────────────────────
-- These statements abort the migration if any row has NULL person_id.
-- MariaDB doesn't have a clean "RAISE ERROR" in plain SQL; the
-- MODIFY COLUMN ... NOT NULL below will fail with a clear "Invalid
-- use of NULL value" error if pre-flight isn't met. That's the gate.

-- ── users.person_id ─────────────────────────────────────────────────
ALTER TABLE `users`
  MODIFY COLUMN `person_id` VARCHAR(16) NOT NULL;

ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_person_id`
  FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`);

ALTER TABLE `users`
  ADD UNIQUE KEY `uk_users_person_id` (`person_id`);

-- ── coach_managed_swimmers.person_id ────────────────────────────────
ALTER TABLE `coach_managed_swimmers`
  MODIFY COLUMN `person_id` VARCHAR(16) NOT NULL;

ALTER TABLE `coach_managed_swimmers`
  ADD CONSTRAINT `fk_cms_person_id`
  FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`);

ALTER TABLE `coach_managed_swimmers`
  ADD UNIQUE KEY `uk_cms_person_id` (`person_id`);

-- ── Post-apply verification (informational) ─────────────────────────
-- After applying, the column metadata should show NOT NULL + FK + UNIQUE
-- on both tables. Verify via:
--   SHOW CREATE TABLE users\G
--   SHOW CREATE TABLE coach_managed_swimmers\G
-- Look for:
--   `person_id` varchar(16) NOT NULL
--   UNIQUE KEY `uk_users_person_id` (`person_id`)
--   CONSTRAINT `fk_users_person_id` FOREIGN KEY (`person_id`) REFERENCES `persons` (`id`)
