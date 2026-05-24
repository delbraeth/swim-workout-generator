# UGC Coach-Authored Sets — v1 Scope

**Status:** scope locked 2026-05-23 (initial); rewritten 2026-05-25 after the 2026-05-24 architecture course-correction surfaced that the hybrid DB-as-canonical model was a misread of intent. **Build approved 2026-05-25** — requested directly by testers, no demand-trigger gating remaining.

This doc is the build contract. Phases A through G ship in sequence per §8.

---

## 1 — Locked decisions

| Aspect | Choice |
|---|---|
| **Bank source-of-truth** | **JS, forever.** `public/index.html` bank constants (WARMUP_OPTIONS / DRILL_OPTIONS / MAIN_OPTIONS / COOLDOWN_OPTIONS, × 3 pool modes) stay where they are. Picker reads them as it does today. No backfill, no regeneration, no `bank-generated.js`. |
| **UGC location** | **DB only, temporarily.** `bank_options` + `bank_sets` rows with `author_sub IS NOT NULL`. Picker overlays UGC on top of JS at filter time via a per-session `/api/bank/my-overlay` fetch. |
| **Graduation lifecycle** | **UGC graduates into JS, soft-delete in DB.** When an admin promotes a public UGC option, a graduation tool injects it into the JS file (see UI/tool decisions below), commits + pushes, and stamps `promoted_at = NOW()` on the DB row. The overlay endpoint filters out promoted rows; the row stays in DB for audit history. Same set ID lives in both places after graduation but the overlay won't return it, so the picker sees one. |
| **Authoring** | **Both form-based AND snapshot.** Form for from-scratch sets (reps/dist/desc/interval/stroke/focus fields, mirrors bank schema). Snapshot for "I like this set the engine just generated — save it to my collection." Two entry points, one underlying record. |
| **Sharing tiers** | **Private + Team-I-pick + Public-with-moderation.** Private = author only. Team = author picks one or more teams they coach. Public = visible to all SetForge coaches' pickers but requires admin approval before going live. No "specific-coach DM" tier in v1. |
| **Propagation** | **Auto-propagate to team.** Coach shares to team → swimmers in that team see the set in their picker immediately (mirrors existing [[swim-generator-favorites-prop-v13]] coach→swimmer flow). Coach can un-share to revert. |
| **Moderation gate (public tier only)** | **Admin queue.** Public submission → status `pending` → admin sees in "Pending UGC" admin tab → approves or rejects. Approved → status `public`, visible to all coaches. Rejected → status `rejected` with reason, visible to author only. |
| **Set ID convention** | **Reuse `s_xxxxxx`.** Server auto-generates the ID at insert; coach never sees or sets the ID. Maintains consistency with hardcoded bank. |
| **Graduation tool UX** | **Auto-edit `public/index.html` with snippet fallback.** Tool locates the matching constant + sub-key (e.g. MAIN_OPTIONS_50M['im']) via balanced-bracket scan and writes the insert before the section's closing bracket. Admin reviews `git diff` before commit. If the heuristic can't locate the insertion point (file structure changed, key missing), tool emits the snippet to stdout + instructions for manual paste. |
| **Graduation grain** | **Per-option.** Admin clicks "Graduate to JS" on one option at a time. Each graduation = one DB write (`promoted_at`) + one local JS edit + one commit + one deploy. Easier to review and undo than batched. |
| **Edit-reverts-public-approval** | **Yes, while DB-resident.** Edit to a `visibility='public'` UGC option flips it back to `pending` for re-review. Once a row is `promoted_at IS NOT NULL`, it's frozen — the JS version is canonical; further edits happen via direct JS edit. |

---

## 2 — Data model

### Migration 031 (UGC schema corrections — supersedes 030's UGC bits)

The empty tables from migration 030 are kept for continuity (no destructive change). Migration 031 corrects the column set to match the corrected architecture.

