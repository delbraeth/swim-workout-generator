# Locations Scope — addresses, household, and team practice facilities

**Status:** Scoped — 6 decisions LOCKED 2026-05-29 (§6). No code yet; ready to build P1 when triggered. A single "locations" model serving BOTH home/household addresses (people) and team practice facilities (one or more pools per team), rather than two ad-hoc address solutions.

**Origin:** Cap'n flagged two needs while finishing identity I-F: (1) a home-address table to anchor household/sibling grouping (since shared-guardian alone isn't reliable siblings), and (2) teams that practice at multiple facilities. Both are "a location, linked to an entity" — design once.

Related (separate scopes): cross-org club↔HS sharing, household/sibling derivation, MAAP minor-safety pack.

---

## 1. Why one model

A "location" is a name + postal address (+ optional geo). Two very different things attach to it:

- **Home address** — where a *person* lives (guardians + athletes). Powers household/sibling grouping and MAAP parent-contact.
- **Practice facility** — where a *team* trains. A team may have several (a club using two pools; a HS team using the school pool + a community pool). A facility carries pool metadata (course, lanes) and feeds scheduling.

These share the address shape but differ in everything attached (a facility has a course; a home has residents). So: one shared `addresses` table for the postal part, with two distinct link/owner tables on top.

---

## 2. Current state (what exists today)

- `teams.school VARCHAR(120)` — added in the I-F/normalization pass (2026-05-29). A single free-text school/club name per team. This is the **degenerate one-facility case** the facility model generalizes.
- `persons` — normalized identity (id, first/last/preferred name, dob, gender, class_year, tombstoned_at). No address.
- `person_external_ids` — USA-S / external IDs per person (pattern precedent for a per-person side table).
- `guardians` — swimmer_person_id ↔ guardian_person_id (M:N). No household/sibling concept; shared guardian ≠ siblings (kinship/foster/coach-as-guardian break it).
- `pool_mode` ("25y"/"25m"/"50m") is chosen **per workout** at generate time and stored on bank options / generated workouts. It is NOT a property of a team or location today.
- `scheduled_workouts` — a coach/user's scheduled practice (user_sub, scheduled_date, intent_params/payload JSON, completed_at). `practice_attendance` rows hang off `scheduled_workout_id`. No facility reference.

---

## 3. Proposed schema (additive)

### 3.1 `addresses` (shared postal record)
```
addresses(
  id            BIGINT PK,
  line1         VARCHAR(160) NULL,
  line2         VARCHAR(160) NULL,
  city          VARCHAR(80)  NULL,
  region        VARCHAR(80)  NULL,   -- state/province
  postal_code   VARCHAR(20)  NULL,
  country       VARCHAR(2)   NULL DEFAULT 'US',
  lat           DECIMAL(9,6) NULL,   -- optional geocode (later)
  lng           DECIMAL(9,6) NULL,
  created_at    TIMESTAMP DEFAULT NOW()
)
```
Plain record; no owner column (ownership lives in the link tables below). Keeps it reusable.

### 3.2 `person_addresses` (home links — the household anchor)
```
person_addresses(
  id          BIGINT PK,
  person_id   VARCHAR(16) FK→persons,
  address_id  BIGINT FK→addresses,
  kind        ENUM('home','mailing','other') DEFAULT 'home',
  is_primary  TINYINT(1) DEFAULT 1,
  added_at    TIMESTAMP DEFAULT NOW(),
  removed_at  TIMESTAMP NULL,
  UNIQUE active-pair (person_id, address_id) via generated-column trick (see migration 043 precedent)
)
```
**Household / sibling derivation (derived, not stored):** two athletes who share BOTH an active home `address_id` AND a guardian are a strong household/sibling signal. Expose as a soft "household" grouping (e.g., the parent view groups siblings); do NOT hard-flag siblings. This replaces the unreliable shared-guardian-only heuristic.

