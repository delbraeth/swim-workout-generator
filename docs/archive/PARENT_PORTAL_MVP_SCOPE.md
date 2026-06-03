# Parent Portal MVP — scope

**Status:** scope-only (2026-05-26). Implementation lives in PHASED_PLAN §3 Phase 4 — "The product earns its team-tier price and survives founder absence." Smallest of the three Phase 4 non-identity deliverables; biggest **dependencies** (needs both Phase 2 email infra AND identity refactor's guardians table).

**Pattern source:** mostly new surface. Reuses Apple/Google OAuth from Phase 1+2 (parents authenticate the same way coaches + swimmers do). Reuses the email worker from Phase 2 for weekly digest delivery.

---

## 1. Why

Parents of under-18 swimmers are SetForge's invisible audience today. Their kid's account is coach-managed (or claimed at 13+); they get zero visibility into what was assigned, what was completed, or how attendance is tracking. The team eval's "parent" personas surfaced this as the difference between "I trust this app for my child" and "I don't know what's going on, I'd rather not."

The minimum viable parent surface that closes that gap is:

1. **Auth path** — parent signs in with their own OAuth and sees their swimmer(s)
2. **Read-only dashboard** — what's been done this week + what's coming + attendance
3. **Weekly digest email** — same content delivered passively for parents who won't log in

This is the MVP. Adult-only swimmer comms, two-way messaging, parent-CC on coach notes, MAAP coach-watch — all bigger; deferred to Phase 5+ or its own scope.

---

## 2. Locked decisions (2026-05-26)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Surface: extend existing app with `parent_mode` flag** | Parent signs into setforge.io with OAuth → server detects they're a guardian (via `guardians` table from identity refactor) → renders parent dashboard instead of generator. Same auth, same domain, same nav shell. Smallest engineering footprint; reuses Phase 1 a11y + landmarks + brand. |
| 2 | **Auth: OAuth-only, same as everyone else** | Apple (today) + Google (Phase 2). No magic-link emails for parents — consistent with [[feedback-no-password-auth]]. Parent OAuth account is a real `users` row with `is_parent=1` flag (also a guardians-table entry tying them to one or more swimmers). |
| 3 | **Multi-swimmer parents fully supported** | One parent account, N children. Dashboard shows a swimmer selector at top. Digest email lists all swimmers in one message. Sibling parents are common in age-group club teams. |
| 4 | **Read-only — parents cannot edit anything** | No fav/disfavor, no PSC, no scheduling, no message-coach. Parent watches, doesn't participate. Reduces surface area for v1; satisfies team eval's "transparency without complication" parent persona. |
| 5 | **Weekly digest content: workouts done + assignments due + attendance** | Three blocks per swimmer: "{N} of {M} assigned workouts done · total yardage {Y}" + "Upcoming: {N} assignments next week" + "Attendance: {N}/{M} practices this week." Coach notes are a v1.1 add (requires coach UI to write them). |
| 6 | **Digest cadence: weekly, Sunday evening** | Recap the week that just ended; preview the week ahead. Sunday evening = parents have time to read; aligns with most coach planning cadence. Configurable per-parent in v1.1 (daily / weekly / off). |
| 7 | **Digest delivery: opt-OUT (default on)** | Every parent account gets the digest by default. ProfileModal has "Pause weekly digest" toggle. Opting out keeps the in-app dashboard fully functional. Transactional posture (account-state notification) keeps it CAN-SPAM clean even at scale. |
| 8 | **Parent dashboard mirrors swimmer's AssignedToMeView** | Same card layout, same metadata. Read-only — buttons (Run, Mark complete) are absent. Reduces design + code overhead; parents see exactly what their swimmer sees. |
| 9 | **Parent-account linking flow = coach invites parent** | When a coach edits a managed swimmer's profile, they get a "Link a parent" button → enters parent's email → invite created → parent receives an email with a link to sign up (via Apple/Google OAuth) → on first sign-in, server matches their verified email to the pending invite + creates `guardians` row. |
| 10 | **No parent-side notifications beyond weekly digest in v1** | No real-time alerts for missed practices, no per-workout completion pings, no PSC-change alerts. v1 stays in the digest-only lane. v1.1 + Phase 5 expands. |
| 11 | **Parent can't see other parents** | Multi-parent swimmer (divorced parents both linked) → each parent sees the swimmer + their own profile only. They can't see "Other parent: Jane Smith." Privacy by default. |
| 12 | **Audit log every parent action that touches data** | Even read access of sensitive fields (DOB? medical PSC?) logged as `parent.view.swimmer`. Sets up the audit trail boards expect for guardian-access systems. |

---

## 3. Implementation (Phase 4, after identity refactor + Phase 2 email infra)

### 3.1 Hard prerequisites

- **`guardians` table from `IDENTITY_SCOPE.md` phase I-E must exist.** This scope cannot ship before that. Document the dependency loudly.
- **`email_outbox` worker from `EMAIL_INFRA_SCOPE.md` must be live.** Parent digests ride this infra.
- **`is_parent` flag (or equivalent role bit) on `users`** — add in this scope if identity refactor doesn't include it; the persons table will naturally carry a `is_guardian` distinction.

### 3.2 New migration (040 — assumes identity refactor took some block of numbers; bump as needed)

```sql
-- Parent-invite flow: track invitations from coaches before parent accepts
CREATE TABLE `parent_invites` (
  `id`              BIGINT AUTO_INCREMENT PRIMARY KEY,
  `swimmer_managed_id` BIGINT NULL,                       -- target managed swimmer (XOR with sub)
  `swimmer_sub`     VARCHAR(255) NULL,                    -- target real swimmer
  `parent_email`    VARCHAR(255) NOT NULL,
  `invited_by_coach_sub` VARCHAR(255) NOT NULL,
  `state`           ENUM('pending','accepted','expired','revoked') NOT NULL DEFAULT 'pending',
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `accepted_at`     DATETIME NULL,
  `expires_at`      DATETIME NOT NULL,
  INDEX `idx_email_state` (`parent_email`, `state`),
  INDEX `idx_swimmer` (`swimmer_managed_id`, `swimmer_sub`)
) ENGINE=InnoDB;

-- Per-parent digest preference (default on, opt-out)
ALTER TABLE `settings`
  ADD COLUMN `digest_paused` TINYINT(1) NOT NULL DEFAULT 0 AFTER `extra`;
```

### 3.3 db.js helpers

- `dbCreateParentInvite({ swimmerSub OR managedId, parentEmail, byCoachSub })` — authz: coach-of-swimmer. Expires in 30 days. Idempotent on (email, swimmer) pair.
- `dbConsumePendingInvitesForUser(userSub, verifiedEmail)` — called on first OAuth sign-in by every user (not just parents). If pending invites exist for this email, create `guardians` rows + flip state='accepted'. Most users have no pending invites; no-op for them.
- `dbListGuardiansForSwimmer(swimmerSub OR managedId)` — for coach view ("who are this swimmer's parents?").
- `dbListSwimmersForParent(parentSub)` — for parent dashboard ("show me my kids").
- `dbGetWeeklyDigestPayload({ parentSub, weekStart })` — returns per-swimmer block: assigned/done/yardage + upcoming + attendance. Used by the weekly cron + the in-app dashboard.
- `dbQueueWeeklyDigests()` — cron sweep Sunday 18:00 local → for every parent with at least one active swimmer and `digest_paused=0`, enqueue digest email via `enqueueEmail` from email infra.

### 3.4 Server routes

- `POST   /api/swimmers/:identifier/parent-invite` — body: `{ parent_email }`. Auth: coach-of-swimmer.
- `DELETE /api/parent-invites/:id` — auth: invite creator or coach-of-swimmer.
- `GET    /api/parent-invites/mine` — pending invites for the logged-in user's verified email. Used by sign-in flow to auto-consume.
- `GET    /api/parent/swimmers` — list this parent's swimmers. Auth: requireAuth + is_parent.
- `GET    /api/parent/digest?week=YYYY-WW` — same payload as email digest, rendered in-app.
- `PATCH  /api/parent/settings` — body: `{ digest_paused: bool }`. Auth: parent.

### 3.5 Client: parent-mode detection

`fetch('/api/auth/status')` already returns user metadata. Extended to include `is_parent` (computed from existence in guardians table). Top-level App branches:

```js
if (me.is_parent && !me.is_coach) {
  return <ParentDashboard />;
} else {
  return <App />;  // existing
}
```

A user who's both parent (of their kid) AND coach (of a team) keeps the coach dashboard, with a "View as parent" toggle in their profile menu (rare case; supports the family-coach scenario).

### 3.6 Client: ParentDashboard component

```
┌─────────────────────────────────────────────┐
│ SetForge · Parent Portal       [👤 Profile] │
├─────────────────────────────────────────────┤
│ Watching:  [▾ Linda Smith (10)]             │
│            also: Mike Smith (12)            │
├─────────────────────────────────────────────┤
│ ── This week ──                             │
│ 4 of 5 assigned workouts done · 12,400 yd  │
│                                             │
│ Recent activity:                            │
│ ┌───────────────────────────────────────┐ │
│ │ Tue · Distance · 3000 yd · ~52 min    │ │
│ │ Done · 53:40                          │ │
│ └───────────────────────────────────────┘ │
│ (more cards, identical layout to AssignedToMeView, read-only)│
│                                             │
│ ── Upcoming ──                              │
│ 3 assignments next week                     │
│                                             │
│ ── Attendance ──                            │
│ This week: 3/4 practices                    │
│ This month: 11/14                           │
│                                             │
│ Coach: Smith · setforge.io/coach-smith     │
└─────────────────────────────────────────────┘
```

Swimmer selector at top swaps between children. Same card layout swimmer sees in their own AssignedToMeView, with the action buttons hidden (`isReadOnly=true` prop).

### 3.7 Coach UX: "Link a parent" button

In Managed Swimmers view + the existing swimmer-edit modal, new row:

```
── Parents/Guardians ──
👤 Jane Smith (jane@example.com)            [Remove]
[+ Add parent]
```

`+ Add parent` opens a small input + Send Invite button. Coach types parent's email → invite created + invitation email sent via Phase 2 infra (template: `parent-invite.js`).

### 3.8 Parent-invite email template

`lib/email-templates/parent-invite.js`:

```js
export default ({ swimmerName, coachName, inviteUrl }) => ({
  subject: `${coachName} invited you to follow ${swimmerName} on SetForge`,
  text: `Hi —

${coachName} added you as ${swimmerName}'s parent on SetForge.

You can sign in with your Apple or Google account here:
${inviteUrl}

Once signed in, you'll see ${swimmerName}'s workouts, assignments,
and attendance. You'll also get a quiet weekly summary by email
(you can turn it off any time).

— Cap'n at SetForge
hello@setforge.io
`,
  html: `<!-- minimal HTML mirror, no tracking pixels -->`,
});
```

### 3.9 Weekly digest email template

`lib/email-templates/parent-digest.js`:

```js
export default ({ parentDisplayName, swimmers }) => ({
  subject: `SetForge weekly summary · ${swimmers.map(s => s.name).join(' + ')}`,
  text: /* per-swimmer blocks of done/upcoming/attendance */,
  html: /* same, minimal HTML */,
});
```

Sent Sunday 18:00 by `dbQueueWeeklyDigests` cron. Skipped for parents with `digest_paused=1`.

---

## 4. Smoke checklist

- Coach creates parent invite for managed swimmer Linda with email `jane@example.com` → `parent_invites` row inserted → invite email sent via Phase 2 infra.
- Jane signs in to setforge.io with Google (verified email matches) → `dbConsumePendingInvitesForUser` runs → `guardians` row created → `is_parent` flag computed → on first auth, ParentDashboard renders instead of App.
- ParentDashboard shows Linda's recent workouts + assignments + attendance, read-only (no Run/Mark complete buttons).
- Jane is also linked to Mike → swimmer selector shows both → switching reveals Mike's data.
- Sunday 18:00 cron runs → `dbQueueWeeklyDigests` → enqueue email for Jane with both swimmers' blocks → email arrives Sunday evening.
- Jane toggles "Pause weekly digest" in Profile → next Sunday, no email.
- Coach removes Jane from Linda's parents → `guardians` row tombstone → Jane's ParentDashboard no longer shows Linda; if Linda was Jane's only swimmer, ParentDashboard shows empty state ("No swimmers linked yet").
- Authz: Jane tries to fetch `/api/parent/digest?swimmer_sub=X` where X isn't her kid → 403.
- Coach-with-kid-too case: Coach Smith is also Linda's dad → still sees the coach dashboard; profile menu has "View as parent" toggle that swaps to ParentDashboard.
- Parent-invite expires (30 days no acceptance) → cron flips state='expired' → coach sees "invite expired" in swimmer-edit modal → resend option.
- Audit log: `parent.view.swimmer` event when ParentDashboard loads each swimmer's data.

---

## 5. Out of scope (deferred to v1.1+ or Phase 5)

- **Coach notes in the digest.** Requires coach UI to write notes; v1 is metrics-only.
- **MAAP coach-watch / coach-CC pattern.** Different scope entirely; lives in MAAP scope deferred to Phase 5.
- **Two-way messaging** (parent → coach in-app). Big surface; deferred.
- **Real-time alerts** (missed practice, completion of assigned workout). Email-only is the MVP.
- **Per-swimmer per-parent permissions** (one parent allowed to see attendance but not workout details). v1 = all-or-nothing.
- **Parent self-claiming** (parent signs up unprompted, can self-link to swimmer via verification code). v1 = coach-initiated only.
- **Parent-to-parent visibility** (co-parents see each other in the swimmer's record). Privacy default = off; v1.1 if asked.
- **Lesson-tier parent recap.** Different shape; lives in Lesson tier scope (Phase 5).
- **Digest cadence configuration.** v1 = weekly only. v1.1 = daily / weekly / off.
- **Mobile-first parent app.** Web app on a saved-to-home-screen covers it; native app is its own Phase.

---

## 6. Open Cap'n forks (none block v1)

1. **Time zone for Sunday 18:00 digest.** v1 uses server timezone (UTC). Parents in different time zones get the digest at different local hours. Per-parent timezone is v1.1; or use a single "good enough" US-ET pick.
2. **Coach-with-kid edge case UX.** "View as parent" toggle is functional but might be discoverable poorly. Add a one-time tooltip on first sign-in if the user is both? v1.1.
3. **Parent without verified email.** Apple "Hide my email" relay vs the verified email the coach typed. If they don't match, invite doesn't auto-consume. Same edge case as GOOGLE_OAUTH_SCOPE §3.12 — document the manual-merge fallback ("email hello@setforge.io").

---

## 7. Effort estimate

~12-16h. Larger than initial "smallest of three" framing because the parent-invite flow has its own moving parts.

- Migration 040 + db helpers: 2h
- Server routes + parent-invite consumption hook in OAuth callback: 2h
- ParentDashboard component (mirroring AssignedToMeView read-only mode): 3h
- Coach UX "Link a parent" + parent-management row in swimmer-edit: 2h
- Email templates (invite + digest) + Sunday cron: 2h
- Smoke + manual update + ROADMAP + privacy disclosure update: 1-2h
- Authz hardening + `parent.view.swimmer` audit-log instrumentation: 1h

Single session feasible but tight. Realistic split: 4a = data + server + invite flow (5-6h); 4b = ParentDashboard + cron + email (6-8h); 4c = smoke + docs (1-2h).

---

## 8. Dependencies

- **HARD: `IDENTITY_SCOPE.md` phase I-E (guardians table)** — without it, no place to store parent↔swimmer linkage. This scope CANNOT ship before identity I-E.
- **HARD: `EMAIL_INFRA_SCOPE.md`** — invite email + weekly digest both ride this infra. No fallback (in-app banner won't reach the parent who hasn't signed in yet).
- **Soft: `GOOGLE_OAUTH_SCOPE.md`** — most parents are not Apple-first. Without Google OAuth, adoption is severely limited (Apple-only excludes most Android parents).
- **No new external services.**
- **No new Cap'n hand-work.**

This scope has the most dependencies of any Phase 4 deliverable. Sequencing implication: **ship identity refactor first, then email infra (Phase 2), then Google OAuth (Phase 2), THEN this scope.** It's the natural "last Phase 4 deliverable" in the sequence.

---

## 9. Related

- `IDENTITY_SCOPE.md` — guardians table (phase I-E) is the foundation
- `EMAIL_INFRA_SCOPE.md` — outbound rails for invite + digest emails
- `GOOGLE_OAUTH_SCOPE.md` — most parent accounts will be Google
- `TEAM_CURATION_SCOPE.md` — same Phase 4 commercial value bundle
- `OWNERSHIP_TRANSFER_SCOPE.md` — same Phase 4 continuity bundle
- [[swim-generator-team-evaluation-2026-05-25]] — parent personas surfacing this gap
- [[feedback-no-password-auth]] — OAuth-only enforcement; no magic-link emails for parents
- PHASED_PLAN §3 Phase 4 — "team-tier earned + continuity closed"; this scope provides the parent-side of trust-building
- Future Phase 5 — Lesson tier parent recap export builds on this surface
