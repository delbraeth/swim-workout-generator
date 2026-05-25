# Coach evaluation — 5 personas + synthesis

**Date:** 2026-05-25
**Method:** 5 parallel agentic coach personas (Private, Summer-League, High School, Club, Masters) read the SetForge codebase + manual + ROADMAP + scope docs and produced structured critiques (top 3 strengths, top 3 gaps, top 3 prioritized requests, would-pay verdict at the tier matching their archetype). A 6th synthesis agent then identified shared themes, contradictions, ranked roadmap candidates, and called out blind spots in the exercise itself.
**Access:** documentation + source only (no live app interaction). Agents could not OAuth into the deployed app.
**Why archive:** captures a point-in-time outside-view of the product after UGC v1 closed and before the next big feature lands. Useful for sanity-checking roadmap moves against the gaps coaches actually surfaced. Reread when a feature in §5 (roadmap candidates) is up for build.

---

## At-a-glance

| Coach | Tier | Verdict | Single blocker |
|---|---|---|---|
| Private | $10 Coach | Maybe | Per-swimmer equipment OR Lesson type |
| Summer-League | $10 Coach | **No** | Beginner content tier (25s, low-yd floor) |
| High School | $10 Coach | Maybe | Meet-anchored taper auto-shift |
| Club | $25 Program | **No** | Periodization + roster import + MAAP pack |
| Masters | $10 Coach | Maybe-leaning-yes | Per-swimmer injury/constraint tags |

**Top 5 ranked roadmap candidates** (synthesis §4):

1. **Per-swimmer constraint vector** (equipment + stroke/equipment exclusions) — M cost · unlocks Private + Masters, moves Club closer
2. **Meet-anchored season/taper** (championship date drives phase auto-shift) — M-L cost · unlocks HS, partial Club + Summer-League
3. **1-page whiteboard print** (large-font landscape, Lane 1/2/3, no roster names) — S cost · unlocks HS + Summer-League + bonus Private
4. **Lesson / Learn-to-Swim content tier** (200-1200yd floor, 25s sets, no forced main) — L cost · unlocks Private + Summer-League
5. **Team-type-driven compliance posture** (Masters skips DOB, Club gets MAAP, Summer-League rosterless) — M cost · resolves 3 contradictions cleanly

---

## §1 — Shared themes (3+ personas converge)

- **Meet/season anchoring is missing.** HS and Club call out no championship-date-driven taper or macrocycle; Summer-League's "Meet prep" / Wednesday-meet preset is the same gap in shorter form. Three coaches, same underlying object: an event with downstream effects on Generate.
- **A 1-page whiteboard/pool-deck print.** HS wants "print-the-whiteboard quick view... single printable page" instead of N6's per-lane multi-page flow. Summer-League wants "giant landscape view sized for whiteboard transcription... Lane 1/2/3 — no swimmer names." Private leans on Multi-pace print but for parents not deck. N6 is over-engineered for the most common deck use.
- **Per-athlete (not per-account) constraints — equipment, injuries, exclusions.** Private: equipment lives on the coach not the swimmer. Masters: needs "no fly for Linda," per-swimmer stroke/equipment exclusions. Club: wants group-by-level scaffolding. All three want the picker to honor a per-swimmer constraint vector, not just pace.
- **Roster model is too heavy for non-club use.** Summer-League ("40 kids will never sign in with Apple... assistant volunteer can't easily get an invite"), Private ("managed swimmers good, but parent layer missing"), Masters ("DOB is a compliance gate... friction without value for adults"). Three different escapes from the same youth-club-shaped data model.
- **The 4-section main-set structure is rigid.** Private explicitly ("90% drill kid lesson fights me"), Summer-League implicitly ("6&U does 400-600yd in 25s"), Masters partially ("set-swap is one set at a time"). Forced WU/Drill/Main/CD with ~65% main yardage doesn't fit lessons, learn-to-swim, or "drop all fly" mid-practice editing.

## §2 — Contradictions

