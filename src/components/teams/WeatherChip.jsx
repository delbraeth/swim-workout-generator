// src/components/teams/WeatherChip.jsx — Phase 5 #5 Slice B (WeatherKit).
// Lazily fetches GET /api/events/:id/weather and renders a compact forecast
// chip for OUTDOOR events. Self-hides when there's no weather (indoor venue,
// no coords, not configured, outside horizon, or fetch error) so it never
// blocks the event row. Mount it only for outdoor venues to avoid pointless
// fetches. React is a runtime global.

// `wx` prop (batched mode): when the parent supplies it from GET /api/events/weather,
// the chip renders that directly and does NOT fetch — collapsing the per-row fan-out.
// When `wx` is omitted (standalone), it lazily fetches its own forecast as before.
export function WeatherChip({ eventId, wx }) {
  const batched = wx !== undefined;
  const [fetched, setFetched] = React.useState(undefined);   // undefined = loading, null = none

  React.useEffect(() => {
    if (batched) return;   // parent supplies the forecast via the batch endpoint
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/events/${eventId}/weather`, { cache: "no-store" });
        const j = r.ok ? await r.json() : null;
        if (alive) setFetched(j && j.weather ? j.weather : null);
      } catch (_) { if (alive) setFetched(null); }
    })();
    return () => { alive = false; };
  }, [eventId, batched]);

  const data = batched ? wx : fetched;
  if (data === undefined || data === null) return null;

  const temp = data.atStart?.tempF ?? data.tempMaxF;
  const lo = data.tempMinF;
  const cond = data.atStart?.condition || data.condition;
  const emoji = data.atStart?.emoji || data.emoji;
  const adv = data.advisory || {};

  return (
    <span title={`${cond}${data.precipChance != null ? ` · ${Math.round(data.precipChance * 100)}% precip` : ""}`}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, marginLeft: 8, padding: "1px 7px", borderRadius: 10, fontSize: 11, fontWeight: 700,
        background: "var(--color-card)", border: "1px solid var(--color-border-strong)", color: "var(--color-text-muted)" }}>
      <span>{emoji}</span>
      {temp != null && <span>{temp}°{lo != null && data.atStart == null ? `/${lo}°` : ""}F</span>}
      {adv.lightning && <span title="Lightning risk in the event window" style={{ color: "var(--color-warn)" }}>⚡</span>}
      {adv.heat && <span title="Heat advisory (≥90°F)" style={{ color: "var(--color-destructive-text)" }}>🥵</span>}
    </span>
  );
}
