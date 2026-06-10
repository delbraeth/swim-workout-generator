// src/components/shell/ImpersonationStartModal.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).

    import { useDialogA11y } from "./useDialogA11y.js";

    const { useState, useMemo, useEffect } = React;

    export function ImpersonationStartModal({ me, onClose, onStartImpersonation }) {
      const dialogRef = useDialogA11y(onClose);
      const [users,  setUsers]  = React.useState(null);
      const [query,  setQuery]  = React.useState("");
      const [picked, setPicked] = React.useState(null);
      const [err,    setErr]    = React.useState(null);
      const [busy,   setBusy]   = React.useState(false);
      React.useEffect(() => {
        fetch("/api/admin/users", { cache: "no-store" })
          .then(r => r.ok ? r.json() : [])
          .then(setUsers)
          .catch(() => setUsers([]));
      }, []);
      const filtered = React.useMemo(() => {
        if (!users) return [];
        const q = query.trim().toLowerCase();
        if (!q) return users.slice(0, 20);
        return users.filter(u => {
          return (u.email || "").toLowerCase().includes(q)
            || (u.display_name || "").toLowerCase().includes(q)
            || (u.initials || "").toLowerCase().includes(q)
            || u.sub.toLowerCase().includes(q);
        }).slice(0, 20);
      }, [users, query]);
      const confirm = async () => {
        if (!picked) return;
        setBusy(true); setErr(null);
        try {
          await onStartImpersonation(picked.sub, picked.display_name || picked.initials || picked.email, picked.email);
          onClose();
        } catch (e) {
          setErr(e.message); setBusy(false);
        }
      };
      return (
        <div onClick={onClose} className="modal-overlay" style={{ padding: 20 }}>
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Start impersonation" onClick={(e) => e.stopPropagation()} style={{
            background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 12,
            padding: 22, maxWidth: 560, width: "100%", maxHeight: "80vh", display: "flex", flexDirection: "column",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
              <div style={{ color: "#fff", fontSize: 16, fontWeight: 700 }}>🛂 Start impersonation</div>
              <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", color: "var(--color-text-dim)", fontSize: 18, cursor: "pointer", padding: 0 }}>×</button>
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-dim)", marginBottom: 10 }}>
              30-min read-only session. Audit-logged. The user will NOT be notified.
            </div>
            <input type="text" value={query} onChange={e => { setQuery(e.target.value); setPicked(null); }}
              autoFocus aria-label="Search users" placeholder="Search by email, name, initials, or sub…"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--color-border-strong)", background: "var(--color-card)", color: "var(--color-text)", fontSize: 13, marginBottom: 12 }} />
            {users === null ? (
              <div style={{ color: "var(--color-text-dim)", fontSize: 12 }}>Loading users…</div>
            ) : (
              <div style={{ overflowY: "auto", flex: 1, border: "1px solid var(--color-border)", borderRadius: 6 }}>
                {filtered.length === 0 ? (
                  <div style={{ padding: 16, color: "var(--color-text-dim)", fontSize: 12, fontStyle: "italic" }}>No matches.</div>
                ) : filtered.map(u => {
                  const isSelf = u.sub === me?.sub;
                  const isPicked = picked && picked.sub === u.sub;
                  return (
                    <div key={u.sub} onClick={() => !isSelf && setPicked(u)}
                      style={{
                        padding: "8px 12px", borderBottom: "1px solid var(--color-card)",
                        cursor: isSelf ? "not-allowed" : "pointer",
                        background: isPicked ? "rgba(220,38,38,0.18)" : "transparent",
                        opacity: isSelf ? 0.4 : 1,
                      }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                        <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{u.display_name || u.initials || "—"}</span>
                        <span style={{ color: "var(--color-text-dim)", fontSize: 11, fontFamily: "monospace" }}>{u.email || u.sub.slice(0, 16) + "…"}</span>
                      </div>
                      {isSelf && <div style={{ fontSize: 10, color: "var(--color-text-dim)", fontStyle: "italic" }}>cannot impersonate yourself</div>}
                    </div>
                  );
                })}
              </div>
            )}
            {err && <div style={{ color: "#fca5a5", fontSize: 12, marginTop: 8 }}>{err}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button onClick={onClose} disabled={busy}
                style={{ padding: "8px 14px", borderRadius: 6, background: "var(--color-border)", border: "none", color: "var(--color-text)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={confirm} disabled={!picked || busy}
                style={{ padding: "8px 14px", borderRadius: 6, background: picked ? "#dc2626" : "var(--color-border)", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: picked ? "pointer" : "not-allowed" }}>
                {busy ? "Starting…" : "🛂 Impersonate"}
              </button>
            </div>
          </div>
        </div>
      );
    }
