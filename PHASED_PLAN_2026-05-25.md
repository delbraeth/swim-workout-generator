# SetForge phased plan — hobby → mature application

**Status:** locked 2026-05-25 by Cap'n. Supersedes ad-hoc Bigger Threads triage in ROADMAP.md.
**Origin:** PM staff agent (per `TEAM.md` roster) synthesized across the three eval archives, IDENTITY_SCOPE, PRICING, RELATIONSHIPS_SCOPE, VISUAL_PROFESSIONALIZATION audit, and existing scope docs. Cap'n locked seven foundational decisions in a multi-question round; PM's deferral recommendation on Discord was overridden with documented reasoning (community + feedback loop value > maintenance cost).
**Why this doc exists:** the next 4–6 months of SetForge work map to four named phases with explicit exit criteria. Everything else either fits into a phase or is permanently deferred. The roadmap is now a tool for saying NO as much as YES.

---

## 1. End-game (locked)

**SetForge is the best workout-programming tool for the working coach of 1–30 swimmers — sold to coaches at $10/mo, free to their swimmers forever, with a credible $300/yr team SKU for clubs that can show a board.**

Concrete shape at end-game: ~50–200 paying coaches across HS / Masters / Private-Lesson / small Club; self-serve signup with Google + Apple OAuth + real marketing site; vendor paper kit good enough for a 501(c)(3) treasurer to sign same-day; outbound email infrastructure carrying parent recaps + transactional notices + re-engagement; identity model that supports parents, tombstoning, and basic compliance (MAAP-shaped, COPPA-respecting); persistent stickiness loop (per-swimmer constraints + meet-anchored season); Discord community as the qualitative feedback loop.

**Explicitly NOT in end-game:** TeamUnify replacement · meet-management system · TrainingPeaks-grade analytics · hardware-tethered product · youth-fitness consumer app · iOS-native app · anything requiring Cap'n to quit his day job.

## 2. Locked decisions (2026-05-25)

