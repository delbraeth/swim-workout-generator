// src/components/profile/NextEventRow.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).

    const { useState } = React;

    export function NextEventRow({ value, onSave, onClear }) {
      const [editing, setEditing] = React.useState(false);
      const [draftName, setDraftName] = React.useState("");
      const [draftDate, setDraftDate] = React.useState("");
      const startEdit = () => {
        setDraftName(value?.name || "");
        setDraftDate(value?.date || "");
        setEditing(true);
      };
      const commit = async () => {
        const ok = await onSave(draftName, draftDate);
        if (ok) setEditing(false);
      };
      const isSet = value && value.name && value.date;
      // Display "N days" relative to today for the read-only view.
      const daysLabel = (() => {
        if (!isSet) return null;
        const today = new Date(); today.setHours(0,0,0,0);
        const target = new Date(`${value.date}T00:00:00`);
        if (isNaN(target)) return null;
        const d = Math.round((target - today) / 86400000);
        if (d < 0) return `${Math.abs(d)}d ago`;
        if (d === 0) return "today!";
        if (d === 1) return "tomorrow";
        return `${d} days`;
      })();
      return (
        <div className="card" style={{
          display: "flex", alignItems: "center", gap: 10,
          borderRadius: 8, padding: "8px 12px",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: "var(--color-text)", fontWeight: 600 }}>🏁 Next event</div>
            {!editing && isSet && (
              <div style={{ fontSize: 11, color: "var(--color-text-dim)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <span style={{ color: "var(--color-primary-text)", fontWeight: 700 }}>{value.name}</span>
                <span> · {value.date}</span>
                {daysLabel && <span style={{ color: "var(--color-border-strong)" }}> · {daysLabel}</span>}
              </div>
            )}
          </div>
          {editing ? (
            <>
              <input type="text" autoFocus value={draftName}
                placeholder="Event name" aria-label="Event name"
                maxLength={80}
                onChange={e => setDraftName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
                style={{
                  width: 140, padding: "4px 8px", fontSize: 13,
                  background: "var(--color-bg)", color: "var(--color-text)",
                  border: "1px solid var(--color-primary)", borderRadius: 6, outline: "none",
                }} />
              <input type="date" value={draftDate}
                aria-label="Event date"
                onChange={e => setDraftDate(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
                style={{
                  padding: "4px 6px", fontSize: 13,
                  background: "var(--color-bg)", color: "var(--color-text)",
                  border: "1px solid var(--color-primary)", borderRadius: 6, outline: "none",
                  colorScheme: "dark",
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
                className="btn btn-sm btn-outlined btn-neutral">
                Edit
              </button>
              <button onClick={onClear}
                title="Remove this event"
                className="btn btn-sm btn-outlined btn-destructive">
                ✕
              </button>
            </>
          ) : (
            <button onClick={startEdit}
              style={{ padding: "4px 12px", borderRadius: 6, border: "1px dashed var(--color-border-strong)",
                background: "transparent", color: "var(--color-primary-text)",
                fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              + Set an event
            </button>
          )}
        </div>
      );
    }
