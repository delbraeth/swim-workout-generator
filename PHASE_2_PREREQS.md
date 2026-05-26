# Phase 2 Prerequisites — Cap'n hand-work checklist

Three external accounts unblock all Phase 2 implementation (Google OAuth + Email Infra + Discord webhook). Tick boxes as you go. Once all three are live + env vars are in Hyperlift, every Phase 2 code scope is unblocked.

**Suggested order:** Discord (also clears Phase 1 tag) → Google Cloud (instant) → Resend (DNS wait). Kick off Resend in parallel with Google Cloud to compress wall-clock.

---

## 1. Discord server + webhook (~30-45 min)

Also clears the Phase 1 hand-work items 11+12 → unblocks the `phase-1-complete` git tag.

Reference: `DISCORD_SCOPE.md` §3-§4 (server + channels + automod), §6+§9 (webhook payload + 8-step impl).

### Server creation
- [ ] Sign in to discord.com on a personal Discord account
- [ ] Create new server → "Create My Own" → "For a club or community"
- [ ] Server name: **SetForge**
- [ ] Server icon: drop in `/icons/icon-512.png` from the repo
- [ ] Verification level: **Medium** (registered Discord ≥5 min)

### Channels (7 total, per DISCORD_SCOPE §3)
- [ ] `#welcome` — public, read-only for non-mods, pinned: scope + rules
- [ ] `#announcements` — public, read-only, Cap'n + future mods post
- [ ] `#coach-talk` — public, coaches-only role gate
- [ ] `#feature-requests` — public, threaded
- [ ] `#bug-reports` — public, threaded
- [ ] `#general` — public, everyone-can-post
- [ ] `#feedback-stream` — **private**, Cap'n + bot only (webhook target)

