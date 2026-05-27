# SetForge — Clean-Slate Analysis & Gap Audit

**Date drafted:** 2026-05-27
**Premise:** Take everything SetForge does today as the *target spec* and ask: if we were starting from scratch with full hindsight, what UX and structural decisions would we make? Then compare against current-state and surface the gap.

**What this is:** Honest retrospective. The current code is the result of months of incremental decisions made under partial information. Many of them turned out to be right and would survive a rewrite; some compounded into structural debt that's now expensive to undo. This doc separates the two and quantifies the gap.

**What this is not:** A rewrite proposal. SetForge is in production with paying-pilot trajectory; a full rewrite is not on the table. The point is to (1) make the surviving good calls explicit so they don't drift in future refactors, and (2) prioritize the rare structural debts that are worth the migration cost.

---

## §0 — Current state, in one paragraph

Single Node/Express server + MariaDB. Single-file React SPA (`public/index.html`, ~26K lines, Babel transpiled in-browser). 42 sequential migrations. OAuth-only auth (Apple + Google). 9 workout types × 4 hardcoded sections (warmup / drill / main / cooldown) × 3 sources per section (Bank / Engine / Mix). Bank is ~1,311 multi-tag canonical options in JS + per-user UGC overlay layered via DB rows that can graduate to canonical. Coach/team/group/swimmer hierarchy with managed-swimmer profiles and full-account swimmers as a polymorphic dual model. Per-swimmer constraints, meet-anchored taper, team-level curation, parent portal MVP. Six reports across three audiences. Three view-as modes (preview / persona / impersonation) layered orthogonally with a parent-flag toggle. Email infra via Resend with minor-bypass guards. Audit events log everything. Vendor paper kit + billing scaffold present but dormant.

---

## §1 — Decisions we'd keep verbatim

The path-dependent wins. These are the calls that, on reflection, are right and would survive a rewrite. Putting them at the top so future refactors don't accidentally walk them back.

### 1.1 OAuth-only, no email/password forever
No password storage, no password resets, no magic-link tokens by default. Sign in with Apple + Sign in with Google. The Parent Portal MVP exercise reinforced this — even the parent-invite flow uses OAuth to complete the link rather than carrying a token. **Keep.** This decision pays for itself in support burden avoidance every week.

### 1.2 Single Node process, no microservices
A solo-operator product with a few hundred users does not need a service mesh. The 30s setInterval email worker doubles as a cron host (orphan-anchor sweep, PSC expiry, parent-digest cron all piggyback). MariaDB pool with `bigIntAsNumber: true` is the entire data layer. **Keep.** Don't reach for Redis/BullMQ/separate-worker-process until there's evidence of actual contention.

### 1.3 Migration-based schema evolution, no FKs into legacy tables
Migrations 001–042 are append-only and idempotent. New tables since 026 use VARCHAR ids (matching `ms_xxxxxx` / `gr_xxxxxx` etc patterns) with INDEX + app-layer integrity instead of FOREIGN KEY constraints into the older INT-keyed tables. This is ugly but correct — `errno 150` failures are well-documented in memory ([[feedback-no-fk-into-legacy-tables]]) and the LEFT-JOIN + cron-sweep pattern handles orphan cleanup cheaply. **Keep.** The audit-events table is the integrity backstop.

### 1.4 Audit events with structured details JSON
Every mutation (curation toggle, impersonation start/end, parent invite, etc.) writes an `audit_events` row with explicit `eventType` and structured `details` JSON. This is what made R3 Curation Log + R6 Curation Support reports possible without separate event tables, and what makes incident investigation tractable. **Keep.** Aggressively expand coverage when adding new write paths.

### 1.5 UGC architecture: JS canonical, DB UGC-only, graduate via snippet
After one wrong-architecture pass that got reverted, the correct model emerged: canonical bank lives in JS code (single source of truth), DB tables hold only user-generated rows with `author_sub IS NOT NULL`, and an admin tool emits a paste-ready snippet to graduate proven public UGC into canonical via a real commit. **Keep.** The snippet+two-step-confirm approach correctly accounts for Hyperlift's "deploy = pull main" model and avoids the in-process-write-then-revert trap.

