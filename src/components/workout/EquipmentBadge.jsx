// src/components/workout/EquipmentBadge.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).

    export function EquipmentBadge({ name }) {
      const colors = {
        kickboard: { bg: "#dbeafe", fg: "#1e40af" },
        fins:      { bg: "#cffafe", fg: "#155e75" },
        paddles:   { bg: "#fef3c7", fg: "#92400e" },
        buoy:      { bg: "#fce7f3", fg: "#9d174d" },
      };
      const c = colors[name] || { bg: "var(--color-text)", fg: "var(--color-border)" };
      return (
        <span style={{ background: c.bg, color: c.fg, fontSize: 10, fontWeight: 700,
                       padding: "2px 7px", borderRadius: 999, marginRight: 4,
                       textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {name}
        </span>
      );
    }
