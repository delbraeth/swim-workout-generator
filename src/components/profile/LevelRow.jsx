// src/components/profile/LevelRow.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { LEVEL_PRESETS } from "../../app.jsx";

    const LEVEL_ORDER = ["recreational", "masters", "competitive"];

    export function LevelRow({ value, onChange }) {
      const selected = value && LEVEL_PRESETS[value] ? LEVEL_PRESETS[value] : null;
      return (
        <div className="card" style={{
          display: "flex", flexDirection: "column", gap: 8,
          borderRadius: 8, padding: "8px 12px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: "var(--color-text)", fontWeight: 600 }}>🎯 Swimmer level</div>
              <div style={{ fontSize: 11, color: "var(--color-text-dim)", marginTop: 2 }}>
                {selected
                  ? <><span style={{ color: "var(--color-warn)", fontWeight: 700 }}>{selected.emoji} {selected.label}</span> · {selected.description} · presets pace to {selected.pace}/100</>
                  : <span style={{ fontStyle: "italic" }}>No level set — pick one to auto-fill your pace.</span>}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {LEVEL_ORDER.map(lid => {
              const l = LEVEL_PRESETS[lid];
              const active = value === lid;
              return (
                <button key={lid}
                  onClick={() => onChange(active ? null : lid, active ? null : l.pace)}
                  title={`${l.label} — pace ${l.pace}/100 · ${l.description}`}
                  className="pill"
                  style={{
                    border: `1px solid ${active ? "var(--color-warn)" : "var(--color-border)"}`,
                    background: active ? "rgba(245,158,11,0.18)" : "transparent",
                    color: active ? "var(--color-warn)" : "var(--color-text-muted)",
                    fontSize: 12, cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}>
                  <span>{l.emoji}</span>
                  <span>{l.label}</span>
                  <span style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace", fontWeight: 500, marginLeft: 2 }}>· {l.pace}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }
