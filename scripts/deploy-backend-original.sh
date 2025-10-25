#!/usr/bin/env bash
set -e

BACKEND_DIR=${1:-./backend}
EXPORT_SERVICE_DIR=${2:-./export-service}
LINT_SERVICE_DIR=${3:-./markdown-lint-service}
SPELL_CHECK_SERVICE_DIR=${4:-./spell-check-service}
REMOTE_USER_HOST=${5:-dlittle@10.0.1.51}
REGISTRY_PORT=${6:-5000}
KEY="$HOME/.ssh/id_danbian"

source ./scripts/colors.sh

# Validation message (all parameters now have defaults)
echo "$BLUE📋 Backend dir: $BACKEND_DIR$NC"
echo "$BLUE📋 Export service dir: $EXPORT_SERVICE_DIR$NC"
echo "$BLUE📋 Lint service dir: $LINT_SERVICE_DIR$NC"
echo "$BLUE📋 Spell check service dir: $SPELL_CHECK_SERVICE_DIR$NC"
echo "$BLUE📋 Remote host: $REMOTE_USER_HOST$NC"
echo "$BLUE📋 Registry port: $REGISTRY_PORT$NC"

# Image names
BACKEND_LOCAL_IMAGE="littledan9/markdown-manager:latest"
BACKEND_REGISTRY_IMAGE="localhost:$REGISTRY_PORT/markdown-manager:latest"
EXPORT_LOCAL_IMAGE="littledan9/markdown-manager-export:latest"
EXPORT_REGISTRY_IMAGE="localhost:$REGISTRY_PORT/markdown-manager-export:latest"
LINT_LOCAL_IMAGE="littledan9/markdown-manager-lint:latest"
LINT_REGISTRY_IMAGE="localhost:$REGISTRY_PORT/markdown-manager-lint:latest"
SPELL_CHECK_LOCAL_IMAGE="littledan9/markdown-manager-spell-check:latest"
SPELL_CHECK_REGISTRY_IMAGE="localhost:$REGISTRY_PORT/markdown-manager-spell-check:latest"
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
    local REMOTE_IMAGE_MANIFEST=$(ssh -q -T -i "$KEY" "$REMOTE_USER_HOST" "curl -s -H 'Accept: application/vnd.docker.distribution.manifest.v2+json' http://localhost:$REGISTRY_PORT/v2/$service_repo/manifests/latest 2>/dev/null" || echo "")

    local SKIP_PUSH=false
    if [ -n "$REMOTE_IMAGE_MANIFEST" ] && echo "$REMOTE_IMAGE_MANIFEST" | grep -q "schemaVersion"; then
        echo "$YELLOW📦 $service_name image exists in registry, checking if it's the same...$NC"

        # Get the image ID from remote registry by pulling and checking
        local REMOTE_IMAGE_ID=$(ssh -q -T -i "$KEY" "$REMOTE_USER_HOST" "docker pull $registry_image >/dev/null 2>&1 && docker images -q $registry_image 2>/dev/null || echo 'none'")

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

# Check if remote host is accessible
echo "$YELLOW🔍 Checking remote host connectivity...$NC"
if ! ssh -q -T -i "$KEY" "$REMOTE_USER_HOST" "echo 'Connection successful'"; then
    echo "$RED❌ Cannot connect to remote host$NC"
    exit 1
else
    echo "$GREEN✅ Remote host accessible$NC"
fi

# Registry status will be checked after SSH tunnel is created

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
ssh -f -N -L $REGISTRY_PORT:localhost:$REGISTRY_PORT -i "$KEY" "$REMOTE_USER_HOST"

# Wait a moment for tunnel to establish
sleep 2

# Test tunnel
if ! curl -s http://localhost:$REGISTRY_PORT/v2/ | grep -q "{}"; then
    echo "$RED❌ SSH tunnel failed$NC"
    pkill -f "ssh.*$REGISTRY_PORT:localhost:$REGISTRY_PORT" || true
    exit 1
fi

# Deploy export service first (dependency for backend)
echo "$CYAN🔧 Deploying export service...$NC"
EXPORT_SKIP_PUSH=$(deploy_service "export" $EXPORT_LOCAL_IMAGE $EXPORT_REGISTRY_IMAGE $EXPORT_SERVICE_DIR)

# Deploy markdown linting service (dependency for backend)
echo "$CYAN🧪 Deploying markdown linting service...$NC"
LINT_SKIP_PUSH=$(deploy_service "lint" $LINT_LOCAL_IMAGE $LINT_REGISTRY_IMAGE $LINT_SERVICE_DIR)

# Deploy spell check service (dependency for backend)
echo "$CYAN✏️  Deploying spell check service...$NC"
SPELL_CHECK_SKIP_PUSH=$(deploy_service "spell-check" $SPELL_CHECK_LOCAL_IMAGE $SPELL_CHECK_REGISTRY_IMAGE $SPELL_CHECK_SERVICE_DIR)

