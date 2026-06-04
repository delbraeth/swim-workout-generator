// src/components/multipace/MultiLaneControl.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { parsePaceMSS } from "../../lib/format.js";

    export function MultiLaneControl({ multiLaneMode, setMultiLaneMode, manualLanesPace, setManualLanesPace, lanePlansForTarget, generateForPlanId }) {
      const currentPlan = (lanePlansForTarget || []).find(p => p.id === generateForPlanId) || null;
      const planLanes = currentPlan && currentPlan.plan_data && Array.isArray(currentPlan.plan_data.lanes)
        ? currentPlan.plan_data.lanes
        : null;
      const usePlanPrefill = () => {
        if (!planLanes || !planLanes.length) return;
        setManualLanesPace(planLanes.map((l, i) => ({
          lane_label: l.lane_label || `Lane ${i + 1}`,
          pace: l.pace || "",
        })));
      };
      const addRow = () => setManualLanesPace(prev => [
        ...prev,
        { lane_label: `Lane ${prev.length + 1}`, pace: "" },
      ]);
      const removeRow = (idx) => setManualLanesPace(prev =>
        prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev
      );
      const updateRow = (idx, field, val) => setManualLanesPace(prev =>
        prev.map((r, i) => i === idx ? { ...r, [field]: val } : r)
      );
      return (
        <div style={{ marginTop: -4, marginBottom: 14, padding: 10, border: "1px solid var(--color-border)", borderRadius: 8, background: "var(--color-card)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Multi-lane
            </span>
            <button
              type="button"
              onClick={() => setMultiLaneMode(v => !v)}
              title="When ON, the picker only chooses options whose intervals fit every lane's pace, and the result opens in the multi-pace print view."
              style={{
                fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6,
                border: "1px solid var(--color-border-strong)",
                background: multiLaneMode ? "var(--color-primary)" : "transparent",
                color: multiLaneMode ? "#fff" : "var(--color-text-dim)",
                cursor: "pointer",
              }}>
              {multiLaneMode ? "ON" : "OFF"}
            </button>
            {multiLaneMode && planLanes && planLanes.length > 0 && (
              <button
                type="button"
                onClick={usePlanPrefill}
                title={`Prefill from lane plan "${currentPlan?.name || "(default)"}"`}
                style={{
                  fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6,
                  border: "1px solid var(--color-border-strong)",
                  background: "transparent",
                  color: "var(--color-text-dim)",
                  cursor: "pointer",
                }}>
                Use lane plan
              </button>
            )}
          </div>
          {multiLaneMode && (
            <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
              {manualLanesPace.map((row, i) => {
                const isValid = row.pace === "" || parsePaceMSS(row.pace) !== null;
                return (
                  <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="text"
                      value={row.lane_label}
                      onChange={e => updateRow(i, "lane_label", e.target.value)}
                      placeholder={`Lane ${i + 1}`}
                      style={{
                        fontSize: 12, padding: "4px 8px", borderRadius: 4,
                        border: "1px solid var(--color-border-strong)", background: "var(--color-bg)",
                        color: "var(--color-text)", width: 100,
                      }} />
                    <input
                      type="text"
                      value={row.pace}
                      onChange={e => updateRow(i, "pace", e.target.value)}
                      placeholder="M:SS"
                      style={{
                        fontSize: 12, fontFamily: "monospace", padding: "4px 8px", borderRadius: 4,
                        border: `1px solid ${isValid ? "var(--color-border-strong)" : "#ef4444"}`,
                        background: "var(--color-bg)", color: "var(--color-text)", width: 60,
                      }} />
                    <span style={{ fontSize: 10, color: "var(--color-text-dim)" }}>/ 100</span>
                    {manualLanesPace.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        title="Remove lane"
                        style={{
                          fontSize: 11, padding: "2px 7px", borderRadius: 4,
                          border: "1px solid var(--color-border-strong)", background: "transparent",
                          color: "var(--color-text-dim)", cursor: "pointer",
                        }}>
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={addRow}
                style={{
                  fontSize: 11, padding: "4px 10px", borderRadius: 4,
                  border: "1px dashed var(--color-border-strong)", background: "transparent",
                  color: "var(--color-text-dim)", cursor: "pointer", justifySelf: "start",
                }}>
                + Add lane
              </button>
            </div>
          )}
        </div>
      );
    }
