-- Migration 039 — identity persons + guardians + contact methods + external IDs
-- (Phase 4 / Identity refactor — Phase I-A of 8)
--
-- Per IDENTITY_SCOPE.md §3 + §7. I-A is schema-only: creates the new
-- tables + adds nullable person_id to users + coach_managed_swimmers.
-- No backfill, no FK enforcement on the new person_id columns yet.
-- I-B backfills persons rows + populates person_id. I-C flips NOT NULL.
--
-- Forks resolved with Cap'n 2026-05-26:
--   - Table name `guardians` (not swimmer_parents); UI label "Parent / Guardian"
--   - person_external_ids included v1 (empty at launch; MAAP populates later)
--   - Display order resolved at I-D (computed display_name helper)
--   - Two-deep enforcement deferred to MAAP era; not in this migration
--
-- Schema notes:
--   - persons.id = px_<base36> per existing ID convention (locked decision 10).
--     Generation happens in app layer at I-B (genPersonId in db.js).
--   - All FKs WITHIN this migration are type-matched and allowed:
--       guardians.swimmer_person_id  → persons.id  (VARCHAR(16))
--       guardians.guardian_person_id → persons.id  (VARCHAR(16))
--       parent_contact_methods.guardian_person_id → persons.id
--       person_external_ids.person_id → persons.id
--   - users.person_id + coach_managed_swimmers.person_id are added as
--     plain nullable VARCHAR(16) WITHOUT FK constraint in I-A. FK + NOT
--     NULL gets enforced in I-C after I-B backfill verifies clean.
--   - gender stays VARCHAR(40) matching app-layer GENDER_VALUES
--     validation (db.js line 752). No DB-side ENUM to keep maintenance
--     simple when values change.
--   - tombstoned_at NULL = active. NOT NULL = anonymized per scope §3.C.
--     I-G adds the tombstone helpers; column lands here for forward compat.
--
-- IDEMPOTENT: every CREATE uses IF NOT EXISTS; every ALTER uses ADD COLUMN
-- IF NOT EXISTS + ADD INDEX IF NOT EXISTS. Safe to re-run.

-- ── persons: normalized identity ────────────────────────────────────
CREATE TABLE IF NOT EXISTS `persons` (
  `id`              VARCHAR(16) PRIMARY KEY,           -- px_<base36>
  `first_name`      VARCHAR(80) NOT NULL,
  `last_name`       VARCHAR(80) NOT NULL,
  `preferred_name`  VARCHAR(80) NULL,                  -- overrides first_name in UI when set
  `initials`        VARCHAR(8)  NULL,                  -- computed default = first[0]+last[0]; overridable
  `dob`             DATE        NULL,                  -- required for minors at app layer
  `gender`          VARCHAR(40) NULL,                  -- matches users.gender app-layer enum
  `pronouns`        VARCHAR(40) NULL,                  -- self-edit, coach-visible per fork 6 (TBD I-D)
  `created_at`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `tombstoned_at`   TIMESTAMP NULL,                    -- I-G populates; NULL = active
  INDEX `idx_last_first` (`last_name`, `first_name`),  -- locked decision 14: sort by last, first
  INDEX `idx_tombstone`  (`tombstoned_at`)
) ENGINE=InnoDB;

