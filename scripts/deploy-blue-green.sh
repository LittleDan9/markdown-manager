#!/usr/bin/env bash
# ==============================================================================
# deploy-blue-green.sh — Zero-downtime blue/green deployment
# ==============================================================================
# Deploys the application stack (backend, nginx, export, linting, etc.) as an
# alternating blue/green Compose project. Traefik automatically routes traffic
# to the healthy stack and drains the old one.
#
# Usage:
#   ./scripts/deploy-blue-green.sh                      # Normal deploy
#   ./scripts/deploy-blue-green.sh --force-rebuild       # Force full rebuild
#   ./scripts/deploy-blue-green.sh --skip-build          # Skip image build
#   ./scripts/deploy-blue-green.sh --rollback            # Revert to previous slot
#
# Prerequisites:
#   - Shared infrastructure stack running (platform via platform-manager)
#   - deployment/production.env exists
# ==============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

source "$SCRIPT_DIR/colors.sh"

# ── Configuration ────────────────────────────────────────────────────────────

APP_DIR="${APP_DIR:-$PROJECT_DIR}"
ENV_FILE="${APP_DIR}/deployment/production.env"
COMPOSE_FILE="${APP_DIR}/docker-compose.app.yml"
SLOT_FILE="${APP_DIR}/.deploy-slot"
STOP_TIMEOUT=30          # Grace period for in-flight requests (seconds)
HEALTH_RETRIES=30        # Max health check attempts
HEALTH_DELAY=5           # Seconds between health checks
BACKEND_HEALTH_RETRIES=60  # 300s budget for embedding ONNX init
BACKEND_HEALTH_DELAY=5

# ── Flags ────────────────────────────────────────────────────────────────────

FORCE_REBUILD=false
SKIP_BUILD=false
ROLLBACK=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --force-rebuild) FORCE_REBUILD=true; shift ;;
    --skip-build)    SKIP_BUILD=true; shift ;;
    --rollback)      ROLLBACK=true; shift ;;
    --env-file)      ENV_FILE="$2"; shift 2 ;;
    *) echo "${RED}Unknown option: $1${NC}"; exit 1 ;;
  esac
done

# ── Validation ───────────────────────────────────────────────────────────────

if [[ ! -f "$ENV_FILE" ]]; then
  echo "${RED}Environment file not found: ${ENV_FILE}${NC}"
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "${RED}Compose file not found: ${COMPOSE_FILE}${NC}"
  exit 1
fi

# Verify shared infrastructure stack is running
if ! docker compose -p platform ps --status running 2>/dev/null | grep -q "traefik"; then
  echo "${RED}Shared infrastructure stack (platform) is not running.${NC}"
  echo "${YELLOW}Deploy platform-manager first: cd /opt/platform-manager && ./scripts/deploy-infra.sh${NC}"
  exit 1
fi

# ── Determine slots ─────────────────────────────────────────────────────────

CURRENT_SLOT="none"
if [[ -f "$SLOT_FILE" ]]; then
  CURRENT_SLOT=$(cat "$SLOT_FILE")
fi

if $ROLLBACK; then
  # Rollback: swap from current to previous
  case "$CURRENT_SLOT" in
    blue)  NEW_SLOT="green"; OLD_SLOT="blue" ;;
    green) NEW_SLOT="blue";  OLD_SLOT="green" ;;
    *)     echo "${RED}No active deployment to rollback from.${NC}"; exit 1 ;;
  esac
  echo "${YELLOW}Rolling back: ${OLD_SLOT} → ${NEW_SLOT}${NC}"
else
  # Normal deploy: advance to the other slot
  case "$CURRENT_SLOT" in
    blue)  NEW_SLOT="green"; OLD_SLOT="blue" ;;
    green) NEW_SLOT="blue";  OLD_SLOT="green" ;;
    none)  NEW_SLOT="blue";  OLD_SLOT="none" ;;
    *)     NEW_SLOT="blue";  OLD_SLOT="none" ;;
  esac
  echo "${BLUE}Deploying: ${NEW_SLOT} (current: ${CURRENT_SLOT:-none})${NC}"
fi

NEW_PROJECT="mm-${NEW_SLOT}"
OLD_PROJECT="mm-${OLD_SLOT}"

# ── Helper functions ─────────────────────────────────────────────────────────

compose_cmd() {
  docker compose -p "$1" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "${@:2}"
}

wait_for_backend_health() {
  local project="$1"
  echo "${YELLOW}Waiting for ${project} backend to become healthy...${NC}"
  for i in $(seq 1 $BACKEND_HEALTH_RETRIES); do
    if compose_cmd "$project" exec -T backend curl -sf http://localhost:8000/health >/dev/null 2>&1; then
      echo "${GREEN}${project} backend is healthy (attempt ${i}/${BACKEND_HEALTH_RETRIES}).${NC}"
      return 0
    fi
    sleep "$BACKEND_HEALTH_DELAY"
  done
  echo "${RED}${project} backend did not become healthy after ${BACKEND_HEALTH_RETRIES} attempts.${NC}"
  return 1
}

