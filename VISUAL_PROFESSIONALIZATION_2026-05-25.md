# Visual professionalization — UX + Marketing joint report

**Date:** 2026-05-25
**Method:** parallel pass by the standing UX and Marketing staff agents (per `TEAM.md` roster). Documentation-driven (no screenshots, no live-app interaction). UX worked the design-craft angle; Marketing worked the brand/credibility angle.
**Audience:** PM agent for later triage + Cap'n for prioritization decisions.
**Honesty note:** initial response in chat synthesized findings that conflated UX agent output with Marketing extrapolation; this report is built from BOTH agents' verbatim outputs (preserved in §10).

---

## 1. Headline finding (both agents independently)

**The engine is mature; the chrome reads hobby.** Sign-in page, link previews (no OG/Twitter cards), contact email (`delbraeth@gmail.com`), broken `theme-color` meta, three forked design palettes across four HTML files, missing marketing surfaces (no `/about`, `/pricing`, `/changelog`), and self-described "hobby-operated / no SLA" language in privacy + ToS — all visible to a first-time prospect before they touch the actual app. **The professionalization gap isn't in the product, it's in everything around it.**

## 2. The single highest-leverage finding (Marketing)

> **The privacy + ToS "hobby-operated" / "side project" language is a charm at $0 and a hard disqualifier at $10/mo. The day the first Patreon webhook fires, three sentences and one email address must change.** Specifically: privacy.html:97, terms.html:100 and :153, and the `delbraeth@gmail.com` contact in privacy.html:188 + terms.html:169.

This is a one-edit, threshold-triggered change that converts the largest single board-blocker the Treasurer persona named (team-eval) into a non-issue. Schedule it to fire WITH billing, not before, not after.

## 3. Cross-validated quick wins (both agents named these)

| # | Quick win | Cost | Why both flagged |
|---|---|---|---|
| 1 | **OG + Twitter card meta + 1200×630 social image** | S | UX: "hobby tell #1." Marketing: "cheapest credibility loss in the file for a word-of-mouth product." Both #1 quick win. |
| 2 | **Fix `theme-color` meta** — literal `#0f172a` not `var(--color-bg)` | S | UX: shipped broken despite Phase 4 comment claiming fix. Marketing: "browsers ignore it." 2-line edit. |
| 3 | **Real sign-in page** — replace gradient + Apple button with value prop + screenshot | S-M | UX: "anyone landing without a referrer bounces." Marketing: "#1 conversion killer." |
| 4 | **`hello@setforge.io` (forward to Gmail)** in privacy/terms footers + a Contact surface | S | Marketing: "Gmail in contact slot of a paid B2B vendor signals hobbyist even when the operator is responsive." |
| 5 | **Unify forked design tokens** across index/manual/privacy/terms HTML files | S | UX: "one brand, not three." Inconsistent cross-page palette is invisible to Cap'n, obvious to a first-time visitor. |

These five are the **one-session quick-win bundle** (≤5h total). They produce the largest first-impression delta-per-hour available.

## 4. Missing credibility surfaces (Marketing-prioritized)

| Surface | What | Cost |
|---|---|---|
| **Marketing landing** (`/` for signed-out users) | Hero + 3 screenshots + "for coaches / swimmers / teams" + invite-request CTA | M |
| **About page** | Founder bio + photo + the honest hobby→product arc | S |
| **Pricing page** | Render PRICING.md as a page; lead with ToS-bound free-tier permanence as a feature | S |
| **Changelog** | Auto-render from git tags or curate; the 100+ tags since rebrand are an invisible credibility asset | S |
| **Status page** | Honest single-operator uptime posture; closes a Treasurer gap without real monitoring infra | S |
| **Security & privacy one-pager** | Re-package existing privacy.html content as security-at-SetForge | S |
| **Sub-processor list** | Spaceship · Apple · Google/Resend planned | S |
| **Contact page** | `hello@setforge.io` + response-time expectation | S |
| **Trust strip / testimonials slot** | DOM scaffolding for first pilot quotes; build the slot empty | M |

Most of these are **S-cost rendering of content that already exists.** Pricing page from PRICING.md, changelog from git tags, security page from privacy.html. The raw material is in the repo; only the surface is missing.

## 5. UX-unique findings (design craft)

These showed up in the UX pass but not Marketing's:

