#!/usr/bin/env bash
# Common functions and variables for deployment scripts

# Source colors if available and not disabled
if [[ -z "$NO_COLOR" && -f "$(dirname "${BASH_SOURCE[0]}")/../colors.sh" ]]; then
    source "$(dirname "${BASH_SOURCE[0]}")/../colors.sh"
else
    # Fallback color definitions (disabled)
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    CYAN=''
    NC=''
fi

# Default configuration
DEFAULT_BACKEND_DIR="./backend"
DEFAULT_EXPORT_SERVICE_DIR="./export-service"
DEFAULT_LINT_SERVICE_DIR="./markdown-lint-service"
DEFAULT_SPELL_CHECK_SERVICE_DIR="./spell-check-service"
DEFAULT_REMOTE_USER_HOST="dlittle@10.0.1.51"
DEFAULT_REGISTRY_PORT="5000"
DEFAULT_SSH_KEY="$HOME/.ssh/id_danbian"

# Service configuration
declare -A SERVICE_CONFIG=(
    ["backend"]="$DEFAULT_BACKEND_DIR:littledan9/markdown-manager:latest:8000"
    ["export"]="$DEFAULT_EXPORT_SERVICE_DIR:littledan9/markdown-manager-export:latest:8001"
    ["lint"]="$DEFAULT_LINT_SERVICE_DIR:littledan9/markdown-manager-lint:latest:8002"
    ["spell-check"]="$DEFAULT_SPELL_CHECK_SERVICE_DIR:littledan9/markdown-manager-spell-check:latest:8003"
)

# Parse service configuration
get_service_dir() {
    local service=$1
    echo "${SERVICE_CONFIG[$service]}" | cut -d':' -f1
}

get_service_image() {
    local service=$1
    echo "${SERVICE_CONFIG[$service]}" | cut -d':' -f2-3
}

get_service_port() {
    local service=$1
    echo "${SERVICE_CONFIG[$service]}" | cut -d':' -f4
}

# Generate registry image name
get_registry_image() {
    local local_image=$1
    local registry_port=$2
    local repo_name=$(echo $local_image | cut -d'/' -f2 | cut -d':' -f1)
    echo "localhost:$registry_port/$repo_name:latest"
}

# Validation functions
validate_required_vars() {
    local required_vars=("$@")
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            echo -e "${RED}❌ Required variable $var is not set${NC}"
            return 1
        fi
    done
}

validate_directory() {
    local dir=$1
    local name=$2
    if [[ ! -d "$dir" ]]; then
        echo -e "${RED}❌ $name directory not found: $dir${NC}"
        return 1
    fi
}

validate_file() {
    local file=$1
    local name=$2
    if [[ ! -f "$file" ]]; then
        echo -e "${RED}❌ $name file not found: $file${NC}"
        return 1
    fi
}

