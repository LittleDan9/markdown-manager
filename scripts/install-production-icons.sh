#!/bin/bash

# Production Icon Pack Installation Script
# Usage: ./install-production-icons.sh [API_URL]

set -e

API_URL=${1:-"http://localhost:8000"}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Installing production icon packs..."
echo "API URL: $API_URL"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed"
    exit 1
fi

# Check if the API is available
echo "Testing API connectivity..."
if curl -f -s -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" "$API_URL/health" > /dev/null; then
    echo "✅ API is accessible"
else
    echo "❌ Cannot connect to API at $API_URL"
    echo "Make sure the backend service is running"
    exit 1
fi

# Run the installation script
echo "Running icon installation..."
cd "$SCRIPT_DIR/.."
node scripts/install-production-icons.js "$API_URL"

echo "✅ Production icon installation complete!"
