// src/components/catalog/MySetsView.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { API_BASE } from "../../app.jsx";
import { UgcFormModal } from "./UgcFormModal.jsx";

    const { useState, useCallback, useEffect } = React;

    export function MySetsView({ onChanged }) {
      const [rows, setRows] = React.useState([]);
      const [loading, setLoading] = React.useState(true);
      const [err, setErr] = React.useState(null);
      const [formState, setFormState] = React.useState(null); // null | { mode: 'create' } | { mode: 'edit', option }
      const [deleting, setDeleting] = React.useState(null);

      const reload = React.useCallback(() => {
        setLoading(true);
        fetch(`${API_BASE}/bank-options/mine`, { cache: "no-store", credentials: "include" })
          .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
          .then(data => {
            setRows(Array.isArray(data) ? data : []);
            setErr(null);
          })
          .catch(e => setErr(e.message || String(e)))
          .finally(() => setLoading(false));
      }, []);
      React.useEffect(() => { reload(); }, [reload]);

      const handleSaved = () => {
        setFormState(null);
        reload();
        if (onChanged) onChanged();  // refresh the App's overlay state
      };

      const handleDelete = async (option) => {
        if (!window.confirm(`Delete "${option.label}"? This cannot be undone.`)) return;
        setDeleting(option.id);
        try {
          const csrf = (await (await fetch('/api/auth/csrf')).json()).token;
          const r = await fetch(`${API_BASE}/bank-options/${option.id}`, {
            method: 'DELETE',
            headers: { 'X-CSRF-Token': csrf },
            credentials: 'include',
          });
          const j = await r.json();
          if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
          reload();
          if (onChanged) onChanged();
        } catch (e) {
          window.alert(`Delete failed: ${e.message || String(e)}`);
        } finally {
          setDeleting(null);
        }
      };

      const handleEdit = async (option) => {
        // Fetch full option (with sets) before opening the form.
        try {
          const r = await fetch(`${API_BASE}/bank-options/${option.id}`, { credentials: 'include' });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const full = await r.json();
          setFormState({ mode: 'edit', option: full });
        } catch (e) {
          window.alert(`Load failed: ${e.message || String(e)}`);
        }
      };

      const fmtDate = (d) => {
        if (!d) return "—";
        const dt = new Date(d);
        return dt.toLocaleDateString() + " " + dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      };

      return (
        <div style={{ padding: "16px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>📝 My Sets</h2>
            <button
              onClick={() => setFormState({ mode: 'create' })}
              style={{
                padding: "8px 14px", borderRadius: 6, border: "1px solid var(--color-primary)",
                background: "var(--color-primary)", color: "white", fontWeight: 600, cursor: "pointer",
              }}
            >+ New set</button>
          </div>
          <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 0, marginBottom: 16 }}>
            Author your own bank options. Currently private (only you see them in your picker).
            Team-sharing + public submission are coming in later phases.
          </p>
          {err && (
            <div style={{ padding: 8, marginBottom: 8, background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", borderRadius: 4, color: "#ef4444", fontSize: 13 }}>
              {err}
            </div>
          )}
          {loading && <p style={{ color: "var(--color-muted)" }}>Loading…</p>}
          {!loading && rows.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: "var(--color-muted)", border: "1px dashed var(--color-border)", borderRadius: 8 }}>
              <p style={{ margin: 0 }}>No UGC sets yet. Tap <strong>+ New set</strong> to author your first one,</p>
              <p style={{ margin: "4px 0 0 0" }}>or use the 📥 snapshot button on a generated workout block.</p>
            </div>
          )}
          {!loading && rows.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                  <th style={{ padding: "6px 4px" }}>Label</th>
                  <th style={{ padding: "6px 4px" }}>Section</th>
                  <th style={{ padding: "6px 4px" }}>Pool</th>
                  <th style={{ padding: "6px 4px" }}>Type/Stroke</th>
                  <th style={{ padding: "6px 4px", textAlign: "right" }}>Yards</th>
                  <th style={{ padding: "6px 4px" }}>Visibility</th>
                  <th style={{ padding: "6px 4px" }}>Updated</th>
                  <th style={{ padding: "6px 4px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td style={{ padding: "6px 4px", fontWeight: 500 }}>{r.label}</td>
                    <td style={{ padding: "6px 4px" }}>{r.section}</td>
                    <td style={{ padding: "6px 4px" }}>{r.pool_mode}</td>
                    <td style={{ padding: "6px 4px" }}>{[...(r.type_ids || []), ...(r.stroke_ids || [])].join(", ") || r.type_id || r.stroke_id || "—"}</td>
                    <td style={{ padding: "6px 4px", textAlign: "right" }}>{r.total_yards}</td>
                    <td style={{ padding: "6px 4px" }}>
                      {r.promoted_at ? (
                        <span title={`Promoted to JS at ${fmtDate(r.promoted_at)}`} style={{ color: "var(--color-success, #10b981)" }}>✅ promoted</span>
                      ) : r.visibility === "private" ? (
                        <span title="Only you see this in your picker">📝 private</span>
                      ) : r.visibility === "team" ? (
                        <span title="Shared with teams you coach">👥 team</span>
                      ) : r.visibility === "public" ? (
                        <span title="Approved by admin; visible to all SetForge coaches" style={{ color: "var(--color-primary)" }}>🌐 public</span>
                      ) : r.visibility === "pending" ? (
                        <span title="Submitted for admin review" style={{ color: "var(--color-warn)" }}>⏳ pending review</span>
                      ) : r.visibility === "rejected" ? (
                        <span title={r.latest_review_reason ? `Rejected: ${r.latest_review_reason}` : "Rejected by admin"} style={{ color: "#ef4444" }}>❌ rejected</span>
                      ) : (
                        <span>{r.visibility}</span>
                      )}
                    </td>
                    <td style={{ padding: "6px 4px", color: "var(--color-muted)" }}>{fmtDate(r.updated_at)}</td>
                    <td style={{ padding: "6px 4px", textAlign: "right" }}>
                      {!r.promoted_at && (
                        <>
                          <button
                            onClick={() => handleEdit(r)}
                            style={{ marginRight: 4, padding: "4px 8px", border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text)", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                          >Edit</button>
                          <button
                            disabled={deleting === r.id}
                            onClick={() => handleDelete(r)}
                            style={{ padding: "4px 8px", border: "1px solid #ef4444", background: "transparent", color: "#ef4444", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                          >{deleting === r.id ? "…" : "Delete"}</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {formState && (
            <UgcFormModal
              option={formState.mode === 'edit' ? formState.option : null}
              onSave={handleSaved}
              onClose={() => setFormState(null)}
            />
          )}
        </div>
      );
    }
