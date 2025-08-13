#!/bin/bash
# diagnose-env.sh - Diagnose environment file issues

set -e

source ./scripts/colors.sh

REMOTE_USER_HOST="${1:-}"
PROD_ENV_FILE="${2:-/etc/markdown-manager.env}"
KEY=~/.ssh/id_danbian

if [ -z "$REMOTE_USER_HOST" ]; then
    echo -e "${RED}❌ Usage: $0 <remote_user_host> [env_file]${NC}"
    echo -e "${BLUE}Example: $0 user@host${NC}"
    exit 1
fi

echo -e "${YELLOW}🔍 Diagnosing environment file: $PROD_ENV_FILE${NC}"

ssh -q -T -i $KEY "$REMOTE_USER_HOST" bash << EOF
set -e

echo -e "${BLUE}=== File Existence Check ===${NC}"
if [ -f "$PROD_ENV_FILE" ]; then
    echo -e "${GREEN}✅ File exists: $PROD_ENV_FILE${NC}"
else
    echo -e "${RED}❌ File does not exist: $PROD_ENV_FILE${NC}"
    exit 1
fi

echo -e "${BLUE}=== File Permissions ===${NC}"
ls -la "$PROD_ENV_FILE"

echo -e "${BLUE}=== File Size ===${NC}"
echo -e "${BLUE}Testing: sudo -n wc -c $PROD_ENV_FILE${NC}"
if sudo -n wc -c "$PROD_ENV_FILE" 2>/dev/null; then
    echo -e "${GREEN}✅ wc command works with sudo${NC}"
else
    echo -e "${RED}❌ wc command failed with sudo${NC}"
    echo -e "${BLUE}💡 Trying alternative: sudo -n cat | wc -c${NC}"
    if sudo -n cat "$PROD_ENV_FILE" | wc -c 2>/dev/null; then
        echo -e "${GREEN}✅ Alternative wc method works${NC}"
    else
        echo -e "${RED}❌ Both wc methods failed${NC}"
    fi
fi

echo -e "${BLUE}=== Testing Individual Sudo Commands ===${NC}"
echo -e "${BLUE}Testing: sudo -n cat${NC}"
if sudo -n cat "$PROD_ENV_FILE" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ sudo -n cat works${NC}"
else
    echo -e "${RED}❌ sudo -n cat failed${NC}"
fi

echo -e "${BLUE}Testing: sudo -n head${NC}"
if sudo -n head "$PROD_ENV_FILE" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ sudo -n head works${NC}"
else
    echo -e "${RED}❌ sudo -n head failed${NC}"
fi

echo -e "${BLUE}Testing: sudo -n wc${NC}"
if sudo -n wc "$PROD_ENV_FILE" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ sudo -n wc works${NC}"
else
    echo -e "${RED}❌ sudo -n wc failed${NC}"
    echo -e "${BLUE}💡 Checking wc location: \$(which wc)${NC}"
    which wc
fi

echo -e "${BLUE}=== Sudo Test (non-interactive) ===${NC}"
if sudo -n cat "$PROD_ENV_FILE" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Can read file with sudo -n${NC}"
else
    echo -e "${RED}❌ Cannot read file with sudo -n${NC}"
    echo -e "${BLUE}💡 You may need to configure sudoers${NC}"
fi

echo -e "${BLUE}=== Raw File Contents (first 20 lines) ===${NC}"
if sudo -n head -20 "$PROD_ENV_FILE" 2>/dev/null; then
    echo -e "${GREEN}✅ File read successfully${NC}"
else
    echo -e "${RED}❌ Failed to read file contents${NC}"
fi

echo -e "${BLUE}=== Lines After Comment Filtering ===${NC}"
if RAW_CONTENT=\$(sudo -n cat "$PROD_ENV_FILE" 2>/dev/null); then
    echo "Total lines: \$(echo "\$RAW_CONTENT" | wc -l)"
    echo "Non-comment lines: \$(echo "\$RAW_CONTENT" | grep -v '^#' | wc -l)"
    echo "Non-empty lines: \$(echo "\$RAW_CONTENT" | grep -v '^#' | grep -v '^\$' | wc -l)"
    echo -e "${BLUE}Filtered content:${NC}"
    echo "\$RAW_CONTENT" | grep -v '^#' | grep -v '^\$' | while read line; do
        echo "  \$line"
    done
else
    echo -e "${RED}❌ Could not read file${NC}"
fi

EOF

echo -e "${GREEN}✅ Diagnosis complete${NC}"