### 1.6 Free-tier permanence written into Terms
Coaches pay, swimmers free, with the free tier locked into ToS rather than the marketing site. This was a strategic call that the three eval personas all flagged as a trust differentiator. **Keep.** Don't relitigate when revenue pressure shows up.

### 1.7 Per-tier rate limiting via compound keys + admin skip
Today's writeLimiter uses `userSub|ip` compound key + 500/min ceiling + `ADMIN_SUBS` env-var skip. Simple, observable, defeatable only by an admin who explicitly opts out. **Keep.** Tier-aware scaling lives in the backlog and is the right next move when pricing ships.

### 1.8 Identity refactor approach: persons table + non-breaking migration
Phase 4 I-A through I-H is doing the painful normalization properly: new `persons` table behind a backfill, old `users.display_name`/`initials` kept as fallback during a soak period, reader switch via 7 surgical slices, writer migration deferred. **Keep this approach** for any future schema normalization. The fallback period saved at least one preventable outage.

### 1.9 View-as as a tiered tool, not a switch
v1 (preview, role flag override) → v2 (persona simulation with data wipe + write block) → v3 (server-side impersonation with audit + 30-min cap) — three distinct tools with different trust models for different jobs. Adding the +parent flag today as an orthogonal axis was the right shape because the tiering pattern was already in place. **Keep the tiering.** Don't collapse the three into one mode.

### 1.10 Brand voice: solo-operator, honest, no marketing-speak
The vendor kit, the manual, the sub-processor list, the welcome email — they all sound like one person wrote them and answers replies. That's not just charm; it's the product's actual moat in a market full of investor-funded competitors. **Keep.** Resist any urge to "professionalize" the copy.

---

## §2 — Architecture: server, client, deploy

### 2.1 Server — `server.js` + `db.js`

**Clean-slate decision:** Split `server.js` (~28K lines) into route modules by domain — `routes/auth.js`, `routes/workouts.js`, `routes/teams.js`, `routes/parent.js`, `routes/admin.js`, etc. — with a thin `server.js` that's just `app.use()` mounts and middleware setup. Same for `db.js` (~7K lines) → `db/auth.js`, `db/workouts.js`, `db/curation.js`, `db/parent.js`, with `db/pool.js` for the shared connection. Single-file-per-domain, not single-file-per-helper, so cohesion stays high.

**Current state:** Both files are giant single modules. `server.js` has 100+ routes registered in a flat sequence. `db.js` has ~150 exported helpers. Finding things requires grep; adding things requires picking a line that's not too close to a related thing. The duplicate-import bug we just hit on `dbAuthzCoachOfSwimmer` (imported twice during the Parent Portal build because the import list spans many lines and visual diff missed it) is a direct symptom.

**Gap:** Large but mechanical. Risk is in moving the test fixtures and the cross-file references. Cost band L (15–25h). Risk: medium — wrong refactor order can break startup. **Priority: low** — pain is annoyance, not outage. Live with it until a second engineer joins or a code review becomes a real workflow.

### 2.2 Client — `public/index.html` single-file React SPA

**Clean-slate decision:** Vite or esbuild build pipeline. React components in `src/components/`, hooks in `src/hooks/`, route-level views in `src/views/`. Tailwind or vanilla CSS modules. Tree-shaken bundle served as a static asset; index.html becomes a 50-line shell. Keep server-rendered static pages (manual.html, privacy.html, etc.) as plain HTML — they don't need the build step.

**Current state:** ~26K lines of JSX inside one `<script type="text/babel">` block. Babel transpiles in-browser on every page load (the console warning has been there forever). Adding a new component means picking a line in the giant file and inserting. The Babel-parse-before-smoke pattern is documented in memory because JSX structural breaks have shipped to prod twice.

**Gap:** This is the single biggest structural debt in the codebase. Migration is non-trivial because the file mixes top-level state, ~30+ React components, and module-scope helpers (date math, picker logic, audit-format helpers) that are all in one closure. Cost band L+ (20–40h, depending on how clean the split goes). Risk: high — easy to introduce subtle bugs because the bundler will resolve scope differently than the giant closure. **Priority: medium-high.** The Babel-in-browser performance cost is real, the maintenance cost is high, and every new feature widens the gap. Pluggable section model (v2-tier confirmed) would be much cheaper to build after this lands.

