# May Code Review — Setforge

**Date:** 2026-05-29
**Reviewer:** fresh-eyes pass (deep, evidence-backed)
**Scope:** `server.js` (4,773 ln), `db.js` (7,274 ln), `public/index.html` SPA (27,989 ln), `lib/billing.js`, `lib/email.js`, migrations 033–042. Cross-referenced ROADMAP.md + CLEAN_SLATE_ANALYSIS.md.
**Method:** Four parallel deep audits (auth/billing, data layer, SPA, functionality gaps). Every code-level bug below was re-verified by hand against source before inclusion. Items I could not confirm from source (no live DB / no runtime) are explicitly labeled **NEEDS-CONFIRM** or **HYPOTHESIS** — they are not asserted as bugs.

This is a gap-analysis working doc, not a punch list to action blindly. Severity is my read; you decide priority.

---

## How to read this

Severity ladder: **BLOCKER** (breaks a shipped feature / loses revenue / loses data) → **BUG** (wrong behavior, bounded blast radius) → **SECURITY** → **UX** → **PERF** → **NIT**.

Each finding carries: symptom · evidence (`file:line`) · why it matters · suggested direction. I have not changed any code — everything here is diagnosis only.

---

## 1. Confirmed bugs (verified against source)

### 1.1 BLOCKER — Second re-anchor per group throws `ER_DUP_ENTRY`
**Where:** `migrations/036_group_anchors_string_ids.sql:28` + `db.js:4634` (`dbSetGroupAnchor`).

`group_anchors` has `UNIQUE KEY uq_one_active_per_group (group_id, active)`. That composite-unique permits exactly **one `active=1` AND one `active=0`** row per group. `dbSetGroupAnchor` re-anchors with replace-semantics:

```sql
UPDATE group_anchors SET active = 0, cleared_at = NOW() WHERE group_id = ? AND active = 1;
INSERT INTO group_anchors (group_id, event_id, set_by_coach_sub) VALUES (?, ?, ?);
```

- **1st anchor:** insert `(g,1)`. Fine.
- **1st re-anchor:** UPDATE flips the old row to `(g,0)`; INSERT adds `(g,1)`. Now `(g,0)` and `(g,1)` coexist. Fine.
- **2nd re-anchor:** UPDATE tries to flip `(g,1)` → `(g,0)`, but a `(g,0)` row already exists for that group → **UNIQUE violation, the whole re-anchor throws.**

**Why it matters:** Meet-anchored taper is a shipped Phase-3 feature. Any group that changes its anchor twice (a coach re-targets a meet, or fixes a wrong date) hits this on the second change. Memory notes no anchor.set completed in prod when 036 shipped, so this likely hasn't been hit at volume — which is exactly why it's worth fixing before it is.

**Direction:** The `active` flag can't carry uniqueness *and* keep audit rows. Options: (a) drop `active` from the unique key and enforce "one active" in the app layer (the cron/orphan story already does app-layer integrity elsewhere); (b) hard-delete the prior anchor instead of flipping to `active=0` (loses the audit trail); (c) a generated column that is `group_id` when active else `NULL`, uniquely indexed (keeps audit + DB-level guarantee). (c) is the cleanest if you want to keep the audit rows.

### 1.2 BLOCKER — Transiently-failed Stripe webhooks are never reprocessed
**Where:** `server.js:2578-2606`.

The handler inserts the dedupe row **before** processing, then short-circuits on *any* row existence:

```js
// Step: record event (dedupe) BEFORE processing
INSERT INTO stripe_webhook_events (stripe_event_id, ...) VALUES (?, ...)   // catch ER_DUP_ENTRY → 200 deduped
// Step: process
try { processWebhookEvent(...) ; UPDATE ... SET processed_status='processed' }
catch { UPDATE ... SET processed_status='failed'; res.status(200) }   // ← still 200
```

If `processWebhookEvent` throws (DB blip, Stripe API timeout inside `resolveUserSubFromEvent`), the row is marked `failed` but **kept**, and the route returns `200`. Stripe's retry of the same `event.id` then hits `ER_DUP_ENTRY` → returns `200 deduped` → **the event is never reprocessed.**

**Why it matters:** A dropped `customer.subscription.created` = a paying customer stuck on `free`. A dropped `invoice.paid` = a permanently missing `billing_history` row. This is silent revenue/ledger loss the moment billing goes live.

