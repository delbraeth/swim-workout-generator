# Relationships scope — teams / coaches / groups / swimmers

**Status:** v1.1 locked 2026-05-16; Stage 1-4 shipped 2026-05-16/17 (commits b217796..17c76ad); Stage 5 shipped then rolled back 2026-05-17 (rollback preserved at git tag `relationships-complete`).
**Origin:** initial scope drafted 2026-05-16, refined that day via coach roundtable (5 personas). Document reconstructed from memory checkpoint [[swim-generator-relationships-scope]] on 2026-05-25 after evaluation sweep flagged the source doc was missing from disk.
**Why this doc exists:** the implementation is shipped; this is the design history + locked decisions a future maintainer needs to reason about the resulting data model and surface.

---

## 1. Problem

SetForge began as a solo-coach generator. The relationships scope adds the data model and surface needed to support **multi-stakeholder workflows**: teams of coaches, groups of swimmers, assignment fan-out, claim flows, role hierarchies. Pilot-ready by end of Stage 4.

## 2. Architecture overview

- **Hybrid swimmer model.** Two kinds of swimmer records:
  - **Managed swimmers** (`coach_managed_swimmers`): no login; owned by a coach; full data (DOB, pace, etc.); used for kids who don't have phones/emails.
  - **Full-account swimmers** (`users.is_coach=0`): standard OAuth user with own settings, history, assignments.
  - **Claim path:** a managed swimmer can be claimed into a full account via a 10-char base36 token (30-day expiry). Identity diff captured at claim; coach values overwrite swimmer values per decision #24/#30.
- **Group-only membership.** Even a 1-on-1 private student is a group of 1. No "ungrouped" assignments. Simplifies all downstream logic.
- **Polymorphic group_members.** A member row points at EITHER a managed swimmer OR a full-account user — `CHECK exactly-one-of(swimmer_sub, managed_id)`.
- **Persistent reusable lane plans** per group, with multi-lane workout generation pulling from one.
- **3-tier team permissions:** `owner` / `admin` / `coach`. v1 UI surfaces only owner role; admin tier exists in data, exposed in Stage 5.
- **One team per group, immutable.** Group can't move teams. Archive + re-create instead.
- **Team type ENUM:** `high_school` / `summer` / `club` / `masters`. Each type has its own compliance rule profile (e.g., high_school surfaces FERPA-shape; masters skips minor scaffolding).
- **DOB collection** on every managed profile + at user signup. Minor status DERIVED live via `isMinor(dob, now)`, not stored. Decision #27.
- **Solo workflow stays top-level** — not modeled as a group-of-1. Decision absorbed from coach roundtable (Theme 8).

## 3. The 37 locked decisions

Organized by category. Full text was in v1.1 of this doc; reconstructed headlines below.

**Architecture (1-5, 9-14, 25-27):**
1. Hybrid swimmer model (managed + full-account)
2. Coach powers: read + generate-on-behalf + coach-mark-on-behalf
3. Group-only membership (private student = group of 1)
4. Polymorphic group_members (managed OR full-account)
5. Persistent reusable lane plans
9. 3-tier team permissions (owner/admin/coach)
10. One team per group, immutable
11. Team type ENUM with per-type rule profiles
12. DOB required on managed profiles; collected at user signup; minor status derived
13. **Decision #13:** Multi-pace generation respects per-member pace from group roster
14. **Decision #14:** Team owner can rename; archive vs delete distinction
25. **Decision #25:** Audit events on every relationship-mutating operation
26. **Decision #26:** Group archive is soft; cascades to member `left_at` stamps
27. **Decision #27:** Minor status is derived from DOB at query time, never cached

**Compliance / lifecycle (15, 16, 24, 30, 37):**
15. Notes journal (multiple per coach-swimmer pair)
16. Claim confirmation + 30-day token expiry
24. Conflict resolution on claim: coach values win
30. Post-claim diff screen surfaces every field change to swimmer
37. **Decision #37 (2026-05-16):** DOB backfill for legacy `users`: soft-prompt at next login, dismissable

**Coach roundtable items absorbed (28-35) — 2026-05-16:**
28. Minor protections — claim blocked under 13; roster-visibility forced off when minors present
29. Notes visibility enum: `private` / `group_coaches` / `team_coaches`
30. Post-claim diff screen
31. Ungrouped roster as first-class view (became the standalone Managed Swimmers screen)
32. `workout_id` FK on notes
33. One PRIMARY group per coach per swimmer (secondary memberships unrestricted)
34. Multi-state completion: `not_started` / `partial` / `complete` / `missed` + coach-mark-on-behalf
35. Solo workflow as top-level picker section, not group-of-1

