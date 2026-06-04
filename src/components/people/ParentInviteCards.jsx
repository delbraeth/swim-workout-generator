// src/components/people/ParentInviteCards.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { API_BASE, csrfHeaders } from "../../app.jsx";

    const { useState } = React;

    export function ParentInviteCards({ invites, onResolved }) {
      const [busyId, setBusyId] = React.useState(null);
      const [err, setErr] = React.useState(null);
      if (!Array.isArray(invites) || invites.length === 0) return null;
      const act = async (id, action) => {
        setBusyId(id); setErr(null);
        try {
          const res = await fetch(`${API_BASE}/parent/invites/${id}/${action}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
          });
          if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `HTTP ${res.status}`); }
          if (onResolved) onResolved();
        } catch (e) { setErr(e.message || String(e)); }
        finally { setBusyId(null); }
      };
      return (
        <div className="screen-only" style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 16px", background: "var(--color-bg)" }}>
          {invites.map(inv => (
            <div key={inv.id} style={{
              display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12,
              background: "var(--color-card)", border: "1px solid var(--color-primary)",
              borderRadius: 10, padding: "12px 14px",
            }}>
              <div style={{ flex: 1, minWidth: 200, fontSize: 13, color: "var(--color-text)" }}>
                👪 <strong>{inv.coach_name}</strong> invited you to follow <strong>{inv.swimmer_name}</strong> on SetForge as a parent/guardian.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => act(inv.id, "accept")} disabled={busyId === inv.id}
                  style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "var(--color-primary)", color: "var(--color-bg)", fontSize: 13, fontWeight: 800, cursor: busyId === inv.id ? "default" : "pointer" }}>
                  {busyId === inv.id ? "…" : "Accept"}
                </button>
                <button onClick={() => act(inv.id, "decline")} disabled={busyId === inv.id}
                  style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-dim)", fontSize: 13, fontWeight: 600, cursor: busyId === inv.id ? "default" : "pointer" }}>
                  Decline
                </button>
              </div>
              {err && <div style={{ flexBasis: "100%", color: "#fca5a5", fontSize: 12 }}>{err}</div>}
            </div>
          ))}
        </div>
      );
    }
