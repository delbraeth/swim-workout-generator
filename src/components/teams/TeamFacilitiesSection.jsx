// src/components/teams/TeamFacilitiesSection.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { API_BASE, csrfHeaders } from "../../lib/shared.js";

    const { useState, useCallback, useEffect } = React;

    const FACILITY_COURSES = [
      { v: "",    label: "—" },
      { v: "25y", label: "SCY (25 yd)" },
      { v: "25m", label: "SCM (25 m)" },
      { v: "50m", label: "LCM (50 m)" },
    ];
    function courseLabel(v) { const o = FACILITY_COURSES.find(x => x.v === (v || "")); return o ? o.label : v; }

    export function TeamFacilitiesSection({ teamId, canWrite }) {
      const [list, setList] = React.useState(null);
      const [busy, setBusy] = React.useState(false);
      const [msg, setMsg]   = React.useState(null);
      const [adding, setAdding] = React.useState(false);
      const emptyF = () => ({ name: "", course: "", lanes: "", is_primary: false, line1: "", city: "", region: "", postal_code: "" });
      const [form, setForm] = React.useState(emptyF());
      const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));
      const load = React.useCallback(async () => {
        try {
          const res = await fetch(`${API_BASE}/teams/${teamId}/facilities`, { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setList(await res.json());
        } catch (e) { setMsg(`Load failed: ${e.message}`); setList([]); }
      }, [teamId]);
      React.useEffect(() => { load(); }, [load]);
      const body = (f) => ({
        name: f.name.trim(), course: f.course || null, lanes: f.lanes === "" ? null : Number(f.lanes), is_primary: !!f.is_primary,
        address: (f.line1 || f.city || f.region || f.postal_code) ? { line1: f.line1 || null, city: f.city || null, region: f.region || null, postal_code: f.postal_code || null } : null,
      });
      const add = async () => {
        if (!form.name.trim()) { setMsg("Facility name required."); return; }
        setBusy(true); setMsg(null);
        try {
          const res = await fetch(`${API_BASE}/teams/${teamId}/facilities`, { method: "POST", headers: { "Content-Type": "application/json", ...csrfHeaders() }, body: JSON.stringify(body(form)) });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
          setForm(emptyF()); setAdding(false); await load();
        } catch (e) { setMsg(`Add failed: ${e.message}`); } finally { setBusy(false); }
      };
      const makePrimary = async (id) => {
        setBusy(true); setMsg(null);
        try {
          const res = await fetch(`${API_BASE}/teams/${teamId}/facilities/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...csrfHeaders() }, body: JSON.stringify({ is_primary: true }) });
          if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `HTTP ${res.status}`); }
          await load();
        } catch (e) { setMsg(`Update failed: ${e.message}`); } finally { setBusy(false); }
      };
      const archive = async (id, name) => {
        if (!window.confirm(`Remove the facility "${name}"?`)) return;
        setBusy(true); setMsg(null);
        try {
          const res = await fetch(`${API_BASE}/teams/${teamId}/facilities/${id}`, { method: "DELETE", headers: { ...csrfHeaders() } });
          if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `HTTP ${res.status}`); }
          await load();
        } catch (e) { setMsg(`Remove failed: ${e.message}`); } finally { setBusy(false); }
      };
      const inputStyle = { padding: "5px 9px", fontSize: 13, background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 5 };
      return (
        <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 14, marginTop: 6 }}>
          <div style={{ color: "var(--color-primary)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Practice facilities</div>
          {list === null ? (
            <div style={{ color: "var(--color-text-dim)", fontSize: 12 }}>Loading…</div>
          ) : list.length === 0 ? (
            <div style={{ color: "var(--color-text-dim)", fontSize: 12, marginBottom: 8 }}>No facilities yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
              {list.map(f => (
                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "8px 10px", background: "var(--color-bg)", borderRadius: 6 }}>
                  <span style={{ fontWeight: 700, color: "var(--color-text)", fontSize: 13 }}>{f.name}</span>
                  {f.is_primary && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-primary)", border: "1px solid var(--color-primary)", borderRadius: 4, padding: "1px 6px" }}>PRIMARY</span>}
                  {f.course && <span style={{ fontSize: 11, color: "var(--color-text-dim)" }}>{courseLabel(f.course)}</span>}
                  {f.lanes != null && <span style={{ fontSize: 11, color: "var(--color-text-dim)" }}>{f.lanes} lanes</span>}
                  {f.address && (f.address.city || f.address.line1) && <span style={{ fontSize: 11, color: "var(--color-text-dim)" }}>· {[f.address.line1, f.address.city, f.address.region].filter(Boolean).join(", ")}</span>}
                  {canWrite && (
                    <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                      {!f.is_primary && <button onClick={() => makePrimary(f.id)} disabled={busy} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer" }}>Make primary</button>}
                      <button onClick={() => archive(f.id, f.name)} disabled={busy} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer" }}>Remove</button>
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {canWrite && (adding ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px", background: "var(--color-bg)", borderRadius: 6 }}>
              <input value={form.name} onChange={e => upd("name", e.target.value)} placeholder="Facility name (e.g. Lincoln HS Natatorium)" maxLength={120} style={inputStyle} />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <select value={form.course} onChange={e => upd("course", e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                  {FACILITY_COURSES.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
                <input value={form.lanes} onChange={e => upd("lanes", e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="Lanes" inputMode="numeric" style={{ ...inputStyle, width: 80 }} />
                <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--color-text-dim)" }}>
                  <input type="checkbox" checked={form.is_primary} onChange={e => upd("is_primary", e.target.checked)} /> Primary
                </label>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <input value={form.line1} onChange={e => upd("line1", e.target.value)} placeholder="Address (optional)" maxLength={160} style={{ ...inputStyle, flex: 2, minWidth: 160 }} />
                <input value={form.city} onChange={e => upd("city", e.target.value)} placeholder="City" maxLength={80} style={{ ...inputStyle, flex: 1, minWidth: 90 }} />
                <input value={form.region} onChange={e => upd("region", e.target.value)} placeholder="State" maxLength={80} style={{ ...inputStyle, width: 70 }} />
                <input value={form.postal_code} onChange={e => upd("postal_code", e.target.value)} placeholder="ZIP" maxLength={20} style={{ ...inputStyle, width: 80 }} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={add} disabled={busy || !form.name.trim()} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: (busy || !form.name.trim()) ? "var(--color-border)" : "var(--color-primary)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: (busy || !form.name.trim()) ? "not-allowed" : "pointer" }}>{busy ? "Saving…" : "Add facility"}</button>
                <button onClick={() => { setAdding(false); setForm(emptyF()); setMsg(null); }} disabled={busy} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-dim)", fontSize: 12, cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-primary)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Add facility</button>
          ))}
          {msg && <div style={{ color: "var(--color-warn)", fontSize: 12, marginTop: 8 }}>{msg}</div>}
        </div>
      );
    }
