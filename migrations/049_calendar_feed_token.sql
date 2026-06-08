-- 049_calendar_feed_token.sql — Phase 5 Slice A (export bridges).
-- Per-user token for the live-subscribe .ics calendar feed. The token is the
-- ONLY credential on the unauthenticated GET /calendar/:token.ics route, so it
-- must be unguessable (random) and revocable (regenerate = rotate). NULL until
-- the user first requests their calendar link (lazy create).
ALTER TABLE `users`
  ADD COLUMN `calendar_feed_token` VARCHAR(64) NULL UNIQUE AFTER `tier`;
