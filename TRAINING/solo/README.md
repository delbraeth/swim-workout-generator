# SetForge — Solo Athlete Onboarding

This folder is the durable training package for a **self-coached adult swimmer** picking up SetForge for the first time. The four deliverables work together but are designed so any single one stands alone.

## Who uses which file

| File | Who reads it | When |
|---|---|---|
| `video_script.md` | Producer / Cap'n | When recording the 6-min screencast hosted on the landing page or onboarding email. |
| `workbook.md` | The swimmer | Self-paced. Printed or read on phone. Includes a Test Set protocol and 5 starter workouts. |
| `in_app_tour_spec.md` | Engineering | When building the first-run tour inside `public/index.html`. Spec only — not implementation. |
| `facilitator_guide.md` | Community manager or Cap'n | When running a live 30-45 min Zoom intro for 5-15 swimmers. |

## Reading order (recommended)

1. **`video_script.md`** — fastest way to internalize the solo-swimmer journey end-to-end.
2. **`workbook.md`** — the durable artifact the swimmer takes home; biggest surface area.
3. **`in_app_tour_spec.md`** — bridges video and workbook into the product itself.
4. **`facilitator_guide.md`** — adds the live-cohort layer when a human is in the loop.

## Brand & voice

- Product name is **SetForge** (capital S, lowercase f). The manual currently uses "SetForge" in many places; that's a known inconsistency, not a different product.
- Solo tier is free. No paid surface for solo athletes.
- Sign-in is Apple-only. No password, email, or magic-link auth.
- No medical advice. No swimming clichés ("dive in", "make a splash" — banned).

## Currency

All references are against `public/manual.html` as of 2026-05-22. Update this folder when shipped features rearrange the solo journey — specifically: first-run flow, generate page layout, save form, Run Mode, Quick-Launch.
