#!/bin/bash
set -e
cd "$(dirname "$0")/.."

# ── Generic GitHub Pages Deploy Script ──
# Deploys web-facing files from main to gh-pages.
#
# Configure WEB_FILES below with the files your site needs.
# Usage:
#   ./scripts/deploy.sh                # Deploy from main to gh-pages
#   ./scripts/deploy.sh "commit msg"   # Override commit message

REPO_NAME=$(basename "$(git rev-parse --show-toplevel)")
BRANCH=$(git rev-parse --abbrev-ref HEAD)

# ── CONFIG: Web files to deploy (edit per repo) ──
# List only files that should be served on the live site.
WEB_FILES=""
if [ -f "paint-mixer.html" ]; then
  WEB_FILES="paint-mixer.html"
elif [ -f "index.html" ] && [ -f "app.js" ]; then
  WEB_FILES="index.html app.js style.css data.json"
elif [ -f "index.html" ]; then
  WEB_FILES="index.html"
fi

# Allow override via .web-files config
if [ -f ".web-files" ]; then
  WEB_FILES=$(cat .web-files)
fi

if [ -z "$WEB_FILES" ]; then
  echo "❌ No web files detected. Create a .web-files file listing deploy targets."
  exit 1
fi

if [ "$BRANCH" != "main" ]; then
  echo "⚠️  Currently on branch '$BRANCH'. Switching to main first."
  git checkout main
fi

echo "=== Deploying $REPO_NAME to gh-pages ==="
echo "  Files: $WEB_FILES"
echo ""

echo "=== Step 1: Push main to origin ==="
git push origin main

echo ""
echo "=== Step 2: Switch to gh-pages ==="
git checkout gh-pages

echo ""
echo "=== Step 3: Copy web files from main ==="
for f in $WEB_FILES; do
  if [ -f "$f" ]; then
    git checkout main -- "$f"
    echo "  ✓ $f"
  fi
done

echo ""
echo "=== Step 4: Remove any files on gh-pages that aren't in the deploy list ==="
DEPLOY_LIST=$(echo "$WEB_FILES" | tr ' ' '\n' | sort)
for f in $(git ls-files --cached); do
  if ! echo "$DEPLOY_LIST" | grep -qx "$f"; then
    git rm --cached "$f" 2>/dev/null && echo "  🗑  Removed stale: $f"
  fi
done

echo ""
echo "=== Step 5: Commit and push ==="
git add $WEB_FILES
COMMIT_MSG="${1:-Deploy: latest from main}"
if git diff --cached --quiet; then
  echo "No changes to commit (gh-pages already up to date)."
else
  MAIN_MSG=$(git log main -1 --format="%s")
  git commit -m "Deploy: $MAIN_MSG"
fi
git push origin gh-pages

echo ""
echo "=== Step 6: Switch back to main ==="
git checkout main

echo ""
echo "✅ Deployed to gh-pages."
