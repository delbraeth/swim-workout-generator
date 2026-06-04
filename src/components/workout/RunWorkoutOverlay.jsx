// src/components/workout/RunWorkoutOverlay.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { SECTION_EMOJIS, SECTION_STYLES } from "../../lib/constants.js";
import { PaceClockView } from "./PaceClockView.jsx";
import { StarRating } from "../StarRating.jsx";

    const { useState, useCallback, useMemo, useEffect } = React;

    export function RunWorkoutOverlay({ workout, restSecs, onClose, onLogAsToday, personalFirstName, audioCues = false, lapButton = true, unit = "yds" }) {
      const [idx, setIdx]               = useState(0);
      const [paceIdx, setPaceIdx]       = useState(null);
      const [elapsed, setElapsed]       = useState(0); // seconds since workout started
      const [autoStartNext, setAutoStartNext] = useState(false);
      const [showFinish, setShowFinish] = useState(false);
      const [finishDifficulty, setFinishDifficulty] = useState(null);
      const [logState, setLogState]     = useState("idle"); // idle | saving | saved | error
      const [logError, setLogError]     = useState(null);
      // E: flat array of all splits captured this session — {blockIdx, setIdx, rep, actual_secs, expected_secs, delta}
      const [allSplits, setAllSplits]   = useState([]);
      // Section model B3 — dryland checklist tick state (keyed "blockIdx:exIdx").
      const [drylandChecked, setDrylandChecked] = useState(() => new Set());
      const blocks  = workout.blocks;

      // Wall-clock elapsed timer — pauses once the workout is finished
      useEffect(() => {
        if (showFinish) return;
        const id = setInterval(() => setElapsed(e => e + 1), 1000);
        return () => clearInterval(id);
      }, [showFinish]);

      const allSets = useMemo(() =>
        blocks.flatMap((block, bIdx) =>
          (block.sets || []).map((set, sIdx) => ({ set, blockIdx: bIdx, setIdx: sIdx }))  // dryland: no swim sets
        ), [blocks]);

      // Marks the workout as completed — show the Finish screen instead of closing.
      const finishWorkout = useCallback(() => {
        setPaceIdx(null);
        setAutoStartNext(false);
        setShowFinish(true);
      }, []);

      const handlePaceNext = useCallback(() => {
        if (paceIdx + 1 < allSets.length) {
          const next = allSets[paceIdx + 1];
          setIdx(next.blockIdx);
          setPaceIdx(paceIdx + 1);
          setAutoStartNext(restSecs !== null); // auto-start if not manual
        } else {
          finishWorkout();
        }
      }, [paceIdx, allSets, restSecs, finishWorkout]);

      const handleLogClick = useCallback(async () => {
        if (!onLogAsToday) { onClose(); return; }
        setLogState("saving"); setLogError(null);
        const res = await onLogAsToday(workout, {
          difficulty: finishDifficulty || undefined,
          // E: bundle any captured splits into the new entry
          actualSplits: allSplits.length > 0 ? allSplits : undefined,
        });
        if (res.ok) {
          setLogState("saved");
          setTimeout(() => onClose(), 900);
        } else {
          setLogState("error");
          setLogError(res.error || "Save failed");
        }
      }, [onLogAsToday, workout, finishDifficulty, onClose, allSplits]);


      // Manual tap on a set card — never auto-starts
      function handleSetTap(globalIdx) {
        setPaceIdx(globalIdx);
        setAutoStartNext(false);
      }
      const block   = blocks[idx];
      const total   = blocks.length;
      const isFirst = idx === 0;
      const isLast  = idx === total - 1;
      const s       = SECTION_STYLES[block.section] || SECTION_STYLES.main;
      const emoji   = SECTION_EMOJIS[block.section] || "🏊";

      return (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "var(--color-bg)", overflowY: "auto",
          display: "flex", flexDirection: "column",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}>
          {/* Top bar: close + progress dots + counter */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "16px 20px", borderBottom: "1px solid var(--color-card)",
            position: "sticky", top: 0, background: "var(--color-bg)", zIndex: 1,
          }}>
            <button onClick={onClose} style={{
              background: "transparent", border: "none", color: "var(--color-text-muted)",
              fontSize: 28, lineHeight: 1, cursor: "pointer",
              padding: "4px 8px", borderRadius: 8, minWidth: 44, minHeight: 44,
            }}>✕</button>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {blocks.map((_, i) => (
                <div key={i} style={{
                  width: i === idx ? 28 : 8, height: 8, borderRadius: 999,
                  background: i === idx ? "var(--color-primary)" : "var(--color-border)",
                  transition: "width 0.2s",
                }} />
              ))}
            </div>
            <div style={{ fontSize: 13, color: "var(--color-text-dim)", fontWeight: 600, minWidth: 44, textAlign: "right" }}>
              {idx + 1}/{total}
            </div>
          </div>

          {/* Section model B3 — dryland blocks render a tick-off checklist
              instead of the pace-card sets. */}
          {block.kind === "dryland" ? (
          <>
            <div style={{ background: "#f0e2cc", padding: "24px 20px 20px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#7a4a12", textTransform: "uppercase", letterSpacing: "0.12em", opacity: 0.7, marginBottom: 6 }}>
                Section {idx + 1} of {total} · Dryland
              </div>
              <div style={{ fontSize: 34, fontWeight: 900, color: "#7a4a12", lineHeight: 1.1, marginBottom: 6 }}>
                🏋 {block.name}
              </div>
              <div style={{ fontSize: 15, color: "#7a4a12", opacity: 0.85, fontWeight: 600 }}>
                {block.placement === "post" ? "After pool" : "Before pool"} · tap to check off
              </div>
            </div>
            <div style={{ flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
              {(block.exercises || []).map((ex, i) => {
                const ck = `${idx}:${i}`;
                const done = drylandChecked.has(ck);
                return (
                  <div key={i}
                    onClick={() => setDrylandChecked(prev => { const n = new Set(prev); n.has(ck) ? n.delete(ck) : n.add(ck); return n; })}
                    style={{ display: "flex", alignItems: "center", gap: 14, background: "var(--color-card)", borderRadius: 14,
                      border: `1px solid ${done ? "#16a34a" : "var(--color-border)"}`, padding: "16px 18px", cursor: "pointer",
                      WebkitTapHighlightColor: "transparent", opacity: done ? 0.6 : 1, minHeight: 54 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      border: `2px solid ${done ? "#16a34a" : "var(--color-border-strong)"}`,
                      background: done ? "#16a34a" : "transparent", color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{done ? "✓" : ""}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1.1, textDecoration: done ? "line-through" : "none" }}>
                        {ex.sets > 1 ? `${ex.sets} × ${ex.reps}` : ex.reps}
                      </div>
                      <div style={{ fontSize: 16, color: "var(--color-text)", marginTop: 2 }}>
                        {ex.name}{ex.rest ? <span style={{ color: "var(--color-text-dim)", fontSize: 13 }}> · rest {ex.rest}</span> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
          ) : (
          <>
          {/* Section header */}
          <div style={{ background: s.headerBg, padding: "24px 20px 20px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: s.headerText, textTransform: "uppercase", letterSpacing: "0.12em", opacity: 0.7, marginBottom: 6 }}>
              Section {idx + 1} of {total}
            </div>
            <div style={{ fontSize: 34, fontWeight: 900, color: s.headerText, lineHeight: 1.1, marginBottom: 6 }}>
              {emoji} {block.name}
            </div>
            <div style={{ fontSize: 15, color: s.headerText, opacity: 0.85, fontWeight: 600 }}>
              {block.totalYards.toLocaleString()} {unit}
            </div>
            {workout.focusNote && (
              <div style={{ marginTop: 10, fontSize: 14, color: s.headerText, opacity: 0.92, fontStyle: "italic", fontWeight: 600 }}>
                🎯 {workout.focusNote}
              </div>
            )}
          </div>

          {/* Sets — tap any card to open the pace clock */}
          <div style={{ flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
            {(block.sets || []).map((set, i) => (
              <div key={i}
                onClick={() => handleSetTap(blocks.slice(0, idx).reduce((acc, b) => acc + (b.sets ? b.sets.length : 0), 0) + i)}
                style={{
                  background: "var(--color-card)", borderRadius: 14,
                  border: `1px solid ${s.border}`, padding: "18px 18px 14px",
                  cursor: "pointer", WebkitTapHighlightColor: "transparent",
                }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ fontSize: 30, fontWeight: 900, color: "#fff", marginBottom: 8, letterSpacing: "-0.02em", lineHeight: 1 }}>
                    {set.reps} <span style={{ color: "var(--color-border-strong)", fontWeight: 400 }}>×</span> {set.dist}
                    <span style={{ fontSize: 16, fontWeight: 500, color: "var(--color-text-dim)", marginLeft: 6 }}>{unit}</span>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--color-border)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", paddingTop: 4 }}>
                    ▶ pace
                  </span>
                </div>
                <div style={{ fontSize: 19, color: "var(--color-text)", lineHeight: 1.45, marginBottom: 10 }}>
                  {set.desc}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "baseline" }}>
                  <span style={{
                    background: "var(--color-bg)", color: "#38bdf8",
                    padding: "4px 12px", borderRadius: 999,
                    fontSize: 16, fontWeight: 700, fontFamily: "monospace",
                    whiteSpace: "nowrap",
                  }}>
                    ⏱ {set.interval}
                  </span>
                  <span style={{ color: "var(--color-text-muted)", fontSize: 16, fontStyle: "italic", lineHeight: 1.4 }}>
                    {set.focus}
                  </span>
                </div>
              </div>
            ))}
          </div>
          </>
          )}

          {/* Pace clock — rendered over this overlay when a set is tapped */}
          {paceIdx !== null && (
            <PaceClockView
              key={paceIdx}
              set={allSets[paceIdx].set}
              sectionName={workout.blocks[allSets[paceIdx].blockIdx].name}
              focusNote={workout.focusNote}
              onClose={() => setPaceIdx(null)}
              onNext={handlePaceNext}
              onWorkoutFinish={finishWorkout}
              onLap={(split) => setAllSplits(prev => [...prev, {
                blockIdx: allSets[paceIdx].blockIdx,
                setIdx:   allSets[paceIdx].setIdx,
                ...split,
              }])}
              isLastSet={paceIdx === allSets.length - 1}
              restSecs={restSecs}
              autoStart={autoStartNext}
              elapsed={elapsed}
              audioCues={audioCues}
              lapButton={lapButton}
              unit={unit}
            />
          )}

          {/* Navigation */}
          <div style={{
            display: "flex", gap: 12, padding: "16px 20px 36px",
            borderTop: "1px solid var(--color-card)", background: "var(--color-bg)",
            position: "sticky", bottom: 0,
          }}>
            {!isFirst ? (
              <button onClick={() => setIdx(i => i - 1)} style={{
                flex: 1, padding: "17px 0", borderRadius: 14,
                border: "1px solid var(--color-border)", background: "var(--color-card)",
                color: "var(--color-text)", fontSize: 17, fontWeight: 700, cursor: "pointer",
                minHeight: 54,
              }}>
                ← Previous
              </button>
            ) : (
              <div style={{ flex: 1 }} />
            )}
            <button onClick={() => isLast ? finishWorkout() : setIdx(i => i + 1)} style={{
              flex: isFirst ? 2 : 1, padding: "17px 0", borderRadius: 14,
              border: "none",
              background: isLast ? "#16a34a" : "var(--color-primary)",
              color: "#fff", fontSize: 17, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
              minHeight: 54,
            }}>
              {isLast ? "✓ Finish" : "Next →"}
            </button>
          </div>

          {/* Finish screen — appears after the user reaches the last set / clicks Finish */}
          {showFinish && (
            <div style={{
              position: "fixed", inset: 0, zIndex: 10001,
              background: "rgba(2,6,23,0.96)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 20,
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            }}>
              <div style={{
                width: "100%", maxWidth: 380,
                background: "var(--color-bg)", border: "1px solid var(--color-card)",
                borderRadius: 16, padding: "28px 22px 22px",
                textAlign: "center",
              }}>
                <div style={{ fontSize: 56, marginBottom: 8 }}>🎉</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginBottom: 4 }}>
                  {personalFirstName ? `Nice work, ${personalFirstName}!` : "Workout complete!"}
                </div>
                <div style={{ fontSize: 13, color: "var(--color-text-dim)", marginBottom: 20 }}>
                  {workout.totalYards.toLocaleString()} {unit} · {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
                  {allSplits.length > 0 && (
                    <> · <span style={{ color: "#86efac", fontWeight: 700 }}>{allSplits.length} split{allSplits.length === 1 ? "" : "s"} captured</span></>
                  )}
                </div>

                {/* Difficulty rating — optional, captured right after the swim while it's fresh */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                    How hard was it? <span style={{ color: "var(--color-border-strong)", textTransform: "none", letterSpacing: 0 }}>(optional)</span>
                  </div>
                  <div style={{ display: "inline-flex" }}>
                    <StarRating
                      value={finishDifficulty}
                      onChange={setFinishDifficulty}
                      size={28}
                      allowToggleClear
                    />
                  </div>
                </div>

                {logState === "saved" ? (
                  <div style={{ color: "#4ade80", fontSize: 15, fontWeight: 700, padding: "10px 0" }}>
                    ✓ Logged to your history{allSplits.length > 0 ? " (with splits)" : ""}
                  </div>
                ) : (
                  <>
                    <button
                      onClick={handleLogClick}
                      disabled={logState === "saving"}
                      style={{
                        width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
                        background: logState === "saving" ? "#1e3a5f" : "var(--color-primary)",
                        color: "#fff", fontSize: 15, fontWeight: 800,
                        cursor: logState === "saving" ? "default" : "pointer",
                        marginBottom: 10,
                      }}>
                      {logState === "saving"
                        ? "Saving…"
                        : allSplits.length > 0
                          ? `Log as today's session (with ${allSplits.length} split${allSplits.length === 1 ? "" : "s"})`
                          : "Log as today's session"}
                    </button>
                    {logState === "error" && (
                      <div style={{ color: "#fca5a5", fontSize: 12, marginBottom: 10 }}>
                        {logError}
                      </div>
                    )}
                    <button
                      onClick={onClose}
                      style={{
                        background: "transparent", border: "none",
                        color: "var(--color-text-dim)", fontSize: 13, cursor: "pointer",
                        padding: "6px 12px",
                      }}>
                      Close without logging
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }
