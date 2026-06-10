// src/components/catalog/UgcFormModal.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { API_BASE } from "../../lib/api.js";

    const { useState, useEffect, useRef } = React;

    export function UgcFormModal({ option, onSave, onClose, isCoach = true }) {
      // isEdit only if we have an option WITH a server id. A pre-filled
      // snapshot from the 📥 button passes a partial option (no id), which
      // should still be treated as create.
      const isEdit = !!(option && option.id);
      const [section, setSection] = React.useState(option?.section || "warmup");
      const [poolMode, setPoolMode] = React.useState(option?.pool_mode || "25y");
      // Phase H — multi-tag. Type + Stroke are arrays; an option can live
      // in multiple type/stroke buckets simultaneously. Fall back to
      // singleton type_id / stroke_id for snapshot pre-fills + edits of
      // pre-migration rows.
      const [typeIds, setTypeIds] = React.useState(() => {
        if (Array.isArray(option?.type_ids)) return [...option.type_ids];
        if (option?.type_id) return [option.type_id];
        return [];
      });
      const [strokeIds, setStrokeIds] = React.useState(() => {
        if (Array.isArray(option?.stroke_ids)) return [...option.stroke_ids];
        if (option?.stroke_id) return [option.stroke_id];
        return [];
      });
      const [label, setLabel] = React.useState(option?.label || "");
      const [totalYards, setTotalYards] = React.useState(option?.total_yards || 0);
      const [sets, setSets] = React.useState(option?.sets?.length
        ? option.sets.map(s => ({ ...s }))
        : [{ reps: 1, dist: 100, desc: "", interval: "On 2:00", focus: "" }]);
      // Phase D — visibility + team picker
      const [visibility, setVisibility] = React.useState(option?.visibility || "private");
      // Lesson tier (Phase 5) — ability level for lesson content (any section).
      const [lessonLevel, setLessonLevel] = React.useState(option?.lesson_level || "");
      const [teamIds, setTeamIds] = React.useState(Array.isArray(option?.team_ids) ? [...option.team_ids] : []);
      const [allTeams, setAllTeams] = React.useState([]);
      React.useEffect(() => {
        fetch(`${API_BASE}/teams`, { credentials: "include", cache: "no-store" })
          .then(r => r.ok ? r.json() : [])
          .then(data => { if (Array.isArray(data)) setAllTeams(data); })
          .catch(() => {});
      }, []);
      const [saving, setSaving] = React.useState(false);
      const [err, setErr] = React.useState(null);

      const needsType = (section === "drill" || section === "main");
      const computedTotal = sets.reduce((acc, s) => acc + (Number(s.reps) || 0) * (Number(s.dist) || 0), 0);

      // Auto-sync total_yards to the computed total. User can override but
      // the form recomputes on each set edit to avoid surprises at save.
      React.useEffect(() => {
        setTotalYards(computedTotal);
      }, [computedTotal]);

      const updateSet = (i, patch) => {
        setSets(prev => prev.map((s, j) => j === i ? { ...s, ...patch } : s));
      };
      // Autofocus the freshly-added row's first input after render. Counter
      // bumps on addSet; useEffect on the counter fires post-render.
      const newRowRepsRef = React.useRef(null);
      const [addCount, setAddCount] = React.useState(0);
      const addSet = () => {
        setSets(prev => [...prev, { reps: 1, dist: 100, desc: "", interval: "On 2:00", focus: "" }]);
        setAddCount(n => n + 1);
      };
      React.useEffect(() => {
        if (addCount > 0 && newRowRepsRef.current) {
          newRowRepsRef.current.focus();
          newRowRepsRef.current.select();  // select the "1" so user can type-replace
        }
      }, [addCount]);
      const removeSet = (i) => {
        if (sets.length === 1) return;  // keep at least 1
        setSets(prev => prev.filter((_, j) => j !== i));
      };

      // Interval normalizer: server requires `On M:SS` or `No interval...`.
      // Forgive common shapes: bare `1:30` → `On 1:30`; bare `none` → `No interval`.
      const normalizeInterval = (raw) => {
        const s = String(raw || "").trim();
        if (!s) return s;
        if (/^\d+:\d{2}$/.test(s)) return `On ${s}`;
        if (/^on \d+:\d{2}$/i.test(s)) return `On ${s.replace(/^on\s+/i, "")}`;  // case-fix
        if (/^(none|no interval)$/i.test(s)) return "No interval";
        return s;  // pass through; server validation will surface if still bad
      };
      const handleSubmit = async () => {
        setErr(null);
        // Client-side guard: team visibility requires at least one team.
        if (visibility === "team" && teamIds.length === 0) {
          setErr("Pick at least one team to share with, or change visibility to Private.");
          return;
        }
        setSaving(true);
        try {
          const csrf = (await (await fetch('/api/auth/csrf')).json()).token;
          // Client-side guard: drill/main need at least one type or stroke checked.
          if (needsType && typeIds.length === 0 && strokeIds.length === 0) {
            setErr("Pick at least one type or stroke for drill/main sections.");
            setSaving(false);
            return;
          }
          const payload = {
            section, pool_mode: poolMode,
            type_ids:   needsType ? typeIds   : [],
            stroke_ids: needsType ? strokeIds : [],
            label,
            total_yards: computedTotal,
            visibility,
            team_ids: visibility === "team" ? teamIds : [],
            lesson_level: lessonLevel || null,
            sets: sets.map(s => ({
              reps: Number(s.reps), dist: Number(s.dist),
              desc: s.desc, interval: normalizeInterval(s.interval),
              focus: s.focus || null, stroke: s.stroke || null, eq: s.eq || null,
            })),
          };
          const url = isEdit
            ? `${API_BASE}/bank-options/${option.id}`
            : `${API_BASE}/bank-options`;
          const r = await fetch(url, {
            method: isEdit ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
            credentials: 'include',
            body: JSON.stringify(payload),
          });
          const j = await r.json();
          if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
          onSave(j);
        } catch (e) {
          setErr(e.message || String(e));
        } finally {
          setSaving(false);
        }
      };

      const fieldStyle = { padding: "6px 8px", border: "1px solid var(--color-border)", borderRadius: 4, fontSize: 13, background: "var(--color-card)", color: "var(--color-text)", minWidth: 0, boxSizing: "border-box" };
      const labelStyle = { display: "block", fontSize: 11, fontWeight: 600, color: "var(--color-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 };

      return (
        <div onClick={onClose} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "var(--color-bg)", color: "var(--color-text)", borderRadius: 8,
            padding: 20, maxWidth: 720, width: "100%", maxHeight: "90vh", overflow: "auto",
            border: "1px solid var(--color-border)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>{isEdit ? "Edit set" : "New set"}</h3>
              <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", color: "var(--color-muted)", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Section</label>
                <select value={section} onChange={(e) => setSection(e.target.value)} style={{ ...fieldStyle, width: "100%" }}>
                  <option value="warmup">warmup</option>
                  <option value="drill">drill / pre-main</option>
                  <option value="main">main</option>
                  <option value="cooldown">cooldown</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Pool mode</label>
                <select value={poolMode} onChange={(e) => setPoolMode(e.target.value)} style={{ ...fieldStyle, width: "100%" }}>
                  <option value="25y">25y</option>
                  <option value="25m">25m</option>
                  <option value="50m">50m</option>
                </select>
              </div>
            </div>
            {/* Phase H — multi-tag type + stroke. Check any combination
                so a single set (e.g. a kick set) can land in distance
                AND sprint AND endurance buckets without duplication. */}
            {needsType && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Type (multi-select)</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 6, border: "1px solid var(--color-border)", borderRadius: 4, background: "var(--color-card)" }}>
                    {["im","distance","sprint","endurance","mixed","technique","lesson"].map(t => (
                      <label key={t} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 12, cursor: "pointer" }}>
                        <input type="checkbox" checked={typeIds.includes(t)}
                          onChange={(e) => {
                            if (e.target.checked) setTypeIds(prev => prev.includes(t) ? prev : [...prev, t]);
                            else setTypeIds(prev => prev.filter(x => x !== t));
                          }} />
                        {t}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Stroke (multi-select)</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 6, border: "1px solid var(--color-border)", borderRadius: 4, background: "var(--color-card)" }}>
                    {["back","breast","fly","free","im"].map(s => (
                      <label key={s} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 12, cursor: "pointer" }}>
                        <input type="checkbox" checked={strokeIds.includes(s)}
                          onChange={(e) => {
                            if (e.target.checked) setStrokeIds(prev => prev.includes(s) ? prev : [...prev, s]);
                            else setStrokeIds(prev => prev.filter(x => x !== s));
                          }} />
                        {s}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Label</label>
              <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120}
                aria-label="Set label"
                style={{ ...fieldStyle, width: "100%" }} placeholder="e.g. Build 8×50" />
            </div>
            {/* Lesson tier (Phase 5) — ability level. Optional; tags the set for the
                Lesson generator's level filter (works on any section, incl. warmup/
                cooldown which can't carry a type tag). Leave "Any" for non-lesson sets. */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Lesson level <span style={{ color: "var(--color-muted)", fontWeight: 400 }}>(optional — for lesson content)</span></label>
              <select value={lessonLevel} onChange={(e) => setLessonLevel(e.target.value)} style={{ ...fieldStyle, width: "100%" }}>
                <option value="">Any / not a lesson set</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            {/* Phase D + E — visibility picker. Public goes through admin
                moderation queue (server coerces to 'pending'). */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Visibility</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", fontSize: 13 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                  <input type="radio" name="ugc-visibility" checked={visibility === "private"}
                    onChange={() => setVisibility("private")} /> 📝 Private (only you)
                </label>
                {/* Team-shared hidden for non-coach (lesson-tier) authors — they have no teams. */}
                {isCoach && (
                <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: allTeams.length === 0 ? "not-allowed" : "pointer", opacity: allTeams.length === 0 ? 0.4 : 1 }}
                  title={allTeams.length === 0 ? "You need to coach at least one team to share." : ""}>
                  <input type="radio" name="ugc-visibility" checked={visibility === "team"}
                    disabled={allTeams.length === 0}
                    onChange={() => setVisibility("team")} /> 👥 Team-shared
                </label>
                )}
                <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                  <input type="radio" name="ugc-visibility" checked={visibility === "public" || visibility === "pending"}
                    onChange={() => setVisibility("public")} /> 🌐 Public (admin review)
                </label>
              </div>
              {(visibility === "public" || visibility === "pending") && (
                <p style={{ fontSize: 11, color: "var(--color-muted)", margin: "6px 0 0 0", fontStyle: "italic" }}>
                  Public submissions wait in an admin review queue before going live to all SetForge coaches.
                </p>
              )}
              {visibility === "team" && (
                <div style={{ marginTop: 8, padding: 8, border: "1px solid var(--color-border)", borderRadius: 4, background: "var(--color-card)" }}>
                  <div style={{ ...labelStyle, marginBottom: 6 }}>Share with teams</div>
                  {allTeams.length === 0 ? (
                    <p style={{ fontSize: 12, color: "var(--color-muted)", margin: 0 }}>(no teams)</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {allTeams.map(t => (
                        <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                          <input type="checkbox"
                            checked={teamIds.includes(t.id)}
                            onChange={(e) => {
                              if (e.target.checked) setTeamIds(prev => prev.includes(t.id) ? prev : [...prev, t.id]);
                              else setTeamIds(prev => prev.filter(id => id !== t.id));
                            }} />
                          <span>{t.name}</span>
                          <span style={{ fontSize: 11, color: "var(--color-muted)" }}>· {t.team_type}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {teamIds.length === 0 && allTeams.length > 0 && (
                    <p style={{ fontSize: 11, color: "#ef4444", margin: "6px 0 0 0" }}>Pick at least one team.</p>
                  )}
                </div>
              )}
            </div>
            <div style={{ marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Sets (total {computedTotal} yd)</label>
              <button onClick={addSet} style={{ padding: "4px 10px", fontSize: 12, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text)", borderRadius: 4, cursor: "pointer" }}>+ Add row</button>
            </div>
            <p style={{ fontSize: 11, color: "var(--color-muted)", margin: "0 0 6px 0" }}>
              Interval format: <code>On 1:30</code> (we'll add "On" if you skip it) or <code>No interval</code> for untimed sets.
            </p>
            <div style={{ marginBottom: 16 }}>
              {sets.map((s, i) => (
                <div key={i} className="editor-row" style={{ display: "grid", gridTemplateColumns: "60px 60px 1fr 100px 1fr 90px 30px", gap: 6, marginBottom: 6, alignItems: "start" }}>
                  <input type="number" min="1" value={s.reps} onChange={(e) => updateSet(i, { reps: e.target.value })} aria-label="Reps" placeholder="reps" style={fieldStyle}
                    ref={i === sets.length - 1 ? newRowRepsRef : null} />
                  <input type="number" min="1" value={s.dist} onChange={(e) => updateSet(i, { dist: e.target.value })} aria-label="Distance" placeholder="dist" style={fieldStyle} />
                  <input className="editor-row-wide" value={s.desc} onChange={(e) => updateSet(i, { desc: e.target.value })} aria-label="Set description" placeholder="Description" style={fieldStyle} maxLength={500} />
                  <input className="editor-row-wide" value={s.interval} onChange={(e) => updateSet(i, { interval: e.target.value })} aria-label="Interval" placeholder="On 2:00" style={fieldStyle} />
                  <input className="editor-row-wide" value={s.focus || ""} onChange={(e) => updateSet(i, { focus: e.target.value })} aria-label="Focus" placeholder="Focus (optional)" style={fieldStyle} maxLength={240} />
                  <select value={s.eq || ""} onChange={(e) => updateSet(i, { eq: e.target.value || null })} style={fieldStyle} title="Equipment required for this set">
                    <option value="">— eq —</option>
                    <option value="kick">kick</option>
                    <option value="pull">pull</option>
                    <option value="snorkel">snorkel</option>
                    <option value="fins">fins</option>
                    <option value="underkick">underkick</option>
                  </select>
                  <button onClick={() => removeSet(i)} disabled={sets.length === 1} style={{ background: "transparent", border: "none", color: sets.length === 1 ? "var(--color-border)" : "#ef4444", cursor: sets.length === 1 ? "default" : "pointer", fontSize: 16 }}>✕</button>
                </div>
              ))}
            </div>
            {err && (
              <div style={{ padding: 8, marginBottom: 12, background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", borderRadius: 4, color: "#ef4444", fontSize: 13 }}>
                {err}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={onClose} disabled={saving}
                style={{ padding: "8px 16px", border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text)", borderRadius: 6, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={saving || !label.trim() || sets.length === 0}
                style={{ padding: "8px 16px", border: "1px solid var(--color-primary)", background: "var(--color-primary)", color: "white", borderRadius: 6, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : isEdit ? "Save changes" : "Create"}
              </button>
            </div>
          </div>
        </div>
      );
    }
