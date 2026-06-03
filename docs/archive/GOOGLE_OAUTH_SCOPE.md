# Google OAuth — scope

**Status:** scope-only (2026-05-26). Implementation gated on Cap'n provisioning a Google Cloud Console project + OAuth 2.0 Client ID/Secret for `setforge.io`. No code until those env vars exist.

**Phase:** PHASED_PLAN §3 Phase 2 — "Android sign-up + email rails." First of three Phase 2 deliverables (the other two: outbound email infra; Discord webhook wiring, which is fully scoped in DISCORD_SCOPE.md §6 + §9).

**Source pattern:** mirrors the existing Apple OAuth flow at `server.js:464-537`. Same session model, same audit events, same invite-code gate for new users. Differences called out per section.

---

## 1. Why

Apple OAuth (live today) excludes:
- Every Android user (parents, swimmers, coaches without an Apple ID)
- Every coach evaluating SetForge on a Windows or ChromeOS work machine
- Every user whose first sign-in attempt fails and who never returns because they don't have an Apple ID

Google OAuth covers ~95% of the gap. Apple stays the primary CTA on the signed-out landing for brand reasons (privacy posture matches); Google is the equal-secondary option ("or Sign in with Google").

Per [[feedback-no-password-auth]]: never email/password, never magic-link emails. OAuth-only forever. Google is the second provider; no third is planned for Phase 2.

---

## 2. Locked decisions (2026-05-26)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Account-linking by verified email** | Same human signing in with both Apple + Google → ONE account. Lookup on Google sign-in: if `email_verified=1` AND a matching `users.email` exists (case-insensitive), bind the Google sub to that existing account. |
| 2 | **Auto-link, not prompt-link** | If verified-email match found, link silently. No "we found another account, link?" confirmation UI in v1. (Decision can flip if Cap'n later flags hijack-risk concern. Today's risk is low — Google email verification is trustworthy and Apple emails are scoped per-app via relays.) |
| 3 | **Apple-relay edge case = separate accounts (documented limitation)** | If the existing Apple account used `@privaterelay.appleid.com` for `email`, no Google email will ever match it. That user ends up with two accounts. They can manually merge later via support; not a v1 UI feature. |
| 4 | **Web-only for v1** | No native Google route (`/api/auth/native` stays Apple-only). iOS native is paused per [[swim-generator-ios-paused]]. Re-evaluate if iOS unpauses. |
| 5 | **Same invite-code gate as Apple** | New Google sub goes through `dbConsumeInviteCode` exactly like new Apple sub. Free-tier permanence promise is unchanged. |
| 6 | **`/api/auth/google` start + `/api/auth/google/callback` callback** | Don't reuse Apple's `/api/auth/callback`. Apple uses `form_post` (POST callback); Google uses `code` flow (GET callback). Separate routes avoid muxing. |
| 7 | **`GOOGLE_AUTH_ACTIVE` env flag** | Mirrors `APPLE_AUTH_ACTIVE`. If the three env vars (client_id, client_secret, redirect_uri) aren't all present, route returns 404. Lets dev/test envs run without Google config. |
| 8 | **Use `google-auth-library` for token verification** | Don't hand-roll JWT validation. The npm package handles cert rotation, audience check, exp check. ~15kb. |
| 9 | **No new DB columns on `users`** | Existing `users` schema (`sub`, `email`, `email_verified`) is unchanged. Google sub becomes the `sub` for new accounts; for linked accounts, the *Apple* sub stays the primary key and we store the Google sub in a new `user_oauth_providers` join table (see §3.2). |
| 10 | **Audit-log explicit provider on every login event** | `auth.login.success`, `auth.signup`, `auth.login.reject` get a `provider: "google"` or `"apple"` field in `details`. Existing rows are implicitly Apple (channel: "web" already discriminates pre-v2). |
| 11 | **Default `users.display_name = given_name` for new Google sign-ups** | Google's id_token exposes `given_name` (first name). On `dbEnsureUser` for a brand-new Google account, default `display_name` to that string. User can edit in Profile. Apple gives nothing, so this is a Google-only bonus. Empty/missing `given_name` → blank, same as Apple. |
| 12 | **No tooltip on the Apple-relay → Google second-account edge case** | Document the situation in `privacy.html` as a one-paragraph note: "If you previously signed in with Apple using Hide My Email, your Google account uses a different email and you'll get a second SetForge account — email hello@setforge.io to merge manually." No in-app UI for this rare case. |
| 13 | **No Google token revoke on sign-out** | Matches Apple's behavior (Apple doesn't expose revoke). We don't store or reuse the OAuth token past id-verification at sign-in. `/api/auth/signout` just clears the SetForge session; the Google session in the user's browser persists (so they can sign back in with one click, which is the same Apple behavior). |

---

## 3. Implementation (deferred until env vars exist)

### 3.1 New env vars

- `GOOGLE_CLIENT_ID` — from Google Cloud Console OAuth 2.0 Client
- `GOOGLE_CLIENT_SECRET` — same source
- `GOOGLE_REDIRECT_URI` — should be `https://setforge.io/api/auth/google/callback` for prod; per-env for dev

Computed flag: `GOOGLE_AUTH_ACTIVE = !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI)`.

### 3.2 New migration (033)

