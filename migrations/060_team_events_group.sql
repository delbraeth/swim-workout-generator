-- 060_team_events_group.sql — Wave 1 C3: group-level team events.
-- Per MEET_SCHEDULE_WEATHER_SCOPE.md §3.5: an event can target a single GROUP
-- (squad) instead of the whole team. NULL = whole-team (today's behavior, so
-- existing rows are unaffected). When set, only members of that group (plus team
-- coaches) see the event on their upcoming list.
--
-- group_id is the gr_xxx string id (matches `groups`.`id`); no hard FK (mirrors
-- the polymorphic/string-id pattern used elsewhere, e.g. group_anchors → team_events).
ALTER TABLE `team_events`
  ADD COLUMN `group_id` VARCHAR(16) NULL AFTER `team_id`;
