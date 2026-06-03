# Per-Swimmer Constraint Vector (PSC) — scope

**Status:** scope-only (2026-05-26). Implementation lives in PHASED_PLAN §3 Phase 3 — "First paying HS coach can sign, pay, and stick." Not the first Phase 3 deliverable (vendor paper kit + billing thin slice come first), but the largest one. Cost band M.

**Triple-cross-validated:** Coach + swimmer + team evaluation personas all surfaced this. Coach personas asked for "no fly for Linda this month"; Masters-swimmer and Tri swimmer personas asked for "shoulder injury — no paddles, no fly"; Team personas asked for "two-deep rule" type roster-wide constraints (out of scope v1; see §6).

**Pattern source:** Mirrors the existing disfavor cascade (`disfavorites` + `user_disfavor_sets` + `dbGetEffectiveDisfavorites` at `db.js:1076`). PSC is the new TOP tier of the cascade — hard exclude, not soft weight.

---

## 1. Why

The disfavor system handles **preference**: a coach or swimmer says "I'd rather not see this set" and the picker downweights or excludes (per `disfavor_mode`). It cannot express:

- "Linda hurt her shoulder — **no fly, no paddles** for two weeks." (Acute, time-bound, hard-stop.)
- "Mike has chronic back issues — **no breaststroke kick, no fly, ever**." (Persistent, hard-stop.)
- "Sarah is in taper — **easy-only, max 1500 yds** through Saturday." (Time-bound multi-axis.)
- "Tonight Joe is coming straight from a meet — **kick-only, pull-only, no main**." (Per-practice, one-time.)

These are clinical/practical constraints, not aesthetic preferences. Conflating them with disfavor risks soft handling where hard handling is needed (an injured swimmer doing fly because the picker rolled an unlucky weight is a real failure mode).

Phase 1+2 expand the audience (cold prospect → trial-ready, Android coaches can sign up, emails work). Phase 3 needs PSC to convert the first paying coach — every paying HS coach has at least one swimmer with an active injury at any given time.

---

## 2. Locked decisions (2026-05-26)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Closed-set vocabulary, not open-tag** | Picker can enforce mechanically. Adding a new type requires a code change (good — forces design review). Closed vocab keeps the print-view rendering deterministic. |
| 2 | **v1 vocabulary = 4 categories** | (a) Stroke exclusions: no fly · no breast · no back · no free. (b) Equipment exclusions: no paddles · no fins · no snorkel · no kickboard · no buoy. (c) Section exclusions: no main · no kick · no drill. (d) Caps: yardage cap (number) · intensity cap (`easy_only` enum). Total ~13 boolean flags + 2 number/enum fields. |
| 3 | **Expiry has three modes: persistent, time-bound, per-practice** | (a) Persistent — until coach removes. (b) Time-bound — stored with `expires_at` date; row stays for audit after expiry but `active=0`. (c) Per-practice — coach picks at Generate time via checklist; never persists. |
| 4 | **Per-practice = checklist at Generate time, not Run-mode modal** | When coach hits Generate for a group, an expandable "Tonight's constraints" row appears: one checkbox per swimmer per stroke/equipment/section/cap. Selection is in-memory only, passed to `generateWorkout`. Run-mode modifications are out of scope v1. |
| 5 | **Multi-lane = per-lane substitution rendered on lane card** | Workout still includes all strokes / equipment / sections globally. The lane card for an affected swimmer renders the substitution: e.g. `4×100 fly @ 1:45 → 4×100 FREE @ 1:45 [no fly this week]`. Other lanes are unaffected. Substitution policy = simple defaults in v1 (§3.5). |
| 6 | **New tier above existing disfavor** | Picker order: PSC HARD-EXCLUDE → favorite-wins precedence → coach/team disfavor weight → free choice. Engine validator gets a new pre-validation rule that rejects templates violating any active PSC. Cleanest mental model; preserves disfavor semantics (preference, not constraint). |
| 7 | **Write authority: coach-only** | Only the coach (primary OR assistant per `group_coaches` w/ `removed_at IS NULL`) of a group containing the swimmer can write PSC on that swimmer. Swimmer can VIEW their own constraints in Profile but cannot edit. Reasoning: "injuries are clinically observed; preferences belong in disfavor." |
| 8 | **Visibility: swimmer sees own constraints in Profile + on Assigned-to-me cards** | Transparency builds trust. Linda's Profile shows "Active constraints: no fly (until 2026-06-15) · no paddles (until 2026-06-15)." Her Assigned-to-me workout cards show what was substituted: "[Sub: free for fly] [Skip: paddles]". Same for adult swimmers and under-18 swimmers — no different visibility rule by age (rejected the "silent for minors" variant; transparency wins; coaches separately communicate clinical info via existing channels). |
| 9 | **PSC propagation: NONE** | Unlike disfavor, PSC does NOT propagate from coach to their group's swimmers. PSC is fundamentally personal (this swimmer's body). A coach's own PSC entries (if they're also a swimmer in someone's group) apply only to themselves. |
| 10 | **Audit log: per-mutation** | `psc.set` (coach added/edited a constraint), `psc.remove` (coach removed before expiry), `psc.expire` (system auto-expired a time-bound row — runs in the worker added for email infra or a separate small cron). Each event_type includes target swimmer sub + constraint type + old/new value in `details`. Coaches' R3 Curation Log gets a new subsection: PSC events in range. |
| 11 | **Coach UX entry point: per-swimmer profile in coach's swimmer list** | Existing 🏊 Managed swimmers + Teams views get a "Constraints" subsection per swimmer card: list of active rows, an "Add constraint" button, edit/remove actions per row. No bulk-edit; one swimmer at a time in v1. |
| 12 | **No notification on PSC change** | Coach sets a constraint → swimmer's UI updates on next page load + 5-min poll (same plumbing as effective-disfavorites poll). No email/Discord ping. Adding that touches Phase 2 email infra and isn't load-bearing. |

