// src/components/teams/TeamSettingsTab.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { csrfHeaders } from "../../lib/api.js";
import { TeamFacilitiesSection } from "./TeamFacilitiesSection.jsx";
import { TeamCalendarFeed } from "./TeamCalendarFeed.jsx";
import { VisibleOptionsPanel } from "./VisibleOptionsPanel.jsx";
import { PaceProfileEditor } from "../pace/PaceProfileEditor.jsx";

    const { useState, useCallback, useEffect } = React;

    export function TeamSettingsTab({ teamId, viewerRole, archived, featureFlags }) {
      const canWrite = viewerRole === "owner" || viewerRole === "admin";
      const ff = featureFlags || {};   // Phase 6: gate the team-curation surface
      // fmtDate is defined inside several other components; keep this one
      // self-contained so we don't pull from a closure that won't exist.
      const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
      const [curation, setCuration] = React.useState(null);                   // { favorites, disfavorites }
      const [settings, setSettings] = React.useState(null);                   // { default_pace_base, default_disfavor_mode, default_equipment_modes }
      const [msg, setMsg]           = React.useState(null);
      const [newFav, setNewFav]     = React.useState("");
      const [newDisfav, setNewDisfav] = React.useState("");
      const [paceDraft, setPaceDraft] = React.useState("");                   // pending edit
      const [busy, setBusy]         = React.useState(false);
      const [teamCode, setTeamCode] = React.useState("");                     // team abbreviation (meet exports)
      const [teamCodeSaved, setTeamCodeSaved] = React.useState("");           // last persisted value
      // Ownership transfer (owner-only section).
      const [coaches, setCoaches]                 = React.useState([]);
      const [pendingTransfer, setPendingTransfer] = React.useState(null);
      const [transferTarget, setTransferTarget]   = React.useState("");
      const [transferBusy, setTransferBusy]       = React.useState(false);

      const load = React.useCallback(async () => {
        try {
          const [cRes, sRes, coRes, ptRes, tRes] = await Promise.all([
            fetch(`/api/teams/${teamId}/curation`, { cache: "no-store" }),
            fetch(`/api/teams/${teamId}/settings`, { cache: "no-store" }),
            fetch(`/api/teams/${teamId}/coaches`, { cache: "no-store" }),
            fetch(`/api/teams/${teamId}/pending-transfer`, { cache: "no-store" }),
            fetch(`/api/teams/${teamId}`, { cache: "no-store" }),
          ]);
          if (!cRes.ok) throw new Error(`curation HTTP ${cRes.status}`);
          if (!sRes.ok) throw new Error(`settings HTTP ${sRes.status}`);
          const c = await cRes.json();
          const s = await sRes.json();
          setCuration(c);
          setSettings(s);
          setPaceDraft(s.default_pace_base || "");
          if (tRes.ok) { try { const t = await tRes.json(); const tc = t.team_code || ""; setTeamCode(tc); setTeamCodeSaved(tc); } catch (_) {} }
          if (coRes.ok) { try { setCoaches(await coRes.json()); } catch (_) {} }
          if (ptRes.ok) { try { const pt = await ptRes.json(); setPendingTransfer(pt && pt.id ? pt : null); } catch (_) {} }
        } catch (e) {
          setMsg(`Error loading: ${e.message}`);
          setCuration({ favorites: [], disfavorites: [] });
          setSettings({ default_pace_base: null, default_disfavor_mode: null, default_equipment_modes: null });
        }
      }, [teamId]);
      React.useEffect(() => { load(); }, [load]);

      const addCuration = async (kind, label) => {
        const cleaned = (label || "").trim();
        if (!cleaned) return;
        setBusy(true); setMsg(null);
        try {
          const url = kind === "fav" ? `/api/teams/${teamId}/favorites` : `/api/teams/${teamId}/disfavorites`;
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({ label: cleaned }),
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) {
            // Surface mutex conflicts nicely (in_favorites / in_disfavorites)
            if (j.error === "in_favorites")     throw new Error(`"${cleaned}" is already a team favorite. Remove it there first.`);
            if (j.error === "in_disfavorites")  throw new Error(`"${cleaned}" is already a team disfavorite. Remove it there first.`);
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          if (kind === "fav") setNewFav(""); else setNewDisfav("");
          await load();
        } catch (e) { setMsg(`Add failed: ${e.message}`); }
        finally { setBusy(false); }
      };

      const removeCuration = async (kind, label) => {
        if (!window.confirm(`Remove "${label}" from team ${kind === "fav" ? "favorites" : "disfavorites"}?`)) return;
        setBusy(true); setMsg(null);
        try {
          const url = kind === "fav"
            ? `/api/teams/${teamId}/favorites/${encodeURIComponent(label)}`
            : `/api/teams/${teamId}/disfavorites/${encodeURIComponent(label)}`;
          const res = await fetch(url, { method: "DELETE", headers: csrfHeaders() });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          await load();
        } catch (e) { setMsg(`Remove failed: ${e.message}`); }
        finally { setBusy(false); }
      };

      const savePace = async () => {
        const value = paceDraft.trim() || null;
        if (value && !/^\d{1,2}:\d{2}$/.test(value)) { setMsg("Pace must look like 2:00."); return; }
        setBusy(true); setMsg(null);
        try {
          const res = await fetch(`/api/teams/${teamId}/settings`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({ pace_base: value }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          await load();
        } catch (e) { setMsg(`Save failed: ${e.message}`); }
        finally { setBusy(false); }
      };

      const saveTeamCode = async () => {
        const value = teamCode.trim().toUpperCase();
        if (value && !/^[A-Z0-9]{1,6}$/.test(value)) { setMsg("Team code must be 1–6 letters/numbers."); return; }
        setBusy(true); setMsg(null);
        try {
          const res = await fetch(`/api/teams/${teamId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({ team_code: value || null }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          setTeamCode(value); setTeamCodeSaved(value);
        } catch (e) { setMsg(`Save failed: ${e.message}`); }
        finally { setBusy(false); }
      };

      const saveMode = async (value) => {
        setBusy(true); setMsg(null);
        try {
          const res = await fetch(`/api/teams/${teamId}/settings`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({ disfavor_mode: value }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          await load();
        } catch (e) { setMsg(`Save failed: ${e.message}`); }
        finally { setBusy(false); }
      };

      const applyPaceToRoster = async () => {
        if (!settings?.default_pace_base) { setMsg("Set the team pace baseline before pushing it to the roster."); return; }
        const ok = window.confirm(
          `Push pace baseline "${settings.default_pace_base}" to every active swimmer in any group under this team?\n\n` +
          "This overwrites their existing pace. One-time action."
        );
        if (!ok) return;
        setBusy(true); setMsg(null);
        try {
          const res = await fetch(`/api/teams/${teamId}/settings/apply-to-roster`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({ field: "pace_base" }),
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
          setMsg(`✓ Pushed pace ${j.value} to ${j.count} swimmer${j.count === 1 ? "" : "s"}.`);
        } catch (e) { setMsg(`Apply failed: ${e.message}`); }
        finally { setBusy(false); }
      };

      const savePaceProfile = async (profile) => {
        setBusy(true); setMsg(null);
        try {
          const res = await fetch(`/api/teams/${teamId}/settings`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({ pace_profile: profile }),
          });
          if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `HTTP ${res.status}`); }
          await load();
          setMsg("✓ Saved team pace profile.");
        } catch (e) { setMsg(`Save failed: ${e.message}`); }
        finally { setBusy(false); }
      };

      const applyPaceProfileToRoster = async () => {
        if (!settings?.default_pace_profile) { setMsg("Save a team pace profile before pushing it."); return; }
        if (!window.confirm("Push this pace profile to every active swimmer in any group under this team?\n\nThis overwrites their existing profile. One-time action.")) return;
        setBusy(true); setMsg(null);
        try {
          const res = await fetch(`/api/teams/${teamId}/settings/apply-to-roster`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({ field: "pace_profile" }),
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
          setMsg(`✓ Pushed pace profile to ${j.count} swimmer${j.count === 1 ? "" : "s"}.`);
        } catch (e) { setMsg(`Apply failed: ${e.message}`); }
        finally { setBusy(false); }
      };

      const proposeTransfer = async () => {
        if (!transferTarget) return;
        if (!window.confirm("Propose this admin as the new team owner? They get 30 days to accept (or it auto-applies); you can cancel anytime before then. You'll become an admin and your team-shared + public sets move to them.")) return;
        setTransferBusy(true); setMsg(null);
        try {
          const res = await fetch(`/api/teams/${teamId}/transfer-ownership`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({ to_sub: transferTarget }),
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
          setTransferTarget("");
          await load();
        } catch (e) { setMsg(`Transfer failed: ${e.message}`); }
        finally { setTransferBusy(false); }
      };

      const cancelTransfer = async () => {
        if (!window.confirm("Cancel the pending ownership transfer?")) return;
        setTransferBusy(true); setMsg(null);
        try {
          const res = await fetch(`/api/teams/${teamId}/transfer-ownership/cancel`, { method: "POST", headers: csrfHeaders() });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
          await load();
        } catch (e) { setMsg(`Cancel failed: ${e.message}`); }
        finally { setTransferBusy(false); }
      };

      if (curation === null || settings === null) {
        return <div style={{ color: "var(--color-text-dim)", fontSize: 12, padding: 12 }}>Loading team settings…</div>;
      }

      const renderCurationList = (kind, items, accent) => (
        <div style={{ marginBottom: 12 }}>
          {items.length === 0 ? (
            <div style={{ color: "var(--color-text-dim)", fontSize: 12, fontStyle: "italic", padding: "6px 0" }}>
              No team {kind === "fav" ? "favorites" : "disfavorites"} set.
            </div>
          ) : (
            items.map(it => (
              <div key={it.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderBottom: "1px solid var(--color-border)", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "var(--color-text)", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</div>
                  <div style={{ color: "var(--color-text-dim)", fontSize: 10, marginTop: 2 }}>
                    set by <span style={{ fontFamily: "monospace" }}>{(it.set_by_coach_sub || "").slice(-8)}</span> · {fmtDate(it.created_at)}
                  </div>
                </div>
                {canWrite && !archived && (
                  <button onClick={() => removeCuration(kind, it.label)} disabled={busy}
                    title="Remove from team list"
                    style={{ padding: "3px 8px", background: "transparent", border: "1px solid var(--color-destructive)", borderRadius: 5, color: "var(--color-destructive-text)", fontSize: 11, cursor: busy ? "not-allowed" : "pointer" }}>
                    ×
                  </button>
                )}
              </div>
            ))
          )}
          {canWrite && !archived && (
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <input value={kind === "fav" ? newFav : newDisfav}
                onChange={e => kind === "fav" ? setNewFav(e.target.value) : setNewDisfav(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") addCuration(kind, kind === "fav" ? newFav : newDisfav); }}
                placeholder={`Add team ${kind === "fav" ? "favorite" : "disfavorite"} (e.g. "4 × 200 IM")`}
                style={{ flex: 1, padding: "6px 9px", fontSize: 12, background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 5 }} />
              <button onClick={() => addCuration(kind, kind === "fav" ? newFav : newDisfav)} disabled={busy}
                style={{ padding: "6px 12px", background: accent, color: "var(--color-bg)", border: "none", borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer" }}>
                + Add
              </button>
            </div>
          )}
        </div>
      );

      return (
        <div className="card" style={{ borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <h3 style={{ color: "var(--color-text)", marginTop: 0, fontSize: 15 }}>
            ⚙ Team Settings
            {!canWrite && (
              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: "var(--color-text-dim)" }}>(read-only — owner + admin can edit)</span>
            )}
          </h3>

          {/* Phase 6 — Team Option Visibility: hide surfaces to simplify the app. */}
          <VisibleOptionsPanel teamId={teamId} canWrite={canWrite} />

          {/* Team calendar feed — shareable live-subscribe .ics (team events +
              practices for the team's groups). Visible to any member; only
              owner/admin can rotate the token. */}
          <TeamCalendarFeed teamId={teamId} canManage={canWrite} />

          {/* Team code / abbreviation — used as the "Team Name" column in meet-entry
              (Hy-Tek) roster exports. Owner-only (matches the rename route). */}
          {viewerRole === "owner" && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ color: "var(--color-primary-text)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                🏷 Team code (meet-entry abbreviation)
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <input value={teamCode}
                  onChange={e => setTeamCode(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase())}
                  onKeyDown={e => { if (e.key === "Enter") saveTeamCode(); }}
                  placeholder="e.g. WSU" maxLength={6}
                  style={{ width: 110, padding: "6px 9px", fontSize: 13, fontFamily: "monospace", letterSpacing: "0.05em", background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 5 }} />
                <button onClick={saveTeamCode} disabled={busy || teamCode.trim().toUpperCase() === teamCodeSaved}
                  style={{ padding: "6px 12px", background: (busy || teamCode.trim().toUpperCase() === teamCodeSaved) ? "var(--color-border)" : "var(--color-primary)", color: "#fff", border: "none", borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: (busy || teamCode.trim().toUpperCase() === teamCodeSaved) ? "not-allowed" : "pointer" }}>
                  Save
                </button>
                <span style={{ fontSize: 11, color: "var(--color-text-dim)" }}>1–6 letters/numbers. Falls back to the team name in exports when empty.</span>
              </div>
            </div>
          )}

          {ff.curation !== false && (<>
          <div style={{ marginBottom: 18 }}>
            <div style={{ color: "var(--color-positive)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
              ⭐ Team Favorites ({curation.favorites.length})
            </div>
            {renderCurationList("fav", curation.favorites, "var(--color-positive)")}
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={{ color: "var(--color-destructive-text)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
              👎 Team Disfavorites ({curation.disfavorites.length})
            </div>
            {renderCurationList("disfav", curation.disfavorites, "var(--color-destructive)")}
          </div>
          </>)}

          <TeamFacilitiesSection teamId={teamId} canWrite={canWrite && !archived} />

          {viewerRole === "owner" && (
            <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 14, marginTop: 6, marginBottom: 18 }}>
              <div style={{ color: "var(--color-warn)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                Ownership
              </div>
              {pendingTransfer ? (
                <div style={{ background: "#f59e0b18", border: "1px solid var(--color-warn)", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ color: "var(--color-text)", fontSize: 13, fontWeight: 600 }}>⏳ Transfer in progress</div>
                  <div style={{ color: "var(--color-text-muted)", fontSize: 12, marginTop: 4 }}>
                    You proposed <span style={{ fontFamily: "monospace" }}>{(pendingTransfer.to_sub || "").slice(-8)}</span> as the new owner. Auto-completes {fmtDate(pendingTransfer.auto_complete_at)}.
                  </div>
                  {!archived && (
                    <button onClick={cancelTransfer} disabled={transferBusy}
                      style={{ marginTop: 8, padding: "5px 12px", background: "transparent", border: "1px solid var(--color-destructive)", borderRadius: 5, color: "var(--color-destructive-text)", fontSize: 12, fontWeight: 700, cursor: transferBusy ? "not-allowed" : "pointer" }}>
                      {transferBusy ? "Working…" : "Cancel transfer"}
                    </button>
                  )}
                </div>
              ) : (() => {
                const admins = (coaches || []).filter(c => c.role === "admin");
                return (
                  <div>
                    <p style={{ color: "var(--color-text-dim)", fontSize: 11, margin: "0 0 8px", lineHeight: 1.5 }}>
                      Hand the team off to an existing admin. They get a 30-day window to accept (or it auto-applies); you become an admin and your team-shared + public sets move to them.
                    </p>
                    {admins.length === 0 ? (
                      <div style={{ color: "var(--color-text-dim)", fontSize: 12, fontStyle: "italic" }}>
                        No admins to transfer to — promote a coach to admin first (Members &amp; Coaches tab).
                      </div>
                    ) : !archived ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <select value={transferTarget} onChange={e => setTransferTarget(e.target.value)}
                          style={{ flex: 1, padding: "6px 9px", fontSize: 12, background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 5 }}>
                          <option value="">— pick an admin —</option>
                          {admins.map(a => <option key={a.coach_sub} value={a.coach_sub}>{a.display_name || a.coach_sub.slice(-8)}</option>)}
                        </select>
                        <button onClick={proposeTransfer} disabled={!transferTarget || transferBusy}
                          style={{ padding: "6px 12px", background: (!transferTarget || transferBusy) ? "var(--color-border)" : "var(--color-warn)", color: (!transferTarget || transferBusy) ? "#cbd5e1" : "var(--color-bg)", border: "none", borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: (!transferTarget || transferBusy) ? "not-allowed" : "pointer" }}>
                          Transfer →
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })()}
            </div>
          )}

          {ff.curation !== false && (
          <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 14, marginTop: 6 }}>
            <div style={{ color: "var(--color-primary-text)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
              Team Defaults
            </div>
            <p style={{ color: "var(--color-text-dim)", fontSize: 11, margin: "0 0 12px", lineHeight: 1.5, fontStyle: "italic" }}>
              Defaults apply when a brand-new swimmer joins a group on this team. Use "Push to roster" to apply to your current swimmers (one-time).
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr auto", gap: 10, alignItems: "center", marginBottom: 10 }}>
              <label style={{ color: "var(--color-text-muted)", fontSize: 12, fontWeight: 600 }}>Pace baseline</label>
              {canWrite && !archived ? (
                <input value={paceDraft}
                  onChange={e => setPaceDraft(e.target.value)}
                  placeholder="e.g. 2:00"
                  style={{ padding: "6px 9px", fontSize: 13, background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 5 }} />
              ) : (
                <span style={{ color: "var(--color-text)", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{settings.default_pace_base || "—"}</span>
              )}
              {canWrite && !archived && (
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={savePace} disabled={busy || paceDraft === (settings.default_pace_base || "")}
                    style={{ padding: "6px 12px", background: (busy || paceDraft === (settings.default_pace_base || "")) ? "var(--color-border)" : "var(--color-primary)", color: (busy || paceDraft === (settings.default_pace_base || "")) ? "#cbd5e1" : "#fff", border: "none", borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: (busy || paceDraft === (settings.default_pace_base || "")) ? "not-allowed" : "pointer" }}>
                    Save
                  </button>
                  <button onClick={applyPaceToRoster} disabled={busy || !settings.default_pace_base}
                    title={settings.default_pace_base ? "Push to every active swimmer in every group under this team (one-time, overwrites)" : "Set + save a pace first"}
                    style={{ padding: "6px 12px", background: "transparent", border: "1px solid var(--color-warn)", borderRadius: 5, color: "var(--color-warn)", fontSize: 12, fontWeight: 700, cursor: (busy || !settings.default_pace_base) ? "not-allowed" : "pointer" }}>
                    Push to roster
                  </button>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ color: "var(--color-text-muted)", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                Pace profile <span style={{ color: "var(--color-text-dim)", fontWeight: 400 }}>— stroke pacing (masters/youth swim non-free strokes slower)</span>
              </label>
              <PaceProfileEditor
                value={settings.default_pace_profile}
                onSave={savePaceProfile}
                busy={busy}
                readOnly={!(canWrite && !archived)}
                extraButton={canWrite && !archived ? (
                  <button onClick={applyPaceProfileToRoster} disabled={busy || !settings.default_pace_profile}
                    title={settings.default_pace_profile ? "Push to every active swimmer in every group under this team (one-time, overwrites)" : "Save a profile first"}
                    style={{ padding: "6px 12px", background: "transparent", border: "1px solid var(--color-warn)", borderRadius: 5, color: "var(--color-warn)", fontSize: 12, fontWeight: 700, cursor: (busy || !settings.default_pace_profile) ? "not-allowed" : "pointer" }}>
                    Push to roster
                  </button>
                ) : null}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr auto", gap: 10, alignItems: "center", marginBottom: 4 }}>
              <label style={{ color: "var(--color-text-muted)", fontSize: 12, fontWeight: 600 }}>Disfavor mode</label>
              {canWrite && !archived ? (
                <div style={{ display: "flex", gap: 4 }}>
                  {[
                    { id: "downweight", label: "Downweight (0.25×)" },
                    { id: "exclude",    label: "Exclude (hard)"   },
                  ].map(opt => {
                    const active = settings.default_disfavor_mode === opt.id;
                    return (
                      <button key={opt.id} onClick={() => saveMode(opt.id)} disabled={busy}
                        className="pill"
                        style={{
                          border: `1px solid ${active ? "var(--color-primary)" : "var(--color-border)"}`,
                          background: active ? "#3b82f622" : "transparent",
                          color: active ? "var(--color-primary)" : "var(--color-text-muted)",
                          fontSize: 11, cursor: busy ? "not-allowed" : "pointer",
                        }}>
                        {opt.label}
                      </button>
                    );
                  })}
                  {settings.default_disfavor_mode && (
                    <button onClick={() => saveMode(null)} disabled={busy}
                      title="Clear default"
                      style={{ padding: "3px 8px", background: "transparent", border: "1px solid var(--color-border-strong)", borderRadius: 5, color: "var(--color-text-muted)", fontSize: 11, cursor: busy ? "not-allowed" : "pointer" }}>
                      Clear
                    </button>
                  )}
                </div>
              ) : (
                <span style={{ color: "var(--color-text)", fontSize: 13 }}>{settings.default_disfavor_mode || "—"}</span>
              )}
              <div />
            </div>

            <div style={{ color: "var(--color-text-dim)", fontSize: 11, marginTop: 10, fontStyle: "italic" }}>
              Equipment defaults + apply-to-roster for non-pace fields land in v1.1.
            </div>
          </div>
          )}

          {msg && <div style={{ color: msg.startsWith("✓") ? "var(--color-positive)" : "var(--color-warn)", fontSize: 12, marginTop: 12, padding: "8px 10px", background: msg.startsWith("✓") ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.12)", borderRadius: 5 }}>{msg}</div>}
        </div>
      );
    }
