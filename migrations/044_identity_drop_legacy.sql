-- Migration 044 — Identity I-F: drop legacy identity columns
-- (Phase 4 / Identity refactor — Phase I-F of 8)
--
-- After I-D switched all read paths to `persons` (JOIN via person_id) and the
-- create/update paths to write `persons` exclusively, these columns on `users`
-- and `coach_managed_swimmers` are vestigial. A static audit (2026-06-03)
-- confirmed the ONLY remaining direct read is db.js `_ensurePersonId`, which is
-- wrapped in try/catch and falls back to placeholders once the columns are gone.
--
-- DEPLOY ORDER (critical): deploy the code that stops reading these columns
-- FIRST (already done — this migration is applied AFTER the code is live), then
-- apply this migration by hand to prod. No migration runner exists.
--
-- Soak: the 30-day I-F soak was waived 2026-06-03 (pilot mode, all test users,
-- thorough static audit, persons is authoritative + re-addable if ever needed).
--
-- KEPT (intentionally NOT dropped):
--   coach_managed_swimmers.parental_contact — superseded later by guardians +
--   parent_contact_methods (migration 039), but retained until that backfill
--   (I-E) runs against real data. Out of I-F drop scope per Cap'n.
--
-- IDEMPOTENT: DROP COLUMN IF EXISTS is safe to re-run. In MariaDB/MySQL,
-- dropping a column auto-removes single-column indexes that reference it.

-- ── users: drop legacy identity columns (live on persons now) ───────
ALTER TABLE `users`
  DROP COLUMN IF EXISTS `display_name`,
  DROP COLUMN IF EXISTS `initials`,
  DROP COLUMN IF EXISTS `dob`,
  DROP COLUMN IF EXISTS `gender`;

-- ── coach_managed_swimmers: same (parental_contact intentionally kept) ──
ALTER TABLE `coach_managed_swimmers`
  DROP COLUMN IF EXISTS `display_name`,
  DROP COLUMN IF EXISTS `initials`,
  DROP COLUMN IF EXISTS `dob`,
  DROP COLUMN IF EXISTS `gender`;

-- Reverse (if ever needed): re-add the columns nullable, then backfill from
-- persons via person_id:
--   ALTER TABLE `users` ADD COLUMN `display_name` VARCHAR(160) NULL,
--     ADD COLUMN `initials` VARCHAR(8) NULL, ADD COLUMN `dob` DATE NULL,
--     ADD COLUMN `gender` VARCHAR(40) NULL;
--   UPDATE `users` u JOIN `persons` p ON p.id = u.person_id
--     SET u.display_name = CONCAT_WS(' ', p.first_name, p.last_name),
--         u.initials = p.initials, u.dob = p.dob, u.gender = p.gender;
--   (and the analogous statements for coach_managed_swimmers)
