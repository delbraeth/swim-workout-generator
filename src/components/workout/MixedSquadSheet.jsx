// src/components/workout/MixedSquadSheet.jsx — 🔱 coach deck sheet for a mixed squad.
// Renders ONE practice as two answer keys side by side: the pool-swimmer set and the
// triathlete variant, on the SAME shared send-off skeleton (panel: "one clock, two
// answer keys"). React is a runtime global. Pure presentational — derives the tri
// variant via the engine transform; no state.
import { triVariantOfWorkout } from "../../lib/engine.js";

export function MixedSquadSheet({ workout, poolMode = "25y" }) {
  if (!workout || !Array.isArray(workout.blocks)) return null;
  const unit = poolMode === "25y" ? "yd" : "m";
  const tri  = triVariantOfWorkout(workout);
  const anySwap = !!tri._triVariant;

  const cell = { fontSize: 12, lineHeight: 1.4, padding: "4px 8px" };
  const head = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", padding: "4px 8px" };

  return (
    <div style={{ marginTop: 14, border: "1px solid var(--color-primary)", borderRadius: 10, overflow: "hidden", background: "var(--color-card)" }}>
      <div style={{ padding: "10px 12px", background: "#1e3a5f", color: "var(--color-primary-text)" }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>🔱 Mixed-squad lane sheet</div>
        <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
          Same send-offs, same structure — pool swimmers and triathletes leave the wall together. Triathletes swap strokes for freestyle.
        </div>
      </div>

      {!anySwap && (
        <div style={{ padding: 12, fontSize: 12, color: "var(--color-text-muted)", fontStyle: "italic" }}>
          This practice is already all-freestyle — triathletes do it exactly as written. No split needed.
        </div>
      )}

      {anySwap && (
        <div>
          {/* column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(120px, 1fr) 1fr 1fr", borderBottom: "1px solid var(--color-border)", background: "var(--color-bg)" }}>
            <div style={{ ...head, color: "var(--color-text-dim)" }}>Send-off (shared)</div>
            <div style={{ ...head, color: "var(--color-text-muted)" }}>🏊 Pool</div>
            <div style={{ ...head, color: "var(--color-primary)" }}>🔱 Triathlete</div>
          </div>

          {workout.blocks.map((b, bi) => {
            if (!Array.isArray(b.sets)) return null;
            const tb = tri.blocks[bi];
            const rounds = b.rounds || 1;
            return (
              <div key={bi} style={{ borderBottom: "1px solid var(--color-border)" }}>
                <div style={{ padding: "5px 8px", fontSize: 11, fontWeight: 700, color: "var(--color-text)", background: "var(--color-bg)" }}>
                  {b.name} — {(b.totalYards || 0).toLocaleString()} {unit}{rounds > 1 ? ` · ×${rounds} rounds` : ""}
                </div>
                {b.sets.map((s, si) => {
                  const ts = tb.sets[si] || s;
                  const swapped = !!ts._triSwapped;
                  return (
                    <div key={si} style={{ display: "grid", gridTemplateColumns: "minmax(120px, 1fr) 1fr 1fr", borderTop: "1px solid var(--color-card)" }}>
                      <div style={{ ...cell, fontWeight: 700, color: "var(--color-text)", fontFamily: "monospace" }}>
                        {s.reps} × {s.dist}{s.interval && !/^no interval/i.test(s.interval) ? ` @ ${s.interval}` : ""}
                      </div>
                      <div style={{ ...cell, color: "var(--color-text-muted)" }}>{s.desc}</div>
                      <div style={{ ...cell, color: swapped ? "var(--color-primary)" : "var(--color-text-dim)" }}>
                        {swapped ? ts.desc : "— same —"}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
