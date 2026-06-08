# SetForge

A single-page React app (served from `public/index.html`) backed by a small
Express + MariaDB server. Generates parameterized swim workouts across SCY /
SCM / LCM pool modes, runs them with a pace-clock UI, logs history with
goals / intensity zones / training-phase awareness, supports week-view
planning + coach-group fanout, and is invite-only multi-user via Sign in
with Apple.

Live at <https://setforge.io>. Runs on a Spaceship Hyperlift container;
MariaDB lives on a separate Spaceship Starlight VM managed by CyberPanel.

Repo working title is `swim-workout-generator` (predates the SetForge
rebrand; not renamed to avoid breaking deploy paths).

**Created by Patrick Cassidy (engineering) and Veronica Cassidy (coach &
swimmer — coaching/swimming domain design).**

## Layout

- `public/index.html` — the entire frontend (single-file React app).
- `public/manual.html` — user-facing manual; linked from the in-app `?` button.
- `public/privacy.html`, `public/terms.html` — legal pages.
- `server.js` — Express server (auth, API routes, static serving).
- `db.js` — MariaDB pool + query helpers.
- `migrations/` — numbered SQL migrations with matching rollbacks. See
  `migrations/README.md` for the apply procedure (phpMyAdmin or `docker compose`).

## Deploying

```sh
python3 _deploy.py "your commit message"
```

The script PUTs the deploy file list (`public/*.html`, `server.js`, `db.js`,
`package.json`, `Dockerfile`, `README.md`) directly to GitHub via the
contents API. Hyperlift watches the repo and rebuilds the container on push.

Checkpoints (for rollback) are tagged via `_checkpoint.py`:

```sh
python3 _checkpoint.py <tag-name> "description"
```

## Required env vars

Server reads these at startup:

- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — MariaDB connection.
- `APPLE_TEAM_ID`, `APPLE_CLIENT_ID`, `APPLE_NATIVE_BUNDLE_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` — Sign in with Apple.
- `APP_URL` — public HTTPS URL (default `https://setforge.io`).
- `PORT` — listen port (default 8080; Hyperlift sets this).
- `ALLOW_NO_ORIGIN` — `"true"` to permit Origin-less requests (local curl).

## See also

- [`ROADMAP.md`](./ROADMAP.md) — sessioned feature plan + shipped-item history.
- [`migrations/README.md`](./migrations/README.md) — DB migration apply procedure.
- [`public/manual.html`](./public/manual.html) — user-facing documentation.
