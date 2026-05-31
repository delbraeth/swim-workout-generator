# SetForge — iOS native client

A native SwiftUI iPhone app for [SetForge](https://setforge.io), the swim-workout
generator. It talks to the **same** Node/Express backend as the web app — no
backend changes required (`/api/auth/native` and Bearer auth already exist).

This is **Milestone 1: the auth + data spine** described in `API_INTEGRATION.md`:

> Sign in with Apple → `/api/auth/native` → store Bearer (Keychain) →
> `/api/me/bootstrap` → render the user, account summary, and recent workouts.

Getting this working proves the whole auth + data path before building out
generator/assignment screens.

## What's implemented

- **Sign in with Apple** (`AuthenticationServices`) with an optional **invite
  code** field (required only for brand-new accounts; the app is invite-only).
- **Token exchange** at `POST /api/auth/native`, session token stored in the
  **Keychain**, sent as `Authorization: Bearer <token>` on every request.
- **APIClient** with the guardrails from the integration doc:
  - No CSRF / origin headers on native requests (Bearer requests skip those by design).
  - **429 retry with exponential backoff** (honors `Retry-After`) for the
    platform's 30 req/min cap.
  - **401 handling** → wipes the dead token and bounces to sign-in.
- **Composite launch:** a single `GET /api/me/bootstrap` on the home screen —
  no mount-time fan-out (the rate-limit guardrail).
- **Section-aware workout rendering:** swim blocks (`sets[]`) and dryland blocks
  (`kind:"dryland"` + `exercises[]`, no `sets`) dispatched at the call site.
- **Device/session management:** list sessions, "sign out everywhere else"
  (`/api/auth/sessions`, `/api/auth/signout-all-others`), sign out
  (`/api/auth/signout`).
- Brand palette and the "target reticle" mark lifted from the web SPA.

## Project layout

```
SetForge-iOS/
  SetForgeApp.xcodeproj/          Xcode 16 project (file-system-synchronized group)
  SetForge/
    SetForgeApp.swift             App entry; owns AuthManager
    SetForge.entitlements         Sign in with Apple capability
    Config/AppConfig.swift        Base URL, rate-limit note, brand colors
    Networking/
      APIClient.swift             Bearer auth, 429 backoff, 401 handling
      APIError.swift              Typed errors (incl. invite_* reasons)
      AnyCodable.swift            Tolerant decoding for open-ended settings/flags
    Auth/
      KeychainStore.swift         Session-token storage
      AuthManager.swift           Sign-in state machine + token plumbing
    Models/
      User.swift                  Me + AuthSession
      Bootstrap.swift             The /api/me/bootstrap composite payload
      Workout.swift               blocks[] / SwimSet / DrylandExercise + pool modes
    Views/
      RootView.swift              Routes loading / signed-out / signed-in
      SignInView.swift            Sign in with Apple + invite code
      HomeView.swift              Bootstrap-driven dashboard
      WorkoutBlockView.swift      Swim + dryland block renderers
      SessionsView.swift          Device management
    Assets.xcassets/              AppIcon slot + AccentColor (#3B82F6)
```

## Building (requires a Mac + Xcode 16+)

1. Open `SetForge-iOS/SetForgeApp.xcodeproj` in Xcode 16 or later.
2. Select the **SetForge** target → **Signing & Capabilities**:
   - Set your **Team** (the `DEVELOPMENT_TEAM` build setting is intentionally blank).
   - Bundle ID is **`com.delbraeth.swimworkout`** — this must match the
     `APPLE_NATIVE_BUNDLE_ID` the prod backend expects (it's the Sign in with Apple
     token audience prod verifies). Don't change it unless you also change prod.
   - Confirm the **Sign in with Apple** capability is present (it ships in
     `SetForge.entitlements`).
3. Pick an iOS 17+ simulator or device and **Run**.

> The project uses Xcode 16's file-system-synchronized group, so new Swift files
> dropped into `SetForge/` are picked up automatically — no `.pbxproj` edits.

### Backend target

**Every build talks to production `https://setforge.io` by default** — the real
backend, DB, and Apple auth — so the app works out of the box with no setup. The
base URL resolves in `Config/AppConfig.swift`.

To point at a **local** `node server.js` instead, set a `SETFORGE_BASE_URL` scheme
environment variable (**Product → Scheme → Edit Scheme → Run → Arguments →
Environment Variables**) — no recompile:

- **Simulator:** `http://localhost:8080`. The Debug-only `Info-Debug.plist`
  whitelists insecure HTTP to localhost (`NSAppTransportSecurity`); Release has no
  such exception.
- **Physical device:** `localhost` is the *phone*, not your Mac — use your Mac's
  LAN IP, e.g. `http://192.168.1.42:8080`. (Insecure-HTTP to a raw IP needs its
  own ATS exception; prefer the Simulator for plain-HTTP local work.)

> Note: running the backend locally is non-trivial — the prod MariaDB is
> IP-allowlisted (unreachable off-host) and the repo has no base schema (only
> incremental migrations `026`→`049`). You'd need a DB tunnel or a local schema
> dump plus the Apple OAuth secrets. Pointing at prod avoids all of that.

## Verified shapes (mined from the web SPA, `public/index.html`)

- **bootstrap** keys: `me`, `workouts[]`, `favorites[]`, `disfavorites[]`,
  `favoriteSets[]`, `disfavorSets[]`, `effectiveFavorites{labels,set_ids,engine}`,
  `effectiveDisfavorites{…}`, `goals[]`, `sessions[]`, `pendingInvites[]`,
  `billing{status}`, `settings{…}`.
- **me**: `sub, email, email_verified, display_name, initials, dob, gender,
  grade, class_year, providers, usa_swimming_id, is_admin, support_role,
  created_at, last_login_at, workout_count, stats_by_pool`. Note `grade` and
  `class_year` are **numbers** (derived int grade / graduation year), not strings;
  `dob` is a `YYYY-MM-DD` string.
- **swim set**: `{ id, reps, dist, desc, interval, focus, eq? }`.
- **dryland exercise**: `{ name, sets, reps, rest }` — `reps`/`rest` are
  **free text** ("20 each way", "45s hold", `null`), decoded as strings.
- **session**: `{ id_prefix, user_agent, ip, last_seen_at, is_current }`.
- **pool modes**: `25y` (SCY), `25m` (SCM), `50m` (LCM), legacy `yds`.

Models are intentionally tolerant (optional fields, lenient decoding) — the SPA's
`applyBootstrap` guards every key and ignores malformed values, so we do too.

## Not in this milestone (next up)

- Workout **generator** UI (the engine lives in the SPA; the client renders /
  saves the `blocks[]` it produces via `POST /api/log-workout`).
- "Assigned to me" via `/api/scheduled-workouts/*`.
- Teams / managed-swimmers detail (composite endpoints), reports, billing portal.
