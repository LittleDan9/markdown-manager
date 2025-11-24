#!/usr/bin/env bash
# Modular Backend Deployment Script - Central Orchestrator

set -e

# Disable ANSI colors to prevent shell interpretation issues
export NO_COLOR=1

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$SCRIPT_DIR/deploy"

# Source common functions
source "$DEPLOY_DIR/deploy-common.sh"

# Parse command line arguments
BACKEND_DIR=${1:-$DEFAULT_BACKEND_DIR}
EXPORT_SERVICE_DIR=${2:-$DEFAULT_EXPORT_SERVICE_DIR}
LINT_SERVICE_DIR=${3:-$DEFAULT_LINT_SERVICE_DIR}
SPELL_CHECK_SERVICE_DIR=${4:-$DEFAULT_SPELL_CHECK_SERVICE_DIR}
CONSUMER_SERVICE_DIR=${5:-$DEFAULT_CONSUMER_SERVICE_DIR}
REMOTE_USER_HOST=${6:-$DEFAULT_REMOTE_USER_HOST}
REGISTRY_PORT=${7:-$DEFAULT_REGISTRY_PORT}
SERVICE_NAME=${8:-"all"}  # Optional: deploy specific service or phase
SSH_KEY="$DEFAULT_SSH_KEY"

# Print configuration
echo "════════════════════════════════════════════════════════════════════════════"
echo "Modular Backend Deployment Script"
echo "════════════════════════════════════════════════════════════════════════════"
print_config_summary "$BACKEND_DIR" "$EXPORT_SERVICE_DIR" "$LINT_SERVICE_DIR" "$SPELL_CHECK_SERVICE_DIR" "$CONSUMER_SERVICE_DIR" "$REMOTE_USER_HOST" "$REGISTRY_PORT"
echo -e "${BLUE}📋 SSH Key: $SSH_KEY${NC}"
echo -e "${BLUE}📋 Target: $SERVICE_NAME${NC}"
echo "════════════════════════════════════════════════════════════════════════════"
echo

# Validate directories
validate_directory "$BACKEND_DIR" "Backend"
validate_directory "$EXPORT_SERVICE_DIR" "Export service"
validate_directory "$LINT_SERVICE_DIR" "Lint service"
validate_directory "$SPELL_CHECK_SERVICE_DIR" "Spell check service"
validate_directory "$CONSUMER_SERVICE_DIR" "Consumer service"
validate_file "$SSH_KEY" "SSH key"

# Main deployment function
deploy_all_services() {
    log_step "🏗️" "Starting full backend deployment..."

    # Phase 1: Infrastructure setup
    log_info "🔧" "Phase 1: Infrastructure Setup"
    "$DEPLOY_DIR/deploy-infra.sh" "$REMOTE_USER_HOST" "$REGISTRY_PORT" "$SSH_KEY"

    # Phase 2: Build and registry push
    log_info "🚀" "Phase 2: Build and Registry Push"
    echo "Starting Docker image builds (this may take several minutes)..."
    # Run build script and capture its output
    build_output=$("$DEPLOY_DIR/deploy-build.sh" "$BACKEND_DIR" "$EXPORT_SERVICE_DIR" "$LINT_SERVICE_DIR" "$SPELL_CHECK_SERVICE_DIR" "$CONSUMER_SERVICE_DIR" "$REGISTRY_PORT" "$REMOTE_USER_HOST" "$SSH_KEY" "$service" 2>&1)
    # Strip ANSI codes from the entire output before processing
    clean_output=$(printf '%s\n' "$build_output" | sed 's/\x1b\[[0-9;]*[A-Za-z]//g')
    # Display the cleaned build output
    echo "$clean_output"
    # Extract skip statuses from the last line
    skip_statuses=$(echo "$clean_output" | tail -1)
    echo "Docker builds completed."    # Phase 3: Remote deployment
    log_info "🌐" "Phase 3: Remote Deployment"
    # Run remote deployment directly (don't capture output to avoid ANSI issues)
    if "$DEPLOY_DIR/deploy-remote.sh" "$BACKEND_DIR" "$EXPORT_SERVICE_DIR" "$LINT_SERVICE_DIR" "$SPELL_CHECK_SERVICE_DIR" "$CONSUMER_SERVICE_DIR" "$REGISTRY_PORT" "$REMOTE_USER_HOST" "$SSH_KEY" "$skip_statuses" "all"; then
        log_success "Remote deployment completed"
    else
        log_error "Remote deployment failed"
        exit 1
    fi

    # Phase 4: Cleanup infrastructure
    log_info "🧹" "Phase 4: Infrastructure Cleanup"
    cleanup_ssh_tunnel "$REGISTRY_PORT"

    # Phase 5: Deploy nginx configurations
    log_info "🌐" "Phase 5: Nginx Configuration"
    "$SCRIPT_DIR/deploy-nginx.sh" deploy_all "$REMOTE_USER_HOST"

    # Phase 6: Image cleanup
    log_info "🗑️" "Phase 6: Image Cleanup"
    "$DEPLOY_DIR/deploy-cleanup.sh" "all" "$REGISTRY_PORT" "$REMOTE_USER_HOST" "$SSH_KEY"

    echo "SUCCESS: Full backend deployment completed!"
}