# SSH and connectivity functions
check_ssh_connectivity() {
    local remote_host=$1
    local ssh_key=$2

    echo -e "${YELLOW}🔍 Checking remote host connectivity...${NC}"
    if ! ssh -q -T -i "$ssh_key" "$remote_host" "echo 'Connection successful'"; then
        echo -e "${RED}❌ Cannot connect to remote host${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Remote host accessible${NC}"
        return 0
    fi
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

# Docker configuration functions
configure_insecure_registry() {
    local registry_url=$1

    if ! grep -q "insecure-registries" ~/.docker/daemon.json 2>/dev/null; then
        echo -e "${YELLOW}🔧 Configuring local Docker for insecure registry...${NC}"
        mkdir -p ~/.docker
        if [[ -f ~/.docker/daemon.json ]]; then
            # Add insecure registry to existing config
            jq ". + {\"insecure-registries\": [\"$registry_url\"]}" ~/.docker/daemon.json > ~/.docker/daemon.json.tmp && mv ~/.docker/daemon.json.tmp ~/.docker/daemon.json
        else
            # Create new config
            echo "{\"insecure-registries\": [\"$registry_url\"]}" > ~/.docker/daemon.json
        fi
        echo -e "${RED}⚠️  Please restart Docker daemon and re-run this script${NC}"
        echo "Run: sudo systemctl restart docker"
        return 1
    fi
    return 0
}

# Service management functions
get_image_id() {
    local image=$1
    docker images -q "$image" 2>/dev/null
}

image_exists_in_registry() {
    local service_name=$1
    local registry_port=$2
    local remote_host=$3
    local ssh_key=$4

    echo -e "${YELLOW}🔍 Checking if $service_name image exists in remote registry...${NC}" >&2
    local service_repo=$(echo $(get_service_image $service_name) | cut -d':' -f1 | cut -d'/' -f2)
    local remote_manifest=$(ssh -q -T -i "$ssh_key" "$remote_host" "curl -s -H 'Accept: application/vnd.docker.distribution.manifest.v2+json' http://localhost:$registry_port/v2/$service_repo/manifests/latest 2>/dev/null" || echo "")

    if [[ -n "$remote_manifest" ]] && echo "$remote_manifest" | grep -q "schemaVersion"; then
        return 0
    else
        return 1
    fi
}

compare_image_ids() {
    local local_image=$1
    local registry_image=$2
    local remote_host=$3
    local ssh_key=$4

    local local_id=$(get_image_id "$local_image")
    # Get remote image ID without pulling - check what's already there
    local remote_id=$(ssh -q -T -i "$ssh_key" "$remote_host" "docker images -q $registry_image 2>/dev/null || echo 'none'")

    if [[ "$local_id" = "$remote_id" ]] && [[ "$remote_id" != "none" ]]; then
        return 0  # Images are the same
    else
        return 1  # Images are different or remote doesn't exist
    fi
}

# Cleanup functions
cleanup_local_images() {
    local repo_name=$1
    local keep_count=${2:-3}

    echo -e "  🔍 Cleaning up old local images for $repo_name..."

    # Get all images for this repository, sorted by creation date (newest first)
    local images=$(docker images --format "table {{.Repository}}:{{.Tag}}\t{{.ID}}\t{{.CreatedAt}}" | grep "^$repo_name:" | sort -k3 -r)

    if [[ -n "$images" ]]; then
        # Get image IDs to keep (first N)
        local keep_ids=$(echo "$images" | head -n $keep_count | awk '{print $2}')

        # Get all image IDs for this repo
        local all_ids=$(echo "$images" | awk '{print $2}')

        # Find IDs to remove (not in keep list)
        local remove_ids=$(echo "$all_ids" | grep -v -F "$keep_ids" || true)

        if [[ -n "$remove_ids" ]]; then
            echo -e "    🗑️  Removing $(echo "$remove_ids" | wc -l) old local images for $repo_name"
            echo "$remove_ids" | xargs -r docker rmi -f 2>/dev/null || true
        else
            echo -e "    ✅ No old local images to remove for $repo_name"
        fi
    else
        echo -e "    ℹ️  No local images found for $repo_name"
    fi
}

cleanup_dangling_images() {
    echo -e "${YELLOW}🧹 Cleaning up local dangling images...${NC}"
    docker image prune -f >/dev/null 2>&1 || true
}

# Utility functions
log_step() {
    local emoji=$1
    local message=$2
    if [[ -n "$NO_COLOR" ]]; then
        echo "STEP: $message"
    else
        echo -e "${YELLOW}$emoji $message${NC}"
    fi
}

log_success() {
    local message=$1
    if [[ -n "$NO_COLOR" ]]; then
        echo "SUCCESS: $message"
    else
        echo -e "${GREEN}✅ $message${NC}"
    fi
}

log_error() {
    local message=$1
    if [[ -n "$NO_COLOR" ]]; then
        echo "ERROR: $message"
    else
        echo -e "${RED}❌ $message${NC}"
    fi
}

log_info() {
    local emoji=$1
    local message=$2
    if [[ -n "$NO_COLOR" ]]; then
        echo "INFO: $message"
    else
        echo -e "${CYAN}$emoji $message${NC}"
    fi
}

# Print configuration summary
print_config_summary() {
    local backend_dir=$1
    local export_dir=$2
    local lint_dir=$3
    local spell_check_dir=$4
    local remote_host=$5
    local registry_port=$6

    echo -e "${BLUE}📋 Backend dir: $backend_dir${NC}"
    echo -e "${BLUE}📋 Export service dir: $export_dir${NC}"
    echo -e "${BLUE}📋 Lint service dir: $lint_dir${NC}"
    echo -e "${BLUE}📋 Spell check service dir: $spell_check_dir${NC}"
    echo -e "${BLUE}📋 Remote host: $remote_host${NC}"
    echo -e "${BLUE}📋 Registry port: $registry_port${NC}"
}

# Wait with visual feedback
wait_with_feedback() {
    local seconds=$1
    local message=${2:-"Waiting"}

    echo -e "${YELLOW}⏳ $message for $seconds seconds...${NC}"
    sleep $seconds
}