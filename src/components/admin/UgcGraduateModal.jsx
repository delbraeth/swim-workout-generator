// src/components/admin/UgcGraduateModal.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components are imported below (freevars-driven).
import { API_BASE } from "../../lib/shared.js";

    const { useState, useEffect } = React;

    export function UgcGraduateModal({ optionId, onDone, onClose }) {
      const [pack, setPack] = React.useState(null);
      const [err, setErr] = React.useState(null);
      const [loading, setLoading] = React.useState(true);
      const [confirmed, setConfirmed] = React.useState(false);
      const [confirming, setConfirming] = React.useState(false);
      const [copied, setCopied] = React.useState(false);

      React.useEffect(() => {
        fetch(`${API_BASE}/admin/ugc/${optionId}/graduate-snippet`, { credentials: "include" })
          .then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(new Error(j.error || `HTTP ${r.status}`))))
          .then(data => { setPack(data); setErr(null); })
          .catch(e => setErr(e.message || String(e)))
          .finally(() => setLoading(false));
      }, [optionId]);

      const copySnippet = async () => {
        if (!pack?.snippet) return;
        try {
          await navigator.clipboard.writeText(pack.snippet);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (_) {
          window.alert("Copy failed — select the snippet text manually.");
        }
      };

      const handleConfirm = async () => {
        setConfirming(true);
        try {
          const csrf = (await (await fetch('/api/auth/csrf')).json()).token;
          const r = await fetch(`${API_BASE}/admin/ugc/${optionId}/graduate`, {
            method: 'POST',
            headers: { 'X-CSRF-Token': csrf },
            credentials: 'include',
          });
          const j = await r.json();
          if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
          onDone();
        } catch (e) {
          setErr(e.message || String(e));
        } finally {
          setConfirming(false);
        }
      };

      return (
        <div onClick={onClose} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "var(--color-bg)", color: "var(--color-text)", borderRadius: 8,
            padding: 20, maxWidth: 820, width: "100%", maxHeight: "90vh", overflow: "auto",
            border: "1px solid var(--color-border)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>🎓 Graduate UGC to JS bank</h3>
              <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", color: "var(--color-muted)", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>
            {loading && <p style={{ color: "var(--color-muted)" }}>Loading snippet…</p>}
            {err && <div style={{ padding: 8, marginBottom: 12, background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", borderRadius: 4, color: "#ef4444", fontSize: 13 }}>{err}</div>}
            {pack && (
              <>
                <div style={{ marginBottom: 12, fontSize: 13 }}>
                  <div><strong>Option:</strong> {pack.label}</div>
                  <div><strong>Target:</strong> <code>{pack.constantName}{pack.subKey ? `[${JSON.stringify(pack.subKey)}]` : ""}</code> in <code>public/index.html</code></div>
                </div>
                <ol style={{ fontSize: 13, paddingLeft: 18, marginTop: 0, marginBottom: 16, color: "var(--color-text)" }}>
                  <li style={{ marginBottom: 6 }}>
                    Copy the snippet below.
                    <button onClick={copySnippet} style={{ marginLeft: 8, padding: "2px 10px", fontSize: 12, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text)", borderRadius: 4, cursor: "pointer" }}>
                      {copied ? "✓ Copied" : "📋 Copy"}
                    </button>
                  </li>
                  <li style={{ marginBottom: 6 }}>{pack.instructions}</li>
                  <li style={{ marginBottom: 6 }}>From your local repo: <code>git add public/index.html &amp;&amp; git commit -m "Graduate UGC: {pack.label}" &amp;&amp; git push</code></li>
                  <li style={{ marginBottom: 6 }}>Wait for Hyperlift to redeploy (~30s).</li>
                  <li>Check the box + click <strong>Confirm Promoted</strong> below to stamp the DB row. This stops the overlay from returning it — JS becomes the source.</li>
                </ol>
                <pre style={{
                  background: "var(--color-card)", color: "var(--color-text)",
                  border: "1px solid var(--color-border)",
                  padding: 12, borderRadius: 4, fontSize: 12, fontFamily: "monospace",
                  whiteSpace: "pre", overflowX: "auto", maxHeight: 200, marginBottom: 16,
                }}>{pack.snippet}</pre>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginBottom: 12, cursor: "pointer" }}>
                  <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                  I've pasted the snippet, committed, pushed, and verified the redeploy is live.
                </label>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button onClick={onClose} disabled={confirming}
                    style={{ padding: "8px 16px", border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text)", borderRadius: 6, cursor: "pointer" }}>
                    Cancel
                  </button>
                  <button onClick={handleConfirm} disabled={!confirmed || confirming}
                    style={{
                      padding: "8px 16px", border: "1px solid var(--color-primary)",
                      background: confirmed ? "var(--color-primary)" : "transparent",
                      color: confirmed ? "white" : "var(--color-primary)",
                      borderRadius: 6, cursor: confirmed && !confirming ? "pointer" : "not-allowed",
                      opacity: confirming ? 0.7 : 1,
                    }}>
                    {confirming ? "Stamping…" : "Confirm Promoted"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      );
    }
