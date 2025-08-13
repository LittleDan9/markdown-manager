#!/bin/bash
# db-restore-prod.sh - Restore production database using remote operational environment

set -e

# Colors for output
source ./scripts/colors.sh

REMOTE_USER_HOST="${1:-}"
BACKEND_BASE="${2:-}"
PROD_ENV_FILE="${3:-/etc/markdown-manager.env}"
BACKUP_FILE="${4:-}"
REMOTE_OPS_DIR="${5:-\$HOME/markdown-manager-ops}"
KEY=~/.ssh/id_danbian

if [ -z "$REMOTE_USER_HOST" ] || [ -z "$BACKEND_BASE" ] || [ -z "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Usage: $0 <remote_user_host> <backend_base> [env_file] <backup_file> [remote_ops_dir]${NC}"
    echo -e "${BLUE}Example: $0 user@host /opt/markdown-manager-api ./backups/production_backup_20240812_123456.json${NC}"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

echo -e "${BLUE}🚀 Starting production database restore...${NC}"
echo -e "${BLUE}📡 Remote: $REMOTE_USER_HOST${NC}"
echo -e "${BLUE}📂 Backend: $BACKEND_BASE${NC}"
echo -e "${BLUE}🔐 Env file: $PROD_ENV_FILE${NC}"
echo -e "${BLUE}📁 Backup file: $BACKUP_FILE${NC}"
echo -e "${BLUE}🛠️ Ops directory: $REMOTE_OPS_DIR${NC}"

# Check if key exists
if [ ! -f "$KEY" ]; then
    echo -e "${RED}❌ SSH key not found: $KEY${NC}"
    exit 1
fi

echo -e "${YELLOW}⚠️ WARNING: This will completely replace the production database!${NC}"
read -p "Are you sure you want to continue? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo -e "${BLUE}❌ Operation cancelled${NC}"
    exit 0
fi

# Test SSH connectivity
echo -e "${YELLOW}🔑 Testing SSH connectivity...${NC}"
if ! ssh -o ConnectTimeout=10 -i $KEY "$REMOTE_USER_HOST" "echo 'SSH connection successful'" 2>/dev/null; then
    echo -e "${RED}❌ Failed to connect to remote server${NC}"
    exit 1
fi

echo -e "${GREEN}✅ SSH connection successful${NC}"

# Upload backup file to remote server
echo -e "${YELLOW}📤 Uploading backup file...${NC}"
scp -q -i $KEY "$BACKUP_FILE" "$REMOTE_USER_HOST:/tmp/restore_backup.json"

# Run restore on remote server
echo -e "${YELLOW}🔄 Restoring database on remote server...${NC}"
ssh -q -T -i $KEY "$REMOTE_USER_HOST" bash << EOF
set -e

if [ ! -f "$PROD_ENV_FILE" ]; then
    echo -e "${RED}❌ Production env file not found: $PROD_ENV_FILE${NC}"
    exit 1
fi

# Extract DATABASE_URL directly from the file
echo -e "${BLUE}ℹ️ Reading DATABASE_URL from $PROD_ENV_FILE${NC}"
DATABASE_URL=\$(sudo -n cat "$PROD_ENV_FILE" | grep '^DATABASE_URL=' | cut -d'=' -f2-)

if [ -z "\$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL not found in $PROD_ENV_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}✅ DATABASE_URL found${NC}"

# Check if operational environment exists
if [ ! -d "$REMOTE_OPS_DIR" ] || [ ! -f "$REMOTE_OPS_DIR/restore_production_data.py" ]; then
    echo -e "${RED}❌ Operational environment not found at $REMOTE_OPS_DIR${NC}"
    echo -e "${BLUE}💡 Run 'make setup-remote-ops' first to set up the environment${NC}"
    exit 1
fi

cd "$REMOTE_OPS_DIR"

echo -e "${YELLOW}🔄 Running restore script in operational environment...${NC}"

# Activate Python virtual environment and run restore
source venv/bin/activate
python restore_production_data.py \
    --db-url "\$DATABASE_URL" \
    --backup-file /tmp/restore_backup.json \
    --clear

echo -e "${GREEN}✅ Database restore completed on remote server${NC}"

# Clean up backup file
rm -f /tmp/restore_backup.json
echo -e "${BLUE}🧹 Cleaned up temporary files${NC}"
EOF

echo -e "${GREEN}✅ Production database restore completed successfully${NC}"
echo -e "${BLUE}💡 The database has been restored from: $BACKUP_FILE${NC}"
