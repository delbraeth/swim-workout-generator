// src/components/groups/JoinTokensPanel.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { csrfHeaders } from "../../lib/api.js";

    const { useState, useCallback, useEffect } = React;

    export function JoinTokensPanel({ groupId, isPrimary, isGroupCoach }) {
      const [tokens, setTokens]      = React.useState(null);
      const [issuing, setIssuing]    = React.useState(false);
      const [issueRole, setIssueRole] = React.useState("primary");
      const [latestIssued, setLatestIssued] = React.useState(null);              // {token, expires_at, intended_role}
      const [copied, setCopied]      = React.useState(false);
      const [err, setErr]            = React.useState(null);

      const load = React.useCallback(async () => {
        try {
          const res = await fetch(`/api/groups/${groupId}/join-tokens`, { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setTokens(await res.json());
        } catch (e) { setErr(e.message); setTokens([]); }
      }, [groupId]);
      React.useEffect(() => { if (isGroupCoach) load(); }, [isGroupCoach, load]);

      const issue = async () => {
        try {
          const res = await fetch(`/api/groups/${groupId}/join-tokens`, {
            method:  "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({ intended_role: issueRole }),
          });
          const j = await res.json();
          if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
          setLatestIssued({ token: j.token, expires_at: j.expires_at, intended_role: issueRole });
          setIssuing(false);
          setCopied(false);
          await load();
        } catch (e) { setErr(e.message); }
      };

      const revoke = async (token) => {
        if (!window.confirm("Revoke this code? Anyone who hasn't redeemed it yet will get an 'invalid token' error.")) return;
        try {
          const res = await fetch(`/api/join-tokens/${token}`, { method: "DELETE", headers: { ...csrfHeaders() } });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          if (latestIssued?.token === token) setLatestIssued(null);
          await load();
        } catch (e) { setErr(e.message); }
      };

      const copyToClipboard = (token) => {
        try {
          navigator.clipboard.writeText(token);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (_) {}
      };

      if (!isGroupCoach) return null;

      return (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Invite full-account swimmers
            </div>
            {isPrimary && !issuing && !latestIssued && (
              <button onClick={() => { setIssuing(true); setErr(null); }}
                style={{ padding: "3px 9px", background: "transparent", color: "var(--color-warn)", border: "1px solid var(--color-warn)", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>
                + Issue join code
              </button>
            )}
          </div>
          {err && <div style={{ color: "#fca5a5", fontSize: 11, marginBottom: 6 }}>{err}</div>}

          {issuing && (
            <div style={{ padding: 8, background: "var(--color-bg)", border: "1px solid var(--color-warn)", borderRadius: 5, marginBottom: 6 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                <label style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Role on join:</label>
                <select value={issueRole} onChange={e => setIssueRole(e.target.value)}
                  style={{ padding: "4px 8px", fontSize: 11, background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 4 }}>
                  <option value="primary">primary (main training group)</option>
                  <option value="secondary">secondary (dryland / additional)</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={issue}
                  style={{ padding: "4px 10px", background: "var(--color-warn)", color: "var(--color-bg)", border: "none", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  Issue code
                </button>
                <button onClick={() => setIssuing(false)}
                  style={{ padding: "4px 10px", background: "var(--color-border)", color: "#cbd5e1", border: "none", borderRadius: 4, fontSize: 11, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {latestIssued && (
            <div style={{ padding: 10, background: "var(--color-bg)", border: "1px solid #22c55e", borderRadius: 5, marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: "var(--color-positive)", marginBottom: 6 }}>
                ✓ Code created. Send this to the swimmer out-of-band (text, email, in person):
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                <code style={{ flex: 1, fontFamily: "monospace", fontSize: 16, fontWeight: 700, padding: "6px 10px", background: "var(--color-card)", color: "var(--color-warn)", border: "1px solid var(--color-border-strong)", borderRadius: 4, letterSpacing: "0.1em", textAlign: "center" }}>
                  {latestIssued.token}
                </code>
                <button onClick={() => copyToClipboard(latestIssued.token)}
                  style={{ padding: "5px 11px", background: copied ? "var(--color-positive)" : "var(--color-primary)", color: "var(--color-bg)", border: "none", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <div style={{ fontSize: 10, color: "var(--color-text-dim)" }}>
                Role on join: <strong>{latestIssued.intended_role}</strong> · Expires {latestIssued.expires_at ? new Date(latestIssued.expires_at).toLocaleDateString() : "in 30 days"}
              </div>
              <button onClick={() => setLatestIssued(null)}
                style={{ marginTop: 6, padding: "3px 8px", background: "transparent", color: "var(--color-text-muted)", border: "none", borderRadius: 4, fontSize: 10, cursor: "pointer", textDecoration: "underline" }}>
                Dismiss
              </button>
            </div>
          )}

          {/* Outstanding tokens (unredeemed, unexpired) */}
          {tokens && tokens.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 10, color: "var(--color-text-dim)", marginBottom: 4 }}>Outstanding codes (unredeemed):</div>
              {tokens.map(t => (
                <div key={t.token} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 4, marginBottom: 3, fontSize: 11 }}>
                  <span>
                    <code style={{ fontFamily: "monospace", color: "var(--color-warn)", fontSize: 11 }}>{t.token}</code>
                    <span style={{ marginLeft: 8, color: "var(--color-text-muted)" }}>· {t.intended_role}</span>
                    <span style={{ marginLeft: 8, color: "var(--color-text-dim)", fontSize: 10 }}>expires {new Date(t.expires_at).toLocaleDateString()}</span>
                  </span>
                  {isPrimary && (
                    <button onClick={() => revoke(t.token)}
                      style={{ padding: "2px 7px", background: "transparent", color: "var(--color-destructive-text)", border: "1px solid #ef4444", borderRadius: 3, fontSize: 10, cursor: "pointer" }}>Revoke</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
