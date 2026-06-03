# View-as v3 — True Impersonation (with `support_role` gate)

**Status:** scope locked 2026-05-22. Build pending.

Companion to [[view-as v1]] (admin role-flag UI override, shipped 2026-05-22, tag `view-as-v1`). v1 lets an admin see what UI another role sees, using the admin's own data. **v3 lets an admin (or `support_role`-flagged user) act as a SPECIFIC OTHER USER server-side** — seeing their actual data, favorites, history, groups.

This is a customer-support tool, not a UI QA tool. Different purpose, different risk profile.

## 1 — Locked decisions (2026-05-22)

| Aspect | Choice |
|---|---|
| **Auth model** | Header-based: `X-Impersonate-Sub: <target_sub>` on every API call. Admin's session stays live. Middleware reads header, validates active session, rewrites `req.userSub`. |
| **Role gate** | New `users.support_role BOOLEAN` column. `is_admin OR support_role` grants impersonation. |
| **Write scope** | **Read-only for v3.0.** Server blocks ALL writes when impersonation header present. No Generate, no Save, no Settings change, no Curation toggles. Defense-in-depth: client also hides write controls. |
| **Audit** | Every API call made during impersonation logged: `(timestamp, admin_sub, target_sub, route, method)`. |
| **Time cap** | **30-minute hard cap** from session start. Expires automatically; new session required to continue. |
| **User notification** | **None.** (Cap'n's call against my recommendation — see Risks §4 below.) |
| **Picker UI** | Both: (a) per-row Impersonate button in Admin→Users, (b) dedicated top-nav modal with search. |
| **Banner** | Sticky amber banner across app while active: "Acting as Alice — N min remaining" + Exit button. |

## 2 — Auth flow

```
1. Admin clicks Impersonate (per-row button or modal-selected user)
2. UI confirms: "Start 30-minute impersonation of Alice? Read-only."
3. POST /api/impersonation/start { target_sub: "..." }
   - Server validates: caller is_admin OR support_role
   - Server validates: target user exists
   - Server INSERTs impersonation_sessions row, returns { session_id, expires_at }
   - Server audit-logs the start event
4. Client stores { target_sub, target_name, expires_at } in App state
5. Every subsequent fetch from client adds `X-Impersonate-Sub: <target_sub>`
6. Server middleware on every authenticated route:
   - If header present: look up active impersonation_sessions row
     (admin_sub matches caller's session, target_sub matches header, not expired, not ended)
   - If valid: rewrite req.userSub = target_sub; set req.impersonatorSub = admin_sub
   - If invalid: 401 with reason; client drops impersonation state
7. Write routes also check req.impersonatorSub — if set, return 403 with reason "impersonation is read-only"
8. Admin clicks Exit OR 30-min timer expires
   - POST /api/impersonation/end (or auto-cleanup on next request after expiry)
   - Server marks session row ended_at
   - Client drops impersonation state, resumes normal session
```

## 3 — Database schema

### Migration 028
```sql
-- 1. Grant gate on users
ALTER TABLE users ADD COLUMN support_role BOOLEAN NOT NULL DEFAULT 0;
CREATE INDEX idx_users_support_role ON users(support_role);

-- 2. Active+historical impersonation sessions
CREATE TABLE impersonation_sessions (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  admin_sub    VARCHAR(64) NOT NULL,
  target_sub   VARCHAR(64) NOT NULL,
  started_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at   DATETIME NOT NULL,   -- started_at + 30 min
  ended_at     DATETIME NULL,        -- null = active; set on explicit end or first expired request
  end_reason   VARCHAR(32) NULL,     -- "exit" | "expired" | "admin_revoked"
  INDEX idx_impersonation_admin_active (admin_sub, ended_at, expires_at),
  INDEX idx_impersonation_target (target_sub, started_at)
);

-- 3. Extend audit_events with impersonator_sub (nullable)
ALTER TABLE audit_events ADD COLUMN impersonator_sub VARCHAR(64) NULL;
CREATE INDEX idx_audit_impersonator ON audit_events(impersonator_sub, occurred_at);
```

**Why active-session-by-admin** (not by session_id): each admin has at most ONE active impersonation at a time. Looking up "who am I currently impersonating?" needs only the admin's sub.

## 4 — Files touched

- `migrations/028_impersonation.sql` (new) — schema above
- `db.js` — 5 new helpers (~80 lines):
  - `dbStartImpersonation(adminSub, targetSub) → { id, expires_at }`
  - `dbEndImpersonation(adminSub, reason) → void` (ends any active session)
  - `dbGetActiveImpersonation(adminSub) → row | null`
  - `dbValidateImpersonationHeader(adminSub, claimedTargetSub) → boolean` (checks active session matches)
  - `dbGrantSupportRole(adminSub, targetSub, granted) → void`
