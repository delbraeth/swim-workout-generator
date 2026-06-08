-- 055_person_external_ids_expiry.sql — Phase 5 #3 (MAAP/SafeSport), Slice A.
-- person_external_ids (mig 039) already stores per-person credential IDs
-- (currently only system='usa_swimming'). MAAP adds compliance credentials —
-- SafeSport certification + background-check — which carry an EXPIRY date.
-- Add a nullable expires_at so the UI can warn on expiring/expired certs.
-- (USA-Swimming Member IDs leave it NULL — they don't expire.) Display + warn
-- only for v1; no action is gated on expiry yet (decision 2026-06-06).
ALTER TABLE `person_external_ids`
  ADD COLUMN `expires_at` DATE NULL AFTER `external_id`;
