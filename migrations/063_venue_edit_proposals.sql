-- 063_venue_edit_proposals.sql — C4 venue field-edit moderation (Wave 4).
-- Venues are a UNIVERSAL catalog (mig 058): one team's home pool is another's
-- away venue, so a coach mustn't silently mutate a shared record. Instead a
-- coach proposes field corrections here; an admin approves (applies to `venues`)
-- or rejects. Archive (admin DELETE /api/venues/:id) already exists; this adds
-- the candidate→approved edit path reserved in scope §2 #4.
--
--   changes   JSON of edited venue fields (whitelist: name, indoor_outdoor,
--             course, timezone, latitude, longitude). Only changed keys present.
--   status    pending → approved|rejected (terminal). One review per proposal.
CREATE TABLE IF NOT EXISTS `venue_edit_proposals` (
  `id`              BIGINT AUTO_INCREMENT PRIMARY KEY,
  `venue_id`        VARCHAR(16)  NOT NULL,
  `proposed_by_sub` VARCHAR(255) NOT NULL,
  `changes`         JSON         NOT NULL,
  `note`            VARCHAR(280) NULL,
  `status`          ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `reviewed_by_sub` VARCHAR(255) NULL,
  `review_note`     VARCHAR(280) NULL,
  `created_at`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at`     TIMESTAMP NULL,
  INDEX `idx_status` (`status`, `created_at`),
  INDEX `idx_venue`  (`venue_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