```sql
-- 031 — UGC schema corrections after architecture course-correction.
--
-- Migration 030 was built around a hybrid model (canonical in DB +
-- JS-export). 2026-05-24 re-scope: JS is canonical forever, DB is
-- UGC-only-and-temporary. This migration drops the now-meaningless
-- canonical-staging columns and adds the graduation timestamp.
--
-- Schema constraint going forward: every row in bank_options has
-- author_sub IS NOT NULL.

ALTER TABLE `bank_options`
  -- author_sub was nullable to allow canonical rows (NULL = canonical).
  -- No more. UGC-only invariant.
  MODIFY COLUMN `author_sub` VARCHAR(64) NOT NULL,
  -- in_export was the DRAFT/LIVE flag on canonical rows. No canonical
  -- in DB anymore → no use for this column.
  DROP COLUMN `in_export`,
  -- Drop the visibility enum value 'canonical' implicitly by virtue of
  -- this app never inserting it again. (MariaDB doesn't enforce VARCHAR
  -- enums; we rely on the app layer + a CHECK constraint below.)
  ADD CONSTRAINT `chk_bank_options_visibility`
    CHECK (`visibility` IN ('private','team','public','pending','rejected')),
  -- Soft-delete timestamp for graduated rows. Overlay queries exclude
  -- promoted_at IS NOT NULL. Set by the graduation tool.
  ADD COLUMN `promoted_at`     DATETIME    NULL AFTER `version`,
  ADD COLUMN `promoted_by_sub` VARCHAR(64) NULL AFTER `promoted_at`;

-- Replace the canonical-export index (no longer used) with a
-- promotion-aware overlay index.
DROP INDEX `idx_bank_export` ON `bank_options`;
CREATE INDEX `idx_bank_overlay` ON `bank_options`
  (`author_sub`, `visibility`, `promoted_at`);
```

### Tables (effective after 031)

- **`bank_options`** (UGC only): id (o_xxxxxx PK), section, type_id, stroke_id, pool_mode, label, total_yards, type_affinity, author_sub (NOT NULL), visibility ∈ {private,team,public,pending,rejected}, created_at, updated_at, version, promoted_at, promoted_by_sub.
- **`bank_sets`** (children of bank_options, cascade FK): id (s_xxxxxx PK), option_id, seq, reps, dist, desc, interval, focus, stroke, eq.
- **`bank_option_team_shares`**: option_id × team_id (no FK to teams; per migration 030 hotfix).
- **`bank_option_reviews`**: BIGINT PK, option_id, reviewer_sub, decision, reason, reviewed_at.

No new tables in 031.

---

## 3 — UI surfaces

### A. Authoring (form-based) — "My Sets" page
- **Where:** new "📝 My Sets" entry in the 🔧 coach dropdown (alongside Teams / Catalog / Reports).
- **List view:** all sets the coach has authored. Columns: label · section · pool mode · visibility · last-edited · status (promoted? rejected?).
- **Each row:** edit · duplicate · change-visibility · delete (with confirmation). Promoted rows are read-only.
- **+ New set button:** opens a form modal. Fields: section, type (if main), stroke, pool mode, label, total yards, then a repeating "set row" group (reps / dist / desc / interval / focus). Save → POST `/api/bank-options`.

### B. Authoring (snapshot) — "Save this set" button on generated workouts
- **Where:** new icon button (📥) in `WorkoutBlock` header next to existing favorite toggle, visible only to coaches.
- **Tap:** opens a small modal pre-filled with the block's current sets. Coach picks visibility + (if team) which team(s). Confirm → POST `/api/bank-options` with the pre-filled payload. Toast confirms.

### C. Visibility change
- **Where:** the row-level action in "My Sets" AND on the snapshot save modal.
- **State machine:** private ↔ team (pick teams) ↔ public (triggers admin review queue, status flips to `pending` while waiting).

### D. Admin moderation queue ("Pending UGC")
- **Where:** new "Pending UGC" tab in AdminView.
- **Each row:** option label · author · submitted-at · "👁 Preview" (renders the option in a read-only block) · ✅ Approve · ❌ Reject (with reason).
- Approve → `visibility='public'`. Reject → `visibility='rejected'`, author sees with reason on their "My Sets" page.

