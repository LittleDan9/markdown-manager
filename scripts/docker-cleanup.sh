#!/bin/bash

# Docker Cleanup Script
# Estimated savings: ~57GB

set -e

echo "🧹 Docker Cleanup - Estimated savings: ~57GB"
echo "=================================================="

echo "📊 Current Docker usage:"
docker system df

echo ""
echo "🗑️  Step 1: Cleaning build cache (~33.25GB)..."
docker builder prune -af

echo ""
echo "🗑️  Step 2: Removing unused images (~22.28GB)..."
docker image prune -af

echo ""
echo "🗑️  Step 3: Removing unused volumes (~1.63GB)..."
docker volume prune -f

echo ""
echo "🗑️  Step 4: Removing stopped containers (~22MB)..."
docker container prune -f

echo ""
echo "✅ Cleanup complete!"
echo "📊 New Docker usage:"
docker system df

echo ""
echo "🎉 Docker cleanup finished successfully!"