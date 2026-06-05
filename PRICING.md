# SetForge pricing

**Status:** workshop locked 2026-05-19 (original 4-tier model). **Revised 2026-05-25** after the three-eval sweep (coach + swimmer + team). **Consolidated 2026-06-04** — progression model, Coach↔Team line, free MAAP assistant seat, coach-seat bands, per-team billing, per-season passes, platform audit, and the tier×feature chart all locked into **§1A below (current source of truth).** Lesson tier is now **BUILT & live (web).** Implementation trigger for the rest: **first paying pilot.**
**Origin:** initial direction captured 2026-05-18 ("free today, Patreon-tiered later"). Workshop 2026-05-19. Doc reconstructed from memory checkpoint [[swim-generator-pricing-direction]] on 2026-05-25 after evaluation sweep flagged the source doc was missing from disk. Eval-driven revisions captured in §6.
**Why this doc exists:** to lock the tier model + commitments before any billing code or marketing surface ships, so downstream decisions (ToS, Privacy Policy, landing page, feature gating) have one source of truth.

---

## 1. Tier model (revised 2026-05-25)

Three paid tiers + free baseline. **Supporter $3 demoted from product tier to "buy Cap'n a coffee" tip-jar** per three-eval sweep finding (no signal as a product tier, weak signal as paid). **Lesson tier added** per coach evaluation top-5 (real demand, distinct from Coach tier).

| Tier | Price | Audience | Status |
|---|---|---|---|
| **Free** | $0 | All swimmers, all parents, exploratory coaches | Always live |
| **Tip jar** | $3 (one-time or recurring, no feature unlock) | "I like this, take my money" | Replaces Supporter $3; not advertised as a tier |
| **Coach** | **$9.99/mo** | Single coach + up to 2 free MAAP assistants | Original tier; price charm-locked 2026-06-04 |
| **Lesson** | **$4.99/mo** (~$49.99/yr) | Private/individual lesson coaches | ✅ **BUILT & live (web), 2026-06-04** — additive tier; see `LESSON_TIER_SCOPE.md` + §1A |
| **Program** | **from $24.99/mo** (per-team; **bands + per-season — see §1A ladder**) | Organizations with multiple coaches | Reframed 2026-06-04: multi-coach is the line; per-team billing + seat bands. **Still gated on team-level features shipping** (see §1A FUTURE) |
| **Institutional / Program+** | TBD (~$1–2k/yr) | Boards requiring cyber insurance + signed MSA/DPA + formal procurement | NEW (2026-06-03) — the **home for board-gated compliance costs**: priced to cover the cyber-insurance premium + lawyer pass + procurement time, so those are passed through, never absorbed into a standard Program plan (a ~$1k/yr policy ≈ 4× a Program·Small annual). |

## 1A. Tier model — 2026-06-04 consolidation (CURRENT source of truth)

Supersedes §1 where they conflict. The §1 table + per-tier lists below remain accurate for Free/Lesson/Coach features; this section refines the **Coach↔Program(Team) line, multi-coach safety, seat bands, billing entity, season pricing, and platform.**

### The ladder + progression principle
`Free (swimmer) → Lesson ($4.99, private instructor) → Coach ($9.99, single coach outside an org) → Program (organization, multi-coach; banded)`. A user **progresses up the ladder with NO DATA LOSS** — `users.tier` is one column; raising it only *unlocks*. The one transition with data semantics (solo Coach → Team: private roster/sets becoming *shared*) is **sharing, not moving** — primitives already exist (`coach_managed_swimmers.team_id`, UGC `visibility:team` + team curation, `team_coaches` roles, ownership transfer). A one-click "promote my solo setup to a team" flow is FUTURE; the data model already favors it.

