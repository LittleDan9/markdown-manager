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

# Get image ID for comparison
IMAGE_ID=$(docker images -q $DOCKER_IMAGE)
echo "Built image ID: $IMAGE_ID"

# Check if remote has the same image
echo "$YELLOW🔍 Checking if remote already has this image...$NC"
REMOTE_IMAGE_ID=$(ssh -q -i $KEY $REMOTE_USER_HOST "docker images -q $DOCKER_IMAGE 2>/dev/null || echo 'none'")

if [ "$IMAGE_ID" = "$REMOTE_IMAGE_ID" ] && [ "$REMOTE_IMAGE_ID" != "none" ]; then
  echo "$GREEN✅ Remote already has the same image, skipping transfer$NC"
  SKIP_IMAGE_TRANSFER=true
else
  echo "$YELLOW📦 Image differs or doesn't exist on remote, preparing transfer...$NC"
  SKIP_IMAGE_TRANSFER=false

  # Use ramcache if available for faster I/O
  if [ -d ~/ramcache ]; then
    TAR_DIR=~/ramcache/markdown-manager
    mkdir -p $TAR_DIR
    TAR_FILE=$TAR_DIR/markdown-manager-image.tar.gz
    echo "$YELLOW🚀 Saving compressed Docker image to ramcache ($TAR_FILE)$NC"
  else
    TAR_FILE=/tmp/markdown-manager-image.tar.gz
    echo "$YELLOW🚀 Saving compressed Docker image to tar file$NC"
  fi

  # Save with compression to reduce transfer size
  docker save $DOCKER_IMAGE | gzip > $TAR_FILE

  echo "$YELLOW🚀 Transferring Docker image to $REMOTE_USER_HOST (using rsync with compression)$NC"
  # Use rsync for delta compression and progress
  rsync -azhP -e "ssh -i $KEY" $TAR_FILE $REMOTE_USER_HOST:/tmp/markdown-manager-image.tar.gz
fi

echo "$YELLOW🚀 Deploying backend container on $REMOTE_USER_HOST$NC"
# Copy and install systemd service file
scp -q -i $KEY $BACKEND_DIR/markdown-manager-api.service $REMOTE_USER_HOST:/tmp/

ssh -q -T -i $KEY $REMOTE_USER_HOST <<EOH
  set -e
  sudo cp /tmp/markdown-manager-api.service /etc/systemd/system/markdown-manager-api.service
  sudo systemctl daemon-reload
  sudo systemctl enable markdown-manager-api.service

  if [ "$SKIP_IMAGE_TRANSFER" != "true" ]; then
    echo "Loading compressed Docker image from tar file..."
    gunzip -c /tmp/markdown-manager-image.tar.gz | docker load
    rm -f /tmp/markdown-manager-image.tar.gz
  else
    echo "Using existing Docker image (no transfer needed)"
  fi

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
  if [ ! -L /etc/nginx/sites-enabled/littledan.com ]; then
    sudo ln -s /etc/nginx/sites-available/littledan.com /etc/nginx/sites-enabled/
  fi
  sudo nginx -t
  sudo systemctl reload nginx
EOH

echo "$GREEN✅ Backend Docker deployment complete$NC"

# Clean up local tar file (only if we created one)
if [ "$SKIP_IMAGE_TRANSFER" != "true" ]; then
  rm -f $TAR_FILE
fi