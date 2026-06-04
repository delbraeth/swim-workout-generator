// src/components/people/ParentsPanel.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { csrfHeaders } from "../../app.jsx";

    const { useState, useCallback, useEffect, useRef } = React;

    export function ParentsPanel({ swimmerRef, swimmerName, seedGuardians = null, seedInvites = null }) {
      const seeded = seedGuardians != null || seedInvites != null;
      const [data,   setData]   = React.useState(seeded
        ? { guardians: Array.isArray(seedGuardians) ? seedGuardians : [], invites: Array.isArray(seedInvites) ? seedInvites : [] }
        : null);                                                          // { guardians, invites }
      const [email,  setEmail]  = React.useState("");
      const [busy,   setBusy]   = React.useState(false);
      const [msg,    setMsg]    = React.useState(null);
      const [info,   setInfo]   = React.useState(null);

      const load = React.useCallback(async () => {
        try {
          const res = await fetch(`/api/swimmers/${encodeURIComponent(swimmerRef)}/parents`, { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const j = await res.json();
          setData({
            guardians: Array.isArray(j.guardians) ? j.guardians : [],
            invites:   Array.isArray(j.invites)   ? j.invites   : [],
          });
        } catch (e) { setMsg(`Load failed: ${e.message}`); setData({ guardians: [], invites: [] }); }
      }, [swimmerRef]);
      // Seeded from the composite detail fetch — skip the initial load; still
      // refetch after invite/revoke/remove. Ref guards only the first run.
      const skipInitial = React.useRef(seeded);
      React.useEffect(() => { if (skipInitial.current) { skipInitial.current = false; return; } load(); }, [load]);

      const submitInvite = async () => {
        if (busy) return;
        const trimmed = email.trim();
        if (!trimmed) { setMsg("Enter the parent's email."); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setMsg("That doesn't look like a valid email."); return; }
        setBusy(true); setMsg(null); setInfo(null);
        try {
          const res = await fetch(`/api/swimmers/${encodeURIComponent(swimmerRef)}/parent-invite`, {
            method:  "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            // Server destructures `parent_email`; sending `email` 400s with
            // "parent_email required". Pre-2026-05-28 bug found in test.
            body:    JSON.stringify({ parent_email: trimmed }),
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
          setEmail("");
          setInfo(`Invite sent to ${trimmed}. They sign in with Apple or Google using that email to complete the link.`);
          await load();
        } catch (e) { setMsg(`Invite failed: ${e.message}`); }
        finally { setBusy(false); }
      };

      const revokeInvite = async (id) => {
        if (!window.confirm("Revoke this pending invite? You can re-invite later.")) return;
        setBusy(true); setMsg(null);
        try {
          const res = await fetch(`/api/parent-invites/${id}`, {
            method:  "DELETE",
            headers: { ...csrfHeaders() },
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          await load();
        } catch (e) { setMsg(`Revoke failed: ${e.message}`); }
        finally { setBusy(false); }
      };

      const removeGuardian = async (id, who) => {
        if (!window.confirm(`Remove ${who || "this parent"} from ${swimmerName || "this swimmer"}?\n\nThey'll lose access to the parent view and the weekly digest. You can re-invite them later if needed.`)) return;
        setBusy(true); setMsg(null);
        try {
          const res = await fetch(`/api/guardians/${id}`, {
            method:  "DELETE",
            headers: { ...csrfHeaders() },
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          await load();
        } catch (e) { setMsg(`Remove failed: ${e.message}`); }
        finally { setBusy(false); }
      };

      if (data === null) {
        return (
          <div className="card" style={{ borderRadius: 10, padding: 14, marginBottom: 14, color: "var(--color-text-dim)", fontSize: 12 }}>
            Loading parents…
          </div>
        );
      }
      const { guardians, invites } = data;

      return (
        <div className="card" style={{ borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <h3 style={{ color: "var(--color-text)", marginTop: 0, marginBottom: 10, fontSize: 14 }}>
            👪 Parents & Guardians
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: "var(--color-text-muted)" }}>
              · they see a weekly recap + read-only view
            </span>
          </h3>

          {/* Current guardians */}
          {guardians.length === 0 ? (
            <div style={{ color: "var(--color-text-dim)", fontSize: 12, fontStyle: "italic", marginBottom: 10 }}>
              No parents linked yet.
            </div>
          ) : (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Linked</div>
              {guardians.map(g => (
                <div key={g.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 8px", background: "var(--color-bg)", borderRadius: 6, marginBottom: 4 }}>
                  <div style={{ fontSize: 12, color: "var(--color-text)" }}>
                    <strong>{g.display_name || g.email || "Parent"}</strong>
                    {g.email && g.display_name && <span style={{ color: "var(--color-text-muted)", marginLeft: 6, fontSize: 11 }}>{g.email}</span>}
                  </div>
                  <button onClick={() => removeGuardian(g.id, g.display_name || g.email)} disabled={busy}
                    style={{ padding: "3px 9px", borderRadius: 4, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", fontSize: 11, cursor: busy ? "wait" : "pointer" }}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Pending invites */}
          {invites.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Pending invites</div>
              {invites.map(inv => (
                <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 8px", background: "var(--color-bg)", borderRadius: 6, marginBottom: 4 }}>
                  <div style={{ fontSize: 12, color: "var(--color-text)" }}>
                    <span>{inv.parent_email}</span>
                    <span style={{ color: "var(--color-text-muted)", marginLeft: 8, fontSize: 11 }}>
                      sent {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : "—"}
                    </span>
                  </div>
                  <button onClick={() => revokeInvite(inv.id)} disabled={busy}
                    style={{ padding: "3px 9px", borderRadius: 4, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", fontSize: 11, cursor: busy ? "wait" : "pointer" }}>
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new parent */}
          <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 10 }}>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Invite a parent</div>
            <div style={{ display: "flex", gap: 6, alignItems: "stretch", flexWrap: "wrap" }}>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setMsg(null); }}
                onKeyDown={e => { if (e.key === "Enter") submitInvite(); }}
                placeholder="parent@example.com"
                disabled={busy}
                style={{ flex: 1, minWidth: 180, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", fontSize: 13 }}
              />
              <button onClick={submitInvite} disabled={busy || !email.trim()}
                style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: busy ? "var(--color-border)" : "var(--color-primary)", color: "var(--color-bg)", fontSize: 12, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>
                {busy ? "Sending…" : "Send invite"}
              </button>
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-dim)", marginTop: 6, lineHeight: 1.5 }}>
              The parent gets an email with a link to SetForge. When they sign in with Apple or Google using this email, the link completes automatically — no token or password to manage.
            </div>
          </div>

          {info && <div style={{ color: "var(--color-positive)", fontSize: 12, marginTop: 8 }}>{info}</div>}
          {msg  && <div style={{ color: "var(--color-warn)",     fontSize: 12, marginTop: 8 }}>{msg}</div>}
        </div>
      );
    }
