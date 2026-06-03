# Vendor Paper Kit — scope

**Status:** scope-only (2026-05-26). Implementation lives in PHASED_PLAN §3 Phase 3 — "First paying HS coach can sign, pay, and stick." Mostly **non-engineering**: ~80% of the work is adapting standard legal templates and writing Cap'n-readable assembly instructions. The one engineering task is Stripe Invoicing setup.

**Triple-cross-validated:** Treasurer + Head Coach + Lifecycle personas across the team eval all surface this as the "same-day approval lever" — the deliverable that converts a board's "we'd consider it" into "we approved the spend." Without it, every 501(c)(3) club + school program review stalls regardless of product quality.

**Pattern source:** none. New surface.

---

## 1. Why

The team eval surfaced a uniform pattern: a 501(c)(3) treasurer asked to evaluate a new SaaS vendor checks for these artifacts before any conversation about product merit:

1. **Counter-signed services agreement** — establishes the contract
2. **Data Processing Addendum (DPA)** — legal cover for personal data
3. **W-9 form** — required for any vendor payment from a US 501(c)(3)
4. **EIN-bearing invoice** — for the accounting line item
5. **Sub-processor list** — who else touches the data
6. **Breach-notification SLA** — what happens if data is exposed
7. **Continuity commitment** — what happens if the vendor disappears

Today, SetForge has (6) and parts of (7) live on public pages. The other five items are conceptual but not delivered as documents anyone can sign or attach to an accounting record.

Without this kit, the Program tier ($25/mo or $300/yr) is unsellable to any organization with a treasurer who follows process. The kit doesn't need to be elaborate; it needs to **exist** and **arrive as a single email attachment** when a treasurer asks.

---

## 2. Locked decisions (2026-05-26)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **DPA: adapt a public template** | Use Stripe Atlas's open-source SaaS DPA template (or equivalent: Vanta, GitHub-published model DPA) as the starting point. Redline for SetForge specifics: actual sub-processor list, 24-hour breach notification, US-only data residency, no behavioral analytics. Lawyer review optional but not blocking; standard templates clear most board reviews on their face. |
| 2 | **Services agreement: adapt Stripe Atlas SaaS MSA-lite** | Same logic. Add the free-tier permanence clause + continuity commitment (both already in our ToS at §X-Y). Annual contract default; auto-renew language for the $300/yr Program tier. |
| 3 | **EIN-bearing invoice: Stripe Invoicing** | Supports EIN on every invoice, ACH/wire/card payment, recurring + one-time. Bundles cleanly with the billing thin slice (separate scope). Patreon doesn't support EIN-on-invoice and is unsuitable for board procurement. QuickBooks Online is heavier than needed for a solo operator. |
| 4 | **Open-source-on-shutdown license: MIT** | Most permissive; matches continuity commitment intent ("the product survives the operator regardless of who picks it up"). Industry-standard for SaaS-codebase release. AGPL would chill adoption (any third-party host would need to re-open-source); Apache 2.0 is fine but adds formality without changing freedom. |
| 5 | **Kit lives in `vendor-kit/` directory in the repo** | Templates as Markdown files in version control. PDFs generated at delivery time (or pre-built). Treasurer receives the bundle by email from `hello@setforge.io`, not a self-serve download link in v1 — reduces operator burden (one-touch attach + send) and creates a record of who asked. |
| 6 | **Delivery: email attachment, not web download** | A treasurer who wants the kit emails Cap'n. Cap'n attaches the bundle. v1 is manual; v2 (if volume justifies) becomes a request form. Sub-processor list + continuity commitment stay on public pages too; only the signable PDFs require the email touch. |
| 7 | **Breach-notification SLA: 24 hours** | From confirmed breach to written notice to affected customers + Cap'n's contact-of-record. Solo operator with no on-call rotation realistically cannot commit to 4-hour or 1-hour SLAs. 24 hours is honest + above the "board-grade" floor most templates use. |
| 8 | **Continuity commitment lives in three places: ToS (legal), pricing page (marketing), kit standalone PDF (procurement)** | Same text in three contexts. ToS is the legally binding source; the standalone PDF in the kit is a procurement-friendly extract. Pricing page is the public-facing summary. |
| 9 | **W-9 stored as a static PDF in the kit** | Cap'n fills it once with Competition Aquatics, LLC info + EIN + signature. Re-issue only when the LLC details change. Not generated on demand. |
| 10 | **No formal "annual security review" commitment** | Some board templates ask for an annual SOC 2 / annual pen-test attestation. SetForge does not have either and won't; this is consistent with the "What we don't have" honest-list on /security. Document the absence in the kit's cover letter; don't promise what we won't deliver. |
| 10a | **DPA data-rights language stays narrow to current state** | DPA documents what exists today: access (export **by request via email**, not self-serve), correction (in-app Profile fields), deletion (cascade-wipe of user data + audit-log sub-NULL tombstone). Does NOT promise self-serve export — that ships in Phase 4 alongside identity refactor per `IDENTITY_SCOPE.md` phase I-G. Cross-phase decision 2026-05-26: not pulling export forward; accepting that some Program-tier boards will defer until self-serve ships. See §5. |
| 11 | **Cover letter accompanies every kit send** | A short Markdown → PDF letter Cap'n sends with the bundle. Mentions: free-tier permanence, what's in the kit, what isn't (no SOC 2 etc.), continuity commitment summary, "I'm the one who answers the email" line. Sets expectations honestly upfront. |
| 12 | **Audit log when a kit is sent** | New audit event `vendor_kit.sent` with `{ recipient_email, organization_name }` in details. Sent manually by Cap'n via a one-click admin action (see §3.5). Helps track adoption + answer "who has the kit?" questions later. |

