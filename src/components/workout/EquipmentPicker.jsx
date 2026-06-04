// src/components/workout/EquipmentPicker.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { EQUIPMENT_LIST } from "../../app.jsx";
import { equipMode } from "../../lib/engine.js";

    export function EquipmentPicker({ equipment, onChange }) {
      // F: tri-state cycle on each card. Click cycles off → preferred → required → off.
      const cycleNext = (mode) =>
        mode === "off" ? "preferred" :
        mode === "preferred" ? "required" :
        "off";
      return (
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: "var(--color-primary)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8, marginTop: 0 }}>
            Equipment Available
            <span style={{ color: "var(--color-text-dim)", textTransform: "none", letterSpacing: 0, fontWeight: 400, marginLeft: 8 }}>
              (tap to cycle: off → preferred → required)
            </span>
          </p>
          <div className="equipment-grid">
            {EQUIPMENT_LIST.map(eq => {
              const mode = equipMode(equipment, eq.id);
              const isPreferred = mode === "preferred";
              const isRequired  = mode === "required";
              const isOn        = mode !== "off";
              // Styling tiers:
              //  off       — slate border, slate bg, no check
              //  preferred — soft slate-blue border, dim bg, soft check
              //  required  — bright blue border, deep blue bg, ★ badge
              const border =
                isRequired ? "var(--color-primary)" :
                isPreferred ? "var(--color-border-strong)" :
                "var(--color-border)";
              const bg =
                isRequired ? "#1e3a5f" :
                isPreferred ? "#1f293b" :
                "var(--color-card)";
              return (
                <button key={eq.id}
                  type="button"
                  onClick={() => onChange(eq.id, cycleNext(mode))}
                  title={`Currently ${mode}. Tap to set ${cycleNext(mode)}.`}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "12px 14px", borderRadius: 10,
                    border: `2px solid ${border}`,
                    background: bg,
                    cursor: "pointer", userSelect: "none",
                    transition: "all 0.15s",
                    textAlign: "left", width: "100%",
                  }}>
                  {/* Tri-state check indicator */}
                  <span style={{
                    width: 18, height: 18, borderRadius: 4,
                    border: `2px solid ${isRequired ? "var(--color-primary)" : isPreferred ? "var(--color-text-dim)" : "var(--color-border-strong)"}`,
                    background: isRequired ? "var(--color-primary)" : isPreferred ? "rgba(100,116,139,0.25)" : "transparent",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                    color: isRequired ? "#fff" : isPreferred ? "var(--color-text-muted)" : "transparent",
                    fontSize: 13, fontWeight: 900, lineHeight: 1,
                  }}>
                    {isRequired ? "✓" : isPreferred ? "✓" : ""}
                  </span>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{eq.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: isOn ? "#fff" : "var(--color-text)", display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {eq.label}
                      </span>
                      {isRequired && (
                        <span title="Required — every workout must include this"
                          style={{ fontSize: 9, fontWeight: 800, color: "var(--color-warn)", letterSpacing: "0.05em", flexShrink: 0 }}>★ REQ</span>
                      )}
                      {isPreferred && (
                        <span title="Preferred — generator boosts options containing this, but won't reject if absent"
                          style={{ fontSize: 9, fontWeight: 700, color: "var(--color-text-muted)", letterSpacing: "0.05em", flexShrink: 0 }}>PREF</span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: isOn ? "#bfdbfe" : "var(--color-text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {eq.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      );
    }
