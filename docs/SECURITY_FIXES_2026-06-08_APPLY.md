# Security-audit fixes — apply order (2026-06-08)

Fixes for the 26-finding audit ([SECURITY_AUDIT_2026-06-08.md](SECURITY_AUDIT_2026-06-08.md)).
Two migrations + one gated web deploy + one iOS build.

## 1. Apply migrations to prod (manual, IN ORDER, before the web deploy)

- **`migrations/065_event_rsvp_unique.sql`** — dedupes `event_rsvp`, adds the two
  UNIQUE keys the new `dbSetRsvp` upsert relies on. Safe; idempotent dedupe.
- **`migrations/066_apple_iap_binding.sql`** — adds `users.apple_app_account_token`,
  normalizes/dedupes `apple_original_transaction_id`, adds its UNIQUE key. IAP is
  Sandbox-only, so the dedupe affects only test rows.
  - **NOTE:** prod was found NOT to have migration 043's Apple columns (never
    applied / reverted by a restore — `#1054 Unknown column` on first attempt), so
    066 is now SELF-CONTAINED + idempotent: it provisions the 043 schema
    (`apple_original_transaction_id`, `apple_iap_events`) with `IF NOT EXISTS`
    before the binding. Re-running it is safe.

Both must be applied **before** the dependent server code goes live (the code
references the new column + unique keys).

## 2. Gated web deploy

After 065 + 066 are applied, deploy the working tree (`python3 _deploy.py "..."`).
Server/db/client fixes only — no new top-level files (the one new doc + migrations
are not in the FILES list / not served).

## 3. iOS build (build 14, via TestFlight — already on build-3)

Commits include the **critical `Bootstrap.featureFlags` build-unbreak** plus the
audit iOS fixes (HealthKit unit, AuthManager bootstrap, Keychain accessibility,
StoreKit `appAccountToken`). Re-archive build 14 from `build-3` HEAD.

## What shipped (by severity)

- **Critical** — Apple IAP transaction binding (`appAccountToken` + UNIQUE
  originalTransactionId + cross-user reject); the iOS build-unbreak.
- **Medium** — cross-team coach-grant check, attendance roster guard, impersonation
  privilege re-check, push-endpoint SSRF allowlist, history-cache namespacing,
  claim/join-token preview 410-on-dead + rate limit, Apple idempotency ordering,
  double-pay guard ordering, email stale-`sending` recovery, RSVP UNIQUE + upsert,
  claim/merge attendance+RSVP repoint.
- **Low** — NULL-owner workout IDOR, Stripe `past_due`/default-coach, audit
  pagination NaN clamp, admin-metrics COLLATE, digest week UTC, completed the
  push-suppress retry fix, HealthKit `"yds"` unit, iOS non-401 trust, Keychain class.

Still open (flagged, not fixed): plaintext session ids at rest (bigger change —
invalidates live sessions); `dbListUpcomingPracticesForReminders` N+1 (perf only);
64-bit claim-token entropy (defense-in-depth, column-width constrained).
