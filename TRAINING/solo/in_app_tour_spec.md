# SetForge — First-Run In-App Tour (Engineering Spec)

This is a spec, not an implementation. An engineer should be able to build the tour against `public/index.html` from this document plus the existing app source.

## Goal

Get a brand-new solo swimmer from "just signed in with Apple" to **"my first generated workout is on screen"** in under 3 minutes of in-app time. The tour ends the moment they hit Generate the first time — past that point, the workout itself is the teacher.

## Non-goals

- Teaching Run Mode, history, goals, week view, or any coach-only surface. Those are deferred to later, contextual moments (or never — many solo users won't need them on day one).
- Forcing the user through every step. Skip is always available.
- Persisting partial tour state. If the user closes the tab, the next session evaluates resume rules and either re-enters or skips per the rules below.

## Trigger criteria (who sees the tour)

The tour fires when **all** of the following are true on app load:

1. The user is authenticated (we have their Apple sub).
2. Their account has **zero saved workouts** in history.
3. `settings.extra.tour_solo_v1_status` is not present, or is `"started"` (resume case) or `"skipped"` (no-op).
4. The user's role is not `coach` or `admin` — solo only. Coaches get a different tour (out of scope here). Use the same view-as flag the rest of the app respects.

If any of those fail, the tour does not fire.

## Steps (9 total)

Each step is a tooltip anchored to a DOM element, with a single-line copy block ≤140 chars. The user advances by performing the **Action**. The Next button is always available as a fallback. Back is available on steps 2–9.

| # | Step ID | Trigger | Anchor target | Copy (≤140 ch) | Action | Persistence |
|---|---|---|---|---|---|---|
| 1 | `step-welcome` | First load after auth, criteria met | Centered modal, no anchor | Welcome to SetForge. In 3 minutes you'll have your first workout. Tap **Start** to begin, or **Skip** to skip the tour. | Click **Start** | Fires once per account. Never re-fires after dismissal. |
| 2 | `step-pool-mode` | After step 1 | Pool-mode toggle row (`.pool-mode-toggle` or first child of the generator form's top row) | Pick your pool. SCY is the 25-yard default — switch if you're swimming meters. | Click any pool-mode pill, or click **Next** | Re-fires only if user has changed pool mode 0 times AND lands here via resume. |
| 3 | `step-pace-input` | After step 2 | Pace input field above the yardage slider | Enter your honest per-100 pace. Not your race time — what you can hold for a long set. | Type a valid pace OR click **Skip — I'll set later** OR click **Next** | Re-fires on resume only if `settings.extra.default_pace` is still empty. |
| 4 | `step-swimmer-level` | After step 3 | Profile button in header (👤) | Don't know your pace? Open Profile and pick a Swimmer Level — Recreational, Masters, or Competitive. | Click **Next** (informational) | Shown as a peek; does not require the user to actually open Profile. |
| 5 | `step-yardage-slider` | After step 4 | Yardage slider container | Drag the slider to your target distance — or tap a time preset (~60 / ~90 / ~2hr). | Drag the slider, tap a preset, or click **Next** | Re-fires on resume if user has not changed the slider value AND tour status is `started`. |
| 6 | `step-type-cards` | After step 5 | Workout-type card grid | Pick one of 9 types. IM = all four strokes. Distance = aerobic. Sprint = short hard. Tap any card. | Click any type card | Required to advance; no Next-without-action fallback (a type must be selected to generate). |
| 7 | `step-equipment` | After step 6 | Equipment card row | Tap equipment to cycle off → preferred → required. Or leave it all off for an equipment-free swim. | Click **Next** (optional interaction) | Informational. Never re-fires after dismissal. |
| 8 | `step-generate-button` | After step 7 | The big **🏊 Generate Workout** button | Hit Generate. You'll see four blocks: Warm-Up, Drill, Main, Cool-Down. | Click **Generate Workout** | Required to advance. No fallback — clicking Generate ends the tour. |
| 9 | `step-celebrate` | Fires the first time a workout renders on screen AND the user is in tour state | Centered modal, optional small confetti or pulse on the summary bar | You generated your first workout. Read the blocks top-to-bottom. **▶ Run** to swim it, **🖨** to print. You're set. | Click **Got it** | Sets `tour_solo_v1_status = "completed"`. Never re-fires. |

### Copy formatting rules

- Use plain text. No emoji in copy except where it mirrors a button label (▶, 🖨, 🏊, 👤).
- Hard limit 140 characters per copy block. Step 9 is at 138 — do not expand.
- Two-button layout in every step: primary action on right, **Skip tour** as a tertiary text-link on the left of every step except step 1 (which uses Start / Skip).

## Storage model

Persist tour state in the existing `settings.extra` JSON column under user_settings (same pattern as the template engine and disfavor mode):

```json
{
  "tour_solo_v1": {
    "status": "not_started" | "started" | "completed" | "skipped",
    "current_step": "step-pool-mode",
    "started_at": "2026-05-22T18:14:01Z",
    "completed_at": null
  }
}
```

Write on every step advancement. The status transition:

- `not_started` → `started` when the user clicks **Start** in step 1
- `started` → `completed` when step 9 dismisses
- `started` → `skipped` when the user clicks **Skip tour** at any step
- `not_started` → `skipped` when the user clicks **Skip** in step 1

## Branching logic — closing the tour mid-flow

The tour can be exited four ways:

| Exit | What gets stored | Tour resumes? |
|---|---|---|
| **Skip on step 1** | `status: "skipped"` | No. Never. |
| **Skip on step 2–8** | `status: "skipped"` | No. Never. (See "Re-show via Profile" below for a manual re-entry.) |
| **User closes browser / tab on step 2–8** | `status: "started"`, `current_step: <last step shown>` | Yes — see resume rules. |
| **User completes via step 9** | `status: "completed"` | No. Tour is done. |

### Resume rules

If `status == "started"` on next app load:

1. Re-evaluate trigger criteria (still solo, still zero workouts, not a coach). If any criterion now fails, transition to `"completed"` silently and do not show the tour.
2. If criteria still hold, re-enter at `current_step`. Skip any step whose underlying state has already been fulfilled (e.g., if `step-pace-input` was the saved step but `default_pace` is now non-empty, jump forward to the next unfulfilled step).
3. If all steps would skip (e.g., user already configured everything before the resume), transition to `"completed"` silently.

### Re-show via Profile (optional, recommended)

In the Profile modal, add a small `Re-run intro tour` text link in the bottom Identity section. Clicking it resets `tour_solo_v1.status` to `not_started` and reloads. This lets a user who skipped the tour come back to it. Out-of-scope for v1 launch if cycle time is tight, but high-value for support.

## Exit conditions — when the tour permanently stops showing

The tour will not fire for an account once any of these conditions become true:

1. `tour_solo_v1.status` is `completed` or `skipped`.
2. The account has 1 or more saved workouts in history (treat completion as implicit dismissal — they've clearly figured it out).
3. The account's role becomes `coach` or `admin`. (Coach tour replaces this one.)
4. `tour_solo_v1.completed_at` is more than 365 days in the past (defensive — prevents zombie tours after a long break).

## Anchor target selectors — preferred form

The current `public/index.html` is a single-file React app without consistent test IDs. Two options:

- **Preferred:** add `data-tour="step-pace-input"` attributes to the relevant elements during this implementation. The tour library queries these. This is the cleanest contract — anchors don't break when class names change.
- **Fallback:** use descriptive selectors (e.g., `input[placeholder*="2:00"]` for the pace field). Brittle. Document anchors in this spec if you go this route.

Recommend the first option. Each step in the table above gets a matching `data-tour` value equal to its Step ID.

## Library / implementation hints (non-binding)

- SetForge is single-file React with no current onboarding library. Driver.js (~10KB gzipped, MIT, no dependencies) is a clean fit for tooltip + spotlight + step orchestration. Alternative: roll a 100-LOC custom popover anchored to `data-tour` attributes — viable for 9 steps and avoids the dependency.
- Whichever path, the tour module should be lazy-loaded — solo users hit it once and it never runs again. No reason to pay the bundle cost on every page load.
- Tooltip styling should match the existing dark-navy aesthetic: `#0f172a` background, `#3b82f6` accent border, `#e2e8f0` text. CSS vars exist in `manual.html` and likely in `index.html` — use them.

## Accessibility

- Every tooltip must be reachable by keyboard. `Tab` advances focus into the tooltip; `Enter` triggers the primary action; `Esc` opens a "Skip tour?" confirm.
- Spotlight overlay should not trap pointer events outside the active step's anchor (the user might want to scroll mid-tour).
- Use `aria-live="polite"` on the tooltip body so screen readers announce step transitions.
- Tooltip copy is plain-language English. No idioms.

## Telemetry (optional, recommended)

Emit one audit event per step transition: `tour.solo_v1.step_advance` with `{from_step, to_step, action_taken}`. Plus terminal events `tour.solo_v1.completed` and `tour.solo_v1.skipped` with `{at_step, duration_seconds}`.

Use the existing audit-event pattern from `server.js`. This tells you at a glance whether the tour is doing its job — if 60% of users skip at step 3 (pace input), the copy or the field UX needs work.

## Open questions

- **Mobile tooltip placement.** On a 375px-wide phone, anchored tooltips for the equipment row and the type card grid may overflow. Decide: stack the tooltip below the anchor with an arrow, or use a half-modal bottom sheet on mobile. Recommend bottom sheet — more readable.
- **Quick-Launch panel.** A returning user with workouts in their history sees the Quick-Launch panel above Generate. New users don't (it's empty). Tour assumes empty state. Verify no rendering collision when Quick-Launch lazy-mounts.
- **Multi-pool-mode setup.** If a user switches pool mode mid-tour (step 2 → SCM), the slider step size and range change. The tour copy in step 5 is pool-agnostic — confirm the anchor still points to the right element after a re-render.
