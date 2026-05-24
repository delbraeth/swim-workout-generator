# Setforge Roadmap

Live at https://setforge.io. Single source of truth — supersedes any scattered "open follow-ups" in v1.x checkpoint memos.

Last refreshed: **2026-05-25** (UGC v2 Phase E shipped: public submission + admin moderation queue + 🌐 PUBLIC badge; Phase F Graduate-to-JS tool next)

## How this file works

- **Now** = something is actively in progress this session.
- **Next** = small, scoped, ready to start. Pick one and ship.
- **Bigger threads** = needs a planning session (locked decisions / scope spec) before any coding.
- **Backlog** = captured, not prioritized. Don't dig here until Next is empty.
- **Closed/declined** = recorded so we don't relitigate.

Memos in `/Users/cassidy/Library/Application Support/Claude/.../memory/` are the per-feature checkpoints. This file is the index of what's left.

---

## Now

- **Coach-authored workout sets (UGC v1)** — scope re-architected + build approved 2026-05-25 per direct tester request. Architecture: **JS is canonical forever**; DB holds UGC rows only (`bank_options.author_sub IS NOT NULL`); UGC graduates into JS via a per-option admin tool that auto-edits `public/index.html` with snippet fallback. After graduation, DB row stays with `promoted_at` timestamp (soft delete from overlay). Picker reads JS constants + per-session UGC overlay (`/api/bank/my-overlay`). Visibility tiers: private / team-I-pick / public-with-admin-moderation. Spec: `UGC_COACH_SETS_SCOPE.md`. **Phases A-G, ~29-40h.** Source: [[swim-generator-ugc-coach-sets-scope]]
  - **Phase A** ✅ SHIPPED 2026-05-25. Migration 031 applied in prod, verified via DESCRIBE/SHOW INDEX. Source: [[swim-generator-ugc-v2-phase-a]]
  - **Phase B** ✅ SHIPPED 2026-05-25. GET /api/bank/my-overlay + dbGetUgcOverlay (visibility-scoped) + client fetch + picker/catalog merge. Source: [[swim-generator-ugc-v2-phase-b]]
  - **Phase C** ✅ SHIPPED 2026-05-25. Full UGC authoring UI (private-only). Source: [[swim-generator-ugc-v2-phase-c]]
  - **Phase D** ✅ SHIPPED 2026-05-25. Team sharing + 👥 TEAM badge. Source: [[swim-generator-ugc-v2-phase-d]]
  - **Phase E** ✅ SHIPPED 2026-05-25. Public submission + admin moderation: dbListPendingUgc + dbReviewUgcOption + dbGetLatestUgcReview; public→pending coercion in create/update; GET /api/admin/pending-ugc + POST /api/admin/pending-ugc/:id/review + GET /api/bank-options/:id/latest-review; UgcFormModal 🌐 Public radio with explainer; MySetsView shows ⏳ pending / ❌ rejected (reason tooltip); new AdminView "Pending UGC" tab with preview + ✅ approve / ❌ reject (reason required). 🌐 PUBLIC badge activates as public rows arrive. Source: [[swim-generator-ugc-v2-phase-e]]
  - **Phases F-G** — Graduate-to-JS tool → smoke + tag.

## Next (small, ready)

_Empty. UGC v1 (now) is the active build._

## Bigger threads (need a planning session)

- **Reporting engine v1** — ✅ COMPLETE 2026-05-23. All 6 phases (A-F) shipped in one day. 6 reports across 3 audiences (coach-self / solo / admin) + Print/PDF + Markdown export. Tag `reporting-v1-complete` after Cap'n's live-exercise pass. v1.1 deferred punch list (charts, true bank-reduction calc, R5/R6 PDF, etc.) lives in [[swim-generator-reporting-v1-complete]]. Source: [[swim-generator-reporting-scope]]
- **Pricing implementation** — spec locked in repo `PRICING.md`. Four-tier Patreon (Free / Supporter $3 / Coach $10 / Program $25). Coaches pay, swimmers free. Trigger: first paying pilot. Source: [[swim-generator-pricing-direction]]
- **Sprint/fly main templates for large budgets** — residual fallback after slice-1 (~4.4% overall) is concentrated in sprint mains ≥1200yd and fly mains ≥1000yd. Both fail validator due to "no rep > 100yd" + budget packing. Real coaches may not program these (so current behavior could be correct). Defer until coach pilot reports a problem. Source: [[swim-generator-fallback-tuning-drill-v1]]

