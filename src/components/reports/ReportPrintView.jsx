// src/components/reports/ReportPrintView.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { setIdToName } from "../../lib/shared.js";

    const { useEffect } = React;

    export function ReportPrintView({ tab, data, rangeLabel, onClose }) {
      React.useEffect(() => {
        document.body.classList.add("reports-print-active");
        const t = setTimeout(() => { try { window.print(); } catch (_) {} }, 250);
        return () => {
          document.body.classList.remove("reports-print-active");
          clearTimeout(t);
        };
      }, []);

      const pageStyle = { position: "fixed", inset: 0, zIndex: 10000, background: "#fff", color: "#000", padding: "0.5in", overflow: "auto", fontFamily: "Georgia, 'Times New Roman', serif" };
      const headerStyle = { borderBottom: "2pt solid #000", paddingBottom: 8, marginBottom: 12 };
      const titleStyle = { fontSize: "20pt", fontWeight: 700, margin: 0 };
      const subStyle = { fontSize: "10pt", fontStyle: "italic", marginTop: 4, color: "#444" };
      const sectionHead = { fontSize: "13pt", fontWeight: 700, borderBottom: "1pt solid #888", paddingBottom: 4, margin: "16px 0 8px" };
      const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: "10pt" };
      const cellStyle = { padding: "4px 8px", borderBottom: "1px solid #ddd" };

      const fmt = (n) => Number(n || 0).toLocaleString();
      const pct = (n) => Math.round(Number(n || 0));

      const titleFor = {
        "programming-mix":    "Programming Mix",
        "schedule-adherence": "Schedule Adherence",
        "curation-log":       "Curation Log",
        "program-recap":      "Program Recap",
      }[tab] || "Report";

      // Per-tab body builders. Each returns JSX for the printed page.
      const renderBody = () => {
        if (tab === "programming-mix") {
          const typeRows = Object.entries(data.yardsByType || {}).sort((a, b) => b[1] - a[1]);
          const strokeRows = Object.entries(data.yardsByStroke || {}).sort((a, b) => b[1] - a[1]);
          const sectionRows = Object.entries(data.sectionYards || {}).sort((a, b) => b[1] - a[1]);
          const srcTotal = Object.values(data.sourceCounts || {}).reduce((s, n) => s + n, 0);
          const RowTable = ({ rows, title }) => (
            <>
              <div style={sectionHead}>{title}</div>
              <table style={tableStyle}><tbody>
                {rows.map(([k, v]) => <tr key={k}><td style={cellStyle}>{k}</td><td style={{ ...cellStyle, textAlign: "right" }}>{fmt(v)}</td></tr>)}
              </tbody></table>
            </>
          );
          return <>
            <div style={sectionHead}>Summary</div>
            <table style={tableStyle}><tbody>
              <tr><td style={cellStyle}>Total yards</td><td style={{ ...cellStyle, textAlign: "right" }}>{fmt(data.totalYards)}</td></tr>
              <tr><td style={cellStyle}>Workouts</td><td style={{ ...cellStyle, textAlign: "right" }}>{data.workoutCount}</td></tr>
              <tr><td style={cellStyle}>Distinct bank labels</td><td style={{ ...cellStyle, textAlign: "right" }}>{(data.bankLabels || []).length}</td></tr>
              <tr><td style={cellStyle}>Source mix</td><td style={{ ...cellStyle, textAlign: "right" }}>Bank {pct((data.sourceCounts?.bank || 0) / Math.max(1, srcTotal) * 100)}% · Engine {pct((data.sourceCounts?.engine || 0) / Math.max(1, srcTotal) * 100)}% · Mix {pct((data.sourceCounts?.mix || 0) / Math.max(1, srcTotal) * 100)}%</td></tr>
            </tbody></table>
            <RowTable rows={typeRows} title="Yards by type" />
            <RowTable rows={strokeRows} title="Yards by stroke" />
            <RowTable rows={sectionRows} title="Yards by section" />
          </>;
        }
        if (tab === "schedule-adherence") {
          return <>
            <div style={sectionHead}>Schedule completion</div>
            <table style={tableStyle}><tbody>
              <tr><td style={cellStyle}>Scheduled practices</td><td style={{ ...cellStyle, textAlign: "right" }}>{data.scheduledCount}</td></tr>
              <tr><td style={cellStyle}>Completed</td><td style={{ ...cellStyle, textAlign: "right" }}>{data.completedCount} ({pct(data.completionPct)}%)</td></tr>
              <tr><td style={cellStyle}>With attendance recorded</td><td style={{ ...cellStyle, textAlign: "right" }}>{data.withAttendance}</td></tr>
              <tr><td style={cellStyle}>Without attendance</td><td style={{ ...cellStyle, textAlign: "right" }}>{data.withoutAttendance}</td></tr>
              <tr><td style={cellStyle}>Avg attendance per practice</td><td style={{ ...cellStyle, textAlign: "right" }}>{pct(data.avgAttendancePct)}%</td></tr>
            </tbody></table>
            {data.rosterTrend && <>
              <div style={sectionHead}>Roster trend</div>
              <table style={tableStyle}><tbody>
                <tr><td style={cellStyle}>Joined</td><td style={{ ...cellStyle, textAlign: "right" }}>+{data.rosterTrend.added}</td></tr>
                <tr><td style={cellStyle}>Left</td><td style={{ ...cellStyle, textAlign: "right" }}>−{data.rosterTrend.removed}</td></tr>
              </tbody></table>
            </>}
          </>;
        }
        if (tab === "curation-log") {
          const Section = ({ title, favs, dis, fmtItem }) => <>
            <div style={sectionHead}>{title}</div>
            <table style={tableStyle}>
              <thead><tr><th style={{ ...cellStyle, textAlign: "left", fontWeight: 700 }}>★ Favorites ({favs.length})</th><th style={{ ...cellStyle, textAlign: "left", fontWeight: 700 }}>👎 Disfavorites ({dis.length})</th></tr></thead>
              <tbody>
                {Array.from({ length: Math.max(favs.length, dis.length) }).map((_, i) => (
                  <tr key={i}><td style={cellStyle}>{favs[i] ? fmtItem(favs[i]) : ""}</td><td style={cellStyle}>{dis[i] ? fmtItem(dis[i]) : ""}</td></tr>
                ))}
              </tbody>
            </table>
          </>;
          return <>
            <Section title="Bank labels" favs={data.bankLabels?.favorites || []} dis={data.bankLabels?.disfavorites || []} fmtItem={x => x.label} />
            <Section title="Sets" favs={data.sets?.favorites || []} dis={data.sets?.disfavorites || []} fmtItem={x => setIdToName(x.set_id)} />
            <Section title="Engine tuples (current state)" favs={data.engine?.favorites || []} dis={data.engine?.disfavorites || []} fmtItem={x => `${x.template_id} · ${x.stroke}`} />
          </>;
        }
        if (tab === "program-recap") {
          const typeRows = Object.entries(data.yardsByType || {}).sort((a, b) => b[1] - a[1]);
          const strokeRows = Object.entries(data.yardsByStroke || {}).sort((a, b) => b[1] - a[1]);
          return <>
            <div style={sectionHead}>Summary</div>
            <table style={tableStyle}><tbody>
              <tr><td style={cellStyle}>Total yards</td><td style={{ ...cellStyle, textAlign: "right" }}>{fmt(data.totalYards)}</td></tr>
              <tr><td style={cellStyle}>Workouts</td><td style={{ ...cellStyle, textAlign: "right" }}>{data.workoutCount}</td></tr>
              {data.multiLane?.generated > 0 && <tr><td style={cellStyle}>Multi-lane fit rate</td><td style={{ ...cellStyle, textAlign: "right" }}>{pct(data.multiLane.successPct)}% ({data.multiLane.withoutFallback}/{data.multiLane.generated})</td></tr>}
            </tbody></table>
            <div style={sectionHead}>Yards by type</div>
            <table style={tableStyle}><tbody>
              {typeRows.map(([k, v]) => <tr key={k}><td style={cellStyle}>{k}</td><td style={{ ...cellStyle, textAlign: "right" }}>{fmt(v)}</td></tr>)}
            </tbody></table>
            <div style={sectionHead}>Yards by stroke</div>
            <table style={tableStyle}><tbody>
              {strokeRows.map(([k, v]) => <tr key={k}><td style={cellStyle}>{k}</td><td style={{ ...cellStyle, textAlign: "right" }}>{fmt(v)}</td></tr>)}
            </tbody></table>
            {(data.strokeGaps || []).length > 0 && <>
              <div style={sectionHead}>Stroke gaps (30-day windows)</div>
              <table style={tableStyle}><tbody>
                {data.strokeGaps.map((g, i) => <tr key={i}><td style={cellStyle}>{g.windowStart} → {g.windowEnd}</td><td style={cellStyle}>Missing: {g.missingStrokes.join(", ")}</td></tr>)}
              </tbody></table>
            </>}
          </>;
        }
        return <div>Export not available for this report.</div>;
      };

      return (
        <div className="reports-print-overlay" style={pageStyle}>
          <button className="screen-only" onClick={onClose}
            style={{ position: "absolute", top: 12, right: 14, padding: "6px 12px", borderRadius: 6, border: "1px solid #888", background: "#f5f5f5", color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer", zIndex: 10001 }}>
            ✕ Close print view
          </button>
          <div style={headerStyle}>
            <div style={titleStyle}>SetForge · {titleFor}</div>
            <div style={subStyle}>{rangeLabel} · generated {new Date().toLocaleDateString()}</div>
          </div>
          {renderBody()}
          <div style={{ marginTop: 24, paddingTop: 8, borderTop: "1pt solid #888", fontSize: "9pt", color: "#666", textAlign: "center" }}>
            © 2026 Competition Aquatics, LLC · setforge.io
          </div>
        </div>
      );
    }
