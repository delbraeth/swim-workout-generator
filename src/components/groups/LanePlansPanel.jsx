// src/components/groups/LanePlansPanel.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { csrfHeaders } from "../../lib/api.js";

    const { useState, useCallback, useEffect } = React;

    export function LanePlansPanel({ groupId, members, isPrimary, onChanged }) {
      const [plans,      setPlans]      = React.useState(null);
      const [editingId,  setEditingId]  = React.useState(null);                 // plan id being edited, or "new"
      const [draft,      setDraft]      = React.useState(null);                 // { name, is_default, plan_data }
      const [err,        setErr]        = React.useState(null);

      const load = React.useCallback(async () => {
        try {
          const res = await fetch(`/api/groups/${groupId}/lane-plans`, { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setPlans(await res.json());
        } catch (e) { setErr(e.message); setPlans([]); }
      }, [groupId]);
      React.useEffect(() => { load(); }, [load]);

      const startNew = () => {
        setEditingId("new");
        setDraft({ name: "", is_default: false, plan_data: { lanes: [{ idx: 0, label: "Lane 1", target_pace_100: "", members: [] }] } });
      };
      const startEdit = (p) => {
        setEditingId(p.id);
        setDraft({ name: p.name, is_default: p.is_default, plan_data: JSON.parse(JSON.stringify(p.plan_data || { lanes: [] })) });
      };
      const cancel = () => { setEditingId(null); setDraft(null); setErr(null); };

      const save = async () => {
        if (!draft.name.trim()) { setErr("Plan name required"); return; }
        try {
          const url    = editingId === "new" ? `/api/groups/${groupId}/lane-plans` : `/api/lane-plans/${editingId}`;
          const method = editingId === "new" ? "POST" : "PATCH";
          const body   = editingId === "new"
            ? JSON.stringify({ name: draft.name.trim(), is_default: !!draft.is_default, plan_data: draft.plan_data })
            : JSON.stringify({ name: draft.name.trim(), plan_data: draft.plan_data });
          const res = await fetch(url, { method, headers: { "Content-Type": "application/json", ...csrfHeaders() }, body });
          const j = await res.json();
          if (!res.ok) throw new Error(j.error || j.reason || `HTTP ${res.status}`);
          // is_default is set via separate endpoint on edit (not part of PATCH body).
          if (editingId !== "new" && draft.is_default) {
            await fetch(`/api/lane-plans/${editingId}/default`, { method: "POST", headers: { ...csrfHeaders() } });
          }
          cancel();
          await load();
          if (onChanged) onChanged();
        } catch (e) { setErr(e.message); }
      };

      const setDefault = async (planId) => {
        try {
          const res = await fetch(`/api/lane-plans/${planId}/default`, { method: "POST", headers: { ...csrfHeaders() } });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          await load();
          if (onChanged) onChanged();
        } catch (e) { setErr(e.message); }
      };

      const archivePlan = async (planId, name) => {
        if (!window.confirm(`Archive plan "${name}"?`)) return;
        try {
          const res = await fetch(`/api/lane-plans/${planId}/archive`, {
            method:  "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({ archived: true }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          await load();
          if (onChanged) onChanged();
        } catch (e) { setErr(e.message); }
      };

      // ── Draft mutation helpers (operate on draft.plan_data.lanes) ────
      const updateDraftLane = (idx, patch) => {
        setDraft(d => ({ ...d, plan_data: { ...d.plan_data, lanes: d.plan_data.lanes.map((l, i) => i === idx ? { ...l, ...patch } : l) } }));
      };
      const addLane = () => {
        setDraft(d => {
          const nextIdx = d.plan_data.lanes.length;
          return { ...d, plan_data: { ...d.plan_data, lanes: [...d.plan_data.lanes, { idx: nextIdx, label: `Lane ${nextIdx + 1}`, target_pace_100: "", members: [] }] } };
        });
      };
      const removeLane = (idx) => {
        setDraft(d => ({ ...d, plan_data: { ...d.plan_data, lanes: d.plan_data.lanes.filter((_, i) => i !== idx).map((l, i) => ({ ...l, idx: i })) } }));
      };
      const addMemberToLane = (laneIdx, managedId) => {
        if (!managedId) return;
        setDraft(d => ({ ...d, plan_data: { ...d.plan_data, lanes: d.plan_data.lanes.map((l, i) => i === laneIdx ? { ...l, members: [...l.members, { managed_id: managedId }] } : l) } }));
      };
      const removeMemberFromLane = (laneIdx, mIdx) => {
        setDraft(d => ({ ...d, plan_data: { ...d.plan_data, lanes: d.plan_data.lanes.map((l, i) => i === laneIdx ? { ...l, members: l.members.filter((_, j) => j !== mIdx) } : l) } }));
      };

      // Members already placed in any lane (across the draft) — for the
      // add-member picker to exclude them.
      const placedManagedIds = new Set((draft?.plan_data?.lanes || []).flatMap(l => l.members.map(m => m.managed_id).filter(Boolean)));
      const memberOptions    = (members || []).filter(m => m.member_managed_id && !placedManagedIds.has(m.member_managed_id));
      const memberName       = (managedId) => (members || []).find(m => m.member_managed_id === managedId)?.display_name || "(unknown)";

      return (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Lane plans ({plans ? plans.length : "—"})
            </div>
            {isPrimary && !editingId && (
              <button onClick={startNew}
                style={{ padding: "3px 9px", background: "transparent", color: "var(--color-warn)", border: "1px solid var(--color-warn)", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>
                + New plan
              </button>
            )}
          </div>
          {err && <div style={{ color: "#fca5a5", fontSize: 11, marginBottom: 6 }}>{err}</div>}

          {/* Existing plans list (read mode) */}
          {!editingId && plans && plans.length === 0 && (
            <div style={{ fontSize: 11, color: "var(--color-text-dim)", fontStyle: "italic" }}>No lane plans yet. Coach generates use stored paces.</div>
          )}
          {!editingId && plans && plans.map(p => (
            <div key={p.id} style={{ padding: "6px 10px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 5, marginBottom: 5, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#cbd5e1", fontWeight: 700 }}>
                  {p.name}
                  {p.is_default && <span style={{ marginLeft: 6, fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "#f59e0b22", border: "1px solid var(--color-warn)", color: "var(--color-warn)", fontWeight: 700 }}>default</span>}
                  <span style={{ marginLeft: 6, color: "var(--color-text-dim)", fontSize: 10 }}>· {(p.plan_data?.lanes || []).length} lanes · {(p.plan_data?.lanes || []).reduce((n, l) => n + (l.members?.length || 0), 0)} swimmers</span>
                </span>
                {isPrimary && (
                  <div style={{ display: "flex", gap: 4 }}>
                    {!p.is_default && <button onClick={() => setDefault(p.id)} style={{ padding: "2px 7px", background: "transparent", color: "var(--color-warn)", border: "1px solid var(--color-warn)", borderRadius: 4, fontSize: 10, cursor: "pointer" }}>Set default</button>}
                    <button onClick={() => startEdit(p)} style={{ padding: "2px 7px", background: "transparent", color: "var(--color-primary-text)", border: "1px solid var(--color-primary)", borderRadius: 4, fontSize: 10, cursor: "pointer" }}>Edit</button>
                    <button onClick={() => archivePlan(p.id, p.name)} style={{ padding: "2px 7px", background: "transparent", color: "var(--color-destructive-text)", border: "1px solid #ef4444", borderRadius: 4, fontSize: 10, cursor: "pointer" }}>Archive</button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Editor (create or edit) */}
          {editingId && draft && (
            <div style={{ padding: 10, background: "var(--color-bg)", border: "1px solid var(--color-warn)", borderRadius: 5, marginBottom: 6 }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
                <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Plan name (e.g. Tuesday config)"
                  style={{ flex: 1, padding: "5px 9px", fontSize: 12, background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 4 }} />
                <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#cbd5e1", cursor: "pointer" }}>
                  <input type="checkbox" checked={!!draft.is_default} onChange={e => setDraft(d => ({ ...d, is_default: e.target.checked }))} />
                  Default
                </label>
              </div>
              {draft.plan_data.lanes.map((lane, lIdx) => (
                <div key={lIdx} className="card" style={{ padding: 8, borderRadius: 4, marginBottom: 6 }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: "var(--color-text-dim)", padding: "5px 0" }}>#{lane.idx + 1}</span>
                    <input value={lane.label} onChange={e => updateDraftLane(lIdx, { label: e.target.value })} placeholder="Lane label" maxLength={40}
                      style={{ flex: 1, padding: "4px 8px", fontSize: 11, background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 3 }} />
                    <input value={lane.target_pace_100 || ""} onChange={e => updateDraftLane(lIdx, { target_pace_100: e.target.value })} placeholder="pace e.g. 2:00" maxLength={8}
                      style={{ width: 80, padding: "4px 8px", fontSize: 11, background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 3 }} />
                    <button onClick={() => removeLane(lIdx)} title="Remove lane"
                      style={{ padding: "3px 8px", background: "transparent", color: "var(--color-destructive-text)", border: "1px solid #ef4444", borderRadius: 3, fontSize: 10, cursor: "pointer" }}>×</button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                    {lane.members.map((m, mIdx) => (
                      <span key={mIdx} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 7px", background: "var(--color-bg)", border: "1px solid var(--color-border-strong)", borderRadius: 999, fontSize: 10, color: "#cbd5e1" }}>
                        {memberName(m.managed_id)}
                        <button onClick={() => removeMemberFromLane(lIdx, mIdx)} style={{ background: "transparent", border: "none", color: "var(--color-destructive-text)", cursor: "pointer", padding: 0, fontSize: 12, lineHeight: 1 }}>×</button>
                      </span>
                    ))}
                    {lane.members.length === 0 && <span style={{ fontSize: 10, color: "var(--color-text-dim)", fontStyle: "italic" }}>No swimmers yet</span>}
                  </div>
                  <select value="" onChange={e => { addMemberToLane(lIdx, e.target.value); e.target.value = ""; }}
                    style={{ width: "100%", padding: "4px 8px", fontSize: 11, background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 3 }}>
                    <option value="">+ Add swimmer to this lane</option>
                    {memberOptions.map(m => (
                      <option key={m.member_managed_id} value={m.member_managed_id}>{m.display_name} ({m.age}y)</option>
                    ))}
                  </select>
                </div>
              ))}
              <button onClick={addLane}
                style={{ padding: "4px 10px", background: "transparent", color: "var(--color-warn)", border: "1px dashed var(--color-warn)", borderRadius: 4, fontSize: 11, cursor: "pointer", marginBottom: 8 }}>
                + Add lane
              </button>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={save}
                  style={{ padding: "5px 11px", background: "var(--color-positive)", color: "var(--color-bg)", border: "none", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  Save plan
                </button>
                <button onClick={cancel}
                  style={{ padding: "5px 11px", background: "var(--color-border)", color: "#cbd5e1", border: "none", borderRadius: 4, fontSize: 11, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }
