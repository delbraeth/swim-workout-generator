-- 064_team_events_series.sql — C5 event recurrence (Wave 4).
-- Recurring events are MATERIALIZED: creating a "weekly ×8" event inserts 8
-- normal team_events rows sharing a `series_id`. Each occurrence is a full event
-- (its own id), so RSVP, weather, the calendar feed, reminders, and per-event
-- edits all keep working with zero downstream changes. `series_id` lets us group
-- them (e.g. "delete this and future occurrences"). NULL = a one-off event.
ALTER TABLE `team_events`
  ADD COLUMN `series_id` VARCHAR(16) NULL AFTER `group_id`,
  ADD INDEX `idx_series` (`series_id`);