### 3.3 `team_facilities` (practice sites — generalizes teams.school)
```
team_facilities(
  id           BIGINT PK,
  team_id      <teams.id type> FK-by-app (legacy table → no hard FK, per the no-FK-into-legacy rule),
  name         VARCHAR(120) NOT NULL,   -- "Lincoln HS Natatorium", "City Aquatic Center"
  address_id   BIGINT NULL FK→addresses,
  course       ENUM('25y','25m','50m') NULL,  -- the pool's course; can default pool_mode
  lanes        TINYINT NULL,
  is_primary   TINYINT(1) DEFAULT 0,    -- the team's main pool
  archived_at  TIMESTAMP NULL,
  created_at   TIMESTAMP DEFAULT NOW()
)
```
**Migration of `teams.school`:** backfill one `team_facilities` row per team that has a non-null `school` (name = school, is_primary = 1), then `teams.school` can be deprecated/dropped in a later step (same deploy-readers-first → drop pattern as I-F). Until then, keep `teams.school` as the convenience mirror of the primary facility's name.

### 3.4 Scheduling hook (later phase)
`scheduled_workouts.facility_id BIGINT NULL FK→team_facilities` — so a multi-pool team's practice records WHICH pool. A facility's `course` can pre-fill the generator's `pool_mode` when scheduling at that facility (instead of picking pool mode every time). Optional; not required for v1.

---

## 4. Privacy / MAAP (load-bearing constraint)

Home addresses of **minors** are sensitive PII. Rules to bake in from day one:
- Access gated: a swimmer's home address is visible only to the swimmer, their guardians, and authorized coaches per role — never team-wide.
- Writes for a minor's home address allowed by guardians OR coaches-with-recorded-consent (decision 6); default-deny otherwise. Every such write audited.
- Audit every read/write of a minor's address (`audit_events`).
- Tombstone/export: home addresses must be covered by the data-portability + tombstone work (I-G) — they're personal data.
- Facility addresses are NOT sensitive (public pool locations) — no gating needed.

This is why home-address belongs with the identity/relationships + MAAP family, and shouldn't ship casually.

---

## 5. Phasing

1. **P1 — `addresses` + `team_facilities` (additive):** schema, team-facility CRUD in Team Settings (generalize the existing `school` field into "facilities"), backfill `teams.school` → primary facility. Lowest-risk, immediately useful (multi-pool teams). No minor-PII yet.
2. **P2 — `person_addresses` (home):** schema + UI on profile / managed-swimmer (guardian-edited for minors) + access gates + audit. The MAAP-sensitive part.
3. **P3 — household/sibling derivation:** soft grouping over (shared address + guardian) in the parent view and rosters. No hard sibling flag.
4. **P4 — scheduling integration:** `scheduled_workouts.facility_id` + facility-course → default pool_mode.
5. **P5 — deprecate `teams.school`** (deploy readers-off-school → drop), once facilities are the source of truth.

---

## 6. Locked decisions (Cap'n, 2026-05-29)

1. **Shared `addresses` table** (not inline columns) — reusable; siblings share one address row. Accept the extra join.
2. **Many home addresses per person, one marked primary** — supports divorced/two-home households (the guardians model already handles split families).
3. **Geocode columns (lat/lng) added now, populated later** — reserved for future distance/maps; no UI in scope.
4. **Facility `course` DEFAULTS `pool_mode`** (pre-fills, coach can override per workout) — does not lock it.
5. **Migrate `teams.school` → facilities, then drop it (P5)** — not kept long-term; readers-off-then-drop pattern (per I-F).
6. **Minor home-address write authority: guardians AND coaches-with-consent.** Not guardian-only. A coach may set/edit a minor's home address WITH recorded consent (the guardian grants it), audited. Implementation: gate the write on either (a) caller is an active guardian of the swimmer, or (b) caller is an authorized coach of the swimmer AND a consent flag/record exists. Consent mechanism + record is a P2 design detail (ties to MAAP); default-deny without consent.

---

## 7. Out of scope
- Cross-org club↔HS sharing (separate scope; a facility/team may be shared context but sharing rules are their own thing).
- Maps/route/distance features (geocode columns reserved, no UI).
- Billing/address-for-invoicing (Program tier may want a billing address later — `kind='mailing'` leaves room).
