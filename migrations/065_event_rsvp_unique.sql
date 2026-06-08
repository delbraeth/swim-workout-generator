-- 065_event_rsvp_unique.sql — data-integrity (security audit 2026-06-08).
-- event_rsvp had NO unique key, and dbSetRsvp did a non-transactional
-- check-then-insert, so two near-simultaneous responses (mobile double-tap,
-- retry, or coach+swimmer at once) could both insert → duplicate rows, which
-- dbGetRsvpSummary then double-counts and dbGetMyRsvp resolves arbitrarily.
--
-- Step 1: dedupe existing rows, keeping the lowest id per logical key. `<=>` is
-- the NULL-safe equal so the polymorphic swimmer_sub/managed_id (XOR, one NULL)
-- compares correctly. Step 2: add the UNIQUE keys that make dbSetRsvp's new
-- INSERT … ON DUPLICATE KEY UPDATE atomic. UNIQUE permits multiple NULLs in
-- MariaDB, so the swimmer-key ignores managed rows (swimmer_sub NULL) and vice
-- versa — exactly what the XOR model needs.

DELETE er FROM `event_rsvp` er
JOIN `event_rsvp` keep
  ON  er.`target_kind` = keep.`target_kind`
  AND er.`target_id`   = keep.`target_id`
  AND er.`swimmer_sub` <=> keep.`swimmer_sub`
  AND er.`managed_id`  <=> keep.`managed_id`
  AND er.`id` > keep.`id`;

ALTER TABLE `event_rsvp`
  ADD UNIQUE KEY `uk_rsvp_swimmer` (`target_kind`, `target_id`, `swimmer_sub`),
  ADD UNIQUE KEY `uk_rsvp_managed` (`target_kind`, `target_id`, `managed_id`);
