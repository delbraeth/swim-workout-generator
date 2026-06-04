// src/components/practices/IntentPreviewOverlay.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { csrfHeaders, makeEntryId } from "../../lib/shared.js";

    const { useState } = React;

    export function IntentPreviewOverlay({ scheduledRow, generatedWorkout, onRegenerate, onRun, onSave, onClose }) {
      const [busy, setBusy] = React.useState(false);
      const [err,  setErr]  = React.useState(null);
      const w = generatedWorkout;

      // Commit the generated workout to the schedule row. Returns true if
      // committed successfully. Shared between Save (no Run mode handoff)
      // and Run (commit + enter Run mode).
      const commit = async () => {
        setBusy(true); setErr(null);
        try {
          // Enrich payload with form context so ✎ Edit on the row later can
          // restore generator state (intent_params + defaults fill in fields
          // not carried in the raw workout output).
          const ip = scheduledRow.intent_params || {};
          const enrichedPayload = {
            ...w,
            maxYardsCap: w.maxYardsCap || Number(ip.maxYards) || 2400,
            poolMode:    w.poolMode    || "25y",
            equipment:   w.equipment   || ip.equipment || { kickboard: "off", fins: "off", paddles: "off", pullBuoy: "off", snorkel: "off" },
          };

          // I Phase 2b — branch by intent mode:
          //   * Group intent (has group_id): route through /api/log-workout
          //     which creates the coach's history entry, fans out assignments,
          //     and (via the Phase 2b dbLinkCompletedToSchedule enhancement)
          //     flips the schedule row intent→payload atomically.
          //   * Self intent: simple PATCH — no history entry until coach
          //     actually swims it.
          if (ip.group_id) {
            const entry = {
              ...enrichedPayload,
              id:            makeEntryId(),
              savedAt:       new Date().toISOString(),
              dateCompleted: scheduledRow.scheduled_date,
              type:          enrichedPayload.typeId,
              typeLabel:     w.assignment_target?.group_name ? `${w.assignment_target.group_name} workout` : (enrichedPayload.typeId || "workout"),
              totalYards:    w.totalYards,
              estimatedMin:  w.estimatedMin,
              maxYardsCap:   enrichedPayload.maxYardsCap,
              poolMode:      enrichedPayload.poolMode,
              equipment:     enrichedPayload.equipment,
              blocks:        w.blocks,
              notes:         (scheduledRow.notes || "").slice(0, 1000),
              focusNote:     enrichedPayload.focusNote || undefined,
              completed:     scheduledRow.scheduled_date <= new Date().toISOString().slice(0, 10),
              scheduled_id:  scheduledRow.id,
              assign_to: {
                group_id: ip.group_id,
                ...(ip.lane_plan_id ? { lane_plan_id: ip.lane_plan_id } : {}),
              },
              assignment_target: w.assignment_target || undefined,
            };
            const res = await fetch("/api/log-workout", {
              method:  "POST",
              headers: { "Content-Type": "application/json", ...csrfHeaders() },
              body:    JSON.stringify(entry),
            });
            const j = await res.json().catch(() => ({}));
            if (!res.ok || !j.ok) {
              throw new Error(j.error || `HTTP ${res.status}`);
            }
          } else {
            // Self-only — Phase 2a flow.
            const res = await fetch(`/api/scheduled-workouts/${scheduledRow.id}`, {
              method:  "PATCH",
              headers: { "Content-Type": "application/json", ...csrfHeaders() },
              body:    JSON.stringify({ payload: enrichedPayload }),
            });
            if (!res.ok) {
              const j = await res.json().catch(() => ({}));
              throw new Error(j.error || `HTTP ${res.status}`);
            }
          }
          return true;
        } catch (e) {
          setErr(e.message);
          setBusy(false);
          return false;
        }
      };

      const handleRun = async () => {
        const ok = await commit();
        if (ok) onRun(w);  // parent loads into Run mode + tags runScheduledId
      };
      const handleSave = async () => {
        const ok = await commit();
        if (ok && onSave) onSave(w);  // parent refreshes week view + closes
      };

      return (
        <div onClick={onClose} style={{
          position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.90)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 12,
            padding: 22, maxWidth: 720, width: "100%", maxHeight: "90vh", overflowY: "auto",
          }}>
            <div style={{ color: "var(--color-warn)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>Preview generated workout</div>
            <div style={{ color: "var(--color-text)", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{w?.typeLabel || w?.type || "Workout"} · {w?.totalYards || 0}y</div>
            <div style={{ color: "var(--color-text-muted)", fontSize: 12, marginBottom: 14 }}>
              Generated from intent for {scheduledRow.scheduled_date}. Regenerate for a different shuffle, or run as-is.
            </div>

            {w && w.blocks && w.blocks.map((b, i) => (
              <div key={i} className="card" style={{ padding: 10, borderRadius: 6, marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                  <span style={{ color: "var(--color-text)", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {b.name || b.section}{b.label && ` — ${b.label}`}
                  </span>
                  <span style={{ color: "var(--color-text-dim)", fontSize: 11 }}>{b.totalYards}y</span>
                </div>
                {b.sets && b.sets.map((s, si) => (
                  <div key={si} style={{ fontSize: 12, color: "#cbd5e1", display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span><strong>{s.reps}×{s.dist}</strong>{s.eq ? <em style={{ marginLeft: 4 }}>[{s.eq}]</em> : null} {s.desc || ""}</span>
                    <span style={{ fontFamily: "ui-monospace, monospace", marginLeft: 8, color: "var(--color-text-muted)" }}>{s.interval || ""}</span>
                  </div>
                ))}
              </div>
            ))}

            {err && <div style={{ color: "#fca5a5", fontSize: 12, marginTop: 6 }}>{err}</div>}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
              <button onClick={onClose} disabled={busy}
                className="btn btn-lg btn-outlined btn-neutral">Cancel</button>
              <button onClick={() => onRegenerate(w)} disabled={busy}
                style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid var(--color-primary)", background: "transparent", color: "var(--color-primary)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>↻ Regenerate</button>
              <button onClick={handleSave} disabled={busy}
                title={scheduledRow.intent_params?.group_id ? "Commit this workout and assign to the group, without entering Run mode" : "Commit this workout to the schedule, without entering Run mode"}
                style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid var(--color-warn)", background: "transparent", color: "var(--color-warn)", fontSize: 13, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer" }}>
                {busy ? "…" : "💾 Save"}
              </button>
              <button onClick={handleRun} disabled={busy}
                title="Commit this workout AND open Run mode for the swim"
                className="btn btn-lg btn-filled btn-positive">
                {busy ? "…" : "▶ Run this"}
              </button>
            </div>
          </div>
        </div>
      );
    }
