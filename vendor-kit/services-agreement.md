---
title: "Services Agreement"
subtitle: "Between Competition Aquatics, LLC (\"SetForge\") and {{ORG_NAME}} (\"Customer\")"
date: "{{TODAY_YMD}}"
---

> **⚠ SCAFFOLD — needs legal-attentive editing before first send.**
>
> This file is a structural outline of the SetForge Services Agreement.
> Each `TODO` marker shows what to import from the public source and what
> SetForge-specific clauses to add. The source recommendation is
> **Stripe Atlas's SaaS Master Services Agreement (MSA-lite)**, publicly
> available at <https://stripe.com/atlas>. Locked decisions:
> - Annual term, $300/yr default Program-tier line
> - Auto-renew unless 60-day written notice from either party
> - Free-tier permanence clause (see §6 below — text is settled)
> - Continuity commitment summary (see §11 — extracted from ToS)
> - 24-hour breach notification (cross-references the DPA)
> - Open-source-on-shutdown under MIT license (see §11.3)
>
> Strip from the Stripe Atlas template: joint-venture / IP-exclusivity
> language, anything referencing investor relations, anything requiring
> insurance certificates Customer doesn't already maintain.
>
> Optional but recommended: $200–500 lawyer pass before the first send.

---

## 1. Parties + effective date

`Competition Aquatics, LLC` (a Wyoming limited liability company, EIN
on file with Customer), operator of the SetForge service at
`https://setforge.io` ("SetForge"), and `{{ORG_NAME}}` ("Customer").
Effective date: `{{TODAY_YMD}}`.

## 2. Definitions

`TODO`: import from Stripe Atlas MSA §1. Define: Service, Customer Data,
Authorized Users, Order Form, Effective Date, Term. Add SetForge-specific
definitions: "Coach Account," "Swimmer Account," "Managed Swimmer Profile,"
"Group," "Team."

## 3. Service description + access

`TODO`: import standard "right to access during the Term" + "subject to
this Agreement" language. Add: Customer may add and remove Authorized
Users (coaches, swimmers, managed profiles) at any time without notice
to SetForge.

## 4. Customer obligations

`TODO`: import standard "comply with applicable law," "no reverse
engineering," "no scraping" language. SetForge-specific additions:

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

`TODO`: import Stripe Atlas's standard "initial term + auto-renew" with
these SetForge-specifics:

- Initial term: 12 months from the Effective Date.
- Auto-renew: yes, for successive 12-month terms unless either party
  delivers written notice of non-renewal at least 60 days before the
  end of the then-current term.
- Termination for cause: either party may terminate on 30 days' written
  notice for the other party's uncured material breach.
- Termination for convenience: Customer may terminate at any time;
  pre-paid fees are non-refundable except as provided in §11
  (Continuity).

## 8. Confidentiality

`TODO`: import Stripe Atlas §X (Confidentiality). Standard mutual
language. SetForge confidential information includes the codebase,
infrastructure architecture, and security-incident details where not
publicly disclosed.

## 9. Data processing + privacy

This Agreement incorporates by reference the **Data Processing Addendum
(DPA)**, attached separately. In case of conflict between this Agreement
and the DPA on a data-processing matter, the DPA controls.

## 10. Warranties + disclaimers

`TODO`: import standard "Service provided AS IS except as expressly
warranted" language. SetForge-specific addition: SetForge does NOT
warrant:

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

`TODO`: import Stripe Atlas mutual-indemnification language. SetForge's
indemnity is capped at fees paid by Customer in the 12 months preceding
the claim, except in cases of willful misconduct.

## 13. Limitation of liability

`TODO`: import standard "no indirect / consequential / lost-profit
damages" + "aggregate liability capped at fees paid in the prior 12
months" language.

## 14. Governing law + dispute resolution

`TODO`: Wyoming law (matches Competition Aquatics, LLC's state of
formation). Pre-litigation: 30-day good-faith negotiation. Then either
party may proceed to litigation in Wyoming state or federal court. No
mandatory arbitration in v1.

## 15. Miscellaneous

`TODO`: import standard severability, entire-agreement, no-waiver,
notices clauses. Notice address for SetForge: `hello@setforge.io`.

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