- **1,912 inline `style={{}}` blocks** in public/index.html. **272 instances of `fontSize: 11`.** **1,033 `fontSize` literals dominated by 10/11/12/13 px.** No type or spacing scale; every component re-litigates 11 vs 12 px and 6 vs 8 vs 10 px. Adding `--text-xs/sm/base/lg` + `--space-1..8` + utility classes is one M-cost change that lets new features land hierarchically for free.
- **349 raw hex colors still inline** despite 1,316 CSS-var references. Phase 4 sweep was partial.
- **Light-on-light form inputs in a dark app** — `background: "#fff"` leaking into modal forms (lines 9572, 9608). Single biggest dark-theme break and is repeated dozens of times. One `.input-dark` class fixes them all.
- **Top-nav is emoji-only icons** (📥 📅 🔧▾ 📊 🛡), no labels, no mobile collapse strategy. Suspected to break on <380px viewport (pool-deck phones).
- **Tap targets sub-44px floor** on tri-state fav/disfavor toggle, regenerate, fav-set cycle, attendance "done." Wet thumbs in a Ziploc bag will mis-tap. Apple/Material recommend 44px.
- **Accessibility floor is low:**
  - 1 `aria-label` in the entire 24k-line file (regenerate button only); top nav + close-X's + toggles all silent to screen readers
  - 0 `<main>` / `<nav>` / `<header>` landmarks
  - Color-only state encoding (tri-state, zone pips) — add text/glyph
  - No `:focus-visible` outside `.btn`
  - No `prefers-reduced-motion`
  - **WCAG AA contrast risk:** `--color-text-dim` (`#64748b`) on `--color-card` (`#1e293b`) at 11px = ~3.6:1 vs required 4.5:1. This token is used hundreds of times.

## 6. Marketing-unique findings (brand/credibility)

These showed up in Marketing pass but not UX's:

