# Billing Thin Slice — scope

**Status:** scope-only (2026-05-26). Implementation lives in PHASED_PLAN §3 Phase 3 — "First paying HS coach can sign, pay, and stick." Triggers the day-of-first-billing changes to ToS/privacy from `BILLING_THRESHOLD_CHANGES.md`.

**Pattern source:** none — first paid feature in SetForge. Sub-processor list will gain Stripe as a new active vendor.

---

## 1. Why

SetForge has never charged anyone. The pricing model is locked (Free / Coach $10/mo / Lesson $5-7/mo TBD / Program $25/mo or $300/yr) and the public pricing page describes it, but no code exists to take a payment, grant a tier, or revoke on lapse. Until that's true, the "Implementation triggers on first paying pilot" stance in pricing memory remains a future tense.

Phase 3's exit criterion is "first paying HS coach signs, pays, and sticks." All three verbs need code:

- **Signs** — Coach taps an "Upgrade" button → goes to Stripe Checkout → returns paid
- **Pays** — Stripe processes the card, holds the recurring subscription, retries on decline
- **Sticks** — Their coach-tier features keep working week after week without operator intervention

The "thin slice" is the minimum viable path to that end-state. It explicitly **does not** ship: Lesson tier, Program tier UI (Program comes via vendor paper kit + manually-issued Stripe Invoice — see `VENDOR_PAPER_KIT_SCOPE.md`), tax calculation, dunning campaigns, customer-self-serve plan-change UI, or any kind of usage-based billing.

---

