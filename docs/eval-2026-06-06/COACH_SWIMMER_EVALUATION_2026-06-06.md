# Coach + Swimmer evaluation — 6 personas + synthesis (live-grounded)

**Date:** 2026-06-06
**Method:** 6 parallel agentic personas — **5 coach archetypes** (Private, Summer-League,
High School, Club, Masters) **+ 1 new Individual Swimmer** — each read the codebase +
manual + ROADMAP + scope docs **plus a live-app evidence capture** (see
`LIVE_EVIDENCE.md`), then produced a structured critique (3 strengths, 3 gaps, 3
prioritized requests, would-pay verdict + single blocker, live-only notes, and what
shipped since the last eval). A 7th synthesis agent rolled up shared themes,
contradictions, a ranked roadmap, what changed since 2026-05-25, and remaining blind spots.
**Access:** documentation + source **+ live production app** (driven via Chrome on a
logged-in coach account, build `bundle 6688d88b62c1`). This is the first eval grounded in
live interaction — closing the "no one drove the real app" blind spot from 2026-05-25.
**Continuity:** this is a RE-RUN of `docs/archive/COACH_EVALUATION_2026-05-25.md`. Personas
were told which prior asks shipped and instructed not to re-request what now exists.

---

## At-a-glance

| Persona | Tier | Verdict | Single blocker |
|---|---|---|---|
| Private / small-group | Lesson ($4.99) | **Yes** ↑ (was Maybe) | None blocks buy; recap is email-only behind guardian-link chain |
| Summer-League | Free (won't pay $10/7wk) | **No** (unchanged) | No genuine beginner content — bank floors ~800yd adult-coded; ~60% of roster locked out |
| High School | Coach ($10) | **Maybe** (unchanged) | Taper still needs manual weekly phase flips (no auto-shift) + no whiteboard print |
| Club / program dir | Coach $9.99 self; **not** Program $25 | **No** (unchanged) | Program tier undefined/undifferentiated; no periodization; no board-defensible MAAP |
| Masters | Coach ($9.99) | **Maybe** ↑ (was leaning-no) | Per-swimmer constraints UI is managed-only — misses self-registered adults |
| **Individual Swimmer** (new) | Free (no SKU exists) | **No** (structural) | No paid tier for solo athletes; free Progress doesn't track per-event PRs over time |

**Movement since 2026-05-25:** Private **Maybe→Yes**, Masters **leaning-no→Maybe**. HS, Club
unchanged (their named blockers half-shipped or untouched). Summer-League unchanged (No).

---

## Top 7 ranked roadmap candidates (synthesis §roadmap)

> **✅ #1–3 SHIPPED + LIVE-VERIFIED 2026-06-06** (commit ebf01d5, bundle 2be48c4a933b):
> type/persona-aware Coach's Note (masters string removed), single-page landscape
> whiteboard print (🪧 button), and the anchor `suggested_phase` opt-in (APPLE base→peak
> confirmed live).
> **✅ #4 SHIPPED + LIVE-VERIFIED 2026-06-06** (commit 411504a): per-swimmer constraints
> now reach real logged-in swimmers — `ConstraintsPanel`/`ConstraintFormModal` polymorphic
> (`swimmerSub`|`managedId`) + 🚱 Limits on every team-roster member. Live: add/persist/remove
> a constraint from the roster; `swimmer_sub` query 200.
> **✅ #5 SHIPPED + LIVE-VERIFIED 2026-06-06** (commits 0767650 + 5a8940f): Youth /
> Learn-to-Swim content pack — built-in 25/50-based deck-paced bank (stroke-survival +
> DQ-avoidance drills) swapped in via a 🧒 Learn-to-Swim toggle; v1.1 guards cap to
> YOUTH_MAX, go gear-light, force bank source. Live: required-buoy + max-1200 (the v1
> break) now yields a clean 425yd youth session.
> **✅ #7 SHIPPED + LIVE-VERIFIED 2026-06-06** (commit 3661c32, migration 054): per-event
> PR progression (new `swimmer_event_pr_history` + inline SVG chart in 📈 Progress, auto-
> capture + log-a-result form that promotes the PR when faster) + SCY/SCM/LCM course tabs
> in 🎯 Race goals. Built the FREE scope only — the swimmer SKU/paywall was deliberately
> deferred (pricing decision; athlete features stay free). **#6 remains open** (define the
> Program tier — also a pricing decision), plus the standalone Lesson Stripe price config.


