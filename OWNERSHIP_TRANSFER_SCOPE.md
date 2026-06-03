# Ownership Transfer + UGC Reassignment — scope

**Status:** ✅ SHIPPED 2026-06-03 (migration 045). Core flow + UGC reassignment + cron + emails + UI all live. **Deferred from this pass:** §3.5 account-delete blocker — there is no self-serve account-delete flow to gate (only the admin tombstone path), so it has nothing to hook into; revisit if/when a self-delete surface ships. Transfer-history viewer, multi-step succession, bulk transfer, and surfacing cancel/decline reasons remain v1.1 (§5). Original scope below.

Implementation lives in PHASED_PLAN §3 Phase 4 — "The product earns its team-tier price and survives founder absence." Continuity-critical: without this, teams orphan on founder/head-coach exit. Head Coach + Assistant + Lifecycle personas across the team eval all flagged this.

**Pattern source:** none directly. New flows. Reuses team_coaches role infrastructure from RELATIONSHIPS_SCOPE and UGC author tracking from UGC v1.

---

## 1. Why

Today: a team has one owner (`team_coaches.role='owner'`). If that owner leaves SetForge, deletes their account, or simply stops paying — the team is stranded. Coaches in the team retain access but no one can:

- Change team metadata (name, archive)
- Add/remove coaches
- Manage team-level curation (when Team Curation scope ships)
- Take billing actions (when Program tier billing routes through team rather than per-coach)
- Inherit the departing coach's UGC (today's UGC has `author_sub` — if author's account is deleted, UGC orphans)

Manual line 1406 already documents "ownership transfer flow planned." The team eval surfaced this as a Head Coach + Assistant + Lifecycle blocker — **without it, the founder-exit story collapses** and any board's "what happens if your head coach leaves?" review fails.

---

## 2. Locked decisions (2026-05-26)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Trigger: explicit "Transfer ownership" UI in Team Settings + 30-day cooldown** | Active intent; reversible mistakes. Owner clicks Transfer → picks new owner → 30-day reversible window during which either party can cancel → after 30 days auto-applies. No silent transfer; no admin override path in v1 (admin path is Cap'n manually via DB if needed). |
| 2 | **New-owner gating: must be an existing team admin** | Picks from `team_coaches WHERE team_id=X AND role='admin' AND removed_at IS NULL`. Forces deliberate succession ("promote first, transfer second"). If no admins exist, Transfer button greyed with tooltip "promote an admin first." |
| 3 | **UGC reassignment policy: all departing-coach UGC reassigns to current owner; UGC stays live** | `bank_options.author_sub` rewritten to current team owner's sub for every UGC row by departing coach where visibility ∈ ('team', 'public'). Private UGC stays with departing coach (it's theirs alone; reassigning would be surprising). Audit row per reassigned option. |
| 4 | **30-day cooldown is reversible on both sides** | Original owner can cancel ("never mind"). Proposed new owner can decline ("not ready"). After 30 days no action, transfer auto-applies + email both parties. Cancel/decline returns to pre-transfer state with no data movement. |
| 5 | **During cooldown, current owner retains full powers** | Pending transfer = pending. Current owner can still do owner things. Proposed new owner gets a banner inviting them to accept early ("you've been proposed as the new owner of Team X · [Accept now] [Decline]"). |
| 6 | **Account-delete cascade: prompt for transfer if owner; block delete until resolved** | When an owner clicks "Delete account" in Profile, they hit a modal: "You're the owner of N teams. Pick a new owner for each before deleting your account." Forces resolution; no orphaned teams. If a team has no admins to promote, owner sees "promote an admin first or archive the team." |
| 7 | **Departing coach (non-owner) leaving a team: no transfer needed; UGC reassignment still triggers** | Regular coach removed from a team (or leaves SetForge) → their team-shared UGC reassigns to the team owner. Private UGC stays. No ownership change. |
| 8 | **Email both parties on transfer events** | `team.transfer.proposed`, `team.transfer.accepted`, `team.transfer.cancelled`, `team.transfer.declined`, `team.transfer.completed` — each sends to both old + new owner via Phase 2 email infra. Falls back to in-app banner if email infra not yet live. |
| 9 | **Audit log every transfer state change** | Each event_type above gets a row. Details: `{ team_id, from_sub, to_sub, transition_state, reason? }`. R5 admin report (when team-tier ships) shows transfer history per team. |
| 10 | **No transfer history visible in TeamsView v1** | Audit log captures it; UI surface for "this team has changed hands 3 times" is v1.1. Cap'n + the parties involved see it via audit log already. |
| 11 | **Reassigned UGC keeps original visibility + sharing** | Team-shared stays team-shared; public-promoted stays promoted. Only the author_sub field changes. Reviewers (admin moderation) don't get re-notified. |
| 12 | **Pending transfer blocks team-level destructive actions** | Owner can't archive the team or delete it during a pending transfer. Other actions (curation, defaults) stay enabled. Reduces "transferred to chaos" failure mode. |

---

## 3. Implementation (Phase 4, can ship in parallel with team curation)

### 3.1 New migration (039 — assumes 038 took team curation)

