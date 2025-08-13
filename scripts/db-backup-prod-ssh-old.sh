#!/bin/bash
# db-backup-prod-ssh.sh - Backup production database using SSH port forwarding and WSL environment

set -e

# Colors for output
source ./scripts/colors.sh

REMOTE_USER_HOST="${1:-}"
BACKEND_BASE="${2:-}"
PROD_ENV_FILE="${3:-/etc/markdown-manager.env}"
LOCAL_BACKUP_DIR="${4:-./backups}"
KEY=~/.ssh/id_danbian

if [ -z "$REMOTE_USER_HOST" ] || [ -z "$BACKEND_BASE" ]; then
    echo -e "${RED}❌ Usage: $0 <remote_user_host> <backend_base> [env_file] [local_backup_dir]${NC}"
    echo -e "${BLUE}Example: $0 user@host /opt/markdown-manager-api${NC}"
    exit 1
fi

echo -e "${BLUE}🚀 Starting production database backup via SSH port forwarding...${NC}"
echo -e "${BLUE}📡 Remote: $REMOTE_USER_HOST${NC}"
echo -e "${BLUE}📂 Backend: $BACKEND_BASE${NC}"
echo -e "${BLUE}🔐 Env file: $PROD_ENV_FILE${NC}"

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

# Set up WSL environment using project's pyproject.toml
source ./scripts/setup-wsl-env.sh
setup_wsl_environment

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to set up WSL environment${NC}"
    exit 1
fi

# Extract DATABASE_URL from remote server
echo -e "${YELLOW}🔍 Extracting database connection info from remote server...${NC}"
DATABASE_URL=$(ssh -q -i $KEY "$REMOTE_USER_HOST" "sudo -n cat $PROD_ENV_FILE | grep '^DATABASE_URL=' | cut -d'=' -f2-" 2>/dev/null)

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ Failed to extract DATABASE_URL from remote server${NC}"
    exit 1
fi

echo -e "${GREEN}✅ DATABASE_URL extracted${NC}"

# Debug: Check URL format without exposing credentials
URL_PREFIX=$(echo "$DATABASE_URL" | cut -d'/' -f1-3)
echo -e "${BLUE}🔍 URL format starts with: $URL_PREFIX${NC}"

