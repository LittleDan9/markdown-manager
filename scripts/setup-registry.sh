#!/bin/bash

# Setup Docker Registry on Remote Host
# Usage: ./setup-registry.sh [remote_host] [remote_user]

REMOTE_HOST=${1:-"danbian"}
REMOTE_USER=${2:-"danbian"}
REGISTRY_PORT=${3:-"5000"}

set -e

echo "Setting up Docker registry on ${REMOTE_USER}@${REMOTE_HOST}..."

# Create registry directory and docker-compose file on remote host
ssh "${REMOTE_USER}@${REMOTE_HOST}" << 'EOF'
# Create registry directory
mkdir -p ~/docker-registry
cd ~/docker-registry

# Create docker-compose.yml for the registry
cat > docker-compose.yml << 'COMPOSE_EOF'
version: '3.8'

services:
  registry:
    image: registry:2
    restart: unless-stopped
    ports:
      - "5000:5000"
    environment:
      REGISTRY_STORAGE_FILESYSTEM_ROOTDIRECTORY: /data
      REGISTRY_HTTP_ADDR: 0.0.0.0:5000
      REGISTRY_STORAGE_DELETE_ENABLED: true
    volumes:
      - registry-data:/data
    networks:
      - registry-net

volumes:
  registry-data:

networks:
  registry-net:
    driver: bridge
COMPOSE_EOF

echo "Docker registry configuration created"

# Start the registry
docker compose up -d

echo "Docker registry started on port 5000"

# Wait for registry to be ready
echo "Waiting for registry to be ready..."
sleep 5

# Test registry
curl -f http://localhost:5000/v2/ && echo "Registry is running successfully!" || echo "Registry health check failed"

EOF

echo "Registry setup complete!"
echo "Registry is available at: ${REMOTE_HOST}:${REGISTRY_PORT}"
echo ""
echo "To test from your dev machine:"
echo "  curl http://${REMOTE_HOST}:${REGISTRY_PORT}/v2/"
echo ""
echo "To configure Docker to use insecure registry, add to /etc/docker/daemon.json:"
echo '  {"insecure-registries": ["'${REMOTE_HOST}:${REGISTRY_PORT}'"]}'