```sql
CREATE TABLE `team_ownership_transfers` (
  `id`                  BIGINT AUTO_INCREMENT PRIMARY KEY,
  `team_id`             BIGINT NOT NULL,
  `from_sub`            VARCHAR(255) NOT NULL,    -- current owner at proposal time
  `to_sub`              VARCHAR(255) NOT NULL,    -- proposed new owner
  `state`               ENUM('pending','accepted','cancelled','declined','completed') NOT NULL DEFAULT 'pending',
  `proposed_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_at`         DATETIME NULL,
  `auto_complete_at`    DATETIME NOT NULL,        -- proposed_at + 30 days
  `cancel_reason`       VARCHAR(255) NULL,
  INDEX `idx_team_state` (`team_id`, `state`),
  INDEX `idx_auto_complete` (`auto_complete_at`, `state`),
  FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;
```

Only one pending transfer per team at a time (enforced at app layer via state check).

### 3.2 db.js helpers

- `dbProposeOwnershipTransfer({ teamId, fromSub, toSub })` — authz: fromSub is current owner; toSub is existing team admin. Checks no other pending. Inserts with `auto_complete_at = NOW() + 30 days`.
- `dbCancelOwnershipTransfer({ teamId, byCoachSub, reason })` — authz: original owner. Marks state='cancelled'.
- `dbAcceptOwnershipTransfer({ teamId, byCoachSub })` — authz: proposed new owner. Marks state='accepted' + flips roles immediately + reassigns UGC.
- `dbDeclineOwnershipTransfer({ teamId, byCoachSub, reason })` — authz: proposed new owner. Marks state='declined'.
- `dbAutoCompleteTransfers()` — cron sweep: finds `state='pending' AND auto_complete_at <= NOW()` → flips to 'completed' → applies role change + UGC reassignment. Piggybacks on the email worker tick.
- `dbReassignDepartingCoachUgc({ teamId, departingSub, newOwnerSub })` — UPDATEs `bank_options` SET author_sub=newOwnerSub WHERE author_sub=departingSub AND visibility IN ('team','public') AND id IN (overlay rows visible to this team). Audit per row.
- `dbGetPendingTransferForTeam(teamId)` — lookup for banner display.
- `dbBlockDeleteIfOwnerOfTeams(userSub)` — called by account-delete flow; returns list of teams needing resolution.

### 3.3 Server routes

- `POST   /api/teams/:id/transfer-ownership` — body: `{ to_sub, reason? }`. Auth: owner.
- `POST   /api/teams/:id/transfer-ownership/cancel` — auth: original proposer.
- `POST   /api/teams/:id/transfer-ownership/accept` — auth: proposed new owner.
- `POST   /api/teams/:id/transfer-ownership/decline` — body: `{ reason? }`. Auth: proposed new owner.
- `GET    /api/teams/:id/pending-transfer` — auth: any coach of the team (read).
- Account-delete flow already exists; extend to call `dbBlockDeleteIfOwnerOfTeams` and block with team list response.

All writes use `checkOrigin` + `requireCsrf` + `writeLimiter`.

### 3.4 UI: TeamsView Settings tab "Ownership" section

For owners:

```
── Ownership ──
Current owner: you (joined 2026-01-15)

[Transfer ownership →]
   Picks from existing team admins:
   ● Coach Smith (admin)
   ○ Coach Jones (admin)
   No admins available? [Promote a coach to admin first]

(when transfer pending:)
⏳ Transfer in progress
   You proposed Coach Smith as new owner on 2026-05-26.
   Auto-completes 2026-06-25 (29 days remaining).
   [Cancel transfer]
```

For proposed new owner (banner above all TeamsView pages):

```
🎯 You've been proposed as the new owner of Team Aquatics.
   Proposed by Coach Cap'n on 2026-05-26 · auto-applies in 29 days.
   [Accept now]  [Decline]
```

### 3.5 UI: Profile account-delete blocker

When owner of any team clicks "Delete account":

```
You're the owner of:
· Team Aquatics (5 swimmers, 3 coaches)
· Team Masters (12 swimmers, 1 coach)

Before deleting your account, resolve ownership for each:
· Team Aquatics → [Transfer ownership]  or  [Archive team]
· Team Masters → No admins available; [Promote an admin first]
                  or [Archive team]
```

Delete button greyed until all teams resolved.

### 3.6 UGC reassignment flow

Triggered on `dbAcceptOwnershipTransfer` AND on coach-leaves-team. Single helper. Auditable.

For ownership transfer: the departing person's team-shared + public UGC moves to the new owner. They're now the author of record.

For a regular coach leaving a team: their team-shared UGC moves to the team's current owner. Public UGC keeps their sub (it's gone through admin moderation; reassigning would muddy the moderation trail). Private UGC stays with them.

### 3.7 Email touches (via Phase 2 infra)

Five email templates added to `lib/email-templates/`:

- `transfer-proposed.js` (to: proposed new owner)
- `transfer-accepted.js` (to: original owner)
- `transfer-cancelled.js` (to: proposed new owner)
- `transfer-declined.js` (to: original owner)
- `transfer-completed-auto.js` (to: both, after 30-day no-action)

