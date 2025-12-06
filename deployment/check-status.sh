#!/usr/bin/env bash
# Service status verification script
# Checks the current state of services on Danbian

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DANBIAN_HOST="dlittle@10.0.1.51"
SSH_KEY="~/.ssh/id_danbian"

echo -e "${BLUE}🔍 Checking service status on Danbian...${NC}"

# Check SSH connectivity
echo -e "\n${YELLOW}📡 Testing SSH connection...${NC}"
if ssh -i "$SSH_KEY" -o ConnectTimeout=10 "$DANBIAN_HOST" "echo 'SSH connection successful'" 2>/dev/null; then
    echo -e "${GREEN}✅ SSH connection working${NC}"
else
    echo -e "${RED}❌ SSH connection failed${NC}"
    exit 1
fi

# Check Docker containers
echo -e "\n${YELLOW}🐳 Docker containers:${NC}"
ssh -i "$SSH_KEY" "$DANBIAN_HOST" "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'" 2>/dev/null || echo "No containers running"

# Check systemd services
echo -e "\n${YELLOW}⚙️  Systemd services:${NC}"
ssh -i "$SSH_KEY" "$DANBIAN_HOST" "systemctl list-units '*markdown-manager*' --no-pager" 2>/dev/null || echo "No markdown-manager systemd services found"

# Check nginx status
echo -e "\n${YELLOW}🌐 Nginx status:${NC}"
ssh -i "$SSH_KEY" "$DANBIAN_HOST" "systemctl is-active nginx" 2>/dev/null || echo "Nginx not running"

# Check ports
echo -e "\n${YELLOW}🔌 Port usage:${NC}"
ssh -i "$SSH_KEY" "$DANBIAN_HOST" "netstat -tlnp 2>/dev/null | grep -E ':(80|3000|5000|6379|8000|8001|8002|8003)' | head -10" || echo "No ports in use"

# Check for legacy deployment artifacts
echo -e "\n${YELLOW}📁 Legacy deployment artifacts:${NC}"
LEGACY_DIRS=$(ssh -i "$SSH_KEY" "$DANBIAN_HOST" "find /opt /home/dlittle /var/lib -name '*markdown-manager*' -type d 2>/dev/null" || true)
if [ -n "$LEGACY_DIRS" ]; then
    echo -e "${RED}⚠️  Found legacy directories:${NC}"
    echo "$LEGACY_DIRS"
else
    echo -e "${GREEN}✅ No legacy directories found${NC}"
fi

# Health check endpoints
echo -e "\n${YELLOW}🏥 Service health checks:${NC}"
SERVICES=("backend:8000" "export:8001" "linting:8002" "spell-check:8003")

for service in "${SERVICES[@]}"; do
    name=${service%:*}
    port=${service#*:}
    
    if ssh -i "$SSH_KEY" "$DANBIAN_HOST" "curl -s -f http://localhost:$port/health >/dev/null 2>&1"; then
        echo -e "${GREEN}✅ $name ($port) - healthy${NC}"
    else
        echo -e "${RED}❌ $name ($port) - not responding${NC}"
    fi
done

# Redis check
echo -e "\n${YELLOW}🔴 Redis status:${NC}"
if ssh -i "$SSH_KEY" "$DANBIAN_HOST" "docker exec markdown-manager-redis redis-cli ping 2>/dev/null | grep -q PONG"; then
    echo -e "${GREEN}✅ Redis - responding${NC}"
else
    echo -e "${RED}❌ Redis - not responding${NC}"
fi

# UI check (static files)
echo -e "\n${YELLOW}🎨 UI status (static files):${NC}"
if ssh -i "$SSH_KEY" "$DANBIAN_HOST" "curl -s -I http://localhost/ 2>/dev/null | grep -q '200 OK'"; then
    echo -e "${GREEN}✅ UI - serving static files${NC}"
else
    echo -e "${RED}❌ UI - not serving${NC}"
fi

echo -e "\n${BLUE}📊 Summary:${NC}"
echo -e "Run ${YELLOW}./deploy-ansible.sh cleanup-legacy${NC} to remove legacy artifacts"
echo -e "Run ${YELLOW}./deploy-ansible.sh all${NC} to deploy Ansible-managed services"
echo -e "See ${YELLOW}deployment/MIGRATION.md${NC} for detailed migration guide"