#!/usr/bin/env bash
# ==============================================================================
# deploy-infra.sh — Start/update the infrastructure stack
# ==============================================================================
# Infrastructure services (db, redis, ollama, clamav, traefik) run under the
# fixed project name "mm-infra" and persist across blue/green app deployments.
#
# Usage:
#   ./scripts/deploy-infra.sh                    # Start/update infra
#   ./scripts/deploy-infra.sh --env-file PATH    # Custom env file
# ==============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

source "$SCRIPT_DIR/colors.sh"

ENV_FILE="${PROJECT_DIR}/deployment/production.env"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --env-file) ENV_FILE="$2"; shift 2 ;;
    *) echo "${RED}Unknown option: $1${NC}"; exit 1 ;;
  esac
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "${RED}Environment file not found: ${ENV_FILE}${NC}"
  exit 1
fi

echo "${BLUE}Starting infrastructure stack (mm-infra)...${NC}"

cd "$PROJECT_DIR"

# Create the shared network if it doesn't exist
docker network inspect mm-network >/dev/null 2>&1 || \
  docker network create --driver bridge mm-network

# Create the shared document-storage volume if it doesn't exist
for vol in mm-document-storage mm-postgres-data mm-redis-data mm-ollama-data mm-clamav-data; do
  docker volume inspect "$vol" >/dev/null 2>&1 || docker volume create "$vol"
done

# Stop services that bind host ports before recreating — avoids port conflicts
# when compose config changes force container recreation.
docker compose \
  -p mm-infra \
  -f docker-compose.infra.yml \
  --env-file "$ENV_FILE" \
  rm -sf traefik 2>/dev/null || true

# Kill any other container holding our ports (e.g. leftover from old project name)
for port in 8080 8888; do
  cid=$(docker ps -q --filter "publish=$port" 2>/dev/null | head -1)
  if [[ -n "$cid" ]]; then
    echo "${YELLOW}Stopping stale container $cid occupying port $port...${NC}"
    docker rm -f "$cid" 2>/dev/null || true
  fi
done

docker compose \
  -p mm-infra \
  -f docker-compose.infra.yml \
  --env-file "$ENV_FILE" \
  up -d

echo "${GREEN}Infrastructure stack is running.${NC}"

# Show status
docker compose -p mm-infra -f docker-compose.infra.yml --env-file "$ENV_FILE" ps
