---
title: "Data Processing Addendum"
subtitle: "To the Services Agreement between Competition Aquatics, LLC (\"SetForge\") and {{ORG_NAME}} (\"Customer\")"
date: "{{TODAY_YMD}}"
---

> **⚠ DRAFT v1 (2026-06-03) — legal review still required before first send.**
>
> The `TODO` scaffolds have been filled with standard GDPR-aligned DPA clauses
> (modeled on Vanta's public model DPA / Stripe Atlas DPA structure), adapted to
> SetForge's locked overrides. This is NOT a lawyer-reviewed document — pair it
> with the Services Agreement's review pass.
>
> Locked SetForge-specific overrides reflected below:
> - **Data residency**: United States only
> - **Breach notification**: 24 hours from confirmation (cross-references the
>   standalone Breach Notification SLA file)
> - **Sub-processor list**: incorporated by reference from
>   `https://setforge.io/sub-processors.html` and the standalone list in this kit
> - **No marketing-purpose data use, ever**; **no automated decision-making**
> - **Deletion** = tombstone / de-identification (identity replaced with a generic
>   placeholder, PII nulled, account disabled; operational records retained in
>   de-identified form), with a full hard-delete available on request. This
>   reflects the shipped implementation (identity refactor I-G, 2026-06).
> - **Data-subject rights**: **self-serve JSON export is LIVE** (Profile → Account
>   → Export my data); correction via in-app Profile; deletion via the
>   account-delete flow. (Earlier drafts described export as a future roadmap item;
>   it shipped 2026-06 and this DPA now reflects current state.)

---

## 1. Definitions

Capitalized terms not defined here have the meaning given in the Services
Agreement. For this DPA:

- **"Personal Data"** means any information relating to an identified or
  identifiable natural person that SetForge Processes on Customer's behalf under
  the Services Agreement.
- **"Data Subject"** means the individual to whom Personal Data relates.
- **"Processing"** means any operation performed on Personal Data (collection,
  storage, use, disclosure, erasure, etc.).
- **"Sub-processor"** means a third party engaged by SetForge to Process Personal
  Data in connection with the Service.
- **"Data Protection Laws"** means the privacy and data-protection laws applicable
  to the Processing, including (where applicable) the GDPR/UK GDPR, the CCPA/CPRA,
  and U.S. state privacy laws, plus COPPA with respect to children.

For the purposes of Data Protection Laws, **Customer is the data controller**
(or "business") and **SetForge is the data processor** (or "service provider"),
Processing Personal Data only on Customer's behalf as described in this DPA.

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

Customer, as controller, is responsible for establishing and maintaining a
lawful basis for the Processing of Personal Data under the Services Agreement,
for providing any required notices to Data Subjects, and for the accuracy of the
Personal Data it (or its Authorized Users) submits. Customer warrants that its
instructions to SetForge comply with Data Protection Laws. SetForge-specific
additions:

- Customer is responsible for collecting parental consent for swimmers
  under 13 per COPPA before adding them as a Managed Swimmer Profile.
- Customer is responsible for the accuracy of contact-of-record data
  used for breach notifications under §10.

## 6. SetForge obligations

SetForge will:

(a) Process Personal Data only on Customer's documented instructions (this DPA
and the Services Agreement being such instructions), unless required otherwise
by law, in which case SetForge will notify Customer where legally permitted.

(b) Ensure that personnel authorized to Process Personal Data are bound by
confidentiality obligations.

(c) Implement and maintain appropriate technical and organizational measures
designed to protect Personal Data against accidental or unlawful destruction,
loss, alteration, unauthorized disclosure, or access — including encryption in
transit (TLS), access controls and authentication, audit logging, and the
incident-response process referenced in §10. SetForge is a single-operator
service and does not, in v1, hold third-party SOC 2 or ISO 27001 attestation
(see §11 and the cover letter).

(d) Assist Customer, taking into account the nature of the Processing and the
information available to SetForge, in responding to Data Subject requests (§9)
and in meeting Customer's breach-notification and security obligations (§10).

(e) Not engage a new Sub-processor except as provided in §7.

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

Taking into account the nature of the Processing, SetForge provides the
following to help Customer fulfill Data Subject requests under Data Protection
Laws (GDPR Articles 15–22 and equivalents). Several are now self-serve:

| Right | How Customer / Data Subject exercises it | Status |
|---|---|---|
| Access / Portability | **Self-serve**: Profile → Account → **Export my data** downloads a full JSON copy of the account (profile, workouts, schedule, curation, and — for coaches — the managed swimmers and teams they own). Also available by emailing `hello@competitionaquatics.com` (reply within 30 days). | **Live** (shipped 2026-06, identity refactor) |
| Correction | In-app Profile fields cover name, DOB, gender, class year, paces; coach surfaces edit managed-swimmer records. Other corrections by email. | Live |
| Deletion / Erasure | In-app account-delete flow **de-identifies** the account: the person's name is replaced with a generic placeholder (e.g. "Former Coach #N"), other PII fields are nulled, the account is disabled, and active sessions are revoked. De-identified operational records (e.g. a team's attendance history) are retained so other users' records stay intact. A full hard-delete is available on written request to `hello@competitionaquatics.com`. | Live |
| Objection / Restriction | Email `hello@competitionaquatics.com` | Live |

SetForge accurately documents the current state. Where Customer is the
controller, Customer directs how and whether each request is fulfilled; SetForge
acts on Customer's instruction and provides the self-serve and assisted
mechanisms above.

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

On reasonable prior written notice, and no more than once in any 12-month
period (except where required by a supervisory authority or following a
confirmed breach), Customer may audit SetForge's compliance with this DPA.
Audits are conducted during normal business hours, with at least **30 days'**
notice, are scoped to records relevant to this DPA, and are subject to
confidentiality. SetForge will respond to a reasonable security questionnaire in
lieu of, or in advance of, an on-site or live audit. SetForge does not offer
third-party SOC 2 or ISO 27001 attestation in v1 (see Services Agreement §10 and
the cover letter); Customer audit rights under this section replace those
attestations.

## 12. Return + deletion of Data

On termination of the Services Agreement, SetForge will, within 90 days:

(a) On Customer's written request, provide a JSON export of all Customer Data
(or Customer may self-serve the export per §9 before access ceases).

(b) De-identify or delete Customer Personal Data from SetForge's active systems
and backups: identity fields are removed or replaced with generic placeholders
and accounts are disabled, such that remaining records no longer identify a Data
Subject. Audit-log event rows are retained with `user_sub` set to NULL for
accounting and security-audit purposes. On Customer's written request, SetForge
will instead perform a full hard-deletion of Customer records (subject to
legal-retention exceptions).

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
