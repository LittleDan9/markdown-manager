#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# scripts/db-functions.sh - Shared database connection functions
# ────────────────────────────────────────────────────────────────────────────

# Don't exit on error for interactive functions
set +e

# Source colors if available
if [ -f "./scripts/colors.sh" ]; then
    source ./scripts/colors.sh
else
    # Fallback color definitions
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    NC='\033[0m'
fi

# SSH and database configuration
KEY=~/.ssh/id_danbian
LOCAL_PORT=15432
SSH_PID_FILE="/tmp/markdown-manager-ssh-tunnel.pid"

# Parse remote DATABASE_URL and extract components
parse_remote_db_env() {
    local remote_user_host=$1

    if [ -z "$remote_user_host" ]; then
        echo -e "$RED❌ Usage: parse_remote_db_env <user@host>$NC"
        return 1
    fi

    echo -e "$YELLOW📋 Parsing remote database configuration...$NC"

    # Get DATABASE_URL from remote /etc/markdown-manager.env (requires sudo)
    local db_url
    db_url=$(ssh -i "$KEY" "$remote_user_host" "sudo grep '^DATABASE_URL=' /etc/markdown-manager.env | cut -d'=' -f2- | tr -d '\"'" 2>/dev/null)

    if [ -z "$db_url" ]; then
        echo -e "$RED❌ Failed to get DATABASE_URL from remote host$NC"
        echo -e "$YELLOW💡 Ensure the remote user has passwordless sudo access to read /etc/markdown-manager.env$NC"
        return 1
    fi

    echo -e "$BLUE🔍 Successfully retrieved DATABASE_URL$NC"

    # Parse using parameter expansion instead of regex for better special character handling
    # postgresql+asyncpg://user:pass@host:port/dbname or postgres://user:pass@host:port/dbname
    local url_part="${db_url#*://}"      # Remove protocol
    local credentials="${url_part%%@*}"  # Extract user:pass
    local hostdb="${url_part#*@}"        # Extract host:port/dbname

    export DB_USER="${credentials%%:*}"   # Extract user
    export DB_PASS="${credentials#*:}"    # Extract password

    local hostport="${hostdb%%/*}"        # Extract host:port
    export DB_NAME="${hostdb#*/}"         # Extract database name

    export DB_HOST="${hostport%%:*}"      # Extract host
    export DB_PORT="${hostport#*:}"       # Extract port

    # Validate that we got all components
    if [ -z "$DB_USER" ] || [ -z "$DB_PASS" ] || [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ] || [ -z "$DB_NAME" ]; then
        echo -e "$RED❌ Failed to parse DATABASE_URL components$NC"
        return 1
    fi

    echo -e "$GREEN✅ Database config parsed: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME$NC"
    echo -e "$BLUE� Password contains ${#DB_PASS} characters$NC"
    return 0
}

# Setup SSH port forwarding to remote database
setup_port_forward() {
    local remote_user_host=$1

    if [ -z "$remote_user_host" ]; then
        echo -e "$RED❌ Usage: setup_port_forward <user@host>$NC"
        return 1
    fi

    if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ]; then
        echo -e "$RED❌ Database config not parsed. Run parse_remote_db_env first$NC"
        return 1
    fi

    echo -e "$YELLOW🔗 Setting up SSH port forwarding $LOCAL_PORT -> $DB_HOST:$DB_PORT...$NC"

    # Kill any existing tunnel
    cleanup_port_forward

    # Create SSH tunnel in background
    ssh -i "$KEY" -f -N -L "$LOCAL_PORT:$DB_HOST:$DB_PORT" "$remote_user_host"
    local ssh_exit_code=$?

    if [ $ssh_exit_code -ne 0 ]; then
        echo -e "$RED❌ Failed to create SSH tunnel (exit code: $ssh_exit_code)$NC"
        return 1
    fi

    # Wait a moment for tunnel to establish
    sleep 2

    # Test connection
    if command -v nc >/dev/null 2>&1 && nc -z localhost "$LOCAL_PORT" 2>/dev/null; then
        echo -e "$GREEN✅ SSH tunnel established on port $LOCAL_PORT$NC"
        return 0
    elif command -v telnet >/dev/null 2>&1; then
        # Fallback to telnet test
        if timeout 3 telnet localhost "$LOCAL_PORT" </dev/null >/dev/null 2>&1; then
            echo -e "$GREEN✅ SSH tunnel established on port $LOCAL_PORT$NC"
            return 0
        fi
    fi

    echo -e "$RED❌ Failed to establish SSH tunnel$NC"
    cleanup_port_forward
    return 1
}

