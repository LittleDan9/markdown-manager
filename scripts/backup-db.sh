#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# scripts/backup-db.sh - Backup production database
# ────────────────────────────────────────────────────────────────────────────

set -e

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Change to project root
cd "$PROJECT_ROOT"

source ./scripts/db-functions.sh

REMOTE_USER_HOST=$1
BACKUP_FILE=$2

if [ -z "$REMOTE_USER_HOST" ]; then
    echo "$RED❌ Missing required argument: REMOTE_USER_HOST$NC"
    exit 1
fi

# Generate backup filename if not provided
if [ -z "$BACKUP_FILE" ]; then
    BACKUP_FILE="$PROJECT_ROOT/backups/production_backup_$(date +%Y%m%d_%H%M%S).json"
fi

# Convert relative path to absolute path
if [[ ! "$BACKUP_FILE" =~ ^/ ]]; then
    BACKUP_FILE="$PROJECT_ROOT/$BACKUP_FILE"
fi

echo "$YELLOW💾 Starting database backup to $BACKUP_FILE...$NC"

# Parse remote database config and setup port forwarding
parse_remote_db_env $REMOTE_USER_HOST
setup_port_forward $REMOTE_USER_HOST

# Get local connection string
LOCAL_DB_URL=$(get_local_db_url)

echo "$YELLOW📊 Generating backup data...$NC"

# Create backups directory if it doesn't exist
mkdir -p "$(dirname "$BACKUP_FILE")"

# Create temporary files for table data
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Export each table to JSON
echo "$YELLOW📋 Exporting users table...$NC"
psql "$LOCAL_DB_URL" -t -c "SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (SELECT * FROM users ORDER BY id) t;" > "$TEMP_DIR/users.json"

echo "$YELLOW📋 Exporting documents table...$NC"
psql "$LOCAL_DB_URL" -t -c "SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (SELECT * FROM documents ORDER BY id) t;" > "$TEMP_DIR/documents.json"

echo "$YELLOW📋 Exporting custom_dictionaries table...$NC"
psql "$LOCAL_DB_URL" -t -c "SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (SELECT * FROM custom_dictionaries ORDER BY id) t;" > "$TEMP_DIR/custom_dictionaries.json"

echo "$YELLOW📋 Exporting document_recovery table...$NC"
psql "$LOCAL_DB_URL" -t -c "SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (SELECT * FROM document_recovery ORDER BY id) t;" > "$TEMP_DIR/document_recovery.json"

# Build final JSON structure (removed alembic_version)
{
    echo "{"
    echo "  \"backup_timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%S.%6N+00:00)\","
    echo "  \"database_url\": \"$DB_HOST:$DB_PORT/$DB_NAME\","
    echo "  \"tables\": {"
    echo "    \"users\": $(cat "$TEMP_DIR/users.json" | sed 's/^ *//' | tr -d '\n'),"
    echo "    \"documents\": $(cat "$TEMP_DIR/documents.json" | sed 's/^ *//' | tr -d '\n'),"
    echo "    \"custom_dictionaries\": $(cat "$TEMP_DIR/custom_dictionaries.json" | sed 's/^ *//' | tr -d '\n'),"
    echo "    \"document_recovery\": $(cat "$TEMP_DIR/document_recovery.json" | sed 's/^ *//' | tr -d '\n')"
    echo "  }"
    echo "}"
} > "$BACKUP_FILE"

echo "$GREEN✅ Database backup complete: $BACKUP_FILE$NC"
echo "$YELLOW📊 Backup size: $(du -h "$BACKUP_FILE" | cut -f1)$NC"

echo "$GREEN✅ Database backup complete: $BACKUP_FILE$NC"
echo "$YELLOW📊 Backup size: $(du -h "$BACKUP_FILE" | cut -f1)$NC"
