// src/components/people/AddressManager.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { API_BASE, csrfHeaders } from "../../lib/shared.js";

    const { useState, useCallback, useEffect, useRef } = React;

    export function AddressManager({ swimmerRef, showConsent, seedAddresses = null, seedCanWrite = null }) {
      // Seeded from the composite detail fetch (owner-coach context, where
      // access is always granted) — skip the initial GET; mutations still
      // refetch. noaccess only arises from a real 403 on the fallback fetch.
      const [data, setData] = React.useState(Array.isArray(seedAddresses)
        ? { addresses: seedAddresses, can_write: !!seedCanWrite, coach_visible: false }
        : null);
      const [adding, setAdding] = React.useState(false);
      const emptyF = () => ({ line1: "", city: "", region: "", postal_code: "" });
      const [form, setForm] = React.useState(emptyF());
      const [busy, setBusy] = React.useState(false);
      const [msg, setMsg] = React.useState(null);
      const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));
      const load = React.useCallback(async () => {
        try {
          const res = await fetch(`${API_BASE}/swimmers/${encodeURIComponent(swimmerRef)}/addresses`, { cache: "no-store" });
          if (res.status === 403) { setData({ addresses: [], can_write: false, coach_visible: false, noaccess: true }); return; }
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setData(await res.json());
        } catch (e) { setMsg(`Load failed: ${e.message}`); setData({ addresses: [], can_write: false, coach_visible: false }); }
      }, [swimmerRef]);
      const skipInitial = React.useRef(Array.isArray(seedAddresses));
      React.useEffect(() => { if (skipInitial.current) { skipInitial.current = false; return; } load(); }, [load]);
      const reqJson = async (url, method, payload) => {
        const res = await fetch(`${API_BASE}${url}`, { method, headers: { "Content-Type": "application/json", ...csrfHeaders() }, body: payload ? JSON.stringify(payload) : undefined });
        if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `HTTP ${res.status}`); }
      };
      const add = async () => {
        if (!form.line1.trim() && !form.city.trim()) { setMsg("Enter at least a street or city."); return; }
        setBusy(true); setMsg(null);
        try { await reqJson(`/swimmers/${encodeURIComponent(swimmerRef)}/addresses`, "POST", { kind: "home", is_primary: true, address: { line1: form.line1 || null, city: form.city || null, region: form.region || null, postal_code: form.postal_code || null } }); setForm(emptyF()); setAdding(false); await load(); }
        catch (e) { setMsg(`Save failed: ${e.message}`); } finally { setBusy(false); }
      };
      const remove = async (id) => {
        if (!window.confirm("Remove this address?")) return;
        setBusy(true); setMsg(null);
        try { await reqJson(`/swimmers/${encodeURIComponent(swimmerRef)}/addresses/${id}`, "DELETE"); await load(); }
        catch (e) { setMsg(`Remove failed: ${e.message}`); } finally { setBusy(false); }
      };
      const setConsent = async (next) => {
        setBusy(true); setMsg(null);
        try { await reqJson(`/swimmers/${encodeURIComponent(swimmerRef)}/address-consent`, "PATCH", { coach_visible: next }); await load(); }
        catch (e) { setMsg(`Update failed: ${e.message}`); } finally { setBusy(false); }
      };
      const inputStyle = { padding: "5px 9px", fontSize: 13, background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 5 };
      if (data === null) return <div style={{ color: "var(--color-text-dim)", fontSize: 12 }}>Loading address…</div>;
      if (data.noaccess) return <div style={{ color: "var(--color-text-dim)", fontSize: 12, fontStyle: "italic" }}>🏠 Home address not shared.</div>;
      const addr = (a) => [a.line1, a.city, a.region, a.postal_code].filter(Boolean).join(", ");
      return (
        <div>
          <div style={{ color: "var(--color-text-muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>🏠 Home address</div>
          {data.addresses.length === 0 ? (
            <div style={{ color: "var(--color-text-dim)", fontSize: 12, marginBottom: 6 }}>No address on file.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
              {data.addresses.map(a => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", background: "var(--color-bg)", borderRadius: 6, fontSize: 13, color: "var(--color-text)" }}>
                  <span style={{ flex: 1 }}>{addr(a) || "—"}{a.is_primary && data.addresses.length > 1 ? <span style={{ marginLeft: 6, fontSize: 10, color: "var(--color-primary)" }}>primary</span> : null}</span>
                  {data.can_write && <button onClick={() => remove(a.id)} disabled={busy} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer" }}>Remove</button>}
                </div>
              ))}
            </div>
          )}
          {data.can_write && (adding ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
              <input value={form.line1} onChange={e => upd("line1", e.target.value)} placeholder="Street address" maxLength={160} style={inputStyle} />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <input value={form.city} onChange={e => upd("city", e.target.value)} placeholder="City" maxLength={80} style={{ ...inputStyle, flex: 1, minWidth: 90 }} />
                <input value={form.region} onChange={e => upd("region", e.target.value)} placeholder="State" maxLength={80} style={{ ...inputStyle, width: 70 }} />
                <input value={form.postal_code} onChange={e => upd("postal_code", e.target.value)} placeholder="ZIP" maxLength={20} style={{ ...inputStyle, width: 80 }} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={add} disabled={busy} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "var(--color-primary)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{busy ? "Saving…" : "Save address"}</button>
                <button onClick={() => { setAdding(false); setForm(emptyF()); setMsg(null); }} disabled={busy} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-dim)", fontSize: 12, cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} style={{ padding: "5px 11px", borderRadius: 6, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-primary)", fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: 8 }}>+ {data.addresses.length ? "Add another" : "Add address"}</button>
          ))}
          {showConsent && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--color-text-dim)", marginTop: 4 }}>
              <input type="checkbox" checked={!!data.coach_visible} disabled={busy} onChange={e => setConsent(e.target.checked)} />
              Let this swimmer's coaches view the home address
            </label>
          )}
          {msg && <div style={{ color: "var(--color-warn)", fontSize: 12, marginTop: 6 }}>{msg}</div>}
        </div>
      );
    }
