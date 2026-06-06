// src/components/admin/AdminVendorKit.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components are imported below (freevars-driven).

    const { useState } = React;

    export function AdminVendorKit() {
      const [recipientEmail,   setRecipientEmail]   = React.useState("");
      const [organizationName, setOrganizationName] = React.useState("");
      const [treasurerName,    setTreasurerName]    = React.useState("");
      const [busy, setBusy]     = React.useState(false);
      const [result, setResult] = React.useState(null);

      const submit = async () => {
        setBusy(true);
        setResult(null);
        try {
          const csrfRes = await fetch("/api/auth/csrf", { credentials: "include" });
          const { token } = await csrfRes.json();
          const res = await fetch("/api/admin/vendor-kit/send", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
            body: JSON.stringify({
              recipient_email:   recipientEmail.trim(),
              organization_name: organizationName.trim(),
              treasurer_name:    treasurerName.trim(),
            }),
          });
          const data = await res.json();
          setResult({ ok: res.ok, data });
        } catch (err) {
          setResult({ ok: false, data: { error: err.message } });
        } finally {
          setBusy(false);
        }
      };

      // Build the mailto: URL after a successful render. Body is the
      // rendered cover letter; subject is the server-provided default.
      const mailtoUrl = (() => {
        if (!result?.ok || !result.data) return null;
        const d = result.data;
        const params = new URLSearchParams({
          subject: d.subject || "SetForge — vendor paperwork",
          body:    d.rendered_letter || "",
        });
        return `mailto:${encodeURIComponent(d.recipient_email)}?${params.toString()}`;
      })();

      const copyLetter = () => {
        if (result?.ok && result.data?.rendered_letter) {
          navigator.clipboard.writeText(result.data.rendered_letter).catch(() => {});
        }
      };

      const input = {
        width: "100%", padding: "8px 10px", borderRadius: 6,
        border: "1px solid var(--color-border)", background: "var(--color-card)",
        color: "var(--color-text)", fontSize: 13, marginBottom: 10,
      };

      return (
        <div>
          <h3 style={{ color: "var(--color-text)", marginTop: 0 }}>Vendor paper kit</h3>
          <p style={{ color: "var(--color-text-muted)", fontSize: 13, lineHeight: 1.5 }}>
            Send the vendor paper kit to a treasurer or board reviewer. Renders the cover letter with the recipient's organization name + treasurer name substituted, audit-logs the send, then opens a mailto: with the letter pre-filled. You attach the kit PDFs (from <code>vendor-kit/build/</code> on your machine) in your mail client before sending.
          </p>

          <div style={{ marginTop: 14 }}>
            <label style={{ display: "block", fontSize: 11, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Recipient email</label>
            <input type="email" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)}
              placeholder="treasurer@school.org" style={input} />

            <label style={{ display: "block", fontSize: 11, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Organization name</label>
            <input type="text" value={organizationName} onChange={e => setOrganizationName(e.target.value)}
              placeholder="Lincoln High School Swim Team Booster Club" style={input} />

            <label style={{ display: "block", fontSize: 11, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Treasurer / contact name</label>
            <input type="text" value={treasurerName} onChange={e => setTreasurerName(e.target.value)}
              placeholder="Jordan Smith" style={input} />

            <button onClick={submit} disabled={busy || !recipientEmail || !organizationName || !treasurerName}
              style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid var(--color-primary)", background: (busy || !recipientEmail || !organizationName || !treasurerName) ? "var(--color-card)" : "var(--color-primary)", color: (busy || !recipientEmail || !organizationName || !treasurerName) ? "var(--color-text-muted)" : "#fff", fontSize: 13, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer" }}>
              {busy ? "Preparing…" : "Prepare kit send"}
            </button>
          </div>

          {result && !result.ok && (
            <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 6, border: "1px solid var(--color-destructive)", color: "var(--color-destructive-text)", fontSize: 13 }}>
              Error: {result.data?.error || "unknown"}
            </div>
          )}

          {result?.ok && result.data && (
            <div style={{ marginTop: 16, padding: 14, borderRadius: 8, border: "1px solid var(--color-positive)", background: "var(--color-card)" }}>
              <div style={{ color: "var(--color-positive)", fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                ✅ Send prepared + audit-logged.
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 10, lineHeight: 1.5 }}>
                Open in your mail client, attach the listed PDFs from <code>vendor-kit/build/</code>, and send. The send is already audit-logged so you don't need to come back to this screen.
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <a href={mailtoUrl}
                  style={{ padding: "8px 14px", borderRadius: 6, background: "var(--color-primary)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                  Open in mail client
                </a>
                <button onClick={copyLetter}
                  style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text)", fontSize: 13, cursor: "pointer" }}>
                  Copy letter to clipboard
                </button>
              </div>
              <div style={{ fontSize: 11, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                Attach these PDFs ({result.data.attachment_filenames?.length || 0})
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--color-text)", lineHeight: 1.6 }}>
                {(result.data.attachment_filenames || []).map(f => (
                  <li key={f}><code style={{ fontFamily: "monospace", fontSize: 11 }}>vendor-kit/build/{f}</code></li>
                ))}
              </ul>
              <div style={{ marginTop: 12, fontSize: 11, color: "var(--color-text-muted)" }}>
                If you haven't built the PDFs yet: <code>cd vendor-kit && ./build.sh</code>. Requires pandoc + a LaTeX engine.
              </div>
            </div>
          )}
        </div>
      );
    }
