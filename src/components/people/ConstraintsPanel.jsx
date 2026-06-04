// src/components/people/ConstraintsPanel.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { csrfHeaders, formatPscRow, PSC_LABEL_MAP } from "../../lib/shared.js";
import { ConstraintFormModal } from "./ConstraintFormModal.jsx";

    const { useState, useCallback, useEffect, useRef } = React;

    export function ConstraintsPanel({ managedId, seedConstraints = null }) {
      const [rows, setRows] = React.useState(Array.isArray(seedConstraints) ? seedConstraints : null);
      const [err,  setErr]  = React.useState(null);
      const [modalOpen, setModalOpen] = React.useState(false);
      const [editRow,   setEditRow]   = React.useState(null);  // prefill row for Edit

      const load = React.useCallback(async () => {
        try {
          const res = await fetch(`/api/swimmer-constraints?managed_id=${encodeURIComponent(managedId)}`, { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const j = await res.json();
          setRows(Array.isArray(j.constraints) ? j.constraints : []);
        } catch (e) { setErr(e.message); setRows([]); }
      }, [managedId]);
      // Seeded from the composite detail fetch — skip the initial load; still
      // refetch after add/edit/remove. Ref guards only the first run.
      const skipInitial = React.useRef(Array.isArray(seedConstraints));
      React.useEffect(() => { if (skipInitial.current) { skipInitial.current = false; return; } load(); }, [load]);

      const handleRemove = async (id, confirmMsg) => {
        if (confirmMsg && !window.confirm(confirmMsg)) return false;
        setErr(null);
        try {
          const res = await fetch(`/api/swimmer-constraints/${id}`, {
            method:  "DELETE",
            headers: { ...csrfHeaders() },
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          await load();
          return true;
        } catch (e) { setErr(e.message); return false; }
      };

      const handleEdit = async (row) => {
        // Per fork 3 (delete + recreate): drop the existing row first, then
        // open the form prefilled. If delete fails, abort.
        const ok = await handleRemove(row.id, null);
        if (!ok) return;
        setEditRow(row);
        setModalOpen(true);
      };

      return (
        <div className="card" style={{ borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ color: "var(--color-text)", margin: 0, fontSize: 15 }}>⚠ Active constraints</h3>
            <button onClick={() => { setEditRow(null); setModalOpen(true); }}
              style={{ padding: "5px 11px", background: "var(--color-primary)", color: "var(--color-bg)", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              + Add constraint
            </button>
          </div>

          {rows === null ? (
            <div style={{ color: "var(--color-text-muted)", fontSize: 12 }}>Loading…</div>
          ) : rows.length === 0 ? (
            <div style={{ color: "var(--color-text-muted)", fontSize: 12, fontStyle: "italic", padding: "8px 0" }}>
              No active constraints. Use Add to record an injury restriction, equipment limit, or taper cap.
            </div>
          ) : (
            <div>
              {rows.map(r => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--color-card)", gap: 8 }}>
                  <div style={{ fontSize: 13, color: "var(--color-text)", flex: 1 }}>
                    <span style={{ marginRight: 6 }}>⚠</span>
                    {formatPscRow(r)}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => handleEdit(r)} title="Edit (replaces the row)"
                      style={{ padding: "4px 9px", background: "var(--color-card)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>
                      Edit
                    </button>
                    <button onClick={() => handleRemove(r.id, `Remove "${PSC_LABEL_MAP[r.constraint_type] || r.constraint_type}"?`)}
                      style={{ padding: "4px 9px", background: "var(--color-card)", color: "var(--color-warn)", border: "1px solid var(--color-warn)", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {err && <div style={{ color: "#fca5a5", fontSize: 12, marginTop: 8 }}>Error: {err}</div>}

          <ConstraintFormModal
            open={modalOpen}
            managedId={managedId}
            prefill={editRow}
            onClose={() => { setModalOpen(false); setEditRow(null); }}
            onSaved={() => { load(); }}
          />
        </div>
      );
    }
