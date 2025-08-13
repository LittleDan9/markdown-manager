#!/bin/bash
# db-backup-prod.sh - Backup production database using remote operational environment

set -e

# Colors for output
source ./scripts/colors.sh

REMOTE_USER_HOST="${1:-}"
BACKEND_BASE="${2:-}"
PROD_ENV_FILE="${3:-/etc/markdown-manager.env}"
LOCAL_BACKUP_DIR="${4:-./backups}"
REMOTE_OPS_DIR="${5:-\$HOME/markdown-manager-ops}"
KEY=~/.ssh/id_danbian

if [ -z "$REMOTE_USER_HOST" ] || [ -z "$BACKEND_BASE" ]; then
    echo -e "${RED}❌ Usage: $0 <remote_user_host> <backend_base> [env_file] [local_backup_dir] [remote_ops_dir]${NC}"
    echo -e "${BLUE}Example: $0 user@host /opt/markdown-manager-api${NC}"
    exit 1
fi

echo -e "${BLUE}🚀 Starting production database backup...${NC}"
echo -e "${BLUE}📡 Remote: $REMOTE_USER_HOST${NC}"
echo -e "${BLUE}📂 Backend: $BACKEND_BASE${NC}"
echo -e "${BLUE}🔐 Env file: $PROD_ENV_FILE${NC}"
echo -e "${BLUE}🛠️ Ops directory: $REMOTE_OPS_DIR${NC}"

# Create local backup directory
mkdir -p "$LOCAL_BACKUP_DIR"

# Check if key exists
if [ ! -f "$KEY" ]; then
    echo -e "${RED}❌ SSH key not found: $KEY${NC}"
    exit 1
fi

# Test SSH connectivity
echo -e "${YELLOW}🔑 Testing SSH connectivity...${NC}"
if ! ssh -o ConnectTimeout=10 -i $KEY "$REMOTE_USER_HOST" "echo 'SSH connection successful'" 2>/dev/null; then
    echo -e "${RED}❌ Failed to connect to remote server${NC}"
    exit 1
fi

echo -e "${GREEN}✅ SSH connection successful${NC}"

# Run backup on remote server
echo -e "${YELLOW}📦 Creating backup on remote server...${NC}"
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
if [ ! -d "$REMOTE_OPS_DIR" ] || [ ! -f "$REMOTE_OPS_DIR/backup_production_data.py" ]; then
    echo -e "${RED}❌ Operational environment not found at $REMOTE_OPS_DIR${NC}"
    echo -e "${BLUE}💡 Run 'make setup-remote-ops' first to set up the environment${NC}"
    exit 1
fi

cd "$REMOTE_OPS_DIR"

# Clean up old backups
rm -rf /tmp/db-backup
mkdir -p /tmp/db-backup

echo -e "${YELLOW}🔄 Running backup script in operational environment...${NC}"

# Activate Python virtual environment and run backup
source venv/bin/activate
python backup_production_data.py \
    --db-url "\$DATABASE_URL" \
    --output-dir /tmp/db-backup

echo -e "${GREEN}✅ Backup created on remote server${NC}"
EOF

# Find the most recent backup file
echo -e "${YELLOW}📥 Downloading backup file...${NC}"
BACKUP_FILE=$(ssh -q -i $KEY "$REMOTE_USER_HOST" 'ls -t /tmp/db-backup/production_backup_*.json 2>/dev/null | head -1' || echo "")

if [ -z "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ No backup file found on remote server${NC}"
    exit 1
fi

BACKUP_NAME=$(basename "$BACKUP_FILE")
LOCAL_BACKUP_PATH="$LOCAL_BACKUP_DIR/$BACKUP_NAME"

# Download the backup file
scp -q -i $KEY "$REMOTE_USER_HOST:$BACKUP_FILE" "$LOCAL_BACKUP_PATH"

# Also download the summary file if it exists
SUMMARY_FILE="${BACKUP_FILE%.*}_summary.json"
SUMMARY_FILE="${SUMMARY_FILE/production_backup_/backup_summary_}"
LOCAL_SUMMARY_PATH="$LOCAL_BACKUP_DIR/$(basename "$SUMMARY_FILE")"

if ssh -q -i $KEY "$REMOTE_USER_HOST" "test -f '$SUMMARY_FILE'"; then
    scp -q -i $KEY "$REMOTE_USER_HOST:$SUMMARY_FILE" "$LOCAL_SUMMARY_PATH"
    echo -e "${GREEN}✅ Downloaded backup summary${NC}"
fi

# Clean up remote backup files
ssh -q -i $KEY "$REMOTE_USER_HOST" "rm -rf /tmp/db-backup"

echo -e "${GREEN}✅ Production database backup completed successfully${NC}"
echo -e "${BLUE}📁 Backup file: $LOCAL_BACKUP_PATH${NC}"
if [ -f "$LOCAL_SUMMARY_PATH" ]; then
    echo -e "${BLUE}📄 Summary file: $LOCAL_SUMMARY_PATH${NC}"
fi
