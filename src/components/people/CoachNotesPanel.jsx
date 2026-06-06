// src/components/people/CoachNotesPanel.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { csrfHeaders } from "../../lib/api.js";

    const { useState, useCallback, useEffect, useRef } = React;

    export function CoachNotesPanel({ targetManagedId, targetSwimmerSub, teamId, mySub, seedNotes = null }) {
      const [notes,       setNotes]        = React.useState(seedNotes ?? null);
      const [team,        setTeam]         = React.useState(null);   // for team_type lookup
      const [draftBody,   setDraftBody]    = React.useState("");
      const [draftVis,    setDraftVis]     = React.useState("private");
      const [busy,        setBusy]         = React.useState(false);
      const [err,         setErr]          = React.useState(null);
      const [editingId,   setEditingId]    = React.useState(null);
      const [editingBody, setEditingBody]  = React.useState("");
      const [editingVis,  setEditingVis]   = React.useState("private");

      const targetQuery = targetManagedId
        ? `managed_id=${encodeURIComponent(targetManagedId)}`
        : `swimmer_sub=${encodeURIComponent(targetSwimmerSub)}`;

      const load = React.useCallback(async () => {
        try {
          const res = await fetch(`/api/coach-notes?${targetQuery}`, { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setNotes(await res.json());
        } catch (e) { setNotes([]); setErr(e.message); }
      }, [targetQuery]);
      // Seeded from the composite detail fetch — skip the initial load; still
      // refetch after add/edit/delete. Ref guards only the first effect run.
      const skipInitial = React.useRef(seedNotes != null);
      React.useEffect(() => { if (skipInitial.current) { skipInitial.current = false; return; } load(); }, [load]);

      // Fetch the team (once) so we can apply the per-team-type default
      // visibility on the create form.
      React.useEffect(() => {
        if (!teamId) { setTeam(null); return; }
        fetch(`/api/teams/${teamId}`, { cache: "no-store" })
          .then(r => r.ok ? r.json() : null)
          .then(t => {
            setTeam(t);
            const def = (t && t.team_type === "high_school") ? "team_coaches" : "private";
            setDraftVis(def);
          })
          .catch(() => {});
      }, [teamId]);

      // Compute which visibility values are actually selectable. team_coaches
      // requires the swimmer to have a team; group_coaches requires a primary
      // group with this coach. We can't pre-check the group here (server
      // resolves at create-time), but the team check is cheap.
      const visOptions = [
        { id: "private",       label: "Private",        desc: "Only you can see this" },
        { id: "group_coaches", label: "Group coaches",  desc: "Other coaches on this swimmer's group" },
        { id: "team_coaches",  label: "Team coaches",   desc: "All coaches on this swimmer's team", disabled: !teamId },
      ];

      const createNote = async () => {
        if (!draftBody.trim()) { setErr("Note can't be empty"); return; }
        setBusy(true); setErr(null);
        try {
          const body = {
            visibility: draftVis,
            body:       draftBody.trim(),
          };
          if (targetManagedId)  body.managed_id  = targetManagedId;
          if (targetSwimmerSub) body.swimmer_sub = targetSwimmerSub;
          const res = await fetch("/api/coach-notes", {
            method:  "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify(body),
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) {
            if (j.error === "group_coaches_requires_group") throw new Error("This swimmer isn't in a group you coach — can't share with group coaches.");
            if (j.error === "team_coaches_requires_team")   throw new Error("This swimmer isn't on a team — can't share with team coaches.");
            if (j.error === "body_too_long")                throw new Error("Note too long (max 5000 chars).");
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          setDraftBody("");
          // Keep draftVis as the user's most-recent preference for the next note.
          await load();
        } catch (e) { setErr(e.message); }
        finally { setBusy(false); }
      };

      const startEdit = (n) => {
        setEditingId(n.id);
        setEditingBody(n.body);
        setEditingVis(n.visibility);
      };
      const cancelEdit = () => { setEditingId(null); setEditingBody(""); };

      const saveEdit = async () => {
        if (!editingBody.trim()) { setErr("Note can't be empty"); return; }
        setBusy(true); setErr(null);
        try {
          const res = await fetch(`/api/coach-notes/${editingId}`, {
            method:  "PATCH",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({ body: editingBody.trim(), visibility: editingVis }),
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
          cancelEdit();
          await load();
        } catch (e) { setErr(e.message); }
        finally { setBusy(false); }
      };

      const deleteNote = async (id) => {
        if (!window.confirm("Delete this note? You can't recover it.")) return;
        setBusy(true); setErr(null);
        try {
          const res = await fetch(`/api/coach-notes/${id}`, {
            method:  "DELETE",
            headers: { ...csrfHeaders() },
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          await load();
        } catch (e) { setErr(e.message); }
        finally { setBusy(false); }
      };

      const visPillStyle = (vis) => {
        const map = {
          private:       { bg: "rgba(100,116,139,0.18)", border: "var(--color-text-dim)", color: "var(--color-text-muted)" },
          group_coaches: { bg: "rgba(245,158,11,0.18)",  border: "var(--color-warn)", color: "var(--color-warn)" },
          team_coaches:  { bg: "rgba(59,130,246,0.18)",  border: "var(--color-primary)", color: "var(--color-primary-text)" },
        };
        const s = map[vis] || map.private;
        return { padding: "2px 8px", borderRadius: 999, border: `1px solid ${s.border}`, background: s.bg, color: s.color, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" };
      };
      const visLabel = { private: "Private", group_coaches: "Group", team_coaches: "Team" };

      return (
        <div style={{ marginTop: 14, padding: 14, background: "var(--color-card)", border: "1px solid var(--color-border-strong)", borderRadius: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <h4 style={{ color: "var(--color-text)", margin: 0, fontSize: 14 }}>Coach notes ({notes ? notes.length : "…"})</h4>
            {team && team.team_type === "high_school" && (
              <span style={{ fontSize: 10, color: "var(--color-primary-text)", fontStyle: "italic" }}>High-school team — notes default to team-shared</span>
            )}
          </div>

          {/* Create form */}
          <div style={{ marginBottom: 10, padding: 8, background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 6 }}>
            <textarea value={draftBody} onChange={(e) => setDraftBody(e.target.value)}
              placeholder="Add a note about this swimmer…"
              rows={2} maxLength={5000}
              style={{ width: "100%", padding: "6px 8px", background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border)", borderRadius: 5, fontSize: 12, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, gap: 6, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {visOptions.map(o => {
                  const active = draftVis === o.id;
                  return (
                    <button key={o.id} onClick={() => !o.disabled && setDraftVis(o.id)}
                      disabled={o.disabled}
                      title={o.disabled ? "Unavailable — swimmer has no team" : o.desc}
                      style={{
                        padding: "3px 9px", borderRadius: 999,
                        border: `1px solid ${active ? "var(--color-primary)" : "var(--color-border)"}`,
                        background: active ? "rgba(59,130,246,0.18)" : "transparent",
                        color: o.disabled ? "var(--color-border-strong)" : (active ? "var(--color-primary)" : "var(--color-text-muted)"),
                        fontSize: 11, fontWeight: 700,
                        cursor: o.disabled ? "not-allowed" : "pointer",
                      }}>{o.label}</button>
                  );
                })}
              </div>
              <button onClick={createNote} disabled={busy || !draftBody.trim()}
                className="btn btn-sm btn-filled btn-primary">
                {busy ? "…" : "Add note"}
              </button>
            </div>
            {err && <div style={{ color: "#fca5a5", fontSize: 11, marginTop: 5 }}>{err}</div>}
          </div>

          {/* List */}
          {notes === null && <div style={{ color: "var(--color-text-muted)", fontSize: 11, fontStyle: "italic" }}>Loading notes…</div>}
          {notes !== null && notes.length === 0 && <div style={{ color: "var(--color-text-muted)", fontSize: 11, fontStyle: "italic" }}>No notes yet.</div>}
          {notes && notes.length > 0 && notes.map(n => {
            const mine = n.author_coach_sub === mySub;
            const editing = editingId === n.id;
            return (
              <div key={n.id} style={{ padding: 10, background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 6, marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5, gap: 6, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--color-text-muted)" }}>
                    <span style={{ color: mine ? "var(--color-warn)" : "#cbd5e1", fontWeight: 700 }}>{n.author_name || (mine ? "You" : "(coach)")}{mine ? " (you)" : ""}</span>
                    <span>·</span>
                    <span>{n.created_at ? new Date(n.created_at).toLocaleString() : ""}</span>
                    {n.updated_at && n.updated_at !== n.created_at && <span style={{ fontStyle: "italic" }}>(edited)</span>}
                  </div>
                  <span style={visPillStyle(n.visibility)}>{visLabel[n.visibility] || n.visibility}</span>
                </div>
                {editing ? (
                  <>
                    <textarea value={editingBody} onChange={(e) => setEditingBody(e.target.value)}
                      rows={3} maxLength={5000}
                      style={{ width: "100%", padding: "6px 8px", background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border)", borderRadius: 5, fontSize: 12, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
                    <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                      {visOptions.map(o => {
                        const active = editingVis === o.id;
                        return (
                          <button key={o.id} onClick={() => !o.disabled && setEditingVis(o.id)}
                            disabled={o.disabled}
                            style={{
                              padding: "3px 9px", borderRadius: 999,
                              border: `1px solid ${active ? "var(--color-primary)" : "var(--color-border)"}`,
                              background: active ? "rgba(59,130,246,0.18)" : "transparent",
                              color: o.disabled ? "var(--color-border-strong)" : (active ? "var(--color-primary)" : "var(--color-text-muted)"),
                              fontSize: 11, fontWeight: 700,
                              cursor: o.disabled ? "not-allowed" : "pointer",
                            }}>{o.label}</button>
                        );
                      })}
                    </div>
                    <div style={{ marginTop: 6, display: "flex", gap: 5 }}>
                      <button onClick={saveEdit} disabled={busy}
                        style={{ padding: "4px 11px", borderRadius: 5, border: "none", background: "var(--color-positive)", color: "var(--color-bg)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Save</button>
                      <button onClick={cancelEdit}
                        style={{ padding: "4px 11px", borderRadius: 5, border: "1px solid var(--color-border-strong)", background: "transparent", color: "var(--color-text-muted)", fontSize: 11, cursor: "pointer" }}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ color: "var(--color-text)", fontSize: 12, whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{n.body}</div>
                    {mine && (
                      <div style={{ marginTop: 5, display: "flex", gap: 5 }}>
                        <button onClick={() => startEdit(n)}
                          style={{ padding: "2px 8px", borderRadius: 5, border: "1px solid var(--color-border-strong)", background: "transparent", color: "var(--color-text-muted)", fontSize: 10, cursor: "pointer" }}>Edit</button>
                        <button onClick={() => deleteNote(n.id)}
                          style={{ padding: "2px 8px", borderRadius: 5, border: "1px solid #ef4444", background: "transparent", color: "var(--color-destructive-text)", fontSize: 10, cursor: "pointer" }}>Delete</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      );
    }
