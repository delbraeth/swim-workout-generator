// src/components/profile/EditableProfileField.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).

    const { useState } = React;

    export function EditableProfileField({ label, value, placeholder, maxLength, type = "text", transform, badge, onSave }) {
      const [editing, setEditing] = React.useState(false);
      const [draft, setDraft]     = React.useState("");
      const [saving, setSaving]   = React.useState(false);
      const [error, setError]     = React.useState(null);
      const startEdit = () => {
        setDraft(value || "");
        setError(null);
        setEditing(true);
      };
      const commit = async () => {
        const v = transform ? transform(draft) : draft;
        setSaving(true); setError(null);
        try {
          await onSave(v.trim());
          setEditing(false);
        } catch (err) {
          setError(err.message || String(err));
        } finally {
          setSaving(false);
        }
      };
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
          <span style={{ color: "var(--color-text-dim)", width: 100, flexShrink: 0 }}>{label}:</span>
          {editing ? (
            <>
              <input
                type={type}
                value={draft}
                autoFocus
                aria-label={label}
                maxLength={maxLength}
                placeholder={placeholder}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
                style={{
                  flex: 1, minWidth: 0,
                  padding: "5px 9px", fontSize: 13,
                  background: "var(--color-bg)", color: "var(--color-text)",
                  border: "1px solid var(--color-primary)", borderRadius: 5, outline: "none",
                }} />
              <button onClick={commit} disabled={saving}
                style={{ padding: "5px 11px", borderRadius: 5, border: "none",
                  background: saving ? "#1e3a5f" : "var(--color-primary)", color: "#fff",
                  fontSize: 12, fontWeight: 700, cursor: saving ? "default" : "pointer" }}>
                {saving ? "…" : "Save"}
              </button>
              <button onClick={() => setEditing(false)} disabled={saving}
                className="btn btn-sm btn-outlined btn-neutral">
                Cancel
              </button>
            </>
          ) : (
            <>
              <span style={{ flex: 1, color: "var(--color-text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {value || <span style={{ color: "var(--color-border-strong)", fontStyle: "italic", fontWeight: 400 }}>{placeholder || "—"}</span>}
                {badge}
              </span>
              <button onClick={startEdit}
                className="btn btn-sm btn-outlined btn-primary">
                Edit
              </button>
            </>
          )}
          {error && (
            <span style={{ color: "#fca5a5", fontSize: 11, marginLeft: 8 }}>{error}</span>
          )}
        </div>
      );
    }
