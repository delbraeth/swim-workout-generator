-- 061_team_feature_flags.sql — Phase 6 "Team Option Visibility" foundation
-- (Wave 2). A team OWNER hides surfaces to simplify the app. Per
-- docs/PHASE_6_TOGGLE_AUDIT.md + docs/IMPLEMENTATION_PLAN_2026-06-06.md (team-only
-- v1; group_id reserved for a later per-group override — decision 1).
--
-- One row holds a team's chosen PRESET (simple/standard/full) + a sparse JSON map
-- of per-flag overrides. Keeping overrides as JSON (not a row-per-flag) means the
-- flag registry can evolve in code (src/lib/featureFlags.js) without migrations.
--   preset      NULL = registry defaults (all-on); else 'simple'|'standard'|'full'
--   overrides   JSON { flag_key: bool } — sparse; overlaid on the preset
--   group_id    RESERVED — '' = team-level (always '' in v1); a future gr_xxx
--               enables per-group override (decision 1) with NO restructure.
--               (NOT NULL + '' sentinel because a NULL can't sit in a PRIMARY KEY.)
-- utf8mb4_unicode_ci explicit (the utf8mb3-default join trap).
CREATE TABLE IF NOT EXISTS `team_feature_flags` (
  `team_id`    VARCHAR(16) NOT NULL,
  `group_id`   VARCHAR(16) NOT NULL DEFAULT '',
  `preset`     ENUM('simple','standard','full') NULL,
  `overrides`  JSON NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` VARCHAR(255) NULL,
  PRIMARY KEY (`team_id`, `group_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
