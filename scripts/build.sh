#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# scripts/build.sh
# ────────────────────────────────────────────────────────────────────────────

set -e

source ./scripts/colors.sh

FRONTEND_DIR=$1

echo "$YELLOW🔨 Building assets...$NC"
cd $FRONTEND_DIR && npm run build
echo "$GREEN✅ Build complete$NC"