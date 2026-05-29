-- Migration 043 — fix two "uniqueness via a status column" bugs found in
-- the May code review (2026-05-29). Both tables tried to enforce
-- "one active row" with a UNIQUE that includes a status/flag column,
-- which either broke re-activation (group_anchors) or was simply missing
-- (guardians). Both are fixed the same way: a STORED generated column
-- that holds the key ONLY for active rows and is NULL otherwise, with a
-- UNIQUE on that column. A UNIQUE index does not deduplicate NULLs, so
-- any number of inactive/removed history rows coexist while at most one
-- active row per key is allowed.
--
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS + ADD UNIQUE INDEX IF NOT EXISTS +
-- DROP INDEX IF EXISTS (same MariaDB idiom as migration 039). The
-- guardians dedup UPDATE is self-idempotent (no dup-active rows remain
-- after the first run). Apply manually after smoke per the usual flow.

-- ─────────────────────────────────────────────────────────────────────
-- Blocker 1 — group_anchors: UNIQUE(group_id, active) blocked the 2nd
-- re-anchor. dbSetGroupAnchor flips the current anchor to active=0 then
-- inserts a new active=1 row. On the second re-anchor the flip created a
-- second (group_id, 0) tuple, colliding with the first inactive row →
-- ER_DUP_ENTRY, so re-anchoring threw. Replace the composite unique with
-- an active-only generated key: NULL for inactive rows (unlimited audit
-- history), = group_id for the one active row.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE `group_anchors` DROP INDEX IF EXISTS `uq_one_active_per_group`;

ALTER TABLE `group_anchors`
  ADD COLUMN IF NOT EXISTS `active_group_key` VARCHAR(32)
    GENERATED ALWAYS AS (IF(`active` = 1, `group_id`, NULL)) STORED,
  ADD UNIQUE INDEX IF NOT EXISTS `uq_active_group` (`active_group_key`);

-- ─────────────────────────────────────────────────────────────────────
-- Blocker 2 — guardians: no UNIQUE on (swimmer_person_id,
-- guardian_person_id), so dbConsumePendingInvitesForUser's ER_DUP_ENTRY
-- "already linked" catch could never fire and a parent re-linking
-- accumulated duplicate active guardian rows. Add an active-only unique
-- the same way (removed_at IS NULL = active). A removed pair can be
-- re-added later because its old row's key goes NULL once removed_at set.
--
-- Dedup existing active duplicates first or ADD UNIQUE fails. Keep the
-- lowest-id active row per (swimmer, guardian); soft-delete the rest
-- (removed_at = NOW()) to preserve the audit trail.
-- ─────────────────────────────────────────────────────────────────────

UPDATE `guardians` g
JOIN (
  SELECT MIN(`id`) AS keep_id, `swimmer_person_id`, `guardian_person_id`
  FROM `guardians`
  WHERE `removed_at` IS NULL
  GROUP BY `swimmer_person_id`, `guardian_person_id`
  HAVING COUNT(*) > 1
) dup
  ON g.`swimmer_person_id`  = dup.`swimmer_person_id`
 AND g.`guardian_person_id` = dup.`guardian_person_id`
 AND g.`id` <> dup.`keep_id`
SET g.`removed_at` = NOW()
WHERE g.`removed_at` IS NULL;

ALTER TABLE `guardians`
  ADD COLUMN IF NOT EXISTS `active_pair_key` VARCHAR(40)
    GENERATED ALWAYS AS (IF(`removed_at` IS NULL,
      CONCAT(`swimmer_person_id`, '|', `guardian_person_id`), NULL)) STORED,
  ADD UNIQUE INDEX IF NOT EXISTS `uq_active_guardian_pair` (`active_pair_key`);
