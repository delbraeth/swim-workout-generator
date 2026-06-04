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

import Stripe from "stripe";
import { pool, dbAuditEvent } from "../db.js";

// Env-var consolidation 2026-05-27: Stripe credentials live in a single
// JSON-blob env var `STRIPE_CONFIG` so the 20/20 Hyperlift cap doesn't
// have to absorb 3 separate STRIPE_* slots. Local dev can still use the
// individual STRIPE_* vars (loaded as fallback when STRIPE_CONFIG isn't set).
//
// Expected shape:
//   STRIPE_CONFIG={"secret_key":"rk_..","webhook_secret":"whsec_..","price_id_coach_monthly":"price_..","portal_return_url":"https://setforge.io/profile"}
function _loadStripeConfig() {
  const raw = process.env.STRIPE_CONFIG;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return {
        secret_key:              parsed.secret_key              || "",
        webhook_secret:          parsed.webhook_secret          || "",
        price_id_coach_monthly:  parsed.price_id_coach_monthly  || "",
        price_id_lesson_monthly: parsed.price_id_lesson_monthly || "",
        portal_return_url:       parsed.portal_return_url       || "https://setforge.io/profile",
      };
    } catch (err) {
      console.error("[billing] STRIPE_CONFIG present but unparseable; falling back to individual vars:", err.message);
    }
  }
  // Fallback shape — individual env vars (legacy / local dev).
  return {
    secret_key:              process.env.STRIPE_SECRET_KEY               || "",
    webhook_secret:          process.env.STRIPE_WEBHOOK_SECRET            || "",
    price_id_coach_monthly:  process.env.STRIPE_PRICE_ID_COACH_MONTHLY    || "",
    price_id_lesson_monthly: process.env.STRIPE_PRICE_ID_LESSON_MONTHLY   || "",
    portal_return_url:       process.env.STRIPE_PORTAL_RETURN_URL         || "https://setforge.io/profile",
  };
}
const STRIPE_CFG = _loadStripeConfig();

export const BILLING_ACTIVE = !!STRIPE_CFG.secret_key;
const PRICE_COACH_MONTHLY   = STRIPE_CFG.price_id_coach_monthly;
const PRICE_LESSON_MONTHLY  = STRIPE_CFG.price_id_lesson_monthly;
// Price → tier resolution for checkout + webhook. Lesson is inert until the
// lesson price_id is configured in Stripe (BILLING_SCOPE / LESSON_TIER_SCOPE).
const PRICE_BY_TIER  = { coach: PRICE_COACH_MONTHLY, lesson: PRICE_LESSON_MONTHLY };
const TIER_BY_PRICE  = {};
if (PRICE_COACH_MONTHLY)  TIER_BY_PRICE[PRICE_COACH_MONTHLY]  = "coach";
if (PRICE_LESSON_MONTHLY) TIER_BY_PRICE[PRICE_LESSON_MONTHLY] = "lesson";
const WEBHOOK_SECRET        = STRIPE_CFG.webhook_secret;
const PORTAL_RETURN_URL     = STRIPE_CFG.portal_return_url;
const TRIAL_DAYS            = 14;  // per BILLING_SCOPE §3.3 decision 4

// Lazy-init the Stripe SDK only when active. Module import is safe even
// when BILLING_ACTIVE=false; the client is only constructed when needed.
const stripe = BILLING_ACTIVE ? new Stripe(STRIPE_CFG.secret_key) : null;

// Public for env-presence checks at route layer.
export function billingConfigState() {
  return {
    active:                BILLING_ACTIVE,
    config_source:         process.env.STRIPE_CONFIG ? "json_blob" : "individual_vars",
    has_secret_key:        !!STRIPE_CFG.secret_key,
    has_webhook:           !!STRIPE_CFG.webhook_secret,
    has_price_id:          !!STRIPE_CFG.price_id_coach_monthly,
    has_price_id_lesson:   !!STRIPE_CFG.price_id_lesson_monthly,
    portal_return:         STRIPE_CFG.portal_return_url,
  };
}

