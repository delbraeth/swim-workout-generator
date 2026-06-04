// src/components/practices/MarkPracticeDoneModal.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { csrfHeaders } from "../../lib/shared.js";

    const { useState, useEffect } = React;

    export function MarkPracticeDoneModal({ sw, onClose, onSaved }) {
      const [ctx, setCtx] = React.useState(null);    // { roster, attendance, group_id, completed_at, ... }
      const [absent, setAbsent] = React.useState(() => new Set()); // keys of swimmers marked absent
      const [busy, setBusy] = React.useState(false);
      const [err, setErr] = React.useState(null);

      // Stable key per roster row — swimmer_sub takes precedence; managed_id
      // prefixed to avoid collisions.
      const rowKey = (m) => m.member_swimmer_sub ? `s:${m.member_swimmer_sub}` : `m:${m.member_managed_id}`;

      React.useEffect(() => {
        let cancelled = false;
        fetch(`/api/scheduled-workouts/${sw.id}/attendance-context`, { cache: "no-store" })
          .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
          .then(data => {
            if (cancelled) return;
            setCtx(data);
            // Seed absent set from existing attendance rows (present=false).
            const seed = new Set();
            for (const a of (data.attendance || [])) {
              if (a.present) continue;
              const k = a.swimmer_sub ? `s:${a.swimmer_sub}` : `m:${a.managed_id}`;
              seed.add(k);
            }
            setAbsent(seed);
          })
          .catch(e => { if (!cancelled) setErr(e.message); });
        return () => { cancelled = true; };
      }, [sw.id]);

      const toggle = (k) => setAbsent(prev => {
        const n = new Set(prev);
        if (n.has(k)) n.delete(k); else n.add(k);
        return n;
      });

      const save = async () => {
        setBusy(true); setErr(null);
        try {
          const attendance = (ctx?.roster || []).map(m => {
            const k = rowKey(m);
            const present = !absent.has(k);
            return m.member_swimmer_sub
              ? { swimmer_sub: m.member_swimmer_sub, present }
              : { managed_id:  m.member_managed_id,  present };
          });
          const res = await fetch(`/api/scheduled-workouts/${sw.id}/complete`, {
            method:  "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({ attendance }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          onSaved && onSaved();
        } catch (e) { setErr(e.message); }
        finally { setBusy(false); }
      };

      const presentCount = (ctx?.roster?.length || 0) - absent.size;

      return (
        <div onClick={onClose} className="modal-overlay" style={{ padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 12,
            padding: 22, maxWidth: 480, width: "100%", maxHeight: "80vh", display: "flex", flexDirection: "column",
          }}>
            <div style={{ color: "var(--color-primary)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>
              {ctx?.completed_at ? "Edit attendance" : "Mark practice done"}
            </div>
            <div style={{ color: "var(--color-text)", fontSize: 15, marginBottom: 14 }}>
              {sw.scheduled_date} {ctx?.group_id ? `· group ${ctx.group_id}` : "· no group (solo)"}
            </div>
            {err && <div style={{ color: "var(--color-destructive)", fontSize: 12, marginBottom: 10 }}>⚠ {err}</div>}
            {!ctx ? (
              <div style={{ color: "var(--color-text-dim)", fontSize: 13 }}>Loading roster…</div>
            ) : ctx.roster.length === 0 ? (
              <div style={{ color: "var(--color-text-dim)", fontSize: 13, padding: "12px 0", lineHeight: 1.5 }}>
                No roster attached — clicking Save will just stamp the practice as done.
              </div>
            ) : (
              <>
                <div style={{ color: "var(--color-text-dim)", fontSize: 12, marginBottom: 8 }}>
                  {presentCount}/{ctx.roster.length} present. Uncheck absentees.
                </div>
                <div style={{ overflowY: "auto", border: "1px solid var(--color-card)", borderRadius: 6, padding: 4, flex: 1 }}>
                  {ctx.roster.map(m => {
                    const k = rowKey(m);
                    const present = !absent.has(k);
                    return (
                      <label key={k} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "8px 10px", borderRadius: 4, cursor: "pointer",
                        background: present ? "transparent" : "rgba(239,68,68,0.08)",
                      }}>
                        <input type="checkbox" checked={present} onChange={() => toggle(k)}
                          style={{ width: 18, height: 18, cursor: "pointer" }} />
                        <span style={{ color: present ? "var(--color-text)" : "var(--color-text-muted)", fontSize: 14, flex: 1, textDecoration: present ? "none" : "line-through" }}>
                          {m.display_name || m.initials || "(no name)"}
                        </span>
                        <span style={{ color: "var(--color-text-dim)", fontSize: 10 }}>
                          {m.role}{m.member_managed_id ? " · managed" : ""}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 14 }}>
              <button onClick={onClose} disabled={busy}
                className="btn btn-lg btn-outlined btn-neutral">Cancel</button>
              <button onClick={save} disabled={busy || !ctx}
                className="btn btn-lg btn-filled btn-primary">
                {busy ? "Saving…" : (ctx?.completed_at ? "Update" : "Mark done ✓")}
              </button>
            </div>
          </div>
        </div>
      );
    }