### 2.3 Deploy — `_deploy.py` + Hyperlift pull from main

**Clean-slate decision:** A real CI pipeline. Push to `main` triggers a GitHub Action that runs node --check + Babel parse + smoke tests, then a deploy webhook fires Hyperlift's rebuild. The script that stamps `BUILD_ID` runs in CI, not locally. `_deploy.py` goes away.

**Current state:** `_deploy.py` is gitignored, lives only on Cap'n's machine, uses the GitHub Contents API to PUT files one at a time (creating one commit per file, not matching local git history). Dead references in it rot silently (today's lesson — the assign-set-ids pre-step pointed at a file that never existed). The local-vs-pushed git history drift is invisible until something else surfaces it.

**Gap:** Modest in code, big in workflow change. Cost band S (3–6h for the basic Action) but with non-trivial workflow churn. Risk: low — if CI fails, fallback is `_deploy.py` itself. **Priority: medium.** This becomes more valuable when a second person can deploy or when the bus-factor concern becomes real. As long as Cap'n is the only deployer, the cost of switching is higher than the cost of one more deploy-script-rot incident.

### 2.4 Env vars — Hyperlift 20-of-20 cap

**Clean-slate decision:** A single `SETFORGE_CONFIG` env var holding a JSON blob, or a small `config/runtime.json` file fetched at boot from a secret manager. 20 discrete env vars is a deployment-platform constraint, not a real engineering need.

**Current state:** Hit the cap. Every new integration (e.g., a future analytics provider) forces a consolidation pass first. [[feedback-env-var-cap]] documents this.

**Gap:** Small, but every refactor like this is a chance to introduce config-parsing bugs. Cost band S (2–4h). Risk: low if done with care, medium if rushed. **Priority: low** — only matters when the next env var is genuinely needed.

---

## §3 — Data model + identity

### 3.1 Persons table & identity normalization

**Clean-slate decision:** Start with `persons` as the root entity from day 1. `users` is a join table linking `persons` ↔ OAuth subs. `coach_managed_swimmers` is another join linking `persons` ↔ owner_coach_sub. Guardians, group members, etc., all reference `persons.id`. Display name is computed from `persons.{first_name, last_name, preferred_name}` everywhere via a shared helper.

**Current state:** Mid-flight. Phase 4 Identity I-A through I-D shipped (persons table exists, backfilled, read-side switched). I-E marked N/A (no real parental_contact data). I-F (drop legacy columns) and I-G (tombstone + portability) and I-H (CSV format) remain. Today we have a polymorphic dual-source pattern everywhere: managed-swimmer reads JOIN `coach_managed_swimmers` + `persons`, full-account reads JOIN `users` + `persons`, and ~18 hot SELECTs needed surgical updates to maintain the fallback. The dual-source `_swimmerPersonId({managedId, swimmerSub})` helper is now baseline.

**Gap:** The architecture is finally correct after the in-flight refactor. Finishing it (I-F drop) is locked-decision and ~1-2h of work. **Priority: medium.** Finishing the refactor cleans up the fallback noise that will otherwise rot the same way the BUILD_ID placeholder did. The 30-day soak gate that I-F is waiting on is reasonable.

### 3.2 Polymorphic swimmer model (managed vs full-account)

**Clean-slate decision:** One swimmer entity. A swimmer is a `person` with a profile. Whether they have an OAuth-linked `users` row is a property (`is_claimed`), not a different type. Coach-managed and self-managed are states of the same row, not different tables.

**Current state:** Two tables, two ID spaces (`ms_xxxxxx` VARCHAR for managed, OAuth sub VARCHAR for full-account), every authz check has to do the XOR dance. The `dbAuthzCoachOfSwimmer({managedId, swimmerSub})` helper exists to encapsulate it, but every route that handles a swimmer reference needs `_parseSwimmerRef` first. Memo: this dual model exists because managed swimmers preceded the relationships work and got their own table; the unification debt is real.

**Gap:** Significant. A migration to merge them would touch ~30+ helpers and every swimmer-scoped route. Cost band L+ (15–25h). Risk: high — claim/unclaim flows, parental_contact, group_members polymorphic FKs all need to move together. **Priority: low** — the dual model is annoying but the polymorphic helpers contain the damage. Revisit only if a new feature surfaces a sharp pain point that the existing model can't express.

### 3.3 Settings sprawl: `settings.extra` JSON blob

**Clean-slate decision:** Strongly-typed columns for known settings (pace_base, disfavor_mode, equipment_modes, audio_cues, lap_button, digest_paused, etc.), a `settings_extras` k/v table for anything experimental. Avoid the "everything goes in extras" trap.

**Current state:** `settings.extra` is a JSON column holding pace presets, audio toggles, multi-lane state, engine fav/disfav arrays, anti-repeat memory, disfavor_mode, lap_button, and more. The server validates known keys; clients have to know the shape. Adding a new setting means picking a key and writing a validator branch. `digest_paused` got its own column (correct call); the rest live in JSON.

**Gap:** Small if done as new settings arrive (graduate `extra` keys to columns over time), large if done as a one-shot migration. Cost band M (8–12h to graduate the top 10 keys + write the column migrations). Risk: medium — JSON-shape mistakes break the affected feature silently. **Priority: low-medium.** Pick this off opportunistically when touching a setting for another reason.

### 3.4 Audit events table

**Clean-slate decision:** Same shape we have today (eventType + structured details JSON + indexed (user_sub, created_at)) but with an explicit `entity_type` + `entity_id` column projection so reports don't have to JSON_EXTRACT. R3/R6 already do this for team_id and it's awkward enough to flag.

**Current state:** Excellent on coverage, awkward on query. Reports that filter by team/group have to use `JSON_UNQUOTE(JSON_EXTRACT(details, '$.team_id'))` which prevents index usage. R6 Curation Support also hit a COLLATE mismatch on `team_coaches.coach_sub` (general_ci vs unicode_ci) that required an explicit COLLATE clause to work around.

**Gap:** Adding 2-3 indexed projected columns to audit_events would be one migration. Cost band S (2–4h). Risk: low. **Priority: low** — reports work, just slowly. Reach for this when the slow query starts mattering.

---

## §4 — UX patterns

### 4.1 Navigation model

**Clean-slate decision:** Routes-first React Router setup. `/`, `/generator`, `/history`, `/assigned`, `/week`, `/teams`, `/parent`, `/admin`, `/reports`. Deep links work, browser back works, refresh keeps you in place. Active state of nav buttons is derived from current URL.

**Current state:** `view` is a `useState` string. Nav buttons set the string; everything keys off it. Refresh dumps you to "generator" regardless of where you were. Browser back/forward doesn't work as expected. Some toggles (admin, assigned, week, reports, parent) are toggleable (click to enter, click again to leave) which Cap'n likes; coach menu items (teams, swimmers, catalog, my-sets) are pick-once-and-stick. The toggleable pattern is documented in memory ([[feedback-toggleable-nav-buttons]]) and survives.

**Gap:** Moderate. Router introduction is mostly mechanical, but the toggleable-button UX needs to be preserved (router would prefer URL-driven state). Cost band M (6–10h). Risk: low. **Priority: medium.** The "refresh dumps you to generator" thing is a real UX paper cut, especially for parents and coaches deep in their daily flow. Worth doing alongside the SPA-build refactor in §2.2 since both touch the same surface.

### 4.2 View-as / impersonation / persona

**Clean-slate decision:** Three orthogonal axes, not interleaved:
- **Role override** (admin QA): self / solo / coach. Pure UI gate.
- **Trait overrides** (admin QA, composable): +parent, +new-user (for onboarding QA), +coppa-protected (for compliance QA).
- **Impersonation** (customer support): server-side, header-based, audit-logged, time-capped. Completely separate code path.

**Current state:** Today is close. v1 = role override (the picker), v1.1 (today) = trait override (+parent), v2 = persona simulation (data wipe + write block) layered on v1 via `isViewingAsOther`, v3 = impersonation (separate). The v1.1 +parent built today follows the right pattern.

**Gap:** Already there. The only future work is: when the next trait axis appears (likely +new-user for onboarding QA), follow the same orthogonal-checkbox pattern.

### 4.3 ProfileModal as the kitchen sink

**Clean-slate decision:** Separate `/profile` settings page split into tabs (Identity, Display, Curation, Reports, Admin QA). ProfileModal stays for quick-edit cases only (pace, name).

**Current state:** ProfileModal contains: pace settings, name/initials/email edit, DOB, gender, OAuth providers list, Discord link, view-as switcher, sessions list, favorites audit, disfavorites audit, engine-favorites, set-level fav/disfav, hard-exclude mode, team-defaults inheritance disclosure, coach curation impact panel, parent digest pause toggle (in ParentDashboard, but related), constraints panel. It's a scroll-down monolith.

**Gap:** Modest. The component is one big React function that could split into N tab components. Cost band S-M (4–8h). Risk: low. **Priority: low.** It's a navigation problem more than a structural one.

### 4.4 Discoverability — "I don't know what's here"

**Clean-slate decision:** A real onboarding flow. After first sign-in, walk the new user through 3 screens explaining the three modes (Bank / Engine / Mix), the favorites system, and how to mark practice done. Persistable "don't show again."

**Current state:** Onboarding curriculum exists as a separate Training package (`TRAINING/solo/`) — 5 markdown files / 12K words. It's documentation, not in-app. Users discover features by exploration or by reading the manual. Cap'n's eval personas surfaced this gap repeatedly.

**Gap:** Real feature work. Cost band M (8–12h for a basic three-card onboarding flow + persistable dismiss). Risk: low. **Priority: medium** when the first pilot user reports getting lost. Today the gap is masked by Cap'n personally onboarding everyone.

---

## §5 — Workout structure

### 5.1 Pluggable section model

**Clean-slate decision:** A workout is an ordered list of sections, each with `{ kind, ... }`. Section kinds are pluggable: pool-swim sections (warmup / drill / main / cooldown), dryland sections (mobility / strength / activation), recovery, etc. UI rendering and validation key off `kind`. The default workout template is the four-section pool layout but it's a default, not a hard requirement.

**Current state:** 4 sections hardcoded everywhere — SECTION_STYLES constant, 12 canonical bank constants (4 sections × 3 pool modes), template engine section tagging, section-source toggle, validator V-rules, R1 Programming Mix, UGC validation, multi-pace print view, save/load payload shape, manual prose. Dryland doesn't exist as a section type. This is the biggest user-facing structural debt.

**Gap:** **Confirmed v2-tier important by Cap'n.** Already in ROADMAP backlog with a scope-session prerequisite. Cost band L+ (15–25h plus dryland-specific renderer work). Risk: high — touches ~12 places. **Priority: high among v2 work.** Should be the first thing scoped after v1 ships, per the existing backlog entry.

### 5.2 Bank / Engine / Mix per-section sources

**Clean-slate decision:** Same model. Per-section source toggle (Bank / Engine / Mix) with persistent settings. The decision to make sources per-section rather than per-workout was correct because real coaches mix templating styles within a workout.

**Current state:** Works as designed. ⚡ badge for engine output, Mix divider rows, anti-repeat memory, hybrid retry-3 with fallback to bank. Validator covers 6 of 8 spec rules.

**Gap:** Two deferred validator rules (V5 mix-pill context, V7 cross-rep descending intervals). Neither has surfaced as a real problem. **Priority: low.** Leave alone unless something breaks.

### 5.3 Multi-lane generate + print

**Clean-slate decision:** First-class lane plan as part of the workout payload. Generate fits all lane paces upfront; print view renders per-lane pages or matrix mode. Lanes carry member assignments so per-swimmer substitutions render inline.

**Current state:** Shipped as v2.0 + v2.1 + N6 export. Lane-fit fallback yellow banner when the constraint can't be satisfied. History persists multi-lane state.

**Gap:** None significant. The "+parent" view doesn't compose with multi-lane (because multi-lane skips PSC and parent view is read-only anyway), but that's not a real overlap.

### 5.4 Engine template count + tuning

**Clean-slate decision:** Same template engine architecture. 17 templates across warmup/drill/main/cooldown is a sensible starting count; tune fallback rate at deploy time with the existing `measure_fallback_rate.mjs` tool.

**Current state:** Fallback rate 3.9% overall (post Phase H Stage 2 + drill-coverage expansion). Sprint/fly main at high budgets is structural, not coverage. Documented as CUT per [[swim-generator-fallback-tuning-drill-v1]].

**Gap:** None. Working as intended.

---

## §6 — Bank, UGC, curation

### 6.1 Canonical bank shape (flat array + multi-tag)

**Clean-slate decision:** Same flat-array shape with `types: []` + `strokes: []` arrays per option. The original object-keyed `{ typeId: [opts] }` layout was wrong (forced duplication for cross-pool sets); the flat-array refactor in Phase H Stage 2 fixed it.

**Current state:** 1,311 options across 12 constants (4 sections × 3 pool modes), all multi-tag. Picker uses `getBankOptions` with `o.types.includes(typeId) || o.strokes.includes(typeId)` and a `mixed`-tag fallback.

**Gap:** None. The refactor stuck.

### 6.2 UGC overlay model

**Clean-slate decision:** Same. JS canonical, DB UGC-only, per-session overlay merged client-side, graduate via admin snippet + two-step confirm. Visibility tiers: private / team / public (with admin moderation for public).

**Current state:** Shipped as UGC v1 (closed 2026-05-25). Multi-tag matches canonical. Graduate snippet builder correctly emits the flat-array shape.

**Gap:** None significant. The "in-process auto-write then commit" trap that the original spec proposed was correctly rejected.

### 6.3 Coach + team curation precedence

**Clean-slate decision:** Layered precedence: team > coach > own, with universal favorite-wins precedence (own-fav + coach-disfavor = 3× weight). Effective sets computed server-side, cached client-side with 5-min poll for cross-coach updates.

**Current state:** Shipped through v1.7 → v1.13 → TC v1. Universal favorite-wins precedence formalized in v1.13B. Team-level layered on top in TC v1 via UNION through `group_members → groups.team_id`.

**Gap:** None significant. The precedence story is documented and tested.

---

## §7 — Compliance + audit

### 7.1 Minor protections

**Clean-slate decision:** DOB-required on every account that can transact (sign up, claim, etc.). `is_minor` derived; `is_coppa_protected` derived from age < 13. Default-bypass on any email when DOB unknown or indicates under-18. Discord webhook, Resend send, every email path checks `isMinor` first.

**Current state:** Matches. The "safer side of unknown" call on DOB-null bypass is correct and survives review.

**Gap:** None. Working as intended.

### 7.2 Parent / guardian model

**Clean-slate decision:** Parents are first-class persons with a guardians join table to swimmer persons. Invite via email → OAuth-completion model (no magic-link tokens). Parents are read-only on swimmer data; their own settings (digest pause) live on `settings.digest_paused`. Multi-parent support free.

**Current state:** Shipped today as Parent Portal MVP. Matches the clean-slate model exactly.

**Gap:** v1.1 punch list (manual section, tighter guardian-removal authz, invite expiry sweep, family-coach unified UX, parent-side prefs beyond pause). All real but small.

### 7.3 Data portability + tombstone-on-delete

**Clean-slate decision:** Self-serve JSON export (full account: workouts + assignments + attendance + notes + group history + UGC + curation). Roster-scoped variant for board secretary. Tombstone identity (null the sub, keep the rows) on delete to preserve audit + co-authored data. Mirrors what `audit_events` already does at the field level.

**Current state:** Not built. "Email the operator" is today's export pipeline. Bundled with Identity I-G in the roadmap. Triple-cross-validated by 4 of 5 team personas + swimmer eval top-5 + assistant coach top-3.

**Gap:** Large. Cost band M (12–18h for export + tombstone). Risk: medium — tombstone replacement strings and FK cascade rules need careful design. **Priority: high once a board approval becomes blocking.** Required for any USA-S 501(c)(3) pilot regardless of product quality.

---

## §8 — Operations + observability

### 8.1 Logging + observability

**Clean-slate decision:** Structured logs (JSON lines) shipped to a log aggregator (Better Stack, Axiom, or similar) with retention. Per-route latency, audit-event counts, email worker stats surfaced on a dashboard. Errors page on threshold.

**Current state:** `console.log` / `console.warn` to Hyperlift's log tail. No structured search. No dashboards. Email worker logs are best-effort. Errors that don't crash the process can go unseen for days (today's lesson — the BUILD_ID stamper was a no-op for 6 days; the deploy-script-rot incident was similar shape).

**Gap:** Real feature work. Cost band M (8–12h to wire structured logging + a basic dashboard). Risk: low. **Priority: medium** when the first paying pilot signs. Below that, the operator-attention model works.

### 8.2 Smoke tests + CI

**Clean-slate decision:** Real CI on push to main. node --check + Babel parse + smoke test matrix (the existing `sim_template_engine.mjs` is a great seed) + a synthetic-traffic test against a staging endpoint that exercises sign-in + generate + save + assigned-to-me round-trip.

**Current state:** Local smoke. The Babel parse step is a memory-locked rule ([[feedback-jsx-parse-before-smoke-claim]]) but it's executed by Cap'n / Claude, not automated. No staging environment. Two prod incidents this month were caught only after deploy.

**Gap:** Cost band M (8–12h for CI + staging). Risk: low. **Priority: medium-high.** This and the build pipeline in §2.3 are the same project; do them together.

### 8.3 Deploy script rot

**Clean-slate decision:** No `_deploy.py`. CI handles it.

**Current state:** See §2.3 + [[feedback-deploy-script-rot]]. The script is gitignored so dead refs rot silently.

**Gap:** Solved by the CI move. Until then, audit `_deploy.py` before every deploy run.

---

## §9 — Gap analysis summary table

Priority bands: H = do early when triggered, M = do when an adjacent feature naturally surfaces it, L = live with it.
Cost bands: S = ≤6h, M = 6–15h, L = 15–25h, L+ = 25h+ or multi-session.

| Area | Decision delta vs clean-slate | Cost | Risk | Priority | Trigger |
|---|---|---|---|---|---|
| Single-file React (§2.2) | Migrate to bundled build (Vite/esbuild), split components | L+ | High | M-H | Before pluggable-section work |
| Single-file server.js + db.js (§2.1) | Split by domain into route + db modules | L | Medium | L | Second engineer joins |
| Deploy via _deploy.py (§2.3) | Move to CI on push | S | Low | M | Second deployer or post-pilot |
| CI + smoke + staging (§8.2) | Bundle with §2.3 | M | Low | M-H | Post-pilot |
| Structured logging + dashboards (§8.1) | Ship to aggregator, surface metrics | M | Low | M | First paying pilot |
| Env-var consolidation (§2.4) | JSON blob or config file | S | Low-M | L | Next env-var needed |
| Hardcoded 4-section workout (§5.1) | Pluggable section model + dryland | L+ | High | H (v2) | After v1 wraps; scope session first |
| Polymorphic swimmer model (§3.2) | Unify managed + full-account | L+ | High | L | Sharp pain from a new feature |
| Identity I-F drop + I-G/H (§3.1, §7.3) | Finish what's started | M (I-F) + M (I-G) | Low (I-F) / Medium (I-G) | M (I-F now) / H (I-G when board) | I-F: 30-day soak passed; I-G: board approval blocker |
| Settings.extra sprawl (§3.3) | Graduate hot keys to columns over time | M | Medium | L | Opportunistic on touch |
| Audit events JSON_EXTRACT (§3.4) | Project entity_type + entity_id columns | S | Low | L | Slow report becomes annoying |
| SPA navigation refresh (§4.1) | React Router | M | Low | M | Bundle with §2.2 |
| ProfileModal monolith (§4.3) | Split to tabbed page | S-M | Low | L | Cosmetic |
| Onboarding flow (§4.4) | In-app 3-card walkthrough | M | Low | M | First lost pilot user |
| Parent Portal v1.1 punch list (§7.2) | Manual, authz, expiry cron, family-coach UX | M | Low | L | Live-exercise feedback |
| Multi-line commits via _COMMIT_MSG.txt | (Process workaround, no fix) | — | — | — | Permanent until commit tooling changes |
| Lock-file sandbox unlink failure | (Process workaround) | — | — | — | Permanent until tooling changes |

---

## §10 — If I had to pick five to actually do

In order, with honest trigger-readiness:

**1. Pluggable section model + dryland (§5.1)**
Highest-value structural change. Cap'n already confirmed it's v2-tier important. The longer it waits, the more places get the 4-section assumption baked deeper. Should start with a scope session per the existing backlog entry. Cost L+ but pays back forever. **Wait for v1 to ship + first dryland-asking pilot.**

**2. SPA build pipeline + React Router (§2.2 + §4.1 bundled)**
Second-highest. Babel-in-browser is a real perf cost, the maintenance burden compounds with every new component, and pluggable sections will be much cheaper to build after this lands. Pair with React Router so the refresh-dumps-you-to-generator UX paper cut goes away. Cost L+, risk high, but the structural payoff justifies the slog. **Do this immediately before §5.1.**

**3. CI + smoke + staging (§8.2 + §2.3 + §8.1)**
Bundle the three ops items. Once a paying pilot signs, the cost of an undetected prod regression goes up sharply. Today the operator-attention model catches things but two incidents this month slipped past it for days. Cost M, risk low. **Trigger: first paying pilot, or right before.**

**4. Identity I-F (drop legacy columns) (§3.1)**
Finish what's started. Decisions are locked, scope is small, the longer the fallback period runs the more chance a new write path silently grows a dependence on the legacy columns. Cost ~1-2h. Risk low. **Trigger: 30-day soak passes (≈2026-06-27).**

**5. Data portability + tombstone (§7.3, bundled with Identity I-G)**
Bundle with I-G since they share the cascade-rules design work. This is the gate for board-approved USA-S 501(c)(3) pilots — without it, no team treasurer can approve the spend regardless of product quality. Cost M. Risk: medium (tombstone identity strings + FK cascade rules need real design). **Trigger: first 501(c)(3) board flag.**

Notes that didn't make the top five but are worth flagging:
- **Onboarding flow (§4.4)** is genuinely valuable but masked by Cap'n personally onboarding everyone. The day that stops scaling, it jumps to top-five.
- **Single-file server.js / db.js (§2.1)** is the most-mentioned annoyance internally but the *least* user-facing. Don't reach for it until second-engineer arrives.
- **Polymorphic swimmer model (§3.2)** is the ugliest data model decision still standing but the polymorphic helpers contain the damage well. Leave alone until it bites.

---

## §11 — What this doc deliberately doesn't cover

- **Pricing implementation** — `PRICING.md` has the spec; it's trigger-gated, not structurally interesting.
- **Vendor paper kit + billing scaffold** — both written, both dormant. Will activate on first paying pilot.
- **Reporting v1.1 polish** — captured in [[swim-generator-reporting-v1-complete]]'s deferred list.
- **Engine fallback tuning** — capped at structural ~4%; documented as CUT.
- **Run-screen polish** — already shipped v1, captured backlog item in ROADMAP.
- **Auth beyond Apple/Google** — backlog scope-session needed; not structural enough to belong here.

---

## §12 — Acknowledgments to current-state Cap'n

Two things worth saying explicitly:

1. The current state is the result of a lot of right calls made under uncertainty. The clean-slate decisions in §1 are not retrospectively obvious; they're the surviving good calls from a much larger decision tree. Most of them would have looked over-engineered or under-engineered to someone else at the time they were made.

2. The structural debts are real but proportionate to the runtime of the project and the size of the team. A solo developer shipping at this velocity is expected to accumulate ~3-5× the technical debt of a team. SetForge is well under that.

The Darwinian journey framing is correct. The features that survived have done so because real users (or real evaluation personas) needed them. The structural choices that survived have done so because the alternatives were worse in the specific context. Both deserve respect even where they look ugly.

---

**End of doc.** This is opinion-shaped; push back on anything that reads wrong and it'll get revised. Memo at [[clean-slate-analysis-2026-05-27]] will point here for future-session pickup.