// ── Active gate ────────────────────────────────────────────────────
// Every Stripe-touching public function checks BILLING_ACTIVE first.
// When false, it returns a structured { skipped: 'inactive' } so callers
// can degrade cleanly. grantTier/revokeTier are exempt when source is
// 'admin_*' so the comp/tester override works without Stripe being live.

// ── Stripe customer resolution ─────────────────────────────────────
// Per scope §3.5 update: every Stripe object stamped with metadata.userSub
// at create time so webhook resolution works regardless of timing. This
// helper looks up an existing stripe_customer_id from users, OR creates
// a fresh customer and stores the id back.
async function ensureStripeCustomer(userSub) {
  if (!BILLING_ACTIVE) throw new Error("ensureStripeCustomer: BILLING_ACTIVE=false");
  const rows = await pool.query(
    "SELECT `stripe_customer_id`, `email` FROM `users` WHERE `sub` = ?",
    [userSub]
  );
  const u = rows[0];
  if (!u) throw new Error(`ensureStripeCustomer: user not found ${userSub}`);
  if (u.stripe_customer_id) return u.stripe_customer_id;
  const customer = await stripe.customers.create({
    email:    u.email || undefined,
    metadata: { userSub },
  });
  await pool.query(
    "UPDATE `users` SET `stripe_customer_id` = ? WHERE `sub` = ?",
    [customer.id, userSub]
  );
  return customer.id;
}

// ── Checkout session ───────────────────────────────────────────────
// Per scope §3.3 + §3.5 metadata stamp. Mode: subscription. Trial: 14
// days (decision 4). Customer: resolved-or-created via ensureStripeCustomer.
// Subscription metadata.userSub also set so webhook resolution works
// regardless of which event fires first.
//
// Returns { url, sessionId } on success, { skipped: 'inactive' } when
// BILLING_ACTIVE=false, { error: 'no_price_id' } if env var missing.
export async function createCheckoutSession({ userSub, successUrl, cancelUrl, tier = "coach" }) {
  if (!BILLING_ACTIVE) return { skipped: "inactive" };
  if (!userSub) throw new Error("createCheckoutSession: userSub required");
  const wantTier = (tier === "lesson") ? "lesson" : "coach";
  const price = PRICE_BY_TIER[wantTier];
  if (!price) return { error: "no_price_id" };   // lesson is inert until its price_id is configured
  const customerId = await ensureStripeCustomer(userSub);
  const session = await stripe.checkout.sessions.create({
    mode:       "subscription",
    customer:   customerId,
    line_items: [{ price, quantity: 1 }],
    success_url: successUrl || `${PORTAL_RETURN_URL}?upgrade=success`,
    cancel_url:  cancelUrl  || `${PORTAL_RETURN_URL}?upgrade=cancelled`,
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      // Stamp the tier so the webhook grants the right one regardless of which
      // event fires first (and even if the price→tier map changes later).
      metadata: { userSub, tier: wantTier },
    },
    metadata: { userSub, tier: wantTier },
    // Allow promotion codes in case Cap'n issues any later
    allow_promotion_codes: true,
  });
  return { url: session.url, sessionId: session.id };
}

// ── Portal session ─────────────────────────────────────────────────
// Per scope §3.3 + decision 5. Wraps stripe.billingPortal.sessions.create.
// User must already have a stripe_customer_id on file (set during their
// first Checkout). Return URL defaults to STRIPE_PORTAL_RETURN_URL.
//
// Returns { url } on success, { skipped: 'inactive' } when inactive,
// { error: 'no_customer' } when user has no Stripe customer (never paid).
export async function createPortalSession({ userSub, returnUrl }) {
  if (!BILLING_ACTIVE) return { skipped: "inactive" };
  if (!userSub) throw new Error("createPortalSession: userSub required");
  const rows = await pool.query(
    "SELECT `stripe_customer_id` FROM `users` WHERE `sub` = ?",
    [userSub]
  );
  const customerId = rows[0]?.stripe_customer_id;
  if (!customerId) return { error: "no_customer" };
  const session = await stripe.billingPortal.sessions.create({
    customer:   customerId,
    return_url: returnUrl || PORTAL_RETURN_URL,
  });
  return { url: session.url };
}

