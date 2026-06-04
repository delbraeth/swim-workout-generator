// src/components/reports/R4ProgramRecapTab.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// Reports sub-tab (consumed by ReportsView). React is a runtime global (no import needed).
import { _ReportTable } from "./_ReportTable.jsx";

    export function R4ProgramRecapTab({ data }) {
      const fmt = (n) => Number(n || 0).toLocaleString();
      const typeRows = Object.entries(data.yardsByType || {}).sort((a, b) => b[1] - a[1]);
      const strokeRows = Object.entries(data.yardsByStroke || {}).sort((a, b) => b[1] - a[1]);
      const card = { padding: 12, background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 };
      const cardLabel = { fontSize: 11, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 };
      const cardValue = { fontSize: 24, fontWeight: 800, color: "var(--color-text)" };

      // Most/least-used: combine templates + labels into a single "items used"
      // view since solo users won't care about the source distinction.
      const renderRanked = (rows, title) => (
        <div style={{ padding: 12, background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: "var(--color-text-dim)", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</div>
          {rows.length === 0 ? (
            <div style={{ color: "var(--color-text-muted)", fontSize: 12, fontStyle: "italic" }}>None in range</div>
          ) : (
            <table style={{ width: "100%", fontSize: 12, color: "#cbd5e1" }}>
              <tbody>
                {rows.map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ padding: "3px 6px 3px 0" }}>{k}</td>
                    <td style={{ padding: "3px 0", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--color-text-dim)" }}>×{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      );

      return (
        <div>
          {/* Top stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 18 }}>
            <div style={card}><div style={cardLabel}>Total yards</div><div style={cardValue}>{fmt(data.totalYards)}</div></div>
            <div style={card}><div style={cardLabel}>Workouts</div><div style={cardValue}>{data.workoutCount}</div></div>
            <div style={card}>
              <div style={cardLabel}>Multi-lane fit</div>
              <div style={cardValue}>{Math.round(data.multiLane?.successPct || 0)}%</div>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
                {data.multiLane?.withoutFallback || 0}/{data.multiLane?.generated || 0} clean
              </div>
            </div>
            <div style={card}>
              <div style={cardLabel}>Stroke gaps</div>
              <div style={cardValue}>{(data.strokeGaps || []).length}</div>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
                30-day windows missing a stroke
              </div>
            </div>
          </div>

          {/* Yardage tables */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 14 }}>
            <_ReportTable title="Yards by type"   rows={typeRows}   totalYards={data.totalYards} />
            <_ReportTable title="Yards by stroke" rows={strokeRows} totalYards={data.totalYards} />
          </div>

          {/* Most/least used */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 14 }}>
            {renderRanked(data.mostUsedLabels || [],     "Most-used bank labels")}
            {renderRanked(data.leastUsedLabels || [],    "Least-used bank labels")}
            {(data.mostUsedTemplates || []).length > 0 && renderRanked(data.mostUsedTemplates, "Most-used engine templates")}
            {(data.leastUsedTemplates || []).length > 0 && renderRanked(data.leastUsedTemplates, "Least-used engine templates")}
          </div>

          {/* 4-stroke balance gaps */}
          {(data.strokeGaps || []).length > 0 && (
            <div style={{ padding: 12, background: "var(--color-card)", border: "1px solid var(--color-warn)", borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: "var(--color-warn)", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                30-day windows missing a stroke
              </div>
              <table style={{ width: "100%", fontSize: 12, color: "#cbd5e1" }}>
                <thead>
                  <tr style={{ color: "var(--color-text-dim)", textAlign: "left" }}>
                    <th style={{ padding: "4px 6px 4px 0" }}>Window</th>
                    <th style={{ padding: "4px 0" }}>Missing</th>
                  </tr>
                </thead>
                <tbody>
                  {data.strokeGaps.map((g, i) => (
                    <tr key={i}>
                      <td style={{ padding: "3px 6px 3px 0", whiteSpace: "nowrap", color: "var(--color-text-muted)" }}>{g.windowStart} → {g.windowEnd}</td>
                      <td style={{ padding: "3px 0", textTransform: "capitalize", color: "var(--color-warn)" }}>{g.missingStrokes.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    }
