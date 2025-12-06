#!/usr/bin/env bash
# One-time migration script to clean up legacy deployment artifacts on Danbian
# Run this once to migrate from shell script deployment to Ansible deployment

set -euo pipefail

# Configuration
DANBIAN_HOST="dlittle@10.0.1.51"
SSH_KEY="~/.ssh/id_danbian"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔥 Legacy Deployment Cleanup${NC}"
echo -e "${YELLOW}This will clean up legacy shell script deployment artifacts on Danbian${NC}"
echo ""
echo -e "${GREEN}✅ SAFE OPERATIONS (will be performed):${NC}"
echo -e "  - Stop legacy Docker containers"
echo -e "  - Remove legacy systemd service files"
echo -e "  - Clean unused Docker images/volumes"
echo -e "  - Create directories for Ansible deployment"
echo ""
echo -e "${RED}🚨 PROTECTED OPERATIONS (will NOT be performed):${NC}"
echo -e "  - Delete directories in /opt/ (potential user data)"
echo -e "  - Remove user documents or storage"
echo -e "  - Delete database files"
echo ""

# Confirm operation
read -p "⚠️  This will STOP and REMOVE existing services. Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Aborted by user${NC}"
    exit 0
fi

echo -e "${BLUE}📊 Checking current status...${NC}"

# Check SSH connectivity
if ! ssh -i "$SSH_KEY" -o ConnectTimeout=10 "$DANBIAN_HOST" "echo 'SSH OK'" >/dev/null 2>&1; then
    echo -e "${RED}❌ SSH connection failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ SSH connection working${NC}"

# Show current containers
echo -e "\n${YELLOW}Current containers:${NC}"
ssh -i "$SSH_KEY" "$DANBIAN_HOST" "docker ps --format 'table {{.Names}}\t{{.Status}}'" 2>/dev/null || true

# Show current systemd services
echo -e "\n${YELLOW}Current systemd services:${NC}"
ssh -i "$SSH_KEY" "$DANBIAN_HOST" "systemctl list-units '*markdown-manager*' --no-legend --no-pager" 2>/dev/null || true

echo ""
read -p "Proceed with cleanup? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Aborted by user${NC}"
    exit 0
fi

echo -e "\n${BLUE}🧹 Starting cleanup...${NC}"

# Stop and remove legacy containers
echo -e "\n${YELLOW}Stopping legacy containers...${NC}"
LEGACY_CONTAINERS=(
    "markdown-manager-api"
    "markdown-manager-export" 
    "markdown-manager-lint"
    "markdown-manager-spell-check"
    "markdown-manager-ui"
    "markdown-manager"
    "event-consumer"
    "event-publisher"
)

for container in "${LEGACY_CONTAINERS[@]}"; do
    if ssh -i "$SSH_KEY" "$DANBIAN_HOST" "docker ps -q -f name=$container" 2>/dev/null | grep -q .; then
        echo "  Stopping $container..."
        ssh -i "$SSH_KEY" "$DANBIAN_HOST" "docker stop $container" >/dev/null 2>&1 || true
        ssh -i "$SSH_KEY" "$DANBIAN_HOST" "docker rm $container" >/dev/null 2>&1 || true
    fi
done

# Stop and remove legacy systemd services
echo -e "\n${YELLOW}Removing legacy systemd services...${NC}"
LEGACY_SERVICES=(
    "markdown-manager-api.service"
    "markdown-manager-export.service"
    "markdown-manager-lint.service" 
    "markdown-manager-spell-check.service"
    "markdown-manager-ui.service"
    "markdown-manager.service"
)

for service in "${LEGACY_SERVICES[@]}"; do
    if ssh -i "$SSH_KEY" "$DANBIAN_HOST" "systemctl is-enabled $service" >/dev/null 2>&1; then
        echo "  Removing $service..."
        ssh -i "$SSH_KEY" "$DANBIAN_HOST" "sudo systemctl stop $service" >/dev/null 2>&1 || true
        ssh -i "$SSH_KEY" "$DANBIAN_HOST" "sudo systemctl disable $service" >/dev/null 2>&1 || true
        ssh -i "$SSH_KEY" "$DANBIAN_HOST" "sudo rm -f /etc/systemd/system/$service" >/dev/null 2>&1 || true
    fi
done

# Reload systemd
echo -e "\n${YELLOW}Reloading systemd...${NC}"
ssh -i "$SSH_KEY" "$DANBIAN_HOST" "sudo systemctl daemon-reload"

# Check for directories that might contain user data (DO NOT DELETE)
echo -e "\n${RED}⚠️  CRITICAL: Checking for directories with user data...${NC}"
POTENTIAL_DATA_DIRS=$(ssh -i "$SSH_KEY" "$DANBIAN_HOST" "find /opt -name '*markdown-manager*' -type d 2>/dev/null" || true)
if [ -n "$POTENTIAL_DATA_DIRS" ]; then
    echo -e "${RED}Found directories that might contain user data:${NC}"
    echo "$POTENTIAL_DATA_DIRS"
    echo ""
    echo -e "${RED}🚨 These directories will NOT be deleted automatically!${NC}"
    echo -e "${YELLOW}Please manually review and backup any user data before removing.${NC}"
    echo ""
    echo -e "${BLUE}Typical user data locations:${NC}"
    echo -e "  /opt/markdown-manager-api/documents/ - User document storage"
    echo -e "  /opt/markdown-manager-*/storage/ - File storage"
    echo -e "  /opt/markdown-manager-*/data/ - Database files"
    echo ""
    echo -e "${YELLOW}After backing up data, you can manually remove empty directories:${NC}"
    echo "$POTENTIAL_DATA_DIRS" | while read -r dir; do
        if [ -n "$dir" ]; then
            echo -e "  ${BLUE}ssh dlittle@10.0.1.51 'sudo rm -rf $dir'${NC}"
        fi
    done
else
    echo -e "${GREEN}  No directories found in /opt/${NC}"
fi

# Clean up Docker resources
echo -e "\n${YELLOW}Cleaning up Docker resources...${NC}"
ssh -i "$SSH_KEY" "$DANBIAN_HOST" "docker system prune -f" >/dev/null 2>&1 || true

# Create directories for Ansible deployment
echo -e "\n${YELLOW}Creating directories for Ansible deployment...${NC}"
ssh -i "$SSH_KEY" "$DANBIAN_HOST" "
    sudo mkdir -p /var/log/markdown-manager
    sudo mkdir -p /etc/markdown-manager
    sudo mkdir -p /var/lib/redis
    sudo mkdir -p /var/www/html
    sudo chown -R www-data:www-data /var/www/html
    sudo chown -R 999:999 /var/lib/redis
"

echo -e "\n${GREEN}✅ Legacy cleanup completed!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "1. Deploy services with Ansible:"
echo -e "   ${YELLOW}./deploy-ansible.sh all${NC}"
echo ""
echo -e "2. Verify deployment:"
echo -e "   ${YELLOW}./deployment/check-status.sh${NC}"
echo ""
echo -e "3. Test endpoints:"
echo -e "   ${YELLOW}curl http://10.0.1.51:8000/health${NC}"
echo -e "   ${YELLOW}curl http://10.0.1.51/${NC}"