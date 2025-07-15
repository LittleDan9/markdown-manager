#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# scripts/wsl-deploy-backend.sh
# This always runs under an interactive/login shell, so your ~/.zshrc (or ~/.bashrc) is loaded.
# ────────────────────────────────────────────────────────────────────────────

set -e

FRONTEND_DIR=$1
REMOTE_USER_HOST=$2
FRONTEND_BASE=$3

KEY=~/.ssh/id_danbian

# now do the rsync + excludes
rsync -azh --delete \
  -e "ssh -i $KEY" \
  $FRONTEND_DIR $REMOTE_USER_HOST:$FRONTEND_BASE

