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

# Tables to exclude from backup (system/migration tables)
EXCLUDED_TABLES="alembic_version"

echo "$YELLOW📋 Discovering database tables...$NC"

# Get all table names excluding system tables
TABLES=$(psql "$LOCAL_DB_URL" -t -c "
    SELECT table_name
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name NOT IN ('$EXCLUDED_TABLES')
    ORDER BY table_name;
" | tr -d ' ' | grep -v '^$' | tr '\n' ' ')

# Convert to array for processing
IFS=' ' read -ra TABLE_ARRAY <<< "$TABLES"

echo "$YELLOW📊 Found ${#TABLE_ARRAY[@]} tables to backup: ${TABLE_ARRAY[*]}$NC"

# Export each table to JSON
for table in "${TABLE_ARRAY[@]}"; do
    if [ -n "$table" ]; then
        echo "$YELLOW📋 Exporting $table table...$NC"
        
        # Check if table has an 'id' column for ordering, otherwise use default order
        has_id=$(psql "$LOCAL_DB_URL" -t -c "
            SELECT EXISTS(
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = '$table' 
                AND column_name = 'id'
                AND table_schema = 'public'
            );
        " | tr -d ' \n')
        
        if [ "$has_id" = "t" ]; then
            ORDER_BY="ORDER BY id"
        else
            ORDER_BY=""
        fi
        
        psql "$LOCAL_DB_URL" -t -c "
            SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) 
            FROM (SELECT * FROM \"$table\" $ORDER_BY) t;
        " > "$TEMP_DIR/$table.json"
    fi
done

# Build final JSON structure dynamically
{
    echo "{"
    echo "  \"backup_timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%S.%6N+00:00)\","
    echo "  \"database_url\": \"$DB_HOST:$DB_PORT/$DB_NAME\","
    echo "  \"excluded_tables\": [\"$EXCLUDED_TABLES\"],"
    echo "  \"tables\": {"
    
    # Add each table's data to the JSON
    first_table=true
    for table in "${TABLE_ARRAY[@]}"; do
        if [ -n "$table" ]; then
            if [ "$first_table" = true ]; then
                first_table=false
            else
                echo ","
            fi
            echo -n "    \"$table\": $(cat "$TEMP_DIR/$table.json" | sed 's/^ *//' | tr -d '\n')"
        fi
    done
    
    echo ""
    echo "  }"
    echo "}"
} > "$BACKUP_FILE"

echo "$GREEN✅ Database backup complete: $BACKUP_FILE$NC"
echo "$YELLOW📊 Backup size: $(du -h "$BACKUP_FILE" | cut -f1)$NC"

echo "$GREEN✅ Database backup complete: $BACKUP_FILE$NC"
echo "$YELLOW📊 Backup size: $(du -h "$BACKUP_FILE" | cut -f1)$NC"
