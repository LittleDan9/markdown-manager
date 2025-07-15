#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# scripts/deploy-frontend.sh
# ────────────────────────────────────────────────────────────────────────────

set -e

source ./scripts/colors.sh


FRONTEND_DIR=$1
REMOTE_USER_HOST=$2
FRONTEND_BASE=$3

KEY=~/.ssh/id_danbian
if [ -z "$FRONTEND_DIR" ] || [ -z "$REMOTE_USER_HOST" ] || [ -z "$FRONTEND_BASE" ]; then
  echo "$RED❌ Missing required arguments: FRONTEND_DIR, REMOTE_USER_HOST, FRONTEND_BASE$NC"
  exit 1
fi

echo "$YELLOW🌐 Deploying frontend → $REMOTE_USER_HOST:$FRONTEND_BASE$NC"

echo "$YELLOW🧹 Cleaning...$REMOTE_USER_HOST:$FRONTEND_BASE$NC"
ssh -i $KEY $REMOTE_USER_HOST "rm -rf $FRONTEND_BASE/*"
# now do the rsync + excludes

echo "$YELLOW📦 Syncing files...$NC"
rsync -azhq --delete \
  -e "ssh -i $KEY" \
  --no-perms \
  --no-times \
  --no-group \
  --progress \
  $FRONTEND_DIR/ $REMOTE_USER_HOST:$FRONTEND_BASE/

echo "$GREEN✅ Frontend deployment complete$NC"