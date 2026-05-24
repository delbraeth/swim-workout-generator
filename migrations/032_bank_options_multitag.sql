-- Migration 032 — Multi-tag on UGC bank options (UGC Phase H.1)
--
-- Adds type_ids + stroke_ids JSON arrays to bank_options so a single
-- option can declare membership in multiple type/stroke buckets without
-- duplicating the row. Spec: tester request 2026-05-25 — coaches don't
-- want to duplicate kick sets just to land them in distance/sprint/etc
-- type pools simultaneously.
--
-- Backfill strategy: existing single-bucket rows get wrapped to an
-- array of length 1. type_id / stroke_id singleton columns are KEPT
-- in this migration for transition safety (still readable by old code
-- paths). A follow-up migration can drop them once all readers switch.
--
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS (MariaDB 10.0.2+).

ALTER TABLE `bank_options`
  ADD COLUMN IF NOT EXISTS `type_ids`   JSON NULL AFTER `type_id`,
  ADD COLUMN IF NOT EXISTS `stroke_ids` JSON NULL AFTER `stroke_id`;

-- Backfill arrays from existing singletons. Idempotent: re-running
-- overwrites with the same JSON_ARRAY, no harm. Only writes for rows
-- that have a non-null singleton (warmup/cooldown options keep both
-- as null since they don't belong to a type/stroke bucket).
UPDATE `bank_options`
   SET `type_ids` = JSON_ARRAY(`type_id`)
 WHERE `type_id` IS NOT NULL AND `type_ids` IS NULL;

UPDATE `bank_options`
   SET `stroke_ids` = JSON_ARRAY(`stroke_id`)
 WHERE `stroke_id` IS NOT NULL AND `stroke_ids` IS NULL;
