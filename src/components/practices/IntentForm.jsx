// src/components/practices/IntentForm.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { csrfHeaders } from "../../lib/api.js";
import { DRYLAND_OPTIONS } from "../../lib/constants.js";
import { poolModeLabel } from "../../lib/format.js";
import { WORKOUT_TYPES } from "../../lib/engine.js";
import { useDialogA11y } from "../shell/useDialogA11y.js";

    const MIX_OPTIONS_INTENT = [
      { id: "balanced",     label: "Balanced" },
      { id: "warmup_heavy", label: "Warmup-heavy" },
      { id: "drill_heavy",  label: "Drill-heavy" },
      { id: "long_main",    label: "Long main" },
    ];

    const { useState, useEffect } = React;

    export function IntentForm({ initialDate, initialIntent, editingId, initialFacilityId = null, onClose, onSaved }) {
      const dialogRef = useDialogA11y(onClose);
      const safeInitial = initialIntent || {};
      const [date,       setDate]       = React.useState(initialDate || "");
      const [type,       setType]       = React.useState(safeInitial.type || (WORKOUT_TYPES[0] && WORKOUT_TYPES[0].id) || "");
      const [maxYards,   setMaxYards]   = React.useState(safeInitial.maxYards || 2400);
      const [mix,        setMix]        = React.useState(safeInitial.mix || "balanced");
      const [recovery,   setRecovery]   = React.useState(!!safeInitial.recovery);
      // Section model A2 — include/skip per intent. main always on.
      const _initInc = Array.isArray(safeInitial.includedSections) ? safeInitial.includedSections : ["warmup","drill","main","cooldown"];
      const [skipWarmup,   setSkipWarmup]   = React.useState(!_initInc.includes("warmup"));
      const [skipDrill,    setSkipDrill]    = React.useState(!_initInc.includes("drill"));
      const [skipCooldown, setSkipCooldown] = React.useState(!_initInc.includes("cooldown"));
      // Kick is the opt-IN 5th section (default off) — seed from the intent's
      // saved includedSections so re-editing an intent preserves it.
      const [addKick,      setAddKick]      = React.useState(_initInc.includes("kick"));
      // Section model — optional dryland block to attach to this intent. "" = none.
      const [drylandPreset, setDrylandPreset] = React.useState(safeInitial.dryland?.preset || "");
      const [drylandPlace,  setDrylandPlace]  = React.useState(safeInitial.dryland?.placement || "pre");
      const [notes,      setNotes]      = React.useState(safeInitial.notes || "");
      // I Phase 2b — coach group fanout. groupId="" means "Yourself" (self-only,
      // no fanout). Selecting a group reveals an optional lane-plan picker.
      const [groupId,    setGroupId]    = React.useState(safeInitial.group_id || "");
      const [lanePlanId, setLanePlanId] = React.useState(safeInitial.lane_plan_id || "");
      const [coachTargets, setCoachTargets] = React.useState([]); // [] = none / not-coach
      const [lanePlans, setLanePlans]   = React.useState([]);     // [] when no group or no plans
      // P4 — facility lives on scheduled_workouts (NOT intent_params). It's a
      // team-level resource, so the picker only appears once a group (→team)
      // is chosen. Selecting a facility defaults pool_mode to its course at
      // generation time. "" = none / inherit.
      const [facilityId, setFacilityId] = React.useState(initialFacilityId != null ? String(initialFacilityId) : "");
      const [facilities, setFacilities] = React.useState([]);     // [] when no group / team has none
      const [busy,       setBusy]       = React.useState(false);
      const [err,        setErr]        = React.useState(null);

      // Fetch coach targets once. 403 means user isn't a coach — leave list empty.
      React.useEffect(() => {
        fetch("/api/picker/coach-targets", { cache: "no-store" })
          .then(r => r.ok ? r.json() : [])
          .then(list => setCoachTargets(Array.isArray(list) ? list : []))
          .catch(() => setCoachTargets([]));
      }, []);

      // Fetch lane plans whenever the selected group changes.
      React.useEffect(() => {
        if (!groupId) { setLanePlans([]); return; }
        fetch(`/api/groups/${groupId}/lane-plans`, { cache: "no-store" })
          .then(r => r.ok ? r.json() : [])
          .then(list => setLanePlans(Array.isArray(list) ? list.filter(p => !p.archived) : []))
          .catch(() => setLanePlans([]));
      }, [groupId]);

      // Clear lane_plan_id if the user switches groups (stale plan id).
      React.useEffect(() => {
        if (!groupId) setLanePlanId("");
        else if (lanePlanId && !lanePlans.some(p => p.id === lanePlanId)) setLanePlanId("");
      }, [groupId, lanePlans]);

      // P4 — load the selected group's team facilities. Facilities are
      // team-level; the group carries team_id via coach-targets.
      React.useEffect(() => {
        if (!groupId) { setFacilities([]); return; }
        const g = coachTargets.find(t => t.id === groupId);
        if (!g || !g.team_id) { setFacilities([]); return; }
        fetch(`/api/teams/${g.team_id}/facilities`, { cache: "no-store" })
          .then(r => r.ok ? r.json() : [])
          .then(list => setFacilities(Array.isArray(list) ? list : []))
          .catch(() => setFacilities([]));
      }, [groupId, coachTargets]);

      // Clear a stale facility when switching groups (different team). Guard on
      // facilities.length > 0 so an edit-mode prefill isn't wiped during the
      // async window where the list hasn't loaded yet.
      React.useEffect(() => {
        if (!groupId) { setFacilityId(""); return; }
        if (facilityId && facilities.length > 0 && !facilities.some(f => String(f.id) === String(facilityId))) setFacilityId("");
      }, [groupId, facilities]);

      const submit = async () => {
        setErr(null);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setErr("Pick a valid date"); return; }
        if (!type) { setErr("Pick a workout type"); return; }
        const intent_params = {
          type,
          maxYards: Number(maxYards),
          mix,
          recovery,
          // Equipment + phase come from the user's current state at
          // generation time — intent only captures the high-level shape.
        };
        // I Phase 2b — group fanout context. Only include when set so old
        // self-only flows produce identical JSON.
        if (groupId) {
          intent_params.group_id = groupId;
          if (lanePlanId) intent_params.lane_plan_id = lanePlanId;
        }
        // Section model A2 — only attach when something is skipped, so old
        // all-4 intents produce identical JSON.
        if (skipWarmup || skipDrill || addKick || skipCooldown) {
          const inc = [];
          if (!skipWarmup) inc.push("warmup");
          if (!skipDrill)  inc.push("drill");
          if (addKick)     inc.push("kick");
          inc.push("main");
          if (!skipCooldown) inc.push("cooldown");
          intent_params.includedSections = inc;
        }
        // Section model — attach a dryland block to the intent (resolved from
        // the preset bank at generation time). Only when one is chosen.
        if (drylandPreset) {
          intent_params.dryland = { preset: drylandPreset, placement: drylandPlace };
        }
        setBusy(true);
        try {
          // P4 — facility_id is a top-level column (not in intent_params).
          // null when self-only or no facility chosen.
          const facility_id = (groupId && facilityId) ? Number(facilityId) : null;
          if (editingId) {
            const res = await fetch(`/api/scheduled-workouts/${editingId}`, {
              method:  "PATCH",
              headers: { "Content-Type": "application/json", ...csrfHeaders() },
              body:    JSON.stringify({ scheduled_date: date, intent_params, notes: notes.trim() || null, facility_id }),
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
          } else {
            const res = await fetch("/api/scheduled-workouts", {
              method:  "POST",
              headers: { "Content-Type": "application/json", ...csrfHeaders() },
              body:    JSON.stringify({ scheduled_date: date, intent_params, notes: notes.trim() || null, facility_id }),
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
          }
          if (onSaved) onSaved();
          if (onClose) onClose();
        } catch (e) { setErr(e.message); }
        finally { setBusy(false); }
      };

      return (
        <div onClick={onClose} className="modal-overlay" style={{ padding: 20 }}>
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Plan a practice" onClick={(e) => e.stopPropagation()} style={{
            background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 12,
            padding: 22, maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto",
          }}>
            <div style={{ color: "var(--color-warn)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>
              {editingId ? "Edit intent" : "Plan intent"}
            </div>
            <div style={{ color: "var(--color-text)", fontSize: 18, fontWeight: 700, marginBottom: 14 }}>
              Schedule a workout intent for later
            </div>

            <label style={{ display: "block", fontSize: 11, color: "var(--color-text-muted)", marginBottom: 4 }}>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              style={{ width: "100%", padding: "7px 9px", background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 6, fontSize: 13, marginBottom: 12 }} />

            <label style={{ display: "block", fontSize: 11, color: "var(--color-text-muted)", marginBottom: 4 }}>Workout type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}
              style={{ width: "100%", padding: "7px 9px", background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 6, fontSize: 13, marginBottom: 12 }}>
              {WORKOUT_TYPES.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}
            </select>

            {/* I Phase 2b — For whom (self vs coach group). Hidden when user
                isn't a coach on any group. */}
            {coachTargets.length > 0 && (
              <>
                <label style={{ display: "block", fontSize: 11, color: "var(--color-text-muted)", marginBottom: 4 }}>For whom</label>
                <select value={groupId} onChange={(e) => setGroupId(e.target.value)}
                  style={{ width: "100%", padding: "7px 9px", background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 6, fontSize: 13, marginBottom: lanePlans.length > 0 ? 8 : 12 }}>
                  <option value="">👤 Yourself only</option>
                  {coachTargets.map(g => (
                    <option key={g.id} value={g.id}>
                      👥 {g.name} ({g.member_count} swimmer{g.member_count === 1 ? "" : "s"})
                    </option>
                  ))}
                </select>
                {groupId && lanePlans.length > 0 && (
                  <>
                    <label style={{ display: "block", fontSize: 11, color: "var(--color-text-muted)", marginBottom: 4 }}>Lane plan (optional)</label>
                    <select value={lanePlanId} onChange={(e) => setLanePlanId(e.target.value)}
                      style={{ width: "100%", padding: "7px 9px", background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 6, fontSize: 13, marginBottom: 12 }}>
                      <option value="">No plan — all members at their stored pace</option>
                      {lanePlans.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </>
                )}
                {groupId && lanePlans.length === 0 && (
                  <div style={{ color: "var(--color-text-dim)", fontSize: 11, fontStyle: "italic", marginBottom: 12 }}>
                    No lane plans for this group — fanout uses each member's stored pace.
                  </div>
                )}
                {groupId && facilities.length > 0 && (
                  <>
                    <label style={{ display: "block", fontSize: 11, color: "var(--color-text-muted)", marginBottom: 4 }}>Facility (optional)</label>
                    <select value={facilityId} onChange={(e) => setFacilityId(e.target.value)}
                      style={{ width: "100%", padding: "7px 9px", background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 6, fontSize: 13, marginBottom: facilityId ? 4 : 12 }}>
                      <option value="">No facility</option>
                      {facilities.map(f => (
                        <option key={f.id} value={f.id}>
                          🏊 {f.name}{f.course ? ` (${poolModeLabel(f.course)})` : ""}{f.is_primary ? " · primary" : ""}
                        </option>
                      ))}
                    </select>
                    {facilityId && (() => {
                      const f = facilities.find(x => String(x.id) === String(facilityId));
                      return f && f.course
                        ? <div style={{ color: "var(--color-text-dim)", fontSize: 11, fontStyle: "italic", marginBottom: 12 }}>
                            Generates in {poolModeLabel(f.course)} by default (this facility's course).
                          </div>
                        : <div style={{ marginBottom: 12 }} />;
                    })()}
                  </>
                )}
              </>
            )}

            <label style={{ display: "block", fontSize: 11, color: "var(--color-text-muted)", marginBottom: 4 }}>Max yardage</label>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 12 }}>
              <input type="range" min="1200" max="5000" step="100" value={maxYards}
                onChange={(e) => setMaxYards(Number(e.target.value))}
                style={{ flex: 1 }} />
              <span style={{ minWidth: 60, fontFamily: "ui-monospace, monospace", color: "var(--color-text)", fontSize: 13, textAlign: "right" }}>{maxYards}</span>
            </div>

            <label style={{ display: "block", fontSize: 11, color: "var(--color-text-muted)", marginBottom: 4 }}>Mix</label>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
              {MIX_OPTIONS_INTENT.map(m => {
                const active = mix === m.id;
                return (
                  <button key={m.id} onClick={() => setMix(m.id)}
                    className="pill"
                    style={{ border: `1px solid ${active ? "var(--color-warn)" : "var(--color-border)"}`, background: active ? "rgba(245,158,11,0.18)" : "transparent", color: active ? "var(--color-warn)" : "var(--color-text-muted)", fontSize: 11, cursor: "pointer" }}>
                    {m.label}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <input type="checkbox" id="intent-recovery" checked={recovery} onChange={(e) => setRecovery(e.target.checked)} />
              <label htmlFor="intent-recovery" style={{ color: "#cbd5e1", fontSize: 13, cursor: "pointer" }}>
                Recovery day (easy mains, intervals +10%)
              </label>
            </div>

            {/* Section model A2 — include/skip sections for this intent. Main always on. */}
            <label style={{ display: "block", fontSize: 11, color: "var(--color-text-muted)", marginBottom: 4 }}>Sections</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {[
                { label: "Warmup",   skip: skipWarmup,   toggle: () => setSkipWarmup(v => !v) },
                { label: "Drill",    skip: skipDrill,    toggle: () => setSkipDrill(v => !v) },
                { label: "Kick",     skip: !addKick,     toggle: () => setAddKick(v => !v) },
                { label: "Main",     locked: true },
                { label: "Cooldown", skip: skipCooldown, toggle: () => setSkipCooldown(v => !v) },
              ].map(s => {
                const included = s.locked || !s.skip;
                return (
                  <button key={s.label} type="button" onClick={s.locked ? undefined : s.toggle}
                    className="pill"
                    style={{
                      border: `1px solid ${included ? "var(--color-primary)" : "var(--color-border)"}`,
                      background: included ? "rgba(59,130,246,0.12)" : "transparent",
                      color: included ? "var(--color-primary)" : "var(--color-text-dim)",
                      textDecoration: included ? "none" : "line-through",
                      fontSize: 11, cursor: s.locked ? "default" : "pointer", opacity: s.locked ? 0.85 : 1,
                    }}>
                    {included ? "✓ " : ""}{s.label}
                  </button>
                );
              })}
            </div>

            {/* Section model — optional dryland block on this intent. */}
            <label style={{ display: "block", fontSize: 11, color: "var(--color-text-muted)", marginBottom: 4 }}>Dryland (optional)</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <select value={drylandPreset} onChange={(e) => setDrylandPreset(e.target.value)}
                style={{ flex: 1, minWidth: 160, padding: "7px 9px", background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 6, fontSize: 13 }}>
                <option value="">No dryland</option>
                {DRYLAND_OPTIONS.map(o => <option key={o.id} value={o.id}>🏋 {o.name}</option>)}
              </select>
              {drylandPreset && (
                <select value={drylandPlace} onChange={(e) => setDrylandPlace(e.target.value)}
                  style={{ padding: "7px 9px", background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 6, fontSize: 13 }}>
                  <option value="pre">Before pool</option>
                  <option value="post">After pool</option>
                </select>
              )}
            </div>

            <label style={{ display: "block", fontSize: 11, color: "var(--color-text-muted)", marginBottom: 4 }}>Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500}
              placeholder="e.g. focus on stroke count, or post-race recovery"
              style={{ width: "100%", padding: "7px 9px", background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 6, fontSize: 12, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", marginBottom: 4 }} />

            {err && <div style={{ color: "#fca5a5", fontSize: 12, marginTop: 6 }}>{err}</div>}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 14 }}>
              <button onClick={onClose}
                className="btn btn-lg btn-outlined btn-neutral">Cancel</button>
              <button onClick={submit} disabled={busy}
                className="btn btn-lg btn-filled btn-warn">
                {busy ? "…" : (editingId ? "Save intent" : "Plan intent ▸")}
              </button>
            </div>
          </div>
        </div>
      );
    }
