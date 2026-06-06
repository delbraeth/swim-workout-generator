// src/components/profile/RaceGoalsPanel.jsx — Phase 5 #4 (HS race-pace).
// Enter per-event goal + PR times that anchor race-pace set targets. Reusable for
// the swimmer themselves (endpoint="/api/me/event-times") and for a coach's managed
// swimmer (endpoint="/api/managed-swimmers/<id>/event-times"). Times are SCY by
// default; enter as M:SS.xx or seconds. React is a runtime global.
import { csrfHeaders } from "../../lib/api.js";
import { RACE_EVENTS, parseRaceTime, formatRaceTime } from "../../lib/raceEvents.js";

export function RaceGoalsPanel({ endpoint, course = "25y", heading = "🎯 Race goals / PRs" }) {
  const [rows, setRows]   = React.useState(null);  // null = loading
  const [drafts, setDrafts] = React.useState({});  // `${event}_${kind}` → typed string
  const [msg, setMsg]     = React.useState(null);

  const load = React.useCallback(async () => {
    try {
      const r = await fetch(endpoint, { cache: "no-store" });
      const a = r.ok ? await r.json() : [];
      setRows(Array.isArray(a) ? a : []);
    } catch (_) { setRows([]); }
  }, [endpoint]);
  React.useEffect(() => { load(); }, [load]);

  // Current saved times for this course → { event: { goal, pr } }.
  const byEvent = {};
  for (const r of (rows || [])) {
    if (r.course !== course) continue;
    (byEvent[r.event] ||= {})[r.kind] = r.time_secs;
  }

  const cellValue = (event, kind) => {
    const k = `${event}_${kind}`;
    if (k in drafts) return drafts[k];
    const secs = byEvent[event] && byEvent[event][kind];
    return secs != null ? formatRaceTime(secs) : "";
  };

  const save = async (event, kind) => {
    const k = `${event}_${kind}`;
    const raw = (drafts[k] ?? "").trim();
    setMsg(null);
    try {
      if (raw === "") {
        const existing = (rows || []).find(r => r.event === event && r.kind === kind && r.course === course);
        if (existing) {
          const res = await fetch(`${endpoint}/${existing.id}`, { method: "DELETE", headers: csrfHeaders() });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        }
      } else {
        const secs = parseRaceTime(raw);
        if (secs == null) { setMsg(`"${raw}" isn't a valid time — use M:SS.xx (e.g. 1:52.34)`); return; }
        const res = await fetch(endpoint, {
          method: "PUT", headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ event, course, kind, time_secs: secs }),
        });
        if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `HTTP ${res.status}`); }
      }
      setDrafts(d => { const n = { ...d }; delete n[k]; return n; });
      await load();
    } catch (e) { setMsg(`Save failed: ${e.message}`); }
  };

  if (rows === null) return null;

  const inp = { width: 76, padding: "4px 7px", fontSize: 13, fontFamily: "monospace", textAlign: "center",
    background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 5 };

  return (
    <div style={{ marginTop: 16, padding: 14, borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--color-card)" }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{heading}</div>
      <p style={{ fontSize: 12, color: "var(--color-text-dim)", marginTop: 0, marginBottom: 10 }}>
        Short-course yards. These set the target splits for Race-Pace workouts — goal is used first, PR as a fallback.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "6px 10px", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)" }}>Event</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)", textAlign: "center" }}>Goal</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)", textAlign: "center" }}>PR</span>
        {RACE_EVENTS.map(ev => (
          <React.Fragment key={ev.id}>
            <span style={{ fontSize: 13, color: "var(--color-text)" }}>{ev.label}</span>
            {["goal", "pr"].map(kind => {
              const k = `${ev.id}_${kind}`;
              return (
                <input key={kind} value={cellValue(ev.id, kind)} placeholder="—" aria-label={`${ev.label} ${kind}`}
                  onChange={e => setDrafts(d => ({ ...d, [k]: e.target.value }))}
                  onBlur={() => { if (k in drafts) save(ev.id, kind); }}
                  onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
                  style={inp} />
              );
            })}
          </React.Fragment>
        ))}
      </div>
      {msg && <div style={{ color: "var(--color-warn)", fontSize: 12, marginTop: 8 }}>{msg}</div>}
    </div>
  );
}