// ── Webhook signature verification ─────────────────────────────────
// Called from server.js webhook route BEFORE any side-effects. Throws
// on bad signature so the route can 400. Returns the parsed Stripe.Event.
export function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!BILLING_ACTIVE) throw new Error("verifyWebhookSignature: BILLING_ACTIVE=false");
  if (!WEBHOOK_SECRET) throw new Error("verifyWebhookSignature: STRIPE_WEBHOOK_SECRET not set");
  return stripe.webhooks.constructEvent(rawBody, signatureHeader, WEBHOOK_SECRET);
}

// ── User resolution from Stripe object ─────────────────────────────
// Per scope §3.5 update: metadata.userSub first, customer.metadata.userSub
// second, local stripe_customer_id lookup third. Returns null on miss
// (caller logs + skips silently as orphan event).
async function resolveUserSubFromEvent(stripeEvent) {
  const obj = stripeEvent?.data?.object || {};
  // 1. Direct metadata on the object (subscription, checkout session)
  if (obj.metadata?.userSub) return obj.metadata.userSub;
  // 2. Customer metadata (need to fetch customer if only id is present)
  const customerId = obj.customer || obj.customer_id || null;
  if (customerId) {
    // Local lookup first (fast)
    const rows = await pool.query(
      "SELECT `sub` FROM `users` WHERE `stripe_customer_id` = ? LIMIT 1",
      [customerId]
    );
    if (rows[0]?.sub) return rows[0].sub;
    // Fall back to Stripe customer fetch for metadata
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (customer?.metadata?.userSub) return customer.metadata.userSub;
    } catch (_) { /* customer may be deleted; treat as orphan */ }
  }
  return null;
}

