// src/components/admin/AdminFeedback.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components are imported below (freevars-driven).
import { csrfHeaders } from "../../app.jsx";

    const { useState, useCallback, useEffect } = React;

    export function AdminFeedback() {
      const [items, setItems]       = React.useState(null);
      const [statusFilter, setStatusFilter] = React.useState("new");
      const [msg, setMsg]           = React.useState(null);
      const [noteDrafts, setNoteDrafts] = React.useState({}); // {id: text}

      const load = React.useCallback(async () => {
        setItems(null); setMsg(null);
        const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
        try {
          const res = await fetch(`/api/admin/feedback${qs}`, { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          setItems(Array.isArray(data) ? data : []);
        } catch (err) {
          setItems([]);
          setMsg(`Error: ${err.message || err}`);
        }
      }, [statusFilter]);
      React.useEffect(() => { load(); }, [load]);

      const updateRow = async (id, patch) => {
        try {
          const res = await fetch(`/api/admin/feedback/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify(patch),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          await load();
        } catch (err) {
          setMsg(`Error: ${err.message || err}`);
        }
      };

      const fmtTime = (iso) => iso ? new Date(iso).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" }) : "—";

      const STATUSES = [
        { id: "new",       label: "New",       color: "var(--color-warn)" },
        { id: "reviewed",  label: "Reviewed",  color: "var(--color-primary)" },
        { id: "resolved",  label: "Resolved",  color: "var(--color-positive)" },
        { id: "dismissed", label: "Dismissed", color: "var(--color-text-dim)" },
      ];
      const CAT_LABEL = { idea: "💡 Idea", bug: "🐛 Bug", praise: "✨ Praise", "catalog-flag": "🚩 Catalog flag", other: "Other" };

      return (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Status:</span>
            {[{ id: "", label: "All" }, ...STATUSES].map(s => {
              const active = statusFilter === s.id;
              return (
                <button key={s.id || "all"} onClick={() => setStatusFilter(s.id)}
                  className="pill"
                  style={{
                    border: `1px solid ${active ? (s.color || "var(--color-primary)") : "var(--color-border)"}`,
                    background: active ? `${s.color || "var(--color-primary)"}22` : "transparent",
                    color: active ? (s.color || "var(--color-primary)") : "var(--color-text-muted)",
                    fontSize: 12, cursor: "pointer",
                  }}>
                  {s.label}
                </button>
              );
            })}
          </div>
          {msg && <div style={{ color: "#fca5a5", fontSize: 13, marginBottom: 10 }}>{msg}</div>}
          {items === null ? (
            <div style={{ color: "var(--color-text-dim)", fontSize: 13 }}>Loading…</div>
          ) : items.length === 0 ? (
            <div style={{ color: "var(--color-text-dim)", fontSize: 13, fontStyle: "italic", padding: 12 }}>No feedback in this view.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {items.map(f => {
                const sMeta = STATUSES.find(s => s.id === f.status) || STATUSES[0];
                const noteVal = id => (id in noteDrafts ? noteDrafts[id] : (f.admin_note || ""));
                return (
                  <div key={f.id} className="card" style={{ borderRadius: 10, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: `${sMeta.color}22`, border: `1px solid ${sMeta.color}`, color: sMeta.color }}>
                          {sMeta.label}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{CAT_LABEL[f.category] || f.category}</span>
                        <span style={{ fontSize: 14, color: "var(--color-text)", fontWeight: 700 }}>{f.subject}</span>
                      </div>
                      <div style={{ fontSize: 10, color: "var(--color-text-dim)", textAlign: "right" }}>
                        <div>{fmtTime(f.created_at)}</div>
                        <div>
                          {f.submitter_initials || (f.user_sub ? f.user_sub.slice(0, 12) + "…" : "anonymous")}
                          {f.submitter_name ? ` · ${f.submitter_name}` : ""}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: "#cbd5e1", whiteSpace: "pre-wrap", marginBottom: 8 }}>{f.body}</div>
                    <div style={{ fontSize: 10, color: "var(--color-border-strong)", marginBottom: 10 }}>
                      {f.page && <span>page: <code>{f.page}</code></span>}
                      {f.user_agent && <span style={{ marginLeft: 12 }}>ua: <code style={{ color: "var(--color-text-dim)" }}>{f.user_agent.slice(0, 80)}{f.user_agent.length > 80 ? "…" : ""}</code></span>}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                      {STATUSES.map(s => (
                        <button key={s.id} onClick={() => updateRow(f.id, { status: s.id })}
                          disabled={f.status === s.id}
                          style={{
                            padding: "4px 10px", borderRadius: 6,
                            border: `1px solid ${f.status === s.id ? s.color : "var(--color-border)"}`,
                            background: f.status === s.id ? `${s.color}22` : "transparent",
                            color: f.status === s.id ? s.color : "var(--color-text-muted)",
                            fontSize: 11, fontWeight: 700,
                            cursor: f.status === s.id ? "default" : "pointer",
                          }}>
                          → {s.label}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <textarea
                        rows={2}
                        value={noteVal(f.id)}
                        onChange={e => setNoteDrafts(d => ({ ...d, [f.id]: e.target.value }))}
                        placeholder="Admin note (internal)…"
                        style={{
                          flex: 1, padding: "6px 8px", fontSize: 12,
                          background: "var(--color-bg)", color: "var(--color-text)",
                          border: "1px solid var(--color-border)", borderRadius: 6,
                          fontFamily: "inherit", resize: "vertical",
                        }} />
                      <button
                        onClick={() => updateRow(f.id, { admin_note: noteVal(f.id) })}
                        style={{
                          padding: "6px 12px", borderRadius: 6, border: "none",
                          background: "var(--color-primary)", color: "#fff",
                          fontSize: 11, fontWeight: 700, cursor: "pointer",
                          alignSelf: "flex-start",
                        }}>
                        Save note
                      </button>
                    </div>
                    {f.reviewer_initials && f.reviewed_at && (
                      <div style={{ fontSize: 10, color: "var(--color-text-dim)", marginTop: 6 }}>
                        Last touched by <strong style={{ color: "var(--color-text-muted)" }}>{f.reviewer_initials}</strong> · {fmtTime(f.reviewed_at)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }
