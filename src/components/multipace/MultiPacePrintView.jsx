// src/components/multipace/MultiPacePrintView.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { scaleInterval } from "../../lib/engine.js";
import { computeSubstitutionsForSwimmer, parsePaceMSS, rescaleBlocksForPace } from "../../lib/shared.js";

    const { Fragment } = React;

    const { useEffect } = React;

    export function MultiPacePrintView({ workout, lanes, mode, onClose, groupActiveConstraints = {} }) {
      // Toggle body class so screen view hides the rest of the app under
      // this overlay AND so we can scope print CSS to the multi-pace path.
      React.useEffect(() => {
        document.body.classList.add("multipace-active");
        // Auto-trigger print dialog after layout settles.
        const t = setTimeout(() => { try { window.print(); } catch (_) {} }, 250);
        return () => {
          document.body.classList.remove("multipace-active");
          clearTimeout(t);
        };
      }, []);

      const headerTitleFor = (lane) =>
        `${lane.lane_label || "Lane"}${lane.pace ? " · " + lane.pace : ""}`;

      if (mode === "matrix") {
        // Matrix: one row per set across all blocks, N columns for the
        // per-lane interval. Block headers separate the sections.
        return (
          <div className="multipace-overlay" style={{ position: "fixed", inset: 0, zIndex: 10000, background: "#fff", color: "#000", padding: "0.5in", overflow: "auto" }}>
            <button className="screen-only" onClick={onClose}
              style={{ position: "absolute", top: 12, right: 14, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", fontSize: 12, fontWeight: 700, cursor: "pointer", zIndex: 10001 }}>
              ✕ Close print view
            </button>
            <div className="multipace-page">
              <div className="multipace-print-header" style={{ borderBottom: "2pt solid #000", paddingBottom: 8, marginBottom: 12 }}>
                <div style={{ fontSize: "20pt", fontWeight: 700, margin: 0 }}>Multi-pace matrix</div>
                <div style={{ fontSize: "11pt", fontStyle: "italic", marginTop: 4 }}>
                  Same workout, {lanes.length} lane{lanes.length === 1 ? "" : "s"}. Intervals scaled from a 2:00/100 baseline.
                </div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "10pt" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", borderBottom: "1.5pt solid #000", padding: "6pt 4pt", width: "44%" }}>Set</th>
                    {lanes.map((l, i) => (
                      <th key={i} style={{ textAlign: "left", borderBottom: "1.5pt solid #000", padding: "6pt 4pt" }}>{l.lane_label}<br /><span style={{ fontWeight: 400, fontStyle: "italic" }}>{l.pace}</span></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {workout.blocks.map((block, bi) => (
                    <React.Fragment key={bi}>
                      <tr>
                        <td colSpan={1 + lanes.length} style={{ padding: "8pt 0 3pt", borderBottom: "0.5pt solid #000", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          {block.name || block.label || block.section}
                          {block.label && block.name && block.label !== block.name ? <span style={{ fontWeight: 400, fontStyle: "italic", textTransform: "none", letterSpacing: 0, marginLeft: 6 }}>— {block.label}</span> : null}
                        </td>
                      </tr>
                      {block.kind === "dryland"
                        ? (block.exercises || []).map((ex, ei) => (
                            <tr key={"dl" + ei}><td colSpan={1 + lanes.length} style={{ padding: "3pt 4pt", borderBottom: "0.25pt solid #ccc" }}>
                              <b>{ex.sets > 1 ? `${ex.sets} × ${ex.reps}` : ex.reps}</b> — {ex.name}{ex.rest ? ` (rest ${ex.rest})` : ""}
                            </td></tr>
                          ))
                        : (block.sets || []).map((s, si) => {
                        const setKey = bi + "-" + si;
                        return (
                          <tr key={setKey} className="multipace-matrix-row">
                            <td style={{ padding: "4pt 4pt", borderBottom: "0.25pt solid #000", verticalAlign: "top" }}>
                              <b>{s.reps}×{s.dist}</b>{s.eq ? <i style={{ marginLeft: 4 }}>[{s.eq}]</i> : null}
                              <div style={{ fontSize: "9pt", marginTop: 2 }}>{s.desc || ""}</div>
                            </td>
                            {lanes.map((l, li) => {
                              const secs = parsePaceMSS(l.pace);
                              const ratio = secs ? secs / 120 : 1;
                              const scaledInt = scaleInterval(s.interval, ratio);
                              return (
                                <td key={li} style={{ padding: "4pt 4pt", borderBottom: "0.25pt solid #000", verticalAlign: "top", fontFamily: "ui-monospace, 'SFMono-Regular', monospace", fontSize: "9.5pt" }}>
                                  {scaledInt || "—"}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      // Per-lane mode: one page per lane.
      return (
        <div className="multipace-overlay" style={{ position: "fixed", inset: 0, zIndex: 10000, background: "#fff", color: "#000", overflow: "auto" }}>
          <button className="screen-only" onClick={onClose}
            style={{ position: "fixed", top: 12, right: 14, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", fontSize: 12, fontWeight: 700, cursor: "pointer", zIndex: 10001 }}>
            ✕ Close print view
          </button>
          {lanes.map((lane, li) => {
            const rescaled = rescaleBlocksForPace(workout.blocks, lane.pace);

            // Phase 3 PSC slice 4 — per-swimmer-on-lane substitution annotations.
            // Per scope §3.7: lane card shows per-swimmer sub when ANY member of
            // this lane has an active constraint. Workout content is unchanged
            // at the workout level; the annotations are visual only.
            //
            // Build a map of (blockIdx, setIdx) → array of "<name>: <sub>" strings.
            // Also collect workout-level annotations (caps + section skips) for
            // the header.
            const laneMembers = Array.isArray(lane.members) ? lane.members : [];
            const perSetAnnotations = {}; // key: `${bi}-${si}` → ["Linda: sub free for fly", …]
            const perBlockAnnotations = {}; // key: bi → [section-skip notes]
            const workoutLevelNotes = [];
            for (const m of laneMembers) {
              const key = m.swimmer_sub || m.managed_id;
              if (!key) continue;
              const memberConstraints = groupActiveConstraints[key] || [];
              if (memberConstraints.length === 0) continue;
              const subs = computeSubstitutionsForSwimmer({ blocks: rescaled }, memberConstraints);
              const memberName = (m.display_name || m.label || (key.startsWith("ms_") ? key : key.slice(-8))).slice(0, 24);
              for (const s of subs) {
                let str = "";
                if (s.kind === "stroke_sub") {
                  str = `${memberName}: ${s.from} → ${s.to}`;
                } else if (s.kind === "equip_drop") {
                  str = `${memberName}: drop ${s.eq}`;
                } else if (s.kind === "section_skip") {
                  const k = s.block_idx;
                  (perBlockAnnotations[k] = perBlockAnnotations[k] || []).push(`${memberName}: skip section`);
                  continue;
                } else if (s.kind === "cap_yardage") {
                  workoutLevelNotes.push(`${memberName}: cap ${s.value} yd (trim from end)`);
                  continue;
                } else if (s.kind === "cap_intensity") {
                  workoutLevelNotes.push(`${memberName}: ${s.value}`);
                  continue;
                }
                if (s.block_idx != null && s.set_idx != null) {
                  const k = `${s.block_idx}-${s.set_idx}`;
                  (perSetAnnotations[k] = perSetAnnotations[k] || []).push(str);
                }
              }
            }

            return (
              <div key={li} className="multipace-page" style={{ padding: "0.5in", minHeight: "10in", pageBreakAfter: li === lanes.length - 1 ? "auto" : "always" }}>
                <div className="multipace-print-header" style={{ borderBottom: "2pt solid #000", paddingBottom: 8, marginBottom: 12 }}>
                  <div style={{ fontSize: "22pt", fontWeight: 700, margin: 0 }}>{headerTitleFor(lane)}</div>
                  <div style={{ fontSize: "11pt", fontStyle: "italic", marginTop: 4 }}>
                    {workout.typeLabel || workout.type || "Workout"} · {workout.totalYards} {(workout.poolMode === "25m" || workout.poolMode === "50m") ? "m" : "yds"}
                    {workout.focusNote ? <span> · {workout.focusNote}</span> : null}
                  </div>
                  {workoutLevelNotes.length > 0 && (
                    <div style={{ fontSize: "10pt", marginTop: 6, padding: "4pt 6pt", border: "0.5pt solid #000", background: "#f7f7f7" }}>
                      <strong>⚠ Constraints:</strong> {workoutLevelNotes.join(" · ")}
                    </div>
                  )}
                </div>
                {rescaled.map((block, bi) => {
                  const blockNotes = perBlockAnnotations[bi] || [];
                  return (
                    <div key={bi} className="multipace-block" style={{ border: "1pt solid #000", padding: "8pt 10pt", marginBottom: 10, pageBreakInside: "avoid", breakInside: "avoid" }}>
                      <div style={{ fontWeight: 700, fontSize: "12pt", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                        {block.name || block.label || block.section}
                        {block.label && block.name && block.label !== block.name ? <span style={{ fontWeight: 400, fontStyle: "italic", textTransform: "none", letterSpacing: 0, marginLeft: 6 }}>— {block.label}</span> : null}
                        <span style={{ float: "right", fontWeight: 400, fontStyle: "italic" }}>{block.totalYards}</span>
                      </div>
                      {blockNotes.length > 0 && (
                        <div style={{ fontSize: "9.5pt", fontStyle: "italic", marginBottom: 6, color: "#444" }}>
                          ⚠ {blockNotes.join(" · ")}
                        </div>
                      )}
                      {block.kind === "dryland"
                        ? (block.exercises || []).map((ex, ei) => (
                            <div key={"dl" + ei} style={{ marginBottom: 3, fontSize: "11pt" }}>
                              <b>{ex.sets > 1 ? `${ex.sets} × ${ex.reps}` : ex.reps}</b> — {ex.name}{ex.rest ? ` (rest ${ex.rest})` : ""}
                            </div>
                          ))
                        : (block.sets || []).map((s, si) => {
                        const setNotes = perSetAnnotations[`${bi}-${si}`] || [];
                        return (
                          <div key={si} style={{ marginBottom: 3, fontSize: "11pt" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                              <span><b>{s.reps}×{s.dist}</b>{s.eq ? <i style={{ marginLeft: 4 }}>[{s.eq}]</i> : null} {s.desc || ""}</span>
                              <span style={{ fontFamily: "ui-monospace, 'SFMono-Regular', monospace", marginLeft: 12, whiteSpace: "nowrap" }}>{s.interval || ""}</span>
                            </div>
                            {setNotes.length > 0 && (
                              <div style={{ fontSize: "9.5pt", fontStyle: "italic", color: "#444", paddingLeft: "1em", marginTop: 1 }}>
                                ⚠ {setNotes.join(" · ")}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {block.rounds && block.rounds > 1 ? (
                        <div style={{ fontStyle: "italic", marginTop: 4, fontSize: "10pt" }}>Rounds: {block.rounds}{block.roundRestSecs ? ` · rest ${block.roundRestSecs}s between rounds` : ""}</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      );
    }
