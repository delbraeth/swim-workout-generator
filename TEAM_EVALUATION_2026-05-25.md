# Team evaluation — 5 personas + synthesis

**Date:** 2026-05-25
**Method:** 5 parallel agentic team-perspective personas (Head Coach as Team Admin, Assistant Coach, Team Manager / Meet Director, Board Treasurer, Lifecycle / Records Manager) + synthesis pass. Documentation-driven (no live-app interaction). Third evaluation in a series — see also [[swim-generator-coach-evaluation-2026-05-25]] and [[swim-generator-swimmer-evaluation-2026-05-25]].
**Why:** prior two evaluations covered single-coach and individual-swimmer/parent perspectives. Team eval tests the multi-stakeholder, governance, billing, lifecycle, and operations dimensions distinct to a multi-coach club tier — the Program tier ($25/mo) value proposition. Cap'n explicitly asked for the full 5-persona scope after I'd recommended deferring.

---

## At-a-glance verdict

| Persona | Verdict | Single blocker | $ scope | Accountability |
|---|---|---|---|---|
| Head Coach (Team Admin) | **No, not today** (maybe 6mo) | No team-level fav/disfav tier | $300/yr | Personal-ish (board-influenced) |
| Assistant Coach | **Maybe-leaning-yes** (2yr) | Cross-assistant invisibility + no portable export | $120/yr personal | Personal |
| Team Manager / Meet Director | **No** | Wrong product category | $300/yr | Board |
| Board Treasurer | **TABLE** (same-day yes w/ paper) | No DPA/invoice/continuity | $300/yr | **Board fiduciary** |
| Lifecycle / Records Manager | **Conditional NO** | Cascade-wipe + no self-serve export + no retention contract | n/a (policy review) | **Board fiduciary** |

Two of five (Treasurer, Lifecycle) carry board fiduciary weight — those are the dispositive votes for a 501(c)(3) pilot.

## The team-tier reality check

**Program tier ($25/mo) is billing chrome over four coach-tier accounts.** Head Coach (Team Admin) said it plainly:

> "asked to pay program-tier money for what is structurally still four parallel coach-tier accounts with shared chrome. Board will ask 'what does $300/yr buy us vs. four $10 coach seats?' and I cannot answer that until team-level inheritance exists."

The skeleton exists (teams, team_coaches, role models, revoke-on-fire, R5/R6 per-team filter, UGC team-share). That's genuinely more than glue — but there is **no team-level curation primitive**. Favorites/disfavorites propagate coach → that coach's swimmers, never coach → team → other coaches' swimmers. There's no `team_favorites` table, no team pace baselines, no team disfavor-mode default, no team vocabulary toggle, no Owner-of-team-scoped Settings surface at all. Every `settings.extra` field is per-user.

## Top 5 team-tier roadmap candidates (synthesis ranking)

1. **Self-serve full-account JSON export + tombstone-on-delete** — unlocks Lifecycle + Treasurer + Assistant + 4 of 5 swimmer-eval personas — **M** — 7+ persona finding across all 3 evals; required for any board approval
2. **Team-level fav/disfavor tier + Team Settings page** — Head Coach (primary), Assistant (transparency variant) — **M** — the single change that converts "billing chrome" into "team programming platform"
3. **Vendor paper kit** (DPA template + EIN-bearing invoice + 90-day shutdown/export clause) — Treasurer (decisive) — **S** — non-engineering, pure legal/ops, same-day approval lever per Treasurer's own words
4. **Outbound email (transactional) + retention policy in privacy doc** — Team Manager + Treasurer + swimmer-eval email-infra finding — **M** — already a swimmer-eval top-5
5. **Ownership transfer + UGC reassignment on departure** — Head Coach + Assistant + Lifecycle — **M** — without it, every team is structurally orphaned-on-founder-exit; fatal for multi-year commitment

## Triple-cross-validated findings (all 3 evals)

These are the highest-leverage items on the entire product:

| Finding | Coach eval | Swimmer eval | Team eval |
|---|---|---|---|
| **Per-swimmer constraint vector** | Top-5 | Top-5 | Implicit in Head Coach's "team philosophy" + Assistant's request-to-head |
| **Data portability / one-way export** | — | Top-5 (one-way export) | Top concern of 4/5 personas |
| **Google OAuth + email infrastructure** | — | Top-5 | Team Manager: hard blocker; Treasurer: breach-notification SLA needs it |
| **Team-type compliance posture** | Top-5 | — | Treasurer + Team Manager + Lifecycle — all 3 want it |
| **Progress/programming dashboard** | — (R-reports cover some) | Top-5 | Head Coach: R5/R6 are closest, still want team-philosophy roll-up |