---

## 3. Implementation (Phase 3, after Phase 2 ships)

### 3.1 New migration (035 — assumes Phase 2 takes 033 + 034)

```sql
CREATE TABLE `swimmer_constraints` (
  `id`              BIGINT AUTO_INCREMENT PRIMARY KEY,
  `swimmer_sub`     VARCHAR(255) NOT NULL,         -- target swimmer (real auth user)
  `managed_id`      BIGINT NULL,                   -- OR target managed swimmer; mutually exclusive with swimmer_sub
  `set_by_coach_sub` VARCHAR(255) NOT NULL,        -- who created the row (audit)
  `constraint_type` ENUM(
                      'stroke_no_fly','stroke_no_breast','stroke_no_back','stroke_no_free',
                      'equip_no_paddles','equip_no_fins','equip_no_snorkel','equip_no_kickboard','equip_no_buoy',
                      'section_no_main','section_no_kick','section_no_drill',
                      'cap_yardage','cap_intensity'
                    ) NOT NULL,
  `value_num`       INT NULL,                       -- for cap_yardage
  `value_str`       VARCHAR(32) NULL,               -- for cap_intensity ('easy_only')
  `expires_at`      DATETIME NULL,                  -- NULL = persistent
  `active`          TINYINT(1) NOT NULL DEFAULT 1,  -- 0 = expired or removed; row stays for audit
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `removed_at`      DATETIME NULL,
  INDEX `idx_swimmer_active` (`swimmer_sub`, `active`, `constraint_type`),
  INDEX `idx_managed_active` (`managed_id`, `active`, `constraint_type`),
  INDEX `idx_expires` (`expires_at`),
  FOREIGN KEY (`swimmer_sub`) REFERENCES `users`(`sub`) ON DELETE CASCADE
) ENGINE=InnoDB;
```

Why `swimmer_sub` OR `managed_id` (not both): real auth users use `sub`; managed swimmers don't have a sub. Mirrors the same pattern in `assignments`/`group_members`. Application-level invariant enforced in db helper (XOR check at insert time).

### 3.2 New db.js helpers