-- ── guardians: swimmer ↔ guardian M:N relation ──────────────────────
-- Schema name `guardians` per Cap'n fork-4 decision 2026-05-26. UI
-- label is "Parent / Guardian" everywhere user-facing. Covers parents,
-- grandparents, foster, kinship care, court-appointed guardians.
--
-- M:N relation: same swimmer can have multiple guardians (divorced
-- families, grandparents-as-secondary); same guardian can be on
-- multiple swimmers (siblings).
--
-- `added_by_sub` → users.sub (coach who added the guardian). No FK
-- constraint to users(sub) here to allow coach account deletion
-- without orphaning the guardian record (audit-log-style preserve);
-- app layer dereferences with LEFT JOIN.
CREATE TABLE IF NOT EXISTS `guardians` (
  `id`                  BIGINT AUTO_INCREMENT PRIMARY KEY,
  `swimmer_person_id`   VARCHAR(16) NOT NULL,
  `guardian_person_id`  VARCHAR(16) NOT NULL,
  `relationship`        ENUM('mother','father','guardian','grandparent','stepparent','foster','other') NOT NULL,
  `is_primary_contact`  TINYINT(1) NOT NULL DEFAULT 0,
  `has_pickup_auth`     TINYINT(1) NOT NULL DEFAULT 0,
  `has_emergency_auth`  TINYINT(1) NOT NULL DEFAULT 0,
  `added_at`            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `added_by_sub`        VARCHAR(255) NULL,
  `removed_at`          TIMESTAMP NULL,
  INDEX `idx_swimmer`  (`swimmer_person_id`,  `removed_at`),
  INDEX `idx_guardian` (`guardian_person_id`, `removed_at`),
  FOREIGN KEY (`swimmer_person_id`)  REFERENCES `persons`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`guardian_person_id`) REFERENCES `persons`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── parent_contact_methods: how to reach a guardian ─────────────────
-- Supports tier-up over time per locked decision 6:
--   day 1                  → method='email'             (free-text address)
--   email-infra-ships day  → method='email' + verify    (magic-link verification flow)
--   google-OAuth-ships day → method='parent_login_sub'  (value = users.sub of OAuth-linked
--                                                       parent account; verified_at = OAuth callback time)
--   future SMS day         → method='sms'               (E.164 phone number)
--
-- No FK on `value` because it's polymorphic — email address / phone /
-- users.sub depending on `method`. App layer enforces format per method.
CREATE TABLE IF NOT EXISTS `parent_contact_methods` (
  `id`                 BIGINT AUTO_INCREMENT PRIMARY KEY,
  `guardian_person_id` VARCHAR(16) NOT NULL,
  `method`             ENUM('email','sms','parent_login_sub') NOT NULL,
  `value`              VARCHAR(255) NOT NULL,
  `is_preferred`       TINYINT(1) NOT NULL DEFAULT 0,
  `verified_at`        TIMESTAMP NULL,
  `added_at`           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_guardian` (`guardian_person_id`),
  INDEX `idx_method_value` (`method`, `value`),
  FOREIGN KEY (`guardian_person_id`) REFERENCES `persons`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── person_external_ids: future MAAP / compliance system IDs ────────
-- Included v1 per Cap'n fork-5 decision 2026-05-26. Empty at I-A launch;
-- populated by future MAAP pack work for USA-S Member ID, SafeSport cert
-- ID, background-check ID, etc. UNIQUE (person_id, system) means one ID
-- per system per person. `external_id` itself isn't UNIQUE (two people
-- can theoretically share an ID across different systems).
--
-- `system` is free-text VARCHAR rather than ENUM so MAAP can add
-- arbitrary registries without a schema migration.
CREATE TABLE IF NOT EXISTS `person_external_ids` (
  `id`           BIGINT AUTO_INCREMENT PRIMARY KEY,
  `person_id`    VARCHAR(16) NOT NULL,
  `system`       VARCHAR(64) NOT NULL,
  `external_id`  VARCHAR(255) NOT NULL,
  `added_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `verified_at`  TIMESTAMP NULL,
  UNIQUE KEY `uk_person_system` (`person_id`, `system`),
  INDEX `idx_system_id` (`system`, `external_id`),
  FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── users.person_id: nullable FK column (no constraint yet) ─────────
-- I-A adds the column nullable. I-B backfills (creates persons rows
-- from existing users.display_name/dob/gender, populates person_id).
-- I-C flips to NOT NULL + adds FK constraint after backfill verifies.
-- Order matters because adding a FK on a NULL column with no matching
-- persons rows would fail.
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `person_id` VARCHAR(16) NULL AFTER `email_verified`,
  ADD INDEX IF NOT EXISTS `idx_users_person_id` (`person_id`);

-- ── coach_managed_swimmers.person_id: same pattern ──────────────────
ALTER TABLE `coach_managed_swimmers`
  ADD COLUMN IF NOT EXISTS `person_id` VARCHAR(16) NULL,
  ADD INDEX IF NOT EXISTS `idx_cms_person_id` (`person_id`);