### The Coach↔Team line = MULTI-COACH (not "has teams")
- **Coach** = a **single operating coach** outside an org. Owns their athletes, curation, reports. May organize athletes into solo groups.
- **Program / "Team"** = an **organization with multiple *authoring* coaches** sharing athletes, + team communication, team admin, org-level reports, priority support.
- The differentiator is **a second *full* coach + shared authoring/admin/comms** — NOT merely "a second adult exists" (see safety rule next).
- ⚠️ **Re-tiering note (OPEN):** multi-coach surfaces (`team_coaches`, co-coach invite, ownership transfer, team curation) are currently gated on `is_coach` — i.e., available at Coach today. Lean **(b): gate only NEW collaboration surfaces** (co-coach *invite*, team comms, org reports) behind Program; let Coach still organize solo; **grandfather** existing users. Not yet implemented.

### Free MAAP assistant seat — safety is NEVER paywalled
USA Swimming **MAAP / Safe Sport two-deep leadership** (and no-one-on-one) *requires* ≥2 screened adults with a minor group. **We will not put the safety-required second adult behind a paywall** — that would financially nudge a budget HS team toward a policy violation.
- **Coach tier includes a free, *limited* assistant seat** (role `assistant` — already in `GROUP_COACH_ROLES`). Capabilities: **view roster, view practices/schedule/assigned, take attendance, add coach notes (co-supervise)**. NOT: author/assign workouts, curation, roster edits, team admin, invite coaches, billing.
- A **small HS team (head + assistant) = Coach tier** (with the free assistant seat) — compliant, no upsell on safety. **Team tier is for when the *operation* grows** (multiple authoring coaches / 3rd adult / org features), not when the 2nd adult appears.
- Upgrading to **Team promotes assistants to full authoring coaches** + unlocks comms/admin/org reports.
- **Soft-enforce:** nudge "add a second adult (recommended — MAAP two-deep)" on minor groups; never gate it. Cap free assistant seats at Coach (**2**) so it's the safety minimum, not free staff.

### Team (Program) seat bands — by number of FULL coaches
| Band | Full coaches | Notes |
|---|---|---|
| Small | 2–4 | |
| Medium | 5–9 | |
| Large | 10+ | dedicated support / SLA |

- **Assistants don't count** toward the band — safety staffing never inflates the bill. 1 head + free assistant = 1 full coach = **Coach** (not Team).
- **Flat price per band** ("up to N coaches"), not per-seat. Adding a coach past the cap → soft prompt to the next band (count = active `team_coaches` rows). Never disable an existing coach.
- **Don't gate *coaching* by band** — all bands get the full toolset. What **scales S→M→L: support** (standard→priority→dedicated) **and reporting depth** (per-team → org/cross-team → + export). What else scales is OPEN (athlete caps? probably none).

### Billing entity — Team is per-TEAM, not per-user
- Free / Lesson / Coach = **per-user** subscriptions (each person pays their own `users.tier`).
- **Team/Program = a per-*team* subscription** (the org owns the plan; coaches are seats). A coach's **effective tier = max(own `users.tier`, the tier of any team they're a seat in)** — so a free-tier assistant added to a Team gets Team access *through the team*, without personally paying.
- Implementation: a `team_subscriptions` concept (plan + Stripe customer + band on the `teams` row; band derived from active coach count). This is the one real **re-architecture** the model implies. FUTURE.

### Per-season pricing — HS & summer teams
Seasonal operations shouldn't pay 12 months. Detected via `team_type` (`high_school`, `summer` → season pass eligible; `club`, `masters` → year-round).
- **Season pass = a fixed-window grant** (HS ~4 mo / summer ~3 mo). **Price = (monthly × months) − $5** flat seasonal discount, charm-rounded — always cheaper than paying monthly across the season. Available at **both Coach and Team** for HS/summer contexts (a solo HS coach gets a Coach season pass too).
- **Off-season = data preserved + read-only.** Roster, history, sets, groups all persist and stay viewable; full coaching pauses until renewal — next season picks up with zero re-entry (same "no data loss" rule).
- Mechanics: timed grant via `tier_granted_at` expiry (Stripe fixed-term schedule or one-time pass that auto-reverts to free, data retained). FUTURE build.

