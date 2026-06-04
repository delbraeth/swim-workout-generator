// src/components/admin/AdminBillingConfig.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components are imported below (freevars-driven).

    const { useState, useCallback, useEffect } = React;

    export function AdminBillingConfig() {
      const [state, setState] = React.useState(null);
      const [busy, setBusy] = React.useState(false);
      const [err, setErr] = React.useState(null);

      const fetchState = React.useCallback(async () => {
        setBusy(true);
        setErr(null);
        try {
          const res = await fetch("/api/admin/billing/config", { cache: "no-store", credentials: "include" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setState(await res.json());
        } catch (e) {
          setErr(e.message);
        } finally {
          setBusy(false);
        }
      }, []);

      React.useEffect(() => { fetchState(); }, [fetchState]);

      const row = (label, value, healthy) => (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--color-border)", fontSize: 13 }}>
          <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
          <span style={{ color: healthy ? "var(--color-positive)" : "var(--color-destructive)", fontFamily: "monospace", fontWeight: 600 }}>
            {typeof value === "boolean" ? (value ? "✓ true" : "✗ false") : String(value)}
          </span>
        </div>
      );

      return (
        <div>
          <h3 style={{ color: "var(--color-text)", marginTop: 0 }}>Billing config</h3>
          <p style={{ color: "var(--color-text-muted)", fontSize: 13, lineHeight: 1.5 }}>
            Reports which STRIPE_CONFIG fields the server loaded without exposing the secret values. If <code>active</code> is false, billing routes are disabled and ProfileModal's Subscription panel shows the "not configured" state. All four <code>has_*</code> flags must be true for Checkout + Customer Portal + webhook to work.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 16, marginBottom: 16 }}>
            <button onClick={fetchState} disabled={busy}
              style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid var(--color-primary)", background: busy ? "var(--color-card)" : "var(--color-primary)", color: busy ? "var(--color-text-muted)" : "#fff", fontSize: 13, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer" }}>
              {busy ? "Loading…" : "Reload"}
            </button>
          </div>
          {err && (
            <div style={{ padding: "10px 14px", borderRadius: 6, border: "1px solid var(--color-destructive)", color: "var(--color-destructive)", fontSize: 13 }}>
              Error: {err}
            </div>
          )}
          {state && (
            <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, padding: "12px 16px" }}>
              {row("active",          state.active,          state.active)}
              {row("config_source",   state.config_source,   true)}
              {row("has_secret_key",  state.has_secret_key,  state.has_secret_key)}
              {row("has_webhook",     state.has_webhook,     state.has_webhook)}
              {row("has_price_id",    state.has_price_id,    state.has_price_id)}
              {row("portal_return",   state.portal_return,   true)}
            </div>
          )}
          {state && !state.active && (
            <p style={{ marginTop: 12, color: "var(--color-warn)", fontSize: 12 }}>
              ⚠ BILLING_ACTIVE is false. Either STRIPE_CONFIG is missing/unparseable or its <code>secret_key</code> field is empty. Check Hyperlift logs for <code>[billing] STRIPE_CONFIG present but unparseable</code> entries.
            </p>
          )}
        </div>
      );
    }
