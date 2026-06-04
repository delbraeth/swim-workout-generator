// src/components/admin/AdminPendingUgc.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components are imported below (freevars-driven).
import { API_BASE } from "../../lib/shared.js";

    const { useState, useCallback, useEffect, Fragment } = React;

    export function AdminPendingUgc() {
      const [rows, setRows] = React.useState([]);
      const [loading, setLoading] = React.useState(true);
      const [err, setErr] = React.useState(null);
      const [expandedId, setExpandedId] = React.useState(null);
      const [previewById, setPreviewById] = React.useState({}); // option_id -> full option
      const [rejectingId, setRejectingId] = React.useState(null);
      const [rejectReason, setRejectReason] = React.useState("");
      const [busyId, setBusyId] = React.useState(null);

      const reload = React.useCallback(() => {
        setLoading(true);
        fetch(`${API_BASE}/admin/pending-ugc`, { cache: "no-store", credentials: "include" })
          .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
          .then(data => { setRows(Array.isArray(data) ? data : []); setErr(null); })
          .catch(e => setErr(e.message || String(e)))
          .finally(() => setLoading(false));
      }, []);
      React.useEffect(() => { reload(); }, [reload]);

      const togglePreview = async (id) => {
        if (expandedId === id) { setExpandedId(null); return; }
        if (!previewById[id]) {
          try {
            const r = await fetch(`${API_BASE}/bank-options/${id}`, { credentials: "include" });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const full = await r.json();
            setPreviewById(prev => ({ ...prev, [id]: full }));
          } catch (e) {
            window.alert(`Preview failed: ${e.message || String(e)}`);
            return;
          }
        }
        setExpandedId(id);
      };

      const submitReview = async (id, decision, reason = null) => {
        setBusyId(id);
        try {
          const csrf = (await (await fetch('/api/auth/csrf')).json()).token;
          const r = await fetch(`${API_BASE}/admin/pending-ugc/${id}/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
            credentials: 'include',
            body: JSON.stringify({ decision, reason }),
          });
          const j = await r.json();
          if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
          setRejectingId(null);
          setRejectReason("");
          setExpandedId(null);
          reload();
        } catch (e) {
          window.alert(`Review failed: ${e.message || String(e)}`);
        } finally {
          setBusyId(null);
        }
      };

      const fmtDate = (d) => d ? new Date(d).toLocaleString() : "—";

      return (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <p style={{ margin: 0, color: "var(--color-muted)", fontSize: 13 }}>
              Coach-submitted UGC options waiting for review. Approve → goes public to all coaches. Reject → row marked rejected with your reason; author sees it on their My Sets page.
            </p>
            <button onClick={reload} style={{ padding: "6px 12px", fontSize: 12, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text)", borderRadius: 4, cursor: "pointer" }}>Reload</button>
          </div>
          {err && <div style={{ padding: 8, marginBottom: 8, background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", borderRadius: 4, color: "#ef4444", fontSize: 13 }}>{err}</div>}
          {loading && <p style={{ color: "var(--color-muted)" }}>Loading…</p>}
          {!loading && rows.length === 0 && (
            <p style={{ color: "var(--color-muted)", textAlign: "center", padding: 24 }}>No pending submissions. 🎉</p>
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
                  <th style={{ padding: "6px 4px" }}>Submitted</th>
                  <th style={{ padding: "6px 4px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <React.Fragment key={r.id}>
                    <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <td style={{ padding: "6px 4px", fontWeight: 500 }}>{r.label}</td>
                      <td style={{ padding: "6px 4px" }}>{r.section}</td>
                      <td style={{ padding: "6px 4px" }}>{r.pool_mode}</td>
                      <td style={{ padding: "6px 4px" }}>{r.type_id || r.stroke_id || "—"}</td>
                      <td style={{ padding: "6px 4px", textAlign: "right" }}>{r.total_yards}</td>
                      <td style={{ padding: "6px 4px" }} title={r.author_sub}>{r.author_name || r.author_initials || r.author_email || r.author_sub.slice(0, 8)}</td>
                      <td style={{ padding: "6px 4px", color: "var(--color-muted)" }}>{fmtDate(r.updated_at)}</td>
                      <td style={{ padding: "6px 4px", textAlign: "right" }}>
                        <button onClick={() => togglePreview(r.id)} style={{ marginRight: 4, padding: "4px 8px", border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text)", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>
                          {expandedId === r.id ? "Hide" : "👁 Preview"}
                        </button>
                        <button disabled={busyId === r.id} onClick={() => submitReview(r.id, "approve")} style={{ marginRight: 4, padding: "4px 8px", border: "1px solid #10b981", background: "transparent", color: "#10b981", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>
                          ✅ Approve
                        </button>
                        <button disabled={busyId === r.id} onClick={() => { setRejectingId(r.id); setRejectReason(""); }} style={{ padding: "4px 8px", border: "1px solid #ef4444", background: "transparent", color: "#ef4444", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>
                          ❌ Reject
                        </button>
                      </td>
                    </tr>
                    {expandedId === r.id && previewById[r.id] && (
                      <tr>
                        <td colSpan={8} style={{ padding: "8px 16px", background: "var(--color-card)" }}>
                          <strong>Sets:</strong>
                          <ul style={{ margin: "6px 0 0 18px", fontSize: 12 }}>
                            {previewById[r.id].sets.map(s => (
                              <li key={s.id} style={{ marginBottom: 2 }}>
                                <code>{s.reps}×{s.dist}</code> — {s.desc} <em style={{ color: "var(--color-muted)" }}>({s.interval})</em>
                                {s.focus && <span style={{ color: "var(--color-muted)" }}> · focus: {s.focus}</span>}
                                {s.eq    && <span style={{ color: "var(--color-muted)" }}> · eq: {s.eq}</span>}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                    {rejectingId === r.id && (
                      <tr>
                        <td colSpan={8} style={{ padding: "8px 16px", background: "rgba(239,68,68,0.06)" }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-muted)", display: "block", marginBottom: 4 }}>Rejection reason (shown to author)</label>
                          <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2}
                            placeholder="e.g. Intervals don't match the stroke / set is mis-categorized / etc."
                            style={{ width: "100%", padding: 6, border: "1px solid var(--color-border)", borderRadius: 4, fontSize: 13, background: "var(--color-bg)", color: "var(--color-text)" }} />
                          <div style={{ marginTop: 6, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <button onClick={() => { setRejectingId(null); setRejectReason(""); }} style={{ padding: "4px 10px", fontSize: 12, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text)", borderRadius: 4, cursor: "pointer" }}>Cancel</button>
                            <button disabled={busyId === r.id || !rejectReason.trim()} onClick={() => submitReview(r.id, "reject", rejectReason.trim())}
                              style={{ padding: "4px 10px", fontSize: 12, border: "1px solid #ef4444", background: "#ef4444", color: "white", borderRadius: 4, cursor: rejectReason.trim() ? "pointer" : "not-allowed", opacity: rejectReason.trim() ? 1 : 0.5 }}>
                              {busyId === r.id ? "…" : "Confirm reject"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      );
    }
