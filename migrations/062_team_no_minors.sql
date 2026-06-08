-- 062_team_no_minors.sql — Phase 6 A6: "adult team / no minors" one-tap.
-- The Masters-coach board ask: a non-'masters' team that is in fact adults-only
-- can declare "no minors", which LIFTS the F5 compliance force-ON (and reads as
-- "youth compliance doesn't apply here"). Stored on the team's feature-flags row
-- (team_id, group_id=''). Masters teams are already minor-free by type, so this
-- only matters for high_school/summer/club teams that happen to be all-adult.
ALTER TABLE `team_feature_flags`
  ADD COLUMN `no_minors` TINYINT(1) NOT NULL DEFAULT 0 AFTER `overrides`;
