# Demo Video Program — Scope

**Status:** scope-only (2026-06-05). No production yet. Defines a two-tier demo-video
program: (1) the per-audience **walkthrough videos** (already scripted in
`DEMO_WALKTHROUGH.md` + `DEMO_NARRATION.md`), and (2) **short feature snippets
embedded in the manual** (`public/manual.html`) for advanced features that need a
deeper look than the flagship tour gives. This doc covers tier 2 + how the coach
walkthrough hands off to it.

## Why

The coach walkthrough (Run A) is an *overview* — if it also taught every advanced
feature in depth it'd run 30+ minutes and bury the story. Instead:
- Run A stays a tight flagship tour and **points to** deep-dives ("for the full
  curation workflow, see the manual").
- Each advanced feature gets a **60–120s snippet** embedded right in its existing
  manual section, so a coach reading the docs can *watch the exact thing*.

This also future-proofs: new features ship with a manual section already; adding a
snippet is now a defined, repeatable step.

## Two tiers (relationship)

| Tier | Artifact | Length | Lives | Source of truth |
|------|----------|--------|-------|-----------------|
| 1 | Audience walkthroughs (Coach/Lesson/Swimmer/Parent) | 3–8 min | landing page / onboarding / YouTube | `DEMO_WALKTHROUGH.md` |
| 2 | **Manual feature snippets** | 60–120 s | inline in `public/manual.html` sections | **this doc** |

Both reuse the same production pipeline (Chrome-driven capture + ElevenLabs
narration + Final Cut assembly) and the same demo dataset (Riverside Aquatics).

## Snippet inventory (advanced coach features → manual anchor)

Each snippet = one manual section. `snip-id` is the asset/caption base name.
"Manual gap" = section doesn't exist yet and must be authored before/with the snippet.

| snip-id | Feature | Manual anchor | Key beats | Gap? |
|---------|---------|---------------|-----------|------|
| `snip-curation` | Favorites / disfavorites + team defaults | `#favorites-panel` `#disfavorites-panel` | bias the engine toward/away from sets; team-wide defaults cascade to the roster | |
| `snip-curation-impact` | Curation impact report | `#curation-impact` | 30-day reach + effectiveness of your curation | |
| `snip-fanout` | Assign one workout to a group | `#coach-fanout` | generate → assign → per-swimmer rows; intent vs payload | |
| `snip-propagation` | Edit propagation to assigned swimmers | `#coach-propagation` | change once, push to the group | |
| `snip-multilane` | Multi-lane generate | `#multi-lane-generate` | one session, lane-by-lane paces from a lane plan | |
| `snip-psc` | Per-swimmer constraints | `#swimmers` (or new `#constraints`) | injuries/limits the engine respects per athlete | maybe |
| `snip-taper` | Meet-anchored taper | `#training-phase` + events | anchor a meet → auto phase suggestion; meets-only | |
| `snip-practices` | Practices + attendance | `#practices-screen` | schedule, mark done, attendance | |
| `snip-reports` | Reports R1–R6 | `#reports` | mix, adherence, curation, volume | |
| `snip-catalog` | Shared catalog + authoring sets | `#catalog` | browse library; author + tag your own sets | |
| `snip-roster-csv` | Roster CSV export (Hy-Tek) | **new** `#export-roster` | team code, gender/DOB formatting, meet-entry ready | **yes** |
| `snip-calendar` | Team calendar feed + downloads | **new** `#export-calendar` | live subscribe vs download; rotate + warning; no minor PII | **yes** |
| `snip-events` | Typed team events | **new** `#team-events` (or fold into calendar) | kinds + emoji; meets drive taper | **yes** |
| `snip-ownership` | Team ownership transfer | `#teams` (or new) | hand a team to another coach safely | maybe |
| `snip-import` | Bulk athlete import | `#swimmers` | paste CSV, preview, minor flags | |
| `snip-viewas` | View-as (preview swimmer/parent) | `#view-as` | see what a swimmer/parent sees | |

(Trim to the highest-value ~8 for v1; the rest are backlog. Recommended v1 set:
`fanout`, `multilane`, `curation`, `taper`, `reports`, `roster-csv`, `calendar`,
`catalog`.)

## Manual integration

- **Embed pattern (open decision — see below).** Default proposal: a lightweight
  **click-to-play poster thumbnail** per section (not an auto-loaded iframe — keeps
  the manual fast). Clicking opens an inline `<video>` (self-hosted) or a lightbox.
- **Captions required.** The ElevenLabs narration text IS the caption — render a
  `.vtt` per snippet from `DEMO_NARRATION.md`-style lines. (Accessibility + lets the
  manual stay useful muted.)
- **Each snippet section gets:** a one-line "Watch (90s)" affordance + the existing
  prose (video supplements, never replaces, the text).
- **Manual gaps:** author `#export-roster`, `#export-calendar`, `#team-events`
  sections (the export bridges + event kinds shipped 2026-06-05 but aren't in the
  manual yet) — needed regardless of video.

## Production pipeline (reuse)

1. Snippet script + narration (extend `DEMO_WALKTHROUGH.md`/`DEMO_NARRATION.md`
   with a `Snippets` section; same scene-ID discipline, ids = `snip-*`).
2. Drive Chrome against the Riverside demo data; capture per snippet.
3. Render narration WAV per snippet (ElevenLabs) + a `.vtt` caption.
4. Assemble in Final Cut → export web-optimized MP4 (H.264, 1080p, faststart).
5. Host + embed in the manual section (per the hosting decision).

## Open decisions

1. **Hosting/format.** ✅ **DECIDED 2026-06-05 — object store / CDN** (e.g.
   Cloudflare R2 or S3 + CDN): no third-party branding, no Hyperlift video
   bandwidth, small ongoing cost. Manual embeds reference the CDN URL; captions
   (`.vtt`) hosted alongside. (Rejected: self-host in `public/` bloats deploy;
   YouTube/Vimeo adds third-party branding.) Still to pick: which provider + bucket.
2. **Embed UX.** Click-to-play thumbnail (proposed) vs inline autoload vs
   "Watch" link out. Perf + simplicity favor click-to-play.
3. **v1 snippet set** — confirm the ~8 above vs a smaller pilot (start with 3:
   `fanout`, `taper`, `reports`?).
4. **Branding/intro** — cold-open straight into the feature, or a 2s SetForge bumper
   per snippet? (Bumper helps if hosted on YouTube.)
5. **Maintenance policy** — UI changes stale a snippet. Policy: re-record on major
   UI change to that surface; otherwise leave. Track snippet → feature owner.

## Out of scope (for this doc)
- The tier-1 audience walkthroughs themselves (covered by `DEMO_WALKTHROUGH.md`).
- In-app contextual help/tooltips (separate from the manual).
- Localization / multi-language narration.

## Deliverables / phasing
- **Phase 0 (now):** this scope + decisions 1–3 resolved.
- **Phase 1:** author the 3 manual gaps (`export-roster`, `export-calendar`,
  `team-events`) as text (useful immediately, video-independent).
- **Phase 2:** produce the v1 snippet set + embed.
- **Phase 3:** backlog snippets as demand/feature-launches dictate.
