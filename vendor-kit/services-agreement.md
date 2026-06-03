---
title: "Services Agreement"
subtitle: "Between Competition Aquatics, LLC (\"SetForge\") and {{ORG_NAME}} (\"Customer\")"
date: "{{TODAY_YMD}}"
---

> **⚠ DRAFT v1 (2026-06-03) — legal review still required before first send.**
>
> The `TODO` scaffolds have been filled with standard SaaS-MSA clauses drafted
> from the public **Stripe Atlas SaaS MSA** structure (<https://stripe.com/atlas>),
> adapted to SetForge's locked decisions. This is NOT a lawyer-reviewed document.
> A **$200–500 attorney pass is recommended** before the first send, focusing on
> §12–§14 (indemnity / liability cap / governing law). Settled sections (§6
> free-tier permanence, §11 continuity) are unchanged — do not redline.
>
> Locked decisions reflected below: annual term + $300/yr Program line · auto-renew
> unless 60-day notice · free-tier permanence (§6) · continuity commitment (§11) ·
> 24-hour breach notice (cross-references the DPA) · open-source-on-shutdown under MIT.
> Joint-venture / IP-exclusivity / investor / insurance-certificate language from the
> source template was intentionally omitted.

---

## 1. Parties + effective date

`Competition Aquatics, LLC` (a Wyoming limited liability company, EIN
on file with Customer), operator of the SetForge service at
`https://setforge.io` ("SetForge"), and `{{ORG_NAME}}` ("Customer").
Effective date: `{{TODAY_YMD}}`.

## 2. Definitions

For purposes of this Agreement:

- **"Service"** means the SetForge workout-generation and team-management
  application made available at `https://setforge.io` and its native mobile
  clients, together with related documentation.
- **"Customer Data"** means all data, content, and information submitted to or
  generated within the Service by or on behalf of Customer or its Authorized
  Users, including workouts, schedules, attendance, notes, and roster records.
- **"Authorized User"** means an individual whom Customer permits to use the
  Service under Customer's account — including coaches, swimmers, and
  Managed Swimmer Profiles.
- **"Order Form"** means an ordering document or online subscription selection
  referencing this Agreement and specifying the tier and fees.
- **"Effective Date"** means the date set out above.
- **"Term"** has the meaning given in §7.

SetForge-specific terms:

- **"Coach Account"** — an Authorized User with the coach role, able to manage
  teams, groups, rosters, and assignments.
- **"Swimmer Account"** — an Authorized User with the swimmer role, holding their
  own authentication credentials (free tier; see §6).
- **"Managed Swimmer Profile"** — a swimmer record maintained by a Coach Account
  for a swimmer who does not hold their own credentials.
- **"Group"** — a coach-defined training cohort within a Team.
- **"Team"** — a Customer's top-level organizational unit, owned by a Coach
  Account and containing Groups, rosters, and team-level settings.

## 3. Service description + access

Subject to Customer's compliance with this Agreement and payment of applicable
fees, SetForge grants Customer a non-exclusive, non-transferable right to access
and use the Service during the Term for Customer's internal operations. Customer
may add and remove Authorized Users (coaches, swimmers, and Managed Swimmer
Profiles) at any time without notice to SetForge. SetForge retains all right,
title, and interest in the Service; this Agreement grants no license to the
underlying software except the access right stated here (and except as provided
in §11 on service discontinuation).

## 4. Customer obligations

Customer will use the Service in compliance with applicable law and this
Agreement, and will not (and will not permit any Authorized User to) reverse
engineer, decompile, or attempt to derive the source code of the Service; scrape
or bulk-extract data except via features SetForge provides; resell or
sublicense the Service; or use the Service to build a competing product.
Customer is responsible for the acts and omissions of its Authorized Users.
SetForge-specific additions:

- Customer must collect parental consent for swimmer accounts under 13
  per COPPA. SetForge's account-creation flow surfaces the DOB gate and
  blocks under-13 self-registration; Customer is responsible for
  parental-consent records.
- Customer must not use SetForge to store data the ToS disclaims —
  specifically: PHI (no HIPAA BAA), payment-card data (Stripe handles
  payments), or government IDs.

## 5. Fees + payment

- **Program tier**: $300 per year ($25/month equivalent). One invoice
  per year via Stripe Invoicing.
- **Coach tier**: $10/month, billed monthly via Stripe.
- **Lesson tier** (when launched): $5–7 per swimmer per month. Pricing
  TBD; this clause becomes a placeholder until launch.
- **Swimmer accounts**: free, forever. See §6.
- **Invoices** include Competition Aquatics, LLC's EIN. Payment terms:
  net 30 from invoice date. ACH, wire, or card accepted.

## 6. Free-tier permanence

> The text in this section is settled. Do not redline.

SetForge commits to the following for the life of the service:

(a) The Swimmer tier (workout generation, save/load, history, pace
clock, assignments) will remain available to individual swimmers at
**zero cost** for as long as SetForge operates.

(b) Features that exist on the Swimmer tier at the date of this
Agreement will not be moved to a paid tier without 90 days' written
notice and a permanent free-tier alternative path.

(c) If SetForge's business model changes such that the free Swimmer tier
becomes economically unsustainable, SetForge will trigger the
Continuity Commitment in §11 rather than retroactively paywall existing
swimmer accounts.

## 7. Term + termination

- **Initial term**: 12 months from the Effective Date.
- **Auto-renewal**: this Agreement renews for successive 12-month terms unless
  either party delivers written notice of non-renewal at least 60 days before
  the end of the then-current term.
- **Termination for cause**: either party may terminate on 30 days' written
  notice of the other party's material breach, if the breach remains uncured at
  the end of that period.
- **Termination for convenience**: Customer may terminate at any time on written
  notice; pre-paid fees are non-refundable except as expressly provided in §11
  (Continuity).
- **Effect of termination**: Customer's access rights cease at the effective date
  of termination; the data-return and deletion provisions of the DPA (§9) apply.

## 8. Confidentiality

Each party (the "Receiving Party") will protect the other party's Confidential
Information using at least the same degree of care it uses for its own
confidential information of like kind (and no less than reasonable care), and
will use it only to perform under this Agreement. "Confidential Information"
means non-public information disclosed by a party that is marked confidential or
that a reasonable person would understand to be confidential. SetForge's
Confidential Information includes the codebase, infrastructure architecture, and
non-public security-incident details. Confidential Information excludes
information that is or becomes public through no fault of the Receiving Party, is
independently developed, or is rightfully received from a third party. The
Receiving Party may disclose Confidential Information if legally compelled,
provided it gives reasonable advance notice where lawful. Customer Data is
Customer's Confidential Information and is governed additionally by the DPA.

## 9. Data processing + privacy

This Agreement incorporates by reference the **Data Processing Addendum
(DPA)**, attached separately. In case of conflict between this Agreement
and the DPA on a data-processing matter, the DPA controls.

## 10. Warranties + disclaimers

Each party warrants that it has the authority to enter into this Agreement.
SetForge warrants that it will provide the Service with commercially reasonable
skill and care. **EXCEPT AS EXPRESSLY STATED IN THIS AGREEMENT, THE SERVICE IS
PROVIDED "AS IS" AND "AS AVAILABLE," AND SETFORGE DISCLAIMS ALL OTHER WARRANTIES,
EXPRESS OR IMPLIED, INCLUDING THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.** For the avoidance of doubt,
SetForge does NOT warrant:

- Uninterrupted availability beyond commercially reasonable efforts
  (no published uptime SLA in v1).
- Compatibility with any specific third-party integration not listed in
  the Sub-processor List.
- Compliance with regimes not specifically named in this Agreement —
  notably no HIPAA, no PCI-DSS (Stripe handles cards), no FERPA-specific
  attestation.

## 11. Continuity Commitment

> The text in this section is settled. Do not redline. Source of truth
> is the ToS continuity clause at `https://setforge.io/terms.html`.

If SetForge ceases active operation — whether due to voluntary wind-down,
LLC dissolution, the founder's permanent incapacitation, or an acquisition
where the buyer does not honor these commitments — the following apply:

(a) **Notice**: SetForge will provide at least 90 days' written notice
to all paid-tier Customers before discontinuing the service. Notice goes
to the contact-of-record email on file plus, where possible, an in-app
banner.

(b) **Data export**: every Customer Account will receive a full JSON
export of their data (workouts, assignments, attendance, coach notes,
group memberships, UGC, favorites/disfavorites) before the service
ends. Export format is documented in the public migration spec.

(c) **Migration scripts**: SetForge will publish open-source scripts to
help Customers move their data into self-hosted PostgreSQL or a
successor service, on a best-efforts basis.

(d) **Open-source release**: the SetForge codebase will be released
under the **MIT License** within 30 days of the service-end date. Any
third party (including Customer or a Customer-adjacent organization)
may then host, fork, or extend the codebase without restriction beyond
the MIT terms.

These commitments survive termination of this Agreement and apply
regardless of the reason for service discontinuation.

## 12. Indemnification

Each party (the "Indemnifying Party") will defend the other party against any
third-party claim to the extent it arises from the Indemnifying Party's breach
of this Agreement or violation of applicable law, and will indemnify the other
party for damages and reasonable attorneys' fees finally awarded (or paid in
settlement the Indemnifying Party approves) on such a claim. SetForge will
additionally defend Customer against a third-party claim that the Service, as
provided, infringes that third party's intellectual-property rights. The
indemnified party must promptly notify the Indemnifying Party, give it control
of the defense, and reasonably cooperate. SetForge's indemnification obligations
are capped at the fees paid by Customer in the 12 months preceding the claim,
except in cases of SetForge's willful misconduct.

