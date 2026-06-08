# SetForge — Demo Walkthrough Scripts (multi-audience)

Several **separate recordings**, one per audience, that **share a single demo
dataset**. The dataset is built once in **Run A** (team build + athlete import) and
reused by the swimmer/parent runs. Data persists across runs — clean up afterward.

Driven live in Chrome via the Claude-in-Chrome MCP; you record the screen. Each
scene = goal + narration beat + click path. Labels marked "(confirm live)" are
verified against the page when driving. I act in discrete steps (deliberate,
guided-tour pace) — say **"pause / redo scene / next"** anytime.

---

## Shared prerequisites

- **Chrome extension connected**, tab on `https://setforge.io`.
- **Sign-in is not automated** (OAuth popups/2FA) — be signed into the right
  account *before* each run. I narrate the sign-in screen but don't complete it.
- Use **test/demo accounts**, not real swimmer data.

### Demo accounts needed (one per audience)
| Run | Account | Notes |
|-----|---------|-------|
| A — Head coach | coach (coach-enabled), **fresh** | builds the shared data |
| B — Lesson coach | coach on **Lesson** tier | own managed swimmers + lessons |
| C — Swimmer | a swimmer account **in Senior Squad** | link during Run A setup |
| D — Parent | a guardian of an imported swimmer | link during Run A setup |

> **Linking C & D to the shared data** (do during/after Run A): add the swimmer
> account to the `Senior Squad` group (join code), and add the parent as a guardian
> of one imported swimmer. These let the swimmer/parent runs show real data + the
> team calendar. (If linking is fiddly, those runs can use their own minimal data.)

### Shared dataset (created in Run A)
- Team **Riverside Aquatics**, code **RIV**, facility **Riverside Natatorium**.
- Group **Senior Squad** (SCY).
- 8 imported athletes (CSV below).
- A generated workout assigned to the group; events **Spring Invitational** (meet) +
  **Picture Day**; a taper anchor on the meet.

### Sample athlete CSV (Run A, Scene 3 — paste into the import box)
```
first_name,last_name,preferred_name,dob,gender,pace_scy_100
Mia,Thompson,,2010-03-15,F,1:18
Liam,Carter,,2009-07-22,M,1:09
Sofia,Nguyen,Sof,2011-01-30,F,1:25
Ethan,Brooks,,2008-11-05,M,1:04
Ava,Martinez,,2012-06-18,F,1:33
Noah,Patel,,2010-09-12,M,1:15
Grace,Kim,,2009-04-03,F,1:11
Owen,Reilly,,2011-12-20,M,1:22
```

---

# Run A — Head Coach / Team (the flagship; builds the data)

**Audience:** club / high-school head coach or team admin.
**Account:** fresh coach. **Length:** longest run.

1. **Landing + sign-in** (narration). Value prop, then land on **🧭 Coach home**.
2. **Coach home orientation** — walk the cards (Managed swimmers, My groups, My
   Sets, Teams, Practices, Catalog, Reports) + the Generate CTA.
3. **Build the team** — Teams → Create `Riverside Aquatics` (Club). Open it →
   **Settings**: set **🏷 Team code = RIV**; add facility `Riverside Natatorium`
   (SCY, 8 lanes, address) → **📍 Map** to show the pin *(skip if MapKit unset)*.
4. **Create group** — Groups → `Senior Squad` (SCY).
5. **Import athletes** — Managed swimmers/Roster → **Bulk import** → paste the CSV →
   show preview → team = Riverside → **Import**. *(This is the data seed.)*
6. **Add athletes to the group** — `Senior Squad` → add the imported swimmers.
7. **Generate + assign** — Generate a workout → set type/yardage → Generate →
   **assign to Senior Squad** (fanout) → show per-lane paces.
8. **Events + kinds** — Events → `Spring Invitational` (**Meet 🏊**) + `Picture Day`
   (**📸**). Point out per-type emoji and that only the meet has **🎯 Anchor** →
   set the meet as anchor for Senior Squad → show suggested phase.
