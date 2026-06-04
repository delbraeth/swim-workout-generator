// src/components/admin/EditUserModal.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components are imported below (freevars-driven).
import { csrfHeaders } from "../../lib/api.js";

    const { useState } = React;

    export function EditUserModal({ user, onClose, onSaved }) {
      const [initials,    setInitials]    = React.useState(user.initials     || "");
      const [displayName, setDisplayName] = React.useState(user.display_name || "");
      const [email,       setEmail]       = React.useState(user.email        || "");
      const [saving, setSaving] = React.useState(false);
      const [error,  setError]  = React.useState(null);

      const save = async () => {
        setSaving(true); setError(null);
        try {
          const r = await fetch(`/api/admin/users/${encodeURIComponent(user.sub)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({ initials, display_name: displayName, email }),
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) { setError(data.error || `HTTP ${r.status}`); return; }
          onSaved();
        } catch (err) { setError(err.message); }
        finally { setSaving(false); }
      };

      return (
        <div className="modal-overlay" style={{ padding: 16 }} onClick={onClose}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 12,
            maxWidth: 480, width: "100%", color: "#cbd5e1",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--color-border)" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)" }}>Edit user</div>
              <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", color: "var(--color-text-muted)", fontSize: 20, cursor: "pointer", padding: 4 }}>✕</button>
            </div>
            <div style={{ padding: "20px" }}>
              <div style={{ fontSize: 10, color: "var(--color-text-dim)", marginBottom: 12, fontFamily: "monospace" }} title={user.sub}>{user.sub.slice(0, 24)}…</div>

              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Initials (max 8)</label>
              <input value={initials} onChange={e => setInitials(e.target.value)} maxLength={8}
                style={{ width: "100%", boxSizing: "border-box", background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 4, color: "var(--color-text)", padding: "8px 10px", fontSize: 14, marginBottom: 14 }} />

              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Full name</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={120}
                style={{ width: "100%", boxSizing: "border-box", background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 4, color: "var(--color-text)", padding: "8px 10px", fontSize: 14, marginBottom: 14 }} />

              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email"
                style={{ width: "100%", boxSizing: "border-box", background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 4, color: "var(--color-text)", padding: "8px 10px", fontSize: 14, marginBottom: 16 }} />

              {error && <div style={{ fontSize: 12, color: "#f87171", marginBottom: 12 }}>{error}</div>}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={onClose} style={{ background: "var(--color-border)", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 12, color: "var(--color-text)", cursor: "pointer", fontWeight: 600 }}>
                  Cancel
                </button>
                <button onClick={save} disabled={saving} style={{ background: "var(--color-primary)", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 12, color: "var(--color-bg)", cursor: saving ? "wait" : "pointer", fontWeight: 700 }}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
