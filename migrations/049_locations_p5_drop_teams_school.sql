-- Migration 049 — Locations P5: drop teams.school.
-- Per LOCATIONS_SCOPE.md decision 5. teams.school was added in migration 044
-- as a single-facility affiliation, then generalized into team_facilities in
-- P1 (migration 046, which backfilled school -> a primary facility). It has
-- been kept only as a redundant mirror of the primary facility's name. All
-- code reads/writes of teams.school were removed in the same commit as this
-- migration (dbGetTeamSettings select, dbSetTeamSchool, the facility-helper
-- mirror writes, and the settings-route school branch), so the column is now
-- dead. team_facilities is the sole source of truth for a team's pool(s).
--
-- ORDER: deploy the code that stops referencing teams.school FIRST (or in the
-- same push), THEN apply this DROP. (A stale deploy still selecting `school`
-- would 500 — same lesson as the I-F legacy-column drop, migration 045.)
--
-- IDEMPOTENT: DROP COLUMN IF EXISTS (MariaDB).

ALTER TABLE `teams`
  DROP COLUMN IF EXISTS `school`;
