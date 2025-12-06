#!/usr/bin/env bash
# Data backup and identification script for migration
# Use this BEFORE running cleanup to identify and backup user data

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

echo -e "${BLUE}📊 Pre-Migration Data Assessment${NC}"
echo -e "${YELLOW}Identifying user data that needs to be preserved during migration${NC}"
echo ""

# Check SSH connectivity
if ! ssh -i "$SSH_KEY" -o ConnectTimeout=10 "$DANBIAN_HOST" "echo 'SSH OK'" >/dev/null 2>&1; then
    echo -e "${RED}❌ SSH connection failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ SSH connection working${NC}"

# Find all markdown-manager directories
echo -e "\n${YELLOW}🔍 Scanning for markdown-manager directories...${NC}"
ALL_DIRS=$(ssh -i "$SSH_KEY" "$DANBIAN_HOST" "find /opt /home/dlittle /var/lib -name '*markdown-manager*' -type d 2>/dev/null" || true)

if [ -z "$ALL_DIRS" ]; then
    echo -e "${GREEN}No markdown-manager directories found${NC}"
    exit 0
fi

echo -e "${BLUE}Found directories:${NC}"
echo "$ALL_DIRS"

# Check each directory for user data
echo -e "\n${YELLOW}📁 Analyzing directory contents...${NC}"

while IFS= read -r dir; do
    if [ -n "$dir" ]; then
        echo -e "\n${BLUE}Checking: $dir${NC}"
        
        # Check directory size
        SIZE=$(ssh -i "$SSH_KEY" "$DANBIAN_HOST" "du -sh '$dir' 2>/dev/null | cut -f1" || echo "unknown")
        echo -e "  Size: $SIZE"
        
        # Check for common data subdirectories
        DATA_SUBDIRS=$(ssh -i "$SSH_KEY" "$DANBIAN_HOST" "find '$dir' -maxdepth 2 -type d -name 'documents' -o -name 'storage' -o -name 'data' -o -name 'uploads' -o -name 'files' 2>/dev/null" || true)
        
        if [ -n "$DATA_SUBDIRS" ]; then
            echo -e "${RED}  ⚠️  Contains potential user data directories:${NC}"
            while IFS= read -r subdir; do
                if [ -n "$subdir" ]; then
                    SUBSIZE=$(ssh -i "$SSH_KEY" "$DANBIAN_HOST" "du -sh '$subdir' 2>/dev/null | cut -f1" || echo "unknown")
                    FILE_COUNT=$(ssh -i "$SSH_KEY" "$DANBIAN_HOST" "find '$subdir' -type f 2>/dev/null | wc -l" || echo "unknown")
                    echo -e "    ${YELLOW}$subdir${NC} (${SUBSIZE}, ${FILE_COUNT} files)"
                fi
            done <<< "$DATA_SUBDIRS"
        fi
        
        # Check for database files
        DB_FILES=$(ssh -i "$SSH_KEY" "$DANBIAN_HOST" "find '$dir' -name '*.db' -o -name '*.sqlite*' -o -name 'dump.rdb' 2>/dev/null" || true)
        if [ -n "$DB_FILES" ]; then
            echo -e "${RED}  ⚠️  Contains database files:${NC}"
            while IFS= read -r dbfile; do
                if [ -n "$dbfile" ]; then
                    DBSIZE=$(ssh -i "$SSH_KEY" "$DANBIAN_HOST" "du -sh '$dbfile' 2>/dev/null | cut -f1" || echo "unknown")
                    echo -e "    ${YELLOW}$dbfile${NC} ($DBSIZE)"
                fi
            done <<< "$DB_FILES"
        fi
        
        # Check for configuration files
        CONFIG_FILES=$(ssh -i "$SSH_KEY" "$DANBIAN_HOST" "find '$dir' -maxdepth 2 -name '*.env' -o -name '*.conf' -o -name '*.json' -o -name '*.yml' -o -name '*.yaml' 2>/dev/null | head -5" || true)
        if [ -n "$CONFIG_FILES" ]; then
            echo -e "  📄 Configuration files found (first 5):"
            while IFS= read -r conffile; do
                if [ -n "$conffile" ]; then
                    echo -e "    ${BLUE}$conffile${NC}"
                fi
            done <<< "$CONFIG_FILES"
        fi
        
        # List top-level contents
        CONTENTS=$(ssh -i "$SSH_KEY" "$DANBIAN_HOST" "ls -la '$dir/' 2>/dev/null | head -10" || true)
        if [ -n "$CONTENTS" ]; then
            echo -e "  📋 Directory contents (first 10 items):"
            echo "$CONTENTS" | tail -n +2 | while IFS= read -r line; do
                echo -e "    $line"
            done
        fi
    fi
