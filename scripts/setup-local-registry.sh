#!/usr/bin/env bash
set -e

REMOTE_USER_HOST=${1:-dlittle@10.0.1.51}
KEY=~/.ssh/id_danbian
REGISTRY_PORT=${2:-5000}

source "$(dirname "$0")/colors.sh"

if [ -z "$REMOTE_USER_HOST" ]; then
  echo "$RED❌ Missing required argument: REMOTE_USER_HOST$NC"
  echo "Usage: $0 [remote_user_host] [registry_port]"
  echo "Default: dlittle@10.0.1.51"
  exit 1
fi

echo "$YELLOW🚀 Setting up local Docker registry on $REMOTE_USER_HOST:$REGISTRY_PORT$NC"

# Create registry setup script
cat > /tmp/setup-registry.sh << 'EOF'
#!/bin/bash
set -e

REGISTRY_PORT=$1
REGISTRY_NAME="local-registry"

echo "🔍 Checking if Docker is installed..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

echo "🔍 Checking if registry container already exists..."
if docker ps -a --format '{{.Names}}' | grep -q "^${REGISTRY_NAME}$"; then
    echo "📦 Registry container already exists. Checking status..."
    if docker ps --format '{{.Names}}' | grep -q "^${REGISTRY_NAME}$"; then
        echo "✅ Registry is already running on port $REGISTRY_PORT"
        exit 0
    else
        echo "🔄 Starting existing registry container..."
        docker start $REGISTRY_NAME
        echo "✅ Registry started on port $REGISTRY_PORT"
        exit 0
    fi
fi

echo "🚀 Creating new registry container..."
docker run -d \
  --name $REGISTRY_NAME \
  --restart=unless-stopped \
  -p $REGISTRY_PORT:5000 \
  -v registry-data:/var/lib/registry \
  registry:2

echo "✅ Local Docker registry setup complete!"
echo "📋 Registry URL: localhost:$REGISTRY_PORT"
echo "🔧 To configure Docker daemon for insecure registry, add to /etc/docker/daemon.json:"
echo '   {"insecure-registries": ["localhost:'$REGISTRY_PORT'"]}'
EOF

# Copy setup script to remote
scp -q -i $KEY /tmp/setup-registry.sh $REMOTE_USER_HOST:/tmp/
rm /tmp/setup-registry.sh

# Execute setup on remote
ssh -q -T -i $KEY $REMOTE_USER_HOST << EOH
chmod +x /tmp/setup-registry.sh
/tmp/setup-registry.sh $REGISTRY_PORT
rm /tmp/setup-registry.sh

# Configure Docker daemon for insecure registry
if [ ! -f /etc/docker/daemon.json ]; then
    echo "🔧 Creating Docker daemon configuration..."
    sudo mkdir -p /etc/docker
    echo '{"insecure-registries": ["localhost:$REGISTRY_PORT"]}' | sudo tee /etc/docker/daemon.json > /dev/null
    sudo systemctl restart docker
    echo "⚠️  Docker daemon restarted to apply insecure registry configuration"
else
    echo "📝 Docker daemon.json already exists. Please manually add:"
    echo '   "insecure-registries": ["localhost:$REGISTRY_PORT"]'
    echo "   to /etc/docker/daemon.json and restart Docker if not already configured"
fi

# Test registry
echo "🧪 Testing registry connectivity..."
if curl -s http://localhost:$REGISTRY_PORT/v2/ | grep -q "{}"; then
    echo "✅ Registry is responding correctly"
else
    echo "❌ Registry test failed"
    exit 1
fi
EOH

echo "$GREEN✅ Local Docker registry setup complete on $REMOTE_USER_HOST:$REGISTRY_PORT$NC"
echo "$YELLOW📋 You can now use deploy-backend-registry.sh for efficient layer-based deployments$NC"
