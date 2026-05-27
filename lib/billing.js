// lib/billing.js — Stripe-backed billing thin slice (SCAFFOLD)
//
// Per BILLING_SCOPE.md §3.3. This module is the central wrapper around
// Stripe for Coach-tier subscription management. As of this scaffold
// commit, NONE of the functions actually call Stripe — they're stubs
// that throw "not implemented" until:
//   1. Cap'n's Stripe account is set up (test + live mode keys)
//   2. STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET + STRIPE_PRICE_ID_COACH_MONTHLY
//      are added to Hyperlift env vars
//   3. `stripe` npm package is installed (deferred — no entry in
//      package.json yet)
//   4. Migration 038 is applied to prod (the columns + tables exist
//      but are unused until this module's functions are real)
//
// BILLING_ACTIVE pattern mirrors EMAIL_ACTIVE in lib/email.js: when
// the env var is missing, the module degrades gracefully so the rest
// of the app runs without billing being live.
//
// Webhook customer→user resolution (per scope §3.5 update 2026-05-26):
// every Stripe object stamped with userSub metadata at create time;
// webhooks resolve via metadata first, then fall back to local
// stripe_customer_id lookup. Avoids the checkout-vs-subscription race
// where subscription.created can arrive before stripe_customer_id is
// stored.

import { pool, dbAuditEvent } from "../db.js";

export const BILLING_ACTIVE = !!process.env.STRIPE_SECRET_KEY;

// Public for env-presence checks at route layer.
export function billingConfigState() {
  return {
    active:         BILLING_ACTIVE,
    has_secret_key: !!process.env.STRIPE_SECRET_KEY,
    has_webhook:    !!process.env.STRIPE_WEBHOOK_SECRET,
    has_price_id:   !!process.env.STRIPE_PRICE_ID_COACH_MONTHLY,
    portal_return:  process.env.STRIPE_PORTAL_RETURN_URL || "https://setforge.io/profile",
  };
}

// ── Stub guards ────────────────────────────────────────────────────
// Every public function checks BILLING_ACTIVE first. When false, it
// returns a structured { skipped: 'inactive' } so callers can degrade
// cleanly. When true (env vars present), the function bodies are still
// TODO — they'll get real Stripe SDK calls in the "fill it in" slice
// that runs when first paying pilot triggers.

function notImplemented(fn) {
  throw new Error(`lib/billing.js ${fn} not implemented yet — see BILLING_SCOPE.md §3.3. Set STRIPE_SECRET_KEY + npm install stripe + flip this stub to a real call when the first paying pilot triggers.`);
}

// ── Checkout session ───────────────────────────────────────────────
// Per scope §3.3 + §3.5 metadata stamp. Wraps stripe.checkout.sessions
// .create. Mode: subscription. Trial: 14 days (decision 4). Customer:
// resolves existing users.stripe_customer_id OR creates new with
// metadata.userSub set. Subscription metadata.userSub also set so
// webhook resolution works regardless of which fires first.
//
// Returns { url, sessionId } on success, { skipped: 'inactive' } when
// BILLING_ACTIVE=false.
export async function createCheckoutSession({ userSub, returnUrl }) {  // eslint-disable-line no-unused-vars
  if (!BILLING_ACTIVE) return { skipped: "inactive" };
  notImplemented("createCheckoutSession");
}

// ── Portal session ─────────────────────────────────────────────────
// Per scope §3.3 + decision 5. Wraps stripe.billingPortal.sessions.create.
// User must already have a stripe_customer_id on file (set during their
// first Checkout). Return URL defaults to STRIPE_PORTAL_RETURN_URL.
//
// Returns { url } on success, { skipped: 'inactive' } when inactive,
// { error: 'no_customer' } when user has no Stripe customer (never paid).
export async function createPortalSession({ userSub }) {  // eslint-disable-line no-unused-vars
  if (!BILLING_ACTIVE) return { skipped: "inactive" };
  notImplemented("createPortalSession");
}

