#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🛠️  Setting up Markdown Manager deployment environment...${NC}"

# Check if we're on the target server
if [[ "$(hostname)" != "Danbian" ]]; then
    echo -e "${RED}❌ This setup script should be run on the target server (Danbian)${NC}"
    exit 1
fi

# Create backend directory
echo -e "${YELLOW}📁 Creating backend directory...${NC}"
sudo mkdir -p /opt/markdown-manager-api
sudo chown www-data:www-data /opt/markdown-manager-api

# Install systemd service
echo -e "${YELLOW}⚙️  Installing systemd service...${NC}"
sudo cp backend/markdown-manager-api.service /etc/systemd/system/
sudo systemctl daemon-reload

# Create nginx backup
echo -e "${YELLOW}💾 Backing up current nginx config...${NC}"
if [ -f /etc/nginx/sites-available/docs.littledan.com.conf ]; then
    sudo cp /etc/nginx/sites-available/docs.littledan.com.conf /etc/nginx/sites-available/docs.littledan.com.conf.backup.$(date +%Y%m%d_%H%M%S)
    
    # Rotate backups using dedicated script
    sudo /home/dlittle/scripts/rotate-nginx-backups.sh
else
    echo -e "${YELLOW}⚠️  No existing nginx config found to backup${NC}"
fi

echo -e "${GREEN}✅ Setup complete!${NC}"
echo -e "${BLUE}📝 Next steps:${NC}"
echo -e "  1. Deploy the application: ${YELLOW}npm run deploy${NC}"
echo -e "  2. Enable and start the backend service: ${YELLOW}sudo systemctl enable --now markdown-manager-api${NC}"
echo -e "  3. Check service status: ${YELLOW}sudo systemctl status markdown-manager-api${NC}"
echo -e "  4. Check API health: ${YELLOW}curl https://docs.littledan.com/api/v1/health-check${NC}"
