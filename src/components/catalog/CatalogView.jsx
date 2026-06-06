// src/components/catalog/CatalogView.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { CATALOG_ALL_EQUIP, CATALOG_SECTIONS, CATALOG_TYPES, EQUIPMENT_LIST, ZONE_ORDER } from "../../lib/constants.js";
import { catalogOptionUsesEquip, equipmentForSet, getCatalogList } from "../../lib/workout-helpers.js";
import { ZONES, inferBlockZone } from "../../lib/engine.js";
import { EquipmentBadge } from "../workout/EquipmentBadge.jsx";
import { FeedbackModal } from "../shell/FeedbackModal.jsx";

    const { useState, useCallback, useMemo } = React;

    export function CatalogView({ favorites, onToggleFavorite, favoriteSets, disfavorSets, onCycleSetStatus, ugcOverlay }) {
      const [poolMode,    setPoolMode]    = React.useState("25y");
      const [section,     setSection]     = React.useState("main");
      const [typeId,      setTypeId]      = React.useState("all");
      const [searchQuery, setSearchQuery] = React.useState("");
      const [equipFilter, setEquipFilter] = React.useState(() => new Set()); // empty = no filter
      const [zoneFilter,  setZoneFilter]  = React.useState(() => new Set()); // empty = no filter
      const [expandedKey, setExpandedKey] = React.useState(null);
      const [printAll,    setPrintAll]    = React.useState(false);
      // Phase II — flag-for-review: stores prefill values for FeedbackModal.
      // null = modal closed; object with { subject, body } = modal open.
      const [flagging,    setFlagging]    = React.useState(null);

      const isTyped = (section === "drill" || section === "main");

      // 1. Get authored options for the selected (section, typeId, poolMode).
      // 2. Filter by search query, equipment, zone — combined with AND.
      const filtered = React.useMemo(() => {
        const list = getCatalogList(section, isTyped ? typeId : null, poolMode, ugcOverlay);
        const q = searchQuery.trim().toLowerCase();
        return list.filter(opt => {
          // Label search
          if (q) {
            const labelText = (opt.label || `${section} #${opt._idx}`).toLowerCase();
            if (!labelText.includes(q)) return false;
          }
          // Equipment filter — option must satisfy at least one of the selected
          // equipment items (OR within the equipment chips).
          if (equipFilter.size > 0) {
            let any = false;
            for (const eq of equipFilter) if (catalogOptionUsesEquip(opt, eq)) { any = true; break; }
            if (!any) return false;
          }
          // Zone filter — option's inferred block zone must be in the set.
          if (zoneFilter.size > 0) {
            const z = inferBlockZone({ section, sets: opt.sets, primary_zone: opt.primary_zone });
            if (!zoneFilter.has(z)) return false;
          }
          return true;
        });
      }, [section, typeId, poolMode, searchQuery, equipFilter, zoneFilter, isTyped]);

      const tabStyle = (active, color = "var(--color-primary)") => ({
        padding: "6px 12px", border: "none", borderRadius: 6,
        background: active ? color : "var(--color-card)",
        color: active ? "var(--color-bg)" : "var(--color-text-muted)",
        fontSize: 12, fontWeight: 700, cursor: "pointer",
        marginRight: 6, marginBottom: 6,
      });

      const toggleSetMember = (set, key, setter) => {
        const next = new Set(set);
        if (next.has(key)) next.delete(key); else next.add(key);
        setter(next);
      };

      // Phase II — open feedback modal prefilled with the option's identity.
      // Coach can append "what to review" detail before submitting.
      const openFlag = React.useCallback((opt) => {
        const labelText = opt.label || `(unlabeled ${section} #${opt._idx})`;
        const subject = `Catalog flag: ${labelText} [${poolMode}/${section}${opt._typeId ? "/" + opt._typeId : ""}]`;
        const body = [
          "Flagged from catalog browse.",
          "",
          `Label:       ${opt.label || "(unlabeled)"}`,
          `Pool mode:   ${poolMode}`,
          `Section:     ${section}`,
          ...(opt._typeId ? [`Type:        ${opt._typeId}`] : []),
          `Index:       ${opt._idx}`,
          `Total:       ${opt.totalYards} ${poolMode === "25y" ? "yd" : "m"}`,
          `Sets:        ${(opt.sets || []).length}`,
          "",
          "What to review (please fill in):",
          "",
        ].join("\n");
        setFlagging({ subject, body });
      }, [section, poolMode]);

      // Print: expand everything, trigger window.print, then collapse back.
      const handlePrint = React.useCallback(() => {
        setPrintAll(true);
        setTimeout(() => {
          window.print();
          setTimeout(() => setPrintAll(false), 250);
        }, 100);
      }, []);

      const unitLabel = (poolMode === "25y") ? "yd" : "m";

      return (
        <div>
          <div className="screen-only">
            <h2 style={{ color: "var(--color-text)", marginTop: 0, display: "inline-block", marginRight: 16 }}>📚 Workout Catalog</h2>
            <button onClick={handlePrint}
              style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--color-border)",
                       background: "var(--color-card)", color: "#cbd5e1", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              🖨 Print catalog (expanded)
            </button>
            <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 8, marginBottom: 8 }}>
              Read-only browse of the workout-set bank as authored. No cross-unit conversion or fallback — see what's actually in each bucket per pool mode.
            </p>
            <p className="card" style={{ color: "var(--color-warn)", fontSize: 12, marginTop: 0, marginBottom: 16, padding: "8px 12px", borderRadius: 6 }}>
              ⚠️ All intervals are calibrated for a <strong>masters baseline of 2:00/100yd</strong> (≈2:11/100m for SCM).
              On the workout page, set your actual pace and click <em>Rescale</em> to scale every interval proportionally.
              Faster swimmers tighten; slower swimmers loosen.
            </p>
          </div>
          <div className="print-only" style={{ marginBottom: 16 }}>
            <h2>Workout Catalog — {poolMode} · {section}{isTyped ? ` · ${typeId}` : ""}</h2>
          </div>

          {/* Pool mode toggle */}
          <div className="screen-only" style={{ marginBottom: 12 }}>
            <span style={{ color: "var(--color-text-dim)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginRight: 10 }}>Mode</span>
            {["25y", "25m", "50m"].map(m => (
              <button key={m} onClick={() => { setPoolMode(m); setExpandedKey(null); }} style={tabStyle(poolMode === m, "var(--color-primary)")}>{m}</button>
            ))}
          </div>

          {/* Section filter */}
          <div className="screen-only" style={{ marginBottom: 12 }}>
            <span style={{ color: "var(--color-text-dim)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginRight: 10 }}>Section</span>
            {CATALOG_SECTIONS.map(s => (
              <button key={s} onClick={() => { setSection(s); setExpandedKey(null); }} style={tabStyle(section === s, "var(--color-positive)")}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Type filter — only meaningful for drill/main */}
          {isTyped && (
            <div className="screen-only" style={{ marginBottom: 12 }}>
              <span style={{ color: "var(--color-text-dim)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginRight: 10 }}>Type</span>
              {CATALOG_TYPES.map(t => (
                <button key={t} onClick={() => { setTypeId(t); setExpandedKey(null); }} style={tabStyle(typeId === t, "var(--color-primary)")}>{t}</button>
              ))}
            </div>
          )}

          {/* Equipment filter chips */}
          <div className="screen-only" style={{ marginBottom: 12 }}>
            <span style={{ color: "var(--color-text-dim)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginRight: 10 }}>Equipment</span>
            {EQUIPMENT_LIST.map(eq => (
              <button key={eq.id}
                onClick={() => toggleSetMember(equipFilter, eq.id, setEquipFilter)}
                title={eq.description}
                style={tabStyle(equipFilter.has(eq.id), "var(--color-warn)")}>
                {eq.icon} {eq.label}
              </button>
            ))}
            {equipFilter.size > 0 && (
              <button onClick={() => setEquipFilter(new Set())}
                style={{ ...tabStyle(false), color: "var(--color-warn)", fontStyle: "italic" }}>
                clear
              </button>
            )}
          </div>

          {/* Zone filter chips */}
          <div className="screen-only" style={{ marginBottom: 12 }}>
            <span style={{ color: "var(--color-text-dim)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginRight: 10 }}>Zone</span>
            {ZONE_ORDER.map(zid => {
              const z = ZONES[zid];
              return (
                <button key={zid}
                  onClick={() => toggleSetMember(zoneFilter, zid, setZoneFilter)}
                  style={{ ...tabStyle(zoneFilter.has(zid), z.color),
                           color: zoneFilter.has(zid) ? "var(--color-bg)" : z.color,
                           border: `1px solid ${z.color}` }}>
                  {z.label}
                </button>
              );
            })}
            {zoneFilter.size > 0 && (
              <button onClick={() => setZoneFilter(new Set())}
                style={{ ...tabStyle(false), color: "var(--color-text-muted)", fontStyle: "italic" }}>
                clear
              </button>
            )}
          </div>

          {/* Search input */}
          <div className="screen-only" style={{ marginBottom: 16 }}>
            <span style={{ color: "var(--color-text-dim)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginRight: 10 }}>Search label</span>
            <input
              type="text" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === "Escape") setSearchQuery(""); }}
              placeholder="e.g. CSS, IM, sprint…"
              style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--color-border)",
                       background: "var(--color-bg)", color: "var(--color-text)", fontSize: 12, width: 220 }}
            />
          </div>

          {/* Result count */}
          <div className="screen-only" style={{ color: "var(--color-text-dim)", fontSize: 12, marginBottom: 12 }}>
            {filtered.length} option{filtered.length === 1 ? "" : "s"}
          </div>

          {/* List */}
          {filtered.length === 0 ? (
            <div style={{ color: "var(--color-text-muted)", fontStyle: "italic", padding: 20, textAlign: "center", border: "1px dashed var(--color-border)", borderRadius: 8 }}>
              No options match. (Try clearing filters or switching section/mode.)
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {filtered.map(opt => {
                const key       = `${opt._typeId || section}-${opt._idx}`;
                const expanded  = printAll || expandedKey === key;
                const declared  = opt.totalYards || 0;
                const actual    = (opt.sets || []).reduce((s, st) => s + (st.reps || 1) * (st.dist || 0), 0);
                const mismatch  = declared !== actual;
                const labelText = opt.label || `(unlabeled ${section} #${opt._idx})`;
                const blockZ    = inferBlockZone({ section, sets: opt.sets, primary_zone: opt.primary_zone });
                const zoneInfo  = ZONES[blockZ] || null;

                return (
                  <div key={key} className="catalog-option"
                    className="card" style={{ borderRadius: 8 }}>
                    {/* Row header — clickable to expand */}
                    <div onClick={() => setExpandedKey(expanded && !printAll ? null : key)}
                      style={{
                        padding: "10px 14px", display: "flex", alignItems: "center", gap: 12,
                        flexWrap: "wrap", cursor: printAll ? "default" : "pointer",
                      }}>
                      <span className="screen-only" style={{ color: "var(--color-text-dim)", fontSize: 12, width: 12 }}>{expanded ? "▾" : "▸"}</span>
                      <strong style={{ color: "var(--color-text)", fontSize: 14 }}>{labelText}</strong>
                      {opt._typeId && (
                        <span style={{ background: "var(--color-border)", color: "var(--color-primary-text)", padding: "1px 7px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                          {opt._typeId}
                        </span>
                      )}
                      {zoneInfo && (
                        <span style={{ background: zoneInfo.color, color: "var(--color-bg)", padding: "1px 7px", borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          {zoneInfo.label}
                        </span>
                      )}
                      <span style={{ color: "var(--color-text-muted)", fontSize: 12, fontFamily: "monospace" }}>
                        {declared.toLocaleString()} {unitLabel}
                      </span>
                      <span style={{ color: "var(--color-text-dim)", fontSize: 12 }}>
                        · {(opt.sets || []).length} set{(opt.sets || []).length === 1 ? "" : "s"}
                      </span>
                      {mismatch && (
                        <span title={`Σ reps×dist = ${actual} but totalYards = ${declared}`}
                          style={{ background: "#7f1d1d", color: "#fee2e2", padding: "1px 7px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                          ⚠ sum mismatch (actual {actual})
                        </span>
                      )}
                      {/* Favorite ★ — toggles the existing label-favorite. Hidden
                          when the option has no label or user not authenticated.
                          stopPropagation so click doesn't also toggle row expand. */}
                      {opt.label && onToggleFavorite && (() => {
                        const isFav = favorites && favorites.includes(opt.label);
                        return (
                          <button className="screen-only"
                            onClick={e => { e.stopPropagation(); onToggleFavorite(opt.label); }}
                            title={isFav ? "Remove from favorites" : "Save as favorite — generator will pick it more often (×3 weight)"}
                            style={{ marginLeft: "auto", padding: "2px 6px",
                                     background: "transparent", border: "none",
                                     color: isFav ? "var(--color-warn)" : "var(--color-text-muted)",
                                     fontSize: 18, lineHeight: 1, cursor: "pointer",
                                     opacity: isFav ? 1 : 0.6 }}>
                            {isFav ? "★" : "☆"}
                          </button>
                        );
                      })()}
                      {/* Phase II — flag for review. Pushes the option's identity
                          into a prefilled feedback submission. stopPropagation so
                          the click doesn't also toggle row expand/collapse. */}
                      <button className="screen-only"
                        onClick={e => { e.stopPropagation(); openFlag(opt); }}
                        title="Flag this option for review"
                        style={{ marginLeft: opt.label && onToggleFavorite ? 0 : "auto",
                                 padding: "4px 8px", borderRadius: 6,
                                 border: "1px solid var(--color-border-strong)", background: "transparent",
                                 color: "var(--color-text-muted)", fontSize: 12, cursor: "pointer", lineHeight: 1 }}>
                        🚩 Flag
                      </button>
                    </div>

                    {/* Expanded detail — full sets */}
                    {expanded && (
                      <div style={{ borderTop: "1px solid var(--color-border)", padding: "10px 14px", background: "var(--color-bg)" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, color: "#cbd5e1" }}>
                          <thead>
                            <tr style={{ color: "var(--color-text-dim)", textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              {onCycleSetStatus && <th style={{ padding: "4px 8px", width: 24 }}></th>}
                              <th style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>Reps × Dist</th>
                              <th style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>Interval</th>
                              <th style={{ padding: "4px 8px" }}>Description</th>
                              <th style={{ padding: "4px 8px" }}>Focus</th>
                            </tr>
                          </thead>
                          <tbody>
                            {opt.sets.map((s, i) => {
                              const eqItems = equipmentForSet(s, CATALOG_ALL_EQUIP);
                              // Gap-2 (2026-05-22) — per-set cycling button.
                              // Only fires when set has an `id` and user is
                              // authenticated. Mirrors SetRow's tri-state.
                              const isFav = !!(s.id && favoriteSets && favoriteSets.has(s.id));
                              const isDis = !!(s.id && disfavorSets && disfavorSets.has(s.id));
                              const cycleIcon  = isFav ? "★" : (isDis ? "👎" : "☆");
                              const cycleColor = isFav ? "var(--color-warn)" : (isDis ? "#ef4444" : "var(--color-text-dim)");
                              const cycleTitle = isFav
                                ? "Favorited — click to disfavor"
                                : (isDis ? "Disfavored — click to clear" : "Click to favorite");
                              return (
                                <tr key={i} style={{ borderTop: "1px solid var(--color-card)" }}>
                                  {onCycleSetStatus && (
                                    <td style={{ padding: "6px 4px", textAlign: "center" }}>
                                      {s.id ? (
                                        <button
                                          type="button"
                                          onClick={() => onCycleSetStatus(s.id)}
                                          title={cycleTitle}
                                          style={{
                                            background: "transparent", border: "none",
                                            color: cycleColor, fontSize: 14, lineHeight: 1,
                                            cursor: "pointer", padding: 2,
                                          }}>
                                          {cycleIcon}
                                        </button>
                                      ) : (
                                        <span style={{ color: "var(--color-text-dim)", opacity: 0.3, fontSize: 10 }} title="No set ID — cannot favorite">·</span>
                                      )}
                                    </td>
                                  )}
                                  <td style={{ padding: "6px 8px", whiteSpace: "nowrap", fontFamily: "monospace", fontWeight: 700, color: "var(--color-text)" }}>
                                    {s.reps > 1 ? `${s.reps}×${s.dist}` : `${s.dist}`} {unitLabel}
                                  </td>
                                  <td style={{ padding: "6px 8px", whiteSpace: "nowrap", fontFamily: "monospace", color: "var(--color-text-muted)" }}>
                                    {s.interval || "—"}
                                  </td>
                                  <td style={{ padding: "6px 8px" }}>
                                    {s.desc || "—"}
                                    {eqItems.length > 0 && (
                                      <span style={{ marginLeft: 6 }}>
                                        {eqItems.map(name => <EquipmentBadge key={name} name={name} />)}
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ padding: "6px 8px", color: "var(--color-text-muted)", fontStyle: "italic" }}>
                                    {s.focus || "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Phase II — flag-for-review modal (reuses FeedbackModal with prefill) */}
          {flagging && (
            <FeedbackModal
              onClose={() => setFlagging(null)}
              initialCategory="catalog-flag"
              initialSubject={flagging.subject}
              initialBody={flagging.body}
            />
          )}
        </div>
      );
    }
