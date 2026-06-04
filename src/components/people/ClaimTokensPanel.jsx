// src/components/people/ClaimTokensPanel.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { csrfHeaders } from "../../app.jsx";

    const { useState, useCallback, useEffect, useRef } = React;

    export function ClaimTokensPanel({ managedId, isMinor, isCoppa, parentManaged, seedTokens = null }) {
      const [tokens,        setTokens]        = React.useState(seedTokens ?? null);
      const [latestIssued,  setLatestIssued]  = React.useState(null);
      const [copied,        setCopied]        = React.useState(false);
      const [err,           setErr]           = React.useState(null);

      const load = React.useCallback(async () => {
        try {
          const res = await fetch(`/api/managed-swimmers/${managedId}/claim-tokens`, { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setTokens(await res.json());
        } catch (e) { setErr(e.message); setTokens([]); }
      }, [managedId]);
      // Seeded from the composite detail fetch — skip the initial load; still
      // refetch after issue/revoke. Ref guards only the first effect run.
      const skipInitial = React.useRef(seedTokens != null);
      React.useEffect(() => { if (skipInitial.current) { skipInitial.current = false; return; } load(); }, [load]);

      const blocked = isCoppa || parentManaged;
      const blockedReason = isCoppa     ? "Under-13 (COPPA-protected) — claim is blocked."
                         : parentManaged ? "Profile flagged as parent-managed — claim is blocked. Uncheck the flag on the swimmer detail to allow claim."
                         : null;

      const issue = async () => {
        if (!window.confirm(
          "Issue a claim link?\n\n" +
          "Once redeemed by the swimmer:\n" +
          "  • Their full-account profile inherits this managed profile's name / DOB / gender / paces (silent overwrite per scope decision #24)\n" +
          "  • All assignments + coach notes + group memberships are repointed to their account\n" +
          "  • This managed profile is DELETED\n\n" +
          "Code is valid for 30 days. You can revoke before redemption."
        )) return;
        setErr(null);
        try {
          const res = await fetch(`/api/managed-swimmers/${managedId}/claim-tokens`, {
            method:  "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    "{}",
          });
          const j = await res.json();
          if (!res.ok) {
            if (j.reason === "claim_blocked_under_13")   throw new Error("Claim blocked: swimmer is under 13.");
            if (j.reason === "claim_blocked_parent_managed") throw new Error("Claim blocked: profile is parent-managed. Uncheck the flag to enable.");
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          setLatestIssued({ token: j.token, expires_at: j.expires_at });
          setCopied(false);
          await load();
        } catch (e) { setErr(e.message); }
      };

      const revoke = async (token) => {
        if (!window.confirm("Revoke this claim code? It will become unusable.")) return;
        try {
          const res = await fetch(`/api/claim-tokens/${token}`, { method: "DELETE", headers: { ...csrfHeaders() } });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          if (latestIssued?.token === token) setLatestIssued(null);
          await load();
        } catch (e) { setErr(e.message); }
      };

      const copyToClipboard = (token) => {
        try { navigator.clipboard.writeText(token); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (_) {}
      };

      return (
        <div style={{ marginTop: 14, padding: 14, background: "var(--color-card)", border: "1px solid var(--color-border-strong)", borderRadius: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <h4 style={{ color: "var(--color-text)", margin: 0, fontSize: 14 }}>Claim link (managed → full-account)</h4>
            {!latestIssued && !blocked && (
              <button onClick={issue}
                style={{ padding: "5px 11px", background: "var(--color-warn)", color: "var(--color-bg)", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Send claim link
              </button>
            )}
          </div>
          {blocked && (
            <div style={{ padding: 8, background: "#dc262622", border: "1px solid #dc2626", borderRadius: 5, color: "#fca5a5", fontSize: 11, marginBottom: 8 }}>
              {blockedReason}
            </div>
          )}
          {err && <div style={{ color: "#fca5a5", fontSize: 11, marginBottom: 6 }}>{err}</div>}

          {latestIssued && (
            <div style={{ padding: 10, background: "var(--color-bg)", border: "1px solid #22c55e", borderRadius: 5, marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: "var(--color-positive)", marginBottom: 6 }}>
                ✓ Claim code created. Send to the swimmer out-of-band:
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
                Expires {latestIssued.expires_at ? new Date(latestIssued.expires_at).toLocaleDateString() : "in 30 days"}
              </div>
              <button onClick={() => setLatestIssued(null)}
                style={{ marginTop: 6, padding: "3px 8px", background: "transparent", color: "var(--color-text-muted)", border: "none", fontSize: 10, cursor: "pointer", textDecoration: "underline" }}>
                Dismiss
              </button>
            </div>
          )}

          {tokens && tokens.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: "var(--color-text-dim)", marginBottom: 4 }}>Outstanding codes:</div>
              {tokens.map(t => (
                <div key={t.token} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 4, marginBottom: 3, fontSize: 11 }}>
                  <span>
                    <code style={{ fontFamily: "monospace", color: "var(--color-warn)", fontSize: 11 }}>{t.token}</code>
                    <span style={{ marginLeft: 8, color: "var(--color-text-dim)", fontSize: 10 }}>expires {new Date(t.expires_at).toLocaleDateString()}</span>
                  </span>
                  <button onClick={() => revoke(t.token)}
                    style={{ padding: "2px 7px", background: "transparent", color: "var(--color-destructive)", border: "1px solid #ef4444", borderRadius: 3, fontSize: 10, cursor: "pointer" }}>Revoke</button>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
