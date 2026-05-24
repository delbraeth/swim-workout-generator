# Setforge Roadmap

Live at https://setforge.io. Single source of truth — supersedes any scattered "open follow-ups" in v1.x checkpoint memos.

Last refreshed: **2026-05-23** (post Reporting v1 COMPLETE — Phase F closure)

## How this file works

- **Now** = something is actively in progress this session.
- **Next** = small, scoped, ready to start. Pick one and ship.
- **Bigger threads** = needs a planning session (locked decisions / scope spec) before any coding.
- **Backlog** = captured, not prioritized. Don't dig here until Next is empty.
- **Closed/declined** = recorded so we don't relitigate.

Memos in `/Users/cassidy/Library/Application Support/Claude/.../memory/` are the per-feature checkpoints. This file is the index of what's left.

---

## Now

_Nothing in progress as of 2026-05-23._

## Next (small, ready)

_Empty. Pick from Bigger threads or wait for a new rough edge._

## Bigger threads (need a planning session)

- **Reporting engine v1** — ✅ COMPLETE 2026-05-23. All 6 phases (A-F) shipped in one day. 6 reports across 3 audiences (coach-self / solo / admin) + Print/PDF + Markdown export. Tag `reporting-v1-complete` after Cap'n's live-exercise pass. v1.1 deferred punch list (charts, true bank-reduction calc, R5/R6 PDF, etc.) lives in [[swim-generator-reporting-v1-complete]]. Source: [[swim-generator-reporting-scope]]
- **Pricing implementation** — spec locked in repo `PRICING.md`. Four-tier Patreon (Free / Supporter $3 / Coach $10 / Program $25). Coaches pay, swimmers free. Trigger: first paying pilot. Source: [[swim-generator-pricing-direction]]
- **Sprint/fly main templates for large budgets** — residual fallback after slice-1 (~4.4% overall) is concentrated in sprint mains ≥1200yd and fly mains ≥1000yd. Both fail validator due to "no rep > 100yd" + budget packing. Real coaches may not program these (so current behavior could be correct). Defer until coach pilot reports a problem. Source: [[swim-generator-fallback-tuning-drill-v1]]
- **Coach-authored workout sets (UGC into engine)** — captured 2026-05-23. NEEDS A SCOPE SESSION. Cap'n wants a workflow where coaches create / generate / suggest workouts in a format the engine can ingest as picker candidates (alongside today's hardcoded bank + engine templates). Two interlocking dimensions:
  - **Authoring model**: form-based create? full payload upload? snapshot from a generated workout the coach liked? "Suggest" implies some approval/review step — confirm whether that's a moderation queue or just a tier above private.
  - **Ownership + sharing tiers**: per Cap'n — `private` (just me) / `team` (my coached teams or groups?) / `public` (entire SetForge community, needs moderation). Each tier needs auth + visibility rules in the picker.
  - **Engine integration**: how do user-authored sets get weighted vs. hardcoded bank/engine output? Inherit fav/disfav system? Get their own propagation? Risk: a coach's bad set spreads via "team" tier and pollutes their swimmers.
  - **Overlaps with existing systems**: favorites already let a coach bias the picker (3× weight on items they like). UGC sets are stronger — they ADD new options, not just reweight existing ones. Worth deciding if UGC sets just go into the bank with an `author_sub` column, or live in a parallel `user_sets` table.
  - Trigger: confirm demand from coach pilot OR plan it as part of the broader catalog evolution. Probably 20-40h all in. Source: chat 2026-05-23.

## Backlog (captured, low priority)

- **Per-type disfavor mode** — split v1.8's single toggle into bank/engine/sets columns. Advanced-user. Source: [[swim-generator-hard-exclude-v18]]
- **Hard-include `favorite_mode`** — mirror of v1.8 hard-exclude. Cap'n flagged as likely overkill given 3× weight. Skip unless asked. Source: [[swim-generator-favorites-panel-v12]]
- **Validator V5 + V7** — V5 needs mix-pill context (mix shipped; V5 still unwired). V7 only relevant if a future template uses cross-rep descending intervals (none do today). Source: [[swim-generator-template-engine-s25]]
- **Recovery-mode behavior gap** — validated as real but mild (15/200 workouts <1800yd; rest land near max). Picker still favors larger options when budget allows. Not a bug, considered for tuning. Source: [[swim-generator-bank-review-todo]] §Status
- **iOS native** — paused 2026-05-18, not declined. `/api/auth/native` stays live for TestFlight users. No new iOS features. Source: [[swim-generator-ios-paused]]
- **View-as v2: persona simulation** — extend view-as v1 (role-flag override) to also filter App state so admin viewing-as-solo doesn't see their own groups/lane plans. ~5-7h, 30-40 site touches. True "what does a new user see?" preview. Lower priority than v3 (real impersonation) which gives more bug coverage. Source: [[swim-generator-view-as-v1]] §Open follow-up
- **Tier-aware rate limits** — captured 2026-05-23 after writeLimiter bump. Today writeLimiter is a flat 100/min/(userSub+IP) for everyone (admins exempt via ADMIN_SUBS). Once pricing ships ([[swim-generator-pricing-direction]]: Free / Supporter $3 / Coach $10 / Program $25), the limit should scale with tier — paid tiers get more headroom. Sketch: lookup tier on auth (could cache in `req.tier_limit`), pass as `limit` callback to express-rate-limit. Trivial once paid_tier column exists; meaningless before pricing. Defer until pricing implementation lands.
- **Discord server for user feedback + community** — captured 2026-05-23. Cap'n wants to design a Discord setup as a feedback + discussion channel for SetForge users (coaches, swimmers, parents). NEEDS A DESIGN PASS before any creation. Decisions to lock: which channels (#general / #coach-corner / #feature-requests / #bug-reports / #pace-clock-help / #showcase / etc.); moderation model (admin-only? trusted-coach mods? automod?); how users discover/join (link in manual? in-app banner? sign-in page?); whether to hook the existing /api/feedback endpoint to a Discord webhook for cross-posting; privacy/age considerations (some swimmers are minors — does Discord's 13+ ToS conflict?); should bug reports get auto-routed to a private channel for triage. Trigger: once coach pilots are live and need somewhere to converge. Probably ~3-5h to draft a SCOPE doc + ~1-2h to actually spin up the server. Source: chat 2026-05-23.
- **Deploy workflow: git lock-file recovery** — captured 2026-05-23. When Claude commits from its sandbox, leftover `.git/index.lock` and `.git/HEAD.lock` files frequently linger because the sandbox can't `unlink()` them (permission denied on the FUSE mount). This blocks the next commit attempt and forces a manual "rm -f .git/*.lock" from Cap'n's terminal before retrying. Hit it three times in the 2026-05-23 session. Fix options: (a) Claude's pre-commit step runs `rm -f` and falls back to hand-off-with-clear-instructions when the rm fails (degrades gracefully); (b) investigate sandbox permission model to see if there's a way to allow unlink on the user's files; (c) move commits entirely to Cap'n's terminal (back to the original workflow). Option (a) is the pragmatic incremental fix. Tooling/DX only, not product-facing.
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
