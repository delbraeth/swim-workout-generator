# iOS build status + next steps

Build number is at **10** in the project file. **Build 10 ARCHIVED 2026-06-03**
(`/tmp/SetForge.xcarchive`, CFBundleVersion=10, ARCHIVE SUCCEEDED) — **pending
upload via Xcode Organizer** (needs Apple ID/2FA). Last uploaded TestFlight build
is 9. Build 10 carries the person-menu Sections fix (commit a56b041, Sign-out
discoverability). Next archive = bump to 11.

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

## 🅱 Waiting to ride build 10 (committed on `build-3`, NOT in build 9)
- **Person-menu Sections fix** (`HomeView.swift`, commit a56b041) — grouped the
  person menu into Workouts / Account sections with **Sign out** isolated in its
  own trailing section. Fixes Sign out scrolling out of view at large Dynamic Type.
  Build verified. (Batched per user — ship with build 10.)
- This is now the ONLY thing build 10 must carry (the IAP-capability concern is
  resolved — products loaded in sandbox). Cut build 10 whenever convenient.

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