Subject + body templates short; all transactional, no marketing. Adult-only per `EMAIL_INFRA_SCOPE.md` minor-bypass.

---

## 4. Smoke checklist

- Owner of Team A proposes Coach Smith (admin of Team A) → `team_ownership_transfers` row inserted with state=pending, auto_complete_at=NOW+30d → email sent to Coach Smith → banner appears in Coach Smith's TeamsView.
- Coach Smith clicks Accept → role flips immediately (Owner↔Admin swap) → Coach Smith now has owner powers → UGC reassignment runs (Coach Cap'n's team-shared UGC → author_sub = Coach Smith).
- Same flow, but Coach Smith declines → state=declined → role unchanged → no UGC movement → email to original owner.
- Same flow, but original owner cancels after 5 days → state=cancelled → role unchanged → no UGC movement.
- Same flow, 30 days pass with no action → cron runs → auto-completes → role flip + UGC reassignment + both emails sent.
- Owner attempts to propose a non-admin → 400 error.
- Owner attempts to propose while one's already pending → 409 error.
- Owner deletes their account while owning teams → blocker modal shows team list + resolution options.
- Owner archives team during pending transfer → blocked.
- Regular coach (not owner) leaves Team A → their team-shared UGC reassigns to current owner; public UGC keeps their sub; private UGC stays with them.
- Audit log shows all five transfer state events + the UGC reassignment count per event.
- Authz: random user tries to accept a transfer not proposed to them → 403.

---

## 5. Out of scope (deferred to v1.1+)

- **Transfer history viewer UI in TeamsView.** Audit log captures everything; richer UI is v1.1.
- **Multi-step succession** (designate "next-next owner" in advance). v1 is direct hand-off only.
- **Bulk team transfer** ("transfer all my teams to Coach Smith in one action"). v1 is per-team.
- **Owner-to-admin demotion as part of transfer** (current owner could opt to leave entirely instead of becoming admin). v1 = role swap; v1.1 could offer "leave the team after handoff" toggle.
- **Public UGC reassignment.** Stays with original author per decision 6 of UGC reassignment. Revisit if it becomes a real complaint.
- **Cancel/decline reason exposed to the other party.** v1 stores `reason` for audit; doesn't surface it in the email or banner. v1.1 could include.

---

## 6. Open Cap'n forks (none block v1)

1. **What if the proposed new owner deletes their account during the cooldown?** Pending transfer should auto-cancel + email original owner. Document the behavior in cron sweep; smoke verify.
2. **What if both parties are admins of a SHARED team and you transfer X, do their roles in other teams change?** No. Ownership is per-team-pair; the swap only affects this team's `team_coaches.role`. Already covered by the data model; worth documenting.
3. **Should "promote an admin first" let owner do it inline from the Transfer modal**, or require navigating away? v1 = inline mini-flow (one extra step in the modal); v1.1 if it feels clunky.

---

## 7. Effort estimate

~10-14h.

- Migration 039 + db helpers: 2h
- Server routes + auto-complete cron (piggyback on email worker): 2h
- UGC reassignment helper + audit: 1.5h
- TeamsView Ownership UI (initiate + cancel + pending state): 3h
- Profile account-delete blocker: 1.5h
- New-owner banner + accept/decline flow: 1.5h
- Email templates (5): 1h
- Smoke + manual update + ROADMAP: 1-2h

Single session feasible if all decisions are locked. Can ship in parallel with Team Curation (no shared files of concern; both touch TeamsView Settings tab — coordinate the layout in one PR).

---

## 8. Dependencies

- **Phase 2 email infra** for the 5 transactional emails. Falls back to in-app banners if email not yet live; emails get added when infra ships.
- **Identity refactor (`IDENTITY_SCOPE.md`)** ideally first — "Set by Coach Smith" attribution + tombstone-on-delete intersect with what this scope does. If identity ships first, account-delete blocker's resolution-options list reads cleanly; if not, this scope is the de-facto blocker for account-delete-with-orphan-teams scenario.
- **Team admin role grant UI** is a hard prereq. Data model exists; UI doesn't. Bundle with Team Curation scope's prereq or ship as standalone first.
- **No new external services.**
- **No new Cap'n hand-work.**

---

## 9. Related

- [[swim-generator-relationships-scope]] — `teams` + `team_coaches.role` + group hierarchy
- [[swim-generator-ugc-v2-phase-c]] through Phase G — UGC author tracking that gets reassigned
- `TEAM_CURATION_SCOPE.md` — same TeamsView Settings tab + same admin-role prerequisite
- `IDENTITY_SCOPE.md` — phase I-G's tombstone-on-delete intersects with this scope's account-delete blocker
- `EMAIL_INFRA_SCOPE.md` — 5 templates ride this infra
- [[swim-generator-team-evaluation-2026-05-25]] — Head Coach + Assistant + Lifecycle personas flagging this as continuity-critical
- PHASED_PLAN §3 Phase 4 — "team-tier earned + continuity closed" exit criteria; this is the continuity half
