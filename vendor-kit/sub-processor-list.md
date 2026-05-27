---
title: "Sub-processor List"
subtitle: "SetForge / Competition Aquatics, LLC"
date: "{{TODAY_YMD}}"
---

> **Source of truth**: this document mirrors `https://setforge.io/sub-processors.html`
> for procurement attachment. If the public page and this document disagree, the
> public page controls.

## Active sub-processors

| Vendor | Purpose | Data they see | Region |
|---|---|---|---|
| **Spaceship Hyperlift** | Application hosting + database hosting + DNS | All application data (workouts, accounts, group rosters, audit logs) — Spaceship operates the servers and storage | United States |
| **Apple** (Sign in with Apple) | OAuth authentication (primary sign-in method) | User's email address (or Apple-relay) at sign-in; SetForge stores Apple's opaque `sub` identifier and the email returned | United States |
| **Google** (Sign in with Google) | OAuth authentication (alternative sign-in method) | User's email address at sign-in; SetForge stores Google's opaque `sub` identifier and the email returned | United States |
| **Resend** (resend.com) | Outbound transactional email — account welcome / confirmation, future parent recap digests, breach notifications | Recipient email address + email subject + email body content (which may include user display name and workout context). Hard-bounce notifications come back as webhook events. | United States |
| **Discord** (discord.com) | Community server + private `#feedback-stream` channel that receives webhook posts from the in-app feedback form | **Adult-only feedback text**, display name, and the page the feedback was submitted from. Feedback from minor accounts (under 18) — or accounts where DOB is not on file — bypasses the Discord webhook entirely; minor feedback stays in the in-app admin queue and never leaves SetForge servers. | United States |

## What we don't use (intentional absence)

For symmetry with the sub-processor list:

- **No third-party analytics** (Google Analytics, Mixpanel, Amplitude, etc.) — SetForge does not collect behavioral telemetry beyond audit logs needed for security and compliance.
- **No advertising networks** — SetForge does not run ads and does not embed any ad-network or tracking-pixel sub-processor.
- **No marketing-automation tools** (HubSpot, Marketo, etc.) — SetForge does not run marketing automation against customer data.
- **No CRMs that touch customer data** (Salesforce, etc.) — SetForge maintains its own customer records inside the application.
- **No payment processors visible to users besides Stripe** — Stripe is the only payment sub-processor (added when the billing thin slice ships); cards are tokenized by Stripe.
- **No chat or support widgets** (Intercom, Zendesk, etc.) — support is via `hello@competitionaquatics.com` email.
- **No customer support tooling that ingests customer data** — emails are read by the operator directly in their personal mail client.
- **No A/B testing or feature-flagging services** (LaunchDarkly, etc.) — feature gating is in-app, in-code, with no external service touching usage data.

## Change notification process

When SetForge adds, removes, or materially changes a sub-processor:

1. The public sub-processor list at `https://setforge.io/sub-processors.html` is updated within 7 days.
2. For changes that materially affect user data handling, active users receive an in-app banner notice (and email when outbound email is live).
3. Paid-tier customers receive notice via the contact-of-record on their Services Agreement.
4. Per the Data Processing Addendum §7, customers have 30 days to object to a new sub-processor; an unresolved objection is grounds for customer termination of the Services Agreement.

---

Last updated: `{{TODAY_YMD}}`. Mirror of `https://setforge.io/sub-processors.html`.
