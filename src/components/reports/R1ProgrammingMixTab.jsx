// src/components/reports/R1ProgrammingMixTab.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// Reports sub-tab (consumed by ReportsView). React is a runtime global (no import needed).
import { _ReportTable } from "./_ReportTable.jsx";

    export function R1ProgrammingMixTab({ data }) {
      const fmt = (n) => Number(n || 0).toLocaleString();
      const pct = (n, d) => d > 0 ? Math.round((n / d) * 100) : 0;
      const srcTotal = Object.values(data.sourceCounts || {}).reduce((s, n) => s + n, 0);
      const typeRows = Object.entries(data.yardsByType || {}).sort((a, b) => b[1] - a[1]);
      const strokeRows = Object.entries(data.yardsByStroke || {}).sort((a, b) => b[1] - a[1]);
      const sectionRows = Object.entries(data.sectionYards || {}).sort((a, b) => b[1] - a[1]);

      const card = { padding: 12, background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 };
      const cardLabel = { fontSize: 11, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 };
      const cardValue = { fontSize: 24, fontWeight: 800, color: "var(--color-text)" };

      return (
        <div>
          {/* Top stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 18 }}>
            <div style={card}><div style={cardLabel}>Total yards</div><div style={cardValue}>{fmt(data.totalYards)}</div></div>
            <div style={card}><div style={cardLabel}>Workouts</div><div style={cardValue}>{data.workoutCount}</div></div>
            <div style={card}><div style={cardLabel}>Distinct labels</div><div style={cardValue}>{(data.bankLabels || []).length}</div></div>
            <div style={card}>
              <div style={cardLabel}>Source mix</div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                Bank {pct(data.sourceCounts?.bank || 0, srcTotal)}% · Engine {pct(data.sourceCounts?.engine || 0, srcTotal)}% · Mix {pct(data.sourceCounts?.mix || 0, srcTotal)}%
              </div>
            </div>
          </div>
          {/* Tables */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            <_ReportTable title="Yards by type"   rows={typeRows}   totalYards={data.totalYards} />
            <_ReportTable title="Yards by stroke" rows={strokeRows} totalYards={data.totalYards} />
            <_ReportTable title="Yards by section" rows={sectionRows} totalYards={data.totalYards} />
          </div>
        </div>
      );
    }