# Deploy specific service
deploy_single_service() {
    local service=$1

    log_step "🎯" "Starting deployment for $service service..."

    # Phase 1: Infrastructure setup
    log_info "🔧" "Phase 1: Infrastructure Setup"
    "$DEPLOY_DIR/deploy-infra.sh" "$REMOTE_USER_HOST" "$REGISTRY_PORT" "$SSH_KEY"

    # Phase 2: Build and registry push for specific service
    log_info "🚀" "Phase 2: Build and Registry Push ($service)"
    echo "Starting Docker image build for $service (this may take a few minutes)..."
    # Run build script and capture its output
    build_output=$("$DEPLOY_DIR/deploy-build.sh" "$BACKEND_DIR" "$EXPORT_SERVICE_DIR" "$LINT_SERVICE_DIR" "$SPELL_CHECK_SERVICE_DIR" "$CONSUMER_SERVICE_DIR" "$REGISTRY_PORT" "$REMOTE_USER_HOST" "$SSH_KEY" "$service" 2>&1)
    # Strip ANSI codes from the entire output before processing
    clean_output=$(echo "$build_output" | sed 's/\x1b\[[0-9;]*m//g')
    # Display the cleaned build output
    echo "$clean_output"
    # Extract skip status from the last line
    skip_status=$(echo "$clean_output" | tail -1)

    # Phase 3: Remote deployment for specific service
    log_info "🌐" "Phase 3: Remote Deployment ($service)"
    # Convert single skip status to format expected by deploy-remote.sh
    case "$service" in
        "export") skip_statuses="$skip_status true true true true true" ;;
        "linting") skip_statuses="true $skip_status true true true true" ;;
        "spell-check") skip_statuses="true true $skip_status true true true" ;;
        "event-consumer") skip_statuses="true true true $skip_status true true" ;;
        "event-publisher") skip_statuses="true true true true $skip_status true" ;;
        "backend") skip_statuses="true true true true true $skip_status" ;;
    esac
    "$DEPLOY_DIR/deploy-remote.sh" "$BACKEND_DIR" "$EXPORT_SERVICE_DIR" "$LINT_SERVICE_DIR" "$SPELL_CHECK_SERVICE_DIR" "$CONSUMER_SERVICE_DIR" "$REGISTRY_PORT" "$REMOTE_USER_HOST" "$SSH_KEY" "$skip_statuses" "$service"

    # Phase 4: Cleanup infrastructure
    log_info "🧹" "Phase 4: Infrastructure Cleanup"
    cleanup_ssh_tunnel "$REGISTRY_PORT"

    log_success "$service service deployment completed successfully!"
}

# Deploy specific phase
deploy_phase() {
    local phase=$1

    case "$phase" in
        "infra"|"infrastructure")
            log_step "🔧" "Deploying infrastructure phase..."
            "$DEPLOY_DIR/deploy-infra.sh" "$REMOTE_USER_HOST" "$REGISTRY_PORT" "$SSH_KEY"
            ;;
        "build")
            log_step "🚀" "Deploying build phase..."
            if ! is_tunnel_active "$REGISTRY_PORT"; then
                log_error "SSH tunnel not active. Run 'infra' phase first."
                exit 1
            fi
            echo "Starting Docker image builds (this may take several minutes)..."
            build_output=$("$DEPLOY_DIR/deploy-build.sh" "$BACKEND_DIR" "$EXPORT_SERVICE_DIR" "$LINT_SERVICE_DIR" "$SPELL_CHECK_SERVICE_DIR" "$CONSUMER_SERVICE_DIR" "$REGISTRY_PORT" "$REMOTE_USER_HOST" "$SSH_KEY" 2>&1)
            echo "$build_output"
            ;;
        "remote")
            log_step "🌐" "Deploying remote phase..."
            "$DEPLOY_DIR/deploy-remote.sh" "$BACKEND_DIR" "$EXPORT_SERVICE_DIR" "$LINT_SERVICE_DIR" "$SPELL_CHECK_SERVICE_DIR" "$CONSUMER_SERVICE_DIR" "$REGISTRY_PORT" "$REMOTE_USER_HOST" "$SSH_KEY" "false false false false false"
            ;;
        "cleanup")
            log_step "🧹" "Deploying cleanup phase..."
            "$DEPLOY_DIR/deploy-cleanup.sh" "all" "$REGISTRY_PORT" "$REMOTE_USER_HOST" "$SSH_KEY"
            ;;
        *)
            log_error "Unknown phase: $phase"
            echo "Valid phases: infra, build, remote, cleanup"
            exit 1
            ;;
    esac

    log_success "Phase '$phase' completed successfully!"
}

# Main execution logic
case "$SERVICE_NAME" in
    "all")
        deploy_all_services
        ;;
    "backend"|"export"|"linting"|"spell-check"|"event-consumer"|"event-publisher")
        deploy_single_service "$SERVICE_NAME"
        ;;
    "infra"|"infrastructure"|"build"|"remote"|"cleanup")
        deploy_phase "$SERVICE_NAME"
        ;;
    *)
        log_error "Unknown service/phase: $SERVICE_NAME"
        echo
        echo "Valid options:"
        echo "  Services: all, backend, export, linting, spell-check, event-consumer, event-publisher"
        echo "  Phases:   infra, build, remote, cleanup"
        echo
        echo "Examples:"
        echo "  $0                                       # Deploy all services"
        echo "  $0 . . . . . . . spell-check            # Deploy only spell-check service"
        echo "  $0 . . . . . . . event-consumer         # Deploy only event-consumer service"
        echo "  $0 . . . . . . . build                  # Run only build phase"
        echo "  $0 ./services/backend ./services/export . ./services/spell-check . infra # Setup infrastructure only"
        exit 1
        ;;
esac