**Leaders: data portability and compliance posture.** Both show up across every audience.

## Severe team-only findings (pilot-blockers, not nice-to-haves)

1. **No vendor contracting surface** (Treasurer) — no DPA, no W-9, no EIN-bearing invoice, no COI, no SOC2 statement, no signed services agreement template. Patreon receipts don't pass a board auditor. **This single gap means no 501(c)(3) board can approve the spend cleanly regardless of how good the product is.**
2. **Single-operator key-person risk + no continuity plan** (Treasurer, Lifecycle) — "may be discontinued," personal Gmail, no escrow, no successor, no shutdown export commitment.
3. **Cascade-wipe on account delete** (Lifecycle) — destroys other users' attendance/workout records when a coach exercises GDPR rights. Direct conflict with 501(c)(3) 7-year retention.
4. **No self-serve export** (Lifecycle, Assistant, Head Coach) — "email the one guy" is the export pipeline.
5. **No team-level curation tier** (Head Coach) — the structural reason Program tier doesn't exist as a product.
6. **Roster changes gated to isPrimary with no request flow** (Assistant) — operational friction the swimmer-side never sees.

Items 1–4 collectively block any USA-S 501(c)(3) board approval today.

## Contradictions

**Within team eval:**
- **Treasurer vs. Head Coach blocker mismatch.** Treasurer would approve same-day with paper (DPA + invoice + shutdown clause). Head Coach won't sign off until team-curation exists. Different blockers → fixing one without the other doesn't unblock a pilot.
- **Assistant Coach wants transparency into head coach's curation; Head Coach wants centralized control.** Both reasonable, opposite UI pulls.
- **Team Manager says "not your product, don't try"; Treasurer + Lifecycle say "must serve this role to be board-approvable."**

**Cross-eval:** No genuine cross-eval contradictions — the three evals stack consistently. Coach eval's enthusiasm for curation/engine doesn't contradict team eval; team eval just says "great, but it stops at the coach boundary."

## Pricing implications (all 3 evals in hand)

**The four-tier model (Free / Supporter $3 / Coach $10 / Program $25) does not hold up as written.**

- **Program tier ($25) should not be advertised until team-curation ships.** Today it doesn't earn its $15 delta over four Coach seats. Sell teams four Coach seats and be honest.
- **Supporter ($3)** has no team-eval signal and weak swimmer-eval signal. Defensible as a tip jar, indefensible as a product tier. **Fold into a "donate" button** to reduce decision surface.
- **Program tier needs a paper SKU when it relaunches** — DPA + invoice + W-9 + COI on request. Quote as annual contract ($300/yr invoiced) to match how boards approve.
- **Lesson tier (Coach-eval top-5) is a real fifth tier with demand.** Worth more than Supporter.

Proposed post-roadmap shape: **Free / Coach $10 / Lesson $? / Program $25 (annual, invoiced, with paper).** Kill Supporter or demote to tip jar.

## The single hardest thing to swallow

> **SetForge is currently a single-coach tool with excellent multi-tenant chrome — and the people who would write the $300/yr check (boards, registrars, treasurers) cannot legally or fiduciarily approve it today, regardless of how good the engine, UGC system, or curation propagation is.**

The hard part isn't that team-tier needs more features — Cap'n knows that. The hard part is that **the work required to unlock team-tier is largely non-engineering**: vendor paper, DPA, EIN-bearing invoices, continuity commitments, retention policy, COPPA verifiable consent flow, ownership transfer. These are the items the "single-operator hobby project" identity actively conflicts with. **Program tier requires SetForge to stop being a hobby project on the cover page — not in the code.**

## Incidental findings

- **PRICING.md and RELATIONSHIPS_SCOPE.md confirmed absent from disk** (third independent persona to surface this — first was solo swimmer, now team personas). Worth a 1-minute audit.
- **Manual line 1406 explicitly says "ownership transfer is a planned future flow."** Head Coach surfaced this; it's a known gap, not a hidden one.

