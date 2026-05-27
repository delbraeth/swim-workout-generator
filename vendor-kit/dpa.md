---
title: "Data Processing Addendum"
subtitle: "To the Services Agreement between Competition Aquatics, LLC (\"SetForge\") and {{ORG_NAME}} (\"Customer\")"
date: "{{TODAY_YMD}}"
---

> **⚠ SCAFFOLD — needs legal-attentive editing before first send.**
>
> This file outlines SetForge's Data Processing Addendum. Each `TODO`
> marker shows what to import from a public source. Recommended sources:
> - **Vanta's public model DPA** — well-known, board-friendly
> - **Stripe Atlas DPA template** (same provenance as the services
>   agreement)
> Either works. Locked SetForge-specific overrides:
> - **Data residency**: United States only
> - **Breach notification**: 24 hours from confirmation (cross-references
>   the standalone Breach Notification SLA file)
> - **Sub-processor list**: incorporated by reference from
>   `https://setforge.io/sub-processors.html` and the standalone
>   sub-processor list in this kit
> - **No marketing-purpose data use, ever**
> - **No automated decision-making**
> - **Deletion**: cascade-wipe of user data + tombstone-on-audit-tables
>   (audit_events.user_sub → NULL); existing implementation
> - **Data subject rights**: export by request via email today; correction
>   via in-app Profile; deletion via account-delete flow. Self-serve
>   export ships in Phase 4 — DPA accurately reflects current state per
>   scope decision 10a.

---

## 1. Definitions

`TODO`: import standard GDPR-aligned definitions. Map: Customer = data
controller, SetForge = data processor. Define Personal Data, Data
Subject, Processing, Sub-processor.

## 2. Scope + applicability

This DPA applies to SetForge's Processing of Personal Data on behalf of
Customer in connection with the Services. It supplements and is
incorporated into the Services Agreement.

## 3. Categories of Personal Data + Data Subjects

**Data Subjects**:

- Customer's coaches (Authorized Users with coach role)
- Customer's swimmers (Authorized Users with swimmer role)
- Customer's parents/guardians (when associated with a managed swimmer
  profile under 18)
- Managed swimmer profiles (records for swimmers who do not have their
  own authentication, maintained by the coach)

**Categories of Personal Data**:

- Identity: display name, email address, OAuth `sub` (Apple or Google),
  date of birth (used for COPPA/minor gating)
- Contact: parental-contact email (managed swimmer profiles only)
- Activity: generated workouts, saved history, assignments, completion
  states, attendance records, focus notes, coach notes
- Preferences: favorites / disfavorites, per-swimmer constraints,
  settings (pace baseline, equipment availability, lap-button mode, etc.)
- Technical: IP address (captured in audit_events only; not displayed in
  the app), user agent, session tokens

**SetForge does NOT collect**: payment-card data (Stripe handles
payments and tokenizes), government IDs, biometric data, geolocation
beyond country-level inference from IP, health/PHI data (the ToS
disclaims HIPAA scope), or social-security numbers.

## 4. Purposes of Processing

SetForge Processes Customer Personal Data solely to:

(a) Deliver the Service as described in the Services Agreement.
(b) Maintain the security and integrity of the Service (audit logging,
abuse prevention, session management).
(c) Communicate with Customer about the Service (transactional email
via the Resend sub-processor; see §7).
(d) Comply with legal obligations.

SetForge **does NOT** Process Customer Personal Data for:

- Marketing, advertising, or behavioral profiling
- Sale or licensing to third parties
- Training of machine-learning models (workout-generation logic is
  rule-based + template-based; no LLM training on Customer Data)
- Automated decision-making with legal effect on Data Subjects

## 5. Customer obligations

`TODO`: import standard "Customer is data controller and is responsible
for the legal basis of Processing" language. SetForge-specific
additions:

- Customer is responsible for collecting parental consent for swimmers
  under 13 per COPPA before adding them as a Managed Swimmer Profile.
- Customer is responsible for the accuracy of contact-of-record data
  used for breach notifications under §10.

## 6. SetForge obligations

`TODO`: import standard "Process only on documented instructions" +
"confidentiality" + "appropriate technical and organizational measures"
language.

## 7. Sub-processors

