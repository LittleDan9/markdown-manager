#!/usr/bin/env bash
# ==============================================================================
# Migrate PostgreSQL from host service to Docker container
# ==============================================================================
# This script migrates an existing PostgreSQL database running as a host service
# to the containerized PostgreSQL defined in docker-compose.prod.yml.
#
# Usage:
#   ./scripts/migrate-db-to-container.sh [remote_host]
#
# Steps:
#   1. Dump the existing host-level PostgreSQL database
#   2. Start only the db container in the compose stack
#   3. Restore the dump into the containerized database
#   4. Verify data integrity
#
# Prerequisites:
#   - SSH access to the remote host
#   - docker-compose.prod.yml configured with production.env
#   - Host PostgreSQL still running (will not be stopped by this script)
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
REMOTE_HOST="${1:-dlittle@10.0.1.51}"
APP_DIR="/opt/markdown-manager"
BACKUP_DIR="${PROJECT_DIR}/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DUMP_FILE="${BACKUP_DIR}/pre-migration-${TIMESTAMP}.sql"

# Source colors if available
if [[ -f "${SCRIPT_DIR}/colors.sh" ]]; then
    source "${SCRIPT_DIR}/colors.sh"
else
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    NC='\033[0m'
fi

echo -e "${BLUE}=== PostgreSQL Migration: Host → Container ===${NC}"
echo ""

# ── Step 1: Dump existing database ──────────────────────────────────────────
echo -e "${YELLOW}Step 1: Dumping existing host PostgreSQL database...${NC}"
mkdir -p "${BACKUP_DIR}"

# Dump on remote first (so sudo TTY prompt is visible), then copy locally
ssh -t "${REMOTE_HOST}" \
    "sudo -u postgres pg_dump markdown_manager > /tmp/migration-dump.sql"

scp "${REMOTE_HOST}:/tmp/migration-dump.sql" "${DUMP_FILE}"
ssh "${REMOTE_HOST}" "rm -f /tmp/migration-dump.sql"

DUMP_SIZE=$(wc -c < "${DUMP_FILE}")
echo -e "${GREEN}  Dump complete: ${DUMP_FILE} (${DUMP_SIZE} bytes)${NC}"

if [[ "${DUMP_SIZE}" -lt 100 ]]; then
    echo -e "${RED}  ERROR: Dump file is suspiciously small. Aborting.${NC}"
    exit 1
fi

# ── Step 2: Start only the db container ─────────────────────────────────────
echo -e "${YELLOW}Step 2: Starting containerized PostgreSQL...${NC}"

# Source the POSTGRES_PASSWORD from production.env if not already set
if [[ -z "${POSTGRES_PASSWORD:-}" ]] && [[ -f "${PROJECT_DIR}/deployment/production.env" ]]; then
    POSTGRES_PASSWORD=$(grep -m1 '^POSTGRES_PASSWORD=' "${PROJECT_DIR}/deployment/production.env" | cut -d= -f2-)
    export POSTGRES_PASSWORD
fi

cd "${PROJECT_DIR}"
docker compose -f docker-compose.prod.yml up -d db

echo "  Waiting for container database to be ready..."
for i in $(seq 1 30); do
    if docker compose -f docker-compose.prod.yml exec -T db pg_isready -U markdown_manager \
        >/dev/null 2>&1; then
        echo -e "${GREEN}  Container database is ready.${NC}"
        break
    fi
    if [[ $i -eq 30 ]]; then
        echo -e "${RED}  ERROR: Container database did not become ready. Aborting.${NC}"
        exit 1
    fi
    sleep 2
done

# ── Step 3: Restore dump into container ─────────────────────────────────────
echo -e "${YELLOW}Step 3: Restoring dump into containerized database...${NC}"

docker compose -f docker-compose.prod.yml exec -T db \
    psql -U markdown_manager -d markdown_manager < "${DUMP_FILE}"

echo -e "${GREEN}  Restore complete.${NC}"

# ── Step 4: Verify data integrity ───────────────────────────────────────────
echo -e "${YELLOW}Step 4: Verifying data integrity...${NC}"

# Count tables and rows in container
CONTAINER_TABLES=$(docker compose -f docker-compose.prod.yml exec -T db \
    psql -U markdown_manager -d markdown_manager -t -c \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" \
    | tr -d '[:space:]')

echo -e "  Tables in container: ${CONTAINER_TABLES}"

CONTAINER_DOCS=$(docker compose -f docker-compose.prod.yml exec -T db \
    psql -U markdown_manager -d markdown_manager -t -c \
    "SELECT count(*) FROM documents;" 2>/dev/null \
    | tr -d '[:space:]' || echo "N/A")

echo -e "  Documents in container: ${CONTAINER_DOCS}"

# ── Step 5: Cleanup ────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}=== Migration Complete ===${NC}"
echo ""
echo -e "Next steps:"
echo -e "  1. Verify the application works: make deploy-status"
echo -e "  2. Once verified, stop host PostgreSQL: ssh ${REMOTE_HOST} 'sudo systemctl stop postgresql'"
echo -e "  3. Optionally disable it: ssh ${REMOTE_HOST} 'sudo systemctl disable postgresql'"
echo -e "  4. Keep the dump file as rollback: ${DUMP_FILE}"