- `dbAddSwimmerConstraint({ swimmerSub, managedId, setByCoachSub, constraintType, valueNum, valueStr, expiresAt })` — validates coach-of-this-swimmer authz, validates type+value combination, INSERT.
- `dbRemoveSwimmerConstraint(id, byCoachSub)` — sets `active=0`, `removed_at=NOW()`. Authz check.
- `dbListConstraintsForSwimmer(swimmerSub or managedId)` — active rows only by default; `{ includeInactive: true }` for audit panels.
- `dbGetActiveConstraintsForGroup(groupId)` — returns map `{swimmerSub|managedId: [constraints...]}` for the entire group's roster. Used by Generate-time per-practice checklist.
- `dbExpirePastConstraints()` — cron-like sweep; sets `active=0` where `expires_at < NOW()` AND `active=1`. Audit-logs each. Runs hourly (piggyback on the email worker's `setInterval` from `EMAIL_INFRA_SCOPE.md` §3.4 — saves one timer).
- `dbAuthzCoachOfSwimmer(coachSub, swimmerSub or managedId)` — central check used by all PSC writes.

### 3.3 New server.js routes

- `GET /api/swimmer-constraints?swimmer_sub=...` OR `?managed_id=...` — read; auth: coach-of-swimmer or the swimmer themselves
- `POST /api/swimmer-constraints` — body: `{ swimmer_sub, managed_id, constraint_type, value_num, value_str, expires_at }`. Auth: coach-of-swimmer.
- `PATCH /api/swimmer-constraints/:id` — edit value/expiry. Auth: coach who set it OR any current coach-of-swimmer (so coach handoffs work).
- `DELETE /api/swimmer-constraints/:id` — soft-delete (sets active=0). Same authz.
- `GET /api/groups/:id/active-constraints` — group-scoped roll-up for the Generate-time checklist. Auth: coach-of-group.

All write routes use `checkOrigin` + `requireCsrf` + `writeLimiter` (mirroring existing patterns).

### 3.4 Picker integration

The picker currently consults:

1. Favorites (own + propagated) — universal precedence
2. Disfavor (own + propagated) — weight 0.25× or hard-exclude per `disfavor_mode`
3. Engine recent templates — anti-repeat

PSC slots in as **step 0** (before all of the above). For each candidate option:

```js
function constraintsExcludeOption(opt, activeConstraints) {
  for (const c of activeConstraints) {
    if (c.constraint_type === 'stroke_no_fly' && opt.strokes.includes('fly')) return true;
    if (c.constraint_type === 'equip_no_paddles' && opt.equipment?.includes('paddles')) return true;
    // ... etc for all 14 types
    if (c.constraint_type === 'section_no_main' && opt.section === 'main') return true;
  }
  return false;
}
```

If `constraintsExcludeOption(opt, ...) === true`, the option is dropped from the pool BEFORE weight computation. If the pool empties, fall back to bank picker; if still empty, generate substitution per §3.5.

### 3.5 Substitution policy (v1 — simple defaults)

When PSC excludes all valid options for a section/stroke:

| Constraint | v1 substitution |
|---|---|
| `stroke_no_fly` | Replace with freestyle, same yardage + interval |
| `stroke_no_breast` | Replace with freestyle, same yardage + interval |
| `stroke_no_back` | Replace with freestyle, same yardage + interval |
| `stroke_no_free` | Replace with backstroke (default fallback when free is excluded) |
| `equip_no_paddles` | Drop the gear note; do set without paddles |
| `equip_no_fins` | Same |
| `equip_no_snorkel` | Same |
| `equip_no_kickboard` | Use streamline kick instead |
| `equip_no_buoy` | Use legs-up pull, or drop set if pull-required |
| `section_no_main` | Render "REST / skip" block on lane card |
| `section_no_kick` | Same |
| `section_no_drill` | Same |
| `cap_yardage` | Trim from the END of the workout until under cap (preserves warmup + main if possible) |
| `cap_intensity` (`easy_only`) | Replace main set with cooldown-equivalent volume at easy pace |

**v1.1 followup:** smarter substitution (stroke-family fallback, interval recompute, intensity-aware swaps). v1 ships simple defaults so the data model + UI surface go live; the substitution algorithm iterates from there.

### 3.6 Engine validator new rule

Engine-generated templates pass through validator before output. Add **Rule V9 (PSC)**: for every active constraint on every swimmer in the target audience, no set in the template may violate the constraint after substitution. If violation found, validator rejects the template and retries (existing retry-3 logic from S2.5).

### 3.7 Multi-lane interaction

`MultiPacePrintView` already renders per-lane pages. Extend it: for each swimmer-on-this-lane, attach their active constraints + the substitutions applied. Lane card shows a small "Constraints" badge in the header if any are active; sets affected by substitution show the original + the sub in `[brackets]`.

If two swimmers share a lane and have conflicting constraints (one no-fly, one no-back), the lane shows fly for the no-back swimmer with a note "Linda: sub free for fly" and back for the no-fly swimmer similarly. Both swims appear on the lane card.

### 3.8 Coach UX

In each existing per-swimmer view (Managed Swimmers, Team rosters, Group rosters):

```
🏊 Linda Smith                                [Edit] [Remove]
   Lane 2 · 1:45 base
   ── Active constraints (2) ──             [+ Add constraint]
   ⚠ No fly · until 2026-06-15              [Edit] [Remove]
   ⚠ No paddles · until 2026-06-15          [Edit] [Remove]
```

`Add constraint` opens a modal with: type dropdown → value field (only for caps) → expiry mode (persistent / until-date / per-practice — last is greyed-out here; per-practice happens at Generate time).

Generate-time, the existing workout-setup screen gets a collapsible row:

```
▾ Tonight's constraints (5 swimmers in this group have active constraints)
  ☐ Linda — no fly tonight (in addition to her persistent no-paddles)
  ☐ Mike — easy only tonight
  ☐ Sarah — skip main
  ...
```

Selection passes to `generateWorkout({ ..., tonightOverrides: [...] })`.

### 3.9 Swimmer UX

In ProfileModal, new section above Disfavorites:

```
── Active constraints (2) ──
⚠ No fly · until 2026-06-15 · set by Coach Smith
⚠ No paddles · until 2026-06-15 · set by Coach Smith
```

Read-only. Footer line: "Constraints are set by your coach. To change them, talk with your coach."

In AssignedToMeView, each workout card with substitutions shows a small constraint badge + a "What was substituted" expandable details row.

### 3.10 Reporting (R3) integration

Curation Log already has subsections: label fav/disfav, set fav/disfav, engine fav/disfav. Add a fourth: PSC events. Shows `psc.set` / `psc.remove` / `psc.expire` with target swimmer + constraint type + range scope. Cap on PSC events visible to a coach = those they set OR those on swimmers in their groups.

---

## 4. Smoke checklist

- Coach adds persistent `stroke_no_fly` to swimmer Linda → Generate group workout → fly sets show free substitution on Linda's lane card → other lanes' fly unchanged.
- Coach adds time-bound `cap_yardage=1500` to Linda with expiry 2026-06-10 → Generate workout at 3000 yds → Linda's lane card trimmed to 1500 from end (warmup + most of main preserved).
- Time travel: simulate 2026-06-11 → cron `dbExpirePastConstraints` runs → row's `active` flips to 0 → next Generate, Linda gets the full 3000.
- Per-practice override: Generate group, check "Linda no fly tonight" + "Mike easy only" → both reflected on print → re-generate next day without checking → constraints reset, fresh workout.
- Engine mode: same constraints applied, engine retries until validator passes V9 → output respects PSC → no infinite loop (max 3 retries → bank fallback → simple-default substitution).
- Multi-lane fit: 3-lane workout, Linda (lane 2) has no-fly, lanes 1 and 3 don't → lane fit succeeds for fly sets globally (constraint doesn't bubble up) → Linda's per-lane card substitutes.
- Linda's ProfileModal shows her own constraints (read-only) → she sees who set them and when they expire.
- Linda's AssignedToMeView workout card shows substitution details on expand.
- Authz: another coach tries to set PSC on Linda but isn't in her group → 403.
- R3 Curation Log: range covers Linda's PSC additions → events appear in PSC subsection with target + type + actor.

