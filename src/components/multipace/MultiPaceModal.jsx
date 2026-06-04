// src/components/multipace/MultiPaceModal.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { parsePaceMSS } from "../../app.jsx";

    const { useState } = React;

    export function MultiPaceModal({ workout, generateForTarget, lanePlansForTarget, onClose, onPreview }) {
      // Default: plan source if a default plan exists, else manual.
      const defaultPlan = (lanePlansForTarget || []).find(p => p.is_default) || (lanePlansForTarget || [])[0] || null;
      const [source, setSource] = React.useState(defaultPlan ? "plan" : "manual");
      const [planId, setPlanId] = React.useState(defaultPlan ? defaultPlan.id : null);
      const [manual, setManual] = React.useState([
        { lane_label: "Lane 1", pace: "1:30" },
        { lane_label: "Lane 2", pace: "1:40" },
        { lane_label: "Lane 3", pace: "1:50" },
      ]);
      const [mode, setMode] = React.useState("per_lane"); // per_lane | matrix
      const [err,  setErr]  = React.useState(null);

      const currentPlan = source === "plan"
        ? (lanePlansForTarget || []).find(p => p.id === planId) || null
        : null;

      // Derive lanes preview (read-only) from the chosen source.
      const planLanes = currentPlan && currentPlan.plan_data && Array.isArray(currentPlan.plan_data.lanes)
        ? currentPlan.plan_data.lanes.map((l, i) => ({
            lane_label: l.lane_label || `Lane ${i + 1}`,
            pace: l.pace || "",
            // Phase 3 PSC slice 4 — preserve members so the per-lane print
            // view can render per-swimmer substitution annotations.
            members: Array.isArray(l.members) ? l.members : [],
          }))
        : [];

      const previewLanes = source === "plan" ? planLanes : manual;

      const addManualRow  = () => setManual(prev => [...prev, { lane_label: `Lane ${prev.length + 1}`, pace: "" }]);
      const removeManual  = (idx) => setManual(prev => prev.filter((_, i) => i !== idx));
      const updateManual  = (idx, field, val) => setManual(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));

      const submit = () => {
        setErr(null);
        const lanes = previewLanes.filter(l => l && l.pace);
        if (!lanes.length) { setErr("Need at least one lane with a pace."); return; }
        for (const l of lanes) {
          if (parsePaceMSS(l.pace) === null) {
            setErr(`"${l.pace}" isn't a valid pace — use M:SS between 0:30 and 5:00.`);
            return;
          }
        }
        onPreview({ lanes, mode });
      };

      const headerLabel = generateForTarget?.name || "Group";

      return (
        <div onClick={onClose} className="modal-overlay" style={{ padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 12,
            padding: 22, maxWidth: 640, width: "100%", maxHeight: "90vh", overflowY: "auto",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <div style={{ color: "var(--color-warn)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>Multi-pace print</div>
                <div style={{ color: "var(--color-text)", fontSize: 18, fontWeight: 700, marginTop: 2 }}>{headerLabel}</div>
              </div>
              <button onClick={onClose} style={{
                background: "transparent", border: "none", color: "var(--color-text-muted)",
                fontSize: 22, cursor: "pointer", lineHeight: 1,
              }}>×</button>
            </div>

            {/* Source toggle */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {[
                { id: "plan",   label: "Use lane plan", disabled: !lanePlansForTarget || lanePlansForTarget.length === 0 },
                { id: "manual", label: "Manual entry",  disabled: false },
              ].map(opt => {
                const active = source === opt.id;
                return (
                  <button key={opt.id}
                    disabled={opt.disabled}
                    onClick={() => { setSource(opt.id); setErr(null); }}
                    style={{
                      flex: 1, padding: "9px 12px", borderRadius: 8,
                      border: `1px solid ${active ? "var(--color-warn)" : "var(--color-border)"}`,
                      background: active ? "rgba(245,158,11,0.18)" : "transparent",
                      color: opt.disabled ? "var(--color-border-strong)" : (active ? "var(--color-warn)" : "var(--color-text-muted)"),
                      fontSize: 13, fontWeight: 700,
                      cursor: opt.disabled ? "not-allowed" : "pointer",
                    }}>
                    {opt.label}
                    {opt.disabled && <span style={{ marginLeft: 6, fontSize: 10, color: "var(--color-border-strong)" }}>(no plans)</span>}
                  </button>
                );
              })}
            </div>

            {/* Plan picker */}
            {source === "plan" && lanePlansForTarget && lanePlansForTarget.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: "var(--color-text-muted)", display: "block", marginBottom: 5 }}>Plan</label>
                <select value={planId || ""} onChange={(e) => setPlanId(Number(e.target.value) || null)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-text)", fontSize: 13 }}>
                  {lanePlansForTarget.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.is_default ? " (default)" : ""}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Lane preview / manual entry */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
                Lanes ({previewLanes.length})
              </label>
              {source === "plan" && (
                <div style={{ border: "1px solid var(--color-border)", borderRadius: 6, background: "var(--color-card)" }}>
                  {previewLanes.length === 0 ? (
                    <div style={{ padding: 10, color: "var(--color-text-muted)", fontSize: 12, fontStyle: "italic" }}>
                      Selected plan has no lanes — pick another plan or switch to Manual entry.
                    </div>
                  ) : (
                    previewLanes.map((l, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 10px", borderTop: i === 0 ? "none" : "1px solid var(--color-border)", fontSize: 13, color: "var(--color-text)" }}>
                        <span>{l.lane_label}</span>
                        <span style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace", color: "var(--color-warn)" }}>{l.pace || "—"}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
              {source === "manual" && (
                <div>
                  {manual.map((row, i) => (
                    <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                      <input value={row.lane_label} onChange={(e) => updateManual(i, "lane_label", e.target.value)}
                        placeholder={`Lane ${i + 1}`}
                        style={{ flex: 2, padding: "7px 9px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-text)", fontSize: 13 }} />
                      <input value={row.pace} onChange={(e) => updateManual(i, "pace", e.target.value)}
                        placeholder="1:30"
                        style={{ flex: 1, padding: "7px 9px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-text)", fontSize: 13, fontFamily: "ui-monospace, SFMono-Regular, monospace" }} />
                      <button onClick={() => removeManual(i)} disabled={manual.length <= 1}
                        title="Remove lane"
                        style={{ padding: "0 10px", borderRadius: 6, border: "1px solid var(--color-border)", background: "transparent", color: manual.length <= 1 ? "var(--color-border-strong)" : "var(--color-text-muted)", cursor: manual.length <= 1 ? "not-allowed" : "pointer", fontSize: 14 }}>×</button>
                    </div>
                  ))}
                  <button onClick={addManualRow}
                    style={{ padding: "6px 12px", borderRadius: 6, border: "1px dashed var(--color-border)", background: "transparent", color: "var(--color-text-muted)", fontSize: 12, cursor: "pointer", marginTop: 2 }}>
                    + Add lane
                  </button>
                </div>
              )}
            </div>

            {/* Render mode */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>Render</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { id: "per_lane", label: "Per-lane pages", desc: "One page per lane, each full workout at that lane's pace" },
                  { id: "matrix",   label: "Matrix view",    desc: "Single page, N pace columns alongside the workout" },
                ].map(m => {
                  const active = mode === m.id;
                  return (
                    <button key={m.id} onClick={() => setMode(m.id)} title={m.desc}
                      style={{
                        flex: 1, padding: "9px 12px", borderRadius: 8,
                        border: `1px solid ${active ? "var(--color-warn)" : "var(--color-border)"}`,
                        background: active ? "rgba(245,158,11,0.18)" : "transparent",
                        color: active ? "var(--color-warn)" : "var(--color-text-muted)",
                        fontSize: 13, fontWeight: 700, cursor: "pointer",
                      }}>{m.label}</button>
                  );
                })}
              </div>
            </div>

            {err && (
              <div style={{ padding: "8px 10px", borderRadius: 6, background: "rgba(239,68,68,0.12)", border: "1px solid #ef4444", color: "#fca5a5", fontSize: 12, marginBottom: 12 }}>
                {err}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={onClose}
                style={{ padding: "9px 14px", borderRadius: 7, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={submit}
                style={{ padding: "9px 14px", borderRadius: 7, border: "1px solid var(--color-warn)", background: "rgba(245,158,11,0.18)", color: "var(--color-warn)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Preview & Print ▸
              </button>
            </div>
          </div>
        </div>
      );
    }
