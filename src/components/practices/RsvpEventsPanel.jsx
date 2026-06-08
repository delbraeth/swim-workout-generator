// src/components/practices/RsvpEventsPanel.jsx — Phase 5 #5 Slice B2.
// Swimmer-facing RSVP: upcoming team events with a going/maybe/out control.
// Reads /api/events/upcoming (carries my_rsvp + status), writes PUT /api/rsvp.
// Cancelled events show struck-through + CANCELLED and freeze RSVP. React global.
import { csrfHeaders } from "../../lib/api.js";
import { eventKindEmoji } from "../../lib/eventKinds.js";
import { WeatherChip } from "../teams/WeatherChip.jsx";

const OPTS = [
  { v: "going", label: "✅ Going",  color: "var(--color-positive)" },
  { v: "maybe", label: "🤔 Maybe",  color: "var(--color-warn)" },
  { v: "out",   label: "❌ Out",    color: "var(--color-destructive-text)" },
];

export function RsvpEventsPanel() {
  const [events, setEvents] = React.useState(null);
  const [practices, setPractices] = React.useState(null);   // C2
  const [busyId, setBusyId] = React.useState(null);
  const [msg, setMsg] = React.useState(null);      // events card
  const [pmsg, setPmsg] = React.useState(null);    // practices card

  const load = React.useCallback(async () => {
    try { const r = await fetch("/api/events/upcoming", { cache: "no-store" }); setEvents(r.ok ? await r.json() : []); }
    catch (_) { setEvents([]); }
    try { const r = await fetch("/api/me/practices/upcoming", { cache: "no-store" }); setPractices(r.ok ? await r.json() : []); }
    catch (_) { setPractices([]); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const noEvents = events === null || events.length === 0;
  const noPractices = practices === null || practices.length === 0;
  if (noEvents && noPractices) return null;  // nothing upcoming → hide

  const setRsvp = async (ev, status) => {
    setBusyId(ev.id); setMsg(null);
    try {
      const r = await fetch("/api/rsvp", {
        method: "PUT", headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ target_kind: "meet", target_id: ev.id, status }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setEvents(list => list.map(e => e.id === ev.id ? { ...e, my_rsvp: status } : e));
    } catch (e) { setMsg(`Couldn't save: ${e.message}`); }
    setBusyId(null);
  };

  // C2 — RSVP to a practice (scheduled_workout). Same control, different target.
  const setPracticeRsvp = async (p, status) => {
    setBusyId(`p${p.id}`); setPmsg(null);
    try {
      const r = await fetch("/api/rsvp", {
        method: "PUT", headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ target_kind: "practice", target_id: p.id, status }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setPractices(list => list.map(x => x.id === p.id ? { ...x, my_rsvp: status } : x));
    } catch (e) { setPmsg(`Couldn't save: ${e.message}`); }
    setBusyId(null);
  };

  const card = { background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: 16, marginBottom: 16 };
  const muted = { color: "var(--color-text-muted)", fontSize: 12 };

  return (
   <React.Fragment>
    {!noPractices && (
      <div style={card}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>🏊 Upcoming practices · RSVP</div>
        <div style={{ display: "grid", gap: 10 }}>
          {practices.map(p => {
            const busy = busyId === `p${p.id}`;
            return (
              <div key={p.id} style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <div>
                    <span style={{ color: "var(--color-text)", fontWeight: 700, fontSize: 14 }}>{p.group_name || "Practice"}</span>
                    {p.facility_name && <span style={{ marginLeft: 8, color: "var(--color-text-dim)", fontSize: 12 }}>🏟 {p.facility_name}</span>}
                  </div>
                  <span style={muted}>{p.team_name ? `${p.team_name} · ` : ""}{p.scheduled_date}</span>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  {OPTS.map(o => {
                    const on = p.my_rsvp === o.v;
                    return (
                      <button key={o.v} onClick={() => setPracticeRsvp(p, o.v)} disabled={busy}
                        style={{ padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: busy ? "wait" : "pointer",
                          border: `1px solid ${on ? o.color : "var(--color-border-strong)"}`,
                          background: on ? o.color : "transparent",
                          color: on ? "var(--color-bg)" : "var(--color-text-muted)" }}>
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {pmsg && <div style={{ color: "var(--color-warn)", fontSize: 12, marginTop: 8 }}>{pmsg}</div>}
      </div>
    )}
    {!noEvents && (
    <div style={card}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>📅 Upcoming events · RSVP</div>
      <div style={{ display: "grid", gap: 10 }}>
        {events.map(ev => {
          const cancelled = ev.status === "cancelled";
          return (
            <div key={ev.id} style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <div>
                  <span style={{ marginRight: 6 }}>{eventKindEmoji(ev.kind)}</span>
                  <span style={{ color: "var(--color-text)", fontWeight: 700, fontSize: 14, textDecoration: cancelled ? "line-through" : "none" }}>{ev.name}</span>
                  {ev.venue && <span style={{ marginLeft: 8, color: "var(--color-text-dim)", fontSize: 12 }}>{ev.venue.indoor_outdoor === "outdoor" ? "🌤" : "🏟"} {ev.venue.name}</span>}
                  {ev.venue && ev.venue.indoor_outdoor === "outdoor" && !cancelled && <WeatherChip eventId={ev.id} />}
                  {cancelled && <span title={ev.status_note || ""} style={{ marginLeft: 8, fontSize: 10, padding: "1px 6px", borderRadius: 3, background: "rgba(239,68,68,0.15)", color: "var(--color-destructive-text)", fontWeight: 700 }}>CANCELLED{ev.status_note ? ` — ${ev.status_note}` : ""}</span>}
                </div>
                <span style={muted}>{ev.team_name ? `${ev.team_name} · ` : ""}{ev.date}{ev.start_time ? ` · ${ev.start_time}` : ""}</span>
              </div>
              {cancelled ? (
                <div style={{ ...muted, marginTop: 6, fontStyle: "italic" }}>RSVP closed — event cancelled.</div>
              ) : (
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  {OPTS.map(o => {
                    const on = ev.my_rsvp === o.v;
                    return (
                      <button key={o.v} onClick={() => setRsvp(ev, o.v)} disabled={busyId === ev.id}
                        style={{ padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: busyId === ev.id ? "wait" : "pointer",
                          border: `1px solid ${on ? o.color : "var(--color-border-strong)"}`,
                          background: on ? o.color : "transparent",
                          color: on ? "var(--color-bg)" : "var(--color-text-muted)" }}>
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {msg && <div style={{ color: "var(--color-warn)", fontSize: 12, marginTop: 8 }}>{msg}</div>}
    </div>
    )}
   </React.Fragment>
  );
}