- **No About page** — buyers Google the founder before paying $10/mo. Currently the only identifiable human surface is `delbraeth@gmail.com` in two policy footers.
- **No `/changelog` or `/pricing` or `/about` routes** — content exists (ROADMAP.md, PRICING.md, this repo's git history of 100+ tags); surfaces don't.
- **Access is invite-only** (manual.html:362-365) — the public landing has no path for a curious buyer. Combined with the login-wall landing, this is a complete conversion dead-end for cold prospects.
- **Footer says `© 2026 Competition Aquatics, LLC`** — an LLC that's nowhere else in the brand. Coach sees an unfamiliar legal entity and asks "what am I actually buying from?"
- **No status page, no security one-pager, no sub-processor list** — Treasurer persona's exact ask. Static stubs > nothing.
- **Footer is copyright only** — no nav, no social, no entity address.

## 7. Honest-posture brand opportunities (lean in, don't sand off)

Marketing flagged a real asset: SetForge's actual posture (no analytics, no dark patterns, ToS-bound free-tier permanence, OAuth-only, solo operator who responds) is **genuinely rare in this vertical**. Don't sand it off — brand it.

**LEAN IN:**
- *"No analytics. No tracking. No ad pixels."* (privacy.html:124) — belongs on the landing page, not buried. Parent persona (swimmer eval) literally said "striking compared to TeamUnify."
- **OAuth-only:** *"We can't lose your password because we never had it."* One-line trust win.
- **ToS-bound free-tier permanence** (PRICING.md:108-112) — anti-rugpull posture. Make this the headline of the pricing page.
- **Solo operator who responds** — reframe from "side project" to "operated by one engineer who answers his own email."
- **Open audit log + self-serve session revoke** — few competitors offer this; security-conscious buyers (HS coaches, club registrars) notice.

**SAND OFF (at billing threshold per §2 above):**
- "Hobby-operated. No SLA. No company." → "operated by one founder under Competition Aquatics, LLC; service interruptions are communicated by email; data export available on request."
- `delbraeth@gmail.com` → `hello@setforge.io`

## 8. Competitor visual benchmark (Marketing)

| Competitor | What they do that SetForge doesn't | What SetForge can credibly NOT do |
|---|---|---|
| **TeamUnify** | Heavy marketing site, multi-page nav, sales-led pricing | Don't be enterprise-shaped. SetForge is the prosumer escape from TeamUnify. |
| **SwimTopia** | Bright "for parents" framing, testimonial wall | Don't ape the parent-PR aesthetic; SetForge is coach-tool first. |
| **Commit Swimming** | **Public-browsable workout library** as marketing surface | **DO copy this** — let the catalog be public-browsable as a try-before-buy. |
| **MyCoach** | Periodization/assessment marketing | Don't claim periodization until meet-anchored season ships (ROADMAP Bigger Threads). |
| **MySwimPro** | App-store badges, video hero, hyper-polished consumer brand | Don't try; SetForge is not consumer fitness. Stay coach-tool. |
| **TritonWear** | Hardware product polish, in-water photography | Don't fake hardware credibility; lean text-and-data. |
| **TrainingPeaks** | Multi-sport coach↔athlete, integration logos (Garmin, Strava, Zwift) | Integration gap is real (swimmer eval) but don't fake the logo wall before integrations exist. |

**Differentiation matrix one-liner (Marketing's draft):**
> *"SetForge is the only swim workout tool where coaches pay, swimmers are free forever, and there are no ads, trackers, or passwords."* Every word fact-checkable.

## 9. What both agents agreed to DEFER not fixing

- **Dark-only theme.** Coherent, modern, competitors are aesthetically dated. Light-mode toggle is high cost / low return today.
- **Emoji-as-icons everywhere** (🏊 ⚡ ★ 👎 📥 📝). Hobbyist-coded vs custom icon set — but consistent, legible internationally, and replacing them is multi-day work with no buyer-impact data. Defer past first paying pilot.
- **Single-page manual** vs multi-page docs site. The current structure works. Don't refactor until docs traffic warrants.
- **Single-file React in `public/index.html`.** Internal tech debt, not brand debt. Buyers won't view source.
- **No demo/sandbox account.** M+ work to build safely. Public-browsable catalog (Commit Swimming pattern, from §8) is cheaper proxy.

## 10. What WASN'T evaluated (limitations)

Both agents worked from source code, not screenshots. They explicitly flagged what they CAN'T evaluate from text alone:

- Actual rendered hierarchy on real screens (visual weight, alignment, breathing room)
- Color contrast in lived context — especially pool-deck sun and mobile glare
- Mobile rendering — top-nav suspected to overflow on phones but unconfirmed
- Modal sizing on <400px viewports — multiple modals use 400-900px maxWidth
- PaceClockView portrait mode usability (only landscape branch was rebuilt)
- Interactive feel (hover, focus animation, modal transitions, button press)
- WorkoutBlock header density on mobile

**To close these gaps,** screenshot-based review is needed against the live app. Most of the authenticated surface needs Cap'n's login (Chrome MCP from his side) since SetForge is OAuth-gated.

## 11. Recommended PM agenda (for when PM is summoned to triage)

In rough order of leverage-per-hour, both agents converged on this sequence:

| # | Bundle | Cost | Outcome |
|---|---|---|---|
| 1 | **Quick wins (§3)** — OG meta + theme-color + sign-in screen + contact email + token unification | S (1 session ~3-5h) | Largest first-impression delta-per-hour in the file |
| 2 | **`/changelog` + `/pricing` + `/about` static pages** rendering from existing docs | S (1 session ~3-4h) | Three new routes; proves momentum + transparency; founder face |
| 3 | **Threshold-language pre-stage** (§2) — draft the softened privacy/ToS language NOW so it ships the moment billing turns on | S (~1h) | Removes the single largest board-blocker as a side-effect of billing |
| 4 | **Design-system tier** — type scale + spacing scale + form primitives + empty/loading states + mobile-nav strategy | M-L (sprint ~10-15h) | Every future feature lands professionally without per-feature design work |
| 5 | **Accessibility floor sprint** — aria-label on icon-only buttons + landmarks + focus rings + contrast token adjustment | S-M (1 session ~4h) | Lighthouse score + screen-reader floor + zero visual change |
| 6 | **Screenshot-based mobile audit** (driven from Cap'n's Chrome) | M | Confirms the gaps §10 flagged but couldn't verify |

PM agent should weigh against the cross-validated ROADMAP candidates (per-swimmer constraints, meet-anchored taper, identity refactor, etc.) when summoned. Visual work has compounding marketing/credibility return but doesn't unlock pilot conversations directly the way (e.g.) the vendor paper kit does.

---

## 12. UX agent — verbatim output (audit trail)

**Posture call up front:** the visual posture is fine for a side project handed to friendly testers. It is **not yet fit for paid SaaS sold to people who haven't met you.** The gaps are uneven — the rebrand sweep landed real tokens and a button system, but the surfaces a first-time visitor sees (login, mobile nav, link previews, manual) still read hobby.

### Visual gaps evident from source

1. **No social/OG metadata.** `index.html` has 4 meta tags total. Zero `og:*`, `twitter:*`, no canonical URL. Any Slack/iMessage/Discord paste of setforge.io renders as a naked link. Hobby tell #1.
2. **`theme-color` meta is broken.** Line 14: `content="var(--color-bg)"` — CSS vars don't resolve in `<meta>`. The Phase-4 memo claims this was fixed; the file still ships the broken literal. PWA chrome on Android won't tint.
3. **Three forked design tokens across four HTML files.** `index.html` uses `--color-primary`, `manual.html` uses `--blue`/`--blue-lt`, `privacy.html` forks again. Manual h2 is `#fff`; app body is `var(--color-text)` (`#e2e8f0`). Cross-page visual mismatch is invisible to Cap'n but obvious to a first-time visitor.
4. **Inline-style sprawl, no scale.** 1,912 inline `style={{` blocks, 1,033 `fontSize` literals dominated by 10/11/12/13 px — and **272 instances of `fontSize: 11`.** No type scale, no spacing scale. The button system + `.card`/`.pill`/`.modal-overlay` classes are a real start but cover <10% of the surface.
5. **349 raw hex colors still inline** despite 1,316 CSS-var references. The Phase 4 sweep was real but partial — borders like `#94a3b8`, `#cbd5e1`, `#7dd3fc`, `#7f1d1d` etc. are scattered through forms/buttons. Light-theme white-on-slate inputs (lines 9572, 9608) leak `background: "#fff"` into a dark app.
6. **Sign-in page is a logo + one button on a gradient.** No tagline, no screenshot, no "who is this for," no proof. Anyone landing without a referrer bounces. (Lines 21560-21605.)
7. **Top nav is a row of emoji-only icons.** History, 📥, 📅, 🔧▾, 📊, 🛡 — all 6×10 padding, 13 px, no labels. Icon meanings are inferred. No mobile collapse; on a narrow viewport they just wrap or push the wordmark off-screen.
8. **Almost no semantic HTML.** 2 `aria-*`, 2 `role=`, 1 `alt=`, 0 `tabIndex`. Buttons are `<button>` but icon-only buttons have no `aria-label`. SetForge wordmark `<img>` has alt; nothing else does.

### Suspected — need screenshots

1. Top-nav overflow on phones (no `flex-wrap` strategy + no breakpoint; suspect wrap to messy row or clip on <380px).
2. Color contrast in light-on-light form inputs (`color: "#0369a1"` on `#e0f2fe` line 9652; `color: "#15803d"` on `#f0fdf4` line 9658 likely near WCAG-AA floor for 12px text).
3. WorkoutBlock header density on mobile (dot + name + tri-toggle + regenerate + badges + zone pip cramped on 360px).
4. PaceClockView portrait fallback (only landscape branch was rebuilt; portrait usability uncertain).
5. Modal sizing (15 modals fixed `maxWidth` 400-900 may scroll horizontally on 360px).

### Quick wins (S = ≤2h, M = half-day, L = day+)

1. **Ship OG + Twitter card meta + a 1200×630 social image.** 6 meta tags + one PNG. Every link share currently looks like spam. **S.**
2. **Fix `theme-color` for real (literal `#0f172a`) + add `<meta name="color-scheme" content="dark">`.** 2-line edit. PWA install + Safari chrome look right, prevents form-control white flashes. **S.**
3. **Unify the three forked palettes onto the index.html `--color-*` tokens.** Search/replace in manual.html + privacy.html + terms.html. One brand, not three. **S.**
4. **`aria-label` audit pass on icon-only buttons** (top nav + WorkoutBlock toggles + close-X's). ~30 buttons. Screen readers + Lighthouse score + zero visual change. **S.**
5. **Real first-screen to sign-in:** one-sentence positioning + 3 bullet value props + a screenshot. 60 lines in `SignInGate`. A paying coach won't sign in to a blank gradient. **M.**

### Structural design-system gaps

1. **Type + spacing scale.** `--text-xs/sm/base/lg`, `--space-1..8`. Right now every component re-litigates 11 vs 12 px and 6 vs 8 vs 10 px. Add the scale + `.txt-xs/sm/base/lg` + `.stack-2/3/4` utilities; new features inherit hierarchy for free.
2. **Form-control primitives.** `.input`, `.input-dark`, `.select`, `.checkbox`. The white-bg input pattern is the single biggest dark-theme break and is repeated dozens of times with slightly different borders. One class fixes them all.
3. **Empty-state + loading-state pattern.** Today: `<div>Loading…</div>` (line 10701, 12934, 13828, 14077) and ad-hoc empties. `<EmptyState icon title body cta />` + `<Skeleton lines={n} />` would professionalize ~20 surfaces and replace the "is it broken or empty?" ambiguity testers flagged.

### Mobile-specific (pool-deck) concerns

1. **Top-nav row will not survive 360px landscape.** 5-7 icon buttons + wordmark + Profile chip on one row, no media query. Suspect overflow/wrap on every phone the personas described.
2. **Form inputs render light-on-light** in a dark app. In bright pool-deck sun, white panels among slate cards are eye-stabbing and pattern-breaking.
3. **Tap-target floor missed.** Buttons routinely 4-6px vertical padding × 11-13px text ≈22-26px tall. Apple/Material recommend 44px. Tri-state toggle, regenerate, fav-set cycle, attendance "done" — all sub-floor. Wet thumbs in a Ziploc will mis-tap.

### Accessibility floor

- **Meets:** `lang="en"` on root, semantic `<button>`, `:focus-visible` defined on `.btn` (one ring shared across the system), keyboard Enter/Escape on most inputs (16 onKeyDown handlers).
- **Doesn't:**
  - Icon-only buttons lack labels (1 `aria-label` in the whole file — the regenerate button).
  - Color-only state encoding on tri-state fav/disfavor and zone pips.
  - No skip-link, no landmarks (no `<main>`, `<nav>`, `<header>`).
  - Contrast risk on `var(--color-text-dim)` (#64748b) over `--color-card` (#1e293b) at 11px ≈3.6:1, below AA's 4.5:1.
  - No `prefers-reduced-motion` or `prefers-color-scheme`.
  - No `:focus-visible` outside `.btn`.

**Bottom line:** the engine, data model, and print output are already mature. The visual layer is one weekend (OG/meta + token unification + sign-in screen + aria-label sweep) + one focused sprint (type/space scale + form primitives + mobile nav) away from looking like the SaaS it functionally is.

Key file paths: `public/index.html` (lines 4-14 meta, 23-39 tokens, 21560-21605 SignInGate, 23670-23800 top nav, 9560-9670 form-input patterns); `public/manual.html` lines 10-25 forked tokens; `public/privacy.html` lines 9-19 forked again; `public/site.webmanifest`.

---

## 13. Marketing agent — verbatim output (audit trail)

### First-impression gaps (prioritized, paying-prospect coach lens)

1. **`setforge.io/` is a login wall, not a product story.** `SignInGate` is "SetForge / Sign in to continue / [Apple button]" (index.html:21558-21603). Zero positioning, zero "what is this," zero screenshots. Any prospect not handed an invite link bounces. Worse, **access is invite-only** (manual.html:362-365) — the public landing literally has no path for a curious buyer.
2. **No social preview metadata.** Missing `og:title / og:description / og:image / twitter:card` (index.html:4-14). Anyone sharing a SetForge link in Discord, iMessage, or email gets a naked URL preview. For a word-of-mouth product, this is the cheapest credibility loss in the file.
3. **Broken `<meta name="theme-color">`** — value is literally `var(--color-bg)` (index.html:14), which browsers ignore. Comment in the source even acknowledges it. Mobile Safari and Chrome won't tint the chrome.
4. **Privacy policy + ToS self-describe as "side project, hobby-operated, no SLA"** (privacy.html:97, terms.html:100, 153). Charming today; a hard disqualifier the second a coach reads it before paying $10/mo. Treasurer persona already flagged this verbatim.
5. **Footer says "© 2026 Competition Aquatics, LLC"** (index.html:25040, privacy.html:194, terms.html:175) — an LLC that's nowhere else in the brand. Coach sees an unfamiliar legal entity and asks "what am I actually buying from?"
6. **Single contact = `delbraeth@gmail.com`** (privacy.html:188, terms.html:169). A Gmail in the contact slot of a paid B2B vendor signals hobbyist even when the operator is responsive. Costs ~$0 to put `hello@setforge.io` in front of it.
7. **No pricing page.** PRICING.md exists but isn't on the site. Prospects hear "$10/mo Coach tier" and have to ask. Loses every cold prospect who won't email a stranger.
8. **No favicon/social icon polish** — manifest is functional but the SVG icon is the only branded asset.

### Missing credibility surfaces

(See §4 table above — Marketing's full surface-by-surface breakdown is preserved there.)

### Honest-posture brand opportunities — lean in vs sand off

**LEAN IN:**
- "No analytics. No tracking. No ad pixels." — genuine differentiator vs every named competitor. Belongs on the landing page, not buried in privacy. Swimmer-eval Parent persona literally said "striking compared to TeamUnify."
- OAuth-only, no passwords — "We can't lose your password because we never had it." One-line trust win.
- ToS-bound free-tier permanence — anti-SaaS-rugpull posture. Make this the HEADLINE of the pricing page.
- Solo operator who responds — not "side project," reframe as "operated by one engineer who answers his own email."
- Open audit log + self-serve session revoke — few competitors offer this; security-conscious buyers notice.

**SAND OFF (at billing threshold):**
- "Hobby-operated. No SLA. No company." → "operated by one founder under Competition Aquatics, LLC; service interruptions are communicated by email; data export available on request." **Don't lie — just stop volunteering "hobby."**
- The Gmail contact address. Same threshold.

### Competitor visual benchmark

(See §8 table above for the full Marketing matrix.)

**Differentiation matrix one-liner:**
> *"SetForge is the only swim workout tool where coaches pay, swimmers are free forever, and there are no ads, trackers, or passwords."* Every word fact-checkable.

### Quick wins (≤2h each)

1. **Fix the `theme-color` meta** — replace `var(--color-bg)` with literal `#0f172a`. Before: browsers ignore it. After: mobile Safari/Chrome tint chrome SetForge-dark.
2. **Add OG/Twitter card meta + a 1200×630 PNG** — pulls SetForge wordmark + tagline. Before: shared link is a naked URL. After: every Discord/iMessage/Slack paste renders a branded preview.
3. **Replace `delbraeth@gmail.com` with `hello@setforge.io`** in privacy.html:188, terms.html:169, and the footer. Forward to the Gmail inbox. Before: "this guy's running it from his personal Gmail." After: "this is a real product."
4. **Soften the two "hobby-operated" / "side project" sentences** in privacy.html:97 + terms.html:100, 153, 165. Replace with neutral operational language. Before: instant disqualifier the moment a coach reads it pre-purchase. After: honest without volunteering disqualifying language.
5. **Add "About" link to the manual sidebar + a 200-word founder bio + photo.** Use existing manual.html chrome. Before: zero human face on the product. After: a buyer who Googles the founder lands on something.

### What looks "hobby" but I'd defer NOT fixing

(See §9 above for both-agent overlap. Marketing-specific deferrals match UX's deferrals; no divergence here.)

### The big call

**SetForge should NOT look more like TeamUnify.** The whole differentiation thesis is "not enterprise, not surveilled, not rugpull-able." The brand work is making *that* legible on first impression — landing page + pricing page + softened "hobby" language + OG tags — not adding chrome to compete on TeamUnify's terms.

**The threshold to name explicitly:** the privacy/ToS "hobby-operated" + Gmail-contact language is a charm at $0 and a hard disqualifier at $10/mo. **The day the first Patreon webhook fires, these three sentences and one email address must change.** It's the single highest-leverage brand edit in the file.

---

## 14. Open follow-ups (for future-Cap'n + PM)

- Screenshot-based mobile audit against live app (closes §10 limitations; needs Cap'n-driven Chrome MCP session)
- Decision on `/changelog` rendering source — git tags vs curated markdown vs auto-extract from MEMORY.md
- Founder bio + photo for the About page (writing exercise; needs Cap'n's voice)
- Soft-language draft for billing threshold (~1h prep so it ships day-of-billing, not retroactively)
- Coordination with IDENTITY_SCOPE.md timing — Google OAuth + outbound email ship before the marketing/sign-in surfaces are most powerful (Android-using parents currently locked out)

---

*Generated 2026-05-25 by parallel UX + Marketing staff agents per `TEAM.md` roster. Documentation-driven; no live-app screenshots. See memory `swim_generator_visual_professionalization_2026_05_25.md` for archive pointer.*