- **Compliance heaviness.** Club wants MORE (MAAP/SafeSport, two-deep, parent CC, anonymized exports). Masters wants LESS (no DOB for adults). Summer-League wants to bypass it entirely (no accounts). Resolution: team-type-driven compliance posture, not a global toggle. Both legitimate.
- **Roster depth.** Club wants TeamUnify/SWIMS/Meet Manager integration (heavy). Summer-League wants "Lane 1/2/3, no roster at all" (none). SetForge needs both as modes — anonymous lane plans for summer/whiteboard, full integration for club. Don't pick a side.
- **Content tier.** Summer-League's #1 ask (Youth/Learn-to-Swim, 200yd floor, 25s) directly contradicts the bank's adult-coded vocabulary that Masters cites as a strength. Different content packs, not different settings — real "do we serve <10yo?" decision.
- **Price ceiling.** Summer-League "No" at $10 (7-week season, booster money). Club "No" at $25 (won't replace existing stack). Private/HS/Masters all "Maybe" at $10. Pricing is right for the maybes; summer-league probably needs a seasonal SKU or to be conceded.

## §3 — Verdict landscape

See "At-a-glance" table above.

## §4 — Roadmap candidates (ranked)

1. **Per-swimmer constraint vector** (equipment + stroke/equipment exclusions) · unlocks Private, Masters, partial Club · **M** · Touches one data model; Private and Masters both flip to "yes," Club moves closer.
2. **Meet-anchored season/taper** (championship date drives phase auto-shift) · unlocks HS, partial Club, partial Summer-League · **M-L** · Three coaches name this; HS flips cheap version; Club's full periodization is the L extension.
3. **1-page whiteboard print** (large-font landscape, Lane 1/2/3, no roster names) · unlocks HS, Summer-League, bonus Private · **S** · Smallest cost, three coaches want it, mostly a new print view over existing data.
4. **Lesson / Learn-to-Swim content tier** (200-1200yd floor, 25s sets, no-interval mode, no forced main) · unlocks Private, Summer-League · **L** · Two segments locked out without it; high cost because it's bank content + structure rules.
5. **Team-type-driven compliance posture** (Masters skips DOB, Club gets MAAP scaffolding, Summer-League can run rosterless lane plans) · unlocks Masters, Club, Summer-League · **M** · One refactor that resolves three contradictions cleanly.

## §5 — Meta-critiques (what the exercise missed)

- **No one stress-tested onboarding.** Every persona arrived knowing the feature set. The real first-30-minutes friction (Apple OAuth gate, manual update, finding Mix toggle) is invisible here.
- **No reliability/latency feedback.** Engine fallback rates, generate times, mobile-on-deck-with-bad-wifi behavior — coaches on deck care, archetypes don't.
- **Pricing willingness is shallow.** Three "maybes" all cite missing features, but none addressed "if those ship, would you actually convert?" — anchoring on features may understate brand/trust/switching-cost barriers.
- **Archetype bias toward feature-completeness.** Real coaches often pay for one wedge feature and ignore 80% of the app. The critiques over-index on "doesn't replace my stack" when SetForge may not need to.
- **No one evaluated the swimmer-side experience.** Coach-pays-swimmer-free is the pricing thesis; zero personas tested whether swimmers actually use what coaches assign them.

---

## Verbatim coach reports (input data, preserved for audit)

### Private coach

**Top 3 strengths**

1. **Generate-on-the-fly speed.** Pick type → set yardage → tap Generate → swap individual sets with ⇄ or regen one block. Workout in <30 sec while the kid is still climbing out for a sip of water. Time presets (~60/~90) and per-set inline editing (click an interval, type, Enter) match how I actually program at the wall.
2. **Multi-pace print + lane plans.** Even for 2-on-1, this is gold: same workout, two paces, one printed sheet. The Per-lane pages render (one page per swimmer) means parents on the deck can follow along, and I'm not re-doing the interval math for a 9-year-old vs. an adult masters athlete in the same lesson slot.
3. **Managed Swimmers + Coach notes.** First-class roster of athletes who don't have logins (perfect for 9-year-olds and most parents), DOB-driven minor handling, per-swimmer timestamped notes panel with Private visibility. Replaces my Notes app and spreadsheet. Bulk CSV import + parental_contact field is exactly the onboarding flow I need.

**Top 3 gaps**

1. **The whole app assumes a "main set" workout.** Every workout is forced into Warm-Up / Drill / Main / Cool-Down with the main set carrying ~65% of yards. For a 30-min kid lesson that's 90% drill + technique with no real "main," the structure fights me. Even Mix pills' "drill-heavy" only pushes drill to ~26%. There's no "kids/lesson" type, no skill-progression scaffolding, no way to anchor a workout around a single concept (e.g., streamline off the wall).
2. **No per-athlete equipment.** Equipment selection is saved to MY account. I coach a 9yo with no gear and an adult masters swimmer with paddles+buoy+snorkel back-to-back. I have to remember to retoggle every lesson, or generate before remembering and get a workout the kid can't do. Same for pace — pace lives on the athlete record (good), but Equipment doesn't.
3. **No parent-facing share.** Parents want to see what their kid did. "Copy Text" + paste to text is the workaround, but there's no native "send today's session to parental_contact" — and parental_contact is sitting right there in the swimmer record. Coach notes are coach-only by design (correct), but there's no parent layer at all. Also: ~$60-90/hr clients expect a polished summary, not a plain-text dump.

**Top 3 prioritized requests**

1. **Per-managed-swimmer equipment profile.** Store equipment three-state on the swimmer record alongside pace. When I pick a swimmer in "Generate for," their equipment loads. One-line scope.
2. **"Lesson" workout type.** A short-form (15-60 min, 200-1200 yd) structure without a forced main set — Warm-Up / Skill Focus 1 / Skill Focus 2 / Send-off. Reuses the Drill bank + Focus Note prominently. Probably 80% of my actual usage.
3. **Parent recap export.** One button on a completed assignment → branded one-pager (workout + focus note + difficulty + my coach note marked "Shared") → either printable PDF or mailto: prefilled to parental_contact. Closes the loop from "managed swimmer" to "parent sees value."

**Would I pay $10/month?** Maybe — the Multi-pace + Managed Swimmers + Coach notes combo is worth $10 even at my low volume (say 8-12 athletes), but the lack of per-athlete equipment and the forced 4-section main-set structure mean I'm spending more time fighting the generator than using it for kid lessons, so I'd want the Lesson type or the equipment fix before committing.

### Summer-League coach

**Top 3 strengths**

1. **Multi-lane generate + per-lane print (v2.0 + N6)** — biggest win. I split 50 kids into 4-6 age groups across lanes with wildly different paces; one workout fits all lanes and I print one page per lane. This is the only feature that matches my actual deck reality.
2. **Recovery Mode + low-yardage floor drop to 1,200yd** — Wednesday-meet days I want easy 30-min taper-ish sessions for the 11-12 and up. Toggle is one click.
3. **Quick-launch "Pick up where you left off"** — when I show up 10 min before practice and need *something*, two taps to start a known-good workout off my phone beats whiteboarding from scratch.

**Top 3 gaps**

1. **No "kids who can't swim 100 yet" content tier.** Yardage floor is 1,900yd SCY (1,200 in Recovery). My 6&U group does maybe 400-600yd a practice in 25s with rest. Pace baseline of 2:30/100 (Recreational) still implies they can hold 2:30 for any distance — half my swimmers can't. No "learn-to-swim", "stroke survival", "25s with rest interval" mode. The "Summer" team type only changes minor-protection rules — the workout content is identical to Masters.
2. **No DQ-avoidance / legal-stroke / IM-order / relay-exchange sets.** This is 80% of summer-league coaching — breast pull-outs, fly two-hand touches, back finish on the back, IM order, relay take-offs. "Butterfly" workout type generates butterfly main sets, not "5x25 breast checking pullout legality." No drill bank tagged for stroke-legality.
3. **Roster model assumes swimmers have accounts.** Managed swimmers + DOB + claim flow + invite codes are built for year-round clubs. My 40 kids will never sign in with Apple — I'd be entering 40 managed profiles with DOBs just to use lane plans, and the "Assigned to me" / completion tracking is dead weight because parents drop kids off and leave. Even the assistant HS volunteer can't easily get an invite-only login.

**Top 3 prioritized requests**

1. **Beginner content + low-yardage floor.** Add a "Youth / Learn-to-Swim" workout type (or team-type-driven content swap) with 25-based sets, generous rest, slider floor 200yd, optional "no interval — wait for the whistle" mode. Without this, 60% of my swimmers can't use SetForge.
2. **Meet-prep set bank.** Legal-stroke drills tagged per stroke (breast pullout, fly two-hand, back finish), IM-order sets, relay take-off sets, dive-start sets. Drives a "Meet prep" workout type and an "before the meet on Wednesday" preset.
3. **Whiteboard mode + roster-free lane plans.** Generate → giant landscape view sized for whiteboard transcription, with per-lane paces shown by lane label only (Lane 1/2/3 — no swimmer names, no accounts, no DOBs). Strip the team/group/assignment scaffolding from the multi-lane flow for coaches who don't need it.

**Would I pay $10/month?** No. For 7 weeks a season on booster-club money, $70 buys me a feature set built for year-round masters/club coaches — and the parts I'd actually use (multi-lane print, recovery mode) don't outweigh the missing beginner content and meet-prep sets.

### High School coach

**Top 3 strengths**

1. **Multi-lane Generate + N6 print** — picker honors a per-lane pace range and auto-routes to MultiPacePrintView. I run 2-3 lanes by ability; one workout that fits all of them with a per-lane printout is exactly the daily artifact I need on deck.
2. **Plan an Intent + Repeat Week + Group fanout** — let me sketch Mon distance / Tue technique / Wed sprint, copy to next week, and have it auto-assign to group members. Matches how an HS season actually runs: a repeating microcycle.
3. **Tri-state Fav/Disfavor with coach propagation + Curation Impact** — I can teach the bank what my program looks like in a few weeks, and my picks silently bias every swimmer's generator. With 30-50 athletes I cannot tune one-by-one, so propagation is huge.

**Top 3 gaps**

1. **No taper/season periodization scaffolding.** Training-phase pills (Base/Build/Peak/Taper/Recovery) are per-group manual flips — there's no season anchor, no "weeks until championship" countdown, no auto-progression. For a 3.5-month season ending at state, I'd want to set a championship date and have phases shift on a schedule.
2. **Events calendar is name+date only — no meet integration.** §1432 says v1 captures "just name + date." No taper-from-meet, no meet-week template, no event-aware Generate ("it's Wednesday of championship week — give me sharpening, not threshold"). For HS this is *the* feature.
3. **No HS-specific event/race templates.** Workout types are stroke + zone based. I don't see anything that says "200 IM race-pace simulator" or "100 free broken-200 set" or "relay start practice." The bank skews club/year-round-aerobic; main creative-sets expansion is generic stroke mechanics. Also: no kick-set focus mode and no obvious dryland/start/turn surface.

**Top 3 prioritized requests**

1. **Meet-date-driven taper auto-shift.** Tie Training Phase to the Events calendar: set state-meet date → phase auto-rolls Base→Build→Peak→Taper across the season. Even a dumb "X weeks out → suggest phase Y" would be 80% of the value.
2. **HS race-pace template pack.** Templates keyed on HS events: 50/100/200/500 free, 100 stroke, 200 IM, plus a relay-exchange set. Wire them as named bank labels so I can favorite the ones I trust and they propagate to the group.
3. **Print-the-whiteboard quick view.** A 1-page, big-font, lane-split workout printable I can post pool-deck without opening MultiPacePrintView's per-lane multi-page flow. Coach tier has Run mode + reports, but the daily artifact I actually need is a single printable page.

**Would I pay $10/month?** Maybe. The multi-lane generator + propagating curation + week planner are genuinely useful, but without meet-anchored taper or HS race templates I'd still write championship-week sets by hand — at $120/yr out of my own pocket (school won't reimburse niche SaaS), I'd want the season scaffolding before committing.

