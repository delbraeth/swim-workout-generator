// src/components/people/ManagedSwimmersView.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { csrfHeaders } from "../../lib/api.js";
import { genderLabel } from "../../lib/format.js";
import { AddressManager } from "./AddressManager.jsx";
import { BulkImportModal } from "./BulkImportModal.jsx";
import { ClaimTokensPanel } from "./ClaimTokensPanel.jsx";
import { CoachNotesPanel } from "./CoachNotesPanel.jsx";
import { ConstraintsPanel } from "./ConstraintsPanel.jsx";
import { HouseholdSiblings } from "./HouseholdSiblings.jsx";
import { ManagedSwimmerForm } from "./ManagedSwimmerForm.jsx";
import { ParentsPanel } from "./ParentsPanel.jsx";
import { SwimmerEquipmentPanel } from "./SwimmerEquipmentPanel.jsx";
import { RaceGoalsPanel } from "../profile/RaceGoalsPanel.jsx";

    const { useState, useCallback, useEffect } = React;

    // Declutter (2026-06-04): collapsible wrapper for the detail panels, so the
    // swimmer detail screen is a tidy list of expandable sections instead of one
    // long stacked wall. Native <details> — no extra state.
    function DetailSection({ emoji, title, children, defaultOpen = false }) {
      return (
        <details open={defaultOpen} style={{ marginTop: 8, borderTop: "1px solid var(--color-border)", paddingTop: 2 }}>
          <summary style={{ cursor: "pointer", padding: "8px 2px", fontWeight: 700, fontSize: 14,
            display: "flex", alignItems: "center", gap: 8, userSelect: "none" }}>
            <span>{emoji}</span><span>{title}</span>
          </summary>
          <div style={{ paddingBottom: 6 }}>{children}</div>
        </details>
      );
    }

    export function ManagedSwimmersView({ mySub = null, featureFlags = null } = {}) {
      const ff = featureFlags || {};   // Phase 6: gate constraints / coach-notes panels
      const [list,       setList]       = React.useState(null);
      const [showArch,   setShowArch]   = React.useState(false);
      const [selectedId, setSelectedId] = React.useState(null);
      const [detail,     setDetail]     = React.useState(null);
      // Composite payload from /api/managed-swimmers/:id/detail — seeds the
      // panels below so opening a swimmer is ONE request, not ~7 (the burst
      // that tripped 429s). Panels still keep their own fetch for post-edit
      // refresh; the seed just skips the initial load. null until loaded.
      const [bundle,     setBundle]     = React.useState(null);
      const [creating,   setCreating]   = React.useState(false);
      const [importing,  setImporting]  = React.useState(false);
      const [form,       setForm]       = React.useState(() => emptyForm());
      const [editing,    setEditing]    = React.useState(false);
      const [teams,      setTeams]      = React.useState(null);                // coach's active teams (for picker)
      const [msg,        setMsg]        = React.useState(null);

      function emptyForm() {
        return {
          display_name: "", initials: "", dob: "", gender: "", class_year: "", usa_swimming_id: "", team_id: "",
          pace_scy_100: "", pace_scm_100: "", pace_lcm_100: "",
          parental_contact: "", parent_managed_flag: false, lesson_level: "",
        };
      }

      const loadList = React.useCallback(async () => {
        try {
          const q = showArch ? "?archived=1" : "";
          const res = await fetch(`/api/managed-swimmers${q}`, { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setList(await res.json());
        } catch (err) {
          setList([]);
          setMsg(`Error loading roster: ${err.message}`);
        }
      }, [showArch]);

      const loadDetail = React.useCallback(async (id) => {
        if (!id) { setDetail(null); setBundle(null); return; }
        setDetail(null); setBundle(null);
        try {
          const res = await fetch(`/api/managed-swimmers/${id}/detail`, { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const payload = await res.json();
          setBundle(payload);
          const d = payload.swimmer;
          setDetail(d);
          setForm({
            display_name:        d.display_name || "",
            initials:            d.initials || "",
            dob:                 d.dob || "",
            gender:              d.gender || "",
            class_year:          d.class_year ? String(d.class_year) : "",
            usa_swimming_id:     d.usa_swimming_id || "",
            team_id:             d.team_id || "",
            pace_scy_100:        d.pace_scy_100 || "",
            pace_scm_100:        d.pace_scm_100 || "",
            pace_lcm_100:        d.pace_lcm_100 || "",
            parental_contact:    d.parental_contact || "",
            parent_managed_flag: !!d.parent_managed_flag,
            lesson_level:        d.lesson_level || "",
          });
        } catch (err) {
          setMsg(`Error loading swimmer: ${err.message}`);
        }
      }, []);

      React.useEffect(() => { loadList(); }, [loadList]);
      React.useEffect(() => { loadDetail(selectedId); }, [selectedId, loadDetail]);

      // Load the coach's active teams once on mount for the team-picker UI.
      // Filtered to non-archived so the picker only shows usable targets.
      React.useEffect(() => {
        fetch("/api/teams", { cache: "no-store" })
          .then(r => r.ok ? r.json() : [])
          .then(ts => {
            const active = (Array.isArray(ts) ? ts : []).filter(t => !t.archived);
            setTeams(active);
            // If the coach has exactly one team, default the create form to it.
            // Only seed an empty form — never overwrite an in-progress edit or
            // a form the user has already touched.
            if (active.length === 1) {
              setForm(f => (f.display_name === "" && f.team_id === "" ? { ...f, team_id: active[0].id } : f));
            }
          })
          .catch(() => setTeams([]));
      }, []);

      const submitCreate = async () => {
        if (!form.display_name.trim()) { setMsg("Name required"); return; }
        if (!form.dob) { setMsg("DOB required (compliance gate)"); return; }
        try {
          const res = await fetch("/api/managed-swimmers", {
            method:  "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({
              display_name:        form.display_name.trim(),
              initials:            form.initials.trim() || null,
              dob:                 form.dob,
              gender:              form.gender || null,
              class_year:          form.class_year ? Number(form.class_year) : null,
              usa_swimming_id:     form.usa_swimming_id.trim() || null,
              team_id:             form.team_id || null,
              pace_scy_100:        form.pace_scy_100.trim() || null,
              pace_scm_100:        form.pace_scm_100.trim() || null,
              pace_lcm_100:        form.pace_lcm_100.trim() || null,
              parental_contact:    form.parental_contact.trim() || null,
              parent_managed_flag: !!form.parent_managed_flag,
              lesson_level:        form.lesson_level || null,
            }),
          });
          const j = await res.json();
          if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
          setMsg(null);
          // Reset to empty form, but re-default team if coach has only one team.
          const reset = emptyForm();
          if (teams && teams.length === 1) reset.team_id = teams[0].id;
          setForm(reset);
          setCreating(false);
          await loadList();
          setSelectedId(j.id);
        } catch (err) { setMsg(`Error: ${err.message}`); }
      };

      const submitEdit = async () => {
        try {
          const res = await fetch(`/api/managed-swimmers/${detail.id}`, {
            method:  "PATCH",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({
              display_name:        form.display_name.trim(),
              initials:            form.initials.trim() || null,
              dob:                 form.dob,
              gender:              form.gender || null,
              class_year:          form.class_year ? Number(form.class_year) : null,
              usa_swimming_id:     form.usa_swimming_id.trim() || null,
              team_id:             form.team_id || null,
              pace_scy_100:        form.pace_scy_100.trim() || null,
              pace_scm_100:        form.pace_scm_100.trim() || null,
              pace_lcm_100:        form.pace_lcm_100.trim() || null,
              parental_contact:    form.parental_contact.trim() || null,
              parent_managed_flag: !!form.parent_managed_flag,
              lesson_level:        form.lesson_level || null,
            }),
          });
          const j = await res.json();
          if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
          setEditing(false);
          setMsg(null);
          await loadDetail(detail.id);
          await loadList();
        } catch (err) { setMsg(`Error: ${err.message}`); }
      };

      const handleArchive = async () => {
        const next = !detail.archived;
        const verb = next ? "Archive" : "Unarchive";
        if (!window.confirm(`${verb} ${detail.display_name}?`)) return;
        try {
          const res = await fetch(`/api/managed-swimmers/${detail.id}/archive`, {
            method:  "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({ archived: next }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          await loadDetail(detail.id);
          await loadList();
        } catch (err) { setMsg(`Error: ${err.message}`); }
      };

      // ── Minor-indicator pill ─────────────────────────────────────────
      function MinorPill({ swimmer }) {
        if (swimmer.is_coppa_protected) {
          return <span title="Under 13 — claim flow blocked per decision #28"
            style={{ fontSize: 10, padding: "1px 7px", borderRadius: 999, background: "#dc262622", border: "1px solid #dc2626", color: "#dc2626", fontWeight: 700 }}>under 13</span>;
        }
        if (swimmer.is_minor) {
          return <span title="Under 18 — minor protections apply"
            style={{ fontSize: 10, padding: "1px 7px", borderRadius: 999, background: "#f59e0b22", border: "1px solid var(--color-warn)", color: "var(--color-warn)", fontWeight: 700 }}>minor</span>;
        }
        return <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 999, background: "#33415522", border: "1px solid var(--color-border-strong)", color: "var(--color-text-muted)", fontWeight: 700 }}>adult</span>;
      }

      // ── Detail view ─────────────────────────────────────────────────
      if (selectedId && detail) {
        return (
          <div>
            <button onClick={() => { setSelectedId(null); setDetail(null); setEditing(false); setMsg(null); }}
              style={{ marginBottom: 12, padding: "5px 11px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              ← All swimmers
            </button>

            <div className="card" style={{ borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                <div>
                  <h2 style={{ color: "var(--color-text)", margin: 0, fontSize: 20 }}>
                    {detail.display_name}
                    {detail.archived && <span style={{ marginLeft: 10, fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "#64748b22", border: "1px solid #64748b", color: "var(--color-text-muted)" }}>archived</span>}
                  </h2>
                  <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Age {detail.age}</span>
                    <MinorPill swimmer={detail} />
                    {detail.parent_managed_flag && (
                      <span title="Coach has flagged this profile as parent-managed; claim blocked even if 13+"
                        style={{ fontSize: 10, padding: "1px 7px", borderRadius: 999, background: "#3b82f622", border: "1px solid var(--color-primary)", color: "var(--color-primary-text)", fontWeight: 700 }}>parent-managed</span>
                    )}
                  </div>
                </div>
                {!editing && (
                  <button onClick={() => setEditing(true)}
                    style={{ padding: "5px 11px", background: "var(--color-primary)", color: "var(--color-bg)", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    ✎ Edit
                  </button>
                )}
              </div>

              {editing ? (
                <ManagedSwimmerForm form={form} setForm={setForm} teams={teams} />
              ) : (
                <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.7 }}>
                  <div>Initials: <strong>{detail.initials || "—"}</strong></div>
                  <div>DOB: <strong>{detail.dob}</strong></div>
                  <div>Gender: <strong>{genderLabel(detail.gender) || "—"}</strong></div>
                  <div>Class year: <strong>{detail.class_year || "—"}</strong>{detail.grade != null && detail.grade >= 1 && detail.grade <= 12 ? <span style={{ color: "var(--color-text-dim)", marginLeft: 6 }}>(Grade {detail.grade})</span> : detail.grade != null && detail.grade > 12 ? <span style={{ color: "var(--color-text-dim)", marginLeft: 6 }}>(Graduated)</span> : null}</div>
                  <div>Team: <strong>{detail.team_id ? ((teams || []).find(t => t.id === detail.team_id)?.name || detail.team_id) : "— none —"}</strong></div>
                  <div>Paces — SCY: <strong>{detail.pace_scy_100 || "—"}</strong> · SCM: <strong>{detail.pace_scm_100 || "—"}</strong> · LCM: <strong>{detail.pace_lcm_100 || "—"}</strong></div>
                  <div>Parental contact: <strong>{detail.parental_contact || "—"}</strong></div>
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--color-card)" }}>
                    {/* Home address — coach sees it only if a guardian shared it (consent). */}
                    <AddressManager key={detail.id} swimmerRef={detail.id} showConsent={false}
                      seedAddresses={bundle?.addresses} seedCanWrite={bundle?.address_can_write} />
                    {/* Siblings (P3) — consent-gated per sibling server-side. */}
                    <HouseholdSiblings key={"hh-" + detail.id} swimmerRef={detail.id}
                      seedHousehold={bundle?.household} />
                  </div>
                </div>
              )}

              <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                {editing ? (
                  <>
                    <button onClick={submitEdit}
                      style={{ padding: "6px 14px", background: "var(--color-positive)", color: "var(--color-bg)", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Save</button>
                    <button onClick={() => { setEditing(false); loadDetail(detail.id); }}
                      style={{ padding: "6px 14px", background: "var(--color-border)", color: "#cbd5e1", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>Cancel</button>
                  </>
                ) : (
                  <button onClick={handleArchive}
                    style={{ padding: "5px 11px", background: detail.archived ? "var(--color-positive)" : "var(--color-text-dim)", color: "var(--color-bg)", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    {detail.archived ? "Unarchive" : "Archive"}
                  </button>
                )}
              </div>

              <div style={{ fontSize: 10, color: "var(--color-text-dim)", marginTop: 10 }}>
                ID <code style={{ background: "var(--color-bg)", padding: "1px 5px", borderRadius: 3 }}>{detail.id}</code>
                <span style={{ marginLeft: 8 }}>Owner sub ends in <code>{detail.owner_coach_sub.slice(-8)}</code></span>
              </div>
            </div>

            {/* Declutter (2026-06-04): the per-swimmer panels are now collapsible
                sections (collapsed by default) so the detail screen is a tidy list,
                not one long stacked wall. */}
            {!detail.archived && ff.constraints !== false && (
              <DetailSection emoji="🚱" title="Constraints">
                <ConstraintsPanel key={"con-" + detail.id} managedId={detail.id}
                  seedConstraints={bundle?.constraints} />
              </DetailSection>
            )}

            {/* Lesson tier (Phase 5) — per-swimmer equipment profile. */}
            {!detail.archived && (
              <DetailSection emoji="🛠️" title="Equipment profile">
                <SwimmerEquipmentPanel key={"eq-" + detail.id} managedId={detail.id}
                  swimmerName={detail.display_name} initialEquipment={detail.equipment_modes}
                  onSaved={() => loadDetail(detail.id)} />
              </DetailSection>
            )}

            {/* Phase 5 #4 — race goals/PRs that anchor Race-Pace workout targets. */}
            {!detail.archived && (
              <DetailSection emoji="🎯" title="Race goals / PRs">
                <RaceGoalsPanel key={"rg-" + detail.id} endpoint={`/api/managed-swimmers/${detail.id}/event-times`} />
              </DetailSection>
            )}

            {/* Parent Portal MVP — invite/revoke parents on this profile */}
            {!detail.archived && (
              <DetailSection emoji="👪" title="Parents">
                <ParentsPanel key={"pp-" + detail.id} swimmerRef={detail.id} swimmerName={detail.display_name}
                  seedGuardians={bundle?.parents?.guardians} seedInvites={bundle?.parents?.invites} />
              </DetailSection>
            )}

            {/* R-H: coach notes journal for this managed profile */}
            {!detail.archived && ff.coach_notes !== false && (
              <DetailSection emoji="🗒️" title="Coach notes">
                <CoachNotesPanel
                  key={"cn-" + detail.id}
                  targetManagedId={detail.id}
                  teamId={detail.team_id}
                  mySub={mySub}
                  seedNotes={bundle?.coach_notes}
                />
              </DetailSection>
            )}

            {/* R-I: claim token issuer (least-used → last). */}
            {!detail.archived && (
              <DetailSection emoji="🎫" title="Claim token (move to swimmer's own account)">
                <ClaimTokensPanel
                  key={"ct-" + detail.id}
                  managedId={detail.id}
                  isMinor={detail.is_minor}
                  isCoppa={detail.is_coppa_protected}
                  parentManaged={detail.parent_managed_flag}
                  seedTokens={bundle?.claim_tokens}
                />
              </DetailSection>
            )}

            {msg && <div style={{ color: "#fca5a5", fontSize: 12, padding: "8px 0" }}>{msg}</div>}
          </div>
        );
      }

      // ── List view ───────────────────────────────────────────────────
      const itemsByMinor = list ? {
        coppa:  list.filter(s => s.is_coppa_protected),
        minor:  list.filter(s => s.is_minor && !s.is_coppa_protected),
        adult:  list.filter(s => !s.is_minor),
      } : null;

      return (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ color: "var(--color-text)", margin: 0 }}>🏊 Managed swimmers</h2>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button onClick={() => setShowArch(v => !v)}
                style={{ padding: "5px 11px", borderRadius: 6, border: "1px solid var(--color-border)", background: showArch ? "var(--color-border)" : "transparent", color: "var(--color-text-muted)", fontSize: 11, cursor: "pointer" }}>
                {showArch ? "Hide archived" : "Show archived"}
              </button>
              <button onClick={() => setImporting(true)}
                style={{ padding: "6px 14px", background: "transparent", color: "var(--color-primary-text)", border: "1px solid var(--color-primary)", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                📥 Import
              </button>
              <button onClick={() => setCreating(c => !c)}
                style={{ padding: "6px 14px", background: creating ? "var(--color-border)" : "var(--color-positive)", color: creating ? "#cbd5e1" : "var(--color-bg)", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {creating ? "Cancel" : "+ New swimmer"}
              </button>
            </div>
          </div>

          {importing && (
            <BulkImportModal
              teams={teams || []}
              onClose={() => setImporting(false)}
              onImported={() => { loadList(); }}
            />
          )}

          {creating && (
            <div style={{ background: "var(--color-card)", border: "1px solid #22c55e", borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <h3 style={{ color: "var(--color-text)", marginTop: 0, fontSize: 14 }}>Create managed swimmer</h3>
              <ManagedSwimmerForm form={form} setForm={setForm} teams={teams} />
              <button onClick={submitCreate}
                style={{ padding: "7px 16px", background: "var(--color-positive)", color: "var(--color-bg)", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>
                Create
              </button>
            </div>
          )}

          {msg && <div style={{ color: "#fca5a5", fontSize: 12, marginBottom: 10 }}>{msg}</div>}

          {list === null ? (
            <div style={{ color: "var(--color-text-dim)", fontSize: 13 }}>Loading…</div>
          ) : list.length === 0 ? (
            <div style={{ color: "var(--color-text-dim)", fontSize: 13, fontStyle: "italic", padding: 20, textAlign: "center", border: "1px dashed var(--color-border)", borderRadius: 10 }}>
              No managed swimmers yet. Add one above — DOB is required for compliance gates.
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 11, color: "var(--color-text-dim)", marginBottom: 8 }}>
                {list.length} swimmer{list.length === 1 ? "" : "s"}
                {itemsByMinor && (itemsByMinor.coppa.length + itemsByMinor.minor.length > 0) && (
                  <span> · {itemsByMinor.coppa.length} under 13 · {itemsByMinor.minor.length} 13–17 · {itemsByMinor.adult.length} adult</span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {list.map(s => {
                  const teamName = s.team_id ? ((teams || []).find(t => t.id === s.team_id)?.name) : null;
                  return (
                    <button key={s.id} onClick={() => setSelectedId(s.id)}
                      style={{ display: "block", textAlign: "left", width: "100%", padding: "10px 12px", background: s.archived ? "#1e293b88" : "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, cursor: "pointer", color: "var(--color-text)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>
                            {s.display_name}
                            {s.archived && <span style={{ marginLeft: 8, fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#64748b22", border: "1px solid #64748b", color: "var(--color-text-muted)" }}>archived</span>}
                          </span>
                          <div style={{ fontSize: 11, color: "var(--color-text-dim)", marginTop: 2 }}>
                            Age {s.age} · DOB {s.dob}
                            {s.pace_scy_100 && <span> · SCY {s.pace_scy_100}</span>}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          {teamName && (
                            <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 999, background: "#3b82f622", border: "1px solid var(--color-primary)", color: "var(--color-primary-text)", fontWeight: 700 }} title="Team affiliation">
                              {teamName}
                            </span>
                          )}
                          <MinorPill swimmer={s} />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      );
    }
