// src/components/workout/LessonRecapButton.jsx — Lesson tier (Phase 5).
// "Send recap to parent" — emails a branded one-pager of the current lesson to
// the target managed swimmer's guardian(s) via POST /api/lessons/recap. Shown
// only when a workout was generated FOR a managed swimmer (managedId present).
// React is a runtime global. Self-managed busy/message state.
import { csrfHeaders } from "../../lib/api.js";

    export function LessonRecapButton({ managedId, swimmerName, workoutPayload }) {
      const [open, setOpen] = React.useState(false);
      const [note, setNote] = React.useState("");
      const [busy, setBusy] = React.useState(false);
      const [msg,  setMsg]  = React.useState(null);

      if (!managedId || !workoutPayload) return null;

      const send = async () => {
        if (busy) return;
        setBusy(true); setMsg(null);
        try {
          const res = await fetch("/api/lessons/recap", {
            method:  "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({ managed_id: managedId, workout: workoutPayload, note: note.trim() || null }),
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) {
            if (j.error === "no_guardian_email") setMsg(j.message || "No parent email linked to this swimmer.");
            else setMsg(`Couldn't send: ${j.error || res.status}`);
            return;
          }
          setMsg(j.sent > 0
            ? `Recap sent to ${j.sent} parent${j.sent === 1 ? "" : "s"}.`
            : `Not sent (${(j.skipped && j.skipped[0]?.reason) || "no recipients"}).`);
          if (j.sent > 0) { setOpen(false); setNote(""); }
        } catch (e) {
          setMsg(`Network error: ${e.message}`);
        } finally { setBusy(false); }
      };

      return (
        <div className="screen-only" style={{ marginTop: 16 }}>
          {!open ? (
            <button onClick={() => { setOpen(true); setMsg(null); }}
              style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid var(--color-primary)",
                background: "transparent", color: "var(--color-primary-text)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              ✉️ Send recap to parent
            </button>
          ) : (
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                Email this lesson recap to {swimmerName || "the swimmer"}'s parent
              </div>
              <textarea value={note} onChange={e => setNote(e.target.value)}
                placeholder="Optional note to the parent (e.g. what went well, what to practice)…"
                aria-label="Note to the parent"
                rows={3} maxLength={1000}
                style={{ width: "100%", boxSizing: "border-box", fontSize: 13, padding: "8px 10px", borderRadius: 6,
                  border: "1px solid var(--color-border-strong)", background: "var(--color-bg)", color: "var(--color-text)",
                  resize: "vertical", marginBottom: 8 }} />
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button onClick={send} disabled={busy}
                  style={{ padding: "7px 14px", borderRadius: 6, border: "none",
                    background: busy ? "var(--color-border)" : "var(--color-primary)", color: "var(--color-bg)",
                    fontSize: 13, fontWeight: 700, cursor: busy ? "default" : "pointer" }}>
                  {busy ? "Sending…" : "Send recap"}
                </button>
                <button onClick={() => { setOpen(false); setMsg(null); }} disabled={busy}
                  style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid var(--color-border-strong)",
                    background: "transparent", color: "var(--color-text-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          {msg && <div style={{ fontSize: 12, marginTop: 8, color: msg.startsWith("Couldn't") || msg.startsWith("Network") || msg.startsWith("No ") ? "var(--color-destructive)" : "var(--color-positive)" }}>{msg}</div>}
        </div>
      );
    }