### E. UGC indicator in picker output
- **Where:** generated workout blocks (WorkoutBlock component).
- Small badge: 📝 own-authored, 👥 team-shared (from your coach), 🌐 public.
- Hardcoded JS canonical blocks have no badge (unchanged from today). After graduation, the badge disappears because the JS row carries no author_sub.

### F. Graduate-to-JS — "Public UGC" admin tab
- **Where:** new "Public UGC" tab in AdminView (separate from "Pending UGC").
- **List view:** all `visibility='public' AND promoted_at IS NULL` rows. Columns: label · author · section · pool mode · type/stroke · usage count (how many workouts have included this set in last 30d) · "Graduate to JS" button.
- **"Graduate to JS" click:**
  1. POST `/api/admin/ugc/:id/graduate?dry=1` → server runs the auto-edit logic against the in-process copy of `public/index.html` (or a temp copy) and returns: { snippet, targetConstant, insertionPointFound: bool, diffPreview }.
  2. Modal displays the diff preview + the snippet. Admin sees where the row will land in JS.
  3. If admin approves: POST `/api/admin/ugc/:id/graduate` (no dry flag) — server writes the actual file, stamps `promoted_at`+`promoted_by_sub`, returns success. Admin then runs `git diff && git commit -am "Graduate UGC: <label>" && git push` from their terminal.
  4. If `insertionPointFound: false`, the snippet is shown with instructions for manual paste; the `promoted_at` write still happens after admin confirms the manual edit is in place.

**Why not auto-commit?** The graduation tool can write the file but should NOT commit/push from inside the running Node process — git credentials don't live there, and the deploy lane stays human-in-the-loop. Same reasoning as the canonical-bank "Run export" button decision (it was a guard against in-app git ops, even though that UI is now gone).

---

