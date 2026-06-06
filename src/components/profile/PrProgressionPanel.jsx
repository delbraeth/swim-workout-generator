// src/components/profile/PrProgressionPanel.jsx — eval 2026-06-06 #7.
// Per-event PR progression ("am I getting faster?"): a dependency-free inline
// SVG line per event+course over the dated PR history, plus a "log a result"
// form. Reads/writes /api/me/event-pr-history (or the managed variant). Faster
// (lower) times plot HIGHER, so an improving event trends upward. React global.
import { csrfHeaders } from "../../lib/api.js";
import { RACE_EVENTS, eventLabel, parseRaceTime, formatRaceTime } from "../../lib/raceEvents.js";

const COURSE_LABEL = { "25y": "SCY", "25m": "SCM", "50m": "LCM" };
const todayYmd = () => new Date().toISOString().slice(0, 10);

function Sparkline({ points }) {
  // points: [{achieved_on, time_secs}] sorted ascending by date.
  const W = 300, H = 56, pad = 8;
  if (points.length === 1) {
    return <svg width={W} height={H} role="img" aria-label="single result">
      <circle cx={W / 2} cy={H / 2} r={4} fill="var(--color-primary)" />
    </svg>;
  }
  const times = points.map(p => p.time_secs);
  const minT = Math.min(...times), maxT = Math.max(...times);
  const range = (maxT - minT) || 1;
  const n = points.length;
  const x = i => pad + (i / (n - 1)) * (W - 2 * pad);
  const y = t => pad + ((t - minT) / range) * (H - 2 * pad); // fastest (minT) at top
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.time_secs).toFixed(1)}`).join(" ");
  return (
    <svg width={W} height={H} role="img" aria-label="progression">
      <polyline points={points.map((p, i) => `${x(i)},${y(p.time_secs)}`).join(" ")}
        fill="none" stroke="var(--color-primary)" strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.time_secs)} r={i === n - 1 ? 3.5 : 2.5}
          fill={p.time_secs === minT ? "var(--color-positive)" : "var(--color-primary)"} />
      ))}
    </svg>
  );
}

export function PrProgressionPanel({ endpoint = "/api/me/event-pr-history" }) {
  const [rows, setRows] = React.useState(null);
  const [msg, setMsg]   = React.useState(null);
  const [form, setForm] = React.useState({ event: "free_100", course: "25y", time: "", date: todayYmd(), note: "" });
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try { const r = await fetch(endpoint, { cache: "no-store" }); setRows(r.ok ? await r.json() : []); }
    catch (_) { setRows([]); }
  }, [endpoint]);
  React.useEffect(() => { load(); }, [load]);

  const submit = async () => {
    setMsg(null);
    const secs = parseRaceTime(form.time);
    if (secs == null) { setMsg(`"${form.time}" isn't a valid time — use M:SS.xx (e.g. 1:52.34)`); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) { setMsg("Pick a valid date."); return; }
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ event: form.event, course: form.course, time_secs: secs, achieved_on: form.date, note: form.note || null }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setForm(f => ({ ...f, time: "", note: "" }));
      setMsg(j.promoted ? "Logged — new PR! 🎉" : "Logged.");
      await load();
    } catch (e) { setMsg(`Save failed: ${e.message}`); }
    finally { setBusy(false); }
  };

  const remove = async (id) => {
    if (!window.confirm("Remove this result?")) return;
    try { await fetch(`${endpoint}/${id}`, { method: "DELETE", headers: csrfHeaders() }); await load(); }
    catch (_) {}
  };

  if (rows === null) return null;

  // Group by event+course, sorted by date ascending.
  const groups = {};
  for (const r of rows) {
    const k = `${r.event}__${r.course}`;
    (groups[k] ||= []).push(r);
  }
  Object.values(groups).forEach(g => g.sort((a, b) => a.achieved_on.localeCompare(b.achieved_on)));
  const groupKeys = Object.keys(groups).sort();

  const card  = { background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: 16, marginBottom: 16 };
  const muted = { color: "var(--color-text-muted)", fontSize: 12 };
  const ctrl  = { padding: "6px 9px", fontSize: 13, borderRadius: 5, background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)" };

  return (
    <div style={card}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Event PRs · progression</div>

      {groupKeys.length === 0 ? (
        <div style={muted}>No race results yet. Log one below — your best time and a per-event trend will show here. (Setting a PR in 🎯 Race goals also logs a point.)</div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {groupKeys.map(k => {
            const g = groups[k];
            const [ev, course] = k.split("__");
            const best = Math.min(...g.map(p => p.time_secs));
            const latest = g[g.length - 1];
            const improved = g.length >= 2 ? (g[g.length - 1].time_secs < g[0].time_secs) : null;
            return (
              <div key={k} style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>
                    {eventLabel(ev)} <span style={{ ...muted, fontWeight: 600 }}>{COURSE_LABEL[course] || course}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--color-text)", fontVariantNumeric: "tabular-nums" }}>
                    PR <strong>{formatRaceTime(best)}</strong>
                    {improved != null && <span style={{ marginLeft: 8, color: improved ? "var(--color-positive)" : "var(--color-text-dim)" }}>{improved ? "▲ improving" : "—"}</span>}
                  </div>
                </div>
                <Sparkline points={g} />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  {g.slice(-6).map(p => (
                    <span key={p.id} title={p.note || ""} style={{ ...muted, fontVariantNumeric: "tabular-nums", display: "inline-flex", alignItems: "center", gap: 3, background: "var(--color-bg)", borderRadius: 4, padding: "1px 6px" }}>
                      {p.achieved_on.slice(5)} · {formatRaceTime(p.time_secs)}
                      <button onClick={() => remove(p.id)} aria-label="remove result" style={{ background: "none", border: "none", color: "var(--color-text-dim)", cursor: "pointer", fontSize: 12, padding: 0, lineHeight: 1 }}>×</button>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Log a result */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--color-border)" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text)", marginBottom: 8 }}>Log a result</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <select value={form.event} onChange={e => setForm(f => ({ ...f, event: e.target.value }))} aria-label="Event" style={ctrl}>
            {RACE_EVENTS.map(ev => <option key={ev.id} value={ev.id}>{ev.label}</option>)}
          </select>
          <select value={form.course} onChange={e => setForm(f => ({ ...f, course: e.target.value }))} aria-label="Course" style={ctrl}>
            {Object.entries(COURSE_LABEL).map(([id, lab]) => <option key={id} value={id}>{lab}</option>)}
          </select>
          <input value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} placeholder="M:SS.xx" aria-label="Time"
            style={{ ...ctrl, width: 90, fontFamily: "monospace", textAlign: "center" }} />
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} aria-label="Date" style={ctrl} />
          <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="note (optional)" aria-label="Note" style={{ ...ctrl, flex: 1, minWidth: 100 }} />
          <button onClick={submit} disabled={busy}
            style={{ padding: "7px 14px", background: "var(--color-positive)", color: "var(--color-bg)", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1 }}>
            {busy ? "Saving…" : "Log"}
          </button>
        </div>
        {msg && <div style={{ fontSize: 12, marginTop: 8, color: /failed|valid|date/.test(msg) ? "var(--color-warn)" : "var(--color-positive)" }}>{msg}</div>}
      </div>
    </div>
  );
}
