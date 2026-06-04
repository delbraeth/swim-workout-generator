// src/components/admin/AdminInvites.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components are imported below (freevars-driven).
import { csrfHeaders } from "../../lib/shared.js";

    const { useState, useCallback, useEffect } = React;

    export function AdminInvites() {
      const [invites, setInvites] = React.useState(null);
      const [note, setNote] = React.useState("");
      const [maxUses, setMaxUses] = React.useState(1);
      const [expiresAt, setExpiresAt] = React.useState("");
      const [msg, setMsg] = React.useState(null);
      const [copiedCode, setCopiedCode] = React.useState(null);

      const copyShareUrl = (code) => {
        // Provider-neutral invite landing — recipient picks Apple OR Google
        // on SignInGate; the chosen button preserves the invite param.
        // Was hard-coded to /api/auth/apple?invite= pre Phase 2 Google.
        navigator.clipboard.writeText(`${window.location.origin}/?invite=${code}`);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(c => c === code ? null : c), 1500);
      };

      const load = React.useCallback(async () => {
        const r = await fetch("/api/admin/invites", { cache: "no-store" });
        setInvites(r.ok ? await r.json() : []);
      }, []);
      React.useEffect(() => { load(); }, [load]);

      const create = async () => {
        setMsg(null);
        const body = { note: note || null, maxUses: Number(maxUses) || 1, expiresAt: expiresAt || null };
        const r = await fetch("/api/admin/invites", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify(body),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) { setMsg(`Error: ${data.error || r.status}`); return; }
        setMsg(`Created: ${data.code}`);
        setNote(""); setMaxUses(1); setExpiresAt("");
        await load();
      };

      const remove = async (code) => {
        if (!confirm(`Delete invite ${code}?`)) return;
        setMsg(null);
        const r = await fetch(`/api/admin/invites/${encodeURIComponent(code)}`, { method: "DELETE", headers: { ...csrfHeaders() } });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) { setMsg(`Error: ${data.error || r.status}`); return; }
        await load();
      };

      if (invites === null) return <div style={{ color: "var(--color-text-dim)" }}>Loading…</div>;
      return (
        <div>
          <div className="card" style={{ borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Create invite</div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr auto", gap: 8, alignItems: "center" }}>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (e.g., for Sarah)"
                style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 4, color: "var(--color-text)", padding: "6px 8px", fontSize: 12 }} />
              <input type="number" value={maxUses} onChange={e => setMaxUses(e.target.value)} min={1} max={100} placeholder="Max uses"
                style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 4, color: "var(--color-text)", padding: "6px 8px", fontSize: 12 }} />
              <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
                style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 4, color: "var(--color-text)", padding: "6px 8px", fontSize: 12 }} />
              <button onClick={create} style={{ background: "var(--color-primary)", color: "var(--color-bg)", border: "none", borderRadius: 4, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Create</button>
            </div>
          </div>
          {msg && <div style={{ fontSize: 12, color: "#10b981", marginBottom: 10 }}>{msg}</div>}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, color: "#cbd5e1" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-text-dim)", textAlign: "left" }}>
                <th style={{ padding: "8px 6px" }}>Code</th>
                <th style={{ padding: "8px 6px" }}>Note</th>
                <th style={{ padding: "8px 6px" }}>Uses</th>
                <th style={{ padding: "8px 6px" }}>Status</th>
                <th style={{ padding: "8px 6px" }}>Expires</th>
                <th style={{ padding: "8px 6px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invites.map(i => (
                <tr key={i.code} style={{ borderBottom: "1px solid var(--color-card)" }}>
                  <td style={{ padding: "8px 6px", fontFamily: "monospace" }}>{i.code}</td>
                  <td style={{ padding: "8px 6px" }}>{i.note || "—"}</td>
                  <td style={{ padding: "8px 6px" }}>{i.times_used}/{i.max_uses}</td>
                  <td style={{ padding: "8px 6px" }}>
                    <span style={{
                      background: i.status === "active" ? "#10b98122" : "#7f1d1d22",
                      color:      i.status === "active" ? "#10b981"   : "#fca5a5",
                      padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700,
                    }}>{i.status}</span>
                  </td>
                  <td style={{ padding: "8px 6px", color: "var(--color-text-muted)" }}>{i.expires_at ? new Date(i.expires_at).toLocaleDateString() : "—"}</td>
                  <td style={{ padding: "8px 6px" }}>
                    <button onClick={() => copyShareUrl(i.code)} style={{ marginRight: 4, fontSize: 11, padding: "3px 8px", background: copiedCode === i.code ? "#10b981" : "var(--color-border)", border: "none", borderRadius: 4, color: copiedCode === i.code ? "var(--color-bg)" : "#cbd5e1", cursor: "pointer", fontWeight: copiedCode === i.code ? 700 : 400, transition: "background 0.15s, color 0.15s" }}>
                      {copiedCode === i.code ? "✓ Copied!" : "Copy link"}
                    </button>
                    <button onClick={() => remove(i.code)} style={{ fontSize: 11, padding: "3px 8px", background: "#7f1d1d", border: "none", borderRadius: 4, color: "#fee2e2", cursor: "pointer" }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
