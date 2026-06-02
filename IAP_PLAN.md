# Apple In-App Purchase — Activation Plan

Status: **scaffolded, inert.** All the code below ships safely with IAP off.
Nothing activates until the env var + App Store Connect products + the Apple
server library are in place. Web billing (Stripe) is unchanged.

## Why this exists
App Store policy requires Apple IAP for digital subscriptions purchased **inside
the iOS app**. You can't route iOS users to Stripe/web checkout for it. So iOS
gets IAP; web keeps Stripe. Both resolve to the same entitlement seam:
`users.tier` written by `grantTier`/`revokeTier`. `tier_source` records which
channel (`stripe_sub_*` vs `apple_iap_*`).

## What's already built (this scaffold)

| Piece | File | State |
|---|---|---|
| DB schema | `migrations/043_apple_iap.sql` | written — **apply to prod manually** (no auto-runner) |
| Server IAP module | `lib/appleIap.js` | inert until `APPLE_IAP_CONFIG` set + Apple lib installed |
| Verify route | `POST /api/billing/apple/verify` (server.js) | 503 until active |
| Notify webhook | `POST /api/billing/apple/notify` (server.js) | acks+drops until active; raw-body wired |
| Admin visibility | `GET /api/admin/billing/config` now returns `{ stripe, apple_iap }` | live |
| iOS product config | `AppConfig.iapProductIDs` ( `[:]` ) | empty ⇒ paywall inert |
| iOS purchase manager | `Billing/StoreKitManager.swift` | inert with no products |
| iOS paywall | `Views/PaywallView.swift` | shows "not available here" until configured |

The seam: `StoreKitManager.purchase()` → `POST /api/billing/apple/verify` →
`verifyTransaction()` (Apple lib) → `applyVerifiedTransaction()` → `grantTier()`.
Renewals/cancels/refunds arrive server-to-server at `/apple/notify` →
`processNotification()` → same `grantTier`/`revokeTier`.

## Activation checklist (when ready to monetize on iOS)

### 1. App Store Connect
- [ ] Paid Apps agreement signed; banking + tax forms complete (blocks all IAP).
- [ ] Create **auto-renewable subscription** products in a subscription group, e.g.:
  - `com.delbraeth.swimworkout.coach.monthly` → tier `coach`
  - `com.delbraeth.swimworkout.program.yearly` → tier `program`
  - Match the **web pricing** intent ($10/mo coach, $300/yr program) — note IAP
    prices use Apple's price tiers and Apple takes 15–30%.
- [ ] Create an **App Store Connect API key** (.p8) for the App Store Server API
  (Users & Access → Integrations → In-App Purchase key). Note issuer id + key id.
- [ ] Set the **App Store Server Notifications V2** URL to
  `https://setforge.io/api/billing/apple/notify` (Production + Sandbox).

### 2. Server
- [ ] `npm install @apple/app-store-server-library` (add to package.json; the
  module's dynamic import stays inert until installed).
- [ ] Set Hyperlift env `APPLE_IAP_CONFIG` (single JSON blob, mirrors STRIPE_CONFIG):
  ```json
  {"bundle_id":"com.delbraeth.swimworkout","issuer_id":"...","key_id":"...",
   "private_key":"-----BEGIN PRIVATE KEY-----\n...","environment":"Production",
   "product_tier_map":{"com.delbraeth.swimworkout.coach.monthly":"coach",
                       "com.delbraeth.swimworkout.program.yearly":"program"}}
  ```
- [ ] Apply `migrations/043_apple_iap.sql` to prod (manual, like 038–042).
- [ ] Wire the two `ACTIVATION TODO` blocks in `lib/appleIap.js`:
  - `verifyTransaction()` — `SignedDataVerifier.verifyAndDecodeTransaction(jws)`
  - `processNotification()` — `verifyAndDecodeNotification()` →
    `verifyAndDecodeTransaction()` → `resolveUserByOriginalTxn()` →
    `applyVerifiedTransaction()`.
  - Idempotency: insert the real `notificationUUID` into `apple_iap_events`
    (mirror the Stripe webhook's dup-check), then dispatch.
- [ ] Load Apple root CAs for `SignedDataVerifier` (bundle them or fetch once).

### 3. iOS
- [ ] Add the **In-App Purchase** capability to the target in Xcode.
- [ ] Fill `AppConfig.iapProductIDs` with the real product ids → tier map
  (must match `product_tier_map` above).
- [ ] Call `StoreKitManager.listenForTransactions()` once at app launch
  (e.g. in `SetForgeApp`) so renewals/refunds sync without a relaunch.
- [ ] Surface the paywall: present `PaywallView()` from an "Upgrade" affordance
  (e.g. when a free user taps a coach-gated feature). Gate the affordance on
  `me.tier != "coach"/"program"` once tier is read client-side (see below).
- [ ] Read entitlement from the server, NOT StoreKit: decode `me.tier` (or
  `bootstrap.billing.status`) and gate UI on it. (Currently iOS only decodes
  `billing.status`; add `tier` to `Me` if you gate features by tier on iOS.)

### 4. Test (sandbox)
- [ ] Create a Sandbox tester in App Store Connect.
- [ ] Set `environment:"Sandbox"` in `APPLE_IAP_CONFIG` for a staging pass.
- [ ] Verify: purchase → `/verify` grants tier → bootstrap reflects it; cancel
  in sandbox → notification revokes; restore re-grants.

## Stripe ↔ IAP coexistence (decided: both active, same tier) — DONE
- Web → Stripe, iOS → Apple IAP. Both write `users.tier`; `tier_source` tags the
  channel. Entitlement is idempotent (tier is tier).
- **Double-pay guard — IMPLEMENTED** (read-only off `tier_source`; `channelForSource`
  + `checkCrossChannel` in `lib/appleIap.js`, 9/9 matrix tested):
  - **Stripe checkout** (`POST /api/billing/checkout`): if an active Apple IAP sub
    exists → **409 `already_subscribed_other_channel`**, before any Stripe session.
  - **iOS pre-purchase** (`GET /api/billing/apple/eligibility`): the paywall calls
    this before StoreKit charges; active Stripe sub → `eligible:false` and the buy
    aborts client-side (StoreKitManager.purchase → crossChannelBlockMessage).
  - **Apple verify backstop** (`POST /api/billing/apple/verify`): if Apple already
    charged while Stripe active, we still GRANT (never take money + deny), but return
    a `warning` + audit `billing.double_pay.detected` so the redundant Stripe sub can
    be cancelled.
  - Same-channel renewals/restores never block; comped (`admin_*`) never blocks.

## App Review gotchas
- iOS must **not** show or link to Stripe/web checkout for the purchase. The
  paywall copy already avoids this; keep it that way.
- Provide a **Restore Purchases** control (PaywallView has one).
- Subscription metadata (price, length, auto-renew terms) + links to Terms and
  Privacy must be visible on the paywall before purchase.
- Account-bound entitlement (Sign in with Apple) is fine; just ensure restore
  works across devices via `Transaction.currentEntitlements`.
