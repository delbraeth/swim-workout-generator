// src/components/workout/RestPickerModal.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { playRestCue, primeAudioCtx, REST_OPTIONS } from "../../app.jsx";

    export function RestPickerModal({ restSecs, onChange, onStart, onCancel, audioCues, onAudioCuesChange, lapButton, onLapButtonChange }) {
      return (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9998,
          background: "rgba(0,0,0,0.75)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}>
          <div style={{
            background: "var(--color-card)", borderRadius: 20, padding: "28px 24px",
            width: "100%", maxWidth: 360, border: "1px solid var(--color-border)",
          }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-text)", marginBottom: 4 }}>
              🏊 Start Workout
            </div>
            <div style={{ fontSize: 13, color: "var(--color-text-dim)", marginBottom: 20 }}>
              Rest between sets
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              {REST_OPTIONS.map(o => {
                const active = restSecs === o.value;
                return (
                  <button key={String(o.value)} onClick={() => onChange(o.value)} style={{
                    flex: 1, padding: "10px 0", borderRadius: 10,
                    border: `2px solid ${active ? "var(--color-primary)" : "var(--color-border)"}`,
                    background: active ? "#1e3a5f" : "var(--color-bg)",
                    color: active ? "var(--color-primary)" : "var(--color-text-dim)",
                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                  }}>
                    {o.label}
                  </button>
                );
              })}
            </div>
            {/* W1: audio-cue toggle */}
            {onAudioCuesChange && (
              <button onClick={() => {
                // Prime the audio context on the user gesture before toggling on,
                // and play a one-beat preview so the user hears what they enabled.
                if (!audioCues) { primeAudioCtx(); playRestCue("beep"); }
                onAudioCuesChange(!audioCues);
              }}
                title="Three beeps at T-3/T-2/T-1, distinct tone at go"
                style={{
                  width: "100%", marginBottom: 22,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", borderRadius: 10,
                  border: `1px solid ${audioCues ? "var(--color-primary)" : "var(--color-border)"}`,
                  background: audioCues ? "#1e3a5f" : "var(--color-bg)",
                  color: audioCues ? "var(--color-primary)" : "var(--color-text-dim)",
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}>
                <span>🔔 Audio cues</span>
                <span style={{ fontSize: 11, color: audioCues ? "var(--color-primary)" : "var(--color-border-strong)" }}>
                  {audioCues ? "ON · preview ▶" : "OFF"}
                </span>
              </button>
            )}
            {/* Run-screen v1: lap-button toggle. When OFF, PaceClockView drops
                the ✓ Lap action and the splits feedback pill; ⏸ Pause becomes
                the primary action. Default ON preserves existing UX. */}
            {onLapButtonChange && (
              <button onClick={() => onLapButtonChange(!lapButton)}
                title="✓ Lap button during sets — tap each rep to record split times. Off = timer auto-advances on hit, no manual lap input."
                style={{
                  width: "100%", marginBottom: 22,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", borderRadius: 10,
                  border: `1px solid ${lapButton ? "var(--color-primary)" : "var(--color-border)"}`,
                  background: lapButton ? "#1e3a5f" : "var(--color-bg)",
                  color: lapButton ? "var(--color-primary)" : "var(--color-text-dim)",
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}>
                <span>✋ Lap button</span>
                <span style={{ fontSize: 11, color: lapButton ? "var(--color-primary)" : "var(--color-border-strong)" }}>
                  {lapButton ? "ON · per-rep splits" : "OFF · auto-advance only"}
                </span>
              </button>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onCancel} style={{
                flex: 1, padding: "14px 0", borderRadius: 12,
                border: "1px solid var(--color-border)", background: "transparent",
                color: "var(--color-text-dim)", fontSize: 15, fontWeight: 600, cursor: "pointer",
              }}>
                Cancel
              </button>
              <button onClick={() => {
                // Prime audio context on the user gesture — first play after this
                // (the first T-3 beep) will work even on iOS Safari.
                if (audioCues) primeAudioCtx();
                onStart();
              }} style={{
                flex: 2, padding: "14px 0", borderRadius: 12,
                border: "none", background: "var(--color-primary)",
                color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
              }}>
                ▶ Start
              </button>
            </div>
          </div>
        </div>
      );
    }
