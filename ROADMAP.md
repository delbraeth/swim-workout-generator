# Setforge Roadmap

Live at https://setforge.io. Single source of truth — supersedes any scattered "open follow-ups" in v1.x checkpoint memos.

Last refreshed: **2026-05-22** (post view-as-v1 deploy)

## How this file works

- **Now** = something is actively in progress this session.
- **Next** = small, scoped, ready to start. Pick one and ship.
- **Bigger threads** = needs a planning session (locked decisions / scope spec) before any coding.
- **Backlog** = captured, not prioritized. Don't dig here until Next is empty.
- **Closed/declined** = recorded so we don't relitigate.

Memos in `/Users/cassidy/Library/Application Support/Claude/.../memory/` are the per-feature checkpoints. This file is the index of what's left.

---

## Now

_Nothing in progress as of 2026-05-22._

## Next (small, ready)

_Empty as of 2026-05-22. Pick from Bigger threads or Backlog for the next session._

## Bigger threads (need a planning session)

- **Pricing implementation** — spec locked in repo `PRICING.md`. Four-tier Patreon (Free / Supporter $3 / Coach $10 / Program $25). Coaches pay, swimmers free. Trigger: first paying pilot. Source: [[swim-generator-pricing-direction]]
- **Bank fallback rate reduction** — engine still falls back to bank in ~17% of (type × section × budget) combos. Engine-tuning project: more templates, better stroke coverage, or relaxed budget gates. Unbounded scope until measured. Source: [[swim-generator-disfavor-v12]] §"Open follow-ups"
- **View-as v3: true impersonation with support_role gate** — admin or support_role-flagged user impersonates a specific other user, sees their actual data. NOT v1's role-flag override — server proxies the session as the target user. Requires: new `support_role` boolean (NOT just `is_admin`), server-side impersonation header check on every authenticated route, audit log every impersonated request, time-limited tokens, ToS update, persistent "Acting as X" banner. ~8-12h plus privacy review. Source: [[swim-generator-view-as-v1]] §Open follow-up

## Backlog (captured, low priority)

- **Per-type disfavor mode** — split v1.8's single toggle into bank/engine/sets columns. Advanced-user. Source: [[swim-generator-hard-exclude-v18]]
- **Hard-include `favorite_mode`** — mirror of v1.8 hard-exclude. Cap'n flagged as likely overkill given 3× weight. Skip unless asked. Source: [[swim-generator-favorites-panel-v12]]
- **Validator V5 + V7** — V5 needs mix-pill context (mix shipped; V5 still unwired). V7 only relevant if a future template uses cross-rep descending intervals (none do today). Source: [[swim-generator-template-engine-s25]]
- **Recovery-mode behavior gap** — validated as real but mild (15/200 workouts <1800yd; rest land near max). Picker still favors larger options when budget allows. Not a bug, considered for tuning. Source: [[swim-generator-bank-review-todo]] §Status
- **iOS native** — paused 2026-05-18, not declined. `/api/auth/native` stays live for TestFlight users. No new iOS features. Source: [[swim-generator-ios-paused]]
- **View-as v2: persona simulation** — extend view-as v1 (role-flag override) to also filter App state so admin viewing-as-solo doesn't see their own groups/lane plans. ~5-7h, 30-40 site touches. True "what does a new user see?" preview. Lower priority than v3 (real impersonation) which gives more bug coverage. Source: [[swim-generator-view-as-v1]] §Open follow-up

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
