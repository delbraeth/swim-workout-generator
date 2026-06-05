// src/components/workout/YardageSlider.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { minYardsForType } from "../../lib/workout-helpers.js";
import { LESSON_MIN, LESSON_MAX } from "../../lib/engine.js";

    const { useState } = React;

    export function YardageSlider({ value, onChange, selectedType, poolMode = "25y", paceInput = "2:00", onPaceChange, sliderMin: sliderMinProp, sliderMax: sliderMaxProp, onRangeChange }) {
      const [activePreset, setActivePreset] = React.useState(null);
      const [editingBound, setEditingBound] = React.useState(null); // 'min' | 'max' | null
      const [boundDraft,   setBoundDraft]   = React.useState("");
      const is25m    = poolMode === "25m";
      const is50m    = poolMode === "50m";
      const isMeters = is25m || is50m;
      // Lesson tier (Phase 5) — fixed short band (800–1200), bypasses the user's
      // saved slider prefs and the standard 1900/2000 floor. Bounds aren't
      // user-editable for lesson.
      const isLesson    = selectedType === "lesson";
      const ABS_MIN     = isLesson ? LESSON_MIN : (isMeters ? 2000 : 1900);
      const ABS_MAX     = isLesson ? LESSON_MAX : 6000;
      const SLIDER_STEP = isLesson ? 100 : (is50m ? 100 : 50);     // SCM uses 50m step like SCY (more granular than LCM)
      const SLIDER_MIN  = isLesson ? LESSON_MIN : Math.max(ABS_MIN, sliderMinProp ?? ABS_MIN);
      const SLIDER_MAX  = isLesson ? LESSON_MAX : Math.min(ABS_MAX, sliderMaxProp ?? 5000);
      const unit = isMeters ? "m" : "yds";
      const pct = ((value - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN) * 100).toFixed(1);
      // 5 evenly-spaced ticks between SLIDER_MIN and SLIDER_MAX
      const ticks = [0,1,2,3,4].map(i => Math.round((SLIDER_MIN + i * (SLIDER_MAX - SLIDER_MIN) / 4) / SLIDER_STEP) * SLIDER_STEP);
      const tickLabel = v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);

      function commitBound(which, raw) {
        const parsed = parseInt(raw, 10);
        if (!isNaN(parsed)) {
          const snap = Math.round(parsed / SLIDER_STEP) * SLIDER_STEP;
          let newMin = SLIDER_MIN, newMax = SLIDER_MAX;
          if (which === "min") newMin = Math.max(ABS_MIN, Math.min(snap, SLIDER_MAX - SLIDER_STEP));
          if (which === "max") newMax = Math.min(ABS_MAX, Math.max(snap, newMin + SLIDER_STEP));
          if (newMin !== SLIDER_MIN || newMax !== SLIDER_MAX) {
            onRangeChange && onRangeChange(newMin, newMax);
          }
        }
        setEditingBound(null);
        setBoundDraft("");
      }

      const typeMin = selectedType ? minYardsForType(selectedType, poolMode) : null;
      const tooLow  = typeMin !== null && value < typeMin;

      return (
        <div style={{ background: "var(--color-card)", border: `1px solid ${tooLow ? "#7f1d1d" : "var(--color-border)"}`, borderRadius: 12, padding: "18px 20px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <div>
              <span style={{ color: "var(--color-text-muted)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>Max {isMeters ? "Distance" : "Yardage"}</span>
              <span style={{ color: "var(--color-text-dim)", fontSize: 11, marginLeft: 8 }}>(min locked at {SLIDER_MIN.toLocaleString()} {unit})</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ color: "#ffffff", fontSize: 26, fontWeight: 900 }}>{value.toLocaleString()}</span>
              <span style={{ color: "var(--color-text-muted)", fontSize: 12 }}>{unit}</span>
            </div>
          </div>

          {/* Pace input + time presets */}
          {(() => {
            function parsePaceSecs(p) {
              const parts = (p || "").trim().split(":");
              if (parts.length !== 2) return null;
              const m = parseInt(parts[0], 10), s = parseInt(parts[1], 10);
              if (isNaN(m) || isNaN(s) || m * 60 + s < 30) return null;
              return m * 60 + s;
            }
            function yardsForMins(mins) {
              const ps = parsePaceSecs(paceInput);
              if (!ps) return null;
              const y = Math.round(2400 * (mins / 60) * (120 / ps) / 50) * 50;
              return Math.min(5000, Math.max(isMeters ? 2000 : 1900, y));
            }
            const presets = [{ label: "~60 min", mins: 60 }, { label: "~90 min", mins: 90 }, { label: "~2 hr", mins: 120 }];
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                <span style={{ color: "var(--color-text-dim)", fontSize: 11 }}>Pace / 100 {unit}:</span>
                <input
                  type="text"
                  value={paceInput}
                  data-tour="step-pace-input"
                  onChange={e => { setActivePreset(null); onPaceChange && onPaceChange(e.target.value); }}
                  placeholder="M:SS"
                  style={{ width: 52, fontFamily: "monospace", fontSize: 13, padding: "4px 7px", borderRadius: 6,
                           border: "1px solid var(--color-border-strong)", background: "var(--color-bg)", color: "var(--color-text)", outline: "none" }}
                />
                {!isLesson && presets.map(({ label, mins }) => {
                  const y = yardsForMins(mins);
                  const active = activePreset === label;
                  return (
                    <button key={label} onClick={() => { if (y) { setActivePreset(label); onChange(y); } }} disabled={!y}
                      style={{ fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 6,
                               border: `1px solid ${active ? "var(--color-primary)" : "var(--color-border)"}`,
                               background: active ? "#1d4ed8" : "var(--color-bg)",
                               color: active ? "#fff" : "var(--color-text-muted)", cursor: y ? "pointer" : "not-allowed" }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {/* Visual track + invisible native input on top */}
          <div style={{ position: "relative", marginBottom: 4 }}>
            <div style={{ height: 6, borderRadius: 3, background: "var(--color-border)", position: "relative" }}>
              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`,
                            background: tooLow ? "linear-gradient(90deg,#ef4444,#f87171)" : "linear-gradient(90deg,var(--color-primary),var(--color-primary))",
                            borderRadius: 3 }} />
            </div>
            <input type="range" min={SLIDER_MIN} max={SLIDER_MAX} step={SLIDER_STEP} value={value}
              onChange={e => { setActivePreset(null); onChange(Number(e.target.value)); }}
              style={{ position: "absolute", top: -4, left: 0, width: "100%", opacity: 0, height: 14, cursor: "pointer", margin: 0 }} />
          </div>

          {/* Tick labels — first and last are editable bounds */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            {ticks.map((v, i) => {
              const isMin = i === 0, isMax = i === ticks.length - 1;
              // Lesson bounds are fixed (not user-editable) — don't expose ✎ edit.
              const boundKey = isLesson ? null : (isMin ? "min" : isMax ? "max" : null);
              if (boundKey && editingBound === boundKey) {
                return (
                  <input key={v} type="number" value={boundDraft} autoFocus
                    onChange={e => setBoundDraft(e.target.value)}
                    onBlur={() => commitBound(boundKey, boundDraft)}
                    onKeyDown={e => { if (e.key === "Enter") commitBound(boundKey, boundDraft); if (e.key === "Escape") { setEditingBound(null); setBoundDraft(""); } }}
                    style={{ width: 52, fontSize: 10, fontFamily: "monospace", padding: "1px 4px", borderRadius: 4,
                             border: "1px solid var(--color-primary)", background: "var(--color-bg)", color: "var(--color-primary)", outline: "none" }} />
                );
              }
              return (
                <span key={v}
                  onClick={() => boundKey ? (setEditingBound(boundKey), setBoundDraft(String(v))) : onChange(v)}
                  title={boundKey ? `Click to set ${boundKey} yardage` : undefined}
                  style={{ fontSize: 10, cursor: "pointer",
                            color: v === value ? "var(--color-primary)" : v < (typeMin||0) ? "#7f1d1d" : "var(--color-border-strong)",
                            fontWeight: v === value ? 700 : 400,
                            textDecoration: boundKey ? "underline dotted" : undefined }}>
                  {tickLabel(v)}{boundKey ? " ✎" : ""}
                </span>
              );
            })}
          </div>

          {/* Status row */}
          {tooLow ? (
            <div style={{ background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <div>
                <span style={{ color: "#fca5a5", fontSize: 12, fontWeight: 600 }}>
                  This workout type needs at least {typeMin.toLocaleString()} {unit}.
                </span>
                <span style={{ color: "var(--color-destructive)", fontSize: 12 }}> Raise the max or choose a different type.</span>
              </div>
            </div>
          ) : typeMin !== null ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "var(--color-text-dim)" }}>Workout range:</span>
              <span style={{ fontSize: 11, color: "#34d399", background: "#064e3b", borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>
                {typeMin.toLocaleString()} – {value.toLocaleString()} {unit} ✓
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "var(--color-text-dim)" }}>Select a workout type to see its range.</span>
            </div>
          )}
        </div>
      );
    }
