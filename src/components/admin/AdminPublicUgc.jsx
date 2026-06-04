// src/components/admin/AdminPublicUgc.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components are imported below (freevars-driven).
import { UgcGraduateModal } from "./UgcGraduateModal.jsx";
import { API_BASE } from "../../app.jsx";

    const { useState, useCallback, useEffect } = React;

    export function AdminPublicUgc() {
      const [rows, setRows] = React.useState([]);
      const [loading, setLoading] = React.useState(true);
      const [err, setErr] = React.useState(null);
      const [graduating, setGraduating] = React.useState(null);  // option_id being graduated

      const reload = React.useCallback(() => {
        setLoading(true);
        fetch(`${API_BASE}/admin/promotable-ugc`, { cache: "no-store", credentials: "include" })
          .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
          .then(data => { setRows(Array.isArray(data) ? data : []); setErr(null); })
          .catch(e => setErr(e.message || String(e)))
          .finally(() => setLoading(false));
      }, []);
      React.useEffect(() => { reload(); }, [reload]);

      const fmtDate = (d) => d ? new Date(d).toLocaleString() : "—";

      return (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <p style={{ margin: 0, color: "var(--color-muted)", fontSize: 13 }}>
              Public UGC options approved by admin and ready to be graduated into the canonical JS bank.
              Graduate = paste snippet into <code>public/index.html</code>, commit + push, then confirm.
              After confirmation the row leaves the overlay (JS becomes the source of truth).
            </p>
            <button onClick={reload} style={{ padding: "6px 12px", fontSize: 12, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text)", borderRadius: 4, cursor: "pointer" }}>Reload</button>
          </div>
          {err && <div style={{ padding: 8, marginBottom: 8, background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", borderRadius: 4, color: "#ef4444", fontSize: 13 }}>{err}</div>}
          {loading && <p style={{ color: "var(--color-muted)" }}>Loading…</p>}
          {!loading && rows.length === 0 && (
            <p style={{ color: "var(--color-muted)", textAlign: "center", padding: 24 }}>No public UGC waiting to graduate.</p>
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
                  <th style={{ padding: "6px 4px" }}>Author</th>
                  <th style={{ padding: "6px 4px" }}>Approved</th>
                  <th style={{ padding: "6px 4px", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td style={{ padding: "6px 4px", fontWeight: 500 }}>{r.label}</td>
                    <td style={{ padding: "6px 4px" }}>{r.section}</td>
                    <td style={{ padding: "6px 4px" }}>{r.pool_mode}</td>
                    <td style={{ padding: "6px 4px" }}>{r.type_id || r.stroke_id || "—"}</td>
                    <td style={{ padding: "6px 4px", textAlign: "right" }}>{r.total_yards}</td>
                    <td style={{ padding: "6px 4px" }} title={r.author_sub}>{r.author_name || r.author_initials || r.author_email || r.author_sub.slice(0, 8)}</td>
                    <td style={{ padding: "6px 4px", color: "var(--color-muted)" }}>{fmtDate(r.approved_at)}</td>
                    <td style={{ padding: "6px 4px", textAlign: "right" }}>
                      <button onClick={() => setGraduating(r.id)}
                        style={{ padding: "4px 10px", border: "1px solid var(--color-primary)", background: "transparent", color: "var(--color-primary)", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                        🎓 Graduate to JS
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {graduating && (
            <UgcGraduateModal
              optionId={graduating}
              onDone={() => { setGraduating(null); reload(); }}
              onClose={() => setGraduating(null)}
            />
          )}
        </div>
      );
    }
