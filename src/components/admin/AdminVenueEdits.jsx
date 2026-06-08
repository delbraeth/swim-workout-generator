// src/components/admin/AdminVenueEdits.jsx — C4 venue field-edit moderation.
// Lists coach-submitted venue correction proposals; admin approves (applies the
// changes to the shared catalog) or rejects. React is a runtime global.
import { csrfHeaders } from "../../lib/api.js";

const FIELD_LABEL = {
  name: "Name", indoor_outdoor: "Indoor/outdoor", course: "Course",
  timezone: "Timezone", latitude: "Latitude", longitude: "Longitude",
};
const fmtVal = (v) => (v === null || v === undefined || v === "") ? "—" : String(v);

export function AdminVenueEdits() {
  const [items, setItems] = React.useState(null);
  const [statusFilter, setStatusFilter] = React.useState("pending");
  const [busyId, setBusyId] = React.useState(null);
  const [msg, setMsg] = React.useState(null);

  const load = React.useCallback(async () => {
    setItems(null); setMsg(null);
    try {
      const r = await fetch(`/api/admin/venue-edits?status=${encodeURIComponent(statusFilter)}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) { setItems([]); setMsg(`Error: ${err.message || err}`); }
  }, [statusFilter]);
  React.useEffect(() => { load(); }, [load]);

  const review = async (id, action) => {
    setBusyId(id); setMsg(null);
    try {
      const r = await fetch(`/api/admin/venue-edits/${id}/review`, {
        method: "POST", headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ action }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      await load();
    } catch (e) { setMsg(`Couldn't ${action}: ${e.message}`); }
    setBusyId(null);
  };

  const fmtTime = (iso) => iso ? new Date(iso).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" }) : "—";
  const FILTERS = [{ id: "pending", label: "Pending" }, { id: "approved", label: "Approved" }, { id: "rejected", label: "Rejected" }];

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Status:</span>
        {FILTERS.map(s => {
          const active = statusFilter === s.id;
          return (
            <button key={s.id} onClick={() => setStatusFilter(s.id)} className="pill"
              style={{ border: `1px solid ${active ? "var(--color-primary)" : "var(--color-border)"}`,
                background: active ? "var(--color-primary)22" : "transparent",
                color: active ? "var(--color-primary)" : "var(--color-text-muted)", fontSize: 12, cursor: "pointer" }}>
              {s.label}
            </button>
          );
        })}
      </div>
      {msg && <div style={{ color: "#fca5a5", fontSize: 13, marginBottom: 10 }}>{msg}</div>}
      {items === null ? (
        <div style={{ color: "var(--color-text-dim)", fontSize: 13 }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ color: "var(--color-text-dim)", fontSize: 13, fontStyle: "italic", padding: 12 }}>No {statusFilter} proposals.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map(p => (
            <div key={p.id} className="card" style={{ borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{ fontSize: 14, color: "var(--color-text)", fontWeight: 700 }}>
                  {p.current?.name || p.venue_id}
                  <span style={{ marginLeft: 8, fontSize: 11, color: "var(--color-text-dim)" }}>{p.venue_id}</span>
                </span>
                <div style={{ fontSize: 10, color: "var(--color-text-dim)", textAlign: "right" }}>
                  <div>{fmtTime(p.created_at)}</div>
                  <div>by {p.proposer_initials || "—"}</div>
                </div>
              </div>
              <div style={{ display: "grid", gap: 4, marginBottom: 10 }}>
                {Object.keys(p.changes).map(k => {
                  const before = p.current ? p.current[k] : undefined;
                  const after = p.changes[k];
                  return (
                    <div key={k} style={{ fontSize: 12, display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                      <span style={{ minWidth: 110, color: "var(--color-text-muted)" }}>{FIELD_LABEL[k] || k}</span>
                      <span style={{ color: "var(--color-text-dim)", textDecoration: "line-through" }}>{fmtVal(before)}</span>
                      <span style={{ color: "var(--color-text-dim)" }}>→</span>
                      <span style={{ color: "var(--color-positive)", fontWeight: 700 }}>{fmtVal(after)}</span>
                    </div>
                  );
                })}
              </div>
              {p.note && <div style={{ fontSize: 12, color: "#cbd5e1", fontStyle: "italic", marginBottom: 10 }}>“{p.note}”</div>}
              {p.status === "pending" ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => review(p.id, "approve")} disabled={busyId === p.id}
                    style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: "var(--color-positive)", color: "var(--color-bg)", fontSize: 12, fontWeight: 700, cursor: busyId === p.id ? "wait" : "pointer" }}>
                    ✓ Approve & apply
                  </button>
                  <button onClick={() => review(p.id, "reject")} disabled={busyId === p.id}
                    style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid var(--color-border-strong)", background: "transparent", color: "var(--color-text-muted)", fontSize: 12, fontWeight: 700, cursor: busyId === p.id ? "wait" : "pointer" }}>
                    ✕ Reject
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: "var(--color-text-dim)" }}>
                  {p.status === "approved" ? "✓ Applied" : "✕ Rejected"}{p.reviewed_at ? ` · ${fmtTime(p.reviewed_at)}` : ""}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