1. **Type/persona-aware Coach's Note** — kill the hardcoded "masters pace 2:00–2:15/100"
   string (App.jsx:5362-5367, branches only on poolMode). **S** · unlocks trust for **all 6**
   · highest consensus (6/6 caught it live), lowest cost.
2. **Single-page big-font landscape whiteboard print** — Lane 1/2/3 columns, large type,
   no names, one page. **S** · Summer-League + HS + Club. Re-requested, did NOT ship 2 evals running.
3. **Wire anchor `suggested_phase` into the generator** (opt-in auto-apply) — `effectivePhase`
   (App.jsx:2959) reads manual `current_phase`, never the anchor's suggestion. **S** · HS (flips
   the named #1 blocker from advisory to hands-off), partial Club.
4. **Per-swimmer constraints UI for real (non-managed) logged-in swimmers** — DB/authz already
   support `swimmer_sub` (db.js:5995); only the modal is managedId-only. **M** · Masters (flips
   Maybe→Yes), HS, Club.
5. **Youth / Learn-to-Swim content pack** — 25-based sets, no-interval/whistle mode, real
   ~200-400yd floor, DQ-avoidance drills, tagged to feed Lesson/Youth type. **L** · Summer-League
   (flips No→Yes), Private's learn-to-swim half. (Lowered LESSON_MIN is a no-op without this.)
6. **Define + ship the Program tier** (editable macrocycle + org reports) — or drop the $25
   claim. **XL** · Club (only path to $25 revenue). Roadmap itself flags Program = "billing chrome."
7. **Unify PRs + per-event progression chart + a swimmer-facing SKU** — close the loop from
   logged splits → per-event PR → progression chart; add SCM/LCM course tabs; bundle as a $3–5
   Athlete tier. **L** · Individual Swimmer (the only persona with zero buyable product).

---

## Shared themes (3+ personas converge)

- **Off-persona Coach's Note (ALL 6).** App.jsx:5362-5367 branches the note only on poolMode;
  the SCY/default branch hardcodes "calibrated for a masters pace of 2:00–2:15/100." Renders
  verbatim on a kids' Lesson, an HS race-pace set, a club sheet. Caught live by every persona.
  Highest-consensus item; trivial conditional fix.
- **No 1-page whiteboard/deck print (Summer-League, HS, Club — all deck coaches).** Only prints
  are `window.print()` of the web layout or `MultiPacePrintView`'s per-lane multi-page flow
  (a page PER lane) — the wrong artifact. S-cost ask, re-requested, still unshipped.
- **Genuine beginner content (Private, Summer-League).** Lesson type lowered the floor but
  built-in technique content can't go below ~800yd; pace presets bottom at 2:30/100 (assumes a
  kid can hold it). ~60% of a summer roster + the learn-to-swim half of a private book locked out.
- **Personalization doesn't reach the swimmers who have it (Masters, HS, Club).** PSC constraints
  UI is managed-only; race-pace goal store is the coach's own → group fanout applies one target to
  everyone. Both marquee personalization features are effectively individual-only.
- **Reliability/latency on deck = solved blind spot (all 6).** Independently confirmed from live
  evidence: bootstrap ~563ms, team-calendars ~465ms, reports 1-2s, no console errors, instant
  SPA nav, healthy 200s. Removes a prior worry rather than adding a request.

## Contradictions

- **Content: adult-coded vs locked-out.** Masters praises "genuinely adult-coded, not kid sets
  relabeled"; Summer-League/Private say it's masters-coded and useless for beginners — same bank.
  **Resolution:** both right; the bank has one center of gravity (~2:00/100) and no breadth at the
  extremes. Fix is an *additive* beginner pack feeding Lesson/Youth, not a rebalance.
- **"Lesson tier BUILT" vs inert paywall.** Lesson FEATURES shipped and work (flips Private to
  Yes); the Lesson PRICE button returns `no_price_id` (server.js:2839) because
  `price_id_lesson_monthly` isn't configured in Stripe. **Resolution:** operational/config gap,
  not a feature gap.
- **Swimmer side "well-executed" but never driven live.** The Individual Swimmer's praise is
  source/manual-based; LIVE_EVIDENCE was a coach account, parent surface only. **Resolution:**
  treat "swimmers actually use assigned workouts" as an unverified assumption — the load-bearing
  gap under the free-swimmer thesis.

