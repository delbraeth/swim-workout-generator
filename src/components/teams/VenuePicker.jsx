// src/components/teams/VenuePicker.jsx — Phase 5 #5 Slice B (universal venues).
// Coach control to attach a venue to a team event: search the shared catalog,
// or create a new venue. On create, the address is geocoded CLIENT-SIDE via
// MapKit JS (the browser-scoped token can't be used server-side) so lat/lng +
// timezone travel to POST /api/venues. indoor/outdoor decides whether weather
// is ever fetched for events here. React is a runtime global.
import { csrfHeaders } from "../../lib/api.js";
import { isMapKitConfigured, geocodeAddress } from "../../lib/mapkit.js";

const inputStyle = { width: "100%", padding: "5px 9px", fontSize: 13, background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 5 };
const labelStyle = { fontSize: 11, color: "var(--color-text-muted)", display: "block", marginBottom: 3 };

// value: { id, name, indoor_outdoor } | null   onChange(venueObjOrNull)
export function VenuePicker({ value, onChange }) {
  const [mode, setMode]   = React.useState("idle");      // idle | search | create
  const [q, setQ]         = React.useState("");
  const [results, setResults] = React.useState(null);    // null = not searched
  const [busy, setBusy]   = React.useState(false);
  const [err, setErr]     = React.useState(null);
  // create form
  const [cName, setCName] = React.useState("");
  const [cAddr, setCAddr] = React.useState("");
  const [cIO, setCIO]     = React.useState("indoor");
  // C4 — suggest-edit form (proposes corrections to the shared catalog).
  const [suggesting, setSuggesting] = React.useState(false);
  const [sName, setSName] = React.useState("");
  const [sIO, setSIO]     = React.useState("");
  const [sCourse, setSCourse] = React.useState("");
  const [sNote, setSNote] = React.useState("");
  const [sBusy, setSBusy] = React.useState(false);
  const [sMsg, setSMsg]   = React.useState(null);

  const mapkitOn = isMapKitConfigured();

  const openSuggest = () => {
    setSName(value?.name || ""); setSIO(value?.indoor_outdoor || ""); setSCourse(""); setSNote(""); setSMsg(null);
    setSuggesting(true);
  };
  const submitSuggest = async () => {
    const changes = {};
    if (sName.trim() && sName.trim() !== (value?.name || "")) changes.name = sName.trim();
    if (sIO && sIO !== value?.indoor_outdoor) changes.indoor_outdoor = sIO;
    if (sCourse) changes.course = sCourse;
    if (Object.keys(changes).length === 0) { setSMsg("No changes to suggest."); return; }
    setSBusy(true); setSMsg(null);
    try {
      const r = await fetch(`/api/venues/${value.id}/propose-edit`, {
        method: "POST", headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ changes, note: sNote.trim() || null }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setSMsg("✓ Sent for review. An admin will apply it.");
      setSuggesting(false);
    } catch (e) { setSMsg(`Couldn't send: ${e.message}`); }
    setSBusy(false);
  };

  const runSearch = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/venues?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" });
      setResults(r.ok ? await r.json() : []);
    } catch (_) { setResults([]); }
    setBusy(false);
  };

  const pick = (v) => { onChange({ id: v.id, name: v.name, indoor_outdoor: v.indoor_outdoor }); setMode("idle"); setResults(null); setQ(""); };

  const createVenue = async () => {
    if (!cName.trim()) { setErr("Venue name required"); return; }
    setBusy(true); setErr(null);
    let geo = null;
    if (cAddr.trim() && mapkitOn) {
      try { geo = await geocodeAddress(cAddr.trim()); }
      catch (_) { /* geocode failed → create without coords (no weather, still valid) */ }
    }
    try {
      const body = {
        name: cName.trim(),
        indoor_outdoor: cIO,
        address: cAddr.trim() ? { line1: cAddr.trim(), postal_code: geo?.postalCode || null } : null,
        latitude: geo?.latitude ?? null,
        longitude: geo?.longitude ?? null,
        timezone: geo?.timezone || null,
      };
      const r = await fetch("/api/venues", { method: "POST", headers: { "Content-Type": "application/json", ...csrfHeaders() }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      pick(j.venue || { id: j.id, name: cName.trim(), indoor_outdoor: cIO });
      setCName(""); setCAddr(""); setCIO("indoor");
    } catch (e) { setErr(`Couldn't save venue: ${e.message}`); }
    setBusy(false);
  };

  return (
    <div>
      <label style={labelStyle}>Venue</label>
      {value ? (
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 9px", background: "var(--color-card)", border: "1px solid var(--color-border-strong)", borderRadius: 5 }}>
            <span style={{ fontSize: 13, color: "var(--color-text)" }}>
              {value.indoor_outdoor === "outdoor" ? "🌤 " : "🏟 "}{value.name}
              {value.indoor_outdoor === "outdoor" && <span style={{ marginLeft: 6, fontSize: 10, color: "var(--color-text-dim)" }}>outdoor</span>}
            </span>
            <button type="button" onClick={() => onChange(null)} style={{ marginLeft: "auto", padding: "2px 8px", fontSize: 11, background: "transparent", color: "var(--color-text-muted)", border: "1px solid var(--color-border-strong)", borderRadius: 4, cursor: "pointer" }}>Clear</button>
          </div>
          {/* C4 — suggest a correction to this shared venue (admin-moderated). */}
          {!suggesting ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button type="button" onClick={openSuggest} style={{ background: "none", border: "none", color: "var(--color-text-dim)", cursor: "pointer", fontSize: 11, padding: 0, textDecoration: "underline" }}>Suggest a correction</button>
              {sMsg && <span style={{ fontSize: 11, color: sMsg.startsWith("✓") ? "var(--color-positive)" : "var(--color-warn)" }}>{sMsg}</span>}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 6, padding: 8, background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6 }}>
              <input value={sName} onChange={e => setSName(e.target.value)} placeholder="Corrected name" aria-label="Corrected venue name" style={inputStyle} />
              <div style={{ display: "flex", gap: 6 }}>
                <select value={sIO} onChange={e => setSIO(e.target.value)} aria-label="Indoor or outdoor" style={{ ...inputStyle, flex: 1 }}>
                  <option value="">Indoor/outdoor (no change)</option>
                  <option value="indoor">🏟 Indoor</option>
                  <option value="outdoor">🌤 Outdoor</option>
                  <option value="unknown">Unknown</option>
                </select>
                <select value={sCourse} onChange={e => setSCourse(e.target.value)} aria-label="Course" style={{ ...inputStyle, flex: 1 }}>
                  <option value="">Course (no change)</option>
                  <option value="SCY">SCY</option>
                  <option value="SCM">SCM</option>
                  <option value="LCM">LCM</option>
                </select>
              </div>
              <input value={sNote} onChange={e => setSNote(e.target.value)} placeholder="Note for the reviewer (optional)" aria-label="Note for the reviewer" style={inputStyle} />
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" onClick={submitSuggest} disabled={sBusy} style={{ padding: "5px 11px", fontSize: 12, background: "var(--color-primary)", color: "var(--color-bg)", border: "none", borderRadius: 5, cursor: sBusy ? "wait" : "pointer", fontWeight: 700 }}>{sBusy ? "…" : "Send for review"}</button>
                <button type="button" onClick={() => { setSuggesting(false); setSMsg(null); }} style={{ padding: "5px 9px", fontSize: 12, background: "var(--color-border)", color: "#cbd5e1", border: "none", borderRadius: 5, cursor: "pointer" }}>Cancel</button>
              </div>
              {sMsg && <div style={{ fontSize: 11, color: sMsg.startsWith("✓") ? "var(--color-positive)" : "var(--color-warn)" }}>{sMsg}</div>}
            </div>
          )}
        </div>
      ) : mode === "idle" ? (
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={() => setMode("search")} style={{ flex: 1, padding: "5px 9px", fontSize: 12, background: "var(--color-card)", color: "var(--color-text-muted)", border: "1px dashed var(--color-border-strong)", borderRadius: 5, cursor: "pointer" }}>🔍 Pick venue</button>
          <button type="button" onClick={() => setMode("create")} style={{ flex: 1, padding: "5px 9px", fontSize: 12, background: "var(--color-card)", color: "var(--color-text-muted)", border: "1px dashed var(--color-border-strong)", borderRadius: 5, cursor: "pointer" }}>+ New venue</button>
        </div>
      ) : mode === "search" ? (
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search venues…" aria-label="Search venues" onKeyDown={e => { if (e.key === "Enter") runSearch(); }} style={inputStyle} />
            <button type="button" onClick={runSearch} disabled={busy} style={{ padding: "5px 11px", fontSize: 12, background: "var(--color-primary)", color: "var(--color-bg)", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700 }}>Go</button>
            <button type="button" onClick={() => { setMode("idle"); setResults(null); }} style={{ padding: "5px 9px", fontSize: 12, background: "var(--color-border)", color: "#cbd5e1", border: "none", borderRadius: 5, cursor: "pointer" }}>×</button>
          </div>
          {results !== null && (results.length === 0
            ? <div style={{ fontSize: 12, color: "var(--color-text-dim)", fontStyle: "italic" }}>No matches. <button type="button" onClick={() => setMode("create")} style={{ background: "none", border: "none", color: "var(--color-primary-text)", cursor: "pointer", fontSize: 12, padding: 0 }}>Create one →</button></div>
            : <div style={{ display: "grid", gap: 3, maxHeight: 160, overflowY: "auto" }}>
                {results.map(v => (
                  <button key={v.id} type="button" onClick={() => pick(v)} style={{ textAlign: "left", padding: "5px 9px", fontSize: 12, background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border)", borderRadius: 5, cursor: "pointer" }}>
                    {v.indoor_outdoor === "outdoor" ? "🌤 " : "🏟 "}{v.name}
                    {v.address?.city && <span style={{ color: "var(--color-text-dim)" }}> · {v.address.city}{v.address.region ? `, ${v.address.region}` : ""}</span>}
                  </button>
                ))}
              </div>)}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 6, padding: 8, background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6 }}>
          <input value={cName} onChange={e => setCName(e.target.value)} placeholder="Venue name (e.g. Mason Rec Center)" aria-label="Venue name" style={inputStyle} />
          <input value={cAddr} onChange={e => setCAddr(e.target.value)} placeholder={mapkitOn ? "Address (geocoded for weather)" : "Address"} aria-label="Address" style={inputStyle} />
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <select value={cIO} onChange={e => setCIO(e.target.value)} aria-label="Indoor or outdoor" style={{ ...inputStyle, width: "auto", flex: 1 }}>
              <option value="indoor">🏟 Indoor pool</option>
              <option value="outdoor">🌤 Outdoor pool (weather)</option>
              <option value="unknown">Unknown</option>
            </select>
            <button type="button" onClick={createVenue} disabled={busy} style={{ padding: "5px 11px", fontSize: 12, background: "var(--color-positive)", color: "var(--color-bg)", border: "none", borderRadius: 5, cursor: busy ? "wait" : "pointer", fontWeight: 700 }}>{busy ? "…" : "Save"}</button>
            <button type="button" onClick={() => { setMode("idle"); setErr(null); }} style={{ padding: "5px 9px", fontSize: 12, background: "var(--color-border)", color: "#cbd5e1", border: "none", borderRadius: 5, cursor: "pointer" }}>×</button>
          </div>
          {cIO === "outdoor" && !mapkitOn && <div style={{ fontSize: 11, color: "var(--color-warn)" }}>Maps not configured — venue saves without coordinates, so no weather.</div>}
        </div>
      )}
      {err && <div style={{ fontSize: 11, color: "var(--color-warn)", marginTop: 4 }}>{err}</div>}
    </div>
  );
}