---

## Verbatim persona reports (input data, preserved for audit)

### Head Coach as Team Admin

**Top 3 strengths**

1. Team role model exists end-to-end. `teams` + `team_coaches` with Owner/Admin/Coach roles, primary + assistant `group_coaches` with `removed_at` soft-delete, archive (not delete), audit events on every mutation. The skeleton for revoke-on-fire is real — `DELETE /api/teams/:id/coaches/:sub` sets `removed_at`, and `dbGetEffectiveDisfavorites` filters `removed_at IS NULL` so a fired coach's curation stops biasing swimmers' pickers immediately. More than a coach-only tool with multi-tenant glued on.
2. R5/R6 admin reports + per-team filter. `dbGetPlatformHealth({teamId})` plus R6 Curation & Support give an admin a per-team rollup. Closest thing to "show me what my assistants are programming for Silver."
3. UGC team-share is the right primitive. `visibility='team'` + `bank_option_team_shares` (coach-of-team validated) with 👥 TEAM badge in WorkoutBlock and admin-moderation for public.

**Top 3 gaps**

1. **No team-level curation. Period.** Favorites/disfavorites propagate from coach → swimmers-in-that-coach's-groups. When I (head coach who direct-coaches only Senior) favorite a set, it propagates to Senior swimmers — NOT to Bronze/Silver/Gold assistants' pickers or their swimmers. No `team_favorites` table, no "team philosophy" surface. Cross-group coordination doesn't exist; each coach is an island propagating downward only.
2. No team-wide settings/defaults. No team pace baselines, no team vocabulary toggle, no team safety policy default, no team disfavor-mode default. Everything in `settings.extra` is per-user. R5 is admin-only (global), not Owner-of-team.
3. No data portability, no ownership transfer, no UGC reassignment on departure. Manual line 1406 explicitly says "ownership transfer is a planned future flow." If I leave Sharks AC, the team is structurally orphaned.

**Top 3 prioritized requests**

1. Team-level fav/disfavor tier above coach-level. New `team_favorites`/`team_disfavorites` tables, Owner/Admin write, `dbGetEffectiveFavorites(userSub)` unions own + coach + team. UI: Team Settings page with same tri-state buttons. Single change that converts SetForge from "individual coach tool with team chrome" to a team programming platform.
2. Ownership transfer + team data export + UGC reassignment.
3. Team Settings surface with role-gated defaults (default pace baseline, disfavor mode, equipment restrictions, minimum two-deep rule, default note visibility).

**Sign off $25/mo Program tier?** **No, not today** — maybe in 6 months. Reasoning: asked to pay program-tier money for what is structurally still four parallel coach-tier accounts with shared chrome. Board will ask "what does $300/yr buy us vs. four $10 coach seats?" and I cannot answer that until team-level inheritance exists.

### Assistant Coach

**Top 3 strengths**

1. The `is_coach` flag is binary — I'm not a second-class coach in the UI. Once Head Coach adds me as `role: "assistant"`, I get Generate-for-group, Run Mode, Mark-practice-done, full UGC suite (📝 My Sets, snapshot, team-share, even submit-to-Public), Reports for my group, fav/disfav curation that propagates to my swimmers same as the head coach's.
2. Practice-day execution is mine. Mark-practice-done is "owner OR active-group-coach" — I don't need head coach to close attendance.
3. My UGC is portable in principle. Copy Markdown reports + UGC rows tied to my `author_sub`. Engine fallback 3.9%, generator quality is real — when I show up at my next club's interview, I have receipts.

**Top 3 gaps**

1. **Roster/structural changes are gated to `isPrimary` (head coach) with NO request-to-head flow.** Adding members, lane plans (read-only for me), phase setting, group settings, join tokens, assistant-coach add/remove — all `isPrimary &&`. If a new kid moves up to Silver mid-week, I literally cannot add them. No "request approval" mechanism — I have to text her.
2. Cross-assistant invisibility. No "see other Sharks assistants' UGC" surface unless they specifically team-shared with me. No team feed, no browse-by-team.
3. **Coach propagation is silent and one-way.** Head coach's disfavor reshapes MY picker, but audit panel shows own-only — I can't see what she suppressed. Worse: her Coach Impact panel shows MY workouts in her reach/effectiveness counts. Asymmetric surveillance.

