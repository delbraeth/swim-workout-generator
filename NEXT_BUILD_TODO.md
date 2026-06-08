# iOS build status + next steps

**Build 15 in source (2026-06-08)** — 429-avoidance iOS: process-lifetime cache for
the STATIC workout-types + coach-targets (`GenerateCache`, cleared on Home
pull-to-refresh) so re-opening Generate fetches 0 (was 2/open); dropped the
redundant launch `auth/status` probe (me/bootstrap's 401 is the validator).
`swiftc -wmo` clean. CURRENT_PROJECT_VERSION 14→15.

**Build 14 SHIPPED to TestFlight 2026-06-08.** (Next archive = 15.)
Build 14 carries: B6 flag-gating, B7 offline cache, B8 deck/print, B9 Siri,
B14b HealthKit import, the critical `Bootstrap.featureFlags` build-unbreak, and
the security-audit iOS fixes (StoreKit appAccountToken binding, AuthManager
non-401 handling, Keychain WhenUnlocked, HealthKit "yds" unit).
(Build 12: B14 HealthKit write · Build 11: B1 race-pace + Learn-to-Swim.)

**Verify on-device when convenient:** one Sandbox purchase to exercise the new
IAP appAccountToken binding end-to-end; Siri "Generate a SetForge workout" shows
in Shortcuts; HealthKit import prompt on first use.

## ✅ Shipped in build 14 (TestFlight 2026-06-08) — Wave 3 native (B7, B8, B9, B14b) + B6 flag gating

### B7 — Offline cache MVP (Wave 3 "highest-leverage", scoped)
- **What it does**: persists the last successful `me/bootstrap` payload to
  Application Support (`BootstrapCache`, raw bytes, `.completeFileProtection`).
  On a failed/offline load, falls back to the cached payload so Home + recent /
  assigned workouts + history stay viewable — and **run mode already works
  offline** (it's local). Offline banner on Home; pull-to-refresh re-syncs.
- `APIClient.getData()` (raw GET, same auth + 429 backoff) feeds both decode +
  cache. `clearToken()` calls `BootstrapCache.clear()` → no history on a signed-out device.
- **NOT included**: on-device *generate* (needs a full Swift port of the JS engine
  — large, deferred) and queued run-logging (the app has no run-log write path;
  generated workouts are already saved at generate time, which itself needs the
  server). This MVP delivers the offline *read + run* resilience. `swiftc -parse` clean.

### B14b — HealthKit READ / import Apple-Watch swims (Wave 3; partial-Watch substitute)
- **No server change** — reuses `POST /api/log-workout`. Each Watch swim's id =
  its HealthKit UUID with hyphens stripped (32 hex chars, fits the id column), so
  the server's duplicate-id 409 IS the dedup; re-imports are counted "already in history".
- `HealthKitManager`: `requestReadAuth()` (workouts + distanceSwimming), `readRecentSwims()`
  (HKSampleQuery, .swimming, last 60d), `importRecentSwims(poolMode:)` → builds a minimal
  1×distance "main" block (distance converted to the pool unit), POSTs each, tallies
  imported/skipped/failed. `NSHealthShareUsageDescription` already in source (build 12).
- **UI**: "Import Apple Watch swims" button on HistoryView (shown when HealthKit available)
  + result alert; on success calls `onImported` → Home refreshes bootstrap.
- Closes B14 (write shipped build 12 · read now). `swiftc -parse` clean.

### B9 — Voice / Siri quick-generate (Wave 3 "if-only-three")
- **App Intents** (`Intents/`): `GenerateWorkoutIntent` (`openAppWhenRun`) +
  `WorkoutLength` AppEnum (short ~1500 / medium ~3000 / long ~4500) + `SetForgeShortcuts`
  provider with phrases ("Generate a SetForge workout", …). "Hey Siri" + Shortcuts-app ready.
- **Routing**: intent stamps `QuickGenerate.shared.pendingYards`; `HomeView` observes it,
  pushes `GenerateView(autoYards:)` via `navigationDestination`; GenerateView prefills the
  slider + auto-runs one generate after `loadTypes()`. Opens app (needs session+server),
  shows the result to run.
- `swiftc -parse` clean. **TODO at archive:** Siri/App-Intents need no entitlement, but
  verify the intent appears in Shortcuts on-device after first launch.

### B8 — Deck/present mode + AirPrint (Wave 3 "if-only-three")
- **Present mode** (`Views/PresentModeView.swift`): full-screen, giant-type, pure
  black/white (natatorium-glare legibility), one block per swipeable page, idle
  timer disabled so the screen never sleeps mid-set. AirPlay this to a deck TV.
- **AirPrint** (`Util/WorkoutPrint.swift`): one-page HTML lane sheet → `UIPrint​Interaction​Controller`
  (iPad presents from window-center rect; iPhone modal). No server round-trip.
- **Entry points**: "Present" + "Print" buttons on `WorkoutCard` (generate result,
  etc.) — read-only, available everywhere a workout renders.
- New files auto-included via the project's `PBXFileSystemSynchronizedRootGroup`
  (no pbxproj source edits). `swiftc -parse` clean.

### B6 — Phase-6 flag gating
- **Roll-call & coach-notes now respect team Visible-options flags.** `Bootstrap.swift`
  decodes the union `feature_flags` map (`featureFlags`, tolerant) + `flag(_:)` accessor
  (unset ⇒ ON, matching the web union default). Gated surfaces:
  - **Practices menu item** (HomeView) → hidden when `attendance` is off.
  - **Per-swimmer coach-notes button** (PracticeAttendanceSheet, threaded via
    `PracticesView(showNotes:)`) → hidden when `coach_notes` is off.
- **`generate-for` stays CORE** (board correction) — never gated.

CURRENT_PROJECT_VERSION 12→14 across both commits. `swiftc -parse` clean.

## ✅ Shipped in build 12 (TestFlight 2026-06-07) — B14 HealthKit write
- **Write completed swims to Apple Health.** `HealthKitManager.swift` + "Save to Apple
  Health" button on the run-finished card (`RunWorkoutView.swift`): an `HKWorkout(.swimming)`
  with distance (totalYards→meters) + duration (run elapsed) + lap length.
  Commits `461ef03` (feature) → `9858186` (await-autoclosure fix).
- **HealthKit setup landed in source** (`f6bc525` + `24bc365`): `com.apple.developer.healthkit`
  entitlement + `NSHealthUpdateUsageDescription` + `NSHealthShareUsageDescription` (both
  build configs). App ID HealthKit-enabled in the portal during the build.
- **Deferred (B14 read half):** auto-import Apple Watch–tracked swims (the partial Watch
  substitute) — share-usage string already in place for when it's built.

## ✅ Shipped in build 11 (TestFlight 2026-06-07)
- **B1 — race-pace + Learn-to-Swim in the iOS generator** (board's #1 iOS gap;
  `GenerateView.swift` + `GenerateModels.swift`, commit `ddd5f92`). `GenerateRequest`
  sends `racePace`/`raceEvent`/`usrpt`/`youthMode`; UI = 🏁 Race-pace control (toggle +
  event picker + USRPT) and a contextual 🧒 Learn-to-Swim toggle (lesson type).
  Closes Wave 0 of `docs/IMPLEMENTATION_PLAN_2026-06-06.md`.

**Broader iOS roadmap (sequenced) — build 12+:** `docs/IMPLEMENTATION_PLAN_2026-06-06.md` Workstream B —
after B1: B2 run/log hardening, B3 generate-for, B4 lane-plan view, B5 coach-notes;
then B-native (offline, deck/AirPrint, voice, HealthKit) + Phase-6 flag gating.
Other prior candidate: swimmer-dashboard parity (Phase 5 #2).

## ✅ Shipped in build 9 (uploaded to TestFlight)
Both items were committed on `build-3` and are now in a shipped build:

1. **managed_id String fix (iOS half)** — `RosterMember`/`AttendanceRecord`/
   `AttendanceMark`/`CoachNoteCreate`/`CoachNotesSheet` changed `Int?` → `String?`.
   Server half was already live; managed-swimmer coach notes / attendance / RSVP
   now work on build 9 (were broken on build 8).
2. **IAP client** — AppConfig.iapProductIDs filled, PaywallView reachable
   ("Upgrade to Coach" menu, free-tier only), StoreKitManager transaction listener
   at launch, double-pay /eligibility pre-check.

## ✅ Sandbox IAP test — PASSED (2026-06-02)
End-to-end on a real device: free-tier SetForge user → Upgrade to Coach →
sandbox purchase → `/api/billing/apple/verify` → tier flipped to coach. Products
LOADED fine, so the **In-App Purchase capability is NOT needed** (StoreKit 2 works
without it here). Confirmed login provider is independent of IAP (tested fine).

## ▶ Next action: IAP PRODUCTION prerequisites (see bottom) when ready to launch.

## ✅ Shipped in build 10 (LIVE on TestFlight 2026-06-04)
- **Person-menu Sections fix** (`HomeView.swift`, commit a56b041) — grouped the
  person menu into Workouts / Account sections with **Sign out** isolated in its
  own trailing section. Fixes Sign out scrolling out of view at large Dynamic Type.
  (The IAP-capability concern was already resolved — products loaded in sandbox.)

## To cut a future build (template)
```
sed -i '' 's/CURRENT_PROJECT_VERSION = 12;/CURRENT_PROJECT_VERSION = 13;/g' \
  ios-app/SetForgeApp.xcodeproj/project.pbxproj
git commit -am "iOS: bump build number to 13"
git push origin build-3
cd ios-app && xcodebuild -project SetForgeApp.xcodeproj -scheme SetForge \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath /tmp/SetForge.xcarchive archive
# verify: PlistBuddy CFBundleVersion == 10, then user uploads via Xcode Organizer
```

## Sandbox IAP test checklist (PASSED 2026-06-02 — kept for reference)
1. ASC → Users and Access → Sandbox → Testers → create one (email NOT tied to a
   real Apple ID).
2. Device Settings → App Store → Sandbox Account → sign in as tester.
3. App → menu → Upgrade to Coach → buy a plan.
4. Expect: purchase → POST /api/billing/apple/verify → tier granted →
   pull-to-refresh Home → billing.status = "coach" → coach surfaces appear.
5. Confirm server saw it: admin → GET /api/admin/billing/config →
   apple_iap.active true. (Double-pay: if the account has an active Stripe tier,
   the paywall blocks with a "manage on web" message — expected.)

## Don't forget for IAP PRODUCTION (not sandbox)
- Flip APPLE_IAP_CONFIG.environment "Sandbox" → "Production".
- ASC products fully complete (name/description/price/review-screenshot) + both in
  one subscription group.
- Apply migration 043 to prod DB (apple_iap_events idempotency table).
