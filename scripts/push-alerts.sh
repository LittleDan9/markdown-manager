#!/usr/bin/env bash
# ==============================================================================
# push-alerts.sh — Push app alert rules to Grafana via HTTP API
# ==============================================================================
# Reads JSON alert rule definitions from deployment/alerts/ and idempotently
# creates or updates them in Grafana using the provisioning API.
#
# Auth: Uses GRAFANA_SERVICE_ACCOUNT_TOKEN from platform-manager's production.env
# (single source of truth — no duplication into app env files).
#
# Usage:
#   ./scripts/push-alerts.sh                    # Push all alerts
#   ./scripts/push-alerts.sh --dry-run          # Show what would be pushed
#
# Prerequisites:
#   - Platform infrastructure stack running (Grafana accessible on shared-services)
#   - /opt/platform-manager/deployment/production.env contains GRAFANA_SERVICE_ACCOUNT_TOKEN
# ==============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

source "$SCRIPT_DIR/colors.sh"

# ── Configuration ────────────────────────────────────────────────────────────

ALERTS_DIR="${PROJECT_DIR}/deployment/alerts"
PLATFORM_ENV="/opt/platform-manager/deployment/production.env"
GRAFANA_URL="http://grafana:3000"
FOLDER_UID="mm-alerts"
FOLDER_TITLE="Markdown Manager"
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)      DRY_RUN=true; shift ;;
    --grafana-url)  GRAFANA_URL="$2"; shift 2 ;;
    *) echo "${RED}Unknown option: $1${NC}"; exit 1 ;;
  esac
done

# ── Load token ───────────────────────────────────────────────────────────────

if [[ ! -f "$PLATFORM_ENV" ]]; then
  echo "${YELLOW}Platform env not found at ${PLATFORM_ENV} — skipping alert push.${NC}"
  exit 0
fi

GRAFANA_SERVICE_ACCOUNT_TOKEN=""
while IFS='=' read -r key value; do
  [[ "$key" == "GRAFANA_SERVICE_ACCOUNT_TOKEN" ]] && GRAFANA_SERVICE_ACCOUNT_TOKEN="$value"
done < <(grep -v '^#' "$PLATFORM_ENV" | grep -v '^\s*$')

if [[ -z "$GRAFANA_SERVICE_ACCOUNT_TOKEN" ]]; then
  echo "${YELLOW}GRAFANA_SERVICE_ACCOUNT_TOKEN not found in ${PLATFORM_ENV} — skipping alert push.${NC}"
  exit 0
fi

AUTH_HEADER="Authorization: Bearer ${GRAFANA_SERVICE_ACCOUNT_TOKEN}"

# ── Verify Grafana is reachable ──────────────────────────────────────────────

if ! curl -sf -H "$AUTH_HEADER" "${GRAFANA_URL}/api/health" >/dev/null 2>&1; then
  echo "${YELLOW}Grafana not reachable at ${GRAFANA_URL} — skipping alert push.${NC}"
  exit 0
fi

# ── Ensure alert folder exists ───────────────────────────────────────────────

FOLDER_RESPONSE=$(curl -sf -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  "${GRAFANA_URL}/api/folders/${FOLDER_UID}" 2>/dev/null || echo "")

if [[ -z "$FOLDER_RESPONSE" ]] || echo "$FOLDER_RESPONSE" | grep -q '"status":"not-found"'; then
  echo "${BLUE}Creating alert folder: ${FOLDER_TITLE}${NC}"
  if ! $DRY_RUN; then
    curl -sf -X POST -H "$AUTH_HEADER" -H "Content-Type: application/json" \
      -d "{\"uid\": \"${FOLDER_UID}\", \"title\": \"${FOLDER_TITLE}\"}" \
      "${GRAFANA_URL}/api/folders" >/dev/null
  fi
fi

# ── Push alert rules ─────────────────────────────────────────────────────────

if [[ ! -d "$ALERTS_DIR" ]]; then
  echo "${YELLOW}No alerts directory found at ${ALERTS_DIR}${NC}"
  exit 0
fi

ALERT_FILES=("$ALERTS_DIR"/*.json)
if [[ ! -f "${ALERT_FILES[0]}" ]]; then
  echo "${YELLOW}No alert JSON files found in ${ALERTS_DIR}${NC}"
  exit 0
fi

SUCCESS=0
FAILED=0

for alert_file in "${ALERT_FILES[@]}"; do
  filename=$(basename "$alert_file")
  uid=$(jq -r '.uid' "$alert_file")
  title=$(jq -r '.title' "$alert_file")

  if $DRY_RUN; then
    echo "${BLUE}[DRY RUN] Would push: ${title} (${uid})${NC}"
    continue
  fi

  # Check if rule exists
  existing=$(curl -sf -H "$AUTH_HEADER" \
    "${GRAFANA_URL}/api/v1/provisioning/alert-rules/${uid}" 2>/dev/null || echo "")

  if [[ -n "$existing" ]] && ! echo "$existing" | grep -q '"status"'; then
    # Update existing rule
    http_code=$(curl -sf -o /dev/null -w "%{http_code}" -X PUT \
      -H "$AUTH_HEADER" -H "Content-Type: application/json" \
      -H "X-Disable-Provenance: true" \
      -d @"$alert_file" \
      "${GRAFANA_URL}/api/v1/provisioning/alert-rules/${uid}")
  else
    # Create new rule
    http_code=$(curl -sf -o /dev/null -w "%{http_code}" -X POST \
      -H "$AUTH_HEADER" -H "Content-Type: application/json" \
      -H "X-Disable-Provenance: true" \
      -d @"$alert_file" \
      "${GRAFANA_URL}/api/v1/provisioning/alert-rules")
  fi

  if [[ "$http_code" =~ ^2 ]]; then
    echo "${GREEN}  ✓ ${title}${NC}"
    ((SUCCESS++))
  else
    echo "${RED}  ✗ ${title} (HTTP ${http_code})${NC}"
    ((FAILED++))
  fi
done

# ── Summary ──────────────────────────────────────────────────────────────────

if $DRY_RUN; then
  echo "${BLUE}Dry run complete — ${#ALERT_FILES[@]} rules would be pushed.${NC}"
else
  echo "${GREEN}Alert push complete: ${SUCCESS} succeeded, ${FAILED} failed.${NC}"
fi

if [[ $FAILED -gt 0 ]]; then
  exit 1
fi