**Top 3 prioritized requests**

1. UGC "submit to Head Coach for blessing" tier. New visibility: `pending_team` — sits in her queue (mirror of AdminPendingUgc but team-scoped), she approves → becomes team-shared with attribution to me.
2. Team UGC browser + "what my coaches are curating" transparency panel.
3. Portable export at account level. JSON/CSV of UGC + history + curation.

**Using SetForge 2 years from now?** **Maybe-leaning-yes.** Architecture treats `is_coach` as binary not hierarchical — when I'm hired as Head Coach somewhere, I get full `isPrimary` with zero re-onboarding, and my UGC + curation history travel with my `author_sub`. Real loyalty path. But if cross-assistant + portfolio-export gaps stay open, I'll associate SetForge with "Jen's tool that I executed in" and shop around.

### Team Manager / Meet Director

**Top 3 strengths (if any)** — None.

The closest things to my workflow: team detail view with Members/Coaches/Groups/Events tabs (but Events is name+date only, Members is a roster not USA-S registration status, nothing for a non-coach to do); attendance recording (Phase A) — could feed billing in theory, but no export tied to dues; bulk CSV swimmer import (closest to roster ingest, but it's names/DOBs/paces for coach's picker, not USA-S IDs or compliance). None built for my job.

**Top 3 gaps**

1. **Zero compliance surface.** No SafeSport status, no USA-S member ID, no background-check expiry, no club-membership status, no DOB-derived "needs renewal in 30 days." Data model has DOB for picker gating only, not for the registrar's tickler file.
2. **Zero financial surface.** No dues tracking, no invoicing, no QuickBooks/Stripe hook, no payment status per swimmer, no fundraising ledger.
3. **Zero parent-comms / external-tools surface.** Server has no outbound email at all (confirmed from swimmer eval). No SportsEngine/TeamUnify/Hytek interop, no mass-blast tool, no .hy3, no meet-entry roster export, no facility booking.

**Top 3 requests (if SetForge wanted this role)**

1. Roster-as-people view with USA-S ID, SafeSport/BC/membership expiry, dues status, parent-of-record — plus "expiring 30/60/90" filter and CSV export.
2. Outbound email + mass-blast to swimmer/parent contacts already in DB.
3. TeamUnify/Hytek/SportsEngine CSV bridges — one-way export of active roster as meet-entry-friendly file.

**Would the team add this to MY toolset?** **No.** SetForge is a coach-and-swimmer product. The non-coaching team-staff role isn't an oversight to plug — it's a different product (TeamUnify/SwimTopia). If SetForge ever wants this segment, requests above are the entry ticket, but no-outbound-email finding has to ship first.

### Board Treasurer

**Top 3 strengths (governance)**

1. No dark-pattern data practices. Privacy policy explicitly: no analytics, no ad pixels, no third-party tracking, no data sales, no behavioral profiling. Cleaner than TeamUnify or SwimTopia.
2. Real audit log exists. Auth events, admin actions, rate-limit hits, CSRF rejections all logged. Recent impersonation system (v3) has 30-min caps, write-blocks server-side, dedicated table, per-request audit. Better internal-controls hygiene than most $300/yr SaaS.
3. Stated data-export and deletion rights. Privacy commits to JSON export and hard delete on request.

**Top 3 gaps that block board approval**

1. **Single-operator key-person risk with no business continuity plan.** Privacy: "no company, no employees, no investors." Terms: "no SLA, no uptime guarantee, hobby-operated, may be discontinued." Operator email is personal Gmail. If he gets hit by a bus, our roster + attendance + USA-S documentation evaporates. No escrow, no data-portability commitment on shutdown, no successor.
2. **No B2B contracting surface.** No DPA, no BAA-style data-handling agreement, no SOC2/SOC2-trajectory statement, no W-9, no invoice mechanism (pricing is "Patreon-tier" — Patreon receipts are not vendor invoices our auditor accepts cleanly). "Competition Aquatics, LLC" in footer but no EIN, no signed agreement template, no certificate of insurance.
3. **Compliance posture unfit for purpose for USA-S club.** No SafeSport language, no MAAP/two-deep alignment, no minor-handling policy beyond "we don't intend for under-13." Roster has DOB but no documented retention/segregation. No COPPA verifiable parental consent flow.

**Top 3 prioritized requests**

