# Billing-threshold language changes — staged but NOT shipped

**Status:** drafted 2026-05-26 per PHASED_PLAN §3 Phase 1 item 9. **DO NOT SHIP** these edits to privacy.html / terms.html until the first Patreon webhook fires (per VISUAL_PROFESSIONALIZATION §2 threshold finding).

**Why pegged:** the current "hobby-operated / side project / no SLA" language is charm at $0 (honest founder, friends-and-family). It's a hard disqualifier the moment a coach reads it before paying $10/mo or a board reads it before approving $300/yr. Treasurer persona's exact blocker. **The day the first paying user exists, these four sentences must change — same commit, same day.**

This file stays in the repo until billing ships; at billing-ship time, apply the swaps below and delete this file.

---

## Edit 1 — `public/privacy.html` line 113

**CURRENT:**
> The app is operated by an individual ("the operator") for a small group of friends, family, and invited swimmers. There is no company, no employees, no investors. The app is hosted on infrastructure provided by Spaceship (a domain and hosting provider) in the United States.

**REPLACE WITH:**
> SetForge is operated by a single founder under Competition Aquatics, LLC. The app is hosted on infrastructure provided by Spaceship (a domain and hosting provider) in the United States. See our [sub-processor list](/sub-processors.html) for the full list of vendors that touch user data.

**Why this shape:** drops "no company, no employees, no investors" (gratuitous disqualifier). Keeps "single founder" (honest). Adds the LLC (already on footer; nothing new). Links to sub-processors per Treasurer ask.

---

## Edit 2 — `public/privacy.html` line 181

**CURRENT:**
> We aim to respond to requests within a reasonable time (typically days, not weeks). This is a side project, not a 24/7 operation.

**REPLACE WITH:**
> We aim to respond to requests within a few business days. SetForge does not operate a 24/7 support desk; urgent service interruptions are communicated to active users by email.

**Why this shape:** drops "side project" framing. Sets honest expectation (days) without volunteering disqualifying language. Names the actual outage-comms mechanism (email to active users) — which only becomes true after Phase 2 ships outbound email infrastructure. **Don't ship Edit 2 before Phase 2 lands.**

---

## Edit 3 — `public/terms.html` line 116

**CURRENT:**
> The App is a non-commercial fitness tool that generates customized swim workouts for personal use. It is operated by an individual as a side project for a small group of invited swimmers. There is no company, no support team, no service-level agreement.

**REPLACE WITH:**
> The App is a fitness tool that generates customized swim workouts for individual coaches and their swimmers. It is operated by Competition Aquatics, LLC. SetForge does not provide a service-level agreement; service availability is best-effort, with material interruptions communicated to active users by email.

**Why this shape:** drops "non-commercial" (no longer true once billing fires), "side project," "small group of invited swimmers" (also false once self-serve signup ships), "no company," "no support team." Keeps the honest "no SLA" framing but reframes from "we don't even try" to "best-effort with comms." Same email-comms note as Edit 2 — needs Phase 2.

---

## Edit 4 — `public/terms.html` line 169

**CURRENT:**
> The App is hobby-operated. It may be offline for maintenance, updates, or unannounced periods. No uptime guarantee.

**REPLACE WITH:**
> SetForge does not provide an uptime guarantee. The App may be offline for maintenance or updates; planned maintenance windows are announced to active users by email when feasible. Unplanned outages are communicated as soon as practical via Discord and email.

**Why this shape:** drops "hobby-operated" (the worst phrase in the file for board credibility). Keeps the no-uptime-guarantee honesty. Names the actual comms channels (Discord exists per Phase 1; email per Phase 2). Both must be live before Edit 4 ships.

---

## Edit 5 — ADD a new section to `public/terms.html` (after Edit 4, before Contact)

**ADD:**
> ### Continuity commitment
>
> If SetForge ceases operation, Competition Aquatics, LLC commits to:
>
> 1. **90-day advance notice** to all active users via email before service ends.
> 2. **Self-serve data export** in JSON format for every active user, available throughout the notice period.
> 3. **Published migration scripts** released to a public GitHub repository so any third party can self-host SetForge on their own infrastructure.
> 4. **Open-source the SetForge codebase** under [LICENSE TBD — see open question in PHASED_PLAN §8] at the start of the notice period, so the product can continue independently of the operator.
>
> This commitment applies to any voluntary shutdown. If the operator becomes incapacitated, a designated successor will execute these steps on the same timeline.

**Why this shape:** materializes all four continuity commitments Cap'n locked in PHASED_PLAN decision #5. This single section converts the Treasurer persona's "TABLE — insufficient info" into "same-day yes." It's the highest-leverage edit in this file and is the entire reason this draft exists.

**Open questions before this ships:**
- **License choice** (MIT / AGPL / source-available-with-shutdown-trigger) — see PHASED_PLAN §8 open follow-up #3. Bracket replaced with chosen license name in final.
- **Designated successor** clause — who actually executes if Cap'n is incapacitated? Either name a person, or replace with "a successor designated in writing by Competition Aquatics, LLC."
- **Legal review** — short pass by a small-business attorney before this language goes live. The continuity commitments are binding once published.

---

## Pre-flight checklist before applying these edits

When the first Patreon webhook fires (or when first Stripe invoice issues — whichever comes first):

- [ ] Verify Phase 2 outbound email infrastructure is live (Edits 2 + 4 reference email-comms; can't ship if that's not true)
- [ ] Verify Discord is set up + invite link is in the manual (Edit 4 references Discord)
- [ ] Verify `/sub-processors.html` is live (Edit 1 links there)
- [ ] License choice locked + bracket replaced in Edit 5
- [ ] Successor clause resolved in Edit 5
- [ ] Small-business attorney review of Edit 5 (the only commitment that creates legal obligation)
- [ ] Apply all 5 edits in a single commit; message: "ToS+privacy: soften hobby-operated language + add continuity commitment (billing-threshold edit per BILLING_THRESHOLD_CHANGES.md)"
- [ ] Delete this file in the same commit

## Related

- [[swim-generator-phased-plan-2026-05-25]] — PHASED_PLAN §3 Phase 1 item 9 (this draft) + Phase 3 (when these ship)
- [[swim-generator-visual-professionalization-2026-05-25]] — §2 highest-leverage finding (the threshold)
- [[swim-generator-team-evaluation-2026-05-25]] — Treasurer + Lifecycle blockers that this addresses
- [[swim-generator-pricing-direction]] — PRICING.md §6 + §7 (free-tier permanence promise that should pair with this)
