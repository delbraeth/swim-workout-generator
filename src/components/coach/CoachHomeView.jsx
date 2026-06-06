// src/components/coach/CoachHomeView.jsx — Coach portal (IA option 2, 2026-06-04).
// A role-aware command center that consolidates the scattered coach/lesson
// surfaces (roster, groups, teams, practices, catalog, my sets, reports) into one
// home, so the generator stays focused on generating. Reached from the nav; not
// the forced default landing. React is a runtime global.

    export function CoachHomeView({ me = null, onNavigate = () => {}, onGenerate = () => {} }) {
      const isCoach   = !!me?.is_coach;
      const canLesson = !!(me?.can_lesson || me?.is_coach);
      const [counts, setCounts] = React.useState({ swimmers: null, groups: null });

      React.useEffect(() => {
        let alive = true;
        // Best-effort counts — cards still render if a fetch fails.
        (async () => {
          try {
            const r = await fetch("/api/managed-swimmers", { cache: "no-store" });
            const a = r.ok ? await r.json() : [];
            if (alive) setCounts(c => ({ ...c, swimmers: Array.isArray(a) ? a.filter(s => !s.archived).length : 0 }));
          } catch (_) {}
          try {
            const r = await fetch("/api/lesson-groups", { cache: "no-store" });
            const a = r.ok ? await r.json() : [];
            if (alive) setCounts(c => ({ ...c, groups: Array.isArray(a) ? a.length : 0 }));
          } catch (_) {}
        })();
        return () => { alive = false; };
      }, []);

      // Cards. `coachOnly` ones only show for full coaches; the rest for any
      // lesson-access user. `count` keys read from the fetched counts.
      const cards = [
        { id: "swimmers",      emoji: "🏊", title: "Managed swimmers", desc: "Your roster — paces, equipment, lesson level, parents.", count: counts.swimmers },
        { id: "lesson-groups", emoji: "👥", title: "My groups",        desc: "Small-group lessons; assign one workout to everyone.", count: counts.groups },
        { id: "my-sets",       emoji: "📝", title: "My Sets",          desc: "Author your own sets — tag lesson + ability level." },
        { id: "teams",         emoji: "🏆", title: "Teams",            desc: "Club teams, groups, co-coaches, curation.",            coachOnly: true },
        { id: "practices",     emoji: "📋", title: "Practices",        desc: "Scheduled practices + attendance.",                    coachOnly: true },
        { id: "catalog",       emoji: "📚", title: "Catalog",          desc: "Browse the shared set library.",                        coachOnly: true },
        { id: "reports",       emoji: "📊", title: "Reports",          desc: "Programming mix, adherence, curation impact.",          coachOnly: true },
      ].filter(c => isCoach || !c.coachOnly);

      const cardStyle = {
        display: "flex", flexDirection: "column", gap: 4, textAlign: "left",
        padding: 16, borderRadius: 12, border: "1px solid var(--color-border)",
        background: "var(--color-card)", color: "var(--color-text)", cursor: "pointer",
        transition: "all 0.15s",
      };

      return (
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 16px" }}>
          <h2 style={{ fontSize: 22, marginBottom: 2 }}>🧭 Coach home</h2>
          <p style={{ fontSize: 13, color: "var(--color-text-dim)", marginTop: 0, marginBottom: 18 }}>
            Everything you coach, in one place.{!isCoach && canLesson ? " (Lesson tier — Teams, Practices, Catalog & Reports are Coach features.)" : ""}
          </p>

          {/* Primary CTA — generate */}
          <button onClick={onGenerate}
            style={{ ...cardStyle, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18,
              border: "1px solid var(--color-primary)", background: "rgba(59,130,246,0.10)" }}>
            <span style={{ fontSize: 28 }}>➕</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontWeight: 700, fontSize: 15, color: "var(--color-primary-text)" }}>Generate a workout</span>
              <span style={{ display: "block", fontSize: 12, color: "var(--color-text-dim)" }}>Build a session — then assign it to a swimmer or group.</span>
            </span>
            <span style={{ color: "var(--color-primary-text)", fontSize: 20 }}>→</span>
          </button>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            {cards.map(c => (
              <button key={c.id} onClick={() => onNavigate(c.id)} style={cardStyle}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--color-primary)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--color-border)"; }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 22 }}>{c.emoji}</span>
                  {typeof c.count === "number" && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-dim)", background: "var(--color-bg)", borderRadius: 999, padding: "2px 9px" }}>{c.count}</span>
                  )}
                </span>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{c.title}</span>
                <span style={{ fontSize: 12, color: "var(--color-text-dim)", lineHeight: 1.45 }}>{c.desc}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }
