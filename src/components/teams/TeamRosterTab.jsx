// src/components/teams/TeamRosterTab.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).

    const { useState, useEffect, Fragment } = React;

    export function TeamRosterTab({ teamId }) {
      const [data, setData] = React.useState(null);                            // null = loading
      const [msg,  setMsg]  = React.useState(null);
      React.useEffect(() => {
        let cancelled = false;
        (async () => {
          try {
            const res = await fetch(`/api/teams/${teamId}/roster`, { cache: "no-store" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const d = await res.json();
            if (!cancelled) setData(Array.isArray(d) ? d : []);
          } catch (e) {
            if (!cancelled) { setMsg(`Error loading roster: ${e.message}`); setData([]); }
          }
        })();
        return () => { cancelled = true; };
      }, [teamId]);

      if (data === null) {
        return <div style={{ color: "var(--color-text-dim)", fontSize: 12, padding: 12 }}>Loading roster…</div>;
      }
      const totalMembers = data.reduce((s, g) => s + g.member_count, 0);

      return (
        <div className="card" style={{ borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
            <h3 style={{ color: "var(--color-text)", marginTop: 0, marginBottom: 0, fontSize: 15 }}>
              🏊 Team Roster
              <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)" }}>
                ({totalMembers} {totalMembers === 1 ? "swimmer" : "swimmers"} across {data.length} {data.length === 1 ? "group" : "groups"})
              </span>
            </h3>
            {totalMembers > 0 && (
              <a href={`/api/teams/${teamId}/roster.csv`} download
                 title="Download roster as a Hy-Tek Meet Manager CSV"
                 style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary-text)", textDecoration: "none", border: "1px solid var(--color-border)", borderRadius: 6, padding: "5px 10px", whiteSpace: "nowrap" }}>
                ⬇ Roster CSV
              </a>
            )}
          </div>
          {data.length === 0 ? (
            <div style={{ color: "var(--color-text-dim)", fontSize: 12, fontStyle: "italic", padding: 12 }}>
              No active groups in this team yet. Create one from the Groups tab.
            </div>
          ) : (
            data.map(section => (
              <div key={section.group_id} style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "6px 0", borderBottom: "2px solid var(--color-primary)", marginBottom: 8 }}>
                  <span style={{ color: "var(--color-text)", fontSize: 13, fontWeight: 700 }}>{section.group_name}</span>
                  {section.pool_mode && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#3b82f622", border: "1px solid var(--color-primary)", color: "var(--color-primary-text)", fontWeight: 700 }}>{section.pool_mode}</span>}
                  <span style={{ color: "var(--color-text-muted)", fontSize: 11, marginLeft: "auto" }}>
                    {section.member_count} {section.member_count === 1 ? "swimmer" : "swimmers"}
                  </span>
                </div>
                {section.member_count === 0 ? (
                  <div style={{ color: "var(--color-text-dim)", fontSize: 11, fontStyle: "italic", padding: "4px 8px" }}>
                    No swimmers in this group yet.
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, fontSize: 12 }}>
                    {section.members.map(m => (
                      <React.Fragment key={m.id}>
                        <div style={{ color: "var(--color-text)", padding: "4px 8px", borderBottom: "1px solid var(--color-card)" }}>
                          {m.display_name || m.initials || "(no name)"}
                          {m.is_minor === true && <span title="Minor" style={{ marginLeft: 6, fontSize: 10, padding: "1px 5px", borderRadius: 3, background: "rgba(245,158,11,0.15)", color: "var(--color-warn)", fontWeight: 700 }}>minor</span>}
                          {m.is_coppa_protected === true && <span title="COPPA-protected (under 13)" style={{ marginLeft: 4, fontSize: 10, padding: "1px 5px", borderRadius: 3, background: "rgba(239,68,68,0.15)", color: "var(--color-destructive-text)", fontWeight: 700 }}>U13</span>}
                        </div>
                        <div style={{ color: "var(--color-text-muted)", padding: "4px 8px", borderBottom: "1px solid var(--color-card)", fontVariantNumeric: "tabular-nums" }}>
                          {m.age != null ? `${m.age}y` : "—"}
                        </div>
                        <div style={{ color: "var(--color-text-muted)", padding: "4px 8px", borderBottom: "1px solid var(--color-card)" }}>
                          {m.gender || "—"}
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
          {msg && <div style={{ color: "var(--color-warn)", fontSize: 12, marginTop: 10 }}>{msg}</div>}
        </div>
      );
    }
