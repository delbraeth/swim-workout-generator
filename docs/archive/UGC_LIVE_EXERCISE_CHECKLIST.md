# UGC v1 — Live-exercise checklist (Phase G)

This is the runbook for end-to-end browser exercise of the full UGC feature on https://setforge.io after the `ugc-coach-sets-v1` tag is cut. Work through it in order; each step has a pass condition. If a step fails, write the failure mode at the bottom under "Findings" and decide between hot-fix vs follow-up commit.

**Test accounts needed:** at minimum one **coach** account (you, Cap'n) and one **admin** account. A **swimmer** in your group is nice-to-have but not required (you can verify the swimmer-side view via View-as v2).

---

## 1. Phase B/C — Author a private UGC option

1. As coach, open the menu → **📝 My Sets**.
2. Click **+ New set**. Fill in:
   - Section: **drill / pre-main**
   - Pool: **25y**
   - Type: check **distance** (only)
   - Stroke: (leave empty)
   - Label: `G-exercise drill (private)`
   - Add one set: `4 × 50 kick @ On 1:00, focus = legs`
3. Save. **Pass:** row appears in My Sets with visibility `📝 private`.
4. Reload the page. **Pass:** row persists (it's in `bank_options` DB, not just local state).
5. Open Generate, pick **drill / distance / 25y**, Generate. Within a few generates, your new option should pull. **Pass:** the WorkoutBlock for that pick shows the **📝 UGC** badge.

## 2. Phase C — Edit, snapshot, delete

1. In My Sets, edit your row. Change one set's reps. Save. **Pass:** edit reflected in the list, badge stays 📝 UGC.
2. Generate a workout. Click the **📥** snapshot button on any non-UGC block. **Pass:** UgcFormModal opens pre-filled with that block's data. Cancel.
3. In My Sets, delete the row. **Pass:** row gone from list AND no longer pulls in Generate (try ~5 generates to confirm).

## 3. Phase H Stage 1 — Multi-tag UGC

1. Create a new UGC option:
   - Section: **drill / pre-main**, Pool: **25y**
   - Type: check **distance** AND **sprint**
   - Stroke: check **free** AND **back**
   - Label: `G-exercise multi-tag kick`
   - One set: `8 × 50 kick @ On 1:15`
2. Save. **Pass:** My Sets row shows comma-joined tags (e.g., `distance, sprint, free, back`).
3. Generate (drill / distance / 25y): your option may pull.
4. Generate (drill / sprint / 25y): your option may pull.
5. Generate (drill / free / 25y): your option may pull.
6. Generate (drill / back / 25y): your option may pull.
   - **Pass:** the same option appears across multiple type/stroke buckets without you having to duplicate it.
7. Open Catalog browse, drill / all / 25y: your multi-tag option appears **exactly once** (not 4x). This is the dedup fix in `getOverlayRowsForTuple`.

## 4. Phase D — Team sharing

1. (If you have a team) Edit your multi-tag option. Switch visibility to **👥 Team-shared**. Pick a team. Save.
2. **Pass:** My Sets shows `👥 team`. If another coach on that team logs in (or you View-as them), they see it pull in Generate with the **👥 TEAM** badge.
3. If you have no other coaches on the team, at least verify the visibility radio + team multi-select renders and saves.

## 5. Phase E — Public submission + moderation

1. Edit your option. Switch visibility to **🌐 Public**. Save. **Pass:** My Sets shows `⏳ pending`.
2. Log in as admin (or impersonate via View-as v3). Open **Admin → Pending UGC** tab.
3. **Pass:** your pending option appears. Click **Approve**.
4. Back as coach: My Sets row now shows `🌐 public`. Other users (not your group) can see it in their overlay. The picker shows it with the **🌐 PUBLIC** badge.
5. (Reject path) Submit another option as public, reject it from Admin with a reason. **Pass:** My Sets shows `❌ rejected` + tooltip with the reason.

## 6. Phase F + G.0a — Graduate to JS

1. As admin, open **Admin → Public UGC** tab.
2. **Pass:** your approved-public option appears in the list with a **Graduate** button.
3. Click **Graduate** on a single-tag option first. **Pass:** UgcGraduateModal opens with:
   - A copyable snippet that includes `types: [...]` and `strokes: [...]` arrays
   - Paste instructions pointing at `const MAIN_OPTIONS = [` (or whichever flat array)
   - **NO mention of sub-arrays or sub-buckets**
4. Click **Graduate** on a **multi-tag** option. **Pass:** snippet correctly emits `types: ["distance","sprint"]` etc. — no `multi_tag_not_supported` error.
5. (Optional, only if you're going to actually graduate one in this exercise) Copy the snippet, paste into `public/index.html` per instructions, commit, push, redeploy. Check the **confirm** checkbox and click **Confirm graduate**. **Pass:** the row leaves the overlay (`promoted_at` stamped); the picker now sees the option exactly once (from JS, not from overlay).

## 7. Post-graduate picker dedup

After step 6.5 — if you actually graduated something:
1. Generate several workouts targeting that section/type. **Pass:** the graduated option appears, but ONLY ONCE in any given workout (no doubling). The badge is gone (📝/👥/🌐 only show on overlay-sourced options, not JS-canonical).
2. In Catalog browse, the option appears in the canonical list, not the UGC overlay list. No duplicate row.

## 8. Quota + validation edge cases

1. As coach, try creating an option with no sets. **Pass:** validation rejects.
2. Try creating drill/main with NO types AND NO strokes. **Pass:** validation rejects ("needs at least one type or stroke tag").
3. (If you can quickly reach the quota) create options past the per-coach quota. **Pass:** quota error message at create time.
4. Try editing an option that's been promoted (`promoted_at` not null). **Pass:** edit fails with "frozen when promoted" — once it's in JS, the DB row is read-only.

## 9. Performance sanity

1. Open DevTools Network tab. Reload the app.
2. Watch for **GET /api/bank/my-overlay** — should fire on mount.
3. Wait 5 minutes. **Pass:** the call fires again (the periodic refresh poll).
4. No errors in the console. No 4xx or 5xx in Network for any UGC route.

---

## Findings

_(Fill in if anything failed)_

| # | Step | Failure mode | Disposition |
|---|---|---|---|
|   |   |   |   |

---

## Sign-off

Live exercise complete. UGC v1 verified end-to-end on prod. Tag `ugc-coach-sets-v1` stands.

Signed: __________
Date:   __________
