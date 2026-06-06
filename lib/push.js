// lib/push.js — Web Push (VAPID) delivery. Foundational notify infrastructure
// shared by RSVP / cancellation / weather / social once those ship.
//
// Mirrors the lib/billing.js "inert until configured" pattern: PUSH_ACTIVE is
// false until VAPID keys are set, so the rest of the app runs fine without push.
// The `web-push` SDK is LAZILY imported inside send() so a missing module can
// never crash server boot (defensive — like the DB-down hard-exit class of bug).
//
// Config (single env blob to respect the 20-var Hyperlift cap):
//   PUSH_CONFIG={"vapid_public":"B..","vapid_private":"..","subject":"mailto:hello@setforge.io"}
// or individual fallbacks VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT.
// Generate a keypair with:  npx web-push generate-vapid-keys
import { dbListPushSubscriptionsForUser, dbDeletePushSubscription } from "../db.js";

function _loadPushConfig() {
  const raw = process.env.PUSH_CONFIG;
  if (raw) {
    try {
      const p = JSON.parse(raw);
      return {
        vapid_public:  p.vapid_public  || "",
        vapid_private: p.vapid_private || "",
        subject:       p.subject       || "mailto:hello@setforge.io",
      };
    } catch (err) {
      console.error("[push] PUSH_CONFIG present but unparseable; falling back to individual vars:", err.message);
    }
  }
  return {
    vapid_public:  process.env.VAPID_PUBLIC_KEY  || "",
    vapid_private: process.env.VAPID_PRIVATE_KEY || "",
    subject:       process.env.VAPID_SUBJECT     || "mailto:hello@setforge.io",
  };
}
const CFG = _loadPushConfig();
export const PUSH_ACTIVE = !!(CFG.vapid_public && CFG.vapid_private);

export function pushConfigState() {
  return { active: PUSH_ACTIVE, vapid_public_key: CFG.vapid_public || null };
}

// Lazy SDK init — only loaded + configured the first time we actually send.
let _webpush = null;
async function _getWebPush() {
  if (_webpush) return _webpush;
  const mod = await import("web-push");
  const wp = mod.default || mod;
  wp.setVapidDetails(CFG.subject, CFG.vapid_public, CFG.vapid_private);
  _webpush = wp;
  return wp;
}

// Send a notification to every browser the user has subscribed. Best-effort:
// dead endpoints (404/410) are pruned; one failure never throws to the caller.
// payload: { title, body, url? }
export async function sendPushToUser(userSub, payload) {
  if (!PUSH_ACTIVE) return { skipped: "inactive" };
  if (!userSub) return { skipped: "no_user" };
  let wp;
  try { wp = await _getWebPush(); }
  catch (e) { console.error("[push] web-push module unavailable:", e.message); return { skipped: "no_module" }; }
  const subs = await dbListPushSubscriptionsForUser(userSub);
  if (!subs.length) return { sent: 0, pruned: 0, no_subs: true };
  const body = JSON.stringify(payload || {});
  let sent = 0, pruned = 0;
  for (const sub of subs) {
    try {
      await wp.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, body);
      sent++;
    } catch (err) {
      const code = err?.statusCode;
      if (code === 404 || code === 410) { await dbDeletePushSubscription(sub.endpoint); pruned++; }
      else console.warn("[push] send failed:", code, err?.message);
    }
  }
  return { sent, pruned };
}
