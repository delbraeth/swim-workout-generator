# Swimmer evaluation — 5 personas + synthesis

**Date:** 2026-05-25
**Method:** 5 parallel agentic swimmer personas (Teen Club Swimmer, Adult Masters w/ Coach, Solo / Self-Coached Fitness Swimmer, Triathlete, Parent of 11yo) + synthesis pass. Documentation-driven (no live-app interaction).
**Origin:** the coach evaluation synthesis ([[swim-generator-coach-evaluation-2026-05-25]]) flagged "no one evaluated the swimmer-side experience" as its highest-leverage missed pass — pricing thesis (coach-pays/swimmer-free) lives or dies on whether swimmers actually use what coaches assign. This evaluation tests that thesis directly.

---

## At-a-glance verdict

| Persona | Engagement | Single blocking fix |
|---|---|---|
| Parent (mom of 11yo) | Monthly | Google OAuth + weekly email digest |
| Teen Club Swimmer | Daily (decays w/o ship) | Lane leaderboard (opt-out) |
| Adult Masters w/ Coach | Workout days only | Personal "this week" digest + splits trendline |
| Solo / Self-Coached | Weekly (plateaus mo. 2) | Solo progress dashboard |
| Triathlete | Once, then ghost | TP/Garmin one-way export |

## Pricing-thesis verdict

**The "coaches pay, swimmers free" model is structurally sound but operationally bleeding.** The free tier is a funnel only for assigned swimmers under an active coach (Teen, Masters partial). For Solo and Tri, free tier drifts to MySwimPro/TrainingPeaks within ~60 days. Parent is a third category — paying-adjacent stakeholder with zero surface. The thesis holds **if** coach-assignment is the gravity well — but right now Run Mode + assignments are the only sticky surface, and assigned swimmers still ghost after week 2 without comparison/PR/progress features. **The funnel is leaking from both ends.**

## Top 5 ranked roadmap candidates (synthesis)

1. **Swimmer progress dashboard** (yards/week, pace trend by stroke, time-trial logger) — unblocks Solo + Masters + Teen — **M** — single largest convergence; reuses R4 frame
2. **Google OAuth + outbound email infrastructure** (Resend/SendGrid + weekly digest) — unblocks Parent + Teen's teammates + downstream MAAP/Discord/Lesson — **M** — foundational; see §"Email infrastructure"
3. **Personal constraint/injury layer** (auto-substitution on assignments) — unblocks Masters + Tri + cross-validated coach-side — **M**
4. **PR-anchored race-pace targets + race-prep arc** — unblocks Teen + Solo + Tri — **M-L**
5. **One-way export** (CSV history + .ics assignments) — unblocks Tri + Masters; explicit *not* full TP parity — **S-M** — cheapest "stop ghosting" lever

## Cross-evaluation with coach side — the highest-leverage finding

Cross-validated (both coaches AND swimmers want):
- **Per-swimmer constraint vector** — coach top-5; Masters #2; Tri implied. **Ship first.**
- **Meet-anchored taper / race-prep arc** — coach top-5; Teen + Solo + Tri swimmer-side.
- 1-page whiteboard print — coach top-5; not surfaced swimmer-side (swimmers use phones).

Swimmer-only:
- Personal progress dashboard
- Lane leaderboards
- External export / TP-Garmin
- Parent portal + Google OAuth

Coach-only:
- Lesson tier
- Team-type compliance posture

**Implication:** **Constraint vector + meet-anchored taper trump everything else** — both sides want them, both are blocked by their absence. These should top the roadmap above even the progress dashboard.

## The "no email infrastructure" finding

Parent persona discovered: `server.js` has **zero outbound mail** (no SendGrid, no SMTP, no nodemailer). `parental_contact` is a dead 255-char string with no actions wired. This silently blocks:

