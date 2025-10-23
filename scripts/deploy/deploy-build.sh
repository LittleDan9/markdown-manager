#!/usr/bin/env bash
# Build and registry deployment - Docker build and push operations

set -e

# Source common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/deploy-common.sh"

# Build and deploy a single service
deploy_service() {
    local service_name=$1
    local registry_port=$2
    local remote_host=$3
    local ssh_key=$4
    
    local service_dir=$(get_service_dir "$service_name")
    local local_image=$(get_service_image "$service_name")
    local registry_image=$(get_registry_image "$local_image" "$registry_port")
    local dockerfile_name=${5:-Dockerfile}
    
    # Validate service directory exists
    validate_directory "$service_dir" "$service_name service" >&2
    
    log_step "🚀" "Building $service_name image → $local_image" >&2
    # Force rebuild without cache to ensure changes are detected
    docker build --no-cache -t $local_image -f $service_dir/$dockerfile_name $service_dir >&2
    
    # Get local image ID
    local local_image_id=$(get_image_id "$local_image")
    echo "Built $service_name image ID: $local_image_id" >&2
    
    # Check if we should skip push
    local skip_push=false
    if image_exists_in_registry "$service_name" "$registry_port" "$remote_host" "$ssh_key"; then
        log_step "📦" "$service_name image exists in registry, checking if it's the same..." >&2
        
        if compare_image_ids "$local_image" "$registry_image" "$remote_host" "$ssh_key"; then
            log_success "Remote registry already has the same $service_name image, skipping push" >&2
            skip_push=true
        else
            log_step "📦" "$service_name image differs, will push new layers..." >&2
        fi
    else
        log_step "📦" "No existing $service_name image in registry, will push all layers..." >&2
    fi
    
    if [[ "$skip_push" != "true" ]]; then
        # Tag image for registry
        docker tag $local_image $registry_image
        
        log_step "📤" "Pushing $service_name to registry (layers will be deduplicated)..." >&2
        docker push $registry_image >&2
        
        log_success "$service_name image pushed successfully" >&2
    fi
    
    # Return skip status for use in deployment
    echo $skip_push
}

# Build and deploy all services
deploy_all_services() {
    local backend_dir=$1
    local export_dir=$2
    local lint_dir=$3
    local spell_check_dir=$4
    local registry_port=$5
    local remote_host=$6
    local ssh_key=$7
    
    # Update service directories in configuration
    SERVICE_CONFIG["backend"]="$backend_dir:$(get_service_image "backend"):$(get_service_port "backend")"
    SERVICE_CONFIG["export"]="$export_dir:$(get_service_image "export"):$(get_service_port "export")"
    SERVICE_CONFIG["lint"]="$lint_dir:$(get_service_image "lint"):$(get_service_port "lint")"
    SERVICE_CONFIG["spell-check"]="$spell_check_dir:$(get_service_image "spell-check"):$(get_service_port "spell-check")"
    
    # Deploy services in dependency order
    log_info "🔧" "Deploying export service..." >&2
    local export_skip=$(deploy_service "export" "$registry_port" "$remote_host" "$ssh_key")
    
    log_info "🧪" "Deploying markdown linting service..." >&2
    local lint_skip=$(deploy_service "lint" "$registry_port" "$remote_host" "$ssh_key")
    
    log_info "✏️" "Deploying spell check service..." >&2
    local spell_check_skip=$(deploy_service "spell-check" "$registry_port" "$remote_host" "$ssh_key")
    
    log_info "🔧" "Deploying backend service..." >&2
    local backend_skip=$(deploy_service "backend" "$registry_port" "$remote_host" "$ssh_key")
    
    # Return skip statuses for downstream use
    echo "$export_skip $lint_skip $spell_check_skip $backend_skip"
}

# Clean up registry tags
cleanup_registry_tags() {
    local registry_port=$1
    
    log_step "🧹" "Cleaning up local registry tags..."
    
    for service in "backend" "export" "lint" "spell-check"; do
        local local_image=$(get_service_image "$service")
        local registry_image=$(get_registry_image "$local_image" "$registry_port")
        docker rmi "$registry_image" 2>/dev/null || true
    done
}

# Main execution when script is called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Parse command line arguments
    BACKEND_DIR=${1:-$DEFAULT_BACKEND_DIR}
    EXPORT_DIR=${2:-$DEFAULT_EXPORT_SERVICE_DIR}
    LINT_DIR=${3:-$DEFAULT_LINT_SERVICE_DIR}
    SPELL_CHECK_DIR=${4:-$DEFAULT_SPELL_CHECK_SERVICE_DIR}
    REGISTRY_PORT=${5:-$DEFAULT_REGISTRY_PORT}
    REMOTE_HOST=${6:-$DEFAULT_REMOTE_USER_HOST}
    SSH_KEY=${7:-$DEFAULT_SSH_KEY}
    SERVICE_NAME=${8:-"all"}  # Optional: deploy specific service
    
    echo "Build and Registry Deployment Script" >&2
    echo "====================================" >&2
    print_config_summary "$BACKEND_DIR" "$EXPORT_DIR" "$LINT_DIR" "$SPELL_CHECK_DIR" "$REMOTE_HOST" "$REGISTRY_PORT" >&2
    echo >&2
    
    # Check if SSH tunnel is active
    if ! is_tunnel_active "$REGISTRY_PORT"; then
        log_error "SSH tunnel not active on port $REGISTRY_PORT" >&2
        echo -e "${YELLOW}💡 Run deploy-infra.sh first to setup SSH tunnel${NC}" >&2
        exit 1
    fi
    
    # Deploy specific service or all services
    if [[ "$SERVICE_NAME" == "all" ]]; then
        log_step "🚀" "Building and deploying all services..." >&2
        skip_statuses=$(deploy_all_services "$BACKEND_DIR" "$EXPORT_DIR" "$LINT_DIR" "$SPELL_CHECK_DIR" "$REGISTRY_PORT" "$REMOTE_HOST" "$SSH_KEY" 2>&1)
        log_success "All services built and deployed" >&2
        echo "$skip_statuses"
    else
        log_step "🚀" "Building and deploying $SERVICE_NAME service..." >&2
        skip_status=$(deploy_service "$SERVICE_NAME" "$REGISTRY_PORT" "$REMOTE_HOST" "$SSH_KEY" 2>&1)
        log_success "$SERVICE_NAME service built and deployed" >&2
        echo "$skip_status"
    fi
    
    # Cleanup registry tags
    cleanup_registry_tags "$REGISTRY_PORT" >&2
    
    log_success "Build deployment completed successfully" >&2
fi