-- Migration 044 — additive person-normalization fields (Identity I-F pass).
-- Part of the same pass that drops the legacy name/dob/gender columns
-- (migration 045, separate + destructive), but THIS file is purely
-- additive and safe to apply on its own at any time.
--
-- Adds:
--   * persons.class_year  — graduation year (SMALLINT). Source of truth for
--     HS/college roster context. Grade level is DERIVED at read time from
--     class_year + current academic year, NOT stored (it would go stale
--     every August). NULL = unknown / not-a-student.
--   * teams.school — school / club affiliation, modeled at the team level
--     (for HS the team usually IS the school; avoids per-swimmer dup).
--
-- USA-Swimming / registration IDs are NOT added here — they already have a
-- home in `person_external_ids` (migration 039), keyed by (person_id,
-- system). The I-F writer pass wires a `usa_swimming` system value there.
--
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS (same MariaDB idiom as 039/041/042).

ALTER TABLE `persons`
  ADD COLUMN IF NOT EXISTS `class_year` SMALLINT NULL AFTER `gender`;

ALTER TABLE `teams`
  ADD COLUMN IF NOT EXISTS `school` VARCHAR(120) NULL;