| # | Decision | Cap'n's call |
|---|---|---|
| 1 | End-game segment | **PM frame confirmed** — HS / Masters / Private / small Club. Concede Summer-League, Triathlon, full-periodization Club |
| 2 | First paying pilot | **Specific candidate exists** (identity held; segment = HS) |
| 3 | Pilot segment | **HS coach** — Phase 3 priority pegs to HS persona's top-3 (meet-anchored taper cheap version + HS race templates + per-swimmer constraints) |
| 4 | Founder bio / About | **Full** — name, photo, honest hobby→product arc |
| 5 | Continuity commitment | **All four:** 90-day shutdown notice + JSON export on shutdown + published migration scripts + open-source codebase on shutdown |
| 6 | Time budget | **4–6 month cadence** (PM's default; matches current shipping pace) |
| 7 | Discord | **Stays in Now** (PM recommended defer; Cap'n overrode — Discord is the feedback loop + community channel, not a maintenance overhead) |

The continuity commitment (#5) is the strongest possible promise a solo operator can make. It substantively closes the Treasurer + Lifecycle persona blockers from the team eval — once published in the vendor paper kit, the "single-operator key-person risk" is materially mitigated, not just hedged.

## 3. Phased plan

Each phase is **outcome-named** (what's true at the end), not work-named. Sequenced by what unlocks what, not what's easy.

### Phase 1 — "A cold prospect can find, evaluate, and trust SetForge" (~4 weeks, ~25–35h)

**Goal:** stop the bleeding at the top of the funnel. No engine work.

**Scope:**
- **Marketing quick-wins bundle:** OG/Twitter meta + 1200×630 social PNG · fix `theme-color` (literal hex `#0f172a`) · real sign-in screen with value prop + screenshot · `hello@setforge.io` forward · unify forked design tokens across 4 HTML files
- **New static routes** rendered from existing content: `/` signed-out marketing landing · `/pricing` (from PRICING.md, leading with ToS-bound free-tier permanence) · `/about` (full founder bio + photo + honest arc) · `/changelog` (curated highlights, not auto-from-tags) · `/security` (re-packaged from privacy.html)
- **Sub-processor list page** (Spaceship · Apple · Google planned · Resend planned)
- **Draft softened ToS/privacy language** in a branch — do NOT ship; pegged to first-billing-fires threshold
- **Accessibility floor sprint:** aria-labels on ~30 icon-only buttons · `<main>`/`<nav>` landmarks · bump `--color-text-dim` to AA-compliant contrast
- **Discord setup** (overrode PM's defer; per DISCORD_SCOPE.md): server creation + 7 channels + automod + `hello@setforge.io` invite, treated as feedback channel from day-one Phase 1 prospects

**Exit:** a coach who got the URL from a friend can read what SetForge is, what it costs, who made it, and request an invite. Lighthouse a11y ≥ 90. Discord exists as a place for early users to be findable.

**Cut from scope (defer to Phase 4):** type/spacing scale refactor · form-primitive sweep · mobile-nav redesign · light theme

### Phase 2 — "An Android parent and a non-Apple coach can sign up; we can email them" (~3 weeks, ~15–20h)

**Goal:** unblock everything downstream that touches a non-coach human.

**Scope:**
- **Google OAuth** (server + client). Apple stays primary. Native Google route on `/api/auth/native` follows iOS pattern; don't expand iOS scope.
- **Outbound email infrastructure:** Resend or Postmark provider · transactional template · queue · one initial template (account email confirmation) · audit/observability
- **Discord webhook wiring** (from DISCORD_SCOPE.md §6): `/api/feedback` → `#feedback-stream` private channel with display-name + workout-context payload, minor-bypass active

**Exit:** signup works on Android. `/api/email/send` exists, sends, logs. Discord receives transactional feedback. No product features yet rely on email/Google; the rails are in place.

**Cut from scope (depends on Phase 3+):** parent magic-link UX · parent portal screens · MAAP coach-CC · Lesson tier recap export

### Phase 3 — "First paying HS coach can sign, pay, and stick" (~4–6 weeks, ~30–40h)

**Goal:** convert the specific HS-coach pilot Cap'n has in mind. Every Phase 3 deliverable lets that pilot say YES.

**HS-specific priority:**
- **Per-swimmer constraint vector** (triple-cross-validated; biggest stickiness lever for HS rosters)
- **Meet-anchored taper — cheap version only:** "X weeks until event Y → suggest phase Z." NO macrocycle, NO auto-shift dashboards. ~4–6h, not 20h.
- (HS race-pace template pack moves to Phase 5 — Coach eval flagged but not in pilot's stated blockers; revisit after first pilot's actual feedback)

**Universal Phase 3:**
- **Vendor paper kit** (non-engineering, parallel track): services agreement template · DPA addendum · W-9 · EIN-bearing invoice mechanism (Stripe Invoicing) · 90-day shutdown/export clause · sub-processor list (already shipped Phase 1) · breach SLA · written continuity commitment (all 4 components per locked decision #5)
- **Billing thin slice:** Patreon webhook + tier-on-user + one feature-gate middleware that today gates nothing. Stripe Invoicing as the Program-tier path.
- **ToS/Privacy softening ships** the moment first invoice fires (drafted in Phase 1)

**Exit:** Cap'n can sign the named HS pilot to $10/mo with paper a school district would accept; pilot's first-30-days experience is meaningfully better than today (constraints + meet anchor active). Open-source-on-shutdown commitment published.

**Cut from scope (defer to Phase 4 or Phase 5):** Lesson tier features · parent portal · full periodization · leaderboards · TP/Garmin export · R5/R6 charts · swimmer dashboard

### Phase 4 — "The product earns its team-tier price and survives founder absence" (~6–8 weeks, ~40–55h)

**Goal:** turn Program tier from billing chrome into a real SKU; close the lifecycle/continuity gaps a board fiduciary requires.

**Scope:**
- **Identity refactor (IDENTITY_SCOPE I-A through I-G):** persons table · name split (first/last/preferred) · guardians as first-class · tombstone-on-delete. ~19h + admin review.
- **Self-serve full-account JSON export** (bundled with I-G; satisfies continuity commitment #2)
- **Team-level curation tier + Team Settings page** (team_favorites / team_disfavorites · role-gated defaults · this is what makes Program tier a product)
- **Ownership transfer + UGC reassignment on departure**
- **Parent portal MVP** — read-only weekly digest email + one screen (now possible because Phase 2 email + Phase 4 identity ship)

**Exit:** Treasurer + Lifecycle blockers from team eval are answerable. Cap'n can pitch Program tier honestly. A club can leave with their data.

**Cut from scope (defer to Phase 5):** MAAP pack (depends on this + real pilot asking) · Lesson tier (depends on identity + email + parent recap export)

### Phase 5 — "Adjacent segments + retention deepening" (trigger-driven, no schedule)

Triggered only by pilot demand or revenue. Items: Lesson tier (depends on Phase 4 identity) · swimmer progress dashboard · MAAP pack · HS race-pace template pack · one-way CSV/.ics export · beginner content tier if Summer-League is ever revisited (unlikely per decision #1).

## 4. Permanently CUT or DEFERRED

The roadmap as NO. Each is a real option being explicitly killed.

1. **Tier-aware rate limits** — flat limit + ADMIN_SUBS skip is fine forever at projected scale. **CUT.**
2. **Per-type disfavor mode · hard-include `favorite_mode` · Validator V5/V7 · Recovery-mode tuning · Sprint/fly templates at large budgets** — perfectionism with no eval signal. **CUT.**
3. **"Passcodes" auth path beyond Apple+Google** — Google OAuth (Phase 2) resolves the friction. Revisit only if a future pilot still can't sign in. **DEFER permanently.**
4. **iOS native re-expansion** — keep paused. Existing TestFlight users keep `/api/auth/native`. **DEFER permanently.**
5. **Full periodization / macrocycle / dashboards** (Club coach's full ask) — out of end-game. Concede the segment that wants Commit Swimming / MyCoach. **CUT.**
6. **TrainingPeaks / Garmin export · TM/Meet Manager · SWIMS · .hy3 / .fit / .tcx** — out of end-game. CSV/.ics one-way may earn a Phase 5 slot; nothing more. **DEFER permanently.**
7. **Beginner / Learn-to-Swim content tier** — concede Summer-League segment. Document as out-of-scope in PRICING.md. **CUT.**
8. **Supporter $3 as a product tier** — already demoted to tip jar; remove from pricing page entirely. Add later if asked. **CUT.**

## 5. Critical path + dependencies

```
Phase 1 (marketing/static + Discord) ──┐
                                       ├── (parallel, independent)
Phase 2 (Google OAuth + email infra) ──┐
                                       ├── Parent portal MVP (Phase 4)
                                       ├── Parent magic-link (Phase 4 / I-E)
                                       ├── MAAP coach-CC (Phase 5)
                                       ├── Lesson recap export (Phase 5)
                                       ├── Re-engagement nudges (Phase 5)
                                       └── Discord webhook notifs (Phase 2)

Phase 3 (paper kit + per-swimmer constraints + meet anchor + billing) — depends ONLY on Phase 1

Phase 4 (identity → tombstone+export → team curation → ownership transfer → parent portal)
  ├── I-A..I-D unblock I-E (parent backfill), which needs Phase 2 email
  ├── Tombstone (I-G) bundles with JSON export
  └── Team-level curation can ship before/after identity; independent
```

**Critical path:** Phase 1 → Phase 2 → Phase 3. Phase 4 can start in parallel with Phase 3 if Cap'n has energy (identity I-A..I-D are non-blocking refactors).

**Foundational unlocks (do early or block forever):** outbound email · Google OAuth · vendor paper kit. First two are Phase 2; third is Phase 3 parallel non-engineering work.

## 6. Risks + mitigations

1. **Pilot conversion timing vs. feature completeness** — Phase 3 ships before parent portal, before team curation, before Lesson tier. Mitigation: pilot is named HS coach; Phase 3 features ARE that pilot's blockers (per Coach eval HS persona top-3). Risk substantially reduced by decision #2.
2. **Single-operator continuity** — already mitigated by decision #5 (all four continuity commitments). Open-source-on-shutdown is the strongest individual promise possible; documented in vendor paper kit, removes the Treasurer blocker.
3. **Scope creep from in-flight evals** — new eval findings go to Phase 5 by default; promotion needs Cap'n decision + equivalent CUT from current phase. This plan = the contract.
4. **Hobby→pro visual threshold** — Phase 1 is literal first month; nothing in Phase 3 fires without it. Discord overrode-defer means Cap'n owes ~3-5h/month of moderation in addition to Phase 1 work.
5. **Discord overhead drift** — Cap'n's override on Discord adds an ongoing ~3-5h/month moderation cost not captured in phase hour estimates. Mitigation: per DISCORD_SCOPE.md §5, mod model is "Cap'n + automod, asynchronous, no SLA in `#welcome` rules." If Discord becomes a time-sink that delays phases, revisit defer call.
6. **Eval-driven over-confidence in cross-validated items** — agents reading docs ≠ paying customers. Ship M-cost versions in Phase 3; verify with the real pilot before scoping fuller versions.

## 7. First-month action list (Monday-morning order)

1. Update ROADMAP.md preamble to point at this plan as the current frame. (15 min)
2. Add OG + Twitter card meta + create a 1200×630 social PNG with SetForge wordmark + tagline. (2h)
3. Fix `theme-color` to literal hex `#0f172a` + add `<meta name="color-scheme" content="dark">`. (15 min)
4. Set up `hello@setforge.io` forward; swap it into privacy.html, terms.html, and footers. (30 min)
5. Build signed-out landing at `/`: hero + 3-bullet value prop + 1 screenshot + "request invite" CTA. (3–4h)
6. Build `/pricing`, `/about` (with photo), `/changelog`, `/security`. (5–6h)
7. Unify the 3 forked design-token files (manual.html, privacy.html, terms.html → use index.html `--color-*`). (1h)
8. Aria-label pass on ~30 icon-only buttons; add `<main>` / `<nav>` landmarks; bump `--color-text-dim` contrast token. (3h)
9. Draft softened ToS/privacy language in a branch. Do NOT ship. (1h)
10. Sub-processor list page (static). (45 min)
11. Discord: create server, set up 7 channels, configure automod, write `#welcome` rules. (30 min — Cap'n)
12. Discord: generate webhook for `#feedback-stream`; add `DISCORD_FEEDBACK_WEBHOOK_URL` to Hyperlift env vars (will be wired in Phase 2). (5 min)

**Total month-1 budget:** ~17–22h engineering + ~1h Discord setup. Leaves headroom for one regression-fix afternoon.

## 8. Open follow-ups

- **Pilot name capture** — Cap'n is holding the HS pilot's identity. When ready, log to memory so Phase 3's exit criteria can be pegged to that specific person's blockers (not just the HS-persona profile).
- **Founder photo** — needed for `/about` page in Phase 1. Cap'n provides; if no current photo works, schedule a quick session.
- **Open-source license choice** — for the open-source-on-shutdown commitment. Common options: MIT (permissive; competitors can fork freely), AGPL (copyleft; protects against closed-source forks), source-available with explicit time-bombed open-source-on-shutdown trigger. Decide before Phase 3's paper kit publishes.
- **Continuity commitment legal language** — draft from a template; check what a small-business attorney would object to. Should be in writing before Phase 3 paper kit publishes.
- **First-pilot timeline** — when does the HS pilot need to sign? Phase 3 exit is the gating event; if pilot date is fixed, plan compresses accordingly.

---

## 9. PM agent — verbatim recommendation (audit trail)

(See chat history 2026-05-25 for the full PM synthesis output. Highlights preserved in §3-§7 above. The single difference between PM's recommendation and this archived plan: PM recommended deferring Discord; Cap'n overrode with documented reasoning. Otherwise this plan = PM's structure with the seven locked decisions filled in.)

---

*Generated 2026-05-25 by PM staff agent per `TEAM.md` roster. Decisions locked by Cap'n in 7-question AskUserQuestion round same day. See memory `swim_generator_phased_plan_2026_05_25.md` for archive pointer.*
