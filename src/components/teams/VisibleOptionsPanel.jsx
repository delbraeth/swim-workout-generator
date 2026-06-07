// src/components/teams/VisibleOptionsPanel.jsx — Phase 6 "Team Option Visibility"
// owner config (Wave 2 A3). Pick a preset (Simple/Standard/Full) + fine-tune the
// per-bundle toggles. Writes PUT /api/teams/:id/feature-flags. React global.
//
// Guardrails reflected in the UI: compliance is force-locked ON for teams with
// minors (non-masters); race-pace + Learn-to-Swim + the swimmer core loop are
// CORE and simply absent from this list (never gateable).
import { csrfHeaders } from "../../lib/api.js";
import { FEATURE_FLAGS, PRESET_KEYS } from "../../lib/featureFlags.js";

const PRESET_META = {
  simple:   { label: "Simple",   desc: "Just generate → run → log (+ per-swimmer limits). For private / lesson coaches." },
  standard: { label: "Standard", desc: "Coach tools on; reports, curation & lane plans off by default." },
  full:     { label: "Full",     desc: "Everything on (default)." },
};

export function VisibleOptionsPanel({ teamId, canWrite }) {
  const [state, setState] = React.useState(null);   // { preset, overrides, resolved, team_type, can_edit }
  const [busy, setBusy]   = React.useState(false);
  const [msg, setMsg]     = React.useState(null);

  const load = React.useCallback(async () => {
    try {
      const r = await fetch(`/api/teams/${teamId}/feature-flags`, { cache: "no-store" });
      setState(r.ok ? await r.json() : { preset: null, overrides: {}, resolved: {}, team_type: null });
    } catch (_) { setState({ preset: null, overrides: {}, resolved: {}, team_type: null }); }
  }, [teamId]);
  React.useEffect(() => { load(); }, [load]);

  const save = async (preset, overrides) => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/teams/${teamId}/feature-flags`, {
        method: "PUT", headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ preset, overrides }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setState(s => ({ ...s, preset, overrides, resolved: j.resolved || s.resolved }));
    } catch (e) { setMsg(`Couldn't save: ${e.message}`); }
    setBusy(false);
  };

  const pickPreset = (p) => save(p, {});                                   // preset resets overrides
  const toggle = (key) => {
    const cur = !!state.resolved[key];
    const overrides = { ...(state.overrides || {}), [key]: !cur };
    save(state.preset || null, overrides);
  };

  if (state === null) return <div style={{ fontSize: 12, color: "var(--color-text-dim)", fontStyle: "italic" }}>Loading…</div>;

  const minors = state.team_type && state.team_type !== "masters";
  const card = { background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: 16, marginBottom: 16 };

  return (
    <div style={card}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>👁 Visible options</div>
      <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 12 }}>
        Hide surfaces your team doesn’t use to simplify the app. Affects what swimmers (and optionally coaches) see. The core training loop is always available.
      </div>

      {/* Presets */}
      <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
        {PRESET_KEYS.map(p => {
          const on = state.preset === p;
          return (
            <button key={p} type="button" disabled={!canWrite || busy} onClick={() => pickPreset(p)}
              style={{ textAlign: "left", padding: "8px 11px", borderRadius: 7, cursor: canWrite ? "pointer" : "default",
                border: `1px solid ${on ? "var(--color-primary)" : "var(--color-border-strong)"}`,
                background: on ? "var(--color-primary)" : "var(--color-bg)",
                color: on ? "var(--color-bg)" : "var(--color-text)" }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{PRESET_META[p].label}{on ? " ✓" : ""}</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>{PRESET_META[p].desc}</div>
            </button>
          );
        })}
      </div>

      {/* Per-bundle toggles */}
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-dim)", marginBottom: 6 }}>Fine-tune</div>
      <div style={{ display: "grid", gap: 2 }}>
        {FEATURE_FLAGS.map(f => {
          const on = !!state.resolved[f.key];
          const locked = f.key === "compliance" && minors;       // F5: forced on for minor teams
          return (
            <div key={f.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--color-border)" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "var(--color-text)", fontWeight: 600 }}>{f.label}</div>
                <div style={{ fontSize: 11, color: "var(--color-text-dim)" }}>{f.desc}{locked ? " · required for teams with minors" : ""}</div>
              </div>
              <button type="button" disabled={!canWrite || busy || locked} onClick={() => toggle(f.key)}
                title={locked ? "Required for teams with minors" : (on ? "On" : "Off")}
                style={{ flexShrink: 0, padding: "4px 12px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                  cursor: (canWrite && !locked) ? "pointer" : "default", opacity: locked ? 0.6 : 1,
                  border: `1px solid ${on ? "var(--color-positive)" : "var(--color-border-strong)"}`,
                  background: on ? "var(--color-positive)" : "transparent",
                  color: on ? "var(--color-bg)" : "var(--color-text-muted)" }}>
                {on ? "On" : "Off"}
              </button>
            </div>
          );
        })}
      </div>

      {!canWrite && <div style={{ fontSize: 11, color: "var(--color-text-dim)", marginTop: 10, fontStyle: "italic" }}>Only the team owner/admin can change these.</div>}
      {msg && <div style={{ fontSize: 12, color: "var(--color-warn)", marginTop: 8 }}>{msg}</div>}
    </div>
  );
}
