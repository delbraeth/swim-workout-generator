// lib/appleIap.js — Apple In-App Purchase billing slice (SCAFFOLD)
//
// Parallel to lib/billing.js (Stripe). App Store policy requires IAP for
// digital subscriptions bought inside the iOS app, so this module turns a
// verified Apple transaction (or an App Store Server Notification) into the
// SAME tier grant Stripe drives — grantTier/revokeTier writing users.tier.
//
// COEXISTENCE: web → Stripe (lib/billing.js), iOS → Apple IAP (this module).
// Both write users.tier; tier_source records the channel ('apple_iap_<txn>'
// vs 'stripe_sub_<id>'). A user pays through ONE channel; reconcileChannels()
// below documents the double-pay guard.
//
// INERT BY DEFAULT: IAP_ACTIVE is false until APPLE_IAP_CONFIG env is set, so
// importing this module is safe and changes nothing in prod. Mirrors the
// BILLING_ACTIVE / EMAIL_ACTIVE pattern.
//
// REAL VERIFICATION (when activated): Apple's App Store Server API returns
// signed JWS transactions; the App Store Server Library
// (`@apple/app-store-server-library`, NOT yet in package.json) verifies the
// signature chain. Until that package + creds are wired, verifyTransaction()
// returns { skipped: 'inactive' } and the routes 503. We deliberately do NOT
// hand-roll JWS verification — Apple's library handles cert-chain validation.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool, dbAuditEvent } from "../db.js";
import { grantTier, revokeTier } from "./billing.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ──────────────────────────────────────────────────────────
// Single JSON-blob env var (matches STRIPE_CONFIG consolidation — keeps the
// Hyperlift env-slot count down). Expected shape:
//   APPLE_IAP_CONFIG={
//     "bundle_id":"com.delbraeth.swimworkout",
//     "issuer_id":"<App Store Connect API issuer UUID>",
//     "key_id":"<.p8 key id>",
//     "private_key":"-----BEGIN PRIVATE KEY-----\n...",   // App Store Connect API key (.p8)
//     "environment":"Production",                          // or "Sandbox"
//     "product_tier_map":{"com.delbraeth.swimworkout.coach.monthly":"coach",
//                          "com.delbraeth.swimworkout.program.yearly":"program"}
//   }
function _loadConfig() {
  const raw = process.env.APPLE_IAP_CONFIG;
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    return {
      bundle_id:        p.bundle_id        || "",
      issuer_id:        p.issuer_id        || "",
      key_id:           p.key_id           || "",
      private_key:      (p.private_key     || "").replace(/\\n/g, "\n"),
      environment:      p.environment      || "Production",
      product_tier_map: p.product_tier_map || {},
      // App's numeric "Apple ID" (App Store id, e.g. 6499999999). Required by
      // SignedDataVerifier for online checks; optional (null) when omitted.
      app_apple_id:     p.app_apple_id != null ? Number(p.app_apple_id) : null,
      // Dir holding Apple's PEM root certs (AppleRootCA-G3.cer etc.), DER or PEM.
      // Defaults to lib/apple-certs/. The library needs Apple's root CAs to
      // verify the JWS x5c chain; we don't bundle them (download from
      // https://www.apple.com/certificateauthority/).
      root_cert_dir:    p.root_cert_dir || path.join(__dirname, "apple-certs"),
    };
  } catch (err) {
    console.error("[appleIap] APPLE_IAP_CONFIG present but unparseable:", err.message);
    return null;
  }
}
const CFG = _loadConfig();

// Active only when the full config is present. Missing the App Store Server
// Library counts as inactive too (we can't verify safely without it).
let _libAvailable = false;
let _AppStoreLib = null;
async function _loadAppleLib() {
  if (_AppStoreLib || _libAvailable) return _AppStoreLib;
  try {
    _AppStoreLib = await import("@apple/app-store-server-library");
    _libAvailable = true;
  } catch (_) {
    _libAvailable = false; // package not installed yet — stays inert
  }
  return _AppStoreLib;
}

// Load Apple's root CA certs (Buffers) from the configured dir. The library's
// SignedDataVerifier needs these to validate the JWS x5c certificate chain.
// Returns [] if the dir is missing — verifier construction then fails loudly,
// which surfaces as a clear error rather than a silent bad-verify.
function _loadAppleRootCerts() {
  try {
    const dir = CFG.root_cert_dir;
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => /\.(cer|der|pem|crt)$/i.test(f))
      .map(f => fs.readFileSync(path.join(dir, f)));
  } catch (err) {
    console.error("[appleIap] failed to load root certs:", err.message);
    return [];
  }
}