wait_for_traefik_routing() {
  echo "${YELLOW}Waiting for Traefik to route to new stack...${NC}"
  for i in $(seq 1 $HEALTH_RETRIES); do
    if curl -sf -H "Host: littledan.com" http://localhost:8080/ -o /dev/null 2>&1; then
      echo "${GREEN}Traefik is routing traffic successfully (attempt ${i}/${HEALTH_RETRIES}).${NC}"
      return 0
    fi
    sleep "$HEALTH_DELAY"
  done
  echo "${RED}Traefik routing check failed after ${HEALTH_RETRIES} attempts.${NC}"
  return 1
}

cleanup_slot() {
  local project="$1"
  local slot="$2"

  if [[ "$slot" == "none" ]]; then
    return 0
  fi

  echo "${YELLOW}Stopping old stack: ${project}...${NC}"
  compose_cmd "$project" down --timeout "$STOP_TIMEOUT" --remove-orphans 2>/dev/null || true

  # Clean up the project-scoped UI volume
  local ui_vol="${project}_ui-static"
  if docker volume inspect "$ui_vol" >/dev/null 2>&1; then
    docker volume rm "$ui_vol" 2>/dev/null || true
    echo "${GREEN}Removed old UI volume: ${ui_vol}${NC}"
  fi
}

# ── Build ────────────────────────────────────────────────────────────────────

cd "$APP_DIR"

if $ROLLBACK; then
  echo "${YELLOW}Rollback mode — skipping build, starting previous slot images.${NC}"
elif $SKIP_BUILD; then
  echo "${YELLOW}Skipping image build (--skip-build).${NC}"
else
  echo "${BLUE}Building shared images (mm-build)...${NC}"
  BUILD_ARGS="--parallel"
  if $FORCE_REBUILD; then
    BUILD_ARGS="$BUILD_ARGS --no-cache"
  fi
  # Build once under a neutral project name — the fixed image: tags
  # (mm-app/*:latest) are shared between blue and green slots.
  DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1 \
    docker compose -p mm-build -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
    build $BUILD_ARGS
  echo "${GREEN}Build complete.${NC}"
fi

# ── Ensure document storage volume exists ────────────────────────────────────

docker volume inspect shared-document-storage >/dev/null 2>&1 || docker volume create shared-document-storage

# ── Clean UI volume for new stack ────────────────────────────────────────────

NEW_UI_VOL="${NEW_PROJECT}_ui-static"
if docker volume inspect "$NEW_UI_VOL" >/dev/null 2>&1; then
  echo "${YELLOW}Cleaning existing UI volume: ${NEW_UI_VOL}${NC}"
  docker run --rm -v "${NEW_UI_VOL}:/output" alpine sh -c "rm -rf /output/*"
fi

# ── Start new stack ──────────────────────────────────────────────────────────

echo "${BLUE}Starting ${NEW_SLOT} stack...${NC}"
compose_cmd "$NEW_PROJECT" up -d --remove-orphans --force-recreate

# ── Wait for health ──────────────────────────────────────────────────────────

if ! wait_for_backend_health "$NEW_PROJECT"; then
  echo "${RED}New stack failed health check. Cleaning up and aborting.${NC}"
  compose_cmd "$NEW_PROJECT" logs --tail=50
  compose_cmd "$NEW_PROJECT" down --timeout 10 --remove-orphans 2>/dev/null || true
  exit 1
fi

# If this is the first deployment (no old slot), just wait for Traefik
if [[ "$OLD_SLOT" == "none" ]]; then
  wait_for_traefik_routing
  echo "$NEW_SLOT" > "$SLOT_FILE"
  echo "${GREEN}Initial deployment complete. Active slot: ${NEW_SLOT}${NC}"
  compose_cmd "$NEW_PROJECT" ps
  docker system prune -f >/dev/null 2>&1 || true
  docker image prune -f >/dev/null 2>&1 || true
  exit 0
fi

# ── Verify Traefik sees the new stack ────────────────────────────────────────

wait_for_traefik_routing

# ── Stop old stack ───────────────────────────────────────────────────────────

cleanup_slot "$OLD_PROJECT" "$OLD_SLOT"

# ── Record active slot ───────────────────────────────────────────────────────

echo "$NEW_SLOT" > "$SLOT_FILE"

# ── Cleanup ──────────────────────────────────────────────────────────────────

echo "${YELLOW}Cleaning up old Docker artifacts...${NC}"
docker system prune -f >/dev/null 2>&1 || true
docker image prune -f >/dev/null 2>&1 || true

# ── Summary ──────────────────────────────────────────────────────────────────

echo ""
echo "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo "${GREEN}  Deployment complete — Active slot: ${NEW_SLOT}${NC}"
echo "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""
compose_cmd "$NEW_PROJECT" ps
