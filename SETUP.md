# Swim Workout Generator — Hyperlift Setup

This is a single-container Node.js app: it serves the static page AND a small REST API that commits history entries to `workouts.json` in this repo. Everything deploys via `git push` once Hyperlift is wired up.

You'll do this once. ~10 minutes end-to-end.

## What's in this repo

```
.
├── Dockerfile           # node:20-alpine, runs server.js
├── package.json         # Express dependency
├── server.js            # API + static file server (~140 lines)
├── public/
│   └── index.html       # the page
├── workouts.json        # history file (read/written via GitHub API)
└── SETUP.md             # this file
```

## Step 1 — Create a fine-grained GitHub token

The server needs to write to `workouts.json` in this repo.

1. Go to https://github.com/settings/personal-access-tokens/new
2. **Token name:** `swim-workout-history`
3. **Expiration:** 1 year (or whatever — you'll need to rotate when it expires)
4. **Resource owner:** your account (`delbraeth`)
5. **Repository access** → **Only select repositories** → pick `swim-workout-generator`
6. **Permissions** → expand **Repository permissions** → set **Contents** to **Read and write**
7. Click **Generate token** and copy the value

> Token is scoped to just this one repo with just contents:write — worst case if it leaks is "someone could vandalize this single file," recoverable from git history.

## Step 2 — Connect this repo to Hyperlift

In the Spaceship/Hyperlift dashboard:

1. **New app** → **Deploy from GitHub** → select `delbraeth/swim-workout-generator`
2. **Branch:** `main`
3. **Build:** Dockerfile (auto-detected from `Dockerfile` in the repo root)
4. **Port:** `8080` (the Dockerfile exposes this and the server reads `PORT`)

## Step 3 — Set environment variables

In the Hyperlift app's **Environment** / **Settings** tab, add:

| Key            | Value                                 | Notes                                        |
|----------------|---------------------------------------|----------------------------------------------|
| `GITHUB_TOKEN` | *(the token from Step 1)*             | Mark as **secret** so it's hidden in the UI  |
| `GITHUB_OWNER` | `delbraeth`                           | Already the default; only set if you fork    |
| `GITHUB_REPO`  | `swim-workout-generator`              | Already the default                          |
| `GITHUB_BRANCH`| `main`                                | Already the default                          |
| `GITHUB_PATH`  | `workouts.json`                       | Already the default                          |

`PORT` is set by Hyperlift automatically — don't add it yourself.

## Step 4 — Push and deploy

```bash
cd "swim workout generator"
git add .
git commit -m "Move to Hyperlift container deploy"
git push
```

Hyperlift should pick up the push, build the Docker image, and deploy. Watch the build log in the dashboard until it goes green.

## Step 5 — Test

Open the URL Hyperlift gave you (something like `https://swim-workout-generator.hyperlift.app`).

1. Confirm the page loads (you should see the workout generator UI)
2. `curl https://your-app-url/healthz` — should return `{"ok":true,"service":"swim-workout-generator"}`
3. Generate a workout, click **💾 Save to History**
4. Within a few seconds you should see `✓ Saved`
5. Within ~5 seconds the GitHub repo should show a new commit touching `workouts.json` (no Hyperlift redeploy needed — the API talks to GitHub directly without changing the container's source)
6. Click the **📜 History** button in the top-right — your saved workout should be there

## Step 6 — Disable the old GitHub Pages site (optional)

The old `delbraeth.github.io/swim-workout-generator/` URL no longer has a working History tab (because the API moved to Hyperlift). You can either:

- **Disable Pages:** repo → **Settings** → **Pages** → set Source to **None**
- **Leave it as a fallback:** the generator and Print still work there; only History/Save will be broken

## How saves actually flow

1. User clicks **Save to History** → page POSTs `/api/log-workout` to the same Hyperlift origin
2. Server checks Origin matches Host (basic anti-CSRF) → reads `workouts.json` from GitHub via API → appends entry → commits with the PAT
3. The next page load (or the next API GET) returns the updated list, with a 30-second TTL cache to avoid pounding the GitHub API
4. The Hyperlift container's source isn't touched — the commit goes straight to `workouts.json` on `main`. No redeploy churn

## Troubleshooting

- **`/api/log-workout` returns 403 "forbidden: cross-origin request"** → the Origin header didn't match Host. If you're calling with curl, set `ALLOW_NO_ORIGIN=true` env var (only for testing).
- **`/api/log-workout` returns 500 with "GitHub read 404"** → `workouts.json` doesn't exist in the repo. Make sure it was pushed (it should be there as `[]`).
- **`/api/log-workout` returns 500 with "GitHub write 401"** → the PAT is wrong, expired, or doesn't have contents:write on this repo.
- **Saves succeed but History stays empty on next page load** → check the GitHub API rate limit. The server caches reads for 30s; if you're hitting throttling, increase the TTL in `server.js`.

## Updating the app later

Just push:

```bash
git add .
git commit -m "your change"
git push
```

Hyperlift rebuilds and redeploys automatically. Saves you'd already made stay intact (they live in `workouts.json` on GitHub, not in the container).

## Rotating the token

When the GitHub PAT expires:

1. Generate a new one (Step 1)
2. Update `GITHUB_TOKEN` in Hyperlift's env vars
3. The app picks up the new value on the next restart (or trigger a manual redeploy)