### Club coach

**Top 3 strengths**

1. **Template Engine + Bank/Engine/Mix toggle with anti-repeat + favorites/disfavorites propagation** — the per-section toggle, validator, 3× favorite / 0.25× disfavor weighting, and coach-to-swimmer propagation is genuinely thoughtful. For my Senior group this is more flexible than Commit Swimming's static workout library.
2. **Multi-Lane Generate (v2.0) + Multi-Pace Print (N6)** — `optionFitsAllLanes` + per-lane print pages is the right primitive for lane-differentiated practice. This is the one thing Commit Swimming doesn't do well and TritonWear doesn't touch.
3. **UGC coach-authored sets with team-sharing + admin moderation + graduate-to-JS** — assistant coaches can share to my team, propagation is automatic, and the audit trail (reviews table, promoted_at) is real. Better than emailing PDFs around the staff.

**Top 3 gaps**

1. **No periodization, no season plan, no macro/meso structure.** Training phase is a single dropdown (Base/Build/Peak/Taper/Recovery) per generate. There's no concept of a season tied to championship meets, no mesocycle templates, no auto-shift from Build→Peak at week N. For a year-round USA-S club this is table stakes — Commit Swimming, MyCoach, Hudl Workouts all have it.
2. **No age-group / level differentiation, no SafeSport-grade compliance model.** RELATIONSHIPS_SCOPE wasn't in the repo, but ROADMAP/memory show DOB collection and a minor-bypass for Discord — that's it. No MAAP-compliant communication channel (1-on-1 with minor blocked, two-deep visibility, parent CC), no group-by-level scaffolding (Bronze/Silver/Gold), no qualifying-times tracking. Reports name swimmers; export does no anonymization. I cannot put this in front of my Platinum group's parents.
3. **No time/split tracking, no meet integration, no parent comms, no data export beyond markdown.** Reports don't ingest TouchPad/Meet Manager/SWIMS results. No CSV of attendance, no .hy3, no integration with TeamUnify/SwimTopia for roster sync. Run Mode logs splits in-browser but there's no analytics on them. Compared to TritonWear (in-water metrics) or even Commit Swimming (TM/Meet Manager hooks), the data layer is too thin.

