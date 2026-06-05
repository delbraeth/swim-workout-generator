// src/components/people/SwimmerEquipmentPanel.jsx — Lesson tier (Phase 5).
// Per-managed-swimmer equipment profile editor. When a coach/instructor
// generates FOR this swimmer (via the generate-for picker), this profile
// overrides their own global equipment selection. Empty / cleared = no profile
// (generator falls back to the coach's equipment). PATCHes equipment_modes on
// /api/managed-swimmers/:id. React is a runtime global.
import { csrfHeaders } from "../../lib/api.js";
import { EquipmentPicker } from "../workout/EquipmentPicker.jsx";

    export function SwimmerEquipmentPanel({ managedId, swimmerName = "this swimmer", initialEquipment = null, onSaved }) {
      // null profile → start from an empty (all-off) object so the picker renders.
      const [equipment, setEquipment] = React.useState(() => initialEquipment && typeof initialEquipment === "object" ? { ...initialEquipment } : {});
      const [hasProfile, setHasProfile] = React.useState(() => !!(initialEquipment && Object.keys(initialEquipment).length));
      const [dirty, setDirty] = React.useState(false);
      const [busy,  setBusy]  = React.useState(false);
      const [msg,   setMsg]   = React.useState(null);

      const onChange = (id, mode) => {
        setEquipment(prev => {
          const next = { ...prev };
          if (mode === "off") delete next[id]; else next[id] = mode;
          return next;
        });
        setDirty(true);
        setMsg(null);
      };

      const save = async (clear = false) => {
        if (busy) return;
        setBusy(true); setMsg(null);
        // clear → null (drops the profile); otherwise send the object ({} also
        // clears, server-side validator stringifies it). Send null for clear so
        // the swimmer reverts to the coach's global equipment.
        const payload = clear ? null : (Object.keys(equipment).length ? equipment : null);
        try {
          const res = await fetch(`/api/managed-swimmers/${managedId}`, {
            method:  "PATCH",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({ equipment_modes: payload }),
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
          if (clear) { setEquipment({}); setHasProfile(false); }
          else { setHasProfile(!!payload); }
          setDirty(false);
          setMsg(clear ? "Equipment profile cleared." : "Equipment profile saved.");
          onSaved && onSaved();
        } catch (err) {
          setMsg(`Error: ${err.message}`);
        } finally { setBusy(false); }
      };

      return (
        <div className="card" style={{ padding: 16, marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <h4 style={{ margin: 0, fontSize: 14 }}>🛠️ Equipment profile</h4>
            <span style={{ fontSize: 11, color: hasProfile ? "var(--color-positive)" : "var(--color-text-dim)" }}>
              {hasProfile ? "Custom profile active" : "Using coach default"}
            </span>
          </div>
          <p style={{ fontSize: 12, color: "var(--color-text-dim)", margin: "0 0 12px", lineHeight: 1.5 }}>
            Sets the equipment used when you generate for {swimmerName}. Overrides your own
            equipment selection. Leave all off (and clear) to fall back to your default.
          </p>
          <EquipmentPicker equipment={equipment} onChange={onChange} />
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={() => save(false)} disabled={busy || !dirty}
              style={{ padding: "7px 14px", borderRadius: 6, border: "none",
                background: (busy || !dirty) ? "var(--color-border)" : "var(--color-primary)",
                color: "var(--color-bg)", fontSize: 13, fontWeight: 700, cursor: (busy || !dirty) ? "default" : "pointer" }}>
              {busy ? "Saving…" : "Save profile"}
            </button>
            {hasProfile && (
              <button onClick={() => save(true)} disabled={busy}
                style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid var(--color-border-strong)",
                  background: "transparent", color: "var(--color-text-muted)", fontSize: 13, fontWeight: 600,
                  cursor: busy ? "default" : "pointer" }}>
                Clear profile
              </button>
            )}
            {msg && <span style={{ fontSize: 12, color: msg.startsWith("Error") ? "var(--color-destructive)" : "var(--color-positive)" }}>{msg}</span>}
          </div>
        </div>
      );
    }
