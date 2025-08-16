#!/usr/bin/env bash
set -e

BACKEND_DIR=${1:-./backend}
PDF_SERVICE_DIR=${2:-./pdf-service}
REMOTE_USER_HOST=${3:-dlittle@10.0.1.51}
REGISTRY_PORT=${4:-5000}
KEY=~/.ssh/id_danbian

source ./scripts/colors.sh

# Validation message (all parameters now have defaults)
echo "$BLUE📋 Backend dir: $BACKEND_DIR$NC"
echo "$BLUE📋 PDF service dir: $PDF_SERVICE_DIR$NC"
echo "$BLUE📋 Remote host: $REMOTE_USER_HOST$NC"
echo "$BLUE📋 Registry port: $REGISTRY_PORT$NC"

# Image names
BACKEND_LOCAL_IMAGE="littledan9/markdown-manager:latest"
BACKEND_REGISTRY_IMAGE="localhost:$REGISTRY_PORT/markdown-manager:latest"
PDF_LOCAL_IMAGE="littledan9/markdown-manager-pdf:latest"
PDF_REGISTRY_IMAGE="localhost:$REGISTRY_PORT/markdown-manager-pdf:latest"
REMOTE_REGISTRY_URL="$REMOTE_USER_HOST:$REGISTRY_PORT"

# Function to build and deploy a service
deploy_service() {
    local service_name=$1
    local local_image=$2
    local registry_image=$3
    local dockerfile_context=$4
    local dockerfile_name=${5:-Dockerfile}

    echo "$YELLOW🚀 Building $service_name image → $local_image$NC"
    docker build -t $local_image -f $dockerfile_context/$dockerfile_name $dockerfile_context

    # Get local image ID
    local LOCAL_IMAGE_ID=$(docker images -q $local_image)
    echo "Built $service_name image ID: $LOCAL_IMAGE_ID"

    # Check if image exists in remote registry
    echo "$YELLOW🔍 Checking if $service_name image exists in remote registry...$NC"
    local service_repo=$(echo $local_image | cut -d':' -f1 | cut -d'/' -f2)
    local REMOTE_IMAGE_MANIFEST=$(ssh -q -i $KEY $REMOTE_USER_HOST "curl -s -H 'Accept: application/vnd.docker.distribution.manifest.v2+json' http://localhost:$REGISTRY_PORT/v2/$service_repo/manifests/latest 2>/dev/null" || echo "")

    local SKIP_PUSH=false
    if [ -n "$REMOTE_IMAGE_MANIFEST" ] && echo "$REMOTE_IMAGE_MANIFEST" | grep -q "schemaVersion"; then
        echo "$YELLOW📦 $service_name image exists in registry, checking if it's the same...$NC"

        # Get the image ID from remote registry by pulling and checking
        local REMOTE_IMAGE_ID=$(ssh -q -i $KEY $REMOTE_USER_HOST "docker pull $registry_image >/dev/null 2>&1 && docker images -q $registry_image 2>/dev/null || echo 'none'")

        if [ "$LOCAL_IMAGE_ID" = "$REMOTE_IMAGE_ID" ] && [ "$REMOTE_IMAGE_ID" != "none" ]; then
            echo "$GREEN✅ Remote registry already has the same $service_name image, skipping push$NC"
            SKIP_PUSH=true
        else
            echo "$YELLOW📦 $service_name image differs, will push new layers...$NC"
        fi
    else
        echo "$YELLOW📦 No existing $service_name image in registry, will push all layers...$NC"
    fi

    if [ "$SKIP_PUSH" != "true" ]; then
        # Tag image for registry
        docker tag $local_image $registry_image

        echo "$YELLOW📤 Pushing $service_name to registry (layers will be deduplicated)...$NC"
        docker push $registry_image

        echo "$GREEN✅ $service_name image pushed successfully$NC"
    fi

    # Return skip status for use in deployment
    echo $SKIP_PUSH
}