---

## 3. Implementation

### 3.1 Repo structure

```
vendor-kit/
├── README.md                       — assembly + send instructions for Cap'n
├── cover-letter.md                 — Markdown template; rendered per-recipient with org name
├── services-agreement.md           — adapted Stripe Atlas SaaS MSA-lite
├── dpa.md                          — adapted public-template DPA
├── breach-notification-sla.md      — standalone 1-pager
├── continuity-commitment.md        — extracted from ToS §X-Y for procurement
├── sub-processor-list.md           — mirrors public /sub-processors page
├── w-9.pdf                         — Cap'n-filled static PDF
└── build.sh                        — renders all .md → .pdf via pandoc (one command)
```

`build.sh` is the simplest engineering: a shell script that calls pandoc with the SetForge brand-friendly LaTeX template to produce uniformly-styled PDFs. Run once per template change; outputs go to `vendor-kit/build/`. Don't commit the PDFs (keep build artifacts out of git per existing repo convention).

### 3.2 Templates (Cap'n's work — legal-attentive editing, ~3-4h)

For each .md template, fork from the public source, adapt to SetForge:

- **services-agreement.md** — Stripe Atlas SaaS MSA. Strip joint-venture / IP-exclusivity language not relevant to solo-operator SaaS. Add the free-tier permanence clause + continuity commitment summary. Annual term, $300/yr default Program-tier line, auto-renew unless 60-day notice.

- **dpa.md** — public DPA template (Vanta's is well-known and clear). Override: data residency US-only, sub-processor list in the kit (don't restate; reference), 24-hour breach notification, no marketing-purpose data use ever, deletion-on-account-deletion with tombstone-on-audit-tables, no automated decision-making.

