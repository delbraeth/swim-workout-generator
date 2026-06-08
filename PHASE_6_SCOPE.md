# Phase 6 Scope — Team Option Visibility (progressive simplification)

**Status:** SPEC ONLY (2026-06-03). Demand-gated like Phase 5. Phase 6 currently holds
**one item** (below); more can be added.

---

## Team Option Visibility — "Show these options" (owner-controlled, per team)

**The ask (verbatim intent):** wherever it makes sense, add a "show these options" screen
so a team owner can **simplify the system for small teams or private coaches** by turning
off surfaces their team doesn't use. Set **per team, by the team owner.**

### Why
SetForge has grown a deep feature set — multi-lane generate, Bank/Engine/Mix per-section
source toggles, kick + dryland sections, per-swimmer constraints, three-tier curation,
Reports, Catalog, UGC authoring, lane plans, anchors. For a **club** that's power; for a
**private lesson coach or a 6-swimmer summer team** it's clutter that hides the one button
they actually use (Generate). A single global "simple mode" is too blunt (different teams
want different subsets). The right control is a **per-team visibility config the owner
sets** — progressive disclosure, opt-in complexity.

### What it is
A team-scoped **feature-visibility map**, edited by the owner in **Team → Settings** (new
"Visible options" / "Simplify" panel — reuses the existing `TeamSettingsTab` + team-defaults
+ team-curation pattern: team-scoped, owner-write, coach read-only). Each entry hides or
shows a surface for that team's coaches and/or swimmers. Default = everything on (no
behavior change for existing teams); the owner opts *down* to simpler.

### Candidate toggles ("wherever it makes sense" — to be finalized in the scope session)
Generation: Bank/Engine/Mix source toggle · multi-lane generate · kick section · dryland ·
advanced equipment · recovery mode · training-phase picker · 🏁 race-pace · 🧒 Learn-to-Swim.
Coach surfaces: per-swimmer constraints · team curation tier · Catalog browser · UGC / My
Sets · Reports · lane plans · meet anchors · 🛡 compliance credentials.
Planning: intents / week view · "Generate for" target picker.
(Grouped, with a few **presets** — e.g. "Simple / Standard / Full" — so an owner sets it in
one click instead of 15.)

> **✅ AUDIT DONE 2026-06-06 → see `docs/PHASE_6_TOGGLE_AUDIT.md`.** That doc is the
> canonical inventory (full web + iOS code sweep) and **supersedes the hand-written list
> above**, which was stale. It groups ~60 surfaces into **21 toggle bundles + 3 presets**
> (Simple / Standard / Full), confirms **📅 Events/RSVP/venues/weather/calendar** as a
> toggle cluster (the flagged one), and corrects two errors here: "training-phase picker"
> is a personal Profile setting (not a generate toggle) and "Generate-for" is CORE (never
> gate). Use the audit's open-decisions list to drive the scope session.

### Reuses (deps already satisfied)
- **Team settings infra** — `TeamSettingsTab` (public/index.html) + team-scoped owner-write
  routes + the team-curation/defaults precedence pattern. ✓
- **Owner authz** — `dbGetTeamRole`/`dbAssertTeamWriter`. ✓
- **The visibility map itself is new** — likely a `teams.feature_flags` JSON column (or a
  small `team_feature_flags` table), surfaced in `me/bootstrap` so the client gates at render.
The bulk of the work is **UI gating across many surfaces** — same "touches ~N places"
shape as the pluggable-section work; cheaper if the SPA build/component split (CLEAN_SLATE
§2.2) lands first.

### Open questions (decide in a dedicated scope session before building)
1. **Granularity** — per-feature toggles vs a few presets vs both? (Lean: presets + an
   "advanced" expander of individual toggles.)
2. **Who it affects** — coaches only, swimmers only, or both? A toggle likely hides the
   surface for *swimmers* always and for *coaches* optionally (a coach may still need the
   tool even on a "simple" team).
3. **Multi-team coaches/swimmers** — if a person is in a "simple" team and a "full" team,
   is visibility a union (show if any team shows it) or per-team-context? (Lean: union for
   personal surfaces; per-team-context for team-scoped surfaces.)
4. **Hide vs server-enforce** — UI-hide only (simplest; the API still works), or also
   reject hidden features server-side? (Lean: UI-hide only v1 — it's a simplification
   affordance, not a permission boundary.)
5. **Interaction with tiers** — should Lesson tier (Phase 5 #1) ship with a simplified
   default visibility map? (Likely yes — they're the same audience.)
6. **iOS parity** — the app reads the same `bootstrap` flags and gates its surfaces too.

### Cost
M–L (one config store + bootstrap plumbing, then visibility gating across many web + iOS
surfaces). Cheaper after the SPA component split; pairs naturally with the pluggable-section
scope and with Lesson tier.

### Trigger
A private coach or small-team owner reports the app is "too much," OR Lesson tier ships
(same audience). Demand-gated — no build clock.

---

## How to use this doc
When the trigger fires, promote to a dedicated `TEAM_OPTION_VISIBILITY_SCOPE.md` with the
six open questions resolved (especially the toggle list + presets + the hide-vs-enforce
call), then build.
