#!/bin/bash
# Scrub leaked GitHub OAuth credentials from git history
# 
# PREREQUISITES:
#   1. REVOKE the credential on GitHub FIRST:
#      Settings → Developer Settings → OAuth Apps → Regenerate secret
#   2. Install git-filter-repo: pip install git-filter-repo
#   3. Ensure you have a clean working directory (no uncommitted changes)
#   4. Back up the repository first
#
# USAGE:
#   ./scripts/scrub-credentials.sh
#
# AFTER RUNNING:
#   1. Force push: git push --force --all && git push --force --tags
#   2. All contributors must re-clone or: git fetch --all && git reset --hard origin/main
#   3. Verify: git log -p --all -S 'a8916caf58825c1269549e13f88a903973967efe'

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
EXPRESSIONS_FILE="$(mktemp)"

# Create expressions file for git-filter-repo
cat > "$EXPRESSIONS_FILE" << 'EOF'
Ov23likBCpFdyxJhTjRL==>your_github_oauth_client_id
a8916caf58825c1269549e13f88a903973967efe==>your_github_oauth_client_secret
EOF

echo "=== Git History Credential Scrub ==="
echo ""
echo "This will rewrite git history to remove leaked credentials."
echo "Expressions file: $EXPRESSIONS_FILE"
echo ""
echo "Contents:"
cat "$EXPRESSIONS_FILE"
echo ""

# Check for git-filter-repo
if ! command -v git-filter-repo &> /dev/null; then
    echo "ERROR: git-filter-repo is not installed."
    echo "Install with: pip install git-filter-repo"
    rm -f "$EXPRESSIONS_FILE"
    exit 1
fi

# Confirm before proceeding
read -p "This will rewrite git history. Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    rm -f "$EXPRESSIONS_FILE"
    exit 0
fi

cd "$REPO_ROOT"

echo "Running git-filter-repo..."
git filter-repo --replace-text "$EXPRESSIONS_FILE" --force

echo ""
echo "=== History rewritten successfully ==="
echo ""
echo "Next steps:"
echo "  1. Verify the scrub: git log -p --all -S 'a8916caf58825c1269549e13f88a903973967efe'"
echo "  2. Force push:       git push --force --all && git push --force --tags"
echo "  3. Notify all contributors to re-clone or reset"

rm -f "$EXPRESSIONS_FILE"
