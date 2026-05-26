# Team-Level Curation Tier + Team Settings — scope

**Status:** scope-only (2026-05-26). Implementation lives in PHASED_PLAN §3 Phase 4 — "The product earns its team-tier price and survives founder absence." This is **what makes Program tier a product** (per team eval): without this, $25/mo Program tier is billing chrome over N Coach accounts.

**Pattern source:** mirrors existing favorites + disfavorites cascade (per-user own tier + coach-propagated tier from v1.13). Adds a new bottom tier (team) that team owners/admins set as defaults.

---

## 1. Why

Today's curation cascade has two tiers: **own** (a user's personal favorites/disfavorites) + **coach-propagated** (a coach's curation flows down to their group's swimmers). Both attach to a single coach's choices.

For a multi-coach club team — say, 4 coaches programming for 7 groups — there's no way to say "no one on this TEAM gets [X set] regardless of which coach you draw." Each coach has to disfavor it individually; assistant coaches' choices vary; new coaches inherit nothing.

The team eval's Head Coach + Treasurer + Lifecycle personas all flagged this as the Program tier's actual value prop. **A team-level curation tier turns Program tier into "set the policy once, every coach inherits."**

---

## 2. Locked decisions (2026-05-26)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Cascade order: Own > Coach > Team** | Personal choice wins. Coach disfavor next. Team default last. Matches "team sets the baseline; individuals tune." Composes cleanly with existing universal favorite-wins precedence from v1.13 (any favorite at any tier still wins over any disfavor at any tier). |
| 2 | **Write authority: Owner + Admin only** | `team_coaches.role IN ('owner','admin')` can write team curation. Regular coaches read-only. Mirrors existing org-role pattern from [[swim-generator-relationships-scope]]. Enforced in API + UI. |
| 3 | **Team Settings page = curation + 3 baseline defaults** | Curation (team_favorites + team_disfavorites) + default pace baseline + default disfavor_mode (downweight vs exclude) + default equipment_modes. Estimated ~5-7h. Bigger than curation-only but well short of "full team-policy page" (which is Phase 5+). |
| 4 | **Defaults apply to NEW swimmers only, not retroactively** | Existing swimmers in the team keep their current settings. Defaults set "what a brand-new swimmer joining the team gets." Coach can manually push defaults to all swimmers via "Apply to current roster" button (one-time, audit-logged). |
| 5 | **Mirror the existing dbGetEffective* helpers, don't rewrite** | `dbGetEffectiveDisfavorites` already does the own + coach union; extend it to add the team tier from `team_disfavorites` joined via `group_members → groups → teams`. Same for favorites. No new top-level helper; the union just gets one more SELECT. |
| 6 | **Team_favorites + team_disfavorites tables, not a unified table with `tier` enum** | Mirrors the existing per-user table pattern (separate `favorites` + `disfavorites`). Easier to reuse picker logic. Mutex enforced at DB level (UNIQUE on `(team_id, label)` across both tables — actually just two separate UNIQUEs since they're separate tables; conflict resolution in app layer). |
| 7 | **Propagation reach = entire team, all groups, all swimmers** | Team curation applies to every swimmer in any group under that team. Cascade picks it up via existing `group_members → groups.team_id` join. No coach-of-group filtering — team tier IS the team-wide policy. |
| 8 | **No "team-level engine disfavorite" support in v1** | The engine disfavorite system (per-template, per-stroke) is per-user only in v1.13. Adding a team tier here would require a new table; defer to v1.1 unless team feedback forces it. Team curation v1 = label-level + set-level only. |
| 9 | **Settings page lives under TeamsView**, not as a separate top-nav | New "⚙ Settings" tab in TeamsView next to the existing tabs. Owners + Admins see it; regular coaches see a read-only variant. |
| 10 | **Audit-log every team write** | `team.fav.add` / `team.fav.remove` / `team.disfav.add` / `team.disfav.remove` / `team.default.update` event types with target team + actor coach + value in details. R3 Curation Log subsection for Program-tier teams. |
| 11 | **Apply-to-current-roster is a one-time button per default** | Owner clicks "Apply pace baseline to all current swimmers." Confirms. Server applies, audit-logs `team.default.apply_to_roster` with count. Not auto-applied on future changes. |
| 12 | **Defaults visible to coaches via Profile + read-only Settings tab** | Coach in a team sees "Team default pace baseline: 2:00 (you have 1:55)" — knows what's inherited vs what's their override. Transparency. |

---

## 3. Implementation (Phase 4, after identity refactor where possible)

### 3.1 New migration (038 — assumes Phase 3 took up to 037)

```sql
CREATE TABLE `team_favorites` (
  `id`            BIGINT AUTO_INCREMENT PRIMARY KEY,
  `team_id`       BIGINT NOT NULL,
  `label`         VARCHAR(255) NOT NULL,
  `set_by_coach_sub` VARCHAR(255) NOT NULL,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_team_label` (`team_id`, `label`),
  INDEX `idx_team` (`team_id`),
  FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `team_disfavorites` (
  -- identical shape to team_favorites
  `id`            BIGINT AUTO_INCREMENT PRIMARY KEY,
  `team_id`       BIGINT NOT NULL,
  `label`         VARCHAR(255) NOT NULL,
  `set_by_coach_sub` VARCHAR(255) NOT NULL,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_team_label` (`team_id`, `label`),
  INDEX `idx_team` (`team_id`),
  FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- v1.1 candidate: team_favorite_sets, team_disfavor_sets (set-id level)

ALTER TABLE `teams`
  ADD COLUMN `default_pace_base`     VARCHAR(8)  NULL  AFTER `name`,
  ADD COLUMN `default_disfavor_mode` ENUM('downweight','exclude') NULL AFTER `default_pace_base`,
  ADD COLUMN `default_equipment_modes` JSON     NULL  AFTER `default_disfavor_mode`;
```

### 3.2 db.js helpers

- `dbAddTeamFavorite({ teamId, label, byCoachSub })` / `dbRemoveTeamFavorite(...)` — authz: owner OR admin of team
- `dbAddTeamDisfavorite(...)` / `dbRemoveTeamDisfavorite(...)` — same
- `dbListTeamCuration(teamId)` — returns `{ favorites: [labels], disfavorites: [labels] }`
- `dbSetTeamDefault({ teamId, field, value, byCoachSub })` — pace_base / disfavor_mode / equipment_modes
- `dbApplyTeamDefaultToRoster({ teamId, field, byCoachSub })` — bulk-update settings for every swimmer in any group under the team. Audit count.
- **Extend** `dbGetEffectiveDisfavorites(userSub)` — add a UNION ALL that pulls from `team_disfavorites` via `users → group_members → groups → teams`. Same shape as existing coach-propagation union.
- **Extend** `dbGetEffectiveFavorites(userSub)` — same pattern for favorites.
- **Extend** `dbEnsureUser(sub)` to read `teams.default_*` for the user's primary team and seed the user's settings row from those defaults on first-create. (Existing teams unaffected; only brand-new users inherit team defaults.)

### 3.3 Server routes

- `GET  /api/teams/:id/curation` — auth: any team coach (read)
- `POST /api/teams/:id/favorites` / `DELETE .../favorites/:label` — auth: owner+admin
- `POST /api/teams/:id/disfavorites` / `DELETE .../disfavorites/:label` — auth: owner+admin
- `GET  /api/teams/:id/settings` — auth: any team coach
- `PATCH /api/teams/:id/settings` — auth: owner+admin; body: any subset of pace_base / disfavor_mode / equipment_modes
- `POST /api/teams/:id/settings/apply-to-roster` — body: `{ field }`; auth: owner+admin; audit count returned

All write routes use `checkOrigin` + `requireCsrf` + `writeLimiter`.

### 3.4 Picker integration

`getEffectiveDisfavorites` (client) calls `/api/effective-disfavorites` which already does own + coach. After migration 038, the same endpoint includes team rows. **No client-side change** — the union shape stays `{ labels, set_ids, engine }`. Picker logic is already correct.

Universal favorite-wins precedence (v1.13) continues to apply: a favorite at ANY tier wins over a disfavor at ANY tier. Cascade order Own > Coach > Team only matters for resolving conflicts where the SAME tier (e.g. two coaches in the team set conflicting) — first-write wins at write time via the UNIQUE constraints.

### 3.5 Team Settings UI

In TeamsView, new "⚙ Settings" tab between existing tabs. For owners + admins:

```
Team Settings

── Team Curation ──
⭐ Favorites (3)            [+ Add]
   · "8 × 100 free descend"
   · "4 × 200 IM"
   · "broken 500s"

👎 Disfavorites (2)         [+ Add]
   · "200 fly straight"
   · "8 × 25 sprint blast"

── Team Defaults ──
Pace baseline:          [2:00 ▾]                  [Apply to all swimmers]
Disfavor mode:          [● Downweight ○ Exclude]  [Apply to all swimmers]
Default equipment:      [Edit]                     [Apply to all swimmers]

Note: defaults apply to NEW swimmers joining the team. Use
"Apply to all swimmers" to push to your current roster (one-time).
```

For regular coaches: same page, read-only, with "Set by [Owner Name] on YYYY-MM-DD" timestamps per row, no Add/Remove/Apply buttons.

### 3.6 Profile inheritance disclosure

In ProfileModal, in the existing Settings + Curation sections, show team-inherited values explicitly:

```
Pace baseline: 1:55     (Team default: 2:00 · you've overridden)
```

Lets coaches see the inheritance + their override at a glance.

### 3.7 R3 Curation Log extension

Existing log has subsections for label fav/disfav + set fav/disfav + engine fav/disfav. Add a fifth: **Team curation**. Shows `team.fav.add` / `team.disfav.add` / `team.default.update` etc. Scoped per team for the viewing coach.

---

## 4. Smoke checklist

- Owner of Team A adds "no fly straight 200s" to team_disfavorites → swimmers in Team A's groups generate workouts and the bank picker excludes that label (per existing `disfavor_mode`).
- Regular coach in Team A sees team_disfavorites in their TeamsView Settings tab as read-only; no add/remove buttons rendered.
- Coach in a DIFFERENT team unaffected.
- Universal favorite-wins still works: a swimmer's personal favorite for a label that's team-disfavored → favorite wins.
- Coach overrides team's default pace_base → ProfileModal shows "Team default: 2:00 · you've overridden" → effective settings use coach's override.
- Owner clicks "Apply pace baseline to all swimmers" → confirm modal → server updates all team swimmer settings.rows → audit log shows `team.default.apply_to_roster` with `{ team_id, field: 'pace_base', count: N }`.
- New user signed up to a team with defaults set → their settings row seeded from team defaults on first generate.
- Authz: regular coach tries POST to `/api/teams/:id/favorites` → 403.
- R3 Curation Log shows team events for Program-tier coaches.

---

## 5. Out of scope (deferred to v1.1+)

- **Team-level engine disfavorite** (per-template, per-stroke at team level). v1 = label + set-level only.
- **Set-level team curation** (team_favorite_sets, team_disfavor_sets). v1 = label-level only; sets in v1.1.
- **Per-group curation tier** (between coach + team). Some clubs want "Sprint Group disfavors X across all coaches" without it being team-wide. v1.1.
- **Tier-conflict notification UI.** If a coach's personal favorite conflicts with a team disfavor, today the favorite silently wins (per universal precedence). v1.1 could surface "You're overriding a team policy" tooltip.
- **Team curation history viewer.** Curation Log shows the events; a richer "policy timeline" view is v1.1.
- **Coach-level override of "apply to roster" (e.g., \"don't apply pace baseline to swimmers in my group\")**. v1 is team-wide push; per-group exemption is v1.1.

---

## 6. Open Cap'n forks (none block v1)

1. **What about teams created BEFORE this ships?** Existing teams have no defaults set; behavior unchanged until owner enters Settings + saves. Document in §3.5 UI ("defaults are blank until you set them"). Don't backfill anything.
2. **Owner-removed-and-no-admin-exists edge case.** Today an owner is the only role. Phase 4 admin role doesn't exist yet — needs to be added BEFORE this ships. RELATIONSHIPS_SCOPE has admin in the data model already; just no UI to grant. Bundle the "grant admin" UI with this scope.
3. **Multi-team coach.** A coach in Team A AND Team B gets team disfavorites from BOTH teams unioned into their effective set. Documented behavior; surface it in coach Profile so they can see which team contributed which entry. v1 just unions silently; v1.1 surfaces attribution.

---

## 7. Effort estimate

~10-14h. Slightly above the originally-rough estimate because Team Settings page is its own UI surface and "apply to roster" is a real flow.

- Migration 038 + db helpers: 2h
- Server routes + authz: 2h
- Picker integration (extend existing dbGetEffective*): 1h
- Team Settings UI (curation + 3 defaults + apply-to-roster): 4-5h
- Profile inheritance disclosure: 1h
- R3 Curation Log subsection: 1h
- Smoke + manual update + ROADMAP + grant-admin UI add: 1-2h

Could split Phase 4a = data + server + extend effective queries + picker (working invisibly, ~5h); Phase 4b = Team Settings UI + inheritance disclosure + reporting (~5-7h).

---

## 8. Dependencies

- **Identity refactor (`IDENTITY_SCOPE.md`) ideally ships first.** Persons-table + name-split makes the "Set by Coach Smith" attribution cleaner. Not strictly required; v1 can use sub-with-display-name lookup like every other audit surface.
- **Team admin role grant UI** is a sub-dependency. Data model exists per RELATIONSHIPS_SCOPE; grant UI doesn't. Bundle into this scope or ship as prereq.
- **No new external services.**
- **No new Cap'n hand-work.**

---

## 9. Related

- [[swim-generator-favorites-prop-v13]] — pattern this scope extends (own + coach tiers); team becomes the third
- [[swim-generator-relationships-scope]] — `teams` + `team_coaches` (with role) + `groups` data model
- [[swim-generator-reporting-v1-complete]] — R3 Curation Log gets a fifth subsection
- `IDENTITY_SCOPE.md` — identity refactor that this ideally rides after for cleaner attribution
- `OWNERSHIP_TRANSFER_SCOPE.md` — owner role mechanics this scope depends on (admin-grant prereq)
- [[swim-generator-team-evaluation-2026-05-25]] — team eval surfacing "without this, Program tier is billing chrome"
- PHASED_PLAN §3 Phase 4 — Phase 4 deliverables; this is the commercial-value-prop one