---

## 5. Out of scope (deferred to v1.1 or later)

- **Roster-wide constraints** (e.g., "the whole sprint group — no shoulder work this week"). Group-level PSC. Phase 4+ if at all.
- **Two-deep rule** (team eval surfaced this — never one coach alone with a minor). That's an org-policy enforcement, not a constraint. Out of PSC entirely; lives in RELATIONSHIPS_SCOPE v2.
- **Swimmer self-edit.** Decision 7 locks coach-only writes. Revisit if adult-only swimmer accounts (no coach) become a real segment in Phase 5.
- **Smart substitution algorithm.** v1 ships simple defaults per §3.5. v1.1 = stroke-family fallback, interval recompute, intensity-aware swaps.
- **Run-mode mid-practice modifications.** Decision 4 punts. Add if coaches surface it in Phase 3 feedback.
- **Email/Discord notification on PSC change.** Decision 12 punts. Add if swimmer eval surfaces "I didn't know my coach had restricted my workouts."
- **Bulk PSC apply.** Decision 11 punts. One swimmer at a time in v1.
- **PSC import from training-load systems** (TrainingPeaks, etc.). Out of SetForge scope entirely per [[swim-generator-architecture]] segmentation decisions.

---

## 6. Open Cap'n forks (v1.1 candidates, none block v1)

