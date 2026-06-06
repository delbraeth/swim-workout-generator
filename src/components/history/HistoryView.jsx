// src/components/history/HistoryView.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { equipMode, inferSetZone, WORKOUT_TYPES, ZONES } from "../../lib/engine.js";
import { GOAL_METRICS, ZONE_ORDER } from "../../lib/constants.js";
import { StarRating } from "../StarRating.jsx";
import { DrylandBlock } from "../workout/DrylandBlock.jsx";
import { WorkoutBlock } from "../workout/WorkoutBlock.jsx";

    const { useState, useMemo, useEffect } = React;

    export function HistoryView({ history, historyLoaded, onUpdateNotes, onUpdateCompleted, onUpdateDifficulty, onDelete, onLoadAndPrint, onRepeat, onRun, favorites, onToggleFavorite, recentMainLabels, goals = [], mySub }) {
      const [filterType,   setFilterType]   = useState("all");
      const [filterUser,   setFilterUser]   = useState("all"); // "all" | "__unattributed__" | sub string
      const [weekMode,     setWeekMode]     = useState("all"); // "all" | "4wk"
      const [typeWindow,   setTypeWindow]   = useState("4wk"); // "4wk" | "12wk" | "all" — windows the Type Breakdown stat
      const [filterStatus, setFilterStatus] = useState("all"); // "all" | "done" | "planned"
      const [editingId,    setEditingId]    = useState(null);
      const [editingNotes, setEditingNotes] = useState("");
      const [expandedId,   setExpandedId]   = useState(null);

      // Distinct subs present in history. Display label = most common initials for that sub.
      const userBuckets = useMemo(() => {
        const subMap = new Map(); // sub → Map<initials, count>
        let hasUnattributed = false;
        for (const e of history) {
          const sub      = (e.sub          || "").trim();
          const initials = (e.userInitials || "").trim();
          if (sub) {
            if (!subMap.has(sub)) subMap.set(sub, new Map());
            const counts = subMap.get(sub);
            if (initials) counts.set(initials, (counts.get(initials) || 0) + 1);
          } else {
            hasUnattributed = true;
          }
        }
        const users = [...subMap.entries()].map(([sub, counts]) => {
          const label = counts.size > 0
            ? [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
            : "Unknown";
          return { id: sub, label };
        }).sort((a, b) => a.label.localeCompare(b.label));
        return { users, hasUnattributed };
      }, [history]);

      // If the selected user filter no longer exists in history, reset to "all".
      useEffect(() => {
        if (filterUser === "all") return;
        if (filterUser === "__unattributed__" && !userBuckets.hasUnattributed) setFilterUser("all");
        else if (filterUser !== "__unattributed__" && !userBuckets.users.find(u => u.id === filterUser)) setFilterUser("all");
      }, [filterUser, userBuckets]);

      const filtered = useMemo(
        () => history.filter(e => {
          if (filterType !== "all" && e.type !== filterType) return false;
          const sub = (e.sub || "").trim();
          if (filterUser !== "all") {
            if (filterUser === "__unattributed__" && sub) return false;
            if (filterUser !== "__unattributed__" && sub !== filterUser) return false;
          }
          if (filterStatus !== "all") {
            const isDone = e.completed !== false; // treat missing as done (legacy entries)
            if (filterStatus === "done"    && !isDone) return false;
            if (filterStatus === "planned" &&  isDone) return false;
          }
          return true;
        }),
        [history, filterType, filterUser, filterStatus]
      );

      // Show the user-filter row only when it would offer a meaningful choice:
      // at least 2 distinct buckets among (users, unattributed).
      const userBucketCount = userBuckets.users.length + (userBuckets.hasUnattributed ? 1 : 0);
      const showUserFilter = userBucketCount > 1;

      const stats = useMemo(() => {
        // Stats count only completed entries (planned workouts excluded)
        const done     = filtered.filter(e => e.completed !== false);
        const sessions = done.length;
        const yards    = done.reduce((s, e) => s + (e.totalYards || 0), 0);
        const avg      = sessions ? Math.round(yards / sessions) : 0;

        // Workouts per week (completed only)
        const now        = Date.now();
        const msPerWeek  = 7 * 24 * 60 * 60 * 1000;
        const fourWksAgo = now - 4 * msPerWeek;
        const allDates   = done.map(e => e.dateCompleted ? new Date(e.dateCompleted).getTime() : 0).filter(Boolean);
        const firstDate  = allDates.length > 0 ? Math.min(...allDates) : now;
        // All-time: sessions / weeks since first entry
        const wkAll = allDates.length > 0
          ? sessions / Math.max(1, (now - firstDate) / msPerWeek)
          : 0;
        // 4-week: sessions in last 28 days / actual elapsed weeks (capped at 4)
        const recentCount  = done.filter(e => {
          const d = e.dateCompleted ? new Date(e.dateCompleted).getTime() : 0;
          return d >= fourWksAgo;
        }).length;
        const weeksElapsed = Math.min(4, Math.max(1, (now - firstDate) / msPerWeek));
        const wkRecent     = recentCount / weeksElapsed;

        // Weekly yards sparkline — last 12 ISO weeks, done-only.
        // Bucket key = Monday of the entry's ISO week (UTC), formatted yyyy-mm-dd.
        const SPARK_WEEKS = 12;
        const mondayUTC = (ts) => {
          const d = new Date(ts);
          // JS getUTCDay: Sun=0, Mon=1, ... Sat=6 — shift so Mon=0..Sun=6
          const dow = (d.getUTCDay() + 6) % 7;
          const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow));
          return m;
        };
        const fmtMonday = (d) => d.toISOString().slice(0, 10);
        const nowMonday = mondayUTC(now);
        const weeks = Array.from({ length: SPARK_WEEKS }).map((_, i) => {
          const m = new Date(nowMonday);
          m.setUTCDate(m.getUTCDate() - (SPARK_WEEKS - 1 - i) * 7);
          return { key: fmtMonday(m), monday: m, yards: 0 };
        });
        const weekIdx = new Map(weeks.map((w, i) => [w.key, i]));
        for (const e of done) {
          if (!e.dateCompleted) continue;
          // dateCompleted is yyyy-mm-dd; interpret as UTC midnight so week math is stable.
          const ts = new Date(`${e.dateCompleted}T00:00:00Z`).getTime();
          const k = fmtMonday(mondayUTC(ts));
          const i = weekIdx.get(k);
          if (i !== undefined) weeks[i].yards += (e.totalYards || 0);
        }
        const sparkMax = weeks.reduce((m, w) => Math.max(m, w.yards), 0);

        // Type distribution (completed only), windowed
        const winDays = typeWindow === "4wk" ? 28 : typeWindow === "12wk" ? 84 : null;
        const winCutoff = winDays === null ? -Infinity : (now - winDays * 24 * 60 * 60 * 1000);
        const windowed = done.filter(e => {
          if (winCutoff === -Infinity) return true;
          const d = e.dateCompleted ? new Date(e.dateCompleted).getTime() : 0;
          return d >= winCutoff;
        });
        const winSessions = windowed.length;
        const typeCounts = new Map();
        for (const e of windowed) typeCounts.set(e.type, (typeCounts.get(e.type) || 0) + 1);
        const typeBreakdown = [...typeCounts.entries()]
          .map(([type, count]) => ({ type, count, pct: winSessions ? Math.round(count / winSessions * 100) : 0 }))
          .sort((a, b) => b.count - a.count);

        // N4: Intensity distribution — yards per zone, derived from inferSetZone
        // for every set in every windowed workout. Two outputs:
        //   intensityTotals: { zoneId → yards } across the whole window
        //   weeklyIntensity: 12-week stacked-bar series (latest 12 ISO weeks)
        const intensityTotals = { easy: 0, aerobic: 0, threshold: 0, vo2: 0, anaerobic: 0 };
        const weeklyIntensity = weeks.map(w => ({
          key: w.key, monday: w.monday,
          zones: { easy: 0, aerobic: 0, threshold: 0, vo2: 0, anaerobic: 0 },
          total: 0,
        }));
        for (const e of done) {
          if (!Array.isArray(e.blocks)) continue;
          const ts = e.dateCompleted ? new Date(`${e.dateCompleted}T00:00:00Z`).getTime() : 0;
          const wIdx = weekIdx.get(fmtMonday(mondayUTC(ts)));
          const inWindow = ts >= winCutoff;
          for (const b of e.blocks) {
            for (const s of (b.sets || [])) {
              const z = s.zone || inferSetZone(s, b.section);
              const y = (s.reps || 1) * (s.dist || 0);
              if (inWindow) intensityTotals[z] = (intensityTotals[z] || 0) + y;
              if (wIdx !== undefined) {
                weeklyIntensity[wIdx].zones[z] += y;
                weeklyIntensity[wIdx].total   += y;
              }
            }
          }
        }
        const intensityYards = Object.values(intensityTotals).reduce((s, v) => s + v, 0);
        // 80/20 ratio: % of yards at or below aerobic vs everything threshold+.
        const easyAerobicYards = intensityTotals.easy + intensityTotals.aerobic;
        const hardYards        = intensityYards - easyAerobicYards;
        const ratio8020 = intensityYards > 0
          ? { easy: Math.round(easyAerobicYards / intensityYards * 100),
              hard: Math.round(hardYards / intensityYards * 100) }
          : null;
        const weeklyIntensityMax = weeklyIntensity.reduce((m, w) => Math.max(m, w.total), 0);

        return { sessions, yards, avg, wkAll, wkRecent, typeBreakdown, winSessions, weeks, sparkMax,
                 intensityTotals, intensityYards, ratio8020, weeklyIntensity, weeklyIntensityMax };
      }, [filtered, typeWindow]);

      // Goal progress vs current period (ISO week Mon..Sun, or calendar month).
      // Only counts the signed-in user's completed workouts.
      const goalProgress = useMemo(() => {
        if (!goals.length || !mySub) return [];
        const now = new Date();
        // ISO week boundaries (Mon..Sun) in local time.
        const dow = (now.getDay() + 6) % 7; // 0 = Monday
        const weekStart = new Date(now); weekStart.setHours(0,0,0,0); weekStart.setDate(now.getDate() - dow);
        const weekStartMs = weekStart.getTime();
        // Calendar month boundary in local time.
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        let wkSessions = 0, wkYards = 0, moYards = 0;
        for (const e of history) {
          if (e.sub !== mySub) continue;
          if (e.completed === false) continue;
          if (!e.dateCompleted) continue;
          const ts = new Date(`${e.dateCompleted}T00:00:00`).getTime();
          if (ts >= weekStartMs) { wkSessions += 1; wkYards += (e.totalYards || 0); }
          if (ts >= monthStart)  { moYards   += (e.totalYards || 0); }
        }
        const valueByMetric = {
          workouts_per_week: wkSessions,
          yards_per_week:    wkYards,
          yards_per_month:   moYards,
        };
        return goals.map(g => ({
          metric: g.metric,
          target: g.target_value,
          current: valueByMetric[g.metric] || 0,
        }));
      }, [goals, history, mySub]);

      if (!historyLoaded) {
        return <div style={{ textAlign: "center", color: "var(--color-text-dim)", padding: 40 }}>Loading history…</div>;
      }
      if (history.length === 0) {
        return (
          <div style={{ textAlign: "center", color: "var(--color-text-dim)", padding: 50 }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>📜</div>
            <p style={{ fontSize: 16, color: "var(--color-text-muted)", margin: 0 }}>No workouts logged yet.</p>
            <p style={{ fontSize: 12, color: "var(--color-text-dim)", marginTop: 6 }}>Generate a workout, swim it, then click <b>Save to History</b> to log it here.</p>
          </div>
        );
      }

      return (
        <div className="screen-only">
          {/* Favorites panel */}
          {favorites && favorites.length > 0 && (
            <div style={{ marginBottom: 18, padding: "14px 16px", borderRadius: 10, background: "#1a1f2e", border: "1px solid #2d3748" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-warn)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
                ★ Favorites
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {favorites.map(label => {
                  const seenDays = recentMainLabels ? recentMainLabels.get(label) : undefined;
                  return (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 8, background: "var(--color-bg)", border: "1px solid #f59e0b33" }}>
                      <span style={{ fontSize: 13, color: "var(--color-text)", fontWeight: 600 }}>{label}</span>
                      {seenDays !== undefined && (
                        <span title={`Last completed ${seenDays === 0 ? "today" : seenDays === 1 ? "yesterday" : seenDays + " days ago"}`}
                          style={{ fontSize: 10, color: "#fca5a5", background: "#7f1d1d33", border: "1px solid #7f1d1d", padding: "1px 6px", borderRadius: 999, fontWeight: 700, letterSpacing: "0.02em" }}>
                          last seen {seenDays === 0 ? "today" : `${seenDays}d ago`}
                        </span>
                      )}
                      <button
                        onClick={() => onToggleFavorite && onToggleFavorite(label)}
                        title="Remove from favorites"
                        style={{ background: "transparent", border: "none", color: "var(--color-warn)", fontSize: 16, cursor: "pointer", padding: "0 2px", lineHeight: 1 }}>
                        ★
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Type filter chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: showUserFilter ? 8 : 14 }}>
            {[{ id: "all", label: "All", emoji: "📋" }, ...WORKOUT_TYPES].map(t => {
              const active = filterType === t.id;
              return (
                <button key={t.id} onClick={() => setFilterType(t.id)}
                  style={{
                    padding: "6px 12px", borderRadius: 999, border: "none",
                    background: active ? "var(--color-primary)" : "var(--color-card)",
                    color: active ? "#fff" : "var(--color-text-muted)",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>
                  {t.emoji} {t.label}
                </button>
              );
            })}
          </div>

          {/* User filter chips — only shown when there's a meaningful choice. */}
          {showUserFilter && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14, alignItems: "center" }}>
              <span style={{ fontSize: 10, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginRight: 4 }}>Who:</span>
              {[
                { id: "all", label: "All" },
                ...userBuckets.users,
                ...(userBuckets.hasUnattributed ? [{ id: "__unattributed__", label: "Unattributed" }] : []),
              ].map(u => {
                const active = filterUser === u.id;
                return (
                  <button key={u.id} onClick={() => setFilterUser(u.id)}
                    style={{
                      padding: "6px 12px", borderRadius: 999, border: "none",
                      background: active ? "#0ea5e9" : "var(--color-card)",
                      color: active ? "#fff" : "var(--color-text-muted)",
                      fontSize: 12, fontWeight: 600, cursor: "pointer",
                      fontVariantNumeric: "tabular-nums",
                    }}>
                    {u.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Status filter chips */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginRight: 4 }}>Status:</span>
            {[
              { id: "all",     label: "All" },
              { id: "done",    label: "✓ Done" },
              { id: "planned", label: "Planned" },
            ].map(s => {
              const active = filterStatus === s.id;
              return (
                <button key={s.id} onClick={() => setFilterStatus(s.id)}
                  style={{
                    padding: "6px 12px", borderRadius: 999, border: "none",
                    background: active ? (s.id === "done" ? "#16a34a" : s.id === "planned" ? "#7c3aed" : "var(--color-border-strong)") : "var(--color-card)",
                    color: active ? "#fff" : "var(--color-text-muted)",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* Goal progress — only renders if user has set at least one goal */}
          {goalProgress.length > 0 && (
            <div className="card" style={{ borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                🎯 Goals · current period
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {goalProgress.map(gp => {
                  const meta = GOAL_METRICS.find(m => m.id === gp.metric);
                  if (!meta) return null;
                  const pct = Math.min(100, gp.target > 0 ? (gp.current / gp.target) * 100 : 0);
                  const hit = gp.current >= gp.target;
                  const barColor = hit ? "var(--color-positive)" : pct >= 75 ? "var(--color-primary)" : "#7c3aed";
                  return (
                    <div key={gp.metric}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: "#cbd5e1", fontWeight: 600 }}>
                          {meta.label}
                          <span style={{ color: "var(--color-border-strong)", fontWeight: 400, marginLeft: 6 }}>· this {meta.period}</span>
                        </span>
                        <span style={{ color: hit ? "#4ade80" : "var(--color-text-muted)", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                          {gp.current.toLocaleString()} / {gp.target.toLocaleString()} {meta.unit}
                          {hit && <span style={{ marginLeft: 6 }}>✓</span>}
                        </span>
                      </div>
                      <div style={{ background: "var(--color-bg)", borderRadius: 4, height: 8, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: barColor, transition: "width 0.4s" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stats summary */}
          <div className="card" style={{ borderRadius: 12, padding: 16, marginBottom: 16 }}>
            {/* Key numbers row */}
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap", marginBottom: stats.sessions > 0 ? 16 : 0 }}>
              {[
                ["Sessions",     stats.sessions.toLocaleString()],
                ["Total Yards",  stats.yards.toLocaleString()],
                ["Avg / Session", stats.avg.toLocaleString()],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 10, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{k}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>{v}</div>
                </div>
              ))}
              {/* Workouts / week with toggle */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 10, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Per Week</span>
                  <button
                    onClick={() => setWeekMode(m => m === "all" ? "4wk" : "all")}
                    style={{ fontSize: 9, padding: "1px 7px", borderRadius: 999, border: "1px solid #7c3aed", background: "#7c3aed33", color: "#c4b5fd", cursor: "pointer", fontWeight: 700 }}>
                    {weekMode === "all" ? "All time" : "4 wks"}
                  </button>
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>
                  {(weekMode === "all" ? stats.wkAll : stats.wkRecent).toFixed(1)}
                </div>
              </div>
            </div>
            {/* Yards/week sparkline — last 12 ISO weeks */}
            {stats.sessions > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 10, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Yards / Week</div>
                  <div style={{ fontSize: 10, color: "var(--color-border-strong)" }}>last 12 weeks</div>
                  {stats.sparkMax > 0 && (
                    <div style={{ marginLeft: "auto", fontSize: 10, color: "var(--color-text-dim)", fontVariantNumeric: "tabular-nums" }}>
                      peak {stats.sparkMax.toLocaleString()}
                    </div>
                  )}
                </div>
                {stats.sparkMax > 0 ? (
                  <svg viewBox="0 0 240 48" preserveAspectRatio="none"
                    style={{ width: "100%", height: 48, display: "block" }}>
                    {stats.weeks.map((w, i) => {
                      const bw = 240 / stats.weeks.length;
                      const x  = i * bw;
                      const h  = (w.yards / stats.sparkMax) * 44;
                      const y  = 48 - h;
                      const isCurrent = i === stats.weeks.length - 1;
                      return (
                        <g key={w.key}>
                          <rect
                            x={x + 1} y={y}
                            width={Math.max(0, bw - 2)} height={h}
                            fill={isCurrent ? "#38bdf8" : "var(--color-primary)"}
                            opacity={w.yards > 0 ? 0.95 : 0}
                            rx={1}
                          >
                            <title>Week of {w.key}: {w.yards.toLocaleString()} yds</title>
                          </rect>
                          {/* baseline tick so empty weeks are still legible */}
                          {w.yards === 0 && (
                            <rect x={x + 1} y={47} width={Math.max(0, bw - 2)} height={1} fill="var(--color-border)">
                              <title>Week of {w.key}: 0 yds</title>
                            </rect>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                ) : (
                  <div style={{ fontSize: 11, color: "var(--color-text-dim)", fontStyle: "italic", padding: "4px 0" }}>
                    No completed workouts in the last 12 weeks.
                  </div>
                )}
              </div>
            )}
            {/* N4: Intensity distribution — stacked horizontal bar + 80/20 ratio */}
            {stats.sessions > 0 && stats.intensityYards > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 10, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Intensity</div>
                  <div style={{ fontSize: 10, color: "var(--color-border-strong)" }}>
                    {typeWindow === "4wk" ? "4 wks" : typeWindow === "12wk" ? "12 wks" : "all time"}
                  </div>
                  {stats.ratio8020 && (
                    <div style={{ marginLeft: "auto", fontSize: 10, fontVariantNumeric: "tabular-nums" }}>
                      <span style={{ color: "var(--color-positive)", fontWeight: 700 }}>{stats.ratio8020.easy}%</span>
                      <span style={{ color: "var(--color-border-strong)" }}> easy/aerobic </span>
                      <span style={{ color: "var(--color-border-strong)" }}>·</span>
                      <span style={{ color: "#f97316", fontWeight: 700 }}> {stats.ratio8020.hard}%</span>
                      <span style={{ color: "var(--color-border-strong)" }}> threshold+</span>
                    </div>
                  )}
                </div>
                {/* Stacked horizontal bar */}
                <div style={{ display: "flex", height: 14, borderRadius: 4, overflow: "hidden", background: "var(--color-bg)", marginBottom: 6 }}>
                  {ZONE_ORDER.map(zId => {
                    const y   = stats.intensityTotals[zId] || 0;
                    const pct = stats.intensityYards > 0 ? (y / stats.intensityYards) * 100 : 0;
                    if (pct <= 0) return null;
                    return (
                      <div key={zId}
                        title={`${ZONES[zId].label}: ${y.toLocaleString()} yds · ${pct.toFixed(1)}%`}
                        style={{ width: `${pct}%`, background: ZONES[zId].color, transition: "width 0.4s" }} />
                    );
                  })}
                </div>
                {/* Per-zone legend */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 10 }}>
                  {ZONE_ORDER.map(zId => {
                    const y   = stats.intensityTotals[zId] || 0;
                    const pct = stats.intensityYards > 0 ? (y / stats.intensityYards) * 100 : 0;
                    return (
                      <span key={zId} style={{ display: "inline-flex", alignItems: "center", gap: 4, color: pct > 0 ? "#cbd5e1" : "var(--color-border-strong)" }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: ZONES[zId].color, display: "inline-block", opacity: pct > 0 ? 1 : 0.4 }} />
                        <span>{ZONES[zId].label}</span>
                        <span style={{ color: "var(--color-text-dim)", fontVariantNumeric: "tabular-nums" }}>{pct.toFixed(0)}%</span>
                      </span>
                    );
                  })}
                </div>
                {/* Bars-over-time: stacked weekly bars, last 12 ISO weeks */}
                {stats.weeklyIntensityMax > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 10, color: "var(--color-border-strong)", marginBottom: 4 }}>last 12 weeks</div>
                    <svg viewBox="0 0 240 48" preserveAspectRatio="none"
                      style={{ width: "100%", height: 48, display: "block" }}>
                      {stats.weeklyIntensity.map((w, i) => {
                        const bw = 240 / stats.weeklyIntensity.length;
                        const x  = i * bw;
                        const colWidth = Math.max(0, bw - 2);
                        const totalHeight = (w.total / stats.weeklyIntensityMax) * 44;
                        let yCursor = 48 - totalHeight;
                        const segments = [];
                        // Stack from easy (bottom) to anaerobic (top).
                        for (const zId of ZONE_ORDER) {
                          const ratio = w.total > 0 ? w.zones[zId] / w.total : 0;
                          if (ratio <= 0) continue;
                          const segH = totalHeight * ratio;
                          segments.push(
                            <rect key={zId}
                              x={x + 1} y={yCursor}
                              width={colWidth} height={segH}
                              fill={ZONES[zId].color} opacity={0.95}>
                              <title>{`${w.key} · ${ZONES[zId].label}: ${w.zones[zId].toLocaleString()} yds`}</title>
                            </rect>
                          );
                          yCursor += segH;
                        }
                        return (
                          <g key={w.key}>
                            {segments}
                            {/* baseline tick for empty weeks */}
                            {w.total === 0 && (
                              <rect x={x + 1} y={47} width={colWidth} height={1} fill="var(--color-border)">
                                <title>{`${w.key}: no yards`}</title>
                              </rect>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                )}
              </div>
            )}

            {/* Type distribution bars */}
            {stats.sessions > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 10, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Type Breakdown</div>
                  <div style={{ display: "inline-flex", gap: 4, marginLeft: "auto" }}>
                    {[
                      { id: "4wk",  label: "4 wks"  },
                      { id: "12wk", label: "12 wks" },
                      { id: "all",  label: "All"    },
                    ].map(o => {
                      const active = typeWindow === o.id;
                      return (
                        <button key={o.id} onClick={() => setTypeWindow(o.id)}
                          style={{
                            fontSize: 9, padding: "1px 7px", borderRadius: 999,
                            border: `1px solid ${active ? "#7c3aed" : "var(--color-border)"}`,
                            background: active ? "#7c3aed33" : "transparent",
                            color: active ? "#c4b5fd" : "var(--color-text-dim)",
                            cursor: "pointer", fontWeight: 700,
                          }}>
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {stats.typeBreakdown.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {stats.typeBreakdown.map(({ type, count, pct }) => {
                      const meta     = WORKOUT_TYPES.find(t => t.id === type);
                      const maxCount = stats.typeBreakdown[0].count;
                      return (
                        <div key={type} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, color: "#cbd5e1", width: 90, flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {meta ? `${meta.emoji} ${meta.label}` : type}
                          </span>
                          <div style={{ flex: 1, background: "var(--color-bg)", borderRadius: 4, height: 8, overflow: "hidden" }}>
                            <div style={{ width: `${(count / maxCount) * 100}%`, height: "100%", background: meta ? meta.badge : "var(--color-primary)", borderRadius: 4, transition: "width 0.4s" }} />
                          </div>
                          <span style={{ fontSize: 11, color: "var(--color-text-dim)", width: 44, textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{count} · {pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: "var(--color-text-dim)", fontStyle: "italic", padding: "4px 0" }}>
                    No completed workouts in this window.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Entries */}
          {filtered.map(entry => {
            const meta       = WORKOUT_TYPES.find(t => t.id === entry.type);
            const isExpanded = expandedId === entry.id;
            const isEditing  = editingId === entry.id;
            // Filter via equipMode so the literal string "off" doesn't slip through
            // the truthy check (regression introduced when equipment moved from
            // booleans to the tri-state "off"|"preferred"|"required" strings).
            const eqList     = entry.equipment
              ? Object.keys(entry.equipment).filter(k => equipMode(entry.equipment, k) !== "off")
              : [];
            return (
              <div key={entry.id} className="card" style={{ borderRadius: 12, padding: 16, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, color: "#cbd5e1", fontVariantNumeric: "tabular-nums" }}>{entry.dateCompleted || "—"}</span>
                    <button
                      onClick={() => onUpdateCompleted(entry.id, !(entry.completed !== false))}
                      title={entry.completed !== false ? "Mark as planned" : "Mark as done"}
                      style={{
                        padding: "2px 9px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700,
                        background: entry.completed !== false ? "#16a34a22" : "#7c3aed22",
                        color:      entry.completed !== false ? "#86efac"   : "#c4b5fd",
                      }}>
                      {entry.completed !== false ? "✓ Done" : "Planned"}
                    </button>
                    {meta && (
                      <span style={{ background: meta.badge, color: meta.badgeText, borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
                        {meta.emoji} {meta.label}
                      </span>
                    )}
                    {entry.userInitials && (
                      <span title="Logged by"
                        style={{ background: "#0ea5e9", color: "#fff", borderRadius: 999, padding: "3px 9px", fontSize: 10, fontWeight: 800, letterSpacing: "0.06em" }}>
                        {entry.userInitials}
                      </span>
                    )}
                    <span style={{ fontSize: 13, color: "#fff", fontWeight: 700 }}>{(entry.totalYards || 0).toLocaleString()} {(entry.poolMode === "50m" || entry.poolMode === "25m") ? "m" : "yds"}</span>
                    {entry.estimatedMin && <span style={{ fontSize: 11, color: "var(--color-text-dim)" }}>~{entry.estimatedMin} min</span>}
                    {entry.multi_lane && Array.isArray(entry.multi_lane.lanes) && entry.multi_lane.lanes.length > 0 && (
                      <span title={`Generated for ${entry.multi_lane.lanes.length} lanes: ${entry.multi_lane.lanes.map(l => l.pace).join(" / ")}`}
                        style={{ background: "rgba(59, 130, 246, 0.18)", color: "var(--color-primary-text)", border: "1px solid rgba(59, 130, 246, 0.45)", borderRadius: 999, padding: "2px 8px", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em" }}>
                        🏊 {entry.multi_lane.lanes.length}-lane
                      </span>
                    )}
                    <span title={entry.difficulty != null ? `Self-rated difficulty: ${entry.difficulty}/5 — click to change` : "Click to rate difficulty (1–5)"}>
                      <StarRating
                        value={entry.difficulty ?? null}
                        size={14}
                        allowToggleClear={false}
                        showClear
                        onChange={n => onUpdateDifficulty(entry.id, n)}
                      />
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      style={{ padding: "4px 10px", background: "transparent", color: "var(--color-primary-text)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
                      {isExpanded ? "Hide" : "View"}
                    </button>
                    <button onClick={() => { setEditingId(entry.id); setEditingNotes(entry.notes || ""); }}
                      style={{ padding: "4px 10px", background: "transparent", color: "#cbd5e1", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
                      Notes
                    </button>
                    <button onClick={() => onRepeat(entry)}
                      title="Open this workout as a fresh, unsaved one to log again"
                      style={{ padding: "4px 10px", background: "transparent", color: "#86efac", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
                      🔁 Repeat
                    </button>
                    {entry.blocks && (
                      <button onClick={() => onRun(entry)}
                        title="Step through this workout section by section"
                        style={{ padding: "4px 10px", background: "transparent", color: "var(--color-primary-text)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
                        ▶ Run
                      </button>
                    )}
                    <button onClick={() => onLoadAndPrint(entry)}
                      style={{ padding: "4px 10px", background: "transparent", color: "#cbd5e1", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
                      🖨 Print
                    </button>
                    <button onClick={() => { if (window.confirm("Delete this workout from history?")) onDelete(entry.id); }}
                      style={{ padding: "4px 10px", background: "transparent", color: "#fca5a5", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
                      Delete
                    </button>
                  </div>
                </div>

                {eqList.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {eqList.map(k => (
                      <span key={k} style={{ background: "var(--color-border)", color: "#cbd5e1", padding: "2px 8px", borderRadius: 999, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{k}</span>
                    ))}
                  </div>
                )}

                {entry.focusNote && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--color-primary-text)", fontWeight: 600 }}>
                    🎯 {entry.focusNote}
                  </div>
                )}

                {isEditing ? (
                  <div style={{ marginTop: 12 }}>
                    <textarea value={editingNotes} onChange={e => setEditingNotes(e.target.value)} rows={2}
                      style={{ width: "100%", padding: 8, background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 6, fontSize: 13, fontFamily: "inherit", resize: "vertical" }} />
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button onClick={() => { onUpdateNotes(entry.id, editingNotes); setEditingId(null); }}
                        style={{ padding: "5px 14px", background: "var(--color-primary)", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Save Notes</button>
                      <button onClick={() => setEditingId(null)}
                        style={{ padding: "5px 14px", background: "transparent", color: "var(--color-text-muted)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>Cancel</button>
                    </div>
                  </div>
                ) : entry.notes ? (
                  <div style={{ marginTop: 8, color: "#cbd5e1", fontSize: 13, fontStyle: "italic", lineHeight: 1.4 }}>
                    “{entry.notes}”
                  </div>
                ) : null}

                {isExpanded && entry.blocks && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--color-border)" }}>
                    {entry.blocks.map((b, i) => b && b.kind === "dryland"
                      ? <DrylandBlock key={i} block={b} />
                      : <WorkoutBlock key={i} block={b} equipment={entry.equipment || {}} recentMainLabels={recentMainLabels} poolMode={entry.poolMode || "25y"} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }
