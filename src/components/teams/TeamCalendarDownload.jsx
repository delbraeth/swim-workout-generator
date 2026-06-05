// src/components/teams/TeamCalendarDownload.jsx — Phase 5 Slice A.
// End-user (parent + swimmer portal) exposure of the team calendar: a one-click
// .ics download per team. A download is the most universal calendar hand-off —
// double-click opens it in Apple Calendar / imports to Google, no URL pasting. The
// feed URL backs the download via an <a download> (same-origin), so the token is
// never shown. MAAP-safe: the feed carries no minor PII, and this can't rotate the
// token. Renders nothing if the user has no teams. React is a runtime global.

function slug(s) {
  return String(s || "team").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "team";
}

export function TeamCalendarDownload({ heading = "📆 Team calendar" }) {
  const [teams, setTeams] = React.useState(null); // null = loading

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/me/team-calendars", { cache: "no-store" });
        const a = r.ok ? await r.json() : [];
        if (alive) setTeams(Array.isArray(a) ? a : []);
      } catch (_) { if (alive) setTeams([]); }
    })();
    return () => { alive = false; };
  }, []);

  if (teams === null || teams.length === 0) return null; // silent when nothing to show

  const link = {
    fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 6,
    border: "1px solid var(--color-border)", background: "transparent",
    color: "var(--color-primary)", cursor: "pointer", whiteSpace: "nowrap",
    textDecoration: "none", display: "inline-block",
  };

  return (
    <div style={{ marginTop: 14, padding: 14, borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--color-card)" }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{heading}</div>
      <p style={{ fontSize: 12, color: "var(--color-text-dim)", marginTop: 0, marginBottom: 10 }}>
        Download a team’s schedule (practices + team events) and open it in your calendar app.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {teams.map(t => (
          <div key={t.team_id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 120 }}>{t.team_name}</span>
            <a href={t.url} download={`${slug(t.team_name)}.ics`} style={link}>⬇ Download .ics</a>
          </div>
        ))}
      </div>
    </div>
  );
}
