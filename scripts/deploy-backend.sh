#!/usr/bin/env bash
set -e

BACKEND_DIR=${1:-./backend}
REMOTE_USER_HOST=${2:-dlittle@10.0.1.51}
REGISTRY_PORT=${3:-5000}
KEY=~/.ssh/id_danbian

source ./scripts/colors.sh

# Validation message (all parameters now have defaults)
echo "$BLUE📋 Backend dir: $BACKEND_DIR$NC"
echo "$BLUE📋 Remote host: $REMOTE_USER_HOST$NC"
echo "$BLUE📋 Registry port: $REGISTRY_PORT$NC"

# Image names
LOCAL_IMAGE="littledan9/markdown-manager:latest"
REGISTRY_IMAGE="localhost:$REGISTRY_PORT/markdown-manager:latest"
REMOTE_REGISTRY_URL="$REMOTE_USER_HOST:$REGISTRY_PORT"

echo "$YELLOW🚀 Building Docker image → $LOCAL_IMAGE$NC"
docker build -t $LOCAL_IMAGE -f Dockerfile.backend .

# Get local image ID
LOCAL_IMAGE_ID=$(docker images -q $LOCAL_IMAGE)
echo "Built image ID: $LOCAL_IMAGE_ID"

# Check if we can reach the remote registry
echo "$YELLOW🔍 Checking remote registry connectivity...$NC"
if ! ssh -q -i $KEY $REMOTE_USER_HOST "curl -s http://localhost:$REGISTRY_PORT/v2/ | grep -q '{}'"; then
    echo "$RED❌ Remote registry is not accessible. Please run setup-local-registry.sh first$NC"
    exit 1
fi

# Get current image ID from remote registry if it exists
echo "$YELLOW🔍 Checking if image exists in remote registry...$NC"
REMOTE_IMAGE_MANIFEST=$(ssh -q -i $KEY $REMOTE_USER_HOST "curl -s -H 'Accept: application/vnd.docker.distribution.manifest.v2+json' http://localhost:$REGISTRY_PORT/v2/markdown-manager/manifests/latest 2>/dev/null" || echo "")

if [ -n "$REMOTE_IMAGE_MANIFEST" ] && echo "$REMOTE_IMAGE_MANIFEST" | grep -q "schemaVersion"; then
    echo "$YELLOW📦 Image exists in registry, checking if it's the same...$NC"
    
    # Get the image ID from remote registry by pulling and checking
    REMOTE_IMAGE_ID=$(ssh -q -i $KEY $REMOTE_USER_HOST "docker pull localhost:$REGISTRY_PORT/markdown-manager:latest >/dev/null 2>&1 && docker images -q localhost:$REGISTRY_PORT/markdown-manager:latest 2>/dev/null || echo 'none'")
    
    if [ "$LOCAL_IMAGE_ID" = "$REMOTE_IMAGE_ID" ] && [ "$REMOTE_IMAGE_ID" != "none" ]; then
        echo "$GREEN✅ Remote registry already has the same image, skipping push$NC"
        SKIP_PUSH=true
    else
        echo "$YELLOW📦 Image differs, will push new layers...$NC"
        SKIP_PUSH=false
    fi
else
    echo "$YELLOW📦 No existing image in registry, will push all layers...$NC"
    SKIP_PUSH=false
fi

if [ "$SKIP_PUSH" != "true" ]; then
    # Tag image for registry
    docker tag $LOCAL_IMAGE $REGISTRY_IMAGE
    
    echo "$YELLOW🚀 Pushing image to remote registry (only changed layers will be uploaded)...$NC"
    
    # Configure local Docker for insecure registry
    if ! grep -q "insecure-registries" ~/.docker/daemon.json 2>/dev/null; then
        echo "$YELLOW🔧 Configuring local Docker for insecure registry...$NC"
        mkdir -p ~/.docker
        if [ -f ~/.docker/daemon.json ]; then
            # Add insecure registry to existing config
            jq '. + {"insecure-registries": ["'$REMOTE_REGISTRY_URL'"]}' ~/.docker/daemon.json > ~/.docker/daemon.json.tmp && mv ~/.docker/daemon.json.tmp ~/.docker/daemon.json
        else
            # Create new config
            echo '{"insecure-registries": ["'$REMOTE_REGISTRY_URL'"]}' > ~/.docker/daemon.json
        fi
        echo "$RED⚠️  Please restart Docker daemon and re-run this script$NC"
        echo "Run: sudo systemctl restart docker"
        exit 1
    fi
    
    # Create SSH tunnel for registry access
    echo "$YELLOW🔗 Creating SSH tunnel to remote registry...$NC"
    ssh -f -N -L $REGISTRY_PORT:localhost:$REGISTRY_PORT -i $KEY $REMOTE_USER_HOST
    
    # Wait a moment for tunnel to establish
    sleep 2
    
    # Test tunnel
    if ! curl -s http://localhost:$REGISTRY_PORT/v2/ | grep -q "{}"; then
        echo "$RED❌ SSH tunnel failed$NC"
        pkill -f "ssh.*$REGISTRY_PORT:localhost:$REGISTRY_PORT" || true
        exit 1
    fi
    
    # Push to registry via tunnel
    echo "$YELLOW📤 Pushing to registry (layers will be deduplicated)...$NC"
    docker push $REGISTRY_IMAGE
    
    # Close SSH tunnel
    pkill -f "ssh.*$REGISTRY_PORT:localhost:$REGISTRY_PORT" || true
    echo "$GREEN✅ Image pushed successfully$NC"
fi

echo "$YELLOW🚀 Deploying backend container on $REMOTE_USER_HOST$NC"

# Copy and install systemd service file
scp -q -i $KEY $BACKEND_DIR/markdown-manager-api.service $REMOTE_USER_HOST:/tmp/

ssh -q -T -i $KEY $REMOTE_USER_HOST << EOH
  set -e
  sudo cp /tmp/markdown-manager-api.service /etc/systemd/system/markdown-manager-api.service
  sudo systemctl daemon-reload
  sudo systemctl enable markdown-manager-api.service

  if [ "$SKIP_PUSH" != "true" ]; then
    echo "🚀 Pulling latest image from local registry..."
    docker pull localhost:$REGISTRY_PORT/markdown-manager:latest
    
    # Tag for local use (matching the service file expectations)
    docker tag localhost:$REGISTRY_PORT/markdown-manager:latest $LOCAL_IMAGE
  else
    echo "✅ Using existing image (no pull needed)"
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

echo "$GREEN✅ Backend Docker deployment complete using local registry$NC"

# Clean up local registry tag
docker rmi $REGISTRY_IMAGE 2>/dev/null || true

# Show registry stats
echo "$YELLOW📊 Remote registry stats:$NC"
ssh -q -i $KEY $REMOTE_USER_HOST "curl -s http://localhost:$REGISTRY_PORT/v2/_catalog 2>/dev/null || echo 'Registry catalog unavailable'"
