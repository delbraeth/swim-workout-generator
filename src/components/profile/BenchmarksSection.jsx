// src/components/profile/BenchmarksSection.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { csrfHeaders } from "../../lib/api.js";

    const { useState, useCallback, useEffect } = React;

    export function BenchmarksSection({ onPaceUpdate }) {
      const [list,        setList]        = React.useState(null);
      const [kind,        setKind]        = React.useState("t30");
      const [poolMode,    setPoolModeBM]  = React.useState("25y");
      // T-30 field: total distance in yards/meters
      const [t30Distance, setT30Distance] = React.useState("");
      // TT500 field: total time as M:SS string
      const [tt500Time,   setTt500Time]   = React.useState("");
      // Broken500 field: total time as M:SS string
      const [broken500Time, setBroken500Time] = React.useState("");
      const [notes,       setNotes]       = React.useState("");
      const [busy,        setBusy]        = React.useState(false);
      const [err,         setErr]         = React.useState(null);

      const load = React.useCallback(async () => {
        try {
          const res = await fetch("/api/benchmarks", { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setList(await res.json());
        } catch (e) { setList([]); setErr(e.message); }
      }, []);
      React.useEffect(() => { load(); }, [load]);

      const parseMSS = (s) => {
        const m = String(s || "").trim().match(/^(\d{1,2}):(\d{2})$/);
        if (!m) return null;
        const secs = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
        if (secs < 30 || secs > 1800) return null;
        return secs;
      };
      const fmtSecs = (s) => {
        if (s == null) return "—";
        const m = Math.floor(s / 60);
        const ss = String(s % 60).padStart(2, "0");
        return `${m}:${ss}`;
      };
      const fmtPace100 = (s) => fmtSecs(s) + "/100";

      const KIND_META = {
        t30:       { emoji: "🕒", label: "T-30",       desc: "30-min continuous swim — record total distance" },
        tt500:     { emoji: "🏁", label: "500 TT",     desc: "500 time trial — record total time" },
        broken500: { emoji: "💥", label: "Broken 500", desc: "10×50 on a generous interval — record total time" },
      };

      const submit = async () => {
        setErr(null);
        const body = { kind, pool_mode: poolMode, notes: notes.trim() || null };
        if (kind === "t30") {
          const yds = parseInt(t30Distance, 10);
          if (!Number.isFinite(yds) || yds < 100 || yds > 5000) { setErr("Enter total distance between 100 and 5000"); return; }
          body.total_yards = yds;
        } else if (kind === "tt500") {
          const secs = parseMSS(tt500Time);
          if (!secs) { setErr("Enter time as M:SS (3:00 to 30:00)"); return; }
          body.total_secs = secs;
        } else {
          const secs = parseMSS(broken500Time);
          if (!secs) { setErr("Enter time as M:SS (3:00 to 30:00)"); return; }
          body.total_secs = secs;
        }
        setBusy(true);
        try {
          const res = await fetch("/api/benchmarks", {
            method:  "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify(body),
          });
          const j = await res.json();
          if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
          // Auto-fill paceInput from t30/tt500 (not broken500).
          if ((kind === "t30" || kind === "tt500") && j.pace_100_secs && onPaceUpdate) {
            onPaceUpdate(fmtSecs(j.pace_100_secs));
          }
          // Reset inputs.
          setT30Distance(""); setTt500Time(""); setBroken500Time(""); setNotes("");
          await load();
        } catch (e) { setErr(e.message); }
        finally { setBusy(false); }
      };

      const remove = async (id) => {
        if (!window.confirm("Delete this benchmark entry?")) return;
        try {
          const res = await fetch(`/api/benchmarks/${id}`, { method: "DELETE", headers: { ...csrfHeaders() } });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          await load();
        } catch (e) { setErr(e.message); }
      };

      return (
        <div className="card" style={{
          display: "flex", flexDirection: "column", gap: 8,
          borderRadius: 8, padding: "8px 12px",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 13, color: "var(--color-text)", fontWeight: 600 }}>🎯 Benchmarks</div>
            <span style={{ fontSize: 10, color: "var(--color-text-dim)", fontStyle: "italic" }}>{list ? `${list.length} recorded` : "…"}</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--color-text-dim)", marginTop: -4 }}>
            Standard test-set results. T-30 / 500 TT auto-fill your generator pace.
          </div>

          {/* Kind picker */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {["t30","tt500","broken500"].map(k => {
              const m = KIND_META[k];
              const active = kind === k;
              return (
                <button key={k} onClick={() => setKind(k)} title={m.desc}
                  style={{
                    padding: "4px 9px", borderRadius: 999,
                    border: `1px solid ${active ? "var(--color-warn)" : "var(--color-border)"}`,
                    background: active ? "rgba(245,158,11,0.18)" : "transparent",
                    color: active ? "var(--color-warn)" : "var(--color-text-muted)",
                    fontSize: 11, fontWeight: 700, cursor: "pointer",
                  }}>
                  {m.emoji} {m.label}
                </button>
              );
            })}
          </div>

          {/* Kind-specific input */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {kind === "t30" && (
              <>
                <input type="number" min="100" max="5000" step="25"
                  value={t30Distance} onChange={(e) => setT30Distance(e.target.value)}
                  placeholder="Total yards (e.g. 1850)" aria-label="Total yards"
                  style={{ flex: 2, minWidth: 140, padding: "6px 8px", background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border)", borderRadius: 5, fontSize: 12 }} />
                {Number.isFinite(parseInt(t30Distance, 10)) && parseInt(t30Distance, 10) > 0 && (
                  <span style={{ fontSize: 11, color: "var(--color-text-dim)", fontFamily: "ui-monospace, monospace" }}>
                    → {fmtSecs(Math.round(1800 * 100 / Math.max(1, parseInt(t30Distance, 10))))}/100
                  </span>
                )}
              </>
            )}
            {(kind === "tt500" || kind === "broken500") && (
              <>
                <input type="text" value={kind === "tt500" ? tt500Time : broken500Time}
                  onChange={(e) => kind === "tt500" ? setTt500Time(e.target.value) : setBroken500Time(e.target.value)}
                  placeholder="M:SS (e.g. 6:30)" aria-label="Time (M:SS)"
                  style={{ flex: 2, minWidth: 140, padding: "6px 8px", background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border)", borderRadius: 5, fontSize: 12, fontFamily: "ui-monospace, monospace" }} />
                {parseMSS(kind === "tt500" ? tt500Time : broken500Time) && (
                  <span style={{ fontSize: 11, color: "var(--color-text-dim)", fontFamily: "ui-monospace, monospace" }}>
                    → {fmtSecs(Math.round(parseMSS(kind === "tt500" ? tt500Time : broken500Time) * 100 / 500))}/100
                  </span>
                )}
              </>
            )}
            <select value={poolMode} onChange={(e) => setPoolModeBM(e.target.value)} aria-label="Pool length"
              style={{ padding: "6px 8px", background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border)", borderRadius: 5, fontSize: 12 }}>
              <option value="25y">25y</option>
              <option value="25m">25m</option>
              <option value="50m">50m</option>
            </select>
            <button onClick={submit} disabled={busy}
              className="btn btn-md btn-filled btn-primary">
              {busy ? "…" : "Record"}
            </button>
          </div>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes" aria-label="Notes"
            maxLength={500}
            style={{ padding: "5px 8px", background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border)", borderRadius: 5, fontSize: 11 }} />
          {err && <div style={{ color: "#fca5a5", fontSize: 11 }}>{err}</div>}

          {/* List */}
          {list && list.length > 0 && (
            <div style={{ marginTop: 4 }}>
              {list.slice(0, 6).map(b => {
                const m = KIND_META[b.kind];
                return (
                  <div key={b.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, padding: "5px 8px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 5, marginBottom: 3, fontSize: 11 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                      <span style={{ color: "var(--color-text-muted)" }}>{m ? m.emoji : "•"}</span>
                      <span style={{ color: "var(--color-text)", fontWeight: 600 }}>{m ? m.label : b.kind}</span>
                      <span style={{ color: "var(--color-text-dim)" }}>·</span>
                      <span style={{ color: "var(--color-warn)", fontFamily: "ui-monospace, monospace" }}>{fmtPace100(b.pace_100_secs)}</span>
                      <span style={{ color: "var(--color-text-dim)" }}>·</span>
                      <span style={{ color: "var(--color-text-muted)", fontSize: 10 }}>{b.recorded_at ? new Date(b.recorded_at).toLocaleDateString() : ""}</span>
                      <span style={{ color: "var(--color-border-strong)", fontSize: 10 }}>({b.pool_mode})</span>
                    </div>
                    <button onClick={() => remove(b.id)}
                      title="Delete this entry"
                      style={{ padding: "2px 7px", background: "transparent", border: "1px solid var(--color-border-strong)", color: "var(--color-text-muted)", borderRadius: 4, fontSize: 10, cursor: "pointer" }}>×</button>
                  </div>
                );
              })}
              {list.length > 6 && (
                <div style={{ fontSize: 10, color: "var(--color-text-dim)", fontStyle: "italic", marginTop: 3 }}>
                  Showing 6 most recent of {list.length} total.
                </div>
              )}
            </div>
          )}
        </div>
      );
    }
