-- 048_lesson_level.sql — Lesson tier (Phase 5): coach-authored lesson sets + level
-- Lessons span a huge ability range (4-year-old learn-to-swim → 80-year-old masters),
-- so coach-authored content needs an ABILITY level (not age) to scope it. `level`
-- is the cross-cutting discriminator that works on every lesson section (warmup,
-- skill, send-off) — warmup/cooldown UGC is type-agnostic, so the lesson *type* tag
-- alone can't scope them, but `lesson_level` can.
--
-- Values: 'beginner' | 'intermediate' | 'advanced' | NULL (untagged = shows at any level).
-- Apply MANUALLY to prod (no runner). Idempotent via IF NOT EXISTS.

ALTER TABLE `bank_options`
  ADD COLUMN IF NOT EXISTS `lesson_level` VARCHAR(16) NULL AFTER `stroke_ids`;

ALTER TABLE `coach_managed_swimmers`
  ADD COLUMN IF NOT EXISTS `lesson_level` VARCHAR(16) NULL AFTER `equipment_modes`;
