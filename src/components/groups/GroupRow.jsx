// src/components/groups/GroupRow.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { csrfHeaders } from "../../lib/api.js";
import { PHASE_OPTIONS } from "../../lib/constants.js";
import { phaseOption } from "../../lib/format.js";
import { GroupAssignmentsPanel } from "./GroupAssignmentsPanel.jsx";
import { JoinTokensPanel } from "./JoinTokensPanel.jsx";
import { LanePlansPanel } from "./LanePlansPanel.jsx";

    const { useState, useCallback, useEffect } = React;

    export function GroupRow({ group, coachPool, managedInTeam, onChanged, featureFlags = null }) {   // exported for src/components/teams/TeamsView.jsx
      const ff = featureFlags || {};   // Phase 6: gate the lane-plans panel
      const [expanded, setExpanded] = React.useState(false);
      const [detail,   setDetail]   = React.useState(null);
      const [addMemberId, setAddMemberId] = React.useState("");
      const [addMemberRole, setAddMemberRole] = React.useState("primary");
      const [addCoachSub, setAddCoachSub] = React.useState("");
      const [err, setErr] = React.useState(null);

      const load = React.useCallback(async () => {
        if (!group?.id) return;
        try {
          const res = await fetch(`/api/groups/${group.id}`, { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setDetail(await res.json());
          setErr(null);
        } catch (e) { setErr(e.message); }
      }, [group?.id]);
      React.useEffect(() => { if (expanded) load(); }, [expanded, load]);

      const isPrimary = detail?.viewer_role === "primary";
      const phase = phaseOption(group.current_phase);

      const setPhase = async (v) => {
        try {
          const res = await fetch(`/api/groups/${group.id}/phase`, {
            method:  "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({ phase: v || null }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          if (onChanged) onChanged();                                          // refresh parent list (header reflects phase)
          await load();
        } catch (e) { setErr(e.message); }
      };

      const toggleVisibility = async () => {
        try {
          const res = await fetch(`/api/groups/${group.id}`, {
            method:  "PATCH",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({ roster_visible_to_members: !detail.roster_visible_to_members }),
          });
          const j = await res.json();
          if (!res.ok) {
            // Decision #28: server returns reason "minors_present_visibility_locked_off"
            if (j.reason === "minors_present_visibility_locked_off") {
              throw new Error("Cannot enable roster visibility — group has under-18 members. Privacy gate is enforced.");
            }
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          await load();
        } catch (e) { setErr(e.message); }
      };

      const archive = async () => {
        if (!window.confirm(`Archive group "${group.name}"? Members will be stamped as left at archive time.`)) return;
        try {
          const res = await fetch(`/api/groups/${group.id}/archive`, {
            method:  "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({ archived: true }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          setExpanded(false);
          if (onChanged) onChanged();
        } catch (e) { setErr(e.message); }
      };

      const addMember = async () => {
        if (!addMemberId) { setErr("Pick a swimmer to add"); return; }
        try {
          const res = await fetch(`/api/groups/${group.id}/members`, {
            method:  "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({ managed_id: addMemberId, role: addMemberRole }),
          });
          const j = await res.json();
          if (!res.ok) {
            // Decision #33: surface the conflict-group name if returned
            if (j.reason === "primary_in_other_group_same_coach") {
              throw new Error(`Already a primary in another of your groups: ${j.conflict_group_name || j.conflict_group_id}. Either change their role here to 'secondary' or remove them from the other group first.`);
            }
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          setAddMemberId("");
          setErr(null);
          await load();
        } catch (e) { setErr(e.message); }
      };

      const removeMember = async (memberId, name) => {
        const reason = window.prompt(`Remove ${name} from ${group.name}? (Optional: enter a reason)`, "");
        if (reason === null) return;                                            // cancel
        try {
          const res = await fetch(`/api/groups/${group.id}/members/${memberId}`, {
            method:  "DELETE",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({ reason: reason || null }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          await load();
        } catch (e) { setErr(e.message); }
      };

      const addCoach = async () => {
        if (!addCoachSub) return;
        try {
          const res = await fetch(`/api/groups/${group.id}/coaches`, {
            method:  "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({ coach_sub: addCoachSub, role: "assistant" }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          setAddCoachSub("");
          await load();
        } catch (e) { setErr(e.message); }
      };

      const removeCoach = async (sub) => {
        if (!window.confirm("Remove this coach from the group?")) return;
        try {
          const res = await fetch(`/api/groups/${group.id}/coaches/${encodeURIComponent(sub)}`, {
            method:  "DELETE",
            headers: { ...csrfHeaders() },
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          await load();
        } catch (e) { setErr(e.message); }
      };

      // Available managed swimmers for the add-member picker = team's managed
      // swimmers minus those already active in this group.
      const activeMemberIds = new Set((detail?.members || []).map(m => m.member_managed_id).filter(Boolean));
      const candidates      = (managedInTeam || []).filter(s => !activeMemberIds.has(s.id));
      const activeCoachSubs = new Set((detail?.coaches || []).map(c => c.coach_sub));
      const coachCandidates = (coachPool || []).filter(c => !activeCoachSubs.has(c.sub));

      return (
        <div style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 6 }}>
          <button onClick={() => setExpanded(e => !e)}
            style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", background: "transparent", border: "none", color: "var(--color-text)", cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700 }}>
                  {expanded ? "▾" : "▸"} {group.name}
                  {group.archived && <span style={{ marginLeft: 6, fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#64748b22", border: "1px solid #64748b", color: "var(--color-text-muted)" }}>archived</span>}
                </span>
                {group.pool_mode_default && <span style={{ marginLeft: 8, fontSize: 10, color: "var(--color-text-muted)" }}>· {group.pool_mode_default}</span>}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {group.current_phase && (
                  <span title={`Phase set ${group.phase_set_at ? new Date(group.phase_set_at).toLocaleDateString() : ""}`}
                    style={{ fontSize: 10, padding: "1px 7px", borderRadius: 999, background: `${phase.color}22`, border: `1px solid ${phase.color}`, color: phase.color, fontWeight: 700 }}>
                    {phase.label}
                  </span>
                )}
              </div>
            </div>
          </button>
          {expanded && (
            <div style={{ padding: "0 14px 14px", borderTop: "1px solid var(--color-border)" }}>
              {err && <div style={{ color: "#fca5a5", fontSize: 11, padding: "8px 0" }}>{err}</div>}
              {!detail ? (
                <div style={{ color: "var(--color-text-dim)", fontSize: 12, padding: "10px 0" }}>Loading…</div>
              ) : (
                <>
                  {/* MAAP two-deep soft-warning (eval 2026-06-06 #3). Non-blocking:
                      a group with any under-18 member and fewer than 2 active
                      coaches falls short of USA Swimming's two-deep guidance. */}
                  {(detail.members || []).some(m => m.is_minor === true) && (detail.coaches || []).length < 2 && (
                    <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 6, background: "rgba(245,158,11,0.12)", border: "1px solid var(--color-warn)", color: "var(--color-warn)", fontSize: 12, lineHeight: 1.4 }}>
                      ⚠ <strong>Two-deep recommended.</strong> This group has under-18 swimmers and only one coach. USA Swimming MAAP guidance calls for at least two adults — add a co-coach below.
                    </div>
                  )}
                  {/* Members */}
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Members ({(detail.members || []).length})
                    </div>
                    {(detail.members || []).length === 0 && <div style={{ fontSize: 12, color: "var(--color-text-dim)", fontStyle: "italic" }}>No members yet.</div>}
                    {(detail.members || []).map(m => (
                      <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", fontSize: 12 }}>
                        <span style={{ color: "#cbd5e1" }}>
                          {m.display_name}
                          <span style={{ marginLeft: 6, color: "var(--color-text-dim)" }}>· age {m.age}</span>
                          <span style={{ marginLeft: 6, fontSize: 10, padding: "1px 6px", borderRadius: 4, background: m.role === "primary" ? "#22c55e22" : "#33415522", border: `1px solid ${m.role === "primary" ? "var(--color-positive)" : "var(--color-border-strong)"}`, color: m.role === "primary" ? "var(--color-positive)" : "var(--color-text-muted)", fontWeight: 700 }}>
                            {m.role}
                          </span>
                          {m.is_coppa_protected && <span style={{ marginLeft: 4, fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#dc262622", border: "1px solid #dc2626", color: "#dc2626", fontWeight: 700 }}>under 13</span>}
                          {m.is_minor && !m.is_coppa_protected && <span style={{ marginLeft: 4, fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#f59e0b22", border: "1px solid var(--color-warn)", color: "var(--color-warn)", fontWeight: 700 }}>minor</span>}
                        </span>
                        {detail.viewer_role && (
                          <button onClick={() => removeMember(m.id, m.display_name)}
                            style={{ padding: "2px 8px", background: "transparent", color: "var(--color-destructive-text)", border: "1px solid #ef4444", borderRadius: 4, fontSize: 10, cursor: "pointer" }}>
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                    {detail.viewer_role && candidates.length > 0 && (
                      <div style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center" }}>
                        <select value={addMemberId} onChange={e => setAddMemberId(e.target.value)}
                          style={{ flex: 1, padding: "5px 9px", fontSize: 12, background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 5 }}>
                          <option value="">— pick a swimmer —</option>
                          {candidates.map(s => (
                            <option key={s.id} value={s.id}>{s.display_name} ({s.age}y)</option>
                          ))}
                        </select>
                        <select value={addMemberRole} onChange={e => setAddMemberRole(e.target.value)}
                          style={{ padding: "5px 9px", fontSize: 12, background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 5 }}>
                          <option value="primary">primary</option>
                          <option value="secondary">secondary</option>
                        </select>
                        <button onClick={addMember} disabled={!addMemberId}
                          style={{ padding: "5px 11px", background: addMemberId ? "var(--color-warn)" : "var(--color-border-strong)", color: addMemberId ? "var(--color-bg)" : "var(--color-text-muted)", border: "none", borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: addMemberId ? "pointer" : "not-allowed" }}>
                          Add
                        </button>
                      </div>
                    )}
                    {detail.viewer_role && candidates.length === 0 && (managedInTeam || []).length === 0 && (
                      <div style={{ fontSize: 11, color: "var(--color-text-dim)", marginTop: 6, fontStyle: "italic" }}>
                        No team-affiliated managed swimmers available. Add some via 🏊 Managed swimmers.
                      </div>
                    )}
                  </div>

                  {/* Group coaches */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Coaches ({(detail.coaches || []).length})
                    </div>
                    {(detail.coaches || []).map(c => (
                      <div key={c.coach_sub} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", fontSize: 12 }}>
                        <span style={{ color: "#cbd5e1" }}>
                          {c.display_name || "(no name)"}
                          <span style={{ marginLeft: 6, fontSize: 10, padding: "1px 6px", borderRadius: 4, background: c.role === "primary" ? "#3b82f622" : "#33415522", border: `1px solid ${c.role === "primary" ? "var(--color-primary)" : "var(--color-border-strong)"}`, color: c.role === "primary" ? "var(--color-primary)" : "var(--color-text-muted)", fontWeight: 700 }}>{c.role}</span>
                        </span>
                        {isPrimary && c.role !== "primary" && (
                          <button onClick={() => removeCoach(c.coach_sub)}
                            style={{ padding: "2px 8px", background: "transparent", color: "var(--color-destructive-text)", border: "1px solid #ef4444", borderRadius: 4, fontSize: 10, cursor: "pointer" }}>
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                    {isPrimary && coachCandidates.length > 0 && (
                      <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                        <select value={addCoachSub} onChange={e => setAddCoachSub(e.target.value)}
                          style={{ flex: 1, padding: "5px 9px", fontSize: 12, background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 5 }}>
                          <option value="">— add an assistant coach —</option>
                          {coachCandidates.map(c => (
                            <option key={c.sub} value={c.sub}>{c.display_name || "(no name)"}{c.initials ? ` (${c.initials})` : ""} · …{c.sub.slice(-6)}</option>
                          ))}
                        </select>
                        <button onClick={addCoach} disabled={!addCoachSub}
                          style={{ padding: "5px 11px", background: addCoachSub ? "var(--color-primary)" : "var(--color-border-strong)", color: addCoachSub ? "var(--color-bg)" : "var(--color-text-muted)", border: "none", borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: addCoachSub ? "pointer" : "not-allowed" }}>
                          Add
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Phase + settings (primary only) */}
                  {isPrimary && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Training phase
                      </div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {PHASE_OPTIONS.map(p => {
                          const active = (group.current_phase || "") === p.v;
                          return (
                            <button key={p.v} onClick={() => setPhase(p.v)}
                              style={{ padding: "4px 10px", borderRadius: 999, border: `1px solid ${active ? p.color : "var(--color-border)"}`, background: active ? `${p.color}22` : "transparent", color: active ? p.color : "var(--color-text-muted)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                              {p.label}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <button onClick={toggleVisibility}
                          style={{ padding: "5px 11px", background: detail.roster_visible_to_members ? "var(--color-positive)" : "var(--color-border)", color: detail.roster_visible_to_members ? "var(--color-bg)" : "#cbd5e1", border: "none", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                          Roster visible to members: {detail.roster_visible_to_members ? "ON" : "OFF"}
                        </button>
                        <button onClick={archive}
                          style={{ padding: "5px 11px", background: "transparent", color: "var(--color-destructive-text)", border: "1px solid #ef4444", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>
                          Archive group
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Lane plans (R-E) — hidden for solo groups per #17; Phase 6 lane_plans flag */}
                  {ff.lane_plans !== false && (detail.members || []).length >= 2 && (
                    <LanePlansPanel groupId={group.id} members={detail.members || []} isPrimary={isPrimary} onChanged={onChanged} />
                  )}

                  {/* Join tokens (R-F) — coach-side invite-code panel */}
                  {!group.archived && (
                    <JoinTokensPanel groupId={group.id} isPrimary={isPrimary} isGroupCoach={!!detail.viewer_role} />
                  )}

                  {/* Coach-mark-on-behalf (R-G, Flow N) — recent assignments */}
                  <GroupAssignmentsPanel groupId={group.id} isGroupCoach={!!detail.viewer_role} />
                </>
              )}
            </div>
          )}
        </div>
      );
    }
