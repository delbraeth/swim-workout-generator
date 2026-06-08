-- 052_team_event_kind.sql — Phase 5: event `kind` tag pulled from
-- MEET_SCHEDULE_WEATHER_SCOPE.md §3 (ahead of Slice B). Categorizes team events
-- (meet / picture day / banquet / meeting / fundraiser / travel / social / other).
-- DEFAULT 'meet' because team_events was meet-only until now, so existing rows are
-- meets. Only kind='meet' is eligible as a group-anchor/taper anchor (enforced in
-- app code, not the schema).
ALTER TABLE `team_events`
  ADD COLUMN `kind` ENUM('meet','picture_day','team_meal','team_meeting','fundraiser','travel','social','other')
    NOT NULL DEFAULT 'meet' AFTER `name`;