# Deploy backend service
echo "$CYAN🔧 Deploying backend service...$NC"
BACKEND_SKIP_PUSH=$(deploy_service "backend" $BACKEND_LOCAL_IMAGE $BACKEND_REGISTRY_IMAGE $BACKEND_DIR)

# Close SSH tunnel
pkill -f "ssh.*$REGISTRY_PORT:localhost:$REGISTRY_PORT" || true

echo "$YELLOW🚀 Deploying containers on $REMOTE_USER_HOST$NC"

# Copy and install export service systemd service file
scp -q -i "$KEY" "$EXPORT_SERVICE_DIR/markdown-manager-export.service" "$REMOTE_USER_HOST:/tmp/"

# Copy and install lint service systemd service file
scp -q -i "$KEY" "$LINT_SERVICE_DIR/markdown-manager-lint.service" "$REMOTE_USER_HOST:/tmp/"

# Copy and install spell check service systemd service file
scp -q -i "$KEY" "$SPELL_CHECK_SERVICE_DIR/markdown-manager-spell-check.service" "$REMOTE_USER_HOST:/tmp/"

# Copy and install backend systemd service file
scp -q -i "$KEY" "$BACKEND_DIR/markdown-manager-api.service" "$REMOTE_USER_HOST:/tmp/"

ssh -q -T -i "$KEY" "$REMOTE_USER_HOST" 'bash -s' << EOH
  set -e

  # Clean up old PDF service if it exists
  if sudo systemctl is-enabled markdown-manager-pdf.service >/dev/null 2>&1; then
    echo "🧹 Cleaning up old PDF service..."
    sudo systemctl stop markdown-manager-pdf.service || true
    sudo systemctl disable markdown-manager-pdf.service || true
    sudo rm -f /etc/systemd/system/markdown-manager-pdf.service || true
    sudo systemctl daemon-reload
  fi

  # Install export service
  sudo cp /tmp/markdown-manager-export.service /etc/systemd/system/markdown-manager-export.service
  sudo systemctl daemon-reload
  sudo systemctl enable markdown-manager-export.service

  # Install lint service
  sudo cp /tmp/markdown-manager-lint.service /etc/systemd/system/markdown-manager-lint.service
  sudo systemctl daemon-reload
  sudo systemctl enable markdown-manager-lint.service

  # Install spell check service
  sudo cp /tmp/markdown-manager-spell-check.service /etc/systemd/system/markdown-manager-spell-check.service
  sudo systemctl daemon-reload
  sudo systemctl enable markdown-manager-spell-check.service

  # Install backend service
  sudo cp /tmp/markdown-manager-api.service /etc/systemd/system/markdown-manager-api.service
  sudo systemctl daemon-reload
  sudo systemctl enable markdown-manager-api.service

  # Pull export service image if needed
  if [ "$EXPORT_SKIP_PUSH" != "true" ]; then
    echo "🚀 Pulling latest export service image from local registry..."
    docker pull localhost:$REGISTRY_PORT/markdown-manager-export:latest

    # Tag for local use (matching the service file expectations)
    docker tag localhost:$REGISTRY_PORT/markdown-manager-export:latest $EXPORT_LOCAL_IMAGE
  else
    echo "✅ Using existing export service image (no pull needed)"
  fi

  # Pull lint service image if needed
  if [ "$LINT_SKIP_PUSH" != "true" ]; then
    echo "🚀 Pulling latest lint service image from local registry..."
    docker pull localhost:$REGISTRY_PORT/markdown-manager-lint:latest

    # Tag for local use (matching the service file expectations)
    docker tag localhost:$REGISTRY_PORT/markdown-manager-lint:latest $LINT_LOCAL_IMAGE
  else
    echo "✅ Using existing lint service image (no pull needed)"
  fi

  # Pull spell check service image if needed
  if [ "$SPELL_CHECK_SKIP_PUSH" != "true" ]; then
    echo "🚀 Pulling latest spell check service image from local registry..."
    docker pull localhost:$REGISTRY_PORT/markdown-manager-spell-check:latest

    # Tag for local use (matching the service file expectations)
    docker tag localhost:$REGISTRY_PORT/markdown-manager-spell-check:latest $SPELL_CHECK_LOCAL_IMAGE
  else
    echo "✅ Using existing spell check service image (no pull needed)"
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

  # Restart services in proper order (dependencies first)
  echo "🔄 Restarting export service..."
  sudo systemctl restart markdown-manager-export.service

  echo "⏳ Waiting for export service to be ready..."
  sleep 3

  echo "🔄 Restarting lint service..."
  sudo systemctl restart markdown-manager-lint.service

  echo "⏳ Waiting for lint service to be ready..."
  sleep 3

  echo "🔄 Restarting spell check service..."
  sudo systemctl restart markdown-manager-spell-check.service

  echo "⏳ Waiting for spell check service to be ready..."
  sleep 3

  echo "🔄 Restarting backend service..."
  sudo systemctl restart markdown-manager-api.service

  echo "⏳ Waiting for backend service to be ready..."
  sleep 8

  # Clean up old Docker images (keep only 5 most recent per repository)
  echo "🧹 Cleaning up old Docker images (keeping 5 most recent per repository)..."

  # Function to clean up old images for a specific repository
  cleanup_old_images() {
    local repo_name=\$1
    local keep_count=5

    echo "  🔍 Cleaning up old images for \$repo_name..."

    # Get all images for this repository, sorted by creation date (newest first)
    local images=\$(docker images --format "table {{.Repository}}:{{.Tag}}\t{{.ID}}\t{{.CreatedAt}}" | grep "^\$repo_name:" | sort -k3 -r)

    if [ -n "\$images" ]; then
      # Get image IDs to keep (first 5)
      local keep_ids=\$(echo "\$images" | head -n \$keep_count | awk '{print \$2}')

      # Get all image IDs for this repo
      local all_ids=\$(echo "\$images" | awk '{print \$2}')

      # Find IDs to remove (not in keep list)
      local remove_ids=\$(echo "\$all_ids" | grep -v -F "\$keep_ids" || true)

      if [ -n "\$remove_ids" ]; then
        echo "    🗑️  Removing \$(echo "\$remove_ids" | wc -l) old images for \$repo_name"
        echo "\$remove_ids" | xargs -r docker rmi -f 2>/dev/null || true
      else
        echo "    ✅ No old images to remove for \$repo_name"
      fi
    else
      echo "    ℹ️  No images found for \$repo_name"
    fi
  }

  # Clean up images for each service
  cleanup_old_images "littledan9/markdown-manager"
  cleanup_old_images "littledan9/markdown-manager-export"
  cleanup_old_images "littledan9/markdown-manager-lint"
  cleanup_old_images "littledan9/markdown-manager-spell-check"
  cleanup_old_images "localhost:$REGISTRY_PORT/markdown-manager"
  cleanup_old_images "localhost:$REGISTRY_PORT/markdown-manager-export"
  cleanup_old_images "localhost:$REGISTRY_PORT/markdown-manager-lint"
  cleanup_old_images "localhost:$REGISTRY_PORT/markdown-manager-spell-check"

  # Clean up dangling images and unused containers
  echo "🧹 Cleaning up dangling images and unused containers..."
  docker image prune -f >/dev/null 2>&1 || true
  docker container prune -f >/dev/null 2>&1 || true

  # Show disk usage after cleanup
  echo "💾 Docker disk usage after cleanup:"
  docker system df
