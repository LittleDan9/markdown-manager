#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# scripts/wsl-deploy-backend.sh
# This always runs under an interactive/login shell, so your ~/.zshrc (or ~/.bashrc) is loaded.
# ────────────────────────────────────────────────────────────────────────────

set -e

BACKEND_DIR=$1
REMOTE_USER_HOST=$2
BACKEND_BASE=$3

if [ -z "$BACKEND_DIR" ] || [ -z "$REMOTE_USER_HOST" ] || [ -z "$BACKEND_BASE" ]; then
  echo "$RED❌ Missing required arguments: BACKEND_DIR, REMOTE_USER_HOST, BACKEND_BASE$NC"
  exit 1
fi

source ./scripts/colors.sh

KEY=~/.ssh/id_danbian

echo "$YELLOW🚀 Deploying backend → $REMOTE_USER_HOST$BACKEND_BASE$NC"

# now do the rsync + excludes
rsync -azhq --delete \
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
  --no-perms \
  --no-times \
  --no-group \
  --progress \
  -e "ssh -i $KEY" \
  $BACKEND_DIR/ $REMOTE_USER_HOST:$BACKEND_BASE/

# copy and install systemd service file
scp -q -i $KEY $BACKEND_DIR/markdown-manager-api.service $REMOTE_USER_HOST:/tmp/
ssh -q -T -i $KEY $REMOTE_USER_HOST <<EOH
  sudo cp /tmp/markdown-manager-api.service /etc/systemd/system/markdown-manager-api.service
  sudo systemctl daemon-reload
  sudo systemctl enable markdown-manager-api.service
  cd $BACKEND_BASE
  poetry install --only=main
  poetry run alembic upgrade head
  sudo systemctl restart markdown-manager-api.service
EOH

# test nginx config and reload
ssh -q -T -i $KEY $REMOTE_USER_HOST <<EOH
  sudo nginx -t
  sudo systemctl reload nginx
EOH

echo "$GREEN✅ Backend deployment with migrations complete$NC"