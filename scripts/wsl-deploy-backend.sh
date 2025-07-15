#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# scripts/wsl-deploy-backend.sh
# This always runs under an interactive/login shell, so your ~/.zshrc (or ~/.bashrc) is loaded.
# ────────────────────────────────────────────────────────────────────────────

set -e

BACKEND_DIR=$1
REMOTE_USER_HOST=$2
BACKEND_BASE=$3

KEY=~/.ssh/id_danbian

# now do the rsync + excludes
rsync -azh --delete \
  --exclude='*.db' --exclude='.venv' \
  -e "ssh -i $KEY" \
  $BACKEND_DIR $REMOTE_USER_HOST:$BACKEND_BASE

# then run migrations & restart
ssh -t -i $KEY $REMOTE_USER_HOST <<EOH
  cd $BACKEND_BASE
  poetry install --only=main
  poetry run alembic upgrade head
  sudo systemctl restart markdown-manager-api.service
EOH

# test nginx config and reload
ssh -t -i $KEY $REMOTE_USER_HOST <<EOH
  sudo nginx -t
  sudo systemctl reload nginx
EOH