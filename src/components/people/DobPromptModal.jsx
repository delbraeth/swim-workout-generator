// src/components/people/DobPromptModal.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { csrfHeaders } from "../../lib/api.js";
import { DOB_MAX_TODAY, DOB_MIN } from "../../lib/constants.js";

    const { useState } = React;

    export function DobPromptModal({ onSaved, onDismiss }) {
      const [dob, setDob] = React.useState("");
      const [err, setErr] = React.useState(null);
      const [saving, setSaving] = React.useState(false);
      const save = async () => {
        if (!dob) { setErr("Please enter your DOB or tap 'Remind me later'."); return; }
        setSaving(true);
        try {
          const res = await fetch("/api/me/dob", {
            method:  "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({ dob }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          onSaved(dob);
        } catch (e) {
          setErr(e.message);
        } finally { setSaving(false); }
      };
      return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
          <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border-strong)", borderRadius: 12, padding: 24, maxWidth: 460, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
            <h3 style={{ color: "var(--color-text)", marginTop: 0 }}>Quick question — your date of birth</h3>
            <p style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.6 }}>
              We're rolling out coaching features (teams, groups, workouts assigned to you). To make sure the right compliance rules apply — especially for minor athletes — we need your DOB on file.
            </p>
            <p style={{ color: "var(--color-text-muted)", fontSize: 12, lineHeight: 1.5 }}>
              Your DOB is private. Only your age and a minor/adult status indicator are visible to other coaches; the raw date is only visible to you.
            </p>
            <label style={{ display: "block", fontSize: 11, color: "var(--color-text-muted)", marginTop: 14, marginBottom: 4 }}>Date of birth</label>
            <input type="date" value={dob} onChange={e => setDob(e.target.value)}
              min={DOB_MIN} max={DOB_MAX_TODAY()}
              style={{ width: "100%", padding: "7px 11px", fontSize: 14, background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 6 }} />
            {err && <div style={{ color: "#fca5a5", fontSize: 12, marginTop: 8 }}>{err}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              <button onClick={onDismiss} disabled={saving}
                style={{ padding: "7px 14px", background: "var(--color-border)", color: "#cbd5e1", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>
                Remind me later
              </button>
              <button onClick={save} disabled={saving || !dob}
                style={{ padding: "7px 14px", background: dob ? "var(--color-positive)" : "var(--color-border-strong)", color: dob ? "var(--color-bg)" : "var(--color-text-muted)", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: dob ? "pointer" : "not-allowed" }}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      );
    }