done <<< "$ALL_DIRS"

echo -e "\n${BLUE}💾 Backup Recommendations:${NC}"
echo ""
echo -e "${YELLOW}CRITICAL DATA TO BACKUP:${NC}"
while IFS= read -r dir; do
    if [ -n "$dir" ]; then
        # Check for user documents
        DOCS_DIR=$(ssh -i "$SSH_KEY" "$DANBIAN_HOST" "find '$dir' -name 'documents' -type d 2>/dev/null" || true)
        if [ -n "$DOCS_DIR" ]; then
            while IFS= read -r docdir; do
                if [ -n "$docdir" ]; then
                    echo -e "${RED}📄 User Documents: $docdir${NC}"
                    echo -e "   Backup command: ${BLUE}scp -i ~/.ssh/id_danbian -r dlittle@10.0.1.51:'$docdir' ./backup-user-documents-$(date +%Y%m%d)/${NC}"
                fi
            done <<< "$DOCS_DIR"
        fi
        
        # Check for database files
        DB_FILES=$(ssh -i "$SSH_KEY" "$DANBIAN_HOST" "find '$dir' -name '*.db' -o -name '*.sqlite*' -o -name 'dump.rdb' 2>/dev/null" || true)
        if [ -n "$DB_FILES" ]; then
            while IFS= read -r dbfile; do
                if [ -n "$dbfile" ]; then
                    echo -e "${RED}🗄️ Database: $dbfile${NC}"
                    echo -e "   Backup command: ${BLUE}scp -i ~/.ssh/id_danbian dlittle@10.0.1.51:'$dbfile' ./backup-database-$(date +%Y%m%d)/$(basename $dbfile)${NC}"
                fi
            done <<< "$DB_FILES"
        fi
        
        # Check for environment/config files
        ENV_FILES=$(ssh -i "$SSH_KEY" "$DANBIAN_HOST" "find '$dir' -maxdepth 1 -name '.env' -o -name '*.conf' 2>/dev/null" || true)
        if [ -n "$ENV_FILES" ]; then
            while IFS= read -r envfile; do
                if [ -n "$envfile" ]; then
                    echo -e "${BLUE}⚙️ Config: $envfile${NC}"
                    echo -e "   Backup command: ${BLUE}scp -i ~/.ssh/id_danbian dlittle@10.0.1.51:'$envfile' ./backup-config-$(date +%Y%m%d)/$(basename $envfile)${NC}"
                fi
            done <<< "$ENV_FILES"
        fi
    fi
done <<< "$ALL_DIRS"

echo ""
echo -e "${GREEN}Safe directories (likely no user data):${NC}"
while IFS= read -r dir; do
    if [ -n "$dir" ]; then
        HAS_DATA=$(ssh -i "$SSH_KEY" "$DANBIAN_HOST" "find '$dir' -name 'documents' -o -name 'storage' -o -name '*.db' -o -name 'dump.rdb' 2>/dev/null" || true)
        if [ -z "$HAS_DATA" ]; then
            echo -e "${GREEN}📁 $dir${NC}"
        fi
    fi
done <<< "$ALL_DIRS"

echo ""
echo -e "${BLUE}💾 Quick Backup Commands:${NC}"
echo -e "${GREEN}# Backup user documents (the important stuff):${NC}"
echo -e "${BLUE}scp -i ~/.ssh/id_danbian -r dlittle@10.0.1.51:'/opt/markdown-manager-api/documents' ./backup-user-documents-$(date +%Y%m%d)/${NC}"
echo ""
echo -e "${GREEN}# Backup database:${NC}"
echo -e "${BLUE}mkdir -p ./backup-database-$(date +%Y%m%d)${NC}"
echo -e "${BLUE}scp -i ~/.ssh/id_danbian dlittle@10.0.1.51:'/opt/markdown-manager-api/app/markdown_manager.db' ./backup-database-$(date +%Y%m%d)/${NC}"
echo ""
echo -e "${GREEN}# Backup environment config:${NC}"
echo -e "${BLUE}mkdir -p ./backup-config-$(date +%Y%m%d)${NC}"
echo -e "${BLUE}scp -i ~/.ssh/id_danbian dlittle@10.0.1.51:'/opt/markdown-manager-api/.env' ./backup-config-$(date +%Y%m%d)/${NC}"
echo ""
echo -e "${BLUE}🚀 Next Steps:${NC}"
echo -e "1. Run the backup commands above (only takes a few seconds for documents)"
echo -e "2. Verify backups: ${YELLOW}ls -la ./backup-*${NC}"
echo -e "3. Run migration cleanup: ${YELLOW}./deployment/cleanup-legacy.sh${NC}"
echo -e "4. Deploy new services: ${YELLOW}./deploy-ansible.sh all${NC}"