**Top 3 prioritized requests**

1. **Season planner with meet anchors** — pick championship meets from a calendar, app builds 12-26 week macrocycle, auto-rotates training phase weekly, dashboards show "Week 6 of 14 toward Sectionals." Without this I'm hand-mapping the existing single-toggle phase weekly.
2. **MAAP/SafeSport compliance pack** — DOB-gated UI, two-deep coach requirement on minor groups, parent contact field per swimmer, parent-visible read-only view of their athlete's plan, attendance export to PDF for safety logs.
3. **Roster import + results integration** — TeamUnify/SwimTopia CSV import, SWIMS-format times import, basic meet-results view tied to athletes, CSV/Excel export on every report. Today I'd run SetForge in parallel with my real systems, which kills the value prop at $25.

**Would I pay $25/month?** No (for the program, not personally). At ~30 athletes the Program tier total cost is fine, but it doesn't replace anything in my stack — I'd still pay Hudl + TeamUnify and use SetForge as a workout-idea generator. Revisit if periodization + roster import + MAAP-grade compliance ship.

### Masters coach

**Top 3 strengths**

1. **Multi-lane generate + per-lane print** (MULTI_LANE_GENERATE_SCOPE + N6 MultiPacePrintView): pace-aware picker filters options so every set fits ALL lanes (MIN_REST=5s, MAX_REST_RATIO=1.5), plus per-lane printed pages from one workout. Reusable lane plans per group with named lanes ("Sprint @ 1:50, Aerobic @ 2:05, Recovery @ 2:20"). This is the single most masters-relevant feature.
2. **Bank vocabulary is plausibly adult**: 2:00/100 baseline, "Masters" pace preset, no kid-coded language, mature focus cues (DPS, stroke count, threshold, race-pace). The 12-template engine + 1,311-option flat bank give real variety. Equipment palette (paddles/pull buoy/snorkel) matches what adults bring.
3. **Coach curation infrastructure**: tri-state fav/disfavor at label/set/engine-template levels, **0.25x downweight OR hard-exclude**, auto-propagation from primary+assistant coaches to swimmers in their groups, plus UGC ("My Sets" + snapshot from any block) with private/team/public tiers. Lets a Masters coach kill sets that hurt shoulders without deleting them globally.

