// src/components/people/HouseholdSiblings.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { API_BASE } from "../../app.jsx";

    const { useState, useEffect } = React;

    export function HouseholdSiblings({ swimmerRef, seedHousehold = null }) {
      const [sibs, setSibs] = React.useState(Array.isArray(seedHousehold) ? seedHousehold : null);
      React.useEffect(() => {
        // Seeded from the composite detail fetch — skip the initial GET.
        if (Array.isArray(seedHousehold)) return;
        let cancelled = false;
        fetch(`${API_BASE}/swimmers/${encodeURIComponent(swimmerRef)}/household`, { cache: "no-store" })
          .then(r => r.ok ? r.json() : { siblings: [] })
          .then(d => { if (!cancelled) setSibs(Array.isArray(d.siblings) ? d.siblings : []); })
          .catch(() => { if (!cancelled) setSibs([]); });
        return () => { cancelled = true; };
      }, [swimmerRef]);
      if (!sibs || sibs.length === 0) return null;
      return (
        <div style={{ fontSize: 12, color: "var(--color-text-dim)", marginTop: 8 }}>
          👪 Household: <span style={{ color: "var(--color-text)" }}>{sibs.map(s => s.display_name).join(", ")}</span>
        </div>
      );
    }
