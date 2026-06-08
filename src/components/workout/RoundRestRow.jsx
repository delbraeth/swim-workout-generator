// src/components/workout/RoundRestRow.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).

    const { useState } = React;

    export function RoundRestRow({ restSecs, onChange }) {
      const [editing, setEditing] = React.useState(false);
      const [draft, setDraft]     = React.useState("");
      function commit() {
        const v = parseInt(draft, 10);
        if (!isNaN(v) && onChange) onChange(v);
        setEditing(false);
      }
      if (editing) {
        return (
          <tr>
            <td colSpan={5} style={{ padding: "4px 16px", background: "var(--color-bg)", borderTop: "1px dashed var(--color-border)", borderBottom: "1px dashed var(--color-border)" }}>
              <span style={{ fontSize: 11, color: "var(--color-text-dim)", marginRight: 8 }}>Rest between rounds:</span>
              <input type="number" autoFocus value={draft} min={0} max={300}
                onChange={e => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
                style={{ width: 52, fontSize: 12, fontFamily: "monospace", padding: "2px 6px", borderRadius: 4,
                         border: "1px solid var(--color-primary)", background: "var(--color-bg)", color: "var(--color-primary-text)", outline: "none" }} />
              <span style={{ fontSize: 11, color: "var(--color-text-dim)", marginLeft: 6 }}>sec</span>
            </td>
          </tr>
        );
      }
      return (
        <tr className="screen-only" onClick={onChange ? () => { setDraft(String(restSecs)); setEditing(true); } : undefined}
          style={{ cursor: onChange ? "pointer" : "default" }}>
          <td colSpan={5} style={{ padding: "7px 16px", background: "var(--color-bg)", borderTop: "1px dashed var(--color-border-strong)", borderBottom: "1px dashed var(--color-border-strong)", textAlign: "center" }}>
            <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 600, letterSpacing: "0.03em" }}>
              ⏸ {restSecs}s rest between rounds{onChange ? <span style={{ color: "var(--color-text-dim)", marginLeft: 8, fontSize: 11, fontWeight: 400 }}>tap to edit</span> : null}
            </span>
          </td>
        </tr>
      );
    }
