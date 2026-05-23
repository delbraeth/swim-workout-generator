# SetForge — Solo Athlete Onboarding

The durable training package for a **self-coached adult swimmer** picking up SetForge for the first time. Four deliverables plus this index. Each deliverable stands alone — a swimmer who only opens the workbook shouldn't need the video.

## Who reads which file

| File | Who reads it | When |
|---|---|---|
| `video_script.md` | Producer / Cap'n | When recording the ~6-min screencast hosted on the landing page or onboarding email. |
| `workbook.md` | The swimmer | Self-paced. Printed or read on phone. Includes a Test Set protocol, 5 starter workouts, and the Favorites & Disfavorites primer. |
| `in_app_tour_spec.md` | Engineering | When building the first-run tour inside `public/index.html`. Spec only — not implementation. |
| `facilitator_guide.md` | Community manager or Cap'n | When running a live 30–45 min Zoom intro for 5–15 swimmers. |

## Recommended reading order

1. **`video_script.md`** — fastest way to internalize the solo-swimmer journey end-to-end.
2. **`workbook.md`** — the durable artifact the swimmer takes home; biggest surface area.
3. **`in_app_tour_spec.md`** — bridges video and workbook into the product itself.
4. **`facilitator_guide.md`** — adds the live-cohort layer when a human is in the loop.

## Brand & voice

- Product name is **SetForge** — capital S AND capital F. Every reference. Not "Setforge," not "setforge." The manual at `public/manual.html` is the source of truth on spelling.
- Solo tier is free, forever. No paywall, no asterisks, no upsell language.
- Sign-in is **Sign in with Apple** only. No password, email, or magic-link auth.
- No medical or training-prescription advice.
- Active voice. Direct address ("you"). Dark-navy training-partner tone — not aquatic clichés ("dive in" / "make a splash" banned).

## What this pass added vs. the prior pass

Everything in here is verified against `public/manual.html` as of 2026-05-22. Net-new coverage versus the prior pass:

- **Favorites & Disfavorites** — tri-state ★/—/👎 toggle, per-set cycling button, the Favorites + Disfavorites audit panels in Profile, the Hard-exclude mode toggle. Workbook adds a dedicated page; video adds a scene; tour adds a step.
- **Universal favorite-wins precedence** — covered at workbook depth.
- **Effort zones / focus note / Quick-Launch / Goals / training phase** — already in the prior pass, kept current.

## What's deliberately out of scope

Solo athletes don't see and don't need the coach-only surfaces. Excluded from every deliverable:

- Coach group propagation, Coach curation impact, Multi-lane generate
- View-as (admin QA)
- Teams, Managed swimmers, Catalog
- Lane plans, multi-pace print, group fanout

If a solo user is granted coach access later, the coach onboarding package covers all of the above. This package never references what the reader can't access.

## Currency

All references are against `public/manual.html` as of 2026-05-22. Update this folder when shipped features rearrange the solo journey — specifically: first-run flow, generator page layout, save form, Run Mode, Quick-Launch, or the fav/disfavor UI.
