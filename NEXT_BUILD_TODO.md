# Next iOS Build (build 9) — what it must carry + how to ship

Quick-reference for the next time iOS gets built. Build number is at **8** in the
project file; the last UPLOADED TestFlight build is **8**. Next archive = **bump to 9**.

## What's already committed and waiting to ride build 9
These are on `build-3` (pushed) but NOT in any shipped build yet:

1. **managed_id String fix (iOS half)** — `RosterMember`/`AttendanceRecord`/
   `AttendanceMark`/`CoachNoteCreate`/`CoachNotesSheet` changed `Int?` → `String?`.
   Server half is ALREADY LIVE. Until build 9 ships, managed-swimmer coach notes /
   attendance / RSVP stay broken on build 8 (full-account swimmers fine).
2. **IAP client** — AppConfig.iapProductIDs filled, PaywallView reachable
   ("Upgrade to Coach" menu, free-tier only), StoreKitManager transaction listener
   at launch, double-pay /eligibility pre-check. (Was committed for build 8 too, so
   it's effectively the first build users can attempt a purchase on once installed.)

## To cut build 9
```
sed -i '' 's/CURRENT_PROJECT_VERSION = 8;/CURRENT_PROJECT_VERSION = 9;/g' \
  ios-app/SetForgeApp.xcodeproj/project.pbxproj
git commit -am "iOS: bump build number to 9"
git push origin build-3
cd ios-app && xcodebuild -project SetForgeApp.xcodeproj -scheme SetForge \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath /tmp/SetForge.xcarchive archive
# verify: PlistBuddy CFBundleVersion == 9, then user uploads via Xcode Organizer
```

## Possible build-10 trigger
- If sandbox IAP **products don't load** on the paywall → the In-App Purchase
  capability isn't in entitlements. Add in Xcode → target → Signing & Capabilities
  → **+ In-App Purchase**, re-archive as build 10.

## Sandbox IAP test checklist (after build 9 installs)
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
