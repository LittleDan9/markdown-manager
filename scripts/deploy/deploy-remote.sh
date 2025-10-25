#!/usr/bin/env bash
# Remote deployment - Systemd services and container management

set -e

# Source common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/deploy-common.sh"

# Copy and install systemd service files
install_systemd_services() {
    local backend_dir=$1
    local export_dir=$2
    local lint_dir=$3
    local spell_check_dir=$4
    local remote_host=$5
    local ssh_key=$6
    
    log_step "📋" "Copying systemd service files..."
    
    # Copy service files to remote /tmp
    scp -q -i "$ssh_key" "$export_dir/markdown-manager-export.service" "$remote_host:/tmp/"
    scp -q -i "$ssh_key" "$lint_dir/markdown-manager-lint.service" "$remote_host:/tmp/"
    scp -q -i "$ssh_key" "$spell_check_dir/markdown-manager-spell-check.service" "$remote_host:/tmp/"
    scp -q -i "$ssh_key" "$backend_dir/markdown-manager-api.service" "$remote_host:/tmp/"
    
    # Install services on remote host
    ssh -q -T -i "$ssh_key" "$remote_host" 'bash -s' << 'EOH'
        set -e
        
        # Clean up old PDF service if it exists
        if sudo systemctl is-enabled markdown-manager-pdf.service >/dev/null 2>&1; then
            echo "🧹 Cleaning up old PDF service..."
            sudo systemctl stop markdown-manager-pdf.service || true
            sudo systemctl disable markdown-manager-pdf.service || true
            sudo rm -f /etc/systemd/system/markdown-manager-pdf.service || true
            sudo systemctl daemon-reload
        fi
        
        # Install export service
        sudo cp /tmp/markdown-manager-export.service /etc/systemd/system/markdown-manager-export.service
        sudo systemctl daemon-reload
        sudo systemctl enable markdown-manager-export.service
        
        # Install lint service
        sudo cp /tmp/markdown-manager-lint.service /etc/systemd/system/markdown-manager-lint.service
        sudo systemctl daemon-reload
        sudo systemctl enable markdown-manager-lint.service
        
        # Install spell check service
        sudo cp /tmp/markdown-manager-spell-check.service /etc/systemd/system/markdown-manager-spell-check.service
        sudo systemctl daemon-reload
        sudo systemctl enable markdown-manager-spell-check.service
        
        # Install backend service
        sudo cp /tmp/markdown-manager-api.service /etc/systemd/system/markdown-manager-api.service
        sudo systemctl daemon-reload
        sudo systemctl enable markdown-manager-api.service
EOH
    
    log_success "Systemd services installed and enabled"
}

