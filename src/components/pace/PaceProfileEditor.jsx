// src/components/pace/PaceProfileEditor.jsx — shared pace-profile picker (#3).
// Preset (Club / Masters / Youth) + optional advanced per-stroke factor overrides.
// Used by ProfileModal (swimmer's own) and TeamSettingsTab (team default).
// Emits { preset } or { preset, factors }. React is a runtime global.
import { PACE_PROFILE_PRESETS } from "../../lib/engine.js";

const PRESET_LABELS = { club: "Club / Age-group", masters: "Masters", youth: "Youth / Lessons" };
const PRESET_ORDER  = ["club", "masters", "youth"];
const STROKES       = [["back", "Back"], ["fly", "Fly"], ["breast", "Breast"], ["im", "IM"]];

export function PaceProfileEditor({ value, onSave, busy = false, readOnly = false, extraButton = null, hint = null }) {
  const { useState, useEffect } = React;

  const seed = (v) => {
    const vv = v || {};
    const preset = PACE_PROFILE_PRESETS[vv.preset] ? vv.preset : "club";
    return {
      preset,
      custom: !!vv.factors,
      factors: { ...(PACE_PROFILE_PRESETS[preset] || PACE_PROFILE_PRESETS.club), ...(vv.factors || {}) },
    };
  };
  const [state, setState] = useState(() => seed(value));
  const [open, setOpen]   = useState(!!(value && value.factors));
  useEffect(() => { setState(seed(value)); setOpen(!!(value && value.factors)); }, [value]);

  const { preset, custom, factors } = state;
  const eff = custom ? factors : (PACE_PROFILE_PRESETS[preset] || PACE_PROFILE_PRESETS.club);

  const pickPreset = (p) => setState(s => ({
    ...s, preset: p,
    factors: s.custom ? s.factors : { ...PACE_PROFILE_PRESETS[p] },
  }));
  const editFactor = (k, raw) => {
    const n = parseFloat(raw);
    setState(s => ({ ...s, custom: true, factors: { ...s.factors, [k]: Number.isFinite(n) ? n : s.factors[k] } }));
  };
  const resetPreset = () => setState(s => ({ ...s, custom: false, factors: { ...PACE_PROFILE_PRESETS[s.preset] } }));

  const dirtyVsSaved = (() => {
    const cur = custom ? { preset, factors } : { preset };
    const sv = value && value.preset ? (value.factors ? { preset: value.preset, factors: value.factors } : { preset: value.preset }) : null;
    return JSON.stringify(cur) !== JSON.stringify(sv);
  })();

  const handleSave = () => onSave(custom ? { preset, factors } : { preset });

  const labelCss = { color: "var(--color-text-muted)", fontSize: 12, fontWeight: 600 };

  if (readOnly) {
    return (
      <div style={{ color: "var(--color-text)", fontSize: 13 }}>
        {PRESET_LABELS[preset] || preset}{custom ? " (custom factors)" : ""}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
        {PRESET_ORDER.map(p => {
          const active = preset === p;
          return (
            <button key={p} type="button" onClick={() => pickPreset(p)} disabled={busy}
              className="pill"
              style={{
                border: `1px solid ${active ? "var(--color-primary)" : "var(--color-border)"}`,
                background: active ? "#3b82f622" : "transparent",
                color: active ? "var(--color-primary)" : "var(--color-text-muted)",
                fontSize: 11, cursor: busy ? "not-allowed" : "pointer",
              }}>
              {PRESET_LABELS[p]}
            </button>
          );
        })}
      </div>

      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ background: "none", border: "none", color: "var(--color-text-dim)", fontSize: 11, cursor: "pointer", padding: 0, marginBottom: open ? 8 : 0 }}>
        {open ? "▾" : "▸"} Advanced: override stroke factors{custom ? " (custom)" : ""}
      </button>

      {open && (
        <div style={{ border: "1px solid var(--color-border)", borderRadius: 6, padding: 10, marginBottom: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ ...labelCss, width: 52 }}>Free</span>
              <span style={{ color: "var(--color-text-dim)", fontSize: 12, fontFamily: "monospace" }}>1.00 (fixed)</span>
            </div>
            {STROKES.map(([k, lbl]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ ...labelCss, width: 52 }}>{lbl}</span>
                <input type="number" step="0.01" min="0.8" max="2.0" value={eff[k]}
                  onChange={e => editFactor(k, e.target.value)} disabled={busy}
                  style={{ width: 64, padding: "4px 6px", fontSize: 12, fontFamily: "monospace", background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 4 }} />
              </div>
            ))}
          </div>
          <div style={{ color: "var(--color-text-dim)", fontSize: 10, marginTop: 8, fontStyle: "italic" }}>
            How much slower than free, per stroke. Higher = more rest. Free is the 1.00 reference.
          </div>
          {custom && (
            <button type="button" onClick={resetPreset} disabled={busy}
              style={{ marginTop: 8, padding: "3px 8px", background: "transparent", border: "1px solid var(--color-border-strong)", borderRadius: 5, color: "var(--color-text-muted)", fontSize: 11, cursor: busy ? "not-allowed" : "pointer" }}>
              Reset to {PRESET_LABELS[preset]} defaults
            </button>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" onClick={handleSave} disabled={busy || !dirtyVsSaved}
          style={{ padding: "6px 12px", background: (busy || !dirtyVsSaved) ? "var(--color-border)" : "var(--color-primary)", color: (busy || !dirtyVsSaved) ? "#cbd5e1" : "#fff", border: "none", borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: (busy || !dirtyVsSaved) ? "not-allowed" : "pointer" }}>
          Save
        </button>
        {extraButton}
      </div>
      {hint && <div style={{ color: "var(--color-text-dim)", fontSize: 11, marginTop: 8, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  );
}
