---
title: "Continuity Commitment"
subtitle: "SetForge / Competition Aquatics, LLC"
date: "{{TODAY_YMD}}"
---

> **Note**: this document is the procurement-friendly extract of the
> continuity clause in SetForge's Terms of Service. The legally
> binding version is on `https://setforge.io/terms.html`. If you find
> any conflict between this extract and the ToS, the ToS controls.

## What this commitment is

SetForge is built and operated by a single person. That changes the
shape of the question every procurement reviewer eventually asks:
**what happens to our data — and to the workouts our coaches built —
if SetForge stops operating?**

The continuity commitment answers that question contractually. The
text was added to the ToS *before* any paid pilot signed, so it
binds SetForge to specific actions regardless of business outcome.

## What triggers continuity

The commitment applies if SetForge ceases active operation for any of
the following reasons:

(a) **Voluntary wind-down** by the operator (e.g., career change,
relocation, retirement).
(b) **LLC dissolution** of Competition Aquatics, LLC.
(c) **Permanent incapacitation** of the operator (illness, death,
incapacity).
(d) **Acquisition** where the acquirer does not, in writing, agree to
honor this commitment for the duration of existing customer
agreements. (An acquirer who does agree replaces SetForge as the
counterparty; the commitments continue under their stewardship.)

It does NOT apply to ordinary downtime, scheduled maintenance, or
temporary outages.

## What SetForge commits to do

When a continuity trigger fires, SetForge will:

### 1. 90-day notice

A written notice will go to every paid-tier customer's contact-of-
record at least **90 days** before the service ends. Where feasible,
an in-app banner notice will appear on coach and swimmer accounts.

For voluntary wind-down + LLC dissolution, the notice is the
operator's affirmative act. For incapacitation, a designated successor
(named in Competition Aquatics, LLC's operating agreement) executes the
notice on the operator's behalf.

### 2. Full JSON data export

Every customer account will receive a JSON export covering all data
the account has generated or owns:

- Workouts (saved + history)
- Assignments + attendance records
- Coach notes
- Group + team memberships
- UGC sets (coach-authored options)
- Favorites / disfavorites / per-swimmer constraints
- Managed swimmer profiles (for coaches)
- Schedule + group anchors

The export format is documented in the public migration spec at
`https://setforge.io/migration.html` (added on continuity trigger if
not earlier). Exports include enough structural metadata for a
successor system to ingest cleanly.

### 3. Open-source migration scripts

SetForge will publish, on a best-efforts basis, open-source scripts
to help customers move their data into:

- A self-hosted PostgreSQL instance
- Any successor SaaS that adopts the SetForge data model
- Plain-text + CSV deliverables for offline storage

The scripts will be MIT-licensed.

### 4. Codebase released under MIT License

Within **30 days** of the service-end date, SetForge will release the
full SetForge codebase to a public Git repository under the **MIT
License**. Any third party — including the customer, a customer-
adjacent organization, or a community group — may then host, fork,
modify, or extend the codebase without restriction beyond the MIT
terms.

The MIT release explicitly applies to: the in-app generator, the
backend server, the database schema + migrations, the deployment
configuration, and any documentation in the repository.

Excluded from the MIT release (but documented for any successor):

- Active secrets (database credentials, API keys, OAuth client
  secrets) — these belong to Competition Aquatics, LLC's
  infrastructure accounts and cannot transfer.
- Trademark on the "SetForge" name + logo — the name does not
  transfer with the code.
- Customer Personal Data — handled per the JSON export above and
  deleted from the live infrastructure on the service-end date.

## Why MIT (not AGPL or Apache 2.0)

MIT is the most permissive of the common open-source licenses. The
intent of the commitment is "the product survives the operator
regardless of who picks it up." AGPL would chill adoption because any
third-party host would need to re-open-source modifications, which
adds friction for a community continuation effort. Apache 2.0 is
acceptable but adds patent-grant formality without changing freedom
materially.

The 2026-05-26 decision was MIT. If you have a strong organizational
preference for Apache 2.0, raise it before contract execution —
SetForge will consider per-customer overrides on a case-by-case
basis but does not promise them.

## What this commitment does NOT do

- It does not promise that SetForge will operate indefinitely. The
  operator may legitimately wind down.
- It does not guarantee that a successor will operate the codebase
  under the same terms.
- It does not refund pre-paid fees beyond a pro-rata refund for the
  unused portion of the annual term.

## Pro-rata refund

If continuity triggers mid-term, paid customers receive a pro-rata
refund of pre-paid fees for the portion of the annual term not
served. Refund issued within 60 days of the service-end date.

---

Source of truth: `https://setforge.io/terms.html` section on Continuity.
This extract is for procurement attachment + board review.
