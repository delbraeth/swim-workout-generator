// src/components/practices/WeekView.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { csrfHeaders, DRYLAND_OPTIONS, makeDrylandBlock, poolModeLabel } from "../../lib/shared.js";
import { generateWorkout, WORKOUT_TYPES } from "../../lib/engine.js";
import { IntentForm } from "./IntentForm.jsx";
import { IntentPreviewOverlay } from "./IntentPreviewOverlay.jsx";
import { MarkPracticeDoneModal } from "./MarkPracticeDoneModal.jsx";

    const { useState, useCallback, useMemo, useEffect } = React;

    export function WeekView({ onRunScheduled, onEditScheduled, myConstraints = [] }) {
      // Compute the Monday of the current ISO week (Mon=1, Sun=7).
      function isoMondayOf(d) {
        const x = new Date(d);
        x.setHours(0, 0, 0, 0);
        const day = x.getDay(); // 0=Sun
        const diff = day === 0 ? -6 : 1 - day;
        x.setDate(x.getDate() + diff);
        return x;
      }
      function ymd(d) {
        const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${dd}`;
      }
      function fmtMonDay(d) {
        return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
      }
      function isoWeekNumber(d) {
        // ISO week number for the given date.
        const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const dayNum = (x.getUTCDay() + 6) % 7; // 0=Mon
        x.setUTCDate(x.getUTCDate() - dayNum + 3);
        const firstThursday = x.valueOf();
        x.setUTCMonth(0, 1);
        if (x.getUTCDay() !== 4) {
          x.setUTCMonth(0, 1 + ((4 - x.getUTCDay()) + 7) % 7);
        }
        return 1 + Math.ceil((firstThursday - x) / 604800000);
      }

      const [weekStart, setWeekStart] = React.useState(() => isoMondayOf(new Date()));
      const [list,      setList]      = React.useState(null);
      const [err,       setErr]       = React.useState(null);
      const [copyTarget, setCopyTarget] = React.useState(null); // { sw, date }
      // Phase 2a — intent form + preview state.
      const [intentForm, setIntentForm] = React.useState(null);  // { date, intent, editingId } | null
      const [intentPreview, setIntentPreview] = React.useState(null); // { sw, workout } | null
      const [repeatBusy, setRepeatBusy] = React.useState(false);
      // Reporting Phase A — attendance modal target. null = closed; sw = open.
      const [markingPractice, setMarkingPractice] = React.useState(null);
      // I Phase 2b — coach targets cache (for group badge + Generate-from-intent
      // assignment_target stamping). Empty array when user isn't a coach.
      const [coachTargets, setCoachTargets] = React.useState([]);
      React.useEffect(() => {
        fetch("/api/picker/coach-targets", { cache: "no-store" })
          .then(r => r.ok ? r.json() : [])
          .then(list => setCoachTargets(Array.isArray(list) ? list : []))
          .catch(() => setCoachTargets([]));
      }, []);

      const days = React.useMemo(() => {
        const arr = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(weekStart);
          d.setDate(d.getDate() + i);
          arr.push(d);
        }
        return arr;
      }, [weekStart]);

      const startStr = ymd(weekStart);
      const endStr   = ymd(days[6]);

      const load = React.useCallback(async () => {
        try {
          const res = await fetch(`/api/scheduled-workouts?start=${startStr}&end=${endStr}`, { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setList(await res.json());
        } catch (e) { setList([]); setErr(e.message); }
      }, [startStr, endStr]);
      React.useEffect(() => { load(); }, [load]);

      const byDate = React.useMemo(() => {
        const m = {};
        for (const sw of (list || [])) {
          const k = sw.scheduled_date;
          (m[k] = m[k] || []).push(sw);
        }
        return m;
      }, [list]);

      const goPrev = () => setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d; });
      const goNext = () => setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d; });
      const goThis = () => setWeekStart(isoMondayOf(new Date()));

      const handleDelete = async (sw) => {
        if (!window.confirm(`Delete this scheduled workout? (${sw.payload?.typeLabel || sw.payload?.type || "workout"})`)) return;
        try {
          const res = await fetch(`/api/scheduled-workouts/${sw.id}`, { method: "DELETE", headers: { ...csrfHeaders() } });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          await load();
        } catch (e) { setErr(e.message); }
      };

      const handleCopy = async (sw, targetDate) => {
        try {
          // Copy preserves mode: intent-mode rows copy as intent; payload
          // copies as payload. (Phase 1 only knew payload; Phase 2a adds
          // intent.)
          const body = {
            scheduled_date: targetDate,
            notes: sw.notes,
          };
          if (sw.payload)       body.payload = sw.payload;
          if (sw.intent_params) body.intent_params = sw.intent_params;
          const res = await fetch("/api/scheduled-workouts", {
            method:  "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify(body),
          });
          const j = await res.json();
          if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
          setCopyTarget(null);
          await load();
        } catch (e) { setErr(e.message); }
      };

      // Phase 2a — generate-from-intent. Invokes the in-app generateWorkout
      // with the intent params, opens IntentPreviewOverlay with the result.
      // User can Run / Regenerate / Cancel from the preview.
      const handleGenerateFromIntent = (sw) => {
        const ip = sw.intent_params || {};
        try {
          const generated = generateWorkout({
            typeId:       ip.type,
            maxYards:     Number(ip.maxYards) || 2400,
            equipment:    ip.equipment || {},
            favorites:    [],
            // P4 — default to the scheduled facility's course (25y/25m/50m)
            // when one is set; else the historical 25y default.
            poolMode:     sw.facility_course || "25y",
            userMin:      1200,
            pinnedBlocks: {},
            recentLabels: [],
            recoveryMode: !!ip.recovery,
            phase:        ip.phase || null,
            favoriteSetIds: null,
            sectionBias:  ip.mix || "balanced",
            // Section model A2 — honor the intent's section choices if present
            // (absent → generateWorkout defaults to all four).
            ...(Array.isArray(ip.includedSections) ? { includedSections: ip.includedSections } : {}),
            myConstraints,                                                       // Phase 3 PSC slice 2 — passed in from App so intent-generates honor active constraints
          });
          if (generated && generated.__generateFailure) {
            setErr(generated.error || "Couldn't generate from intent — try regenerating or editing the intent.");
            return;
          }
          // I Phase 2b — stamp assignment_target so the preview overlay's Run
          // handler can route through /api/log-workout's fanout path. Mirrors
          // R-D's handleGenerate stamping.
          if (ip.group_id) {
            const g = coachTargets.find(t => t.id === ip.group_id);
            if (g) {
              generated.assignment_target = {
                kind:         "group",
                group_id:     g.id,
                group_name:   g.name,
                member_count: g.member_count,
                phase:        g.current_phase || null,
              };
              if (ip.lane_plan_id) generated.assignment_target.lane_plan_id = ip.lane_plan_id;
            }
          }
          // Section model — attach the intent's dryland block (resolved from
          // the preset bank) at the chosen placement.
          if (ip.dryland?.preset && Array.isArray(generated.blocks)) {
            const opt = DRYLAND_OPTIONS.find(o => o.id === ip.dryland.preset);
            if (opt) {
              const blk = makeDrylandBlock(opt, ip.dryland.placement || "pre");
              generated.blocks = ip.dryland.placement === "post"
                ? [...generated.blocks, blk]
                : [blk, ...generated.blocks];
            }
          }
          setIntentPreview({ sw, workout: generated });
        } catch (e) {
          setErr(`Generate failed: ${e.message}`);
        }
      };

      // Phase 2a — bulk-copy this week to next.
      const handleRepeatWeek = async () => {
        const rowCount = (list || []).length;
        if (rowCount > 5 && !window.confirm(`Copy all ${rowCount} workouts to next week? Target days that already have rows will be skipped.`)) return;
        if (rowCount === 0) { setErr("Nothing to repeat — this week has no scheduled workouts."); return; }
        setRepeatBusy(true); setErr(null);
        try {
          const res = await fetch("/api/scheduled-workouts/repeat-week", {
            method:  "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({ start_date: startStr }),
          });
          const j = await res.json();
          if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
          // Jump to the new week and reload.
          const nextStart = new Date(weekStart); nextStart.setDate(nextStart.getDate() + 7);
          setWeekStart(nextStart);
          // load() will fire automatically via the useEffect dependency change.
          window.alert(`Copied ${j.copied} workout${j.copied === 1 ? "" : "s"} to next week.${j.skipped > 0 ? ` Skipped ${j.skipped} (target day already had rows).` : ""}`);
        } catch (e) { setErr(e.message); }
        finally { setRepeatBusy(false); }
      };

      const today = ymd(new Date());
      const showingThisWeek = startStr === ymd(isoMondayOf(new Date()));

      return (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <h2 style={{ margin: 0, color: "var(--color-text)", fontSize: 22 }}>📅 Plan your week</h2>
              <div style={{ color: "var(--color-text-muted)", fontSize: 12, marginTop: 4 }}>
                Week {isoWeekNumber(weekStart)} · {weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – {days[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button onClick={handleRepeatWeek} disabled={repeatBusy || (list || []).length === 0}
                title="Copy this week's scheduled workouts to next week (skips days that already have rows)"
                style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${repeatBusy ? "var(--color-border)" : "var(--color-warn)"}`, background: repeatBusy ? "transparent" : "rgba(245,158,11,0.12)", color: repeatBusy ? "var(--color-text-dim)" : "var(--color-warn)", fontSize: 13, fontWeight: 700, cursor: repeatBusy || (list || []).length === 0 ? "not-allowed" : "pointer", opacity: (list || []).length === 0 ? 0.4 : 1 }}>{repeatBusy ? "…" : "🗓 Repeat next week"}</button>
              <button onClick={goPrev} title="Previous week"
                className="btn btn-md btn-outlined btn-neutral">‹ Prev</button>
              <button onClick={goThis} disabled={showingThisWeek}
                title="Jump to current ISO week"
                style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${showingThisWeek ? "var(--color-border)" : "var(--color-primary)"}`, background: showingThisWeek ? "transparent" : "rgba(59,130,246,0.15)", color: showingThisWeek ? "var(--color-border-strong)" : "var(--color-primary)", fontSize: 13, fontWeight: 700, cursor: showingThisWeek ? "default" : "pointer" }}>This week</button>
              <button onClick={goNext} title="Next week"
                className="btn btn-md btn-outlined btn-neutral">Next ›</button>
            </div>
          </div>

          {err && <div style={{ color: "#fca5a5", fontSize: 12, marginBottom: 10 }}>{err}</div>}

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
            {days.map((d) => {
              const dk = ymd(d);
              const rows = byDate[dk] || [];
              const isToday = dk === today;
              const isPast  = dk < today;
              return (
                <div key={dk} style={{
                  border: `1px solid ${isToday ? "var(--color-primary)" : "var(--color-border)"}`,
                  background: isToday ? "rgba(167,139,250,0.06)" : "var(--color-card)",
                  borderRadius: 8, padding: "10px 14px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    <div style={{ color: isToday ? "var(--color-primary)" : "var(--color-text)", fontSize: 13, fontWeight: 700 }}>
                      {fmtMonDay(d)}
                      {isToday && <span style={{ marginLeft: 8, fontSize: 10, color: "var(--color-primary)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Today</span>}
                      {isPast && rows.length === 0 && <span style={{ marginLeft: 8, fontSize: 10, color: "var(--color-border-strong)", fontStyle: "italic" }}>(rest day)</span>}
                    </div>
                    <span style={{ fontSize: 10, color: "var(--color-border-strong)" }}>{rows.length} {rows.length === 1 ? "workout" : "workouts"}</span>
                  </div>
                  {rows.length === 0 && !isPast && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", flexWrap: "wrap" }}>
                      <span style={{ color: "var(--color-border-strong)", fontSize: 11, fontStyle: "italic" }}>Nothing scheduled.</span>
                      <button onClick={() => setIntentForm({ date: dk, intent: null, editingId: null })}
                        title="Plan a workout intent for this day — generate-from-intent on the day of"
                        style={{ padding: "3px 10px", border: "1px dashed var(--color-border-strong)", borderRadius: 5, background: "transparent", color: "var(--color-text-muted)", fontSize: 11, cursor: "pointer" }}>+ Plan intent</button>
                    </div>
                  )}
                  {rows.map(sw => {
                    const done       = !!sw.completed_workout_id;
                    // Reporting Phase A — practice completion stamp (separate
                    // from `done`/completed_workout_id, which is swimmer's
                    // run-mode log linkback). practiceDone captures "coach
                    // closed the practice + recorded attendance."
                    const practiceDone = !!sw.completed_at;
                    const isIntent   = sw.mode === "intent";
                    // Payload field shape: raw workout object from generateWorkout →
                    // has typeId + totalYards (no type/typeLabel/maxYardsCap/poolMode).
                    // Intent_params shape: { type, maxYards, mix, recovery }.
                    const typeId     = sw.payload?.typeId || sw.intent_params?.type || null;
                    const typeMeta   = typeId ? WORKOUT_TYPES.find(t => t.id === typeId) : null;
                    const typeLabel  = typeMeta ? `${typeMeta.emoji} ${typeMeta.label}` : "workout";
                    const yards      = sw.payload?.totalYards || sw.intent_params?.maxYards || 0;
                    const isMeters   = sw.payload?.poolMode === "25m" || sw.payload?.poolMode === "50m";
                    const unit       = isMeters ? "m" : "yds";
                    const borderClr  = done ? "var(--color-positive)" : (isIntent ? "var(--color-warn)" : "var(--color-border)");
                    // I Phase 2b — group fanout context. Look up group name
                    // from cached coach-targets (empty for non-coaches; old
                    // self-only rows have no group_id and skip rendering).
                    const groupId    = sw.intent_params?.group_id || sw.payload?.assignment_target?.group_id || null;
                    const groupName  = (() => {
                      if (!groupId) return null;
                      const g = coachTargets.find(t => t.id === groupId);
                      if (g) return g.name;
                      return sw.payload?.assignment_target?.group_name || "group";
                    })();
                    return (
                      <div key={sw.id} style={{ display: "flex", gap: 6, alignItems: "center", padding: "6px 8px", background: "var(--color-bg)", border: `1px solid ${borderClr}`, borderRadius: 5, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ color: done ? "var(--color-positive)" : (isIntent ? "var(--color-warn)" : "#cbd5e1"), fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0 }}>
                          {done ? "✓ " : ""}{isIntent && !done && <span style={{ fontSize: 9, color: "var(--color-warn)", letterSpacing: "0.1em", marginRight: 6, textTransform: "uppercase" }}>Intent</span>}{typeLabel}
                          {groupName && (
                            <span title={`Coach-planned for group "${groupName}"`}
                              style={{ marginLeft: 6, fontSize: 10, color: "#86efac", background: "rgba(34,197,94,0.12)", border: "1px solid #16a34a", borderRadius: 4, padding: "1px 6px", fontWeight: 700, letterSpacing: "0.04em" }}>
                              → {groupName}
                            </span>
                          )}
                          {sw.facility_name && (
                            <span title={`At ${sw.facility_name}${sw.facility_course ? ` · ${poolModeLabel(sw.facility_course)}` : ""}`}
                              style={{ marginLeft: 6, fontSize: 10, color: "var(--color-primary)", background: "rgba(59,130,246,0.12)", border: "1px solid var(--color-primary)", borderRadius: 4, padding: "1px 6px", fontWeight: 700, letterSpacing: "0.04em" }}>
                              🏊 {sw.facility_name}
                            </span>
                          )}
                          <span style={{ color: "var(--color-text-dim)", fontWeight: 400, marginLeft: 6 }}>{yards.toLocaleString()} {unit}{isIntent && " (target)"}</span>
                          {isIntent && sw.notes && <span style={{ marginLeft: 8, fontSize: 11, color: "var(--color-text-muted)", fontStyle: "italic" }}>· {sw.notes}</span>}
                        </span>
                        {!done && isIntent && (
                          <>
                            <button onClick={() => handleGenerateFromIntent(sw)}
                              title="Generate a workout from this intent + preview it"
                              style={{ padding: "3px 10px", border: "1px solid var(--color-warn)", borderRadius: 5, background: "transparent", color: "var(--color-warn)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>▶ Generate</button>
                            <button onClick={() => setIntentForm({ date: sw.scheduled_date, intent: sw.intent_params, editingId: sw.id, facilityId: sw.facility_id })}
                              title="Edit this intent"
                              style={{ padding: "3px 10px", border: "1px solid var(--color-primary)", borderRadius: 5, background: "transparent", color: "var(--color-primary)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✎ Edit intent</button>
                          </>
                        )}
                        {!done && !isIntent && (
                          <>
                            <button onClick={() => onRunScheduled && onRunScheduled(sw)}
                              title="Run this workout now (loads into Run mode)"
                              style={{ padding: "3px 10px", border: "1px solid #22c55e", borderRadius: 5, background: "transparent", color: "var(--color-positive)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>▶ Run</button>
                            <button onClick={() => onEditScheduled && onEditScheduled(sw)}
                              title="Open in the generator to edit / regenerate"
                              style={{ padding: "3px 10px", border: "1px solid var(--color-primary)", borderRadius: 5, background: "transparent", color: "var(--color-primary)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✎ Edit</button>
                          </>
                        )}
                        {/* Reporting Phase A — practice attendance. Visible on
                            payload-mode rows (intent-mode rows need to be
                            generated first). Toggles between "Mark practice
                            done" and "Edit attendance" based on completed_at. */}
                        {!isIntent && (
                          <button onClick={() => setMarkingPractice(sw)}
                            title={practiceDone ? "Edit recorded attendance" : "Mark practice done + record attendance"}
                            style={{ padding: "3px 10px", border: `1px solid ${practiceDone ? "var(--color-positive)" : "var(--color-border-strong)"}`, borderRadius: 5, background: practiceDone ? "rgba(34,197,94,0.12)" : "transparent", color: practiceDone ? "var(--color-positive)" : "var(--color-text-muted)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                            {practiceDone ? "✓ Attendance" : "📋 Mark done"}
                          </button>
                        )}
                        <button onClick={() => setCopyTarget({ sw, date: dk })}
                          title="Copy this workout to another day"
                          style={{ padding: "3px 10px", border: "1px solid var(--color-border-strong)", borderRadius: 5, background: "transparent", color: "var(--color-text-muted)", fontSize: 11, cursor: "pointer" }}>🗐 Copy</button>
                        {!done && (
                          <button onClick={() => handleDelete(sw)}
                            title="Delete this scheduled workout"
                            style={{ padding: "3px 10px", border: "1px solid #ef4444", borderRadius: 5, background: "transparent", color: "var(--color-destructive)", fontSize: 11, cursor: "pointer" }}>🗑</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Copy-to-day modal */}
          {copyTarget && (() => {
            const defaultDate = (() => {
              const d = new Date(copyTarget.date + "T00:00:00");
              d.setDate(d.getDate() + 1);
              return ymd(d);
            })();
            return (
              <div onClick={() => setCopyTarget(null)} className="modal-overlay" style={{ padding: 20 }}>
                <div onClick={(e) => e.stopPropagation()} style={{
                  background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 12,
                  padding: 22, maxWidth: 420, width: "100%",
                }}>
                  <div style={{ color: "var(--color-primary)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>Copy workout</div>
                  <div style={{ color: "var(--color-text)", fontSize: 16, fontWeight: 700, marginBottom: 14 }}>
                    Copy "{copyTarget.sw.payload?.typeLabel || copyTarget.sw.payload?.type || "workout"}" to:
                  </div>
                  <input type="date" defaultValue={defaultDate} id="copy-target-date"
                    style={{ width: "100%", padding: "8px 10px", background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 6, fontSize: 14 }} />
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 14 }}>
                    <button onClick={() => setCopyTarget(null)}
                      className="btn btn-lg btn-outlined btn-neutral">Cancel</button>
                    <button onClick={() => {
                        const v = document.getElementById("copy-target-date")?.value;
                        if (v) handleCopy(copyTarget.sw, v);
                      }}
                      className="btn btn-lg btn-filled btn-primary">Copy ▸</button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Phase 2a — IntentForm modal */}
          {intentForm && (
            <IntentForm
              initialDate={intentForm.date}
              initialIntent={intentForm.intent}
              editingId={intentForm.editingId}
              initialFacilityId={intentForm.facilityId}
              onClose={() => setIntentForm(null)}
              onSaved={() => { load(); }}
            />
          )}

          {/* Reporting Phase A — Mark Practice Done modal */}
          {markingPractice && (
            <MarkPracticeDoneModal
              sw={markingPractice}
              onClose={() => setMarkingPractice(null)}
              onSaved={() => { setMarkingPractice(null); load(); }}
            />
          )}

          {/* Phase 2a — IntentPreviewOverlay (Generate-from-intent flow) */}
          {intentPreview && (
            <IntentPreviewOverlay
              scheduledRow={intentPreview.sw}
              generatedWorkout={intentPreview.workout}
              onRegenerate={() => handleGenerateFromIntent(intentPreview.sw)}
              onSave={() => {
                // I Phase 2b — commit without entering Run mode. Refresh
                // week view so the row updates from intent → payload (and
                // shows ✓ done for group intents, which the log-workout
                // path linked + completed).
                setIntentPreview(null);
                load();
              }}
              onRun={(w) => {
                // Hand off to the parent's run-scheduled handler. The preview
                // overlay has already PATCHed the row's payload (self intent)
                // OR called /api/log-workout to create the snapshot + fanout +
                // link (group intent — I Phase 2b). Pass a synthesized sw so
                // onRunScheduled doesn't need to refetch.
                //
                // For group intents the schedule row is already linked to the
                // snapshot workout — null out completed_workout_id link
                // marker by tagging mode "payload_already_linked" so the
                // parent skips runScheduledId (avoids a second link attempt +
                // duplicate workout entry at finish-Run-mode time).
                const wasGroupIntent = !!(intentPreview.sw.intent_params && intentPreview.sw.intent_params.group_id);
                const swForRun = {
                  ...intentPreview.sw,
                  payload: w,
                  intent_params: null,
                  mode: "payload",
                  _alreadyLinked: wasGroupIntent,
                };
                setIntentPreview(null);
                load();
                if (onRunScheduled) onRunScheduled(swForRun);
              }}
              onClose={() => setIntentPreview(null)}
            />
          )}
        </div>
      );
    }
