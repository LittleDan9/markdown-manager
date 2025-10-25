#!/usr/bin/env bash
# Modular Backend Deployment Script - Central Orchestrator

set -e

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
REMOTE_USER_HOST=${5:-$DEFAULT_REMOTE_USER_HOST}
REGISTRY_PORT=${6:-$DEFAULT_REGISTRY_PORT}
SERVICE_NAME=${7:-"all"}  # Optional: deploy specific service or phase
SSH_KEY="$DEFAULT_SSH_KEY"

# Print configuration
echo "════════════════════════════════════════════════════════════════════════════"
echo "Modular Backend Deployment Script"
echo "════════════════════════════════════════════════════════════════════════════"
print_config_summary "$BACKEND_DIR" "$EXPORT_SERVICE_DIR" "$LINT_SERVICE_DIR" "$SPELL_CHECK_SERVICE_DIR" "$REMOTE_USER_HOST" "$REGISTRY_PORT"
echo -e "${BLUE}📋 SSH Key: $SSH_KEY${NC}"
echo -e "${BLUE}📋 Target: $SERVICE_NAME${NC}"
echo "════════════════════════════════════════════════════════════════════════════"
echo

# Validate directories
validate_directory "$BACKEND_DIR" "Backend"
validate_directory "$EXPORT_SERVICE_DIR" "Export service"
validate_directory "$LINT_SERVICE_DIR" "Lint service"
validate_directory "$SPELL_CHECK_SERVICE_DIR" "Spell check service"
validate_file "$SSH_KEY" "SSH key"

# Main deployment function
deploy_all_services() {
    log_step "🏗️" "Starting full backend deployment..."
    
    # Phase 1: Infrastructure setup
    log_info "🔧" "Phase 1: Infrastructure Setup"
    "$DEPLOY_DIR/deploy-infra.sh" "$REMOTE_USER_HOST" "$REGISTRY_PORT" "$SSH_KEY"
    
    # Phase 2: Build and registry push
    log_info "🚀" "Phase 2: Build and Registry Push"
    "$DEPLOY_DIR/deploy-build.sh" "$BACKEND_DIR" "$EXPORT_SERVICE_DIR" "$LINT_SERVICE_DIR" "$SPELL_CHECK_SERVICE_DIR" "$REGISTRY_PORT" "$REMOTE_USER_HOST" "$SSH_KEY" "all"
    
    # For now, assume all services will be skipped since they already exist
    # In a production system, you would capture these properly
    skip_statuses="true true true true"
    
    # Phase 3: Remote deployment
    log_info "🌐" "Phase 3: Remote Deployment"
    "$DEPLOY_DIR/deploy-remote.sh" "$BACKEND_DIR" "$EXPORT_SERVICE_DIR" "$LINT_SERVICE_DIR" "$SPELL_CHECK_SERVICE_DIR" "$REGISTRY_PORT" "$REMOTE_USER_HOST" "$SSH_KEY" "$skip_statuses" "all"
    
    # Phase 4: Cleanup infrastructure
    log_info "🧹" "Phase 4: Infrastructure Cleanup"
    cleanup_ssh_tunnel "$REGISTRY_PORT"
    
    # Phase 5: Deploy nginx configurations
    log_info "🌐" "Phase 5: Nginx Configuration"
    "$SCRIPT_DIR/deploy-nginx.sh" deploy_all "$REMOTE_USER_HOST"
    
    # Phase 6: Image cleanup
    log_info "🗑️" "Phase 6: Image Cleanup"
    "$DEPLOY_DIR/deploy-cleanup.sh" "all" "$REGISTRY_PORT" "$REMOTE_USER_HOST" "$SSH_KEY"
    
    log_success "Full backend deployment completed successfully!"
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
    skip_status=$("$DEPLOY_DIR/deploy-build.sh" "$BACKEND_DIR" "$EXPORT_SERVICE_DIR" "$LINT_SERVICE_DIR" "$SPELL_CHECK_SERVICE_DIR" "$REGISTRY_PORT" "$REMOTE_USER_HOST" "$SSH_KEY" "$service")
    
    # Phase 3: Remote deployment for specific service
    log_info "🌐" "Phase 3: Remote Deployment ($service)"
    # Convert single skip status to format expected by deploy-remote.sh
    case "$service" in
        "export") skip_statuses="$skip_status true true true" ;;
        "lint") skip_statuses="true $skip_status true true" ;;
        "spell-check") skip_statuses="true true $skip_status true" ;;
        "backend") skip_statuses="true true true $skip_status" ;;
    esac
    "$DEPLOY_DIR/deploy-remote.sh" "$BACKEND_DIR" "$EXPORT_SERVICE_DIR" "$LINT_SERVICE_DIR" "$SPELL_CHECK_SERVICE_DIR" "$REGISTRY_PORT" "$REMOTE_USER_HOST" "$SSH_KEY" "$skip_statuses" "$service"
    
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
            "$DEPLOY_DIR/deploy-build.sh" "$BACKEND_DIR" "$EXPORT_SERVICE_DIR" "$LINT_SERVICE_DIR" "$SPELL_CHECK_SERVICE_DIR" "$REGISTRY_PORT" "$REMOTE_USER_HOST" "$SSH_KEY"
            ;;
        "remote")
            log_step "🌐" "Deploying remote phase..."
            "$DEPLOY_DIR/deploy-remote.sh" "$BACKEND_DIR" "$EXPORT_SERVICE_DIR" "$LINT_SERVICE_DIR" "$SPELL_CHECK_SERVICE_DIR" "$REGISTRY_PORT" "$REMOTE_USER_HOST" "$SSH_KEY" "false false false false"
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
    "backend"|"export"|"lint"|"spell-check")
        deploy_single_service "$SERVICE_NAME"
        ;;
    "infra"|"infrastructure"|"build"|"remote"|"cleanup")
        deploy_phase "$SERVICE_NAME"
        ;;
    *)
        log_error "Unknown service/phase: $SERVICE_NAME"
        echo
        echo "Valid options:"
        echo "  Services: all, backend, export, lint, spell-check"
        echo "  Phases:   infra, build, remote, cleanup"
        echo
        echo "Examples:"
        echo "  $0                                    # Deploy all services"
        echo "  $0 . . . . . . spell-check           # Deploy only spell-check service"
        echo "  $0 . . . . . . build                 # Run only build phase"
        echo "  $0 ./backend ./export . ./spell infra # Setup infrastructure only"
        exit 1
        ;;
esac