## 13. Limitation of liability

**EXCEPT FOR (i) A PARTY'S INDEMNIFICATION OBLIGATIONS UNDER §12, (ii) CUSTOMER'S
PAYMENT OBLIGATIONS, OR (iii) A PARTY'S WILLFUL MISCONDUCT, NEITHER PARTY WILL BE
LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
OR FOR LOST PROFITS, REVENUE, OR DATA, EVEN IF ADVISED OF THE POSSIBILITY. EACH
PARTY'S TOTAL AGGREGATE LIABILITY ARISING OUT OF OR RELATED TO THIS AGREEMENT
WILL NOT EXCEED THE FEES PAID OR PAYABLE BY CUSTOMER TO SETFORGE IN THE 12 MONTHS
PRECEDING THE EVENT GIVING RISE TO THE LIABILITY.** Nothing in this section
limits liability that cannot be limited under applicable law.

## 14. Governing law + dispute resolution

This Agreement is governed by the laws of the **State of Wyoming** (the state of
Competition Aquatics, LLC's formation), without regard to its conflict-of-laws
rules. Before initiating litigation, the parties will attempt in good faith to
resolve any dispute through negotiation between authorized representatives for
**30 days** after written notice of the dispute. If unresolved, either party may
bring an action in the state or federal courts located in Wyoming, and each party
consents to the personal jurisdiction of those courts. There is no mandatory
arbitration in v1.

## 15. Miscellaneous

- **Entire agreement**: this Agreement, together with the DPA and any Order Form,
  is the entire agreement between the parties on its subject matter and supersedes
  prior or contemporaneous understandings.
- **Severability**: if any provision is held unenforceable, the remaining
  provisions remain in effect and the unenforceable provision is reformed to the
  minimum extent necessary.
- **No waiver**: a party's failure to enforce a provision is not a waiver of its
  right to do so later.
- **Assignment**: neither party may assign this Agreement without the other's
  consent, except to a successor in connection with a merger or sale of
  substantially all assets (subject to the continuity commitments in §11).
- **Independent contractors**: the parties are independent contractors; this
  Agreement creates no partnership, joint venture, or agency.
- **Notices**: notices to SetForge go to `hello@competitionaquatics.com`; notices
  to Customer go to the contact-of-record email on file. Email notice is
  sufficient for all notices under this Agreement.

---

## Signature block

**Competition Aquatics, LLC** (d/b/a SetForge)

Signature: ____________________________ Date: __________

Printed name: ______________________________________

Title: ______________________________________________

**{{ORG_NAME}}**

Signature: ____________________________ Date: __________

Printed name: ______________________________________

Title: ______________________________________________
