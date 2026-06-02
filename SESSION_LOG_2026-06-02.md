# Session Log — 2026-05-31 → 2026-06-02

Multi-day working session: shipped features (kick set, iOS editing tools, dryland,
coach tools), bug fixes, web Practices screen, full Apple IAP build-out, and a
large set of spec docs. This is the durable record of **what shipped, what was
decided, and what's still TODO**.

Branch: `build-3` (in sync with `origin/build-3`). Web live at build `f80b75d`.
iOS uploaded build: **8** (project file at 8). Held iOS fixes await **build 9**.

---

## 1. Shipped & LIVE (web deployed + verified)

| Feature | Notes | Commit-ish |
|---|---|---|
| **Kick set** (opt-in 5th section) | default OFF, inline drill→kick→main; web engine + iOS. Placeholder sets (board kick/descend/dolphin/IM-order). Server `SECTION_NAMES` had to include "kick". | engine in index.html |
| **Workout editing → iOS** | edit interval/desc/round-rest, swap set, rescale pace, fav/disfavor, regenerate section. New `POST /api/regenerate-section` + `regenerateSection` export in lib/generator.js. | — |
| **Dryland add/remove + explainers** | iOS DrylandCatalog (mirrors web DRYLAND_OPTIONS verbatim) + DrylandGlossary (49 explainers). Web hover tooltip + iOS tap sheet. | — |
| **Attendance cleanup** | shared `extractScheduledWorkoutGroupId` helper; fixed coach-fanout empty-roster bug; accurate attendance_count. | — |
| **Web Practices screen** | coach 🔧 dropdown → 📋 Practices; lists scheduled practices, opens existing MarkPracticeDoneModal. Additive (week-view button kept). | c3b693f |
| **iOS coach tools** | is_coach gating, "Generate for" target picker (assign_to fanout), multi-lane generate (lanesPaceSecs), coach notes, team+individual event pills on home card. | — |
| **Apple IAP server** | lib/appleIap.js (verify + ASSN v2 + grantTier seam), routes, Apple Root CA G3 cert, double-pay reconciliation. ACTIVE in Sandbox. | — |

### Bug fixes shipped to web
- **iOS profile black screen** — `.sheet(item:)` data-driven (was `isPresented` + nil me).
- **Me decoded to nil** — `providers` and `stats_by_pool` are ARRAYS (server sends arrays of objects), were typed dict/[String]; gave `Me` a tolerant per-field init. This was the real cause of greyed Edit-profile + hidden Practices.
- **Kick silently dropped on iOS** — server `/api/generate` `SECTION_NAMES` omitted "kick" → filtered out. Added.
- **Over-long workout id** — `entry.id` > VARCHAR(32) → opaque SQL 1406. Added 32-char + charset validation → clean 400.
- **Dryland hover** — `DRYLAND_EXPLAINERS` shipped but consumer markup never did (silent failed edit); re-wired title tooltip + ⓘ.
- **managed_id is a string** (`ms_xxxxxx`), not Int — server `Number()`-mangled it to NaN→null; iOS typed `Int?`. Broke managed-swimmer coach notes/RSVP/roll-call. **Server half DEPLOYED; iOS half held for build 9.**

---

## 2. Apple IAP — full status

**Architecture:** every channel resolves to `users.tier` via `grantTier`/`revokeTier`;
`tier_source` records channel (`stripe_sub_*` / `apple_iap_*` / `admin_*`). Web=Stripe,
iOS=Apple, same tier seam. Migration 043 adds `apple_original_transaction_id` +
`apple_iap_events`. See `IAP_PLAN.md` for the activation runbook.

### Live in prod (Sandbox)
- `APPLE_IAP_CONFIG` env SET — `IAP_ACTIVE=true`, environment **Sandbox**, 2 products.
  - bundle_id `com.delbraeth.swimworkout`, issuer `17e5e10c-…`, key_id `D89CK78P79`,
    app_apple_id `6775248240`. (Validated EC P-256 key.)
- Apple Root CA - G3 cert deployed to `lib/apple-certs/`.
- `@apple/app-store-server-library` ^3.1.0 installed.
- Routes live: `POST /api/billing/apple/verify`, `POST /api/billing/apple/notify`,
  `GET /api/billing/apple/eligibility`. Verified end-to-end (junk payload →
  `notification_verify_failed`, i.e. cert+verifier working).
- Double-pay reconciliation deployed (server): checkout 409 if Apple active;
  /eligibility pre-check; verify grants-but-warns on cross-channel.

### Product IDs (must match ASC ↔ server ↔ iOS — verified identical)
- `com.delbraeth.swimworkout.coach.monthly` → coach
- `com.delbraeth.swimworkout.program.yearly` → program

