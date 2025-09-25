#!/bin/bash

# Fix ownership of storage directories to match container user
# The markdown user inside the container has uid=999, gid=999

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Fixing storage directory ownership for markdown-manager container...${NC}"

# Check if storage directory exists
STORAGE_DIR="/home/dlittle/code/markdown-manager/storage"
if [ ! -d "$STORAGE_DIR" ]; then
    echo -e "${RED}Error: Storage directory not found at $STORAGE_DIR${NC}"
    exit 1
fi

echo -e "${YELLOW}Current ownership:${NC}"
ls -la "$STORAGE_DIR" | head -10

echo -e "\n${YELLOW}Changing ownership to uid=999 gid=999 (markdown container user)...${NC}"

# Change ownership of the entire storage directory tree
# uid=999 is the markdown user inside the container
# gid=999 is the markdown group inside the container
sudo chown -R 999:999 "$STORAGE_DIR"

echo -e "${GREEN}Ownership fixed successfully!${NC}"

echo -e "\n${YELLOW}New ownership:${NC}"
ls -la "$STORAGE_DIR" | head -10

echo -e "\n${GREEN}All storage files are now owned by the markdown container user (999:999)${NC}"
echo -e "${GREEN}This will prevent permission issues when the container creates or modifies files.${NC}"