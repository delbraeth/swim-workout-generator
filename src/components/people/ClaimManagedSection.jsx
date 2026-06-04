// src/components/people/ClaimManagedSection.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { csrfHeaders } from "../../app.jsx";

    const { useState } = React;

    export function ClaimManagedSection({ me, setMe, onClaimed }) {
      const [code,     setCode]    = React.useState("");
      const [preview,  setPreview] = React.useState(null);
      const [result,   setResult]  = React.useState(null);
      const [err,      setErr]     = React.useState(null);
      const [busy,     setBusy]    = React.useState(false);
      const normalized = code.trim().toLowerCase();

      const doPreview = async () => {
        if (!normalized) { setErr("Enter a code first"); return; }
        setErr(null); setResult(null);
        try {
          const res = await fetch(`/api/claim-tokens/${encodeURIComponent(normalized)}/preview`, { cache: "no-store" });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          const p = await res.json();
          if (p.is_redeemed) throw new Error("That claim code has already been used.");
          if (p.is_expired)  throw new Error("That claim code has expired.");
          setPreview(p);
        } catch (e) { setErr(e.message); setPreview(null); }
      };

      const doRedeem = async () => {
        setBusy(true); setErr(null);
        try {
          const res = await fetch(`/api/claim-tokens/${encodeURIComponent(normalized)}/redeem`, {
            method:  "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    "{}",
          });
          const j = await res.json();
          if (!res.ok) {
            if (j.reason === "group_conflict") {
              throw new Error(`Group conflict: the managed profile is primary in "${j.conflict_managed_group_name}" but you're already primary in "${j.conflict_swimmer_group_name}" with the same coach. Resolve manually (leave one) then retry.`);
            }
            if (j.reason === "already_redeemed") throw new Error("That code has already been used.");
            if (j.reason === "expired")          throw new Error("That code has expired.");
            if (j.reason === "invalid_token")    throw new Error("That code isn't valid.");
            throw new Error(j.error || j.reason || `HTTP ${res.status}`);
          }
          // Update me with the new identity fields the migration applied.
          // Recompute is_minor properly (month/day-aware) matching the DOB-save
          // path. Year-only subtraction misclassifies pre-birthday minors.
          if (j.identity_diff && j.identity_diff.length > 0) {
            setMe(prev => {
              if (!prev) return prev;
              const next = { ...prev };
              for (const d of j.identity_diff) next[d.field] = d.to;
              if ("dob" in next && next.dob) {
                const today = new Date();
                const dob   = new Date(next.dob);
                let age = today.getFullYear() - dob.getFullYear();
                const monthDiff = today.getMonth() - dob.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
                next.is_minor = age < 18;
              }
              return next;
            });
          }
          setResult(j);
          setCode("");
          setPreview(null);
          if (onClaimed) onClaimed(j);
        } catch (e) { setErr(e.message); }
        finally { setBusy(false); }
      };

      return (
        <div style={{ marginTop: 14, padding: 14, background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 8 }}>
          <h4 style={{ color: "var(--color-text)", margin: 0, marginBottom: 6, fontSize: 14 }}>Claim a managed profile</h4>
          <p style={{ color: "var(--color-text-muted)", fontSize: 12, margin: "0 0 10px", lineHeight: 1.5 }}>
            Got a claim code from a coach? Paste it here to inherit a managed profile they were maintaining for you — your account picks up the name/DOB/gender/paces they had on file, plus all assignments, notes, and group memberships.
          </p>

          {result ? (
            <div style={{ padding: 12, background: "#22c55e22", border: "1px solid #22c55e", borderRadius: 6 }}>
              <div style={{ color: "var(--color-positive)", fontWeight: 700, fontSize: 14, marginBottom: 8 }}>✓ Claim complete</div>
              <div style={{ color: "#cbd5e1", fontSize: 12, marginBottom: 10 }}>
                Brought over: <strong>{result.repointed?.workout_assignments || 0}</strong> assignments
                {(result.repointed?.coach_swimmer_notes || 0) > 0 && <>, <strong>{result.repointed.coach_swimmer_notes}</strong> coach notes</>}
                {(result.repointed?.group_memberships || 0) > 0 && <>, <strong>{result.repointed.group_memberships}</strong> group membership{result.repointed.group_memberships === 1 ? "" : "s"}</>}.
              </div>
              {result.identity_diff && result.identity_diff.length > 0 ? (
                <div style={{ padding: 10, background: "var(--color-card)", border: "1px solid var(--color-border-strong)", borderRadius: 5 }}>
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                    Updated on your account:
                  </div>
                  <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                    <thead><tr style={{ color: "var(--color-text-dim)", fontSize: 10 }}>
                      <th style={{ textAlign: "left", padding: 2 }}>Field</th>
                      <th style={{ textAlign: "left", padding: 2 }}>Was</th>
                      <th style={{ textAlign: "left", padding: 2 }}>Now</th>
                    </tr></thead>
                    <tbody>
                      {result.identity_diff.map(d => (
                        <tr key={d.field} style={{ borderTop: "1px solid var(--color-border)" }}>
                          <td style={{ padding: 4, color: "#cbd5e1", fontFamily: "monospace" }}>{d.field}</td>
                          <td style={{ padding: 4, color: "var(--color-text-dim)" }}>{d.from || "(empty)"}</td>
                          <td style={{ padding: 4, color: "var(--color-positive)", fontWeight: 700 }}>{d.to}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>No identity fields changed (your account already had matching values).</div>
              )}
              <button onClick={() => setResult(null)}
                style={{ marginTop: 8, padding: "5px 12px", background: "var(--color-primary)", color: "var(--color-bg)", border: "none", borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Done
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input value={code} onChange={e => { setCode(e.target.value); setPreview(null); setErr(null); }}
                  placeholder="Paste 10-character claim code"
                  onKeyDown={e => { if (e.key === "Enter") { preview ? doRedeem() : doPreview(); } }}
                  style={{ flex: 1, padding: "6px 10px", fontSize: 13, fontFamily: "monospace", letterSpacing: "0.08em", background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 5, textTransform: "lowercase" }} />
                {!preview && (
                  <button onClick={doPreview} disabled={!normalized || busy}
                    style={{ padding: "6px 14px", background: normalized ? "var(--color-warn)" : "var(--color-border-strong)", color: normalized ? "var(--color-bg)" : "var(--color-text-muted)", border: "none", borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: normalized ? "pointer" : "not-allowed" }}>
                    Look up
                  </button>
                )}
              </div>
              {preview && (
                <div style={{ padding: 10, background: "var(--color-card)", border: "1px solid var(--color-warn)", borderRadius: 6, marginBottom: 6 }}>
                  <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 6 }}>
                    Claiming <strong style={{ color: "var(--color-text)" }}>{preview.managed_name}</strong> from coach <strong style={{ color: "var(--color-warn)" }}>{preview.coach_name || "(coach)"}</strong>.
                    <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4, lineHeight: 1.5 }}>
                      Your account's name / DOB / gender / paces will be silently updated from the managed profile (per scope #24). All assignments + coach notes + group memberships will be repointed to your account. The managed profile will be deleted.
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={doRedeem} disabled={busy}
                      style={{ padding: "6px 14px", background: "var(--color-positive)", color: "var(--color-bg)", border: "none", borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      {busy ? "Claiming…" : "Confirm claim"}
                    </button>
                    <button onClick={() => { setPreview(null); setCode(""); }}
                      style={{ padding: "6px 14px", background: "var(--color-border)", color: "#cbd5e1", border: "none", borderRadius: 5, fontSize: 12, cursor: "pointer" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {err && <div style={{ color: "#fca5a5", fontSize: 12, marginTop: 6 }}>{err}</div>}
            </>
          )}
        </div>
      );
    }
