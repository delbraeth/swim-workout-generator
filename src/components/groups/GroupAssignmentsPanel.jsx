// src/components/groups/GroupAssignmentsPanel.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { csrfHeaders, COMPLETION_LABELS } from "../../app.jsx";

    const { useState, useCallback, useEffect } = React;

    export function GroupAssignmentsPanel({ groupId, isGroupCoach }) {
      const [list, setList] = React.useState(null);
      const [err,  setErr]  = React.useState(null);

      const load = React.useCallback(async () => {
        try {
          const res = await fetch(`/api/groups/${groupId}/assignments`, { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setList(await res.json());
        } catch (e) { setErr(e.message); setList([]); }
      }, [groupId]);
      React.useEffect(() => { if (isGroupCoach) load(); }, [isGroupCoach, load]);

      const markState = async (assignmentId, state) => {
        try {
          const res = await fetch(`/api/assignments/${assignmentId}`, {
            method:  "PATCH",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({ completion_state: state }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          await load();
        } catch (e) { setErr(e.message); }
      };

      if (!isGroupCoach) return null;

      return (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Recent assignments ({list ? list.length : "—"})
            </div>
          </div>
          {err && <div style={{ color: "#fca5a5", fontSize: 11, marginBottom: 6 }}>{err}</div>}
          {!list ? (
            <div style={{ fontSize: 12, color: "var(--color-text-dim)", fontStyle: "italic" }}>Loading…</div>
          ) : list.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--color-text-dim)", fontStyle: "italic" }}>No assignments yet. Generate a workout for this group to start the loop.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 280, overflow: "auto" }}>
              {list.map(a => {
                const meta = COMPLETION_LABELS[a.completion_state] || COMPLETION_LABELS.not_started;
                const isCoachMarked = !!a.completed_by_coach_sub;
                return (
                  <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 9px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 4, fontSize: 11 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: "#cbd5e1", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {a.target_name || "(unknown)"} · {a.workout_type} {a.workout_total_yards}
                        {a.lane_label && <span style={{ color: "var(--color-text-dim)" }}> · {a.lane_label}</span>}
                      </div>
                      <div style={{ color: "var(--color-text-dim)", fontSize: 10 }}>
                        {new Date(a.assigned_at).toLocaleDateString()} · <span style={{ color: meta.color, fontWeight: 700 }}>{meta.label}</span>
                        {isCoachMarked && <span style={{ color: "var(--color-warn)" }}> (by coach)</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 3 }}>
                      {a.completion_state !== "complete" && <button onClick={() => markState(a.id, "complete")} title="Mark complete" style={{ padding: "2px 7px", background: "transparent", color: "var(--color-positive)", border: "1px solid #22c55e", borderRadius: 3, fontSize: 10, cursor: "pointer" }}>✓</button>}
                      {a.completion_state !== "partial"  && <button onClick={() => markState(a.id, "partial")}  title="Mark partial"  style={{ padding: "2px 7px", background: "transparent", color: "var(--color-warn)", border: "1px solid var(--color-warn)", borderRadius: 3, fontSize: 10, cursor: "pointer" }}>◐</button>}
                      {a.completion_state !== "missed"   && <button onClick={() => markState(a.id, "missed")}   title="Mark missed"   style={{ padding: "2px 7px", background: "transparent", color: "var(--color-destructive)", border: "1px solid #ef4444", borderRadius: 3, fontSize: 10, cursor: "pointer" }}>✕</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }
