# Email Infrastructure — scope

**Status:** scope-only (2026-05-26). Implementation gated on Cap'n creating a Resend account, verifying the setforge.io domain in Resend, and adding three DNS records (SPF + DKIM + DMARC) at Spaceship. No code until those exist.

**Phase:** PHASED_PLAN §3 Phase 2 — "Android sign-up + email rails." Second of three Phase 2 deliverables. Provides the rails that everything downstream depends on (Phase 3 billing receipts, Phase 4 parent portal, Lesson tier recaps, Discord webhook fallback notifications, breach-notification SLA for board-grade buyers).

---

## 1. Why

SetForge has no outbound email capability today. Every flow that *should* email — account confirmation, password recovery (N/A; OAuth), notification of admin action on feedback, parent recap, billing receipt, breach notification SLA — currently can't.

Phase 1 punted by routing every contact through `mailto:hello@setforge.io`. That works as long as the operator (Cap'n) is the only sender. Phase 2 unlocks: SetForge initiating an email to a user, not just receiving one from them.

Per [[feedback-no-password-auth]]: no magic-link emails. Auth stays OAuth. This rail is for transactional notifications only, plus the eventual one-off broadcasts (continuity 90-day notice; major changes).

---

## 2. Locked decisions (2026-05-26)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Provider: Resend** | Modern API, react-email template ecosystem, $20/mo for 50k emails (way over our volume need), webhook for delivery/bounce events. Apple-relay emails route fine. Pricing transparent; no per-org sales call. |
| 2 | **From-address: `noreply@setforge.io`** | Standard transactional convention. **Reply-to set to `hello@setforge.io`** so replies still reach Cap'n. Apple-relay users get their relay back-translated to their real address on reply (Apple's relay handles that side). |
| 3 | **First user-facing template: combined Welcome + Email Confirmation** | One email after sign-up: "Welcome — your account is set up · here's the manual · here's free vs paid (Free for swimmers forever) · here's how to send feedback · this is also confirming your email is good." Doesn't gate any functionality; a "confirm to use" flow would friction sign-up. Pure courtesy + first-touch trust. |
| 4 | **Provider library: `resend` npm package** | Official. Type-safe. Maintained. ~20kb. Don't hand-roll the HTTP. |
| 5 | **DNS at Spaceship (Cap'n's hands)** | SPF (TXT), DKIM (3 CNAME records Resend provides), DMARC (TXT, `p=none` v1 → `p=quarantine` v2 after 30 days of clean SPF/DKIM). Per [[user-profile]] Cap'n controls Spaceship DNS. |
| 6 | **Queue: `email_outbox` DB table** | Don't trust the provider's queue alone. Insert into our `email_outbox` first; a background worker processes the row and updates status from `pending` → `sent` (or `failed` + retry). Survives provider outages. Audit log writes follow the queue write, not the provider response. |
| 7 | **Worker: in-process setInterval poller** | No Redis/BullMQ. Polls `email_outbox` every 30 seconds, claims rows via `UPDATE ... SET status='sending' WHERE status='pending' LIMIT 10`. Solo-operator scale; this is fine for <1k emails/day. Switch when we hit it (we won't). |
| 8 | **Idempotency key per send** | Every queue insert requires a `dedup_key` (e.g. `welcome:${userSub}` or `feedback_ack:${feedbackId}`). UNIQUE constraint. Lets handler code be naive ("send this; if it's a dup it no-ops") instead of having to check first. |
| 9 | **`/api/email/send` is internal only — no HTTP route** | Routes that need to trigger email call `enqueueEmail(...)` directly. No "send email" REST endpoint to abuse. |
| 10 | **No unsubscribe link on transactional** | Transactional emails (welcome, billing receipt, security notification) don't need unsubscribe per CAN-SPAM. **Any future marketing email gets its own table + List-Unsubscribe header + opt-in default-off.** Documented upfront so nobody adds an OnboardingCampaign drip without flipping the bit. |
| 11 | **Audit-log every queue write + every provider response** | Two audit event types: `email.enqueue` (writes to DB queue) and `email.send.result` (provider returned success or failure). Failures retry up to 3× with exponential backoff (1m, 5m, 30m); after that, status → `failed` + admin notification in feedback queue. |
| 12 | **Hard-stop on minors** | The minor-bypass posture from DISCORD_SCOPE.md §6 extends here: **never email an account where `users.dob` indicates under-18 OR `users.dob IS NULL`** (default to bypass when DOB unknown — safer side). `enqueueEmail` short-circuits before the queue write. The welcome email checks this; minors just don't get the welcome (they see in-app welcome instead, scope TBD). |

---

## 3. Open Cap'n forks

1. **Resend pricing tier choice.** Free tier is 3k emails/mo + setforge.io subdomain only. Pro is $20/mo + apex domain support. Apex is needed for `noreply@setforge.io` (not `noreply@mail.setforge.io`). Pro is the assumed pick; confirm.
2. **DMARC rollout policy.** v1 ships `p=none` (monitor only). After 30 days of clean reports → flip to `p=quarantine` (suspicious goes to spam). Flip to `p=reject` is Phase 3+ posture. OK with this rollout?
3. **Minor welcome email — do they get an in-app welcome instead, or nothing?** If "in-app welcome modal," scope it in a v1.1 followup or fold into Phase 4 parent-portal. If "nothing," that's a degraded experience for swimmers who claim a managed account at 13+.
4. **Cap'n on the bounce list.** Resend will notify on hard bounces. Should those become admin feedback rows, Discord alerts, or just dashboard? `email.send.result` audit log captures it regardless; the question is what else.

---

## 4. Implementation (deferred until Resend account + DNS exist)

### 4.1 New env vars

- `RESEND_API_KEY` — from Resend dashboard
- `EMAIL_FROM` — `"SetForge <noreply@setforge.io>"`
- `EMAIL_REPLY_TO` — `"hello@setforge.io"`
- Computed flag: `EMAIL_ACTIVE = !!RESEND_API_KEY`. When false, `enqueueEmail` no-ops with a warn log (lets dev/test envs run without sending real email).

### 4.2 DNS records (Cap'n at Spaceship)

| Record | Type | Value (from Resend dashboard) |
|---|---|---|
| `setforge.io` | TXT | `v=spf1 include:amazonses.com -all` (Resend uses SES under the hood; exact value from their dashboard) |
| `resend._domainkey.setforge.io` | CNAME | `<resend-provided>` |
| `resend2._domainkey.setforge.io` | CNAME | `<resend-provided>` |
| `resend3._domainkey.setforge.io` | CNAME | `<resend-provided>` |
| `_dmarc.setforge.io` | TXT | `v=DMARC1; p=none; rua=mailto:hello@setforge.io` |

Verify in Resend dashboard before sending the first email.

### 4.3 New migration (034)

```sql
CREATE TABLE `email_outbox` (
  `id`               BIGINT AUTO_INCREMENT PRIMARY KEY,
  `dedup_key`        VARCHAR(255) NOT NULL UNIQUE,
  `to_email`         VARCHAR(255) NOT NULL,
  `to_user_sub`      VARCHAR(255) NULL,
  `template_id`      VARCHAR(64) NOT NULL,
  `subject`          VARCHAR(255) NOT NULL,
  `html_body`        MEDIUMTEXT NOT NULL,
  `text_body`        MEDIUMTEXT NOT NULL,
  `status`           ENUM('pending','sending','sent','failed','bypassed_minor') NOT NULL DEFAULT 'pending',
  `attempts`         INT NOT NULL DEFAULT 0,
  `last_error`       TEXT NULL,
  `provider_msg_id`  VARCHAR(255) NULL,
  `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sent_at`          DATETIME NULL,
  `next_retry_at`    DATETIME NULL,
  INDEX `idx_status_retry` (`status`, `next_retry_at`)
) ENGINE=InnoDB;
```

### 4.4 New module: `lib/email.js`

Exports:

- `enqueueEmail({ dedupKey, toEmail, toUserSub, templateId, ...templateVars })` — minor-bypass check first, then render template, then INSERT into `email_outbox`. Returns row id or `{ bypassed: 'minor' }`.
- `startEmailWorker()` — called once at server boot. Sets up `setInterval(processQueue, 30_000)`. Idempotent.
- `processQueue()` — claims up to 10 pending rows, sends via Resend, updates row status.
- `renderTemplate(templateId, vars)` — returns `{ subject, html, text }`. Templates live in `lib/email-templates/`.

### 4.5 First template: `welcome.js`

```js
// lib/email-templates/welcome.js
export default ({ displayName, manualUrl }) => ({
  subject: "Welcome to SetForge",
  text: `Hi${displayName ? ' ' + displayName : ''} —

Welcome to SetForge. Your account is set up.

A few quick things:

· You're on the free tier, which stays free forever for swimmers (it's written into our Terms).
· The manual is the fastest way to learn what SetForge can do: ${manualUrl}
· One person answers the email here. Reply to this message or write to hello@setforge.io anytime.

