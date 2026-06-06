// src/components/reports/ReportsView.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { REPORT_RANGES } from "../../lib/constants.js";
import { reportToMarkdown } from "../../lib/workout-helpers.js";
import { R1ProgrammingMixTab } from "./R1ProgrammingMixTab.jsx";
import { R2ScheduleAdherenceTab } from "./R2ScheduleAdherenceTab.jsx";
import { R3CurationLogTab } from "./R3CurationLogTab.jsx";
import { R4ProgramRecapTab } from "./R4ProgramRecapTab.jsx";
import { R5PlatformHealthTab } from "./R5PlatformHealthTab.jsx";
import { R6CurationSupportTab } from "./R6CurationSupportTab.jsx";
import { ReportPrintView } from "./ReportPrintView.jsx";

    const { useState, useEffect } = React;

    export function ReportsView({ isCoach = false, isAdmin = false }) {
      // Non-coaches land on Program Recap (R4) — the only tab they can see.
      // Coaches default to Programming Mix (R1) as before. Admin gets two
      // extra tabs (R5 Platform Health, R6 Curation & Support).
      const [tab, setTab] = React.useState(isCoach ? "programming-mix" : "program-recap");
      const [range, setRange] = React.useState("month");
      const [groupId, setGroupId] = React.useState("");   // "" = all groups
      const [groups, setGroups] = React.useState([]);
      const [data, setData] = React.useState(null);
      const [err, setErr] = React.useState(null);
      const [loading, setLoading] = React.useState(false);
      // Phase E — print-view overlay state. null = not printing. Holds the
      // tab + data snapshot at the moment Print was clicked so the overlay
      // renders the same data even if filters change.
      const [printingData, setPrintingData] = React.useState(null);

      // Load coach's groups for the filter dropdown (coach-only endpoint).
      React.useEffect(() => {
        if (!isCoach) return;
        fetch("/api/picker/coach-targets", { cache: "no-store" })
          .then(r => r.ok ? r.json() : [])
          .then(list => setGroups(Array.isArray(list) ? list : []))
          .catch(() => setGroups([]));
      }, [isCoach]);

      // Re-fetch the active report whenever tab / range / groupId changes.
      React.useEffect(() => {
        const qs = new URLSearchParams({ range });
        if (groupId) qs.set("group_id", groupId);
        const url = `/api/reports/${tab}?${qs}`;
        setLoading(true); setErr(null); setData(null);
        fetch(url, { cache: "no-store" })
          .then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(new Error(j.error || `HTTP ${r.status}`))))
          .then(d => { setData(d); setLoading(false); })
          .catch(e => { setErr(e.message); setLoading(false); });
      }, [tab, range, groupId]);

      // Coach tabs gated to coaches; admin tabs gated to admins; Program
      // Recap is always visible.
      const tabs = [
        ...(isCoach ? [
          { id: "programming-mix",    label: "📈 Programming Mix" },
          { id: "schedule-adherence", label: "🗓 Schedule Adherence" },
          { id: "curation-log",       label: "🎚 Curation Log" },
        ] : []),
        { id: "program-recap",        label: "📖 Program Recap" },
        ...(isAdmin ? [
          { id: "platform-health",    label: "🩺 Platform Health" },
          { id: "curation-support",   label: "🛡 Curation & Support" },
        ] : []),
      ];

      return (
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, color: "var(--color-text)" }}>📊 Reports</h2>
            <span style={{ color: "var(--color-text-dim)", fontSize: 13 }}>
              Self-only coach view · numbers + tables (charts in a future phase)
            </span>
          </div>

          {/* Sticky filter row: range + group */}
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
            padding: 12, background: "var(--color-card)", border: "1px solid var(--color-border)",
            borderRadius: 8, marginBottom: 14,
          }}>
            <span style={{ color: "var(--color-text-dim)", fontSize: 12, fontWeight: 600 }}>RANGE</span>
            {REPORT_RANGES.map(r => {
              const active = range === r.id;
              return (
                <button key={r.id} onClick={() => setRange(r.id)}
                  style={{
                    padding: "5px 12px", borderRadius: 999,
                    border: `1px solid ${active ? "var(--color-primary)" : "var(--color-border)"}`,
                    background: active ? "#1e3a5f" : "var(--color-bg)",
                    color: active ? "var(--color-primary)" : "var(--color-text-dim)",
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                  }}>{r.label}</button>
              );
            })}
            {groups.length > 0 && (
              <>
                <span style={{ color: "var(--color-text-dim)", fontSize: 12, fontWeight: 600, marginLeft: 8 }}>GROUP</span>
                <select value={groupId} onChange={e => setGroupId(e.target.value)}
                  style={{
                    padding: "5px 10px", borderRadius: 6,
                    background: "var(--color-bg)", color: "var(--color-text)",
                    border: "1px solid var(--color-border-strong)", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>
                  <option value="">All groups</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </>
            )}
            {data && (
              <span style={{ marginLeft: "auto", color: "var(--color-text-muted)", fontSize: 11 }}>
                {data.startYmd} → {data.endYmd}
              </span>
            )}
            {/* Phase E export buttons. PDF print disabled for R5/R6 (admin-
                internal — no share use case). Markdown available for all. */}
            {data && (
              <div style={{ display: "flex", gap: 6 }}>
                {["programming-mix", "schedule-adherence", "curation-log", "program-recap"].includes(tab) && (
                  <button onClick={() => setPrintingData({ tab, data })}
                    title="Open a print-friendly view, then use your browser's print dialog to save as PDF"
                    style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--color-primary)", background: "transparent", color: "var(--color-primary-text)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    📄 Print / PDF
                  </button>
                )}
                <button onClick={() => {
                  const md = reportToMarkdown(tab, data);
                  const filename = `setforge-${tab}-${data.startYmd}-to-${data.endYmd}.md`;
                  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = filename;
                  document.body.appendChild(a); a.click();
                  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
                }}
                  title="Download a markdown file (paste into email, Slack, Notion, etc.)"
                  style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--color-border-strong)", background: "transparent", color: "var(--color-text-dim)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  📋 Markdown
                </button>
              </div>
            )}
          </div>

          {/* Tab nav */}
          <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--color-border)", marginBottom: 16 }}>
            {tabs.map(t => {
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  style={{
                    padding: "10px 16px", border: "none", background: "transparent",
                    color: active ? "var(--color-primary)" : "var(--color-text-dim)",
                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                    borderBottom: `3px solid ${active ? "var(--color-primary)" : "transparent"}`,
                    marginBottom: -1,
                  }}>{t.label}</button>
              );
            })}
          </div>

          {/* Tab body */}
          {loading && <div style={{ color: "var(--color-text-dim)" }}>Loading…</div>}
          {err && <div style={{ color: "var(--color-destructive-text)", padding: 12, background: "rgba(239,68,68,0.08)", borderRadius: 6 }}>⚠ {err}</div>}
          {!loading && !err && data && tab === "programming-mix"    && <R1ProgrammingMixTab data={data} />}
          {!loading && !err && data && tab === "schedule-adherence" && <R2ScheduleAdherenceTab data={data} hasGroup={!!groupId} />}
          {!loading && !err && data && tab === "curation-log"       && <R3CurationLogTab data={data} />}
          {!loading && !err && data && tab === "program-recap"      && <R4ProgramRecapTab data={data} />}
          {!loading && !err && data && tab === "platform-health"    && <R5PlatformHealthTab data={data} />}
          {!loading && !err && data && tab === "curation-support"   && <R6CurationSupportTab data={data} />}

          {/* Phase E print overlay. Mounted at the ReportsView root so
              the body class scoping works correctly. */}
          {printingData && (
            <ReportPrintView
              tab={printingData.tab}
              data={printingData.data}
              rangeLabel={`${printingData.data.startYmd} → ${printingData.data.endYmd}${printingData.data.groupId ? ` · group ${printingData.data.groupId}` : ""}`}
              onClose={() => setPrintingData(null)}
            />
          )}
        </div>
      );
    }
