// src/components/profile/ProfileModal.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { csrfHeaders } from "../../lib/api.js";
import { GOAL_METRICS, LEVEL_PRESETS } from "../../lib/constants.js";
import { AddressManager } from "../people/AddressManager.jsx";
import { ClaimManagedSection } from "../people/ClaimManagedSection.jsx";
import { COOLDOWN_OPTIONS, DRILL_OPTIONS, MAIN_OPTIONS, WARMUP_OPTIONS, PHASES } from "../../lib/engine.js";
import { BenchmarksSection } from "./BenchmarksSection.jsx";
import { EditableProfileField } from "./EditableProfileField.jsx";
import { GoalRow } from "./GoalRow.jsx";
import { JoinGroupSection } from "./JoinGroupSection.jsx";
import { TeamCalendarDownload } from "../teams/TeamCalendarDownload.jsx";
import { LevelRow } from "./LevelRow.jsx";
import { NextEventRow } from "./NextEventRow.jsx";
import { PhaseRow } from "./PhaseRow.jsx";
import { ProfileActiveConstraintsSection } from "./ProfileActiveConstraintsSection.jsx";
import { ProfileGenderRow } from "./ProfileGenderRow.jsx";

    const { useState, useCallback, useEffect } = React;

    export function ProfileModal({ onClose, onProfileChange, onPaceUpdate, authMode, onSendFeedback, onStartTour, appEffectiveMe, appViewAsRole, appSetViewAsRole, appViewAsParent, appSetViewAsParent, appMe, appGoals, appFavorites, appDisfavorites, appFavoriteSets, appDisfavorSets, appMyConstraints, appSessions, appTeamDefaults, appBillingStatus, appLevel, appNextEvent, appPhase, appDisfavorMode, appEngineDisfavorites, appEngineFavorites }) {
      // Burst-mitigation B — seed ALL local state from App-level props.
      // /api/me/bootstrap returns everything ProfileModal needs (sessions +
      // team-defaults + billing-status added in B). loadAll's Promise.all is
      // now empty; only billing-history + coach-impact remain as on-demand
      // fetches (sequenced post-mount, not part of the open burst).
      const [me, setMe]             = React.useState(() => appMe || null);
      const [sessions, setSessions] = React.useState(() => Array.isArray(appSessions) ? appSessions : []);
      const [goals, setGoals]       = React.useState(() => Array.isArray(appGoals) ? appGoals : []);
      const [nextEvent, setNextEventLocal] = React.useState(() => appNextEvent || null);
      const [phase, setPhaseLocal]  = React.useState(() => appPhase || null);
      const [level, setLevelLocal]  = React.useState(() => appLevel || null);
      const [loading, setLoading]   = React.useState(true);
      const [revoking, setRevoking] = React.useState(false);
      const [revokeMsg, setRevokeMsg] = React.useState(null);
      // v1.4 — disfavorites audit panel
      const [bankDisfavorites, setBankDisfavorites] = React.useState(() =>
        Array.isArray(appDisfavorites) ? appDisfavorites : []);
      const [engineDisfavoritesLocal, setEngineDisfavoritesLocal] = React.useState(() =>
        Array.isArray(appEngineDisfavorites) ? appEngineDisfavorites : []);
      // v1.10 — set-level disfavorites for the audit panel — seeded from
      // App-level disfavorSets (Set), which arrived via bootstrap.
      const [setDisfavoritesLocal, setSetDisfavoritesLocal] = React.useState(() =>
        appDisfavorSets instanceof Set ? Array.from(appDisfavorSets) : []);
      // v1.12 — favorites audit (parallel of disfavor panel)
      const [bankFavoritesLocal, setBankFavoritesLocal] = React.useState(() =>
        Array.isArray(appFavorites) ? appFavorites : []);
      const [setFavoritesLocal, setSetFavoritesLocal] = React.useState(() =>
        appFavoriteSets instanceof Set ? Array.from(appFavoriteSets) : []);
      // v1.13 — engine favorites in the audit panel (mirror of v1.4 engine disfavorites)
      const [engineFavoritesLocal, setEngineFavoritesLocal] = React.useState(() =>
        Array.isArray(appEngineFavorites) ? appEngineFavorites : []);
      // v3.0 — coach curation impact (last 30 days, aggregate counts)
      const [impactData, setImpactData] = React.useState(null);
      // Billing v1 — subscription status + history. Status reads users.tier
      // (always safe). History reads billing_history (empty until first
      // invoice arrives via Stripe webhook).
      const [billingStatus,  setBillingStatus]  = React.useState(() => appBillingStatus || null);
      const [billingHistory, setBillingHistory] = React.useState([]);
      const [billingBusy,    setBillingBusy]    = React.useState(false);
      const [billingMsg,     setBillingMsg]     = React.useState(null);
      // v1.8 — disfavor mode: "downweight" (default 0.25×) or "exclude" (weight 0)
      const [disfavorModeLocal, setDisfavorModeLocal] = React.useState(() =>
        (appDisfavorMode === "downweight" || appDisfavorMode === "exclude") ? appDisfavorMode : "downweight");
      // Team Curation v1 slice 5 — defaults inherited from any team the user is in.
      // Array of { team_id, team_name, default_pace_base, default_disfavor_mode, default_equipment_modes }.
      const [teamDefaults, setTeamDefaults] = React.useState(() =>
        Array.isArray(appTeamDefaults) ? appTeamDefaults : []);
      // Profile cleanup 2026-05-28 — ProfileModal had grown to ~14 sections in
      // one scroll; split into 3 tabs (Account / Curation / Subscription).
      // Default tab is Account; persists across re-opens via localStorage so
      // a user who lives in the Curation tab stays there.
      const [tab, setTab] = React.useState(() => {
        try { return localStorage.getItem("profileTab") || "account"; }
        catch (_) { return "account"; }
      });
      React.useEffect(() => {
        try { localStorage.setItem("profileTab", tab); } catch (_) {}
      }, [tab]);

      const loadAll = React.useCallback(async () => {
        // Burst mitigation B — every section ProfileModal needs that's
        // available pre-open arrives via /api/me/bootstrap (which already
        // ran before the user opened the modal). Local state is seeded from
        // the App props in the useState initializers above. loadAll's
        // Promise.all is now empty. Only two on-demand fetches remain,
        // sequenced one tick apart so they don't form a burst:
        //   - billing-history: subscription invoices (rarely non-empty;
        //     loaded only because the Subscription panel shows them inline).
        //   - coach-impact: 30-day curation reach + effectiveness, coach-only.
        // Both are best-effort; failures don't block the modal.
        setLoading(true);
        try {
          if (appEffectiveMe ? appEffectiveMe.is_coach : appMe?.is_coach) {
            fetch("/api/coach/curation-impact", { cache: "no-store" })
              .then(r => r.ok ? r.json() : null)
              .then(d => { if (d) setImpactData(d); })
              .catch(() => {});
          }
          fetch("/api/billing/history?limit=5", { cache: "no-store" })
            .then(r => r.ok ? r.json() : [])
            .then(d => { if (Array.isArray(d)) setBillingHistory(d); })
            .catch(() => {});
        } finally {
          setLoading(false);
        }
      }, []);

      // v1.4 — remove a bank disfavorite (DELETE /api/disfavorites/:label)
      const handleRemoveBankDisfavorite = async (label) => {
        const prev = bankDisfavorites;
        setBankDisfavorites(prev.filter(l => l !== label));
        try {
          await fetch(`/api/disfavorites/${encodeURIComponent(label)}`, {
            method: "DELETE",
            headers: { ...csrfHeaders() },
          });
          // Tell the parent app to refresh its local mirror via window event
          // (ProfileModal is self-contained; the App's disfavorites array
          // re-fetches on profile-change events).
          if (onProfileChange) onProfileChange();
        } catch (_) {
          setBankDisfavorites(prev);
        }
      };

      // v1.8 — switch disfavor mode (downweight ↔ exclude). POSTs to
      // settings.extra and notifies the parent App via onProfileChange so
      // its own disfavorMode state refreshes (which the picker reads).
      const handleSetDisfavorMode = async (mode) => {
        if (mode !== "downweight" && mode !== "exclude") return;
        const prev = disfavorModeLocal;
        setDisfavorModeLocal(mode);
        try {
          await fetch("/api/settings/extra", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({ disfavor_mode: mode }),
          });
          if (onProfileChange) onProfileChange();
        } catch (_) {
          setDisfavorModeLocal(prev);
        }
      };

      // v1.10 — remove a set-level disfavorite (DELETE /api/disfavor-sets/:setId)
      const handleRemoveSetDisfavorite = async (setId) => {
        const prev = setDisfavoritesLocal;
        setSetDisfavoritesLocal(prev.filter(s => s !== setId));
        try {
          await fetch(`/api/disfavor-sets/${encodeURIComponent(setId)}`, {
            method: "DELETE",
            headers: { ...csrfHeaders() },
          });
          if (onProfileChange) onProfileChange();
        } catch (_) {
          setSetDisfavoritesLocal(prev);
        }
      };

      // v1.10 — context lookup: find an option that contains the given
      // set_id, returning { label, desc } for the audit panel display.
      // Scans MAIN/DRILL/WARMUP/COOLDOWN_OPTIONS (global script constants).
      // Returns null if no match (orphaned set_id — bank evolution).
      const lookupSetContext = (setId) => {
        if (!setId) return null;
        // Phase H Stage 2: all bank constants are flat arrays.
        const banks = [
          typeof MAIN_OPTIONS     !== "undefined" ? MAIN_OPTIONS     : null,
          typeof DRILL_OPTIONS    !== "undefined" ? DRILL_OPTIONS    : null,
          typeof WARMUP_OPTIONS   !== "undefined" ? WARMUP_OPTIONS   : null,
          typeof COOLDOWN_OPTIONS !== "undefined" ? COOLDOWN_OPTIONS : null,
        ];
        for (const arr of banks) {
          if (!Array.isArray(arr)) continue;
          for (const opt of arr) {
            if (!opt || !Array.isArray(opt.sets)) continue;
            for (const s of opt.sets) {
              if (s && s.id === setId) {
                return { label: opt.label, desc: s.desc, dist: s.dist, reps: s.reps };
              }
            }
          }
        }
        return null;
      };

      // v1.4 — remove an engine disfavorite (rewrite engine_disfavorites array)
      const handleRemoveEngineDisfavorite = async (template_id, stroke) => {
        const prev = engineDisfavoritesLocal;
        const next = prev.filter(e => !(e.template_id === template_id && e.stroke === stroke));
        setEngineDisfavoritesLocal(next);
        try {
          await fetch("/api/settings/extra", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({ engine_disfavorites: next }),
          });
          if (onProfileChange) onProfileChange();
        } catch (_) {
          setEngineDisfavoritesLocal(prev);
        }
      };

      // v1.13 — remove an engine favorite (rewrite engine_favorites array)
      const handleRemoveEngineFavorite = async (template_id, stroke) => {
        const prev = engineFavoritesLocal;
        const next = prev.filter(e => !(e.template_id === template_id && e.stroke === stroke));
        setEngineFavoritesLocal(next);
        try {
          await fetch("/api/settings/extra", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({ engine_favorites: next }),
          });
          if (onProfileChange) onProfileChange();
        } catch (_) {
          setEngineFavoritesLocal(prev);
        }
      };

      // v1.12 — remove a bank favorite (DELETE /api/favorites/:label)
      const handleRemoveBankFavorite = async (label) => {
        const prev = bankFavoritesLocal;
        setBankFavoritesLocal(prev.filter(l => l !== label));
        try {
          await fetch(`/api/favorites/${encodeURIComponent(label)}`, {
            method: "DELETE",
            headers: { ...csrfHeaders() },
          });
          if (onProfileChange) onProfileChange();
        } catch (_) {
          setBankFavoritesLocal(prev);
        }
      };

      // v1.12 — remove a set-level favorite (DELETE /api/favorite-sets/:id)
      const handleRemoveSetFavorite = async (setId) => {
        const prev = setFavoritesLocal;
        setSetFavoritesLocal(prev.filter(s => s !== setId));
        try {
          await fetch(`/api/favorite-sets/${encodeURIComponent(setId)}`, {
            method: "DELETE",
            headers: { ...csrfHeaders() },
          });
          if (onProfileChange) onProfileChange();
        } catch (_) {
          setSetFavoritesLocal(prev);
        }
      };

      React.useEffect(() => { loadAll(); }, [loadAll]);

      const handleSignoutOthers = async () => {
        setRevoking(true); setRevokeMsg(null);
        try {
          const res = await fetch("/api/auth/signout-all-others", {
            method: "POST",
            headers: { ...csrfHeaders() },
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            setRevokeMsg(`Signed out ${data.revoked} other session(s).`);
            await loadAll();
          } else {
            setRevokeMsg(`Error: ${data.error || res.status}`);
          }
        } catch (err) {
          setRevokeMsg(`Error: ${err.message}`);
        } finally {
          setRevoking(false);
        }
      };

      const handleSaveGoal = async (metric, targetValue) => {
        const v = parseInt(targetValue, 10);
        if (!v || v <= 0) return;
        const res = await fetch("/api/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ metric, target_value: v }),
        });
        if (res.ok) {
          setGoals(prev => {
            const without = prev.filter(g => g.metric !== metric);
            return [...without, { metric, target_value: v }];
          });
        }
      };

      const handleDeleteGoal = async (metric) => {
        const res = await fetch(`/api/goals/${encodeURIComponent(metric)}`, {
          method: "DELETE",
          headers: { ...csrfHeaders() },
        });
        if (res.ok) {
          setGoals(prev => prev.filter(g => g.metric !== metric));
        }
      };

      const handleSaveNextEvent = async (name, date) => {
        const trimmed = (name || "").trim();
        if (!trimmed || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
        const res = await fetch("/api/settings/extra", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ next_event: { name: trimmed, date } }),
        });
        if (res.ok) {
          setNextEventLocal({ name: trimmed, date });
          if (onProfileChange) onProfileChange();
          return true;
        }
        return false;
      };

      const handleClearNextEvent = async () => {
        const res = await fetch("/api/settings/extra", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ next_event: null }),
        });
        if (res.ok) {
          setNextEventLocal(null);
          if (onProfileChange) onProfileChange();
        }
      };

      // N5: set or clear the training phase. Null = cleared (no phase bias).
      const handleSetPhase = async (phaseId) => {
        const value = phaseId && PHASES[phaseId] ? phaseId : null;
        const res = await fetch("/api/settings/extra", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ phase: value }),
        });
        if (res.ok) {
          setPhaseLocal(value);
          if (onProfileChange) onProfileChange();
        }
      };

      // J: set or clear the swimmer level. Picking a level also overwrites
      // paceInput with that level's preset pace (handled via onPaceUpdate
      // callback up to App). LevelRow's onChange passes (id, pace) — when
      // clearing (id===null), pace is null too and we don't touch paceInput.
      const handleSetLevel = async (levelId, presetPace) => {
        const value = levelId && LEVEL_PRESETS[levelId] ? levelId : null;
        const res = await fetch("/api/settings/extra", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ level: value }),
        });
        if (res.ok) {
          setLevelLocal(value);
          if (value && presetPace && onPaceUpdate) onPaceUpdate(presetPace);
          if (onProfileChange) onProfileChange();
        }
      };

      const handleRevokeOne = async (prefix) => {
        setRevokeMsg(null);
        try {
          const res = await fetch(`/api/auth/sessions/${encodeURIComponent(prefix)}`, {
            method: "DELETE",
            headers: { ...csrfHeaders() },
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            setRevokeMsg(`Revoked session ${prefix}…`);
            await loadAll();
          } else {
            setRevokeMsg(`Error: ${data.error || res.status}`);
          }
        } catch (err) {
          setRevokeMsg(`Error: ${err.message}`);
        }
      };

      const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
      const fmtTime = (d) => d ? new Date(d).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" }) : "—";
      const poolLabel = (m) => ({ "25y": "SCY (25y)", "25m": "SCM (25m)", "50m": "LCM (50m)", "yds": "SCY (legacy)" })[m] || m;
      const poolUnit  = (m) => (m === "50m" || m === "25m") ? "m" : "yds";

      return (
        <div className="modal-overlay" style={{ padding: 16 }} onClick={onClose}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 12,
            maxWidth: 560, width: "100%", maxHeight: "85vh", overflowY: "auto",
            color: "#cbd5e1",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--color-border)" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)" }}>👤 Profile</div>
              <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", color: "var(--color-text-muted)", fontSize: 20, cursor: "pointer", padding: 4 }}>✕</button>
            </div>

            {/* Tab bar — Account / Curation / Subscription. Render only when
                me is loaded so the loading/error states stay clean. */}
            {!loading && me && (() => {
              const tabBtn = (id, label) => (
                <button onClick={() => setTab(id)} key={id}
                  style={{
                    flex: 1, padding: "10px 0", border: "none",
                    background: tab === id ? "var(--color-card)" : "transparent",
                    color: tab === id ? "var(--color-primary)" : "var(--color-text-muted)",
                    borderBottom: tab === id ? "2px solid var(--color-primary)" : "2px solid transparent",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                    transition: "color 120ms, border-color 120ms",
                  }}>
                  {label}
                </button>
              );
              return (
                <div style={{ display: "flex", borderBottom: "1px solid var(--color-border)" }}>
                  {tabBtn("account",      "Account")}
                  {tabBtn("curation",     "Curation")}
                  {tabBtn("subscription", "Subscription")}
                </div>
              );
            })()}

            {loading ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-dim)" }}>Loading…</div>
            ) : !me ? (
              <div style={{ padding: 40, textAlign: "center", color: "#f87171" }}>Could not load profile.</div>
            ) : (
              <>
                {tab === "account" && (
                <div style={{ padding: "18px 20px" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Identity</div>
                  <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                    <EditableProfileField
                      label="Name"
                      value={me.display_name}
                      placeholder="Your name (used to personalize the app)"
                      maxLength={120}
                      onSave={async (v) => {
                        const res = await fetch("/api/me", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json", ...csrfHeaders() },
                          body: JSON.stringify({ display_name: v }),
                        });
                        if (!res.ok) {
                          const body = await res.json().catch(() => ({}));
                          throw new Error(body.error || `HTTP ${res.status}`);
                        }
                        setMe(prev => prev ? { ...prev, display_name: v || null } : prev);
                        if (onProfileChange) onProfileChange();
                      }} />
                    <EditableProfileField
                      label="Initials"
                      value={me.initials}
                      placeholder="Up to 8 characters"
                      maxLength={8}
                      transform={(v) => v.toUpperCase()}
                      onSave={async (v) => {
                        const res = await fetch("/api/me", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json", ...csrfHeaders() },
                          body: JSON.stringify({ initials: v }),
                        });
                        if (!res.ok) {
                          const body = await res.json().catch(() => ({}));
                          throw new Error(body.error || `HTTP ${res.status}`);
                        }
                        setMe(prev => prev ? { ...prev, initials: v || null } : prev);
                        if (onProfileChange) onProfileChange();
                      }} />
                    <EditableProfileField
                      label="Email"
                      type="email"
                      value={me.email}
                      placeholder="you@example.com"
                      badge={me.email_verified ? <span style={{ color: "#10b981", fontSize: 11, marginLeft: 4 }}>✓ verified</span> : null}
                      onSave={async (v) => {
                        const res = await fetch("/api/me", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json", ...csrfHeaders() },
                          body: JSON.stringify({ email: v }),
                        });
                        if (!res.ok) {
                          const body = await res.json().catch(() => ({}));
                          throw new Error(body.error || `HTTP ${res.status}`);
                        }
                        setMe(prev => prev ? { ...prev, email: v || null, email_verified: (v === prev.email) ? prev.email_verified : false } : prev);
                        if (onProfileChange) onProfileChange();
                      }} />
                    {/* Gender — custom row (EditableProfileField is input-only,
                        gender needs a select). Saves through the same PATCH /api/me. */}
                    <ProfileGenderRow me={me} setMe={setMe} onProfileChange={onProfileChange} />
                    {/* Class year (graduation year). Grade is derived server-side
                        from class_year, shown as a read-only badge. */}
                    <EditableProfileField
                      label="Class year"
                      value={me.class_year ? String(me.class_year) : ""}
                      placeholder="Graduation year, e.g. 2027"
                      maxLength={4}
                      transform={(v) => v.replace(/\D/g, "").slice(0, 4)}
                      badge={me.grade != null ? <span style={{ color: "var(--color-text-dim)", fontSize: 11, marginLeft: 4 }}>{me.grade >= 1 && me.grade <= 12 ? `Grade ${me.grade}` : me.grade > 12 ? "Graduated" : "Pre-HS"}</span> : null}
                      onSave={async (v) => {
                        const res = await fetch("/api/me", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json", ...csrfHeaders() },
                          body: JSON.stringify({ class_year: v === "" ? null : Number(v) }),
                        });
                        if (!res.ok) {
                          const body = await res.json().catch(() => ({}));
                          throw new Error(body.error || `HTTP ${res.status}`);
                        }
                        setMe(prev => prev ? { ...prev, class_year: v === "" ? null : Number(v) } : prev);
                        if (onProfileChange) onProfileChange();
                      }} />
                    <EditableProfileField
                      label="USA-S ID"
                      value={me.usa_swimming_id}
                      placeholder="USA Swimming member ID (optional)"
                      maxLength={255}
                      onSave={async (v) => {
                        const res = await fetch("/api/me", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json", ...csrfHeaders() },
                          body: JSON.stringify({ usa_swimming_id: v === "" ? null : v }),
                        });
                        if (!res.ok) {
                          const body = await res.json().catch(() => ({}));
                          throw new Error(body.error || `HTTP ${res.status}`);
                        }
                        setMe(prev => prev ? { ...prev, usa_swimming_id: v || null } : prev);
                        if (onProfileChange) onProfileChange();
                      }} />
                    {me?.sub && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--color-card)" }}>
                        <AddressManager swimmerRef={me.sub} showConsent={true} />
                      </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px", marginTop: 4 }}>
                      <span style={{ color: "var(--color-text-dim)" }}>Member since:</span>
                      <span style={{ color: "var(--color-text)" }}>{fmtDate(me.created_at)}</span>
                      <span style={{ color: "var(--color-text-dim)" }}>Last login:</span>
                      <span style={{ color: "var(--color-text)" }}>{fmtTime(me.last_login_at)}</span>
                      {appEffectiveMe?.is_admin && (<>
                        <span style={{ color: "var(--color-text-dim)" }}>Role:</span>
                        <span style={{ color: "var(--color-primary)", fontWeight: 700 }}>Admin</span>
                      </>)}
                    </div>
                    {/* R-F: join-group code redemption (visible to all
                        authenticated users; not coach-gated). */}
                    <JoinGroupSection me={me} setMe={setMe} onJoined={() => { if (onProfileChange) onProfileChange(); }} />
                    {/* R-I: claim a managed profile a coach created for you */}
                    <ClaimManagedSection me={me} setMe={setMe} onClaimed={() => { if (onProfileChange) onProfileChange(); }} />
                    {/* Team calendar — one-click .ics download for any team the user is in. */}
                    <TeamCalendarDownload />
                  </div>
                  {/* Setforge rebrand 2026-05-20 — Send feedback + Sign out
                      folded down from the top nav (REBRAND_SCOPE §8.1, §8.4). */}
                  <div style={{ display: "flex", gap: 8, marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--color-card)" }}>
                    {onSendFeedback && (
                      <button onClick={() => { onSendFeedback(); onClose(); }}
                        title="Send feedback or report a bug"
                        style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        💬 Send feedback
                      </button>
                    )}
                    {authMode === "apple" && (
                      <a href="/api/auth/signout" title="Sign out"
                        style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, textDecoration: "none" }}>
                        🚪 Sign out
                      </a>
                    )}
                  </div>
                  {onStartTour && (
                    <button onClick={() => { onClose(); onStartTour(); }}
                      title="Replay the quick walkthrough of the workout generator"
                      style={{ width: "100%", marginTop: 8, padding: "9px 12px", borderRadius: 8, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      👋 Take the tour
                    </button>
                  )}
                </div>

                )}

                {tab === "account" && (
                <div style={{ padding: "18px 20px", borderTop: "1px solid var(--color-card)" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Workouts</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 28, fontWeight: 900, color: "var(--color-text)" }}>{me.workout_count.toLocaleString()}</span>
                    <span style={{ fontSize: 11, color: "var(--color-text-dim)" }}>total saved</span>
                  </div>
                  {me.stats_by_pool.length > 0 && (
                    <div style={{ fontSize: 12, display: "grid", gap: 4 }}>
                      {me.stats_by_pool.map(s => (
                        <div key={s.pool_mode} style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--color-text-muted)" }}>{poolLabel(s.pool_mode)}</span>
                          <span style={{ color: "var(--color-text)" }}>{s.count.toLocaleString()} workouts · {s.total.toLocaleString()} {poolUnit(s.pool_mode)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                )}

                {tab === "account" && (
                <div style={{ padding: "18px 20px", borderTop: "1px solid var(--color-card)" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                    🎯 Goals
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {GOAL_METRICS.map(m => {
                      const existing = goals.find(g => g.metric === m.id);
                      return (
                        <GoalRow key={m.id} metric={m}
                          value={existing ? existing.target_value : null}
                          onSave={(v) => handleSaveGoal(m.id, v)}
                          onDelete={() => handleDeleteGoal(m.id)} />
                      );
                    })}
                    <NextEventRow value={nextEvent}
                      onSave={handleSaveNextEvent}
                      onClear={handleClearNextEvent} />
                    <PhaseRow value={phase} onChange={handleSetPhase} />
                    <LevelRow value={level} onChange={handleSetLevel} />
                    <BenchmarksSection onPaceUpdate={onPaceUpdate} />
                  </div>
                </div>
                )}

                {/* Phase 3 PSC slice 4 — read-only Active Constraints section.
                    Closes scope decision #8 (transparency): swimmer sees their
                    own constraints with set-by + expiry. Read-only — coach is
                    the write authority. */}
                {tab === "curation" && (
                  <ProfileActiveConstraintsSection constraints={appMyConstraints} />
                )}

                {/* v1.12 — Favorites audit panel. Mirrors the v1.4/v1.10
                    Disfavorites panel for favorites. Bank labels + set IDs
                    favorited by this user, with one-click remove. */}
                {tab === "curation" && (
                <div style={{ padding: "18px 20px", borderTop: "1px solid var(--color-card)" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                    Favorites ({bankFavoritesLocal.length + setFavoritesLocal.length + engineFavoritesLocal.length})
                  </div>
                  {bankFavoritesLocal.length === 0 && setFavoritesLocal.length === 0 && engineFavoritesLocal.length === 0 ? (
                    <div style={{ fontSize: 12, color: "var(--color-text-dim)", fontStyle: "italic" }}>
                      No favorites yet. Click ★ on any main-set in a workout, or use the ☆ button on a specific set, to boost pick weight.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      {bankFavoritesLocal.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                            Bank labels ({bankFavoritesLocal.length})
                          </div>
                          <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
                            {bankFavoritesLocal.map(label => (
                              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, padding: "6px 10px" }}>
                                <span style={{ color: "var(--color-text)" }}>★ {label}</span>
                                <button onClick={() => handleRemoveBankFavorite(label)}
                                  title="Remove from favorites"
                                  style={{ background: "transparent", border: "1px solid var(--color-border-strong)", borderRadius: 4, color: "var(--color-text-dim)", fontSize: 11, padding: "2px 8px", cursor: "pointer" }}>
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {engineFavoritesLocal.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                            Engine templates ({engineFavoritesLocal.length})
                          </div>
                          <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
                            {engineFavoritesLocal.map((e, i) => (
                              <div key={`${e.template_id}:${e.stroke}:${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, padding: "6px 10px" }}>
                                <span style={{ color: "var(--color-text)" }}>
                                  ★ <code style={{ fontSize: 11, color: "var(--color-warn)" }}>{e.template_id}</code>
                                  <span style={{ color: "var(--color-text-dim)", marginLeft: 6 }}>+ {e.stroke}</span>
                                </span>
                                <button onClick={() => handleRemoveEngineFavorite(e.template_id, e.stroke)}
                                  title="Remove from engine favorites"
                                  style={{ background: "transparent", border: "1px solid var(--color-border-strong)", borderRadius: 4, color: "var(--color-text-dim)", fontSize: 11, padding: "2px 8px", cursor: "pointer" }}>
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {setFavoritesLocal.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                            Sets ({setFavoritesLocal.length})
                          </div>
                          <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
                            {setFavoritesLocal.map((setId, i) => {
                              const ctx = lookupSetContext(setId);
                              return (
                                <div key={`${setId}:${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, padding: "6px 10px", gap: 10 }}>
                                  <span style={{ color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, flex: 1 }}>
                                    {ctx ? (
                                      <>
                                        <span>{ctx.reps > 1 ? `${ctx.reps}×${ctx.dist}` : `${ctx.dist}`}</span>
                                        <span style={{ color: "var(--color-text-dim)", margin: "0 6px" }}>·</span>
                                        <span style={{ color: "var(--color-text-dim)" }}>{(ctx.desc || "").slice(0, 80)}</span>
                                        <div style={{ fontSize: 10, color: "var(--color-text-dim)", marginTop: 2 }}>
                                          from <em>{ctx.label}</em> · <code>{setId}</code>
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <code style={{ fontSize: 11, color: "var(--color-warn)" }}>{setId}</code>
                                        <span style={{ color: "var(--color-text-dim)", marginLeft: 6, fontStyle: "italic", fontSize: 10 }}>(no longer in the bank)</span>
                                      </>
                                    )}
                                  </span>
                                  <button onClick={() => handleRemoveSetFavorite(setId)}
                                    title="Remove from set favorites"
                                    style={{ background: "transparent", border: "1px solid var(--color-border-strong)", borderRadius: 4, color: "var(--color-text-dim)", fontSize: 11, padding: "2px 8px", cursor: "pointer", flexShrink: 0 }}>
                                    Remove
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                )}

                {/* Billing v1 — Subscription section. Always visible to
                    authenticated users (swimmers see "Free", coaches see
                    Subscribe / Manage). Reads /api/billing/status which is
                    safe regardless of BILLING_ACTIVE. */}
                {tab === "subscription" && (
                <div style={{ padding: "18px 20px", borderTop: "1px solid var(--color-card)" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                    Subscription
                  </div>
                  {!billingStatus ? (
                    <div style={{ fontSize: 12, color: "var(--color-text-dim)", fontStyle: "italic" }}>Loading…</div>
                  ) : (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, color: "var(--color-text)" }}>Current tier:</span>
                        <span style={{
                          padding: "3px 10px", borderRadius: 4, fontSize: 12, fontWeight: 700,
                          background: billingStatus.tier === "free" ? "var(--color-border)" : "#0d9488",
                          color: billingStatus.tier === "free" ? "#cbd5e1" : "#fff",
                          textTransform: "capitalize",
                        }}>
                          {billingStatus.tier}
                        </span>
                        {billingStatus.tier_source === "admin_grant" && (
                          <span title="Comped by operator (no payment on file)" style={{ padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, background: "#7c3aed", color: "#fff" }}>
                            Comped
                          </span>
                        )}
                        {billingStatus.tier_granted_at && (
                          <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                            since {new Date(billingStatus.tier_granted_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      {billingStatus.tier === "free" && (
                        <div>
                          <div style={{ fontSize: 12, color: "var(--color-text-dim)", marginBottom: 10, lineHeight: 1.5 }}>
                            Subscribe to Coach for <strong>$10/month</strong> with a 14-day free trial.
                            Unlocks managed swimmers, teams, group assignments, multi-lane generate,
                            coach reports, UGC authoring, and team curation.
                            Cancel anytime before day 14 for no charge.
                          </div>
                          <button
                            onClick={async () => {
                              if (billingBusy) return;
                              setBillingBusy(true); setBillingMsg(null);
                              try {
                                const r = await fetch("/api/billing/checkout", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json", ...csrfHeaders() },
                                });
                                const d = await r.json().catch(() => ({}));
                                if (!r.ok) {
                                  if (d.error === "billing_not_configured") {
                                    setBillingMsg("Billing isn't live in this environment yet.");
                                  } else if (d.error === "no_price_id") {
                                    setBillingMsg("Stripe price ID not configured. Contact the operator.");
                                  } else {
                                    setBillingMsg(`Couldn't start checkout: ${d.error || r.status}`);
                                  }
                                  setBillingBusy(false);
                                  return;
                                }
                                // Redirect to Stripe-hosted checkout. setBillingBusy stays true
                                // so the button doesn't allow a second click during the redirect.
                                window.location.href = d.url;
                              } catch (e) {
                                setBillingMsg(`Network error: ${e.message}`);
                                setBillingBusy(false);
                              }
                            }}
                            disabled={billingBusy}
                            style={{
                              padding: "8px 16px", borderRadius: 6, border: "none",
                              background: billingBusy ? "var(--color-border)" : "var(--color-primary)",
                              color: "var(--color-bg)", fontSize: 13, fontWeight: 700,
                              cursor: billingBusy ? "wait" : "pointer",
                            }}>
                            {billingBusy ? "Starting…" : "Start free trial"}
                          </button>

                          {/* Lesson tier (Phase 5) — additive $5/mo plan for
                              private/small-group instructors. Only shown once the
                              Stripe lesson price is configured (has_price_id_lesson). */}
                          {billingStatus.has_price_id_lesson && (
                            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--color-border)" }}>
                              <div style={{ fontSize: 12, color: "var(--color-text-dim)", marginBottom: 10, lineHeight: 1.5 }}>
                                Just teaching lessons? Subscribe to <strong>Lesson</strong> for <strong>$5/month</strong>.
                                Unlocks the Lesson workout type (short skill sessions), managed swimmers,
                                per-swimmer equipment, and parent recap exports.
                              </div>
                              <button
                                onClick={async () => {
                                  if (billingBusy) return;
                                  setBillingBusy(true); setBillingMsg(null);
                                  try {
                                    const r = await fetch("/api/billing/checkout", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json", ...csrfHeaders() },
                                      body: JSON.stringify({ tier: "lesson" }),
                                    });
                                    const d = await r.json().catch(() => ({}));
                                    if (!r.ok) {
                                      if (d.error === "billing_not_configured") {
                                        setBillingMsg("Billing isn't live in this environment yet.");
                                      } else if (d.error === "no_price_id") {
                                        setBillingMsg(d.message || "Lesson price not configured. Contact the operator.");
                                      } else {
                                        setBillingMsg(`Couldn't start checkout: ${d.error || r.status}`);
                                      }
                                      setBillingBusy(false);
                                      return;
                                    }
                                    window.location.href = d.url;
                                  } catch (e) {
                                    setBillingMsg(`Network error: ${e.message}`);
                                    setBillingBusy(false);
                                  }
                                }}
                                disabled={billingBusy}
                                style={{
                                  padding: "8px 16px", borderRadius: 6, border: "1px solid var(--color-primary)",
                                  background: "transparent",
                                  color: "var(--color-primary)", fontSize: 13, fontWeight: 700,
                                  cursor: billingBusy ? "wait" : "pointer",
                                }}>
                                {billingBusy ? "Starting…" : "Subscribe to Lesson — $5/mo"}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {billingStatus.tier !== "free" && billingStatus.tier_source !== "admin_grant" && billingStatus.has_stripe_customer && (
                        <button
                          onClick={async () => {
                            if (billingBusy) return;
                            setBillingBusy(true); setBillingMsg(null);
                            try {
                              const r = await fetch("/api/billing/portal", {
                                method: "POST",
                                headers: { "Content-Type": "application/json", ...csrfHeaders() },
                              });
                              const d = await r.json().catch(() => ({}));
                              if (!r.ok) {
                                setBillingMsg(`Couldn't open portal: ${d.error || r.status}`);
                                setBillingBusy(false);
                                return;
                              }
                              window.location.href = d.url;
                            } catch (e) {
                              setBillingMsg(`Network error: ${e.message}`);
                              setBillingBusy(false);
                            }
                          }}
                          disabled={billingBusy}
                          style={{
                            padding: "8px 16px", borderRadius: 6, border: "1px solid var(--color-border)",
                            background: "transparent", color: "var(--color-text)", fontSize: 13, fontWeight: 600,
                            cursor: billingBusy ? "wait" : "pointer",
                          }}>
                          {billingBusy ? "Opening…" : "Manage subscription"}
                        </button>
                      )}

                      {billingStatus.tier !== "free" && billingStatus.tier_source === "admin_grant" && (
                        <div style={{ fontSize: 12, color: "var(--color-text-dim)", fontStyle: "italic", lineHeight: 1.5 }}>
                          You're on a comped {billingStatus.tier} tier (no payment method on file).
                          Email hello@competitionaquatics.com with any questions.
                        </div>
                      )}

                      {billingHistory.length > 0 && (
                        <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--color-card)" }}>
                          <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 6 }}>
                            Recent invoices
                          </div>
                          {billingHistory.map(inv => (
                            <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--color-text-dim)", padding: "3px 0" }}>
                              <span>
                                {inv.occurred_at ? new Date(inv.occurred_at).toLocaleDateString() : "—"}
                                {" · "}
                                <span style={{ color: inv.status === "paid" ? "var(--color-positive)" : inv.status === "refunded" ? "var(--color-warn)" : "var(--color-text-muted)" }}>{inv.status}</span>
                              </span>
                              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                                {inv.amount_cents < 0 ? "−" : ""}${Math.abs(inv.amount_cents / 100).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {billingMsg && (
                        <div style={{ fontSize: 12, color: "var(--color-warn)", marginTop: 10 }}>
                          {billingMsg}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                )}

                {/* v3.0 — Coach curation impact panel. Coach-only. Shows
                    how the coach's own curation (labels + sets + engine
                    tuples) is landing across their group's last-30d
                    workouts. Aggregate counts only, no swimmer names. */}
                {tab === "curation" && appEffectiveMe?.is_coach && (
                  <div style={{ padding: "18px 20px", borderTop: "1px solid var(--color-card)" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                      Curation impact (last 30 days)
                    </div>
                    {!impactData ? (
                      <div style={{ fontSize: 12, color: "var(--color-text-dim)", fontStyle: "italic" }}>Loading…</div>
                    ) : impactData.groupCount === 0 ? (
                      <div style={{ fontSize: 12, color: "var(--color-text-dim)", fontStyle: "italic" }}>
                        You don't coach any active groups yet. Curation propagation runs through groups — add one to start seeing impact.
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 12 }}>
                          {impactData.groupCount} {impactData.groupCount === 1 ? "group" : "groups"} · {impactData.swimmerCount} {impactData.swimmerCount === 1 ? "swimmer" : "swimmers"}
                          {impactData.swimmersWithActivity !== impactData.swimmerCount && (
                            <span> ({impactData.swimmersWithActivity} active in window)</span>
                          )}
                          {" · "}
                          {impactData.workoutCount} {impactData.workoutCount === 1 ? "workout" : "workouts"}
                        </div>
                        {impactData.labels.length === 0 && impactData.sets.length === 0 && impactData.engine.length === 0 ? (
                          <div style={{ fontSize: 12, color: "var(--color-text-dim)", fontStyle: "italic" }}>
                            You haven't curated anything yet. Click ★ or 👎 on a set to start influencing your group's picks.
                          </div>
                        ) : (
                          <div style={{ display: "grid", gap: 12 }}>
                            {impactData.labels.length > 0 && (
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                                  Bank labels ({impactData.labels.length})
                                </div>
                                <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                  {impactData.labels.map((row, i) => (
                                    <div key={`l${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, padding: "6px 10px", gap: 10 }}>
                                      <span style={{ color: "var(--color-text)" }}>
                                        {row.kind === "favorite" ? "★" : "👎"} {row.label}
                                      </span>
                                      <span style={{ fontSize: 11, color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
                                        reach <strong style={{ color: "var(--color-text)" }}>{row.reach}</strong> · <strong style={{ color: "var(--color-text)" }}>{row.effectiveness}</strong> {row.effectiveness === 1 ? "wo" : "wos"}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {impactData.engine.length > 0 && (
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                                  Engine templates ({impactData.engine.length})
                                </div>
                                <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                  {impactData.engine.map((row, i) => (
                                    <div key={`e${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, padding: "6px 10px", gap: 10 }}>
                                      <span style={{ color: "var(--color-text)" }}>
                                        {row.kind === "favorite" ? "★" : "👎"} <code style={{ fontSize: 11, color: "var(--color-warn)" }}>{row.template_id}</code>
                                        <span style={{ color: "var(--color-text-dim)", marginLeft: 6 }}>+ {row.stroke}</span>
                                      </span>
                                      <span style={{ fontSize: 11, color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
                                        reach <strong style={{ color: "var(--color-text)" }}>{row.reach}</strong> · <strong style={{ color: "var(--color-text)" }}>{row.effectiveness}</strong> {row.effectiveness === 1 ? "wo" : "wos"}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {impactData.sets.length > 0 && (
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                                  Sets ({impactData.sets.length})
                                </div>
                                <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                  {impactData.sets.map((row, i) => {
                                    const ctx = lookupSetContext(row.set_id);
                                    return (
                                      <div key={`s${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, padding: "6px 10px", gap: 10 }}>
                                        <span style={{ color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, flex: 1 }}>
                                          {row.kind === "favorite" ? "★" : "👎"}
                                          {ctx ? (
                                            <>
                                              <span style={{ marginLeft: 4 }}>{ctx.reps > 1 ? `${ctx.reps}×${ctx.dist}` : `${ctx.dist}`}</span>
                                              <span style={{ color: "var(--color-text-dim)", margin: "0 6px" }}>·</span>
                                              <span style={{ color: "var(--color-text-dim)" }}>{(ctx.desc || "").slice(0, 60)}</span>
                                            </>
                                          ) : (
                                            <code style={{ fontSize: 11, color: "var(--color-warn)", marginLeft: 4 }}>{row.set_id}</code>
                                          )}
                                        </span>
                                        <span style={{ fontSize: 11, color: "var(--color-text-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>
                                          reach <strong style={{ color: "var(--color-text)" }}>{row.reach}</strong> · <strong style={{ color: "var(--color-text)" }}>{row.effectiveness}</strong> {row.effectiveness === 1 ? "wo" : "wos"}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* v1.4 — Disfavorites audit panel. Shows bank + engine
                    disfavorites with one-click remove. Empty state explains
                    how to add disfavorites (click 👎 in a workout block). */}
                {tab === "curation" && (
                <div style={{ padding: "18px 20px", borderTop: "1px solid var(--color-card)" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                    Disfavorites ({bankDisfavorites.length + engineDisfavoritesLocal.length + setDisfavoritesLocal.length})
                  </div>
                  {/* Team Curation v1 slice 5: inheritance disclosure. Per
                      TEAM_CURATION_SCOPE.md §3.6 — show team defaults explicitly
                      so the user knows what's inherited and where their own
                      settings diverge. Multi-team coach gets one line per team
                      (v1: no conflict-resolution UI; defaults union silently
                      and v1.1 surfaces attribution per the spec fork). */}
                  {teamDefaults.length > 0 && (
                    <div style={{ marginBottom: 14, padding: "10px 12px", background: "rgba(59,130,246,0.08)", border: "1px solid var(--color-primary)", borderRadius: 6 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-primary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                        👥 Team defaults you inherit
                      </div>
                      {teamDefaults.map(td => {
                        const bits = [];
                        if (td.default_pace_base)     bits.push(`pace ${td.default_pace_base}`);
                        if (td.default_disfavor_mode) bits.push(`disfavor mode ${td.default_disfavor_mode}`);
                        if (td.default_equipment_modes) bits.push("equipment defaults");
                        return (
                          <div key={td.team_id} style={{ fontSize: 12, color: "var(--color-text)", lineHeight: 1.5 }}>
                            <strong>{td.team_name}</strong>: {bits.join(" · ")}
                            {td.default_disfavor_mode && td.default_disfavor_mode !== disfavorModeLocal && (
                              <span style={{ color: "var(--color-warn)", fontSize: 11, marginLeft: 6 }}>
                                (you've overridden to {disfavorModeLocal})
                              </span>
                            )}
                          </div>
                        );
                      })}
                      <div style={{ fontSize: 10, color: "var(--color-text-dim)", fontStyle: "italic", marginTop: 6 }}>
                        Defaults apply to brand-new swimmers joining the team. Your own settings below override them; clear an override to fall back to the team default.
                      </div>
                    </div>
                  )}
                  {/* v1.8 — mode toggle: applies to all disfavor types */}
                  <div style={{ marginBottom: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "var(--color-text-dim)" }}>Mode:</span>
                    <div style={{ display: "inline-flex", borderRadius: 6, border: "1px solid var(--color-border)", overflow: "hidden" }}>
                      {[
                        { id: "downweight", label: "Downweight (0.25×)", title: "Disfavored items get 0.25× pick weight — still possible but rare" },
                        { id: "exclude",    label: "Hard-exclude",        title: "Disfavored items get 0 weight — never picked unless the pool would empty (silent fallback)" },
                      ].map(opt => {
                        const active = disfavorModeLocal === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleSetDisfavorMode(opt.id)}
                            title={opt.title}
                            style={{
                              fontSize: 11, fontWeight: 600, padding: "5px 10px",
                              background: active ? "var(--color-primary)" : "var(--color-card)",
                              color: active ? "#fff" : "var(--color-text-dim)",
                              border: "none", cursor: "pointer",
                              transition: "background 0.15s, color 0.15s",
                            }}>
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {bankDisfavorites.length === 0 && engineDisfavoritesLocal.length === 0 && setDisfavoritesLocal.length === 0 ? (
                    <div style={{ fontSize: 12, color: "var(--color-text-dim)", fontStyle: "italic" }}>
                      No disfavorites yet. Click 👎 on any main-set in a workout to reduce its pick weight.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      {bankDisfavorites.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                            Bank labels ({bankDisfavorites.length})
                          </div>
                          <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
                            {bankDisfavorites.map(label => (
                              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, padding: "6px 10px" }}>
                                <span style={{ color: "var(--color-text)" }}>{label}</span>
                                <button onClick={() => handleRemoveBankDisfavorite(label)}
                                  title="Remove from disfavorites"
                                  style={{ background: "transparent", border: "1px solid var(--color-border-strong)", borderRadius: 4, color: "var(--color-text-dim)", fontSize: 11, padding: "2px 8px", cursor: "pointer" }}>
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {engineDisfavoritesLocal.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                            Engine templates ({engineDisfavoritesLocal.length})
                          </div>
                          <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
                            {engineDisfavoritesLocal.map((e, i) => (
                              <div key={`${e.template_id}:${e.stroke}:${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, padding: "6px 10px" }}>
                                <span style={{ color: "var(--color-text)" }}>
                                  <code style={{ fontSize: 11, color: "var(--color-warn)" }}>{e.template_id}</code>
                                  <span style={{ color: "var(--color-text-dim)", marginLeft: 6 }}>+ {e.stroke}</span>
                                </span>
                                <button onClick={() => handleRemoveEngineDisfavorite(e.template_id, e.stroke)}
                                  title="Remove from engine disfavorites"
                                  style={{ background: "transparent", border: "1px solid var(--color-border-strong)", borderRadius: 4, color: "var(--color-text-dim)", fontSize: 11, padding: "2px 8px", cursor: "pointer" }}>
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* v1.10 — set-level disfavorites with context lookup */}
                      {setDisfavoritesLocal.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                            Sets ({setDisfavoritesLocal.length})
                          </div>
                          <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
                            {setDisfavoritesLocal.map((setId, i) => {
                              const ctx = lookupSetContext(setId);
                              return (
                                <div key={`${setId}:${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, padding: "6px 10px", gap: 10 }}>
                                  <span style={{ color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, flex: 1 }}>
                                    {ctx ? (
                                      <>
                                        <span>{ctx.reps > 1 ? `${ctx.reps}×${ctx.dist}` : `${ctx.dist}`}</span>
                                        <span style={{ color: "var(--color-text-dim)", margin: "0 6px" }}>·</span>
                                        <span style={{ color: "var(--color-text-dim)" }}>{(ctx.desc || "").slice(0, 80)}</span>
                                        <div style={{ fontSize: 10, color: "var(--color-text-dim)", marginTop: 2 }}>
                                          from <em>{ctx.label}</em> · <code>{setId}</code>
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <code style={{ fontSize: 11, color: "var(--color-warn)" }}>{setId}</code>
                                        <span style={{ color: "var(--color-text-dim)", marginLeft: 6, fontStyle: "italic", fontSize: 10 }}>(no longer in the bank)</span>
                                      </>
                                    )}
                                  </span>
                                  <button onClick={() => handleRemoveSetDisfavorite(setId)}
                                    title="Remove from set disfavorites"
                                    style={{ background: "transparent", border: "1px solid var(--color-border-strong)", borderRadius: 4, color: "var(--color-text-dim)", fontSize: 11, padding: "2px 8px", cursor: "pointer", flexShrink: 0 }}>
                                    Remove
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                )}

                {/* Community — link to the SetForge Discord. Sibling of
                    Favorites/Disfavorites per DISCORD_SCOPE §7. Adult
                    feedback is forwarded to a private Discord channel
                    for triage; minors' feedback stays in-app. The DOB
                    check happens server-side; UI surface is just the
                    invite link. */}
                {tab === "account" && (
                <div style={{ padding: "18px 20px", borderTop: "1px solid var(--color-card)" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                    Community
                  </div>
                  <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 10, lineHeight: 1.5 }}>
                    Discord server for coaches and adult swimmers (13+). Feature requests, bug reports, coach-to-coach discussion.
                  </div>
                  <a href="https://discord.gg/N8BMxNbhf7" target="_blank" rel="noopener"
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 6, border: "1px solid var(--color-primary)", color: "var(--color-primary)", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
                    💬 Join the SetForge Discord
                  </a>
                </div>
                )}

                {/* Self-serve data export (Phase 4 continuity). Authenticated
                    GET /api/me/export → JSON download via blob (cookie auth). */}
                {tab === "account" && (
                <div style={{ padding: "18px 20px", borderTop: "1px solid var(--color-card)" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                    Your data
                  </div>
                  <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 10, lineHeight: 1.5 }}>
                    Download a full copy of your account as JSON — your profile, workouts, schedule, curation, and the swimmers and teams you coach.
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/me/export", { credentials: "include" });
                        if (!res.ok) throw new Error("export failed");
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `setforge-export-${new Date().toISOString().slice(0, 10)}.json`;
                        document.body.appendChild(a); a.click(); a.remove();
                        URL.revokeObjectURL(url);
                      } catch (_) { alert("Couldn't generate the export. Please try again."); }
                    }}
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 6, border: "1px solid var(--color-primary)", background: "transparent", color: "var(--color-primary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    ⬇ Export my data (JSON)
                  </button>
                </div>
                )}

                {/* View-as switcher — admin-only QA tool. Gated on REAL
                    admin (me.is_admin), not effectiveMe, so an admin who
                    flipped into "view as solo" can still see + exit the
                    switcher. Real `me` (from this modal's own /api/me
                    fetch) is the authoritative role check. */}
                {tab === "account" && me?.is_admin && (
                  <div style={{ padding: "18px 20px", borderTop: "1px solid var(--color-card)" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                      View as <span style={{ color: "var(--color-warn)", marginLeft: 6 }}>(admin QA)</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-text-dim)", marginBottom: 10 }}>
                      Override your role flags to preview what other users see. Doesn't change server-side permissions — coach/admin API endpoints still respond, the UI just hides those features.
                    </div>
                    <div style={{ display: "inline-flex", borderRadius: 6, border: "1px solid var(--color-border-strong)", overflow: "hidden" }}>
                      {[
                        { id: "self",  label: "Self",  title: "Your real role flags (admin + whatever else)" },
                        { id: "solo",  label: "Solo",  title: "Hide all coach + admin UI" },
                        { id: "coach", label: "Coach", title: "Show coach UI, hide admin UI" },
                      ].map(opt => {
                        const active = appViewAsRole === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => appSetViewAsRole && appSetViewAsRole(opt.id)}
                            title={opt.title}
                            style={{
                              fontSize: 11, fontWeight: 700, padding: "5px 12px",
                              background: active ? "var(--color-primary)" : "var(--color-card)",
                              color: active ? "#fff" : "var(--color-text-dim)",
                              border: "none", cursor: "pointer",
                              transition: "background 0.15s, color 0.15s",
                            }}>
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    {/* Orthogonal "+ parent" toggle. Composes with the role
                        picker so admins can preview coach+parent or
                        solo+parent UIs (the 👪 nav + ParentDashboard
                        surface when flipped on). */}
                    <label
                      title="Also pretend you have at least one linked guardian row (shows 👪 nav + Parent view). Composes with the role picker."
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        marginLeft: 10, fontSize: 11, fontWeight: 600,
                        color: appViewAsParent ? "var(--color-primary)" : "var(--color-text-dim)",
                        cursor: "pointer", userSelect: "none",
                      }}>
                      <input
                        type="checkbox"
                        checked={!!appViewAsParent}
                        onChange={(e) => appSetViewAsParent && appSetViewAsParent(e.target.checked)}
                        style={{ margin: 0, cursor: "pointer" }}
                      />
                      + parent
                    </label>
                  </div>
                )}

                {tab === "account" && (
                <div style={{ padding: "18px 20px", borderTop: "1px solid var(--color-card)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Active sessions ({sessions.length})</div>
                    {sessions.length > 1 && (
                      <button onClick={handleSignoutOthers} disabled={revoking} style={{ background: "var(--color-border)", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "var(--color-text)", cursor: revoking ? "wait" : "pointer", fontWeight: 600 }}>
                        {revoking ? "Revoking…" : "Sign out everywhere else"}
                      </button>
                    )}
                  </div>
                  {revokeMsg && (
                    <div style={{ fontSize: 12, color: "#10b981", marginBottom: 12 }}>{revokeMsg}</div>
                  )}
                  <div style={{ display: "grid", gap: 8, fontSize: 12 }}>
                    {sessions.map(s => (
                      <div key={s.id_prefix} style={{ background: s.is_current ? "#1e3a5f" : "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, padding: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                          <span style={{ color: "var(--color-text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {s.user_agent ? s.user_agent.slice(0, 70) : "Unknown browser"}
                            {s.is_current && <span style={{ marginLeft: 8, fontSize: 10, color: "#10b981", fontWeight: 700 }}>● this device</span>}
                          </span>
                          <span style={{ color: "var(--color-text-dim)", fontSize: 10, flexShrink: 0 }}>{s.id_prefix}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                          <span style={{ color: "var(--color-text-dim)", fontSize: 11 }}>{s.ip || "—"} · last seen {fmtTime(s.last_seen_at)}</span>
                          {!s.is_current && (
                            <button onClick={() => handleRevokeOne(s.id_prefix)} style={{ background: "transparent", border: "1px solid var(--color-border-strong)", borderRadius: 6, padding: "2px 8px", fontSize: 10, color: "#cbd5e1", cursor: "pointer", fontWeight: 600 }}>
                              Revoke
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                )}
              </>
            )}
          </div>
        </div>
      );
    }
