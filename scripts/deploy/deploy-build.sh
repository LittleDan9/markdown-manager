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
    
    log_step "🚀" "Building $service_name image → $local_image"
    echo "📦 Using Docker layer caching for faster builds..."
    echo "💡 Changes will automatically invalidate relevant cache layers"
    echo "🔨 Building Docker image (this may take a few minutes)..."
    echo "   Output will be displayed below:"
    echo
    
    # Use Docker cache for faster builds, changes will still invalidate relevant layers
    if docker build -t $local_image -f $service_dir/$dockerfile_name $service_dir; then
        echo
        echo "✅ $service_name image built successfully"
    else
        echo
        echo "❌ Failed to build $service_name image"
        exit 1
    fi
    
    # Get local image ID
    local local_image_id=$(get_image_id "$local_image")
    echo "🏷️  Built $service_name image ID: $local_image_id"
    
    # Check if we should skip push
    local skip_push=false
    if image_exists_in_registry "$service_name" "$registry_port" "$remote_host" "$ssh_key"; then
        echo "� Checking if $service_name image exists in registry..."
        
        if compare_image_ids "$local_image" "$registry_image" "$remote_host" "$ssh_key"; then
            echo "✅ Remote registry already has the same $service_name image, skipping push"
            skip_push=true
        else
            echo "📦 $service_name image differs, will push updated layers..."
        fi
    else
        echo "📦 No existing $service_name image in registry, will push all layers..."
    fi
    
    if [[ "$skip_push" != "true" ]]; then
        # Tag image for registry
        echo "🏷️  Tagging image for registry..."
        docker tag $local_image $registry_image
        
        echo "📤 Pushing $service_name to registry..."
        echo "⏳ This may take a while depending on image size and network..."
        if docker push $registry_image; then
            echo "✅ $service_name image pushed successfully"
        else
            echo "❌ Failed to push $service_name image"
            exit 1
        fi
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
    echo "🔧 Building export service..."
    local export_skip=$(deploy_service "export" "$registry_port" "$remote_host" "$ssh_key")
    
    echo "🧪 Building markdown linting service..."
    local lint_skip=$(deploy_service "lint" "$registry_port" "$remote_host" "$ssh_key")
    
    echo "✏️ Building spell check service..."
    local spell_check_skip=$(deploy_service "spell-check" "$registry_port" "$remote_host" "$ssh_key")
    
    echo "🔧 Building backend service..."
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
    
    echo "Build and Registry Deployment Script"
    echo "===================================="
    print_config_summary "$BACKEND_DIR" "$EXPORT_DIR" "$LINT_DIR" "$SPELL_CHECK_DIR" "$REMOTE_HOST" "$REGISTRY_PORT"
    echo
    
    # Check if SSH tunnel is active
    if ! is_tunnel_active "$REGISTRY_PORT"; then
        log_error "SSH tunnel not active on port $REGISTRY_PORT"
        echo -e "${YELLOW}💡 Run deploy-infra.sh first to setup SSH tunnel${NC}"
        exit 1
    fi
    
    # Deploy specific service or all services
    if [[ "$SERVICE_NAME" == "all" ]]; then
        echo "🚀 Building and deploying all services..."
        echo "This process will:"
        echo "  1. Build Docker images (with caching for speed)"
        echo "  2. Push to local registry"
        echo "  3. Skip unchanged images to save time"
        echo ""
        skip_statuses=$(deploy_all_services "$BACKEND_DIR" "$EXPORT_DIR" "$LINT_DIR" "$SPELL_CHECK_DIR" "$REGISTRY_PORT" "$REMOTE_HOST" "$SSH_KEY" 2>&1)
        echo ""
        echo "✅ All services built and deployed successfully!"
        echo "$skip_statuses"
    else
        echo "🚀 Building and deploying $SERVICE_NAME service..."
        skip_status=$(deploy_service "$SERVICE_NAME" "$REGISTRY_PORT" "$REMOTE_HOST" "$SSH_KEY" 2>&1)
        echo ""
        echo "✅ $SERVICE_NAME service built and deployed successfully!"
        echo "$skip_status"
    fi
    
    # Cleanup registry tags
    cleanup_registry_tags "$REGISTRY_PORT"
    
    log_success "Build deployment completed successfully"
fi