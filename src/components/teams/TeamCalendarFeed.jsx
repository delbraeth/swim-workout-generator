// src/components/teams/TeamCalendarFeed.jsx — Phase 5 Slice A (export bridges).
// A team's live-subscribe calendar feed URL (team events + practices scheduled for
// the team's groups). Coaches copy it to share with the team's families; pasted as
// a calendar *subscription* it auto-updates. Rotate (owner/admin) revokes the old
// URL. React is a runtime global.
import { csrfHeaders } from "../../lib/api.js";

export function TeamCalendarFeed({ teamId, canManage = false }) {
  const [url, setUrl]       = React.useState(null);
  const [busy, setBusy]     = React.useState(false);
  const [msg, setMsg]       = React.useState(null);
  const [copied, setCopied] = React.useState(false);

  const load = React.useCallback(async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/teams/${teamId}/calendar-token`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setUrl(j.url);
    } catch (e) { setMsg(`Couldn’t load the link: ${e.message}`); } finally { setBusy(false); }
  }, [teamId]);
  React.useEffect(() => { load(); }, [load]);

  const rotate = async () => {
    if (!window.confirm(
      "⚠️ Regenerate the team calendar link?\n\n" +
      "This immediately breaks the current link. EVERY parent and swimmer who " +
      "subscribed or downloaded it will stop getting updates until you re-share the " +
      "new link with them.\n\n" +
      "Only do this if the link was shared outside the team or leaked."
    )) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/teams/${teamId}/calendar-token/rotate`, { method: "POST", headers: { ...csrfHeaders() } });
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
    <div style={{ marginBottom: 18 }}>
      <div style={{ color: "var(--color-primary)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
        📆 Calendar feed
      </div>
      <p style={{ fontSize: 12, color: "var(--color-text-dim)", marginTop: 0, marginBottom: 8 }}>
        Share this with the team — subscribe in Apple/Google Calendar to see team events + practices for this team’s groups. It updates automatically (paste as a new calendar subscription, not a one-time import).
      </p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <input readOnly value={url || (busy ? "Loading…" : "")} onFocus={e => e.target.select()} style={inputStyle} />
        <button onClick={copy} disabled={!url || busy} style={btn}>{copied ? "Copied ✓" : "Copy"}</button>
        {canManage && <button onClick={rotate} disabled={busy} style={{ ...btn, color: "var(--color-text-muted)" }}>Regenerate</button>}
      </div>
      {msg && <div style={{ color: "var(--color-warn)", fontSize: 12, marginTop: 8 }}>{msg}</div>}
    </div>
  );
}