- **breach-notification-sla.md** — one page. Trigger ("a confirmed breach affecting customer data"), notification target (the customer's contact-of-record), method (email + the kit's contact list), timeline (24 hours from confirmation), content of notification (what data, when, what we've done, what they should do), follow-up cadence.

- **continuity-commitment.md** — extract from current ToS (already drafted in `BILLING_THRESHOLD_CHANGES.md`). Four bullets: 90-day notice + JSON export + migration scripts + open-source-on-shutdown (MIT). Add the "what triggers this" list (Cap'n permanently incapacitated; voluntary wind-down; LLC dissolution; acquisition where buyer doesn't honor the commitments → 90-day notice + transfer).

- **sub-processor-list.md** — mirror of public /sub-processors page, formatted for procurement attachment. Auto-regenerate from a script in v2; manual mirror in v1.

- **cover-letter.md** — Markdown with placeholders for `{{ORG_NAME}}` and `{{TREASURER_NAME}}` + date stamp. Sent unsigned (it's a letter, not a contract).

### 3.3 W-9

Cap'n fills the IRS W-9 form once (LLC name, EIN, address, signature) → exports as `vendor-kit/w-9.pdf` → commits. Re-do only when LLC details change. Single static file.

### 3.4 Stripe Invoicing setup (engineering, ~1-2h)

- Create Stripe Invoicing product: "SetForge Program Tier" with one-time $300 / annual + recurring $300/yr SKUs
- EIN added to Stripe account settings (Competition Aquatics, LLC's EIN)
- Template: SetForge wordmark, payment terms net-30, footer with hello@setforge.io
- Test invoice issued to a test address; verify EIN renders + ACH + card payment paths work
- Webhook handler is part of the billing thin slice (separate scope); v1 of vendor paper kit doesn't need it — invoices are manually issued by Cap'n via Stripe dashboard

### 3.5 Admin "Send vendor kit" one-click action (small engineering, ~0.5h)

In AdminView, new section "Vendor kit" with:
- Input: recipient email + organization name
- "Send kit" button → POST `/api/admin/vendor-kit/send` → renders cover letter with placeholders → sends email via Resend (Phase 2 infra) with all kit PDFs attached → audit-logs `vendor_kit.sent`

If Phase 2 email infra isn't live yet, the button instead renders the cover letter + opens a `mailto:` with the recipient pre-filled + lists the files Cap'n should attach manually. Either way, audit logs the send.

### 3.6 Public-page updates

- `/pricing` — Program-tier card already mentions vendor paper kit. Update to: "Sent on request to your treasurer or board — email hello@setforge.io with your organization name."
- `/security` — add "Vendor paper kit" to the buyer-facing list. Cross-reference.
- `/about` (when founder bio is filled) — mention "I send the vendor kit personally when asked" as the consistent solo-operator voice.

---

## 4. Smoke checklist

- All .md templates compile to PDF via `build.sh` without pandoc errors.
- PDF styling looks professional: SetForge wordmark on top, page numbers, consistent typography (no LaTeX defaults that read as amateur).
- Cover letter renders with `{{ORG_NAME}}` and `{{TREASURER_NAME}}` substituted.
- Sub-processor list in the kit matches the public /sub-processors page (visual diff check).
- W-9 PDF opens and contains correct LLC info + EIN + signature.
- Continuity commitment PDF includes all four commitments + trigger conditions + the MIT-license-on-shutdown specification.
- Stripe test invoice issued to a test email: shows EIN, shows $300/yr line, ACH + card payment paths both work.
- AdminView "Send vendor kit" action: sends test email to a personal address with all 7 attachments + correct cover letter.
- Audit log: `vendor_kit.sent` event appears with recipient + organization name.

---

## 5. Out of scope (deferred to v1.1 or later)

- **Self-serve JSON data export.** Bundled with the identity refactor at Phase 4 (`IDENTITY_SCOPE.md` phase I-G). The vendor kit's DPA accurately states data export is available **by request** today, which is the current implementation per `security.html`. Boards that demand self-serve export will need to wait for Phase 4 or accept the by-request flow. Decision 2026-05-26: not pulling export forward — the schema redesign cost is real (export needs to include persons + guardians rows once they exist), and "by request" satisfies most Coach-tier boards. Program-tier boards may push back; that's an accepted trade.
- **Self-serve download portal for the kit.** Treasurer can't get the kit without emailing first. v2 if volume justifies.
- **Per-org customization of templates.** Same template for every recipient in v1. v2 could insert custom clauses for specific boards.
- **Electronic signature integration** (DocuSign, HelloSign, etc.). v1 = treasurer signs PDF and emails back. DocuSign adds another vendor + sub-processor list entry.
- **SOC 2 attestation.** Decision 10 — won't ever offer; honest about the absence in the cover letter.
- **Annual pen-test report.** Same as SOC 2 — out forever.
- **HIPAA BAA.** /security explicitly disclaims; out forever.
- **Multi-language templates.** English only.
- **Cyber-insurance certificate.** Treasurer may ask. Cap'n can purchase a basic policy ($200-500/yr) when first paying coach's board requires it; not in scope of this kit.

---

## 6. Open Cap'n forks (none block v1; v1.1 polish)

1. **Pen-test alternative.** Some boards will accept "we have not had a third-party pen-test, here is our internal threat model + the fact that we use OAuth-only auth + the public attack surface is small" as a substitute. Worth drafting a one-pager `vendor-kit/security-posture.md` for inclusion when asked? Not v1.
2. **Cyber-insurance policy.** When the first paying board asks, decide policy provider + coverage level. Not v1.
3. **Annual review meeting commitment.** Some boards want a yearly call with the vendor. Should this be in the services agreement, or kept informal? v1 keeps informal; revisit if asked.

---

## 7. Effort estimate

~6-8h total, mostly non-engineering.

- Template adaptation (services agreement, DPA, breach SLA, continuity, cover letter, sub-processor mirror): 3-4h
- W-9 fill + export: 0.5h
- `build.sh` + pandoc template tuning: 1h
- Stripe Invoicing setup + test invoice: 1-2h
- AdminView "Send vendor kit" action: 0.5h
- Public-page updates (/pricing, /security): 0.5h
- Smoke + manual update: 0.5h

Could batch with PSC's Phase 3a slice (data + server) since vendor kit's engineering work is small and parallel.

---

## 8. Dependencies

- **Phase 2 email infra (recommended, not required).** AdminView "Send vendor kit" works better if Resend is live; if not, falls back to `mailto:` with manual attach. Kit shippable either way.
- **No new external services beyond Stripe** (which is needed for billing thin slice regardless).
- **Cap'n's hands:**
  1. Sign up for Stripe account (if not already done for billing thin slice — likely shared)
  2. Add EIN to Stripe account
  3. Fill W-9 once
  4. Legal-attentive editing pass on the 5 adapted templates (the most expensive Cap'n-time)
  5. Optional: $200-500 lawyer review pass on services-agreement + DPA before first send

---

## 9. Related

- `/sub-processors.html` — public sub-processor list that the kit's `sub-processor-list.md` mirrors
- `/security.html` — buyer-facing security posture, including the "What we don't have" honest-list
- `/pricing.html#continuity` — public continuity commitment summary
- `/terms.html` — legally binding continuity commitment text (source of truth)
- `BILLING_THRESHOLD_CHANGES.md` — staged ToS softening that ships day-of-first-billing
- `EMAIL_INFRA_SCOPE.md` §3.4 — Resend infrastructure that powers the AdminView "Send vendor kit" action
- `BILLING_SCOPE.md` (forthcoming) — Stripe Invoicing setup happens here too; this scope just adds the EIN + product configuration
- [[swim-generator-team-evaluation-2026-05-25]] — Treasurer + Head Coach + Lifecycle personas surfacing this as the same-day-approval lever
- PHASED_PLAN §3 Phase 3 — Phase 3 deliverables in order; this is the parallel non-engineering track
