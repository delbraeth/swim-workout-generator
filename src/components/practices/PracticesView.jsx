// src/components/practices/PracticesView.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { MarkPracticeDoneModal } from "./MarkPracticeDoneModal.jsx";

    const { useState, useCallback, useMemo, useEffect } = React;

    export function PracticesView() {
      const [list, setList]   = React.useState(null);   // null = loading
      const [err, setErr]     = React.useState(null);
      const [marking, setMarking] = React.useState(null);

      const fmtYmd = (d) => {
        const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${dd}`;
      };
      // Window: start of this week (local), 28 days forward.
      const { startStr, endStr } = React.useMemo(() => {
        const now = new Date();
        const start = new Date(now); start.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday
        const end = new Date(start); end.setDate(start.getDate() + 27);
        return { startStr: fmtYmd(start), endStr: fmtYmd(end) };
      }, []);

      const load = React.useCallback(async () => {
        setErr(null);
        try {
          const res = await fetch(`/api/scheduled-workouts?start=${startStr}&end=${endStr}`, { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const rows = await res.json();
          rows.sort((a, b) => (a.scheduled_date || "").localeCompare(b.scheduled_date || ""));
          setList(rows);
        } catch (e) { setList([]); setErr(e.message); }
      }, [startStr, endStr]);
      React.useEffect(() => { load(); }, [load]);

      const prettyDate = (ymdStr) => {
        if (!ymdStr) return "";
        const [y, m, d] = ymdStr.split("-").map(Number);
        const dt = new Date(y, (m || 1) - 1, d || 1);
        return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
      };

      return (
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h2 style={{ color: "var(--color-text)", fontSize: 20, fontWeight: 800, marginBottom: 4 }}>📋 Practices</h2>
          <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginBottom: 16 }}>
            Mark a practice done and record who attended. Shows your scheduled practices for the next four weeks.
          </p>
          {err && <div style={{ color: "var(--color-warn)", fontSize: 13, marginBottom: 12 }}>Couldn't load practices: {err}</div>}
          {list === null ? (
            <div style={{ color: "var(--color-text-dim)", fontSize: 13 }}>Loading…</div>
          ) : list.length === 0 ? (
            <div style={{ color: "var(--color-text-dim)", fontSize: 13, padding: "32px 0", textAlign: "center" }}>
              No scheduled practices in the next four weeks. Schedule one from the 📅 week view.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {list.map(sw => {
                const isIntent = sw.mode === "intent";
                const done = !!sw.completed_at;
                return (
                  <div key={sw.id} className="card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: "var(--color-text)", fontWeight: 700, fontSize: 14 }}>{prettyDate(sw.scheduled_date)}</div>
                      <div style={{ color: "var(--color-text-dim)", fontSize: 11 }}>
                        {sw.facility_name ? sw.facility_name + " · " : ""}{isIntent ? "Planned (generate first)" : (done ? "Attendance recorded" : "Not yet recorded")}
                      </div>
                    </div>
                    {isIntent ? (
                      <span style={{ fontSize: 11, color: "var(--color-text-dim)" }}>—</span>
                    ) : (
                      <button onClick={() => setMarking(sw)}
                        style={{ padding: "6px 12px", border: "1px solid var(--color-primary)", borderRadius: 6,
                          background: done ? "transparent" : "var(--color-primary)",
                          color: done ? "var(--color-primary)" : "var(--color-bg)",
                          fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                        {done ? "Edit attendance" : "📋 Mark done"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {marking && (
            <MarkPracticeDoneModal
              sw={marking}
              onClose={() => setMarking(null)}
              onSaved={() => { setMarking(null); load(); }}
            />
          )}
        </div>
      );
    }
