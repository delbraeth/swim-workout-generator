// src/components/admin/AdminEmailTest.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components are imported below (freevars-driven).

    const { useState } = React;

    export function AdminEmailTest() {
      const [templateId, setTemplateId] = React.useState("welcome");
      const [busy, setBusy] = React.useState(false);
      const [result, setResult] = React.useState(null);

      const send = async () => {
        setBusy(true);
        setResult(null);
        try {
          const csrfRes = await fetch("/api/auth/csrf", { credentials: "include" });
          const { token } = await csrfRes.json();
          const res = await fetch("/api/admin/email/test", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
            body: JSON.stringify({ template_id: templateId }),
          });
          const data = await res.json();
          setResult({ ok: res.ok, data });
        } catch (err) {
          setResult({ ok: false, data: { error: err.message } });
        } finally {
          setBusy(false);
        }
      };

      // Map worker result to a human banner.
      const banner = (() => {
        if (!result) return null;
        if (!result.ok) {
          return { color: "var(--color-destructive)", text: `Server error: ${result.data?.error || "unknown"}` };
        }
        const d = result.data || {};
        if (d.id) {
          return { color: "var(--color-positive)", text: `✅ Enqueued row #${d.id} — email should arrive within ~30 seconds (worker polls every 30s).` };
        }
        if (d.bypassed) {
          const reasonMap = { dob_unknown: "DOB unknown on your profile — fix to receive transactional emails.", minor: "Account marked as minor (DOB <18) — minor-bypass triggered." };
          return { color: "var(--color-warn)", text: `⚠ Bypassed: ${reasonMap[d.bypassed] || d.bypassed}` };
        }
        if (d.skipped) {
          const reasonMap = { inactive: "EMAIL_ACTIVE=false on the server — RESEND_API_KEY env var missing.", no_email: "No email on your users row — Apple may not have shared it.", user_not_found: "User row not found.", duplicate: "Duplicate dedup_key — shouldn't happen with Date.now() suffix." };
          return { color: "var(--color-warn)", text: `⚠ Skipped: ${reasonMap[d.skipped] || d.skipped}` };
        }
        return { color: "var(--color-text-muted)", text: JSON.stringify(d) };
      })();

      return (
        <div>
          <h3 style={{ color: "var(--color-text)", marginTop: 0 }}>Email test</h3>
          <p style={{ color: "var(--color-text-muted)", fontSize: 13, lineHeight: 1.5 }}>
            Fires a test email to your own account via the real enqueueEmail path (lib/email.js). Same minor-bypass + audit + retry logic as production sign-up welcomes. The worker picks the row up within ~30 seconds.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
            <label style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
              Template:&nbsp;
              <select value={templateId} onChange={e => setTemplateId(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-text)", fontSize: 13 }}>
                <option value="welcome">welcome</option>
              </select>
            </label>
            <button onClick={send} disabled={busy}
              style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid var(--color-primary)", background: busy ? "var(--color-card)" : "var(--color-primary)", color: busy ? "var(--color-text-muted)" : "#fff", fontSize: 13, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer" }}>
              {busy ? "Sending…" : "Send to me"}
            </button>
          </div>
          {banner && (
            <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 6, border: `1px solid ${banner.color}`, color: banner.color, fontSize: 13 }}>
              {banner.text}
            </div>
          )}
          {result?.ok && result.data?.id && (
            <p style={{ marginTop: 16, color: "var(--color-text-muted)", fontSize: 12 }}>
              Verify the send in <code>email_outbox</code> (row #{result.data.id}) once the worker tick completes. Also check <code>audit_events</code> for <code>email.enqueue</code> + <code>email.send.result</code> entries.
            </p>
          )}
        </div>
      );
    }