## What changed since 2026-05-25

- **PSC v1 (per-swimmer constraints) SHIPPED well** — 14-type vocab, step-0 picker filter, V9
  validator, expiry, Generate-time checklist, per-lane print annotations, proper authz. Resolved
  the triple-cross-validated #1 gap — **except** managed-swimmer-only (misses self-registered adults).
- **Lesson type + per-swimmer equipment + coach-authored lesson sets SHIPPED** — resolved BOTH
  Private blockers (Maybe→Yes).
- **HS race-pace + PR/goal-anchored targets SHIPPED, landed strongest** — engine-exact per-rep
  splits (live-verified 1:52.34→28.09), 8-event taxonomy, USRPT. **But** group fanout reverts to
  one generic target → effectively individual-only.
- **Meet-anchored taper shipped ONLY the cheap version** — `suggestedPhaseFromWeeksOut` + badge,
  NOT wired into Generate. HS #1 blocker half-done; club's real macrocycle untouched.
- **Calendar .ics + roster CSV exports SHIPPED** — one-way bridge out; not the TeamUnify/SWIMS
  two-way the club needs.
- **Swimmer Progress dashboard SHIPPED but PARTIAL** — volume + yards-by-stroke + 3 test-set
  bests; omits per-event PRs + progression chart. Reports still "Yards by stroke: No data in range."
- **NOT shipped despite prior asks:** whiteboard print (S, re-requested ×3), beginner content,
  team-type compliance posture (masters still hits unconditional DOB gate, server.js:5523), defined
  Program tier, MAAP/SafeSport pack (person_external_ids empty, two-deep still soft warning).

## Remaining blind spots (meta-critique of THIS exercise)

- **Swimmer athlete session STILL not driven live** — same gap as 2026-05-25. Parent surface was
  driven; no real non-coach swimmer logged against an assignment or saw PR-anchored targets as set.
- **First-run / onboarding unverified** — live run was already-authed. Invite-only + Apple/Google
  signup flagged by 3 personas but the OAuth gate / empty first-generate state was never driven.
- **iOS native entirely untested** — live evidence is web-only; no read on iOS parity / on-deck
  phone (the stated primary use case).
- **Multi-lane never stressed at a realistic ability spread** — Masters' 1:10–2:45/100 fallback
  concern is source inference, not a live finding.
- **Latency only measured single-coach/good-wifi** — no concurrent load, bad pool wifi, the 429
  rate-limit pressure the roadmap flags, or 30-40 swimmer fanout.
- **Pricing is self-reported intent against a checkout that doesn't fully exist** — Lesson price
  inert + Program undefined means 2 of 4 paid tiers can't be bought today; even the "Yes" (Private
  $4.99) couldn't complete the buy.
- **No competitive grounding** — Commit Swimming / TrainingPeaks / TeamUnify named but never
  compared head-to-head; "beats my Google Doc" is the only real baseline.

## Headline

Since 2026-05-25, SetForge shipped almost exactly the right things and shipped them well —
per-swimmer constraints, the Lesson type + per-swimmer equipment, and exact PR/goal-anchored
race-pace are all live and live-verified, and they moved real verdicts (Private Maybe→Yes,
Masters toward Yes). Deck reliability now reads as solved. But the gains are concentrated in the
audience the bank was already built for (masters/HS/club individuals), and three patterns hold back
broad conversion: (1) the marquee personalization features don't reach the self-registered swimmers
and team fanouts where they're most needed; (2) the cheap, thrice-requested whiteboard print and
genuine beginner content still haven't shipped, leaving summer-league and learn-to-swim empty; and
(3) an off-persona "masters pace" Coach's Note (all 6 caught it), an inert Lesson price button, and
an undefined Program tier undercut trust and revenue on the surfaces and SKUs that should close
deals. Engineering execution is strong; the highest-leverage/lowest-cost moves now are last-mile
wiring (suggested_phase into Generate, constraints to real swimmers, per-swimmer race-pace on
fanout) plus the two stubbornly-unshipped cheap items (whiteboard print, type-aware note).

---

## Verbatim persona reports (input data, preserved for audit)

Full structured JSON for all 6 personas is preserved at
`docs/eval-2026-06-06/panel-raw.json`. Key per-persona verdicts + single blockers are in the
At-a-glance table above; full strengths/gaps/requests/live-notes/shipped-since are in the raw file.