# Pull images and restart services
deploy_containers() {
    local registry_port=$1
    local remote_host=$2
    local ssh_key=$3
    local skip_statuses=$4  # "export_skip lint_skip spell_check_skip backend_skip"
    
    # Parse skip statuses
    read export_skip lint_skip spell_check_skip backend_skip <<< "$skip_statuses"
    
    log_step "🚀" "Deploying containers on $remote_host"
    
    # Create remote deployment script with explicit variable passing
    ssh -q -T -i "$ssh_key" "$remote_host" "
        set -e
        
        REGISTRY_PORT=$registry_port
        EXPORT_SKIP=$export_skip
        LINT_SKIP=$lint_skip
        SPELL_CHECK_SKIP=$spell_check_skip
        BACKEND_SKIP=$backend_skip
        
        # Pull export service image if needed
        if [[ \"\$EXPORT_SKIP\" != \"true\" ]]; then
            echo \"[PULL] Pulling latest export service image from local registry...\"
            docker pull localhost:\$REGISTRY_PORT/markdown-manager-export:latest
            # Tag for local use (matching the service file expectations)
            docker tag localhost:\$REGISTRY_PORT/markdown-manager-export:latest littledan9/markdown-manager-export:latest
        else
            echo \"[SKIP] Using existing export service image (no pull needed)\"
        fi
        
        # Pull lint service image if needed
        if [[ \"\$LINT_SKIP\" != \"true\" ]]; then
            echo \"[PULL] Pulling latest lint service image from local registry...\"
            docker pull localhost:\$REGISTRY_PORT/markdown-manager-lint:latest
            # Tag for local use (matching the service file expectations)
            docker tag localhost:\$REGISTRY_PORT/markdown-manager-lint:latest littledan9/markdown-manager-lint:latest
        else
            echo \"[SKIP] Using existing lint service image (no pull needed)\"
        fi
        
        # Pull spell check service image if needed
        if [[ \"\$SPELL_CHECK_SKIP\" != \"true\" ]]; then
            echo \"[PULL] Pulling latest spell check service image from local registry...\"
            docker pull localhost:\$REGISTRY_PORT/markdown-manager-spell-check:latest
            # Tag for local use (matching the service file expectations)
            docker tag localhost:\$REGISTRY_PORT/markdown-manager-spell-check:latest littledan9/markdown-manager-spell-check:latest
        else
            echo \"[SKIP] Using existing spell check service image (no pull needed)\"
        fi
        
        # Pull backend image if needed
        if [[ \"\$BACKEND_SKIP\" != \"true\" ]]; then
            echo \"[PULL] Pulling latest backend image from local registry...\"
            docker pull localhost:\$REGISTRY_PORT/markdown-manager:latest
            # Tag for local use (matching the service file expectations)
            docker tag localhost:\$REGISTRY_PORT/markdown-manager:latest littledan9/markdown-manager:latest
        else
            echo \"[SKIP] Using existing backend image (no pull needed)\"
        fi
        
        # Restart services in proper order (dependencies first)
        echo \"[RESTART] Restarting export service...\"
        sudo systemctl restart markdown-manager-export.service
        
        echo \"[WAIT] Waiting for export service to be ready...\"
        sleep 3
        
        echo \"[RESTART] Restarting lint service...\"
        sudo systemctl restart markdown-manager-lint.service
        
        echo \"[WAIT] Waiting for lint service to be ready...\"
        sleep 3
        
        echo \"[RESTART] Restarting spell check service...\"
        sudo systemctl restart markdown-manager-spell-check.service
        
        echo \"[WAIT] Waiting for spell check service to be ready...\"
        sleep 3
        
        echo \"[RESTART] Restarting backend service...\"
        sudo systemctl restart markdown-manager-api.service
        
        echo \"[WAIT] Waiting for backend service to be ready...\"
        sleep 8
    "
    
    log_success "Container deployment completed"
}

# Deploy a single service
deploy_single_service() {
    local service_name=$1
    local registry_port=$2
    local remote_host=$3
    local ssh_key=$4
    local skip_push=$5
    
    local local_image=$(get_service_image "$service_name")
    local service_file="markdown-manager-${service_name}.service"
    if [[ "$service_name" == "backend" ]]; then
        service_file="markdown-manager-api.service"
    fi
    
    # Install systemd service
    local service_dir=$(get_service_dir "$service_name")
    scp -q -i "$ssh_key" "$service_dir/$service_file" "$remote_host:/tmp/"
    
    ssh -q -T -i "$ssh_key" "$remote_host" bash << EOH
        SERVICE_FILE=$service_file
        sudo cp /tmp/\$SERVICE_FILE /etc/systemd/system/\$SERVICE_FILE
        sudo systemctl daemon-reload
        sudo systemctl enable \$SERVICE_FILE
EOH
    
    # Pull image and restart service
    ssh -q -T -i "$ssh_key" "$remote_host" bash << EOH
        REGISTRY_PORT=$registry_port
        SERVICE_NAME=$service_name
        SKIP_PUSH=$skip_push
        LOCAL_IMAGE=$local_image
        SERVICE_FILE=$service_file
        
        if [[ "\$SKIP_PUSH" != "true" ]]; then
            echo "[PULL] Pulling latest \$SERVICE_NAME service image from local registry..."
            REPO_NAME=\$(echo "\$LOCAL_IMAGE" | cut -d'/' -f2 | cut -d':' -f1)
            docker pull localhost:\$REGISTRY_PORT/\$REPO_NAME:latest
            docker tag localhost:\$REGISTRY_PORT/\$REPO_NAME:latest \$LOCAL_IMAGE
        else
            echo "[SKIP] Using existing \$SERVICE_NAME service image (no pull needed)"
        fi
        
        echo "[RESTART] Restarting \$SERVICE_NAME service..."
        sudo systemctl restart \$SERVICE_FILE
        sleep 5
EOH
    
    log_success "$service_name service deployed"
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
    SKIP_STATUSES=${8:-"false false false false"}  # Default to rebuild all
    SERVICE_NAME=${9:-"all"}  # Optional: deploy specific service
    
    echo "Remote Deployment Script"
    echo "========================"
    print_config_summary "$BACKEND_DIR" "$EXPORT_DIR" "$LINT_DIR" "$SPELL_CHECK_DIR" "$REMOTE_HOST" "$REGISTRY_PORT"
    echo
    
    # Validate SSH key and connectivity
    validate_file "$SSH_KEY" "SSH key"
    check_ssh_connectivity "$REMOTE_HOST" "$SSH_KEY"
    
    if [[ "$SERVICE_NAME" == "all" ]]; then
        # Deploy all services
        install_systemd_services "$BACKEND_DIR" "$EXPORT_DIR" "$LINT_DIR" "$SPELL_CHECK_DIR" "$REMOTE_HOST" "$SSH_KEY"
        deploy_containers "$REGISTRY_PORT" "$REMOTE_HOST" "$SSH_KEY" "$SKIP_STATUSES"
    else
        # Deploy single service
        read export_skip lint_skip spell_check_skip backend_skip <<< "$SKIP_STATUSES"
        case "$SERVICE_NAME" in
            "export") deploy_single_service "export" "$REGISTRY_PORT" "$REMOTE_HOST" "$SSH_KEY" "$export_skip" ;;
            "lint") deploy_single_service "lint" "$REGISTRY_PORT" "$REMOTE_HOST" "$SSH_KEY" "$lint_skip" ;;
            "spell-check") deploy_single_service "spell-check" "$REGISTRY_PORT" "$REMOTE_HOST" "$SSH_KEY" "$spell_check_skip" ;;
            "backend") deploy_single_service "backend" "$REGISTRY_PORT" "$REMOTE_HOST" "$SSH_KEY" "$backend_skip" ;;
            *) log_error "Unknown service: $SERVICE_NAME"; exit 1 ;;
        esac
    fi
    
    log_success "Remote deployment completed successfully"
fi