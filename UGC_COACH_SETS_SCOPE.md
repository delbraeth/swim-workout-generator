# UGC Coach-Authored Sets — v1 Scope

**Status:** scope locked 2026-05-23. Build pending (Bigger thread on ROADMAP). Companion concept to the existing curation system ([[swim-generator-favorites-prop-v13]]) which only re-weights HARDCODED bank options. UGC adds the ability for coaches to contribute their own option content into the picker.

This doc is the planning-session output. After Cap'n signs off, it moves to Bigger threads → build trigger (likely: first paying coach explicitly asks "can I add my own sets?" OR a coach pilot reveals that bank gaps are stalling adoption).

---

## 1 — Locked decisions (2026-05-23)

| Aspect | Choice |
|---|---|
| **Authoring** | **Both form-based AND snapshot.** Form for from-scratch sets (reps/dist/desc/interval/stroke/focus fields, mirrors bank schema). Snapshot for "I like this set the engine just generated — save it to my collection." Two entry points, one underlying record. |
| **Sharing tiers** | **Private + Team-I-pick + Public-with-moderation.** Private = just the author. Team = author picks one or more specific teams they coach. Public = visible to all SetForge coaches' pickers but requires admin approval before going live. No "specific-coach DM" tier in v1. |
| **Engine integration** | **Extend the bank with an `author_sub` column.** UGC sets live in the SAME tables as hardcoded bank options (`WARMUP_OPTIONS`/`MAIN_OPTIONS`/etc. + their underlying set rows once migrated to DB), distinguished by `author_sub IS NULL` (hardcoded canonical) vs. non-null (UGC). Picker treats them identically. Existing fav/disfav/curation systems just work. |
| **Propagation** | **Auto-propagate to team.** Coach shares to team → swimmers in that team see the set in their picker immediately (mirrors existing [[swim-generator-favorites-prop-v13]] coach→swimmer flow). Coach can un-share to revert. Risk acknowledged — a bad set silently spreads; mitigation is the un-share + the swimmer can disfavor it. |
| **Set ID convention** | **Reuse `s_xxxxxx`.** Server auto-generates the ID at insert; coach never sees or sets the ID. Maintains consistency with hardcoded bank (`tools/assign_set_ids.py` pattern). |
| **Moderation gate (public tier only)** | **Admin queue.** Public submission → status `pending` → admin sees in a new "Pending UGC" admin tab → approves or rejects. Approved → status `public`, visible. Rejected → status `rejected` with reason, visible to author only. No automated moderation in v1 (manual). |

---

## 2 — Data model

### Migration 030 (UGC bank extension)

