// src/components/profile/GoalRow.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).

    const { useState } = React;

    export function GoalRow({ metric, value, onSave, onDelete }) {
      const [editing, setEditing] = React.useState(false);
      const [draft, setDraft]     = React.useState("");
      const startEdit = () => {
        setDraft(String(value ?? metric.defaultTarget));
        setEditing(true);
      };
      const commit = () => {
        const v = parseInt(draft, 10);
        if (v > 0) onSave(v);
        setEditing(false);
      };
      const isSet = value != null;
      return (
        <div className="card" style={{
          display: "flex", alignItems: "center", gap: 10,
          borderRadius: 8, padding: "8px 12px",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: "var(--color-text)", fontWeight: 600 }}>{metric.label}</div>
            {!editing && isSet && (
              <div style={{ fontSize: 11, color: "var(--color-text-dim)", marginTop: 2 }}>
                Target: <span style={{ color: "var(--color-primary-text)", fontWeight: 700 }}>{value.toLocaleString()}</span> {metric.unit}
              </div>
            )}
          </div>
          {editing ? (
            <>
              <input type="number" autoFocus value={draft} min={1}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
                style={{
                  width: 80, padding: "4px 8px", fontSize: 13,
                  background: "var(--color-bg)", color: "var(--color-text)",
                  border: "1px solid var(--color-primary)", borderRadius: 6, outline: "none",
                  fontFamily: "monospace", textAlign: "right",
                }} />
              <button onClick={commit}
                style={{ padding: "4px 10px", borderRadius: 6, border: "none",
                  background: "var(--color-primary)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Save
              </button>
              <button onClick={() => setEditing(false)}
                className="btn btn-sm btn-outlined btn-neutral">
                Cancel
              </button>
            </>
          ) : isSet ? (
            <>
              <button onClick={startEdit}
                style={{ padding: "4px 10px", borderRadius: 6,
                  border: "1px solid var(--color-border)", background: "transparent",
                  color: "#cbd5e1", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                Edit
              </button>
              <button onClick={onDelete}
                title="Remove this goal"
                style={{ padding: "4px 8px", borderRadius: 6,
                  border: "1px solid var(--color-border)", background: "transparent",
                  color: "#fca5a5", fontSize: 11, cursor: "pointer" }}>
                ✕
              </button>
            </>
          ) : (
            <button onClick={startEdit}
              style={{ padding: "4px 12px", borderRadius: 6, border: "1px dashed var(--color-border-strong)",
                background: "transparent", color: "var(--color-primary-text)",
                fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              + Set a goal
            </button>
          )}
        </div>
      );
    }