### Automod
- [ ] Server Settings → AutoMod → enable "Commonly Flagged Words" preset
- [ ] Add slow mode 30s on `#general` and `#coach-talk`
- [ ] Set DM rule: server-only DMs require ≥1 day membership
- [ ] Verification: phone-required for non-Apple-OAuth members (covers minor-protection signal — Discord's 13+ ToS plus this gate)

### Webhook
- [ ] In `#feedback-stream` → channel Settings → Integrations → Webhooks → New Webhook
- [ ] Name: **SetForge Feedback Bot**
- [ ] Avatar: drop in `/icons/icon-512.png`
- [ ] **Copy the webhook URL** (only shown once). ⚠ **TREAT AS A SECRET.** Paste it ONLY into your terminal / a password manager / the Hyperlift env-vars dashboard. **Never** paste a webhook URL into a chat window, public file, commit message, or screenshot — it's the only credential gating posts to this channel. If you ever paste it somewhere it shouldn't be, immediately delete + regenerate the webhook in Discord.
- [ ] Hyperlift dashboard → Environment Variables → add:
  - `DISCORD_FEEDBACK_WEBHOOK_URL=<paste URL>`
- [ ] Save + redeploy

### Invite link
- [ ] Server Settings → Invites → Create invite that **never expires** + **unlimited uses**
- [ ] Copy the invite URL — drop into `public/about.html` (currently has `https://discord.gg/[TBD]` placeholder)

### Verification
- [ ] All 7 channels exist
- [ ] Automod active
- [ ] Webhook URL in Hyperlift env
- [ ] About page invite link replaces `[TBD]` placeholder
- [ ] Discord webhook handler is not yet wired (that's Phase 2 implementation per `DISCORD_SCOPE.md` §9 step 3+4) — env var sits there waiting

---

## 2. Google Cloud Console OAuth (~30 min)

Reference: `GOOGLE_OAUTH_SCOPE.md` §7 (dependencies list).

### Project setup
- [ ] Sign in to console.cloud.google.com with the Google account that should own SetForge OAuth (your personal Gmail or a dedicated `setforge@gmail.com` if you prefer separation)
- [ ] Create new project: **SetForge**
- [ ] APIs & Services → Enable APIs → enable **Google+ API** (legacy name; what OAuth uses)
  - *Or just skip — modern OAuth doesn't require it; included for completeness*

### OAuth consent screen
- [ ] APIs & Services → OAuth consent screen → External (unless you have Google Workspace)
- [ ] App name: **SetForge**
- [ ] User support email: `hello@setforge.io`
- [ ] App logo: upload `/icons/icon-512.png` (must be exactly 120x120 — may need to resize)
- [ ] Application home page: `https://setforge.io`
- [ ] Application privacy policy: `https://setforge.io/privacy.html`
- [ ] Application terms of service: `https://setforge.io/terms.html`
- [ ] Authorized domains: `setforge.io`
- [ ] Developer contact: `hello@setforge.io`
- [ ] Scopes: add `email` + `profile` + `openid` (the three OpenID Connect scopes — nothing more)
- [ ] Test users: skip (we'll publish straight to External when ready)
- [ ] Submit for verification? **Not required** for the low-volume Apple-OAuth-style sign-in; only needed if you exceed unverified-app warnings

### OAuth Client ID
- [ ] APIs & Services → Credentials → Create Credentials → OAuth client ID
- [ ] Application type: **Web application**
- [ ] Name: **SetForge Production**
- [ ] Authorized JavaScript origins: `https://setforge.io`
- [ ] Authorized redirect URIs: `https://setforge.io/api/auth/google/callback`
- [ ] Click Create
- [ ] **Copy Client ID + Client Secret** (Secret only shown once)

### Hyperlift env vars
- [ ] `GOOGLE_CLIENT_ID=<paste>`
- [ ] `GOOGLE_CLIENT_SECRET=<paste>`
- [ ] `GOOGLE_REDIRECT_URI=https://setforge.io/api/auth/google/callback`
- [ ] Save + redeploy

### Verification
- [ ] Visit `https://accounts.google.com/o/oauth2/v2/auth?client_id=<your-id>&redirect_uri=https://setforge.io/api/auth/google/callback&response_type=code&scope=openid+email+profile`
- [ ] Should show Google's "Choose an account" screen (will 404 on callback since server isn't wired yet — that's expected)

---

## 3. Resend account + setforge.io DNS (~1-2 hours wall-clock, mostly DNS wait)

Reference: `EMAIL_INFRA_SCOPE.md` §7 (dependencies list).

### Resend account
- [ ] Sign up at resend.com
- [ ] Pro plan ($20/mo) — required for apex-domain (`noreply@setforge.io`)
  - *Free tier forces `noreply@mail.setforge.io` which is uglier and lower-trust*
- [ ] Add domain: `setforge.io`

### DNS records (Spaceship → Domains → setforge.io → DNS Records)
Resend's dashboard shows you the exact values. Add each as a new record:

- [ ] **SPF (TXT)** — record name `@`, value from Resend (will look like `v=spf1 include:amazonses.com -all` or similar — use exact value from Resend)
- [ ] **DKIM (CNAME)** — record name `resend._domainkey`, value from Resend
- [ ] **DKIM (CNAME)** — record name `resend2._domainkey`, value from Resend
- [ ] **DKIM (CNAME)** — record name `resend3._domainkey`, value from Resend
- [ ] **DMARC (TXT)** — record name `_dmarc`, value: `v=DMARC1; p=none; rua=mailto:hello@setforge.io`

### Wait for DNS propagation
- [ ] 5-60 minutes typical for Spaceship
- [ ] Verify each record via `dig`:
  ```
  dig +short TXT setforge.io | grep spf1
  dig +short CNAME resend._domainkey.setforge.io
  dig +short CNAME resend2._domainkey.setforge.io
  dig +short CNAME resend3._domainkey.setforge.io
  dig +short TXT _dmarc.setforge.io
  ```

### Verify in Resend
- [ ] Resend dashboard → Domains → setforge.io
- [ ] All 4 Resend records (SPF + 3 DKIM) show ✅
- [ ] Domain status: **Verified**
- [ ] If anything ❌ after 60 min, double-check the record values exactly match (a single extra space breaks it)

### API key
- [ ] Resend dashboard → API Keys → Create API Key
- [ ] Name: **SetForge Production**
- [ ] Permissions: **Sending access** (full Send permission)
- [ ] **Copy the API key** (only shown once)

### Hyperlift env vars
- [ ] `RESEND_API_KEY=<paste>`
- [ ] `EMAIL_FROM=SetForge <noreply@setforge.io>`
- [ ] `EMAIL_REPLY_TO=hello@setforge.io`
- [ ] Save + redeploy

### Test send (from Resend dashboard, before code lands)
- [ ] Resend dashboard → Logs → "Send a test email"
- [ ] To: your personal email
- [ ] Verify arrives in your inbox (not spam!)
- [ ] DMARC after 30 days of clean monitoring → flip to `p=quarantine` (calendar reminder for ~2026-06-25)

---

## 4. After all three are live

Verification before declaring Phase 2 unblocked:

- [ ] Hyperlift environment shows all 7 new env vars set:
  - `DISCORD_FEEDBACK_WEBHOOK_URL`
  - `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` · `GOOGLE_REDIRECT_URI`
  - `RESEND_API_KEY` · `EMAIL_FROM` · `EMAIL_REPLY_TO`
- [ ] Discord invite URL replaces `[TBD]` placeholder in `public/about.html`
- [ ] Resend domain shows verified in dashboard
- [ ] Google OAuth consent screen accessible via direct URL
- [ ] Phase 1 punch list cleared (also need founder bio + screenshot + Lighthouse measure — separate from this checklist)
- [ ] Ready to start Phase 2 implementation: Google OAuth scope (~6-8h) + Email infra scope (~8-10h) + Discord webhook wiring (DISCORD_SCOPE.md §9, ~2h)

---

## 5. Costs

| Item | Monthly | Notes |
|---|---|---|
| Discord | $0 | Free server hosting |
| Google Cloud (OAuth) | $0 | Identity API is free; usage stays under any paid threshold |
| Resend Pro | $20 | 50k emails/mo included; way over our volume need |
| **Total new monthly cost** | **$20** | Discord + Google free; Resend the only paid service |

Hyperlift + Spaceship costs unchanged.

---

## 6. If you hit a snag

- **Discord webhook URL leaked?** Delete it in the channel's Integrations → regenerate → update env var. URL is the only secret; rotation is free.
- **Google OAuth consent screen requires verification?** Only if you exceed unverified-app warnings (~100 users/day). For SetForge's volume, skip verification.
- **Resend DKIM won't verify?** Most common cause: Spaceship auto-appends the domain to CNAME values. Record value should be EXACTLY what Resend shows, no extra `.setforge.io` suffix. Edit + retry.
- **DNS not propagating?** `dig @8.8.8.8 ...` to bypass your ISP's cache. If Google's DNS sees it but yours doesn't, your local DNS is just slow; Resend's verifier will see it.
- **Any other weirdness:** capture screenshots + paste into next conversation. I'll triage.
