// src/components/profile/PushNotificationsPanel.jsx — Web Push opt-in.
// Self-hides unless VAPID is configured server-side (cfg.active). Registers the
// /sw.js service worker, requests permission, subscribes via PushManager, and
// stores the subscription server-side. React is a runtime global.
import { csrfHeaders } from "../../lib/api.js";

function urlB64ToUint8(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const b64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function PushNotificationsPanel() {
  const [cfg, setCfg] = React.useState(null);   // {active, vapid_public_key}
  const [sub, setSub] = React.useState(undefined); // undefined=loading | null=none | obj
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);

  const supported = typeof navigator !== "undefined" && "serviceWorker" in navigator
    && typeof window !== "undefined" && "PushManager" in window && "Notification" in window;

  React.useEffect(() => {
    fetch("/api/push/config", { cache: "no-store" }).then(r => r.json()).then(setCfg).catch(() => setCfg({ active: false }));
  }, []);
  React.useEffect(() => {
    if (!supported) { setSub(null); return; }
    navigator.serviceWorker.getRegistration()
      .then(reg => reg ? reg.pushManager.getSubscription() : null)
      .then(s => setSub(s || null)).catch(() => setSub(null));
  }, [supported]);

  if (!cfg || !cfg.active) return null;  // inert until VAPID keys configured

  const card = { marginTop: 16, padding: 14, borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--color-card)" };
  const btn = (bg, color) => ({ padding: "7px 14px", border: "none", borderRadius: 6, background: bg, color, fontSize: 13, fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1 });

  const enable = async () => {
    setBusy(true); setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setMsg("Notifications are blocked in your browser settings."); setBusy(false); return; }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(cfg.vapid_public_key) });
      const r = await fetch("/api/push/subscribe", {
        method: "POST", headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ subscription: s.toJSON() }),
      });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || `HTTP ${r.status}`); }
      setSub(s); setMsg("Browser notifications enabled.");
    } catch (e) { setMsg(`Couldn't enable: ${e.message}`); }
    setBusy(false);
  };

  const disable = async () => {
    setBusy(true); setMsg(null);
    try {
      if (sub) {
        const ep = sub.endpoint;
        await sub.unsubscribe().catch(() => {});
        await fetch("/api/push/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json", ...csrfHeaders() }, body: JSON.stringify({ endpoint: ep }) });
      }
      setSub(null); setMsg("Disabled.");
    } catch (e) { setMsg(`Couldn't disable: ${e.message}`); }
    setBusy(false);
  };

  const test = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/push/test", { method: "POST", headers: csrfHeaders() });
      const j = await r.json().catch(() => ({}));
      setMsg(j.sent > 0 ? "Test sent — check your notifications." : (j.no_subs ? "No active subscription on this browser." : "Sent."));
    } catch (e) { setMsg(`Test failed: ${e.message}`); }
    setBusy(false);
  };

  return (
    <div style={card}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>🔔 Browser notifications</div>
      <p style={{ fontSize: 12, color: "var(--color-text-dim)", marginTop: 0, marginBottom: 10 }}>
        Get notified in this browser when it lands — practice/meet RSVP reminders, cancellations, and more. Optional, per-device.
      </p>
      {!supported ? (
        <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>This browser doesn't support push notifications.</div>
      ) : sub === undefined ? (
        <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Checking…</div>
      ) : sub ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={test} disabled={busy} style={btn("var(--color-primary)", "var(--color-bg)")}>Send test</button>
          <button onClick={disable} disabled={busy} style={btn("var(--color-border)", "#cbd5e1")}>Disable on this browser</button>
        </div>
      ) : (
        <button onClick={enable} disabled={busy} style={btn("var(--color-positive)", "var(--color-bg)")}>
          {busy ? "Enabling…" : "Enable browser notifications"}
        </button>
      )}
      {msg && <div style={{ fontSize: 12, marginTop: 8, color: /can.t|failed|blocked/i.test(msg) ? "var(--color-warn)" : "var(--color-positive)" }}>{msg}</div>}
    </div>
  );
}