EOH

# Deploy nginx configurations using dedicated script
echo "$YELLOW🚀 Deploying nginx configurations...$NC"
./scripts/deploy-nginx.sh deploy_all $REMOTE_USER_HOST

echo "$GREEN✅ Docker deployment complete using local registry$NC"

# Clean up local registry tags
docker rmi $BACKEND_REGISTRY_IMAGE 2>/dev/null || true
docker rmi $EXPORT_REGISTRY_IMAGE 2>/dev/null || true
docker rmi $LINT_REGISTRY_IMAGE 2>/dev/null || true
docker rmi $SPELL_CHECK_REGISTRY_IMAGE 2>/dev/null || true

# Clean up old local images (keep only 3 most recent per repository)
echo "$YELLOW🧹 Cleaning up old local Docker images...$NC"

cleanup_local_images() {
    local repo_name=$1
    local keep_count=3

    echo "  🔍 Cleaning up old local images for $repo_name..."

    # Get all images for this repository, sorted by creation date (newest first)
    local images=$(docker images --format "table {{.Repository}}:{{.Tag}}\t{{.ID}}\t{{.CreatedAt}}" | grep "^$repo_name:" | sort -k3 -r)

    if [ -n "$images" ]; then
      # Get image IDs to keep (first 3)
      local keep_ids=$(echo "$images" | head -n $keep_count | awk '{print $2}')

      # Get all image IDs for this repo
      local all_ids=$(echo "$images" | awk '{print $2}')

      # Find IDs to remove (not in keep list)
      local remove_ids=$(echo "$all_ids" | grep -v -F "$keep_ids" || true)

      if [ -n "$remove_ids" ]; then
        echo "    🗑️  Removing $(echo "$remove_ids" | wc -l) old local images for $repo_name"
        echo "$remove_ids" | xargs -r docker rmi -f 2>/dev/null || true
      else
        echo "    ✅ No old local images to remove for $repo_name"
      fi
    else
      echo "    ℹ️  No local images found for $repo_name"
    fi
}

# Clean up local images for each service
cleanup_local_images "littledan9/markdown-manager"
cleanup_local_images "littledan9/markdown-manager-export"
cleanup_local_images "littledan9/markdown-manager-lint"
cleanup_local_images "littledan9/markdown-manager-spell-check"

# Clean up local dangling images
echo "$YELLOW🧹 Cleaning up local dangling images...$NC"
docker image prune -f >/dev/null 2>&1 || true

# Show registry stats
echo "$YELLOW📊 Remote registry stats:$NC"
ssh -q -T -i "$KEY" "$REMOTE_USER_HOST" "curl -s http://localhost:$REGISTRY_PORT/v2/_catalog 2>/dev/null || echo 'Registry catalog unavailable'"