**Direction:** Only short-circuit when `processed_status='processed'`. On `failed`, let the retry through (or return non-200 so Stripe retries). Pairs naturally with a small "replay failed events" admin action.

### 1.3 BUG — Coach is revoked on `past_due` (transient dunning), not just terminal states
**Where:** `lib/billing.js:235`.

```js
if (["canceled", "unpaid", "incomplete_expired", "past_due"].includes(status)) {
  await revokeTier({ userSub, reason: ... });
}
```

Stripe marks a subscription `past_due` on the **first** failed payment retry — while dunning is still running and the customer may still pay. Including it here means a coach loses access mid-cycle on a transient card decline, before Stripe has given up.

**Why it matters:** A coach mid-season gets locked out of coach features because their card hiccuped on renewal, even though Stripe will retry and likely succeed. Bad first impression on the exact users who are paying.

**Direction:** Revoke only on terminal states (`canceled`, `unpaid`, `incomplete_expired`, and `customer.subscription.deleted`). Treat `past_due` as soft — no change, or a warning banner. Confirm against `BILLING_SCOPE.md` intent.

### 1.4 BUG — Duplicate `guardians` rows accumulate (dedupe-by-exception never fires)
**Where:** `db.js:3299-3311` (`dbConsumePendingInvitesForUser`) + `migrations/039_identity_persons.sql` guardians table.

The consume path inserts a guardians row and treats `ER_DUP_ENTRY` as a benign re-link:

```js
} catch (e) {
  if (e.code !== "ER_DUP_ENTRY" && !/duplicate/i.test(e.message || "")) { throw e; }
}
```

But the `guardians` table has only `INDEX idx_swimmer (swimmer_person_id, removed_at)` and `INDEX idx_guardian (...)` — **no `UNIQUE (swimmer_person_id, guardian_person_id)`** (verified in migration 039). So the dup never throws; a parent who signs in twice with pending invites (or has two pending invites for the same swimmer) gets **duplicate active guardian rows.**

**Why it matters:** Duplicates inflate guardian counts in `dbListGuardiansForSwimmer` and weekly-digest fan-out. The parent dashboard happens to dedupe swimmers via a `Set` (`db.js:3420`), which *masks* the problem on screen — so it'll be invisible until a count or a digest looks wrong.

**Direction:** Add `UNIQUE (swimmer_person_id, guardian_person_id)`. Because rows soft-delete via `removed_at`, decide the re-add story: either a partial-unique (active rows only) or a reactivate-on-conflict path so a removed+re-added pair doesn't collide.

---

## 2. Security findings

### 2.1 SECURITY (low) — Impersonation session survives `support_role` revocation
**Where:** `db.js:934-939` (`dbValidateImpersonationHeader`) vs. `server.js:1015-1021` (start-route authz).

Authorization (`is_admin`/`support_role`) is checked only when an impersonation session is **created**. The per-request validator only confirms an active row exists and matches the target. If an admin revokes a user's `support_role` while that user holds an active impersonation session, it keeps working until the 30-min cap expires.

**Direction:** Re-assert `dbIsAdmin || dbIsSupportRole` on each impersonated request, or end active sessions when `support_role` is revoked.

### 2.2 OBSERVATION (confirm intent) — No server-side *payment* gate on coach features
**Where:** all coach routes gate on `requireCoach` → `dbIsCoach` (the `is_coach` flag); `grantTier` (`billing.js:305`) sets only `tier`, never `is_coach`. `BILLING_SCOPE.md:94` declares `is_coach` and `tier` independent **by design.**

Net effect: a user with `is_coach=1, tier='free'` has full, unpaid access to every coach feature. If the intent is "admin manually grants coach + billing is tracked separately," this is correct as-is. If the intent is "coaches must pay to use coach features," **there is no enforcement of that anywhere server-side.** Flagging to confirm intent before billing goes live — not labeling a bug, since the scope sanctions the decoupling.

### 2.3 Clean bills of health (verified — do NOT touch)
- **Stripe webhook raw body** is correct: `express.json()` skips `/api/billing/webhook` (`server.js:206`), route uses `express.raw(...)` and passes the Buffer into signature verify. The hard-won fix held.
- **CSRF coverage is complete.** All 122 state-changing `fetch()` calls in the SPA send a token (via `csrfHeaders()` or an inline `X-CSRF-Token`); server applies `checkOrigin + requireAuth + requireCsrf` on every cookie-authed write. No state-changing route ships without CSRF except the deliberate exceptions (webhook, signout).
- **No SQL injection found.** Every dynamic-column path is allowlisted; all user values are parameterized.
- **OAuth state/nonce** handling (Apple + Google) verified correct: exact state-cookie comparison, full id_token signature/iss/aud/exp verification.
- **The ParentsPanel field-name bug class is clean.** The original `{email}` vs `{parent_email}` mismatch is fixed (`index.html:20228` ↔ `server.js:3039`), and a full diff of client body keys vs. server destructuring surfaced **no other instances.**

