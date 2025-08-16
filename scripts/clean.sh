#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# scripts/clean.sh
# ────────────────────────────────────────────────────────────────────────────

set -e

source ./scripts/colors.sh

FRONT_DIST_DIR=$1
BACKEND_DIR=$2

echo "$YELLOW🧹 Cleaning local...$NC"
rm -rf $FRONT_DIST_DIR frontend/node_modules/.cache
rm -rf $BACKEND_DIR/__pycache__ $BACKEND_DIR/.pytest_cache
echo "$GREEN✅ Clean complete$NC"