1. **Stroke substitution default when no-free.** v1 says "back" but unclear what's right. Survey first paying coaches; default = whatever they pick most.
2. **Yardage cap trim direction.** v1 trims from the end. Coach may prefer trim-from-main-middle ("keep the warmup AND the cooldown, just halve the main reps"). Make configurable in v1.1?
3. **PSC-aware fallback rate.** Will PSC inflate the engine fallback rate (currently 4.4%)? Possible — fewer options means more retries. Measure in Phase 3 post-ship; tune drill_progression coverage if it spikes.

---

## 7. Effort estimate

~15-20h. Slightly under the disfavor system's total (which was 30-40h spread over v1.2-v1.13) because PSC reuses much of that infrastructure conceptually.

- Migration 035 + db helpers: 2h
- Server routes + authz: 2h
- Picker integration + substitution: 3-4h
- Engine validator V9 rule + retry tuning: 1.5h
- Multi-lane per-lane substitution rendering: 2-3h
- Coach UX (per-swimmer constraints panel + Add modal + Generate-time checklist): 3h
- Swimmer UX (ProfileModal section + AssignedToMe card details): 1.5h
- R3 Curation Log subsection: 1h
- Expire cron hook (piggyback on email worker): 0.5h
- Smoke + manual update + ROADMAP: 1-2h

Suggest splitting into Phase 3a (data model + server + picker basics) and Phase 3b (UI + multi-lane + reporting) so a working slice lands halfway through.

---

## 8. Dependencies

- **Phase 2 must ship first.** Specifically the email worker's `setInterval` infrastructure from `EMAIL_INFRA_SCOPE.md` §3.4 is the host for `dbExpirePastConstraints`. PSC could ship before Phase 2 by adding its own timer, but bundling is cleaner.
- **No additional Cap'n hand-work** beyond the existing Phase 2 dependencies. PSC is pure server + client work.
- **No new external services or API keys.**

---

## 9. Related

- [[swim-generator-disfavor-v12]] through v1.13 — the pattern PSC mirrors at the data + propagation level
- [[swim-generator-relationships-scope]] — group_members + group_coaches define coach-of-swimmer authz
- [[swim-generator-multi-lane-generate-v20]] — multi-lane infrastructure PSC extends
- [[swim-generator-reporting-v1-complete]] — R3 Curation Log extension point
- [[swim-generator-coach-evaluation-2026-05-25]] — coach eval that surfaced "no fly for Linda this month"
- [[swim-generator-swimmer-evaluation-2026-05-25]] — Masters + Tri swimmer evals that surfaced injury-driven constraints
- [[swim-generator-team-evaluation-2026-05-25]] — team eval that surfaced two-deep + roster-level constraints (deferred per §5)
- `EMAIL_INFRA_SCOPE.md` §3.4 — host for the `dbExpirePastConstraints` cron
- PHASED_PLAN §3 Phase 3 — Phase 3 deliverables in order
