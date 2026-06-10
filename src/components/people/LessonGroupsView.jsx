// src/components/people/LessonGroupsView.jsx — Lesson tier (Phase 5).
// "My Groups" — minimal small-group management for lesson coaches without the
// Coach team/club machinery. Lists the caller's lesson groups (team-less),
// creates new ones, and adds/removes managed swimmers. A group can then be
// picked in the generator's "Generate for" dropdown to fan one workout out to
// every member. React is a runtime global.
import { csrfHeaders } from "../../lib/api.js";

    export function LessonGroupsView() {
      const [groups,  setGroups]  = React.useState(null);
      const [managed, setManaged] = React.useState([]);          // caller's managed swimmers (for the add picker)
      const [newName, setNewName] = React.useState("");
      const [busy,    setBusy]    = React.useState(false);
      const [msg,     setMsg]     = React.useState(null);
      const [openId,  setOpenId]  = React.useState(null);        // expanded group → shows members
      const [membersByGroup, setMembersByGroup] = React.useState({});
      const [addPick, setAddPick] = React.useState({});          // groupId → selected managed_id

      const loadGroups = React.useCallback(async () => {
        try {
          const r = await fetch("/api/lesson-groups", { cache: "no-store" });
          setGroups(r.ok ? await r.json() : []);
        } catch (e) { setGroups([]); setMsg(`Error loading groups: ${e.message}`); }
      }, []);

      const loadManaged = React.useCallback(async () => {
        try {
          const r = await fetch("/api/managed-swimmers", { cache: "no-store" });
          setManaged(r.ok ? await r.json() : []);
        } catch (_) { setManaged([]); }
      }, []);

      const loadMembers = React.useCallback(async (groupId) => {
        try {
          const r = await fetch(`/api/groups/${groupId}/members`, { cache: "no-store" });
          const m = r.ok ? await r.json() : [];
          setMembersByGroup(prev => ({ ...prev, [groupId]: Array.isArray(m) ? m : [] }));
        } catch (_) { setMembersByGroup(prev => ({ ...prev, [groupId]: [] })); }
      }, []);

      React.useEffect(() => { loadGroups(); loadManaged(); }, [loadGroups, loadManaged]);

      const createGroup = async () => {
        const name = newName.trim();
        if (!name || busy) return;
        setBusy(true); setMsg(null);
        try {
          const r = await fetch("/api/lesson-groups", {
            method: "POST", headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({ name }),
          });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
          setNewName(""); await loadGroups();
        } catch (e) { setMsg(`Error: ${e.message}`); } finally { setBusy(false); }
      };

      const toggleOpen = (id) => {
        const next = openId === id ? null : id;
        setOpenId(next);
        if (next && !membersByGroup[next]) loadMembers(next);
      };

      const addMember = async (groupId) => {
        const managed_id = addPick[groupId];
        if (!managed_id || busy) return;
        setBusy(true); setMsg(null);
        try {
          const r = await fetch(`/api/groups/${groupId}/members`, {
            method: "POST", headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({ managed_id }),
          });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(j.error || j.reason || `HTTP ${r.status}`);
          setAddPick(prev => ({ ...prev, [groupId]: "" }));
          await loadMembers(groupId); await loadGroups();
        } catch (e) { setMsg(`Error: ${e.message}`); } finally { setBusy(false); }
      };

      const removeMember = async (groupId, memberId) => {
        if (busy) return;
        setBusy(true); setMsg(null);
        try {
          const r = await fetch(`/api/groups/${groupId}/members/${memberId}`, {
            method: "DELETE", headers: { ...csrfHeaders() },
          });
          if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || `HTTP ${r.status}`); }
          await loadMembers(groupId); await loadGroups();
        } catch (e) { setMsg(`Error: ${e.message}`); } finally { setBusy(false); }
      };

      // managed swimmers not already in the open group (for the add dropdown)
      const availableFor = (groupId) => {
        const inGroup = new Set((membersByGroup[groupId] || []).map(m => m.member_managed_id).filter(Boolean));
        return managed.filter(m => !m.archived && !inGroup.has(m.id));
      };

      return (
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>
          <h2 style={{ fontSize: 20, marginBottom: 4 }}>👥 My Groups</h2>
          <p style={{ fontSize: 13, color: "var(--color-text-dim)", marginTop: 0, lineHeight: 1.5 }}>
            Small-group lessons (e.g. "9:00 AM Sunday"). Add your managed swimmers, then pick the
            group in the generator's <strong>Generate for</strong> dropdown to send one workout to everyone.
            To assign to a single swimmer instead, pick them directly under <strong>Individuals</strong> there.
          </p>

          {/* Create */}
          <div style={{ display: "flex", gap: 8, margin: "12px 0 20px", flexWrap: "wrap" }}>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") createGroup(); }}
              placeholder="New group name (e.g. 9:00 AM Sunday)" aria-label="New group name" maxLength={120}
              style={{ flex: 1, minWidth: 200, padding: "8px 10px", fontSize: 13, borderRadius: 6,
                border: "1px solid var(--color-border-strong)", background: "var(--color-bg)", color: "var(--color-text)" }} />
            <button onClick={createGroup} disabled={busy || !newName.trim()}
              style={{ padding: "8px 16px", borderRadius: 6, border: "none",
                background: (busy || !newName.trim()) ? "var(--color-border)" : "var(--color-primary)",
                color: "var(--color-bg)", fontSize: 13, fontWeight: 700, cursor: (busy || !newName.trim()) ? "default" : "pointer" }}>
              + New group
            </button>
          </div>

          {msg && <div style={{ fontSize: 12, marginBottom: 12, color: msg.startsWith("Error") ? "var(--color-destructive)" : "var(--color-positive)" }}>{msg}</div>}

          {groups === null ? (
            <p style={{ color: "var(--color-text-dim)" }}>Loading…</p>
          ) : groups.length === 0 ? (
            <p style={{ color: "var(--color-text-dim)" }}>No groups yet. Create one above to get started.</p>
          ) : (
            groups.map(g => {
              const open = openId === g.id;
              const members = membersByGroup[g.id] || [];
              const avail = availableFor(g.id);
              return (
                <div key={g.id} className="card" style={{ padding: 14, marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                    onClick={() => toggleOpen(g.id)}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{g.name}</span>
                    <span style={{ fontSize: 12, color: "var(--color-text-dim)" }}>{open ? "▾" : "▸"} manage members</span>
                  </div>
                  {open && (
                    <div style={{ marginTop: 12 }}>
                      {members.length === 0 ? (
                        <p style={{ fontSize: 13, color: "var(--color-text-dim)", margin: "0 0 8px" }}>No swimmers in this group yet.</p>
                      ) : (
                        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 10px" }}>
                          {members.map(m => (
                            <li key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid var(--color-border)" }}>
                              <span style={{ fontSize: 13 }}>{m.display_name || m.member_managed_id || "Swimmer"}</span>
                              <button onClick={() => removeMember(g.id, m.id)} disabled={busy}
                                style={{ padding: "2px 8px", fontSize: 11, borderRadius: 4, border: "1px solid var(--color-border-strong)",
                                  background: "transparent", color: "var(--color-text-muted)", cursor: "pointer" }}>
                                Remove
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <select value={addPick[g.id] || ""} onChange={e => setAddPick(prev => ({ ...prev, [g.id]: e.target.value }))}
                          aria-label="Add a managed swimmer"
                          style={{ flex: 1, minWidth: 160, padding: "6px 9px", fontSize: 13, borderRadius: 5,
                            background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)" }}>
                          <option value="">Add a managed swimmer…</option>
                          {avail.map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}
                        </select>
                        <button onClick={() => addMember(g.id)} disabled={busy || !addPick[g.id]}
                          style={{ padding: "6px 14px", borderRadius: 5, border: "none",
                            background: (busy || !addPick[g.id]) ? "var(--color-border)" : "var(--color-primary)",
                            color: "var(--color-bg)", fontSize: 13, fontWeight: 700, cursor: (busy || !addPick[g.id]) ? "default" : "pointer" }}>
                          Add
                        </button>
                      </div>
                      {avail.length === 0 && managed.length > 0 && (
                        <p style={{ fontSize: 11, color: "var(--color-text-dim)", margin: "6px 0 0" }}>All your managed swimmers are already in this group.</p>
                      )}
                      {managed.length === 0 && (
                        <p style={{ fontSize: 11, color: "var(--color-text-dim)", margin: "6px 0 0" }}>Add managed swimmers first (🔧 → Managed swimmers).</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      );
    }
