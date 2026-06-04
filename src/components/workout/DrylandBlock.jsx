// src/components/workout/DrylandBlock.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { DRYLAND_EXPLAINERS } from "../../app.jsx";

    const { useState } = React;

    export function DrylandBlock({ block, onRemove = null, onChange = null }) {
      const ex = Array.isArray(block.exercises) ? block.exercises : [];
      const [editing, setEditing] = useState(false);
      const [draft, setDraft]     = useState(null);
      const startEdit = () => { setDraft({ name: block.name || "", exercises: ex.map(e => ({ ...e })) }); setEditing(true); };
      const commit = () => {
        if (onChange) onChange({
          ...block,
          name: (draft.name || "").trim() || "Dryland",
          exercises: (draft.exercises || []).filter(e => (e.name || "").trim() || String(e.reps ?? "").trim()),
        });
        setEditing(false);
      };
      const updEx = (i, k, v) => setDraft(d => ({ ...d, exercises: d.exercises.map((e, j) => j === i ? { ...e, [k]: v } : e) }));
      const addEx = () => setDraft(d => ({ ...d, exercises: [...d.exercises, { name: "", sets: 1, reps: "10", rest: null }] }));
      const rmEx  = (i) => setDraft(d => ({ ...d, exercises: d.exercises.filter((_, j) => j !== i) }));
      const inp = { padding: "4px 6px", fontSize: 12, borderRadius: 4, border: "1px solid #d8c19a", background: "#fff", color: "#5b4326", fontFamily: "inherit" };
      const headerBtn = { background: "transparent", border: "none", color: "#a3702c", fontSize: 14, cursor: "pointer", lineHeight: 1, fontWeight: 700 };
      return (
        <div style={{ border: "1px solid #a3702c", borderRadius: 10, marginBottom: 14, background: "#fbf6ee", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "#f0e2cc", color: "#7a4a12", padding: "8px 14px", fontWeight: 700, fontSize: 14, gap: 8 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>🏋
              {editing
                ? <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} style={{ ...inp, fontWeight: 700, width: 170 }} />
                : <span>{block.name || "Dryland"}</span>}
              <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.7 }}>
                Dryland · {block.placement === "post" ? "after pool" : "before pool"}
              </span>
            </span>
            <span style={{ display: "flex", gap: 10, flexShrink: 0 }}>
              {onChange && (editing
                ? <button onClick={commit} style={headerBtn} title="Done editing">✓ Done</button>
                : <button onClick={startEdit} style={headerBtn} title="Edit exercises">✎</button>)}
              {onRemove && !editing && <button onClick={onRemove} title="Remove this dryland block" style={{ ...headerBtn, fontSize: 16 }}>✕</button>}
            </span>
          </div>
          <div style={{ padding: "8px 14px" }}>
            {editing ? (
              <>
                {draft.exercises.map((e, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", padding: "4px 0", flexWrap: "wrap" }}>
                    <input type="number" min="1" value={e.sets} onChange={ev => updEx(i, "sets", Number(ev.target.value) || 1)} title="sets" style={{ ...inp, width: 44 }} />
                    <span style={{ color: "#9a7b4f" }}>×</span>
                    <input value={e.reps} onChange={ev => updEx(i, "reps", ev.target.value)} placeholder="reps / hold" title="reps or hold" style={{ ...inp, width: 92 }} />
                    <input value={e.name} onChange={ev => updEx(i, "name", ev.target.value)} placeholder="exercise" style={{ ...inp, flex: 1, minWidth: 120 }} />
                    <input value={e.rest || ""} onChange={ev => updEx(i, "rest", ev.target.value || null)} placeholder="rest" title="rest (optional)" style={{ ...inp, width: 64 }} />
                    <button onClick={() => rmEx(i)} title="Remove exercise" style={{ background: "transparent", border: "none", color: "#a3702c", cursor: "pointer", fontSize: 14 }}>✕</button>
                  </div>
                ))}
                <button onClick={addEx} style={{ marginTop: 6, padding: "4px 10px", border: "1px dashed #a3702c", borderRadius: 6, background: "transparent", color: "#a3702c", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Add exercise</button>
              </>
            ) : (
              ex.length === 0 ? (
                <div style={{ color: "#9a7b4f", fontSize: 12, fontStyle: "italic" }}>No exercises.</div>
              ) : ex.map((e, i) => (
                <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "4px 0", borderTop: i > 0 ? "1px solid #ecddc3" : "none" }}>
                  <span style={{ minWidth: 70, fontWeight: 700, color: "#7a4a12", fontSize: 13, fontFamily: "ui-monospace, monospace" }}>
                    {e.sets > 1 ? `${e.sets} × ${e.reps}` : `${e.reps}`}
                  </span>
                  <span style={{ flex: 1, fontSize: 13 }}>
                    <span title={DRYLAND_EXPLAINERS[e.name] || undefined}
                      style={{ color: "#5b4326", ...(DRYLAND_EXPLAINERS[e.name] ? { borderBottom: "1px dotted #c9a96a", cursor: "help" } : {}) }}>
                      {e.name}
                    </span>
                    {DRYLAND_EXPLAINERS[e.name] ? (
                      <span title={DRYLAND_EXPLAINERS[e.name]} style={{ color: "#a3702c", fontSize: 11, marginLeft: 4, cursor: "help" }}>ⓘ</span>
                    ) : null}
                  </span>
                  {e.rest && <span style={{ color: "#9a7b4f", fontSize: 11 }}>rest {e.rest}</span>}
                </div>
              ))
            )}
          </div>
        </div>
      );
    }
