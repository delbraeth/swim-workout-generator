# iOS build status + next steps

Build number is at **10**. **Build 10 LIVE on TestFlight 2026-06-04** (person-menu
Sections fix, commit a56b041 — Sign-out discoverability at large Dynamic Type). Next
archive = bump to 11.

No iOS changes are currently queued for build 11. Candidates when one is built: iOS
swimmer-dashboard parity (Phase 5 #2), or whatever the next iOS feature is.

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
sed -i '' 's/CURRENT_PROJECT_VERSION = 9;/CURRENT_PROJECT_VERSION = 10;/g' \
  ios-app/SetForgeApp.xcodeproj/project.pbxproj
git commit -am "iOS: bump build number to 10"
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
