-- 050_team_code.sql — Phase 5 Slice A (export bridges) support.
-- Short team abbreviation/code for meet-entry exports (the Hy-Tek Meet Manager
-- "Team Name" column wants the abbreviation, not the full name). 1–6 chars,
-- alphanumeric; NULL until an owner sets it (the roster CSV falls back to the
-- full team name when unset).
ALTER TABLE `teams`
  ADD COLUMN `team_code` VARCHAR(6) NULL AFTER `name`;
