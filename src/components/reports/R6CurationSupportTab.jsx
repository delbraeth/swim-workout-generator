// src/components/reports/R6CurationSupportTab.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// Reports sub-tab (consumed by ReportsView). React is a runtime global (no import needed).

    export function R6CurationSupportTab({ data }) {
      const card = { padding: 12, background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 };
      const subTitle = { fontSize: 12, color: "var(--color-text-dim)", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" };
      const cByT = data.curationByTeam || [];
      const maxProp = Math.max(1, ...cByT.map(t => t.total_propagating));

      return (
        <div>
          {/* Per-team propagating disfavor counts */}
          <div style={{ ...card, marginBottom: 14 }}>
            <div style={subTitle}>Propagating disfavor by team <span style={{ fontSize: 10, color: "var(--color-text-muted)", textTransform: "none", fontWeight: 400, marginLeft: 4 }}>(simplified proxy — true {">"} 30% bank-reduction calc deferred)</span></div>
            {cByT.length === 0 ? (
              <div style={{ color: "var(--color-text-muted)", fontSize: 12, fontStyle: "italic" }}>No teams</div>
            ) : (
              <table style={{ width: "100%", fontSize: 12, color: "#cbd5e1" }}>
                <thead>
                  <tr style={{ color: "var(--color-text-dim)", textAlign: "left", borderBottom: "1px solid var(--color-bg)" }}>
                    <th style={{ padding: "4px 6px 4px 0" }}>Team</th>
                    <th style={{ padding: "4px", textAlign: "right" }}>Coaches</th>
                    <th style={{ padding: "4px", textAlign: "right" }}>Labels</th>
                    <th style={{ padding: "4px", textAlign: "right" }}>Sets</th>
                    <th style={{ padding: "4px", textAlign: "right" }}>Engine</th>
                    <th style={{ padding: "4px", textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {cByT.map(t => (
                    <tr key={t.team_id} style={{ borderBottom: "1px solid var(--color-bg)" }}>
                      <td style={{ padding: "4px 6px 4px 0" }}>{t.team_name}</td>
                      <td style={{ padding: "4px", textAlign: "right", color: "var(--color-text-muted)" }}>{t.coach_count}</td>
                      <td style={{ padding: "4px", textAlign: "right", color: "var(--color-text-muted)" }}>{t.label_count}</td>
                      <td style={{ padding: "4px", textAlign: "right", color: "var(--color-text-muted)" }}>{t.set_count}</td>
                      <td style={{ padding: "4px", textAlign: "right", color: "var(--color-text-muted)" }}>{t.engine_count}</td>
                      <td style={{ padding: "4px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: t.total_propagating > 30 ? "var(--color-warn)" : "var(--color-text)" }}>{t.total_propagating}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Impersonation activity */}
          <div style={{ ...card, marginBottom: 14 }}>
            <div style={subTitle}>Impersonation activity (range)</div>
            {(data.impersonationByActor || []).length === 0 ? (
              <div style={{ color: "var(--color-text-muted)", fontSize: 12, fontStyle: "italic" }}>No impersonation sessions in range</div>
            ) : (
              <table style={{ width: "100%", fontSize: 12, color: "#cbd5e1" }}>
                <thead>
                  <tr style={{ color: "var(--color-text-dim)", textAlign: "left", borderBottom: "1px solid var(--color-bg)" }}>
                    <th style={{ padding: "4px 6px 4px 0" }}>Admin sub</th>
                    <th style={{ padding: "4px", textAlign: "right" }}>Sessions</th>
                    <th style={{ padding: "4px", textAlign: "right" }}>Avg min</th>
                    <th style={{ padding: "4px", textAlign: "right" }}>Distinct targets</th>
                  </tr>
                </thead>
                <tbody>
                  {data.impersonationByActor.map(a => (
                    <tr key={a.admin_sub} style={{ borderBottom: "1px solid var(--color-bg)" }}>
                      <td style={{ padding: "4px 6px 4px 0", fontFamily: "monospace", fontSize: 10 }} title={a.admin_sub}>{(a.admin_sub || "").slice(0, 16)}…</td>
                      <td style={{ padding: "4px", textAlign: "right" }}>{a.sessions}</td>
                      <td style={{ padding: "4px", textAlign: "right", color: "var(--color-text-muted)" }}>{a.avg_minutes}</td>
                      <td style={{ padding: "4px", textAlign: "right", color: "var(--color-text-muted)" }}>{a.distinct_targets}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Per-team audit rollup */}
          <div style={card}>
            <div style={subTitle}>Audit events per team (range)</div>
            {(data.auditByTeam || []).length === 0 ? (
              <div style={{ color: "var(--color-text-muted)", fontSize: 12, fontStyle: "italic" }}>No audit events tied to any team in range</div>
            ) : (
              <div>
                {data.auditByTeam.map(t => (
                  <div key={t.team_id} style={{ marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid var(--color-bg)" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text)", marginBottom: 4 }}>Team {t.team_id} <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>({t.total} events)</span></div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {t.events.map(e => (
                        <span key={e.event_type} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
                          <code style={{ fontFamily: "monospace" }}>{e.event_type}</code> ×{e.count}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }
