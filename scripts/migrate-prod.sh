#!/bin/bash
# migrate-prod.sh - Complete database reset: clear DB → fresh migrations → ready for restore

set -e

# Colors for output
source ./scripts/colors.sh

REMOTE_USER_HOST="${1:-}"
BACKEND_BASE="${2:-}"
PROD_ENV_FILE="${3:-/etc/markdown-manager.env}"
KEY=~/.ssh/id_danbian

if [ -z "$REMOTE_USER_HOST" ] || [ -z "$BACKEND_BASE" ]; then
    echo -e "${RED}❌ Usage: $0 <remote_user_host> <backend_base> [env_file]${NC}"
    echo -e "${BLUE}Example: $0 user@host /opt/markdown-manager-api${NC}"
    exit 1
fi

echo -e "${YELLOW}🔄 Running complete database reset on production...${NC}"
echo -e "${BLUE}ℹ️ Target: $REMOTE_USER_HOST${NC}"
echo -e "${BLUE}ℹ️ Backend: $BACKEND_BASE${NC}"
echo -e "${BLUE}ℹ️ Environment: $PROD_ENV_FILE${NC}"

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

# Run complete database reset on remote server
echo -e "${YELLOW}🔄 Running database reset on remote server...${NC}"
ssh -q -T -i $KEY "$REMOTE_USER_HOST" bash << 'EOF'
set -e

if [ ! -f "/etc/markdown-manager.env" ]; then
    echo -e "\033[31m❌ Production env file not found: /etc/markdown-manager.env\033[0m"
    exit 1
fi

echo -e "\033[34mℹ️ Reading DATABASE_URL from /etc/markdown-manager.env\033[0m"
DATABASE_URL=$(sudo -n cat "/etc/markdown-manager.env" | grep '^DATABASE_URL=' | cut -d'=' -f2-)

if [ -z "$DATABASE_URL" ]; then
    echo -e "\033[31m❌ DATABASE_URL not found in /etc/markdown-manager.env\033[0m"
    exit 1
fi

echo -e "\033[32m✅ DATABASE_URL found (connection string hidden for security)\033[0m"

# Step 1: Clear database using psql
echo -e "\033[33m🗑️ Step 1: Clearing database using psql...\033[0m"
PSQL_URL=$(echo "$DATABASE_URL" | sed 's/postgresql+asyncpg:/postgresql:/')

psql "$PSQL_URL" -c "
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
" && echo -e "\033[32m✅ Database cleared\033[0m"

# Step 2: Run fresh migrations from Docker container
echo -e "\033[33m🔄 Step 2: Running fresh migrations from Docker container...\033[0m"

# Find the running backend container
CONTAINER_ID=$(docker ps --filter "ancestor=littledan9/markdown-manager:latest" --format "{{.ID}}" | head -1)

if [ -z "$CONTAINER_ID" ]; then
    echo -e "\033[31m❌ No running markdown-manager container found\033[0m"
    echo -e "\033[34m💡 Make sure the backend container is running\033[0m"
    exit 1
fi

echo -e "\033[34mℹ️ Using container: $CONTAINER_ID\033[0m"

echo -e "\033[33m🔄 Running alembic upgrade head...\033[0m"
docker exec -e DATABASE_URL="$DATABASE_URL" $CONTAINER_ID \
    poetry run alembic upgrade head

echo -e "\033[32m✅ Fresh migrations completed\033[0m"
echo -e "\033[32m✅ Database is now ready for data restore\033[0m"
EOF

echo -e "${GREEN}✅ Complete database reset completed successfully${NC}"
echo -e "${BLUE}💡 Database is now empty with fresh schema - ready for restore!${NC}"