```sql
-- Today the bank is JavaScript constants. UGC requires a DB-backed bank.
-- Two parts: (a) migrate existing JS bank into DB rows once at deploy time;
-- (b) add author + visibility columns for UGC.

-- 2a. New bank_options table (one row per "option" — warm-up / drill / main / cooldown variant)
CREATE TABLE IF NOT EXISTS `bank_options` (
  `id`              VARCHAR(8)   PRIMARY KEY,            -- e.g. "o_a1b2c3" (parallel to s_xxx for sets)
  `section`         VARCHAR(16)  NOT NULL,                -- "warmup" | "drill" | "main" | "cooldown"
  `type_id`         VARCHAR(16)  NULL,                    -- IM/distance/sprint/etc. NULL for warmup/cooldown
  `stroke_id`       VARCHAR(16)  NULL,                    -- "free"|"back"|... or NULL
  `pool_mode`       VARCHAR(8)   NOT NULL DEFAULT '25y',  -- "25y" | "25m" | "50m"
  `label`           VARCHAR(120) NOT NULL,
  `total_yards`     INT          NOT NULL,
  `type_affinity`   JSON         NULL,                    -- ["sprint","distance"] etc.
  `equipment_req`   JSON         NULL,                    -- {"kickboard":"required",...}
  `author_sub`      VARCHAR(64)  NULL,                    -- NULL = hardcoded canonical; non-null = UGC
  `visibility`      VARCHAR(16)  NOT NULL DEFAULT 'canonical',  -- "canonical" | "private" | "team" | "public" | "pending" | "rejected"
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `version`         INT          NOT NULL DEFAULT 1,      -- bumped on edit (see §6 history-snapshot)
  INDEX `idx_bank_section_pool` (`section`, `pool_mode`),
  INDEX `idx_bank_author` (`author_sub`, `visibility`),
  INDEX `idx_bank_visibility_pending` (`visibility`)       -- fast admin pending queue
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2b. Sets within an option (replaces the JS `sets: [...]` array)
CREATE TABLE IF NOT EXISTS `bank_sets` (
  `id`              VARCHAR(8)   PRIMARY KEY,            -- s_xxxxxx convention
  `option_id`       VARCHAR(8)   NOT NULL,
  `seq`             INT          NOT NULL,                -- order within option
  `reps`            INT          NOT NULL,
  `dist`            INT          NOT NULL,
  `desc`            TEXT         NOT NULL,
  `interval`        VARCHAR(60)  NOT NULL,
  `focus`           VARCHAR(240) NULL,
  `stroke`          VARCHAR(16)  NULL,
  INDEX `idx_bank_sets_option` (`option_id`, `seq`),
  CONSTRAINT `fk_bank_sets_option` FOREIGN KEY (`option_id`) REFERENCES `bank_options`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2c. Team scope for "team" visibility — many-to-many
CREATE TABLE IF NOT EXISTS `bank_option_team_shares` (
  `option_id`       VARCHAR(8)   NOT NULL,
  `team_id`         VARCHAR(8)   NOT NULL,
  `shared_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`option_id`, `team_id`),
  CONSTRAINT `fk_bots_option` FOREIGN KEY (`option_id`) REFERENCES `bank_options`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_bots_team`   FOREIGN KEY (`team_id`)   REFERENCES `teams`(`id`)        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2d. Moderation review log (for public submissions)
CREATE TABLE IF NOT EXISTS `bank_option_reviews` (
  `id`              BIGINT       AUTO_INCREMENT PRIMARY KEY,
  `option_id`       VARCHAR(8)   NOT NULL,
  `reviewer_sub`    VARCHAR(64)  NOT NULL,
  `decision`        VARCHAR(16)  NOT NULL,                -- "approve" | "reject"
  `reason`          TEXT         NULL,                    -- shown to author on reject
  `reviewed_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_bor_option` (`option_id`),
  CONSTRAINT `fk_bor_option` FOREIGN KEY (`option_id`) REFERENCES `bank_options`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### One-time backfill (must run AFTER migration before code goes live)

`tools/backfill_bank_to_db.mjs` (new): walks the JS constants (`WARMUP_OPTIONS` etc., all 12 of them across 3 pool modes), INSERTs each as `bank_options` + `bank_sets` rows with `author_sub=NULL`, `visibility='canonical'`, IDs re-using existing `s_xxxxxx` values where present (already in JS). 600+ option rows + ~2000 set rows. Idempotent: skip rows where ID already exists.

### Picker query change

Today: JS picker filters `WARMUP_OPTIONS.filter(...)`. After backfill: JS picker calls a server endpoint (or downloads the bank on session start) that returns options filtered by `WHERE visibility = 'canonical' OR (visibility = 'private' AND author_sub = ?) OR (visibility = 'team' AND option_id IN (...team-shares for teams I'm in...)) OR visibility = 'public'`. Cached in client state, refreshed on the same 5-min poll cadence as effective-favorites.

---

## 3 — UI surfaces

### A. Authoring (form-based) — "My Sets" page

- **Where:** new "📝 My Sets" entry in the 🔧 coach dropdown (alongside Teams / Catalog / Reports).
- **List view:** all sets the coach has authored. Columns: label · section · pool mode · visibility · last-edited.
- **Each row:** edit · duplicate · change-visibility · delete (with confirmation).
- **+ New set button:** opens a form modal. Fields: section, type (if main), stroke, pool mode, label, total yards, then a repeating "set row" group (reps / dist / desc / interval / focus). Save → POST `/api/bank-options`.

### B. Authoring (snapshot) — "Save this set" button on generated workouts

- **Where:** new icon button (📥) in `WorkoutBlock` header next to existing favorite toggle, visible only to coaches.
- **Tap:** opens a small modal pre-filled with the block's current sets. Coach picks visibility + (if team) which team(s). Confirm → POST `/api/bank-options` with the pre-filled payload. Toast confirms.

### C. Visibility change

- **Where:** the row-level action in "My Sets" AND on the snapshot save modal.
- **State machine:** private ↔ team (pick teams) ↔ public (triggers admin review queue, status flips to `pending` while waiting).

### D. Admin moderation queue

- **Where:** new "Pending UGC" tab in AdminView.
- **Each row:** option label · author · submitted-at · "👁 Preview" (renders the option in a read-only block) · ✅ Approve · ❌ Reject (with reason).
- Approve → visibility = `public`. Reject → visibility = `rejected`, author sees with reason on their "My Sets" page.

### E. UGC indicator in picker output

- **Where:** generated workout blocks (WorkoutBlock component).
- A small badge appears on UGC-sourced blocks: 📝 own-authored, 👥 team-shared (from your coach), 🌐 public.
- Hardcoded canonical blocks have no badge (unchanged from today).

---

## 4 — Server routes

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET`    | `/api/bank-options` | any auth | Returns options visible to caller (canonical + own private + team-shared + public). Replaces the JS constants over time. Cached client-side. |
| `POST`   | `/api/bank-options` | coach | Body: full option payload + visibility + (if team) team_ids. Returns the new option_id. Public submissions get visibility=`pending`. |
| `PATCH`  | `/api/bank-options/:id` | author (or admin) | Edit. Triggers version bump (§6). |
| `DELETE` | `/api/bank-options/:id` | author (or admin) | Soft-delete recommended (mark hidden); hard-delete only by admin. |
| `POST`   | `/api/bank-options/:id/visibility` | author | Change visibility. Team→pick team_ids. Public→triggers admin review. |
| `GET`    | `/api/admin/pending-ugc` | admin | Pending public submissions queue. |
| `POST`   | `/api/admin/pending-ugc/:id/review` | admin | Body: { decision: "approve"|"reject", reason? }. Stamps `bank_option_reviews` + flips visibility. |

All authenticated; writes CSRF-protected and rate-limited via existing writeLimiter.

---

## 5 — Validation (server-side)

Required at insert/edit time:
- `section` ∈ enum
- `pool_mode` ∈ enum
- At least 1 set
- Each set: `reps > 0`, `dist > 0`, `desc` non-empty, `interval` matches `/^(On \d+:\d{2}|No interval.*)$/` OR equivalent
- `total_yards` matches sum of reps × dist (server recomputes; reject if author-provided differs by >10%)
- `label` ≤ 120 chars, `desc` ≤ 500, `focus` ≤ 240
- Max 50 UGC options per coach (quota)

Soft validations (warn but allow):
- Total yards > 5000 (unusual)
- More than 12 sets per option (unusual)
- Interval `On X:XX` where X seems off for the stroke/dist (e.g., 100 free On 1:00 = world-record pace)

---

## 6 — Edit & versioning

**Problem:** UGC sets get embedded in workout payloads (via `workouts.payload.blocks[].sets[]`). If a coach edits a UGC set, what happens to historical workouts?

**Decision:** Versioning required. `bank_options.version` bumps on each edit. Payloads embed the option snapshot at generation time (already done today — payload contains full block content, not just refs). So historical workouts stay accurate; the picker uses the current version going forward.

**Edge case:** a coach edits a public set after admin approval. Should re-approval be required? **v1 decision: yes** — any edit to a public set flips visibility back to `pending`. Author sees "approval reverted, edit pending re-review." Annoying but safe.

---

## 7 — Picker integration deep-dive

The picker today filters JS constants by:
- Section + type/stroke for relevance
- Equipment requirements vs. user equipment
- Recovery mode (filters to low-intensity)
- Yardage budget
- Fav/disfav weight modifiers (3× / 0.25×)

After UGC ships, picker filters server-returned options the same way. UGC sets get the SAME treatment as canonical:
- Same equipment-match filter
- Same fav/disfav weight (a coach can ★ their own UGC, swimmers can 👎 a UGC set, all the usual rules apply)
- Same multi-lane fit constraint (validator runs)
- Same anti-repeat memory (no special-casing)

**Coach-curation propagation already handles team scope.** When a coach favorites a UGC set, that favorite flows to their swimmers via [[swim-generator-favorites-prop-v13]] — no new propagation code needed.

---

## 8 — Phases & estimate

| Phase | What | ~Hours |
|---|---|---|
| **Phase A** — Migration + backfill | Migration 030 + `tools/backfill_bank_to_db.mjs` + sanity verify (canonical row count matches JS constant count). Picker still reads JS constants; DB is just shadowed. | 4-6h |
| **Phase B** — Picker reads DB | Switch picker to call `/api/bank-options`. Client caches. Delete JS constants (or keep as fallback for offline). All workouts continue to work; DB-backed bank verified at parity. | 4-6h |
| **Phase C** — Authoring (form + snapshot) | "My Sets" page + form modal + snapshot 📥 button. Visibility = private only in this phase. | 6-8h |
| **Phase D** — Team sharing | Team picker on share modal. `bank_option_team_shares` writes. Picker query extends to include team-shared options. UGC indicator badge (📝/👥). | 4-6h |
| **Phase E** — Public + moderation | Public-submission flow. Admin "Pending UGC" tab. Review log. Re-approval-on-edit logic. 🌐 indicator. | 6-8h |
| **Phase F** — Smoke + manual + tag | E2E exercise across all visibility tiers + author/edit/delete + admin review. Manual sweep + new section. Tag `ugc-coach-sets-v1`. | 3-4h |

**Total: ~27-38h.** Original ROADMAP estimate was 20-40h; this lands inside that.

---

## 9 — Risks & open questions

**Honest gaps that will surface during build:**

- **Public moderation review SLA.** No SLA committed in v1. If Cap'n's the sole reviewer and out for a week, public submissions stack up. v1.1 candidate: trusted-coach moderator role.
- **Quota at 50/coach.** Picked arbitrarily. Real number depends on what active coaches actually create. Adjust after first month.
- **Edit-reverts-public-approval annoyance.** Coaches will hate this if they want to fix a typo. Mitigation: define a "minor edit" path (label-only changes) that doesn't re-trigger review. Defer until a coach complains.
- **Bad-set risk via team auto-propagate.** A coach shares a broken set to their team → swimmers' picker breaks for that block until coach un-shares. Server-side validation catches structural issues but not "this set is poorly programmed." Acceptable risk; mitigation is the un-share button.
- **JS-to-DB bank backfill performance.** ~600 options × ~2000 sets. Should run in <30s. If slower in prod, batch the INSERTs.
- **Pool-mode duplication.** Today each pool mode has its own JS constant (`WARMUP_OPTIONS_50M` etc.). A coach authoring for 25y — should the set auto-replicate for 50m / 25m, or is the coach expected to author each separately? **v1 decision: per-pool-mode authoring** (matches existing data model). v1.1 could add a "translate to other pool modes" button.
- **Bank label collisions.** Today `tools/check_label_collisions.py` ensures bank labels are unique. UGC could collide with canonical names. **v1 decision: UGC labels must be unique within (author_sub, section, pool_mode)** but CAN collide with canonical labels (with the UGC indicator badge disambiguating in UI).

**Out of scope for v1 (recorded so we don't relitigate):**
- Specific-coach DM tier (just-share-with-friend-Mary). Future.
- Automated moderation (LLM screening). Future.
- Versioning UI (history of edits). Author sees current version only.
- Forking / "duplicate-and-modify another coach's public set." Future.
- Rating / review system for public sets. Future.
- Bulk import (CSV/JSON of multiple sets at once). Future.
- Translation across pool modes. Future.

---

## 10 — Trigger to build

Per original ROADMAP capture: confirm demand from coach pilot OR plan it as part of broader catalog evolution. Two paths:

1. **Demand-pull**: first paying coach explicitly asks "can I add my own sets?" Build immediately, ship Phases A-C (private-only) first.
2. **Push as foundation**: ship Phases A+B (migration + DB-backed picker) as standalone tech-debt cleanup BEFORE coach pilots arrive. This unblocks UGC AND removes a long-standing "bank is hardcoded constants" pain point. Phases C-F can then ship in response to demand.

**Recommendation: path 2.** Phases A+B are pure plumbing — no user-visible behavior change — and they convert the bank from a code-deploy-required artifact into a data-edit-able one. That has value beyond UGC (e.g., bank corrections without redeploy). Once that's in place, the UGC layers (C, D, E) become incremental and demand-driven.

Until then: this doc is the contract. ROADMAP entry stays under Bigger threads.