9. **Exports** — Roster tab → **⬇ Roster CSV** (open it: RIV, MALE/FEMALE,
   MM/DD/YYYY). Settings → **📆 Calendar feed** → Copy (mention rotate + its
   warning; don't rotate).
10. **Wrap** — "Empty account → built team, roster, assigned workout, typed
    schedule, exports."

# Run B — Lesson-tier Coach (1:1 / small-group instructor)

**Audience:** independent lesson coach (Lesson tier). **Account:** lesson-tier coach.
**Data:** own managed swimmers (can reuse Run A's import flow on this account, or a
couple of hand-added swimmers with **levels**).

1. **Sign-in → Coach home** (note: Lesson tier shows Roster/Groups/My Sets; Teams &
   Reports are Coach-only — call this out).
2. **Managed swimmer detail** — open a swimmer → show **lesson level**
   (beginner/intermediate/advanced), **per-swimmer equipment**, parents.
3. **Lesson groups** — My groups → a small lesson group.
4. **Generate a Lesson** — Generate → **Lesson** type → show the 3-section shape
   (Warm-Up / Skill Focus / Send-off), the **level selector**, and **My-sets-only**
   toggle. Generate for a swimmer (uses their level + equipment).
5. **My Sets (lesson)** — My Sets → author a set tagged **lesson** + a **level**.
6. **Parent recap** — from a generated lesson → **Send recap to parent** (show the
   button + that it emails the guardian a one-pager).
7. **Wrap** — "Built for teaching 4-year-olds to masters, with parent-facing recaps."

# Run C — Swimmer (athlete)

**Audience:** a swimmer using SetForge solo or within a team.
**Account:** swimmer in Senior Squad.

1. **Sign-in → home/greeting** — personalized greeting; if in a group, the upcoming
   **event pill**.
2. **Generate own workout** — set level/type/yardage → Generate → show the set.
3. **Join a group** (if not already) — Profile → **Join group** with a code.
4. **Log a workout** — run/complete a workout → log it.
5. **Progress dashboard** — **📈 Progress** → volume trend + PRs.
6. **Team calendar** — Profile → **📆 Team calendar** → **⬇ Download .ics** → opens
   in calendar app.
7. **Wrap.**

# Run D — Parent

**Audience:** parent/guardian of a team swimmer.
**Account:** guardian of an imported swimmer.

1. **Sign-in → 👪 Parent view** — swimmer selector; weekly digest stats (volume,
   scheduled).
2. **Per-swimmer digest** — select a swimmer → recent activity.
3. **Team calendar** — **📆 Team calendar** → **⬇ Download .ics** (note: shows only
   the kid's team; no private data in the file).
4. **Digest email control** — show the pause-digest toggle.
5. **Wrap** — "Parents get visibility without a login maze; MAAP-aligned."

---

## Editing handoff (Final Cut Pro)

Goal: every scene is a self-contained pair (screen clip + voiceover clip) with
matching names, so in FCP you drop them on the timeline in ID order per audience.

**Naming (shared across screen + audio + script):** the scene IDs — `A1`–`A10`,
`B1`–`B7`, `C1`–`C7`, `D1`–`D5`.
- Audio (I render): `scene-A1.wav`, `scene-A2.wav`, … in `demo-assets/audio/`.
- Screen (you record): name each capture to match, e.g. `scene-A1.mov`. If you
  prefer one continuous capture per run, that's fine — split on the scene
  boundaries (the narration clip lengths tell you where).

**Per-audience FCP project = its run's scenes in order:**
- *Head Coach* video = A1 … A10. *Lesson Coach* = B1 … B7. *Swimmer* = C1 … C7.
  *Parent* = D1 … D5.

**Recommended capture approach:** record **one clip per scene** (start/stop around
each scene). Cleanest sync — each `scene-X.mov` pairs with `scene-X.wav`, and a
re-do is just one scene, not the whole run. Continuous capture also works; you'll
just slice it.

**Audio format for editing:** I'll render **WAV (PCM, 44.1 kHz)** rather than MP3 —
lossless and friendlier for FCP. (ElevenLabs `pcm_44100`, wrapped to .wav.) Say the
word if you'd rather have MP3.

**Manifest:** alongside the audio I'll drop `demo-assets/manifest.csv` mapping
`scene_id, run, audio_file, duration_sec, spoken_line` — so in FCP you can see at a
glance which clip is which and how long each beat runs.

**Pacing tip:** I drive in discrete steps, so the raw screen capture will have small
dead spots between actions. In FCP, trim those and let the voiceover clip set each
scene's length (ripple the video to fit the narration, or vice-versa).

## Notes / risks
- **No destructive/financial actions**; all creates land on demo accounts. You
  clean up afterward.
- **Recording order:** run **A first** (creates shared data), then C/D (consume it),
  B standalone. Re-runs are fine — data accumulates; clean up later.
- **Downloads** (Roster CSV, .ics) land in your Downloads folder during capture.
- **MapKit map** renders only if `MAPKIT_TOKEN` is set + origin covers the demo
  domain.
- **Linking swimmer/parent accounts** to the shared team is a manual setup step
  (join code + guardian add) — easiest to do at the end of Run A.
- If a label differs from this script, I read the live page and adapt.
