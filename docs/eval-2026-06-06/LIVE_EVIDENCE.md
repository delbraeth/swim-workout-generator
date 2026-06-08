# Live app evidence — SetForge — captured 2026-06-06

Captured by driving the **live production app** at https://setforge.io (Chrome,
logged in as coach **Patrick Cassidy**, build `5a49dbd-dirty · bundle 6688d88b62c1`).
This is the real current-state UX, not source inference. Panel personas: treat this
as ground truth for "what actually works / is reachable / how it feels," and read the
source + docs for feature detail.

## Account / data context
- Logged in as a **coach** account (Patrick Cassidy), Apple-authed, invite-only.
- Teams present: **TEST TEAM: MAKOS**, **MASTERS TEAM**.
- Groups: APPLE (base, 2 swimmers), BANNANA (build, 2), GOLD (Masters, 0), SILVER
  (Masters, 0), "10:00 Sunday", "lesson girl".
- Managed/parent swimmers: Mike Smith (12y), Sally Jones (12y).
- History: 12 workouts logged.

## Generator (coach home) — WORKS end-to-end
- Pool mode SCY/SCM/LCM toggle. Two anchor chips visible: "TEST TEAM: MAKOS · 29 days"
  (meet/schedule anchor) and "Happy Birthday · 29 days".
- Advanced options expanded shows: **🏁 Race Pace ON** + event dropdown (50/100/200/500
  free, 100 back/breast/fly, 200 IM) + **USRPT** checkbox + "Target from goal time".
- Mix presets: Easy day, Balanced, Warmup-heavy, Drill-heavy, Long main.
- Sections toggle: Warmup / Drill / Kick / Main / Cooldown (Kick off by default).
- **10 workout types** incl. Lesson ("Short skill session — warm-up, skill focus, send-off").
- Equipment cycle (off→preferred→required): Kickboard, Fins, Paddles, Pull Buoy, Snorkel.
- Max yardage slider with pace/100 presets (~60min/~90min/~2hr), live workout range.
- Multi-lane toggle + quick input.
- **GENERATE FOR** picker: Myself / APPLE (2·base) / BANNANA (2·build) / GOLD / SILVER —
  i.e. group fanout + (per scope) individual targets.
- **Race-pace verified LIVE**: with a 200-free goal of 1:52.34 set, generating Distance +
  Race Pace produced Main Set "200 Free Race-Pace": **26×50 "50 Free — 200 Free goal pace
  @ 28.09" On :55 · hold 200 Free goal pace (28.09 per 50)**. Per-rep target is exact.
  (Send-off :55 is app-scaled post-engine; target is engine-exact.)
- Output shows Warm-Up/Drill/Main/Cool-Down with per-line REPS×DIST/DESC/INTERVAL/FOCUS,
  per-set BANK/ENGINE/MIX source toggle + Regenerate, inline-editable intervals, a
  Coach's Note, "+ Add dryland", Run / Copy Text / Print / Schedule, and a Log form.
- **Coach's Note observed**: "Intervals are calibrated for a masters pace of 2:00–2:15/100
  yds…" — note the generic masters framing even though generating as a coach.

## Parent / swimmer-facing view (/parent) — WORKS
- "Parent view (2 swimmers)" with swimmer chips (Mike Smith 12y, Sally Jones 12y).
- **Team calendar .ics download** per team (best-practice download, not URL paste).
- Per-swimmer weekly card: Workouts done (0/0), Yardage (0), Next week (0 scheduled).
- Home address management + "Let this swimmer's coaches view the home address" toggle.
- **Weekly Sunday digest** (US-Eastern) with Pause.
- NOTE: swimmer-side here is parent/guardian-centric; the *swimmer's own* athlete
  experience (logging, PRs, goals, assigned workouts) is a separate surface.

## Reports (/reports) — WORKS, numbers/tables only
- Header literally says "Self-only coach view · numbers + tables (**charts in a future
  phase**)". Range: 7/30/90/season. Group filter incl. per-group + lesson groups.
- 6 report tabs: Programming Mix, Schedule Adherence, Curation Log, Program Recap,
  Platform Health, Curation & Support. Export: Print/PDF + Markdown.
- Programming Mix (90d) real data: 24,200 total yds, 10 workouts, 11 distinct labels,
  Source mix Bank 100%/Engine 0%/Mix 0%, yards by type (Mixed 17.4k, IM 4.8k, Tech 2k),
  **YARDS BY STROKE: "No data in range"** (stroke attribution gap), yards by section.

## Reliability / latency (live, logged-in)
- `/api/me/bootstrap` → 200 in ~563ms; `/api/me/team-calendars` → 200 in ~465ms.
- No console errors surfaced during navigation. App healthy (200s, not 503).
- SPA route nav (Generator↔Parent↔Reports) is instant; report data loads in ~1–2s.

## Footer / credit (live)
- "Created by Patrick Cassidy & Veronica Cassidy (coach & swimmer). © 2026 Competition
  Aquatics, LLC." — co-author credit is live.

## Reachable nav surfaces (coach)
- Top row: Generator/History toggle, mail/digest, 📅 calendar(17), 👥 teams/parent,
  🔧 coach tools (dropdown), 📊 reports.
- Second row: 📈 progress, 🛡 (curation/support), 📋 (blue check — practices/schedule),
  👤 profile, ❓ help/manual.

## NOT exercised live this run (personas: infer from source/docs)
- Onboarding / first-run / Apple OAuth gate (already authed).
- iOS app (web-only session).
- Coach tools dropdown internals, calendar authoring, impersonation, admin, manual page body.
- A real swimmer (non-coach, non-parent) athlete session.
