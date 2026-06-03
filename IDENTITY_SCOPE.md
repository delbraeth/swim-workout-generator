# Identity scope — persons, parents, names, and the user/team relationship graph

**Status:** scoping locked 2026-05-25 (best-judgment calls in §5; open Cap'n forks in §6). **Not yet approved for build.** Implementation trigger: see §10.
**Origin:** synthesized from the three-eval sweep ([[swim-generator-coach-evaluation-2026-05-25]] + [[swim-generator-swimmer-evaluation-2026-05-25]] + [[swim-generator-team-evaluation-2026-05-25]]) + MAAP context memo ([[swim-generator-maap-pack-context]]) + the deferred persons-normalization tech debt called out in [[swim-generator-relationships-scope]] §9.
**Why this doc exists:** the existing relationships work (Stage 1-4 shipped) treats identity as flat strings (`display_name`, `parental_contact`). The eval sweep surfaced six independent findings that all point at the same root cause: identity is under-modeled. Parents are invisible (string field with no surface). Names can't be sorted-by-last or addressed formally. Team-level features (curation, governance) can't cleanly model "who is this person to this entity." A persons-table refactor + name-split + parent-as-first-class is the foundation that unblocks: parent portal, MAAP coach-CC, lifecycle tombstone-on-delete, ownership transfer, board-grade audit logs, Lesson tier parent recap export.

---

## 1. Problem statement

The current model has six identity gaps that the eval sweep made concrete:

| Eval finding | Underlying gap |
|---|---|
| Parent persona: *"I am invisible. `parental_contact` is a 255-char string with nothing sent to it."* | Parent is not a first-class entity |
| Parent persona: *"Most of my parents are on Android/Gmail — Apple-OAuth-only locks them out."* | Identity doesn't model "auth method per person" |
| Team Manager persona: *"Roster has DOB but no USA-S ID, no SafeSport, no parent-of-record."* | Identity-adjacent compliance attributes have no home |
| Lifecycle persona: *"Cascade-wipe on coach deletion destroys swimmers' attendance records."* | Person-as-actor identity is conflated with person-as-data-subject; can't tombstone identity without losing referential history |
| Team Treasurer persona: *"No COPPA verifiable parental consent flow."* | Parent identity + provable consent linkage absent |
| Relationships scope §9 (technical debt): *"`users` and `coach_managed_swimmers` duplicate person properties — do the persons-table extraction when the smell becomes painful."* | The smell is now painful — `gender` added 2026-05-16 already required parallel column work in both tables |

Names compound the problem: `display_name` is a single VARCHAR. Sort-by-last-name is impossible. "Address the parent formally" is impossible. Initials are stored separately and drift from the name. Future MAAP audit log line "Coach Jen Smith CC'd parent Marcus Smith on note re Sophie Smith" is impossible without name structure.

## 2. Current state inventory

### Tables holding person identity

| Table | Person columns | Notes |
|---|---|---|
| `users` | `sub` (PK from OAuth), `email`, `email_verified`, `display_name` VARCHAR(255), `initials` VARCHAR(8), `dob` DATE, `gender` ENUM | Full-account person (coach OR swimmer). One row per OAuth identity. |
| `coach_managed_swimmers` | `id` (PK `ms_<base36>`), `owner_coach_sub` FK, `display_name`, `initials`, `dob` NOT NULL, `gender`, `parental_contact` VARCHAR(255) | No-login person owned by a coach. Single-string parental contact. |

### Relationship tables (in/out of identity model)

- `team_coaches` — coach ↔ team, with role (owner/admin/coach), append-only via `removed_at`
- `group_coaches` — coach ↔ group, primary/assistant, append-only
- `group_members` — polymorphic: `member_swimmer_sub` OR `member_managed_id`, CHECK exactly-one
- `workout_assignments` — polymorphic target: `target_swimmer_sub` OR `target_managed_id`
- `coach_managed_swimmers.owner_coach_sub` — direct FK to users

### What's NOT modeled

- **Parents.** `parental_contact` is unstructured free text. No row in any table represents "Sophie's mother Marcus."
- **First/last name structure.** All names are `display_name` single fields. Initials drift.
- **Auth provenance per person.** `users.sub` encodes auth provider via OAuth issuer prefix but there's no first-class "preferred contact method" or "additional auth methods."
- **Multi-parent / divorced families.** `parental_contact` is one VARCHAR; can't hold two emails meaningfully.
- **Person-as-actor vs. person-as-data-subject distinction.** Tombstoning a coach (former employee, GDPR delete) destroys their authorship of past curation/notes/attendance because identity IS the FK.
- **External identifiers** (USA-S Member ID, SafeSport cert ID, background-check ID). No place to put them.
- **Pronouns, preferred name, nickname.** Adjacent to identity, no home.

### Touchpoints — where this refactor reaches

- `db.js`: ~30 SELECT/INSERT/UPDATE statements reference `display_name` or `initials`
- `server.js`: ~12 routes accept/return display_name
- `public/index.html`: 37 references to `display_name`
- `public/manual.html`: documents `parental_contact` as a feature
- All 3 eval archives reference parental_contact gaps
- CSV bulk import format (`setforge-swimmer-import-template.csv`) uses single name column

## 3. Target state — the model I'm proposing

Three new concepts. Each is independently shippable but they compose.

### Concept A: `persons` table (normalization)

New top-level table holding shared identity:

```
persons:
  id              VARCHAR(16) PK     (px_<base36>)
  first_name      VARCHAR(80)        required
  last_name       VARCHAR(80)        required
  preferred_name  VARCHAR(80)        nullable — overrides first_name in UI when set
  initials        VARCHAR(8)         computed default = first[0]+last[0], overridable
  dob             DATE               nullable for adults; required for minors via app-layer check
  gender          ENUM               existing values
  pronouns        VARCHAR(40)        nullable, free text per user preference
  created_at      TIMESTAMP
  updated_at      TIMESTAMP
  tombstoned_at   TIMESTAMP NULL     identity preserved-but-anonymized for tombstone-on-delete
```

`users` and `coach_managed_swimmers` reference `persons` via FK:
```
users.person_id  → persons.id  (1:1, exists for every user)
coach_managed_swimmers.person_id → persons.id  (1:1, exists for every managed swimmer)
```

`display_name` on read = `COALESCE(preferred_name, first_name) || ' ' || last_name` (computed). Optionally stored as a denormalized cache column on `persons` if performance demands.

### Concept B: `parents` (or "guardians") as a first-class entity

A parent is a Person who is associated with one or more minor Persons. Two patterns of association:

```
swimmer_parents:
  swimmer_person_id   FK persons.id
  parent_person_id    FK persons.id
  relationship        ENUM ('mother', 'father', 'guardian', 'other')
  is_primary_contact  BOOL
  has_pickup_auth     BOOL
  has_emergency_auth  BOOL
  added_at            TIMESTAMP
  added_by_sub        FK users.sub
  removed_at          TIMESTAMP NULL
```

Auth methods per parent (because parent may not have a SetForge login):
```
parent_contact_methods:
  parent_person_id    FK persons.id
  method              ENUM ('email', 'sms', 'parent_login_sub')
  value               VARCHAR(255)       email address / phone / users.sub
  is_preferred        BOOL
  verified_at         TIMESTAMP NULL
  added_at            TIMESTAMP
```

This lets a parent be reachable via email today, then upgrade to a magic-link login when the outbound email infrastructure ships, then upgrade to OAuth login when Google OAuth ships. No schema change needed at each upgrade.

### Concept C: Tombstone semantics

`persons.tombstoned_at` IS NULL = active. NOT NULL = anonymized. On tombstone:
- `first_name` → "Former"
- `last_name` → "Coach #N" or "Swimmer #N" (sequential per type, stable for life-of-row)
- `preferred_name`, `pronouns` → NULL
- `dob`, `gender` → NULL (PII purge)
- Other identity attributes purged per data class
- All FKs from operational tables (`workout_assignments`, `coach_swimmer_notes`, etc.) **stay intact** because they reference `persons.id`, not `users.sub` directly

Audit log already does NULL-the-sub anonymization (privacy policy §149) — this extends the pattern to operational data.

### What `users` and `coach_managed_swimmers` become

After persons extraction:

```
users:
  sub               VARCHAR(255) PK   (unchanged, from OAuth)
  person_id         FK persons.id     (1:1)
  email             VARCHAR(255)      (the OAuth email, separate from person contact methods)
  email_verified    BOOL
  is_admin          BOOL
  is_coach          BOOL
  support_role      BOOL              (from impersonation v3)
  created_at        TIMESTAMP
  last_login_at     TIMESTAMP
```

`display_name`, `initials`, `dob`, `gender` columns are removed (live on `persons`).

```
coach_managed_swimmers:
  id                VARCHAR(16) PK
  person_id         FK persons.id
  owner_coach_sub   FK users.sub
  team_id           FK teams.id
  parent_managed_flag BOOL
  pace_scy_100      DECIMAL
  pace_scm_100      DECIMAL
  pace_lcm_100      DECIMAL
  archived          BOOL
  archived_at       TIMESTAMP NULL
```

`display_name`, `initials`, `dob`, `gender`, `parental_contact` columns removed. (`parental_contact` superseded by `swimmer_parents` + `parent_contact_methods`.)

## 4. Relationship graph (the actual question Cap'n asked)

After refactor, every meaningful relationship is a clean edge:

```
Person ─── 1:1 ───── Users (full-account) — has OAuth sub, can log in
       \── 1:1 ───── Managed swimmer record — owned by a coach, no login

Swimmer (Person) ─── M:N (swimmer_parents) ─── Parent (Person)
Parent  (Person) ─── 1:M (parent_contact_methods) ─── contact method (email/sms/login_sub)

Coach (User where is_coach=1) ─── M:N (team_coaches) ─── Team
Coach                          ─── M:N (group_coaches) ─── Group (with primary/assistant)
Group  ─── 1:N (group_members polymorphic) ─── Swimmer (full or managed)
Group  ─── N:1 (team_id) ─── Team

Swimmer ─── derived from group_members → groups → team_id ─── Team
Parent  ─── derived from swimmer_parents → group_members → groups → ── Coach + Team
```

**Two-deep MAAP property** falls out naturally: for any coach-to-minor-swimmer interaction, the system can derive "is there at least one other adult on this group's group_coaches?" AND "does swimmer_parents include at least one parent_contact_method we can CC?"

**Three views per Person:**
- Self-view (what the person sees about themselves)
- Coach-view (what coaches see about this person)
- Public/relational-view (what teammates / parents-of-teammates see)

Each view masks different identity fields per role + minor status + visibility settings.

## 5. Locked decisions (my best-case calls)

1. **Names ARE split into first_name + last_name.** Required, not optional. Backfill from `display_name` via SQL split-on-last-space rule + admin curation pass for ambiguous cases. Preferred_name + pronouns as nullable additions. Initials computed default; overridable.
2. **`display_name` becomes a computed read-side projection,** not a stored column. Existing API surfaces continue to return `display_name` for compat; clients can ignore the new fields until they want them.
3. **Persons extraction is mandatory** — not optional. This is the foundation; without it, parent-as-first-class can't work, tombstone-on-delete can't preserve referential history, and the team-eval-flagged "single-operator continuity" story stays broken.
4. **Parents are first-class Persons,** not a string field on swimmers. `parental_contact` is migrated to `swimmer_parents` + `parent_contact_methods` rows.
5. **Multi-parent support is included from day one.** `swimmer_parents` is M:N. Divorced families, joint custody, grandparents-as-guardians all fit.
6. **`parent_contact_methods` supports tier-up over time.** Day-one shape supports email-only. When outbound email infra ships, magic links flow through `method='email'` rows. When Google OAuth ships, `method='parent_login_sub'` rows link to `users.sub`. No schema change at each upgrade.
7. **Tombstone-on-delete becomes the default delete semantics for Persons.** Hard cascade-wipe (current behavior) becomes an admin-confirmed rare path. This is the cross-validated team-eval finding made concrete.
8. **External identifier columns** (USA-S Member ID, SafeSport cert ID, BC ID) live on a separate `person_external_ids` table — keyed by (`person_id`, `system`, `external_id`). Out-of-scope for v1 build but the table lands at the same time so MAAP pack work later doesn't need another migration.
9. **OAuth provider per User is tracked** via `users.auth_provider` ENUM (`apple`, `google`, `parent_magic_link`). Already implicit in `sub` prefix; making it explicit unblocks Google OAuth + the "parent passwordless login" feature without a future migration.
10. **Persons IDs are `px_<base36>`** to match the existing ID convention (`tm_*`, `ms_*`).
11. **Backfill is per-table, transactional, online.** No downtime. Phased — see §7. Reverse migration documented.
12. **Names in the bulk-import CSV change format.** New columns: `first_name`, `last_name`, `preferred_name` (optional). Old `name` column accepted with split-on-last-space + warning in the result screen. Template updated.
13. **`display_name` is NEVER edited directly post-refactor.** Editing surfaces edit first_name, last_name, preferred_name; the computed display_name updates automatically. Eliminates the "name and initials drift" bug.
14. **Person sort order = last_name, first_name** everywhere unless explicitly overridden. Admin roster views, R6 admin reports, audit logs, etc.

## 6. Open Cap'n forks (the things I won't decide alone)

These have material product or business implications:

| Fork | Options | My lean |
|---|---|---|
| **Display order in informal UI** | "First Last" (US/UK) vs "Last, First" (formal) vs locale-driven | "First Last" for chrome, "Last, First" for tables/roster. Auto-format helpers. |
| **Are parent Persons visible to other parents?** | No (private list) / Yes (team roster) / Coach-toggleable | No by default; matches MAAP-minor minor protections posture |
| **Can a single Person be both a Parent of one swimmer AND a Swimmer themselves** (e.g., masters-swimming parent)? | Yes — `persons.id` exists in both `swimmer_parents.parent_person_id` AND `group_members.member_swimmer_sub` paths (via users) — natural fit | Same Person can play both roles; no special handling needed |
| **What's the right name for "Parent"?** | `parents` / `guardians` / `caretakers` / `parent_or_guardian` | `guardians` is more accurate (covers grandparents, foster, etc.) but `parents` is what coaches/parents themselves say. Suggest: table named `guardians` in schema, UI label "Parent / Guardian" |
| **External IDs table v1 vs deferred** | Include in v1 build (1-2h add) vs defer | Include — same migration, future MAAP pack benefits |
| **Pronouns surfaced where** | Self-edit only, coach-visible only, never visible, full opt-in | Self-edit, coach-visible only, never on rosters that parents see |
| **Two-deep gate enforcement** | Soft warning (flag, don't block) vs hard block (refuse to save 1-coach minor groups) | Soft warning v1; hard block reserved for MAAP pack v2 |

## 7. Migration plan — phased, non-breaking

| Phase | What | ~Hours | Trigger |
|---|---|---|---|
| **I-A** | Migration N: create `persons`, `swimmer_parents`, `parent_contact_methods`, `person_external_ids`. Add `person_id` nullable to `users` + `coach_managed_swimmers`. Online; no FK enforcement yet. | 2 | Ready when this scope is approved |
| **I-B** | Backfill: walk `users` + `coach_managed_swimmers`, create `persons` rows, populate `person_id`. SQL split-on-last-space heuristic for `display_name` → first+last. Admin curation pass for ambiguous cases (single-word names, hyphenated, etc.) | 3 + admin review time | I-A applied |
| **I-C** | Enforce `person_id NOT NULL` on both tables. Add unique constraints. Reading paths still use legacy `display_name` columns. | 1 | I-B clean + verified |
| **I-D** | Add `display_name` computed projection helper to db.js. Switch read paths to compute from persons. Legacy `users.display_name` + `coach_managed_swimmers.display_name` columns kept but no longer authoritative. | 4 | I-C deployed |
| **I-E** | Parent backfill: parse `coach_managed_swimmers.parental_contact` strings → best-effort `guardians` rows + `parent_contact_methods` (method=email when string looks like email; method=other-text when not). Coach-review queue for ambiguous parses. | 3 + coach review | I-D deployed |
| **I-F** ✅ 2026-06-03 | Drop legacy columns: `users.{display_name,initials,dob,gender}`, `coach_managed_swimmers.{display_name,initials,dob,gender}` via migration 044. **`parental_contact` intentionally KEPT** (superseded by guardians later, not this pass). Soak waived (pilot mode/all-test-users/clean static audit). | 1 | done |
| **I-G** ✅ 2026-06-03 | Tombstone-on-delete: `dbAdminDeleteUser` → `dbTombstonePerson` ("Former / Coach #N\|Swimmer #N", PII nulled, `tombstoned_at`) + keep users row `is_disabled=1` + revoke sessions. `signInAs`/native-auth refuse disabled; requireAuth already did. `{hard:true}` keeps the cascade-wipe as an admin override. **Self-serve JSON export bundled** (`dbExportAccount` + `GET /api/me/export` + web button). Coach-removal stays soft (`removed_at`); UGC reassignment is the separate Ownership-transfer scope. | 3 | done |
| **I-H** ✅ 2026-06-03 | Bulk-import CSV now imports `first_name`/`last_name`/`preferred_name` columns (legacy single `name` still accepted, split-on-last-space + amber ⚠ in the preview). `dbCreateManagedSwimmer` accepts explicit name parts (preferred) or splits `display_name` (fallback). Template + help text + manual updated. | 2 | done — **identity refactor I-A→I-H COMPLETE** |

**Total: ~19h + admin review pass.** Stage 1 (I-A through I-D) is the meaningful refactor; everything else is backfill + cleanup.

**Per-phase compat:** every phase keeps old API surface intact. Clients reading `display_name` see the same string before and after (computed when needed). Only I-F removes old columns, gated on a 30-day soak.

## 8. Dependencies + interaction with other in-flight work

This scope is foundational. Many in-flight things either depend on it or fight it.

| Other work | Interaction |
|---|---|
| **Outbound email infrastructure** (swimmer-eval top-5) | Parent magic-link auth needs email infra. Ship email infra FIRST so I-E parent backfill has a place to send the verification email. |
| **Google OAuth** (swimmer-eval top-5) | Parents-as-Persons-with-google-OAuth-login depends on Google OAuth landing. Either ship Google OAuth first, OR ship this scope with `method='parent_login_sub'` stubbed-but-unused. |
| **MAAP pack** ([[swim-generator-maap-pack-context]]) | MAAP coach-CC on minor notes, two-deep coach gate, parent-visible plan — ALL depend on this scope. Build MAAP after this. |
| **Lifecycle: self-serve JSON export + tombstone-on-delete** (ROADMAP Bigger Threads) | Tombstone-on-delete is literally phase I-G of this scope. Don't ship them separately; bundle. |
| **Lifecycle: lesson-tier parent recap export** (PRICING.md §1) | Parent recap export sends to `parental_contact` — needs guardians table + parent_contact_methods + outbound email. Depends on I-E + email infra. |
| **Team-level curation tier** (ROADMAP Bigger Threads) | Independent; can ship before or after. |
| **Per-swimmer constraint vector** (ROADMAP Bigger Threads) | Constraint storage hangs off `persons.id`, not `users.sub` or `coach_managed_swimmers.id`. Slightly cleaner if this scope ships first; not blocking. |
| **Vendor paper kit** (ROADMAP Bigger Threads) | Independent. |
| **Reporting v1.1** | R6 admin curation log naming would benefit from first+last. Backfill comes for free with I-D. |
| **Discord scope** ([[swim-generator-discord-scope]]) | Discord webhook already uses display_name — continues to work via compat shim. Optional polish: switch webhook payload to "First Last" once I-D ships. |
| **Self-serve JSON export** | Export shape MUST include person + guardian rows. Scope it together so the export schema isn't designed around the old flat model and need re-design. |

**Ordering recommendation if all of these are on the table:** outbound email → Google OAuth → this scope (I-A through I-G) → MAAP pack → JSON export + tombstone (bundled with I-G).

## 9. Risk assessment

| Risk | Probability | Severity | Mitigation |
|---|---|---|---|
| Name-split heuristic mis-parses names ("Mary Lou Smith" → first="Mary", last="Lou Smith"?) | High | Medium | Admin-review queue in I-B; coach can manually fix; preferred_name catches edge cases |
| Existing parental_contact strings are unparseable mush ("call mom 555-1234") | High | Low | I-E coach review queue; raw string preserved as audit note on guardian row; coach re-enters |
| Compat shim leaves old display_name columns out of sync with persons | Medium | Medium | I-D explicitly writes to BOTH during transition; I-F removes columns. No long-lived dual-write. |
| Tombstone semantics break audit logs that expect a sub | Low | High | Audit log already handles NULL-sub case (privacy policy §149); tombstone reuses same path |
| `persons` table becomes the hot table (every query joins it) | Low | Low | One-row-per-user lookups are trivial; existing FK indexes on sub stay |
| Parent identity rollout reveals previously-unaccounted-for compliance issues (e.g., COPPA consent required to create child Person) | Medium | Medium | Lock the COPPA consent flow as a prerequisite to I-E; gate creation behind it |
| Backfill creates duplicate Person rows for same human (coach is also a parent on another swimmer's record) | Medium | Low | Email match during backfill; merge tool for admin to consolidate |

## 10. Cost band + trigger

- **Cost band:** **L** (large). ~19h engineering + admin review time + the cascading email/OAuth dependencies.
- **Real bottom of stack:** depends on outbound email + Google OAuth shipping first if parent magic-link is in the v1 of this scope. Without those two, you can ship persons + name split + guardians-as-shells without any parent-side activation flow (parents exist in the DB, no notifications, no logins) — useful for downstream MAAP work but not user-visible to parents.
- **Trigger:** the natural trigger is "first paying pilot with a 13yo athlete." Until then, this is foundational debt + future-MAAP-unblock. Could also pull forward if Pricing/Lesson tier ships (Lesson tier parent recap export literally depends on parts of this).

## 11. What this scope is NOT

- Not a complete persons-DB migration to a graph database / RDF / similar. Just a normalization within the existing relational schema.
- Not a multi-tenancy refactor — `team_id` and `team_coaches` already do that.
- Not authentication overhaul — `users.sub` keeps its meaning and FK role. New `auth_provider` column is a tracking field, not a new auth path.
- Not a CRM. `parent_contact_methods` holds methods, not engagement history.
- Not an MDM (master data management) tool. Backfill is one-shot; ongoing identity is single-source.

## 12. Related

- [[swim-generator-relationships-scope]] — predecessor; this builds on its team/group model
- [[swim-generator-maap-pack-context]] — biggest downstream beneficiary
- [[swim-generator-coach-evaluation-2026-05-25]] — Club coach + Masters coach evidence
- [[swim-generator-swimmer-evaluation-2026-05-25]] — parent-invisibility finding + email-infra dependency
- [[swim-generator-team-evaluation-2026-05-25]] — tombstone-on-delete + lifecycle continuity
- `PRICING.md` — Lesson tier parent recap export depends on this
- ROADMAP.md Bigger Threads — data portability + tombstone item explicitly overlaps phase I-G

---

**Best-judgment summary for Cap'n's review:** persons-table extraction + name split + parent-as-first-class is the single foundational refactor that unblocks the most cross-validated downstream work from the three-eval sweep (MAAP, parent portal, lifecycle tombstone, Lesson-tier recap, board-grade audit logging). 19h L-cost. Phased non-breaking. Trigger naturally lands when first paying pilot has a minor athlete OR when Lesson tier ships.
