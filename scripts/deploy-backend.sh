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
  --exclude='*.db' \
  --exclude='.venv' \
  --exclude='__pycache__' \
  --exclude='tests' \
  --exclude='.mypy_cache' \
  --exclude='.pytest_cache' \
	--exclude='*.pyc' \
	--exclude='*.pyo' \
	--exclude='*.log' \
	--exclude='*.egg-info' \
	--exclude='*.egg' \
	--exclude='.vscode' \
	--exclude='markdown-manager-api.service' \
  -e "ssh -i $KEY" \
  $BACKEND_DIR/ $REMOTE_USER_HOST:$BACKEND_BASE/

# copy and install systemd service file
scp -i $KEY $BACKEND_DIR/markdown-manager-api.service $REMOTE_USER_HOST:/tmp/
ssh -t -i $KEY $REMOTE_USER_HOST <<EOH
  sudo cp /tmp/markdown-manager-api.service /etc/systemd/system/markdown-manager-api.service
  sudo systemctl daemon-reload
  sudo systemctl enable markdown-manager-api.service
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