---

## 3. UX findings (front-end)

### 3.1 UX — Core swimmer self-logging uses native `window.prompt()` dialogs
**Where:** `public/index.html:19027, 19035, 19040` (`AssignedToMe` mark complete/partial/missed).

The primary swimmer interaction — "mark my workout done, rate difficulty 1–5, add a note" — is three sequential unstyled browser prompts. On mobile they're cramped, can't render the 1–5 scale as buttons, and break the visual design.

**Companion BUG:** `parseInt(diffStr,10)` silently discards out-of-range / non-numeric input (`19026-19042`). A swimmer who types "9", "8/10", or "hard" gets no error — difficulty is dropped and the workout is marked complete with no rating.

**Direction:** Replace with a small in-app modal (difficulty as five buttons, optional note field, validation feedback). This is a high-traffic swimmer path and the most-felt friction in the app.

### 3.2 UX — "Mark on behalf" / self-log buttons have no busy state (double-submit hazard)
**Where:** `index.html:19242-19255` + buttons at `19289/19291` (coach), `19011-19024` (self).

Buttons stay enabled through `await fetch(...) → await load()`. A double-tap fires two PATCHes. Low data risk (idempotent state set) but no feedback the click registered. Contrast with `EditableProfileField` and team-curation `addCuration`, which correctly disable while saving — so the pattern exists, it's just not applied here.

### 3.3 UX — Editing your own email strands you as permanently "unverified"
**Where:** `index.html:14293-14311` ↔ `server.js:856-878`.

The Account tab lets you edit `email`; the change optimistically sets `email_verified:false` and the server honors it. But per the OAuth-only design (no auth-email channel, no magic links) **there is no re-verification flow** — so editing your email leaves you unverified forever. **NEEDS-CONFIRM** whether `email_verified` gates anything; if it doesn't, this is cosmetic, but the inconsistency is real.

**Direction:** Either make the field non-editable (email comes from the OAuth provider anyway), or make "unverified" explicitly harmless and explained.

### 3.4 A11y — Several modal close buttons lack `aria-label`
**Where:** `✕`/`×` buttons at `index.html:11806, 11937, 13033, 13481, 13556, 19610` (glyph only, no accessible name). Inconsistent with the correctly-labeled ones at `12866, 13191, 14218` (`aria-label="Close"`). Cheap, mechanical fix.

### 3.5 A11y — `EditableProfileField` input not associated with its label
**Where:** `index.html:12293-12310`. The visible "Email:" / "Display name:" is a plain `<span>`, the `<input>` has no `id`/`aria-label`. Screen readers read it as unlabeled. Reused for every Account-tab field, so one fix covers all.

### 3.6 Well-built UX (don't touch)
`FeedbackModal` state machine, `GroupAssignmentsPanel` loading/empty/error states, team-curation `addCuration` busy+conflict handling, `handleLogAsToday` optimistic-add-with-rollback + 409-as-success, and color+text completion labels (not color-only) are all solid.

---

## 4. Performance & data-integrity (lower urgency)

### 4.1 NEEDS-CONFIRM (likely BUG on hot path) — Collation mismatch on effective-curation JOINs
**Where:** `db.js:1381-1390` (`dbGetEffectiveDisfavorites`) and `db.js:1600-1609` (`dbGetEffectiveFavorites`):

```sql
JOIN groups g ON g.team_id = td.team_id   -- (and tf.team_id)
```

`db.js:6430-6445` documents that `team_coaches.coach_sub` is `utf8mb4_general_ci` (legacy default) while migration-026+ tables are `utf8mb4_unicode_ci`, and that the **unhandled mix already threw "Illegal mix of collations"** once — the R6 hot-fix added an explicit `COLLATE`. The team-curation tables (migration 041) declare no explicit charset, so they inherit the DB default (almost certainly `unicode_ci`), while legacy `groups.team_id` is likely `general_ci`. **If so, these two JOINs throw at runtime for any user on a team with team-level curation** — and unlike R6 (admin-only report), `dbGetEffective*` runs on **every Generate and every 5-min poll.** The R6 `COLLATE` fix was **not** applied here.