## 4 — Server routes

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET`    | `/api/bank/my-overlay` | any auth | Returns all UGC visible to caller (own private + team-shared + admin-approved public), **excluding** rows where `promoted_at IS NOT NULL`. Picker merges with JS constants. Polled every 5 min (same cadence as effective-favorites). |
| `POST`   | `/api/bank-options` | coach | Body: full option payload + visibility + (if team) team_ids. Returns the new option_id. Public submissions get visibility=`pending`. |
| `PATCH`  | `/api/bank-options/:id` | author (or admin) | Edit. Triggers version bump. If row was public, flips back to pending. **Rejected if `promoted_at IS NOT NULL`** (promoted rows are frozen). |
| `DELETE` | `/api/bank-options/:id` | author (or admin) | Soft-delete recommended for unpromoted rows. Promoted rows can be hard-deleted by admin only (and only if the JS row has also been removed). |
| `POST`   | `/api/bank-options/:id/visibility` | author | Change visibility. Team→pick team_ids. Public→triggers admin review. |
| `GET`    | `/api/admin/pending-ugc` | admin | Pending public submissions queue. |
| `POST`   | `/api/admin/pending-ugc/:id/review` | admin | Body: `{ decision: "approve"\|"reject", reason? }`. Stamps `bank_option_reviews` + flips visibility. |
| `GET`    | `/api/admin/public-ugc` | admin | Public UGC list for the Graduate-to-JS tab. Filters where `visibility='public' AND promoted_at IS NULL`. |
| `POST`   | `/api/admin/ugc/:id/graduate` | admin | `?dry=1` returns the planned snippet + diff preview without writing. Without `?dry=1`, writes the JS file + stamps `promoted_at`. Returns `{ snippet, diff, insertionPointFound, written }`. |

All writes: `checkOrigin + requireAuth + requireAdmin + requireCsrf` (where admin-only); authoring uses `requireAuth + requireCoach + requireCsrf`.

---

## 5 — Validation (server-side, at insert/edit)

- `section` ∈ {warmup, drill, main, cooldown}
- `pool_mode` ∈ {25y, 25m, 50m}
- At least 1 set
- Each set: `reps > 0`, `dist > 0`, `desc` non-empty, `interval` matches `/^(On \d+:\d{2}|No interval.*)$/` OR equivalent
- `total_yards` matches sum of reps × dist (server recomputes; reject if author-provided differs by >10%)
- `label` ≤ 120 chars, `desc` ≤ 500, `focus` ≤ 240
- Max 50 unpromoted UGC options per coach (quota; promoted rows don't count against quota since they've graduated out)

Soft validations (warn but allow):
- Total yards > 5000 (unusual)
- More than 12 sets per option (unusual)
- Interval `On X:XX` where X seems off for the stroke/dist (e.g., 100 free On 1:00 = world-record pace)

---

## 6 — Edit & versioning

**Pre-promotion:** Versioning required. `bank_options.version` bumps on each edit. Workout payloads embed the option snapshot at generation time (already done today). Edit to a public set reverts visibility to `pending` for re-review.

**Post-promotion:** Row is frozen in DB (`promoted_at IS NOT NULL`). Further edits go through the JS file directly (regular code edit + redeploy). DB row exists only as audit history.

---

## 7 — Picker integration

The picker today filters JS constants directly:
```js
WARMUP_OPTIONS.filter(opt => /* relevance + equipment + recovery + budget + fav/disfav weight */)
```

After UGC ships, the only change is the input array:
```js
const candidates = [...WARMUP_OPTIONS, ...overlayWarmupOptions(myOverlay)];
candidates.filter(opt => /* SAME filter logic */)
```

- `WARMUP_OPTIONS` remains the JS constant (unchanged).
- `myOverlay` is the in-memory copy of `/api/bank/my-overlay`. Refreshes on the 5-min poll.
- `overlayWarmupOptions(myOverlay)` projects the overlay rows into the same shape WARMUP_OPTIONS has.

**Same filter logic.** Equipment-match, fav/disfav weight (3× / 0.25×), multi-lane fit, anti-repeat — UGC sets get the same treatment as JS canonical, they're just additional candidates.

**Coach-curation propagation** already handles team scope. When a coach favorites a UGC set, the favorite flows to their swimmers via [[swim-generator-favorites-prop-v13]] — no new propagation code needed.

**After graduation:** the JS row now exists with the same set IDs. The overlay endpoint excludes the promoted DB row, so the picker sees the set exactly once.

---

## 8 — Phases & estimate

| Phase | What | ~Hours |
|---|---|---|
| **Phase A** — Migration 031 (UGC schema corrections) | Drop in_export; author_sub NOT NULL; add promoted_at + promoted_by_sub; replace canonical-export index with overlay index. Reuses migration 030's tables (left empty since the architecture flip). | 1-2h |
| **Phase B** — UGC overlay endpoint + client merge | `GET /api/bank/my-overlay` returns own private UGC (still no authoring UI yet). Client fetches on mount + 5-min poll. Picker concat: JS canonical + overlay (where promoted_at IS NULL). Wired but empty (no UGC rows exist yet). | 3-4h |
| **Phase C** — Authoring (form + snapshot) — private only | "My Sets" page in coach dropdown + form modal + snapshot 📥 button on WorkoutBlock. Visibility = private only. Sets appear in own picker via overlay. UGC indicator badge (📝). | 6-8h |
| **Phase D** — Team sharing + propagation | Team picker on share modal. `bank_option_team_shares` writes. Overlay endpoint extends to include team-shared. Auto-propagation works because favorites system already does the heavy lifting. 👥 indicator. | 4-6h |
| **Phase E** — Public submission + admin moderation | Public-visibility flow → `pending`. Admin "Pending UGC" tab + approve/reject + review log. Re-approval-on-edit logic. 🌐 indicator. | 6-8h |
| **Phase F** — Graduate-to-JS tool + admin "Public UGC" tab | Server-side balanced-bracket walk to locate insertion points for any (section, pool_mode, type_id/stroke_id) tuple. Diff-preview modal in admin UI. `POST /api/admin/ugc/:id/graduate` writes the JS file (no commit). Snippet fallback when heuristic fails. Stamp `promoted_at`. | 6-8h |
| **Phase G** — Smoke + manual + tag | E2E across visibility tiers + author/edit/delete + admin review + graduate + post-graduate picker dedup. Manual section update. Tag `ugc-coach-sets-v1`. | 3-4h |

**Total: ~29-40h.** Lower than the prior hybrid scope's 32-45h because we drop the canonical-bank backfill, the export tool, and the staging UI; gain back ~3-4h on the Graduate-to-JS tool.

### Recommended ship order

**No standalone "ship first" recommendation anymore.** With JS-canonical architecture, Phases A-B don't have value beyond the UGC feature itself (they're not unlocking bank-edit-without-deploy or anything like that). Ship A through G as one contiguous build when coach demand triggers.

If you want to pre-bake to reduce time-to-ship-once-asked, you could land A+B (~4-6h) as silent infrastructure — but they truly do nothing until C lands, so the urgency is low.

---

## 9 — Risks & open questions

- **Graduation auto-edit heuristic getting the wrong insertion point.** Mitigation: diff-preview modal in admin UI BEFORE the file write commits. Admin sees exactly what changes and where; can cancel.
- **Public moderation review SLA.** No SLA committed in v1. If Cap'n's the sole reviewer and out for a week, public submissions stack up. v1.1 candidate: trusted-coach moderator role.
- **Quota at 50/coach.** Picked arbitrarily. Real number depends on what active coaches actually create. Promoted rows don't count.
- **Edit-reverts-public-approval annoyance.** Coaches will hate this if they want to fix a typo. Mitigation: define a "minor edit" path (label-only changes) that doesn't re-trigger review. Defer until a coach complains.
- **Bad-set risk via team auto-propagate.** A coach shares a broken set to their team → swimmers' picker breaks for that block until coach un-shares. Server-side validation catches structural issues but not "this set is poorly programmed." Acceptable risk; mitigation is the un-share button.
- **Pool-mode duplication.** Each pool mode has its own JS constant. A coach authoring for 25y — should the set auto-replicate for 50m / 25m, or is the coach expected to author each separately? **v1 decision: per-pool-mode authoring** (matches existing data model). v1.1 could add a "translate to other pool modes" button.
- **Bank label collisions.** UGC labels must be unique within `(author_sub, section, pool_mode)` but CAN collide with JS canonical labels (with the UGC indicator badge disambiguating in UI).
- **Post-promotion JS hygiene.** After graduation, the same set ID exists in BOTH JS (canonical) and DB (promoted, hidden). If a future migration drops the DB row, the JS row is still the authority. If the JS row gets deleted (e.g., bank cleanup), the picker loses the set. Audit responsibility: graduate slowly + watch git history.

**Out of scope for v1 (recorded so we don't relitigate):**
- Specific-coach DM tier (just-share-with-friend-Mary). Future.
- Automated moderation (LLM screening). Future.
- Versioning UI (history of edits). Author sees current version only.
- Forking / "duplicate-and-modify another coach's public set." Future.
- Rating / review system for public sets. Future.
- Bulk import (CSV/JSON of multiple sets at once). Future.
- Translation across pool modes. Future.
- Editing canonical JS bank from inside the app. That's a separate problem with its own constraints (declined twice — see catalog Phase III decline + 2026-05-24 architecture flip).

---

## 10 — Build status

**Approved 2026-05-25.** Testers requested the feature directly — no demand-trigger to wait on. Phases A through G ship in sequence; the spec doc above is the contract.

ROADMAP moves the entry from "Bigger threads" into "Now" / "Next" as build progresses.

---

## Appendix — What changed from the 2026-05-23/24 hybrid scope

The earlier version of this doc described a hybrid model: canonical bank lives in DB; client reads `public/bank-generated.js` (committed but regenerated by CLI); UGC overlays on top. That model was a misread of "have both db and js, then on a schedule export from db to js" — interpreted as bidirectional sync where Cap'n meant UGC's lifecycle (DB → JS via graduation).

What got built before the course-correction (commits `5fcc4ed`, `4019748`, `9dbb184`):
- Migration 030: 4 UGC tables + (now-defunct) `in_export` flag — tables stay, column removed in 031.
- `tools/sync_bank.mjs --import` + `tools/bank_importer.mjs` — to be removed (no canonical to import).
- `POST /api/admin/run-bank-import` route in server.js — to be removed.

The cleanup commit follows scope-rewrite acceptance.
