# Test findings — 2026-05-28 testing window

Cap'n's testing pass after today's bundle ship. Anything that surfaces lands here for repair in a later session.

## Today's deploy covers

- Bootstrap composite endpoint (killed app-load 429s)
- A+B ProfileModal burst mitigation (killed modal-open 429s)
- Billing v1 end-to-end (Checkout → portal → webhook → tier grant → trial)
- `?upgrade=success` refresh-bootstrap fix
- Stripe webhook raw-body middleware fix (the real bug behind today's 400s)
- Admin billing config diagnostic (Admin → Billing config tab)
- ProfileModal 3-tab reorg (Account / Curation / Subscription)
- Manual + ROADMAP + memory updates

## Test surfaces worth poking

- [ ] Profile modal open + tab switching across Account / Curation / Subscription
- [ ] Subscription panel: Start trial → Stripe Checkout → return → tier flips to "Coach (trial)" within ~3s without reload
- [ ] Subscription panel: Manage subscription → Stripe Customer Portal
- [ ] Admin → Billing config diagnostic — all six rows green
- [ ] Generate a workout end-to-end (basic regression)
- [ ] Save + load from history (basic regression)
- [ ] Open Profile as swimmer vs coach vs admin — view-as switcher only renders for admin, Curation Impact only renders for coach
- [ ] Modal close → header initials still update if changed inside modal
- [ ] Modal save (e.g., toggle a favorite) → onProfileChange fires refreshBootstrap → App-level state updates
- [ ] Network tab during app load — should be ~3 GETs (`/api/auth/status`, `/api/auth/csrf`, `/api/me/bootstrap`)
- [ ] Network tab during ProfileModal open — should be 0 parallel + maybe 2 sequenced (billing-history + coach-impact)

## Findings — Issues to repair

<!-- Cap'n: add anything that breaks or behaves wrong below. Format:
### Short title
- **What broke:** (the symptom)
- **How to reproduce:** (steps)
- **Severity:** blocker | bug | nit | UX polish
- **Suspected cause:** (optional — leave blank if unclear)
-->

### ✅ FIXED — Parent invite "parent_email required" 400
- **What broke:** ParentsPanel "Send invite" 400'd with `parent_email required` even though the email field was populated.
- **Severity:** blocker (parent portal MVP unusable)
- **Cause:** field name mismatch — client at `submitInvite` sent `{ email: trimmed }`, server destructures `{ parent_email }`. Pre-existing bug from Phase 4 PP MVP; first hit during this test pass.
- **Fix:** changed client body to `{ parent_email: trimmed }`. Bundled in this session's next commit.

## Findings — Working as expected
<!-- Optional: positive confirmations help next session know what NOT to touch. -->

(none yet)
