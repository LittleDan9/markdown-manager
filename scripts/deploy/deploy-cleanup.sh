#!/usr/bin/env bash
# Cleanup deployment - Image and container cleanup operations

set -e

# Source common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/deploy-common.sh"

# Remote cleanup operations
cleanup_remote_images() {
    local registry_port=$1
    local remote_host=$2
    local ssh_key=$3
    local keep_count=${4:-5}

    log_step "🧹" "Cleaning up remote Docker images..."

    ssh -q -T -i "$ssh_key" "$remote_host" "REGISTRY_PORT=$registry_port KEEP_COUNT=$keep_count" 'bash -s' << 'EOH'
        set -e

        # Function to clean up old images for a specific repository
        cleanup_old_images() {
            local repo_name=$1
            local keep_count=$2

            echo "  🔍 Cleaning up old images for $repo_name..."

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
                    echo "    🗑️  Removing $(echo "$remove_ids" | wc -l) old images for $repo_name"
                    echo "$remove_ids" | xargs -r docker rmi -f 2>/dev/null || true
                else
                    echo "    ✅ No old images to remove for $repo_name"
                fi
            else
                echo "    ℹ️  No images found for $repo_name"
            fi
        }

        # Clean up images for each service
        cleanup_old_images "littledan9/markdown-manager" $KEEP_COUNT
        cleanup_old_images "littledan9/markdown-manager-export" $KEEP_COUNT
        cleanup_old_images "littledan9/markdown-manager-lint" $KEEP_COUNT
        cleanup_old_images "littledan9/markdown-manager-spell-check" $KEEP_COUNT
        cleanup_old_images "localhost:$REGISTRY_PORT/markdown-manager" $KEEP_COUNT
        cleanup_old_images "localhost:$REGISTRY_PORT/markdown-manager-export" $KEEP_COUNT
        cleanup_old_images "localhost:$REGISTRY_PORT/markdown-manager-lint" $KEEP_COUNT
        cleanup_old_images "localhost:$REGISTRY_PORT/markdown-manager-spell-check" $KEEP_COUNT

        # Clean up dangling images and unused containers
        echo "🧹 Cleaning up dangling images and unused containers..."
        docker image prune -f >/dev/null 2>&1 || true
        docker container prune -f >/dev/null 2>&1 || true

        # Show disk usage after cleanup
        echo "💾 Docker disk usage after cleanup:"
        docker system df
EOH

    log_success "Remote image cleanup completed"
}

# Local cleanup operations
cleanup_local_repository() {
    local repo_name=$1
    local keep_count=$2

    echo "  🔍 Cleaning up old images for $repo_name..." >&2

    # Get all images for this repository, sorted by creation date (newest first)
    local images=$(docker images --format "table {{.Repository}}:{{.Tag}}\t{{.ID}}\t{{.CreatedAt}}" | grep "^$repo_name:" | sort -k3 -r 2>/dev/null || true)

    if [[ -n "$images" ]]; then
        # Get image IDs to keep (first N)
        local keep_ids=$(echo "$images" | head -n $keep_count | awk '{print $2}')

        # Get all image IDs for this repo
        local all_ids=$(echo "$images" | awk '{print $2}')

        # Find IDs to remove (not in keep list)
        local remove_ids=$(echo "$all_ids" | grep -v -F "$keep_ids" 2>/dev/null || true)

        if [[ -n "$remove_ids" ]]; then
            echo "    🗑️  Removing $(echo "$remove_ids" | wc -l) old images for $repo_name" >&2
            echo "$remove_ids" | xargs -r docker rmi -f 2>/dev/null || true
        else
            echo "    ✅ No old images to remove for $repo_name" >&2
        fi
    else
        echo "    ℹ️  No images found for $repo_name" >&2
    fi
}

cleanup_local_images() {
    local keep_count=${1:-3}

    log_step "🧹" "Cleaning up local Docker images..."

    # Clean up local images for each service
    cleanup_local_repository "littledan9/markdown-manager" $keep_count
    cleanup_local_repository "littledan9/markdown-manager-export" $keep_count
    cleanup_local_repository "littledan9/markdown-manager-lint" $keep_count
    cleanup_local_repository "littledan9/markdown-manager-spell-check" $keep_count

    # Clean up dangling images
    cleanup_dangling_images

    log_success "Local image cleanup completed"
}

# Get registry statistics
show_registry_stats() {
    local registry_port=$1
    local remote_host=$2
    local ssh_key=$3

    log_step "📊" "Remote registry stats:"
    ssh -q -T -i "$ssh_key" "$remote_host" "REGISTRY_PORT=$registry_port" 'bash -s' << 'EOH'
        curl -s http://localhost:$REGISTRY_PORT/v2/_catalog 2>/dev/null || echo 'Registry catalog unavailable'
EOH
}

# Comprehensive cleanup (both local and remote)
cleanup_all() {
    local registry_port=$1
    local remote_host=$2
    local ssh_key=$3
    local local_keep_count=${4:-3}
    local remote_keep_count=${5:-5}

    # Local cleanup
    cleanup_local_images $local_keep_count

    # Remote cleanup
    cleanup_remote_images $registry_port $remote_host $ssh_key $remote_keep_count

    # Show registry stats
    show_registry_stats $registry_port $remote_host $ssh_key

    log_success "Comprehensive cleanup completed"
}

# Main execution when script is called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Parse command line arguments
    OPERATION=${1:-"all"}  # all, local, remote, stats
    REGISTRY_PORT=${2:-$DEFAULT_REGISTRY_PORT}
    REMOTE_HOST=${3:-$DEFAULT_REMOTE_USER_HOST}
    SSH_KEY=${4:-$DEFAULT_SSH_KEY}
    LOCAL_KEEP_COUNT=${5:-3}
    REMOTE_KEEP_COUNT=${6:-5}

    echo "Cleanup Deployment Script"
    echo "========================="
    echo -e "${BLUE}📋 Operation: $OPERATION${NC}"
    echo -e "${BLUE}📋 Registry port: $REGISTRY_PORT${NC}"
    echo -e "${BLUE}📋 Remote host: $REMOTE_HOST${NC}"
    echo -e "${BLUE}📋 Local keep count: $LOCAL_KEEP_COUNT${NC}"
    echo -e "${BLUE}📋 Remote keep count: $REMOTE_KEEP_COUNT${NC}"
    echo

    case "$OPERATION" in
        "local")
            cleanup_local_images $LOCAL_KEEP_COUNT
            ;;
        "remote")
            validate_file "$SSH_KEY" "SSH key"
            check_ssh_connectivity "$REMOTE_HOST" "$SSH_KEY"
            cleanup_remote_images $REGISTRY_PORT $REMOTE_HOST $SSH_KEY $REMOTE_KEEP_COUNT
            ;;
        "stats")
            validate_file "$SSH_KEY" "SSH key"
            check_ssh_connectivity "$REMOTE_HOST" "$SSH_KEY"
            show_registry_stats $REGISTRY_PORT $REMOTE_HOST $SSH_KEY
            ;;
        "all")
            validate_file "$SSH_KEY" "SSH key"
            check_ssh_connectivity "$REMOTE_HOST" "$SSH_KEY"
            cleanup_all $REGISTRY_PORT $REMOTE_HOST $SSH_KEY $LOCAL_KEEP_COUNT $REMOTE_KEEP_COUNT
            ;;
        *)
            log_error "Unknown operation: $OPERATION"
            echo "Valid operations: all, local, remote, stats"
            exit 1
            ;;
    esac

    log_success "Cleanup operation '$OPERATION' completed"
fi