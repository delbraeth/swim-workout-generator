// src/components/reports/R5PlatformHealthTab.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// Reports sub-tab (consumed by ReportsView). React is a runtime global (no import needed).

    export function R5PlatformHealthTab({ data }) {
      const fmt = (n) => Number(n || 0).toLocaleString();
      const pct = (n) => Math.round(Number(n || 0));
      const fa  = data.featureAdoption || {};
      const ac  = data.activeCoaches || {};
      const card = { padding: 12, background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 };
      const cardLabel = { fontSize: 11, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 };
      const cardValue = { fontSize: 24, fontWeight: 800, color: "var(--color-text)" };
      const maxWeekly = Math.max(1, ...(data.weeklyByTeam || []).map(w => w.total));

      return (
        <div>
          {/* Active coaches stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 18 }}>
            <div style={card}><div style={cardLabel}>Active 7d</div><div style={cardValue}>{ac.d7}</div><div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>coaches</div></div>
            <div style={card}><div style={cardLabel}>Active 14d</div><div style={cardValue}>{ac.d14}</div><div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>coaches</div></div>
            <div style={card}><div style={cardLabel}>Active 30d</div><div style={cardValue}>{ac.d30}</div><div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>coaches</div></div>
            <div style={card}><div style={cardLabel}>Workouts (range)</div><div style={cardValue}>{fmt(fa.totalWorkouts)}</div></div>
          </div>

          {/* Feature adoption */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 18 }}>
            <div style={card}>
              <div style={cardLabel}>Engine usage</div>
              <div style={cardValue}>{pct(fa.enginePct)}%</div>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>of workouts use engine</div>
            </div>
            <div style={card}>
              <div style={cardLabel}>Mix usage</div>
              <div style={cardValue}>{pct(fa.mixPct)}%</div>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>of workouts use mix</div>
            </div>
            <div style={card}>
              <div style={cardLabel}>Multi-lane usage</div>
              <div style={cardValue}>{pct(fa.multiLanePct)}%</div>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>of workouts</div>
            </div>
            <div style={card}>
              <div style={cardLabel}>Fallback rate</div>
              <div style={cardValue}>{pct(fa.fallbackPct)}%</div>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>any-block fallback</div>
            </div>
            <div style={card}>
              <div style={cardLabel}>Users with favs/disfavs</div>
              <div style={cardValue}>{fa.usersWithFavs}/{fa.usersWithDis}</div>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>of {fa.totalUsers} total</div>
            </div>
          </div>

          {/* Workouts per week (trended) */}
          <div style={{ padding: 12, background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: "var(--color-text-dim)", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Workouts per week
            </div>
            {(data.weeklyByTeam || []).length === 0 ? (
              <div style={{ color: "var(--color-text-muted)", fontSize: 12, fontStyle: "italic" }}>No workouts in range</div>
            ) : (
              <table style={{ width: "100%", fontSize: 12, color: "#cbd5e1" }}>
                <tbody>
                  {data.weeklyByTeam.map(w => (
                    <tr key={w.weekStart}>
                      <td style={{ padding: "3px 6px 3px 0", whiteSpace: "nowrap", color: "var(--color-text-muted)" }}>Week of {w.weekStart}</td>
                      <td style={{ padding: "3px 6px", width: "60%" }}>
                        <div style={{ background: "var(--color-bg)", borderRadius: 3, height: 8, position: "relative", overflow: "hidden" }}>
                          <div style={{ position: "absolute", inset: 0, width: `${Math.min(100, (w.total / maxWeekly) * 100)}%`, background: "var(--color-primary)" }} />
                        </div>
                      </td>
                      <td style={{ padding: "3px 0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{w.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Fallback rate trended */}
          {(data.fallbackTrend || []).length > 0 && (
            <div style={{ padding: 12, background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: "var(--color-text-dim)", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Engine fallback rate per week
              </div>
              <table style={{ width: "100%", fontSize: 12, color: "#cbd5e1" }}>
                <tbody>
                  {data.fallbackTrend.map(w => (
                    <tr key={w.weekStart}>
                      <td style={{ padding: "3px 6px 3px 0", whiteSpace: "nowrap", color: "var(--color-text-muted)" }}>Week of {w.weekStart}</td>
                      <td style={{ padding: "3px 6px", width: "50%" }}>
                        <div style={{ background: "var(--color-bg)", borderRadius: 3, height: 8, position: "relative", overflow: "hidden" }}>
                          <div style={{ position: "absolute", inset: 0, width: `${Math.min(100, w.fallbackPct)}%`, background: w.fallbackPct > 10 ? "var(--color-warn)" : "var(--color-positive)" }} />
                        </div>
                      </td>
                      <td style={{ padding: "3px 0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{Math.round(w.fallbackPct)}% <span style={{ color: "var(--color-text-muted)" }}>({w.fallbackCount}/{w.totalWorkouts})</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    }
