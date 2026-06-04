// src/components/profile/ProfileGenderRow.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { csrfHeaders, GENDER_OPTIONS, genderLabel } from "../../app.jsx";

    const { useState } = React;

    export function ProfileGenderRow({ me, setMe, onProfileChange }) {
      const [editing, setEditing] = React.useState(false);
      const [draft,   setDraft]   = React.useState("");
      const [saving,  setSaving]  = React.useState(false);
      const [error,   setError]   = React.useState(null);
      const startEdit = () => { setDraft(me?.gender || ""); setError(null); setEditing(true); };
      const commit = async () => {
        setSaving(true); setError(null);
        try {
          const res = await fetch("/api/me", {
            method:  "PATCH",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({ gender: draft || null }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          setMe(prev => prev ? { ...prev, gender: draft || null } : prev);
          if (onProfileChange) onProfileChange();
          setEditing(false);
        } catch (err) { setError(err.message || String(err)); }
        finally { setSaving(false); }
      };
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
          <span style={{ color: "var(--color-text-dim)", width: 100, flexShrink: 0 }}>Gender:</span>
          {editing ? (
            <>
              <select value={draft} onChange={e => setDraft(e.target.value)} autoFocus
                style={{ flex: 1, minWidth: 0, padding: "5px 9px", fontSize: 13, background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-primary)", borderRadius: 5, outline: "none" }}>
                {GENDER_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
              <button onClick={commit} disabled={saving}
                style={{ padding: "5px 11px", borderRadius: 5, border: "none", background: saving ? "#1e3a5f" : "var(--color-primary)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: saving ? "default" : "pointer" }}>
                {saving ? "…" : "Save"}
              </button>
              <button onClick={() => setEditing(false)} disabled={saving}
                style={{ padding: "5px 9px", borderRadius: 5, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-dim)", fontSize: 11, cursor: "pointer" }}>
                Cancel
              </button>
              {error && <span style={{ color: "#fca5a5", fontSize: 11 }}>{error}</span>}
            </>
          ) : (
            <>
              <span style={{ flex: 1, color: "var(--color-text)", fontWeight: 600 }}>
                {me?.gender ? genderLabel(me.gender) : <span style={{ color: "var(--color-border-strong)", fontStyle: "italic", fontWeight: 400 }}>not set</span>}
              </span>
              <button onClick={startEdit}
                style={{ padding: "3px 9px", borderRadius: 5, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", fontSize: 11, cursor: "pointer" }}>
                Edit
              </button>
            </>
          )}
        </div>
      );
    }
