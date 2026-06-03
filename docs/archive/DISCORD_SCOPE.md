# Discord community — scope

**Status:** locked 2026-05-25. Implementation ready (~3-5h).
**Trigger:** ship now. UGC v1 just closed, Now slot is empty, this is a clean moment.

---

## 1. Why

Give SetForge coaches a place to talk to each other, surface feature requests and bug reports faster, and give Cap'n a single triage feed for live feedback without bouncing between admin UI + email + ad-hoc messages. The whole thing is small-on-purpose; we are not building a community platform.

## 2. Audience — coaches + adults only

- **In scope:** coaches (free + paid tiers, once Pricing ships), adult masters/solo swimmers, adult parents.
- **Out of scope:** under-18 swimmers. Their feedback flows in-app only (see §6). Discord's 13+ ToS plus our minor-protection posture from [[swim-generator-relationships-scope]] makes "swimmers + Discord" a non-starter without per-account age gating we don't want to maintain.
- This is not announced as "for coaches only" in the manual — the Community section says "13+ users" and lets adults self-select. The minor-bypass on the webhook (§6) is the actual enforcement.

## 3. Channels (7, day 1)

| # | Channel | Public? | Purpose |
|---|---|---|---|
| 1 | `#welcome` | public, read-only | Server rules, code of conduct, intro link. New members land here. |
| 2 | `#general` | public | Open coach-to-coach discussion. |
| 3 | `#coach-corner` | private, role-gated | For users with the manually-granted "verified coach" role. Coach shop-talk, programming questions, anything that doesn't belong in front of newcomers. |
| 4 | `#feature-requests` | public | Suggest things. Use Discord's emoji-vote for triage. |
| 5 | `#bug-reports` | public | User-reported bugs. Cap'n triages; severe ones move to a private issue. |
| 6 | `#showcase` | public | Share workouts, PRs, swimmer wins. The fun channel. |
| 7 | `#feedback-stream` | private, Cap'n + bot only | Receives `/api/feedback` webhook posts. Read-only triage feed; Cap'n acts in the admin UI, not here. |

Themed structure chosen over minimal because the audience is small enough that having the right shape on day 1 invites the right behavior. Empty channels get pruned at the 60-day mark if no one posts.

## 4. Moderation

- **Mod team:** Cap'n only.
- **Automod:** Discord's built-in automod handles routine spam — banned-word list, raid protection, slowmode on high-traffic channels. No third-party bots.
- **Asynchronous:** No SLA on moderation response. Server rules in `#welcome` state this explicitly: "this is a small community, expect a few hours of latency on mod action."

## 5. Identity & roles

- **Verified Coach role:** granted manually by Cap'n per request (DM or `#intro` post). Unlocks `#coach-corner` and any future role-gated channels. No bot. No SSO. No auto-verification against the SetForge account.
- Everyone else gets the default `@member` role on join.
- This is intentionally light: with a small community we don't need the automation overhead of a verification bot.

## 6. Feedback webhook integration

The existing `/api/feedback` endpoint (server.js:2012) gets a server-side hook that posts to a private Discord channel for triage. The DB write stays canonical; the Discord post is best-effort fire-and-forget.

**Payload:**
```
[<category>] <subject>
by <display_name>
on <page>
---
<body>
```
- `display_name` from `users.display_name`. NOT email, NOT sub.
- `page` from existing payload field.
- No user_agent (noise).

**Routing rules:**
- **If `user.dob IS NULL` OR `isMinor(user.dob, now)` → skip webhook.** DB write proceeds normally; admin sees it in the existing feedback UI. Defaults to bypass when DOB is unknown (safer side of the fence).
- Otherwise post to the webhook URL stored in `process.env.DISCORD_FEEDBACK_WEBHOOK_URL`.
- Webhook failure is logged but never fails the user's request. The DB row is the source of truth.

**Why "display name + workout context, with minor bypass":** triage in Discord wants real names so Cap'n can recognize "Alice asked about X" without a context switch. Minors never have their name posted to a third party. Adult opt-in is implicit when they create a SetForge account and set a DOB ≥ 18.

## 7. Discovery / join flow

