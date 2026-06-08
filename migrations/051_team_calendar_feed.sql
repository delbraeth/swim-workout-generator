-- 051_team_calendar_feed.sql — Phase 5 Slice A rework: move the calendar feed from
-- per-coach to per-team (more shareable — a team's families can subscribe). Adds a
-- per-team feed token and drops the per-coach one from 049 (now unused).
-- The token is the sole credential on the public GET /calendar/:token.ics route, so
-- it must be unguessable + revocable. NULL until an owner first generates the link.
ALTER TABLE `teams`
  ADD COLUMN `calendar_feed_token` VARCHAR(64) NULL UNIQUE AFTER `team_code`;

ALTER TABLE `users`
  DROP COLUMN `calendar_feed_token`;
