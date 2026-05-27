# Vendor Paper Kit — assembly + send instructions

This directory holds the procurement-grade paperwork a 501(c)(3) treasurer
or school program reviewer needs before approving a SaaS vendor payment.
Per `VENDOR_PAPER_KIT_SCOPE.md` (locked 2026-05-26). Triple-cross-validated
in the team eval as the same-day-approval lever.

## What's in here

| File | What | Cap'n's hands? |
|---|---|---|
| `cover-letter.md` | Personalized intro letter with `{{ORG_NAME}}` + `{{TREASURER_NAME}}` placeholders | Edit once, served as-is per recipient |
| `services-agreement.md` | Annual SaaS services agreement (Program-tier $300/yr) | **SCAFFOLD** — adapt from Stripe Atlas SaaS MSA-lite |
| `dpa.md` | Data Processing Addendum | **SCAFFOLD** — adapt from Vanta or Stripe Atlas public DPA template |
| `breach-notification-sla.md` | One-page breach notification commitment | Edit once, ready as-is |
| `continuity-commitment.md` | What happens if SetForge winds down | Edit once, ready as-is (extracted from ToS) |
| `sub-processor-list.md` | Procurement-formatted mirror of `/sub-processors` | Re-sync when public page changes |
| `w-9.pdf` | IRS W-9 for Competition Aquatics, LLC | Fill once, re-do only on LLC change |
| `build.sh` | Renders all `.md` → `.pdf` via pandoc | Run when templates change |

PDFs land in `vendor-kit/build/` — git-ignored. The static `w-9.pdf` is
the only PDF in version control.

## How to send a kit

The treasurer / board reviewer emails `hello@setforge.io`. Cap'n:

1. Open **AdminView → Vendor kit** in the app.
2. Enter recipient email + organization name + treasurer name.
3. Click **Send kit**. The server renders `cover-letter.md` with the
   placeholders substituted, attaches all generated PDFs, and ships via
   Resend (Phase 2 email infra). Audit log captures `vendor_kit.sent`
   with the recipient + org name.
4. If Resend isn't live, the button instead opens a `mailto:` with the
   subject + recipient prefilled and lists the attachments to add
   manually. Audit log still captures the send.

## How to (re)build the PDFs

```
cd vendor-kit
./build.sh
```

Requires `pandoc` + `texlive-xetex` (or any LaTeX engine pandoc can
drive). The script writes uniformly-styled PDFs to `vendor-kit/build/`
with the SetForge wordmark in the header and page numbers in the footer.
Don't commit the build directory.

## What's NOT in here (intentionally)

Per scope §5 + decision 10:

- **SOC 2 attestation** — won't ever offer; cover-letter discloses honestly.
- **Annual pen-test report** — won't ever offer; same.
- **HIPAA BAA** — `/security` explicitly disclaims; out forever.
- **Self-serve data export** — by-request only in v1 per DPA. Self-serve
  export ships in Phase 4 alongside the identity refactor (`IDENTITY_SCOPE.md`
  phase I-G).
- **Cyber-insurance certificate** — Cap'n purchases when first board
  requires it; not v1.
- **DocuSign / HelloSign integration** — treasurer signs PDF and emails
  back in v1.

## Cap'n's first-time setup checklist

Before the first send, Cap'n needs to:

1. Sign up for a Stripe account (or use the one already created for the
   billing thin slice).
2. Add Competition Aquatics, LLC's EIN to Stripe account settings.
3. Fill the IRS W-9 form once with LLC name + EIN + address + signature.
   Save as `vendor-kit/w-9.pdf` and commit (this file IS in git).
4. **Legal-attentive editing pass** on the two SCAFFOLD templates
   (`services-agreement.md` + `dpa.md`). Each scaffold has TODO markers
   showing exactly what to import from the public source template + what
   SetForge-specific clauses to add.
   - Source for services agreement: Stripe Atlas's "SaaS Master Services
     Agreement" (publicly available at stripe.com/atlas).
   - Source for DPA: Vanta's public model DPA or Stripe Atlas's DPA
     template (both well-known + clear; either works).
5. Optional but recommended: $200-500 lawyer review of the two adapted
   legal templates before the first send.
6. Install pandoc + a LaTeX engine; run `./build.sh` once to verify the
   PDFs render cleanly.
7. Test the **AdminView → Vendor kit** send action to a personal address
   with all attachments. Verify the cover letter renders with placeholders
   substituted + every attachment opens.

After that, every subsequent send is one click in AdminView.

## Source-of-truth pointers

- Continuity commitment: `/terms.html` is legally binding source. The
  `.md` here is the procurement-friendly extract.
- Sub-processor list: `/sub-processors.html` is the public source. The
  `.md` here mirrors it for offline attachment.
- Breach notification SLA: this directory is the source of truth (the
  public posture is summarized on `/security.html`).
- Pricing: `/pricing.html#continuity` is the public-facing summary; the
  Program-tier card mentions vendor kit availability.