**Why NEEDS-CONFIRM:** confirming requires `SHOW CREATE TABLE groups` / `team_favorites` against the live DB, which I can't run from source. The R6 precedent proves the mismatch is real for at least one legacy table, so this is one query away from confirmed.

**Direction:** Run the `SHOW CREATE TABLE` check. If collations differ, add the same explicit `COLLATE utf8mb4_unicode_ci` the R6 fix used. (As a bonus, forced collation conversion also defeats any index on `groups.team_id` — so it's a perf issue even where it doesn't throw.)

### 4.2 BUG (low) — Out-of-order subscription webhooks can clobber tier state
**Where:** `lib/billing.js:228-244` + `grantTier`/`revokeTier`. Events dispatch purely on `obj.status` and write unconditionally with `tier_granted_at = NOW()`. Stripe does not guarantee ordering; a late stale `past_due` delivered after a newer `active` will revoke a paying user (or vice versa). No event-timestamp / version guard. Lower likelihood than 1.2, same blast radius. Worth a `created`-timestamp guard when you touch 1.2/1.3.

### 4.3 BUG (low) — Email worker can strand rows in `status='sending'`
**Where:** `lib/email.js:201-238` + `processQueue:246-248`. If a send fails and the retry-scheduling `pool.query` itself throws (or the final-failure UPDATE throws), the row is left `status='sending'` and never re-claimed (`claimPending` only selects `'pending'`). `processQueue` awaits `sendOne` per row with no try/catch, so a throw also aborts the rest of the batch. Low likelihood, but silently strands outbox rows. Wrap each `sendOne` in try/catch + a sweep that resets long-stuck `'sending'` rows.

### 4.4 PERF — Weekly-digest cron is N+1 (acceptable now, will spike later)
**Where:** `db.js:3540` → per parent → `dbListSwimmersForParent` (3 queries) + per-swimmer payload (2–3 each), in one synchronous loop on a 10-connection pool. Fine at MVP scale; becomes a Sunday-night spike as the parent base grows. Also verify `workout_assignments` (legacy table) is indexed on the columns the per-swimmer query filters.

### 4.5 PERF / cost — Four 5-minute polls run for every user regardless of role
**Where:** `index.html:24806, 24828, 24850, 24874` (effective-disfavorites, effective-favorites, my-constraints, ugc-overlay). A solo free user with no coach fires all four forever. Cleanup/hydration guards are correct (not a leak), just needless server load. Gate on role.

### 4.6 NITs (low risk)
- **Non-transactional persons + parent-table inserts** (`db.js:158-166`, `3823-3838`) can orphan a `persons` row on a non-dup second-insert failure; no cron sweep for these. Wrap in the existing `beginTransaction` pattern.
- **`settings.extra` JSON read-merge-write** (`db.js:320-338`) is last-writer-wins on the whole blob; concurrent writes can drop an engine-curation tuple. Rare (single user, mostly serialized).
- **Team fav/disfavor mutex** (`db.js:2954-2991`) is check-then-insert across two tables with no transaction — TOCTOU; picker precedence resolves it cosmetically.
- **HYPOTHESIS (unconfirmed):** a literal `"0:00"` interval in `PaceClockView` (`index.html:11488-11537`) would auto-complete all reps instantly, because `parseIntervalSeconds("0:00")` returns `0` (not `null`) so `hasTimer` is true. I could not confirm any workout emits a literal `0:00`. Cheap guard: `hasTimer = totalSecs !== null && totalSecs > 0`.
- **`billing_history` ledger** has no UNIQUE on `stripe_invoice_id`/`stripe_charge_id` (NEEDS-CONFIRM against migration 038). Route-level dedupe covers normal flow; a future replay path could double-insert. Consider a unique index for ledger integrity.

---

## 5. Functionality gaps & enhancements

All "shipped" ROADMAP claims were spot-checked against code — **no rolled-back-but-marked-shipped regressions found this pass.** The gaps below are genuinely scoped-not-shipped or dormant.

### Gaps (scoped / half-built / dormant)

