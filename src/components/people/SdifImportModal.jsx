// src/components/people/SdifImportModal.jsx — Hy-Tek SDIF (.sd3/.cl2) import.
// Upload → dry-run PREVIEW (create/match/times/skipped) → Confirm → commit.
// Posts the file as text/plain to POST /api/teams/:id/import/sdif. React is a global.
import { csrfHeaders } from "../../lib/api.js";

const fmtTime = (s) => {
  if (s == null) return "—";
  const m = Math.floor(s / 60), sec = (s % 60).toFixed(2).padStart(5, "0");
  return m > 0 ? `${m}:${sec}` : Number(s).toFixed(2);
};
const OUTCOME = {
  new:         { label: "new",   color: "var(--color-positive)" },
  faster:      { label: "PR ↓",  color: "var(--color-primary)" },
  slower_skip: { label: "kept",  color: "var(--color-text-dim)" },
};

export function SdifImportModal({ teamId, onClose, onImported }) {
  const { useState } = React;
  const [text, setText]         = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy]         = useState(false);
  const [preview, setPreview]   = useState(null);
  const [committed, setCommitted] = useState(null);
  const [err, setErr]           = useState(null);

  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setErr(null); setPreview(null); setCommitted(null); setFileName(f.name);
    const r = new FileReader();
    r.onload  = () => setText(String(r.result || ""));
    r.onerror = () => setErr("Couldn't read that file.");
    r.readAsText(f);
  };

  const run = async (commit) => {
    if (!text || text.length < 4) { setErr("Choose a .sd3 / .cl2 file first."); return; }
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/teams/${teamId}/import/sdif${commit ? "?commit=1" : ""}`, {
        method: "POST", headers: { "Content-Type": "text/plain", ...csrfHeaders() }, body: text,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      if (commit) { setCommitted(j); if (onImported) onImported(); }
      else setPreview(j);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "5vh 16px", overflowY: "auto" };
  const card    = { background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: 20, width: "100%", maxWidth: 640 };
  const btn     = (bg, fg) => ({ padding: "8px 14px", borderRadius: 6, border: "none", background: bg, color: fg, fontSize: 13, fontWeight: 700, cursor: busy ? "wait" : "pointer" });

  const t = preview?.totals;

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h3 style={{ color: "var(--color-text)", margin: 0, fontSize: 16 }}>📥 Import Hy-Tek best times (SDIF)</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--color-text-dim)", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>
        <p style={{ color: "var(--color-text-dim)", fontSize: 12, margin: "0 0 14px", lineHeight: 1.5 }}>
          Upload a <code>.sd3</code> / <code>.cl2</code> export from Hy-Tek Team or Meet Manager. SetForge matches swimmers (USA-Swimming ID, then name + birthdate), creates any new ones on this team, and saves their best times as PRs — feeding race-pace targets. Only the 8 tracked events import; others are listed as skipped. <strong>Preview first — nothing is written until you confirm.</strong>
        </p>

        {!committed && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
            <label style={{ ...btn("var(--color-bg)", "var(--color-text)"), border: "1px solid var(--color-border-strong)", display: "inline-block" }}>
              Choose file
              <input type="file" accept=".sd3,.cl2,.txt,.zip" onChange={onFile} style={{ display: "none" }} />
            </label>
            <span style={{ color: "var(--color-text-muted)", fontSize: 12 }}>{fileName || "no file chosen"}</span>
            <button onClick={() => run(false)} disabled={busy || !text} style={btn((busy || !text) ? "var(--color-border)" : "var(--color-primary)", "#fff")}>
              {busy ? "Working…" : "Preview"}
            </button>
          </div>
        )}

        {err && <div style={{ color: "var(--color-warn)", fontSize: 12, marginBottom: 12, padding: "8px 10px", background: "rgba(245,158,11,0.12)", borderRadius: 6 }}>{err}</div>}

        {/* Preview */}
        {preview && !committed && t && (
          <div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "var(--color-text-muted)", marginBottom: 10, padding: "8px 10px", background: "var(--color-bg)", borderRadius: 6 }}>
              <span><strong style={{ color: "var(--color-positive)" }}>{t.newSwimmers}</strong> new swimmers</span>
              <span><strong style={{ color: "var(--color-text)" }}>{t.matched}</strong> matched</span>
              {t.skippedNoDob > 0 && <span style={{ color: "var(--color-warn)" }}><strong>{t.skippedNoDob}</strong> skipped — no birthdate in file (add manually, then re-import)</span>}
              <span><strong style={{ color: "var(--color-primary)" }}>{t.timesToWrite}</strong> times to write</span>
              {t.timesSkipped > 0 && <span><strong>{t.timesSkipped}</strong> kept (existing faster)</span>}
              {t.eventsSkipped > 0 && <span><strong>{t.eventsSkipped}</strong> untracked-event rows</span>}
            </div>
            <div style={{ maxHeight: "38vh", overflowY: "auto", display: "grid", gap: 6 }}>
              {preview.swimmers.map((s, i) => (
                <div key={i} style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ color: "var(--color-text)", fontWeight: 700, fontSize: 13 }}>{s.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 3,
                      background: s.status === "new" ? "rgba(34,197,94,0.18)" : s.status === "skipped_no_dob" ? "rgba(245,158,11,0.18)" : "var(--color-border)",
                      color: s.status === "new" ? "var(--color-positive)" : s.status === "skipped_no_dob" ? "var(--color-warn)" : "var(--color-text-muted)" }}>
                      {s.status === "new" ? "NEW" : s.status === "skipped_no_dob" ? "NO BIRTHDATE — SKIPPED" : "MATCHED"}</span>
                    {s.dob && <span style={{ color: "var(--color-text-dim)", fontSize: 11 }}>{s.dob}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                    {s.times.map((tm, j) => {
                      const o = OUTCOME[tm.outcome] || OUTCOME.new;
                      return <span key={j} title={tm.outcome} style={{ fontSize: 11, fontFamily: "monospace", padding: "1px 6px", borderRadius: 4, border: `1px solid ${o.color}`, color: o.color }}>{tm.eventLabel} {tm.course} · {fmtTime(tm.timeSecs)} <em style={{ fontStyle: "normal", opacity: 0.7 }}>{o.label}</em></span>;
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button onClick={() => run(true)} disabled={busy || (t.newSwimmers === 0 && t.timesToWrite === 0)} style={btn((busy || (t.newSwimmers === 0 && t.timesToWrite === 0)) ? "var(--color-border)" : "var(--color-positive)", "#fff")}>
                {busy ? "Importing…" : `Confirm import — ${t.newSwimmers} new, ${t.timesToWrite} times`}
              </button>
              <button onClick={() => { setPreview(null); setText(""); setFileName(""); }} disabled={busy} style={btn("transparent", "var(--color-text-muted)")}>Start over</button>
            </div>
          </div>
        )}

        {/* Committed */}
        {committed && (
          <div>
            <div style={{ color: "var(--color-positive)", fontSize: 14, fontWeight: 700, marginBottom: 8 }}>✓ Import complete</div>
            <div style={{ fontSize: 13, color: "var(--color-text)", lineHeight: 1.7 }}>
              Created <strong>{committed.committed?.swimmersCreated ?? 0}</strong> swimmers · wrote <strong>{committed.committed?.timesWritten ?? 0}</strong> best times.
              {committed.totals?.eventsSkipped > 0 && <div style={{ color: "var(--color-text-dim)", fontSize: 12 }}>{committed.totals.eventsSkipped} rows for untracked events were skipped.</div>}
              {committed.committed?.errors?.length > 0 && <div style={{ color: "var(--color-warn)", fontSize: 12, marginTop: 6 }}>{committed.committed.errors.length} row(s) had errors (e.g. missing birthdate) — they were skipped, the rest imported.</div>}
            </div>
            <button onClick={onClose} style={{ ...btn("var(--color-primary)", "#fff"), marginTop: 14 }}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
