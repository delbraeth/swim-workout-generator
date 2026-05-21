-- Migration 026 — Disfavorites
--
-- Per-user "disfavor" flag for bank labels. Mirrors the `favorites` table
-- exactly but with opposite semantics: disfavored labels get a 0.25× weight
-- in the bank picker (vs favorites' 3×). Mutually exclusive with favorites:
-- adding a label to either table removes it from the other (enforced at the
-- application layer in db.js / dbAddFavorite + dbAddDisfavorite).
--
-- Scope locked v1.2 — 2026-05-21:
--   * Fixed 0.25× weight (not configurable per-user)
--   * Label-level only (no set-level mirror yet)
--   * Bank picker only (engine output not affected in v1.2)
--   * Per-individual (no coach-group propagation)
--
-- NOTE on FK: original draft included a foreign key to `users(sub)` but ran
-- into MySQL errno 150 (column length mismatch — initial migration used
-- VARCHAR(255), but `users.sub` and `favorites.user_sub` are both
-- VARCHAR(64)). Even with matching length the FK isn't strictly required —
-- application enforces user_sub validity via auth middleware (no row
-- reaches dbAddDisfavorite without passing requireAuth), which is the
-- pattern `favorites` already follows.

CREATE TABLE IF NOT EXISTS `disfavorites` (
  `user_sub`   VARCHAR(64)  NOT NULL,
  `label`      VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_sub`, `label`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Index supports the common read pattern: list all disfavored labels for a
-- user, ordered by created_at. The PRIMARY KEY already covers (user_sub,
-- label) lookups, but a created_at index helps ORDER BY without a filesort.
CREATE INDEX `idx_disfavorites_user_created`
  ON `disfavorites` (`user_sub`, `created_at`);
