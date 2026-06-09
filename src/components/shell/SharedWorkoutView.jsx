// src/components/shell/SharedWorkoutView.jsx — PUBLIC read-only view of a shared
// workout (/s/:id), rendered OUTSIDE the SignInGate so a logged-out person (even a
// non-user) can see it. Doubles as a growth surface: "make your own free". React global.
const btnPrimary = { padding: "9px 16px", borderRadius: 7, border: "none", background: "var(--color-primary)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const btnGhost   = { padding: "9px 16px", borderRadius: 7, border: "1px solid var(--color-border-strong)", background: "transparent", color: "var(--color-text-muted)", fontSize: 13, fontWeight: 700, cursor: "pointer" };

export function SharedWorkoutView({ token, authenticated, onCopyToGenerator }) {
  const { useState, useEffect } = React;
  const [data, setData] = useState(undefined);   // undefined = loading, null = error/not-found

  useEffect(() => {
    let off = false;
    fetch(`/api/share/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(j => { if (!off) setData(j); })
      .catch(() => { if (!off) setData(null); });
    return () => { off = true; };
  }, [token]);

  const page = { minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)", padding: "32px 16px", display: "flex", flexDirection: "column", alignItems: "center" };
  const card = { width: "100%", maxWidth: 680, background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: 20 };

  if (data === undefined) return <div style={page}><div style={{ color: "var(--color-text-dim)", marginTop: 40 }}>Loading shared workout…</div></div>;
  if (data === null) return (
    <div style={page}><div style={card}>
      <h2 style={{ marginTop: 0, fontSize: 18 }}>🏊 SetForge</h2>
      <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>This shared workout isn’t available — the link may be wrong, or the owner removed it.</p>
      <a href="/" style={{ ...btnPrimary, textDecoration: "none", display: "inline-block" }}>Go to SetForge →</a>
    </div></div>
  );

  const w = data.workout || {};
  const unit = (w.poolMode === "50m" || w.poolMode === "25m") ? "m" : "yds";
  return (
    <div style={page}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>🏊 {data.title || "Shared workout"}</h2>
          <a href="/" style={{ color: "var(--color-text-dim)", fontSize: 12, textDecoration: "none" }}>SetForge</a>
        </div>
        <div style={{ color: "var(--color-text-dim)", fontSize: 12, marginBottom: 14 }}>
          {(w.totalYards || 0).toLocaleString()} {unit}{w.estimatedMin ? ` · ~${w.estimatedMin} min` : ""} · read-only
        </div>
        {(w.blocks || []).map((b, bi) => (
          <div key={bi} style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
              {b.name || b.section}{b.rounds > 1 ? ` ×${b.rounds}` : ""}
              {b.totalYards ? <span style={{ color: "var(--color-text-dim)", fontWeight: 400, fontSize: 12 }}> · {b.totalYards} {unit}</span> : null}
            </div>
            {(b.sets || []).map((s, si) => (
              <div key={si} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "4px 0", borderBottom: "1px solid var(--color-border)", fontSize: 13 }}>
                <span><strong>{s.reps > 1 ? `${s.reps} × ${s.dist}` : `${s.dist}`}</strong> {s.desc}</span>
                <span style={{ color: "var(--color-text-muted)", fontFamily: "monospace", whiteSpace: "nowrap" }}>{s.interval || ""}</span>
              </div>
            ))}
          </div>
        ))}
        <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
          {authenticated && onCopyToGenerator
            ? <button onClick={() => onCopyToGenerator(w)} style={btnPrimary}>Copy to my workouts →</button>
            : <a href="/" style={{ ...btnPrimary, textDecoration: "none", display: "inline-block" }}>Sign in to copy →</a>}
          <a href="/" style={{ ...btnGhost, textDecoration: "none", display: "inline-block" }}>Make your own free →</a>
        </div>
        <div style={{ color: "var(--color-text-dim)", fontSize: 11, marginTop: 14 }}>Shared via SetForge — free swim-workout generator.</div>
      </div>
    </div>
  );
}
