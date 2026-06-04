// src/components/admin/AdminAudit.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components are imported below (freevars-driven).

    const { useState, useCallback, useEffect } = React;

    // Audit-log event groups (admin toggles which to show). Saved per-session in state.
    const AUDIT_GROUP_CHIPS = [
      { id: "auth",          label: "Auth",          defaultOn: true  },
      { id: "admin",         label: "Admin",         defaultOn: true  },
      { id: "impersonation", label: "Impersonation", defaultOn: false },
      { id: "coach",         label: "Coach",         defaultOn: true  },
      { id: "rate_limit",    label: "Rate limit",    defaultOn: true  },
      { id: "csrf",          label: "CSRF",          defaultOn: true  },
      { id: "other",         label: "Other",         defaultOn: true  },
    ];

    export function AdminAudit() {
      const [events, setEvents] = React.useState(null);
      const [filterType, setFilterType] = React.useState("");
      const [filterUser, setFilterUser] = React.useState("");
      const [groupOn, setGroupOn] = React.useState(() => {
        const s = {};
        for (const g of AUDIT_GROUP_CHIPS) s[g.id] = g.defaultOn;
        return s;
      });

      const load = React.useCallback(async () => {
        const qs = new URLSearchParams();
        if (filterType) qs.set("event_type", filterType);
        if (filterUser) qs.set("user_sub",   filterUser);
        // Build event_type_groups from checked chips. If all are off AND no
        // exact event_type set, send an explicit empty list so the server
        // returns nothing (matches the UI's "I checked nothing" intent).
        const checkedGroups = AUDIT_GROUP_CHIPS.filter(g => groupOn[g.id]).map(g => g.id);
        if (!filterType) {
          if (checkedGroups.length === AUDIT_GROUP_CHIPS.length) {
            // All checked = no filter (faster query path).
          } else {
            qs.set("event_type_groups", checkedGroups.join(","));
          }
        }
        qs.set("limit", "500");
        const r = await fetch(`/api/admin/audit-events?${qs}`, { cache: "no-store" });
        setEvents(r.ok ? await r.json() : []);
      }, [filterType, filterUser, groupOn]);
      React.useEffect(() => { load(); }, [load]);

      if (events === null) return <div style={{ color: "var(--color-text-dim)" }}>Loading…</div>;

      const toggleGroup = (id) => setGroupOn(prev => ({ ...prev, [id]: !prev[id] }));
      const allOn  = () => setGroupOn(Object.fromEntries(AUDIT_GROUP_CHIPS.map(g => [g.id, true])));
      const allOff = () => setGroupOn(Object.fromEntries(AUDIT_GROUP_CHIPS.map(g => [g.id, false])));

      return (
        <div>
          {/* Chip-row filter: each group is a checkbox. Default: all on
              except Impersonation (high-volume per-request audit chatter). */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8, alignItems: "center" }}>
            {AUDIT_GROUP_CHIPS.map(g => {
              const on = !!groupOn[g.id];
              return (
                <button key={g.id} onClick={() => toggleGroup(g.id)}
                  title={on ? `Click to hide ${g.label} events` : `Click to show ${g.label} events`}
                  style={{
                    fontSize: 11, padding: "5px 10px", borderRadius: 999,
                    border: `1px solid ${on ? "var(--color-primary)" : "var(--color-border)"}`,
                    background: on ? "#1e3a5f" : "var(--color-bg)",
                    color: on ? "var(--color-primary)" : "var(--color-text-dim)",
                    fontWeight: 700, cursor: "pointer",
                  }}>
                  {on ? "✓ " : ""}{g.label}
                </button>
              );
            })}
            <button onClick={allOn} style={{ fontSize: 10, padding: "4px 8px", background: "transparent", border: "1px solid var(--color-border)", borderRadius: 4, color: "var(--color-text-dim)", cursor: "pointer", marginLeft: 4 }}>all</button>
            <button onClick={allOff} style={{ fontSize: 10, padding: "4px 8px", background: "transparent", border: "1px solid var(--color-border)", borderRadius: 4, color: "var(--color-text-dim)", cursor: "pointer" }}>none</button>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
            <input value={filterType} onChange={e => setFilterType(e.target.value)} placeholder="exact event_type (overrides chips, e.g. auth.login.success)"
              style={{ flex: 1, background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 4, color: "var(--color-text)", padding: "6px 8px", fontSize: 12 }} />
            <input value={filterUser} onChange={e => setFilterUser(e.target.value)} placeholder="user_sub (full Apple sub)"
              style={{ flex: 2, background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 4, color: "var(--color-text)", padding: "6px 8px", fontSize: 12 }} />
            <button onClick={() => { setFilterType(""); setFilterUser(""); allOn(); }} style={{ fontSize: 12, padding: "6px 10px", background: "var(--color-border)", border: "none", borderRadius: 4, color: "#cbd5e1", cursor: "pointer" }}>
              Reset
            </button>
          </div>
          <div style={{ fontSize: 11, color: "var(--color-text-dim)", marginBottom: 8 }}>{events.length} events (most recent first)</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, color: "#cbd5e1" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-text-dim)", textAlign: "left" }}>
                <th style={{ padding: "6px 4px" }}>Time</th>
                <th style={{ padding: "6px 4px" }}>Event</th>
                <th style={{ padding: "6px 4px" }}>User</th>
                <th style={{ padding: "6px 4px" }}>IP</th>
                <th style={{ padding: "6px 4px" }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {events.map(e => (
                <tr key={e.id} style={{ borderBottom: "1px solid var(--color-card)" }}>
                  <td style={{ padding: "6px 4px", color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>{new Date(e.created_at).toLocaleString("en-US", { dateStyle: "short", timeStyle: "medium" })}</td>
                  <td style={{ padding: "6px 4px", fontFamily: "monospace" }}>{e.event_type}</td>
                  <td style={{ padding: "6px 4px", color: "var(--color-text-muted)" }} title={e.user_sub || ""}>{e.user_sub ? e.user_sub.slice(0, 12) + "…" : "—"}</td>
                  <td style={{ padding: "6px 4px", color: "var(--color-text-muted)" }}>{e.ip || "—"}</td>
                  <td style={{ padding: "6px 4px", color: "var(--color-text-muted)", fontFamily: "monospace", fontSize: 10 }}>{e.details ? JSON.stringify(e.details).slice(0, 80) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
