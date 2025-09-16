#!/bin/bash
# Test: Docker Infrastructure Validation
# Tests filesystem migration Docker infrastructure setup

set -e  # Exit on any error

echo "=== Testing Docker Infrastructure for Filesystem Migration ==="

# Ensure we're in the right directory
cd "$(dirname "$0")/.."

# Check if docker-compose.yml has the storage volume configuration
echo "1. Validating docker-compose.yml configuration..."
grep -q "./storage:/documents" docker-compose.yml || {
    echo "❌ Volume mount configuration missing in docker-compose.yml"
    exit 1
}

grep -q "MARKDOWN_STORAGE_ROOT" docker-compose.yml || {
    echo "❌ MARKDOWN_STORAGE_ROOT environment variable missing"
    exit 1
}

echo "✅ Docker Compose configuration valid"

# Ensure storage directory exists
echo "2. Ensuring storage directory exists..."
mkdir -p storage
echo "✅ Storage directory ready"

# Start the backend service
echo "3. Starting backend service..."
docker compose up -d backend

# Wait for backend to be ready
echo "4. Waiting for backend to be ready..."
for i in {1..30}; do
    if docker compose exec backend curl -f http://localhost:8000/health >/dev/null 2>&1; then
        echo "✅ Backend service is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Backend service failed to start within 30 seconds"
        docker compose logs backend --tail=20
        exit 1
    fi
    sleep 1
done

# Check git installation in container
echo "5. Checking git installation..."
docker compose exec backend git --version || {
    echo "❌ Git not installed in backend container"
    exit 1
}
echo "✅ Git is installed"

# Check volume mount exists
echo "6. Checking volume mount..."
docker compose exec backend ls -la /documents || {
    echo "❌ Volume mount /documents not accessible"
    exit 1
}
echo "✅ Volume mount accessible"

# Check environment variable
echo "7. Checking environment variables..."
STORAGE_ROOT=$(docker compose exec backend env | grep MARKDOWN_STORAGE_ROOT | cut -d'=' -f2 | tr -d '\r')
if [ "$STORAGE_ROOT" != "/documents" ]; then
    echo "❌ MARKDOWN_STORAGE_ROOT not set correctly: $STORAGE_ROOT"
    exit 1
fi
echo "✅ MARKDOWN_STORAGE_ROOT environment variable set correctly"

# Check storage directory permissions
echo "8. Checking storage directory permissions..."
docker compose exec backend test -w /documents || {
    echo "❌ Storage directory not writable by application user"
    exit 1
}
echo "✅ Storage directory has correct permissions"

# Test creating a directory structure
echo "9. Testing directory creation..."
docker compose exec backend mkdir -p /documents/test/local/test-category || {
    echo "❌ Cannot create directory structure"
    exit 1
}

docker compose exec backend ls -la /documents/test/local/ | grep test-category || {
    echo "❌ Created directory not visible"
    exit 1
}

# Cleanup test directory
docker compose exec backend rm -rf /documents/test

echo "✅ Directory creation and cleanup working"

# Test git operations in the container
echo "10. Testing git operations..."
docker compose exec backend bash -c "
cd /documents && \
mkdir -p test-git && \
cd test-git && \
git init && \
git config user.email 'test@example.com' && \
git config user.name 'Test User' && \
echo '# Test' > test.md && \
git add test.md && \
git commit -m 'Initial commit'
" || {
    echo "❌ Git operations failed"
    exit 1
}

# Cleanup test git repo
docker compose exec backend rm -rf /documents/test-git

echo "✅ Git operations working"

echo ""
echo "🎉 Docker Infrastructure Test PASSED"
echo "✅ All infrastructure components ready for filesystem migration"
echo ""
echo "Next steps:"
echo "- Implement filesystem service layer"
echo "- Update database models"
echo "- Refactor document APIs"