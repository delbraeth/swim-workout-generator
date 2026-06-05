-- 047_tier_add_lesson.sql — Lesson tier (Phase 5)
-- Extend users.tier ENUM to allow 'lesson'. Migration 038 created it as
-- ENUM('free','coach','program'); granting 'lesson' (admin grant or Stripe
-- webhook) fails with "Data truncated for column 'tier'" until this runs.
-- Ordered free → lesson → coach → program (cheapest → most). DEFAULT unchanged.
--
-- Apply MANUALLY to prod (no migration runner). MODIFY is idempotent — re-running
-- sets the same enum. No data change (existing values are a subset of the new set).

ALTER TABLE `users`
  MODIFY COLUMN `tier` ENUM('free','lesson','coach','program') NOT NULL DEFAULT 'free';
