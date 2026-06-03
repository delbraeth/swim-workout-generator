# Lesson Tier — scope

**Status:** SPEC (2026-06-03). Promoted from `PHASE_5_SCOPE.md` item 1. Demand-gated:
build when a private/lesson coach actually asks, or when the first Coach-tier
downgrade request arrives. Two business decisions (price + the replace-vs-additive
fork) must be locked before building — flagged below. Source: `PRICING.md`
§"Lesson tier" + the coach-eval Private-coach persona.

## Why / audience
A paid tier **below** Coach for private / 1-on-1 / small-lesson coaches who want
more than Free but don't need club infrastructure (teams, groups, multi-coach,
Reports). The coach-eval Private persona said "Maybe at $10 *only* with
per-swimmer equipment OR a Lesson workout type" — i.e. Coach tier is mis-fit for
them, and these are tier-defining features for a distinct audience. Add the tier;
don't load these onto Coach.

## What's in it (value-add over Free)
1. **Lesson workout type** — 200–1200yd, **no forced main set**; section shape
   Warm-Up / Skill Focus 1 / Skill Focus 2 / Send-off.
2. **Parent recap export** — one-button branded one-pager sent to the swimmer's
   guardian contact after a lesson.
3. **Managed swimmer roster** — the existing Managed Swimmers feature (today
   Coach-tier; see the fork below).
4. **Per-managed-swimmer equipment profile** — equipment availability stored on
   the swimmer/person, not the coach (so each lesson client's kit is remembered).

Explicitly NOT included (these stay Coach/Program): teams, groups, multi-coach,
team curation, Reports, lane plans, anchors.

## ⚠ Decisions to lock before building
1. **Exact price.** Target $5–7/mo. **Recommend $6/mo** — a clear $4 gap below
   Coach ($10) so it reads as a real downgrade, not a rounding difference.
   Annual option ~$60/yr.
2. **Replace vs additive (the big one).** Per PRICING §"Lesson tier" open question:
   - **Option A — restructure:** managed swimmers move OUT of Coach INTO Lesson;
     Coach becomes "full-account swimmers only." Breaks the value prop for every
     existing Coach user → needs grandfathering + migration comms. High blast radius.
   - **Option B — additive (RECOMMENDED):** Lesson is a standalone cheaper tier
     (Lesson type + recap + per-swimmer equipment + a **capped** managed-swimmer
     roster); Coach is unchanged. Non-breaking, simplest, matches "don't load onto
     Coach." Differentiate from Coach with a managed-swimmer cap (e.g. ≤N).
   - If Option B: pick the **managed-swimmer cap** for Lesson (e.g. 10–15) or leave
     uncapped and differentiate purely on the club features Lesson lacks.
3. **iOS sequencing.** Ship **web (Stripe) first**, add the Apple IAP product
   after? Or both at launch (needs a new ASC IAP product + product-tier-map entry +
   `AppConfig.iapProductIDs`)? Lean web-first — iOS IAP adds an ASC review cycle.

## Build shape (deps mostly satisfied)
- **Tier plumbing** — add `lesson` to the product/tier map; entitlement gates key
  off `users.tier` (the grant/revoke + `tier_source` seam already exists from
  billing). Stripe: new price; iOS: new IAP product (per decision 3). Paywall reuses
  `PaywallView` / the web upgrade flow.
- **Lesson workout type** — a new workout type whose default section set is
  Warm-Up / Skill Focus 1 / Skill Focus 2 / Send-off with **no main**. ⚠ The engine
  currently treats the **main set as always-included** (manual: "Main set is always
  included"); a no-main type requires relaxing that invariant. The flexible-section
  work (skip/redistribute) shipped, so the section machinery is most of the way
  there; this is the one real engine change. (Cleaner still after the pluggable-
  section model, Phase 5 §5.1 — but not blocked on it.)
- **Parent recap export** — reuses guardians + `parent_contact_methods` + the email
  worker + the `parent-digest` template pattern. New per-lesson recap template +
  a "Send recap" button on a saved/assigned lesson. (Branded one-pager; PDF optional
  v1.1, email body v1.)
- **Per-swimmer equipment profile** — store equipment availability on the
  person/managed-swimmer record (small schema add) and have Generate read it for
  that swimmer instead of the coach's global equipment. Composes with per-swimmer
  constraints (already on the person).
- **Gating** — Lesson-only surfaces (Lesson type, recap button, per-swimmer
  equipment) appear for `tier=lesson` (and Coach/Program as a superset).

## Out of scope
Teams/groups/multi-coach/Reports for Lesson (those define Coach/Program). PDF recap
(email-body v1; PDF later). A separate Lesson-specific bank (reuses the canonical
bank filtered to the Lesson type's sections).

## Dependencies
- Identity ✓, guardians + `parent_contact_methods` ✓, email infra ✓, billing
  rails (Stripe + Apple IAP seam) ✓, flexible sections ✓ — **satisfied.**
- The no-main engine invariant change is the only net-new engine work.
- Cheaper/cleaner after the **SPA component split** (`SPA_BUILD_SPLIT_SCOPE.md`) and
  pairs with **Phase 6 Team Option Visibility** (a Lesson coach likely wants a
  simplified surface by default).

## Verification (when built)
`node --check` + babel-parse; engine byte-diff that existing types are unaffected by
the no-main relaxation; a Lesson-type generate produces the 4-section shape with no
main; recap email enqueues to the guardian (minor-bypass honored); tier gate shows
Lesson surfaces only at `tier ∈ {lesson, coach, program}`; Stripe (and, if in scope,
Apple IAP) grant flips `users.tier=lesson`.

## How to use this doc
Lock decisions 1–3 (price, replace-vs-additive + cap, iOS sequencing), then build.
Until a private coach pulls it forward, it stays parked here.
