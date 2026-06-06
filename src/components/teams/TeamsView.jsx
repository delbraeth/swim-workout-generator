// src/components/teams/TeamsView.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { csrfHeaders } from "../../lib/api.js";
import { EVENT_KINDS, eventKindEmoji } from "../../lib/eventKinds.js";
import { GroupRow } from "../groups/GroupRow.jsx";
import { TeamRosterTab } from "./TeamRosterTab.jsx";
import { TeamSettingsTab } from "./TeamSettingsTab.jsx";

    const { useState, useCallback, useEffect } = React;

    const TEAM_TYPE_LABELS = {
      high_school: "High School",
      summer:      "Summer",
      club:        "Club",
      masters:     "Masters",
    };
    const TEAM_TYPE_DESCRIPTIONS = {
      high_school: "FERPA-shape: minor protections, restricted disclosure, parental consent for under-18.",
      summer:      "Mixed-age seasonal program. Minor protections apply if under-18 members present.",
      club:        "Year-round mixed-age (USA Swimming pattern). Under-13 protections apply per member.",
      masters:     "Adults only (18+). Minimal compliance burden.",
    };

    export function TeamsView() {
      const [teams,       setTeams]       = React.useState(null);                 // null = loading
      const [selectedId,  setSelectedId]  = React.useState(null);
      const [detail,      setDetail]      = React.useState(null);                 // null = unloaded/loading
      const [creating,    setCreating]    = React.useState(false);
      const [createName,  setCreateName]  = React.useState("");
      const [createType,  setCreateType]  = React.useState("club");
      const [editingName, setEditingName] = React.useState(false);
      const [renameVal,   setRenameVal]   = React.useState("");
      const [addCoachSub, setAddCoachSub] = React.useState("");
      const [addCoachRole, setAddCoachRole] = React.useState("coach");           // R-J: role on add (coach / admin)
      const [coachPool,   setCoachPool]   = React.useState(null);                // null = unloaded
      // R-J: when remove fails with primary_on_groups, hold the conflict
      // info so the UI can prompt for per-group primary transfer.
      const [removeConflict, setRemoveConflict] = React.useState(null);          // { coachSub, groups: [...] }
      const [transferPlan,   setTransferPlan]   = React.useState({});            // { group_id: new_primary_sub }
      // Setforge rebrand 2026-05-20 — team detail tabs (REBRAND_SCOPE §8.2).
      // Members & Coaches / Groups / Events. Default = members.
      const [activeTab, setActiveTab] = React.useState("members");
      // R-C additions: groups in this team, team events, and managed-roster
      // (filtered to team) for the member-add picker inside each group.
      const [groups,        setGroups]        = React.useState(null);             // null = unloaded
      const [events,        setEvents]        = React.useState(null);
      const [managedInTeam, setManagedInTeam] = React.useState(null);
      const [creatingGroup, setCreatingGroup] = React.useState(false);
      const [newGroupName,  setNewGroupName]  = React.useState("");
      const [newGroupPool,  setNewGroupPool]  = React.useState("");
      const [creatingEvent, setCreatingEvent] = React.useState(false);
      const [newEventName,  setNewEventName]  = React.useState("");
      const [newEventDate,  setNewEventDate]  = React.useState("");
      const [newEventKind,  setNewEventKind]  = React.useState("meet");
      const [editingEventId, setEditingEventId] = React.useState(null);
      const [editEventName,  setEditEventName]  = React.useState("");
      const [editEventDate,  setEditEventDate]  = React.useState("");
      const [editEventKind,  setEditEventKind]  = React.useState("meet");
      // Meet-anchored taper (MEET_ANCHORED_TAPER_SCOPE §3.6): inline picker
      // appears when coach clicks 🎯 on an event row. anchoringEventId = ev.id
      // while the picker is open. Groups list fetched on open.
      const [anchoringEventId, setAnchoringEventId] = React.useState(null);
      const [anchorGroupsList, setAnchorGroupsList] = React.useState(null); // null while loading
      const [anchorTargetGroupId, setAnchorTargetGroupId] = React.useState("");
      const [anchorBusy, setAnchorBusy] = React.useState(false);
      // RSVP (Phase 5 #5 Slice B): inline coach tally panel per event.
      const [rsvpEventId, setRsvpEventId] = React.useState(null);
      const [rsvpData, setRsvpData]       = React.useState(null); // null=loading

      const openRsvp = React.useCallback(async (eventId) => {
        if (rsvpEventId === eventId) { setRsvpEventId(null); return; }
        setRsvpEventId(eventId); setRsvpData(null);
        try {
          const res = await fetch(`/api/rsvp/meet/${encodeURIComponent(eventId)}`, { cache: "no-store" });
          setRsvpData(res.ok ? await res.json() : { tally: {}, list: [] });
        } catch (_) { setRsvpData({ tally: {}, list: [] }); }
      }, [rsvpEventId]);

      const handleEventStatus = React.useCallback(async (ev, status) => {
        let note = null;
        if (status === "cancelled") { note = window.prompt("Reason (optional) — shown to swimmers:", ev.status_note || "") || null; }
        try {
          const res = await fetch(`/api/events/${encodeURIComponent(ev.id)}/status`, {
            method: "POST", headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({ status, note }),
          });
          if (res.ok && detail?.id) loadEvents(detail.id);
        } catch (_) {}
      }, [detail]);
      const [msg,         setMsg]         = React.useState(null);
      // Ownership transfers proposed TO this coach (accept/decline banner).
      const [incomingTransfers, setIncomingTransfers] = React.useState([]);
      const [incomingBusy, setIncomingBusy] = React.useState(null);   // teamId being acted on
      const loadIncomingTransfers = React.useCallback(async () => {
        try {
          const res = await fetch("/api/me/incoming-transfers", { cache: "no-store" });
          if (res.ok) setIncomingTransfers(await res.json());
        } catch (_) {}
      }, []);
      React.useEffect(() => { loadIncomingTransfers(); }, [loadIncomingTransfers]);
      const respondTransfer = async (teamId, action) => {
        if (!window.confirm(action === "accept" ? "Accept ownership of this team? Roles swap immediately and the previous owner's team-shared + public sets move to you." : "Decline this ownership transfer?")) return;
        setIncomingBusy(teamId); setMsg(null);
        try {
          const res = await fetch(`/api/teams/${teamId}/transfer-ownership/${action}`, { method: "POST", headers: csrfHeaders() });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
          await loadIncomingTransfers();
          await loadList();
          if (detail && String(detail.id) === String(teamId)) await loadDetail(teamId);
        } catch (e) { setMsg(`Transfer ${action} failed: ${e.message}`); }
        finally { setIncomingBusy(null); }
      };
      // Banner shown atop both list + detail views.
      const incomingBanner = (incomingTransfers && incomingTransfers.length > 0) ? (
        <div style={{ marginBottom: 16 }}>
          {incomingTransfers.map(t => (
            <div key={t.id} style={{ background: "#3b82f618", border: "1px solid var(--color-primary)", borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
              <div style={{ color: "var(--color-text)", fontSize: 13, fontWeight: 700 }}>🎯 You've been proposed as the new owner of {t.team_name}.</div>
              <div style={{ color: "var(--color-text-muted)", fontSize: 12, margin: "4px 0 10px" }}>
                Auto-applies {t.auto_complete_at ? new Date(t.auto_complete_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "in 30 days"} if you do nothing.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => respondTransfer(t.team_id, "accept")} disabled={incomingBusy === t.team_id}
                  style={{ padding: "6px 14px", background: "var(--color-positive)", color: "var(--color-bg)", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: incomingBusy === t.team_id ? "not-allowed" : "pointer" }}>
                  {incomingBusy === t.team_id ? "Working…" : "Accept now"}
                </button>
                <button onClick={() => respondTransfer(t.team_id, "decline")} disabled={incomingBusy === t.team_id}
                  style={{ padding: "6px 14px", background: "transparent", border: "1px solid var(--color-destructive)", color: "var(--color-destructive-text)", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: incomingBusy === t.team_id ? "not-allowed" : "pointer" }}>
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null;

      const loadGroups = React.useCallback(async (teamId) => {
        if (!teamId) { setGroups(null); return; }
        try {
          const res = await fetch(`/api/teams/${teamId}/groups`, { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setGroups(await res.json());
        } catch (err) { setGroups([]); }
      }, []);
      const loadEvents = React.useCallback(async (teamId) => {
        if (!teamId) { setEvents(null); return; }
        try {
          const res = await fetch(`/api/teams/${teamId}/events`, { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setEvents(await res.json());
        } catch (err) { setEvents([]); }
      }, []);
      const loadManagedInTeam = React.useCallback(async (teamId) => {
        if (!teamId) { setManagedInTeam(null); return; }
        try {
          const res = await fetch("/api/managed-swimmers", { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const all = await res.json();
          setManagedInTeam((Array.isArray(all) ? all : []).filter(s => s.team_id === teamId && !s.archived));
        } catch (err) { setManagedInTeam([]); }
      }, []);

      const loadList = React.useCallback(async () => {
        try {
          const res = await fetch("/api/teams", { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setTeams(await res.json());
        } catch (err) {
          setTeams([]);
          setMsg(`Error loading teams: ${err.message}`);
        }
      }, []);

      const loadDetail = React.useCallback(async (id) => {
        if (!id) { setDetail(null); return; }
        setDetail(null);
        try {
          const res = await fetch(`/api/teams/${id}`, { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const d = await res.json();
          setDetail(d);
          setRenameVal(d.name);
        } catch (err) {
          setMsg(`Error loading team: ${err.message}`);
        }
      }, []);

      // Composite team-detail loader — one GET seeds detail + groups + events
      // (was 3 parallel fetches). Cuts the team-select burst that, with the
      // managed-roster fetch, tripped 429s. Per-section loaders above stay for
      // post-mutation refresh (onChanged → loadGroups, create → loadEvents).
      const loadTeamDetail = React.useCallback(async (id) => {
        if (!id) { setDetail(null); setGroups(null); setEvents(null); return; }
        setDetail(null); setGroups(null); setEvents(null);
        try {
          const res = await fetch(`/api/teams/${id}/detail`, { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const d = await res.json();
          setDetail(d.team);
          setRenameVal(d.team.name);
          setGroups(Array.isArray(d.groups) ? d.groups : []);
          setEvents(Array.isArray(d.events) ? d.events : []);
        } catch (err) {
          setMsg(`Error loading team: ${err.message}`);
          setGroups([]); setEvents([]);
        }
      }, []);

      React.useEffect(() => { loadList(); }, [loadList]);
      React.useEffect(() => {
        loadTeamDetail(selectedId);
        loadManagedInTeam(selectedId);
      }, [selectedId, loadTeamDetail, loadManagedInTeam]);

      // Load the coach pool on first detail-open. Reused across visits to the
      // same team session; if a coach is added/removed they'll appear/disappear
      // on the next page-load (acceptable freshness for a picker).
      React.useEffect(() => {
        if (!selectedId || coachPool !== null) return;
        fetch("/api/coaches", { cache: "no-store" })
          .then(r => r.ok ? r.json() : [])
          .then(setCoachPool)
          .catch(() => setCoachPool([]));
      }, [selectedId, coachPool]);

      const handleCreate = async () => {
        if (!createName.trim()) { setMsg("Name required"); return; }
        try {
          const res = await fetch("/api/teams", {
            method:  "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({ name: createName.trim(), team_type: createType }),
          });
          const j = await res.json();
          if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
          setMsg(null);
          setCreateName(""); setCreateType("club"); setCreating(false);
          await loadList();
          setSelectedId(j.id);
        } catch (err) {
          setMsg(`Error: ${err.message}`);
        }
      };

      const handleRename = async () => {
        if (!renameVal.trim() || renameVal === detail?.name) { setEditingName(false); return; }
        try {
          const res = await fetch(`/api/teams/${detail.id}`, {
            method:  "PATCH",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({ name: renameVal.trim() }),
          });
          const j = await res.json();
          if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
          setEditingName(false);
          await loadList();
          await loadDetail(detail.id);
        } catch (err) {
          setMsg(`Error: ${err.message}`);
        }
      };

      const handleToggleArchive = async () => {
        if (!detail) return;
        const next = !detail.archived;
        const verb = next ? "archive" : "unarchive";
        if (!window.confirm(`${verb.charAt(0).toUpperCase() + verb.slice(1)} team "${detail.name}"?`)) return;
        try {
          const res = await fetch(`/api/teams/${detail.id}/archive`, {
            method:  "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({ archived: next }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          await loadList();
          await loadDetail(detail.id);
        } catch (err) {
          setMsg(`Error: ${err.message}`);
        }
      };

      const handleAddCoach = async () => {
        if (!addCoachSub.trim()) { setMsg("coach_sub required"); return; }
        try {
          const res = await fetch(`/api/teams/${detail.id}/coaches`, {
            method:  "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({ coach_sub: addCoachSub.trim(), role: addCoachRole }),
          });
          const j = await res.json();
          if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
          setAddCoachSub("");
          setAddCoachRole("coach");
          setMsg(null);
          await loadDetail(detail.id);
        } catch (err) {
          setMsg(`Error adding coach: ${err.message}`);
        }
      };

      // R-J: promote/demote between admin and coach.
      const handleRoleChange = async (sub, newRole) => {
        try {
          const res = await fetch(`/api/teams/${detail.id}/coaches/${encodeURIComponent(sub)}`, {
            method:  "PATCH",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({ role: newRole }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          await loadDetail(detail.id);
        } catch (err) {
          setMsg(`Error changing role: ${err.message}`);
        }
      };

      const handleRemoveCoach = async (sub) => {
        if (!window.confirm("Remove this coach from the team?")) return;
        try {
          const res = await fetch(`/api/teams/${detail.id}/coaches/${encodeURIComponent(sub)}`, {
            method:  "DELETE",
            headers: { ...csrfHeaders() },
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            // R-J: surface primary_on_groups as a transfer-modal prompt.
            if (j.reason === "primary_on_groups") {
              setRemoveConflict({ coachSub: sub, groups: j.groups || [] });
              setTransferPlan({});
              return;
            }
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          await loadDetail(detail.id);
        } catch (err) {
          setMsg(`Error: ${err.message}`);
        }
      };

      // R-J: execute the per-group primary transfers then retry the remove.
      const executeRemoveWithTransfers = async () => {
        const conflict = removeConflict;
        if (!conflict) return;
        // Validate every conflicting group has a transfer destination set.
        const missing = conflict.groups.filter(g => !transferPlan[g.id]);
        if (missing.length > 0) {
          setMsg(`Pick a new primary for: ${missing.map(g => g.name).join(", ")}`);
          return;
        }
        try {
          for (const g of conflict.groups) {
            const res = await fetch(`/api/groups/${g.id}/primary-coach`, {
              method:  "POST",
              headers: { "Content-Type": "application/json", ...csrfHeaders() },
              body:    JSON.stringify({ new_primary_sub: transferPlan[g.id] }),
            });
            if (!res.ok) {
              const j = await res.json().catch(() => ({}));
              throw new Error(`Transfer for "${g.name}" failed: ${j.error || `HTTP ${res.status}`}`);
            }
          }
          // Retry the original removal.
          const res = await fetch(`/api/teams/${detail.id}/coaches/${encodeURIComponent(conflict.coachSub)}`, {
            method:  "DELETE",
            headers: { ...csrfHeaders() },
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          setRemoveConflict(null);
          setTransferPlan({});
          setMsg(null);
          await loadDetail(detail.id);
        } catch (err) {
          setMsg(`Error: ${err.message}`);
        }
      };

      // R-C: create group within this team
      const handleCreateGroup = async () => {
        if (!newGroupName.trim()) { setMsg("Group name required"); return; }
        try {
          const res = await fetch(`/api/teams/${detail.id}/groups`, {
            method:  "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({ name: newGroupName.trim(), pool_mode_default: newGroupPool || null }),
          });
          const j = await res.json();
          if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
          setNewGroupName(""); setNewGroupPool(""); setCreatingGroup(false); setMsg(null);
          await loadGroups(detail.id);
        } catch (err) { setMsg(`Error creating group: ${err.message}`); }
      };

      // R-C: create team event
      const handleCreateEvent = async () => {
        if (!newEventName.trim()) { setMsg("Event name required"); return; }
        if (!newEventDate)        { setMsg("Event date required"); return; }
        try {
          const res = await fetch(`/api/teams/${detail.id}/events`, {
            method:  "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({ name: newEventName.trim(), date: newEventDate, kind: newEventKind }),
          });
          const j = await res.json();
          if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
          setNewEventName(""); setNewEventDate(""); setNewEventKind("meet"); setCreatingEvent(false); setMsg(null);
          await loadEvents(detail.id);
        } catch (err) { setMsg(`Error creating event: ${err.message}`); }
      };

      // R-C polish: edit team event (inline)
      const startEditEvent = (ev) => {
        setEditingEventId(ev.id);
        setEditEventName(ev.name);
        setEditEventDate(ev.date);
        setEditEventKind(ev.kind || "meet");
        setMsg(null);
      };
      const cancelEditEvent = () => {
        setEditingEventId(null);
        setEditEventName("");
        setEditEventDate("");
        setEditEventKind("meet");
      };
      const handleSaveEditEvent = async () => {
        if (!editEventName.trim()) { setMsg("Event name required"); return; }
        if (!editEventDate)        { setMsg("Event date required"); return; }
        try {
          const res = await fetch(`/api/events/${editingEventId}`, {
            method:  "PATCH",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({ name: editEventName.trim(), date: editEventDate, kind: editEventKind }),
          });
          const j = await res.json();
          if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
          cancelEditEvent();
          setMsg(null);
          await loadEvents(detail.id);
        } catch (err) { setMsg(`Error saving event: ${err.message}`); }
      };

      // R-C: delete team event
      const handleDeleteEvent = async (eventId) => {
        if (!window.confirm("Delete this event?")) return;
        try {
          const res = await fetch(`/api/events/${eventId}`, {
            method:  "DELETE",
            headers: { ...csrfHeaders() },
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          await loadEvents(detail.id);
        } catch (err) { setMsg(`Error: ${err.message}`); }
      };

      // Open the inline anchor-picker for an event. Fetches the team's
      // groups so the coach can pick which group inherits this event as
      // its training-phase anchor. Per MEET_ANCHORED_TAPER_SCOPE §3.6.
      const openAnchorPicker = async (eventId) => {
        setAnchoringEventId(eventId);
        setAnchorGroupsList(null);
        setAnchorTargetGroupId("");
        try {
          const res = await fetch(`/api/teams/${detail.id}/groups`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const groups = await res.json();
          const live = (Array.isArray(groups) ? groups : []).filter(g => !g.archived);
          setAnchorGroupsList(live);
          if (live.length === 1) setAnchorTargetGroupId(String(live[0].id));
        } catch (err) {
          setMsg(`Error loading groups: ${err.message}`);
          setAnchoringEventId(null);
        }
      };

      const cancelAnchorPicker = () => {
        setAnchoringEventId(null);
        setAnchorGroupsList(null);
        setAnchorTargetGroupId("");
      };

      const handleSetAnchor = async () => {
        if (!anchoringEventId || !anchorTargetGroupId) return;
        setAnchorBusy(true);
        try {
          // event_id is a VARCHAR string (ev_xxx) on the server — pass through
          // unchanged. The initial implementation Number()-converted, which
          // turned the string into NaN and the server rejected the body.
          const res = await fetch(`/api/groups/${anchorTargetGroupId}/anchor`, {
            method:  "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({ event_id: anchoringEventId }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          const data = await res.json();
          const groupName = anchorGroupsList?.find(g => String(g.id) === String(anchorTargetGroupId))?.name || "group";
          setMsg(`🎯 Anchor set for ${groupName} (${data.anchor?.weeks_out ?? "?"} wks out, suggested phase: ${data.anchor?.suggested_phase || "—"})`);
          cancelAnchorPicker();
        } catch (err) {
          setMsg(`Error: ${err.message}`);
        } finally {
          setAnchorBusy(false);
        }
      };

      // ── Render ──────────────────────────────────────────────────────
      const isOwner = detail?.viewer_role === "owner";

      // Detail panel
      if (selectedId && detail) {
        return (
          <div>
            {incomingBanner}
            <button onClick={() => { setSelectedId(null); setDetail(null); setEditingName(false); setMsg(null); }}
              style={{ marginBottom: 12, padding: "5px 11px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              ← All teams
            </button>
            <div className="card" style={{ borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                {editingName ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1 }}>
                    <input value={renameVal} onChange={e => setRenameVal(e.target.value)} autoFocus
                      onKeyDown={e => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") { setEditingName(false); setRenameVal(detail.name); } }}
                      style={{ flex: 1, padding: "6px 10px", fontSize: 16, fontWeight: 700, background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 6 }} />
                    <button onClick={handleRename} style={{ padding: "5px 11px", background: "var(--color-positive)", color: "var(--color-bg)", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Save</button>
                    <button onClick={() => { setEditingName(false); setRenameVal(detail.name); }} style={{ padding: "5px 11px", background: "var(--color-border)", color: "#cbd5e1", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>Cancel</button>
                  </div>
                ) : (
                  <h2 style={{ color: "var(--color-text)", margin: 0, fontSize: 20 }}>
                    {detail.name}
                    {detail.archived && <span style={{ marginLeft: 10, fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "#64748b22", border: "1px solid #64748b", color: "var(--color-text-muted)" }}>archived</span>}
                    {isOwner && (
                      <button onClick={() => setEditingName(true)} title="Rename"
                        style={{ marginLeft: 10, padding: "3px 8px", background: "transparent", border: "1px solid var(--color-border)", borderRadius: 6, color: "var(--color-text-dim)", fontSize: 11, cursor: "pointer" }}>✎</button>
                    )}
                  </h2>
                )}
                <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: "#3b82f622", border: "1px solid var(--color-primary)", color: "var(--color-primary-text)", fontWeight: 700 }}>
                  {TEAM_TYPE_LABELS[detail.team_type] || detail.team_type}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
                {TEAM_TYPE_DESCRIPTIONS[detail.team_type]}
              </div>
              <div style={{ fontSize: 11, color: "var(--color-text-dim)", marginTop: 8 }}>
                Your role in this team: <span style={{ color: "#cbd5e1", fontWeight: 700 }}>{detail.viewer_role}</span>
                <span style={{ marginLeft: 10 }}>· Team ID: <code style={{ background: "var(--color-bg)", padding: "1px 5px", borderRadius: 3 }}>{detail.id}</code></span>
              </div>
              {isOwner && (
                <div style={{ marginTop: 12 }}>
                  <button onClick={handleToggleArchive}
                    style={{ padding: "5px 11px", background: detail.archived ? "var(--color-positive)" : "var(--color-text-dim)", color: "var(--color-bg)", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    {detail.archived ? "Unarchive team" : "Archive team"}
                  </button>
                </div>
              )}
            </div>

            {/* Setforge rebrand 2026-05-20 — team detail tab nav.
                3 tabs: Members & Coaches / Groups / Events. */}
            <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--color-border)", marginBottom: 16 }}>
              {[
                { id: "members",  label: "Members & Coaches", count: (detail.coaches || []).length },
                { id: "groups",   label: "Groups",            count: (groups || []).length },
                { id: "roster",   label: "🏊 Roster",         count: 0 },
                { id: "events",   label: "Events",            count: (events || []).length },
                { id: "settings", label: "⚙ Settings",        count: 0 },
              ].map(t => {
                const active = activeTab === t.id;
                return (
                  <button key={t.id} onClick={() => setActiveTab(t.id)}
                    style={{
                      padding: "9px 14px", border: "none", borderBottom: active ? "2px solid var(--color-primary)" : "2px solid transparent",
                      background: "transparent", color: active ? "var(--color-text)" : "var(--color-text-muted)",
                      fontSize: 13, fontWeight: active ? 700 : 600, cursor: "pointer",
                      marginBottom: -1,
                    }}>
                    {t.label}
                    {t.count > 0 && (
                      <span style={{ marginLeft: 6, fontSize: 11, color: active ? "var(--color-text-muted)" : "var(--color-text-dim)", fontWeight: 500 }}>
                        ({t.count})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {activeTab === "members" && (
            <div className="card" style={{ borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <h3 style={{ color: "var(--color-text)", marginTop: 0, fontSize: 15 }}>Coaches ({detail.coaches?.length || 0})</h3>
              {(detail.coaches || []).map(c => (
                <div key={c.coach_sub} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--color-border)" }}>
                  <div>
                    <span style={{ color: "var(--color-text)", fontSize: 13, fontWeight: 600 }}>
                      {c.display_name || c.initials || "(no name)"}
                    </span>
                    {(() => {
                      // R-J: role pill colored by tier. Owner = purple,
                      // Admin = blue, Coach = slate.
                      const colors = c.role === "owner" ? { bg: "#3b82f622", border: "var(--color-primary)", color: "var(--color-primary-text)" }
                                  : c.role === "admin"  ? { bg: "#3b82f622", border: "var(--color-primary)", color: "var(--color-primary-text)" }
                                  :                        { bg: "#33415522", border: "var(--color-border-strong)", color: "var(--color-text-muted)" };
                      return (
                        <span style={{ marginLeft: 8, fontSize: 10, padding: "1px 6px", borderRadius: 4, background: colors.bg, border: `1px solid ${colors.border}`, color: colors.color, fontWeight: 700 }}>{c.role}</span>
                      );
                    })()}
                    {(() => {
                      // MAAP cert rollup (eval 2026-06-06 #3): SafeSport status badge.
                      let label, col;
                      if (!c.safesport_on) { label = "no SafeSport"; col = "var(--color-text-dim)"; }
                      else if (c.safesport_expires) {
                        const days = Math.round((new Date(c.safesport_expires + "T00:00:00") - new Date().setHours(0,0,0,0)) / 86400000);
                        if (days < 0)       { label = "SafeSport expired"; col = "var(--color-destructive-text)"; }
                        else if (days <= 30){ label = `SafeSport ${days}d`; col = "var(--color-warn)"; }
                        else                { label = "SafeSport ✓"; col = "var(--color-positive)"; }
                      } else { label = "SafeSport ✓"; col = "var(--color-positive)"; }
                      return <span title="SafeSport certification status" style={{ marginLeft: 6, fontSize: 10, padding: "1px 6px", borderRadius: 4, border: `1px solid ${col}`, color: col, fontWeight: 700 }}>🛡 {label}</span>;
                    })()}
                    <div style={{ fontSize: 10, color: "var(--color-text-dim)", fontFamily: "monospace", marginTop: 2 }}>{c.coach_sub}</div>
                  </div>
                  {isOwner && c.role !== "owner" && (
                    <div style={{ display: "flex", gap: 4 }}>
                      {/* R-J: promote/demote between admin and coach */}
                      {c.role === "coach" && (
                        <button onClick={() => handleRoleChange(c.coach_sub, "admin")}
                          title="Promote to admin (manage team coaches + archives)"
                          style={{ padding: "3px 8px", background: "transparent", border: "1px solid var(--color-primary)", borderRadius: 6, color: "var(--color-primary-text)", fontSize: 11, cursor: "pointer" }}>
                          ↑ Admin
                        </button>
                      )}
                      {c.role === "admin" && (
                        <button onClick={() => handleRoleChange(c.coach_sub, "coach")}
                          title="Demote to coach (no team-management rights)"
                          style={{ padding: "3px 8px", background: "transparent", border: "1px solid #64748b", borderRadius: 6, color: "var(--color-text-muted)", fontSize: 11, cursor: "pointer" }}>
                          ↓ Coach
                        </button>
                      )}
                      <button onClick={() => handleRemoveCoach(c.coach_sub)}
                        style={{ padding: "3px 8px", background: "transparent", border: "1px solid #ef4444", borderRadius: 6, color: "var(--color-destructive-text)", fontSize: 11, cursor: "pointer" }}>
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {isOwner && !detail.archived && (() => {
                // Filter out coaches already active on this team so the picker
                // only shows valid candidates.
                const activeSubs = new Set((detail.coaches || []).map(c => c.coach_sub));
                const candidates = (coachPool || []).filter(c => !activeSubs.has(c.sub));
                return (
                  <div style={{ marginTop: 12, padding: "10px 0 0", borderTop: "1px solid var(--color-border)" }}>
                    <div style={{ fontSize: 11, color: "var(--color-text-dim)", marginBottom: 6 }}>Add a coach:</div>
                    {coachPool === null ? (
                      <div style={{ fontSize: 12, color: "var(--color-text-dim)", fontStyle: "italic" }}>Loading coach list…</div>
                    ) : candidates.length === 0 ? (
                      <div style={{ fontSize: 12, color: "var(--color-text-dim)", fontStyle: "italic" }}>
                        No other coaches available to add. {(coachPool.length === 0) ? "Grant the is_coach flag to a user via Admin → Users first." : "All eligible coaches are already on this team."}
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <select value={addCoachSub} onChange={e => setAddCoachSub(e.target.value)}
                          style={{ flex: 2, minWidth: 180, padding: "6px 10px", fontSize: 13, background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 6, cursor: "pointer" }}>
                          <option value="">— pick a coach —</option>
                          {candidates.map(c => (
                            <option key={c.sub} value={c.sub}>
                              {c.display_name || "(no name)"}
                              {c.initials ? ` (${c.initials})` : ""}
                              {` · …${c.sub.slice(-6)}`}
                            </option>
                          ))}
                        </select>
                        {/* R-J: role on add — coach (default) or admin */}
                        <select value={addCoachRole} onChange={e => setAddCoachRole(e.target.value)}
                          style={{ padding: "6px 10px", fontSize: 13, background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 6, cursor: "pointer" }}>
                          <option value="coach">Coach</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button onClick={handleAddCoach} disabled={!addCoachSub}
                          style={{ padding: "6px 14px", background: addCoachSub ? "var(--color-primary)" : "var(--color-border-strong)", color: addCoachSub ? "var(--color-bg)" : "var(--color-text-muted)", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: addCoachSub ? "pointer" : "not-allowed" }}>
                          Add
                        </button>
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: "var(--color-text-dim)", marginTop: 4 }}>
                      Only users with the <code>is_coach</code> flag (or admin) appear. <b>Admin</b> can manage team coaches + archives; <b>Coach</b> can coach groups but not manage the team.
                    </div>
                  </div>
                );
              })()}
            </div>
            )}

            {activeTab === "groups" && (
            <div style={{ background: "var(--color-card)", border: "1px solid var(--color-warn)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h3 style={{ color: "var(--color-warn)", marginTop: 0, marginBottom: 0, fontSize: 15 }}>🏊‍♀️ Groups ({(groups || []).length})</h3>
                {(detail.viewer_role === "owner" || detail.viewer_role === "admin") && !detail.archived && (
                  <button onClick={() => setCreatingGroup(c => !c)}
                    style={{ padding: "5px 11px", background: creatingGroup ? "var(--color-border)" : "var(--color-warn)", color: creatingGroup ? "#cbd5e1" : "var(--color-bg)", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    {creatingGroup ? "Cancel" : "+ New group"}
                  </button>
                )}
              </div>
              {creatingGroup && (
                <div style={{ background: "var(--color-bg)", border: "1px solid var(--color-warn)", borderRadius: 6, padding: 10, marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: "var(--color-text-muted)", display: "block", marginBottom: 3 }}>Group name</label>
                  <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                    placeholder="e.g. Tuesday Sprint"
                    style={{ width: "100%", padding: "5px 9px", fontSize: 13, background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 5, marginBottom: 8 }} />
                  <label style={{ fontSize: 11, color: "var(--color-text-muted)", display: "block", marginBottom: 3 }}>Default pool mode (optional)</label>
                  <select value={newGroupPool} onChange={e => setNewGroupPool(e.target.value)}
                    style={{ width: "100%", padding: "5px 9px", fontSize: 13, background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 5, marginBottom: 10 }}>
                    <option value="">— inherit / unspecified —</option>
                    <option value="25y">25 yd (SCY)</option>
                    <option value="25m">25 m (SCM)</option>
                    <option value="50m">50 m (LCM)</option>
                  </select>
                  <button onClick={handleCreateGroup}
                    style={{ padding: "6px 14px", background: "var(--color-warn)", color: "var(--color-bg)", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    Create group
                  </button>
                </div>
              )}
              {groups === null ? (
                <div style={{ color: "var(--color-text-dim)", fontSize: 12, fontStyle: "italic" }}>Loading…</div>
              ) : groups.length === 0 ? (
                <div style={{ color: "var(--color-text-dim)", fontSize: 12, fontStyle: "italic" }}>No groups yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {groups.map(g => (
                    <GroupRow key={g.id} group={g}
                      coachPool={coachPool || []}
                      managedInTeam={managedInTeam || []}
                      onChanged={() => loadGroups(detail.id)} />
                  ))}
                </div>
              )}
            </div>
            )}

            {activeTab === "roster" && (
              <TeamRosterTab teamId={detail.id} />
            )}

            {activeTab === "events" && (
            <div style={{ background: "var(--color-card)", border: "1px solid var(--color-warn)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h3 style={{ color: "var(--color-warn)", marginTop: 0, marginBottom: 0, fontSize: 15 }}>📅 Events ({(events || []).length})</h3>
                {detail.viewer_role && !detail.archived && (
                  <button onClick={() => setCreatingEvent(c => !c)}
                    style={{ padding: "5px 11px", background: creatingEvent ? "var(--color-border)" : "var(--color-warn)", color: creatingEvent ? "#cbd5e1" : "var(--color-bg)", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    {creatingEvent ? "Cancel" : "+ New event"}
                  </button>
                )}
              </div>
              {creatingEvent && (
                <div style={{ background: "var(--color-bg)", border: "1px solid var(--color-warn)", borderRadius: 6, padding: 10, marginBottom: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, color: "var(--color-text-muted)", display: "block", marginBottom: 3 }}>Event name</label>
                      <input value={newEventName} onChange={e => setNewEventName(e.target.value)}
                        placeholder="e.g. Cincinnati Invite"
                        style={{ width: "100%", padding: "5px 9px", fontSize: 13, background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 5 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "var(--color-text-muted)", display: "block", marginBottom: 3 }}>Type</label>
                      <select value={newEventKind} onChange={e => setNewEventKind(e.target.value)}
                        style={{ width: "100%", padding: "5px 9px", fontSize: 13, background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 5 }}>
                        {EVENT_KINDS.map(k => <option key={k.value} value={k.value}>{k.emoji} {k.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "var(--color-text-muted)", display: "block", marginBottom: 3 }}>Date</label>
                      <input type="date" value={newEventDate} onChange={e => setNewEventDate(e.target.value)}
                        style={{ width: "100%", padding: "5px 9px", fontSize: 13, background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 5 }} />
                    </div>
                  </div>
                  <button onClick={handleCreateEvent}
                    style={{ padding: "6px 14px", background: "var(--color-warn)", color: "var(--color-bg)", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    Create event
                  </button>
                </div>
              )}
              {events === null ? (
                <div style={{ color: "var(--color-text-dim)", fontSize: 12, fontStyle: "italic" }}>Loading…</div>
              ) : events.length === 0 ? (
                <div style={{ color: "var(--color-text-dim)", fontSize: 12, fontStyle: "italic" }}>No events yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {events.map(ev => {
                    const isPast    = new Date(ev.date) < new Date(new Date().toDateString());
                    const isEditing = editingEventId === ev.id;
                    if (isEditing) {
                      return (
                        <div key={ev.id} style={{ padding: "8px 10px", background: "var(--color-bg)", border: "1px solid var(--color-warn)", borderRadius: 6 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                            <input value={editEventName} onChange={e => setEditEventName(e.target.value)} placeholder="Event name"
                              onKeyDown={e => { if (e.key === "Enter") handleSaveEditEvent(); if (e.key === "Escape") cancelEditEvent(); }}
                              autoFocus
                              style={{ width: "100%", padding: "5px 9px", fontSize: 13, background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 5 }} />
                            <select value={editEventKind} onChange={e => setEditEventKind(e.target.value)}
                              style={{ width: "100%", padding: "5px 9px", fontSize: 13, background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 5 }}>
                              {EVENT_KINDS.map(k => <option key={k.value} value={k.value}>{k.emoji} {k.label}</option>)}
                            </select>
                            <input type="date" value={editEventDate} onChange={e => setEditEventDate(e.target.value)}
                              style={{ width: "100%", padding: "5px 9px", fontSize: 13, background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 5 }} />
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={handleSaveEditEvent}
                              style={{ padding: "5px 11px", background: "var(--color-positive)", color: "var(--color-bg)", border: "none", borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Save</button>
                            <button onClick={cancelEditEvent}
                              style={{ padding: "5px 11px", background: "var(--color-border)", color: "#cbd5e1", border: "none", borderRadius: 5, fontSize: 12, cursor: "pointer" }}>Cancel</button>
                          </div>
                        </div>
                      );
                    }
                    const isAnchoring = anchoringEventId === ev.id;
                    return (
                      <div key={ev.id}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 6, opacity: isPast ? 0.6 : 1 }}>
                          <div>
                            <span style={{ marginRight: 6 }} title={ev.kind || "meet"}>{eventKindEmoji(ev.kind)}</span>
                            <span style={{ color: "var(--color-text)", fontWeight: 700, fontSize: 13, textDecoration: ev.status === "cancelled" ? "line-through" : "none" }}>{ev.name}</span>
                            <span style={{ marginLeft: 10, color: "var(--color-text-muted)", fontSize: 12 }}>{ev.date}</span>
                            {isPast && <span style={{ marginLeft: 8, fontSize: 10, color: "var(--color-text-dim)", fontStyle: "italic" }}>(past)</span>}
                            {ev.status === "cancelled" && <span title={ev.status_note || ""} style={{ marginLeft: 8, fontSize: 10, padding: "1px 6px", borderRadius: 3, background: "rgba(239,68,68,0.15)", color: "var(--color-destructive-text)", fontWeight: 700 }}>CANCELLED{ev.status_note ? ` — ${ev.status_note}` : ""}</span>}
                          </div>
                          {detail.viewer_role && (
                            <div style={{ display: "flex", gap: 6 }}>
                              {(ev.kind || "meet") === "meet" && (
                                <button onClick={() => openRsvp(ev.id)}
                                  title="Expected attendance (RSVP tally)"
                                  style={{ padding: "3px 9px", background: "transparent", color: "var(--color-primary-text)", border: "1px solid var(--color-border-strong)", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>
                                  📋 RSVP
                                </button>
                              )}
                              {!isPast && (ev.kind || "meet") === "meet" && (
                                <button onClick={() => openAnchorPicker(ev.id)}
                                  title="Set as training-phase anchor for a group (meets only)"
                                  style={{ padding: "3px 9px", background: "transparent", color: "var(--color-warn)", border: "1px solid var(--color-warn)", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>
                                  🎯 Anchor
                                </button>
                              )}
                              {!isPast && (
                                <button onClick={() => handleEventStatus(ev, ev.status === "cancelled" ? "scheduled" : "cancelled")}
                                  title={ev.status === "cancelled" ? "Restore this event" : "Cancel this event (freezes RSVP, shows CANCELLED)"}
                                  style={{ padding: "3px 9px", background: "transparent", color: ev.status === "cancelled" ? "var(--color-positive)" : "var(--color-warn)", border: `1px solid ${ev.status === "cancelled" ? "var(--color-positive)" : "var(--color-warn)"}`, borderRadius: 5, fontSize: 11, cursor: "pointer" }}>
                                  {ev.status === "cancelled" ? "Restore" : "Cancel"}
                                </button>
                              )}
                              <button onClick={() => startEditEvent(ev)}
                                style={{ padding: "3px 9px", background: "transparent", color: "var(--color-primary-text)", border: "1px solid var(--color-primary)", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>
                                Edit
                              </button>
                              <button onClick={() => handleDeleteEvent(ev.id)}
                                style={{ padding: "3px 9px", background: "transparent", color: "var(--color-destructive-text)", border: "1px solid #ef4444", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                        {rsvpEventId === ev.id && (
                          <div style={{ marginTop: 6, padding: "10px 12px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 6 }}>
                            {rsvpData === null ? (
                              <div style={{ fontSize: 12, color: "var(--color-text-dim)" }}>Loading RSVPs…</div>
                            ) : (
                              <>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text)", marginBottom: 6 }}>
                                  Expected attendance — ✅ {rsvpData.tally?.going || 0} going · 🤔 {rsvpData.tally?.maybe || 0} maybe · ❌ {rsvpData.tally?.out || 0} out
                                </div>
                                {(rsvpData.list || []).length === 0 ? (
                                  <div style={{ fontSize: 12, color: "var(--color-text-dim)", fontStyle: "italic" }}>No responses yet.</div>
                                ) : (
                                  <div style={{ display: "grid", gap: 2 }}>
                                    {rsvpData.list.map((p, i) => (
                                      <div key={i} style={{ fontSize: 12, color: "var(--color-text-muted)", display: "flex", justifyContent: "space-between" }}>
                                        <span>{p.name}</span>
                                        <span>{p.status === "going" ? "✅ going" : p.status === "maybe" ? "🤔 maybe" : p.status === "out" ? "❌ out" : "—"}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                        {isAnchoring && (
                          <div style={{ marginTop: 6, padding: "10px 12px", background: "var(--color-bg)", border: "1px solid var(--color-warn)", borderRadius: 6 }}>
                            <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 8 }}>
                              Set <strong style={{ color: "var(--color-text)" }}>{ev.name}</strong> as anchor for which group? Group's Training Phase will auto-suggest base/build/peak/taper from weeks out. Replacing an existing anchor clears the prior one.
                            </div>
                            {anchorGroupsList === null ? (
                              <div style={{ fontSize: 12, color: "var(--color-text-dim)", fontStyle: "italic" }}>Loading groups…</div>
                            ) : anchorGroupsList.length === 0 ? (
                              <div style={{ fontSize: 12, color: "var(--color-text-dim)", fontStyle: "italic" }}>This team has no active groups. Create a group first.</div>
                            ) : (
                              <>
                                <select value={anchorTargetGroupId} onChange={e => setAnchorTargetGroupId(e.target.value)}
                                  style={{ padding: "5px 9px", fontSize: 13, background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 5, marginRight: 8, minWidth: 200 }}>
                                  <option value="">— pick a group —</option>
                                  {anchorGroupsList.map(g => (
                                    <option key={g.id} value={g.id}>{g.name}</option>
                                  ))}
                                </select>
                                <button onClick={handleSetAnchor} disabled={!anchorTargetGroupId || anchorBusy}
                                  style={{ padding: "5px 12px", background: (!anchorTargetGroupId || anchorBusy) ? "var(--color-border)" : "var(--color-warn)", color: (!anchorTargetGroupId || anchorBusy) ? "#cbd5e1" : "var(--color-bg)", border: "none", borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: (!anchorTargetGroupId || anchorBusy) ? "not-allowed" : "pointer", marginRight: 6 }}>
                                  {anchorBusy ? "Setting…" : "Set anchor"}
                                </button>
                                <button onClick={cancelAnchorPicker} disabled={anchorBusy}
                                  style={{ padding: "5px 11px", background: "var(--color-border)", color: "#cbd5e1", border: "none", borderRadius: 5, fontSize: 12, cursor: anchorBusy ? "not-allowed" : "pointer" }}>
                                  Cancel
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            )}

            {activeTab === "settings" && (
              <TeamSettingsTab
                teamId={detail.id}
                viewerRole={detail.viewer_role}
                archived={!!detail.archived}
              />
            )}

            {msg && <div style={{ color: "#fca5a5", fontSize: 12, padding: "8px 0" }}>{msg}</div>}
          </div>
        );
      }

      // List view
      return (
        <div>
          {incomingBanner}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ color: "var(--color-text)", margin: 0 }}>👥 Teams</h2>
            <button onClick={() => setCreating(c => !c)}
              style={{ padding: "6px 14px", background: creating ? "var(--color-border)" : "var(--color-positive)", color: creating ? "#cbd5e1" : "var(--color-bg)", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {creating ? "Cancel" : "+ New team"}
            </button>
          </div>

          {creating && (
            <div style={{ background: "var(--color-card)", border: "1px solid #22c55e", borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <h3 style={{ color: "var(--color-text)", marginTop: 0, fontSize: 14 }}>Create team</h3>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "block", fontSize: 11, color: "var(--color-text-muted)", marginBottom: 4 }}>Name</label>
                <input value={createName} onChange={e => setCreateName(e.target.value)} placeholder="e.g. Cincinnati Masters"
                  style={{ width: "100%", padding: "6px 10px", fontSize: 13, background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 6 }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 11, color: "var(--color-text-muted)", marginBottom: 4 }}>Type</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {Object.keys(TEAM_TYPE_LABELS).map(t => (
                    <button key={t} onClick={() => setCreateType(t)}
                      className="pill"
                      style={{ border: `1px solid ${createType === t ? "var(--color-primary)" : "var(--color-border)"}`, background: createType === t ? "#3b82f622" : "transparent", color: createType === t ? "var(--color-primary)" : "var(--color-text-muted)", fontSize: 12, cursor: "pointer" }}>
                      {TEAM_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: "var(--color-text-dim)", marginTop: 6, lineHeight: 1.5 }}>
                  {TEAM_TYPE_DESCRIPTIONS[createType]}
                </div>
              </div>
              <button onClick={handleCreate}
                style={{ padding: "7px 16px", background: "var(--color-positive)", color: "var(--color-bg)", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Create
              </button>
            </div>
          )}

          {msg && <div style={{ color: "#fca5a5", fontSize: 12, marginBottom: 10 }}>{msg}</div>}

          {/* R-J: per-group primary-transfer modal. Shows when removing a
              coach who's still primary on at least one group. Each group
              needs a destination; once all are picked, the modal runs the
              transfers in sequence then retries the remove. */}
          {removeConflict && detail && (() => {
            // Eligible new primaries: active team coaches excluding the
            // coach being removed.
            const eligible = (detail.coaches || []).filter(c =>
              c.coach_sub !== removeConflict.coachSub
            );
            return (
              <div onClick={() => { setRemoveConflict(null); setTransferPlan({}); }}
                className="modal-overlay" style={{ padding: 20 }}>
                <div onClick={(e) => e.stopPropagation()}
                  style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 12, padding: 22, maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
                  <div style={{ color: "var(--color-warn)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>Coach removal blocked</div>
                  <div style={{ color: "var(--color-text)", fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Transfer primary first</div>
                  <p style={{ color: "#cbd5e1", fontSize: 12, marginTop: 0, marginBottom: 12, lineHeight: 1.5 }}>
                    This coach is still primary on {removeConflict.groups.length} {removeConflict.groups.length === 1 ? "group" : "groups"}. Pick a new primary for each before removing them from the team.
                  </p>
                  {removeConflict.groups.map(g => (
                    <div key={g.id} className="card" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: 8, borderRadius: 6 }}>
                      <span style={{ flex: 1, color: "var(--color-text)", fontSize: 13, fontWeight: 600 }}>{g.name}</span>
                      <select value={transferPlan[g.id] || ""}
                        onChange={(e) => setTransferPlan(prev => ({ ...prev, [g.id]: e.target.value }))}
                        style={{ flex: 1, padding: "5px 8px", fontSize: 12, background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 5, cursor: "pointer" }}>
                        <option value="">— new primary —</option>
                        {eligible.map(c => (
                          <option key={c.coach_sub} value={c.coach_sub}>
                            {c.display_name || c.initials || c.coach_sub.slice(-6)} ({c.role})
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                  {eligible.length === 0 && (
                    <div style={{ color: "#fca5a5", fontSize: 12, marginBottom: 10, padding: 8, background: "rgba(239,68,68,0.12)", border: "1px solid #ef4444", borderRadius: 5 }}>
                      No other team coaches available to take over. Add another coach to this team first, then retry.
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 14 }}>
                    <button onClick={() => { setRemoveConflict(null); setTransferPlan({}); }}
                      className="btn btn-lg btn-outlined btn-neutral">
                      Cancel
                    </button>
                    <button onClick={executeRemoveWithTransfers}
                      disabled={eligible.length === 0}
                      style={{ padding: "8px 14px", borderRadius: 6, border: "none", background: eligible.length === 0 ? "var(--color-border)" : "var(--color-destructive)", color: eligible.length === 0 ? "var(--color-text-dim)" : "#fff", fontSize: 13, fontWeight: 700, cursor: eligible.length === 0 ? "not-allowed" : "pointer" }}>
                      Transfer & remove ▸
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {teams === null ? (
            <div style={{ color: "var(--color-text-dim)", fontSize: 13 }}>Loading…</div>
          ) : teams.length === 0 ? (
            <div style={{ color: "var(--color-text-dim)", fontSize: 13, fontStyle: "italic", padding: 20, textAlign: "center", border: "1px dashed var(--color-border)", borderRadius: 10 }}>
              No teams yet. Create one to get started, or join an existing team via an invite code (coming in a later session).
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {teams.map(t => (
                <button key={t.id} onClick={() => setSelectedId(t.id)}
                  style={{ display: "block", textAlign: "left", width: "100%", padding: "12px 14px", background: t.archived ? "#1e293b88" : "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, cursor: "pointer", color: "var(--color-text)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>
                      {t.name}
                      {t.archived && <span style={{ marginLeft: 8, fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#64748b22", border: "1px solid #64748b", color: "var(--color-text-muted)" }}>archived</span>}
                    </span>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: "#3b82f622", border: "1px solid var(--color-primary)", color: "var(--color-primary-text)", fontWeight: 700 }}>{TEAM_TYPE_LABELS[t.team_type] || t.team_type}</span>
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: t.role === "owner" ? "#3b82f622" : "#33415522", border: `1px solid ${t.role === "owner" ? "var(--color-primary)" : "var(--color-border-strong)"}`, color: t.role === "owner" ? "var(--color-primary)" : "var(--color-text-muted)", fontWeight: 700 }}>{t.role}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }
