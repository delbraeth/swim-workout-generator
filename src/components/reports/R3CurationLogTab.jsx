// src/components/reports/R3CurationLogTab.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// Reports sub-tab (consumed by ReportsView). React is a runtime global (no import needed).
// setIdToName lives in the engine prelude of app.jsx (UI-only; engine doesn't use it).
// Imported here from the entry — runtime-safe (it's called at render, not module-eval).
import { setIdToName } from "../../lib/format.js";

    export function R3CurationLogTab({ data }) {
      const sub = { marginBottom: 18 };
      const subTitle = { fontSize: 13, color: "var(--color-text-dim)", fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" };
      const list = { padding: 10, background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12 };
      const empty = { color: "var(--color-text-muted)", fontStyle: "italic" };
      const fmtTime = (iso) => iso ? new Date(iso).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" }) : "—";

      const Section = ({ favs, dis, fmtItem }) => (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={list}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-primary-text)", marginBottom: 6 }}>★ Favorites ({favs.length})</div>
            {favs.length === 0 ? <div style={empty}>none in range</div> : (
              <div>{favs.map((f, i) => <div key={i} style={{ padding: "3px 0", borderBottom: "1px solid var(--color-bg)" }}>{fmtItem(f)}</div>)}</div>
            )}
          </div>
          <div style={list}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-warn)", marginBottom: 6 }}>👎 Disfavorites ({dis.length})</div>
            {dis.length === 0 ? <div style={empty}>none in range</div> : (
              <div>{dis.map((d, i) => <div key={i} style={{ padding: "3px 0", borderBottom: "1px solid var(--color-bg)" }}>{fmtItem(d)}</div>)}</div>
            )}
          </div>
        </div>
      );

      return (
        <div>
          <div style={sub}>
            <div style={subTitle}>Bank labels</div>
            <Section
              favs={data.bankLabels?.favorites || []}
              dis={data.bankLabels?.disfavorites || []}
              fmtItem={(x) => <><strong>{x.label}</strong> <span style={{ color: "var(--color-text-muted)", marginLeft: 6 }}>{fmtTime(x.at)}</span></>}
            />
          </div>
          <div style={sub}>
            <div style={subTitle}>Sets</div>
            <Section
              favs={data.sets?.favorites || []}
              dis={data.sets?.disfavorites || []}
              fmtItem={(x) => {
                const name = setIdToName(x.set_id);
                const resolved = name !== x.set_id;
                return <>
                  {resolved
                    ? <span>{name} <code style={{ fontFamily: "monospace", fontSize: 10, color: "var(--color-text-muted)" }}>({x.set_id})</code></span>
                    : <code style={{ fontFamily: "monospace" }} title="Set no longer in current bank">{x.set_id}</code>}
                  <span style={{ color: "var(--color-text-muted)", marginLeft: 6 }}>{fmtTime(x.at)}</span>
                </>;
              }}
            />
          </div>
          <div style={sub}>
            <div style={subTitle}>Engine tuples <span style={{ fontSize: 10, color: "var(--color-text-muted)", textTransform: "none", fontWeight: 400, marginLeft: 4 }}>(current state — no per-item timestamps)</span></div>
            <Section
              favs={data.engine?.favorites || []}
              dis={data.engine?.disfavorites || []}
              fmtItem={(x) => <><code style={{ fontFamily: "monospace" }}>{x.template_id}</code> · <em>{x.stroke}</em></>}
            />
          </div>
          {/* Phase 3 PSC slice 2 — fourth subsection: per-swimmer constraint events */}
          <div style={sub}>
            <div style={subTitle}>Per-swimmer constraints <span style={{ fontSize: 10, color: "var(--color-text-muted)", textTransform: "none", fontWeight: 400, marginLeft: 4 }}>(set / remove events)</span></div>
            {(!data.psc || data.psc.length === 0) ? (
              <div style={list}><span style={empty}>No constraint events in range.</span></div>
            ) : (
              <div style={list}>
                {data.psc.map((e, i) => {
                  const isSet = e.event_type === "psc.set";
                  const target = e.swimmer_sub
                    ? <code style={{ fontFamily: "monospace", fontSize: 10 }}>{(e.swimmer_sub || "").slice(0, 12)}…</code>
                    : <code style={{ fontFamily: "monospace", fontSize: 10 }}>{e.managed_id}</code>;
                  const valueBit = e.value_num != null ? ` = ${e.value_num}` :
                                   e.value_str != null ? ` = ${e.value_str}` : "";
                  const expiryBit = e.expires_at ? ` · expires ${new Date(e.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "";
                  return (
                    <div key={i} style={{ padding: "3px 0", borderBottom: i < data.psc.length - 1 ? "1px solid var(--color-bg)" : "none" }}>
                      <span style={{ color: isSet ? "var(--color-positive)" : "var(--color-warn)", fontWeight: 700, marginRight: 6 }}>
                        {isSet ? "+ SET" : "− REMOVE"}
                      </span>
                      <code style={{ fontFamily: "monospace", fontSize: 11 }}>{e.constraint_type}</code>
                      {valueBit && <span style={{ color: "var(--color-text-muted)" }}>{valueBit}</span>}
                      <span style={{ marginLeft: 8, color: "var(--color-text-muted)" }}>→ {target}</span>
                      {expiryBit && <span style={{ color: "var(--color-text-muted)" }}>{expiryBit}</span>}
                      <span style={{ color: "var(--color-text-muted)", marginLeft: 6 }}>{fmtTime(e.at)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {/* Team Curation v1 slice 6 — fifth subsection: team-level audit events.
              Spec §3.7: every team.* event on teams the viewing coach is on, so
              co-owners + admins see what each other changed. */}
          <div style={sub}>
            <div style={subTitle}>Team curation <span style={{ fontSize: 10, color: "var(--color-text-muted)", textTransform: "none", fontWeight: 400, marginLeft: 4 }}>(team favorites / disfavorites / defaults)</span></div>
            {(!data.team || data.team.length === 0) ? (
              <div style={list}><span style={empty}>No team curation events in range.</span></div>
            ) : (
              <div style={list}>
                {data.team.map((e, i) => {
                  const isAdd    = e.event_type.endsWith(".add");
                  const isRemove = e.event_type.endsWith(".remove");
                  const isFav    = e.event_type.startsWith("team.fav");
                  const isApply  = e.event_type === "team.default.apply_to_roster";
                  const actionLabel = isAdd ? "+ ADD" : isRemove ? "− REMOVE" : isApply ? "↳ PUSH" : "Δ UPDATE";
                  const actionColor = isAdd ? "var(--color-positive)" : isRemove ? "var(--color-warn)" : isApply ? "var(--color-warn)" : "var(--color-primary)";
                  // Kind tag: fav / disfav / default
                  const kindTag = e.event_type.startsWith("team.fav") ? "fav"
                                : e.event_type.startsWith("team.disfav") ? "disfav"
                                : "default";
                  const kindColor = kindTag === "fav" ? "var(--color-positive)" : kindTag === "disfav" ? "var(--color-warn)" : "var(--color-primary)";
                  return (
                    <div key={i} style={{ padding: "3px 0", borderBottom: i < data.team.length - 1 ? "1px solid var(--color-bg)" : "none" }}>
                      <span style={{ color: actionColor, fontWeight: 700, marginRight: 6 }}>{actionLabel}</span>
                      <span style={{ background: "rgba(59,130,246,0.15)", color: kindColor, padding: "1px 5px", borderRadius: 3, fontSize: 10, fontWeight: 700, marginRight: 6 }}>{kindTag}</span>
                      {e.label && <span style={{ color: "var(--color-text)" }}>"{e.label}"</span>}
                      {e.field && <code style={{ fontFamily: "monospace", fontSize: 11, color: "var(--color-text)" }}>{e.field}</code>}
                      {e.value != null && <span style={{ color: "var(--color-text-muted)" }}> = {typeof e.value === "object" ? JSON.stringify(e.value) : String(e.value)}</span>}
                      {e.count != null && <span style={{ color: "var(--color-text-muted)" }}> · {e.count} swimmer{e.count === 1 ? "" : "s"}</span>}
                      <span style={{ marginLeft: 8, color: "var(--color-text-muted)" }}>team <code style={{ fontFamily: "monospace", fontSize: 10 }}>{e.team_id}</code></span>
                      {e.actor_sub && <span style={{ marginLeft: 8, color: "var(--color-text-muted)" }}>by <code style={{ fontFamily: "monospace", fontSize: 10 }}>{e.actor_sub.slice(-8)}</code>{e.role ? ` (${e.role})` : ""}</span>}
                      <span style={{ color: "var(--color-text-muted)", marginLeft: 6 }}>{fmtTime(e.at)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    }