// ── Webhook event processor ────────────────────────────────────────
// Per scope §3.5. Central dispatch. The route layer verifies signature
// + inserts event into stripe_webhook_events (idempotency) BEFORE calling
// this function. This function handles the type-switch + state updates.
export async function processWebhookEvent(stripeEvent) {
  if (!BILLING_ACTIVE) return { skipped: "inactive" };
  const type = stripeEvent?.type;
  const obj  = stripeEvent?.data?.object || {};
  const userSub = await resolveUserSubFromEvent(stripeEvent);
  if (!userSub) {
    console.warn(`[billing] orphan webhook ${type} event_id=${stripeEvent?.id}`);
    return { skipped: "orphan_no_user" };
  }

  switch (type) {
    case "checkout.session.completed": {
      // Customer id should now be canonical on the users row; ensure it's stored.
      if (obj.customer) {
        await pool.query(
          "UPDATE `users` SET `stripe_customer_id` = ? WHERE `sub` = ? AND (`stripe_customer_id` IS NULL OR `stripe_customer_id` = '')",
          [obj.customer, userSub]
        );
      }
      return { handled: "checkout_session_completed" };
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const status = obj.status || "unknown";
      if (["active", "trialing"].includes(status)) {
        // Resolve which tier this subscription grants: prefer the tier stamped
        // on the subscription metadata at checkout, else map the price id, else
        // default coach (older subs predate the metadata stamp).
        const metaTier = obj?.metadata?.tier;
        const priceId  = obj?.items?.data?.[0]?.price?.id;
        const resolvedTier = (metaTier === "coach" || metaTier === "lesson") ? metaTier
                            : (priceId && TIER_BY_PRICE[priceId]) ? TIER_BY_PRICE[priceId]
                            : "coach";
        await grantTier({ userSub, tier: resolvedTier, source: `stripe_sub_${obj.id}` });
        return { handled: type, status, action: `granted_${resolvedTier}` };
      }
      if (["canceled", "unpaid", "incomplete_expired", "past_due"].includes(status)) {
        await revokeTier({ userSub, reason: `stripe_${type}_${status}` });
        return { handled: type, status, action: "revoked" };
      }
      return { handled: type, status, action: "no_change" };
    }

    case "customer.subscription.deleted": {
      await revokeTier({ userSub, reason: `stripe_subscription_deleted_${obj.id}` });
      return { handled: type, action: "revoked" };
    }

    case "invoice.paid": {
      const amount = obj.amount_paid || 0;
      await pool.query(
        "INSERT INTO `billing_history` (`user_sub`, `stripe_invoice_id`, `amount_cents`, `currency`, `status`, `description`, `occurred_at`) " +
        "VALUES (?, ?, ?, ?, 'paid', ?, FROM_UNIXTIME(?))",
        [userSub, obj.id, amount, (obj.currency || "usd").toUpperCase(), obj.description || "Subscription payment", obj.created || Math.floor(Date.now() / 1000)]
      );
      return { handled: "invoice_paid", amount_cents: amount };
    }

    case "invoice.payment_failed": {
      dbAuditEvent({
        userSub,
        eventType: "billing.invoice.failed",
        details:   { invoice_id: obj.id, amount_cents: obj.amount_due || 0 },
      });
      return { handled: "invoice_payment_failed" };
    }

    case "charge.refunded": {
      const amount = -(obj.amount_refunded || 0);
      await pool.query(
        "INSERT INTO `billing_history` (`user_sub`, `stripe_charge_id`, `amount_cents`, `currency`, `status`, `description`, `occurred_at`) " +
        "VALUES (?, ?, ?, ?, 'refunded', ?, FROM_UNIXTIME(?))",
        [userSub, obj.id, amount, (obj.currency || "usd").toUpperCase(), "Refund", obj.created || Math.floor(Date.now() / 1000)]
      );
      dbAuditEvent({
        userSub,
        eventType: "billing.refund",
        details:   { charge_id: obj.id, amount_cents: amount },
      });
      return { handled: "charge_refunded", amount_cents: amount };
    }

    default:
      // Ignored event type — not an error.
      return { skipped: "unhandled_type", type };
  }
}

// ── Tier grant + revoke (internal, called by webhook processor) ─────
// Per scope §3.3. Direct DB writes; the webhook processor wraps these.
// Idempotent: setting tier='coach' when already coach is a no-op
// (no audit event emitted in the no-op case).
//
// Scope update 2026-05-26 invariant note: v1 doesn't enforce
// "tier='coach' implies is_coach=1" — convention only. v1.1 should
// either add a CHECK constraint or have these helpers set both atomically.
// grantTier / revokeTier intentionally bypass the BILLING_ACTIVE gate
// when source starts with "admin_" (e.g. admin_grant, admin_pilot).
// This lets Cap'n comp testers without Stripe needing to be configured —
// the override mechanism is independent of payment processing. Stripe-
// driven grants (source='stripe_sub_xxx') still gate on BILLING_ACTIVE
// because they assume the Stripe SDK is wired.
function isAdminGrantSource(source) {
  return typeof source === "string" && source.startsWith("admin_");
}

export async function grantTier({ userSub, tier, source }) {
  if (!BILLING_ACTIVE && !isAdminGrantSource(source)) return { skipped: "inactive" };
  if (!userSub || !tier) throw new Error("grantTier: userSub + tier required");
  const allowed = ["free", "coach", "lesson", "program"];   // Lesson tier (Phase 5)
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
  // Revoke intentionally bypasses BILLING_ACTIVE — it's a safety mechanism
  // and must work even when Stripe isn't configured (e.g. revoking a
  // comped tier after a tester pilot ends).
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