### Platform — web-first, then iOS parity
New features ship to the **web app first**; iOS follows in a later build. Audited 2026-06-04:
- **Universal** (iOS view exists): generator (types, equipment, phase, recovery, multi-lane, generate-for), History, Run mode, Assigned-to-me, Practices + attendance, Coach notes, Profile/subscription.
- **Web-only** (no iOS yet): Teams, Catalog, My Sets/UGC authoring, Reports, Progress dashboard, Goals, managed-swimmer roster, **all Lesson-tier surfaces** (lesson type, groups, per-swimmer equipment, parent recap, lesson-set authoring).

### Tier × feature comparison chart (working draft → for the manual)
✓ = included · — = not · Platform = Universal (web+iOS) / Web (web-only). Program(Team) band-scaled rows at the bottom.

| Feature | Free | Lesson | Coach | Program/Team | Platform |
|---|:--:|:--:|:--:|:--:|---|
| Workout generator (9 types) | ✓ | ✓ | ✓ | ✓ | Universal |
| History + stats · Run mode | ✓ | ✓ | ✓ | ✓ | Universal |
| Goals · Progress dashboard | ✓ | ✓ | ✓ | ✓ | Web |
| Account + subscription | ✓ | ✓ | ✓ | ✓ | Universal |
| Lesson workout type | — | ✓ | ✓ | ✓ | Web |
| Managed swimmers · lesson groups | — | ✓ | ✓ | ✓ | Web |
| Per-swimmer equipment · parent recap | — | ✓ | ✓ | ✓ | Web |
| Author lesson sets (My Sets, leveled) | — | ✓ | ✓ | ✓ | Web |
| Individual / group assignment | — | ✓ | ✓ | ✓ | Web (lesson) · Universal (coach groups) |
| Catalog browse · UGC team-share/public | — | — | ✓ | ✓ | Web |
| Team curation (fav/disfavor propagation) | — | — | ✓ | ✓ | Web |
| Reports | — | — | ✓ | ✓ | Web |
| Practices + attendance · coach notes | — | — | ✓ | ✓ | Universal |
| Lane plans · multi-lane generate | — | — | ✓ | ✓ | Universal |
| Meet anchors / taper | — | — | ✓ | ✓ | Web |
| Free assistant seat (limited, MAAP) | — | — | ✓ (2) | ✓ | Web |
| **Multiple full coaches** (invite, shared authoring) | — | — | — | ✓ | Web |
| **Team communication** | — | — | — | ✓ (FUTURE build) | — |
| **Org / cross-team reports + export** | — | — | — | ✓ (FUTURE) | Web |
| Coaches on shared roster | 1 | 1 | 1 (+free asst) | **2–4 / 5–9 / 10+** | — |
| Support | community | community | standard | **standard / priority / dedicated** | — |

### BUILT vs FUTURE (as of 2026-06-04)
- **BUILT & live (web):** Free baseline, **Lesson tier (all features)**, Coach features, per-user Stripe billing (Lesson + Coach prices, test mode), admin tier grant, coach-authored leveled lesson sets.
- **FUTURE (this model implies):** per-team billing + `team_subscriptions`, coach-seat bands + enforcement, the Coach→Team re-tiering (option b), free-assistant-seat capability gating + cap, **team communication** (net-new — no messaging today), org/cross-team reports + export, per-season passes, the solo→team "promote" flow, iOS parity.

### Price ladder — LOCKED 2026-06-04 (charm pricing; supersedes any older $ in this doc)
| Tier / band | Coaches | Monthly | Annual (~2 mo free) | Season pass (HS ~4mo / summer ~3mo) |
|---|---|---|---|---|
| Free | — | $0 | — | — |
| Lesson | 1 (private) | **$4.99** | $49.99 | — |
| Coach | 1 (+2 free assistants) | **$9.99** | $99.99 | $34.99 / $24.99 |
| Program · Small | 2–4 | **$24.99** | $249.99 | $94.99 / $69.99 |
| Program · Medium | 5–9 | **$49.99** | $499.99 | $194.99 / $144.99 |
| Program · Large | 10+ | **$99.99** | $999.99 | custom |
| Institutional | board procurement | — | ~$1–2k custom | — |

