// src/components/multipace/WhiteboardPrintView.jsx
// Eval 2026-06-06 roadmap #2 — single-page, big-font, landscape "whiteboard"
// print. Three deck coaches (summer-league, HS, club) all asked for one sheet
// they can post pool-side / transcribe onto a whiteboard, NOT the per-lane
// multi-page MultiPacePrintView. No swimmer names; large type readable from
// across a deck. Mirrors the multipace overlay print mechanism (body class +
// auto window.print(); print CSS scoped to .whiteboard-active in index.html).

export function WhiteboardPrintView({ workout, onClose, unit = "yds" }) {
  React.useEffect(() => {
    document.body.classList.add("whiteboard-active");
    const t = setTimeout(() => { try { window.print(); } catch (_) {} }, 250);
    return () => {
      document.body.classList.remove("whiteboard-active");
      clearTimeout(t);
    };
  }, []);

  const blocks = (workout && workout.blocks) || [];
  const title  = workout?.typeLabel || workout?.type || "Workout";

  return (
    <div className="whiteboard-overlay" style={{ position: "fixed", inset: 0, zIndex: 10000, background: "#fff", color: "#000", overflow: "auto" }}>
      <button className="screen-only" onClick={onClose}
        style={{ position: "fixed", top: 12, right: 14, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", fontSize: 12, fontWeight: 700, cursor: "pointer", zIndex: 10001 }}>
        ✕ Close print view
      </button>
      <div className="whiteboard-page" style={{ padding: "0.4in", fontFamily: "Arial, Helvetica, sans-serif" }}>
        <div style={{ borderBottom: "3pt solid #000", paddingBottom: 6, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16 }}>
          <div style={{ fontSize: "30pt", fontWeight: 800, lineHeight: 1.05 }}>{title}</div>
          <div style={{ fontSize: "18pt", fontWeight: 700, whiteSpace: "nowrap" }}>
            {workout?.totalYards} {unit}{workout?.estimatedMin ? ` · ~${workout.estimatedMin} min` : ""}
          </div>
        </div>
        {blocks.map((block, bi) => (
          <div key={bi} className="whiteboard-block" style={{ marginBottom: 12, pageBreakInside: "avoid", breakInside: "avoid" }}>
            <div style={{ fontSize: "15pt", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.03em", borderBottom: "1.5pt solid #000", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
              <span>{block.name || block.label || block.section}</span>
              <span style={{ fontWeight: 600 }}>{block.totalYards}</span>
            </div>
            {block.kind === "dryland"
              ? (block.exercises || []).map((ex, ei) => (
                  <div key={"dl" + ei} style={{ fontSize: "17pt", fontWeight: 600, marginBottom: 2 }}>
                    <b>{ex.sets > 1 ? `${ex.sets} × ${ex.reps}` : ex.reps}</b> — {ex.name}{ex.rest ? ` (rest ${ex.rest})` : ""}
                  </div>
                ))
              : (block.sets || []).map((s, si) => (
                  <div key={si} style={{ fontSize: "19pt", fontWeight: 700, marginBottom: 3, display: "flex", justifyContent: "space-between", gap: 16, lineHeight: 1.15 }}>
                    <span><b style={{ fontWeight: 800 }}>{s.reps}×{s.dist}</b>{s.eq ? ` [${s.eq}]` : ""} {s.desc || ""}</span>
                    <span style={{ fontFamily: "'Courier New', monospace", whiteSpace: "nowrap", fontWeight: 800 }}>{s.interval || ""}</span>
                  </div>
                ))
            }
            {block.rounds && block.rounds > 1 ? (
              <div style={{ fontSize: "14pt", fontStyle: "italic", marginTop: 2 }}>
                × {block.rounds} rounds{block.roundRestSecs ? ` · rest ${block.roundRestSecs}s between` : ""}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
