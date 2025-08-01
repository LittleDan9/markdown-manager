#!/usr/bin/env bash
set -e

BACKEND_DIR=$1
REMOTE_USER_HOST=$2
DOCKER_IMAGE=littledan9/markdown-manager:latest
KEY=~/.ssh/id_danbian

source ./scripts/colors.sh

if [ -z "$BACKEND_DIR" ] || [ -z "$REMOTE_USER_HOST" ]; then
  echo "$RED❌ Missing required arguments: BACKEND_DIR, REMOTE_USER_HOST$NC"
  exit 1
fi

echo "$YELLOW🚀 Building Docker image → $DOCKER_IMAGE$NC"
docker build -t $DOCKER_IMAGE -f Dockerfile.backend .

echo "$YELLOW🚀 Pushing Docker image to registry$NC"
docker push $DOCKER_IMAGE

echo "$YELLOW🚀 Deploying backend container on $REMOTE_USER_HOST$NC"
# Copy and install systemd service file
scp -q -i $KEY $BACKEND_DIR/markdown-manager-api.service $REMOTE_USER_HOST:/tmp/

ssh -q -T -i $KEY $REMOTE_USER_HOST <<'EOH'
  set -e
  # Prompt for Docker login if not already logged in
  if ! docker info | grep -q 'Username:'; then
    echo "Docker login required. Please login manually."
    docker login
  fi
  sudo cp /tmp/markdown-manager-api.service /etc/systemd/system/markdown-manager-api.service
  sudo systemctl daemon-reload
  sudo systemctl enable markdown-manager-api.service

  docker pull littledan9/markdown-manager:latest
  sudo systemctl restart markdown-manager-api.service
EOH


# Copy nginx config files to the remote host
echo "$YELLOW🚀 Syncing nginx config files to $REMOTE_USER_HOST:/etc/nginx$NC"
rsync -azhq \
  --exclude='*.swp' \
  --exclude='.DS_Store' \
  --exclude='scripts/' \
  --no-perms \
  --no-times \
  --no-group \
  --progress \
  -e "ssh -i $KEY" \
  ./nginx/ $REMOTE_USER_HOST:/etc/nginx/

ssh -q -T -i $KEY $REMOTE_USER_HOST <<'EOH'
  sudo ln -s /etc/nginx/sites-available/littledan.com /etc/nginx/sites-enabled/
  sudo nginx -t
  sudo systemctl reload nginx
EOH

echo "$GREEN✅ Backend Docker deployment complete$NC"