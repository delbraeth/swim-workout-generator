# SetForge pricing

**Status:** workshop locked 2026-05-19 (original 4-tier model). **Revised 2026-05-25** after the three-eval sweep (coach + swimmer + team). Implementation trigger: **first paying pilot.**
**Origin:** initial direction captured 2026-05-18 ("free today, Patreon-tiered later"). Workshop 2026-05-19. Doc reconstructed from memory checkpoint [[swim-generator-pricing-direction]] on 2026-05-25 after evaluation sweep flagged the source doc was missing from disk. Eval-driven revisions captured in §6.
**Why this doc exists:** to lock the tier model + commitments before any billing code or marketing surface ships, so downstream decisions (ToS, Privacy Policy, landing page, feature gating) have one source of truth.

---

## 1. Tier model (revised 2026-05-25)

Three paid tiers + free baseline. **Supporter $3 demoted from product tier to "buy Cap'n a coffee" tip-jar** per three-eval sweep finding (no signal as a product tier, weak signal as paid). **Lesson tier added** per coach evaluation top-5 (real demand, distinct from Coach tier).

| Tier | Price | Audience | Status |
|---|---|---|---|
| **Free** | $0 | All swimmers, all parents, exploratory coaches | Always live |
| **Tip jar** | $3 (one-time or recurring, no feature unlock) | "I like this, take my money" | Replaces Supporter $3; not advertised as a tier |
| **Coach** | $10/mo | Working coach with 1+ groups | Original tier, unchanged |
| **Lesson** | TBD (target $5-7/mo) | Private/individual lesson coaches | NEW per coach eval; structure TBD |
| **Program** | $25/mo (or $300/yr invoiced) | Multi-coach club teams | Original tier; **gated on team-level curation shipping** + vendor paper kit |

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

### Coach tier — $10/mo

Free tier PLUS:
- UGC authoring (📝 My Sets, snapshot, team-share, public-submit)
- Coach Reports (R1 Programming Mix, R2 Schedule Adherence, R3 Curation Log)
- Multi-lane generate with auto-route to per-lane print
- Coach-level fav/disfav propagation to your swimmers
- Group management (groups, lane plans, assignments, attendance)
- Coach impact panel (curation reach + effectiveness)
- Team membership (as a non-Owner; one team)

### Lesson tier — $5-7/mo (TBD)

For private/individual coaches who don't need full club infrastructure but want more than Free. Coach evaluation's Private coach persona identified specific gaps that should be the lesson-tier value-add:
- Per-managed-swimmer equipment profile (stored on the swimmer, not the coach)
- Lesson workout type (200-1200yd, no forced main set — Warm-Up / Skill Focus 1 / Skill Focus 2 / Send-off)
- Parent recap export (one-button branded one-pager to `parental_contact`)
- Managed swimmer roster (the existing Managed Swimmers feature; currently Coach-tier)

Open question: does Lesson tier replace the Managed Swimmers feature in the Coach tier (Coach drops to "coaches with full-account swimmers only," Lesson adds managed-swimmer suite), or is Lesson tier an additive tier?

### Program tier — $25/mo or $300/yr invoiced

Coach tier × N seats PLUS team-level features that don't yet exist. Per [[swim-generator-team-evaluation-2026-05-25]], **Program tier should not be advertised until these ship:**

1. **Team-level fav/disfav tier** (currently in ROADMAP Bigger Threads) — converts "billing chrome over four Coach accounts" into a team programming platform
2. **Team Settings page** with role-gated defaults (pace baseline, disfavor mode, equipment restrictions, two-deep rule, default note visibility)
3. **Vendor paper kit** (DPA + EIN-bearing invoice + 90-day shutdown/export clause + sub-processor list)
4. **Self-serve full-account JSON export + tombstone-on-delete** (required for board approval regardless of product quality)
5. **Outbound email infrastructure** (required for breach-notification SLA the Treasurer persona surfaced)
6. **Ownership transfer + UGC reassignment on departure** (without it teams orphan on founder-exit)

Quote as **annual contract ($300/yr invoiced)** when relaunched — boards approve annual contracts, not monthly SaaS.

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
| Coach $10 | ✓ | ✓ (annual, $120/yr) |
| Lesson | ✓ | ✓ (annual) |
| Program $25 | ✓ | ✓ (**preferred**, annual $300/yr) |

## 10. Open questions

- **Lesson tier exact price** — TBD. Coach eval Private persona said "Maybe at $10," so Lesson should be cheaper than Coach to be a real downgrade option (target $5-7/mo).
- **Does Lesson replace Managed Swimmers feature in Coach?** If yes, Coach-tier users with managed swimmers grandfather in. Open.
- **Patreon's coach-creator-fee model vs. flat-tier model** — Patreon supports either. Workshop noted "specifics need [more] workshopping."
- **Annual prepay discount** — boards expect it. 10% off Program annual ($270/yr) is industry norm.
- **Sub-processor list** for the paper kit. Currently: Spaceship Hyperlift (hosting), Apple (OAuth), planned Google (OAuth), planned Resend or Postmark (email). Lock the list before Treasurer asks.

---

**Source memory:** [[swim-generator-pricing-direction]]
**Related:**
- [[swim-generator-coach-evaluation-2026-05-25]] — Lesson tier rationale; Coach eval Private persona quotes
- [[swim-generator-swimmer-evaluation-2026-05-25]] — pricing-thesis stress test
- [[swim-generator-team-evaluation-2026-05-25]] — Program tier gating + vendor paper kit
- [[feedback-no-password-auth]] — OAuth-only commitment that bounds Patreon's role to billing
- ROADMAP.md Bigger Threads — team-level curation tier + vendor paper kit + outbound email all gating Program tier