**Top 3 gaps**

1. **No injury/modification workflow.** Zero search hits for "injury," "shoulder," "knee," "substitute," or per-swimmer constraint. Disfavor is the only workaround — it's blunt, not "skip fly for Linda this month." Mid-practice modification is manual editing only (set-swap is one set at a time, not "drop all fly for swimmer X").
2. **Same workout across multiple sessions is awkward.** Lane plans are per-group, but a single workout that runs at 5:30am, noon, and 6pm with different rosters in different lanes each time has no first-class concept — you'd Repeat-next-week or copy-from-history rather than "this is one practice with three deliveries." Attendance is per scheduled_workout row only.
3. **Adult-program features are stuck behind a youth-centric data model.** DOB is a compliance gate, team types include "high_school" with FERPA-shape, manual leads with "minor protections." Masters coaches don't need DOB collection or roster claim flows for adults — friction without value. PRICING.md and RELATIONSHIPS_SCOPE.md are referenced in memory but absent from the repo, so I can't verify pricing/relationships beyond the manual.

**Top 3 prioritized requests**

1. **Per-swimmer constraint tags** (stroke exclusions, equipment exclusions, "no fly," "pull-only this week"). Should compose with existing disfavor and flow through the picker the same way coach-propagation does. Highest masters value; closes the injury gap.
2. **Multi-lane: widen the pace spread tolerance OR surface a "ghost lane" mode.** MIN_REST=5/MAX_REST_RATIO=1.5 will empty the pool on a real 1:10–2:45 lane spread (likely fallback-banner every time). Need either (a) per-lane interval overrides on the same set, or (b) bucket lanes into 2 print groups automatically.
3. **"Same practice, multiple sessions" object** — one workout, N delivery rows (time + location + roster + lane plan), one attendance pass per delivery. Eliminates the copy/paste loop for AM/noon/PM coaches.

