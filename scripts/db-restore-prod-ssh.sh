#!/bin/bash
# db-restore-prod-ssh.sh - Restore production database using SSH port forwarding

set -e

# Colors for output
source ./scripts/colors.sh

# Source WSL environment setup functions
source ./scripts/setup-wsl-env.sh

REMOTE_USER_HOST="${1:-}"
BACKEND_BASE="${2:-}"
PROD_ENV_FILE="${3:-/etc/markdown-manager.env}"
BACKUP_FILE="${4:-}"
KEY=~/.ssh/id_danbian

if [ -z "$REMOTE_USER_HOST" ] || [ -z "$BACKEND_BASE" ] || [ -z "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Usage: $0 <remote_user_host> <backend_base> [env_file] <backup_file>${NC}"
    echo -e "${BLUE}Example: $0 user@host /opt/markdown-manager-api ./backups/production_backup_20240812_123456.json${NC}"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

echo -e "${BLUE}🚀 Starting production database restore via SSH port forwarding...${NC}"
echo -e "${BLUE}📡 Remote: $REMOTE_USER_HOST${NC}"
echo -e "${BLUE}📂 Backend: $BACKEND_BASE${NC}"
echo -e "${BLUE}🔐 Env file: $PROD_ENV_FILE${NC}"
echo -e "${BLUE}📁 Backup file: $BACKUP_FILE${NC}"

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

# Extract DATABASE_URL from remote server
echo -e "${YELLOW}🔍 Extracting database connection info from remote server...${NC}"
DATABASE_URL=$(ssh -q -i $KEY "$REMOTE_USER_HOST" "sudo -n cat $PROD_ENV_FILE | grep '^DATABASE_URL=' | cut -d'=' -f2-" 2>/dev/null)

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ Failed to extract DATABASE_URL from remote server${NC}"
    exit 1
fi

echo -e "${GREEN}✅ DATABASE_URL extracted${NC}"

# Parse DATABASE_URL to extract connection details
# Expected format: postgresql://user:pass@host:port/dbname or postgresql+asyncpg://user:pass@host:port/dbname
if [[ $DATABASE_URL =~ postgresql(\+asyncpg)?://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+) ]]; then
    DB_USER="${BASH_REMATCH[2]}"
    DB_PASS="${BASH_REMATCH[3]}"
    DB_HOST="${BASH_REMATCH[4]}"
    DB_PORT="${BASH_REMATCH[5]}"
    DB_NAME="${BASH_REMATCH[6]}"
else
    echo -e "${RED}❌ Failed to parse DATABASE_URL format. Expected: postgresql://user:pass@host:port/dbname${NC}"
    exit 1
fi

echo -e "${BLUE}📊 Database details:${NC}"
echo -e "${BLUE}  Host: $DB_HOST${NC}"
echo -e "${BLUE}  Port: $DB_PORT${NC}"
echo -e "${BLUE}  Database: $DB_NAME${NC}"
echo -e "${BLUE}  User: $DB_USER${NC}"

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

# Test local connection through tunnel
echo -e "${YELLOW}🧪 Testing database connection through SSH tunnel...${NC}"
LOCAL_DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:$LOCAL_PORT/$DB_NAME"

if ! timeout 10 python3 -c "
import asyncpg
import asyncio
async def test():
    try:
        conn = await asyncpg.connect('$LOCAL_DATABASE_URL')
        await conn.close()
        print('Connection successful')
    except Exception as e:
        print(f'Connection failed: {e}')
        exit(1)
asyncio.run(test())
" 2>/dev/null; then
    echo -e "${RED}❌ Failed to connect to database through SSH tunnel${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Database connection through SSH tunnel successful${NC}"

# Run restore using local Python environment
echo -e "${YELLOW}🔄 Restoring database using local environment...${NC}"
cd backend

# Activate virtual environment if it exists
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
elif [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
fi

# Check if restore script exists
if [ ! -f "../scripts/restore_production_data.py" ]; then
    echo -e "${RED}❌ Restore script not found: ../scripts/restore_production_data.py${NC}"
    exit 1
fi

# Run restore script with local connection
python ../scripts/restore_production_data.py \
    --db-url "$LOCAL_DATABASE_URL" \
    --backup-file "../$BACKUP_FILE" \
    --clear

echo -e "${GREEN}✅ Production database restore completed successfully${NC}"
echo -e "${BLUE}💡 The database has been restored from: $BACKUP_FILE${NC}"

# Cleanup will happen automatically via trap
