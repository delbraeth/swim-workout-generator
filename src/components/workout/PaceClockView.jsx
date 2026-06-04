// src/components/workout/PaceClockView.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { fmtTime, parseIntervalSeconds, playRestCue, useIsLandscape } from "../../lib/shared.js";

    const { useState, useEffect } = React;

    export function PaceClockView({ set, sectionName, focusNote, onClose, onNext, onWorkoutFinish, onLap, isLastSet, restSecs, autoStart, elapsed, audioCues = false, lapButton = true, unit = "yds" }) {
      const totalSecs  = parseIntervalSeconds(set.interval);
      const hasTimer   = totalSecs !== null;
      const isLandscape = useIsLandscape();

      const [repIdx,    setRepIdx]   = useState(0);
      const [secsLeft,  setSecsLeft] = useState(totalSecs ?? 0);
      const [running,   setRunning]  = useState(() => !!(autoStart && totalSecs !== null));
      const [finished,  setFinished] = useState(false);
      const [restLeft,  setRestLeft] = useState(null); // null = not in rest phase
      // E: lap-split state. `lastSplit` shows transient feedback after each lap;
      // `setSplits` is the running list for this single set (parent merges across sets).
      const [lastSplit, setLastSplit] = useState(null);
      const [setSplits, setSetSplits] = useState([]);

      // Tick down every second while running
      useEffect(() => {
        if (!running || !hasTimer) return;
        const id = setInterval(() => setSecsLeft(s => Math.max(0, s - 1)), 1000);
        return () => clearInterval(id);
      }, [running, hasTimer]);

      // When countdown hits zero, record an on-time split and advance rep or finish.
      useEffect(() => {
        if (!running || !hasTimer || secsLeft !== 0) return;
        // E: auto-advance = swimmer made the interval exactly (delta 0).
        recordSplit(totalSecs);
        if (repIdx + 1 >= set.reps) {
          setRunning(false);
          setFinished(true);
        } else {
          setRepIdx(r => r + 1);
          setSecsLeft(totalSecs);
        }
      }, [secsLeft, running, hasTimer]);

      // E: helper — record a split for the current rep and bubble up to parent.
      function recordSplit(actualSecs) {
        if (!hasTimer) return;
        const split = {
          rep:           repIdx,
          actual_secs:   Math.max(0, Math.round(actualSecs)),
          expected_secs: totalSecs,
          delta:         Math.round(actualSecs) - totalSecs,
        };
        setSetSplits(prev => [...prev, split]);
        setLastSplit(split);
        if (onLap) onLap(split);
      }

      function handleLap() {
        if (!hasTimer || !running) return;
        const actualSecs = totalSecs - secsLeft;
        if (actualSecs <= 0) return; // ignore taps before the rep has run
        recordSplit(actualSecs);
        if (repIdx + 1 >= set.reps) {
          setRunning(false);
          setFinished(true);
        } else {
          setRepIdx(r => r + 1);
          setSecsLeft(totalSecs);
        }
      }

      // When a set finishes, kick off rest phase (or 1.5s flash for 0s)
      useEffect(() => {
        if (!finished || isLastSet || restSecs === null) return;
        if (restSecs === 0) {
          const id = setTimeout(() => { if (onNext) onNext(); }, 1500);
          return () => clearTimeout(id);
        }
        setRestLeft(restSecs);
      }, [finished, isLastSet, restSecs, onNext]);

      // Tick rest countdown; call onNext when it reaches zero.
      // W1: fire audio cues on the 3/2/1 beeps and the 0 "go" tone.
      useEffect(() => {
        if (restLeft === null) return;
        if (audioCues) {
          if (restLeft === 0)                 playRestCue("go");
          else if (restLeft <= 3)             playRestCue("beep");
        }
        if (restLeft === 0) { if (onNext) onNext(); return; }
        const id = setTimeout(() => setRestLeft(r => r - 1), 1000);
        return () => clearTimeout(id);
      }, [restLeft, audioCues]);

      const handleReset = () => {
        setRunning(false);
        setFinished(false);
        setRepIdx(0);
        setSecsLeft(totalSecs ?? 0);
        // E: dump in-progress splits — resetting means "swim this set over."
        setSetSplits([]);
        setLastSplit(null);
      };

      const handleSkip = () => {
        if (repIdx + 1 >= set.reps) {
          setRunning(false);
          setFinished(true);
        } else {
          setRepIdx(r => r + 1);
          setSecsLeft(totalSecs ?? 0);
        }
      };

      const isAtStart = repIdx === 0 && secsLeft === (totalSecs ?? 0) && !running;

      // E: split feedback — running avg across this set plus last-rep delta.
      const avgDelta = setSplits.length > 0
        ? Math.round(setSplits.reduce((s, sp) => s + sp.delta, 0) / setSplits.length)
        : null;
      const fmtSigned = (n) => {
        if (n == null) return "—";
        const abs = Math.abs(n);
        const m = Math.floor(abs / 60);
        const s = abs % 60;
        const t = m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `0:${String(s).padStart(2, "0")}`;
        return (n > 0 ? "+" : n < 0 ? "−" : "±") + t;
      };
      const splitFeedback = lapButton && hasTimer && (setSplits.length > 0 || lastSplit) && (
        <div className="screen-only" style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 14,
          padding: "6px 12px", borderRadius: 999,
          background: "rgba(15,23,42,0.6)", border: "1px solid var(--color-card)",
          fontVariantNumeric: "tabular-nums",
          fontSize: isLandscape ? 13 : 14,
        }}>
          {lastSplit && (
            <span style={{
              color: lastSplit.delta < 0 ? "#86efac" : lastSplit.delta > 0 ? "#fca5a5" : "#cbd5e1",
              fontWeight: 800,
            }}>
              last {fmtSigned(lastSplit.delta)} <span style={{ color: "var(--color-border-strong)", fontWeight: 400 }}>· {fmtTime(lastSplit.actual_secs)}</span>
            </span>
          )}
          {avgDelta !== null && setSplits.length > 1 && (
            <span style={{ color: "var(--color-text-muted)" }}>
              avg ∆ <span style={{ color: avgDelta < 0 ? "#86efac" : avgDelta > 0 ? "#fca5a5" : "#cbd5e1", fontWeight: 700 }}>{fmtSigned(avgDelta)}</span>
              <span style={{ color: "var(--color-border-strong)" }}> · {setSplits.length}/{set.reps}</span>
            </span>
          )}
        </div>
      );

      // Rep dots shared between portrait and landscape
      const repDots = set.reps <= 20 && (
        <div style={{ display: "flex", gap: isLandscape ? 16 : 12, flexWrap: "wrap", justifyContent: "center" }}>
          {Array.from({ length: set.reps }).map((_, i) => (
            <div key={i} style={{
              width: isLandscape ? 28 : 18, height: isLandscape ? 28 : 18,
              borderRadius: "50%",
              background: i < repIdx ? "var(--color-positive)" : i === repIdx ? "var(--color-primary)" : "var(--color-card)",
              border: `2px solid ${i < repIdx ? "var(--color-positive)" : i === repIdx ? "var(--color-primary)" : "var(--color-border)"}`,
              transition: "background 0.3s, border-color 0.3s",
            }} />
          ))}
        </div>
      );

      // Controls shared between portrait and landscape
      const btnBase = {
        borderRadius: 16, fontWeight: 700, cursor: "pointer",
        padding: isLandscape ? "14px 0" : "22px 0",
        minHeight: isLandscape ? 60 : 70,
        fontSize: isLandscape ? 18 : 22,
      };
      const controls = (
        <div style={{ display: "flex", gap: isLandscape ? 10 : 14, width: "100%" }}>
          {!finished && (
            <>
              {hasTimer && running ? (
                lapButton ? (
                  // E: when timer is running AND lap button is on, the primary
                  // action is "✓ Lap" — coach taps each rep to record splits.
                  <>
                    <button onClick={handleLap} style={{
                      ...btnBase, flex: 2, border: "none", background: "#16a34a",
                      color: "#fff", fontSize: isLandscape ? 20 : 26, fontWeight: 800,
                    }}>
                      ✓ Lap
                    </button>
                    <button onClick={() => setRunning(false)} style={{
                      ...btnBase, flex: 1, border: "1px solid var(--color-border)",
                      background: "var(--color-bg)", color: "#cbd5e1",
                    }}>
                      ⏸
                    </button>
                  </>
                ) : (
                  // Run-screen v1: lap button OFF — primary action is Pause
                  // (no manual lap input; timer auto-advances on hit).
                  <button onClick={() => setRunning(false)} style={{
                    ...btnBase, flex: 2, border: "none",
                    background: "var(--color-primary)",
                    color: "#fff", fontSize: isLandscape ? 20 : 26, fontWeight: 800,
                  }}>
                    ⏸ Pause
                  </button>
                )
              ) : hasTimer ? (
                <button onClick={() => setRunning(r => !r)} style={{
                  ...btnBase, flex: 2, border: "none",
                  background: "var(--color-primary)",
                  color: "#fff", fontSize: isLandscape ? 20 : 26, fontWeight: 800,
                }}>
                  {isAtStart ? "▶ Start" : "▶ Resume"}
                </button>
              ) : (
                <button onClick={handleSkip} style={{
                  ...btnBase, flex: 2, border: "none", background: "var(--color-primary)",
                  color: "#fff", fontSize: isLandscape ? 20 : 26, fontWeight: 800,
                }}>
                  {repIdx + 1 >= set.reps ? "Done ✓" : "Next Rep →"}
                </button>
              )}
              {hasTimer && (
                <button onClick={handleSkip} style={{
                  ...btnBase, flex: 1, border: "1px solid var(--color-border)",
                  background: "var(--color-bg)", color: "var(--color-text-dim)",
                }}>
                  Skip →
                </button>
              )}
            </>
          )}
          {!finished ? (
            <button onClick={handleReset} style={{
              ...btnBase, border: "1px solid var(--color-card)", background: "transparent",
              color: "var(--color-border-strong)", width: isLandscape ? undefined : "100%",
            }}>
              ↺ Reset
            </button>
          ) : isLastSet ? (
            <button onClick={onWorkoutFinish || onClose} style={{
              ...btnBase, flex: 1, border: "1px solid #16a34a",
              background: "#16a34a22", color: "#86efac",
            }}>
              Finish ✓
            </button>
          ) : restSecs === null ? (
            <button onClick={onNext || onClose} style={{
              ...btnBase, flex: 1, border: "1px solid var(--color-card)",
              background: "transparent", color: "var(--color-border-strong)",
            }}>
              Next Set →
            </button>
          ) : restLeft !== null && restLeft > 0 ? (
            <button onClick={() => setRestLeft(0)} style={{
              ...btnBase, flex: 1, border: "1px solid var(--color-warn)",
              background: "transparent", color: "var(--color-warn)",
            }}>
              Skip Rest →
            </button>
          ) : null}
        </div>
      );

      if (isLandscape) {
        // ── LANDSCAPE: two-column layout ──────────────────────────────
        // Run-screen v1 rebuild for poolside glance-readability:
        //  - Info hierarchy swapped: live state (REP X OF Y, clock) dominates
        //    over static set info on the left.
        //  - Clock grown 80→128. State label ("INTERVAL"/"REST"/"GO") sits
        //    above the number so glance disambiguates without reading color.
        //  - repDots moved to the right column under the clock (dynamic state
        //    with dynamic state). splitFeedback stays on the left.
        //  - Column ratio flipped 1.1:1 → 1:1.2 so the clock side gets the
        //    extra real estate.
        //  - Right column wrapped in a min-height container so the swap
        //    between running / REST / Set Complete doesn't shift layout.

        // State label + color drive the glance disambiguation.
        let phaseLabel = null;
        let phaseColor = "var(--color-text-dim)";
        if (finished && restLeft !== null && restLeft > 0) {
          if (restLeft <= 3) { phaseLabel = "GO IN"; phaseColor = "#4ade80"; }
          else               { phaseLabel = "REST";  phaseColor = "var(--color-warn)"; }
        } else if (finished) {
          phaseLabel = null; // celebration screen has its own headline
        } else if (hasTimer) {
          phaseLabel = "INTERVAL"; phaseColor = running ? "var(--color-text)" : "var(--color-border-strong)";
        } else {
          phaseLabel = "FREE";     phaseColor = "var(--color-border-strong)";
        }

        return (
          <div style={{
            position: "fixed", inset: 0, zIndex: 10000,
            background: "#020617",
            display: "flex", flexDirection: "column",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          }}>
            {/* Top bar */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 16px", borderBottom: "1px solid var(--color-card)", flexShrink: 0,
            }}>
              <button onClick={onClose} style={{
                background: "transparent", border: "none", color: "var(--color-text-muted)",
                fontSize: 28, lineHeight: 1, cursor: "pointer",
                padding: "4px 8px", borderRadius: 8, minWidth: 44, minHeight: 44,
              }}>✕</button>
              <div style={{ textAlign: "center", minWidth: 0, flex: 1, padding: "0 8px" }}>
                <div style={{ fontSize: 15, color: "var(--color-border-strong)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  {sectionName || "Pace Clock"}
                </div>
                {focusNote && (
                  <div style={{ fontSize: 12, color: "var(--color-primary)", fontStyle: "italic", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    🎯 {focusNote}
                  </div>
                )}
              </div>
              <div style={{ minWidth: 44, textAlign: "right" }}>
                {elapsed !== undefined && (
                  <div style={{ fontSize: 36, color: "var(--color-warn)", fontWeight: 700, fontFamily: "monospace", letterSpacing: "0.04em" }}>
                    {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
                  </div>
                )}
              </div>
            </div>

            {/* Two-column content — right column gets more room */}
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

              {/* Left: set info (now visually secondary to the clock) */}
              <div style={{
                flex: 1, display: "flex", flexDirection: "column",
                justifyContent: "center", padding: "12px 20px",
                borderRight: "1px solid var(--color-card)",
              }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "var(--color-text)", marginBottom: 8 }}>
                  {set.reps} × {set.dist} {unit}
                </div>
                <div style={{ fontSize: 24, color: "#cbd5e1", lineHeight: 1.35, marginBottom: 6 }}>
                  {set.desc}
                </div>
                <div style={{ fontSize: 22, color: "var(--color-border-strong)", fontFamily: "monospace" }}>
                  {set.interval}
                </div>
                {splitFeedback && <div style={{ marginTop: 14 }}>{splitFeedback}</div>}
              </div>

              {/* Right: clock — bigger flex, bigger number, label above */}
              <div style={{
                flex: 1.2, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", padding: "12px 16px",
              }}>
                {/* Min-height container kills layout shift between states */}
                <div style={{
                  minHeight: 220, width: "100%",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                }}>
                  {finished ? (
                    restLeft !== null && restLeft > 0 ? (
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: phaseColor, letterSpacing: "0.14em", marginBottom: 8 }}>
                          {phaseLabel}
                        </div>
                        <div style={{ fontSize: 128, fontWeight: 900, color: phaseColor, fontFamily: "monospace", letterSpacing: "-0.03em", lineHeight: 1 }}>
                          {restLeft}
                        </div>
                        <div style={{ fontSize: 13, color: "var(--color-text-dim)", marginTop: 8 }}>Next set starting soon…</div>
                      </div>
                    ) : (
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 56, marginBottom: 10 }}>✅</div>
                        <div style={{ fontSize: 32, fontWeight: 800, color: "#4ade80" }}>Set Complete!</div>
                        <div style={{ fontSize: 18, color: "var(--color-text-dim)", marginTop: 8 }}>
                          {set.reps} rep{set.reps !== 1 ? "s" : ""} done
                        </div>
                      </div>
                    )
                  ) : (
                    <>
                      <div style={{ fontSize: 32, fontWeight: 700, color: "var(--color-text-dim)", marginBottom: 8, letterSpacing: "0.06em" }}>
                        REP <span style={{ color: "var(--color-text)" }}>{repIdx + 1}</span>
                        {" "}<span style={{ color: "var(--color-border)" }}>OF</span>{" "}
                        {set.reps}
                      </div>
                      {phaseLabel && (
                        <div style={{ fontSize: 13, fontWeight: 800, color: phaseColor, letterSpacing: "0.14em", marginBottom: 4 }}>
                          {phaseLabel}
                        </div>
                      )}
                      {hasTimer ? (
                        <div style={{
                          fontSize: 128, fontWeight: 900,
                          color: running ? "#ffffff" : "var(--color-border)",
                          fontFamily: "monospace", letterSpacing: "-0.03em", lineHeight: 1,
                          transition: "color 0.25s",
                        }}>
                          {fmtTime(secsLeft)}
                        </div>
                      ) : (
                        <div style={{ fontSize: 22, color: "var(--color-border-strong)", fontStyle: "italic" }}>
                          Swim easy
                        </div>
                      )}
                      {repDots && <div style={{ marginTop: 14 }}>{repDots}</div>}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div style={{ padding: "10px 16px 14px", borderTop: "1px solid var(--color-card)", flexShrink: 0 }}>
              {controls}
            </div>
          </div>
        );
      }

      // ── PORTRAIT: original vertical layout ────────────────────────
      return (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10000,
          background: "#020617",
          display: "flex", flexDirection: "column", alignItems: "center",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}>
          {/* Top bar */}
          <div style={{
            width: "100%", display: "flex", justifyContent: "space-between",
            alignItems: "center", padding: "16px 20px",
            borderBottom: "1px solid var(--color-card)",
          }}>
            <button onClick={onClose} style={{
              background: "transparent", border: "none", color: "var(--color-text-muted)",
              fontSize: 36, lineHeight: 1, cursor: "pointer",
              padding: "4px 8px", borderRadius: 8, minWidth: 52, minHeight: 52,
            }}>✕</button>
            <div style={{ textAlign: "center", minWidth: 0, flex: 1, padding: "0 8px" }}>
              <div style={{ fontSize: 18, color: "var(--color-border-strong)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                {sectionName || "Pace Clock"}
              </div>
              {focusNote && (
                <div style={{ fontSize: 13, color: "var(--color-primary)", fontStyle: "italic", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  🎯 {focusNote}
                </div>
              )}
            </div>
            <div style={{ minWidth: 52, textAlign: "right" }}>
              {elapsed !== undefined && (
                <div style={{ fontSize: 36, color: "var(--color-warn)", fontWeight: 700, fontFamily: "monospace", letterSpacing: "0.04em" }}>
                  {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
                </div>
              )}
            </div>
          </div>

          {/* Set description + interval label */}
          <div style={{ width: "100%", padding: "20px 24px 0", textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--color-text)", lineHeight: 1.3, marginBottom: 8 }}>
              {set.reps} × {set.dist} {unit}
            </div>
            <div style={{ fontSize: 30, color: "#cbd5e1", lineHeight: 1.4, marginBottom: 8 }}>
              {set.desc}
            </div>
            <div style={{ fontSize: 20, color: "var(--color-border-strong)", fontFamily: "monospace" }}>
              {set.interval}
            </div>
          </div>

          {/* Clock area */}
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            width: "100%", padding: "0 24px",
          }}>
            {finished ? (
              restLeft !== null ? (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-warn)", letterSpacing: "0.12em", marginBottom: 8 }}>REST</div>
                  <div style={{ fontSize: 110, fontWeight: 900, color: "var(--color-warn)", fontFamily: "monospace", letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 20 }}>
                    {restLeft}
                  </div>
                  <div style={{ fontSize: 16, color: "var(--color-text-dim)" }}>Next set starting soon…</div>
                </div>
              ) : (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 72, marginBottom: 16 }}>✅</div>
                  <div style={{ fontSize: 38, fontWeight: 800, color: "#4ade80" }}>Set Complete!</div>
                  <div style={{ fontSize: 24, color: "var(--color-text-dim)", marginTop: 12 }}>
                    {set.reps} rep{set.reps !== 1 ? "s" : ""} done
                  </div>
                </div>
              )
            ) : (
              <>
                <div style={{ fontSize: 28, fontWeight: 700, color: "var(--color-text-dim)", marginBottom: 16, letterSpacing: "0.06em" }}>
                  REP <span style={{ color: "var(--color-text)" }}>{repIdx + 1}</span>
                  {" "}<span style={{ color: "var(--color-border)" }}>OF</span>{" "}
                  {set.reps}
                </div>
                {hasTimer ? (
                  <div style={{
                    fontSize: 110, fontWeight: 900,
                    color: running ? "#ffffff" : "var(--color-border)",
                    fontFamily: "monospace", letterSpacing: "-0.03em", lineHeight: 1,
                    marginBottom: 28, transition: "color 0.25s",
                  }}>
                    {fmtTime(secsLeft)}
                  </div>
                ) : (
                  <div style={{ fontSize: 26, color: "var(--color-border-strong)", marginBottom: 28, fontStyle: "italic" }}>
                    No interval — swim easy
                  </div>
                )}
                <div style={{ marginBottom: 8 }}>{repDots}</div>
                {splitFeedback && <div style={{ marginTop: 12 }}>{splitFeedback}</div>}
              </>
            )}
          </div>

          {/* Controls */}
          <div style={{ width: "100%", padding: "0 20px 40px", display: "flex", flexDirection: "column", gap: 14 }}>
            {controls}
          </div>
        </div>
      );
    }
