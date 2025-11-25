#!/bin/bash
# Script to restart the backend service on production server
# This needs to be run manually due to sudo password requirements

echo "🔧 Updating systemd service and restarting backend..."

# Copy the updated service file
sudo cp markdown-manager-api.service /etc/systemd/system/

# Reload systemd daemon
sudo systemctl daemon-reload

# Restart and enable the service
sudo systemctl restart markdown-manager-api
sudo systemctl enable markdown-manager-api

# Check status
echo "📊 Service status:"
systemctl status markdown-manager-api

echo "🌐 Testing API endpoint:"
curl -s http://localhost:8000/api/v1/health || echo "API not responding"

echo "✅ Done! The backend service should now be running."