// ── Webhook event processor ────────────────────────────────────────
// Per scope §3.5. Central dispatch for incoming Stripe webhooks. The
// route layer (server.js) verifies the Stripe signature + inserts the
// event into stripe_webhook_events (idempotency) BEFORE calling this
// function. This function handles the type-switch + state updates.
//
// Event types handled:
//   - checkout.session.completed              → store stripe_customer_id
//   - customer.subscription.created           → grantTier (coach)
//   - customer.subscription.updated           → grantTier or revokeTier per status
//   - customer.subscription.deleted           → revokeTier
//   - invoice.paid                            → billing_history insert
//   - invoice.payment_failed                  → audit log (Stripe handles retry)
//   - charge.refunded                         → billing_history insert (negative amount)
//
// User resolution per scope §3.5 update: metadata.userSub first,
// customer.metadata.userSub second, local stripe_customer_id lookup
// third. If all three miss → log + skip silently (orphan event).
export async function processWebhookEvent(stripeEvent) {  // eslint-disable-line no-unused-vars
  if (!BILLING_ACTIVE) return { skipped: "inactive" };
  notImplemented("processWebhookEvent");
}

// ── Tier grant + revoke (internal, called by webhook processor) ─────
// Per scope §3.3. Direct DB writes; the webhook processor wraps these.
// Idempotent: setting tier='coach' when already coach is a no-op
// (no audit event emitted in the no-op case).
//
// Scope update 2026-05-26 invariant note: v1 doesn't enforce
// "tier='coach' implies is_coach=1" — convention only. v1.1 should
// either add a CHECK constraint or have these helpers set both atomically.
export async function grantTier({ userSub, tier, source }) {
  if (!BILLING_ACTIVE) return { skipped: "inactive" };
  if (!userSub || !tier) throw new Error("grantTier: userSub + tier required");
  const allowed = ["free", "coach", "program"];
  if (!allowed.includes(tier)) throw new Error(`grantTier: invalid tier ${tier}`);

  // Real DB write — even in scaffold mode (with BILLING_ACTIVE=true
  // and env vars set but stripe SDK not yet installed, this helper
  // can still be called manually by an admin grant flow).
  const r = await pool.query(
    "UPDATE `users` SET `tier` = ?, `tier_granted_at` = NOW(), `tier_source` = ? WHERE `sub` = ?",
    [tier, source || null, userSub]
  );
  if (r.affectedRows === 0) return { skipped: "user_not_found" };

  dbAuditEvent({
    userSub,
    eventType: "billing.tier.grant",
    details:   { tier, source },
  });
  return { granted: true, tier };
}

export async function revokeTier({ userSub, reason }) {
  if (!BILLING_ACTIVE) return { skipped: "inactive" };
  if (!userSub) throw new Error("revokeTier: userSub required");
  const r = await pool.query(
    "UPDATE `users` SET `tier` = 'free', `tier_granted_at` = NULL, `tier_source` = NULL WHERE `sub` = ? AND `tier` != 'free'",
    [userSub]
  );
  if (r.affectedRows === 0) return { skipped: "already_free_or_not_found" };

  dbAuditEvent({
    userSub,
    eventType: "billing.tier.revoke",
    details:   { reason: reason || "unspecified" },
  });
  return { revoked: true };
}

// ── Read helpers ───────────────────────────────────────────────────
// Used by /api/billing/status + /api/billing/history routes. Both
// safe to call without Stripe SDK installed — pure DB reads against
// the migration 038 schema.

export async function getBillingStatusFor(userSub) {
  if (!userSub) return { tier: "free" };
  const rows = await pool.query(
    "SELECT `tier`, `tier_granted_at`, `tier_source`, `stripe_customer_id` FROM `users` WHERE `sub` = ?",
    [userSub]
  );
  const r = rows[0];
  if (!r) return { tier: "free" };
  return {
    tier:                  r.tier || "free",
    tier_granted_at:       r.tier_granted_at,
    has_stripe_customer:   !!r.stripe_customer_id,
    // next_invoice_date is a Stripe API call — left null in scaffold;
    // real implementation fetches via stripe.subscriptions.retrieve.
    next_invoice_date:     null,
  };
}

export async function getBillingHistoryFor(userSub, limit = 10) {
  if (!userSub) return [];
  const rows = await pool.query(
    "SELECT `id`, `stripe_invoice_id`, `stripe_charge_id`, `amount_cents`, `currency`, `status`, `description`, `occurred_at` " +
    "FROM `billing_history` WHERE `user_sub` = ? ORDER BY `occurred_at` DESC LIMIT ?",
    [userSub, Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50)]
  );
  return rows;
}
