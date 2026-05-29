-- Migration 045 — Identity I-F final step: DROP the 8 legacy identity
-- columns now that persons is the sole source of truth.
--
-- ⚠️  DO NOT APPLY until the code that stops reading these columns is
--     DEPLOYED and SMOKED. As of 2026-05-29 every writer writes persons,
--     every reader reads persons (legacy SELECT aliases + COALESCE legacy
--     arms + ORDER-BYs all stripped from db.js), and server.js has no
--     direct legacy reads. `_ensurePersonId` is the only place that still
--     touches a legacy column, and only in its rare create/repair branch
--     inside a try/catch — it self-heals to placeholder seeding once these
--     columns are gone. Apply this manually (phpMyAdmin) after a clean
--     smoke of: profile edit (name/initials/dob/gender/class_year),
--     create/edit managed swimmer, parent claim (redeem token), coach
--     notes, group rosters, reports.
--
-- Drops:
--   users.display_name, users.initials, users.dob, users.gender
--   coach_managed_swimmers.display_name, .initials, .dob, .gender
-- KEEPS: coach_managed_swimmers.parental_contact (out of I-F scope, waits
--        for I-E), persons.* (the replacements), class_year, usa_swimming_id.
--
-- IDEMPOTENT: DROP COLUMN IF EXISTS (MariaDB). If a DROP errors due to a
-- dependent COMPOSITE index on one of these columns, run `SHOW INDEX FROM
-- <table>` and DROP INDEX IF EXISTS that index first, then re-run. (Single-
-- column indexes are auto-dropped with the column.)

ALTER TABLE `users`
  DROP COLUMN IF EXISTS `display_name`,
  DROP COLUMN IF EXISTS `initials`,
  DROP COLUMN IF EXISTS `dob`,
  DROP COLUMN IF EXISTS `gender`;

ALTER TABLE `coach_managed_swimmers`
  DROP COLUMN IF EXISTS `display_name`,
  DROP COLUMN IF EXISTS `initials`,
  DROP COLUMN IF EXISTS `dob`,
  DROP COLUMN IF EXISTS `gender`;
