-- 056_push_subscriptions.sql — Web Push infrastructure (foundational unlock).
-- Stores a user's Web Push subscriptions (one row per browser/endpoint). The
-- notify half of RSVP / cancellation / weather / social all enqueue against this.
-- v1 is Web Push (VAPID) only; an APNs device-token column can be added later.
-- Minor-safety: the subscribe route refuses minors (server-authoritative), so
-- minors never get rows here — mirrors the email/Discord minor-bypass stance.
CREATE TABLE IF NOT EXISTS `push_subscriptions` (
  `id`           BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_sub`     VARCHAR(255) NOT NULL,
  `endpoint`     VARCHAR(512) NOT NULL,
  `p256dh`       VARCHAR(255) NOT NULL,
  `auth`         VARCHAR(255) NOT NULL,
  `platform`     VARCHAR(32)  NULL,
  `user_agent`   VARCHAR(255) NULL,
  `created_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_seen_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_endpoint` (`endpoint`),
  INDEX `idx_user` (`user_sub`)
) ENGINE=InnoDB;