- **Manual:** a `Community` section above `What's Coming` with a Join the Discord button. Plain text explains: 13+, coach-friendly, mod is Cap'n.
- **ProfileModal:** a `Community` subsection (sibling of Favorites, Disfavorites, etc.) with the same invite link.
- No login-page banner. No first-login popup. No email blast.

## 8. Privacy posture

- Discord stores: display names + freely-typed user content + workout context strings. No emails, no subs, no DOBs, no swimmer names from a roster.
- Linked from manual + ProfileModal. Privacy doc updated to disclose: "If you join the SetForge Discord, your feedback may include your display name. Minors' feedback never leaves SetForge servers."
- Webhook URL is a server-side secret. Rotating it is a Discord channel-settings action; no code change.

## 9. Implementation steps

| # | Step | Where | ~Time |
|---|---|---|---|
| 1 | Set up Discord server, create 7 channels, configure automod, write `#welcome` rules | Discord (Cap'n) | 30 min |
| 2 | Generate webhook URL for `#feedback-stream`. Add to env vars (Hyperlift dashboard + local `.env`). | Discord + Hyperlift | 5 min |
| 3 | In `db.js`, export `isMinor` (already exists) and add a `postFeedbackToDiscord(payload)` helper that fetches the env var, no-ops if absent, posts JSON to webhook URL, catches errors | db.js | 30 min |
| 4 | In `/api/feedback` route, after the DB insert: load user (already in scope via `req.userSub`), check minor bypass, call `postFeedbackToDiscord` fire-and-forget | server.js | 20 min |
| 5 | Add `Community` section to manual (above What's Coming) with the invite link + 13+ note + brief explanation | public/manual.html | 20 min |
| 6 | Add `Community` subsection to ProfileModal with the invite link | public/index.html | 20 min |
| 7 | Update privacy.html disclosure paragraph re: webhook → Discord for adult feedback | public/privacy.html | 15 min |
| 8 | Smoke: submit feedback as a coach (DOB ≥ 18) — verify Discord post; submit as a minor or DOB-null account — verify NO Discord post; verify both rows in admin UI | live | 20 min |
| 9 | Manually grant Cap'n's account the "verified coach" Discord role; verify `#coach-corner` access | Discord | 5 min |
| 10 | Commit + push + redeploy; update ROADMAP + memory checkpoint | git | 15 min |

**Total: ~3.5h.** No migration. No new tables. No new routes. Just one helper + one route hook + three doc surfaces.

## 10. Out of scope (deferred / declined)

- **Discord OAuth bot for auto-verification.** Considered, rejected: not worth the bot-hosting + maintenance for the volume.
- **Outbound from Discord → SetForge.** No bot reads Discord and acts on the app. Pure one-way SetForge → Discord.
- **Per-tier Discord channels (Free vs. Supporter vs. Coach vs. Program).** Deferred until Pricing ships. The "Verified Coach" role covers the only role-gate we need today.
- **Notification when an admin acts on someone's feedback.** Out of scope — feedback flow stays one-way notification to Cap'n.
- **Showcase auto-posting (e.g., "Alice just hit a PR on this workout").** Out of scope. Requires opt-in flow we don't want to build.
- **Discord-based support tickets / SLAs.** Discord is a community, not a help desk.

## 11. Decision matrix (for memo)

| Decision | Chosen | Alternatives considered |
|---|---|---|
| Audience | Coaches + adults only | Coaches only · All users 13+ |
| Integration | Feedback webhook | Link only · Verified-coach role + webhook (bot) |
| Moderation | Cap'n + automod | Cap'n + volunteers · Cap'n no automod |
| Verification | Manual coach role | No roles · Discord bot OAuth |
| Webhook PII | Display name + context | Anonymous · Sub + context |
| Minor feedback | Bypass webhook (DB only) | Same webhook, anonymous · Bypass for ALL swimmers |
| Channels | 7 themed | Minimal 4 · Start with 2 |
| Discovery | Manual + ProfileModal | Manual only · Manual + dashboard banner |
| Launch | Now | After first paying coach · After pilot starts |

---

**Spec doc owner:** Cap'n. Update this file when any decision changes. Memo: `swim_generator_discord_scope.md` once the build starts.