### Review screenshot
- Paywall mockup generated → `ios-app/iap-assets/coach-paywall-review.png` (gitignored)
  + `~/Desktop/SetForge-Coach-paywall-review.png`. 1290×2796.

### iOS IAP (committed, NOT in a shipped build yet — rides build 9)
- AppConfig.iapProductIDs filled; PaywallView reachable via "Upgrade to Coach"
  menu item (free-tier only); StoreKitManager.listenForTransactions() at launch;
  eligibility pre-check before purchase.
- ⚠️ **In-App Purchase capability NOT in entitlements.** StoreKit 2 usually works
  without it; if sandbox product-load fails, add in Xcode → Signing & Capabilities
  → + In-App Purchase, re-archive.

---

## 3. Key decisions (locked)

- **Env vars maxed at 20.** `APP_URL` removed (defaults to https://setforge.io —
  verify OAuth redirect stays registered). `STRIPE_CONFIG` is the active blob;
  there are NO individual STRIPE_* vars to delete. DB vars (DB_HOST/PORT/USER/
  PASSWORD/NAME) count toward the 20. Future headroom = consolidate Apple-auth
  (5→1 APPLE_CONFIG) or DB (5→1) into a blob — both mirror STRIPE_CONFIG, both
  unbuilt.
- **Stripe + IAP coexist**, same tier. Double-pay guard blocks cross-channel.
- **Coach roll-call is coach-side only** — there is NO swimmer RSVP anywhere yet
  (RSVP is spec'd in MEET_SCHEDULE_WEATHER_SCOPE, unbuilt).
- **Migrations apply manually to prod** (no runner). 043 written; apply before IAP
  notifications need the events table.
- **Deploy = `_deploy.py`** writes a FILES list to GitHub main via API; Hyperlift
  rebuilds (Dockerfile COPY lib/ etc.). New files MUST be added to FILES or they
  never reach GitHub. `_deploy.py` is gitignored (local tool).
- **Hyperlift lag** ~2–4 min on deploy; ALWAYS poll the live BUILD_ID + a route
  before trusting a deploy.

---

## 4. TODO / pending

### Immediate (gated on next iOS build = build 9)
- [ ] **Cut build 9** — carries: (a) iOS managed_id String fix (server half already
      live; managed-swimmer coach notes still broken on build 8 until this ships),
      (b) the IAP client (paywall/product IDs/listener — already in build 8 too).
- [ ] **Sandbox-test IAP** end-to-end: sandbox tester → Upgrade to Coach → buy →
      verify tier flips to coach. (User drives; Claude debugs.)
- [ ] If sandbox products don't load → add In-App Purchase capability (build 10).

### Before IAP production launch
- [ ] Flip `APPLE_IAP_CONFIG.environment` Sandbox → Production.
- [ ] Finish ASC product completeness (display name + description + price +
      review screenshot) for BOTH products; confirm both in one subscription group.
- [ ] Apply migration 043 to prod DB (for apple_iap_events idempotency).

### Deferred features (spec'd, unbuilt)
- [ ] **Team calendar + venues + weather + RSVP** — `MEET_SCHEDULE_WEATHER_SCOPE.md`
      (full functional spec, band L). Needs: shared `venues` table, WeatherKit key,
      geocoder, and **push infra (does not exist — shared blocker for all
      notify features)**.
- [ ] Multi-lane OUTPUT rendering on iOS (sends lanesPaceSecs, renders one workout).
- [ ] Favorite initial-state preload on reopened saved workouts (iOS).
- [ ] iOS coach roll-call not documented in the user manual.

### Housekeeping
- [ ] Stray `config` file (SSH config) + `__pycache__` are gitignored; fine.
- [ ] Kick set ships PLACEHOLDER content — user to supply real kick sets anytime.

---

## 5. Gotchas worth remembering
- **Terminal garble on public/index.html** — use Read/Edit tools, never sed/grep
  for editing; node-extract for inspection. (Edit tool itself is fine.)
- **Subagent reports over-claim** — always ground-truth their facts (several were
  wrong this session: "no lanesPaceSecs support" [false], "is_coach not in
  bootstrap" [false], "stale version marker in manual" [false]).
- **Synthesized Swift Decodable is brittle** — one field type-mismatch nils the
  whole object via Bootstrap's `try?`. Prefer tolerant per-field `init(from:)`
  (Me, Workout, Bootstrap idiom).
- **`_deploy.py` FILES list ≠ Dockerfile COPY.** Deploy writes individual files to
  GitHub; Dockerfile copies whole dirs at build. A NEW file absent from FILES
  never reaches GitHub, so the container build can't see it.