**Decisions surfaced in implementation (38-39):**
38. Team events vs personal `next_event` pill — both coexist; team event pill takes leading position
39. Per-group `current_phase` + `phase_set_at` columns (override path for the generator's training-phase pill)

**Deferred to v2 (36):**
36. Theme 6 (per-set lane subdivision), Theme 10 (notifications), Theme 12 (long runway), full FERPA disclosure-log infra, notes categories/tags

## 4. Data model — 10+1 tables

Tables created across migrations 011-021 (migrations subsequently consolidated out of repo; DDL lives in production). Each row is `tablename — purpose — key columns — note`:

1. **`teams`** — top-level org unit — `id`, `name`, `type ENUM`, `owner_sub`, `archived` — one row per team
2. **`team_coaches`** — append-only coach roster per team — `team_id`, `coach_sub`, `role ENUM('owner','admin','coach')`, `added_at`, `removed_at` — never DELETE
3. **`coach_managed_swimmers`** — no-login swimmer records — `id` (`ms_<base36>`), `owner_coach_sub`, `name`, `initials`, `dob NOT NULL`, `parental_contact`, `parent_managed_flag`, `pace_25y`, `pace_25m`, `pace_50m`, `team_id FK SET NULL`, `gender`, `archived`
4. **`users.dob`** — added 2026-05-16 to support derived `is_minor` for full-account users — added via migration 013
5. **`users.gender`** — added 2026-05-16 alongside managed gender via migration 014
6. **`groups`** — cohort within a team — `id`, `team_id FK SET NULL`, `primary_coach_sub FK RESTRICT`, `name`, `pool_mode_default`, `roster_visible_to_members`, `current_phase`, `phase_set_at`, `archived`
7. **`group_coaches`** — append-only coach attachment per group — `group_id`, `coach_sub`, `role ENUM('primary','assistant')`, `added_at`, `removed_at`
8. **`group_members`** — polymorphic membership — `group_id`, `member_swimmer_sub`, `member_managed_id`, `CHECK exactly-one-of(...)`, `role ENUM('primary','secondary')`, `joined_at`, `left_at`, `reason`
9. **`team_events`** — calendar events at team level — `id`, `team_id FK CASCADE`, `name`, `date`, `created_by_coach_sub FK SET NULL`
10. **`workout_assignments`** — fanned-out assignments per swimmer per workout — `workout_id VARCHAR(32)`, `target_swimmer_sub`, `target_managed_id`, `CHECK exactly-one`, `assigned_via_lane_plan_id`, `completion_state ENUM`, `completed_at`, `completed_by_coach_sub`, `splits_payload JSON`, `difficulty`, `focus_note`
11. **`group_lane_plans`** — reusable lane assignments per group — `id`, `group_id`, `name`, `plan_data JSON`, `is_default`, `archived`
12. **`group_join_tokens`** — code-based group join — `token`, `group_id`, `expires_at`, `redeemed_at`, `redeemed_by_sub`
13. **`managed_swimmer_claim_tokens`** — managed→full-account claim path — `token`, `managed_id`, `expires_at`, `redeemed_at`, `redeemed_by_sub`

(Numbering: "10+1" refers to relationships tables proper plus the `users.dob`/`users.gender` add-on columns.)

## 5. 5-stage implementation plan — all shipped

| Stage | Theme | Hours | Sessions | Status |
|---|---|---|---|---|
| 1 | Foundation (teams + DOB + managed roster) | 7 | R-A, R-B, R-B' | ✅ Shipped 2026-05-16 |
| 2 | Cohort (groups + members + role) | 4 | R-C | ✅ Shipped 2026-05-16 |
| 3 | Assignment (generate-for + lane plans) | 8 | R-D, R-E | ✅ Shipped 2026-05-16/17 |
| 4 | 🎯 Pilot (full-account + completion + notes) | 11 | R-F, R-G, R-H | ✅ Shipped 2026-05-17 (R-H deferred — try/catch makes it optional) |
| 5 | Lifecycle (claim + admin tier + archive + docs) | 9 | R-I, R-J, R-K | ⚠ Shipped 2026-05-17, rolled back same day; survives at tag `relationships-complete` |

**Total: ~39h.** Real coach pilot became possible at end of Stage 4.

### Stage 5 rollback note (2026-05-17 ~03:20 UTC)

Stage 5 (R-I claim flow + R-J admin tier + R-K manual sweep), generator section-bias (Mix pills), and build-id-logging were rolled back from local source after Hyperlift's deploy queue got stuck on the Stage 4 / R-G build (02:22 UTC) and never processed subsequent commits. Rather than wait with multiple unshipped commits queued, Cap'n rolled local + GitHub back to 02:22 state.

- **Stage 5 code:** survives at `git checkout relationships-complete` (commit 17c76ad).
- **Migration 021** (`managed_swimmer_claim_tokens`) was **NOT** rolled back — table exists in prod, currently unused.
- **Next pickup options:** cherry-pick from the tag OR rebuild fresh now that the scope is understood. Section-bias ~2h to re-add; Stage 5 ~9h.

## 6. Coach roundtable (2026-05-16)

Five personas reviewed v1 of this scope. Outputs absorbed into v1.1:

| Coach | Background | Top inputs |
|---|---|---|
| **Marcus** | Head club coach | Bulk import need (became R-B'); roster as first-class view (decision #31) |
| **Diana** | Private/individual coach | Solo workflow stays separate (decision #35) |
| **Ray** | Masters volunteer | Lighter compliance for adults (drove team-type-driven posture) |
| **Tasha** | Age-group coach with kids | Minor protections + notes visibility enum (decisions #28, #29) |
| **Greg** | D1 head coach | Multi-state completion + coach-mark-on-behalf (decision #34) |

12 themes raised; 5 of Cap'n's top picks + Themes 7 and 11 baked into v1.1. Themes 6, 10, 12 deferred with notes.

## 7. Per-type rule profiles (decision #11)

Each team type has its own posture. Headlines:

- **`high_school`** — FERPA-shape language, school-calendar season, school-affiliated minor protections
- **`summer`** — short-season, lighter compliance per Cap'n's "Summer League" scope; minor protections still apply for under-13
- **`club`** — year-round, USA-S aligned; full minor protections + MAAP gestures (see [[swim-generator-maap-pack-context]] for what's missing here)
- **`masters`** — adult-only (18+); minor scaffolding skipped; DOB still collected to enforce age gate

## 8. Compliance posture (current state)

- DOB collected, minor status derived at query time
- Claim flow blocks under-13 + parent-managed-flag rows
- Roster visibility forced off when group contains any minor
- Audit log on every mutation (anonymized on account deletion per privacy policy)

**Not yet shipped:** MAAP/SafeSport scaffolding (two-deep coach gate, parent-CC on minor notes, coach credential tracking). See [[swim-generator-maap-pack-context]] for the full feature surface; L-cost; trigger is first Club tier pilot.

## 9. Deferred / known gaps

- **R-H** `coach_swimmer_notes` journal table — deferred at scope time; claim flow has try/catch so it works without; ships when actually needed
- **Persons-table normalization** — technical debt; `users` and `coach_managed_swimmers` duplicate person properties (DOB, gender, etc.). Do the refactor when the smell becomes painful
- **Per-set lane subdivision** (Theme 6) — out of scope
- **Notifications** (Theme 10) — depends on outbound email infrastructure (still missing per [[swim-generator-swimmer-evaluation-2026-05-25]])
- **Notes categories/tags** (free-text categorization) — deferred
- **Ownership transfer + UGC reassignment on departure** — known gap surfaced in [[swim-generator-team-evaluation-2026-05-25]]; manual line 1406 says "planned future flow"
- **Self-serve JSON export + tombstone-on-delete** — board-blocker per team eval; in ROADMAP Bigger Threads

## 10. Live touchpoints in code (post-shipment)

Search anchors for future maintainers:

- `db.js` — sections labelled `// See RELATIONSHIPS_SCOPE.md` over the teams/coaches/managed-swimmers blocks
- `server.js` — admin-tier comment over team role surface
- `public/index.html` — TeamsView, GroupRow, ManagedSwimmersView, AssignedToMeView, DobPromptModal, ClaimTokensPanel, ClaimManagedSection, JoinTokensPanel, JoinGroupSection, GroupAssignmentsPanel, LanePlansPanel
- `public/manual.html` — Teams + Groups + Managed Swimmers + Claim flow + Admin tier sections

## 11. Pricing / tier implications

The Program tier ($25/mo) builds on this relationships model. Per [[swim-generator-team-evaluation-2026-05-25]], current state delivers four parallel Coach-tier accounts with shared chrome — team-level curation tier (in ROADMAP Bigger Threads) is the next addition that makes Program tier earn its $15 delta.

---

**Source memory:** [[swim-generator-relationships-scope]]
**Related:**
- [[swim-generator-coach-evaluation-2026-05-25]]
- [[swim-generator-swimmer-evaluation-2026-05-25]]
- [[swim-generator-team-evaluation-2026-05-25]]
- [[swim-generator-maap-pack-context]]