## Backlog (captured, low priority)

- **Per-type disfavor mode** — split v1.8's single toggle into bank/engine/sets columns. Advanced-user. Source: [[swim-generator-hard-exclude-v18]]
- **Hard-include `favorite_mode`** — mirror of v1.8 hard-exclude. Cap'n flagged as likely overkill given 3× weight. Skip unless asked. Source: [[swim-generator-favorites-panel-v12]]
- **Validator V5 + V7** — V5 needs mix-pill context (mix shipped; V5 still unwired). V7 only relevant if a future template uses cross-rep descending intervals (none do today). Source: [[swim-generator-template-engine-s25]]
- **Recovery-mode behavior gap** — validated as real but mild (15/200 workouts <1800yd; rest land near max). Picker still favors larger options when budget allows. Not a bug, considered for tuning. Source: [[swim-generator-bank-review-todo]] §Status
- **iOS native** — paused 2026-05-18, not declined. `/api/auth/native` stays live for TestFlight users. No new iOS features. Source: [[swim-generator-ios-paused]]
- **Tier-aware rate limits** — captured 2026-05-23 after writeLimiter bump. Today writeLimiter is a flat 100/min/(userSub+IP) for everyone (admins exempt via ADMIN_SUBS). Once pricing ships ([[swim-generator-pricing-direction]]: Free / Supporter $3 / Coach $10 / Program $25), the limit should scale with tier — paid tiers get more headroom. Sketch: lookup tier on auth (could cache in `req.tier_limit`), pass as `limit` callback to express-rate-limit. Trivial once paid_tier column exists; meaningless before pricing. Defer until pricing implementation lands.
- **Discord server for user feedback + community** — captured 2026-05-23. Cap'n wants to design a Discord setup as a feedback + discussion channel for SetForge users (coaches, swimmers, parents). NEEDS A DESIGN PASS before any creation. Decisions to lock: which channels (#general / #coach-corner / #feature-requests / #bug-reports / #pace-clock-help / #showcase / etc.); moderation model (admin-only? trusted-coach mods? automod?); how users discover/join (link in manual? in-app banner? sign-in page?); whether to hook the existing /api/feedback endpoint to a Discord webhook for cross-posting; privacy/age considerations (some swimmers are minors — does Discord's 13+ ToS conflict?); should bug reports get auto-routed to a private channel for triage. Trigger: once coach pilots are live and need somewhere to converge. Probably ~3-5h to draft a SCOPE doc + ~1-2h to actually spin up the server. Source: chat 2026-05-23.
- **Deploy workflow: git lock-file recovery** — captured 2026-05-23. When Claude commits from its sandbox, leftover `.git/index.lock` and `.git/HEAD.lock` files frequently linger because the sandbox can't `unlink()` them (permission denied on the FUSE mount). This blocks the next commit attempt and forces a manual "rm -f .git/*.lock" from Cap'n's terminal before retrying. Hit it three times in the 2026-05-23 session. Fix options: (a) Claude's pre-commit step runs `rm -f` and falls back to hand-off-with-clear-instructions when the rm fails (degrades gracefully); (b) investigate sandbox permission model to see if there's a way to allow unlink on the user's files; (c) move commits entirely to Cap'n's terminal (back to the original workflow). Option (a) is the pragmatic incremental fix. Tooling/DX only, not product-facing.
- **User type taxonomy normalization** — captured 2026-05-25. The user role/type vocabulary spans `solo`, `solo+`, `solo_team`, `coach`, `coach+`, `team_admin` (and possibly more in code paths). Today these are inferred from a mix of flags (is_coach, support_role, etc.), group/team relationships, and ad-hoc gates per UI component. Needs work: lock the canonical list, define what each type can do (read/write capabilities, UI surfaces visible), centralize the resolution logic so server + client agree, and audit the existing role gates against it. Likely a SCOPE SESSION before any code. Related to (but distinct from) the display-name normalization item below. Source: chat 2026-05-25.
- **User table normalization (single source of truth for display name)** — captured 2026-05-23 while building Reports v1. Today's gap: `workouts` table has its own `initials` column AND payload JSON sometimes carries `userInitials`; audit_events payloads occasionally stash names inline; reports that want to show a person's name have to JOIN `users` AND fall back to the cached copies if the JOIN misses. Goal: `users.display_name` (+ `users.initials`) becomes the ONE source — every report/UI fetches via JOIN, no caching. Audit: grep code for `initials`/`display_name` references on non-user tables, document each, decide keep-vs-drop per case. Likely involves a one-time backfill (replay workouts payload `userInitials` into `users.initials` where the user row's value is null) + dropping the redundant columns from `workouts`. ~6-10h depending on how many places cache. Source: chat 2026-05-23.
- **Auth beyond Apple-only (passcodes, NOT email/password)** — captured 2026-05-23. Cap'n wants to move past Apple-only but is FIRM on no email/password storage. Specified "passcodes" — most likely interpretation is one-of: (a) email-delivered one-time passcodes (vs. magic-link tokens), (b) TOTP via authenticator app, (c) user-set numeric PIN as a second factor. NEEDS A SCOPE SESSION before any code — locked decisions needed on: which passcode model, which channel (email/SMS), what's the recovery path if a user loses access, does this conflict with the existing [[feedback-no-password-auth]] rule (which currently forbids "magic links by default"). Trigger: when Apple-only friction becomes a real signup blocker. Source: chat 2026-05-23.

## Closed / Declined (do not relitigate)

- **In-app bank editing (catalog Phase III)** — declined 2026-05-15. Local-deploy clobber problem. Feedback loop via Phase II 🚩 flag is the iteration mechanism. Source: [[swim-generator-catalog-plan]]
- **In-app bank label quality iteration** — declined 2026-05-15. Same architecture reason as Phase III. Source: [[swim-generator-catalog-plan]]
- **Watch companion (iOS)** — formally declined. Source: [[swim-generator-ios-paused]]
- **Password/email auth** — never. OAuth-only (Apple + Google planned). Source: [[feedback-no-password-auth]]
- **Bank label backfill** — verified done 2026-05-22 via `tools/bank_audit.py`: 616/616 options labeled, 598 unique. Catalog memo's "85-90 unlabeled" claim was stale; that work shipped during catalog Phase II week (2026-05-15).

## Recently shipped (last ~10 days, for context)

Reverse-chronological. Each is a memo in the memory directory.

| Date | Tag | What |
|---|---|---|
| 2026-05-25 | (no tag) | UGC v2 Phase E: public submission + admin moderation. db.js — dbListPendingUgc (FIFO pending queue with author info), dbReviewUgcOption (atomic insert review + visibility flip), dbGetLatestUgcReview (rejection-reason lookup); validateUgcPayload allowVisibility extended to ['private','team','public']; create/update coerce author 'public' → 'pending'; dbListUgcOptionsByAuthor extended with LEFT JOIN bank_option_reviews to include latest_review_reason on rejected rows (no N+1). server.js — 3 new routes: GET /api/admin/pending-ugc (admin), POST /api/admin/pending-ugc/:id/review (admin + CSRF + reason-required-on-reject), GET /api/bank-options/:id/latest-review (author or admin). Audit event ugc.option.review. Client — UgcFormModal: 🌐 Public radio with "needs admin review" explainer; MySetsView visibility column gets ⏳ pending and ❌ rejected variants (reason in tooltip); new AdminPendingUgc tab (preview + approve/reject + reason textarea) in AdminView. 🌐 PUBLIC badge variant in WorkoutBlock (wired in Phase D) activates as public rows arrive. |
| 2026-05-25 | (no tag) | UGC v2 Phase D: team sharing. db.js — dbSetUgcOptionTeamShares (with coach-of-team validation) + dbSetUgcOptionVisibility helper; extend dbCreateUgcOption/dbUpdateUgcOption to write bank_option_team_shares atomically when visibility='team'; dbGetUgcOption returns team_ids array. server.js — POST/PATCH /api/bank-options no longer force private; new POST /api/bank-options/:id/visibility for standalone visibility flips. Client — UgcFormModal: visibility radio (📝 Private / 👥 Team-shared) with team multi-select that loads from /api/teams. WorkoutBlock badge upgraded from set-id Set to set-id→{_is_own,_visibility} Map so team-shared options render with 👥 TEAM badge instead of 📝 UGC. 🌐 PUBLIC variant pre-wired (silent until Phase E ships public visibility). |
| 2026-05-25 | (no tag) | UGC v2 Phase C: full authoring UI. Server-side: 5 routes (list/get/create/update/delete /api/bank-options) + 5 db helpers with quota + validation + edit-reverts-public + frozen-when-promoted. Client-side: 📝 My Sets entry in coach menu, MySetsView (list + edit + delete), UgcFormModal (section/type/stroke/pool_mode/label/repeating set rows), 📥 snapshot button on WorkoutBlock that pre-fills the same modal from any block, 📝 UGC badge in WorkoutBlock header when block sourced from overlay. Visibility forced to 'private' Phase C (team in D, public in E). Manual updated (What's Coming → "In progress"). First user-visible UGC surface. |
| 2026-05-25 | (no tag) | UGC v2 Phase B (server-side checkpoint): db.js 5 author helpers + 5 /api/bank-options routes (private-only Phase C scope). |
| 2026-05-25 | (no tag) | UGC v2 Phase B: GET /api/bank/my-overlay endpoint + dbGetUgcOverlay helper (visibility-scoped: own + admin-approved public + team-shared via team_coaches OR group_members→groups.team_id; excludes promoted_at). Client fetch on mount + 5-min poll. Picker (getBankOptions) + catalog (getCatalogList) merge — exact pool mode only. Wired but empty until Phase C populates rows. No user-visible change yet. |
| 2026-05-25 | (no tag) | UGC v2 Phase A: migration 031 corrects migration 030's wrong-architecture schema in prod. bank_options.author_sub NOT NULL, drop in_export, add promoted_at + promoted_by_sub, swap export-index for overlay-index. Idempotent (re-runnable). Tables empty; no client behavior change. |
| 2026-05-25 | (no tag) | UGC architecture course-correction: scope rewritten with JS-canonical / DB-UGC-only / soft-delete graduation model. Removed obsolete code from yesterday's wrong-architecture build: tools/sync_bank.mjs --import, tools/bank_importer.mjs, POST /api/admin/run-bank-import route. Migration 030's empty tables stay (no destructive change); migration 031 will correct the schema during Phase A of the corrected build. Build approved per direct tester request. |
| 2026-05-24 | `ugc-phase-a` (obsolete, see 2026-05-25) | UGC Phase A under wrong (hybrid DB-canonical) architecture: migration 030 + tools/sync_bank.mjs --import + admin import endpoint. Architecture misread of "have both db and js, then export from db to js" — actual intent was UGC's lifecycle (DB → JS via graduation), not bidirectional sync. Schema tables remain in prod (empty + harmless) for the corrected build to inherit. See [[swim-generator-ugc-phase-a]] warning header. |
| 2026-05-23 | `reporting-v1-complete` (pending) | Reporting v1 Phase F: static audit clean (all 6 routes wired, 6/6 tab IDs consistent, no orphans, no TODOs). Manual swept: Reports section accurate, "no export" caveat removed, What's Coming updated to reflect Reporting complete. Consolidated memory checkpoint written. Tag pending Cap'n's live-exercise pass. |
| 2026-05-23 | `reporting-phase-e` | Reporting v1 Phase E: 📄 Print / PDF + 📋 Markdown export buttons. ReportPrintView component (overlay + body-class scope + auto-window.print, mirroring MultiPacePrintView pattern). Per-report print layouts for R1-R4. Shared `reportToMarkdown` helper for all 6 reports. Manual updated; "no export" caveat removed. |
| 2026-05-23 | `branding-polish-v1` | Copyright text → "© 2026 Competition Aquatics, LLC · All rights reserved." in 4 files (index, manual, privacy, terms). SetForge logo added to left of wordmark in app header + manual masthead via existing `/icons/icon-192.png` (no static-serving config change needed; `/png/` repo-root folder was the staging copy). |
| 2026-05-23 | `reporting-phase-d` | Reporting v1 Phase D: R5 Platform Health + R6 Curation & Support (admin-only tabs). Weekly bar-fill tables for workouts-per-week + engine fallback trend. Feature adoption %, active-coach 7/14/30d counts. Per-team propagating disfavor counts (simplified proxy), impersonation activity by actor, per-team audit_events rollup. |
| 2026-05-23 | `reporting-phase-c` | Reporting v1 Phase C: R4 Program Recap (solo/masters). Reports promoted out of coach dropdown to top-nav (📊 button); coaches see 4 tabs, solo users see only Program Recap. R4 adds template usage counts + multi-lane fit success rate + 30-day sliding-window stroke-gap detector. |
| 2026-05-23 | `reporting-phase-b` | Reporting v1 Phase B: 3 coach reports (R1 Programming Mix · R2 Schedule Adherence · R3 Curation Log). New 📊 Reports view in coach dropdown with range + group filters. Numbers + tables (charts deferred). 3 db.js helpers + 3 GET routes + ReportsView component + R1/R2/R3 tab renderers. |
| 2026-05-23 | `reporting-phase-a` | Reporting v1 Phase A: practice_attendance table (migration 029) + completed_at on scheduled_workouts + /attendance-context GET + /complete POST + Mark practice done modal in WeekView. Owner-OR-active-group-coach authz. |
| 2026-05-23 | (no tag, post v2) | View-as v2: persona simulation (wipes data on entry, write-block via ref guards, exit-reload) + auth-beyond-Apple backlog |
| 2026-05-23 | (no tag) | AdminUsers: 📋 sub copy button + ROADMAP: tier-aware rate limits backlog entry |
| 2026-05-23 | (no tag) | Rate-limit + audit-log: writeLimiter D (compound key + bump 30→100 + ADMIN_SUBS skip), handler explicit logging, audit chip filters in admin UI |
| 2026-05-23 | `run-screen-v1` | PaceClockView landscape rebuild (clock 80→128px, hierarchy swap, INTERVAL/REST/GO label, repDots to right col, button-height bump) + ✋ Lap-button toggle in start modal |
| 2026-05-23 | `manual-impersonation-docs` | Manual: new Impersonation section under Admin docs + audit-log event types updated |
| 2026-05-22 | `view-as-v3-client` | v3 Phase B: impersonation client (fetch wrapper, banner, modal, Admin→Users buttons) — feature complete end-to-end |
| 2026-05-22 | `view-as-v3-server-only` | v3 Phase A: impersonation server-side (header auth, support_role, read-only, audit, 30-min cap) |
| 2026-05-22 | `fallback-tuning-drill-v1` | Engine fallback 16.2%→4.4%: drill_progression now covers distance/sprint/endurance/mixed |
| 2026-05-22 | `view-as-v1` | Admin role-flag override (self/solo/coach) for UI QA |
| 2026-05-22 | `coach-impact-v1` | Coach curation impact panel (reach + effectiveness, last 30d) |
| 2026-05-22 | `hotfix-buildworkout-2026-05-22` | Hotfix: buildWorkout ReferenceError on useLaneFit (intro v2.0) |
| 2026-05-22 | `phase-4-css-sweep` | 289 hex→var replacements + theme-color meta bug fix |
| 2026-05-22 | `v2.1-multi-lane-history` | Periodic refresh + multi-lane workouts persist to history |
| 2026-05-22 | `inherited-gaps-2026-05-22` | regenerateSection set-level weights + catalog set cycling button |
| 2026-05-22 | `multi-lane-polish-v1` | v2.0 polish: persist multi_lane + lane-fit fallback banner |
| 2026-05-22 | `multi-lane-generate-v1` | v2.0 pace-aware picker + lane-fit validator + coach UI + auto-route to N6 |
| 2026-05-22 | `favorites-prop-v1` | v1.13 coach-prop favorites + universal precedence + engine-favorite |
| 2026-05-22 | `favorites-panel-v1` | v1.12 favorites audit panel |
| 2026-05-21 | `hard-exclude-v1` + 7 more | v1.2-v1.11 disfavor/fav system buildout |
| 2026-05-21 | `template-engine-v1.1` | Mix sub-block renderer |
| 2026-05-21 | `template-engine-v1` | Per-section Bank/Engine/Mix toggle, ⚡ badge, write side |
| 2026-05-21 | `template-engine-s2.5` | Validator 6/8 rules + anti-repeat + hybrid retry |
| 2026-05-21 | `template-engine-s2` | 9 new engine templates (~61% bank coverage) |
| 2026-05-21 | `template-engine-s1` | Engine bootstrap (3 templates, 80.5% audit coverage) |
| 2026-05-21 | `bank-stroke-creative-2026-05-21` | 18 stroke-mechanical creative mains |
| 2026-05-21 | `bank-creative-mains-2026-05-21` | 30 creative main sets |
| 2026-05-20 | `setforge-rebrand-2026-05-20` | Phases 1+2+3 of rebrand |
| 2026-05-20 | `i-week-view-phase2b-2026-05-20` | I Phase 2b (coach group fanout) |
| 2026-05-20 | `i-week-view-phase2a-2026-05-20` | I Phase 2a (intent rows + repeat-week) |
| 2026-05-19 | `n6-multipace-export-2026-05-19` | Coach-only multi-pace print |

Full history is in `MEMORY.md` index.
