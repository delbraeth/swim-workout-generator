// src/components/profile/CompliancePanel.jsx — Phase 5 #3 (MAAP/SafeSport), Slice A.
// Record/display a coach's compliance credentials: USA-Swimming Member ID,
// SafeSport certification (+ expiry), background-check ID. Display + expiry
// warning ONLY — nothing is gated on expiry in v1 (decision 2026-06-06).
// Reads/writes /api/me/credentials. React is a runtime global.
import { csrfHeaders } from "../../lib/api.js";

const FIELDS = [
  { system: "safesport_cert",   label: "SafeSport certification", hasExpiry: true,  ph: "cert ID / confirmation #" },
  { system: "background_check", label: "Background check",        hasExpiry: true,  ph: "reference #" },
  { system: "usa_swimming",     label: "USA Swimming Member ID",  hasExpiry: false, ph: "member ID" },
];

function expiryBadge(ymd) {
  if (!ymd) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const exp = new Date(ymd + "T00:00:00");
  const days = Math.round((exp - today) / 86400000);
  if (days < 0)  return { text: `expired ${ymd}`,        color: "var(--color-destructive-text)" };
  if (days <= 30) return { text: `expires ${ymd} (${days}d)`, color: "var(--color-warn)" };
  return { text: `valid to ${ymd}`, color: "var(--color-positive)" };
}

export function CompliancePanel({ endpoint = "/api/me/credentials", heading = "🛡 Compliance credentials" }) {
  const [rows, setRows] = React.useState(null);
  const [drafts, setDrafts] = React.useState({});   // `${system}_id` / `${system}_exp` → string
  const [msg, setMsg] = React.useState(null);

  const load = React.useCallback(async () => {
    try { const r = await fetch(endpoint, { cache: "no-store" }); setRows(r.ok ? await r.json() : []); }
    catch (_) { setRows([]); }
  }, [endpoint]);
  React.useEffect(() => { load(); }, [load]);

  if (rows === null) return null;
  const bySystem = {};
  for (const r of rows) bySystem[r.system] = r;

  const idVal = (sys) => { const k = `${sys}_id`; return k in drafts ? drafts[k] : (bySystem[sys]?.external_id || ""); };
  const expVal = (sys) => { const k = `${sys}_exp`; return k in drafts ? drafts[k] : (bySystem[sys]?.expires_at || ""); };

  const save = async (sys) => {
    setMsg(null);
    const id = (idVal(sys) || "").trim();
    const exp = (expVal(sys) || "").trim();
    try {
      if (!id) {
        if (bySystem[sys]) {
          const res = await fetch(`${endpoint}/${sys}`, { method: "DELETE", headers: csrfHeaders() });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        }
      } else {
        const res = await fetch(endpoint, {
          method: "PUT", headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ system: sys, external_id: id, expires_at: exp || null }),
        });
        if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `HTTP ${res.status}`); }
      }
      setDrafts(d => { const n = { ...d }; delete n[`${sys}_id`]; delete n[`${sys}_exp`]; return n; });
      await load();
    } catch (e) { setMsg(`Save failed: ${e.message}`); }
  };

  const inp = { padding: "5px 8px", fontSize: 13, background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 5 };

  return (
    <div style={{ marginTop: 16, padding: 14, borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--color-card)" }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{heading}</div>
      <p style={{ fontSize: 12, color: "var(--color-text-dim)", marginTop: 0, marginBottom: 10 }}>
        For coaches of minors (MAAP / SafeSport). Stored privately; the app warns when a cert is expiring. Optional.
      </p>
      <div style={{ display: "grid", gap: 10 }}>
        {FIELDS.map(f => {
          const badge = f.hasExpiry ? expiryBadge(expVal(f.system)) : null;
          return (
            <div key={f.system}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 3 }}>{f.label}</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <input value={idVal(f.system)} placeholder={f.ph} aria-label={f.label}
                  onChange={e => setDrafts(d => ({ ...d, [`${f.system}_id`]: e.target.value }))}
                  onBlur={() => { if ((`${f.system}_id` in drafts) || (`${f.system}_exp` in drafts)) save(f.system); }}
                  style={{ ...inp, flex: 1, minWidth: 140 }} />
                {f.hasExpiry && (
                  <input type="date" value={expVal(f.system)} aria-label={`${f.label} expiry`}
                    onChange={e => setDrafts(d => ({ ...d, [`${f.system}_exp`]: e.target.value }))}
                    onBlur={() => { if ((`${f.system}_id` in drafts) || (`${f.system}_exp` in drafts)) save(f.system); }}
                    style={{ ...inp, width: 150 }} />
                )}
              </div>
              {badge && <div style={{ fontSize: 11, marginTop: 3, color: badge.color, fontWeight: 600 }}>⚠ {badge.text}</div>}
            </div>
          );
        })}
      </div>
      {msg && <div style={{ color: "var(--color-warn)", fontSize: 12, marginTop: 8 }}>{msg}</div>}
    </div>
  );
}
