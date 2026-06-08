# Research note — Apple TV (tvOS) deck display board

**Status:** research note / spec idea (2026-06-06). Demand-gated. Captures a tvOS app
that turns a pool-deck TV into a SetForge **display board** — deliberately tiny function
set (pace clock, lane plan, current set). Direct response to the coaching-board's #1
deck need (Summer + HS: "whiteboard on a phone / AirPlay to a deck TV",
`docs/COACH_BOARD_2026-06-06_phase6-ios.md` Task 2b #3 + #8).

## Why
Pools already have wall-mounted TVs. The classic deck hardware is a **giant pace
clock**; coaches also want the **lane plan / current set** posted where wet swimmers
can read it from the water. A tvOS app is the premium, always-on version of the iOS
"deck/present mode + AirPlay" idea (B8) — dedicated hardware, 10-foot-legible, no phone
tied up. It's read-only/glanceable, so it's a small surface, not a port of the app.

## Function set (intentionally minimal — a "10-foot UI")
Tier the build so the MVP is shippable alone:

**MVP-0 — standalone pace clock** (no account, no pairing): a full-screen running
**pace clock** with a configurable send-off interval and a big sweep — usable on day one
as just a wall clock. This alone justifies the app for many decks.

**MVP-1 — paired board:** the TV is claimed to a team/group and displays:
- **Current workout / set** in giant type (the active block, big rep + interval).
- **Lane plan** (multi-lane: per-lane pace/interval columns) — the whiteboard, on the wall.
- **Pace clock / send-off** running alongside.
- Header ticker: team name, next event countdown, outdoor weather chip (reuse existing).

**Later:** auto-advance through sets, a "now / next" set view, manual remote nav
(Siri remote focus), broadcast a coach-pushed message ("10 min warning"), QR to the
swimmer app.

Explicitly NOT on tvOS: any authoring/config/roster/reports — display only.

## Auth / pairing (the tricky part — researched)
Standard for TV apps is the **OAuth 2.0 Device Authorization Grant (RFC 8628)**: the TV
shows a short code (+ QR), the coach opens a URL on phone/web, enters/scans the code,
approves, and the backend marks the TV session authenticated. tvOS 17+ can even route
passkey verification to a paired iPhone via CTAP 2.2 hybrid transport. Apple's HIG is
explicit: **minimize keyboard entry on tvOS — send a code to another device.**

**Recommended for SetForge (cheap, reuses our patterns):** a **read-only display token**
device-code flow:
1. TV calls `POST /api/display/register` → gets a short pairing code + device id; shows
   the code/QR on screen and polls `GET /api/display/:deviceId/state`.
2. Coach (web/iOS, authed) enters the code under Team → Settings → "Pair a display,"
   picks the team/group → server binds a scoped **display token** to that device
   (mirrors the existing `team_calendar_feed` token pattern + the venue/RSVP scoping).
3. TV then polls `GET /api/display/:token` for the **board payload** (current group
   workout / lane plan + clock config) and renders it. No login on the TV ever.
This is the calendar-feed token idea generalized to a live board. Revoke = rotate token
(same as the calendar feed).

## Data flow
- Board payload = the group's **most-recent generated/scheduled workout** (or a coach
  "display this" push from phone). Server already has scheduled workouts + lane plans +
  the engine output shape.
- **No engine port needed:** tvOS renders server-provided workout JSON (the engine is
  JS/server-side; the TV is a dumb renderer). The pace clock runs locally on-device.
- Refresh: short poll (or SSE/websocket later) so "generate on the phone → appears on
  the wall" feels instant.

## tvOS technical notes
- **SwiftUI on tvOS** (shares models/networking with the iOS app target — same repo,
  added target). Focus engine for any remote nav; mostly we want zero interaction.
- **Keep-awake:** a wall clock must not dim/screensaver — set `isIdleTimerDisabled`
  equivalent; verify tvOS screensaver override is allowed for an active session.
- Big-type, high-contrast, dark theme (reuse the whiteboard/print styling intent).
- Distribution: separate tvOS app in the same App Store listing (or its own); free app,
  gated to Coach/Program-tier teams (display board as a tier perk).

## Relationship to the rest of the plan
- **Cheap MVP first = iOS AirPlay / present-mode (plan slice B8).** Ship that; it covers
  80% with zero new platform. The **tvOS app is the premium upgrade** when there's
  demand for an always-on dedicated board.
- Reuses: `team_calendar_feed` token pattern (scoping/rotate), lane-plan data, engine
  output shape, weather chip, next-event pill.

## Cost / effort
**L** for a polished MVP-1 (new tvOS target, device-code pairing endpoints, board
payload endpoint, big-type renderer, keep-awake) — but **MVP-0 (standalone pace clock)
is S–M** and could ship as a standalone "is this worth it" probe. Server side is small
(2–3 endpoints + a `display_tokens`/`display_devices` table mirroring calendar feeds).

## Open questions
1. MVP-0 standalone clock first (validate hardware/demand), or straight to paired board?
2. Pairing scope: per **team** or per **group** (a club wants the senior-lane board to
   differ from age-group)? Lean per-group, reusing the Phase-6 group axis.
3. Push vs poll for "now showing" (poll MVP; SSE later).
4. Tier gating: Coach + Program only, or any team? (Lean: Coach/Program perk.)
5. Does it share an App Store listing / IAP entitlement with the iOS app?

## Sources
- [Apple — Simplifying User Authentication in a tvOS App](https://developer.apple.com/documentation/authenticationservices/simplifying-user-authentication-in-a-tvos-app)
- [Apple HIG — tvOS Accounts (minimize data entry; send a code to another device)](https://developer.apple.com/design/human-interface-guidelines/tvos/app-architecture/accounts/)
- [OAuth for Apple TV / tvOS — login with a secondary device (RFC 8628 device flow)](https://stephenradford.me/oauth-login-on-tvos/)
- [Apple Developer Forums — OAuth on tvOS](https://developer.apple.com/forums/thread/18450)
