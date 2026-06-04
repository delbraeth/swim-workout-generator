    // SPA-split Phase 3: components carved out of this file live in src/components/;
    // the workout engine lives in src/lib/engine.js (a pure module imported by both this
    // bundle and the server's lib/generator.js — the vm/text-slice is retired).
    import { Stat } from "./components/Stat.jsx";
    import { StarRating } from "./components/StarRating.jsx";
    import { FeedbackModal } from "./components/shell/FeedbackModal.jsx";
    import { ImpersonationStartModal } from "./components/shell/ImpersonationStartModal.jsx";
    import { ImpersonationBanner } from "./components/shell/ImpersonationBanner.jsx";
    import { SignInGate } from "./components/shell/SignInGate.jsx";
    import { TourOverlay } from "./components/shell/TourOverlay.jsx";
    import { ReportPrintView } from "./components/reports/ReportPrintView.jsx";
    import { ProgressDashboard } from "./components/reports/ProgressDashboard.jsx";
    import { ReportsView } from "./components/reports/ReportsView.jsx";
    import { MultiLaneControl } from "./components/multipace/MultiLaneControl.jsx";
    import { MultiPaceModal } from "./components/multipace/MultiPaceModal.jsx";
    import { MultiPacePrintView } from "./components/multipace/MultiPacePrintView.jsx";
    import { SaveToHistoryForm } from "./components/history/SaveToHistoryForm.jsx";
    import { HistoryView } from "./components/history/HistoryView.jsx";
    import { CatalogView } from "./components/catalog/CatalogView.jsx";
    import { MySetsView } from "./components/catalog/MySetsView.jsx";
    import { UgcFormModal } from "./components/catalog/UgcFormModal.jsx";
    import { GroupAssignmentsPanel } from "./components/groups/GroupAssignmentsPanel.jsx";
    import { JoinTokensPanel } from "./components/groups/JoinTokensPanel.jsx";
    import { LanePlansPanel } from "./components/groups/LanePlansPanel.jsx";
    import { GroupRow } from "./components/groups/GroupRow.jsx";
    import { ParentDashboard } from "./components/people/ParentDashboard.jsx";
    import { ClaimTokensPanel } from "./components/people/ClaimTokensPanel.jsx";
    import { ClaimManagedSection } from "./components/people/ClaimManagedSection.jsx";
    import { CoachNotesPanel } from "./components/people/CoachNotesPanel.jsx";
    import { ConstraintFormModal } from "./components/people/ConstraintFormModal.jsx";
    import { ParentsPanel } from "./components/people/ParentsPanel.jsx";
    import { ConstraintsPanel } from "./components/people/ConstraintsPanel.jsx";
    import { ManagedSwimmersView } from "./components/people/ManagedSwimmersView.jsx";
    import { ManagedSwimmerForm } from "./components/people/ManagedSwimmerForm.jsx";
    import { BulkImportModal } from "./components/people/BulkImportModal.jsx";
    import { DobPromptModal } from "./components/people/DobPromptModal.jsx";
    import { AddressManager } from "./components/people/AddressManager.jsx";
    import { HouseholdSiblings } from "./components/people/HouseholdSiblings.jsx";
    import { ParentInviteCards } from "./components/people/ParentInviteCards.jsx";
    import { EquipmentBadge } from "./components/workout/EquipmentBadge.jsx";
    import { SetRow } from "./components/workout/SetRow.jsx";
    import { EquipmentPicker } from "./components/workout/EquipmentPicker.jsx";
    import { RoundRestRow } from "./components/workout/RoundRestRow.jsx";
    import { DrylandBlock } from "./components/workout/DrylandBlock.jsx";
    import { WorkoutBlock } from "./components/workout/WorkoutBlock.jsx";
    import { YardageSlider } from "./components/workout/YardageSlider.jsx";
    import { PaceClockView } from "./components/workout/PaceClockView.jsx";
    import { RestPickerModal } from "./components/workout/RestPickerModal.jsx";
    import { RunWorkoutOverlay } from "./components/workout/RunWorkoutOverlay.jsx";
    import { JoinGroupSection } from "./components/profile/JoinGroupSection.jsx";
    import { ProfileGenderRow } from "./components/profile/ProfileGenderRow.jsx";
    import { EditableProfileField } from "./components/profile/EditableProfileField.jsx";
    import { GoalRow } from "./components/profile/GoalRow.jsx";
    import { PhaseRow } from "./components/profile/PhaseRow.jsx";
    import { BenchmarksSection } from "./components/profile/BenchmarksSection.jsx";
    import { LevelRow } from "./components/profile/LevelRow.jsx";
    import { NextEventRow } from "./components/profile/NextEventRow.jsx";
    import { ProfileActiveConstraintsSection } from "./components/profile/ProfileActiveConstraintsSection.jsx";
    import { ProfileModal } from "./components/profile/ProfileModal.jsx";
    import { IntentParserModal } from "./components/practices/IntentParserModal.jsx";
    import { IntentForm } from "./components/practices/IntentForm.jsx";
    import { IntentPreviewOverlay } from "./components/practices/IntentPreviewOverlay.jsx";
    import { PracticesView } from "./components/practices/PracticesView.jsx";
    import { MarkPracticeDoneModal } from "./components/practices/MarkPracticeDoneModal.jsx";
    import { WeekView } from "./components/practices/WeekView.jsx";
    import { AssignedToMeView } from "./components/practices/AssignedToMeView.jsx";
    import { TeamRosterTab } from "./components/teams/TeamRosterTab.jsx";
    import { TeamSettingsTab } from "./components/teams/TeamSettingsTab.jsx";
    import { TeamsView } from "./components/teams/TeamsView.jsx";
    import { TeamFacilitiesSection } from "./components/teams/TeamFacilitiesSection.jsx";
    import { R1ProgrammingMixTab } from "./components/reports/R1ProgrammingMixTab.jsx";
    import { R2ScheduleAdherenceTab } from "./components/reports/R2ScheduleAdherenceTab.jsx";
    import { R3CurationLogTab } from "./components/reports/R3CurationLogTab.jsx";
    import { R4ProgramRecapTab } from "./components/reports/R4ProgramRecapTab.jsx";
    import { R5PlatformHealthTab } from "./components/reports/R5PlatformHealthTab.jsx";
    import { R6CurationSupportTab } from "./components/reports/R6CurationSupportTab.jsx";
    import { AdminView } from "./components/admin/AdminView.jsx";
    import { AdminPendingUgc } from "./components/admin/AdminPendingUgc.jsx";
    import { AdminPublicUgc } from "./components/admin/AdminPublicUgc.jsx";
    import { UgcGraduateModal } from "./components/admin/UgcGraduateModal.jsx";
    import { AdminFeedback } from "./components/admin/AdminFeedback.jsx";
    import { AdminUsers } from "./components/admin/AdminUsers.jsx";
    import { EditUserModal } from "./components/admin/EditUserModal.jsx";
    import { AdminInvites } from "./components/admin/AdminInvites.jsx";
    import { AdminEmailTest } from "./components/admin/AdminEmailTest.jsx";
    import { AdminBillingConfig } from "./components/admin/AdminBillingConfig.jsx";
    import { AdminVendorKit } from "./components/admin/AdminVendorKit.jsx";
    import { AdminAudit } from "./components/admin/AdminAudit.jsx";
    // Workout engine (pure module; same source the server imports via lib/generator.js).
    import {
      COOLDOWN_OPTIONS, COOLDOWN_OPTIONS_50M, COOLDOWN_OPTIONS_SCM, DRILL_OPTIONS, DRILL_OPTIONS_50M,
      DRILL_OPTIONS_SCM, EQUIP_REQUIREMENTS, KICK_OPTIONS, KICK_OPTIONS_50M, KICK_OPTIONS_SCM,
      MAIN_OPTIONS, MAIN_OPTIONS_50M, MAIN_OPTIONS_SCM, MIN_YARDS, NO_INTERVAL_CANONICAL, PHASES,
      TEMPLATE_CANONICAL_DISTS, TEMPLATE_ENGINE, WARMUP_OPTIONS, WARMUP_OPTIONS_50M, WARMUP_OPTIONS_SCM,
      WORKOUT_TYPES, ZONES, applyEngineOverrides, calcEstimatedMin, equipMode, formatIntervalSecs,
      generateEngineForSection, generateWorkout, getBankOptions, getOverlayRowsForTuple, inferBlockZone,
      inferSetZone, pick, regenerateSection, scaleInterval,
    } from "./lib/engine.js";
    import {
      API_BASE,
      DRYLAND_OPTIONS,
      LEVEL_PRESETS,
      ZONE_ORDER,
      csrf,
      csrfHeaders,
      equipmentForSet,
      extractMainLabel,
      formatPscRow,
      getEquivalents,
      makeDrylandBlock,
      makeEntryId,
      minYardsForType,
      normalizeInitials,
      parseIntent,
      parsePaceMSS,
      rescaleBlocksForPace
    } from "./lib/shared.js";

    const { useState, useCallback, useMemo, useEffect } = React;

    // ═══════════════════════════════════════════════════════════════
    //  HISTORY BACKEND CONFIG — same origin as the page, so all paths
    //  are relative. The Node server (see server.js + Dockerfile)
    //  handles GitHub commits server-side; no secrets in this file.
    // ═══════════════════════════════════════════════════════════════
                     // same origin (exported for src/components/**; engine extractor strips `export`)
    const BUILD_ID  = (typeof window !== "undefined" && window.__BUILD_ID__) || "dev";   // SPA-split: the shell index.html sets window.__BUILD_ID__ (stamped by _deploy.py); the bundle reads it here (deploy stamps index.html, not the bundle).

    // CSRF token bound to the session. Fetched after auth-status confirms login,
    // sent on every write as the X-CSRF-Token header.
    
    async function refreshCsrf() {
      try {
        const r = await fetch(`${API_BASE}/auth/csrf`, { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        csrf.token = d.token || null;
      } catch { /* leave previous value */ }
    }
    

    // v3 impersonation client (2026-05-22 per VIEW_AS_V3_SCOPE.md).
    // Module-scope so the fetch wrapper below can read it without React
    // closure complexity. App.jsx sets/clears it via setImpersonation().
    // Shape: { target_sub, target_name, target_email, expires_at } | null.
    const impersonation = { active: null };
    function setImpersonation(state) {
      impersonation.active = state || null;
    }
    // Wrap window.fetch to auto-add X-Impersonate-Sub to every /api/* call
    // when an impersonation session is active. Targeting only /api/ keeps
    // CDN/asset fetches untouched. The header is the only signal the
    // server needs to rewrite req.userSub; the server validates the
    // header against an active session row on every request (see
    // server.js requireAuth).
    // Also makes every fetch resilient to HTTP 429. Hyperlift rate-limits
    // bursts of parallel GETs (opening a team or swimmer fans out 5-7 reads
    // at once); a 429 means the request was REJECTED before the handler ran,
    // so a short backoff-retry is safe for reads AND writes (the write never
    // executed). Without this, callers' catch blocks silently render the 429
    // as empty — e.g. the Groups tab showing "No groups yet" for a team that
    // actually has groups. Retries only on 429; all other statuses pass
    // straight through. Honors Retry-After when the server sends it.
    if (typeof window !== "undefined" && window.fetch && !window.__sfImpersonationFetchWrapped) {
      const _origFetch = window.fetch.bind(window);
      const _sfSleep = ms => new Promise(r => setTimeout(r, ms));
      const _SF_MAX_429_RETRIES = 4;
      window.fetch = async function(input, init) {
        const url = typeof input === "string" ? input : (input && input.url) || "";
        if (impersonation.active && impersonation.active.target_sub && url.startsWith("/api/")) {
          init = init || {};
          init.headers = { ...(init.headers || {}), "X-Impersonate-Sub": impersonation.active.target_sub };
        }
        let attempt = 0;
        while (true) {
          const res = await _origFetch(input, init);
          if (res.status !== 429 || attempt >= _SF_MAX_429_RETRIES) return res;
          const ra = parseFloat(res.headers.get("retry-after"));
          const backoff = Number.isFinite(ra) ? ra * 1000 : Math.min(2000, 200 * Math.pow(2, attempt));
          await _sfSleep(backoff + Math.random() * 150);
          attempt++;
        }
      };
      window.__sfImpersonationFetchWrapped = true;
    }

    // Normalize raw initials input: trim, uppercase, alphanumeric only, max 4 chars.
    

    // Pool-mode → human label. Top-level so any component can use it (there's
    // also a component-local `poolLabel` with the same mapping; this is the
    // shared one for IntentForm / WeekView / facility chips).
    

    const HISTORY_LOCAL_KEY = "swim_history_v1";
    const USER_INITIALS_KEY = "swim_user_initials";

    function loadLocalHistory() {
      try { const raw = localStorage.getItem(HISTORY_LOCAL_KEY); return raw ? JSON.parse(raw) : []; }
      catch (_) { return []; }
    }
    function saveLocalHistory(entries) {
      try { localStorage.setItem(HISTORY_LOCAL_KEY, JSON.stringify(entries)); } catch (_) {}
    }
    // Merge two entry lists by id (b wins on conflict), then sort newest-first by dateCompleted.
    function mergeById(a, b) {
      const map = new Map();
      for (const e of a) if (e && e.id) map.set(e.id, e);
      for (const e of b) if (e && e.id) map.set(e.id, e);
      return [...map.values()].sort((x, y) => (y.dateCompleted || "").localeCompare(x.dateCompleted || ""));
    }
    

    // ═══════════════════════════════════════════════════════════════
    //  WORKOUT TYPE METADATA
    // ═══════════════════════════════════════════════════════════════
    

    

    // ═══════════════════════════════════════════════════════════════
    //  EFFORT-ZONE TAXONOMY (Session 2 H foundation)
    //  5 zones, green → red intensity gradient. Used for the small color
    //  pip rendered on block headers and on divergent set rows.
    //  Options can set `primary_zone` (and optional `secondary_zones`)
    //  explicitly; otherwise `inferZone()` derives a sensible default.
    // ═══════════════════════════════════════════════════════════════
    
    

    // ═══════════════════════════════════════════════════════════════
    //  MESOCYCLE / TRAINING PHASE (N5)
    //  Five phases. User sets one in the Profile modal; it sticks until
    //  changed. The generator multiplies main-set pick weights by the
    //  phase's per-zone multiplier (in addition to fav/repeat/recent).
    //  Naming note: "recovery" PHASE is a longer-term setting; "recovery
    //  mode" (item C) is a per-generation toggle. They compose: a recovery-
    //  phase swimmer can still flip recovery mode on for an extra-easy day.
    // ═══════════════════════════════════════════════════════════════
    

    // J — Swimmer-level presets. Persisted in settings.extra.level; picking
    // a level in Profile overwrites paceInput. No extra interval-scaling
    // multiplier (decision 2026-05-19) — level is just a calibration shortcut
    // so a new swimmer can pick "Masters" and get a sane default pace
    // instead of staring at the M:SS field with no idea what to type.
    

    // Onboarding tour — a lightweight spotlight walkthrough of the
    // generator setup flow, ending at the Generate button. Each step
    // targets a data-tour="..." anchor that already exists in the markup.
    // Only PRE-generation controls are included (favorite-toggle and
    // celebrate anchors render only after a workout exists). The anchor
    // named "step-swimmer-level" is actually on the profile button, so it
    // is intentionally not used here. Persisted-seen flag lives in
    // settings.extra.tour_seen (see applySettings / handleTourFinish).
    const TOUR_STEPS = [
      { sel: "step-pool-mode",      title: "Pick your pool",        body: "Choose your course — short-course yards or meters, or long-course. This sets the distances and the pace math for everything below." },
      { sel: "step-type-cards",     title: "Choose a workout type", body: "Pick today's focus — sprint, distance, IM and more. Each type shapes the sets the generator builds." },
      { sel: "step-pace-input",     title: "Set your pace",         body: "Enter your base pace as M:SS per 100. Intervals and target times are calculated from this number." },
      { sel: "step-equipment",      title: "Mark your equipment",   body: "Tell the generator what you have — fins, paddles, kickboard, snorkel. Sets will use or avoid gear to match." },
      { sel: "step-yardage-slider", title: "Dial in the distance",  body: "Slide to set the total distance for the session. The generator fills it with balanced warmup, main and cooldown work." },
      { sel: "step-generate-button", title: "Build your first set", body: "When you're ready, tap Generate — your workout appears below, ready to print or run on the pace clock." },
    ];

    // Heuristic zone inference from a single set's text + interval + distance.
    // Returns one of ZONE_ORDER. Keyword cues in desc/focus dominate; interval
    // tightness (work/total ratio) is the tie-breaker when text is ambiguous.
    

    // Block-level zone: explicit `primary_zone` wins; otherwise take the
    // highest-rank zone across the block's sets (so a block with one vo2
    // finisher is shown as threshold/vo2, not aerobic).
    

    // ═══════════════════════════════════════════════════════════════
    //  WORKOUT DATA — all options as flat arrays
    //  Every totalYards value is verified: sum of (reps × dist)
    // ═══════════════════════════════════════════════════════════════

    

    

    

    

    // ═══════════════════════════════════════════════════════════════
    //  50-METER POOL OPTION BANKS
    //  All distances are in meters. totalYards property is re-used
    //  (value is meters) to keep the generator logic unchanged.
    //  IM / back / breast / fly types fall back to yard banks.
    // ═══════════════════════════════════════════════════════════════

    

    

    

    

    // ═══════════════════════════════════════════════════════════════
    //  SCM (25m short-course meters) option banks.
    //  Ported from the SCY (25y) banks: same distances (lengths match),
    //  intervals scaled +5% to reflect meter-vs-yard pace difference.
    //  Specialty types fall back to LCM (50m) if a type entry is missing.
    // ═══════════════════════════════════════════════════════════════

    

    

    

    

    // ═══════════════════════════════════════════════════════════════
    //  KICK OPTIONS — standalone 5th-section kick banks. Non-typed
    //  (types:[]/strokes:[]) like warmup/cooldown so getBankOptions
    //  returns all options regardless of workout type. Yards bank +
    //  meters banks (50m / SCM) so unit-aware lookup never crosses
    //  banks needlessly. eq:["kickboard"] is a PREFERRED tag (bonus
    //  weight in the picker), never a hard requirement.
    // ═══════════════════════════════════════════════════════════════
    
    
    

    // ═══════════════════════════════════════════════════════════════
    //  SET-ID LOOKUP MAP — set_id → "reps×dist – parent label"
    //  Built once at script load by walking every *_OPTIONS bank.
    //  Used by R3 Curation Log to render human-readable set names
    //  instead of raw "s_xxxxxx" identifiers. Old IDs no longer in
    //  the bank (e.g., a user favorited a set that's since been
    //  removed) fall back to the raw ID at the render site.
    // ═══════════════════════════════════════════════════════════════
    
    

    // ═══════════════════════════════════════════════════════════════
    //  BUDGET-AWARE GENERATOR
    //  Filters options so the workout stays within [1900, maxYards]
    // ═══════════════════════════════════════════════════════════════

    

    // Weighted random pick. weightFn(item) returns a positive number.
    // Items with weight 0 are excluded. Falls back to uniform pick if total is 0.
    // ─── Audio cues (W1) ─────────────────────────────────────────────
    // Web Audio API tone generator for rest-timer cues.
    // Lazy-init the AudioContext on first call. iOS requires the first
    // call to happen inside a user gesture; we prime it from the rest
    // picker's Start button (and from any user click that opens Run mode).
    
    
    

    

    // Returns the main-set label for a block, whether the block came from a
    // freshly generated workout (label preserved by spread), a regenerated
    // section, or a history-loaded entry (handleSave persists `label` now;
    // older rows fall back to parsing the block name).
    

    
    

    // Each checked equipment item must be satisfied by ≥ 1 set in the drill+main blocks.
    // satisfiedBy lists the eq tags whose presence counts for that equipment.
    

    // F: equipment can be in three modes: "off" | "preferred" | "required".
    // For backward compatibility, treat truthy bools as "required" and falsy /
    // missing as "off". These helpers centralize the read so the rest of the
    // pipeline doesn't need to care about the wire format.
    
    
    
    

    

    // Hard-filter check: only "required" equipment enforces the constraint.
    // "Preferred" is handled by weight-bias at pick time (see preferredEquipBoost).
    

    // Returns the count of "preferred" equipment items whose required `eq`
    // tags appear in this option's sets. Used to multiply pick weights.
    

    // pinnedBlocks: { warmup?, drill?, main?, cooldown? } — sections to hold fixed.
    // For each pinned section the block is used as-is; unpinned sections are generated
    // to fill the remaining budget. Budget math uses freeBudget = maxYards - pinnedTotal.
    // Maps workout type → warmup affinity family. Types not listed get no filter (use all warmups).
    

    // ═══════════════════════════════════════════════════════════════
    //  W2 — NATURAL-LANGUAGE INTENT PARSER (keyword, no LLM)
    //  ───────────────────────────────────────────────────────────────
    //  Coach types something like "easy 2k aerobic" or "threshold 25
    //  min @ 2:00 with paddles" — parser extracts known tokens, leaves
    //  the rest as `unparsed` for the UI to display.
    //
    //  Order of consume() passes matters:
    //    1. pace (so @2:00 doesn't collide with bare distance)
    //    2. distance with explicit unit suffix (k/y/yd/m/meters/yards)
    //    3. duration (min/hr)
    //    4. workout type (im/distance/sprint/etc — strip BEFORE zone
    //       so standalone "sprint" maps to type, not zone)
    //    5. recovery mode toggle ("recovery" / "easy day")
    //    6. zones (easy/aerobic/threshold/vo2/anaerobic)
    //    7. equipment (paddles/fins/snorkel/kickboard/pull buoy)
    //
    //  Returns { tokens: [...], unparsed: "..." }. Vocabulary expansion
    //  is intentional — add categories opportunistically as coaches
    //  surface phrases that should parse.
    

    // 2026-05-15: refactored to single options object for readability and to
    // make adding/removing optional knobs safe (no positional ordering pitfalls).
    // All previous positional args are now keys on the opts object — the
    // function body still references them by name via destructuring.
    // Section-proportion controls (real-shift). Each bias mode declares
    // target ratios of freeBudget per section. "balanced" is sentinel for
    // no-change-to-current-allocator. Non-balanced modes:
    //   - compute target_section = freeBudget * ratio
    //   - bias warmup + drill pickers toward options nearest the target
    //     (inverse-distance weighting on top of existing favBoost/equip)
    //   - override main's hardcoded 65% floor with the bias-specific ratio
    //   - cooldown left as-is (always small, near-floor)
    // Targets are guidance, not hard floors — the existing attempts-loop +
    // bank-availability fallbacks still apply.
    

    // ── S3: helpers for engine routing per section ───────────────────
    // generateEngineForSection — pick an applicable template (weighted
    // among those applicable to section × typeKey; v1.3 applies 0.25×
    // weight to disfavored (template_id, stroke) tuples) and invoke the
    // engine's full pipeline (validate + retry-3 + anti-repeat).
    // Returns { option, templateUsed, attempts } or { option: null } on
    // no-applicable-template or full-failure (caller silently falls
    // back to bank).
    

    // applyEngineOverrides — replace bank-picked sections with engine
    // output when sectionSources[sect] === "engine" (or "mix" — TODO S3.4).
    // The bank picker still chooses an option per section; if engine is
    // requested, we replace that option AFTER the picker succeeds, sizing
    // the engine output to the bank option's totalYards. This preserves
    // the picker's combination validation (equipment, yardage min/max)
    // while substituting content per section. Engine output gets a
    // __engineMeta marker so the renderer can show the ⚡ badge.
    

    

    

    // ─── Per-section regeneration ────────────────────────────────────
    // Replace ONE section of an existing workout. The other three sections
    // are held fixed, so the new pick must (a) keep total yardage in
    // [MIN_YARDS, maxYards] and (b) preserve the equipment-coverage invariant
    // across drill+main if any equipment is checked.
    

    // Stable signature so we can exclude the current pick when alternatives exist.
    // Built from the full sets array so it matches across (a) fresh blocks
    // (which spread the option, including `label`), (b) raw pool options, and
    // (c) history-loaded blocks (which have `label` stripped by handleSave).
    

    // Returns { workout, error }. On success, workout is a fresh object with the
    // requested section replaced. On failure, error is a human-readable reason
    // and the caller should keep the prior workout unchanged.
    // 2026-05-15: refactored to options-object — same rationale as generateWorkout.
    

    // ═══════════════════════════════════════════════════════════════
    //  EQUIPMENT — checkbox state shapes set descriptions at render time
    //  (yardage, intervals, and focus are unchanged — equipment is a
    //   "what gear you use" detail, not a different exercise)
    // ═══════════════════════════════════════════════════════════════

    

    // Returns the equipment items (in display order) that apply to a given set
    // based on the set's `eq` tag and the user's current checkbox state.
    

    // Rewrite a set's description based on which compatible equipment is checked.
    // Yardage and intervals never change — only the prose updates to be explicit
    // about which gear to grab.
    

    // ═══════════════════════════════════════════════════════════════
    //  SET SWAP HELPERS
    // ═══════════════════════════════════════════════════════════════

    // Strict interval parser — the single source of truth for "how many seconds
    // is this interval string?". Returns null for empty / no-interval / unparseable.
    // Only accepts the canonical authored form `On M:SS` (with `M` optional, e.g.
    // `On :45`). User-typed input from the per-set editor is canonicalized via
    // normalizeIntervalInput BEFORE being stored, so the math only ever sees
    // canonical strings here.
    

    

    // Canonical sentinel for an interval-less set. Authored data uses this
    // exact string; clear-to-no-interval and "no interval" typed input both
    // normalize to it.
    

    // Normalize raw user input from the per-set interval editor into either
    // a canonical interval string or an explicit error. Permissive about
    // input form, strict about what it stores. Returns:
    //   { value: "On M:SS" | NO_INTERVAL_CANONICAL, secs: number | null, error: null }  // valid
    //   { value: null, secs: null, error: null }                                          // empty → no-op
    //   { value: null, secs: null, error: "<friendly message>" }                          // unparseable
    //
    // Accepted forms (case-insensitive, leading/trailing whitespace ignored):
    //   "On 1:30"   → On 1:30   (canonical pass-through)
    //   "1:30"      → On 1:30
    //   ":45"       → On 0:45
    //   "0:45"      → On 0:45
    //   "90"        → On 1:30   (bare integer = seconds; 5–3600 range)
    //   "no interval" / "none" / "off" → NO_INTERVAL_CANONICAL
    //   ""          → no-op (caller closes editor without changes)
    //
    // Rejected: decimals, negative numbers, hour notation, anything else.
    function normalizeIntervalInput(raw) {
      const v = (raw == null ? "" : String(raw)).trim();
      if (v === "") return { value: null, secs: null, error: null };

      // "no interval" family — accept several common phrasings.
      if (/^(no\s*interval|none|off|n\/a)$/i.test(v)) {
        return { value: NO_INTERVAL_CANONICAL, secs: null, error: null };
      }

      // Strip an optional leading "On " (case-insensitive) so the rest of the
      // logic sees only the time part. Also handle the case where the user
      // backspaced everything except the "On" prefix — treat as empty no-op.
      const stripped = v.replace(/^on\s*/i, "").trim();
      if (stripped === "") return { value: null, secs: null, error: null };

      // M:SS or :SS form (M optional, SS must be 1–2 digits).
      const colonMatch = stripped.match(/^(\d*):(\d{1,2})$/);
      if (colonMatch) {
        const mins = colonMatch[1] === "" ? 0 : parseInt(colonMatch[1], 10);
        const secs = parseInt(colonMatch[2], 10);
        if (secs >= 60) {
          return { value: null, secs: null, error: "seconds must be 0–59 (use M:SS, not S:SS)" };
        }
        const total = mins * 60 + secs;
        if (total < 5)    return { value: null, secs: null, error: "interval too short (minimum 5s)" };
        if (total > 3600) return { value: null, secs: null, error: "interval too long (max 1 hour)" };
        return { value: formatIntervalSecs(total), secs: total, error: null };
      }

      // Bare integer = total seconds (e.g. "90" → On 1:30).
      const intMatch = stripped.match(/^(\d+)$/);
      if (intMatch) {
        const total = parseInt(intMatch[1], 10);
        if (total < 5)    return { value: null, secs: null, error: "interval too short (minimum 5s)" };
        if (total > 3600) return { value: null, secs: null, error: "interval too long (max 1 hour)" };
        return { value: formatIntervalSecs(total), secs: total, error: null };
      }

      return { value: null, secs: null, error: `cannot parse "${v}" — try "1:30" or "90" or "no interval"` };
    }

    

    // v2.0 — Multi-lane fit check. Given an option (warmup/drill/main/cooldown
    // shape) and an array of lane pace strings (e.g. ["1:30", "1:45", "2:00"]),
    // returns true iff every set with a parseable interval leaves every lane
    // a rest time in [minRest, maxRestRatio * swimTime].
    //
    // The math:
    //   swimTime_L(set) = (paceL / paceBaseline) * baseSwimTime(set)
    //   rest_L(set)     = interval(set) - swimTime_L(set)
    // baseSwimTime is the "swim time at baseline pace" for this set —
    // approximated as (dist / 100) * paceBaseline since intervals are
    // authored relative to a 100-yd reference. This is the same model
    // rescaleBlocksForPace uses.
    //
    // Sets without an interval (NO_INTERVAL_CANONICAL, warmups, cooldowns)
    // are skipped (return true for that set — they're not interval-driven).
    // An option with NO interval-driven sets passes trivially.
    //
    // Edge cases:
    //   - Empty/null lanesPace: returns true (single-pace path, no filter)
    //   - Unparseable pace: skipped (treated as "any pace" — defensive)
    //   - dist <= 0 or missing: set skipped (defensive against bad bank rows)
    // Phase 3 / PSC slice 2 — hard-exclude check.
    // Returns true if `option` violates ANY constraint in `constraints`.
    // Used as step-0 of the picker (before favorites + disfavor) per
    // PER_SWIMMER_CONSTRAINTS_SCOPE.md §3.4.
    //
    // Constraint types handled here (12 of 14 — option-level):
    //   stroke_no_{fly,breast,back,free}     — checks option.strokes[] + label/desc fallback
    //   equip_no_{paddles,fins,snorkel,kickboard,buoy} — checks set.eq across all sets
    // Section + cap constraints are NOT option-level; caller handles those
    // separately at the section/post-assembly level.
    //
    // Equipment mapping (bank eq vocab → constraint type):
    //   "paddles" → equip_no_paddles  (rare; bank uses paddles in desc text only)
    //   "fins"    → equip_no_fins
    //   "snorkel" → equip_no_snorkel
    //   "kick"    → equip_no_kickboard  (eq="kick" implies kickboard-assisted)
    //   "pull"    → equip_no_buoy       (eq="pull" implies pull-buoy)
    

    // Phase 3 PSC slice 4 — substitution policy v1 (scope §3.5).
    // Pure function. Walks workout.blocks/sets against constraints, returns
    // per-set annotations describing what would be substituted FOR THIS
    // SWIMMER. Used by AssignedToMeView per-card details and by
    // MultiPacePrintView per-lane substitution rendering.
    //
    // Output shape:
    //   [
    //     { block_idx, set_idx, kind: "stroke_sub", from, to, constraint_type },
    //     { block_idx, set_idx, kind: "equip_drop", eq, constraint_type },
    //     { block_idx,          kind: "section_skip", section, constraint_type },
    //     {                     kind: "cap_yardage", value, constraint_type },
    //     {                     kind: "cap_intensity", value, constraint_type },
    //   ]
    //
    // The renderer decides how to display each kind. Section-skip + caps are
    // workout-level (no set_idx); stroke + equip are per-set.
    //
    // Substitution policy per scope §3.5 table.
    

    // Tag-extract used by the constraint UIs to render substitutions
    // attached to a particular block/set. Returns array of subs for that
    // (block_idx, set_idx) — pre-filtered for the renderer.
    function pickSetSubs(subs, blockIdx, setIdx) {
      if (!Array.isArray(subs)) return [];
      return subs.filter(s => s.block_idx === blockIdx && s.set_idx === setIdx);
    }
    function pickBlockSubs(subs, blockIdx) {
      if (!Array.isArray(subs)) return [];
      return subs.filter(s => s.block_idx === blockIdx && s.set_idx == null);
    }
    function pickWorkoutSubs(subs) {
      if (!Array.isArray(subs)) return [];
      return subs.filter(s => s.block_idx == null);
    }

    

    // ═══════════════════════════════════════════════════════════════
    //  TEMPLATE ENGINE (S1 — bank audit + 3 templates)
    //
    //  Generates bank-shaped option objects ({label, totalYards, sets[]})
    //  from structural templates. Complements the bank, doesn't replace
    //  it. Per TEMPLATE_ENGINE_SCOPE.md §2.
    //
    //  Output shape matches bank options EXACTLY:
    //    { label, totalYards, sets: [{ id?, reps, dist, desc, interval, focus, eq? }, ...] }
    //
    //  Intervals are authored at the canonical baseline pace (2:00/100,
    //  same as PACE_BASELINE_SECS in rescaleBlocksForPace). The existing
    //  rescaleBlocksForPace path adjusts them to the user's actual pace
    //  at render time — engine output integrates with the bank-fallback
    //  path with no special handling.
    //
    //  S1 = 3 templates (block_with_recovery, aerobic_volume,
    //  descend_ladder) chosen for combined ~24% bank coverage. S2 adds
    //  validator + anti-repeat + DB. S3 wires the per-section UI toggle
    //  and ⚡ badge.
    //
    //  Family selection priorities and definitions live in
    //  tools/bank_audit.json (run tools/bank_audit.py to refresh).
    // ═══════════════════════════════════════════════════════════════
      // 2:00 / 100 yd — matches rescaleBlocksForPace

    // Canonical SCY distances per spec §1 V2. Engine output must pick from this set.
    

    // Per-effort rest offsets (added to swim-time at baseline pace).
    // Tuned for masters; rescaleBlocksForPace adjusts proportionally for
    // faster/slower swimmers.
    

    // Compute interval = swim_time(dist) + rest(effort), rounded to 5s.
    

    // Pick a value from an array using a seeded-or-random index. The S2
    // anti-repeat layer will pass a seed; for S1 it's plain Math.random.
    

    // Given (distChoices, budget, [minReps, maxReps], preference), return
    // the {dist, reps} pair whose total comes closest to budget while
    // satisfying the rep-count constraint AND staying within ±5% (spec V1).
    // If no combination is within ±5%, returns the closest one anyway —
    // S2's validator will retry with a different template. preference can
    // be "longer" (bias toward longer dists when ties), "shorter" (bias
    // shorter), or "any" (uniform among candidates within tolerance).
    

    // Default stroke for a workout type. Stroke-specific types use that
    // stroke; free-axis types default to freestyle.
    

    // Stroke-name → desc-token (capitalization matches authored bank).
    

    // Distance bias by workout type — what rep distances make sense.
    // Picks from TEMPLATE_CANONICAL_DISTS subset appropriate to the type.
    

    // ── Template definitions ───────────────────────────────────────
    // Each template defines slots + generate(). Generate returns a bank-
    // shaped option object. S1 ships 3 templates; S2 adds 7-10 more.
    

    // ── Validator (S2.5 — spec §5) ───────────────────────────────────
    // Returns array of { code, msg } error objects. Empty array = passes.
    // V5 (mix-distribution) and V7 (cross-rep descending intervals) are
    // deferred: V5 needs picker context (mix pills) that engine doesn't
    // see yet (S3); V7 doesn't apply to current templates whose descend
    // shape is a single-row cue, not cross-rep intervals.
    

    // Engine entry point. Two surfaces:
    //   .generate(...)            — single-attempt template invocation.
    //                                 Returns bank-shaped option or null.
    //                                 No validation, no retry, no anti-repeat.
    //                                 Useful for tests and direct invocations.
    //   .generateWithRetry({...}) — validated invocation per spec §5.
    //                                 Hybrid retry-3 per Cap'n's S2.5 choice:
    //                                 attempt 1+2 = same template w/ new slots,
    //                                 attempt 3 = different applicable template
    //                                 (respecting anti-repeat). Returns
    //                                 { option, errors, attempts, templateUsed }
    //                                 or { option: null, ... } on full failure
    //                                 — caller falls back to bank.
    //   .validate(option, ctx)    — exposed validator.
    

    // Expose for browser-console smoke tests during S1/S2. Wired to UI in S3.
    if (typeof window !== "undefined") window.TEMPLATE_ENGINE = TEMPLATE_ENGINE;

    // ═══════════════════════════════════════════════════════════════
    //  UNIT CONVERSION — yd ↔ m
    //  Used by the bank-fallback path when a content gap forces us to
    //  pull options authored for a different pool unit. Distances get
    //  multiplied by 0.9144 (or 1/0.9144) and snapped to pool-realistic
    //  increments; intervals scale by the same ratio so per-unit pace
    //  stays equivalent. `label` and `desc` text are NOT rewritten —
    //  see the manual / code-quality-plan memory for why.
    // ═══════════════════════════════════════════════════════════════
    

    // Snap a distance to a pool-realistic increment:
    //   ≥100 → nearest 25 (matches typical 100/150/200/400/etc authoring)
    //   <100 → nearest 5  (captures 25/50/75 plus the occasional 15-yd
    //                       drill cue without forcing 0)
    
    
    

    // Convert a whole option (warmup/drill/main/cooldown) across the
    // unit boundary. Each set's dist + interval get converted; totalYards
    // is recomputed from the post-conversion sets. The returned option is
    // a fresh copy; the input is untouched. fromUnit / toUnit ∈ {"yd","m"}.
    

    // Unit-aware bank selection. Replaces the older ternary fallback that
    // returned yard-authored options to a meters-mode user without converting.
    // Fallback chain (defense in depth — today all three banks have full
    // coverage for all 9 typeIds, so the cross-unit branch is dead code now):
    //   25m → SCM → LCM → SCY    (SCM authored for 25m; LCM authored for 50m
    //                              but same unit; SCY needs yd→m conversion)
    //   50m → LCM → SCY          (skip SCM — different pool size)
    //   25y → SCY                (no fallback — SCY is the universal source)
    //
    // `kind`   — "warmup" | "cooldown" | "drill" | "main"
    // `typeId` — workout type (ignored for flat warmup/cooldown banks)
    // `poolMode` — "25y" | "25m" | "50m"
    

    // UGC overlay extractor for picker. Returns array of options
    // matching (kind, typeId, poolMode) exactly from the UGC overlay
    // object. ugcOverlay shape matches the 12 JS bank constants.
    // Spec: UGC_COACH_SETS_SCOPE.md §7.
    

    // ─── Catalog data accessor (used by CatalogView) ────────────────────
    // Returns the AUTHORED options for a given (kind, typeId, poolMode)
    // tuple — no cross-unit fallback, no conversion, no .mixed fallback.
    // The catalog browse intentionally shows the bank as authored, so a
    // coach can see what's actually in each bucket per pool mode.
    //
    // typeId === "all" (only valid for kind=drill/main) returns ALL typed
    // entries flattened, with each option carrying its source `_typeId`.
    //
    // Phase III note: when editable bank lands, this is the right hook
    // to merge in DB overrides (or whatever the writeback mechanism becomes).
    

    // Format a workout as plain text for clipboard sharing.
    function workoutToText(workout, meta, paceInput, unit = "yds") {
      if (!workout) return "";
      const lines = [];
      const estMin = calcEstimatedMin(workout.blocks);
      lines.push(`${meta.label} Swim Workout — ${workout.totalYards.toLocaleString()} ${unit} (~${estMin} min)`);
      if (paceInput) lines.push(`Pace target: ${paceInput}/100`);
      lines.push("");
      for (const block of workout.blocks) {
        // Section model B — dryland blocks (no swim sets) render as an
        // exercise list in copied text.
        if (block.kind === "dryland" || !Array.isArray(block.sets)) {
          lines.push(`${(block.name || "DRYLAND").toUpperCase()}  (dryland · ${block.placement === "post" ? "after pool" : "before pool"})`);
          for (const e of (block.exercises || [])) {
            lines.push(`  ${e.sets > 1 ? e.sets + " × " : ""}${e.reps} — ${e.name}${e.rest ? ` (rest ${e.rest})` : ""}`);
          }
          lines.push("");
          continue;
        }
        const rounds = block.rounds || 1;
        const roundNote = rounds > 1 ? `  ×${rounds} rounds, ${block.roundRestSecs ?? 30}s rest between` : "";
        lines.push(`${block.name.toUpperCase()}  (${block.totalYards.toLocaleString()} ${unit})${roundNote}`);
        const renderSets = () => {
          for (const set of block.sets) {
            const ivl = set.interval ? ` @ ${set.interval}` : "";
            lines.push(`  ${set.reps} × ${set.dist} — ${set.desc}${ivl}`);
          }
        };
        if (rounds > 1) {
          for (let r = 1; r <= rounds; r++) {
            lines.push(`  — Round ${r} —`);
            renderSets();
            if (r < rounds) lines.push(`  (${block.roundRestSecs ?? 30}s rest)`);
          }
        } else {
          renderSets();
        }
        lines.push("");
      }
      return lines.join("\n").trimEnd();
    }

    // Sum reps×interval across all sets; fall back to 35 yd/min for sets with no interval.
    

    // S4 #18 — Memoized cache of all `dist` values appearing in any option's
    // sets, per pool mode. Used to gate longer-swaps: we only offer a longer
    // version if the bank actually contains sets at that distance, rather than
    // hardcoding a 400 cap that drifts between yd / m.
    
    

    // S4 #8 — Riegel-ish exponent for distance↔interval scaling on swaps.
    // T2 = T1 × (D2/D1)^EXP. EXP=1.06 is the standard "Riegel" coefficient
    // for fatigue-aware time prediction in middle-distance running/swimming.
    // Real swim data sits in the 1.05–1.10 range across stroke + pool size.
    
    

    // S4 #8 + #18 — getEquivalents now takes poolMode so it can:
    //   1. Apply a Riegel-ish (non-linear) interval scale instead of a flat ratio
    //      (linear under-corrected the interval for sprints and over-corrected
    //      for long aerobic doubling).
    //   2. Gate BOTH swaps on whether the bank actually contains sets at the
    //      target distance — catches half-yard / half-meter outputs (e.g. 75yd
    //      shorter would be 37.5, which no pool supports) and unauthored long
    //      distances. Replaces the old hardcoded 400 cap.
    //   3. Suppress both swaps when the description encodes within-set
    //      structure (e.g. "25 Fly Drill / 25 Back Drill / 25 Breast Drill"
    //      describes a 75-yd structure that doesn't survive a 2× / ½× rescale).
    //      Heuristic: desc contains `<digits><text>/<digits>` — a numeric
    //      breakdown separated by a slash.
    
    

    // ═══════════════════════════════════════════════════════════════
    //  COMPONENTS
    // ═══════════════════════════════════════════════════════════════





    // ═══════════════════════════════════════════════════════════════
    //  DRYLAND (Section model Part B) — non-swim blocks: exercises with
    //  sets×reps, no distance/interval/pace. Live in the same workout
    //  blocks[] array with kind:"dryland"; rendered by DrylandBlock (NOT
    //  WorkoutBlock) via a call-site dispatch. Excluded from yardage math
    //  (totalYards:0). Inserted post-generation, never engine-generated.
    // ═══════════════════════════════════════════════════════════════
    // Starter bank — curated dryland blocks a coach can drop in. `reps` is a
    // free string ("12", "30s", "10 each side"). `placement` is the default
    // (pre/post); the coach can override at insert time.
    

    // Plain-language explainer per dryland exercise — what it is, how to do it,
    // and why it matters for swimmers. Keyed by the EXACT exercise `name` used
    // in DRYLAND_OPTIONS (the iOS DrylandGlossary mirrors these same keys).
    // Shown as a hover tooltip (+ ⓘ marker) on each exercise row.
    

    // Make a fresh dryland block (deep-copies exercises so edits don't mutate
    // the bank). `totalYards:0` keeps it out of all yardage math.
    

    // Renderer for a dryland block. Exercise list (sets × reps, optional rest);
    // no pace clock, no swap/interval/favorite affordances. `onRemove` optional.
    // `onChange(updatedBlock)` makes the block editable (✎ toggle → inline
    // exercise editor with a local draft, committed on Done). Passed only at
    // the main workout display; read-only everywhere else.


    // ─── Max Yardage Slider ──────────────────────────────────────────
    // Compute the minimum possible total yards for a given type
    


    // ═══════════════════════════════════════════════════════════════
    //  SAVE-TO-HISTORY FORM — appears below a freshly generated workout
    // ═══════════════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════════════
    //  HISTORY VIEW — list, filter, expand, edit notes, delete, re-print
    // ═══════════════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════════════
    //  PACE CLOCK
    //  Tap a set card to step through reps with a live countdown.
    // ═══════════════════════════════════════════════════════════════

    // Returns true when viewport is wider than it is tall (landscape).
    

    // Parse "On 2:00", "On :45", "On 1:10" → seconds. "No interval" → null.
    

    


    // ═══════════════════════════════════════════════════════════════
    //  REST PICKER MODAL — shown when tapping "Run Workout"
    // ═══════════════════════════════════════════════════════════════

    

    // ═══════════════════════════════════════════════════════════════
    //  PROFILE / ACCOUNT MODAL — identity, stats, active sessions
    // ═══════════════════════════════════════════════════════════════
    // Goal metric metadata — shared by ProfileModal (set/edit) and the
    // generator stats panel (progress bars).
    

    // Single editable row used in the Profile modal's Identity panel.
    // Click "Edit" → input + Save/Cancel. onSave throws on validation error.
    // JoinGroupSection (R-F) — swimmer-side code redemption in Profile modal.
    // Open to all authenticated users; surfaces specific errors (DOB required,
    // #33 conflict, already-in-group, expired, etc.). On success, parent
    // refreshes me + history.

    // Profile gender row — matches EditableProfileField row layout but uses a
    // select. Saves through PATCH /api/me (same endpoint, gender is in the
    // allowed-fields list per migration 014 / db.js dbUpdateMe).



    // N5: PhaseRow lives in the Profile modal Goals section. Five buttons,
    // single-select; clicking the active one clears the phase.

    // N7: BenchmarksSection lives in the Profile modal Goals area. Logs
    // standard test-set results (T-30, 500 TT, Broken 500) and auto-fills
    // the generator paceInput from the latest t30/tt500 (broken500 is
    // sprint-focused so does NOT auto-fill aerobic pace).

    // J: LevelRow lives in the Profile modal Goals section. Three buttons,
    // single-select; clicking the active one clears the level. Picking a
    // level immediately overwrites paceInput with the level's preset pace
    // (handled in the caller via onChange's second arg).


    // Session 5: user → admin feedback modal. Auto-captures page + user agent.
    // Cat Phase II (2026-05-15): accepts initialCategory/initialSubject/initialBody
    // so the catalog's per-option flag button can prefill an option-identity report.

    // W2 — Natural-language intent parser modal. Coach types a one-liner;
    // parseIntent extracts known tokens; user previews chips and clicks
    // Apply to push values into the generator form. Apply behavior is
    // owned by App via the onApply callback so the modal stays a pure UI.

    // ═══════════════════════════════════════════════════════════════
    //  N6 — Multi-pace export
    //  Modal for picking pace source + render mode; print overlay that
    //  renders the same workout at N paces. Coach-only, group-only.
    // ═══════════════════════════════════════════════════════════════

    // Parse "M:SS" → seconds; null on bad input.
    

    // v2.0 — Multi-lane multi-pace generate control. Sits below YardageSlider
    // when the viewer is a coach. Toggle ON expands to N lane rows; user
    // edits paces; the picker filters options that fit ALL lanes.
    // v3 impersonation — dedicated quick-start modal. Top-nav button opens
    // this; coach/support types a name/email fragment, picks a target, hits
    // Confirm. Fetches /api/admin/users (admin-gated server-side) so the
    // search list is the same source-of-truth as AdminUsers. Read-only safe.

    // v3 impersonation banner. Persistent sticky red bar at the top of the
    // app while an impersonation session is active. Shows target identity +
    // a countdown to expiry + Exit button. Ticks every 5s. Auto-fires the
    // exit when the timer hits zero so the UI doesn't get stuck.


    // Take a blocks array, rescale every set's interval to a target pace.
    // No-op for unparseable paces or "No interval" sets (scaleInterval
    // already returns the input untouched in that case).
    


    // Print overlay. Renders the workout at every lane's pace. Mounts as
    // a fullscreen layer that hides the rest of the app via body class.

    // Phase 3 PSC slice 4 — read-only Active Constraints subsection.
    // Spec: PER_SWIMMER_CONSTRAINTS_SCOPE.md §3.9. Read-only by decision #7
    // (coach is write authority). Lives inside ProfileModal so swimmers see
    // their constraints in the same place they see favorites/disfavorites.


    // ═══════════════════════════════════════════════════════════════
    //  ADMIN VIEW — users, invites, audit log
    // ═══════════════════════════════════════════════════════════════
    // ─── Catalog view (Phase I read-only browse) ────────────────────────
    // Coach-gated. Walks the AUTHORED workout-set bank for the selected
    // pool mode / section / type and lists labels + totalYards + set count.
    // Click a row to expand the full set list. Search by label, filter by
    // equipment / zone. Print stylesheet expands everything for paper.
    
    
    // Synthetic "all equipment on" state — passed to equipmentForSet so the
    // catalog renders every applicable badge regardless of the user's actual
    // equipment selections.
    

    // Does this option's sets satisfy the given equipment requirement key?
    // (Reuses EQUIP_REQUIREMENTS — the same mapping the generator uses.)
    

    // Teams view (relationships scope, Stage 1 / R-A).
    // Coach-gated container for the team layer of the org hierarchy. v1
    // surfaces only the owner role; team-admin tier is in the data model
    // but not exposed in UI until R-J. See RELATIONSHIPS_SCOPE.md.
    // Parent dashboard (PARENT_PORTAL_MVP_SCOPE.md §3 — 2026-05-27).
    // Top-level view for users with at least one active guardian row.
    // Shown when they toggle 👪 in nav, regardless of whether they're
    // also a coach or swimmer themselves. The dashboard surfaces last
    // week's recap + this-week schedule for each linked swimmer,
    // plus a pause-digest toggle. Read-only — no write actions from
    // here per spec.

    // Team roster v1 (2026-05-27). 🏊 Roster tab in TeamsView showing every
    // swimmer in any active group under the team, grouped by group section.
    // Read-only for all team coaches. Backed by /api/teams/:id/roster.

    // Team Curation v1 (TEAM_CURATION_SCOPE.md slice 4 — 2026-05-27).
    // Settings tab inside TeamsView. Owner + admin can write team-level
    // favorites/disfavorites + 3 defaults (pace_base, disfavor_mode,
    // equipment_modes). Regular coaches see read-only with "set by … on …"
    // attribution. Apply-to-roster button (v1: pace_base only) bulk-pushes
    // the default to every active swimmer in any group under the team.


    // AssignedToMeView (Stage 4 / R-G) — swimmer-side list of workouts
    // assigned to them by coaches. Filterable by completion state. Click a
    // row to expand the workout in place; mark complete / partial / missed
    // inline OR run via Run-mode (which then writes back to the assignment).
    

    // ClaimTokensPanel (Stage 5 / R-I) — coach-side managed-swimmer claim
    // token issuer. Per scope §10 + decision #16: confirmation dialog before
    // issuing because claim is destructive (managed row dies after redeem).
    // Per #28: blocked for under-13 (COPPA) and for parent_managed_flag.

    // ClaimManagedSection (Stage 5 / R-I) — swimmer-side claim redemption in
    // Profile modal. Paste code → preview ("you're about to claim Sarah's
    // managed profile from Coach Foo") → confirm → redeem. Post-claim diff
    // screen per decision #30: "we updated these fields on your account."

    // CoachNotesPanel (Stage 5 / R-H) — coach-side private notes journal
    // attached to a managed swimmer (or full-account swimmer after claim).
    // Visibility per-note: private / group_coaches / team_coaches. Default
    // visibility derived from the swimmer's team_type (high_school →
    // team_coaches; everyone else → private).

    // IntentForm (I Phase 2a) — capture generator params for a scheduled
    // intent-mode row. Opens with optional pre-fill from an existing intent
    // row (edit mode). On submit POSTs to /api/scheduled-workouts with
    // intent_params, or PATCHes if editingId is set.

    // IntentPreviewOverlay (I Phase 2a) — fullscreen preview when the user
    // clicks ▶ Generate on an intent row. Shows the freshly-generated
    // workout + Run / Regenerate / Cancel actions. On Run: PATCHes the
    // schedule row's payload (intent → payload conversion) and hands off
    // to the parent to load into Run mode.

    // WeekView (I — Week-view planning, Phase 1) — 7-day ISO-week grid
    // (Monday → Sunday). Lists each user's own scheduled-workout rows per
    // day. Actions: ▶ Run (loads into Run mode, link via runScheduledId),
    // ✎ Edit (loads back into generator), 🗐 Copy to (date picker), 🗑 Delete.
    // Completed rows show a green ✓ + workout link.
    // ═══════════════════════════════════════════════════════════════
    //  REPORT PRINT VIEW — Reporting v1 Phase E
    //  Mirror of MultiPacePrintView pattern: overlay, body class for
    //  CSS scoping, auto-print on mount, Close button to exit.
    //  Per-report layouts (R1-R4); R5/R6 share-out has no use case so
    //  export buttons hidden for those tabs.
    // ═══════════════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════════════
    //  REPORTS VIEW — Reporting v1 Phase B (R1-R3 coach reports)
    //  Spec: REPORTING_SCOPE.md §2 + §5. Self-only (gated to current
    //  coach via server). Numbers + tables only — no charts in v1
    //  (deferred per Cap'n's scope call).
    // ═══════════════════════════════════════════════════════════════
    

    // Build a markdown export for any tab. Walks the report JSON and emits
    // headers + tables. Single shared helper — markdown is naturally flexible
    // enough that per-report templates aren't worth the maintenance.
    

    // Phase 5 #2 — Swimmer Progress Dashboard. A swimmer-facing surface (not
    // buried in Reports/Profile) that assembles existing data: training volume
    // from R4 Program Recap (/api/reports/program-recap) + benchmark PRs/trend
    // (/api/benchmarks) + the existing BenchmarksSection logger. Free/ungated —
    // it's the free-tier retention lever. No server/DB changes.


    // R2 — Schedule Adherence tab body.

    // R3 — Curation Log tab body. Three subsections (labels / sets / engine).

    // R4 — Program Recap (Reporting v1 Phase C). Solo/masters report.
    // Stat cards + reused tables + most/least-used templates + 4-stroke
    // balance grid + multi-lane fit success rate.

    // R5 — Platform Health (Reporting v1 Phase D, admin only).

    // R6 — Curation & Support Activity (admin only).

    // Reporting Phase A — modal for marking a scheduled practice done +
    // PracticesView — a dedicated coach screen that surfaces attendance/roll-call
    // outside the week grid. Lists scheduled practices over a date window
    // (default: this week + the next 3) and opens the SAME MarkPracticeDoneModal
    // the week view uses, so behavior stays identical. Additive: the week-view
    // "📋 Mark done" button is unchanged. Intent-mode rows (not yet generated)
    // can't take attendance, so they're shown disabled with a hint.

    // recording attendance. Fetches /attendance-context to get roster
    // (point-in-time) + any existing attendance, renders roster pre-checked,
    // POSTs /complete on save. Group-less workouts (solo / no roster) get
    // a simpler "Just mark done" path with no checklist.



    // GroupAssignmentsPanel — coach-mark-on-behalf (Flow N, R-G). Lists
    // recent assignments fanned out from this group + lets the coach mark
    // any swimmer's completion state from the deck. Sets completed_by_coach_sub
    // so the swimmer sees "marked by coach" on their side.

    // JoinTokensPanel — coach-side invite-code issuer + outstanding list.
    // Inside GroupRow expanded view (R-F). Primary coach can issue + revoke;
    // any group coach can read.

    // LanePlansPanel — inside GroupRow, renders the list of lane plans for
    // a group plus an in-place editor. Hidden for solo groups per decision
    // #17 (groups with member_count < 2). Read by any group coach; write by
    // group primary coach only. Plan structure JSON per scope §7.

    // GroupRow — expandable component for a group within TeamsView's team
    // detail (R-C). Shows header (name, phase, member count) and expands to
    // members + coaches + phase setter + visibility/archive controls.
    
    


    // Managed Swimmers view (relationships scope, Stage 1 / R-B).
    // First-class top-level coach roster per decision #31 — shows ALL managed
    // swimmers regardless of group placement. Coach-gated. DOB required at
    // create per decision #27; minor status (#28) is DERIVED, never stored.

    // Bounds for the DOB date input. min: 1900-01-01 (sane lower bound);
    // max: today (no future-born). Both as YYYY-MM-DD strings for input[type=date].
    
    

    // ═══════════════════════════════════════════════════════════════
    //  Per-Swimmer Constraints (PSC) — slice 3 coach UX
    //  Spec: PER_SWIMMER_CONSTRAINTS_SCOPE.md §3.8
    //  Decisions (Cap'n 2026-05-26):
    //    - Managed Swimmers only for v1 (real-user swimmers via API)
    //    - Edit = delete + recreate (no PATCH route)
    // ═══════════════════════════════════════════════════════════════

    // Closed vocab — keep in sync with migration 037 ENUM and db.js PSC_TYPES.
    

    // Flat lookup for label rendering.
    

    

    // Add/Edit modal. Edit = caller passes prefill from a soft-deleted row.

    // Parents/Guardians subsection (Parent Portal MVP — 2026-05-27).
    // Slots into the managed-swimmer detail view alongside Constraints +
    // CoachNotes. Coach types a parent email → backend enqueues an
    // invite email; parent signs in via Apple/Google with that email and
    // the join completes server-side. Already-linked guardians can be
    // removed (one-way; the parent has to be re-invited if removed).
    // Pending invites can be revoked before the parent acts on them.

    // Per-managed-swimmer Constraints subsection. Slots into the swimmer
    // detail view between ClaimTokensPanel and CoachNotesPanel.


    // Gender enum constants (matches db.js GENDER_VALUES). Labels used in
    // pickers; raw values are M / F / X / prefer_not_to_say.
    
    

    // Shared form component for create + edit. Pure presentation.

    // ── Bulk-import helpers (R-B') ────────────────────────────────────
    // Simple CSV/TSV parser — handles quoted strings with embedded delimiters
    // (Excel/Sheets export shape), auto-detects comma vs tab, requires a
    // header row. NOT a full RFC 4180 parser; handles 99% of coach exports.
    // I-H: names import as first_name + last_name (+ optional preferred_name).
    // The legacy single `name` column is still accepted and split on the last
    // space, with a per-row warning so the coach can verify the split.
    // Required: dob + a name (first_name OR legacy name).
    
    // Every header the parser recognizes (superset; legacy `name` included).
    
    // Accept several spellings of gender in CSV (case-insensitive). Map to enum.
    

    

    

    // Normalize + validate one row. Returns {ok, normalized?, error?}.
    

    

    


    // DOB soft-prompt modal (decision #37). Surfaces when authenticated and
    // me.dob is null. Dismissable; sessionStorage prevents re-nagging within
    // a single browser session. Hard gates (group join, coach invite accept)
    // will re-prompt unconditionally when they ship in R-F.
    const DOB_PROMPT_DISMISS_KEY = "setforge.dob_prompt_dismissed_v1";



    // ─── My Sets (UGC authoring, Phase C) ────────────────────────────────
    // List + create + edit + delete coach-authored UGC bank options.
    // Phase C scope: visibility forced to 'private' server-side.
    // Spec: UGC_COACH_SETS_SCOPE.md §3.A + §3.C.

    // UGC author/edit form modal. Phase C: visibility forced to private
    // server-side regardless of selection (no team/public flow yet).
    // option=null → create; option={...} → edit (with pre-fill).
    // onSave called after a successful POST/PATCH (parent re-fetches list).


    // Phase E — admin moderation queue for public UGC submissions.
    // Lists visibility='pending' rows with author info + preview +
    // approve/reject controls. Reject requires a reason.

    // Phase F — Graduate-to-JS admin tab. Lists visibility='public' AND
    // promoted_at IS NULL rows. Per-row Graduate button opens UgcGraduateModal
    // which shows the JS snippet + paste instructions. Admin pastes locally,
    // commits, pushes, then confirms → server stamps promoted_at and the
    // row leaves this list (also leaves the overlay endpoint per visibility
    // scoping).

    // Two-step graduate modal. Fetches snippet on open; admin copies +
    // commits + pushes locally + waits for Hyperlift redeploy, then
    // clicks "Confirm" which POSTs the graduate route → stamps promoted_at.

    // Session 5: admin feedback tab. Lists feedback rows, filterable by status.
    // Each row has inline status pills + admin note edit. Default filter "new".




    // Audit log group chips. Each maps to the server-side AUDIT_EVENT_GROUPS
    // patterns. Default ON for everything except impersonation (the
    // impersonation.access per-request rows are extremely high volume and
    // bury other events; admin can re-enable when investigating support
    // sessions). Saved per-session in component state.
    // Admin-only email-test surface. Fires POST /api/admin/email/test which
    // routes through enqueueEmail (lib/email.js) — same path as the real
    // sign-up welcome. The worker picks the row up within ~30s on its next
    // tick. Result display surfaces whichever branch enqueueEmail returned:
    //   { id }              — queued; email arrives within ~30s
    //   { bypassed: ... }   — minor-bypass triggered; check your DOB on file
    //   { skipped: ... }    — EMAIL_ACTIVE=false, no email, etc

    // Admin-only Stripe-config diagnostic. Hits GET /api/admin/billing/config
    // which returns billingConfigState() from lib/billing.js — booleans for
    // each field's presence (NOT the secret values). Lets us confirm
    // at-a-glance whether STRIPE_CONFIG parsed cleanly + every field landed
    // without grepping Hyperlift logs or echoing secrets to stdout.

    // Phase 3 vendor paper kit (deliverable 3 of 4).
    // Per VENDOR_PAPER_KIT_SCOPE.md §3.5. Server route POST
    // /api/admin/vendor-kit/send returns the rendered cover-letter +
    // attachment filenames; the client opens a mailto: with subject +
    // body pre-filled. Cap'n attaches PDFs from vendor-kit/build/
    // manually in his mail client. Audit log captures the send.



    // ═══════════════════════════════════════════════════════════════
    //  RUN WORKOUT OVERLAY
    //  Full-screen step-through: one section at a time, iPhone-sized.
    // ═══════════════════════════════════════════════════════════════

    


    // ═══════════════════════════════════════════════════════════════
    //  ACCESS GATE
    // ═══════════════════════════════════════════════════════════════

    // SignInGate is the public-facing surface for setforge.io. It serves three
    // audiences in one page: (1) existing users with invites who just want to
    // sign in, (2) cold prospects who landed without context, (3) prospects who
    // bounced off a coach's recommendation and need to request access.
    //
    // Phase 1 item 5 (PHASED_PLAN_2026-05-25.md): expanded from "logo + sign-in
    // button on a gradient" into a real marketing landing. Cap'n homework: the
    // screenshot below is a stylized mock — swap for a real screenshot when
    // available (PHASED_PLAN §8 open follow-up).
    //
    // Copy decisions locked as defaults (revise freely):
    //   - Hero tagline: "Swim workouts in seconds." (matches og-image.png)
    //   - Subtitle: "Generator and pace clock for coaches and their swimmers."
    //   - 3 value props: free-for-swimmers-forever / no-ads-trackers-passwords /
    //     coach-pays-$10 + solo-founder. Marketing's "lean-in" set.
    //   - Primary CTA: Sign in with Apple (existing). Secondary: "No invite?
    //     Request one" mailto. Google OAuth slot pre-wired but commented out.

    // ═══════════════════════════════════════════════════════════════
    //  ONBOARDING TOUR OVERLAY
    // ═══════════════════════════════════════════════════════════════
    // Spotlight coachmark over a data-tour anchor + a tooltip card.
    // No external libraries. The dim ring uses a large box-shadow "hole"
    // and is pointer-events:none so the highlighted control stays
    // clickable (so the final "tap Generate" step actually works). If an
    // anchor is missing, the card falls back to screen-center so the tour
    // never dead-ends.

    // ═══════════════════════════════════════════════════════════════
    //  TEAM PRACTICE FACILITIES (Locations P1)
    // ═══════════════════════════════════════════════════════════════
    // One-or-more pools per team (generalizes the old single "school"
    // field). Read for any team member; add/edit/archive for owner/admin.

    // ═══════════════════════════════════════════════════════════════
    //  HOME ADDRESS MANAGER (Locations P2)
    // ═══════════════════════════════════════════════════════════════
    // Manages a person's home address(es) via /api/swimmers/:ref/addresses.
    // The server gates access (self+guardians always; coach only with the
    // consent toggle on) — a 403 just renders "not shared". showConsent adds
    // the guardian/self consent toggle ("coaches may view this address").

    // Household/siblings (Locations P3) — read-only derived display. Server
    // gates it (shared address+guardian, per-sibling consent), so we just
    // render whatever names come back; nothing if none/not-authorized.

    // ═══════════════════════════════════════════════════════════════
    //  PARENT INVITE ACCEPT CARDS
    // ═══════════════════════════════════════════════════════════════
    // Explicit-consent surface: a parent with pending invites (from
    // bootstrap.pending_invites) sees one card per invite and must Accept
    // (creates the guardian link) or Decline. Replaces the old silent
    // auto-consume. Renders for any signed-in user with a pending invite,
    // even before they're a linked parent.

    // ═══════════════════════════════════════════════════════════════
    //  MAIN APP
    // ═══════════════════════════════════════════════════════════════

    export function App() {
      const [selectedType, setSelectedType] = useState(null);
      const [maxYards, setMaxYards]         = useState(2400);
      const [poolMode, setPoolMode]         = useState("25y");
      const [paceInput, setPaceInput]       = useState("2:00");
      // Onboarding tour. tourStep -1 = inactive, 0..N-1 = active step.
      // tourSeen defaults true so the tour never flashes before settings
      // resolve; applySettings sets the real value (unset → false → auto-run
      // once). tourSeenWriteRef guards the one-time persist.
      const [tourStep, setTourStep]         = useState(-1);
      const [tourSeen, setTourSeen]         = useState(true);
      const tourAutoRef     = React.useRef(false);
      const tourSeenWriteRef = React.useRef(false);
      // v2.0 — multi-lane mode (coach-only). When ON, picker filters
      // options to those whose intervals fit ALL lane paces, and the
      // generate flow auto-routes to MultiPacePrintView. manualLanesPace
      // holds { lane_label, pace } rows; user types or seeds from a plan.
      const [multiLaneMode, setMultiLaneMode] = useState(false);
      const [manualLanesPace, setManualLanesPace] = useState([
        { lane_label: "Lane 1", pace: "1:45" },
        { lane_label: "Lane 2", pace: "2:00" },
      ]);
      const [sliderMin, setSliderMin]       = useState(1900);
      const [sliderMax, setSliderMax]       = useState(5000);
      const [workout, setWorkout]           = useState(null);
      const [hover, setHover]               = useState(null);
      // F: equipment is tri-state per item — "off" | "preferred" | "required".
      // Initial state is all "off"; values are loaded from settings.extra.equipment_modes
      // on mount (legacy booleans are normalized via equipMode()).
      const [equipment, setEquipment]       = useState({
        kickboard: "off", fins: "off", paddles: "off", pullBuoy: "off", snorkel: "off",
      });

      // History state
      const [view, setView]                       = useState("generator"); // "generator" | "history" | "admin"
      const [history, setHistory]                 = useState(() => loadLocalHistory());
      const [historyLoaded, setHistoryLoaded]     = useState(false);
      const [favorites, setFavorites]             = useState([]);
      // v1.2 — Disfavorites: labels with 0.25× pick weight (inverse of fav).
      // Loaded on mount alongside favorites; toggled via /api/disfavorites.
      // Mutex with favorites enforced at the DB layer (dbAdd* helpers clear
      // the opposite table on insert).
      const [disfavorites, setDisfavorites]       = useState([]);
      // v1.3 — Engine disfavorites: array of { template_id, stroke } pairs
      // the user has marked as disfavored in engine output. 0.25× weight in
      // the engine template picker. Persisted to settings.extra (no DB table).
      const [engineDisfavorites, setEngineDisfavorites] = useState([]);
      // v1.8 — Disfavor mode: "downweight" (0.25× weight, default) or
      // "exclude" (hard-exclude, weight 0 with silent fallback if pool
      // empties). Applies to ALL disfavor types (label, set, engine).
      // Persisted to settings.extra.disfavor_mode.
      const [disfavorMode, setDisfavorMode] = useState("downweight");
      // Set-level per-user favorites — Set<set_id> for O(1) lookup. Loaded
      // alongside label-favorites; toggled via /api/favorite-sets endpoints.
      const [favoriteSets, setFavoriteSets]       = useState(() => new Set());
      // v1.5 — Set-level disfavorites: Set<set_id>. 0.25× pick weight per
      // matching set inside an option (vs favorite-sets' 3×). Mutex with
      // favorite-sets enforced at the DB layer. Loaded on mount; no UI
      // in v1.5 (mirrors favorite-sets' API-only setup) — future catalog
      // or coach view can wire the toggle handler.
      const [disfavorSets, setDisfavorSets]       = useState(() => new Set());
      // v1.7 — Effective disfavorites (own + coach propagation). Fetched
      // from /api/effective-disfavorites on mount. Used by the picker so
      // primary coach's disfavorites silently apply to swimmers in their
      // group. The audit panel + tri-state UI still read the OWN lists
      // (disfavorites + disfavorSets + engineDisfavorites) so swimmers
      // don't see coach contributions in their UI.
      const [effectiveDisfavorLabels, setEffectiveDisfavorLabels] = useState([]);
      const [effectiveDisfavorSetIds, setEffectiveDisfavorSetIds] = useState(() => new Set());
      const [effectiveEngineDisfavorites, setEffectiveEngineDisfavorites] = useState([]);
      // v1.13 — Effective favorites mirror. Own favorites + coach (primary
      // + assistant) favorites silently boost picks. Audit panel still
      // own-only via /api/favorites + /api/favorite-sets.
      const [effectiveFavoriteLabels, setEffectiveFavoriteLabels] = useState([]);
      const [effectiveFavoriteSetIds, setEffectiveFavoriteSetIds] = useState(() => new Set());
      const [effectiveEngineFavorites, setEffectiveEngineFavorites] = useState([]);
      // v1.13 — Own engine favorites (separate from effective so the
      // audit panel can list user's own without coach contributions).
      // Lives in settings.extra.engine_favorites, loaded on mount.
      const [engineFavorites, setEngineFavorites]               = useState([]);
      // Phase 3 PSC slice 2 — caller's own active per-swimmer constraints.
      // Fetched from /api/me/constraints on mount + 5-min poll. Fed into
      // generateWorkout/regenerateSection as step-0 hard-exclude. Per Cap'n
      // fork 2 (2026-05-26): we apply the caller's OWN PSC to every Generate
      // — solo, coach-Generate, etc. Slice 3 adds coach UX + per-practice
      // checklist for assignments targeting specific swimmers.
      const [myConstraints, setMyConstraints] = useState([]);
      // Phase 3 PSC slice 3 — per-practice checklist.
      // groupActiveConstraints: { [swimmerKey: sub|managed_id]: [constraint rows] }
      // tonightSelected: Set<constraint_id> of rows the coach checked for THIS Generate.
      // groupActiveConstraints refetches on target group change. tonightSelected
      // resets to empty (default to NOT applying — coach opts in per practice).
      const [groupActiveConstraints, setGroupActiveConstraints] = useState({});
      const [tonightSelected, setTonightSelected] = useState(() => new Set());
      // UGC Phase B — bank overlay. Mirrors the 12 JS bank constants;
      // populated by /api/bank/my-overlay (own + team-shared + public
      // UGC, excluding promoted_at). Picker merges with simple concat
      // per constant. Empty 12-key shape until authoring lands (Phase C).
      const [ugcOverlay, setUgcOverlay] = useState(() => ({
        WARMUP_OPTIONS: [], COOLDOWN_OPTIONS: [], DRILL_OPTIONS: {}, MAIN_OPTIONS: {},
        WARMUP_OPTIONS_50M: [], COOLDOWN_OPTIONS_50M: [], DRILL_OPTIONS_50M: {}, MAIN_OPTIONS_50M: {},
        WARMUP_OPTIONS_SCM: [], COOLDOWN_OPTIONS_SCM: [], DRILL_OPTIONS_SCM: {}, MAIN_OPTIONS_SCM: {},
      }));
      // UGC Phase C — snapshot button on WorkoutBlock opens UgcFormModal
      // pre-filled with the block's data. null = closed, object = open
      // with that pseudo-"option" pre-populated.
      const [snapshotOption, setSnapshotOption] = useState(null);
      // Sub IDs used to classify a 'selectedType' value as a TYPE vs STROKE
      // when building the snapshot pre-fill (drill/main need one of the two).
      const UGC_TYPE_KEYS_CLIENT   = React.useMemo(() => new Set(["im","distance","sprint","endurance","mixed","technique"]), []);
      const UGC_STROKE_KEYS_CLIENT = React.useMemo(() => new Set(["back","breast","fly","free","im"]), []);
      // Pre-built Map of UGC overlay set IDs → { _is_own, _visibility }
      // for the badge derivation in WorkoutBlock. Phase D needs the
      // metadata (not just presence) to pick the right badge variant:
      //   📝 = your own (any visibility)
      //   👥 = team-shared from another coach (_visibility === 'team')
      //   🌐 = admin-approved public from another coach (Phase E)
      const ugcSetIdMeta = React.useMemo(() => {
        const out = new Map();
        if (!ugcOverlay) return out;
        const walkOptionList = (list) => {
          if (!Array.isArray(list)) return;
          for (const opt of list) {
            if (opt && Array.isArray(opt.sets)) {
              const meta = {
                _is_own:     !!opt._is_own,
                _visibility: opt._visibility || null,
              };
              for (const s of opt.sets) if (s && s.id) out.set(s.id, meta);
            }
          }
        };
        for (const key of Object.keys(ugcOverlay)) {
          if (key.startsWith("_")) continue;
          const val = ugcOverlay[key];
          if (Array.isArray(val)) {
            walkOptionList(val);
          } else if (val && typeof val === "object") {
            for (const subKey of Object.keys(val)) walkOptionList(val[subKey]);
          }
        }
        return out;
      }, [ugcOverlay]);

      const handleSnapshotBlock = useCallback((block) => {
        if (!block || !block.sets) return;
        const needsType = (block.section === "drill" || block.section === "main");
        const sel       = selectedType || "";
        const isStroke  = UGC_STROKE_KEYS_CLIENT.has(sel);
        const isType    = UGC_TYPE_KEYS_CLIENT.has(sel);
        setSnapshotOption({
          // No id → UgcFormModal treats this as a "create" with pre-fill.
          section:     block.section,
          pool_mode:   poolMode,
          // Phase H — arrays so the snapshot pre-fill seeds the multi-select
          // checkboxes correctly.
          type_ids:    needsType && isType   ? [sel] : [],
          stroke_ids:  needsType && isStroke ? [sel] : [],
          label:       block.label ? `${block.label} (copy)` : "Snapshot",
          total_yards: block.sets.reduce((acc, s) => acc + (s.reps || 0) * (s.dist || 0), 0),
          sets:        block.sets.map(s => ({
            reps: s.reps, dist: s.dist, desc: s.desc, interval: s.interval,
            focus: s.focus || null, stroke: s.stroke || null, eq: s.eq || null,
          })),
        });
      }, [selectedType, poolMode, UGC_STROKE_KEYS_CLIENT, UGC_TYPE_KEYS_CLIENT]);
      const [goals, setGoals]                     = useState([]);
      const [nextEvent, setNextEvent]             = useState(null); // { name, date } | null
      const [phase, setPhase]                     = useState(null); // N5: "base"|"build"|"peak"|"taper"|"recovery"|null
      // B (bootstrap extension) — lifted to App so ProfileModal can read from
      // props instead of re-fetching /api/settings just to get `level`.
      const [level, setLevel]                     = useState(null); // J — swimmer-level preset id | null
      // B — sessions + team-defaults + billing-status arrive in bootstrap so
      // ProfileModal-open doesn't need their three GETs anymore.
      const [sessions, setSessions]               = useState([]);   // auth/sessions
      const [teamDefaults, setTeamDefaults]       = useState([]);   // team-defaults inherited
      const [pendingInvites, setPendingInvites]   = useState([]);   // parent invites awaiting accept
      const [billingStatus, setBillingStatus]     = useState(null); // { tier, ... } | null
      const [audioCues, setAudioCues]             = useState(true); // W1: rest-timer beeps default ON
      const [lapButton, setLapButton]             = useState(true); // Run-screen v1: ✓ Lap button default ON
      const [loadedFromHistoryId, setLoadedFromHistoryId] = useState(null);
      const [saveStatus, setSaveStatus]           = useState(null); // null | "saving" | "saved" | "error"
      const [saveError, setSaveError]             = useState(null);
      const [dateDraft, setDateDraft]             = useState(() => new Date().toISOString().slice(0, 10));
      const [noteDraft, setNoteDraft]             = useState("");
      const [difficultyDraft, setDifficultyDraft] = useState(null);    // 1–5 stars, null = unrated
      const [focusNoteDraft, setFocusNoteDraft]   = useState("");      // pre-workout intention
      const [initialsDraft, setInitialsDraft]     = useState(() => {
        try { return normalizeInitials(localStorage.getItem(USER_INITIALS_KEY) || ""); }
        catch (_) { return ""; }
      });
      // Pinned sections: { warmup?: bool, drill?: bool, main?: bool, cooldown?: bool }
      // Pinned blocks are held fixed on "Generate New Workout"; unpinned sections get fresh picks.
      const [pinnedSections, setPinnedSections]   = useState({});
      const [recoveryMode, setRecoveryMode]       = useState(false); // C: per-generation toggle, not persisted
      const [sectionBias, setSectionBias]         = useState("balanced"); // Section-proportion bias: balanced / warmup_heavy / drill_heavy / long_main. Per-generation, session-only.
      // Section model A2 — which sections to include. `main` always on. Skipping
      // a section drops it from the workout (a correspondingly shorter, honest
      // total). Per-generation, session-only.
      const [skipWarmup,   setSkipWarmup]   = useState(false);
      const [skipDrill,    setSkipDrill]    = useState(false);
      const [skipCooldown, setSkipCooldown] = useState(false);
      // Kick is the opt-IN 5th section (default off), so it's tracked as
      // addKick rather than a skip flag. Order in includedSections must match
      // the engine's block order: warmup → drill → kick → main → cooldown.
      const [addKick,      setAddKick]      = useState(false);
      const includedSections = React.useMemo(() => {
        const out = [];
        if (!skipWarmup) out.push("warmup");
        if (!skipDrill)  out.push("drill");
        if (addKick)     out.push("kick");
        out.push("main");
        if (!skipCooldown) out.push("cooldown");
        return out;
      }, [skipWarmup, skipDrill, addKick, skipCooldown]);
      // Section model B2 — dryland insert picker (post-generation add).
      const [drylandPickerOpen, setDrylandPickerOpen] = useState(false);
      const [drylandPresetId,   setDrylandPresetId]   = useState(DRYLAND_OPTIONS[0].id);
      const [drylandPlacement,  setDrylandPlacement]  = useState("pre");
      // S3 — per-section engine source (bank | engine | mix), default all bank.
      // Persisted to settings.extra.engine_section_sources on change. Read on
      // mount via the settings fetch elsewhere in this component.
      const [sectionSources, setSectionSources]   = useState({ warmup: "bank", drill: "bank", main: "bank", cooldown: "bank" });
      // S3 — anti-repeat memory for engine (last 10 { template_id, stroke, ts }).
      // Persisted as settings.extra.engine_recent_templates. Loaded on mount,
      // updated client-side after each successful engine generate.
      const [recentEngineTemplates, setRecentEngineTemplates] = useState([]);

      // Per-section regeneration error: { section: "warmup"|"drill"|"main"|"cooldown", message } | null
      const [regenError, setRegenError]           = useState(null);
      // S3 #3 — top-level generate error (e.g. required equipment unsatisfiable).
      // Surfaced as a banner above the workout area; cleared on successful generate.
      const [generateError, setGenerateError]     = useState(null);
      // S4 #7 — session-local anti-repeat: every successful generate / main-regen
      // records the picked main-set label here. Unioned with recentMainLabels (from
      // saved history) when computing weights, so consecutive generates don't
      // repeat the same main even before any save has happened.
      const [sessionRecentLabels, setSessionRecentLabels] = useState(() => new Set());
      // Run Workout overlay: null when inactive, or the workout/entry object being stepped through
      const [runWorkout, setRunWorkout]           = useState(null);
      const [showRestPicker, setShowRestPicker]   = useState(false);
      // R-G: when set, Run-mode finish writes to this assignment row instead
      // of creating a new history entry. Cleared after the run completes or
      // when the swimmer exits Run mode.
      const [runAssignmentId, setRunAssignmentId] = useState(null);
      // I — week-view planning. runScheduledId is set when a scheduled
      // workout is launched into Run mode so the log-workout call links
      // the completion back via dbLinkCompletedToSchedule. editingScheduledId
      // is set when a scheduled row is loaded into the workout slot for
      // edit/regen — handleSave PATCHes the schedule row instead of
      // creating a new history entry.
      const [runScheduledId,     setRunScheduledId]     = useState(null);
      const [editingScheduledId, setEditingScheduledId] = useState(null);
      // I — date picker shown when user clicks "📅 Schedule for…" on the
      // workout display. holds the target date string (YYYY-MM-DD) and is
      // null when the picker is closed.
      const [scheduleDate, setScheduleDate] = useState(null);
      // I Phase 2a — save-as-intent date picker. Opens when "Save as intent
      // for later…" is clicked under the Generate button. POSTs intent_params
      // built from the *current* form state (type/maxYards/mix/recovery) —
      // generation deferred to the scheduled day.
      const [intentDate, setIntentDate] = useState(null);
      const [intentSaveBusy, setIntentSaveBusy] = useState(false);
      const [showProfile, setShowProfile]         = useState(false);
      // Setforge rebrand 2026-05-20 — Coach dropdown (REBRAND_SCOPE §8.1).
      // Collapses Teams / Swimmers / Catalog into a single nav entry.
      const [coachMenuOpen, setCoachMenuOpen] = useState(false);
      const [showFeedback, setShowFeedback]       = useState(false);
      const [showIntentParser, setShowIntentParser] = useState(false);
      // DOB soft-prompt dismissal (sessionStorage-backed, per decision #37).
      // Initialized lazily from sessionStorage so the modal doesn't re-pop
      // after dismissal within the same tab.
      const [dobPromptDismissed, setDobPromptDismissed] = useState(() => {
        try { return sessionStorage.getItem(DOB_PROMPT_DISMISS_KEY) === "1"; }
        catch (_) { return false; }
      });
      const [restSecs,      setRestSecs]          = useState(30); // null=manual, 0/30/45/60=auto
      // Print dialog: show "save before printing?" prompt for unsaved workouts
      const [showPrintDialog, setShowPrintDialog] = useState(false);
      // N6 — Multi-pace export. showMultiPace gates the modal; multiPaceLanes
      // is non-null while the print overlay is mounted ({lanes, mode}).
      const [showMultiPace,   setShowMultiPace]   = useState(false);
      const [multiPaceLanes,  setMultiPaceLanes]  = useState(null);
      const [copyFlash,       setCopyFlash]       = useState(false);
      // Auth state: null = checking, false = not signed in, true = signed in
      const [authenticated, setAuthenticated] = useState(null);
      const [authMode,      setAuthMode]      = useState(null); // "open" | "apple"
      const [authError,     setAuthError]     = useState(null);
      const [me,            setMe]            = useState(null); // /api/me payload (for is_admin gate, etc.)
      // View-as: admin-only QA mode that temporarily overrides role flags
      // for UI gating purposes. Real `me` stays unchanged so API permission
      // checks (server-side) and the view-as switcher's own visibility
      // continue to use real role. localStorage-backed so it survives reload.
      // Values: "self" (no override) | "solo" (no coach, no admin) | "coach"
      // (coach only). Switcher only renders to actual admins.
      const [viewAsRole, setViewAsRoleState] = useState(() => {
        try { return localStorage.getItem("setforge_view_as") || "self"; } catch (_) { return "self"; }
      });
      const setViewAsRole = useCallback((role) => {
        const v = ["self", "solo", "coach"].includes(role) ? role : "self";
        setViewAsRoleState(v);
        try { localStorage.setItem("setforge_view_as", v); } catch (_) {}
      }, []);
      // Orthogonal "+ parent" toggle (2026-05-27). Composes with the role
      // picker: when on AND role != self, effectiveMe also flips is_parent
      // true so the 👪 nav + ParentDashboard are reachable in preview. Only
      // meaningful for admins (mirrors the rest of view-as v1 semantics).
      const [viewAsParent, setViewAsParentState] = useState(() => {
        try { return localStorage.getItem("setforge_view_as_parent") === "1"; } catch (_) { return false; }
      });
      const setViewAsParent = useCallback((on) => {
        const v = !!on;
        setViewAsParentState(v);
        try { localStorage.setItem("setforge_view_as_parent", v ? "1" : "0"); } catch (_) {}
      }, []);
      // effectiveMe — same as me, but with role flags overridden when
      // viewAsRole !== "self". UI gates should read effectiveMe; the
      // view-as switcher itself reads me.is_admin (real) for visibility.
      const effectiveMe = React.useMemo(() => {
        if (!me) return me;
        if (viewAsRole === "self" && !viewAsParent) return me;
        if (!me.is_admin) return me;  // non-admins can't view-as; ignore the stored value
        let next = me;
        if      (viewAsRole === "solo")  next = { ...me, is_admin: false, is_coach: false };
        else if (viewAsRole === "coach") next = { ...me, is_admin: false, is_coach: true  };
        // Parent flag is orthogonal — composes on top of solo/coach (and
        // even self, though the banner is hidden in self mode so it has
        // no UX effect there).
        if (viewAsParent) next = { ...next, is_parent: true };
        return next;
      }, [me, viewAsRole, viewAsParent]);

      // View-as v2 (2026-05-23): persona simulation. When admin is viewing-as
      // another role, the read view shows a fresh-new-user empty state AND
      // writes are blocked. Different from v1 which only hid UI surfaces.
      // Different from v3 impersonation (server-side, real target user) —
      // this is pure client-side preview using admin's own session.
      const isViewingAsOther = !!(me?.is_admin && (viewAsRole !== "self" || viewAsParent));
      // Ref mirror — write handlers use useCallback with non-view-as deps, so
      // reading isViewingAsOther directly in the handler closure would stale.
      // The ref is updated on every render so handlers always see the current
      // value without forcing a re-memoize across every dep array.
      const isViewingAsOtherRef = React.useRef(isViewingAsOther);
      isViewingAsOtherRef.current = isViewingAsOther;
      const [personaBlockMsg, setPersonaBlockMsg] = useState(null);
      // Auto-clear the persona-block toast after 2.5s.
      useEffect(() => {
        if (!personaBlockMsg) return;
        const id = setTimeout(() => setPersonaBlockMsg(null), 2500);
        return () => clearTimeout(id);
      }, [personaBlockMsg]);

      // Billing v1 — ?upgrade=success / ?upgrade=cancelled banner when
      // the user returns from Stripe Checkout. Clears the query param
      // from the URL after read so refresh doesn't re-show the banner.
      // Also fires a delayed refreshBootstrap() so the new tier (set
      // server-side by the Stripe webhook arriving asynchronously)
      // propagates into App state without requiring a manual reload.
      const [upgradeBanner, setUpgradeBanner] = useState(null);
      useEffect(() => {
        try {
          const params = new URLSearchParams(window.location.search);
          const u = params.get("upgrade");
          if (u === "success") {
            setUpgradeBanner({ kind: "success", text: "Welcome to Coach tier — your 14-day free trial is active. Manage your subscription anytime from Profile → Subscription." });
            // Webhook arrives async (~1-2s after Stripe redirect). Refresh
            // bootstrap twice with a small delay so we usually catch the
            // tier flip without forcing the user to wait or reload. First
            // call is best-effort right away (covers fast webhooks); second
            // covers the typical webhook latency window. If both miss, the
            // 5-min poll OR next ProfileModal-open will pick it up.
            refreshBootstrap();
            setTimeout(() => { refreshBootstrap(); }, 3000);
          } else if (u === "cancelled") {
            setUpgradeBanner({ kind: "info", text: "Checkout cancelled. Your account is still on the Swimmer (Free) tier. Subscribe from Profile → Subscription whenever you're ready." });
          }
          if (u) {
            // Clear the param so refresh doesn't re-trigger.
            params.delete("upgrade");
            const q = params.toString();
            window.history.replaceState({}, "", window.location.pathname + (q ? "?" + q : ""));
          }
        } catch (_) { /* URLSearchParams unsupported — skip */ }
      }, []);
      // Auto-clear upgrade banner after 8s (longer than persona-block since
      // it's success-flow not error-flow).
      useEffect(() => {
        if (!upgradeBanner) return;
        const id = setTimeout(() => setUpgradeBanner(null), 8000);
        return () => clearTimeout(id);
      }, [upgradeBanner]);
      // v2 entry/exit handler. On entering view-as, wipe data state for a
      // fresh-new-user simulation. On exit, force window.location.reload()
      // to restore admin's real data cleanly — avoids racing N fetch chains.
      // Brutal but bulletproof for an admin-only QA tool.
      const prevViewingRef = React.useRef(isViewingAsOther);
      useEffect(() => {
        const wasViewing = prevViewingRef.current;
        prevViewingRef.current = isViewingAsOther;
        if (!wasViewing && isViewingAsOther) {
          setHistory([]);
          setFavorites([]);
          setDisfavorites([]);
          setEngineDisfavorites([]);
          setFavoriteSets(new Set());
          setDisfavorSets(new Set());
          setEffectiveDisfavorLabels([]);
          setEffectiveDisfavorSetIds(new Set());
          setEffectiveEngineDisfavorites([]);
          setEffectiveFavoriteLabels([]);
          setEffectiveFavoriteSetIds(new Set());
          setEffectiveEngineFavorites([]);
          setEngineFavorites([]);
          setGoals([]);
          setNextEvent(null);
        } else if (wasViewing && !isViewingAsOther) {
          // Restore real data cleanly.
          window.location.reload();
        }
      }, [isViewingAsOther]);

      const [showImpersonationModal, setShowImpersonationModal] = useState(false);
      // v3 impersonation state. Mirrors module-scope `impersonation.active`
      // for React render purposes. setImpersonation() (module-scope) updates
      // the fetch-wrapper's view; setImpersonationState here triggers React
      // re-renders for the banner, write-control gating, etc.
      const [impersonationState, setImpersonationState] = useState(null);
      // Keep module-scope mirror in sync with React state.
      useEffect(() => { setImpersonation(impersonationState); }, [impersonationState]);

      // On mount: try to recover impersonation state across page reload.
      // GET /api/impersonation/active returns the caller's currently-active
      // session if any. If found, restore + auto-end on expiry.
      useEffect(() => {
        if (!authenticated) return;
        fetch(`${API_BASE}/impersonation/active`, { cache: "no-store" })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data && data.active) {
              // We don't know target name/email from this endpoint; fetch /api/me
              // (which under the new header will return the target's profile) to
              // populate the banner label. Temporarily set the module-scope
              // wrapper so the next /api/me request carries the header.
              setImpersonation({ target_sub: data.active.target_sub, target_name: "" });
              fetch(`${API_BASE}/me`, { cache: "no-store" })
                .then(r => r.ok ? r.json() : null)
                .then(targetMe => {
                  setImpersonationState({
                    target_sub: data.active.target_sub,
                    target_name: (targetMe && (targetMe.display_name || targetMe.initials || targetMe.email)) || data.active.target_sub.slice(0, 8),
                    target_email: targetMe && targetMe.email,
                    expires_at: data.active.expires_at,
                  });
                })
                .catch(() => {});
            }
          })
          .catch(() => {});
      }, [authenticated]);

      // Start an impersonation session. Returns a promise that resolves on
      // success (with the populated state) or rejects with an error string.
      const handleStartImpersonation = React.useCallback(async (targetSub, targetName, targetEmail) => {
        const res = await fetch(`${API_BASE}/impersonation/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ target_sub: targetSub }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `start failed (${res.status})`);
        }
        const data = await res.json();
        setImpersonationState({
          target_sub: data.target_sub,
          target_name: targetName || data.target_sub.slice(0, 8),
          target_email: targetEmail || null,
          expires_at: data.expires_at,
        });
        return data;
      }, []);

      // End the current impersonation session. Safe to call even if no
      // session is active (server returns ended: 0).
      const handleEndImpersonation = React.useCallback(async () => {
        try {
          await fetch(`${API_BASE}/impersonation/end`, {
            method: "POST",
            headers: { ...csrfHeaders() },
          });
        } catch (_) { /* swallow — clear local state anyway */ }
        setImpersonationState(null);
        setImpersonation(null);
        // Force a reload-ish behavior so any cached data from the target's
        // perspective gets re-fetched as the admin. Simplest: hard reload.
        // (Alternative: re-fetch /api/me + invalidate all caches. Reload
        // is one line and bullet-proof.)
        if (typeof window !== "undefined") window.location.reload();
      }, []);

      // Bootstrap composite (2026-05-28). Replaces ~13 parallel /api/* reads
      // on app load with a single /api/me/bootstrap request. Mitigates 429s
      // from Spaceship Hyperlift's platform-level inbound rate limit. The
      // ref starts true so the ~13 individual mount-time useEffects below
      // can check it as a "skip the duplicate fetch" guard. Bootstrap
      // completion (success OR failure) flips the ref to false so the
      // post-mount 5-min polls and post-mutation refreshes still work.
      const bootstrapHydratingRef = React.useRef(true);

      // On mount: check auth status via session cookie (set by /auth/callback)
      useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("auth") === "error") {
          setAuthError(params.get("reason") || "unknown");
          window.history.replaceState({}, "", "/");
        }
        fetch("/api/auth/status")
          .then(r => r.json())
          .then(data => {
            setAuthenticated(data.authenticated);
            setAuthMode(data.mode === "open" ? "open" : "apple");
            if (data.authenticated) {
              refreshCsrf();
              // Don't fetch /api/me here — bootstrap useEffect below handles it.
            } else {
              // Not authed; nothing to bootstrap, free the ref so any
              // post-sign-in fetches run normally.
              bootstrapHydratingRef.current = false;
            }
          })
          .catch(() => { setAuthenticated(false); setAuthMode(null); bootstrapHydratingRef.current = false; });
      }, []);

      // Bootstrap fetch — fires when auth confirms. Hydrates 13 sections in
      // one round-trip. Each section that comes back populates its state
      // directly; the original individual mount-time useEffects skip via the
      // bootstrapHydratingRef guard. If bootstrap fails entirely, the ref
      // flips to false and the individual useEffects... won't re-fire (they
      // had [] deps and already mounted). In that case, the 5-min polls
      // catch up. Per-section _errors are tolerated — that section keeps
      // its initial state until the next poll.
      // Apply a /api/me/bootstrap payload to App-level state. Extracted from
      // the mount useEffect so refreshBootstrap (post-mutation refresh) and
      // ProfileModal close/save handlers can reuse the same hydration path
      // without duplicating setters.
      const applyBootstrap = useCallback((d) => {
        if (!d || typeof d !== "object") return;
        // me
        if (d.me) setMe(d.me);
        // workouts (history) — merge with local cache like the original useEffect did
        if (Array.isArray(d.workouts)) {
          const merged = mergeById(loadLocalHistory(), d.workouts);
          setHistory(merged);
          saveLocalHistory(merged);
          setHistoryLoaded(true);
        }
        // favorites + sets (Set wrappers)
        if (Array.isArray(d.favorites))     setFavorites(d.favorites);
        if (Array.isArray(d.disfavorites))  setDisfavorites(d.disfavorites);
        if (Array.isArray(d.favoriteSets))  setFavoriteSets(new Set(d.favoriteSets));
        if (Array.isArray(d.disfavorSets))  setDisfavorSets(new Set(d.disfavorSets));
        // effective favorites/disfavorites (three states each)
        if (d.effectiveDisfavorites && typeof d.effectiveDisfavorites === "object") {
          if (Array.isArray(d.effectiveDisfavorites.labels))  setEffectiveDisfavorLabels(d.effectiveDisfavorites.labels);
          if (Array.isArray(d.effectiveDisfavorites.set_ids)) setEffectiveDisfavorSetIds(new Set(d.effectiveDisfavorites.set_ids));
          if (Array.isArray(d.effectiveDisfavorites.engine))  setEffectiveEngineDisfavorites(d.effectiveDisfavorites.engine);
        }
        if (d.effectiveFavorites && typeof d.effectiveFavorites === "object") {
          if (Array.isArray(d.effectiveFavorites.labels))  setEffectiveFavoriteLabels(d.effectiveFavorites.labels);
          if (Array.isArray(d.effectiveFavorites.set_ids)) setEffectiveFavoriteSetIds(new Set(d.effectiveFavorites.set_ids));
          if (Array.isArray(d.effectiveFavorites.engine))  setEffectiveEngineFavorites(d.effectiveFavorites.engine);
        }
        // PSC constraints
        if (d.myConstraints && Array.isArray(d.myConstraints.constraints)) {
          setMyConstraints(d.myConstraints.constraints);
        }
        // UGC overlay — only set if shape looks right
        if (d.ugcOverlay && typeof d.ugcOverlay === "object" && "WARMUP_OPTIONS" in d.ugcOverlay) {
          setUgcOverlay(d.ugcOverlay);
        }
        // Goals
        if (Array.isArray(d.goals)) setGoals(d.goals);
        // B — sessions (auth devices list), team-defaults (inherited
        // settings preview), billing-status (subscription tier). All read
        // by ProfileModal; lifting to App-level state means the modal can
        // seed from props instead of fetching on open.
        if (Array.isArray(d.sessions))     setSessions(d.sessions);
        if (Array.isArray(d.teamDefaults)) setTeamDefaults(d.teamDefaults);
        if (Array.isArray(d.pendingInvites)) setPendingInvites(d.pendingInvites);
        if (d.billing && d.billing.status) setBillingStatus(d.billing.status);
        // Settings — applied through the shared applySettings helper so
        // we don't refetch /api/settings post-bootstrap. applySettings is
        // a stable useCallback defined later in this component; deliberately
        // not in the deps array (it's in TDZ at this point in source order,
        // and the closure resolves at call time which is post-mount).
        if (d.settings) applySettings(d.settings);
      }, []);

      // Programmatic bootstrap re-fetch. Replaces post-mutation refresh
      // bursts (5-8 GETs after ProfileModal close) with a single composite
      // GET. Returns the promise so callers can chain. Same stable-callback
      // pattern as applyBootstrap — applyBootstrap is intentionally not in deps.
      const refreshBootstrap = useCallback(() => {
        return fetch(`${API_BASE}/me/bootstrap`, { cache: "no-store" })
          .then(r => r.ok ? r.json() : null)
          .then(d => { applyBootstrap(d); return d; })
          .catch(() => null);
      }, []);

      useEffect(() => {
        if (!authenticated) return;
        let cancelled = false;
        fetch(`${API_BASE}/me/bootstrap`, { cache: "no-store" })
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (!cancelled) applyBootstrap(d); })
          .catch(() => { /* tolerated; ref flip in finally */ })
          .finally(() => {
            if (!cancelled) bootstrapHydratingRef.current = false;
          });
        return () => { cancelled = true; };
      }, [authenticated]);

      // Refresh me whenever the view changes — keeps the admin feedback-count
      // badge accurate after triage (mark new → reviewed/resolved/dismissed
      // happens inside AdminView; we re-pull here when the user navigates
      // back so the badge reflects the new count). Cheap GET, indexed query.
      // Suppressed on first load by bootstrap ref — bootstrap hydrates `me`.
      useEffect(() => {
        if (!authenticated) return;
        if (bootstrapHydratingRef.current) return;
        fetch("/api/me").then(r => r.ok ? r.json() : null).then(d => { if (d) setMe(d); }).catch(() => {});
      }, [view, authenticated]);

      // On mount: fetch live history from the API, merge with localStorage cache.
      // Suppressed on first load by bootstrap ref — bootstrap hydrates history.
      useEffect(() => {
        if (bootstrapHydratingRef.current) return;
        let cancelled = false;
        fetch(`${API_BASE}/workouts`, { cache: "no-store" })
          .then(r => r.ok ? r.json() : [])
          .then(remote => {
            if (cancelled) return;
            const merged = mergeById(loadLocalHistory(), Array.isArray(remote) ? remote : []);
            setHistory(merged);
            saveLocalHistory(merged);
            setHistoryLoaded(true);
          })
          .catch(() => { if (!cancelled) setHistoryLoaded(true); });
        return () => { cancelled = true; };
      }, []);

      // On mount: fetch favorites — suppressed on first load by bootstrap.
      useEffect(() => {
        if (bootstrapHydratingRef.current) return;
        fetch(`${API_BASE}/favorites`, { cache: "no-store" })
          .then(r => r.ok ? r.json() : [])
          .then(data => { if (Array.isArray(data)) setFavorites(data); })
          .catch(() => {});
      }, []);

      // v1.2 — On mount: fetch disfavorites — suppressed on first load by bootstrap.
      useEffect(() => {
        if (bootstrapHydratingRef.current) return;
        fetch(`${API_BASE}/disfavorites`, { cache: "no-store" })
          .then(r => r.ok ? r.json() : [])
          .then(data => { if (Array.isArray(data)) setDisfavorites(data); })
          .catch(() => {});
      }, []);

      // On mount: fetch per-user set-favorites — suppressed on first load by bootstrap.
      useEffect(() => {
        if (bootstrapHydratingRef.current) return;
        fetch(`${API_BASE}/favorite-sets`, { cache: "no-store" })
          .then(r => r.ok ? r.json() : [])
          .then(data => { if (Array.isArray(data)) setFavoriteSets(new Set(data)); })
          .catch(() => {});
      }, []);

      // v1.5 — On mount: fetch per-user set-disfavorites — suppressed on first load by bootstrap.
      useEffect(() => {
        if (bootstrapHydratingRef.current) return;
        fetch(`${API_BASE}/disfavor-sets`, { cache: "no-store" })
          .then(r => r.ok ? r.json() : [])
          .then(data => { if (Array.isArray(data)) setDisfavorSets(new Set(data)); })
          .catch(() => {});
      }, []);

      // v1.7 — On mount: fetch effective disfavorites (own + coach
      // propagation). Updated separately from the own-only lists so the
      // audit panel keeps showing only the user's own picks.
      const refreshEffectiveDisfavorites = useCallback(() => {
        return fetch(`${API_BASE}/effective-disfavorites`, { cache: "no-store" })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (!data || typeof data !== "object") return;
            if (Array.isArray(data.labels))  setEffectiveDisfavorLabels(data.labels);
            if (Array.isArray(data.set_ids)) setEffectiveDisfavorSetIds(new Set(data.set_ids));
            if (Array.isArray(data.engine))  setEffectiveEngineDisfavorites(data.engine);
          })
          .catch(() => {});
      }, []);
      useEffect(() => {
        if (bootstrapHydratingRef.current) return;
        refreshEffectiveDisfavorites();
      }, [refreshEffectiveDisfavorites]);
      // Periodic refresh (2026-05-22) — coach updates while swimmer is logged
      // in stay stale until next page load. 5-min poll keeps the swimmer's
      // picker effectively current without forcing a reload. Cheap relative
      // to the picker's already-on-mount fetch; the server-side helper
      // (dbGetEffectiveDisfavorites) is a small 3-query SELECT.
      useEffect(() => {
        const id = setInterval(refreshEffectiveDisfavorites, 5 * 60 * 1000);
        return () => clearInterval(id);
      }, [refreshEffectiveDisfavorites]);

      // v1.13 — Mirror of refreshEffectiveDisfavorites for the favorite side.
      const refreshEffectiveFavorites = useCallback(() => {
        return fetch(`${API_BASE}/effective-favorites`, { cache: "no-store" })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (!data || typeof data !== "object") return;
            if (Array.isArray(data.labels))  setEffectiveFavoriteLabels(data.labels);
            if (Array.isArray(data.set_ids)) setEffectiveFavoriteSetIds(new Set(data.set_ids));
            if (Array.isArray(data.engine))  setEffectiveEngineFavorites(data.engine);
          })
          .catch(() => {});
      }, []);
      useEffect(() => {
        if (bootstrapHydratingRef.current) return;
        refreshEffectiveFavorites();
      }, [refreshEffectiveFavorites]);
      // Periodic refresh mirror of the disfavor side.
      useEffect(() => {
        const id = setInterval(refreshEffectiveFavorites, 5 * 60 * 1000);
        return () => clearInterval(id);
      }, [refreshEffectiveFavorites]);

      // Phase 3 PSC slice 2 — fetch own active constraints + 5-min poll.
      // Mirrors the effective-disfavor refresh pattern. Coach updates on
      // a swimmer's constraints reach the swimmer's UI within 5 min without
      // requiring a reload (slice 3 adds coach UX; slice 4 adds visible
      // swimmer UI like ProfileModal section + AssignedToMe details).
      const refreshMyConstraints = useCallback(() => {
        return fetch(`${API_BASE}/me/constraints`, { cache: "no-store" })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data && Array.isArray(data.constraints)) setMyConstraints(data.constraints);
          })
          .catch(() => {});
      }, []);
      useEffect(() => {
        if (bootstrapHydratingRef.current) return;
        refreshMyConstraints();
      }, [refreshMyConstraints]);
      useEffect(() => {
        const id = setInterval(refreshMyConstraints, 5 * 60 * 1000);
        return () => clearInterval(id);
      }, [refreshMyConstraints]);

      // UGC Phase B — pull the UGC bank overlay on mount + 5-min poll.
      // Empty 12-key shape arrives as { WARMUP_OPTIONS: [], DRILL_OPTIONS: {}, ... }
      // until Phase C+ populates rows. Picker merges via getBankOptions concat.
      const refreshUgcOverlay = useCallback(() => {
        return fetch(`${API_BASE}/bank/my-overlay`, { cache: "no-store" })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (!data || typeof data !== "object") return;
            // Validate shape minimally — must have at least one of the
            // expected keys to avoid clobbering state with garbage.
            if (!("WARMUP_OPTIONS" in data)) return;
            setUgcOverlay(data);
          })
          .catch(() => {});
      }, []);
      useEffect(() => {
        if (bootstrapHydratingRef.current) return;
        refreshUgcOverlay();
      }, [refreshUgcOverlay]);
      useEffect(() => {
        const id = setInterval(refreshUgcOverlay, 5 * 60 * 1000);
        return () => clearInterval(id);
      }, [refreshUgcOverlay]);

      // On mount: fetch goals (recurring targets for stats progress bars)
      const refreshGoals = useCallback(() => {
        fetch(`${API_BASE}/goals`, { cache: "no-store" })
          .then(r => r.ok ? r.json() : [])
          .then(data => { if (Array.isArray(data)) setGoals(data); })
          .catch(() => {});
      }, []);
      useEffect(() => {
        if (bootstrapHydratingRef.current) return;
        refreshGoals();
      }, [refreshGoals]);

      // Apply a settings payload to the matching React state. Extracted from
      // refreshSettings so the bootstrap useEffect can hydrate settings from
      // /api/me/bootstrap without firing an extra /api/settings GET.
      const applySettings = useCallback((s) => {
        if (!s || typeof s !== "object") return;
        if (s.sliderMin) setSliderMin(s.sliderMin);
        if (s.sliderMax) { setSliderMax(s.sliderMax); setMaxYards(v => Math.min(v, s.sliderMax)); }
        if (s.paceInput) setPaceInput(s.paceInput);
        if (s.initials)  setInitialsDraft(normalizeInitials(s.initials));
        // Q: next-event countdown lives in settings.extra; dbGetSettings
        // spreads extra into the top-level response.
        setNextEvent(s.next_event && s.next_event.name && s.next_event.date ? s.next_event : null);
        // N5: phase also in settings.extra (single string id).
        setPhase(s.phase && PHASES[s.phase] ? s.phase : null);
        // J: level preset id (settings.extra). Validated against LEVEL_PRESETS.
        setLevel(s.level && LEVEL_PRESETS[s.level] ? s.level : null);
        // W1: audio_cues persisted per-user; default ON when unset.
        if (typeof s.audio_cues === "boolean") setAudioCues(s.audio_cues);
        // Run-screen v1: lap_button persisted per-user; default ON when unset.
        if (typeof s.lap_button === "boolean") setLapButton(s.lap_button);
        // Onboarding tour: tour_seen persisted per-user. Unset (new user) →
        // false → the auto-start effect runs the tour once.
        setTourSeen(s.tour_seen === true);
        // F: equipment_modes is a per-item map { kickboard: "off"|"preferred"|"required", ... }
        if (s.equipment_modes && typeof s.equipment_modes === "object") {
          setEquipment(prev => {
            const next = { ...prev };
            for (const k of Object.keys(prev)) {
              // Normalize unknown values through equipMode() (handles legacy booleans).
              next[k] = equipMode(s.equipment_modes, k);
            }
            return next;
          });
        }
        // S3 — template engine per-section toggle + anti-repeat memory
        if (s.engine_section_sources && typeof s.engine_section_sources === "object") {
          setSectionSources(prev => ({ ...prev, ...s.engine_section_sources }));
        }
        if (Array.isArray(s.engine_recent_templates)) {
          setRecentEngineTemplates(s.engine_recent_templates.slice(0, 10));
        }
        // v1.3 — engine disfavorites
        if (Array.isArray(s.engine_disfavorites)) {
          setEngineDisfavorites(s.engine_disfavorites.slice(0, 50));
        }
        // v1.13 — own engine favorites (settings.extra.engine_favorites)
        if (Array.isArray(s.engine_favorites)) {
          setEngineFavorites(s.engine_favorites.slice(0, 50));
        }
        // v2.0 polish — multi-lane persisted state (enabled + lanes)
        if (s.multi_lane && typeof s.multi_lane === "object") {
          if (typeof s.multi_lane.enabled === "boolean") {
            setMultiLaneMode(s.multi_lane.enabled);
          }
          if (Array.isArray(s.multi_lane.lanes) && s.multi_lane.lanes.length > 0) {
            setManualLanesPace(s.multi_lane.lanes.slice(0, 12).map((l, i) => ({
              lane_label: l.lane_label || `Lane ${i + 1}`,
              pace: l.pace || "",
            })));
          }
        }
        // v1.8 — disfavor mode (downweight | exclude)
        if (s.disfavor_mode === "downweight" || s.disfavor_mode === "exclude") {
          setDisfavorMode(s.disfavor_mode);
        }
      }, []);

      // On mount: fetch user settings (slider range + default pace). Suppressed
      // on first load by the bootstrap ref guard — bootstrap calls applySettings
      // directly. Post-bootstrap (programmatic refresh) it still GETs.
      const refreshSettings = useCallback(() => {
        return fetch(`${API_BASE}/settings`, { cache: "no-store" })
          .then(r => r.ok ? r.json() : {})
          .then(applySettings)
          .catch(() => {});
      }, [applySettings]);
      useEffect(() => {
        if (bootstrapHydratingRef.current) return;
        refreshSettings();
      }, [refreshSettings]);

      // W1: persist the audio_cues toggle to settings.extra without disturbing
      // other extra keys. Optimistic local update; best-effort save.
      const handleAudioCuesToggle = useCallback((next) => {
        setAudioCues(next);
        fetch(`${API_BASE}/settings/extra`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ audio_cues: next }),
        }).catch(() => {});
      }, []);

      // Run-screen v1: persist the lap_button toggle. Mirror of audio_cues
      // pattern — optimistic local update + best-effort POST.
      const handleLapButtonToggle = useCallback((next) => {
        setLapButton(next);
        fetch(`${API_BASE}/settings/extra`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ lap_button: next }),
        }).catch(() => {});
      }, []);

      // Onboarding tour controls. Auto-start once for users whose tour_seen
      // is unset (resolves to false in applySettings). startTour replays it
      // on demand. finishTour ends it and persists tour_seen=true so it
      // won't auto-run again (best-effort; one write per session via ref).
      useEffect(() => {
        if (!tourAutoRef.current && tourSeen === false) {
          tourAutoRef.current = true;
          setTourStep(0);
        }
      }, [tourSeen]);
      const startTour = useCallback(() => { setTourStep(0); }, []);
      const finishTour = useCallback(() => {
        setTourStep(-1);
        setTourSeen(true);
        if (!tourSeenWriteRef.current) {
          tourSeenWriteRef.current = true;
          fetch(`${API_BASE}/settings/extra`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({ tour_seen: true }),
          }).catch(() => {});
        }
      }, []);

      // v2.0 polish — Persist multi-lane state (enabled + lanes) to
      // settings.extra. Debounced 800ms so per-keystroke pace edits coalesce
      // into one POST. The ref skips the first effect run (initial render
      // with defaults) so the second (post-refreshSettings) is the first
      // server write. Harmless round-trip if user had persisted state.
      const isFirstMultiLaneEffect = React.useRef(true);
      const multiLaneSaveTimerRef = React.useRef(null);
      useEffect(() => {
        if (isFirstMultiLaneEffect.current) {
          isFirstMultiLaneEffect.current = false;
          return;
        }
        clearTimeout(multiLaneSaveTimerRef.current);
        multiLaneSaveTimerRef.current = setTimeout(() => {
          fetch(`${API_BASE}/settings/extra`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({
              multi_lane: { enabled: multiLaneMode, lanes: manualLanesPace },
            }),
          }).catch(() => {});
        }, 800);
      }, [multiLaneMode, manualLanesPace]);

      // Debounced settings save — fires 1.5s after the last change
      const saveSettingsTimerRef = React.useRef(null);
      function saveSettings(min, max, pace, initials) {
        clearTimeout(saveSettingsTimerRef.current);
        saveSettingsTimerRef.current = setTimeout(() => {
          fetch(`${API_BASE}/settings`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({ sliderMin: min, sliderMax: max, paceInput: pace, initials }),
          }).catch(() => {});
        }, 1500);
      }

      // Range change: update bounds, clamp current value, persist
      const handleRangeChange = useCallback((newMin, newMax) => {
        setSliderMin(newMin);
        setSliderMax(newMax);
        setMaxYards(v => Math.max(newMin, Math.min(v, newMax)));
        setWorkout(null);
        setSaveStatus(null);
        saveSettings(newMin, newMax, paceInput, initialsDraft);
      }, [paceInput, initialsDraft]);

      // Pace change with settings persistence
      const handlePaceChange = useCallback((val) => {
        setPaceInput(val);
        saveSettings(sliderMin, sliderMax, val, initialsDraft);
      }, [sliderMin, sliderMax, initialsDraft]);

      // Initials change with settings persistence
      const handleInitialsChange = useCallback((val) => {
        const normalized = normalizeInitials(val);
        setInitialsDraft(normalized);
        saveSettings(sliderMin, sliderMax, paceInput, normalized);
      }, [sliderMin, sliderMax, paceInput]);

      // Toggle a main-set label in/out of favorites
      const handleToggleFavorite = useCallback(async (label) => {
        if (isViewingAsOtherRef.current) { setPersonaBlockMsg("Favorites disabled in view-as mode"); return; }
        const isFav = favorites.includes(label);
        // Optimistic update
        setFavorites(prev => isFav ? prev.filter(x => x !== label) : [...prev, label]);
        // v1.2 — adding favorite implicitly removes disfavor (server-side mutex
        // in dbAddFavorite). Reflect locally so the UI doesn't briefly show both.
        if (!isFav) setDisfavorites(prev => prev.filter(x => x !== label));
        try {
          if (isFav) {
            await fetch(`${API_BASE}/favorites/${encodeURIComponent(label)}`, {
              method: "DELETE",
              headers: { ...csrfHeaders() },
            });
          } else {
            await fetch(`${API_BASE}/favorites`, {
              method: "POST",
              headers: { "Content-Type": "application/json", ...csrfHeaders() },
              body: JSON.stringify({ label }),
            });
          }
        } catch (_) {
          // Revert optimistic update on error
          setFavorites(prev => isFav ? [...prev, label] : prev.filter(x => x !== label));
        }
      }, [favorites]);

      // v1.3 — Toggle an engine (template_id, stroke) pair in/out of
      // engine_disfavorites (settings.extra JSON array). 0.25× weight in
      // the engine template picker.
      // v1.13 — Now mutex-enforced with engine_favorites: adding a
      // disfavor strips any matching favorite, both updated in a single
      // /api/settings/extra patch.
      const handleToggleEngineDisfavor = useCallback(async (meta) => {
        if (!meta || !meta.template_id || !meta.stroke) return;
        if (isViewingAsOtherRef.current) { setPersonaBlockMsg("Engine curation disabled in view-as mode"); return; }
        const key = `${meta.template_id}:${meta.stroke}`;
        const isDis = engineDisfavorites.some(e => `${e.template_id}:${e.stroke}` === key);
        const nextDis = isDis
          ? engineDisfavorites.filter(e => `${e.template_id}:${e.stroke}` !== key)
          : [...engineDisfavorites, { template_id: meta.template_id, stroke: meta.stroke }].slice(0, 50);
        // v1.13 — mutex: if we're ADDING a disfavor, clear any matching favorite
        const nextFav = (!isDis)
          ? engineFavorites.filter(e => `${e.template_id}:${e.stroke}` !== key)
          : engineFavorites;
        setEngineDisfavorites(nextDis);
        if (!isDis) setEngineFavorites(nextFav);
        if (typeof fetch === "function" && csrf.token) {
          const body = { engine_disfavorites: nextDis };
          if (!isDis) body.engine_favorites = nextFav;
          fetch(`${API_BASE}/settings/extra`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf.token },
            body: JSON.stringify(body),
          }).catch(() => {
            // Revert optimistic update on network error
            setEngineDisfavorites(engineDisfavorites);
            setEngineFavorites(engineFavorites);
          });
        }
      }, [engineDisfavorites, engineFavorites]);

      // v1.13 — Mirror of handleToggleEngineDisfavor for the favorite side.
      // 3× weight in the engine template picker. Mutex with disfavorites.
      const handleToggleEngineFavorite = useCallback(async (meta) => {
        if (!meta || !meta.template_id || !meta.stroke) return;
        if (isViewingAsOtherRef.current) { setPersonaBlockMsg("Engine curation disabled in view-as mode"); return; }
        const key = `${meta.template_id}:${meta.stroke}`;
        const isFav = engineFavorites.some(e => `${e.template_id}:${e.stroke}` === key);
        const nextFav = isFav
          ? engineFavorites.filter(e => `${e.template_id}:${e.stroke}` !== key)
          : [...engineFavorites, { template_id: meta.template_id, stroke: meta.stroke }].slice(0, 50);
        // Mutex: adding a favorite strips any matching disfavor
        const nextDis = (!isFav)
          ? engineDisfavorites.filter(e => `${e.template_id}:${e.stroke}` !== key)
          : engineDisfavorites;
        setEngineFavorites(nextFav);
        if (!isFav) setEngineDisfavorites(nextDis);
        if (typeof fetch === "function" && csrf.token) {
          const body = { engine_favorites: nextFav };
          if (!isFav) body.engine_disfavorites = nextDis;
          fetch(`${API_BASE}/settings/extra`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf.token },
            body: JSON.stringify(body),
          }).catch(() => {
            setEngineFavorites(engineFavorites);
            setEngineDisfavorites(engineDisfavorites);
          });
        }
      }, [engineFavorites, engineDisfavorites]);

      // v1.2 — Toggle a main-set label in/out of disfavorites. Mirror of
      // handleToggleFavorite with 0.25× pick weight in the picker. Server-
      // side dbAddDisfavorite removes any matching favorite on insert; we
      // reflect that locally for instant UI consistency.
      const handleToggleDisfavorite = useCallback(async (label) => {
        if (isViewingAsOtherRef.current) { setPersonaBlockMsg("Disfavorites disabled in view-as mode"); return; }
        const isDis = disfavorites.includes(label);
        setDisfavorites(prev => isDis ? prev.filter(x => x !== label) : [...prev, label]);
        if (!isDis) setFavorites(prev => prev.filter(x => x !== label));
        try {
          if (isDis) {
            await fetch(`${API_BASE}/disfavorites/${encodeURIComponent(label)}`, {
              method: "DELETE",
              headers: { ...csrfHeaders() },
            });
          } else {
            await fetch(`${API_BASE}/disfavorites`, {
              method: "POST",
              headers: { "Content-Type": "application/json", ...csrfHeaders() },
              body: JSON.stringify({ label }),
            });
          }
        } catch (_) {
          setDisfavorites(prev => isDis ? [...prev, label] : prev.filter(x => x !== label));
        }
      }, [disfavorites]);

      // Toggle a single set in/out of per-user favorites. Optimistic update
      // mirrors the label-favorite handler. Caller must pass a valid set_id
      // ("s_xxxxxx") — UI hides the star button on un-IDed sets.
      const handleToggleFavoriteSet = useCallback(async (setId) => {
        if (!setId) return;
        if (isViewingAsOtherRef.current) { setPersonaBlockMsg("Set favorites disabled in view-as mode"); return; }
        const isFav = favoriteSets.has(setId);
        setFavoriteSets(prev => {
          const next = new Set(prev);
          if (isFav) next.delete(setId); else next.add(setId);
          return next;
        });
        // v1.6 — mirror server-side mutex locally: adding to favorites
        // removes from disfavor-sets for the same set_id.
        if (!isFav) {
          setDisfavorSets(prev => {
            if (!prev.has(setId)) return prev;
            const next = new Set(prev); next.delete(setId); return next;
          });
        }
        try {
          if (isFav) {
            await fetch(`${API_BASE}/favorite-sets/${encodeURIComponent(setId)}`, {
              method: "DELETE",
              headers: { ...csrfHeaders() },
            });
          } else {
            await fetch(`${API_BASE}/favorite-sets`, {
              method: "POST",
              headers: { "Content-Type": "application/json", ...csrfHeaders() },
              body: JSON.stringify({ setId }),
            });
          }
        } catch (_) {
          // Revert optimistic update on error
          setFavoriteSets(prev => {
            const next = new Set(prev);
            if (isFav) next.add(setId); else next.delete(setId);
            return next;
          });
        }
      }, [favoriteSets]);

      // v1.6 — Toggle a single set in/out of per-user disfavor-sets.
      // Mirror of handleToggleFavoriteSet. Local mutex with favoriteSets
      // (server-side dbAddDisfavorSet already enforces this).
      const handleToggleDisfavorSet = useCallback(async (setId) => {
        if (!setId) return;
        if (isViewingAsOtherRef.current) { setPersonaBlockMsg("Set disfavorites disabled in view-as mode"); return; }
        const isDis = disfavorSets.has(setId);
        setDisfavorSets(prev => {
          const next = new Set(prev);
          if (isDis) next.delete(setId); else next.add(setId);
          return next;
        });
        if (!isDis) {
          setFavoriteSets(prev => {
            if (!prev.has(setId)) return prev;
            const next = new Set(prev); next.delete(setId); return next;
          });
        }
        try {
          if (isDis) {
            await fetch(`${API_BASE}/disfavor-sets/${encodeURIComponent(setId)}`, {
              method: "DELETE",
              headers: { ...csrfHeaders() },
            });
          } else {
            await fetch(`${API_BASE}/disfavor-sets`, {
              method: "POST",
              headers: { "Content-Type": "application/json", ...csrfHeaders() },
              body: JSON.stringify({ setId }),
            });
          }
        } catch (_) {
          setDisfavorSets(prev => {
            const next = new Set(prev);
            if (isDis) next.add(setId); else next.delete(setId);
            return next;
          });
        }
      }, [disfavorSets]);

      // v1.6 — Cycle a set's status: neutral → favorite → disfavor → neutral.
      // Used by the SetRow's per-set status button. Both fav and disfavor
      // handlers carry server-side AND local mutex, so a single call per
      // transition suffices.
      const handleCycleSetStatus = useCallback((setId) => {
        if (!setId) return;
        const isFav = favoriteSets.has(setId);
        const isDis = disfavorSets.has(setId);
        if (!isFav && !isDis) handleToggleFavoriteSet(setId);  // neutral → favorite
        else if (isFav)       handleToggleDisfavorSet(setId);  // favorite → disfavor (server mutex clears favorite)
        else                  handleToggleDisfavorSet(setId);  // disfavor → neutral (just untoggle)
      }, [favoriteSets, disfavorSets, handleToggleFavoriteSet, handleToggleDisfavorSet]);

      const [openSwapKey, setOpenSwapKey] = useState(null);

      const handleToggleSwap = useCallback((blockIdx, setIdx) => {
        const key = `${blockIdx}-${setIdx}`;
        setOpenSwapKey(prev => prev === key ? null : key);
      }, []);

      const handleApplySwap = useCallback((blockIdx, setIdx, newSet) => {
        setWorkout(prev => {
          const blocks = prev.blocks.map((b, bi) => {
            if (bi !== blockIdx) return b;
            const sets = b.sets.map((s, si) => si === setIdx ? newSet : s);
            const totalYards = sets.reduce((sum, s) => sum + s.reps * s.dist, 0) * (b.rounds || 1);
            return { ...b, sets, totalYards };
          });
          return { ...prev, blocks };
        });
        setOpenSwapKey(null);
      }, []);

      // ── Pace rescaling ────────────────────────────────────────────
      const PACE_BASELINE_SECS = 120; // app intervals calibrated for 2:00/100yd

      const handleApplyPace = useCallback(() => {
        const parts = paceInput.trim().split(":");
        if (parts.length !== 2) return;
        const userSecs = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        if (!userSecs || userSecs < 30 || userSecs > 300) return;
        const ratio = userSecs / PACE_BASELINE_SECS;
        setWorkout(prev => {
          const newBlocks = prev.blocks.map(b => Array.isArray(b.sets) ? ({
            ...b,
            sets: b.sets.map(s => ({ ...s, interval: scaleInterval(s.interval, ratio) })),
          }) : b);   // Section model B — dryland blocks have no intervals; pass through.
          return { ...prev, blocks: newBlocks, estimatedMin: calcEstimatedMin(newBlocks) };
        });
      }, [paceInput]);

      // ── Per-set interval editing ──────────────────────────────────
      const [editIntervalKey,   setEditIntervalKey]   = useState(null);
      const [editIntervalDraft, setEditIntervalDraft] = useState("");
      // S2 — inline rejection message when normalizeIntervalInput can't parse
      // the draft. Cleared on successful commit, cancel, or next keystroke.
      const [editIntervalError, setEditIntervalError] = useState(null);

      const handleStartEditInterval = useCallback((bIdx, sIdx, current) => {
        setEditIntervalKey(`${bIdx}-${sIdx}`);
        setEditIntervalDraft(current);
        setEditIntervalError(null);
        setOpenSwapKey(null);
      }, []);

      // S2 — commit goes through normalizeIntervalInput. Empty draft closes
      // the editor without changes; unparseable input keeps the editor open
      // and surfaces an inline error so the user can fix it; valid input is
      // stored as the canonical string (math always sees canonical form).
      const handleCommitInterval = useCallback((bIdx, sIdx, draft) => {
        const norm = normalizeIntervalInput(draft);
        if (norm.error) {
          setEditIntervalError(norm.error);
          return; // keep editor open so user can correct
        }
        if (norm.value != null) {
          setWorkout(prev => {
            const newBlocks = prev.blocks.map((b, bi) => bi !== bIdx ? b : {
              ...b,
              sets: b.sets.map((s, si) => si !== sIdx ? s : { ...s, interval: norm.value }),
            });
            return { ...prev, blocks: newBlocks, estimatedMin: calcEstimatedMin(newBlocks) };
          });
        }
        setEditIntervalKey(null);
        setEditIntervalDraft("");
        setEditIntervalError(null);
      }, []);

      // S2 — ⊘ button: clears the set's interval to the canonical no-interval
      // sentinel. calcEstimatedMin will fall back to yd/min for that set.
      const handleClearInterval = useCallback((bIdx, sIdx) => {
        setWorkout(prev => {
          const newBlocks = prev.blocks.map((b, bi) => bi !== bIdx ? b : {
            ...b,
            sets: b.sets.map((s, si) => si !== sIdx ? s : { ...s, interval: NO_INTERVAL_CANONICAL }),
          });
          return { ...prev, blocks: newBlocks, estimatedMin: calcEstimatedMin(newBlocks) };
        });
        setEditIntervalKey(null);
        setEditIntervalDraft("");
        setEditIntervalError(null);
      }, []);

      const handleCancelInterval = useCallback(() => {
        setEditIntervalKey(null);
        setEditIntervalDraft("");
        setEditIntervalError(null);
      }, []);

      // ── Round rest editing ───────────────────────────────────────
      const handleRoundRestChange = useCallback((blockIdx, newSecs) => {
        const secs = Math.max(0, Math.min(300, parseInt(newSecs, 10) || 0));
        setWorkout(prev => {
          const newBlocks = prev.blocks.map((b, i) =>
            i !== blockIdx ? b : { ...b, roundRestSecs: secs }
          );
          return { ...prev, blocks: newBlocks, estimatedMin: calcEstimatedMin(newBlocks) };
        });
      }, []);

      // ── Per-set description editing ───────────────────────────────
      const [editDescKey,   setEditDescKey]   = useState(null);
      const [editDescDraft, setEditDescDraft] = useState("");

      const handleStartEditDesc = useCallback((bIdx, sIdx, current) => {
        setEditDescKey(`${bIdx}-${sIdx}`);
        setEditDescDraft(current);
        setOpenSwapKey(null);
        setEditIntervalKey(null);
      }, []);

      const handleCommitDesc = useCallback((bIdx, sIdx, draft) => {
        const val = draft.trim();
        if (val) {
          setWorkout(prev => {
            const newBlocks = prev.blocks.map((b, bi) => bi !== bIdx ? b : {
              ...b,
              sets: b.sets.map((s, si) => si !== sIdx ? s : { ...s, desc: val }),
            });
            return { ...prev, blocks: newBlocks };
          });
        }
        setEditDescKey(null);
        setEditDescDraft("");
      }, []);

      const handleCancelDesc = useCallback(() => {
        setEditDescKey(null);
        setEditDescDraft("");
      }, []);

      // W2 — Apply parsed-intent tokens to generator form state. Each token
      // category maps to a setter; tokens with no setter (e.g. zone) are
      // silent no-ops by design (visible in the chip preview only). When
      // duration AND distance both present, distance wins (it's more direct).
      // Multiple type tokens: first wins.
      const handleApplyIntent = useCallback((parsed) => {
        if (!parsed || !parsed.tokens || !parsed.tokens.length) return;
        const isMeters = poolMode === "25m" || poolMode === "50m";

        // Pre-pass: capture pace before computing distance from duration
        // (duration → maxYards needs paceSecs). Apply pace immediately so
        // the input is consistent if Generate fires next.
        const paceTok = parsed.tokens.find(t => t.kind === "pace");
        if (paceTok) {
          const m  = Math.floor(paceTok.value / 60);
          const ss = String(paceTok.value % 60).padStart(2, "0");
          setPaceInput(`${m}:${ss}`);
        }
        const effectivePaceSecs = paceTok
          ? paceTok.value
          : (() => {
              const parts = (paceInput || "").trim().split(":");
              if (parts.length !== 2) return 120;
              const m = parseInt(parts[0], 10), s = parseInt(parts[1], 10);
              return (isNaN(m) || isNaN(s)) ? 120 : m * 60 + s;
            })();

        // Track which categories have already applied so multi-token kinds
        // honor the "first wins" rule (e.g. "im technique" → im selected).
        let appliedType = false;
        let appliedDistance = false;

        for (const tok of parsed.tokens) {
          switch (tok.kind) {
            case "type":
              if (!appliedType) {
                setSelectedType(tok.value);
                appliedType = true;
              }
              break;
            case "distance": {
              if (appliedDistance) break;
              let yards = tok.value;
              if (tok.unit === "m" && !isMeters)      yards = Math.round(tok.value * 1.0936 / 50) * 50;
              else if (tok.unit === "y" && isMeters)  yards = Math.round(tok.value * 0.9144 / 50) * 50;
              const lo = isMeters ? 1300 : 1200;
              const hi = 5000;
              setMaxYards(Math.max(lo, Math.min(hi, yards)));
              appliedDistance = true;
              break;
            }
            case "duration": {
              if (appliedDistance) break;  // explicit distance wins
              const y = Math.round(2400 * (tok.value / 60) * (120 / effectivePaceSecs) / 50) * 50;
              const lo = isMeters ? 2000 : 1900;
              const hi = 5000;
              setMaxYards(Math.max(lo, Math.min(hi, y)));
              appliedDistance = true;  // treat duration as having set the budget
              break;
            }
            case "recovery":
              setRecoveryMode(true);
              break;
            case "equipment":
              setEquipment(prev => ({ ...prev, [tok.value]: "preferred" }));
              break;
            case "pace":
              // Already applied in the pre-pass above.
              break;
            case "zone":
              // No direct form control — visible in chip preview only.
              // Future: a "preferred zone" hint could bias the picker.
              break;
            default:
              break;
          }
        }
      }, [poolMode, paceInput]);

      // ── Late-declared deps moved up so the useCallback dep arrays below see
      // real values (not the var-hoisted undefined). These previously sat near
      // line 15017+ which caused stale-closure risk in handleGenerate /
      // handleRegenerateSection / handleSave. ────────────────────────────

      // R-D: generate-for picker. State = group_id string OR "myself".
      // coachTargets is the loaded list of groups the user coaches (with
      // member counts + current_phase). Loaded once when authenticated and
      // is_coach. Defaults to "myself" — solo training is the default flow.
      const [generateForId, setGenerateForId] = useState("myself");
      const [coachTargets,   setCoachTargets]  = useState([]);
      // R-E: lane plans for the currently-selected group (loaded on demand).
      // generateForPlanId is "" = no plan (stored paces) or plan id.
      const [lanePlansForTarget, setLanePlansForTarget] = useState([]);
      const [generateForPlanId,  setGenerateForPlanId]  = useState("");
      useEffect(() => {
        if (!authenticated || !effectiveMe?.is_coach) { setCoachTargets([]); return; }
        fetch("/api/picker/coach-targets", { cache: "no-store" })
          .then(r => r.ok ? r.json() : [])
          .then(data => setCoachTargets(Array.isArray(data) ? data : []))
          .catch(() => setCoachTargets([]));
      }, [authenticated, effectiveMe?.is_coach, view]);
      // R-E: when a multi-member group is picked, load its lane plans. Reset
      // selection to default plan if one exists (so "Generate" with the
      // default plan is a one-click flow on each visit).
      useEffect(() => {
        if (generateForId === "myself" || !generateForId) { setLanePlansForTarget([]); setGenerateForPlanId(""); return; }
        const target = coachTargets.find(t => t.id === generateForId);
        if (!target || target.member_count < 2) { setLanePlansForTarget([]); setGenerateForPlanId(""); return; }
        fetch(`/api/groups/${generateForId}/lane-plans`, { cache: "no-store" })
          .then(r => r.ok ? r.json() : [])
          .then(plans => {
            const arr = Array.isArray(plans) ? plans : [];
            setLanePlansForTarget(arr);
            const def = arr.find(p => p.is_default);
            setGenerateForPlanId(def ? def.id : "");
          })
          .catch(() => { setLanePlansForTarget([]); setGenerateForPlanId(""); });
      }, [generateForId, coachTargets]);
      // Resolve the currently-selected target (or null for "myself").
      const generateForTarget = useMemo(() => {
        if (generateForId === "myself" || !generateForId) return null;
        return coachTargets.find(t => t.id === generateForId) || null;
      }, [generateForId, coachTargets]);
      // Effective phase: group's current_phase overrides the user's personal
      // phase when generating for a group (decision #39).
      const effectivePhase = generateForTarget?.current_phase || phase;

      // Phase 3 PSC slice 3 — per-practice checklist data fetch.
      // When Generate target switches to a group, fetch its active constraints
      // roll-up so the coach can opt in (per-practice) to additional restrictions.
      // Selection resets per target switch (no leaky-state between groups).
      useEffect(() => {
        setTonightSelected(new Set());
        if (!generateForTarget || !generateForTarget.id) {
          setGroupActiveConstraints({});
          return;
        }
        fetch(`${API_BASE}/groups/${encodeURIComponent(generateForTarget.id)}/active-constraints`, { cache: "no-store" })
          .then(r => r.ok ? r.json() : {})
          .then(map => { if (map && typeof map === "object") setGroupActiveConstraints(map); else setGroupActiveConstraints({}); })
          .catch(() => setGroupActiveConstraints({}));
      }, [generateForTarget?.id]);

      // Derived: flat list of (swimmerKey, constraint) pairs for the checklist.
      // swimmerKey is either users.sub (real swimmer) or ms_xxxx (managed).
      const tonightChecklistRows = useMemo(() => {
        const out = [];
        for (const [swimmerKey, list] of Object.entries(groupActiveConstraints || {})) {
          if (!Array.isArray(list)) continue;
          for (const c of list) out.push({ swimmerKey, c });
        }
        return out;
      }, [groupActiveConstraints]);

      // The subset of checked constraints, expanded into the picker-shape array.
      const tonightOverrides = useMemo(() => {
        if (!tonightSelected.size) return [];
        const out = [];
        for (const { c } of tonightChecklistRows) {
          if (tonightSelected.has(c.id)) out.push(c);
        }
        return out;
      }, [tonightChecklistRows, tonightSelected]);

      // N1: recently-used main-set labels for the signed-in user (last 7 days).
      // Returns Map<label, daysAgo> — used for (a) generator weight down-bias and
      // (b) "last seen Nd ago" badges in the favorites panel + main-set blocks.
      const recentMainLabels = useMemo(() => {
        const mySub = me?.sub;
        const map = new Map();
        if (!mySub || !history.length) return map;
        const today = new Date().toISOString().slice(0, 10);
        const cutoffMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
        for (const e of history) {
          if (e.sub !== mySub) continue;
          if (e.completed === false) continue;
          if (!e.dateCompleted) continue;
          const ts = new Date(`${e.dateCompleted}T00:00:00Z`).getTime();
          if (ts < cutoffMs) continue;
          if (!Array.isArray(e.blocks)) continue;
          const daysAgo = Math.max(0, Math.round((new Date(today) - new Date(e.dateCompleted)) / 86400000));
          for (const b of e.blocks) {
            const label = extractMainLabel(b);
            if (!label) continue;
            const prev = map.get(label);
            if (prev === undefined || daysAgo < prev) map.set(label, daysAgo);
          }
        }
        return map;
      }, [history, me]);

      const handleGenerate = useCallback(() => {
        if (!selectedType) return;
        // Build pinned block map from current workout state
        const pinned = {};
        if (workout) {
          for (const b of workout.blocks) {
            if (pinnedSections[b.section]) pinned[b.section] = b;
          }
        }
        // S4 #7 — union saved-history labels with this session's just-picked labels.
        const recentLabels = Array.from(new Set([
          ...recentMainLabels.keys(),
          ...sessionRecentLabels,
        ]));
        // v2.0 — multi-lane: parse rows into pace-seconds array. Invalid rows
        // are dropped silently (the input box turns red so the coach sees it).
        // If multiLaneMode is OFF or no valid lanes, fall back to single-pace.
        const lanesPaceSecs = multiLaneMode
          ? manualLanesPace.map(l => parsePaceMSS(l.pace)).filter(s => s !== null)
          : null;
        const useMultiLane = multiLaneMode && Array.isArray(lanesPaceSecs) && lanesPaceSecs.length > 0;
        let newWorkout = generateWorkout({
          typeId:         selectedType,
          maxYards,
          // v1.13 — same union pattern as disfavor: own + coach-propagated.
          favorites:      Array.from(new Set([...favorites, ...effectiveFavoriteLabels])),
          equipment,
          poolMode,
          userMin:        sliderMin,
          pinnedBlocks:   pinned,
          recentLabels,
          recoveryMode,
          phase: effectivePhase,                                               // R-D: group-context override (#39)
          favoriteSetIds: new Set([...favoriteSets, ...effectiveFavoriteSetIds]),
          sectionBias,                                                          // Real-shift section-proportion controls (Mix pills)
          includedSections,                                                     // Section model A2 — skip warmup/drill/cooldown per workout
          sectionSources,                                                       // S3 — Bank/Engine/Mix per section
          recentEngineTemplates,                                                // S3 — anti-repeat memory for engine
          // v1.13 — engine favorites union (own + coach-propagated)
          engineFavorites: (() => {
            const seen = new Set();
            const out = [];
            for (const e of [...engineFavorites, ...effectiveEngineFavorites]) {
              const k = `${e.template_id}:${e.stroke}`;
              if (!seen.has(k)) { seen.add(k); out.push(e); }
            }
            return out;
          })(),
          // v1.7 — union user's OWN disfavorites with effective coach
          // propagation. Union (not effective alone) so optimistic toggle
          // updates apply immediately even before refreshEffectiveDisfavorites
          // re-fetches. Coach contributions stay invisible to the swimmer's
          // audit panel (which reads own-only state).
          disfavorites: Array.from(new Set([...disfavorites, ...effectiveDisfavorLabels])),
          engineDisfavorites: (() => {
            const seen = new Set();
            const out = [];
            for (const e of [...engineDisfavorites, ...effectiveEngineDisfavorites]) {
              const k = `${e.template_id}:${e.stroke}`;
              if (!seen.has(k)) { seen.add(k); out.push(e); }
            }
            return out;
          })(),
          disfavorSetIds: new Set([...disfavorSets, ...effectiveDisfavorSetIds]),
          disfavorMode,                                                         // v1.8 — downweight or exclude
          lanesPaceSecs: useMultiLane ? lanesPaceSecs : null,                   // v2.0 — multi-lane fit filter
          ugcOverlay,                                                           // UGC Phase B — bank overlay merged in getBankOptions
          myConstraints,                                                         // Phase 3 PSC slice 2 — step-0 hard-exclude (skipped in multi-lane)
          tonightOverrides,                                                       // Phase 3 PSC slice 3 — per-practice checklist selections (in-memory, never persisted)
        });
        // S3 #3 — generateWorkout returns a failure sentinel when required equipment
        // can't be satisfied. Surface the message and bail before any post-processing.
        if (newWorkout && newWorkout.__generateFailure) {
          setGenerateError(newWorkout.error || "Could not build a workout matching your constraints.");
          return;
        }
        // R-D: stamp assignment target onto the workout so the pill renders in
        // the workout-display header AND survives to history (the payload JSON
        // round-trips this field).
        if (generateForTarget) {
          newWorkout.assignment_target = {
            kind:         "group",
            group_id:     generateForTarget.id,
            group_name:   generateForTarget.name,
            member_count: generateForTarget.member_count,
            phase:        generateForTarget.current_phase || null,
          };
        }
        setGenerateError(null);
        // Apply user's pace to intervals at generation time (not just on "Rescale all")
        const parts = paceInput.trim().split(":");
        if (parts.length === 2) {
          const userSecs = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
          if (userSecs && userSecs >= 30 && userSecs <= 300 && userSecs !== PACE_BASELINE_SECS) {
            const ratio = userSecs / PACE_BASELINE_SECS;
            const newBlocks = newWorkout.blocks.map(b => ({
              ...b,
              sets: b.sets.map(s => ({ ...s, interval: scaleInterval(s.interval, ratio) })),
            }));
            newWorkout = { ...newWorkout, blocks: newBlocks, estimatedMin: calcEstimatedMin(newBlocks) };
          }
        }
        // C: recovery mode → stretch every interval +10% on top of any pace
        // scaling, and mark the workout so the UI can render the green badge.
        if (recoveryMode) {
          const newBlocks = newWorkout.blocks.map(b => ({
            ...b,
            sets: b.sets.map(s => ({ ...s, interval: scaleInterval(s.interval, 1.10) })),
          }));
          newWorkout = { ...newWorkout, blocks: newBlocks, recovery: true, estimatedMin: calcEstimatedMin(newBlocks) };
        }
        // N5: stamp the current training phase on the workout so the soft
        // badge renders alongside the summary bar.
        if (phase && PHASES[phase]) {
          newWorkout = { ...newWorkout, phase };
        }
        // v2.1 — stamp multi-lane state onto the workout so save-to-history
        // round-trips it. Workout payload is JSON server-side so no migration.
        if (useMultiLane) {
          const lanesForPersist = manualLanesPace
            .filter(l => parsePaceMSS(l.pace) !== null)
            .map(l => ({ lane_label: l.lane_label || "Lane", pace: l.pace }));
          if (lanesForPersist.length) {
            newWorkout = { ...newWorkout, multi_lane: { lanes: lanesForPersist } };
          }
        }
        setWorkout(newWorkout);
        // v2.0 — multi-lane: auto-route to MultiPacePrintView. The print view
        // takes the canonical workout + lane paces and renders per-lane pages.
        // setMultiPaceLanes mounts the print overlay; coach can dismiss to
        // return to the editor with the workout still loaded.
        if (useMultiLane && newWorkout.multi_lane?.lanes?.length) {
          setMultiPaceLanes({ lanes: newWorkout.multi_lane.lanes, mode: "per_lane" });
        }
        // S3 — write side: prepend engine entries to recent[], cap at 10,
        // post to settings.extra. Fire-and-forget; errors don't block UI.
        const newEngineEntries = [];
        for (const b of newWorkout.blocks || []) {
          if (b && b.__engineMeta && b.__engineMeta.template_id) {
            newEngineEntries.push({
              template_id: b.__engineMeta.template_id,
              stroke: b.__engineMeta.stroke || "free",
              ts: Date.now(),
            });
          }
        }
        if (newEngineEntries.length) {
          setRecentEngineTemplates(prev => {
            const next = [...newEngineEntries, ...prev].slice(0, 10);
            if (typeof fetch === "function" && csrf.token) {
              fetch(`${API_BASE}/settings/extra`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf.token },
                body: JSON.stringify({ engine_recent_templates: next }),
              }).catch(() => {});
            }
            return next;
          });
        }
        // S4 #7 — record this session's main label for future anti-repeat.
        const mainLabel = newWorkout.blocks && newWorkout.blocks[2] && newWorkout.blocks[2].label;
        if (mainLabel) setSessionRecentLabels(prev => new Set([...prev, mainLabel]));
        setLoadedFromHistoryId(null);
        setSaveStatus(null); setSaveError(null);
        setRegenError(null);
        setDateDraft(new Date().toISOString().slice(0, 10));
        setNoteDraft("");
        setFocusNoteDraft("");
        setDifficultyDraft(null);
        setOpenSwapKey(null);
        setEditIntervalKey(null);
        setEditDescKey(null);
      }, [selectedType, maxYards, equipment, favorites, poolMode, paceInput, sliderMin, pinnedSections, workout, recentMainLabels, sessionRecentLabels, recoveryMode, phase, favoriteSets, effectivePhase, generateForTarget, sectionBias, sectionSources, recentEngineTemplates, disfavorites, engineDisfavorites, disfavorSets, effectiveDisfavorLabels, effectiveDisfavorSetIds, effectiveEngineDisfavorites, disfavorMode, engineFavorites, effectiveFavoriteLabels, effectiveFavoriteSetIds, effectiveEngineFavorites, multiLaneMode, manualLanesPace, includedSections]);

      // Regenerate one section in place, holding the other three fixed.
      // On failure (no valid alternative), keep the workout untouched and
      // surface a per-section inline error.
      const handleRegenerateSection = useCallback((sectionKey, sourceOverride = null) => {
        if (!workout || !selectedType) return;
        if (pinnedSections[sectionKey]) return; // pinned sections can't be individually regenerated
        const isRecovery = !!workout.recovery;
        // S4 #7 — same union as handleGenerate so main regenerations also avoid repeats.
        const recentLabels = Array.from(new Set([
          ...recentMainLabels.keys(),
          ...sessionRecentLabels,
        ]));
        // v1.3 fix — sourceOverride lets callers (e.g. the section-source
        // toggle's setTimeout) pass the new source EXPLICITLY, bypassing
        // stale-closure issues where sectionSources hadn't repropagated yet
        // when the regen was queued. If no override, read current state.
        const effectiveSource = sourceOverride || sectionSources[sectionKey] || "bank";
        const result = regenerateSection({
          workout,
          typeId:       selectedType,
          sectionKey,
          maxYards,
          equipment,
          poolMode,
          userMin:      sliderMin,
          recentLabels,
          recoveryMode: isRecovery,
          phase,
          // v1.13 — union own + coach-propagated favorites (mirror v1.7).
          // Gap-1 (2026-05-22) — set-level (favoriteSetIds/disfavorSetIds)
          // now wired in regenerateSection's main-section picker.
          favorites: Array.from(new Set([...favorites, ...effectiveFavoriteLabels])),
          favoriteSetIds: new Set([...favoriteSets, ...effectiveFavoriteSetIds]),
          engineFavorites: (() => {
            const seen = new Set();
            const out = [];
            for (const e of [...engineFavorites, ...effectiveEngineFavorites]) {
              const k = `${e.template_id}:${e.stroke}`;
              if (!seen.has(k)) { seen.add(k); out.push(e); }
            }
            return out;
          })(),
          sectionSource: effectiveSource,
          recentEngineTemplates,
          // v1.7 — union own + effective coach propagation (see handleGenerate)
          disfavorites: Array.from(new Set([...disfavorites, ...effectiveDisfavorLabels])),
          disfavorSetIds: new Set([...disfavorSets, ...effectiveDisfavorSetIds]),
          engineDisfavorites: (() => {
            const seen = new Set();
            const out = [];
            for (const e of [...engineDisfavorites, ...effectiveEngineDisfavorites]) {
              const k = `${e.template_id}:${e.stroke}`;
              if (!seen.has(k)) { seen.add(k); out.push(e); }
            }
            return out;
          })(),
          disfavorMode,                                                         // v1.8
          ugcOverlay,                                                           // UGC Phase B — overlay merged into bank picker
          myConstraints,                                                         // Phase 3 PSC slice 2 — step-0 hard-exclude (skipped in multi-lane)
          tonightOverrides,                                                       // Phase 3 PSC slice 3 — per-practice checklist (regen honors the same selections)
        });
        if (result.error) {
          setRegenError({ section: sectionKey, message: result.error });
          return;
        }
        // Scale new section's intervals to match current pace
        let regenWorkout = result.workout;
        const parts = paceInput.trim().split(":");
        if (parts.length === 2) {
          const userSecs = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
          if (userSecs && userSecs >= 30 && userSecs <= 300 && userSecs !== PACE_BASELINE_SECS) {
            const ratio = userSecs / PACE_BASELINE_SECS;
            const newBlocks = regenWorkout.blocks.map((b, bi) => {
              const origBlock = workout.blocks[bi];
              // Only rescale the regenerated section; leave others as-is
              if (b.section !== sectionKey) return b;
              return { ...b, sets: b.sets.map(s => ({ ...s, interval: scaleInterval(s.interval, ratio) })) };
            });
            regenWorkout = { ...regenWorkout, blocks: newBlocks, estimatedMin: calcEstimatedMin(newBlocks) };
          }
        }
        // C: if the existing workout is a recovery-day workout, apply the +10%
        // interval stretch to the regenerated section so it matches its siblings.
        if (isRecovery) {
          const newBlocks = regenWorkout.blocks.map(b => {
            if (b.section !== sectionKey) return b;
            return { ...b, sets: b.sets.map(s => ({ ...s, interval: scaleInterval(s.interval, 1.10) })) };
          });
          regenWorkout = { ...regenWorkout, blocks: newBlocks, recovery: true, estimatedMin: calcEstimatedMin(newBlocks) };
        }
        setWorkout(regenWorkout);
        // S4 #7 — if main was regenerated, record the new label for anti-repeat.
        if (sectionKey === "main") {
          const newMainLabel = regenWorkout.blocks && regenWorkout.blocks[2] && regenWorkout.blocks[2].label;
          if (newMainLabel) setSessionRecentLabels(prev => new Set([...prev, newMainLabel]));
        }
        // v1.1 — write side for section regen: if the regenerated section
        // used the engine, prepend its template+stroke to recentEngineTemplates
        // (same shape as handleGenerate's write path).
        const regenBlock = regenWorkout.blocks.find(b => b.section === sectionKey);
        if (regenBlock && regenBlock.__engineMeta && regenBlock.__engineMeta.template_id) {
          const newEntry = {
            template_id: regenBlock.__engineMeta.template_id,
            stroke: regenBlock.__engineMeta.stroke || "free",
            ts: Date.now(),
          };
          setRecentEngineTemplates(prev => {
            const next = [newEntry, ...prev].slice(0, 10);
            if (typeof fetch === "function" && csrf.token) {
              fetch(`${API_BASE}/settings/extra`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf.token },
                body: JSON.stringify({ engine_recent_templates: next }),
              }).catch(() => {});
            }
            return next;
          });
        }
        setRegenError(null);
        setEditDescKey(null);
        setEditIntervalKey(null);
        // A single-section regen makes this a fresh, unsaved workout — even if
        // it was previously loaded from history.
        setLoadedFromHistoryId(null);
        setSaveStatus(null); setSaveError(null);
      }, [workout, selectedType, maxYards, equipment, poolMode, paceInput, sliderMin, pinnedSections, recentMainLabels, sessionRecentLabels, phase, favorites, favoriteSets, sectionSources, recentEngineTemplates, disfavorites, engineDisfavorites, disfavorSets, effectiveDisfavorLabels, effectiveDisfavorSetIds, effectiveEngineDisfavorites, disfavorMode, engineFavorites, effectiveFavoriteLabels, effectiveFavoriteSetIds, effectiveEngineFavorites]);

      const handleTogglePin = useCallback((sectionKey) => {
        setPinnedSections(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
      }, []);

      const handleTypeSelect = (id) => { setSelectedType(id); setWorkout(null); setLoadedFromHistoryId(null); setSaveStatus(null); setRegenError(null); setGenerateError(null); setPinnedSections({}); };
      const handleMaxChange  = (v)  => { setMaxYards(v); setWorkout(null); setLoadedFromHistoryId(null); setSaveStatus(null); setRegenError(null); setGenerateError(null); };
      const handlePoolModeChange = (mode) => {
        setPoolMode(mode);
        setWorkout(null);
        setLoadedFromHistoryId(null);
        setSaveStatus(null);
        setRegenError(null);
        setGenerateError(null);
        setPinnedSections({});
        setMaxYards(mode === "50m" || mode === "25m" ? 2500 : 2400);
      };
      // F: `mode` is "off" | "preferred" | "required" (legacy booleans accepted).
      const handleEquipChange = (id, mode) => {
        const next = mode === true ? "required" :
                     mode === false || mode == null ? "off" :
                     mode;
        setEquipment(prev => {
          const updated = { ...prev, [id]: next };
          // Persist to settings.extra.equipment_modes (best-effort).
          fetch(`${API_BASE}/settings/extra`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({ equipment_modes: updated }),
          }).catch(() => {});
          return updated;
        });
        setWorkout(null);
        setLoadedFromHistoryId(null);
        setSaveStatus(null);
        setRegenError(null);
        setGenerateError(null);
      };

      // Save the current workout to history (POST to worker, optimistic local update)
      const handleSave = useCallback(async () => {
        if (!workout || !selectedType) return;
        if (isViewingAsOtherRef.current) { setPersonaBlockMsg("Save disabled in view-as mode"); return; }
        setSaveStatus("saving"); setSaveError(null);
        // I — if we're editing a scheduled-workout row (loaded via the
        // ✎ Edit action in WeekView), PATCH the schedule row's payload
        // instead of creating a new history entry. Schedule row keeps
        // its date; only payload changes.
        if (editingScheduledId) {
          try {
            // Enrich payload with form context (matches Phase 1 schedule POST
            // — see comment there).
            const enrichedPayload = {
              ...workout,
              maxYardsCap: workout.maxYardsCap || maxYards,
              poolMode:    workout.poolMode    || poolMode,
              equipment:   workout.equipment   || { ...equipment },
              focusNote:   workout.focusNote   || focusNoteDraft || undefined,
            };
            const res = await fetch(`/api/scheduled-workouts/${editingScheduledId}`, {
              method:  "PATCH",
              headers: { "Content-Type": "application/json", ...csrfHeaders() },
              body:    JSON.stringify({ payload: enrichedPayload }),
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
            setSaveStatus("scheduled");
            setEditingScheduledId(null);
            setTimeout(() => setSaveStatus(null), 2500);
            return;
          } catch (err) {
            setSaveStatus("error");
            setSaveError(`Schedule update failed: ${err.message || String(err)}`);
            return;
          }
        }
        const meta = WORKOUT_TYPES.find(t => t.id === selectedType);
        const cleanInitials = normalizeInitials(initialsDraft);
        // Remember the last-used initials for next time (best-effort).
        try {
          if (cleanInitials) localStorage.setItem(USER_INITIALS_KEY, cleanInitials);
        } catch (_) {}
        const entry = {
          id: makeEntryId(),
          savedAt: new Date().toISOString(),
          dateCompleted: dateDraft,
          type: selectedType,
          typeLabel: meta ? meta.label : selectedType,
          totalYards: workout.totalYards,
          estimatedMin: workout.estimatedMin,
          maxYardsCap: maxYards,
          poolMode: poolMode,
          equipment: { ...equipment },
          blocks: workout.blocks.map(b => b.kind === "dryland" ? ({
            // Section model B — dryland blocks persist exercises, not swim sets.
            kind: "dryland", section: "dryland", name: b.name,
            placement: b.placement || "pre",
            exercises: (b.exercises || []).map(e => ({ ...e })),
            totalYards: 0,
          }) : ({
            name: b.name, section: b.section, totalYards: b.totalYards,
            rounds: b.rounds, roundRestSecs: b.roundRestSecs,
            label: b.label,
            sets: b.sets.map(s => ({ ...s })),
          })),
          userInitials: cleanInitials,
          notes: (noteDraft || "").trim(),
          focusNote: (focusNoteDraft || "").trim() || undefined,
          difficulty: difficultyDraft || undefined,
          recovery: workout.recovery ? true : undefined,
          phase: workout.phase || undefined,
          completed: dateDraft <= new Date().toISOString().slice(0, 10),
          // R-D: assignment metadata snapshot persists in payload JSON so
          // history loads can render the pill without an extra fetch.
          assignment_target: workout.assignment_target || undefined,
          // v2.1 — multi-lane snapshot for history. Carries the lanes the
          // workout was generated for. Load-from-history restores App state.
          multi_lane: workout.multi_lane || undefined,
        };
        // R-D: include assign_to for fanout when generate-for picker is set.
        // Server validates caller has access to the group + writes assignment
        // rows in the same /api/log-workout call.
        // R-E: include lane_plan_id when one was selected — server uses the
        // plan's lanes as the authoritative member list with per-lane pace.
        if (generateForTarget?.id) {
          entry.assign_to = { group_id: generateForTarget.id };
          if (generateForPlanId) entry.assign_to.lane_plan_id = generateForPlanId;
        }
        // Optimistic: add to local cache and state immediately
        setHistory(prev => {
          const next = mergeById(prev, [entry]);
          saveLocalHistory(next);
          return next;
        });
        try {
          const res = await fetch(`${API_BASE}/log-workout`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify(entry),
          });
          // S5 S7 — 409 means the server already has this entry id (a prior
          // attempt of the same submission succeeded; this is a network retry).
          // The optimistic local state is correct as-is; treat it as success
          // rather than surfacing a confusing "duplicate id" error.
          if (res.status === 409) {
            setSaveStatus("saved");
            setNoteDraft("");
            setFocusNoteDraft("");
            setDifficultyDraft(null);
            return;
          }
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `HTTP ${res.status}`);
          }
          const saved = await res.json().catch(() => ({}));
          // Replace optimistic entry with server's version (which has sub stamped)
          if (saved.entry) {
            setHistory(prev => {
              const next = prev.map(e => e.id === entry.id ? saved.entry : e);
              saveLocalHistory(next);
              return next;
            });
          }
          setSaveStatus("saved");
          setNoteDraft("");
          setFocusNoteDraft("");
          setDifficultyDraft(null);
        } catch (err) {
          setSaveStatus("error");
          setSaveError(err.message || String(err));
        }
      }, [workout, selectedType, maxYards, equipment, dateDraft, noteDraft, initialsDraft, poolMode, focusNoteDraft, difficultyDraft, generateForTarget, generateForPlanId, editingScheduledId]);

      // Log a completed Run-mode workout as today's session.
      // Used by RunWorkoutOverlay's finish screen — POSTs a NEW entry dated today,
      // not a duplicate of any source entry's id/sub. Returns true on success.
      const handleLogAsToday = useCallback(async (sourceWorkout, opts = {}) => {
        if (!sourceWorkout || !sourceWorkout.blocks || !sourceWorkout.type) {
          return { ok: false, error: "missing workout fields" };
        }
        if (isViewingAsOtherRef.current) { setPersonaBlockMsg("Log disabled in view-as mode"); return { ok: false, error: "view-as preview" }; }
        // R-G: if this run was launched from an assignment ("Run this workout"
        // on AssignedToMeView), write completion back to the assignment row
        // instead of creating a new workout in the swimmer's history. The
        // canonical workout already exists in the coach's history; we just
        // stamp completion + splits on the assignment.
        if (runAssignmentId) {
          try {
            const res = await fetch(`/api/assignments/${runAssignmentId}`, {
              method:  "PATCH",
              headers: { "Content-Type": "application/json", ...csrfHeaders() },
              body:    JSON.stringify({
                completion_state: "complete",
                splits_payload:   (opts.actualSplits && opts.actualSplits.length) ? opts.actualSplits : null,
                difficulty:       opts.difficulty || null,
                focus_note:       (opts.notes || "").trim() || null,
              }),
            });
            const j = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
            // Clear the assignment tag so subsequent solo runs save normally.
            setRunAssignmentId(null);
            return { ok: true, assignment: true };
          } catch (err) {
            return { ok: false, error: err.message || String(err) };
          }
        }
        const meta = WORKOUT_TYPES.find(t => t.id === sourceWorkout.type);
        const today = new Date().toISOString().slice(0, 10);
        const cleanInitials = normalizeInitials(initialsDraft) || sourceWorkout.userInitials || "";
        const entry = {
          id: makeEntryId(),
          savedAt: new Date().toISOString(),
          dateCompleted: today,
          type: sourceWorkout.type,
          typeLabel: sourceWorkout.typeLabel || (meta ? meta.label : sourceWorkout.type),
          totalYards: sourceWorkout.totalYards,
          estimatedMin: sourceWorkout.estimatedMin,
          maxYardsCap: sourceWorkout.maxYardsCap,
          poolMode: sourceWorkout.poolMode || "25y",
          equipment: { ...(sourceWorkout.equipment || {}) },
          blocks: sourceWorkout.blocks.map(b => b.kind === "dryland" ? ({
            kind: "dryland", section: "dryland", name: b.name,
            placement: b.placement || "pre",
            exercises: (b.exercises || []).map(e => ({ ...e })),
            totalYards: 0,
          }) : ({
            name: b.name, section: b.section, totalYards: b.totalYards,
            rounds: b.rounds, roundRestSecs: b.roundRestSecs,
            label: b.label,
            sets: b.sets.map(s => ({ ...s })),
          })),
          userInitials: cleanInitials,
          notes: (opts.notes || "").trim(),
          focusNote: sourceWorkout.focusNote || undefined,
          difficulty: opts.difficulty || undefined,
          recovery: sourceWorkout.recovery ? true : undefined,
          phase: sourceWorkout.phase || undefined,
          actual_splits: opts.actualSplits && opts.actualSplits.length > 0 ? opts.actualSplits : undefined,
          completed: true,
        };
        // I — if this run was launched from a scheduled-workout row, tag the
        // log call so the server stamps completed_workout_id on the schedule
        // row. Cleared after the request returns (success or failure).
        if (runScheduledId) entry.scheduled_id = runScheduledId;
        setHistory(prev => {
          const next = mergeById(prev, [entry]);
          saveLocalHistory(next);
          return next;
        });
        try {
          const res = await fetch(`${API_BASE}/log-workout`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify(entry),
          });
          // S5 S7 — same idempotent treatment as handleSave: 409 means the
          // entry was already accepted by a prior attempt. Optimistic add stays.
          if (res.status === 409) {
            return { ok: true };
          }
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `HTTP ${res.status}`);
          }
          const saved = await res.json().catch(() => ({}));
          if (saved.entry) {
            setHistory(prev => {
              const next = prev.map(e => e.id === entry.id ? saved.entry : e);
              saveLocalHistory(next);
              return next;
            });
          }
          // I — clear the scheduled-id tag once the log succeeds.
          if (runScheduledId) setRunScheduledId(null);
          return { ok: true };
        } catch (err) {
          // Roll back optimistic add
          setHistory(prev => {
            const next = prev.filter(e => e.id !== entry.id);
            saveLocalHistory(next);
            return next;
          });
          return { ok: false, error: err.message || String(err) };
        }
      }, [initialsDraft, runAssignmentId, runScheduledId]);

      const handleUpdateCompleted = useCallback(async (id, completed) => {
        setHistory(prev => {
          const next = prev.map(e => e.id === id ? { ...e, completed } : e);
          saveLocalHistory(next);
          return next;
        });
        try {
          await fetch(`${API_BASE}/workouts/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({ completed }),
          });
        } catch (err) { console.error("Failed to update completed:", err); }
      }, []);

      const handleUpdateNotes = useCallback(async (id, notes) => {
        setHistory(prev => {
          const next = prev.map(e => e.id === id ? { ...e, notes } : e);
          saveLocalHistory(next);
          return next;
        });
        try {
          await fetch(`${API_BASE}/workouts/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({ notes }),
          });
        } catch (err) { console.error("Failed to update notes:", err); }
      }, []);

      // PATCH difficulty (1–5 or null). Optimistic; reverts on failure.
      const handleUpdateDifficulty = useCallback(async (id, difficulty) => {
        const prevHistory = history;
        setHistory(prev => {
          const next = prev.map(e => e.id === id ? { ...e, difficulty } : e);
          saveLocalHistory(next);
          return next;
        });
        try {
          const res = await fetch(`${API_BASE}/workouts/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({ difficulty }),
          });
          if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);
        } catch (err) {
          console.error("Failed to update difficulty:", err);
          setHistory(prevHistory);
          saveLocalHistory(prevHistory);
        }
      }, [history]);

      const handleDelete = useCallback(async (id) => {
        setHistory(prev => {
          const next = prev.filter(e => e.id !== id);
          saveLocalHistory(next);
          return next;
        });
        try {
          await fetch(`${API_BASE}/workouts/${id}`, { method: "DELETE", headers: { ...csrfHeaders() } });
        } catch (err) { console.error("Failed to delete entry:", err); }
      }, []);

      // Load a past workout into the generator view and trigger Print
      const handleLoadAndPrint = useCallback((entry) => {
        setSelectedType(entry.type);
        setMaxYards(entry.maxYardsCap || 2400);
        setPoolMode(entry.poolMode || "25y");
        setEquipment(entry.equipment || { kickboard: "off", fins: "off", paddles: "off", pullBuoy: "off", snorkel: "off" });
        // Reconstruct a workout-shaped object from the saved entry. v2.1:
        // carry multi_lane through so the print view can re-render per-lane.
        setWorkout({
          blocks: entry.blocks,
          totalYards: entry.totalYards,
          estimatedMin: entry.estimatedMin,
          typeId: entry.type,
          multi_lane: entry.multi_lane || undefined,
        });
        // v2.1 — restore multi-lane App state when entry carries lanes.
        if (entry.multi_lane && Array.isArray(entry.multi_lane.lanes) && entry.multi_lane.lanes.length) {
          setMultiLaneMode(true);
          setManualLanesPace(entry.multi_lane.lanes.map((l, i) => ({
            lane_label: l.lane_label || `Lane ${i + 1}`,
            pace: l.pace || "",
          })));
        }
        setLoadedFromHistoryId(entry.id);
        setFocusNoteDraft(entry.focusNote || "");
        setSaveStatus(null);
        setRegenError(null);
        setView("generator");
        // Wait for the next paint, then open the print dialog
        setTimeout(() => window.print(), 150);
      }, []);

      // Repeat a historical workout as a fresh, unsaved one. Same blocks/type/
      // equipment as the source entry, but loadedFromHistoryId stays null so
      // the Save form appears with today's date and empty notes. Per-section
      // regenerate buttons remain enabled — user can shuffle pieces before
      // logging the repeat as its own history entry.
      const handleRepeatFromHistory = useCallback((entry) => {
        setSelectedType(entry.type);
        setMaxYards(entry.maxYardsCap || 2400);
        setPoolMode(entry.poolMode || "25y");
        setEquipment(entry.equipment || { kickboard: "off", fins: "off", paddles: "off", pullBuoy: "off", snorkel: "off" });
        setWorkout({
          blocks: entry.blocks,
          totalYards: entry.totalYards,
          estimatedMin: entry.estimatedMin,
          typeId: entry.type,
          multi_lane: entry.multi_lane || undefined,
        });
        // v2.1 — restore multi-lane state for the repeat path too.
        if (entry.multi_lane && Array.isArray(entry.multi_lane.lanes) && entry.multi_lane.lanes.length) {
          setMultiLaneMode(true);
          setManualLanesPace(entry.multi_lane.lanes.map((l, i) => ({
            lane_label: l.lane_label || `Lane ${i + 1}`,
            pace: l.pace || "",
          })));
        }
        setLoadedFromHistoryId(null);     // treat as fresh / unsaved
        setSaveStatus(null); setSaveError(null);
        setRegenError(null);
        setDateDraft(new Date().toISOString().slice(0, 10));
        setNoteDraft("");
        setView("generator");
      }, []);

      // Q: derive countdown state for the next event chip. Returns null when no
      // event is set OR when the event date is more than 1 day in the past.
      // Past day-of (i.e. yesterday) is treated as cleared from display — the
      // underlying settings.extra.next_event row stays put until the user edits it.
      const nextEventCountdown = useMemo(() => {
        if (!nextEvent || !nextEvent.date) return null;
        const today = new Date(); today.setHours(0,0,0,0);
        const target = new Date(`${nextEvent.date}T00:00:00`);
        if (isNaN(target)) return null;
        const days = Math.round((target - today) / 86400000);
        if (days < 0) return null; // past — hide display, keep data
        return { name: nextEvent.name || "Your event", days };
      }, [nextEvent]);

      // R-C / decision #38: upcoming team events (across all the user's teams
      // they're a coach on or have a group membership in). Refreshed when the
      // user navigates between views to absorb event creates/deletes promptly.
      const [upcomingTeamEvents, setUpcomingTeamEvents] = useState([]);
      useEffect(() => {
        if (!authenticated) return;
        fetch("/api/events/upcoming", { cache: "no-store" })
          .then(r => r.ok ? r.json() : [])
          .then(data => setUpcomingTeamEvents(Array.isArray(data) ? data : []))
          .catch(() => setUpcomingTeamEvents([]));
      }, [authenticated, view]);
      // Pick the most-imminent team event for the pill. Server returns events
      // in date-ascending order, so we just take the first non-past one.
      const teamEventPill = useMemo(() => {
        if (!upcomingTeamEvents.length) return null;
        const today = new Date(); today.setHours(0,0,0,0);
        for (const ev of upcomingTeamEvents) {
          const target = new Date(`${ev.date}T00:00:00`);
          if (isNaN(target)) continue;
          const days = Math.round((target - today) / 86400000);
          if (days >= 0) return { ...ev, days };
        }
        return null;
      }, [upcomingTeamEvents]);

      // P: derive the display name used for personalization throughout the app.
      // Falls back display_name → initials → null. Possessive needs the first
      // word only, so "Patrick James" → "Patrick" → "Patrick's workout."
      const personalFirstName = useMemo(() => {
        const dn = (me?.display_name || "").trim();
        if (dn) {
          const first = dn.split(/\s+/)[0];
          if (first) return first;
        }
        const ini = (me?.initials || "").trim();
        return ini || null;
      }, [me]);

      // Quick-launch — last 3 completed workouts belonging to the signed-in user.
      // Powers the pre-pool "do yesterday's again" cards above the Generate button.
      const quickLaunch = useMemo(() => {
        const mySub = me?.sub;
        if (!mySub) return [];
        const mine = history.filter(e =>
          e.sub === mySub && e.completed !== false && e.dateCompleted && e.blocks
        );
        if (!mine.length) return [];
        mine.sort((a, b) => b.dateCompleted.localeCompare(a.dateCompleted));
        const today = new Date().toISOString().slice(0, 10);
        return mine.slice(0, 3).map(e => {
          const diffDays = Math.round((new Date(today) - new Date(e.dateCompleted)) / 86400000);
          let when;
          if      (diffDays === 0) when = "Today";
          else if (diffDays === 1) when = "Yesterday";
          else if (diffDays <  7)  when = `${diffDays} days ago`;
          else if (diffDays < 14)  when = "1 week ago";
          else                     when = `${Math.floor(diffDays / 7)} weeks ago`;
          const unit = (e.poolMode === "50m" || e.poolMode === "25m") ? "m" : "yds";
          const typeMeta = WORKOUT_TYPES.find(t => t.id === e.type);
          return {
            id: e.id,
            entry: e,
            emoji: typeMeta ? typeMeta.emoji : "🏊",
            label: e.typeLabel || (typeMeta ? typeMeta.label : e.type),
            when,
            totalYards: e.totalYards || 0,
            estimatedMin: e.estimatedMin,
            unit,
          };
        });
      }, [history, me]);

      // Auth gate — render nothing while checking, show gate if no valid code
      if (authenticated === null) return null; // still checking
      if (!authenticated) return <SignInGate authError={authError} />;

      const meta = WORKOUT_TYPES.find(t => t.id === selectedType);
      const sectionColors = ["#38bdf8", "#2dd4bf", "var(--color-primary)", "var(--color-text-muted)"];
      const unit = (poolMode === "50m" || poolMode === "25m") ? "m" : "yds";
      const typeMin = selectedType ? minYardsForType(selectedType, poolMode) : 0;
      const canGenerate = selectedType && maxYards >= typeMin;

      return (
        <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, var(--color-bg) 0%, #1e3a5f 50%, var(--color-bg) 100%)" }}>
          {/* Skip-link — keyboard-only users can jump straight to main content.
              Visually hidden until focused (Phase 1 item 8, 2026-05-26). */}
          <a href="#main-content"
             style={{
               position: "absolute", left: "-9999px", top: "auto",
               width: 1, height: 1, overflow: "hidden",
             }}
             onFocus={(e) => {
               Object.assign(e.target.style, {
                 position: "fixed", left: "8px", top: "8px",
                 width: "auto", height: "auto", overflow: "visible",
                 padding: "10px 16px", background: "var(--color-primary)",
                 color: "#fff", borderRadius: 6, textDecoration: "none",
                 fontSize: 14, fontWeight: 700, zIndex: 99999,
               });
             }}
             onBlur={(e) => {
               Object.assign(e.target.style, {
                 position: "absolute", left: "-9999px", top: "auto",
                 width: 1, height: 1, overflow: "hidden",
                 padding: 0, background: "transparent", color: "inherit",
                 borderRadius: 0, fontSize: "inherit", fontWeight: "inherit", zIndex: "auto",
               });
             }}
          >Skip to main content</a>
          {/* v3 impersonation banner — sticky at top (above view-as banner)
              when an active impersonation session exists. Persistent and
              dismiss-resistant on purpose: this is a customer-support session
              acting as another user, NOT a UI preview. Hard-red background
              to distinguish from the amber view-as v1 banner. Countdown
              ticks every 5s. */}
          {impersonationState && (
            <ImpersonationBanner state={impersonationState} onExit={handleEndImpersonation} />
          )}
          {/* View-as banner — sticky at top when admin has flipped into a
              role-override mode. Only renders to actual admins (real me)
              who picked something other than "self". One-click exit. */}
          {me?.is_admin && (viewAsRole !== "self" || viewAsParent) && (
            <div className="screen-only" style={{
              position: "sticky", top: 0, zIndex: 9000,
              background: "var(--color-warn)", color: "#1e293b",
              padding: "6px 16px", fontSize: 12, fontWeight: 700,
              display: "flex", justifyContent: "center", alignItems: "center", gap: 12,
              boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            }}>
              <span>👁 PREVIEW MODE — viewing as <strong style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>{viewAsRole}{viewAsParent ? " + parent" : ""}</strong> · fresh-user view · writes blocked</span>
              <button
                type="button"
                onClick={() => { setViewAsParent(false); setViewAsRole("self"); }}
                style={{
                  background: "rgba(30, 41, 59, 0.85)", color: "#fff",
                  border: "none", borderRadius: 4,
                  padding: "3px 12px", fontSize: 11, fontWeight: 700,
                  cursor: "pointer",
                }}>
                Exit (reload)
              </button>
            </div>
          )}
          {/* Parent invite accept cards — explicit consent for any pending
              invites matching this user's verified email (from bootstrap). */}
          {authenticated && pendingInvites.length > 0 && (
            <ParentInviteCards invites={pendingInvites} onResolved={refreshBootstrap} />
          )}
          {/* Billing v1 — post-Stripe-redirect banner. Auto-clears in 8s.
              Renders above the persona-block toast (higher z-index). */}
          {upgradeBanner && (
            <div className="screen-only" style={{
              position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
              zIndex: 9060, maxWidth: 560, width: "calc(100% - 32px)",
              background: upgradeBanner.kind === "success" ? "var(--color-positive)" : "rgba(30, 41, 59, 0.95)",
              color: "#fff",
              padding: "12px 18px", borderRadius: 8,
              fontSize: 13, fontWeight: 600, lineHeight: 1.5,
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              border: upgradeBanner.kind === "success" ? "none" : "1px solid var(--color-primary)",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            }}>
              <span>{upgradeBanner.kind === "success" ? "✓ " : "ⓘ "}{upgradeBanner.text}</span>
              <button onClick={() => setUpgradeBanner(null)}
                aria-label="Dismiss"
                style={{ background: "transparent", border: "none", color: "inherit", fontSize: 18, cursor: "pointer", padding: 0, lineHeight: 1 }}>
                ×
              </button>
            </div>
          )}
          {/* v2 persona-block toast — surfaces a brief reason when a write
              is intercepted while viewing-as. Auto-clears in 2.5s. */}
          {personaBlockMsg && (
            <div className="screen-only" style={{
              position: "fixed", top: 60, left: "50%", transform: "translateX(-50%)",
              zIndex: 9050,
              background: "rgba(30, 41, 59, 0.95)", color: "#fff",
              padding: "10px 18px", borderRadius: 999,
              fontSize: 13, fontWeight: 600,
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              border: "1px solid var(--color-warn)",
            }}>
              ⚠ {personaBlockMsg}
            </div>
          )}
          {/* Header */}
          <header className="screen-only" role="banner" style={{ background: "var(--color-bg)", borderBottom: "1px solid #1e40af", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
            <div style={{ maxWidth: 940, margin: "0 auto", padding: "20px 24px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
                {/* SetForge logo. /icons/icon-192.png is served via the
                    public/icons/ static folder. 36px target gives a crisp
                    render on standard DPI; the 192px source covers 2x. */}
                <img src="/icons/icon-192.png" alt="SetForge" width="36" height="36"
                  style={{ display: "block", borderRadius: 6, flexShrink: 0 }} />
                <div>
                  <h1 style={{ fontFamily: '"Inter Tight", Inter, sans-serif', fontSize: 28, fontWeight: 800, color: "var(--color-text)", margin: 0, letterSpacing: "-0.02em" }}>SetForge</h1>
                {/* Banner tagline (2026-05-27): when signed in, show provider
                    icon(s) + the user's full display_name. Hidden entirely when
                    signed out. Helps disambiguate Apple vs Google account when
                    a user has both registered (which today produces two
                    separate user rows per GOOGLE_OAUTH_SCOPE decision 3). */}
                {me?.display_name && (
                  <p style={{ color: "var(--color-text-muted)", fontSize: 13, margin: "2px 0 0", display: "flex", alignItems: "center", gap: 6 }}>
                    {(me.providers || []).map(p => (
                      p.provider === 'apple' ? (
                        <svg key="apple" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-label="Apple" style={{ flexShrink: 0 }}>
                          <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                        </svg>
                      ) : p.provider === 'google' ? (
                        <svg key="google" width="13" height="13" viewBox="0 0 24 24" aria-label="Google" style={{ flexShrink: 0 }}>
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                      ) : null
                    ))}
                    <span>{me.display_name}</span>
                  </p>
                )}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                <nav aria-label="Primary" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button onClick={() => setView(v => v === "generator" ? "history" : "generator")}
                    style={{
                      padding: "8px 14px", borderRadius: 8,
                      border: "1px solid var(--color-border)", background: "var(--color-card)",
                      color: "var(--color-text)", fontSize: 13, fontWeight: 600,
                      cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
                    }}>
                    {view === "generator" ? "📜 History" : "⏎ Generator"}
                    {view === "generator" && history.length > 0 && (
                      <span style={{ background: "var(--color-primary)", color: "#fff", borderRadius: 999, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>
                        {history.length}
                      </span>
                    )}
                  </button>
                  {/* R-G: 📥 Assigned to me — visible to all auth users (any
                      account may be a swimmer in someone's group). */}
                  {authenticated && (
                    <button onClick={() => setView(v => v === "assigned" ? "generator" : "assigned")}
                      title={view === "assigned" ? "Back to generator" : "Workouts assigned to you"}
                      aria-label={view === "assigned" ? "Back to generator" : "Workouts assigned to you"}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--color-primary)", background: view === "assigned" ? "var(--color-primary)" : "var(--color-card)", color: view === "assigned" ? "var(--color-bg)" : "var(--color-primary)", fontSize: 13, fontWeight: 700, cursor: "pointer", lineHeight: 1 }}>
                      {view === "assigned" ? "⏎" : "📥"}
                    </button>
                  )}
                  {/* I — 📅 Week view (planning grid). Visible to all auth users. */}
                  {authenticated && (
                    <button onClick={() => setView(v => v === "week" ? "generator" : "week")}
                      title={view === "week" ? "Back to generator" : "Plan your week"}
                      aria-label={view === "week" ? "Back to generator" : "Plan your week"}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--color-primary)", background: view === "week" ? "var(--color-primary)" : "var(--color-card)", color: view === "week" ? "var(--color-bg)" : "var(--color-primary)", fontSize: 13, fontWeight: 700, cursor: "pointer", lineHeight: 1 }}>
                      {view === "week" ? "⏎" : "📅"}
                    </button>
                  )}
                  {/* 👪 Parent view — visible when this user has at least one
                      active guardian row (effectiveMe.is_parent — so the admin
                      view-as +parent flag also surfaces the button). Toggleable
                      so users who are also a swimmer/coach can still reach
                      their other views. */}
                  {effectiveMe?.is_parent && (
                    <button onClick={() => setView(v => v === "parent" ? "generator" : "parent")}
                      title={view === "parent" ? "Back to generator" : "Parent view (your swimmers)"}
                      aria-label={view === "parent" ? "Back to generator" : "Parent view"}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--color-primary)", background: view === "parent" ? "var(--color-primary)" : "var(--color-card)", color: view === "parent" ? "var(--color-bg)" : "var(--color-primary)", fontSize: 13, fontWeight: 700, cursor: "pointer", lineHeight: 1 }}>
                      {view === "parent" ? "⏎" : "👪"}
                    </button>
                  )}
                  {/* Setforge rebrand 2026-05-20 — Coach dropdown collapses
                      Teams / Swimmers / Catalog (REBRAND_SCOPE §8.1). Visible
                      only to coaches. Clicking the trigger toggles a small
                      menu; clicking an item navigates + closes. */}
                  {effectiveMe?.is_coach && (
                    <div style={{ position: "relative", display: "inline-flex" }}>
                      <button onClick={() => setCoachMenuOpen(v => !v)}
                        title="Coach tools (Teams, Swimmers, Catalog)"
                        aria-label="Coach tools menu"
                        aria-haspopup="menu"
                        aria-expanded={coachMenuOpen}
                        style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--color-primary)",
                          background: ["teams","swimmers","practices","catalog","my-sets"].includes(view) ? "var(--color-primary)" : "var(--color-card)",
                          color: ["teams","swimmers","practices","catalog","my-sets"].includes(view) ? "var(--color-bg)" : "var(--color-primary)",
                          fontSize: 13, fontWeight: 700, cursor: "pointer", lineHeight: 1,
                          display: "inline-flex", alignItems: "center", gap: 4 }}>
                        🔧 <span style={{ fontSize: 10 }}>▾</span>
                      </button>
                      {coachMenuOpen && (
                        <>
                          {/* Click-outside catcher */}
                          <div onClick={() => setCoachMenuOpen(false)}
                            style={{ position: "fixed", inset: 0, zIndex: 50 }} />
                          <div className="card" style={{
                            position: "absolute", top: "calc(100% + 4px)", right: 0,
                            borderRadius: 8,
                            boxShadow: "0 8px 24px rgba(0,0,0,0.4)", minWidth: 180, zIndex: 51,
                            padding: 4,
                          }}>
                            {[
                              { id: "teams",     emoji: "👥", label: "Teams" },
                              { id: "swimmers",  emoji: "🏊", label: "Managed swimmers" },
                              { id: "practices", emoji: "📋", label: "Practices" },
                              { id: "catalog",   emoji: "📚", label: "Catalog" },
                              { id: "my-sets",  emoji: "📝", label: "My Sets" },
                            ].map(item => {
                              const active = view === item.id;
                              return (
                                <button key={item.id}
                                  onClick={() => { setView(item.id); setCoachMenuOpen(false); }}
                                  style={{
                                    display: "flex", width: "100%", alignItems: "center", gap: 8,
                                    padding: "8px 12px", borderRadius: 5, border: "none",
                                    background: active ? "rgba(59,130,246,0.12)" : "transparent",
                                    color: active ? "var(--color-primary)" : "#cbd5e1",
                                    fontSize: 13, fontWeight: active ? 700 : 500, cursor: "pointer",
                                    textAlign: "left",
                                  }}>
                                  <span>{item.emoji}</span><span>{item.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {/* Reports — top-nav (was under 🔧 coach dropdown in Phase B).
                      Promoted out 2026-05-23 with Phase C so solo users get
                      access to their own Program Recap. ReportsView itself
                      gates the per-tab visibility by role. */}
                  {authenticated && (
                    <button onClick={() => setView(v => v === "reports" ? "generator" : "reports")}
                      title={view === "reports" ? "Back to generator" : "Reports"}
                      aria-label={view === "reports" ? "Back to generator" : "Reports"}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--color-border)",
                        background: view === "reports" ? "var(--color-border)" : "var(--color-card)",
                        color: view === "reports" ? "var(--color-text)" : "var(--color-text-dim)",
                        fontSize: 13, fontWeight: 700, cursor: "pointer", lineHeight: 1 }}>
                      {view === "reports" ? "⏎" : "📊"}
                    </button>
                  )}
                  {/* Progress dashboard — top-nav, all authed users (free-tier
                      retention surface; Phase 5 #2). */}
                  {authenticated && (
                    <button onClick={() => setView(v => v === "progress" ? "generator" : "progress")}
                      title={view === "progress" ? "Back to generator" : "Progress (your training + bests)"}
                      aria-label={view === "progress" ? "Back to generator" : "Progress"}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--color-border)",
                        background: view === "progress" ? "var(--color-border)" : "var(--color-card)",
                        color: view === "progress" ? "var(--color-text)" : "var(--color-text-dim)",
                        fontSize: 13, fontWeight: 700, cursor: "pointer", lineHeight: 1 }}>
                      {view === "progress" ? "⏎" : "📈"}
                    </button>
                  )}
                  {effectiveMe?.is_admin && (() => {
                    const pendingFb = view === "admin" ? 0 : (me?.pending_feedback_count || 0);
                    return (
                      <button onClick={() => setView(v => v === "admin" ? "generator" : "admin")}
                        title={view === "admin"
                          ? "Back to generator"
                          : pendingFb > 0
                            ? `Admin — ${pendingFb} new feedback item${pendingFb === 1 ? "" : "s"}`
                            : "Admin"}
                        aria-label={view === "admin"
                          ? "Back to generator"
                          : pendingFb > 0
                            ? `Admin console — ${pendingFb} new feedback item${pendingFb === 1 ? "" : "s"}`
                            : "Admin console"}
                        style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--color-primary)", background: view === "admin" ? "var(--color-primary)" : "var(--color-card)", color: view === "admin" ? "var(--color-bg)" : "var(--color-primary)", fontSize: 13, fontWeight: 700, cursor: "pointer", lineHeight: 1, position: "relative" }}>
                        {view === "admin" ? "⏎" : "🛡"}
                        {/* Feedback-count badge — only when not on admin view AND
                            count > 0. Hidden when viewing admin to avoid stale
                            "look here" signal while you're already there. */}
                        {pendingFb > 0 && (
                          <span style={{
                            position: "absolute",
                            top: -6, right: -6,
                            minWidth: 16, height: 16,
                            padding: "0 4px",
                            borderRadius: 8,
                            background: "var(--color-warn)",
                            color: "var(--color-bg)",
                            fontSize: 10, fontWeight: 800,
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            border: "1px solid var(--color-bg)",
                            lineHeight: 1,
                          }}>
                            {pendingFb > 99 ? "99+" : pendingFb}
                          </span>
                        )}
                      </button>
                    );
                  })()}
                  {(me?.is_admin || me?.support_role) && !impersonationState && (
                    <button onClick={() => setShowImpersonationModal(true)}
                      title="Start impersonation (read-only customer-support session)"
                      style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #dc2626", background: "transparent", color: "#fca5a5", fontSize: 13, fontWeight: 700, cursor: "pointer", lineHeight: 1 }}>
                      🛂
                    </button>
                  )}
                  <button onClick={() => setShowProfile(true)} title="Account (also: Send feedback, Sign out)"
                    data-tour="step-swimmer-level"
                    style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-text-dim)", fontSize: 13, fontWeight: 700, cursor: "pointer", lineHeight: 1 }}>
                    👤
                  </button>
                  <a href="/manual.html" target="_blank" rel="noopener" title="User manual"
                    style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-text-dim)", fontSize: 13, fontWeight: 700, cursor: "pointer", textDecoration: "none", lineHeight: 1 }}>
                    ?
                  </a>
                </nav>
                <span style={{ fontSize: 10, color: "var(--color-border)", fontFamily: "monospace" }}>{BUILD_ID}</span>
              </div>
            </div>
          </header>

          <main id="main-content" style={{ maxWidth: 940, margin: "0 auto", padding: "32px 24px" }}>

            {view === "admin"    && <AdminView me={me} onStartImpersonation={handleStartImpersonation} />}
            {view === "parent"   && <ParentDashboard me={me} />}
            {view === "teams"    && <TeamsView />}
            {view === "swimmers" && <ManagedSwimmersView mySub={me?.sub} />}
            {view === "practices" && <PracticesView />}
            {view === "week"     && (
              <WeekView
                myConstraints={myConstraints}
                onRunScheduled={(sw) => {
                  // Same pattern as AssignedToMeView's onRunAssignment: load
                  // the workout into Run mode and tag the schedule id so the
                  // finish-flow writes the completion back via /api/log-workout
                  // with scheduled_id set, which stamps completed_workout_id.
                  //
                  // I Phase 2b — group intents reach Run mode already linked
                  // (the Run handler created the snapshot + ran fanout + linked
                  // the schedule row in one log-workout call). Skip
                  // runScheduledId so the coach's actual-swim completion
                  // doesn't attempt a second link / duplicate workout entry.
                  setRunWorkout(sw.payload);
                  if (!sw._alreadyLinked) setRunScheduledId(sw.id);
                  setShowRestPicker(true);
                  setView("generator");
                }}
                onEditScheduled={(sw) => {
                  // Load the scheduled workout back into the generator workout
                  // slot so the user can regenerate / tweak / re-save. Tag
                  // so handleSave can offer "Update schedule" instead of "Save as new."
                  //
                  // CRITICAL: must restore selectedType from the payload. The
                  // workout-display block reads
                  //   meta = WORKOUT_TYPES.find(t => t.id === selectedType)
                  // and crashes on meta.badge if selectedType is null (bug
                  // surfaced 2026-05-20 when Edit was clicked on a fresh page
                  // load without first selecting a type → "undefined is not
                  // an object 'meta.badge'").
                  //
                  // Restore full form context from the enriched payload. The
                  // schedule POST/PATCH sites enrich `payload` with
                  // maxYardsCap/poolMode/equipment/focusNote alongside the
                  // raw workout fields. Pre-enrichment rows (created before
                  // 2026-05-20 hotfix) just have the raw workout — those
                  // conditionals fall through and leave current form state
                  // untouched.
                  const p = sw.payload || {};
                  if (p.typeId)      setSelectedType(p.typeId);
                  if (p.maxYardsCap) setMaxYards(p.maxYardsCap);
                  if (p.poolMode)    setPoolMode(p.poolMode);
                  if (p.equipment)   setEquipment(p.equipment);
                  setFocusNoteDraft(p.focusNote || "");
                  setWorkout(sw.payload);
                  setEditingScheduledId(sw.id);
                  setLoadedFromHistoryId(null);
                  setRunScheduledId(null);
                  setView("generator");
                }}
              />
            )}
            {view === "assigned" && (
              <AssignedToMeView
                onRunAssignment={(a) => {
                  // Load the coach-snapshot workout into Run mode and tag the
                  // assignment so the finish-flow writes back to it instead
                  // of creating a new history entry.
                  setRunWorkout(a.workout);
                  setRunAssignmentId(a.id);
                  setShowRestPicker(true);
                  setView("generator");
                }}
              />
            )}
            {view === "catalog"  && (
              <CatalogView
                favorites={favorites}
                onToggleFavorite={authenticated ? handleToggleFavorite : null}
                favoriteSets={favoriteSets}
                disfavorSets={disfavorSets}
                onCycleSetStatus={authenticated ? handleCycleSetStatus : null}
                ugcOverlay={ugcOverlay}
              />
            )}
            {view === "my-sets"  && (
              <MySetsView
                onChanged={refreshUgcOverlay}
              />
            )}
            {view === "reports"  && (
              <ReportsView isCoach={!!effectiveMe?.is_coach} isAdmin={!!effectiveMe?.is_admin} />
            )}
            {view === "progress" && (
              <ProgressDashboard onPaceUpdate={handlePaceChange} />
            )}

            {view === "history" && (
              <HistoryView
                history={history}
                historyLoaded={historyLoaded}
                onUpdateNotes={handleUpdateNotes}
                onUpdateCompleted={handleUpdateCompleted}
                onUpdateDifficulty={handleUpdateDifficulty}
                recentMainLabels={recentMainLabels}
                goals={goals}
                mySub={me?.sub}
                onDelete={handleDelete}
                onLoadAndPrint={handleLoadAndPrint}
                onRepeat={handleRepeatFromHistory}
                onRun={entry => { setRunWorkout(entry); setShowRestPicker(true); }}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
              />
            )}

            {view === "generator" && <>

            {/* Pool mode toggle + next-event countdown (Q, right-justified) */}
            {/* Setforge rebrand 2026-05-20 — pool-row-wrap class lets the mobile
                breakpoint force pool buttons + label onto row 1 alone, with
                modifiers (Recovery, Phase, Mix pills) wrapping to row 2 cleanly
                (REBRAND_SCOPE §8.3). */}
            <div className="screen-only pool-mode-row" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Pool</span>
              <div className="pool-mode-buttons" data-tour="step-pool-mode" style={{ display: "flex", background: "var(--color-bg)", borderRadius: 8, border: "1px solid var(--color-border)", overflow: "hidden" }}>
                {[["25y","SCY"],["25m","SCM"],["50m","LCM"]].map(([mode, label]) => (
                  <button key={mode} onClick={() => handlePoolModeChange(mode)}
                    style={{
                      padding: "6px 16px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
                      background: poolMode === mode ? "var(--color-primary)" : "transparent",
                      color: poolMode === mode ? "#fff" : "var(--color-text-dim)",
                      transition: "all 0.15s",
                    }}>
                    {label}
                  </button>
                ))}
              </div>
              {/* Team event pill (decision #38) — most-imminent team event
                  across all teams the user is in. Renders to the left of the
                  personal next_event pill. marginLeft: auto on the FIRST one
                  pushes the pair right; subsequent siblings flow naturally. */}
              {teamEventPill && (
                <div title={`${teamEventPill.team_name}: ${teamEventPill.name} — ${teamEventPill.date}`}
                  className="pill"
                  style={{
                    marginLeft: nextEventCountdown ? 0 : "auto",
                    display: "inline-flex", alignItems: "center", gap: 6,
                    background: teamEventPill.days === 0 ? "#f59e0b22" : "#1e3a5f",
                    border: `1px solid ${teamEventPill.days === 0 ? "var(--color-warn)" : "var(--color-warn)"}`,
                    color: teamEventPill.days === 0 ? "#fde68a" : "var(--color-warn)",
                    fontSize: 12,
                  }}>
                  📅
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}>
                    {teamEventPill.team_name}: {teamEventPill.name}
                  </span>
                  <span style={{ color: "var(--color-text-dim)", fontWeight: 400 }}>·</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {teamEventPill.days === 0 ? "today!" : teamEventPill.days === 1 ? "1 day" : `${teamEventPill.days} days`}
                  </span>
                </div>
              )}
              {nextEventCountdown && (
                <div title={`${nextEventCountdown.name} — ${nextEvent.date}`}
                  className="pill"
                  style={{
                    marginLeft: teamEventPill ? 6 : "auto",
                    display: "inline-flex", alignItems: "center", gap: 6,
                    background: nextEventCountdown.days === 0 ? "#f59e0b22" : "#1e3a5f",
                    border: `1px solid ${nextEventCountdown.days === 0 ? "var(--color-warn)" : "var(--color-primary)"}`,
                    color: nextEventCountdown.days === 0 ? "#fde68a" : "var(--color-primary)",
                    fontSize: 12,
                  }}>
                  🏁
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}>
                    {nextEventCountdown.name}
                  </span>
                  <span style={{ color: "var(--color-text-dim)", fontWeight: 400 }}>·</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {nextEventCountdown.days === 0
                      ? "today!"
                      : nextEventCountdown.days === 1
                        ? "1 day"
                        : `${nextEventCountdown.days} days`}
                  </span>
                </div>
              )}
            </div>

            {/* C: Recovery mode toggle (Easy day / Recovery day ON) + section-
                proportion bias (Mix:) — merged onto one flex row 2026-05-27 per
                Cap'n's "save vertical space if room permits" request. Both
                groups flex-wrap as a unit so narrow viewports split them onto
                two lines cleanly. Outer gap 14 = old marginBottom between the
                two stacks. */}
            <div className="screen-only" style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
              {/* Easy day / Recovery day ON toggle + helper text */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={() => setRecoveryMode(v => !v)}
                  title={recoveryMode
                    ? "Recovery day ON — next generate keeps things easy/aerobic"
                    : "Toggle recovery day — easy/aerobic main only, intervals +10%, no repeat sets"}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "6px 14px", borderRadius: 999,
                    border: `1px solid ${recoveryMode ? "var(--color-positive)" : "var(--color-border)"}`,
                    background: recoveryMode ? "rgba(34,197,94,0.15)" : "transparent",
                    color: recoveryMode ? "#86efac" : "var(--color-text-dim)",
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                    transition: "all 0.15s",
                  }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: recoveryMode ? "var(--color-positive)" : "var(--color-border-strong)",
                  }} />
                  {recoveryMode ? "Recovery day ON" : "Easy day"}
                </button>
                {recoveryMode && (
                  <span style={{ fontSize: 11, color: "var(--color-border-strong)", fontStyle: "italic" }}>
                    Easy/aerobic mains · intervals +10% · no repeat sets · floor 1,200 {(poolMode === "50m" || poolMode === "25m") ? "m" : "yds"}
                  </span>
                )}
              </div>

              {/* Section-proportion bias (real-shift). Per-generation, session-
                  only. Shifts yardage allocations between warmup / drill /
                  main / cooldown beyond the baseline ~13/17/65/5 split. */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "var(--color-border-strong)", marginRight: 4 }}>Mix:</span>
                {[
                  { id: "balanced",     label: "Balanced",     desc: "Current allocator (warmup ~13% / drill ~17% / main ~65% / cooldown ~5%)" },
                  { id: "warmup_heavy", label: "Warmup-heavy", desc: "Bigger warmup (~22%); main reduced (~62%)" },
                  { id: "drill_heavy",  label: "Drill-heavy",  desc: "Bigger drill section (~26%); main reduced (~61%)" },
                  { id: "long_main",    label: "Long main",    desc: "Most yardage on the main set (~83%); warmup + drill suppressed" },
                ].map(m => {
                  const active = sectionBias === m.id;
                  return (
                    <button key={m.id} onClick={() => setSectionBias(m.id)} title={m.desc}
                      className="pill"
                      style={{
                        border: `1px solid ${active ? "var(--color-warn)" : "var(--color-border)"}`,
                        background: active ? "rgba(245,158,11,0.15)" : "transparent",
                        color: active ? "var(--color-warn)" : "var(--color-text-dim)",
                        fontSize: 11, cursor: "pointer",
                        transition: "all 0.15s",
                      }}>
                      {m.label}
                    </button>
                  );
                })}
              </div>

              {/* Section model A2 — include/skip per workout. Main is always on.
                  Skipping drops the section (a shorter, honest total). */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "var(--color-border-strong)", marginRight: 4 }}>Sections:</span>
                {[
                  { key: "warmup",   label: "Warmup",   skip: skipWarmup,   toggle: () => setSkipWarmup(v => !v) },
                  { key: "drill",    label: "Drill",    skip: skipDrill,    toggle: () => setSkipDrill(v => !v) },
                  { key: "kick",     label: "Kick",     skip: !addKick,     toggle: () => setAddKick(v => !v) },
                  { key: "main",     label: "Main",     locked: true },
                  { key: "cooldown", label: "Cooldown", skip: skipCooldown, toggle: () => setSkipCooldown(v => !v) },
                ].map(s => {
                  const included = s.locked || !s.skip;
                  return (
                    <button key={s.key} onClick={s.locked ? undefined : s.toggle}
                      title={s.locked ? "Main set is always included" : (included ? `Skip ${s.label.toLowerCase()} on next generate` : `Include ${s.label.toLowerCase()}`)}
                      className="pill"
                      style={{
                        border: `1px solid ${included ? "var(--color-primary)" : "var(--color-border)"}`,
                        background: included ? "rgba(59,130,246,0.12)" : "transparent",
                        color: included ? "var(--color-primary)" : "var(--color-text-dim)",
                        textDecoration: included ? "none" : "line-through",
                        fontSize: 11, cursor: s.locked ? "default" : "pointer", opacity: s.locked ? 0.85 : 1,
                      }}>
                      {included ? "✓ " : ""}{s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Workout type selector */}
            <p className="screen-only" style={{ color: "var(--color-primary)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 12, marginTop: 0 }}>
              Select Workout Type
            </p>
            <div className="screen-only type-card-grid" data-tour="step-type-cards" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              {WORKOUT_TYPES.map(t => {
                const isSel = selectedType === t.id;
                const isHov = hover === t.id;
                return (
                  <button key={t.id}
                    onClick={() => handleTypeSelect(t.id)}
                    onMouseEnter={() => setHover(t.id)}
                    onMouseLeave={() => setHover(null)}
                    style={{
                      borderRadius: 12, border: `2px solid ${isSel ? t.selBg : t.border}`,
                      padding: 16, textAlign: "left", cursor: "pointer",
                      background: isSel ? t.selBg : "var(--color-card)",
                      color: isSel ? "#fff" : "var(--color-text)",
                      transform: isSel ? "scale(1.02)" : isHov ? "scale(1.01)" : "scale(1)",
                      transition: "all 0.15s",
                      boxShadow: isSel ? "0 8px 24px rgba(0,0,0,0.35)" : "none",
                      outline: "none",
                    }}>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>{t.emoji}</div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{t.label}</div>
                    <div style={{ fontSize: 11, marginTop: 2, opacity: 0.75 }}>{t.description}</div>
                  </button>
                );
              })}
            </div>

            <div className="screen-only">

              {/* Equipment checkboxes */}
              <div data-tour="step-equipment"><EquipmentPicker equipment={equipment} onChange={handleEquipChange} /></div>

              {/* Max Yardage / Distance Slider */}
              <div data-tour="step-yardage-slider"><YardageSlider value={maxYards} onChange={handleMaxChange} selectedType={selectedType} poolMode={poolMode} paceInput={paceInput} onPaceChange={handlePaceChange} sliderMin={sliderMin} sliderMax={sliderMax} onRangeChange={handleRangeChange} /></div>

              {/* v2.0 — Multi-lane multi-pace generate. Coach-only. When ON, the
                  picker filters options that fit ALL lane paces and the generate
                  flow auto-opens MultiPacePrintView. Prefills from the selected
                  lane plan when one is in play; otherwise the coach edits rows. */}
              {effectiveMe?.is_coach && (
                <MultiLaneControl
                  multiLaneMode={multiLaneMode}
                  setMultiLaneMode={setMultiLaneMode}
                  manualLanesPace={manualLanesPace}
                  setManualLanesPace={setManualLanesPace}
                  lanePlansForTarget={lanePlansForTarget}
                  generateForPlanId={generateForPlanId}
                />
              )}

              {/* Quick-launch — last 3 of your own completed workouts (pre-pool "do yesterday's again") */}
              {!workout && quickLaunch.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                    Pick up where you left off
                  </div>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: 6,
                  }}>
                    {quickLaunch.map(ql => (
                      <div key={ql.id}
                        onClick={() => { setRunWorkout(ql.entry); setShowRestPicker(true); }}
                        className="card"
                        title="Run this workout"
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          borderRadius: 8,
                          padding: "6px 8px 6px 10px", cursor: "pointer", minHeight: 44,
                          transition: "border-color 0.15s, background 0.15s",
                          WebkitTapHighlightColor: "transparent",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--color-primary)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--color-border)"; }}>
                        <div style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{ql.emoji}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: "#fff", fontWeight: 700, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {ql.label}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--color-text-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {ql.when} · {ql.totalYards.toLocaleString()} {ql.unit}
                            {ql.estimatedMin ? ` · ~${ql.estimatedMin} min` : ""}
                          </div>
                        </div>
                        {/* Actions, inline + right-aligned */}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRepeatFromHistory(ql.entry); }}
                          title="Load into generator (don't auto-start)"
                          style={{
                            padding: "8px 9px", borderRadius: 6,
                            border: "1px solid var(--color-border)", background: "transparent",
                            color: "#86efac", fontSize: 13, cursor: "pointer", flexShrink: 0, lineHeight: 1,
                          }}>
                          🔁
                        </button>
                        <div style={{
                          flexShrink: 0, padding: "8px 10px", borderRadius: 6,
                          background: "#1e3a5f", color: "var(--color-primary)",
                          fontSize: 12, fontWeight: 700,
                          display: "inline-flex", alignItems: "center", gap: 4, lineHeight: 1,
                        }}>
                          ▶ Run
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* W2 — Parse Intent button (smaller, sits above Generate). Opens
                  the IntentParserModal so coaches can fill the form from a
                  natural-language one-liner. Always visible — coaches and
                  swimmers alike can use it; vocabulary is documented in manual. */}
              <button
                onClick={() => setShowIntentParser(true)}
                style={{
                  width: "100%", padding: "9px 0", borderRadius: 10,
                  border: "1px solid var(--color-border)", background: "transparent",
                  color: "var(--color-text-muted)", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", marginBottom: 10, outline: "none",
                }}>
                ✏️ Quick input…
              </button>

              {/* R-D: generate-for picker (coach-only). Lists solo private
                  students separately from multi-member groups per decision
                  #35. State sticks across generations. Phase from the
                  selected group overrides personal phase (decision #39). */}
              {effectiveMe?.is_coach && coachTargets.length > 0 && (() => {
                const solos  = coachTargets.filter(t => t.member_count === 1);
                const groups = coachTargets.filter(t => t.member_count >= 2);
                return (
                  <div style={{ marginBottom: 10, padding: "10px 12px", background: "var(--color-bg)", border: "1px solid var(--color-warn)", borderRadius: 8 }}>
                    <label style={{ display: "block", fontSize: 11, color: "var(--color-warn)", marginBottom: 4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Generate for
                    </label>
                    <select value={generateForId} onChange={e => setGenerateForId(e.target.value)}
                      style={{ width: "100%", padding: "6px 10px", fontSize: 13, background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 5 }}>
                      <option value="myself">Myself (solo training, no assignment)</option>
                      {solos.length > 0 && (
                        <optgroup label="Private students">
                          {solos.map(t => (
                            <option key={t.id} value={t.id}>{t.name}{t.team_name ? ` · ${t.team_name}` : ""}</option>
                          ))}
                        </optgroup>
                      )}
                      {groups.length > 0 && (
                        <optgroup label="Groups">
                          {groups.map(t => (
                            <option key={t.id} value={t.id}>{t.name} ({t.member_count}{t.team_name ? ` · ${t.team_name}` : ""}{t.current_phase ? ` · ${t.current_phase}` : ""})</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    {/* R-E: lane plan picker. Only shown when target is a
                        multi-member group AND it has plans. Defaults to the
                        group's default plan if any. */}
                    {generateForTarget && generateForTarget.member_count >= 2 && lanePlansForTarget.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <label style={{ display: "block", fontSize: 10, color: "var(--color-text-muted)", marginBottom: 3, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Lane plan
                        </label>
                        <select value={generateForPlanId} onChange={e => setGenerateForPlanId(e.target.value)}
                          style={{ width: "100%", padding: "5px 9px", fontSize: 12, background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 5 }}>
                          <option value="">— No plan (each swimmer uses stored pace) —</option>
                          {lanePlansForTarget.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name}{p.is_default ? " (default)" : ""} · {(p.plan_data?.lanes || []).length} lanes · {(p.plan_data?.lanes || []).reduce((n, l) => n + (l.members?.length || 0), 0)} swimmers
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {generateForTarget && (
                      <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 6 }}>
                        {generateForPlanId
                          ? (() => {
                              const p = lanePlansForTarget.find(pl => pl.id === generateForPlanId);
                              const swimmerCount = (p?.plan_data?.lanes || []).reduce((n, l) => n + (l.members?.length || 0), 0);
                              return <>Workout saves to <strong>your history</strong> and fans out as <strong>{swimmerCount} per-lane assignment{swimmerCount === 1 ? "" : "s"}</strong> using plan <strong>{p?.name}</strong>.</>;
                            })()
                          : <>Workout will save to <strong>your history</strong> and fan out as <strong>{generateForTarget.member_count} assignment{generateForTarget.member_count === 1 ? "" : "s"}</strong> to {generateForTarget.name}'s members.</>
                        }
                        {generateForTarget.current_phase && <span> Phase override: <strong>{generateForTarget.current_phase}</strong>.</span>}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Phase 3 PSC slice 3 — per-practice constraint checklist.
                  Shown only when generating for a group whose roster has
                  active constraints. Each checked row gets unioned into
                  tonightOverrides for THIS Generate only (in-memory). */}
              {generateForTarget && tonightChecklistRows.length > 0 && (
                <div style={{ marginBottom: 12, padding: 12, background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: "var(--color-text)", fontWeight: 700 }}>
                      Tonight's constraints
                      <span style={{ color: "var(--color-text-muted)", fontWeight: 400, marginLeft: 6 }}>
                        ({tonightChecklistRows.length} active across roster)
                      </span>
                    </div>
                    {tonightSelected.size > 0 && (
                      <button onClick={() => setTonightSelected(new Set())}
                        style={{ padding: "3px 8px", background: "transparent", color: "var(--color-text-muted)", border: "1px solid var(--color-border)", borderRadius: 4, fontSize: 10, cursor: "pointer" }}>
                        Clear ({tonightSelected.size})
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginBottom: 8, lineHeight: 1.4 }}>
                    Check any constraint to apply to <em>tonight's</em> generated workout only. Persistent constraints already apply automatically — these are extras for one practice.
                  </div>
                  <div style={{ maxHeight: 180, overflowY: "auto", paddingRight: 4 }}>
                    {tonightChecklistRows.map(({ swimmerKey, c }) => {
                      const checked = tonightSelected.has(c.id);
                      const swimmerTag = swimmerKey.startsWith("ms_")
                        ? swimmerKey
                        : swimmerKey.slice(0, 12) + "…";
                      return (
                        <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid var(--color-bg)", fontSize: 12, cursor: "pointer", color: "var(--color-text)" }}>
                          <input type="checkbox" checked={checked}
                            onChange={() => {
                              setTonightSelected(prev => {
                                const next = new Set(prev);
                                if (checked) next.delete(c.id); else next.add(c.id);
                                return next;
                              });
                            }}
                            style={{ accentColor: "var(--color-primary)" }} />
                          <code style={{ fontFamily: "monospace", fontSize: 10, color: "var(--color-text-muted)", minWidth: 80 }}>{swimmerTag}</code>
                          <span style={{ flex: 1 }}>{formatPscRow(c)}</span>
                        </label>
                      );
                    })}
                  </div>
                  {tonightSelected.size > 0 && (
                    <div style={{ fontSize: 11, color: "var(--color-primary)", marginTop: 8, fontWeight: 700 }}>
                      → {tonightSelected.size} constraint{tonightSelected.size === 1 ? "" : "s"} will apply to this Generate.
                    </div>
                  )}
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                data-tour="step-generate-button"
                style={{
                  width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
                  fontWeight: 700, fontSize: 15, cursor: canGenerate ? "pointer" : "not-allowed",
                  background: canGenerate ? meta.selBg : "var(--color-border)",
                  color: canGenerate ? "#fff" : "var(--color-text-dim)",
                  boxShadow: canGenerate ? "0 8px 24px rgba(0,0,0,0.3)" : "none",
                  transition: "all 0.15s", marginBottom: 32, outline: "none",
                }}>
                {workout ? "🔄 Generate New Workout" : "🏊 Generate Workout"}
              </button>

              {/* I Phase 2a — save current form state as a deferred intent.
                  Visible whenever the form is ready to generate AND the user
                  is authenticated. Useful when planning ahead without
                  committing to a specific shuffle. */}
              {canGenerate && authenticated && (
                <div style={{ marginTop: -22, marginBottom: 28, textAlign: "center" }}>
                  <button onClick={() => {
                      const t = new Date(); t.setDate(t.getDate() + 1);
                      const y = t.getFullYear(), m = String(t.getMonth() + 1).padStart(2, "0"), d = String(t.getDate()).padStart(2, "0");
                      setIntentDate(`${y}-${m}-${d}`);
                    }}
                    title="Save these settings as an intent for a future day — generate the actual workout on the day of"
                    style={{
                      background: "transparent", border: "none", color: "var(--color-warn)",
                      fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 4,
                      textDecoration: "underline", textDecorationStyle: "dotted",
                    }}>
                    💾 Save as intent for later…
                  </button>
                </div>
              )}

              {/* S3 #3 — generate-level error (e.g. required equipment unsatisfiable) */}
              {generateError && (
                <div role="alert" style={{
                  background: "#fef2f2", border: "1px solid #fecaca",
                  color: "#991b1b", borderRadius: 10, padding: "12px 16px",
                  marginTop: -16, marginBottom: 24,
                  display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, lineHeight: 1.4,
                }}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>⚠️</span>
                  <span>{generateError}</span>
                </div>
              )}
            </div>

            {/* Workout display */}
            {workout && (
              <div>
                {/* Summary bar (screen) — green-bordered when recovery day */}
                <div className="screen-only" data-tour="step-celebrate" style={{
                  background: "var(--color-card)",
                  border: `${workout.recovery ? 2 : 1}px solid ${workout.recovery ? "var(--color-positive)" : "var(--color-border)"}`,
                  borderRadius: 12, padding: 20, marginBottom: 16,
                  display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center",
                }}>
                  <span style={{ background: meta.badge, color: meta.badgeText, borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>
                    {meta.emoji} {meta.label}
                  </span>
                  {workout.recovery && (
                    <span title="Generated as a recovery day — easy/aerobic main, intervals stretched +10%, no repeat sets"
                      style={{
                        background: "rgba(34,197,94,0.18)",
                        border: "1px solid #22c55e",
                        color: "#86efac",
                        borderRadius: 999, padding: "4px 12px",
                        fontSize: 12, fontWeight: 700,
                        display: "inline-flex", alignItems: "center", gap: 6,
                      }}>
                      🌿 Recovery day
                    </span>
                  )}
                  {workout.phase && PHASES[workout.phase] && (() => {
                    const p = PHASES[workout.phase];
                    return (
                      <span title={`Phase: ${p.label} — ${p.description}. Change in Account → Goals.`}
                        style={{
                          background: `${p.color}1f`,
                          border: `1px solid ${p.color}`,
                          color: p.color,
                          borderRadius: 999, padding: "4px 12px",
                          fontSize: 12, fontWeight: 700,
                          display: "inline-flex", alignItems: "center", gap: 6,
                        }}>
                        {p.emoji} {p.label}
                      </span>
                    );
                  })()}
                  {workout.assignment_target && (
                    <span title={`Generated for ${workout.assignment_target.group_name} — ${workout.assignment_target.member_count} swimmer${workout.assignment_target.member_count === 1 ? "" : "s"}`}
                      style={{
                        background: "#f59e0b1f",
                        border: "1px solid var(--color-warn)",
                        color: "var(--color-warn)",
                        borderRadius: 999, padding: "4px 12px",
                        fontSize: 12, fontWeight: 700,
                        display: "inline-flex", alignItems: "center", gap: 6,
                      }}>
                      → {workout.assignment_target.group_name} ({workout.assignment_target.member_count})
                    </span>
                  )}
                  {[
                    [(poolMode === "50m" || poolMode === "25m") ? "Total Distance" : "Total Yardage", `${workout.totalYards.toLocaleString()} ${unit}`],
                    ["Est. Duration",   `~${workout.estimatedMin} min`],
                    ["Target Range",   `${typeMin.toLocaleString()} – ${maxYards.toLocaleString()} ${unit}`],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <div style={{ fontSize: 10, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>
                        {val.split(" ")[0]}
                        <span style={{ fontSize: 12, fontWeight: 400, color: "var(--color-text-muted)" }}> {val.split(" ").slice(1).join(" ")}</span>
                      </div>
                    </div>
                  ))}
                  <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    <button
                      onClick={() => {
                        const focus = (focusNoteDraft || "").trim();
                        // Enrich workout with the surrounding App state so that
                        // "Log as today's session" can build a valid entry from
                        // a freshly-generated (not-yet-saved) workout.
                        setRunWorkout({
                          ...workout,
                          type: selectedType,
                          typeLabel: meta ? meta.label : selectedType,
                          poolMode,
                          equipment: { ...equipment },
                          maxYardsCap: maxYards,
                          ...(focus ? { focusNote: focus } : {}),
                        });
                        setShowRestPicker(true);
                      }}
                      style={{
                        padding: "10px 16px", borderRadius: 8,
                        border: "1px solid var(--color-primary)", background: "#1e3a5f", color: "var(--color-primary)",
                        fontSize: 13, fontWeight: 700, cursor: "pointer",
                        display: "inline-flex", alignItems: "center", gap: 6,
                      }}
                      title="Step through this workout section by section">
                      ▶ Run
                    </button>
                    <button
                      onClick={() => {
                        const text = workoutToText(workout, meta, paceInput, unit);
                        navigator.clipboard.writeText(text).then(() => {
                          setCopyFlash(true);
                          setTimeout(() => setCopyFlash(false), 2000);
                        });
                      }}
                      style={{
                        padding: "10px 16px", borderRadius: 8,
                        border: `1px solid ${copyFlash ? "var(--color-positive)" : "var(--color-border-strong)"}`,
                        background: copyFlash ? "#052e16" : "var(--color-bg)",
                        color: copyFlash ? "#86efac" : "var(--color-text)",
                        fontSize: 13, fontWeight: 700, cursor: "pointer",
                        display: "inline-flex", alignItems: "center", gap: 6,
                        transition: "all 0.2s",
                      }}
                      title="Copy workout as plain text for texting or pasting into Notes">
                      {copyFlash ? "✓ Copied!" : "📋 Copy Text"}
                    </button>
                    <button
                      onClick={() => {
                        if (loadedFromHistoryId) {
                          // Already saved — print directly
                          window.print();
                        } else {
                          // Unsaved fresh workout — ask first
                          setShowPrintDialog(true);
                        }
                      }}
                      style={{
                        padding: "10px 16px", borderRadius: 8,
                        border: "1px solid var(--color-border-strong)", background: "var(--color-bg)", color: "var(--color-text)",
                        fontSize: 13, fontWeight: 700, cursor: "pointer",
                        display: "inline-flex", alignItems: "center", gap: 6,
                      }}
                      title="Print a clean B&W 8.5×11 version of this workout">
                      🖨 Print Workout
                    </button>
                    {/* N6 — Multi-pace export. Coach-only, group-only. Visible only
                        when generating for a group with ≥2 members (lane plans can't
                        exist for groups <2 per decision #17). */}
                    {effectiveMe?.is_coach && generateForTarget && generateForTarget.member_count >= 2 && (
                      <button
                        onClick={() => setShowMultiPace(true)}
                        style={{
                          padding: "10px 16px", borderRadius: 8,
                          border: "1px solid var(--color-warn)", background: "rgba(245,158,11,0.15)", color: "var(--color-warn)",
                          fontSize: 13, fontWeight: 700, cursor: "pointer",
                          display: "inline-flex", alignItems: "center", gap: 6,
                        }}
                        title="Render this workout at multiple paces — one page per lane (or a side-by-side matrix). Coach + group only.">
                        🏊 Multi-pace print…
                      </button>
                    )}
                    {/* I — Schedule this workout for a future day. Available
                        whenever there's a workout on screen and the user is
                        authenticated. */}
                    {workout && authenticated && (
                      <button
                        onClick={() => {
                          // Default: tomorrow.
                          const t = new Date(); t.setDate(t.getDate() + 1);
                          const y = t.getFullYear(), m = String(t.getMonth() + 1).padStart(2, "0"), d = String(t.getDate()).padStart(2, "0");
                          setScheduleDate(`${y}-${m}-${d}`);
                        }}
                        style={{
                          padding: "10px 16px", borderRadius: 8,
                          border: "1px solid var(--color-primary)", background: "rgba(59,130,246,0.15)", color: "var(--color-primary)",
                          fontSize: 13, fontWeight: 700, cursor: "pointer",
                          display: "inline-flex", alignItems: "center", gap: 6,
                        }}
                        title="Schedule this workout for a future date (planning, not logging)">
                        📅 Schedule for…
                      </button>
                    )}
                  </div>
                </div>

                {/* Focus note — pre-workout intention (screen, edit-in-place) */}
                {loadedFromHistoryId ? (
                  focusNoteDraft && (
                    <div className="screen-only card" style={{
                      marginBottom: 12, padding: "8px 12px",
                      borderRadius: 8, fontSize: 13, color: "var(--color-primary)", fontStyle: "italic",
                    }}>
                      🎯 Focus: {focusNoteDraft}
                    </div>
                  )
                ) : (
                  <div className="screen-only" style={{ marginBottom: 12 }}>
                    <input type="text" value={focusNoteDraft}
                      onChange={e => setFocusNoteDraft(e.target.value.slice(0, 255))}
                      placeholder="🎯 Focus for this workout (optional) — e.g. hip rotation, strong turns…"
                      style={{
                        width: "100%", padding: "8px 12px",
                        background: "var(--color-bg)", color: "var(--color-text)",
                        border: `1px solid ${focusNoteDraft ? "var(--color-primary)" : "var(--color-border)"}`,
                        borderRadius: 8, fontSize: 13, fontFamily: "inherit",
                        transition: "border-color 0.15s",
                      }} />
                  </div>
                )}

                {/* Print-only header */}
                <div className="print-only print-header">
                  <h1 className="print-title">{meta.label} Swim Workout</h1>
                  <p className="print-subtitle">{meta.description}</p>
                  {focusNoteDraft && (
                    <p style={{ fontSize: 14, fontStyle: "italic", color: "#000", marginTop: 6 }}>
                      🎯 Focus: {focusNoteDraft}
                    </p>
                  )}
                  <div className="print-meta">
                    <span><b>Date:</b> {new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
                    <span><b>Total:</b> {workout.totalYards.toLocaleString()} {unit}</span>
                    <span><b>Duration:</b> ~{workout.estimatedMin} min</span>
                    <span><b>Pace target:</b> ~{paceInput} / 100 {unit}</span>
                  </div>
                </div>

                {/* Section breakdown bar (screen only) */}
                <div className="screen-only" style={{ display: "flex", gap: 3, height: 10, borderRadius: 999, overflow: "hidden", marginBottom: 8 }}>
                  {workout.blocks.map((b, i) => (
                    <div key={i}
                      style={{ width: `${(b.totalYards / workout.totalYards * 100).toFixed(1)}%`, background: sectionColors[i] }}
                      title={`${b.name}: ${b.totalYards} ${unit}`}
                    />
                  ))}
                </div>
                <div className="screen-only" style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
                  {workout.blocks.map((b, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--color-text-muted)" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: sectionColors[i], display: "inline-block" }} />
                      <span style={{ color: sectionColors[i] }}>{b.name}</span>
                      <span>({b.totalYards} {unit})</span>
                    </div>
                  ))}
                </div>

                {/* v2.0 polish — Lane-fit fallback banner. Shows when the
                    multi-lane picker couldn't find lane-friendly options for
                    one or more sections and fell back to the unfiltered pool.
                    Tells the coach the workout may not fit every lane's pace
                    as cleanly as they'd expect. */}
                {Array.isArray(workout.__laneFitFallback) && workout.__laneFitFallback.length > 0 && (
                  <div className="screen-only" style={{
                    marginBottom: 16, padding: "10px 14px",
                    background: "rgba(234, 179, 8, 0.10)",
                    border: "1px solid rgba(234, 179, 8, 0.45)",
                    borderRadius: 8,
                    display: "flex", alignItems: "flex-start", gap: 10,
                  }}>
                    <span style={{ fontSize: 16, lineHeight: 1 }}>⚠️</span>
                    <div style={{ fontSize: 12, color: "var(--color-text)", lineHeight: 1.5 }}>
                      <strong>Lane range is wide</strong> — the picker couldn't find options that fit every lane's pace for: <em>{workout.__laneFitFallback.join(", ")}</em>. Those sections used the unfiltered pool, so intervals may be tight for your slowest lane or loose for your fastest. Tighten the lane range or relax intervals to remove this warning.
                    </div>
                  </div>
                )}

                {/* Pace control (screen only) */}
                <div className="screen-only" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 16px", background: "var(--color-card)", borderRadius: 10, border: "1px solid var(--color-border)", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>100 {unit} pace</span>
                  <input
                    type="text"
                    value={paceInput}
                    onChange={e => handlePaceChange(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleApplyPace()}
                    placeholder="M:SS"
                    style={{ width: 58, fontFamily: "monospace", fontSize: 13, padding: "4px 7px", borderRadius: 6, border: "1px solid var(--color-border-strong)", background: "var(--color-bg)", color: "var(--color-text)" }}
                  />
                  <button onClick={handleApplyPace}
                    style={{ fontSize: 12, fontWeight: 600, padding: "4px 13px", borderRadius: 6, border: "1px solid var(--color-primary)", background: "#1d4ed8", color: "#fff", cursor: "pointer" }}>
                    Rescale all
                  </button>
                  <span style={{ fontSize: 11, color: "var(--color-border-strong)" }}>· Click any interval or description to edit directly</span>
                </div>

                {/* Workout blocks */}
                {workout.blocks.map((block, i) => block && block.kind === "dryland" ? (
                  <DrylandBlock
                    key={i}
                    block={block}
                    onRemove={() => setWorkout(w => w ? { ...w, blocks: w.blocks.filter((_, j) => j !== i) } : w)}
                    onChange={(nb) => setWorkout(w => w ? { ...w, blocks: w.blocks.map((b, j) => j === i ? nb : b) } : w)}
                  />
                ) : (
                  <WorkoutBlock
                    key={i}
                    block={block}
                    equipment={equipment}
                    onRegenerate={handleRegenerateSection}
                    regenError={regenError && regenError.section === block.section ? regenError.message : null}
                    blockIdx={i}
                    openSwapKey={openSwapKey}
                    onToggleSwap={handleToggleSwap}
                    onApplySwap={handleApplySwap}
                    editIntervalKey={editIntervalKey}
                    editIntervalDraft={editIntervalDraft}
                    setEditIntervalDraft={(v) => { setEditIntervalDraft(v); setEditIntervalError(null); }}
                    editIntervalError={editIntervalError}
                    onStartEditInterval={handleStartEditInterval}
                    onCommitInterval={handleCommitInterval}
                    onClearInterval={handleClearInterval}
                    onCancelInterval={handleCancelInterval}
                    editDescKey={editDescKey}
                    editDescDraft={editDescDraft}
                    setEditDescDraft={setEditDescDraft}
                    onStartEditDesc={handleStartEditDesc}
                    onCommitDesc={handleCommitDesc}
                    onCancelDesc={handleCancelDesc}
                    isFavorited={!!(block.label && favorites.includes(block.label))}
                    onToggleFavorite={handleToggleFavorite}
                    isDisfavorited={!!(block.label && disfavorites.includes(block.label))}
                    onToggleDisfavorite={handleToggleDisfavorite}
                    isEngineDisfavorited={!!(block.__engineMeta && engineDisfavorites.some(e => e.template_id === block.__engineMeta.template_id && e.stroke === block.__engineMeta.stroke))}
                    onToggleEngineDisfavor={handleToggleEngineDisfavor}
                    isEngineFavorited={!!(block.__engineMeta && engineFavorites.some(e => e.template_id === block.__engineMeta.template_id && e.stroke === block.__engineMeta.stroke))}
                    onToggleEngineFavorite={handleToggleEngineFavorite}
                    favoriteSets={favoriteSets}
                    disfavorSets={disfavorSets}
                    onCycleSetStatus={handleCycleSetStatus}
                    onRoundRestChange={handleRoundRestChange}
                    unit={unit}
                    isPinned={!!pinnedSections[block.section]}
                    onTogglePin={handleTogglePin}
                    recentMainLabels={recentMainLabels}
                    poolMode={poolMode}
                    isCoach={!!effectiveMe?.is_coach}
                    onSnapshot={authenticated ? handleSnapshotBlock : null}
                    ugcSetIdMeta={ugcSetIdMeta}
                    sectionSource={sectionSources[block.section] || "bank"}
                    onSectionSourceChange={(newSource) => {
                      setSectionSources(prev => {
                        const next = { ...prev, [block.section]: newSource };
                        // S3 — persist to settings.extra (fire-and-forget, errors
                        // surface in console but don't block UI). Header CSRF + auth
                        // wrappers piggy-back on the existing /api/settings/extra
                        // route added by S2.5.
                        if (typeof fetch === "function" && csrf.token) {
                          fetch(`${API_BASE}/settings/extra`, {
                            method: "POST",
                            credentials: "include",
                            headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf.token },
                            body: JSON.stringify({ engine_section_sources: next }),
                          }).catch(() => {});
                        }
                        return next;
                      });
                      // Trigger a regen of this section under the new source — only
                      // if it's not pinned (pinned sections stay fixed).
                      if (!pinnedSections[block.section]) {
                        // v1.3 fix — pass newSource explicitly. The setTimeout
                        // closure captures the OLD handleRegenerateSection which
                        // reads the OLD sectionSources. The sourceOverride arg
                        // bypasses that staleness so the regen uses the source
                        // the user JUST clicked.
                        setTimeout(() => handleRegenerateSection(block.section, newSource), 0);
                      }
                    }}
                  />
                ))}

                {/* Section model B2 — add a dryland block (before / after pool). */}
                <div className="screen-only" style={{ marginTop: 12, marginBottom: 4 }}>
                  {!drylandPickerOpen ? (
                    <button onClick={() => setDrylandPickerOpen(true)}
                      style={{ padding: "6px 12px", border: "1px dashed #a3702c", borderRadius: 8, background: "transparent", color: "#a3702c", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      🏋 + Add dryland
                    </button>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "10px 12px", border: "1px solid #a3702c", borderRadius: 8, background: "#fbf6ee" }}>
                      <select value={drylandPresetId} onChange={e => setDrylandPresetId(e.target.value)}
                        style={{ padding: "5px 8px", fontSize: 13, borderRadius: 5, border: "1px solid #d8c19a", background: "#fff", color: "#5b4326" }}>
                        {DRYLAND_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                      <select value={drylandPlacement} onChange={e => setDrylandPlacement(e.target.value)}
                        style={{ padding: "5px 8px", fontSize: 13, borderRadius: 5, border: "1px solid #d8c19a", background: "#fff", color: "#5b4326" }}>
                        <option value="pre">Before pool</option>
                        <option value="post">After pool</option>
                      </select>
                      <button onClick={() => {
                        const opt = DRYLAND_OPTIONS.find(o => o.id === drylandPresetId) || DRYLAND_OPTIONS[0];
                        const blk = makeDrylandBlock(opt, drylandPlacement);
                        setWorkout(w => w ? { ...w, blocks: drylandPlacement === "pre" ? [blk, ...w.blocks] : [...w.blocks, blk] } : w);
                        setDrylandPickerOpen(false);
                      }}
                        style={{ padding: "6px 14px", border: "none", borderRadius: 6, background: "#a3702c", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Add</button>
                      <button onClick={() => setDrylandPickerOpen(false)}
                        style={{ padding: "6px 12px", border: "1px solid #d8c19a", borderRadius: 6, background: "transparent", color: "#9a7b4f", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                    </div>
                  )}
                </div>

                {/* Coach note (screen only — user opted not to include in print) */}
                <div className="screen-only" style={{ marginTop: 20, background: "rgba(30,41,59,0.6)", borderRadius: 12, padding: 16, border: "1px solid var(--color-border)", color: "var(--color-text-muted)", fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: "#cbd5e1" }}>📋 Coach's Note: </span>
                  {poolMode === "50m"
                    ? "Intervals are scaled from your pace setting. Adjust ±10–15 sec to match your base in long-course."
                    : poolMode === "25m"
                    ? "Intervals are scaled from your pace setting. Adjust ±10–15 sec to match your base in short-course meters."
                    : "Intervals are calibrated for a masters pace of 2:00–2:15/100 yds. Adjust ±10–15 sec to match your base."
                  }
                  Always prioritize stroke mechanics over hitting a split — especially on drill and technique sets.
                </div>

                {/* Save-to-history form (only for freshly generated workouts) */}
                {!loadedFromHistoryId && (
                  <SaveToHistoryForm
                    dateDraft={dateDraft} setDateDraft={setDateDraft}
                    initialsDraft={initialsDraft} setInitialsDraft={handleInitialsChange}
                    noteDraft={noteDraft} setNoteDraft={setNoteDraft}
                    difficultyDraft={difficultyDraft} setDifficultyDraft={setDifficultyDraft}
                    saveStatus={saveStatus} saveError={saveError}
                    onSave={handleSave}
                  />
                )}

                {/* Banner for workouts loaded from history */}
                {loadedFromHistoryId && (
                  <div className="screen-only" style={{ marginTop: 20, background: "var(--color-card)", border: "1px dashed var(--color-border-strong)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "var(--color-text-muted)" }}>
                    📜 Loaded from history. To save a new workout, click <b>Generate New Workout</b> above.
                  </div>
                )}
              </div>
            )}

            {/* Empty state */}
            {!workout && (
              <div className="screen-only" style={{ textAlign: "center", padding: "60px 0", color: "var(--color-border-strong)" }}>
                <div style={{ fontSize: 56, marginBottom: 12 }}>🌊</div>
                <p style={{ fontSize: 18, fontWeight: 500, color: "var(--color-text-muted)", margin: 0 }}>Pick a type, set your max yardage, and generate</p>
                <p style={{ fontSize: 13, marginTop: 4, color: "var(--color-border-strong)" }}>Each press produces a fresh workout within your range</p>
              </div>
            )}

            </>}
          </main>
          {showPrintDialog && (
            <div className="screen-only" style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
              display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
            }}
              onClick={() => setShowPrintDialog(false)}>
              <div className="card" style={{
                borderRadius: 12,
                padding: "28px 32px", maxWidth: 400, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
              }}
                onClick={e => e.stopPropagation()}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>🖨 Print Workout</div>
                <p style={{ color: "#cbd5e1", fontSize: 14, margin: "0 0 24px 0", lineHeight: 1.5 }}>
                  Would you like to save this workout to your history before printing?
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    onClick={async () => {
                      setShowPrintDialog(false);
                      await handleSave();
                      setTimeout(() => window.print(), 150);
                    }}
                    style={{
                      flex: 1, padding: "10px 16px", borderRadius: 8,
                      border: "none", background: "#2563eb", color: "#fff",
                      fontSize: 13, fontWeight: 700, cursor: "pointer",
                    }}>
                    Save &amp; Print
                  </button>
                  <button
                    onClick={() => { setShowPrintDialog(false); setTimeout(() => window.print(), 150); }}
                    style={{
                      flex: 1, padding: "10px 16px", borderRadius: 8,
                      border: "1px solid var(--color-border-strong)", background: "transparent", color: "#cbd5e1",
                      fontSize: 13, fontWeight: 600, cursor: "pointer",
                    }}>
                    Print Without Saving
                  </button>
                  <button
                    onClick={() => setShowPrintDialog(false)}
                    style={{
                      width: "100%", padding: "8px 16px", borderRadius: 8,
                      border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-dim)",
                      fontSize: 13, cursor: "pointer", marginTop: 2,
                    }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
          {showRestPicker && runWorkout && (
            <RestPickerModal
              restSecs={restSecs}
              onChange={setRestSecs}
              onStart={() => setShowRestPicker(false)}
              onCancel={() => { setRunWorkout(null); setShowRestPicker(false); setRunAssignmentId(null); }}
              audioCues={audioCues}
              onAudioCuesChange={handleAudioCuesToggle}
              lapButton={lapButton}
              onLapButtonChange={handleLapButtonToggle}
            />
          )}
          {!showRestPicker && runWorkout && (
            <RunWorkoutOverlay
              workout={runWorkout}
              restSecs={restSecs}
              onClose={() => { setRunWorkout(null); setRunAssignmentId(null); }}
              onLogAsToday={handleLogAsToday}
              personalFirstName={personalFirstName}
              audioCues={audioCues}
              lapButton={lapButton}
              unit={unit}
            />
          )}
          {showProfile && (
            <ProfileModal
              onClose={() => {
                setShowProfile(false);
                // Burst mitigation — was 3 parallel GETs (me, goals,
                // settings). Replaced with a single bootstrap re-fetch which
                // refreshes me + goals + settings + everything else in one
                // round-trip.
                refreshBootstrap();
              }}
              onProfileChange={() => {
                // Burst mitigation — was 8 parallel GETs (me, settings,
                // disfavorites, disfavor-sets, effective-disfavorites,
                // favorites, favorite-sets, effective-favorites). Replaced
                // with a single bootstrap re-fetch which covers all of them.
                refreshBootstrap();
              }}
              onPaceUpdate={(newPace) => {
                // J — LevelRow pushes a preset pace up to App when a level
                // is picked. Use handlePaceChange so the debounced save
                // path persists it to settings alongside the local update.
                handlePaceChange(newPace);
              }}
              authMode={authMode}
              onSendFeedback={() => setShowFeedback(true)}
              onStartTour={startTour}
              appEffectiveMe={effectiveMe}
              appViewAsRole={viewAsRole}
              appSetViewAsRole={setViewAsRole}
              appViewAsParent={viewAsParent}
              appSetViewAsParent={setViewAsParent}
              /* Burst-mitigation — pass App-level state already populated by
                 bootstrap so ProfileModal can seed its local state without
                 re-fetching. Each prop replaces one GET in the open burst. */
              appMe={me}
              appGoals={goals}
              appFavorites={favorites}
              appDisfavorites={disfavorites}
              appFavoriteSets={favoriteSets}
              appDisfavorSets={disfavorSets}
              appMyConstraints={myConstraints}
              /* B (bootstrap extension) — sessions + team-defaults +
                 billing-status + level + settings-derived bits passed in so
                 ProfileModal can drop the /api/settings + /api/auth/sessions
                 + /api/me/team-defaults fetches on open. */
              appSessions={sessions}
              appTeamDefaults={teamDefaults}
              appBillingStatus={billingStatus}
              appLevel={level}
              appNextEvent={nextEvent}
              appPhase={phase}
              appDisfavorMode={disfavorMode}
              appEngineDisfavorites={engineDisfavorites}
              appEngineFavorites={engineFavorites} />
          )}
          {showFeedback && (
            <FeedbackModal onClose={() => setShowFeedback(false)} />
          )}
          {tourStep >= 0 && (
            <TourOverlay
              steps={TOUR_STEPS}
              stepIndex={tourStep}
              onNext={() => setTourStep(s => Math.min(TOUR_STEPS.length - 1, s + 1))}
              onBack={() => setTourStep(s => Math.max(0, s - 1))}
              onSkip={finishTour}
              onFinish={finishTour}
            />
          )}
          {showImpersonationModal && (
            <ImpersonationStartModal
              me={me}
              onClose={() => setShowImpersonationModal(false)}
              onStartImpersonation={handleStartImpersonation}
            />
          )}
          {showIntentParser && (
            <IntentParserModal
              onClose={() => setShowIntentParser(false)}
              onApply={handleApplyIntent}
            />
          )}
          {/* UGC Phase C — snapshot-from-WorkoutBlock opens the same
              UgcFormModal used by My Sets, pre-filled with block data.
              No id on the pre-fill → modal treats as create. */}
          {snapshotOption && (
            <UgcFormModal
              option={snapshotOption}
              onSave={() => { setSnapshotOption(null); refreshUgcOverlay(); }}
              onClose={() => setSnapshotOption(null)}
            />
          )}
          {/* N6 — Multi-pace export. Modal first; on Preview, modal closes
              and the print overlay mounts (multiPaceLanes !== null). */}
          {showMultiPace && workout && generateForTarget && (
            <MultiPaceModal
              workout={workout}
              generateForTarget={generateForTarget}
              lanePlansForTarget={lanePlansForTarget}
              onClose={() => setShowMultiPace(false)}
              onPreview={(payload) => { setShowMultiPace(false); setMultiPaceLanes(payload); }}
            />
          )}
          {multiPaceLanes && workout && (
            <MultiPacePrintView
              workout={workout}
              lanes={multiPaceLanes.lanes}
              mode={multiPaceLanes.mode}
              groupActiveConstraints={groupActiveConstraints}
              onClose={() => setMultiPaceLanes(null)}
            />
          )}
          {/* I — schedule-for-day picker. Opens when scheduleDate state is
              non-null (set by the 📅 Schedule for… button). Picks a date,
              POSTs to /api/scheduled-workouts with the current workout. */}
          {scheduleDate !== null && workout && (
            <div onClick={() => setScheduleDate(null)} className="modal-overlay" style={{ padding: 20 }}>
              <div onClick={(e) => e.stopPropagation()} style={{
                background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 12,
                padding: 22, maxWidth: 420, width: "100%",
              }}>
                <div style={{ color: "var(--color-primary)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>Schedule workout</div>
                <div style={{ color: "var(--color-text)", fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Pick a date</div>
                <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 6, fontSize: 14 }} />
                <div style={{ color: "var(--color-text-muted)", fontSize: 11, marginTop: 6 }}>
                  Saves the current workout to your week-view planner. Run it later from the 📅 Week tab — your completion logs back to history and links to the schedule row.
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 14 }}>
                  <button onClick={() => setScheduleDate(null)}
                    className="btn btn-lg btn-outlined btn-neutral">Cancel</button>
                  <button onClick={async () => {
                      if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduleDate)) { setSaveError("Pick a valid date"); return; }
                      try {
                        // Enrich payload with form context so ✎ Edit on the
                        // scheduled row can fully restore the generator
                        // (otherwise the raw workout object doesn't carry
                        // maxYards/poolMode/equipment).
                        const enrichedPayload = {
                          ...workout,
                          maxYardsCap: workout.maxYardsCap || maxYards,
                          poolMode:    workout.poolMode    || poolMode,
                          equipment:   workout.equipment   || { ...equipment },
                          focusNote:   workout.focusNote   || focusNoteDraft || undefined,
                        };
                        const res = await fetch("/api/scheduled-workouts", {
                          method:  "POST",
                          headers: { "Content-Type": "application/json", ...csrfHeaders() },
                          body:    JSON.stringify({ scheduled_date: scheduleDate, payload: enrichedPayload }),
                        });
                        const j = await res.json();
                        if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
                        setScheduleDate(null);
                        setSaveStatus("scheduled");
                        setTimeout(() => setSaveStatus(null), 2500);
                      } catch (e) {
                        setSaveError(`Schedule failed: ${e.message}`);
                        setScheduleDate(null);
                      }
                    }}
                    className="btn btn-lg btn-filled btn-primary">Schedule ▸</button>
                </div>
              </div>
            </div>
          )}
          {/* I Phase 2a — save-as-intent date picker. Captures the current
              generator form state as an intent_params row; generation runs
              on the scheduled day via WeekView's ▶ Generate button. */}
          {intentDate !== null && (
            <div onClick={() => setIntentDate(null)} className="modal-overlay" style={{ padding: 20 }}>
              <div onClick={(e) => e.stopPropagation()} style={{
                background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 12,
                padding: 22, maxWidth: 460, width: "100%",
              }}>
                <div style={{ color: "var(--color-warn)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>Save as intent</div>
                <div style={{ color: "var(--color-text)", fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Plan these settings for…</div>
                <input type="date" value={intentDate} onChange={(e) => setIntentDate(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 6, fontSize: 14 }} />
                <div style={{ color: "var(--color-text-muted)", fontSize: 11, marginTop: 8, lineHeight: 1.5 }}>
                  Saves these settings (type, yardage, mix, recovery) as an <strong>intent</strong> for the chosen day. On the day, generate the actual workout from the latest bank state via 📅 Week.
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 14 }}>
                  <button onClick={() => setIntentDate(null)} disabled={intentSaveBusy}
                    className="btn btn-lg btn-outlined btn-neutral">Cancel</button>
                  <button onClick={async () => {
                      if (!/^\d{4}-\d{2}-\d{2}$/.test(intentDate)) { setSaveError("Pick a valid date"); return; }
                      setIntentSaveBusy(true);
                      try {
                        const intent_params = {
                          type:     selectedType,
                          maxYards: Number(maxYards),
                          mix:      sectionBias,
                          recovery: !!recoveryMode,
                        };
                        const res = await fetch("/api/scheduled-workouts", {
                          method:  "POST",
                          headers: { "Content-Type": "application/json", ...csrfHeaders() },
                          body:    JSON.stringify({ scheduled_date: intentDate, intent_params }),
                        });
                        const j = await res.json();
                        if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
                        setIntentDate(null);
                        setSaveStatus("intent_saved");
                        setTimeout(() => setSaveStatus(null), 2500);
                      } catch (e) {
                        setSaveError(`Save intent failed: ${e.message}`);
                        setIntentDate(null);
                      } finally { setIntentSaveBusy(false); }
                    }}
                    disabled={intentSaveBusy}
                    className="btn btn-lg btn-filled btn-warn">{intentSaveBusy ? "…" : "Save intent ▸"}</button>
                </div>
              </div>
            </div>
          )}
          {/* DOB soft-prompt (decision #37). Surfaces once per session when
              authenticated and me.dob is null. The check is gated by
              dobPromptDismissed (sessionStorage) so dismissal sticks for
              the rest of the browser tab life. */}
          {authenticated && me && me.dob === null && !dobPromptDismissed && (
            <DobPromptModal
              onSaved={(newDob) => {
                // Compute age correctly: year diff minus 1 if birthday hasn't passed this year.
                // (Server is authoritative via /api/me; this just keeps the local `me` consistent
                // until the next refresh.) Year-only subtraction misclassified anyone whose
                // birthday hadn't occurred yet — e.g. Nov-2008 evaluated in May 2026.
                setMe(prev => {
                  if (!prev) return prev;
                  const today = new Date();
                  const dob   = new Date(newDob);
                  let age = today.getFullYear() - dob.getFullYear();
                  const monthDiff = today.getMonth() - dob.getMonth();
                  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
                  return { ...prev, dob: newDob, is_minor: age < 18 };
                });
                setDobPromptDismissed(true);
              }}
              onDismiss={() => {
                try { sessionStorage.setItem(DOB_PROMPT_DISMISS_KEY, "1"); } catch (_) {}
                setDobPromptDismissed(true);
              }}
            />
          )}
          {/* Footer — quiet copyright stamp at the bottom of every view. */}
          <footer className="screen-only" style={{
            textAlign: "center", padding: "20px 16px 32px",
            color: "var(--color-border-strong)", fontSize: 11, fontFamily: "system-ui, -apple-system, sans-serif",
            borderTop: "1px solid var(--color-card)", marginTop: 40,
          }}>
            © 2026 Competition Aquatics, LLC · All rights reserved.
          </footer>
        </div>
      );
    }