# Check if we can reach the remote registry
echo "$YELLOW🔍 Checking remote registry connectivity...$NC"
if ! ssh -q -i $KEY $REMOTE_USER_HOST "curl -s http://localhost:$REGISTRY_PORT/v2/ | grep -q '{}'"; then
    echo "$RED❌ Remote registry is not accessible. Please run setup-local-registry.sh first$NC"
    exit 1
fi

# Configure local Docker for insecure registry if needed
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

# Deploy PDF service first (dependency for backend)
echo "$CYAN� Deploying PDF service...$NC"
PDF_SKIP_PUSH=$(deploy_service "PDF" $PDF_LOCAL_IMAGE $PDF_REGISTRY_IMAGE $PDF_SERVICE_DIR)

# Deploy backend service
echo "$CYAN🔧 Deploying backend service...$NC"
BACKEND_SKIP_PUSH=$(deploy_service "backend" $BACKEND_LOCAL_IMAGE $BACKEND_REGISTRY_IMAGE $BACKEND_DIR)

# Close SSH tunnel
pkill -f "ssh.*$REGISTRY_PORT:localhost:$REGISTRY_PORT" || true

echo "$YELLOW🚀 Deploying containers on $REMOTE_USER_HOST$NC"

# Copy and install PDF service systemd service file
scp -q -i $KEY $PDF_SERVICE_DIR/markdown-manager-pdf.service $REMOTE_USER_HOST:/tmp/

# Copy and install backend systemd service file
scp -q -i $KEY $BACKEND_DIR/markdown-manager-api.service $REMOTE_USER_HOST:/tmp/

ssh -q -T -i $KEY $REMOTE_USER_HOST << EOH
  set -e

  # Install PDF service
  sudo cp /tmp/markdown-manager-pdf.service /etc/systemd/system/markdown-manager-pdf.service
  sudo systemctl daemon-reload
  sudo systemctl enable markdown-manager-pdf.service

  # Install backend service
  sudo cp /tmp/markdown-manager-api.service /etc/systemd/system/markdown-manager-api.service
  sudo systemctl daemon-reload
  sudo systemctl enable markdown-manager-api.service

  # Pull PDF service image if needed
  if [ "$PDF_SKIP_PUSH" != "true" ]; then
    echo "🚀 Pulling latest PDF service image from local registry..."
    docker pull localhost:$REGISTRY_PORT/markdown-manager-pdf:latest

    # Tag for local use (matching the service file expectations)
    docker tag localhost:$REGISTRY_PORT/markdown-manager-pdf:latest $PDF_LOCAL_IMAGE
  else
    echo "✅ Using existing PDF service image (no pull needed)"
  fi

  # Pull backend image if needed
  if [ "$BACKEND_SKIP_PUSH" != "true" ]; then
    echo "🚀 Pulling latest backend image from local registry..."
    docker pull localhost:$REGISTRY_PORT/markdown-manager:latest

    # Tag for local use (matching the service file expectations)
    docker tag localhost:$REGISTRY_PORT/markdown-manager:latest $BACKEND_LOCAL_IMAGE
  else
    echo "✅ Using existing backend image (no pull needed)"
  fi

  # Restart services in proper order (PDF service first, then backend)
  echo "🔄 Restarting PDF service..."
  sudo systemctl restart markdown-manager-pdf.service

  echo "⏳ Waiting for PDF service to be ready..."
  sleep 5

  echo "🔄 Restarting backend service..."
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

echo "$GREEN✅ Docker deployment complete using local registry$NC"

# Clean up local registry tags
docker rmi $BACKEND_REGISTRY_IMAGE 2>/dev/null || true
docker rmi $PDF_REGISTRY_IMAGE 2>/dev/null || true

# Show registry stats
echo "$YELLOW📊 Remote registry stats:$NC"
ssh -q -i $KEY $REMOTE_USER_HOST "curl -s http://localhost:$REGISTRY_PORT/v2/_catalog 2>/dev/null || echo 'Registry catalog unavailable'"