// Cached SignedDataVerifier (cert load + construction are not free). Built on
// first use; null until then. Throws if certs are missing so misconfig is loud.
let _verifier = null;
async function _getVerifier() {
  if (_verifier) return _verifier;
  const lib = await _loadAppleLib();
  if (!lib) throw new Error("library_unavailable");
  const certs = _loadAppleRootCerts();
  if (!certs.length) throw new Error(`no_root_certs in ${CFG.root_cert_dir}`);
  // lib.Environment is a value-enum: { SANDBOX:"Sandbox", PRODUCTION:"Production", ... }.
  // CFG.environment is the VALUE string ("Production"/"Sandbox"); validate it's a
  // real enum value rather than indexing by it (Environment["Production"] is undefined).
  const validEnvs = Object.values(lib.Environment);
  const env = validEnvs.includes(CFG.environment) ? CFG.environment : lib.Environment.PRODUCTION;
  // (rootCerts, enableOnlineChecks, environment, bundleId, appAppleId?)
  // enableOnlineChecks=true does revocation + expiration checking on the chain.
  _verifier = new lib.SignedDataVerifier(certs, true, env, CFG.bundle_id, CFG.app_apple_id ?? undefined);
  return _verifier;
}

export const IAP_ACTIVE = !!(CFG && CFG.bundle_id && CFG.issuer_id && CFG.key_id && CFG.private_key);

export function appleIapConfigState() {
  return {
    active:           IAP_ACTIVE,
    has_config:       !!CFG,
    bundle_id:        CFG?.bundle_id || null,
    environment:      CFG?.environment || null,
    product_count:    CFG ? Object.keys(CFG.product_tier_map).length : 0,
    // library presence is async to detect; report config-readiness here.
    note:             IAP_ACTIVE ? "config present; @apple/app-store-server-library required at runtime" : "inactive — APPLE_IAP_CONFIG not set",
  };
}

// Map an Apple product id → our tier via config. Unknown product → null.
function tierForProduct(productId) {
  if (!CFG || !productId) return null;
  return CFG.product_tier_map[productId] || null;
}

// ── Transaction verification ────────────────────────────────────────
// Client (StoreKit 2) sends its signed transaction JWS to /verify; the server
// validates it with Apple's library and extracts { productId, originalTransactionId,
// expiresDate, revoked }. Returns a normalized result. INERT until active.
//
// Implementation note for activation: use SignedDataVerifier from
// @apple/app-store-server-library with Apple's root certs + bundle_id +
// environment, then verifyAndDecodeTransaction(jws).
export async function verifyTransaction(signedTransactionJws) {
  if (!IAP_ACTIVE) return { skipped: "inactive" };
  if (!signedTransactionJws) return { error: "no_jws" };
  let verifier;
  try {
    verifier = await _getVerifier();
  } catch (err) {
    return { error: err.message === "library_unavailable" ? "library_unavailable" : "verifier_init_failed", detail: err.message };
  }
  try {
    // Validates the JWS signature + cert chain, then decodes the transaction.
    const tx = await verifier.verifyAndDecodeTransaction(signedTransactionJws);
    return {
      ok:                    true,
      productId:             tx.productId,
      originalTransactionId: tx.originalTransactionId,
      // Apple gives epoch-millis; normalize to Number (applyVerifiedTransaction
      // compares against Date.now()). expiresDate is undefined for non-subs.
      expiresDate:           tx.expiresDate != null ? Number(tx.expiresDate) : null,
      revoked:               tx.revocationDate != null,
    };
  } catch (err) {
    // Bad signature / wrong bundle / expired chain → reject (caller 400s).
    return { error: "verification_failed", detail: err.message };
  }
}

