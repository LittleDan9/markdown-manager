#!/bin/bash
# setup-remote-ops.sh - Set up operational scripts on remote server

set -e

# Colors for output
source ./scripts/colors.sh

REMOTE_USER_HOST="${1:-}"
REMOTE_OPS_DIR="${2:-\$HOME/markdown-manager-ops}"

if [ -z "$REMOTE_USER_HOST" ]; then
    echo -e "${RED}❌ Usage: $0 <remote_user_host> [remote_ops_dir]${NC}"
    echo -e "${BLUE}Example: $0 user@host${NC}"
    exit 1
fi

echo -e "${BLUE}🚀 Setting up operational environment on $REMOTE_USER_HOST...${NC}"

# Create remote operations directory and copy scripts
echo -e "${YELLOW}📁 Creating remote operations directory...${NC}"
ssh -i ~/.ssh/id_danbian "$REMOTE_USER_HOST" "mkdir -p \$HOME/markdown-manager-ops"

# Copy operational scripts to remote server
echo -e "${YELLOW}📦 Copying operational scripts...${NC}"
scp -i ~/.ssh/id_danbian -r scripts/*.py scripts/colors.sh "$REMOTE_USER_HOST:~/markdown-manager-ops/"

# Set up Python virtual environment for operations
echo -e "${YELLOW}🐍 Setting up Python environment...${NC}"
ssh -i ~/.ssh/id_danbian "$REMOTE_USER_HOST" bash << EOF
set -e

cd \$HOME/markdown-manager-ops

# Install Python virtual environment if not exists
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate and install dependencies
source venv/bin/activate

# Install required packages
pip install --upgrade pip
pip install asyncpg sqlalchemy psycopg2-binary alembic alembic

echo "✅ Python environment ready"
EOF

echo -e "${GREEN}✅ Remote operational environment setup complete${NC}"
echo -e "${BLUE}📁 Scripts located at: \$HOME/markdown-manager-ops${NC}"
echo -e "${BLUE}🐍 Python environment: \$HOME/markdown-manager-ops/venv${NC}"
