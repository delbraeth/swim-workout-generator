// src/components/teams/WeatherChip.jsx — Phase 5 #5 Slice B (WeatherKit).
// Lazily fetches GET /api/events/:id/weather and renders a compact forecast
// chip for OUTDOOR events. Self-hides when there's no weather (indoor venue,
// no coords, not configured, outside horizon, or fetch error) so it never
// blocks the event row. Mount it only for outdoor venues to avoid pointless
// fetches. React is a runtime global.

export function WeatherChip({ eventId }) {
  const [wx, setWx] = React.useState(undefined);   // undefined = loading, null = none

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/events/${eventId}/weather`, { cache: "no-store" });
        const j = r.ok ? await r.json() : null;
        if (alive) setWx(j && j.weather ? j.weather : null);
      } catch (_) { if (alive) setWx(null); }
    })();
    return () => { alive = false; };
  }, [eventId]);

  if (wx === undefined || wx === null) return null;

  const temp = wx.atStart?.tempF ?? wx.tempMaxF;
  const lo = wx.tempMinF;
  const cond = wx.atStart?.condition || wx.condition;
  const emoji = wx.atStart?.emoji || wx.emoji;
  const adv = wx.advisory || {};

  return (
    <span title={`${cond}${wx.precipChance != null ? ` · ${Math.round(wx.precipChance * 100)}% precip` : ""}`}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, marginLeft: 8, padding: "1px 7px", borderRadius: 10, fontSize: 11, fontWeight: 700,
        background: "var(--color-card)", border: "1px solid var(--color-border-strong)", color: "var(--color-text-muted)" }}>
      <span>{emoji}</span>
      {temp != null && <span>{temp}°{lo != null && wx.atStart == null ? `/${lo}°` : ""}F</span>}
      {adv.lightning && <span title="Lightning risk in the event window" style={{ color: "var(--color-warn)" }}>⚡</span>}
      {adv.heat && <span title="Heat advisory (≥90°F)" style={{ color: "var(--color-destructive-text)" }}>🥵</span>}
    </span>
  );
}
