# CLAUDE.md — SetForge project context

> Auto-loaded by Claude Code. Distilled from accumulated working memory so a new
> session starts oriented. Source of truth for **open work** is `ROADMAP.md`.

## What this is
**SetForge** (domain **setforge.io**) — a swim-workout **generator** for the coach-on-deck-with-a-phone (1–30 swimmers) and solo/masters swimmers. Repo working title is "swim workout generator". Coaches pay, swimmers are free forever.
- **Pricing/tiers:** Free (swimmers) · Coach **$10/mo** + 14-day trial · (Program $25 gated, Lesson $5–7 TBD). Spec: `PRICING.md`.
- **Auth:** OAuth only — **Sign in with Apple + Google**. **No passwords, ever** (no email/password, no magic links by default). iOS native uses `POST /api/auth/native`.

## Architecture (know this before editing)
- **`public/index.html`** — the *entire* React SPA, ~28K lines, **transpiled in-browser by Babel** (`<script type="text/babel">`). No build step. Single file by design.
- **`server.js`** — Node/Express API (`/api/*`). **`db.js`** — MariaDB via the `mariadb` driver (`pool.query` returns rows directly, not `[rows]`).
- **`migrations/NNN_*.sql`** — schema changes, **applied by hand in phpMyAdmin** (not auto-run). Idempotent idioms: `ADD/DROP COLUMN IF EXISTS`, `ADD INDEX IF NOT EXISTS`.
- **`_deploy.py`** — the deploy mechanism (gitignored). Reads working-tree files and pushes them to the GitHub repo via the Contents API (Hyperlift auto-deploys on push). **It has an explicit `FILES` allowlist** — a file not in that list never deploys (this is why `changelog.html`/`about.html` went stale). It base64-encodes binaries. Migrations are NOT run by it.

## Verify before claiming done (no CI — these are the gates)
- `node --check server.js` and `node --check db.js` after JS edits.
- **Babel-parse `public/index.html`** after any JSX edit (syntax errors don't surface otherwise): extract the `<script type="text/babel">` block and `@babel/parser` parse it with the `jsx` plugin. A plain smoke/grep is NOT enough — JSX tag mistakes have shipped blank-white prod pages.
- `migrations/*.sql` → parse with `sqlglot` (read='mysql').
- **Generator engine changes:** `tools/_a1_verify.mjs` seeds `Math.random` and snapshots `generateWorkout` blocks across a config matrix — diff before/after to prove a refactor is byte-identical. Reuse it for any `generateWorkout` work.

## Hard-won guardrails — DO NOT REGRESS
- **DB collation = `utf8mb4_unicode_ci` everywhere.** New tables/cols must be unicode_ci. `DEFAULT CHARSET=utf8mb4` *alone* defaults columns to general_ci → errno 1267/150. Be explicit: `COLLATE=utf8mb4_unicode_ci` on CREATE, `CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` on string FK columns.
- **No FK into legacy INT-PK tables** (causes errno 150). Use BIGINT + INDEX + app-layer integrity (+ cron sweep). All migrations ≥026 follow this.
- **Stripe webhook raw body:** global `express.json()` MUST skip `/api/billing/webhook`, or signature verification breaks (per-route `express.raw()` needs the unparsed bytes).
- **Dockerfile COPY allowlist:** a new top-level dir needs its own `COPY` line in the SAME commit, or prod `ERR_MODULE_NOT_FOUND`.
- **Env vars capped at 20** on the host — consolidate (JSON blob / comma-list) before adding; surface the trade.
- **`_deploy.py` FILES allowlist:** if you add/edit a served file (a new page, an asset), add it to the allowlist or it won't deploy. Verify the footer `__BUILD_ID__` actually changes after deploy.
- **429s = Hyperlift platform limit: 30 requests/MINUTE, same across all tiers — can't be bought away.** NOT the in-app `writeLimiter`. A new view must NOT fan out many mount-time GETs — extend a composite (`/api/me/bootstrap`, `/api/teams/:id/detail`, `/api/managed-swimmers/:id/detail`) and seed panels from props. The `window.fetch` wrapper already retries 429 with backoff.
- **Identity:** `persons` table is the **sole** identity store (id/first/last/preferred/initials/dob/gender/class_year). Legacy name/dob/gender cols were dropped (migration 045). Display name via `displayNameInline()` over a persons JOIN.
- **Section model:** workouts are a generic `blocks[]` array. Swim blocks have `sets[]`; dryland blocks have `kind:"dryland"` + `exercises[]` (no sets). Any code iterating `block.sets` must guard `Array.isArray(b.sets)`. `validateLoggedEntry` (server) allows variable sections + dryland.

## Workflow quirks
- **Commits:** Cap'n's zsh stalls on multi-line `-m` with apostrophes/parens. Write `_COMMIT_MSG.txt` and `git commit -F _COMMIT_MSG.txt`. The sandbox can't unlink `.git/*.lock` or copy binaries in the mount — hand those commands to Cap'n.
- **Keep `ROADMAP.md` + `public/manual.html` fresh in the same commit as the code.** Grep code before trusting a doc's "shipped" claim.
- **Tone:** concise/direct, no sycophancy, ask when genuinely uncertain, pushback-for-quality welcome. No "goodnight"/sign-off phrases mid-session.
- **`bingo`** = update manual → deploy → update memory → checkpoint.

## Map of the docs
`ROADMAP.md` (open work) · `MAY_CODE_REVIEW.md` · `SECTION_MODEL_SCOPE.md` · `LOCATIONS_SCOPE.md` · `PRICING.md` · `IDENTITY_SCOPE.md` · `RELATIONSHIPS_SCOPE.md` · `API_INTEGRATION.md` (for the iOS client).
