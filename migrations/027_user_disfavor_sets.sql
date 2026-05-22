-- Migration 027 — User-level set disfavorites
--
-- Per-user "disfavor" flag keyed on the set-level `id` field (s_<base36>)
-- that tools/assign_set_ids.py injected into every bank set. Mirror of
-- user_favorite_sets but with opposite semantics in the picker — each
-- disfavored set inside an option multiplies pick weight by 0.25
-- (vs favorite-sets' 3× per match).
--
-- Mutex with user_favorite_sets enforced at the application layer
-- (db.js / dbAddDisfavorSet + dbAddFavoriteSet clear the opposite table).
--
-- Scope locked v1.5 — 2026-05-21:
--   * Fixed 0.25× per disfavored set inside an option
--   * Bank picker only (engine picker doesn't expose set_ids per-set)
--   * Per-individual (no coach-group propagation)
--   * NO UI in v1.5 — mirrors the existing user_favorite_sets which is
--     also API-only. Future catalog/coach views can wire the button.
--
-- VARCHAR(64) matches users.sub and user_favorite_sets.user_sub canonical
-- width. No explicit FK (favorites/disfavorites pattern relies on
-- application-level integrity via requireAuth middleware).

CREATE TABLE IF NOT EXISTS `user_disfavor_sets` (
  `user_sub`   VARCHAR(64) NOT NULL,
  `set_id`     VARCHAR(32) NOT NULL,
  `created_at` TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_sub`, `set_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Index for "list disfavored sets for user, ordered by when disfavored"
CREATE INDEX `idx_user_disfavor_sets_user_created`
  ON `user_disfavor_sets` (`user_sub`, `created_at`);