| # | Item | State in code | Value | Effort | Note |
|---|------|---------------|-------|--------|------|
| A1 | **Ownership transfer + UGC reassignment** | Only `dbTransferGroupPrimary` (group-level swap) exists; `team_ownership_transfers` → **0 hits**. Team `owner` hardcoded immutable (`server.js:2800`). | HIGH | ~12–18h | Gates the **$25 Program tier**; teams orphan on founder exit. |
| A2 | **Data portability + tombstone-on-delete (I-G)** | `persons.tombstoned_at` column exists (forward-compat). **No export route, no self-delete, no tombstone helpers.** | HIGH | ~12–18h | Hard blocker for 501(c)(3) board approval. Bundle with A1 (shared cascade design). |
| A5 | **Billing live-mode never verified** | Full Checkout/portal/webhook behind `BILLING_ACTIVE = !!secret_key`; test mode works. Live + cancellation E2E never run. | HIGH | S (verify) | Code is done — this is ops, and it unblocks all revenue. **Cheapest high-value item.** |
| A3 | **Identity I-F (drop legacy name columns)** | I-A→I-D shipped; dual-read fallback live. Drop migration paused 2026-05-27. | MED | ~1–2h | Longer the fallback runs, the more risk a new write path re-grows a legacy dependency. Soak gate ≈ 2026-06-27. |
| A4 | **Onboarding tour** | **9 `data-tour="step-*"` anchors placed, but no driver reads them** (`startTour`/`TourOverlay`/`shepherd` → 0 hits). Onboarding is external markdown today. | MED | ~8–12h | Scaffold already in place; wire a 3-card walkthrough. Removes the most-cited UX gap. |
| A6 | **Parent-invite expiry sweep** | Reads filter `expires_at > NOW()`; no `dbExpireParentInvites` in the worker tick. | LOW | ~1h | Dead rows linger, harmless. |

### Enhancements (extend shipped features)

| # | Item | Value | Effort | Note |
|---|------|-------|--------|------|
| B1 | **Pluggable section model + dryland** | HIGH | L+ (15–25h) | Workout hard-locked to 4 sections; Cap'n confirmed v2-tier. Scope session first (ROADMAP:110). Touches ~12 places. |
| B2 | **PSC real substitution (vs. annotation-only) + non-managed coach panel** | MED-HIGH | M | `computeSubstitutionsForSwimmer` (`index.html:8065`) currently only **annotates** ("would substitute X for Y"); doesn't swap rendered content. (Re-confirm at runtime.) |
| B4 | **Account-merge admin tool** | MED→HIGH | ~3–5h | No merge code; documented path is hand-written SQL. Triggers on the Apple-relay↔Google dual-account edge. Spec in ROADMAP:109. Build before first support case. |
| B3 | **Reporting v1.1 (real calcs + charts + R5/R6 PDF)** | MED | M | R6 uses a "simplified proxy"; all reports are tables, charts deferred. |
| B6 | **Tier-aware rate limits** | LOW | S | `writeLimiter` flat 500/min for all. Trivial once billing live; meaningless before. |

---

## 6. Recommended order (my read — you decide)

1. **A5 — verify billing live-mode + cancellation E2E.** Code's done; unblocks revenue; cheapest high-value item. *But fix 1.2 (webhook reprocess) and 1.3 (`past_due`) first* — going live with those is how you silently lose paying customers.
2. **1.1 group_anchors blocker** — small migration, prevents a shipped feature from throwing on re-anchor.
3. **1.4 guardians UNIQUE** — small migration, stops duplicate accumulation before the parent base grows.
4. **4.1 collation check** — one `SHOW CREATE TABLE` to confirm; if it bites, it's on the hot path.
5. **A3 Identity I-F** — ~1–2h, soak gate nearly passed, prevents fallback rot.
6. **A4 onboarding tour** — scaffold placed; highest UX ROI.
7. **A1 + A2 bundled** — unblock $25 Program tier + board approval. Highest strategic value.
8. **3.1 swimmer self-logging modal** — most-felt everyday friction.
9. Everything else opportunistic.

---

## 7. Confidence & caveats

- **Verified by hand against source:** 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, all §2.3 clean bills, and the A-table "0 hits" claims.
- **NEEDS-CONFIRM (needs live DB):** 4.1 collation, 4.6 billing_history unique index.
- **HYPOTHESIS (couldn't confirm trigger):** §4.6 `0:00` interval.
- The legacy schema (pre-026 tables) isn't in the repo, so a few JOIN-into-legacy claims rest on documented behavior (R6 precedent) rather than the table DDL. No runtime testing was performed — this is a static review.
