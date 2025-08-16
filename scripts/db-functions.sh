#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# scripts/db-functions.sh - Shared database connection functions
# ────────────────────────────────────────────────────────────────────────────

set -e

source ./scripts/colors.sh

# SSH and database configuration
KEY=~/.ssh/id_danbian
LOCAL_PORT=15432
SSH_PID_FILE="/tmp/markdown-manager-ssh-tunnel.pid"

# Parse remote DATABASE_URL and extract components
parse_remote_db_env() {
    local remote_user_host=$1
    
    echo "$YELLOW📋 Parsing remote database configuration...$NC"
    
    # Get DATABASE_URL from remote /etc/markdown-manager.env (requires sudo)
    local db_url=$(ssh -i $KEY $remote_user_host "sudo grep '^DATABASE_URL=' /etc/markdown-manager.env | cut -d'=' -f2- | tr -d '\"'")
    
    if [ -z "$db_url" ]; then
        echo "$RED❌ Failed to get DATABASE_URL from remote host$NC"
        echo "$YELLOW💡 Ensure the remote user has passwordless sudo access to read /etc/markdown-manager.env$NC"
        exit 1
    fi
    
    echo "$BLUE🔍 Raw DATABASE_URL: $db_url$NC"
    
    # Parse postgresql+asyncpg://user:pass@host:port/dbname or postgres://user:pass@host:port/dbname
    if [[ $db_url =~ ^postgresql(\+asyncpg)?://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+)$ ]]; then
        export DB_USER="${BASH_REMATCH[2]}"
        export DB_PASS="${BASH_REMATCH[3]}"
        export DB_HOST="${BASH_REMATCH[4]}"
        export DB_PORT="${BASH_REMATCH[5]}"
        export DB_NAME="${BASH_REMATCH[6]}"
        
        echo "$GREEN✅ Database config parsed: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME$NC"
        echo "$BLUE🔐 Password contains ${#DB_PASS} characters$NC"
    else
        echo "$RED❌ Failed to parse DATABASE_URL format$NC"
        echo "$YELLOW💡 Expected format: postgresql+asyncpg://user:pass@host:port/dbname$NC"
        echo "$YELLOW💡 Got: $db_url$NC"
        exit 1
    fi
}

# Setup SSH port forwarding to remote database
setup_port_forward() {
    local remote_user_host=$1
    
    echo "$YELLOW🔗 Setting up SSH port forwarding $LOCAL_PORT -> $DB_HOST:$DB_PORT...$NC"
    
    # Kill any existing tunnel
    cleanup_port_forward
    
    # Create SSH tunnel in background
    ssh -i $KEY -f -N -L $LOCAL_PORT:$DB_HOST:$DB_PORT $remote_user_host
    
    # Store PID for cleanup
    echo $! > $SSH_PID_FILE
    
    # Wait a moment for tunnel to establish
    sleep 2
    
    # Test connection
    if nc -z localhost $LOCAL_PORT 2>/dev/null; then
        echo "$GREEN✅ SSH tunnel established on port $LOCAL_PORT$NC"
    else
        echo "$RED❌ Failed to establish SSH tunnel$NC"
        cleanup_port_forward
        exit 1
    fi
}

# Cleanup SSH port forwarding
cleanup_port_forward() {
    if [ -f "$SSH_PID_FILE" ]; then
        local pid=$(cat $SSH_PID_FILE)
        if kill -0 $pid 2>/dev/null; then
            echo "$YELLOW🧹 Cleaning up SSH tunnel (PID: $pid)...$NC"
            kill $pid
        fi
        rm -f $SSH_PID_FILE
    fi
    
    # Also kill any processes using our local port
    local existing_pid=$(lsof -ti:$LOCAL_PORT 2>/dev/null || true)
    if [ -n "$existing_pid" ]; then
        kill $existing_pid 2>/dev/null || true
    fi
}

# Get local connection string for forwarded port
get_local_db_url() {
    echo "postgresql://$DB_USER:$DB_PASS@localhost:$LOCAL_PORT/$DB_NAME"
}

# Cleanup on script exit
trap cleanup_port_forward EXIT
