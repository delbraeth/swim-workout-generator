-- Migration 047 — Locations P2: person (home) addresses + guardian consent.
-- Per LOCATIONS_SCOPE.md. SENSITIVE: home addresses of minors are personal
-- data — access is enforced in the app layer (dbCanAccessPersonAddress):
-- self + guardians always; coaches-of-the-swimmer ONLY when the swimmer's
-- home_addr_coach_visible toggle is on (the "recorded consent" of decision 6).
-- Default-deny.
--
-- All unicode_ci (DB standard — see feedback-db-collation-unicode). person_id
-- joins persons (unicode_ci) so no collation mix.
--
-- IDEMPOTENT: CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS.

-- Many addresses per person (divorced/two-home households), one primary
-- (decision 2). Active-pair unique via a STORED generated column (NULL for
-- removed rows → re-add allowed; migration 043 precedent) so the same
-- address can't be linked twice while active.
-- IMPORTANT: person_id is explicitly utf8mb4_unicode_ci to match persons.id
-- (the FK target). `DEFAULT CHARSET=utf8mb4` alone defaults columns to the
-- charset's default collation (general_ci), which mismatches the unified
-- unicode_ci persons.id → FK errno 150. So set the collation explicitly on
-- both the table and the FK column.
CREATE TABLE IF NOT EXISTS `person_addresses` (
  `id`               BIGINT AUTO_INCREMENT PRIMARY KEY,
  `person_id`        VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `address_id`       BIGINT      NOT NULL,
  `kind`             ENUM('home','mailing','other') NOT NULL DEFAULT 'home',
  `is_primary`       TINYINT(1)  NOT NULL DEFAULT 1,
  `added_at`         TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `removed_at`       TIMESTAMP   NULL,
  `active_link_key`  BIGINT GENERATED ALWAYS AS (IF(`removed_at` IS NULL, `address_id`, NULL)) STORED,
  INDEX `idx_person_addr` (`person_id`, `removed_at`),
  UNIQUE KEY `uq_active_person_address` (`person_id`, `active_link_key`),
  FOREIGN KEY (`person_id`)  REFERENCES `persons`(`id`)   ON DELETE CASCADE,
  FOREIGN KEY (`address_id`) REFERENCES `addresses`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Guardian-controlled consent toggle (per swimmer). Default 0 = coaches
-- cannot see the home address. Set by a guardian or the swimmer themselves.
ALTER TABLE `persons`
  ADD COLUMN IF NOT EXISTS `home_addr_coach_visible` TINYINT(1) NOT NULL DEFAULT 0;
