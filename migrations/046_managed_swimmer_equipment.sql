-- 046_managed_swimmer_equipment.sql — Lesson tier (Phase 5)
-- Per-managed-swimmer equipment profile. When a coach/instructor generates FOR
-- a managed swimmer, this swimmer-specific equipment overrides the coach's own
-- global equipment selection. Mirrors `teams.default_equipment_modes` (mig 041):
-- a JSON blob whose structure matches the user settings.equipment shape
-- ({ fins: "off"|"preferred"|"required", ... }). NULL = no per-swimmer profile
-- (fall back to the coach's global equipment at generate time).
--
-- Apply MANUALLY to prod (no migration runner). Idempotent via IF NOT EXISTS.

ALTER TABLE `coach_managed_swimmers`
  ADD COLUMN IF NOT EXISTS `equipment_modes` JSON NULL AFTER `pace_lcm_100`;
