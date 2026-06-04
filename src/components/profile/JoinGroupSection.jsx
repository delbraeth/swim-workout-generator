// src/components/profile/JoinGroupSection.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { csrfHeaders, DOB_MAX_TODAY, DOB_MIN } from "../../lib/shared.js";

    const { useState } = React;

    export function JoinGroupSection({ me, setMe, onJoined }) {
      const [code,     setCode]    = React.useState("");
      const [preview,  setPreview] = React.useState(null);                       // {group_name, intended_role, expires_at, is_expired, is_redeemed}
      const [result,   setResult]  = React.useState(null);
      const [err,      setErr]     = React.useState(null);
      const [needsDob, setNeedsDob] = React.useState(false);
      const [dobDraft, setDobDraft] = React.useState("");
      const [busy,     setBusy]    = React.useState(false);

      const normalizedCode = code.trim().toLowerCase();

      const doPreview = async () => {
        if (!normalizedCode) { setErr("Enter a code first"); return; }
        setErr(null); setResult(null);
        try {
          const res = await fetch(`/api/join-tokens/${encodeURIComponent(normalizedCode)}/preview`, { cache: "no-store" });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          const p = await res.json();
          if (p.is_redeemed) throw new Error("That code has already been redeemed.");
          if (p.is_expired)  throw new Error("That code has expired.");
          setPreview(p);
        } catch (e) { setErr(e.message); setPreview(null); }
      };

      const submitDob = async () => {
        if (!dobDraft) { setErr("Enter your date of birth"); return; }
        setBusy(true); setErr(null);
        try {
          const res = await fetch("/api/me/dob", {
            method:  "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({ dob: dobDraft }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || j.reason || `HTTP ${res.status}`);
          }
          setMe(prev => prev ? { ...prev, dob: dobDraft } : prev);
          setNeedsDob(false);
          setDobDraft("");
          // Immediately retry the redeem now that DOB is set.
          await doRedeem();
        } catch (e) { setErr(e.message); }
        finally { setBusy(false); }
      };

      const doRedeem = async () => {
        setBusy(true); setErr(null);
        try {
          const res = await fetch(`/api/join-tokens/${encodeURIComponent(normalizedCode)}/redeem`, {
            method:  "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    "{}",
          });
          const j = await res.json();
          if (!res.ok) {
            if (j.reason === "dob_required" || j.error === "dob_required") {
              setNeedsDob(true);
              return;
            }
            if (j.reason === "primary_in_other_group_same_coach") {
              throw new Error(`You're already a primary in another of this coach's groups: ${j.conflict_group_name}. Leave that group first, or ask the coach to issue a 'secondary' code instead.`);
            }
            if (j.reason === "already_in_group")  throw new Error("You're already a member of this group.");
            if (j.reason === "already_redeemed")  throw new Error("That code has already been redeemed.");
            if (j.reason === "expired")           throw new Error("That code has expired.");
            if (j.reason === "group_archived")    throw new Error("That group has been archived.");
            if (j.reason === "invalid_token")     throw new Error("That code isn't valid.");
            throw new Error(j.error || j.reason || `HTTP ${res.status}`);
          }
          setResult(j);
          setCode("");
          setPreview(null);
          if (onJoined) onJoined(j);
        } catch (e) { setErr(e.message); }
        finally { setBusy(false); }
      };

      return (
        <div style={{ marginTop: 18, padding: 14, background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 8 }}>
          <h4 style={{ color: "var(--color-text)", margin: 0, marginBottom: 6, fontSize: 14 }}>Join a group</h4>
          <p style={{ color: "var(--color-text-muted)", fontSize: 12, margin: "0 0 10px", lineHeight: 1.5 }}>
            Got a join code from a coach? Paste it here. Once you join, workouts the coach generates for the group will show up in your "📥 Assigned to me" view.
          </p>

          {result ? (
            <div style={{ padding: 10, background: "#22c55e22", border: "1px solid #22c55e", borderRadius: 6 }}>
              <div style={{ color: "var(--color-positive)", fontWeight: 700, fontSize: 13 }}>✓ Joined {result.group_name}</div>
              <div style={{ color: "var(--color-text-muted)", fontSize: 11, marginTop: 4 }}>Role: <strong>{result.role}</strong>.</div>
              <button onClick={() => setResult(null)}
                style={{ marginTop: 8, padding: "4px 10px", background: "transparent", color: "var(--color-text-muted)", border: "1px solid var(--color-border)", borderRadius: 4, fontSize: 11, cursor: "pointer" }}>
                Dismiss
              </button>
            </div>
          ) : needsDob ? (
            <div style={{ padding: 10, background: "#f59e0b11", border: "1px solid var(--color-warn)", borderRadius: 6 }}>
              <div style={{ color: "var(--color-warn)", fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Date of birth required</div>
              <div style={{ color: "var(--color-text-muted)", fontSize: 11, marginBottom: 8, lineHeight: 1.5 }}>
                Joining a group triggers minor-protection rules that depend on your age. Please add your DOB to continue.
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <input type="date" value={dobDraft} onChange={e => setDobDraft(e.target.value)}
                  min={DOB_MIN} max={DOB_MAX_TODAY()}
                  style={{ flex: 1, padding: "6px 10px", fontSize: 13, background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 5 }} />
                <button onClick={submitDob} disabled={busy || !dobDraft}
                  style={{ padding: "6px 14px", background: dobDraft ? "var(--color-positive)" : "var(--color-border-strong)", color: dobDraft ? "var(--color-bg)" : "var(--color-text-muted)", border: "none", borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: dobDraft ? "pointer" : "not-allowed" }}>
                  Save & retry
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input value={code} onChange={e => { setCode(e.target.value); setPreview(null); setErr(null); }}
                  placeholder="Paste 10-character code"
                  onKeyDown={e => { if (e.key === "Enter") { preview ? doRedeem() : doPreview(); } }}
                  style={{ flex: 1, padding: "6px 10px", fontSize: 13, fontFamily: "monospace", letterSpacing: "0.08em", background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 5, textTransform: "lowercase" }} />
                {!preview && (
                  <button onClick={doPreview} disabled={!normalizedCode || busy}
                    style={{ padding: "6px 14px", background: normalizedCode ? "var(--color-primary)" : "var(--color-border-strong)", color: normalizedCode ? "var(--color-bg)" : "var(--color-text-muted)", border: "none", borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: normalizedCode ? "pointer" : "not-allowed" }}>
                    Look up
                  </button>
                )}
              </div>
              {preview && (
                <div style={{ padding: 10, background: "var(--color-card)", border: "1px solid var(--color-primary)", borderRadius: 6, marginBottom: 6 }}>
                  <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 6 }}>
                    Joining <strong style={{ color: "var(--color-text)" }}>{preview.group_name}</strong> as <strong style={{ color: "var(--color-primary)" }}>{preview.intended_role}</strong>.
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={doRedeem} disabled={busy}
                      style={{ padding: "6px 14px", background: "var(--color-positive)", color: "var(--color-bg)", border: "none", borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      {busy ? "Joining…" : "Join group"}
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