SetForge engages the sub-processors listed in the **Sub-processor List**
attached to this kit (and mirrored at
`https://setforge.io/sub-processors.html`). As of the date of this DPA,
the active sub-processors are:

| Vendor | Purpose | Region |
|---|---|---|
| Spaceship Hyperlift | Application + database hosting + DNS | US |
| Apple | OAuth authentication (primary) | US |
| Google | OAuth authentication (alternative) | US |
| Resend | Outbound transactional email | US |
| Discord | Adult-only feedback webhook + community server | US |

**Notification of changes**: SetForge will publish updates to the
public Sub-processor List page within 7 days of adding, removing, or
materially changing a sub-processor. For material changes that affect
user data handling, an in-app banner notice is added to coach and
swimmer accounts. Customer may object to a new sub-processor in writing
within 30 days; an unresolved objection is grounds for Customer
termination of the Services Agreement.

## 8. Data residency

All Customer Personal Data is stored in United States data centers
operated by Spaceship Hyperlift. Sub-processors listed in §7 are
United States entities. SetForge does NOT replicate Personal Data to
non-US regions in v1.

## 9. Data subject rights

`TODO`: import standard GDPR Articles 15–22 rights. Operationalize for
SetForge:

| Right | How Customer / Data Subject exercises it (today) | Self-serve in roadmap |
|---|---|---|
| Access | Email `hello@setforge.io` requesting an export. SetForge replies with a JSON file containing the Data Subject's data within 30 days. | Self-serve export ships in Phase 4 (identity refactor); see `IDENTITY_SCOPE.md` phase I-G |
| Correction | In-app Profile fields cover display name, DOB, gender, paces. Other corrections by email. | In-app coverage already broad in v1 |
| Deletion | In-app account-delete flow cascade-wipes Customer Data + sets `audit_events.user_sub` = NULL for the deleted account (tombstone in audit log; identity-replaced rows in other tables) | Already self-serve |
| Portability | Same as Access — by-request JSON export | Same as Access |
| Objection / Restriction | Email `hello@setforge.io` | Same |

SetForge accurately documents the current state. **Self-serve JSON
export is on the Phase 4 roadmap** and is not promised in this DPA;
boards that require self-serve export today should defer engagement
until that feature ships (estimated ~3–6 months from Effective Date).

## 10. Personal data breach notification

In the event of a Personal Data breach affecting Customer Data,
SetForge will:

(a) Notify Customer's contact-of-record by email within **24 hours**
from the time SetForge confirms the breach.

(b) The notification will include: the nature and scope of the breach,
the categories and approximate number of Data Subjects affected, the
likely consequences, and the measures SetForge has taken or proposes
to take.

(c) SetForge will follow up at 7-day intervals until the incident is
closed.

(d) SetForge maintains an internal incident response runbook; the SLA
is set at 24 hours because SetForge is operated by one person and a
shorter commitment would not be honest.

See the standalone **Breach Notification SLA** in this kit for full
text.

## 11. Audit rights

`TODO`: import standard "reasonable audit rights upon reasonable notice"
language. SetForge-specific limitation: audits are limited to one per
12-month period, conducted during business hours, with at least 30 days'
notice, and scoped to records relevant to this DPA. SetForge does not
offer third-party SOC 2 or ISO 27001 attestation (see Services
Agreement §10 and the cover letter); Customer audits replace those.

## 12. Return + deletion of Data

On termination of the Services Agreement, SetForge will, within 90
days:

(a) On Customer's written request, provide a JSON export of all
Customer Data.

(b) Delete all Customer Personal Data from SetForge's active systems
and backups. Audit-log records have `user_sub` set to NULL but the
event rows are retained for accounting and security audit purposes.

If the Services Agreement terminates pursuant to the Continuity
Commitment (Agreement §11), the export and migration provisions there
control.

## 13. Liability + governing law

This DPA inherits the limitation of liability + governing law clauses
from the Services Agreement.

---

## Signature block

(This DPA is incorporated into the Services Agreement and does not
require a separate signature when the Agreement is signed. If your
counsel prefers separate signature blocks, sign below.)

**Competition Aquatics, LLC** (d/b/a SetForge)

Signature: ____________________________ Date: __________

**{{ORG_NAME}}**

Signature: ____________________________ Date: __________