— Cap'n

(SetForge · setforge.io · Competition Aquatics, LLC)`,
  html: `<!-- minimal HTML version mirroring the text. No tracking pixels. -->`,
});
```

Plain text + matching minimal HTML. No tracking pixels (security.html promises no email tracking). No images hosted off-domain. ~600 bytes total.

### 4.6 Server wiring

In the Apple OAuth callback (and Google's, once Phase 2.1 ships), after `dbAuditEvent('auth.signup')`:

```js
enqueueEmail({
  dedupKey: `welcome:${sub}`,
  toUserSub: sub,
  toEmail: payload.email,
  templateId: 'welcome',
  displayName: null,            // not collected at sign-up
  manualUrl: 'https://setforge.io/manual.html',
}).catch(err => console.warn('[email] welcome enqueue failed:', err.message));
```

Fire-and-forget. Welcome never blocks sign-up.

### 4.7 Boot: start the worker

In `server.js` near the end, after the listen call:

```js
import { startEmailWorker } from './lib/email.js';
if (EMAIL_ACTIVE) startEmailWorker();
```

---

## 5. Smoke checklist

- `EMAIL_ACTIVE=false` (no `RESEND_API_KEY`) → all enqueue calls no-op with warn log. App still works.
- DNS verified in Resend dashboard. Test send from Resend's dashboard arrives in a real inbox.
- Brand-new sign-up (adult, real email) → `email_outbox` row inserted → worker picks it up within 30s → status flips to `sent` → email arrives.
- Brand-new sign-up (minor, DOB <18) → `email_outbox` row with status `bypassed_minor` (not actually sent). Audit log shows `email.enqueue` with `bypassed: 'minor'` detail.
- Brand-new sign-up (DOB null) → same as minor case (safe-side default).
- Duplicate enqueue (same `dedup_key`) → INSERT IGNORE or ON DUPLICATE KEY UPDATE → no double-send. Verify.
- Provider failure (test with a bad API key for one send) → status `failed` after 3 retries with exponential backoff. Last error logged.

---

## 6. Out of scope (deferred)

- **Marketing email infrastructure** — separate table, opt-in default-off, List-Unsubscribe header. Phase 3+ if ever.
- **Email open/click tracking** — actively declined per security.html promise. Don't add even if Resend's dashboard suggests it.
- **HTML template builder UI** — templates stay as `.js` files in `lib/email-templates/`. Code review is the moderation.
- **Per-user email preferences page** — solo operator doesn't need it yet. Bypass-by-DOB covers the only legal requirement.
- **Bulk send / digest emails** — out of scope. Daily recaps, weekly digests, etc. are Phase 4+ if ever.

---

## 7. Effort estimate

~8-10 hours implementation + 1-2 hours smoke + ~1 hour DNS waiting + verification.

- Migration + lib/email.js scaffold: 2.5h
- Worker + retry logic: 2h
- First template (welcome) + render plumbing: 1.5h
- OAuth callback wiring (Apple + Google): 1h
- Audit events + minor-bypass: 1h
- Privacy/manual updates: 1h
- Smoke + DNS verification: 1-2h

Single 10-12h session feasible.

---

## 8. Dependencies on Cap'n's hands

1. Create Resend account at resend.com. Pro tier ($20/mo) for apex-domain support.
2. Add `setforge.io` as a domain in Resend dashboard.
3. Copy the 3 DKIM CNAME records + the SPF record into Spaceship DNS.
4. Add `_dmarc.setforge.io` TXT record (DMARC monitoring policy).
5. Wait for DNS propagation (5-60 min typical).
6. Verify domain in Resend dashboard — must show ✅ for all four records.
7. Generate API key in Resend dashboard.
8. Add `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` to Hyperlift dashboard + local `.env`.

Until step 6 verifies clean, deferred. After: code can start.

---

## 9. Related

- [[feedback-no-password-auth]] — OAuth-only stance; no magic-link emails
- [[swim-generator-discord-scope]] — minor-bypass pattern; same shape used here
- [[swim-generator-relationships-scope]] — DOB/`is_minor` derivation lives in this scope
- `GOOGLE_OAUTH_SCOPE.md` — Phase 2 deliverable 1 of 3; this is deliverable 2
- DISCORD_SCOPE.md §6 + §9 — Phase 2 deliverable 3 of 3 (already fully scoped; not re-written)
