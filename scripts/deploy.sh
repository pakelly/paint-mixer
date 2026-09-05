#!/bin/bash
set -e
cd "$(dirname "$0")/.."

# ── Generic GitHub Pages Deploy Script ──
# For single-file or multi-file static sites.
# Works by copying tracked files from main to gh-pages.
#
# Usage:
#   ./scripts/deploy.sh                # Deploy from main to gh-pages
#   ./scripts/deploy.sh "commit msg"   # Override commit message

REPO_NAME=$(basename "$(git rev-parse --show-toplevel)")
BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [ "$BRANCH" != "main" ]; then
  echo "⚠️  Currently on branch '$BRANCH'. Switching to main first."
  git checkout main
fi

# Files to deploy: all tracked files on main (excluding scripts/ and .gitignore)
DEPLOY_FILES=$(git ls-files --cached | grep -v '^scripts/' | grep -v '^\.gitignore$' | grep -v '^README.md$' | grep -v '^docs/' | grep -v '^parse_and_split.py$' | tr '\n' ' ')

if [ -z "$DEPLOY_FILES" ]; then
  echo "❌ No files found to deploy. Aborting."
  exit 1
fi

echo "=== Deploying $REPO_NAME to gh-pages ==="
echo "  Files: $DEPLOY_FILES"
echo ""

echo "=== Step 1: Push main to origin ==="
git push origin main

echo ""
echo "=== Step 2: Switch to gh-pages ==="
git checkout gh-pages

echo ""
echo "=== Step 3: Copy files from main ==="
for f in $DEPLOY_FILES; do
  git checkout main -- "$f"
  echo "  ✓ $f"
done

echo ""
echo "=== Step 4: Remove any files on gh-pages that don't exist on main ==="
MAIN_FILES=$(echo "$DEPLOY_FILES" | tr ' ' '\n' | sort)
GH_PAGES_FILES=$(git ls-files --cached | sort)
for f in $GH_PAGES_FILES; do
  if ! echo "$MAIN_FILES" | grep -qx "$f"; then
    git rm --cached "$f" 2>/dev/null && echo "  🗑  Removed stale: $f"
  fi
done

echo ""
echo "=== Step 5: Commit and push ==="
git add -A
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
echo "✅ Deployed to gh-pages. Verify at your site URL."