# Cleanup SSH port forwarding
cleanup_port_forward() {
    # Kill processes using our local port
    local existing_pids
    existing_pids=$(lsof -ti:"$LOCAL_PORT" 2>/dev/null || true)
    if [ -n "$existing_pids" ]; then
        echo -e "$YELLOW🧹 Cleaning up processes on port $LOCAL_PORT...$NC"
        echo "$existing_pids" | xargs -r kill 2>/dev/null || true
        sleep 1
    fi

    # Clean up PID file
    if [ -f "$SSH_PID_FILE" ]; then
        rm -f "$SSH_PID_FILE"
    fi
}

# Get local connection string for forwarded port (for programmatic use)
get_local_db_url() {
    if [ -z "$DB_USER" ] || [ -z "$DB_PASS" ] || [ -z "$DB_NAME" ]; then
        echo -e "$RED❌ Database config not parsed. Run parse_remote_db_env first$NC" >&2
        return 1
    fi

    # URL-encode special characters in password for PostgreSQL connection
    local encoded_pass
    encoded_pass=$(printf '%s' "$DB_PASS" | python3 -c "import sys, urllib.parse; print(urllib.parse.quote(sys.stdin.read().strip(), safe=''))")

    # Return the URL without printing it (caller should capture it)
    printf "postgresql://%s:%s@localhost:%s/%s" "$DB_USER" "$encoded_pass" "$LOCAL_PORT" "$DB_NAME"
}

# Show connection information (without password)
show_connection_info() {
    if [ -z "$DB_USER" ] || [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ] || [ -z "$DB_NAME" ]; then
        echo -e "$RED❌ Database config not parsed. Run parse_remote_db_env first$NC"
        return 1
    fi

    echo -e "$BLUE📊 Connection Information:$NC"
    echo -e "  Host: $DB_HOST:$DB_PORT"
    echo -e "  Database: $DB_NAME"
    echo -e "  User: $DB_USER"
    echo -e "  Local tunnel: localhost:$LOCAL_PORT"
    echo -e "  Password: [HIDDEN]"
}

# Connect to database via tunnel
connect_to_db() {
    if [ -z "$DB_USER" ] || [ -z "$DB_PASS" ] || [ -z "$DB_NAME" ]; then
        echo -e "$RED❌ Database config not parsed. Run parse_remote_db_env first$NC"
        return 1
    fi

    echo -e "$YELLOW🔗 Connecting to database...$NC"
    # Get URL without printing it to terminal
    local db_url
    db_url=$(get_local_db_url)
    psql "$db_url"
}

# Show usage information
show_db_usage() {
    echo -e "$BLUE📚 Database Functions Usage:$NC"
    echo ""
    echo "1. Parse remote database configuration:"
    echo "   parse_remote_db_env dlittle@10.0.1.51"
    echo ""
    echo "2. Setup SSH tunnel:"
    echo "   setup_port_forward dlittle@10.0.1.51"
    echo ""
    echo "3. Show connection info (without password):"
    echo "   show_connection_info"
    echo ""
    echo "4. Connect to database directly:"
    echo "   connect_to_db"
    echo ""
    echo "5. Get connection URL for scripts (capture output):"
    echo "   DB_URL=\$(get_local_db_url)"
    echo ""
    echo "6. Cleanup:"
    echo "   cleanup_port_forward"
    echo ""
    echo -e "$YELLOW⚠️  Security Note: Never run 'get_local_db_url' without capturing output$NC"
    echo -e "$YELLOW   as it contains the password. Use 'show_connection_info' instead.$NC"
    echo ""
    echo -e "$YELLOW💡 Example workflow:$NC"
    echo "   parse_remote_db_env dlittle@10.0.1.51"
    echo "   setup_port_forward dlittle@10.0.1.51"
    echo "   connect_to_db"
    echo "   cleanup_port_forward"
}
