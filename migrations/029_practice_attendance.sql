-- Migration 029 — Practice attendance (Reporting v1 Phase A)
--
-- Lightweight default-present attendance model. Spec: REPORTING_SCOPE.md §3.
--
-- Scope locked 2026-05-23:
--   * Bundle attendance into reporting v1 (vs. punt to v2) — unlocks R2
--     (Schedule Adherence) with meaningful "what % of programmed work
--     was actually done" data.
--   * Coach UX: "Mark practice done" → roster pre-rendered + pre-checked
--     → uncheck absences → save. Per-swimmer notes optional.
--   * No-roster cases (solo, masters without rosters) still stamp
--     completed_at on the schedule row but write no attendance rows.
--   * Two-target convention (swimmer_sub XOR managed_id) mirrors
--     workout_assignments for swimmers that exist as real users vs.
--     coach-managed stand-ins (R-H managed_swimmers).
--
-- VARCHAR(64) for *_sub columns matches users, favorites, audit_events.

-- 1. Practice attendance — one row per (scheduled_workout, swimmer).
CREATE TABLE IF NOT EXISTS `practice_attendance` (
  `id`                    BIGINT       AUTO_INCREMENT PRIMARY KEY,
  `scheduled_workout_id`  BIGINT       NOT NULL,
  `swimmer_sub`           VARCHAR(64)  NULL,
  `managed_id`            BIGINT       NULL,
  `present`               BOOLEAN      NOT NULL DEFAULT 1,
  `notes`                 TEXT         NULL,
  `recorded_by_sub`       VARCHAR(64)  NOT NULL,
  `recorded_at`           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Uniqueness keys: one attendance row per (workout, target). Two indexes
  -- (one per target type) because MariaDB UNIQUE allows multiple NULLs but
  -- the swimmer/managed XOR keeps them from colliding.
  UNIQUE KEY `uq_attendance_swimmer` (`scheduled_workout_id`, `swimmer_sub`),
  UNIQUE KEY `uq_attendance_managed` (`scheduled_workout_id`, `managed_id`),
  -- Look up "what did absentee X miss" by swimmer; "who missed practice Y"
  -- by scheduled_workout_id (already covered by the unique above).
  INDEX `idx_attendance_swimmer_history` (`swimmer_sub`, `recorded_at`),
  INDEX `idx_attendance_managed_history` (`managed_id`, `recorded_at`),
  -- XOR constraint: every row targets EITHER a real swimmer sub OR a
  -- managed_swimmers row, never both, never neither.
  CONSTRAINT `chk_attendance_one_target` CHECK (
    (`swimmer_sub` IS NOT NULL AND `managed_id` IS NULL) OR
    (`swimmer_sub` IS NULL     AND `managed_id` IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Mark scheduled_workouts row as completed.
-- NULL completed_at = still scheduled or skipped; NOT NULL = marked done.
-- completed_by_sub captures who tapped "Mark practice done" (usually the
-- coach who owns the workout, but could differ in a multi-coach group).
ALTER TABLE `scheduled_workouts`
  ADD COLUMN `completed_at`     DATETIME     NULL AFTER `scheduled_date`,
  ADD COLUMN `completed_by_sub` VARCHAR(64)  NULL AFTER `completed_at`;

-- Look up completion stats per coach (R2 Schedule Adherence).
CREATE INDEX `idx_scheduled_completed` ON `scheduled_workouts` (`completed_at`);
