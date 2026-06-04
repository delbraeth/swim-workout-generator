// src/components/admin/AdminUsers.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components are imported below (freevars-driven).
import { EditUserModal } from "./EditUserModal.jsx";
import { csrfHeaders } from "../../lib/api.js";

    const { useState, useCallback, useEffect } = React;

    export function AdminUsers({ me, onStartImpersonation }) {
      const [users, setUsers] = React.useState(null);
      const [msg, setMsg]     = React.useState(null);
      const [editing, setEditing] = React.useState(null); // user being edited

      const load = React.useCallback(async () => {
        const r = await fetch("/api/admin/users", { cache: "no-store" });
        setUsers(r.ok ? await r.json() : []);
      }, []);
      React.useEffect(() => { load(); }, [load]);

      const canImpersonate = !!(me && (me.is_admin || me.support_role));

      const startImpersonate = async (u) => {
        if (!canImpersonate || !onStartImpersonation) return;
        if (u.sub === me.sub) { setMsg("Error: cannot impersonate yourself"); return; }
        if (!confirm(`Start 30-minute impersonation of ${u.display_name || u.email || u.sub.slice(0, 10)}?\n\nRead-only. Every action is audit-logged. The user will NOT be notified.`)) return;
        try {
          await onStartImpersonation(u.sub, u.display_name || u.initials || u.email, u.email);
          setMsg(`Impersonation of ${u.display_name || u.email || u.sub.slice(0, 10)} started.`);
        } catch (err) {
          setMsg(`Error starting impersonation: ${err.message}`);
        }
      };

      const act = async (sub, action, body = null) => {
        setMsg(null);
        let url, method = "POST", payload = null;
        if (action === "disable") url = `/api/admin/users/${encodeURIComponent(sub)}/disable`;
        else if (action === "enable") url = `/api/admin/users/${encodeURIComponent(sub)}/enable`;
        else if (action === "coach-grant" || action === "coach-revoke") {
          url = `/api/admin/users/${encodeURIComponent(sub)}/coach`;
          payload = { granted: action === "coach-grant" };
        }
        else if (action === "support-grant" || action === "support-revoke") {
          url = `/api/admin/users/${encodeURIComponent(sub)}/support-role`;
          payload = { granted: action === "support-grant" };
        }
        else if (action === "tier-grant-coach" || action === "tier-grant-lesson" || action === "tier-grant-program" || action === "tier-revoke") {
          url = `/api/admin/users/${encodeURIComponent(sub)}/tier`;
          // tier-grant-<tier> → <tier>; tier-revoke → free.
          payload = { tier: action === "tier-revoke" ? "free" : action.replace("tier-grant-", "") };
        }
        else if (action === "delete") {
          if (!confirm(`Delete user ${sub.slice(0, 10)}…?\n\nThis cascades and wipes all their workouts, favorites, settings, and sessions. Audit events stay (anonymized). NOT REVERSIBLE.`)) return;
          url = `/api/admin/users/${encodeURIComponent(sub)}`;
          method = "DELETE";
        }
        const r = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: payload ? JSON.stringify(payload) : undefined,
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) { setMsg(`Error: ${data.error || r.status}`); return; }
        setMsg(`${action} → ok`);
        await load();
      };

      if (users === null) return <div style={{ color: "var(--color-text-dim)" }}>Loading…</div>;
      return (
        <div>
          {msg && <div style={{ fontSize: 12, color: "#10b981", marginBottom: 10 }}>{msg}</div>}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, color: "#cbd5e1" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-text-dim)", textAlign: "left" }}>
                <th style={{ padding: "8px 6px" }}>Initials</th>
                <th style={{ padding: "8px 6px" }}>Name</th>
                <th style={{ padding: "8px 6px" }}>Email</th>
                <th style={{ padding: "8px 6px", textAlign: "right" }}>Workouts</th>
                <th style={{ padding: "8px 6px" }}>Last login</th>
                <th style={{ padding: "8px 6px" }}>Flags</th>
                <th style={{ padding: "8px 6px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.sub} style={{ borderBottom: "1px solid var(--color-card)" }}>
                  <td style={{ padding: "8px 6px", fontWeight: 700 }}>{u.initials || "—"}</td>
                  <td style={{ padding: "8px 6px" }}>{u.display_name || "—"}</td>
                  <td style={{ padding: "8px 6px" }} title={u.sub}>{u.email || u.sub.slice(0, 16) + "…"}</td>
                  <td style={{ padding: "8px 6px", textAlign: "right" }}>{u.workout_count}</td>
                  <td style={{ padding: "8px 6px", color: "var(--color-text-muted)" }}>{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "—"}</td>
                  <td style={{ padding: "8px 6px" }}>
                    {u.is_admin     && <span style={{ background: "var(--color-primary)", color: "var(--color-bg)", padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700, marginRight: 4 }}>admin</span>}
                    {u.is_coach     && <span style={{ background: "var(--color-primary)", color: "var(--color-bg)", padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700, marginRight: 4 }}>coach</span>}
                    {u.support_role && <span style={{ background: "#7c3aed", color: "#fff", padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700, marginRight: 4 }}>support</span>}
                    {u.tier && u.tier !== "free" && <span title={u.tier_source ? `Granted via ${u.tier_source} on ${u.tier_granted_at ? new Date(u.tier_granted_at).toLocaleDateString() : "?"}` : "Tier active"} style={{ background: "#0d9488", color: "#fff", padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700, marginRight: 4 }}>{u.tier}{u.tier_source === "admin_grant" ? " · comp" : ""}</span>}
                    {u.is_disabled  && <span style={{ background: "#7f1d1d", color: "#fee2e2", padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>disabled</span>}
                  </td>
                  <td style={{ padding: "8px 6px" }}>
                    {/* Copy-sub button — primary use: grabbing your own sub
                        for ADMIN_SUBS env-var config. Falls back to a
                        prompt() when navigator.clipboard isn't available
                        (HTTP, old browsers, denied permission). */}
                    <button
                      onClick={() => {
                        const sub = u.sub;
                        const fallback = () => window.prompt("Copy this sub:", sub);
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                          navigator.clipboard.writeText(sub).then(
                            () => setMsg(`copied ${sub.slice(0, 10)}…`),
                            () => fallback(),
                          );
                        } else {
                          fallback();
                        }
                      }}
                      title={`Copy full sub: ${u.sub}`}
                      style={{ marginRight: 4, fontSize: 11, padding: "3px 8px", background: "var(--color-border)", border: "none", borderRadius: 4, color: "#cbd5e1", cursor: "pointer", fontFamily: "monospace" }}>
                      📋 sub
                    </button>
                    <button onClick={() => setEditing(u)} style={{ marginRight: 4, fontSize: 11, padding: "3px 8px", background: "var(--color-border)", border: "none", borderRadius: 4, color: "#cbd5e1", cursor: "pointer" }}>
                      Edit
                    </button>
                    <button onClick={() => act(u.sub, u.is_coach ? "coach-revoke" : "coach-grant")}
                      title={u.is_admin ? "Admins implicitly have coach access; explicit toggle still settable for clarity." : ""}
                      style={{ marginRight: 4, fontSize: 11, padding: "3px 8px", background: u.is_coach ? "#1e40af" : "var(--color-border)", border: "none", borderRadius: 4, color: "#cbd5e1", cursor: "pointer" }}>
                      {u.is_coach ? "Un-coach" : "Coach"}
                    </button>
                    {me?.is_admin && (
                      <button onClick={() => act(u.sub, u.support_role ? "support-revoke" : "support-grant")}
                        title="Grants impersonation rights without full admin. Admin-only to toggle."
                        style={{ marginRight: 4, fontSize: 11, padding: "3px 8px", background: u.support_role ? "#7c3aed" : "var(--color-border)", border: "none", borderRadius: 4, color: u.support_role ? "#fff" : "#cbd5e1", cursor: "pointer" }}>
                        {u.support_role ? "Un-support" : "Support"}
                      </button>
                    )}
                    {me?.is_admin && (
                      <select
                        value={u.tier || "free"}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (next === u.tier) return;
                          const label = next === "free" ? "revoke paid tier" : `grant ${next} tier (comp)`;
                          if (!confirm(`${label} for ${u.display_name || u.sub.slice(0,10)}?`)) return;
                          act(u.sub, next === "free" ? "tier-revoke" : `tier-grant-${next}`);
                        }}
                        title={u.tier_source ? `Tier source: ${u.tier_source}` : "Set paid tier (comps testers without Stripe). Free = revoke."}
                        style={{ marginRight: 4, fontSize: 11, padding: "3px 6px", background: u.tier && u.tier !== "free" ? "#0d9488" : "var(--color-border)", border: "none", borderRadius: 4, color: u.tier && u.tier !== "free" ? "#fff" : "#cbd5e1", cursor: "pointer" }}>
                        <option value="free">Free</option>
                        <option value="lesson">Lesson</option>
                        <option value="coach">Coach</option>
                        <option value="program">Program</option>
                      </select>
                    )}
                    {canImpersonate && u.sub !== me?.sub && (
                      <button onClick={() => startImpersonate(u)}
                        title="Start 30-minute read-only impersonation session"
                        style={{ marginRight: 4, fontSize: 11, padding: "3px 8px", background: "#dc2626", border: "none", borderRadius: 4, color: "#fff", cursor: "pointer", fontWeight: 700 }}>
                        🛂 Impersonate
                      </button>
                    )}
                    <button onClick={() => act(u.sub, u.is_disabled ? "enable" : "disable")} style={{ marginRight: 4, fontSize: 11, padding: "3px 8px", background: "var(--color-border)", border: "none", borderRadius: 4, color: "#cbd5e1", cursor: "pointer" }}>
                      {u.is_disabled ? "Enable" : "Disable"}
                    </button>
                    <button onClick={() => act(u.sub, "delete")} style={{ fontSize: 11, padding: "3px 8px", background: "#7f1d1d", border: "none", borderRadius: 4, color: "#fee2e2", cursor: "pointer" }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {editing && (
            <EditUserModal user={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setMsg("updated"); load(); }} />
          )}
        </div>
      );
    }
