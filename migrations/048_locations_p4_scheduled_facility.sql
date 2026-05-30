-- Migration 048 — Locations P4: tie a scheduled practice to a facility.
-- Per LOCATIONS_SCOPE.md. A multi-pool team's practice can record WHICH pool
-- it's at; the facility's course can default the generator's pool_mode.
--
-- NO hard FK to team_facilities (team_facilities uses soft-archive via
-- archived_at, so ON DELETE never fires; and scheduled_workouts is an older
-- table — keep it conservative: column + index + app-layer LEFT JOIN, per
-- the no-FK-into-legacy guardrail). facility_id is BIGINT (no collation).
--
-- IDEMPOTENT: ADD COLUMN/INDEX IF NOT EXISTS.

ALTER TABLE `scheduled_workouts`
  ADD COLUMN IF NOT EXISTS `facility_id` BIGINT NULL;

ALTER TABLE `scheduled_workouts`
  ADD INDEX IF NOT EXISTS `idx_sched_facility` (`facility_id`);