# Parse DATABASE_URL to extract connection details
# Expected format: postgresql://user:pass@host:port/dbname or postgresql+asyncpg://user:pass@host:port/dbname
if [[ $DATABASE_URL =~ postgresql(\+asyncpg)?://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+) ]]; then
    DB_USER="${BASH_REMATCH[2]}"
    DB_PASS="${BASH_REMATCH[3]}"
    DB_HOST="${BASH_REMATCH[4]}"
    DB_PORT="${BASH_REMATCH[5]}"
    DB_NAME="${BASH_REMATCH[6]}"
    
    # URL decode the password using Python
    DB_PASS=$(run_in_wsl_env "python -c \"import urllib.parse; print(urllib.parse.unquote('$DB_PASS'))\"")
    
else
    echo -e "${RED}❌ Failed to parse DATABASE_URL format. Expected: postgresql://user:pass@host:port/dbname${NC}"
    exit 1
fi

echo -e "${BLUE}📊 Database details:${NC}"
echo -e "${BLUE}  Host: $DB_HOST${NC}"
echo -e "${BLUE}  Port: $DB_PORT${NC}"
echo -e "${BLUE}  Database: $DB_NAME${NC}"
echo -e "${BLUE}  User: $DB_USER${NC}"
echo -e "${BLUE}  Password: [HIDDEN]${NC}"

# Find available local port for forwarding
LOCAL_PORT=5433
while ss -tuln 2>/dev/null | grep -q ":$LOCAL_PORT " || netstat -an 2>/dev/null | grep -q ":$LOCAL_PORT "; do
    LOCAL_PORT=$((LOCAL_PORT + 1))
done

echo -e "${YELLOW}🔗 Setting up SSH port forwarding: localhost:$LOCAL_PORT -> $DB_HOST:$DB_PORT${NC}"

# Set up SSH port forwarding in background
ssh -f -N -L $LOCAL_PORT:$DB_HOST:$DB_PORT -i $KEY "$REMOTE_USER_HOST"
SSH_PID=$!

# Cleanup function
cleanup() {
    echo -e "${YELLOW}🧹 Cleaning up SSH port forwarding...${NC}"
    if [ ! -z "$SSH_PID" ]; then
        kill $SSH_PID 2>/dev/null || true
    fi
    # Also kill any remaining SSH forwarding processes
    pkill -f "ssh.*-L $LOCAL_PORT:$DB_HOST:$DB_PORT" 2>/dev/null || true
}

# Set trap to cleanup on exit
trap cleanup EXIT

# Wait a moment for SSH tunnel to establish
sleep 2

# Test local connection through tunnel using WSL environment
echo -e "${YELLOW}🧪 Testing database connection through SSH tunnel...${NC}"

# Use the WSL environment to test connection
if ! run_in_wsl_env "python -c \"
import asyncpg
import asyncio
async def test():
    try:
        conn = await asyncpg.connect(
            host='localhost', 
            port=$LOCAL_PORT, 
            database='$DB_NAME', 
            user='$DB_USER', 
            password='$DB_PASS'
        )
        await conn.close()
        print('Connection successful')
    except Exception as e:
        print(f'Connection failed: {e}')
        exit(1)
asyncio.run(test())
\""; then
    echo -e "${RED}❌ Failed to connect to database through SSH tunnel${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Database connection through SSH tunnel successful${NC}"

# Run backup using WSL environment and Poetry
echo -e "${YELLOW}📦 Creating backup using WSL environment...${NC}"

# Create temporary backup directory
TEMP_BACKUP_DIR="/tmp/db-backup-$$"
mkdir -p "$TEMP_BACKUP_DIR"

# Check if backup script exists in WSL environment
if [ ! -f "$WSL_ENV_DIR/scripts/backup_production_data.py" ]; then
    echo -e "${RED}❌ Backup script not found in WSL environment${NC}"
    exit 1
fi

# Run backup script with local connection through SSH tunnel
run_in_wsl_env "python scripts/backup_production_data.py \
    --db-url 'postgresql://$DB_USER:$DB_PASS@localhost:$LOCAL_PORT/$DB_NAME' \
    --output-dir '$TEMP_BACKUP_DIR'"

# Move backup files to final location
BACKUP_FILE=$(ls -t "$TEMP_BACKUP_DIR"/production_backup_*.json 2>/dev/null | head -1)
if [ -z "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ No backup file created${NC}"
    exit 1
fi

BACKUP_NAME=$(basename "$BACKUP_FILE")
LOCAL_BACKUP_PATH="$LOCAL_BACKUP_DIR/$BACKUP_NAME"
mv "$BACKUP_FILE" "$LOCAL_BACKUP_PATH"

# Move summary file if it exists
SUMMARY_FILE="$TEMP_BACKUP_DIR/backup_summary_$(echo $BACKUP_NAME | sed 's/production_backup_//' | sed 's/.json/.json/')"
if [ -f "$SUMMARY_FILE" ]; then
    LOCAL_SUMMARY_PATH="$LOCAL_BACKUP_DIR/$(basename "$SUMMARY_FILE")"
    mv "$SUMMARY_FILE" "$LOCAL_SUMMARY_PATH"
    echo -e "${GREEN}✅ Backup summary created${NC}"
fi

# Clean up temporary directory
rm -rf "$TEMP_BACKUP_DIR"

echo -e "${GREEN}✅ Production database backup completed successfully${NC}"
echo -e "${BLUE}📁 Backup file: $LOCAL_BACKUP_PATH${NC}"
if [ -f "$LOCAL_SUMMARY_PATH" ]; then
    echo -e "${BLUE}📄 Summary file: $LOCAL_SUMMARY_PATH${NC}"
fi

# Cleanup will happen automatically via trap