## 2. Locked decisions (2026-05-26)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **All-Stripe architecture** | Stripe Checkout for Coach tier ($10/mo recurring); Stripe Invoicing for Program tier ($300/yr annual, manually issued). Same vendor, same webhook secret, one new sub-processor entry. Patreon is rejected for Program-tier procurement (no EIN invoicing, no board-grade artifacts). |
| 2 | **Webhook auto-grant on payment success; webhook auto-revoke on lapse** | Stripe `customer.subscription.created` / `invoice.paid` → server resolves Stripe customer to SetForge user (via stored `users.stripe_customer_id` set at Checkout) → flips `users.tier = 'coach'` → audit `billing.tier.grant`. `customer.subscription.deleted` / `invoice.payment_failed` (after Stripe's own retry exhaustion) → flips tier back to `free` → audit `billing.tier.revoke`. No operator action needed in the happy path. |
| 3 | **Soft-lapse, not hard-lapse** | When tier flips back to free, account stays active. Coach-tier features (UGC editing, Reports beyond R4, multi-lane print, group/lane management) lock with "Renew to access" overlay. Free-tier features (generator, history, run mode, single-pace print, favorites/disfavorites, assigned-to-me) continue forever. Matches the free-tier permanence promise in ToS. **No data loss on lapse**: UGC rows stay (just no edit access), groups stay (just no add/remove access), assignments stay (just no new ones). |
| 4 | **14-day trial, card required upfront** | Industry standard; Stripe Checkout's built-in trial parameter handles it. Coach gets full Coach access on day 0. No charge until day 14. Card decline at trial end → soft-lapse per decision 3. Cancellable any time before day 14 with no charge via Stripe customer portal. |
| 5 | **Stripe customer portal for self-serve plan management** | Stripe ships a hosted portal for: view next invoice, update payment method, cancel subscription, view past invoices. Generate portal session via `stripe.billingPortal.sessions.create` → redirect user. Saves us building all of that. ProfileModal gets a "Manage billing" button that opens the portal in a new tab. |
| 6 | **Refund policy: Program tier prorated within first 60 days; no refunds thereafter** | For the $300/yr Program annual contracts (Stripe Invoicing). Coach $10/mo refunds are per-coach goodwill (Cap'n issues via Stripe dashboard on request). Documented in ToS update at billing threshold. |
| 7 | **No Stripe Tax in v1** | Stripe Tax adds complexity (per-jurisdiction registration, monthly filing, $0.50/transaction). At <100 coaches volume, sales tax exposure is minimal and US sales tax for SaaS varies wildly by state. v1.1 enables Stripe Tax once volume justifies. ToS notes "tax may apply where required by law" as cover. |
| 8 | **Paywall pattern: feature-modal on click, not pre-paywall on landing** | Free users see Coach-tier features in the UI (greyed or with 🔒 badge). Clicking opens a modal: "Coach tier · $10/mo · 14-day free trial · Upgrade." Modal CTA → Stripe Checkout. Rejects the "blur the whole feature" approach (less discoverable; tells them what they're missing). |
| 9 | **Billing UI lives in ProfileModal** | New section between "Disfavorites" and "Sign out": "Subscription · Coach tier · next invoice 2026-06-12 · Manage billing →". For free users: "Free tier · Upgrade to Coach →". Single source of truth in-app for billing status. |
| 10 | **One Stripe product, two prices (Coach monthly + Coach annual)** | Coach monthly = $10/mo recurring. Optional Coach annual = $100/yr (save $20). Annual is a v1.1 add; v1 ships monthly only. Mention "annual coming" in the modal copy. |
| 11 | **Audit log every billing state change** | `billing.checkout.start` (user clicked upgrade, Checkout session created) · `billing.tier.grant` (subscription created) · `billing.tier.revoke` (subscription ended / payment failed past retry) · `billing.refund` (Cap'n issued refund via dashboard; webhook captures it) · `billing.portal.open` (user clicked Manage Billing). |
| 12 | **Stripe customer ID stored on users; no other PII denormalized** | New column `users.stripe_customer_id` (nullable VARCHAR). Everything else (next-invoice date, card last-4, plan name) is read on-demand from Stripe's API or the portal — don't denormalize, never goes stale. |
| 13 | **Webhook idempotency via Stripe event ID** | New table `stripe_webhook_events` with `stripe_event_id` UNIQUE + `received_at` + `processed_status`. Insert on every webhook receipt; skip processing if already inserted (Stripe re-sends on retry). Standard pattern; Stripe docs reference it explicitly. |

---

## 3. Implementation

### 3.1 New env vars

- `STRIPE_SECRET_KEY` — server-side API key (live mode + test mode separate)
- `STRIPE_WEBHOOK_SECRET` — for webhook signature verification
- `STRIPE_PRICE_ID_COACH_MONTHLY` — Stripe Price ID for the $10/mo recurring product
- `STRIPE_PORTAL_RETURN_URL` — defaults to `https://setforge.io/profile`

`BILLING_ACTIVE = !!STRIPE_SECRET_KEY`. When false (dev/test), paywall modal opens but Checkout button is greyed with "Billing not configured in this environment."

### 3.2 New migration (037 — assumes Phase 2 took 033 + 034, PSC took 035, taper took 036)

```sql
ALTER TABLE `users`
  ADD COLUMN `stripe_customer_id` VARCHAR(64) NULL AFTER `email_verified`,
  ADD COLUMN `tier`                ENUM('free','coach','program') NOT NULL DEFAULT 'free' AFTER `is_admin`,
  ADD COLUMN `tier_granted_at`    DATETIME NULL,
  ADD COLUMN `tier_source`        VARCHAR(64) NULL,   -- e.g. 'stripe_sub_xyz' or 'admin_grant'
  ADD INDEX `idx_stripe_customer` (`stripe_customer_id`);

CREATE TABLE `stripe_webhook_events` (
  `stripe_event_id`  VARCHAR(128) PRIMARY KEY,
  `event_type`       VARCHAR(64) NOT NULL,
  `received_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_status` ENUM('pending','processed','failed') NOT NULL DEFAULT 'pending',
  `last_error`       TEXT NULL,
  `payload_json`     MEDIUMTEXT NOT NULL,
  INDEX `idx_status_received` (`processed_status`, `received_at`)
) ENGINE=InnoDB;

CREATE TABLE `billing_history` (
  `id`               BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_sub`         VARCHAR(255) NOT NULL,
  `stripe_invoice_id` VARCHAR(64) NULL,
  `stripe_charge_id`  VARCHAR(64) NULL,
  `amount_cents`     INT NOT NULL,
  `currency`         VARCHAR(3) NOT NULL DEFAULT 'USD',
  `status`           ENUM('paid','refunded','failed','disputed') NOT NULL,
  `description`      VARCHAR(255) NULL,
  `occurred_at`      DATETIME NOT NULL,
  INDEX `idx_user_occurred` (`user_sub`, `occurred_at`),
  FOREIGN KEY (`user_sub`) REFERENCES `users`(`sub`) ON DELETE CASCADE
) ENGINE=InnoDB;
```

Tier-vs-is_coach decision: keep `is_coach` for org-role distinction (a coach is someone who coaches a team, regardless of billing tier — a free-tier solo athlete can still be a coach of a managed swimmer). Add `tier` as the billing-status field. Two are independent: `is_coach=1, tier='free'` means "coach who hasn't subscribed yet"; `is_coach=0, tier='coach'` is unreachable (paywall checks `is_coach`).

### 3.3 New module: `lib/billing.js`

Exports:

- `createCheckoutSession({ userSub, returnUrl })` — wraps `stripe.checkout.sessions.create`. Mode: subscription. Trial: 14 days. Price ID: env var. Customer: existing `users.stripe_customer_id` if set, else create + store. Returns Checkout URL.
- `createPortalSession({ userSub })` — wraps `stripe.billingPortal.sessions.create`. Returns portal URL.
- `processWebhookEvent(stripeEvent)` — central dispatch by event type. Handles: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`. Idempotent via `stripe_webhook_events`.
- `grantTier({ userSub, tier, source })` — sets `tier`, `tier_granted_at`, `tier_source`. Audits.
- `revokeTier({ userSub, reason })` — sets `tier = 'free'`. Audits.

### 3.4 New server.js routes

- `POST /api/billing/checkout` — auth: requireAuth + requireCsrf. Body: none. Returns `{ url: <Checkout URL> }`. Audit `billing.checkout.start`.
- `POST /api/billing/portal` — auth: requireAuth + requireCsrf. Returns `{ url: <portal URL> }`. Audit `billing.portal.open`.
- `POST /api/billing/webhook` — NO auth (Stripe is the caller). Verify Stripe signature. Insert into `stripe_webhook_events` (skip if dup). Call `processWebhookEvent`. Always 200 OK to Stripe (we own retry semantics now).
- `GET /api/billing/status` — auth: requireAuth. Returns `{ tier, tier_granted_at, has_active_subscription, next_invoice_date }`. Used by ProfileModal display.
- `GET /api/billing/history` — auth: requireAuth. Returns last N rows from `billing_history` for the user. Used by ProfileModal (Stripe portal handles the canonical history view; this is a quick at-a-glance in-app).

### 3.5 Webhook handler logic

```
on stripe event:
  insert into stripe_webhook_events (skip if dup)
  switch event.type:
    case 'checkout.session.completed':
      → store stripe_customer_id on users (link account)
    case 'customer.subscription.created':
    case 'customer.subscription.updated' where status in ('active','trialing'):
      → grantTier({ userSub, tier: 'coach', source: subscription.id })
    case 'customer.subscription.deleted':
    case 'customer.subscription.updated' where status in ('canceled','unpaid','past_due'):
      → revokeTier({ userSub, reason: status })
    case 'invoice.paid':
      → insert into billing_history (status: paid)
    case 'invoice.payment_failed':
      → log to audit; Stripe handles retry internally
    case 'charge.refunded':
      → insert into billing_history (status: refunded, amount: -amount)
  mark webhook event processed
```

Defensive: if Stripe customer doesn't match a SetForge user (account deleted between subscribe + webhook), log and skip silently — no orphan tier grants.

### 3.6 Client: paywall modal

Free user clicks a Coach-tier feature (e.g. "Create UGC set"):

```
┌─────────────────────────────────────────────┐
│  Coach tier · $10/month                     │
│  Start a 14-day free trial                  │
│                                             │
│  Unlocks:                                   │
│  · 📝 My Sets (author your own workouts)    │
│  · 📊 Coach Reports (programming, etc.)     │
│  · 🏊‍♂️ Multi-lane generate + per-lane print │
│  · Group management + lane plans + assigns  │
│  · Coach impact panel + curation propagation│
│                                             │
│  Free forever (no card needed):             │
│  · Generator + pace clock + history         │
│  · Single-pace print + run mode             │
│  · Favorites + disfavorites + Assigned-to-me│
│                                             │
│  [Maybe later]      [Start free trial →]    │
└─────────────────────────────────────────────┘
```

CTA → POST `/api/billing/checkout` → redirect to Stripe Checkout URL.

### 3.7 Client: ProfileModal billing section

```
── Subscription ──
🎯 Coach tier
   Started 2026-05-26 (trial ends 2026-06-09)
   Next invoice: 2026-06-12 · $10.00
   [Manage billing →]   (opens Stripe portal in new tab)

── Recent invoices ──
2026-06-12  $10.00  Paid       (in-app summary, Stripe portal for full history)
```

For free users:

```
── Subscription ──
Free tier
   [Upgrade to Coach →]
```

### 3.8 Free-tier feature lock semantics

The handful of Coach-tier features each get a check at the entry point:

- `UgcFormModal` open guard: if `me.tier !== 'coach'` → paywall modal
- `MySetsView`: if not coach-tier, show paywall hero instead of list
- `ReportsView` R1/R2/R3 tabs (R4 Program Recap stays free): if not coach-tier, render "Coach feature" stub
- `MultiLaneControl` toggle: if not coach-tier, button greyed with paywall on click
- `TeamsView` / `ManagedSwimmersView`: if not coach-tier, show paywall hero (these gate group management)

Audit `paywall.shown` event-type with the feature name in details — useful Phase 3 data.

### 3.9 Day-of-first-billing ToS softening

Per `BILLING_THRESHOLD_CHANGES.md`, the day the first paying coach actually subscribes:

- Apply the 5 staged edits to `public/privacy.html` + `public/terms.html`
- Update sub-processor list to mark Stripe as **Active** (currently Planned)
- Update pricing page status: "Billing live as of 2026-XX-XX"
- Audit-log `billing.first_paid_subscription` (one-time event) for the activation moment
- Send Cap'n a Discord ping (when Phase 2 webhook is live) or email (when Phase 2 email is live) — "you have your first paying coach"

This is more process than code; reminder lives here for the checklist.

---

## 4. Smoke checklist

- Stripe test-mode account configured with Coach monthly product + price ID added to env.
- Test card 4242 4242 4242 4242 used in Checkout → returns to `/?upgrade=success` → ProfileModal shows Coach tier active + trial-end date.
- `customer.subscription.created` webhook arrives → `users.tier` flips to coach → audit log shows `billing.tier.grant`.
- Coach-only features unlock immediately after webhook (need page reload or 5-min poll equivalent for in-flight session).
- Stripe customer portal opens via "Manage billing" button → can update card, view invoices, cancel.
- Cancel from portal → `customer.subscription.deleted` webhook → `users.tier` flips to free → Coach features lock → UGC rows still in DB but uneditable → free features still work.
- Test card 4000 0000 0000 0341 (always declines after trial) → trial converts to declined payment → after Stripe's retry exhaustion, `customer.subscription.deleted` fires → soft-lapse.
- Webhook retry: Stripe re-sends same event → `stripe_webhook_events` UNIQUE prevents double-grant.
- Refund issued via Stripe dashboard → `charge.refunded` webhook → `billing_history` row added with negative amount, status refunded.
- Authz: another user can't trigger a checkout linked to a different user (CSRF + userSub on session prevent it).
- `BILLING_ACTIVE=false` (no Stripe env vars) → paywall modal opens but CTA is disabled with "Billing not configured" message. App still works.

---

## 5. Out of scope (deferred to v1.1 or later)

- **Lesson tier** ($5-7/mo, TBD). Different pricing logic + per-managed-swimmer equipment profiles. Phase 4+.
- **Program tier self-serve UI.** Program ships via vendor paper kit + manually-issued Stripe Invoice. Self-serve later.
- **Coach annual price** ($100/yr, save $20). v1.1 add; one extra Stripe price + one radio in paywall modal.
- **Stripe Tax.** v1.1 when volume justifies the $0.50/transaction + per-state registration overhead.
- **Dunning campaigns** (custom email sequences on payment failure). Stripe Smart Retries handles the basics; custom flows wait.
- **Affiliate / referral codes.** No coupon mechanism in v1.
- **Team/seat-based billing for Program tier.** Program is currently $300/yr flat per organization. Seat-based when team-tier features land Phase 4.
- **Receipt customization.** Stripe's default receipts are fine; SetForge-branded receipts wait for v1.1.
- **Tip-jar product.** Mentioned in pricing memo. Separate Stripe Checkout flow with one-time payment + no tier change. v1.1.

---

## 6. Open Cap'n forks (none block v1)

1. **Stripe account region.** US-only initially. International coaches will work mechanically but Stripe charges per-region fees + currency conversion overhead. Document US-only on pricing page in v1.
2. **Tier display name to swimmers.** Swimmers on a coach's team see no billing UI — but should AssignedToMe cards show "Programmed by Coach Smith (Coach tier)" as a subtle status, or stay silent? v1 silent.
3. **Coach who lapses then re-subscribes.** Tier grants re-trigger; do we honor a second 14-day trial? Stripe's default is no (you've already used the trial). v1 inherits Stripe's behavior; revisit if it becomes a real complaint.

---

## 7. Effort estimate

~10-14h. Largest engineering Phase 3 deliverable.

- Migration 037 + db helpers: 2h
- `lib/billing.js` (Checkout, portal, webhook processor): 3-4h
- Server routes + Stripe signature verification: 2h
- Webhook handler logic (state-machine for tier flips): 2h
- Client: paywall modal: 1.5h
- Client: ProfileModal billing section: 1.5h
- Client: feature-lock guards on 5 entry points: 1.5h
- Smoke + Stripe test-card matrix + ToS update + manual + ROADMAP: 2-3h

Single 12-14h session not feasible — recommend Phase 3a = data + server + webhook (5-6h, end-to-end testable with test card), Phase 3b = client paywall + ProfileModal + locks (4-5h), Phase 3c = ToS update + manual + smoke (1-2h).

---

## 8. Dependencies

- **Cap'n's hands:**
  1. Create Stripe account at stripe.com (test mode access immediate; live mode requires identity verification, ~24h)
  2. Add EIN to Stripe account (also needed for vendor paper kit per `VENDOR_PAPER_KIT_SCOPE.md` §3.4)
  3. Create Stripe Product "SetForge Coach" with Price $10/mo recurring + 14-day trial
  4. Copy Price ID + Secret Key + Webhook Secret into Hyperlift dashboard
  5. Configure webhook endpoint in Stripe dashboard pointing at `https://setforge.io/api/billing/webhook` for the 5 event types
- **Vendor paper kit ideally ships first** (shares Stripe account setup; treasurer-facing material is in place when first paying Coach refers a colleague).
- **No new external services beyond Stripe.**

---

## 9. Related

- `VENDOR_PAPER_KIT_SCOPE.md` — shares Stripe account setup; the Program-tier branch of billing flows through manually-issued Stripe Invoices documented there
- `BILLING_THRESHOLD_CHANGES.md` — staged ToS/privacy edits that ship day-of-first-billing
- `/pricing.html` — public pricing model already documents Coach $10/mo, Program $25/mo or $300/yr
- `/sub-processors.html` — Stripe currently listed as Planned; flips to Active day-of-first-payment
- [[swim-generator-pricing-direction]] — locked pricing model from 2026-05-19, revised 2026-05-25
- `EMAIL_INFRA_SCOPE.md` — receipts ride Stripe's default email; if Resend goes live first, can route through our infra in v1.1
- PHASED_PLAN §3 Phase 3 — exit criterion is "first paying HS coach signs, pays, and sticks"
