// src/components/coach/CalendarFeedSection.jsx — Phase 5 Slice A (export bridges).
// Surfaces the coach's live-subscribe calendar feed URL (practices + team events),
// with copy + regenerate. The URL is a tokenized public .ics feed the coach pastes
// into Apple/Google Calendar; it auto-updates as the schedule changes. Regenerate
// rotates the token (revokes the old URL). React is a runtime global.
import { API_BASE, csrfHeaders } from "../../lib/api.js";

export function CalendarFeedSection() {
  const [url, setUrl]       = React.useState(null);
  const [busy, setBusy]     = React.useState(false);
  const [msg, setMsg]       = React.useState(null);
  const [copied, setCopied] = React.useState(false);

  const load = React.useCallback(async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`${API_BASE}/me/calendar-token`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setUrl(j.url);
    } catch (e) { setMsg(`Couldn’t load your link: ${e.message}`); } finally { setBusy(false); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const rotate = async () => {
    if (!window.confirm("Generate a new link? Any calendar already subscribed to the old link will stop updating.")) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`${API_BASE}/me/calendar-token/rotate`, { method: "POST", headers: { ...csrfHeaders() } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setUrl(j.url); setCopied(false);
    } catch (e) { setMsg(`Couldn’t regenerate: ${e.message}`); } finally { setBusy(false); }
  };

  const copy = async () => {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch (_) { setMsg("Copy failed — select the link and copy manually."); }
  };

  const inputStyle = { flex: 1, minWidth: 180, padding: "6px 9px", fontSize: 12, fontFamily: "monospace", background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 5 };
  const btn = { fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-primary)", cursor: "pointer", whiteSpace: "nowrap" };

  return (
    <div style={{ marginTop: 24, padding: 16, borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--color-card)" }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>📆 Calendar feed</div>
      <p style={{ fontSize: 12, color: "var(--color-text-dim)", marginTop: 0, marginBottom: 10 }}>
        Subscribe in Apple or Google Calendar to see your scheduled practices + team events. It updates automatically — paste this URL as a new calendar subscription (not a one-time import).
      </p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <input readOnly value={url || (busy ? "Loading…" : "")} onFocus={e => e.target.select()} style={inputStyle} />
        <button onClick={copy} disabled={!url || busy} style={btn}>{copied ? "Copied ✓" : "Copy"}</button>
        <button onClick={rotate} disabled={busy} style={{ ...btn, color: "var(--color-text-muted)" }}>Regenerate</button>
      </div>
      {msg && <div style={{ color: "var(--color-warn)", fontSize: 12, marginTop: 8 }}>{msg}</div>}
    </div>
  );
}
