#!/usr/bin/env bash
# Infrastructure deployment - SSH tunnels and registry setup

set -e

# Source common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/deploy-common.sh"

# Infrastructure setup function
setup_infrastructure() {
    local remote_host=$1
    local registry_port=$2
    local ssh_key=$3
    
    # Validate required parameters
    validate_required_vars "remote_host" "registry_port" "ssh_key"
    
    # Check SSH connectivity
    check_ssh_connectivity "$remote_host" "$ssh_key"
    
    # Configure local Docker for insecure registry
    local registry_url="$remote_host:$registry_port"
    configure_insecure_registry "$registry_url"
    
    # Create SSH tunnel for registry access
    log_step "🔗" "Creating SSH tunnel to remote registry..."
    ssh -f -N -L $registry_port:localhost:$registry_port -i "$ssh_key" "$remote_host"
    
    # Wait for tunnel to establish
    wait_with_feedback 2 "Waiting for SSH tunnel to establish"
    
    # Test tunnel
    if ! curl -s http://localhost:$registry_port/v2/ | grep -q "{}"; then
        log_error "SSH tunnel failed"
        cleanup_ssh_tunnel "$registry_port"
        return 1
    fi
    
    log_success "Infrastructure setup complete"
    return 0
}

# Cleanup SSH tunnel
cleanup_ssh_tunnel() {
    local registry_port=$1
    log_step "🧹" "Cleaning up SSH tunnel..."
    pkill -f "ssh.*$registry_port:localhost:$registry_port" || true
}

# Check if SSH tunnel is active
is_tunnel_active() {
    local registry_port=$1
    curl -s http://localhost:$registry_port/v2/ | grep -q "{}" 2>/dev/null
}

# Main execution when script is called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Parse command line arguments
    REMOTE_HOST=${1:-$DEFAULT_REMOTE_USER_HOST}
    REGISTRY_PORT=${2:-$DEFAULT_REGISTRY_PORT}
    SSH_KEY=${3:-$DEFAULT_SSH_KEY}
    
    # Validate SSH key
    validate_file "$SSH_KEY" "SSH key"
    
    echo "Infrastructure Deployment Script"
    echo "================================"
    print_config_summary "" "" "" "" "$REMOTE_HOST" "$REGISTRY_PORT"
    echo
    
    # Setup infrastructure
    if setup_infrastructure "$REMOTE_HOST" "$REGISTRY_PORT" "$SSH_KEY"; then
        log_success "Infrastructure deployment completed successfully"
        echo -e "${YELLOW}📝 SSH tunnel is active on port $REGISTRY_PORT${NC}"
        echo -e "${YELLOW}📝 Use 'pkill -f \"ssh.*$REGISTRY_PORT:localhost:$REGISTRY_PORT\"' to cleanup when done${NC}"
    else
        log_error "Infrastructure deployment failed"
        exit 1
    fi
fi