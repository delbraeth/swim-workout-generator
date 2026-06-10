// src/components/shell/FeedbackModal.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { csrfHeaders } from "../../lib/api.js";
import { useDialogA11y } from "./useDialogA11y.js";

    const { useState } = React;

    export function FeedbackModal({ onClose, initialCategory = "idea", initialSubject = "", initialBody = "" }) {
      const dialogRef = useDialogA11y(onClose);
      const [category, setCategory] = React.useState(initialCategory);
      const [subject, setSubject]   = React.useState(initialSubject);
      const [body, setBody]         = React.useState(initialBody);
      const [state, setState]       = React.useState("idle"); // idle | sending | sent | error
      const [error, setError]       = React.useState(null);
      const canSubmit = subject.trim().length > 0 && body.trim().length > 0 && state !== "sending";

      const submit = async () => {
        setState("sending"); setError(null);
        try {
          const res = await fetch("/api/feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({
              category,
              subject: subject.trim(),
              body:    body.trim(),
              page:    typeof window !== "undefined" ? window.location.pathname : null,
              user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
            }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          setState("sent");
          setTimeout(onClose, 1100);
        } catch (err) {
          setState("error");
          setError(err.message || String(err));
        }
      };

      const cats = [
        { id: "idea",         label: "💡 Idea" },
        { id: "bug",          label: "🐛 Bug" },
        { id: "praise",       label: "✨ Praise" },
        { id: "catalog-flag", label: "🚩 Catalog flag" },
        { id: "other",        label: "Other" },
      ];

      return (
        <div onClick={onClose} className="modal-overlay" style={{ padding: 16, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Send feedback" onClick={e => e.stopPropagation()} style={{
            background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 12,
            maxWidth: 480, width: "100%", maxHeight: "85vh", overflowY: "auto",
            color: "#cbd5e1",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--color-border)" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)" }}>💬 Send feedback</div>
              <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", color: "var(--color-text-muted)", fontSize: 20, cursor: "pointer", padding: 4 }}>✕</button>
            </div>

            {state === "sent" ? (
              <div style={{ padding: "40px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#4ade80" }}>Thanks — feedback sent.</div>
              </div>
            ) : (
              <div style={{ padding: "16px 20px 20px" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Category</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                  {cats.map(c => {
                    const active = category === c.id;
                    return (
                      <button key={c.id} onClick={() => setCategory(c.id)}
                        className="pill"
                        style={{
                          border: `1px solid ${active ? "var(--color-primary)" : "var(--color-border)"}`,
                          background: active ? "#1e3a5f" : "transparent",
                          color: active ? "var(--color-primary)" : "var(--color-text-muted)",
                          fontSize: 12, cursor: "pointer",
                        }}>
                        {c.label}
                      </button>
                    );
                  })}
                </div>

                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Subject</label>
                <input value={subject} maxLength={255}
                  onChange={e => setSubject(e.target.value)}
                  aria-label="Subject"
                  placeholder="One-line summary"
                  style={{
                    width: "100%", boxSizing: "border-box",
                    padding: "8px 10px", marginBottom: 14, fontSize: 13,
                    background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6,
                    color: "var(--color-text)", outline: "none",
                  }} />

                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Details</label>
                <textarea value={body} rows={6} maxLength={10000}
                  onChange={e => setBody(e.target.value)}
                  aria-label="Feedback details"
                  placeholder="What happened? What did you expect? Steps to reproduce if it's a bug."
                  style={{
                    width: "100%", boxSizing: "border-box",
                    padding: "8px 10px", marginBottom: 8, fontSize: 13,
                    background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6,
                    color: "var(--color-text)", outline: "none", fontFamily: "inherit", resize: "vertical",
                  }} />

                <div style={{ fontSize: 10, color: "var(--color-border-strong)", marginBottom: 14 }}>
                  Page and browser info are attached automatically.
                </div>

                {error && (
                  <div style={{ color: "#fca5a5", fontSize: 12, marginBottom: 10 }}>{error}</div>
                )}

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button onClick={onClose}
                    style={{
                      padding: "8px 14px", borderRadius: 8, border: "1px solid var(--color-border)",
                      background: "transparent", color: "var(--color-text-dim)",
                      fontSize: 13, fontWeight: 600, cursor: "pointer",
                    }}>
                    Cancel
                  </button>
                  <button onClick={submit} disabled={!canSubmit}
                    style={{
                      padding: "8px 18px", borderRadius: 8, border: "none",
                      background: canSubmit ? "var(--color-primary)" : "#1e3a5f",
                      color: "#fff", fontSize: 13, fontWeight: 700,
                      cursor: canSubmit ? "pointer" : "default",
                    }}>
                    {state === "sending" ? "Sending…" : "Send"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
