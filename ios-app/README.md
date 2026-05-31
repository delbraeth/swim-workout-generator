# SetForge iOS

Native iOS client for [SetForge](https://setforge.io). This is **Milestone 1 —
auth + data spine**: everything needed to sign in with Apple, hold a session,
and load the user's core data from the existing Express backend. Workout
generation, the pace-clock runner, logging, and planning land in later
milestones.

## What's in milestone 1

- **Sign in with Apple (native)** → exchanges Apple's `identityToken` for a
  SetForge session token via `POST /api/auth/native`, invite-code aware.
- **Keychain-backed session** — the bearer token is stored in the Keychain
  (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`) and replayed as
  `Authorization: Bearer <token>` on every request.
- **Networking layer** — a small, typed `APIClient` + `SetForgeClient` facade
  with structured `APIError` handling (401 → re-auth, 403 → invite reasons,
  429 → rate limited, …).
- **Codable data spine** — models mirroring the server contract (`User`,
  `Workout`, `AppSettings`, `Goal`, `Bootstrap`) with a resilient
  `/api/me/bootstrap` decode that tolerates partial-section failures the way
  the server's own `_errors` field does.
- **Minimal signed-in UI** — a read-only Home screen that renders the
  bootstrapped profile, per-pool totals, and workout history to prove the whole
  round-trip works.

## Architecture

```
ios-app/
├── project.yml                  # XcodeGen spec → SetForge.xcodeproj
├── Packages/SetForgeKit/        # Foundation-only data spine (cross-platform, tested)
│   ├── Sources/SetForgeKit/
│   │   ├── Models/              # User, Workout, Settings, Bootstrap, enums, JSONValue
│   │   ├── Networking/          # APIClient, APIError, Endpoint, APIConfiguration
│   │   ├── Auth/                # TokenStore protocol + in-memory impl
│   │   └── SetForgeClient.swift # high-level typed endpoints + token lifecycle
│   └── Tests/SetForgeKitTests/  # model decode, request building, error mapping
└── SetForge/                    # iOS app target (UIKit/SwiftUI/Keychain/AppleID)
    ├── App/                     # @main entry + AppEnvironment (app state)
    ├── Auth/                    # KeychainTokenStore
    ├── Features/                # RootView, SignInView, HomeView
    └── Resources/               # Assets.xcassets
```

The split is deliberate: **`SetForgeKit` depends only on Foundation**, so it
compiles and tests on any platform (including Linux CI) with `swift test`. The
iOS-only frameworks — `AuthenticationServices` (Sign in with Apple) and
`Security` (Keychain) — live in the app target, which conforms the package's
`TokenStore` protocol to the Keychain.

## Building

The Xcode project is generated from `project.yml` (so we don't commit a
merge-hostile `.pbxproj`).

```sh
brew install xcodegen          # one-time
cd ios-app
xcodegen generate
open SetForge.xcodeproj
```

Then in Xcode → **Signing & Capabilities**, select your Apple Developer team.
"Sign in with Apple" is already declared in `SetForge/SetForge.entitlements`;
it requires a paid Developer account to sign and run on device.

**No XcodeGen?** Create a new iOS App target in Xcode (SwiftUI lifecycle, bundle
id `io.setforge.app`), drag in the `SetForge/` sources, add the local package at
`Packages/SetForgeKit` (File → Add Package Dependencies → Add Local…), set the
entitlements file, and enable the Sign in with Apple capability.

### Running the package tests

```sh
cd ios-app/Packages/SetForgeKit
swift test
```

These cover model decoding against fixture JSON, bearer-header/auth request
construction, HTTP status → `APIError` mapping, and the sign-in token lifecycle
— all without a live server (via a `URLProtocol` mock).

## Server / backend configuration

The app talks to the contract already implemented in `../server.js`. Relevant
server env vars (see the repo root `README.md`):

- `APPLE_NATIVE_BUNDLE_ID` — **must equal this app's bundle id** (`io.setforge.app`,
  or whatever you ship). The server uses it as the expected audience when
  verifying the native `identityToken`. Falls back to `APPLE_CLIENT_ID` if unset.
- `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` — Sign in with Apple.
- `APP_URL` — default `https://setforge.io`, the client's default base URL.

To point the app at a different backend (e.g. staging or a local tunnel),
construct `AppEnvironment` with a custom `APIConfiguration(baseURL:)`.

## Endpoints used (milestone 1)

| Purpose | Method & path | Auth |
| --- | --- | --- |
| Native sign-in | `POST /api/auth/native` | none (returns token) |
| Profile + rollups | `GET /api/me` | Bearer |
| Launch bootstrap | `GET /api/me/bootstrap` | Bearer |
| Workout history | `GET /api/workouts` | Bearer |
| Active sessions | `GET /api/auth/sessions` | Bearer |

Bearer-token requests are CSRF- and Origin-exempt on the server, so no CSRF
token or `Origin` header is sent. Sessions last 30 days; a `401` anywhere drops
the local token and returns the user to sign-in.

## Not yet implemented (later milestones)

Workout generation, the pace-clock runner, logging/editing
(`POST /api/log-workout`, `PATCH/DELETE /api/workouts/:id`), settings editing,
favorites/disfavorites, goals, week-view planning, and coach fanout. The
`LogWorkoutRequest` / `WorkoutPatch` request models are already defined in
`SetForgeKit` to make those a small lift.