- Parent portal digests
- MAAP coach-CC on minor notes
- Discord scope notifications
- Lesson tier confirmations
- Passwordless/magic-link auth (option doesn't exist even if revisited)
- Abandonment/re-engagement nudges (exact lever to stop Solo + Tri ghosting)
- Review-request loops

**Cost:** S to wire (Resend or Postmark, ~4-6h provider + template + queue). **Urgency: high.** Every roadmap candidate touching a non-coach human needs this eventually. Ship before parent portal, before Discord, before Lesson tier.

## Contradictions (need resolution)

- **Privacy vs. social comparison** — Teen wants lane leaderboards; Parent wants tighter visibility on minors. *Opt-in leaderboards default-off for under-18, owner-toggle for adult groups. Don't ship global.*
- **UGC gating** — Solo wants `is_coach` gate dropped; coach memo + Pricing keeps UGC as Coach-tier value-add. *Ship "snapshot to personal save" for solo; keep team-share + public-submit gated.*
- **Vocabulary** — Solo says jargon (`descend_ladder`, `threshold_steady`) is fine; Tri says drill descriptions assume coach context. *Keep terms, add 1-tap inline glossary/cue.*
- **Walled garden vs. focus** — Tri + Masters want TP/Garmin export; contradicts "own the deck experience" thesis. *Ship CSV/.ics one-way, don't chase full TP parity.*

## Meta-critiques (what the personas didn't test)

- **Nobody tested Android end-to-end.** Parent flagged Apple-only conceptually but didn't simulate Pixel sign-in. Real failure mode (web fallback?) uncharacterized.
- **Nobody walked swimmer onboarding cold.** Claim flow, invite codes, parental_contact entry, 13th-birthday handoff — all reviewed as features, none as first-time UX. Funnel top is unmeasured.
- **No real churn signal.** Personas project ghost behavior. The "moat grows weekly" claim (Solo) is plausible but untested against month-2 plateau prediction.
- **Pricing wasn't pressure-tested at $3.** Only Solo addressed willingness-to-pay at the Supporter tier. Teen/Masters/Tri didn't.
- **Discord scope unevaluated.** Just locked, no persona touched it.

## Incidental finding

While reading scope docs, the Solo agent reported **PRICING.md and RELATIONSHIPS_SCOPE.md don't exist on disk** despite being referenced by name in memory + this evaluation's input prompts. Two possibilities: they were drafted-then-not-committed, or memory + ROADMAP reference them by intention. Worth a 1-minute audit.

> **Reconciliation (2026-05-25, same day):** audit confirmed both docs had NEVER existed in git history despite being referenced in 5+ places across code + manual + ROADMAP. The relationships work shipped Stage 1-4 (Stage 5 rolled back). Both docs reconstructed from memory checkpoints on 2026-05-25: RELATIONSHIPS_SCOPE.md as-shipped design history, PRICING.md as 2026-05-19 workshop + revisions driven by this evaluation sweep (Supporter demoted to tip jar, Lesson tier added, Program tier gated on team-curation + paper kit).

---

## Verbatim persona reports (input data, preserved for audit)

### Parent of 11-year-old age-grouper

**Top 3 strengths**
1. Privacy posture is genuinely above-average for a side project. No analytics, no ad pixels, no third-party tracking, hard COPPA gate, DOB stored once and `is_minor` derived live, audit logs anonymize on account deletion. Compared to TeamUnify, this is striking.
2. The coach has real tools to differentiate Sophie's training. Per-swimmer pace fields, favorite/disfavor propagation from coach to swimmer, attendance tracking, multi-lane generation, reports (R2 Schedule Adherence, R3 Curation Log). Value flowing to my kid.
3. The "parent-managed" flag works as advertised. Coach can mark Sophie's profile parent-managed, blocking the claim flow even at 13+. Right default.

**Top 3 gaps**
1. **I am invisible.** Parental_contact is a 255-char string with nothing sent to it. No emails, notifications, parent portal, parent login, read-only digest. `server.js` has zero outbound mail (no SendGrid, no SMTP, no nodemailer). The entire parent-comms channel doesn't exist.
2. **Apple-OAuth-only is a real friction wall for a Gmail family.** I'm Android/Gmail. To manage Sophie's account, the docs say sign in with Apple. Privacy.html still says "Google planned" but isn't shipped. For a club where most parents are Android, this excludes us.
3. No safety surface for me. No two-deep coach visibility, no DM transparency, no log of who edited her profile, no audit trail I can read. Reports are coach-facing not parent-facing. View-as/impersonation is admin-only with no notification.

**Top 3 prioritized requests**
1. Parent portal (read-only) tied to parental_contact. Magic-link or Google OAuth. This week's practices, attendance %, coach's last note, two-deep coach roster, data-export + deletion. MVP-shape (one screen + weekly digest email) converts me from blind to engaged.
2. **Google Sign-in, ship it.** Locks out a large share of the youth-swimming parent population.
3. MAAP-style coach-contact transparency + parent-CC. CC parental_contact on coach focus notes for minors. Log non-primary coach access. If/when DMs ever land, two-adult visibility by default.

**Engagement verdict:** Maybe once a month, only because I'm paranoid. Google sign-in + weekly digest would get me to weekly email open + ~2x/month click-in.

**Trust verdict:** Cautiously yes for the data (privacy policy + data model responsible), no for the parental experience (total absence of parent-facing surface = trusting on faith).

### Teen Club Swimmer (16)

**Top 3 strengths**
1. Pace clock on my phone, on the wall. Big landscape countdown + audio cues at T-3/2/1/0 = no squinting at the wall clock. Lap-button split capture with delta vs interval is TritonWear-lite without the pod.
2. **"📥 Assigned to me"** — coach drops today's workout, it's right there with full set list + lane label + lane pace. No more squinting at the whiteboard from the back of lane 4. Mark complete + 1-5 difficulty in two taps. Killer feature.
3. Tri-state fav/disfavor on sets. I'd press 👎 on hated sets, ★ on crushed ones. Satisfaction is the receipt.

**Top 3 gaps**
1. **No way to compare to teammates.** No leaderboard, no lane-average split, no "Mara hit 1:08, you hit 1:11." Half the reason 16yo opens anything is to see where she ranks. Without it, splits are journal entries.
2. **No PR tracking / goal-times on race-pace sets.** I swim 200 free in 1:52. Where do I tell the app? When a race-pace 8×50 shows up I want "target = :28" not generic 2:00/100. Goals are "yards per week" — coach KPIs, not swimmer.
3. **No coach intent / "why this set."** Focus Note is mine. I want to read coach's. Why threshold today, what zone, meet 4 weeks out. The whiteboard at least has coach scribbling "RACE PACE" next to the main.

**Top 3 prioritized requests**
1. Race times + PR-anchored pace targets. Profile = my events with current PRs. Race-pace 200 free pulls *my* :28.
2. Lane leaderboard for splits. When 3+ teammates ran the same assigned workout, show lane median + my delta. Opt-out for privacy.
3. Coach note per assigned workout. 1-line "today is threshold, second 50 of each 100 should feel hard." Already-shipped focus-note infra; just let coach write it on the assignment.

**Engagement verdict:** Daily for assigned-workout + pace clock; ghost the rest within 2 weeks unless leaderboard ships. Apple-only sign-in annoying (I'm iPhone but half my teammates Android and locked out).

### Adult Masters with a Coach (45)

**Top 3 strengths**
1. "Assigned to me" + Run Mode + PaceClockView. Morning-of, pool-deck-ready loop I actually use. Clock at 128px landscape readable from the wall.
2. Multi-lane pace handling. Coach generates one workout the picker validated against every lane's pace, prints per-lane via MultiPacePrintView. I'm not getting an interval my lane can't make.
3. History + favorites + goals. Saved splits roll into actual_splits, stats panel tracks yards/week against goals, starring biases future generations. Better than my Excel sheet.

**Top 3 gaps**
1. **No injury / modification workflow.** Can't tell the app "right shoulder tweak — swap fly + paddles for kick/pull-buoy free." Manual ⇄ swap exists per-set; no per-swimmer constraint that follows me. Coach can't program around it either.
2. **Zero outside-app integration.** No Garmin Connect import, no TCX/FIT export, no TrainingPeaks push. Even a CSV history export would let me reconcile.
3. **"This week" view is buried + coach-centric.** I want glanceable "Tue = threshold, Wed = recovery, do I need to be there at 5:15?"

**Top 3 prioritized requests**
1. Swimmer-side "this week" digest — read-only ribbon of next 4 assignments, swipeable, no scheduling chrome.
2. Personal modification layer — active "injury profile" (shoulder, knee, low-back) auto-substituting flagged equipment/strokes on incoming assignments; surface "modified for shoulder" tag to my coach.
3. Splits trendline + export — surface 100-pace trend by stroke over 90 days in my own view; let me export history as CSV/TCX.

**Engagement verdict:** Workout days only, twice — ~3 min/day, 4 days/week. No reason to open on rest days without Garmin sync or personal trend view.

**Coach-curation awareness:** Mildly creepy once I know; app doesn't surface it. Coach's fav/disfav silently shapes my picker. For assigned workouts I don't care; for own generations I'd want a one-line "your picker is also biased by Coach Jen's preferences" with view-only link.

### Solo / Self-Coached Fitness Swimmer (35)

**Top 3 strengths**
1. **Generator quality.** 12-template engine + Bank/Engine/Mix per section + 3.9% fallback = one button → coach-quality non-trivial workout. Entire reason to open the app.
2. Repeat-last-week + history with multi-lane chip + Run Mode. On-deck loop works. No screenshot dance.
3. **Personal curation** (favorite / disfavor at label, set, engine-template levels). After two weeks the picker stops giving me fly mains and prefers pull sets I like. The moat — switching costs grow weekly.

**Top 3 gaps**
1. **No progress-over-time surface for me.** R4 is template/source/usage stats. Doesn't tell me "your 100 free pace dropped 3s in 8 weeks." For a fitness swimmer that's THE retention loop.
2. **UGC is coach-gated.** I'd want to save "Cap'n's broken 500" as a personal set but `is_coach` hides My Sets and snapshot. Disfavor subtracts; I can't add.
3. **No OWS-aware mode or race-prep arc.** Bank doesn't tag continuous swims, sighting drills, or a 6-week build-to-race. Generator is per-workout, not per-season.

**Top 3 prioritized requests**
1. Solo progress dashboard. Yards/week trend, stroke distribution, simple time-trial logger, top-3 paces rolling 8 weeks. Killer add.
2. Open My Sets / snapshot to solo tier. Drop `is_coach` on create + snapshot; keep team-share + public-submit coach-only. Per-account quota (5 free, 20 Supporter).
3. Race-prep mode. Pick date + distance + pool/OWS; generator biases toward aerobic/threshold over build, taper last week.

**Engagement verdict:** Weekly yes, daily no, abandon no. Plateaus around month 2 without progress surface.

**Pay verdict:** $3 Supporter probably yes IF it unlocks something (UGC quota, dashboard, OWS mode). $10 Coach no — I'm not a coach; framing tells me I'm second-class. Pricing says "coaches pay, swimmers free" — honor that; solo tier needs to be genuinely good on its own.

### Triathlete (40, intermediate)

**Top 3 strengths**
1. Translates "70 min aerobic" into actual sets. TP gives yardage; SetForge turns it into concrete sets at *my* pace. Gap my coach refuses to fill.
2. Pace clock + Run Mode on phone. Landscape clock, INTERVAL/REST/GO labels, optional lap button — usable through a Ziploc.
3. Drills without a coach watching. Bank has real progressions. Better than YouTube mid-set.

**Top 3 gaps**
1. **No TP/Garmin export of any kind.** Only N6 Print/PDF + Markdown export exist. No .ics, .zwo, .fit, .mrc. My coach can't see what I did; Garmin won't auto-prompt the set on my wrist.
2. Open-water content is a single set. Two hits for "Long Open Water Sim." No 750 race-pace, no sighting drills as their own set, no buoy-turn sims, no breathing-side balance for chop.
3. Bank skews pool-club, not tri. Lots of IM/back/breast/fly — irrelevant. Sprint/VO2 is short max efforts, not the 400-1500 broken-pace tri work (10×100 @ 1500 pace, 6×200 descending to 70.3).

**Top 3 prioritized requests**
1. TP structured-workout export (or raw .json/.ics with set list). Even one-way push converts SetForge from silo to translator.
2. Tri intent profile + tri main-set pack. "Triathlon" pace preset (1500/Oly/70.3 goal paces), bank tag `tri`: sighting ladders, broken 1500s, race-pace 750s, CSS sets, bilateral-breathing endurance.
3. Drill section that doesn't need a coach to interpret. Inline 1-sentence cue + optional YouTube link per drill id.

**Engagement verdict:** Once and ghost, probably. Use for 1-2 swims to convert coach's yardage, then drift back to whiteboard.

**Workflow-fit verdict:** Silo. Solo tier is free so cost is fine, but with zero TP/Garmin path it's a parallel system — triathletes don't add parallel systems.

---

## Open follow-ups (for future-Cap'n)

- Cross-validated candidates (per-swimmer constraint vector + meet-anchored taper) are now backed by both coach + swimmer evidence. These move from "interesting" to "obvious next."
- The email-infrastructure unlock is the highest-leverage cheap thing on the table. Ship before any feature that touches a non-coach human.
- Android-on-prod and swimmer-onboarding-cold are the two unrun real-user tests. Worth a real first-time-user pass before any pilot push.
- The PRICING.md / RELATIONSHIPS_SCOPE.md absence-from-disk needs a 1-minute audit — were they drafted but not committed, or are they intentional memory-only artifacts?

---

*Generated 2026-05-25 by 5 parallel persona agents + 1 synthesis agent. Documentation-driven evaluation; no live-app interaction. See memory `swim_generator_swimmer_evaluation_2026_05_25.md` for archive pointer.*