- `server.js` — middleware + routes (~120 lines):
  - `requireAuth` extended: after resolving session, check `X-Impersonate-Sub` header; validate via `dbValidateImpersonationHeader`; rewrite `req.userSub` and set `req.impersonatorSub`
  - `requireWritable` middleware (new): blocks any req with `impersonatorSub` set. Returns 403 with `reason: "impersonation is read-only"`. Applied to every POST/PUT/DELETE/PATCH route via shared chain.
  - Audit logger extended: every call to `dbAuditEvent` propagates `req.impersonatorSub` if set
  - `POST /api/impersonation/start` (requires admin || support_role)
  - `POST /api/impersonation/end` (requires impersonation header present)
  - `GET /api/impersonation/active` (returns caller's own active session if any — used by client to recover state after reload)
  - `POST /api/admin/users/:sub/support-role` (admin-only — grants/revokes)
- `public/index.html` — App state + handlers + UI (~250 lines):
  - State: `impersonating: { target_sub, target_name, target_email, expires_at } | null`
  - Fetch wrapper: auto-adds `X-Impersonate-Sub` header when active
  - Exit handler + banner countdown
  - Admin→Users: per-row Impersonate button (gated)
  - New top-nav modal entry: search by email/initials, Confirm dialog
  - Sticky amber banner with countdown + Exit
  - On mount: GET /api/impersonation/active to recover state across reloads
- `public/manual.html` — short admin-docs section explaining the feature (~60 lines)

Total estimate: **~6-8 hours focused work**.

## 5 — Risks

1. **Auth is the most dangerous code category.** Every API route now goes through the impersonation-aware path. A bug here can leak data across users or grant unintended privileges. Mitigation: build server-side first, test via `curl` against staging before any UI ships; write integration tests against the start/end/header-validation paths.

2. **Header forgery.** A malicious client could send `X-Impersonate-Sub` of a target they don't have an active session for. Mitigation: server validates against `impersonation_sessions` on every request; client can NEVER set this without a valid session row.

3. **Time-cap enforcement race.** Between session expiry and the client noticing, requests with the now-expired header will 401. Acceptable behavior — client drops impersonation state on first 401-with-expired-reason and shows "session expired, please restart impersonation."

4. **No-notification trust risk.** This is the SetForge-trust risk Cap'n explicitly accepted. If pilot users discover later that admins viewed their accounts without notification, the trust hit can be significant. Mitigation suggested at minimum: a publicly-readable admin-actions log per user so curious users can audit themselves; ToS update before adding any non-Cap'n admin. Deferring to v3.1+.

5. **Write-block gaps.** Some routes might not go through the shared `requireWritable` chain (e.g. WebSocket connections if added later). Audit every route after build to confirm middleware coverage. Document any non-applicable cases.

6. **Multi-tab edge case.** If admin has SetForge open in two tabs and starts impersonation in tab A, tab B's existing session continues normally. Mitigation: every fetch reads current impersonating state from React; if the user manually navigates tab B and triggers a fetch, it correctly uses tab B's state (no impersonation), not tab A's. Acceptable.

## 6 — Out of scope for v3.0 (deferred)

- **Write permissions** — defer to v3.1+ once a real support workflow proves the need. Allowlist specific safe writes (e.g. "fix this stuck workout") rather than enabling all writes at once.
- **User notification on session end** — strongly recommended for v3.1. See Risk §4.
- **User opt-out toggle** ("don't allow admins to impersonate me") — v3.2+, with ToS update.
- **Coach impersonation of their own swimmers** — different feature class (coach has a relationship-based reason); separate scope. Could share infrastructure later.
- **Concurrent multi-target impersonation** — out of scope. One admin = one active session at a time.
- **Persistent impersonation across reloads** — possible (GET /api/impersonation/active on mount). Built into v3.0 client.

## 7 — Test plan

Manual e2e post-deploy (multi-user — needs Cap'n + a test account):

1. As admin: navigate Admin→Users, click Impersonate on a test account → confirm dialog → session starts.
2. Verify amber banner appears with countdown.
3. Navigate to Generator: verify you see the test account's pace/level/equipment defaults, not yours.
4. Try to click Generate: write blocked (server 403 OR client hides button).
5. Open Profile: verify you see the test account's favorites/disfavorites lists, not yours.
6. Click Exit on banner: session ends, banner disappears, you're back to your own data.
7. Start a new session, wait 30 minutes (or temporarily set the cap lower for testing): verify session auto-expires.
8. Check audit log: should show start, every API call during the session (tagged with impersonator_sub), end (with end_reason).
9. As non-admin non-support-role user: confirm Impersonate buttons absent everywhere.
10. As support_role user (admin-granted): verify Impersonate works without `is_admin` flag.

## 8 — Manual docs section (to add post-build)

New section in `public/manual.html` under Admin docs:

> ### Impersonation (`support_role`)
>
> Users with `support_role` or `is_admin` can impersonate any other user for up to 30 minutes, read-only. Used for customer support to diagnose issues without asking the user to share screen.
>
> ...etc.