Per-coach effective rate dips as the band grows (volume incentive) while staying ≤ the $9.99 Coach anchor: Small $6.25–12.49/coach, Medium $5.55–10, Large ≤$10. Large is **self-serve big-club**; Institutional is **board-procurement-only** (signed MSA/DPA + cyber-insurance pass-through) — distinguished by *process*, not size. Tip jar stays $3 (not a tier).

### Resolved decisions (2026-06-04 — LOCKED)
1. **Name:** **Program** (keep code name); marketed "for teams/clubs with multiple coaches." No collision with the Teams *feature*.
2. **Coach→Program line:** **(b)** — gate only NEW collaboration (co-coach invite, team comms, org reports) behind Program; Coach keeps solo organizing; **existing users grandfathered**.
3. **Free assistant seats at Coach:** **2** (head + up to 2 limited MAAP assistants free; 3rd adult / authoring coach → Program).
4. **Program pricing:** **per-band flat** (table above); only **support + reporting depth** scale S→M→L — coaching tools are NOT metered by team size (no athlete caps).
5. **Band price points:** locked in the table above (charm-priced).

### Free tier — what's in it

Every existing user-facing surface. Specifically:
- Workout generator (full quality, all templates, all banks)
- Run mode + Pace clock
- History + Repeat last week
- Multi-pace + multi-lane (already shipped)
- Per-account fav/disfavor (label, set, engine-template) tri-state
- Solo Reports (R4 Program Recap)
- "Assigned to me" view for assigned swimmers
- Mark-practice-done / completion logging
- UGC consumption (your overlay shows team-shared and public-approved sets)

**ToS-bound permanence:** the v1 free feature set stays free forever. Future paid features can be added; existing free features cannot be moved to a paid tier.

### Coach tier — $9.99/mo

Free tier PLUS:
- UGC authoring (📝 My Sets, snapshot, team-share, public-submit)
- Coach Reports (R1 Programming Mix, R2 Schedule Adherence, R3 Curation Log)
- Multi-lane generate with auto-route to per-lane print
- Coach-level fav/disfav propagation to your swimmers
- Group management (groups, lane plans, assignments, attendance)
- Coach impact panel (curation reach + effectiveness)
- Team membership (as a non-Owner; one team)

### Lesson tier — $4.99/mo (✅ BUILT & live web, 2026-06-04)

