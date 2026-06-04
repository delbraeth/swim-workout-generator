// src/components/practices/AssignedToMeView.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { csrfHeaders, COMPLETION_LABELS, computeSubstitutionsForSwimmer, PSC_LABEL_MAP } from "../../lib/shared.js";
import { DrylandBlock } from "../workout/DrylandBlock.jsx";
import { WorkoutBlock } from "../workout/WorkoutBlock.jsx";

    const { useState, useCallback, useEffect } = React;

    export function AssignedToMeView({ onRunAssignment }) {
      const [list,       setList]       = React.useState(null);
      const [stateFilter, setStateFilter] = React.useState("");                  // "" = all
      const [expandedId, setExpandedId] = React.useState(null);
      const [msg,        setMsg]        = React.useState(null);
      // Meet-anchored taper (cheap version). Fetched once on mount + refresh
      // when list reloads. Map of { group_id: anchor } so per-card lookup
      // by assignment.assigned_via_group_id is O(1).
      const [groupAnchors, setGroupAnchors] = React.useState({});
      // Phase 3 PSC slice 4 — swimmer's own active constraints for
      // computeSubstitutionsForSwimmer on each assigned workout. View-local
      // fetch (mirrors App-level myConstraints but scoped to this view's
      // lifecycle).
      const [myConstraints, setMyConstraints] = React.useState([]);

      const load = React.useCallback(async () => {
        try {
          const q = stateFilter ? `?state=${encodeURIComponent(stateFilter)}` : "";
          const [assignRes, anchorRes, constraintRes] = await Promise.all([
            fetch(`/api/me/assignments${q}`, { cache: "no-store" }),
            fetch(`/api/me/group-anchors`,   { cache: "no-store" }),
            fetch(`/api/me/constraints`,     { cache: "no-store" }),
          ]);
          if (!assignRes.ok) throw new Error(`HTTP ${assignRes.status}`);
          setList(await assignRes.json());
          if (anchorRes.ok) setGroupAnchors(await anchorRes.json());
          else setGroupAnchors({});
          if (constraintRes.ok) {
            const d = await constraintRes.json();
            setMyConstraints(Array.isArray(d?.constraints) ? d.constraints : []);
          } else { setMyConstraints([]); }
        } catch (e) { setList([]); setMsg(e.message); }
      }, [stateFilter]);
      React.useEffect(() => { load(); }, [load]);

      const markState = async (assignmentId, state, extra = {}) => {
        try {
          const res = await fetch(`/api/assignments/${assignmentId}`, {
            method:  "PATCH",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({ completion_state: state, ...extra }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          await load();
        } catch (e) { setMsg(e.message); }
      };

      const handleMarkComplete = (a) => {
        const diffStr = window.prompt(`Mark "${a.workout?.typeLabel || a.workout?.type}" complete. Difficulty 1-5 (optional, leave blank):`, "");
        if (diffStr === null) return;
        const extra = {};
        const d = parseInt(diffStr, 10);
        if (Number.isFinite(d) && d >= 1 && d <= 5) extra.difficulty = d;
        markState(a.id, "complete", extra);
      };
      const handleMarkPartial = (a) => {
        const note = window.prompt("Mark partial. Optional note (what you completed / why):", "");
        if (note === null) return;
        markState(a.id, "partial", note ? { focus_note: note.slice(0, 255) } : {});
      };
      const handleMarkMissed = (a) => {
        const note = window.prompt("Mark missed. Optional reason:", "");
        if (note === null) return;
        markState(a.id, "missed", note ? { focus_note: note.slice(0, 255) } : {});
      };

      const counts = list ? list.reduce((acc, a) => { acc[a.completion_state] = (acc[a.completion_state] || 0) + 1; return acc; }, {}) : {};

      return (
        <div>
          <h2 style={{ color: "var(--color-text)", marginTop: 0 }}>📥 Assigned to me</h2>

          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {[{ id: "", label: "All", n: list?.length || 0 }, ...Object.keys(COMPLETION_LABELS).map(k => ({ id: k, label: COMPLETION_LABELS[k].label, n: counts[k] || 0 }))].map(f => {
              const active = stateFilter === f.id;
              const color  = COMPLETION_LABELS[f.id]?.color || "var(--color-primary)";
              return (
                <button key={f.id || "all"} onClick={() => setStateFilter(f.id)}
                  className="pill"
                  style={{ border: `1px solid ${active ? color : "var(--color-border)"}`, background: active ? `${color}22` : "transparent", color: active ? color : "var(--color-text-muted)", fontSize: 12, cursor: "pointer" }}>
                  {f.label} ({f.n})
                </button>
              );
            })}
          </div>

          {msg && <div style={{ color: "#fca5a5", fontSize: 12, marginBottom: 10 }}>{msg}</div>}

          {list === null ? (
            <div style={{ color: "var(--color-text-dim)", fontSize: 13 }}>Loading…</div>
          ) : list.length === 0 ? (
            <div style={{ color: "var(--color-text-dim)", fontSize: 13, fontStyle: "italic", padding: 20, textAlign: "center", border: "1px dashed var(--color-border)", borderRadius: 10 }}>
              No assigned workouts {stateFilter ? `in "${COMPLETION_LABELS[stateFilter]?.label}"` : "yet"}. When a coach generates a workout for a group you're in, it shows up here.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {list.map(a => {
                const meta = COMPLETION_LABELS[a.completion_state] || COMPLETION_LABELS.not_started;
                const isExpanded = expandedId === a.id;
                const isCoachMarked = !!a.completed_by_coach_sub;
                // Meet-anchored taper countdown badge. Lookup the source
                // group's anchor (if any) from the pre-fetched map. Only
                // renders when an anchor exists for this card's group AND
                // the event is still in the future (weeks_out >= 0). Per
                // MEET_ANCHORED_TAPER_SCOPE §3.7. Cosmetic only.
                const anchor = groupAnchors[a.assigned_via_group_id] || groupAnchors[a.group_id];
                const showAnchorBadge = anchor && anchor.weeks_out != null && anchor.weeks_out >= 0;
                // Phase 3 PSC slice 4 — per-card substitution computation.
                // Substitutions are derived from the swimmer's OWN constraints
                // applied to the assigned workout. Coach-side workout content
                // doesn't carry sub annotations; the swimmer's view computes
                // them at render time.
                const subs = a.workout ? computeSubstitutionsForSwimmer(a.workout, myConstraints) : [];
                const subCount = subs.length;
                return (
                  <div key={a.id} style={{ background: "var(--color-card)", border: `1px solid ${meta.color}`, borderRadius: 10, overflow: "hidden" }}>
                    <button onClick={() => setExpandedId(isExpanded ? null : a.id)}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "12px 14px", background: "transparent", border: "none", color: "var(--color-text)", cursor: "pointer" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div>
                          <span style={{ fontSize: 14, fontWeight: 700 }}>
                            {isExpanded ? "▾" : "▸"} {a.workout?.typeLabel || a.workout?.type} · {a.workout?.totalYards} {a.workout?.poolMode === "25y" ? "yd" : "m"}
                          </span>
                          <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 3 }}>
                            From <strong>{a.coach_name || "(coach)"}</strong>
                            {a.group_name && <> · group <strong>{a.group_name}</strong></>}
                            {a.lane_label && <> · lane <strong>{a.lane_label}</strong>{a.lane_pace ? ` @ ${a.lane_pace}` : ""}</>}
                            · assigned {new Date(a.assigned_at).toLocaleDateString()}
                          </div>
                          {showAnchorBadge && (
                            <div style={{ fontSize: 11, color: "var(--color-warn)", marginTop: 4, fontWeight: 600 }}>
                              🎯 {anchor.weeks_out === 0 ? "This week" : `${anchor.weeks_out} wk${anchor.weeks_out === 1 ? "" : "s"} to`} <strong>{anchor.event_name}</strong> · suggested phase: <strong style={{ textTransform: "capitalize" }}>{anchor.suggested_phase}</strong>
                            </div>
                          )}
                          {subCount > 0 && (
                            <div style={{ fontSize: 11, color: "var(--color-warn)", marginTop: 4, fontWeight: 600 }}>
                              ⚠ {subCount} substitution{subCount === 1 ? "" : "s"} applied for your active constraint{myConstraints.length === 1 ? "" : "s"}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: 10, padding: "3px 9px", borderRadius: 999, background: `${meta.color}22`, border: `1px solid ${meta.color}`, color: meta.color, fontWeight: 700 }}>
                          {meta.label}{isCoachMarked ? " (by coach)" : ""}
                        </span>
                      </div>
                    </button>
                    {isExpanded && (
                      <div style={{ padding: "0 14px 14px", borderTop: "1px solid var(--color-border)" }}>
                        {subCount > 0 && (
                          <div style={{ marginTop: 10, padding: 10, background: "var(--color-bg)", border: "1px solid var(--color-warn)", borderRadius: 6, fontSize: 11 }}>
                            <div style={{ color: "var(--color-warn)", fontWeight: 700, marginBottom: 6 }}>
                              ⚠ What was substituted ({subCount})
                            </div>
                            <div style={{ color: "var(--color-text-muted)", marginBottom: 6 }}>
                              These changes apply to YOUR copy because of your active constraints. Other swimmers in the group get the original.
                            </div>
                            <ul style={{ margin: 0, paddingLeft: 18, color: "var(--color-text)", lineHeight: 1.6 }}>
                              {subs.map((s, i) => {
                                const block = a.workout.blocks?.[s.block_idx];
                                const sectName = block?.section || "section";
                                if (s.kind === "stroke_sub") {
                                  return (
                                    <li key={i}>
                                      <em>{sectName}</em> set {s.set_idx + 1}: swap <strong>{s.from}</strong> → <strong>{s.to}</strong>
                                      <span style={{ color: "var(--color-text-muted)" }}> · {PSC_LABEL_MAP[s.constraint_type] || s.constraint_type}</span>
                                    </li>
                                  );
                                }
                                if (s.kind === "equip_drop") {
                                  return (
                                    <li key={i}>
                                      <em>{sectName}</em> set {s.set_idx + 1}: drop <strong>{s.eq}</strong> gear, swim unassisted
                                      <span style={{ color: "var(--color-text-muted)" }}> · {PSC_LABEL_MAP[s.constraint_type] || s.constraint_type}</span>
                                    </li>
                                  );
                                }
                                if (s.kind === "section_skip") {
                                  return (
                                    <li key={i}>
                                      Skip <em>{s.section}</em> — rest or own choice instead
                                      <span style={{ color: "var(--color-text-muted)" }}> · {PSC_LABEL_MAP[s.constraint_type] || s.constraint_type}</span>
                                    </li>
                                  );
                                }
                                if (s.kind === "cap_yardage") {
                                  return (
                                    <li key={i}>
                                      Yardage cap <strong>{s.value} yd</strong> — trim from the end if the workout runs long
                                    </li>
                                  );
                                }
                                if (s.kind === "cap_intensity") {
                                  return (
                                    <li key={i}>
                                      Intensity cap <strong>{s.value}</strong> — main set replaced with easy-pace equivalent volume
                                    </li>
                                  );
                                }
                                return null;
                              })}
                            </ul>
                          </div>
                        )}
                        {a.workout?.blocks && (
                          <div style={{ marginTop: 10 }}>
                            {a.workout.blocks.map((b, i) => b && b.kind === "dryland" ? (
                              <DrylandBlock key={i} block={b} />
                            ) : (
                              <WorkoutBlock key={i} block={b} equipment={a.workout.equipment || {}}
                                recentMainLabels={new Map()} poolMode={a.workout.poolMode || "25y"} />
                            ))}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                          {a.completion_state !== "complete" && (
                            <button onClick={() => { if (onRunAssignment) onRunAssignment(a); }}
                              style={{ padding: "7px 14px", background: "var(--color-positive)", color: "var(--color-bg)", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                              ▶ Run this workout
                            </button>
                          )}
                          <button onClick={() => handleMarkComplete(a)}
                            style={{ padding: "7px 12px", background: "transparent", color: "var(--color-positive)", border: "1px solid #22c55e", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
                            ✓ Mark complete
                          </button>
                          <button onClick={() => handleMarkPartial(a)}
                            style={{ padding: "7px 12px", background: "transparent", color: "var(--color-warn)", border: "1px solid var(--color-warn)", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
                            ◐ Mark partial
                          </button>
                          <button onClick={() => handleMarkMissed(a)}
                            style={{ padding: "7px 12px", background: "transparent", color: "var(--color-destructive)", border: "1px solid #ef4444", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
                            ✕ Mark missed
                          </button>
                        </div>
                        {a.focus_note && (
                          <div style={{ marginTop: 10, padding: 8, background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 5, fontSize: 11, color: "#cbd5e1" }}>
                            <span style={{ color: "var(--color-text-dim)" }}>Note:</span> {a.focus_note}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }
