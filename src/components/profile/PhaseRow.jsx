// src/components/profile/PhaseRow.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { PHASES } from "../../lib/engine.js";

    const PHASE_ORDER = ["base", "build", "peak", "taper", "recovery"];

    export function PhaseRow({ value, onChange }) {
      const selected = value && PHASES[value] ? PHASES[value] : null;
      return (
        <div className="card" style={{
          display: "flex", flexDirection: "column", gap: 8,
          borderRadius: 8, padding: "8px 12px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: "var(--color-text)", fontWeight: 600 }}>📅 Training phase</div>
              <div style={{ fontSize: 11, color: "var(--color-text-dim)", marginTop: 2 }}>
                {selected
                  ? <><span style={{ color: selected.color, fontWeight: 700 }}>{selected.emoji} {selected.label}</span> · {selected.description}</>
                  : <span style={{ fontStyle: "italic" }}>No phase set — generator runs without phase bias.</span>}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {PHASE_ORDER.map(pid => {
              const p = PHASES[pid];
              const active = value === pid;
              return (
                <button key={pid}
                  onClick={() => onChange(active ? null : pid)}
                  title={`${p.label} — ${p.description}`}
                  className="pill"
                  style={{
                    border: `1px solid ${active ? p.color : "var(--color-border)"}`,
                    background: active ? `${p.color}22` : "transparent",
                    color: active ? p.color : "var(--color-text-muted)",
                    fontSize: 12, cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}>
                  <span>{p.emoji}</span>
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }
