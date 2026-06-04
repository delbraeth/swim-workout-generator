// src/components/workout/SetRow.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { enhanceDesc, equipmentForSet, getEquivalents } from "../../lib/shared.js";
import { inferSetZone, ZONES } from "../../lib/engine.js";
import { EquipmentBadge } from "./EquipmentBadge.jsx";

    const { Fragment } = React;

    export function SetRow({ set, idx, blockIdx, setIdx, isSwapOpen, onToggleSwap, onApplySwap, equipment, isEditingInterval, editIntervalDraft, setEditIntervalDraft, editIntervalError, onStartEditInterval, onCommitInterval, onClearInterval, onCancelInterval, isEditingDesc, editDescDraft, setEditDescDraft, onStartEditDesc, onCommitDesc, onCancelDesc, unit = "yds", blockSection, blockZoneId, poolMode = "25y", isFavoriteSet, isDisfavorSet, onCycleSetStatus }) {
      const eqItems = equipmentForSet(set, equipment);
      const desc = enhanceDesc(set, equipment);
      const equiv = onToggleSwap ? getEquivalents(set, poolMode) : {};
      const hasSwap = !!(equiv.shorter || equiv.longer);
      // H: per-set pip only when the set's zone diverges from the block's
      // dominant zone (keeps the table visually quiet most of the time).
      const setZoneId = set.zone || inferSetZone(set, blockSection);
      const showSetPip = blockZoneId && setZoneId && setZoneId !== blockZoneId;
      const setZone = showSetPip ? (ZONES[setZoneId] || null) : null;
      return (
        <React.Fragment>
          <tr style={{ background: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
            <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "var(--color-border)", whiteSpace: "nowrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {setZone && (
                  <span className="screen-only"
                    title={`This set is ${setZone.label} (block is ${(ZONES[blockZoneId] || {}).label || "n/a"})`}
                    style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: setZone.color,
                      display: "inline-block", flexShrink: 0,
                    }} />
                )}
                {set.reps > 1 ? `${set.reps} × ${set.dist}` : `${set.dist}`}
                {hasSwap && (
                  <button onClick={() => onToggleSwap(blockIdx, setIdx)}
                    style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, border: `1px solid ${isSwapOpen ? "var(--color-text-muted)" : "#cbd5e1"}`, background: isSwapOpen ? "var(--color-text)" : "transparent", cursor: "pointer", color: "var(--color-text-dim)", lineHeight: 1 }}>
                    ⇄
                  </button>
                )}
                {/* v1.6 — per-set fav/disfavor cycling button. Shows when
                    the set has a stable ID (otherwise the API call would
                    fail format validation). Click cycles: neutral → favorite
                    → disfavor → neutral. Mutex enforced server-side. */}
                {set.id && onCycleSetStatus && (() => {
                  const state = isFavoriteSet ? "favorite" : isDisfavorSet ? "disfavor" : "neutral";
                  const icon = state === "favorite" ? "★" : state === "disfavor" ? "👎" : "☆";
                  const color = state === "favorite" ? "var(--color-warn)" : state === "disfavor" ? "#ef4444" : "var(--color-text-dim)";
                  const titles = {
                    neutral:  "Neutral — click to mark this set as favorite (next click: disfavor)",
                    favorite: "Favorite (3× weight) — click to mark as disfavor",
                    disfavor: "Disfavor (0.25× weight) — click to clear",
                  };
                  return (
                    <button
                      className="screen-only"
                      onClick={() => onCycleSetStatus(set.id)}
                      title={titles[state]}
                      style={{
                        fontSize: 12, lineHeight: 1, cursor: "pointer",
                        padding: "2px 5px", borderRadius: 4,
                        background: state !== "neutral" ? "rgba(245,158,11,0.10)" : "transparent",
                        border: "none",
                        color,
                        opacity: state === "neutral" ? 0.35 : 1,
                        transition: "opacity 0.15s, color 0.15s, background 0.15s",
                      }}>
                      {icon}
                    </button>
                  );
                })()}
              </div>
            </td>
            <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "var(--color-card)", whiteSpace: "nowrap" }}>
              {(set.reps * set.dist).toLocaleString()} {unit}
            </td>
            <td style={{ padding: "10px 16px", fontSize: 13, color: "var(--color-border)" }}>
              {isEditingDesc ? (
                <input
                  autoFocus
                  value={editDescDraft}
                  onChange={e => setEditDescDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter")  onCommitDesc(blockIdx, setIdx, editDescDraft);
                    if (e.key === "Escape") onCancelDesc();
                  }}
                  onBlur={() => onCommitDesc(blockIdx, setIdx, editDescDraft)}
                  style={{ width: "100%", fontSize: 13, padding: "2px 6px", borderRadius: 4, border: "1px solid #94a3b8", background: "#fff", color: "var(--color-card)", boxSizing: "border-box" }}
                />
              ) : (
                <span
                  onClick={() => onStartEditDesc && onStartEditDesc(blockIdx, setIdx, set.desc)}
                  title={onStartEditDesc ? "Click to edit" : undefined}
                  style={{ cursor: onStartEditDesc ? "text" : "default", borderBottom: onStartEditDesc ? "1px dashed #94a3b8" : "none", paddingBottom: onStartEditDesc ? 1 : 0 }}>
                  {desc}
                </span>
              )}
              {eqItems.length > 0 && (
                <div className="equipment-badges" style={{ marginTop: 6 }}>
                  {eqItems.map(e => <EquipmentBadge key={e} name={e} />)}
                </div>
              )}
            </td>
            <td style={{ padding: "10px 16px", fontSize: 12, color: "var(--color-text-dim)", fontFamily: "monospace" }}>
              {isEditingInterval ? (() => {
                const hasOn = /^On\s+/i.test(editIntervalDraft);
                const timePart = hasOn ? editIntervalDraft.replace(/^On\s+/i, "") : editIntervalDraft;
                const hasError = !!editIntervalError;
                return (
                  <div>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {hasOn && <span style={{ color: "var(--color-text-muted)" }}>On</span>}
                      <input
                        autoFocus
                        value={timePart}
                        onChange={e => setEditIntervalDraft(hasOn ? "On " + e.target.value : e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter")  onCommitInterval(blockIdx, setIdx, editIntervalDraft);
                          if (e.key === "Escape") onCancelInterval();
                        }}
                        onBlur={() => onCommitInterval(blockIdx, setIdx, editIntervalDraft)}
                        style={{ width: 52, fontFamily: "monospace", fontSize: 12, padding: "2px 5px", borderRadius: 4,
                                 border: hasError ? "1px solid #dc2626" : "1px solid #94a3b8",
                                 background: "#fff", color: "var(--color-card)" }}
                      />
                      {/* S2 — ⊘ clears to no-interval. onMouseDown preventDefault keeps
                          focus on the input so onBlur doesn't fire and try to commit
                          the (possibly invalid) draft before the clear takes effect. */}
                      {onClearInterval && (
                        <button
                          type="button"
                          title="Clear to no interval"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => onClearInterval(blockIdx, setIdx)}
                          style={{ fontSize: 14, lineHeight: 1, padding: "0 4px", borderRadius: 4,
                                   border: "1px solid #cbd5e1", background: "#f8fafc", color: "var(--color-text-dim)",
                                   cursor: "pointer" }}
                        >
                          ⊘
                        </button>
                      )}
                    </span>
                    {hasError && (
                      <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3, fontFamily: "inherit", fontStyle: "italic" }}>
                        {editIntervalError}
                      </div>
                    )}
                  </div>
                );
              })() : (
                <span
                  onClick={() => onStartEditInterval && onStartEditInterval(blockIdx, setIdx, set.interval)}
                  title={onStartEditInterval ? "Click to edit" : undefined}
                  style={{ cursor: onStartEditInterval ? "text" : "default", borderBottom: onStartEditInterval ? "1px dashed #94a3b8" : "none", paddingBottom: onStartEditInterval ? 1 : 0 }}>
                  {set.interval}
                </span>
              )}
            </td>
            <td style={{ padding: "10px 16px", fontSize: 12, color: "var(--color-text-dim)", fontStyle: "italic" }}>{set.focus}</td>
          </tr>
          {isSwapOpen && (
            <tr>
              <td colSpan={5} style={{ padding: "0 16px 12px 16px", background: "#f0f9ff", borderBottom: "2px solid #bae6fd" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", paddingTop: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-border-strong)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Swap to:</span>
                  {equiv.shorter && (
                    <button onClick={() => onApplySwap(blockIdx, setIdx, equiv.shorter)}
                      style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "1px solid #7dd3fc", background: "#e0f2fe", color: "#0369a1", cursor: "pointer", fontWeight: 600 }}>
                      ↙ Shorter — {equiv.shorter.reps} × {equiv.shorter.dist} {unit} &nbsp;<span style={{ fontWeight: 400, color: "#0284c7" }}>{equiv.shorter.interval}</span>
                    </button>
                  )}
                  {equiv.longer && (
                    <button onClick={() => onApplySwap(blockIdx, setIdx, equiv.longer)}
                      style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "1px solid #86efac", background: "#f0fdf4", color: "#15803d", cursor: "pointer", fontWeight: 600 }}>
                      ↗ Longer — {equiv.longer.reps} × {equiv.longer.dist} {unit} &nbsp;<span style={{ fontWeight: 400, color: "#16a34a" }}>{equiv.longer.interval}</span>
                    </button>
                  )}
                  <button onClick={() => onToggleSwap(blockIdx, setIdx)}
                    style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#f1f5f9", color: "var(--color-text-dim)", cursor: "pointer", marginLeft: 4 }}>
                    Cancel
                  </button>
                </div>
              </td>
            </tr>
          )}
        </React.Fragment>
      );
    }
