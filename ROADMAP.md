# Setforge Roadmap

Live at https://setforge.io. Single source of truth — supersedes any scattered "open follow-ups" in v1.x checkpoint memos.

Last refreshed: **2026-05-22** (post v1.13 favorites-prop deploy)

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

- **regenerateSection set-level weights** — `regenerateSection` doesn't accept `favoriteSetIds` / `disfavorSetIds` / `engineFavorites` per-set, so per-set weight logic only fires on full generate. Inherited gap since v1.5/v1.10; v1.13 added a comment at the call site. ~45min. Source: [[swim-generator-favorites-prop-v13]]
- **Show set IDs in catalog view** — wire the v1.6 cycling button into catalog rows so users can fav/disfavor sets without first generating a workout. ~45min. Source: [[swim-generator-set-status-button-v16]]
- **Periodic refresh of effective fav + disfavor** — currently mount-only; coach updates while a swimmer is logged in go stale until next page load. Cheapest: poll every 5min. ~30min. Source: [[swim-generator-coach-propagation-v17]] [[swim-generator-favorites-prop-v13]]
- **Phase 4 rebrand cleanup** — CSS refactor + favicons deferred from the rebrand ship. Source: [[swim-generator-rebrand-shipped]]

## Bigger threads (need a planning session)

- **Pricing implementation** — spec locked in repo `PRICING.md`. Four-tier Patreon (Free / Supporter $3 / Coach $10 / Program $25). Coaches pay, swimmers free. Trigger: first paying pilot. Source: [[swim-generator-pricing-direction]]
- **Coach "see how my fav/disfavor is rolling out" view** — group-impact dashboard. Symmetric for fav and disfavor sides. Needs scope. Source: [[swim-generator-coach-propagation-v17]] [[swim-generator-favorites-prop-v13]]
- **Bank label backfill** — outstanding from catalog Phase II. ~216 option slots, ~85-90 unique labels. Source: [[swim-generator-catalog-plan]] §"Pending: label backfill"
- **Bank fallback rate reduction** — engine still falls back to bank in ~17% of (type × section × budget) combos. Engine-tuning project: more templates, better stroke coverage, or relaxed budget gates. Unbounded scope until measured. Source: [[swim-generator-disfavor-v12]] §"Open follow-ups"
- **Multi-lane multi-pace workout request function** — coach sets up N lanes with per-lane pace, generates ONE workout, prints wall-sheet with one column per lane. Partially shipped via N6 multi-pace export, but the "generate one workout that all lanes do simultaneously" piece is the unfinished half. Source: [[swim-generator-catalog-plan]] §"Future architecture concerns"

## Backlog (captured, low priority)

- **Per-type disfavor mode** — split v1.8's single toggle into bank/engine/sets columns. Advanced-user. Source: [[swim-generator-hard-exclude-v18]]
- **Hard-include `favorite_mode`** — mirror of v1.8 hard-exclude. Cap'n flagged as likely overkill given 3× weight. Skip unless asked. Source: [[swim-generator-favorites-panel-v12]]
- **Validator V5 + V7** — V5 needs mix-pill context (mix shipped; V5 still unwired). V7 only relevant if a future template uses cross-rep descending intervals (none do today). Source: [[swim-generator-template-engine-s25]]
- **Recovery-mode behavior gap** — validated as real but mild (15/200 workouts <1800yd; rest land near max). Picker still favors larger options when budget allows. Not a bug, considered for tuning. Source: [[swim-generator-bank-review-todo]] §Status
- **iOS native** — paused 2026-05-18, not declined. `/api/auth/native` stays live for TestFlight users. No new iOS features. Source: [[swim-generator-ios-paused]]

## Closed / Declined (do not relitigate)

- **In-app bank editing (catalog Phase III)** — declined 2026-05-15. Local-deploy clobber problem. Feedback loop via Phase II 🚩 flag is the iteration mechanism. Source: [[swim-generator-catalog-plan]]
- **In-app bank label quality iteration** — declined 2026-05-15. Same architecture reason as Phase III. Source: [[swim-generator-catalog-plan]]
- **Watch companion (iOS)** — formally declined. Source: [[swim-generator-ios-paused]]
- **Password/email auth** — never. OAuth-only (Apple + Google planned). Source: [[feedback-no-password-auth]]

## Recently shipped (last ~10 days, for context)

Reverse-chronological. Each is a memo in the memory directory.

| Date | Tag | What |
|---|---|---|
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
