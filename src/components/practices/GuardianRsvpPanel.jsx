// src/components/practices/GuardianRsvpPanel.jsx — D1 (2026-06-09).
// A guardian RSVPs to a CONSENTED real-account child's upcoming practices & meets.
// Mirrors RsvpEventsPanel but targets the child via swimmer_sub. Renders nothing
// when the child has nothing upcoming or hasn't opted in (endpoint 403 → hidden).
// React is a runtime global.
import { csrfHeaders } from "../../lib/api.js";
import { eventKindEmoji } from "../../lib/eventKinds.js";

const OPTS = [
  { v: "going", label: "✅ Going", color: "var(--color-positive)" },
  { v: "maybe", label: "🤔 Maybe", color: "var(--color-warn)" },
  { v: "out",   label: "❌ Out",   color: "var(--color-destructive-text)" },
];

export function GuardianRsvpPanel({ swimmerSub, displayName }) {
  const [events, setEvents]       = React.useState(null);
  const [practices, setPractices] = React.useState(null);
  const [busyId, setBusyId]       = React.useState(null);
  const [msg, setMsg]             = React.useState(null);

  const load = React.useCallback(async () => {
    try {
      const r = await fetch(`/api/parent/swimmers/${encodeURIComponent(swimmerSub)}/upcoming`, { cache: "no-store" });
      if (r.ok) { const j = await r.json(); setEvents(j.events || []); setPractices(j.practices || []); }
      else { setEvents([]); setPractices([]); }
    } catch (_) { setEvents([]); setPractices([]); }
  }, [swimmerSub]);
  React.useEffect(() => { load(); }, [load]);

  const sendRsvp = async (kind, id, status, busyKey, setList) => {
    setBusyId(busyKey); setMsg(null);
    try {
      const r = await fetch("/api/rsvp", {
        method: "PUT", headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ target_kind: kind, target_id: id, status, swimmer_sub: swimmerSub }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setList(list => list.map(x => x.id === id ? { ...x, my_rsvp: status } : x));
    } catch (e) { setMsg(`Couldn't save: ${e.message}`); }
    setBusyId(null);
  };

  const noE = !events || events.length === 0;
  const noP = !practices || practices.length === 0;
  if (noE && noP) return null;

  const rsvpBtns = (cur, onPick, busy) => (
    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
      {OPTS.map(o => {
        const on = cur === o.v;
        return (
          <button key={o.v} onClick={() => onPick(o.v)} disabled={busy}
            style={{ padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: busy ? "wait" : "pointer",
              border: `1px solid ${on ? o.color : "var(--color-border-strong)"}`,
              background: on ? o.color : "transparent",
              color: on ? "var(--color-bg)" : "var(--color-text-muted)" }}>{o.label}</button>
        );
      })}
    </div>
  );

  const card = { background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: 16, marginBottom: 16 };
  const muted = { color: "var(--color-text-muted)", fontSize: 12 };

  return (
    <div style={card}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
        📅 RSVP for {displayName || "your swimmer"}
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {!noP && practices.map(p => (
          <div key={`p${p.id}`} style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span style={{ color: "var(--color-text)", fontWeight: 700, fontSize: 14 }}>🏊 {p.group_name || "Practice"}</span>
              <span style={muted}>{p.team_name ? `${p.team_name} · ` : ""}{p.scheduled_date}</span>
            </div>
            {rsvpBtns(p.my_rsvp, (v) => sendRsvp("practice", p.id, v, `p${p.id}`, setPractices), busyId === `p${p.id}`)}
          </div>
        ))}
        {!noE && events.map(ev => {
          const cancelled = ev.status === "cancelled";
          return (
            <div key={`e${ev.id}`} style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span style={{ color: "var(--color-text)", fontWeight: 700, fontSize: 14, textDecoration: cancelled ? "line-through" : "none" }}>
                  {eventKindEmoji(ev.kind)} {ev.name}
                </span>
                <span style={muted}>{ev.team_name ? `${ev.team_name} · ` : ""}{ev.date}{ev.start_time ? ` · ${ev.start_time}` : ""}</span>
              </div>
              {cancelled
                ? <div style={{ ...muted, marginTop: 6, fontStyle: "italic" }}>RSVP closed — cancelled.</div>
                : rsvpBtns(ev.my_rsvp, (v) => sendRsvp("meet", ev.id, v, `e${ev.id}`, setEvents), busyId === `e${ev.id}`)}
            </div>
          );
        })}
      </div>
      {msg && <div style={{ color: "var(--color-warn)", fontSize: 12, marginTop: 8 }}>{msg}</div>}
    </div>
  );
}