For private/individual coaches who don't need full club infrastructure but want more than Free. **Shipped** (web; iOS later):
- Per-managed-swimmer equipment profile (stored on the swimmer, not the coach)
- **Lesson workout type** — 3-section (Warm-Up / **Skill Focus** / Send-off), no "Main Set", **800–1,200 yd** built-in (down to ~100 with coach-authored short content). NB: built as 3 sections + 800 floor, not the spec's "Skill Focus 1/2 / 200yd" — smallest feasible 3-section lesson from reused banks is 800; coach-authored sets unlock genuinely short kids lessons.
- Parent recap export (one-button branded one-pager to the swimmer's guardian)
- Managed swimmer roster + minimal **lesson groups** + individual/group assignment
- **Coach-authored lesson sets** — author leveled content (Beginner/Intermediate/Advanced) tagged `lesson`; "use my sets only" toggle for young/beginner swimmers
- Tier gating + admin grant + web "$4.99/mo" paywall. See `LESSON_TIER_SCOPE.md`.

Resolved: Lesson is **additive** (Coach unchanged; Coach keeps managed swimmers). Lesson surfaces unlock at tier ∈ {lesson, coach, program}.

### Program tier — from $24.99/mo (per-band; see §1A ladder)

> **2026-06-04 reframe — see §1A for the current model:** Program = the **multi-coach / organization** tier (the line is a 2nd *full authoring* coach, not "a 2nd adult" — the safety-required assistant is free at Coach). Billed **per-team** (org owns the plan; coaches are seats; effective tier = max(own, team-seat)), **seat-banded** Small 2–4 / Medium 5–9 / Large 10+, with **per-season passes** for HS/summer. The pre-conditions below still gate launch.

Coach tier × N seats PLUS team-level features that don't yet exist. Per [[swim-generator-team-evaluation-2026-05-25]], **Program tier should not be advertised until these ship:**

1. **Team-level fav/disfav tier** (currently in ROADMAP Bigger Threads) — converts "billing chrome over four Coach accounts" into a team programming platform
2. **Team Settings page** with role-gated defaults (pace baseline, disfavor mode, equipment restrictions, two-deep rule, default note visibility)
3. **Vendor paper kit** (DPA + EIN-bearing invoice + 90-day shutdown/export clause + sub-processor list)
4. **Self-serve full-account JSON export + tombstone-on-delete** (required for board approval regardless of product quality)
5. **Outbound email infrastructure** (required for breach-notification SLA the Treasurer persona surfaced)
6. **Ownership transfer + UGC reassignment on departure** (without it teams orphan on founder-exit)

Quote as an **annual contract** when relaunched (see §1A ladder — e.g. Program Small $249.99/yr; Institutional custom $1–2k) — boards approve annual contracts, not monthly SaaS.

## 2. Coaches pay; swimmers free (the central thesis)

Anchor decision: **swimmers under an active coach are free at the swimmer tier forever.** Coach pays; their assigned swimmers get the swimmer-side feature set at no cost.

**Pricing-thesis verdict from swimmer eval:** *"structurally sound but operationally bleeding."* Free tier is a funnel only for assigned swimmers under an active coach. Solo + Triathlete swimmers drift to MySwimPro/TrainingPeaks within ~60 days. Even assigned swimmers ghost after week 2 without comparison/PR/progress features. The thesis holds *if* coach-assignment is the gravity well, but the swimmer-retention features that maintain it haven't shipped yet (progress dashboard, PR-anchored race-pace, leaderboards). See [[swim-generator-swimmer-evaluation-2026-05-25]] §"Pricing-thesis verdict."

## 3. Billing platform — Patreon

- **Patreon** owns billing, refunds, tax handling
- **Patreon OAuth is for billing-link only**, NOT authentication (SetForge stays Sign-in-with-Apple / Google OAuth-only per [[feedback-no-password-auth]])
- Patreon receipts work as personal expense documentation; **NOT sufficient for 501(c)(3) board approval** (per Treasurer eval) — Program tier needs an EIN-bearing invoice mechanism alongside (Stripe Invoicing or QBO-compatible)

## 4. Implementation trigger

**Don't pre-build billing plumbing.** Trigger is the **first paying pilot** asking. Until then, every paid feature exists in the codebase but unlocked for all coach users. Build order when triggered:

1. Patreon webhook + user-to-tier link
2. Feature-gate middleware reading user tier
3. Gate Coach-tier features behind tier check
4. Vendor paper kit (parallel to engineering — non-engineering work)
5. Program tier features (team curation, etc.) ship per ROADMAP Bigger Threads BEFORE Program tier is advertised

## 5. Admin override system (§6b)

Per the 2026-05-19 workshop: admins can override any user's tier for support reasons (free Coach for a pilot, complimentary Program for a feedback partner, etc.). Mirror of the support_role + impersonation pattern shipped in [[swim-generator-view-as-v3-server]]. Audit-logged.

## 6. Eval-driven revisions (2026-05-25)

Three coach/swimmer/team evaluations changed three things from the 2026-05-19 lock:

| Change | Reason |
|---|---|
| **Supporter $3 demoted to tip jar** | Three-eval sweep found no product-tier signal. Only Solo swimmer mentioned willingness-to-pay at $3, conditional on unlocking specific features. Indefensible as a tier; defensible as a tip jar. |
| **Lesson tier added** | Coach eval top-5: Private coach said Maybe at $10 *only* with per-swimmer equipment OR Lesson type. These are tier-defining features for a distinct audience. Add tier; don't load onto Coach. |
| **Program tier gated on team-curation + paper kit** | Team eval verdict was uniform: Program tier is "billing chrome over four Coach accounts" today. Head Coach: *"I cannot answer 'what does $300/yr buy us vs. four $10 seats' until team-level inheritance exists."* |

What stayed the same: coaches-pay-swimmers-free thesis, ToS-bound free-tier permanence, Patreon as billing platform, Apple/Google OAuth for auth.

## 7. Free-tier ToS commitment

Locked language to put in ToS when billing ships:

> The features available without payment as of the v1 release of SetForge (workout generation, run mode, history, multi-pace, per-account curation, assigned workouts, completion logging) will remain free for individual users for as long as SetForge operates. Future paid features may be added at any tier. We will not move features from the free tier to a paid tier.

## 8. Compliance interaction with paid status

- Paid status MUST NOT bypass safety/compliance gates (under-13 protections, MAAP rules, minor visibility defaults). Tier check happens after compliance check.
- Tier downgrade (lapse) does NOT delete user data. Lapsed users revert to free-tier feature set with all data intact. Tier upgrade restores access to authored content.
- Pilot accounts (admin-override) get a tier-pinned timestamp + audit entry.

## 9. No-Patreon support fallback

For users who can't or won't use Patreon (corporate, allergic to subscriptions, board accountability): support **direct Stripe Invoicing** (Program tier already needs this for boards). Per-tier fallback:

| Tier | Patreon | Stripe Invoice |
|---|---|---|
| Tip jar | ✓ | ✗ |
| Coach $9.99 | ✓ | ✓ (annual $99.99/yr) |
| Lesson $4.99 | ✓ | ✓ (annual $49.99/yr) |
| Program (from $24.99) | ✓ | ✓ (**preferred**, annual — §1A ladder) |

## 10. Open questions

- **Program/Team + season-pricing decisions** now live in **§1A → "Open decisions"** (name, re-tiering line a/b, free-assistant cap, S→M→L scaling, band price points). That's the active list.
- **Lesson tier** — ✅ **BUILT & live (web) 2026-06-04**; additive (Coach unchanged). See `LESSON_TIER_SCOPE.md` + §1A.
- **Does Lesson replace Managed Swimmers in Coach?** ✅ Resolved — **no, additive**; Coach keeps managed swimmers, Lesson unlocks the same suite at $4.99.
- **Patreon's coach-creator-fee model vs. flat-tier model** — Patreon supports either. Workshop noted "specifics need [more] workshopping."
- **Annual prepay discount** — ✅ resolved in §1A ladder: annual = **~2 months free** (~17%), e.g. Coach $99.99/yr, Program Small $249.99/yr.
- **Sub-processor list** for the paper kit. Currently: Spaceship Hyperlift (hosting), Apple (OAuth), planned Google (OAuth), planned Resend or Postmark (email). Lock the list before Treasurer asks.

---

**Source memory:** [[swim-generator-pricing-direction]]
**Related:**
- [[swim-generator-coach-evaluation-2026-05-25]] — Lesson tier rationale; Coach eval Private persona quotes
- [[swim-generator-swimmer-evaluation-2026-05-25]] — pricing-thesis stress test
- [[swim-generator-team-evaluation-2026-05-25]] — Program tier gating + vendor paper kit
- [[feedback-no-password-auth]] — OAuth-only commitment that bounds Patreon's role to billing
- ROADMAP.md Bigger Threads — team-level curation tier + vendor paper kit + outbound email all gating Program tier
