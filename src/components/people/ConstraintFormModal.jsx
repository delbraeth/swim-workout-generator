// src/components/people/ConstraintFormModal.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { csrfHeaders, PSC_TYPE_GROUPS } from "../../lib/shared.js";

    const { useState, useEffect } = React;

    export function ConstraintFormModal({ open, managedId, prefill, onClose, onSaved }) {
      const [type,     setType]     = React.useState(prefill?.constraint_type || "stroke_no_fly");
      const [valueNum, setValueNum] = React.useState(prefill?.value_num != null ? String(prefill.value_num) : "");
      const [valueStr, setValueStr] = React.useState(prefill?.value_str || "easy_only");
      const [persistent, setPersistent] = React.useState(prefill ? !prefill.expires_at : true);
      const [expiresYmd, setExpiresYmd] = React.useState(() => {
        if (prefill?.expires_at) return String(prefill.expires_at).slice(0, 10);
        // default: 2 weeks from now
        const d = new Date(); d.setDate(d.getDate() + 14);
        return d.toISOString().slice(0, 10);
      });
      const [busy, setBusy] = React.useState(false);
      const [err,  setErr]  = React.useState(null);

      // Re-init on open (prefill changes between Add and Edit invocations).
      React.useEffect(() => {
        if (!open) return;
        setType(prefill?.constraint_type || "stroke_no_fly");
        setValueNum(prefill?.value_num != null ? String(prefill.value_num) : "");
        setValueStr(prefill?.value_str || "easy_only");
        setPersistent(prefill ? !prefill.expires_at : true);
        if (prefill?.expires_at) setExpiresYmd(String(prefill.expires_at).slice(0, 10));
        setErr(null);
      }, [open, prefill]);

      if (!open) return null;

      const needsYd  = type === "cap_yardage";
      const needsStr = type === "cap_intensity";

      const submit = async () => {
        setErr(null);
        const body = { managed_id: managedId, constraint_type: type };
        if (needsYd) {
          const n = parseInt(valueNum, 10);
          if (!Number.isInteger(n) || n <= 0) { setErr("Yardage cap must be a positive integer"); return; }
          body.value_num = n;
        }
        if (needsStr) body.value_str = valueStr;
        if (!persistent) {
          // Build ISO with end-of-day UTC so the date inclusive feels right
          body.expires_at = `${expiresYmd}T23:59:59Z`;
        }
        setBusy(true);
        try {
          const res = await fetch("/api/swimmer-constraints", {
            method:  "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify(body),
          });
          const j = await res.json();
          if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
          setBusy(false);
          onSaved && onSaved(j.constraint);
          onClose();
        } catch (e) { setBusy(false); setErr(e.message); }
      };

      return (
        <div onClick={onClose} className="modal-overlay"
          style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(2,6,23,0.7)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "10vh 16px" }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 460, background: "var(--color-bg)", border: "1px solid var(--color-card)", borderRadius: 14, padding: "22px 22px 18px", boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h3 style={{ color: "var(--color-text)", fontSize: 17, margin: 0, fontWeight: 700 }}>
                {prefill ? "Edit constraint" : "Add constraint"}
              </h3>
              <button onClick={onClose} aria-label="Close"
                style={{ background: "transparent", border: "none", color: "var(--color-text-dim)", fontSize: 22, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 11, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Constraint type</label>
              <select value={type} onChange={e => setType(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-text)", fontSize: 14 }}>
                {PSC_TYPE_GROUPS.map(g => (
                  <optgroup key={g.label} label={g.label}>
                    {g.opts.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>

            {needsYd && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 11, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Yardage cap</label>
                <input type="number" min="100" max="20000" step="100" value={valueNum}
                  onChange={e => setValueNum(e.target.value)} placeholder="e.g. 1500"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-text)", fontSize: 14 }} />
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
                  Workouts beyond this size get trimmed from the end (preserves warmup + main when possible).
                </div>
              </div>
            )}

            {needsStr && (
              <div style={{ marginBottom: 12, padding: 8, background: "var(--color-card)", borderRadius: 6, fontSize: 12, color: "var(--color-text-muted)" }}>
                Currently the only intensity cap is <strong>easy_only</strong> — replaces the main set with cooldown-equivalent volume at easy pace.
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Expiry</label>
              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <button type="button" onClick={() => setPersistent(true)}
                  style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--color-border)", background: persistent ? "var(--color-primary)" : "var(--color-card)", color: persistent ? "var(--color-bg)" : "var(--color-text-muted)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  Persistent (until removed)
                </button>
                <button type="button" onClick={() => setPersistent(false)}
                  style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--color-border)", background: !persistent ? "var(--color-primary)" : "var(--color-card)", color: !persistent ? "var(--color-bg)" : "var(--color-text-muted)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  Until date
                </button>
              </div>
              {!persistent && (
                <input type="date" value={expiresYmd} onChange={e => setExpiresYmd(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-text)", fontSize: 14 }} />
              )}
            </div>

            {err && <div style={{ color: "#fca5a5", fontSize: 12, marginBottom: 10 }}>Error: {err}</div>}

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={submit} disabled={busy}
                style={{ flex: 1, padding: "9px 14px", background: "var(--color-positive)", color: "var(--color-bg)", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1 }}>
                {busy ? "Saving…" : (prefill ? "Save changes" : "Add constraint")}
              </button>
              <button onClick={onClose} disabled={busy}
                style={{ padding: "9px 14px", background: "var(--color-border)", color: "#cbd5e1", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      );
    }