1. Written vendor agreement + invoice path — counter-signed services agreement, DPA addendum, W-9, EIN, real Stripe/QBO-compatible invoice.
2. Shutdown/continuity clause — 90-day notice + automated JSON export of all team data + open-source escrow OR commitment to publish migration scripts.
3. Compliance commitment letter — written attestation on under-13/COPPA, breach-notification SLA in hours, SafeSport-aligned impersonation logging visible to team admin, retention schedule per data class, sub-processor list.

**Board verdict: TABLE — insufficient info.** "$300/yr is under threshold and product looks legitimate, but vendor is a single hobbyist with no contracting surface, no continuity plan, and no compliance posture appropriate for a 501(c)(3) holding minor athlete data — get me a signed services agreement, real invoice, and written shutdown/export commitment, and I'll approve it the same day."

### Lifecycle / Records Manager

**Top 3 strengths (long-term data)**

1. Append-only relationship history. `team_coaches` and `group_coaches` use `removed_at` not DELETE. A coach who leaves in 2026 still has 2024 group attachments queryable. Same pattern on `group_members` with `added_at`/`left_at`. Right shape for "who was on what roster, when."
2. Soft-archive on teams, groups, swimmers. Archive button hides without deleting. Toggle restores. Matches summer/winter split-roster reality.
3. Audit-log anonymization on delete, not deletion. Audit rows survive account deletion with `user_sub` NULLed. Impersonation events carry both target + impersonator subs.

**Top 3 gaps**

1. **No swimmer data portability.** Privacy says "email the operator and we'll export your workouts/favorites/settings as JSON." A solo human IS the export pipeline. No self-serve takeout button anywhere in the UI (only markdown report export + CSV roster template). When a swimmer leaves Sharks for Stingrays, no "take your history" path.
2. **Cascade hard-delete on account removal.** Account deletion `cascade-wipes workouts, favorites, settings, sessions. NOT REVERSIBLE.` If a former coach demands deletion (GDPR/CCPA), swimmers' attendance + workout records that referenced him collapse. No "anonymize the coach, preserve the data" path equivalent to what audit_events gets. USA-S audit two years later asking "who coached this practice in 2024" returns null.
3. **No retention policy, no archival workflow, no USA-S story.** Zero mentions of "retention," "USA-S," "audit," "year-end roster cleanup," or "alumni" anywhere. The 501(c)(3) 7-year retention obligation isn't acknowledged.

**Top 3 prioritized requests**

1. Self-serve full-account JSON export (workouts + assignments + attendance + notes + group history). Should also produce roster-scoped export for board secretary ("all swimmers who were ever on the 2024 JO group, with attendance"). ~1 session.
2. Tombstone-on-delete instead of cascade-wipe — at least for coaches and managed-swimmer rows referenced by other people's data. Keep workout/attendance rows; replace identity with "former coach #N" or "departed swimmer." Mirrors what audit_events already does.
3. Retention/archival contract in writing. Privacy policy needs Records Retention section: how long workouts stay after archive, Spaceship backup retention in days, what survives account deletion, what under-13 record's retention looks like (COPPA has its own clock). Year-end roster snapshot admin export. Required for any 501(c)(3) records-retention policy a board signs.

**Lifecycle verdict: CONDITIONAL NO.** Would not put 5+ years of team's data into SetForge today: no self-serve export, deletion is destructive to other people's records, privacy contract is "email the one guy and hope" — fine for friends-and-family side project, disqualifying for USA-S-affiliated nonprofit with retention obligations.

---

## Open follow-ups (for future-Cap'n)

- Reconcile PRICING.md + RELATIONSHIPS_SCOPE.md absence-from-disk (3rd independent finding across the eval sweep).
- Decide on Supporter tier fate (kill / demote to donate / keep). Sweep doesn't support keeping it as a product tier.
- The "vendor paper kit" is non-engineering but high-leverage — counter-signed services agreement template + DPA + EIN-bearing invoice could ship without touching code.
- Team eval did NOT live-test claim flow / parent-managed handoff at 13 — same gap as swimmer eval flagged.

---

*Generated 2026-05-25 by 5 parallel persona agents + 1 synthesis agent. Documentation-driven evaluation; no live-app interaction. See memory `swim_generator_team_evaluation_2026_05_25.md` for archive pointer.*