```sql
CREATE TABLE `user_oauth_providers` (
  `user_sub`     VARCHAR(255) NOT NULL,
  `provider`     ENUM('apple','google') NOT NULL,
  `provider_sub` VARCHAR(255) NOT NULL,
  `linked_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`provider`, `provider_sub`),
  INDEX `idx_user_sub` (`user_sub`),
  FOREIGN KEY (`user_sub`) REFERENCES `users`(`sub`) ON DELETE CASCADE
) ENGINE=InnoDB;
```

Backfill: every existing `users.sub` gets a row in `user_oauth_providers` with `provider='apple', provider_sub=sub`. Idempotent (`ON DUPLICATE KEY UPDATE linked_at = linked_at`).

After backfill: lookups become `dbGetUserSubByProvider(provider, providerSub)`. For Apple this is a passthrough today (provider_sub IS the user_sub). For Google: lookup the join table to find the primary user_sub.

### 3.3 New db.js helpers

- `dbGetUserSubByProvider(provider, providerSub)` — returns `users.sub` or null. Used by the callback to know if this is an existing user.
- `dbLinkOAuthProvider({ userSub, provider, providerSub })` — inserts join row. Idempotent.
- `dbFindUserByVerifiedEmail(email)` — case-insensitive lookup, only returns row if `email_verified=1`. Used for the link-by-email path.

### 3.4 New server.js routes

`app.get("/api/auth/google", authLimiter, ...)` — mirrors `/api/auth/apple` shape. Generates state cookie. Redirects to Google with `scope=openid email profile` (profile gives us `given_name` per §2 decision 11).

`app.post("/api/auth/google/callback", ...)` — actually GET since Google uses `?code=` redirect. Exchanges code for tokens server-side (Google requires the secret), verifies id_token via `google-auth-library`, then:

```
const googleSub = payload.sub;
const googleEmail = payload.email;
const googleEmailVerified = payload.email_verified === true;

// Step 1 — already linked?
const existingSub = await dbGetUserSubByProvider('google', googleSub);
if (existingSub) {
  // Returning Google user. Create session as that sub.
  return signInAs(existingSub, 'google');
}

// Step 2 — link by verified email?
if (googleEmailVerified) {
  const matched = await dbFindUserByVerifiedEmail(googleEmail);
  if (matched) {
    await dbLinkOAuthProvider({ userSub: matched.sub, provider: 'google', providerSub: googleSub });
    dbAuditEvent({ userSub: matched.sub, eventType: 'auth.provider.link', ...meta, details: { provider: 'google' } });
    return signInAs(matched.sub, 'google');
  }
}

// Step 3 — brand new. Invite gate, then create user, then link.
// (mirrors Apple new-user path)
```

`signInAs(sub, provider)` is a tiny helper that wraps `dbCreateSession` + cookie + `auth.login.success` audit (with the provider tag). Refactor Apple's callback to use it too so the audit tagging is consistent.

### 3.5 Client wiring

- Add "Sign in with Google" button below the "Sign in with Apple" button on the signed-out landing (`SignInGate` at `public/index.html:21595`). Same visual weight, same height (48px min), Google's brand uses their official SVG + colors per their identity guidelines.
- Same `<a href="/api/auth/google?invite=...">` shape as the existing Apple link.
- No client-side OAuth code; everything redirect-based.

### 3.6 Manual + privacy disclosure

- `public/manual.html` "More sign-in options" entry already mentions Google OAuth (updated 2026-05-26). After Phase 2 ships, move from "Under consideration" to a current-state mention in the Account section.
- `public/privacy.html` sub-processors table already lists Google as Phase-2-planned. Move to active when shipped.

---

## 4. Smoke checklist

- Apple-only user (existing) → still signs in via Apple → session works as before. **Regression check.**
- Brand-new user with valid invite → signs in with Google → creates `users` row + `user_oauth_providers` row → session works.
- Existing Apple user (verified real email, not relay) → signs in with Google using the same email → second `user_oauth_providers` row appears with their existing sub → session is for the original account, history intact. **Link path.**
- Existing Apple user (relay email) → signs in with Google → becomes a second account. **Documented limitation; verify nothing breaks; verify the user sees their NEW empty account, not the old one's data.**
- Bad state cookie / missing id_token / Google email_verified=false → reject with `auth.login.reject` audit event, redirect to `/?auth=error`.
- `GOOGLE_AUTH_ACTIVE=false` (env vars absent) → `/api/auth/google` returns 404.

---

## 5. Out of scope (deferred)

- **Native Google** (`/api/auth/native` for Google). Tied to iOS; iOS is paused.
- **Third provider** (GitHub, Microsoft, anything else). Apple + Google covers ~95% of the relevant audience.
- **Account-merge UI for the Apple-relay edge case.** Users hit support if they realize they've got two accounts. Manual operator merge for now.
- **OAuth-token storage for revocation/refresh.** We only need sign-in identity, not API access; the id_token is verified once and discarded.

---

## 6. Effort estimate

~6-8 hours implementation + 1-2 hours smoke. Single ~8-10h session feasible.

- Migration + db helpers: 1.5h
- Server routes + Google verification: 2.5h
- `signInAs` refactor + audit-provider-tagging: 1h
- Client button + Google brand assets: 1h
- Smoke + privacy/manual updates: 1.5h

---

## 7. Dependencies on Cap'n's hands

1. Google Cloud Console project → OAuth 2.0 Client ID + Secret
2. Authorized redirect URI registered: `https://setforge.io/api/auth/google/callback`
3. Authorized JavaScript origins: `https://setforge.io`
4. OAuth consent screen filled out (app name, support email, privacy policy URL, terms URL — all already public on setforge.io)
5. Env vars added to Hyperlift dashboard + local `.env`

No DNS changes needed for Google OAuth (that's Email Infra's domain — see EMAIL_INFRA_SCOPE.md).
