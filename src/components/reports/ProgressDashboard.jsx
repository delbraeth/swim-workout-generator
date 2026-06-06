// src/components/reports/ProgressDashboard.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { BenchmarksSection } from "../profile/BenchmarksSection.jsx";
import { PrProgressionPanel } from "../profile/PrProgressionPanel.jsx";

    const { useState, useEffect } = React;

    export function ProgressDashboard({ onPaceUpdate }) {
      const [recap, setRecap]   = React.useState(null);   // null = loading
      const [bench, setBench]   = React.useState(null);   // null = loading

      React.useEffect(() => {
        const ymd = (d) => d.toISOString().slice(0, 10);
        const end = new Date();
        const start = new Date(); start.setDate(start.getDate() - 90);
        (async () => {
          try {
            const r = await fetch(`/api/reports/program-recap?start=${ymd(start)}&end=${ymd(end)}`, { cache: "no-store" });
            setRecap(r.ok ? await r.json() : {});
          } catch (_) { setRecap({}); }
          try {
            const b = await fetch("/api/benchmarks", { cache: "no-store" });
            setBench(b.ok ? await b.json() : []);
          } catch (_) { setBench([]); }
        })();
      }, []);

      const fmtSecs = (s) => { if (s == null) return "—"; const m = Math.floor(s / 60), ss = String(Math.round(s % 60)).padStart(2, "0"); return `${m}:${ss}`; };
      const KIND_LABEL = { t30: "T-30", tt500: "500 TT", broken500: "Broken 500" };

      // Group benchmarks by kind (API returns recorded_at DESC). PR = lowest
      // pace_100_secs; trend compares the two most recent (lower = improving).
      const byKind = {};
      (bench || []).forEach(b => { (byKind[b.kind] = byKind[b.kind] || []).push(b); });
      const prRows = Object.keys(KIND_LABEL).filter(k => byKind[k] && byKind[k].length).map(k => {
        const rows = byKind[k];
        const paces = rows.map(r => Number(r.pace_100_secs)).filter(n => !Number.isNaN(n));
        const pr = paces.length ? Math.min(...paces) : null;
        let trend = null;
        if (rows.length >= 2 && rows[0].pace_100_secs != null && rows[1].pace_100_secs != null) {
          const d = Number(rows[0].pace_100_secs) - Number(rows[1].pace_100_secs); // latest - prior
          trend = d < -0.5 ? "up" : d > 0.5 ? "down" : "flat";
        }
        return { kind: k, pr, count: rows.length, latest: rows[0], trend };
      });

      const card = { background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: 16, marginBottom: 16 };
      const muted = { color: "var(--color-text-muted)", fontSize: 12 };
      const loading = recap === null || bench === null;

      // yards-by-stroke bars
      const stroke = (recap && recap.yardsByStroke) || {};
      const strokeMax = Math.max(1, ...Object.values(stroke).map(Number));

      return (
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h2 style={{ color: "var(--color-text)", fontSize: 20, fontWeight: 800, marginBottom: 4 }}>📈 Progress</h2>
          <p style={{ ...muted, marginBottom: 16 }}>Your last 90 days of training, plus your test-set bests. Log a time trial below to track your paces over time.</p>

          {loading ? (
            <div style={{ ...muted, padding: "24px 0" }}>Loading…</div>
          ) : (
            <>
              {/* Training volume (R4) */}
              <div style={card}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Training volume · last 90 days</div>
                <div style={{ display: "flex", gap: 24, marginBottom: 12 }}>
                  <div><div style={{ fontSize: 22, fontWeight: 800, color: "var(--color-text)" }}>{(recap.totalYards || 0).toLocaleString()}</div><div style={muted}>yards</div></div>
                  <div><div style={{ fontSize: 22, fontWeight: 800, color: "var(--color-text)" }}>{recap.workoutCount || 0}</div><div style={muted}>workouts</div></div>
                </div>
                {Object.keys(stroke).length > 0 ? (
                  <div style={{ display: "grid", gap: 4 }}>
                    {Object.entries(stroke).sort((a, b) => b[1] - a[1]).map(([s, y]) => (
                      <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 64, fontSize: 12, color: "var(--color-text-muted)", textTransform: "capitalize" }}>{s}</div>
                        <div style={{ flex: 1, background: "var(--color-bg)", borderRadius: 4, overflow: "hidden", height: 14 }}>
                          <div style={{ width: `${Math.round(Number(y) / strokeMax * 100)}%`, background: "var(--color-primary)", height: "100%" }} />
                        </div>
                        <div style={{ width: 70, textAlign: "right", fontSize: 11, color: "var(--color-text-dim)", fontVariantNumeric: "tabular-nums" }}>{Number(y).toLocaleString()} yd</div>
                      </div>
                    ))}
                  </div>
                ) : <div style={muted}>No saved workouts in this window yet.</div>}
                {Array.isArray(recap.strokeGaps) && recap.strokeGaps.length > 0 && (
                  <div style={{ marginTop: 10, fontSize: 12, color: "var(--color-warn)" }}>
                    ⚠ Stroke gap: a 30-day window missing {recap.strokeGaps[recap.strokeGaps.length - 1].missingStrokes.join(", ")}.
                  </div>
                )}
              </div>

              {/* Personal bests (benchmarks) */}
              <div style={card}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Test-set bests</div>
                {prRows.length === 0 ? (
                  <div style={muted}>No time trials logged yet. Log one below — you'll see your best pace and whether you're trending faster.</div>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {prRows.map(r => (
                      <div key={r.kind} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingBottom: 6, borderBottom: "1px solid var(--color-border)" }}>
                        <div style={{ color: "var(--color-text)", fontSize: 14, fontWeight: 600 }}>{KIND_LABEL[r.kind]}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 13, color: "var(--color-text)", fontVariantNumeric: "tabular-nums" }}>PR {fmtSecs(r.pr)}/100</span>
                          {r.trend && <span title="vs your previous result" style={{ fontSize: 13, color: r.trend === "up" ? "var(--color-positive)" : r.trend === "down" ? "var(--color-warn)" : "var(--color-text-dim)" }}>{r.trend === "up" ? "▲ faster" : r.trend === "down" ? "▼ slower" : "—"}</span>}
                          <span style={muted}>{r.count} logged</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Eval #7 — per-event PR progression (race events, dated). */}
              <PrProgressionPanel endpoint="/api/me/event-pr-history" />

              {/* Logger (reuses the existing component) */}
              <div style={card}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Log a time trial</div>
                <BenchmarksSection onPaceUpdate={onPaceUpdate || (() => {})} />
              </div>
            </>
          )}
        </div>
      );
    }
