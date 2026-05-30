# API Integration — SetForge backend (for the iOS native client)

The native app talks to the **same** Node/Express backend as the web app
(`server.js`). This doc is what the iOS client needs; it does **not** require any
backend changes — `/api/auth/native` and Bearer auth already exist.

- **Base URL:** `https://setforge.io`
- **Transport:** JSON over HTTPS. Responses are JSON; errors are `{ "error": "..." }` with a 4xx/5xx status.

## Authentication (native) — the whole flow

No passwords. Sign in with Apple on-device, exchange the identity token for a
session token, then send that token as a Bearer header on every request.

1. **Sign in with Apple** (`ASAuthorizationAppleIDProvider`) → get the
   `identityToken` (JWT, as a UTF-8 string).
2. **Exchange it:**
   ```
   POST /api/auth/native
   Content-Type: application/json
   { "identityToken": "<apple identity token>", "inviteCode": "<CODE>"? }
   ```
   - `inviteCode` is **required for a brand-new account** (the app is invite-only); omit it for returning users. A bad/expired/used invite returns `403 {"error":"invite_<reason>"}`.
   - **Success:** `200 { "ok": true, "token": "<session token>" }`.
3. **Store the token** (Keychain) and send it on every subsequent request:
   ```
   Authorization: Bearer <session token>
   ```

`requireAuth` resolves the Bearer token to an active session (the web app uses a
`swim_session` cookie instead; same backend, either works).

### Native requests skip CSRF and origin checks — by design
`checkOrigin` and `requireCsrf` both **early-return when an `Authorization: Bearer`
header is present** (a Bearer request can't be a browser CSRF). So the iOS client:
- does **not** call `/api/auth/csrf`,
- does **not** send `X-CSRF-Token`,
- does **not** need an `Origin` header.
Just send the Bearer token on reads and writes alike. (CSRF/origin only protect the cookie-based web path.)

### Session lifecycle
- `GET  /api/auth/status` — is the current token valid? (cheap check)
- `GET  /api/auth/sessions` — list this user's active sessions (device management UI).
- `POST /api/auth/signout-all-others` — revoke every session except this one.
- `GET  /api/auth/signout` — revoke the current session.
- On `401 {"error":"not authenticated"}`, the token is dead → re-run the sign-in flow.

## Launch sequence — use the composite, don't fan out
On launch, call **`GET /api/me/bootstrap`** — one request that returns the user +
favorites + disfavorites + effective sets + settings + flags in a single payload.

> **Rate limit (critical):** the host (Hyperlift) caps at **30 requests per minute**,
> identical on every tier — it can't be raised. **Do not fire many parallel `/api/*`
> calls on a screen.** Prefer the composite endpoints, cache reads, and **retry 429s
> with exponential backoff** (the web client wraps `fetch` to do exactly this). Other
> composites: `GET /api/teams/:id/detail`, `GET /api/managed-swimmers/:id/detail`.

## API surface (by area — read `server.js` for exact shapes)
| Area | Prefix | Notes |
|---|---|---|
| Auth/session | `/api/auth/*` | native sign-in, status, csrf (web only), sessions |
| Me / bootstrap | `/api/me/*` | `bootstrap`, profile `GET/PATCH /api/me`, `/api/me/team-defaults` |
| Workouts | `/api/log-workout`, `/api/workouts/*`, `/api/scheduled-workouts/*` | save a completed workout; the week/intent planner |
| Teams / groups | `/api/teams/*` (27), `/api/groups/*` (20) | coach org model; `/teams/:id/detail` composite |
| Managed swimmers | `/api/managed-swimmers/*` (9) | coach-managed profiles; `:id/detail` composite |
| Swimmers / parents | `/api/swimmers/*`, `/api/parent/*`, `/api/parent-invites/*`, `/api/guardians/*` | parent portal, addresses, household |
| Curation | `/api/favorites`, `/api/disfavorites`, `/api/favorite-sets`, `/api/disfavor-sets`, `/api/effective-*` | per-user + coach-propagated |
| Reports | `/api/reports/*` (6) | coach/solo/admin reports |
| Billing | `/api/billing/*` | Stripe checkout/portal/webhook (web) |
| Bank/catalog | `/api/bank-options/*`, `/api/bank`, `/api/picker/*` | set bank + UGC overlay |
| Misc | `/api/goals`, `/api/benchmarks`, `/api/coach-notes`, `/api/swimmer-constraints`, `/api/lane-plans`, `/api/events`, `/api/feedback` | |
| Admin | `/api/admin/*` (22) | admin-gated |

## Payload notes the client must handle
- **Workout = `blocks[]`.** Swim blocks have `sets[]` (`{reps,dist,desc,interval,focus,eq?}`); **dryland blocks** have `kind:"dryland"` + `exercises[]` (`{name,sets,reps,rest}`) and **no `sets`** — guard for that when rendering/saving. `totalYards` excludes dryland.
- **Saving a workout** (`POST /api/log-workout`): the entry's `blocks` may be a variable count (sections can be skipped) and may include dryland blocks; the server validator requires a non-empty list with exactly one `main` section. Don't assume 4 fixed sections.
- **Pool modes:** `25y` (SCY) · `25m` (SCM) · `50m` (LCM).
- **Identity:** display names come from the server already-resolved; don't expect raw name columns.

## Auth-related env on the backend (for whoever runs it)
- Apple/Google OAuth creds, `STRIPE_CONFIG`, `ALLOW_NO_ORIGIN` (web edge cases only). Native auth needs the Apple identity-token verification path live (it already is — `/api/auth/native`, used by TestFlight today).

## First iOS milestone (suggested)
Sign in with Apple → `/api/auth/native` → store Bearer → `/api/me/bootstrap` →
render the generator and "Assigned to me". That proves the whole auth + data spine
before building out screens. Reuse the workout `blocks[]` model from the web client
as your view model.
