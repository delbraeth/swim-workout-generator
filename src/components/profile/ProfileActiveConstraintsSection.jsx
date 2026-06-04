// src/components/profile/ProfileActiveConstraintsSection.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { formatPscRow } from "../../lib/shared.js";

    export function ProfileActiveConstraintsSection({ constraints }) {
      // Burst mitigation — accept constraints as a prop from ProfileModal
      // (sourced from App-level myConstraints, populated by bootstrap).
      // Dropped the standalone /api/me/constraints fetch.
      const rows = Array.isArray(constraints) ? constraints : [];
      const err = null;

      // Hide the entire section when the swimmer has no constraints —
      // ProfileModal is busy enough; empty cards add noise. Coach + admin
      // can still see "no constraints" on the per-swimmer panel.
      if (rows.length === 0) return null;

      return (
        <div style={{ padding: "18px 20px", borderTop: "1px solid var(--color-card)" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-warn)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
            ⚠ Active constraints ({rows.length})
          </div>
          <div style={{ display: "grid", gap: 6, fontSize: 12 }}>
            {rows.map(r => (
              <div key={r.id} style={{ background: "var(--color-card)", border: "1px solid var(--color-warn)", borderRadius: 6, padding: "8px 10px" }}>
                <div style={{ color: "var(--color-text)", fontWeight: 600 }}>
                  <span style={{ marginRight: 6 }}>⚠</span>
                  {formatPscRow(r)}
                </div>
                <div style={{ color: "var(--color-text-muted)", fontSize: 10, marginTop: 4 }}>
                  Set by coach <code style={{ fontFamily: "monospace" }}>{(r.set_by_coach_sub || "").slice(-8) || "—"}</code>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            Constraints are set by your coach. To change them, talk with your coach. Your generated workouts already honor these — you don't need to do anything.
          </div>
          {err && <div style={{ color: "#fca5a5", fontSize: 11, marginTop: 6 }}>Error: {err}</div>}
        </div>
      );
    }
