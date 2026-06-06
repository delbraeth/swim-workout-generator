// src/components/reports/R2ScheduleAdherenceTab.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// Reports sub-tab (consumed by ReportsView). React is a runtime global (no import needed).

    export function R2ScheduleAdherenceTab({ data, hasGroup }) {
      const pct = (n, d) => d > 0 ? Math.round((n / d) * 100) : 0;
      const card = { padding: 12, background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 };
      const cardLabel = { fontSize: 11, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 };
      const cardValue = { fontSize: 24, fontWeight: 800, color: "var(--color-text)" };
      return (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 18 }}>
            <div style={card}>
              <div style={cardLabel}>Scheduled</div>
              <div style={cardValue}>{data.scheduledCount}</div>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>practices in range</div>
            </div>
            <div style={card}>
              <div style={cardLabel}>Completed</div>
              <div style={cardValue}>{data.completedCount}</div>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
                {Math.round(data.completionPct)}% of scheduled
              </div>
            </div>
            <div style={card}>
              <div style={cardLabel}>With attendance</div>
              <div style={cardValue}>{data.withAttendance}</div>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
                {pct(data.withAttendance, data.completedCount)}% of completed
              </div>
            </div>
            <div style={card}>
              <div style={cardLabel}>Avg attendance</div>
              <div style={cardValue}>{Math.round(data.avgAttendancePct)}%</div>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
                per practice w/ attendance
              </div>
            </div>
          </div>
          {data.rosterTrend && (
            <div style={{ padding: 12, background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: "var(--color-text-dim)", fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Roster trend (selected group, in range)
              </div>
              <div style={{ fontSize: 13, color: "#cbd5e1" }}>
                <span style={{ color: "var(--color-positive)" }}>+{data.rosterTrend.added}</span> joined ·{" "}
                <span style={{ color: "var(--color-destructive-text)" }}>−{data.rosterTrend.removed}</span> left
              </div>
            </div>
          )}
          {data.withoutAttendance > 0 && (
            <div className="callout note" style={{ marginTop: 14, padding: 10, fontSize: 12, color: "var(--color-text-dim)", background: "rgba(245,158,11,0.08)", border: "1px solid var(--color-warn)", borderRadius: 6 }}>
              <strong>{data.withoutAttendance}</strong> completed practice{data.withoutAttendance === 1 ? "" : "s"} ha{data.withoutAttendance === 1 ? "s" : "ve"} no attendance recorded — open the WeekView and tap <strong>📋 Mark done</strong> to fill in the roster.
            </div>
          )}
          {!hasGroup && (
            <div style={{ marginTop: 14, fontSize: 12, color: "var(--color-text-muted)", fontStyle: "italic" }}>
              Tip: pick a group from the filter to see roster trend.
            </div>
          )}
        </div>
      );
    }
