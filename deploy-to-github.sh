#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Swim Workout Generator — GitHub Pages Deployer
# Run this from the "swim workout generator" folder on your computer.
# Requires: git, gh (GitHub CLI) — install gh at https://cli.github.com
# ─────────────────────────────────────────────────────────────────────────────

set -e

REPO_NAME="swim-workout-generator"

echo ""
echo "🏊 Swim Workout Generator → GitHub Pages"
echo "──────────────────────────────────────────"

# 1. Make sure gh is installed
if ! command -v gh &> /dev/null; then
  echo "❌  GitHub CLI (gh) not found."
  echo "    Install it: https://cli.github.com  then run: gh auth login"
  exit 1
fi

# 2. Make sure user is authenticated
if ! gh auth status &> /dev/null; then
  echo "🔑  Logging in to GitHub..."
  gh auth login
fi

# 3. Init git if needed
if [ ! -d ".git" ]; then
  git init
  git branch -m main
fi

# 4. Stage only the web files
git add index.html
git add swim-workout-generator.jsx 2>/dev/null || true  # optional source file

# 5. Commit
git commit -m "🏊 Swim workout generator — initial deploy" 2>/dev/null || \
git commit --allow-empty -m "🏊 Swim workout generator — re-deploy"

# 6. Create GitHub repo (public) or push to existing
if gh repo view "$REPO_NAME" &> /dev/null 2>&1; then
  echo "📦  Repo already exists — pushing..."
  git push origin main 2>/dev/null || git push -u origin main
else
  echo "📦  Creating public GitHub repo: $REPO_NAME"
  gh repo create "$REPO_NAME" --public --source=. --remote=origin --push
fi

# 7. Enable GitHub Pages (deploy from main branch root)
echo "🌐  Enabling GitHub Pages..."
gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  "/repos/$(gh api user --jq .login)/$REPO_NAME/pages" \
  -f source='{"branch":"main","path":"/"}' 2>/dev/null || \
  echo "    (Pages may already be enabled)"

# 8. Get the URL
GITHUB_USER=$(gh api user --jq .login)
PAGES_URL="https://${GITHUB_USER}.github.io/${REPO_NAME}"

echo ""
echo "✅  Done! Your site will be live in ~30 seconds at:"
echo ""
echo "    $PAGES_URL"
echo ""
echo "    (GitHub Pages takes up to 60s on first deploy — refresh if you see a 404)"
