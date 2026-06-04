// src/components/reports/_ReportTable.jsx — shared two-column table with bar fills.
// rows = [[key, value], ...]. Used by R1ProgrammingMixTab + R4ProgramRecapTab.
// Extracted from src/app.jsx (SPA-split Phase 3). React is a runtime global.

    export function _ReportTable({ title, rows, totalYards }) {
      return (
        <div style={{ padding: 12, background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: "var(--color-text-dim)", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</div>
          {rows.length === 0 ? (
            <div style={{ color: "var(--color-text-muted)", fontSize: 12, fontStyle: "italic" }}>No data in range</div>
          ) : (
            <table style={{ width: "100%", fontSize: 12, color: "#cbd5e1" }}>
              <tbody>
                {rows.map(([k, v]) => {
                  const pct = totalYards > 0 ? (v / totalYards) * 100 : 0;
                  return (
                    <tr key={k}>
                      <td style={{ padding: "3px 6px 3px 0", whiteSpace: "nowrap", textTransform: "capitalize" }}>{k}</td>
                      <td style={{ padding: "3px 6px", width: "60%" }}>
                        <div style={{ background: "var(--color-bg)", borderRadius: 3, height: 8, position: "relative", overflow: "hidden" }}>
                          <div style={{ position: "absolute", inset: 0, width: `${Math.min(100, pct)}%`, background: "var(--color-primary)" }} />
                        </div>
                      </td>
                      <td style={{ padding: "3px 0", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--color-text-dim)" }}>{Number(v).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      );
    }