**Would I pay $10/month?** Maybe-leaning-yes. Multi-lane generate + per-lane print alone beats my Google Doc, but without per-swimmer injury handling I'd still maintain a side spreadsheet — fix that and it's an easy yes.

---

## Open follow-ups (for future-Cap'n)

- The "no one evaluated the swimmer-side experience" meta-critique is the highest-leverage thread. Pricing thesis is coach-pays / swimmer-free; if swimmers don't actually use what coaches assign, the whole free tier is dead weight on infra. Worth its own evaluation pass (1-2 swimmer personas?).
- The "no one stress-tested onboarding" critique should probably be run by an actual first-time user rather than another agent — agents already know the feature names.
- Summer-League's "No" is structural (booster-club money + 7-week season). Either build a seasonal SKU (cheap if PRICING.md allows for it) or formally concede the segment.

## Reconciliation — missing-docs finding (2026-05-25)

The Club coach's note that *"PRICING.md and RELATIONSHIPS_SCOPE.md are referenced in memory but absent from the repo"* (Top 3 Gaps §3) was first reported here; the swimmer + team evals reproduced it. Audit on the same day confirmed both docs had NEVER existed in git history despite 5+ code/manual/ROADMAP references. Both reconstructed 2026-05-25:

- **RELATIONSHIPS_SCOPE.md** — as-shipped design history of the Stage 1-4 relationships work (Stage 5 rolled back, survives at git tag `relationships-complete`). Reconstructed from memory checkpoint.
- **PRICING.md** — 2026-05-19 workshop content + revisions driven by this evaluation sweep (Supporter $3 demoted to tip jar per cross-eval no-signal finding; Lesson tier added per Private coach Top 3 Request #2; Program tier gated on team-curation + paper kit shipping per team eval).

---

*Generated 2026-05-25 by 5 parallel persona agents + 1 synthesis agent. Documentation-driven evaluation; no live-app interaction. See memory `swim_generator_coach_evaluation_2026_05_25.md` for archive pointer.*