// Apply a verified transaction to the user's tier. Called by /verify (client
// round-trip) AND by processNotification (Apple → server). Single writer path.
export async function applyVerifiedTransaction({ userSub, productId, originalTransactionId, expiresDate, revoked }) {
  if (!IAP_ACTIVE) return { skipped: "inactive" };
  if (!userSub) throw new Error("applyVerifiedTransaction: userSub required");
  const tier = tierForProduct(productId);
  if (!tier) return { error: "unknown_product", productId };

  // Persist the Apple linkage so server notifications can resolve user later.
  if (originalTransactionId) {
    await pool.query(
      "UPDATE `users` SET `apple_original_transaction_id` = ? WHERE `sub` = ? " +
      "AND (`apple_original_transaction_id` IS NULL OR `apple_original_transaction_id` = '')",
      [String(originalTransactionId), userSub]
    );
  }

  const active = !revoked && (!expiresDate || Number(expiresDate) > Date.now());
  if (active) {
    await grantTier({ userSub, tier, source: `apple_iap_${originalTransactionId || "unknown"}` });
    return { granted: true, tier };
  }
  await revokeTier({ userSub, reason: `apple_iap_${revoked ? "revoked" : "expired"}_${originalTransactionId || ""}` });
  return { revoked: true };
}

// ── App Store Server Notifications V2 ───────────────────────────────
// Apple POSTs a signedPayload (JWS) on subscription lifecycle changes
// (SUBSCRIBED, DID_RENEW, DID_CHANGE_RENEWAL_STATUS, EXPIRED, REFUND, etc.).
// Route layer inserts into apple_iap_events for idempotency, then calls this.
// Resolve user via apple_original_transaction_id (stored at first verify).
export async function processNotification(signedPayload) {
  if (!IAP_ACTIVE) return { skipped: "inactive" };
  if (!signedPayload) return { error: "no_payload" };
  let verifier;
  try {
    verifier = await _getVerifier();
  } catch (err) {
    return { error: err.message === "library_unavailable" ? "library_unavailable" : "verifier_init_failed", detail: err.message };
  }

  let payload, notificationUUID, notificationType, subtype;
  try {
    payload          = await verifier.verifyAndDecodeNotification(signedPayload);
    notificationUUID = payload.notificationUUID || null;
    notificationType = payload.notificationType || null;
    subtype          = payload.subtype || null;
  } catch (err) {
    return { error: "notification_verify_failed", detail: err.message };
  }

  // Decode the embedded transaction (present on subscription lifecycle events).
  const signedTx = payload?.data?.signedTransactionInfo;
  if (!signedTx) {
    // Some notification types (e.g. test, renewal-info-only) carry no txn — ack.
    return { handled: notificationType, subtype, notificationUUID, action: "no_transaction" };
  }
  let tx;
  try {
    tx = await verifier.verifyAndDecodeTransaction(signedTx);
  } catch (err) {
    return { error: "transaction_verify_failed", detail: err.message, notificationUUID };
  }

  const origTxn = tx.originalTransactionId;
  const userSub = await resolveUserByOriginalTxn(origTxn);
  if (!userSub) {
    // No local user mapped to this subscription yet (e.g. notification raced
    // ahead of the client /verify that stores the linkage). Caller records the
    // event; a later /verify reconciles. Not an error.
    return { skipped: "orphan_no_user", notificationUUID, notificationType, original_txn_id: origTxn };
  }

  const result = await applyVerifiedTransaction({
    userSub,
    productId:             tx.productId,
    originalTransactionId: origTxn,
    expiresDate:           tx.expiresDate != null ? Number(tx.expiresDate) : null,
    revoked:               tx.revocationDate != null,
  });
  return { handled: notificationType, subtype, notificationUUID, original_txn_id: origTxn, result };
}

// Resolve a user from Apple's originalTransactionId (set during first verify).
export async function resolveUserByOriginalTxn(originalTransactionId) {
  if (!originalTransactionId) return null;
  const rows = await pool.query(
    "SELECT `sub` FROM `users` WHERE `apple_original_transaction_id` = ? LIMIT 1",
    [String(originalTransactionId)]
  );
  return rows[0]?.sub || null;
}

// ── Double-pay reconciliation (policy doc, called nowhere yet) ──────
// A user could in theory pay on web (Stripe) AND iOS (Apple). Both write
// users.tier, so the tier itself is correct (idempotent). The PROBLEM is two
// live subscriptions billing the same person. Guard strategy (implement when
// IAP goes live):
//   • Before opening a Stripe checkout, if tier_source LIKE 'apple_iap_%' and
//     still active → block + tell the user to manage their sub in the App Store.
//   • Before opening the iOS paywall, if tier_source LIKE 'stripe_sub_%' and
//     active → block + point to the web billing portal.
// This is read-only off users.tier_source, so no schema change is needed.
export function reconciliationNote() {
  return "See lib/appleIap.js reconcileChannels comment — block cross-channel purchase when an active sub exists on the other channel.";
}
