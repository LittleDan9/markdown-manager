#!/usr/bin/env bash
# Quick backup script for essential user data before migration
# Backs up only what's needed: documents, database, and config

set -euo pipefail

# Configuration
DANBIAN_HOST="dlittle@10.0.1.51"
SSH_KEY="~/.ssh/id_danbian"
DATE=$(date +%Y%m%d-%H%M%S)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📦 Quick Backup of Essential User Data${NC}"
echo -e "${YELLOW}Backing up only documents, database, and config files${NC}"
echo ""

# Check SSH connectivity
if ! ssh -i "$SSH_KEY" -o ConnectTimeout=10 "$DANBIAN_HOST" "echo 'SSH OK'" >/dev/null 2>&1; then
    echo -e "${RED}❌ SSH connection failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ SSH connection working${NC}"

# Create backup directory
BACKUP_DIR="./backup-essential-data-$DATE"
mkdir -p "$BACKUP_DIR"
echo -e "${GREEN}📁 Created backup directory: $BACKUP_DIR${NC}"

# Backup user documents (the most critical data)
echo -e "\n${YELLOW}📄 Backing up user documents...${NC}"
if ssh -i "$SSH_KEY" "$DANBIAN_HOST" "test -d '/opt/markdown-manager-api/documents'" 2>/dev/null; then
    scp -i "$SSH_KEY" -r "$DANBIAN_HOST:/opt/markdown-manager-api/documents" "$BACKUP_DIR/" 2>/dev/null || true
    DOC_COUNT=$(find "$BACKUP_DIR/documents" -type f 2>/dev/null | wc -l || echo "0")
    DOC_SIZE=$(du -sh "$BACKUP_DIR/documents" 2>/dev/null | cut -f1 || echo "0")
    echo -e "${GREEN}✅ Documents backed up: $DOC_COUNT files, $DOC_SIZE${NC}"
else
    echo -e "${YELLOW}⚠️ No documents directory found${NC}"
fi

# Backup database
echo -e "\n${YELLOW}🗄️ Backing up database...${NC}"
if ssh -i "$SSH_KEY" "$DANBIAN_HOST" "test -f '/opt/markdown-manager-api/app/markdown_manager.db'" 2>/dev/null; then
    scp -i "$SSH_KEY" "$DANBIAN_HOST:/opt/markdown-manager-api/app/markdown_manager.db" "$BACKUP_DIR/markdown_manager.db" 2>/dev/null || true
    if [ -f "$BACKUP_DIR/markdown_manager.db" ]; then
        DB_SIZE=$(du -sh "$BACKUP_DIR/markdown_manager.db" 2>/dev/null | cut -f1 || echo "0")
        echo -e "${GREEN}✅ Database backed up: $DB_SIZE${NC}"
    else
        echo -e "${RED}❌ Database backup failed${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ No database file found${NC}"
fi

# Backup environment config
echo -e "\n${YELLOW}⚙️ Backing up configuration...${NC}"
if ssh -i "$SSH_KEY" "$DANBIAN_HOST" "test -f '/opt/markdown-manager-api/.env'" 2>/dev/null; then
    scp -i "$SSH_KEY" "$DANBIAN_HOST:/opt/markdown-manager-api/.env" "$BACKUP_DIR/production.env" 2>/dev/null || true
    if [ -f "$BACKUP_DIR/production.env" ]; then
        echo -e "${GREEN}✅ Configuration backed up${NC}"
    else
        echo -e "${RED}❌ Configuration backup failed${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ No .env file found${NC}"
fi

# Show backup summary
echo -e "\n${BLUE}📊 Backup Summary:${NC}"
if [ -d "$BACKUP_DIR" ]; then
    TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1 || echo "0")
    TOTAL_FILES=$(find "$BACKUP_DIR" -type f 2>/dev/null | wc -l || echo "0")
    echo -e "${GREEN}📁 Backup location: $BACKUP_DIR${NC}"
    echo -e "${GREEN}📊 Total size: $TOTAL_SIZE${NC}"
    echo -e "${GREEN}📄 Total files: $TOTAL_FILES${NC}"
    echo ""
    echo -e "${BLUE}Contents:${NC}"
    ls -la "$BACKUP_DIR/"
else
    echo -e "${RED}❌ Backup directory not created${NC}"
    exit 1
fi

echo -e "\n${GREEN}✅ Essential data backup completed!${NC}"
echo ""
echo -e "${BLUE}🚀 Next Steps:${NC}"
echo -e "1. Verify backup contents: ${YELLOW}ls -la $BACKUP_DIR/documents/${NC}"
echo -e "2. Run migration cleanup: ${YELLOW}./deployment/cleanup-legacy.sh${NC}"
echo -e "3. Deploy new services: ${YELLOW}./deploy-ansible.sh all${NC}"
echo -e "4. Restore data to new deployment locations (manual step)"