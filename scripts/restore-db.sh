#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# scripts/restore-db.sh - Restore production database from backup
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

if [ -z "$REMOTE_USER_HOST" ] || [ -z "$BACKUP_FILE" ]; then
    echo "$RED❌ Missing required arguments: REMOTE_USER_HOST, BACKUP_FILE$NC"
    exit 1
fi

# Convert relative path to absolute path
if [[ ! "$BACKUP_FILE" =~ ^/ ]]; then
    BACKUP_FILE="$PROJECT_ROOT/$BACKUP_FILE"
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "$RED❌ Backup file not found: $BACKUP_FILE$NC"
    exit 1
fi

echo "$YELLOW🔄 Starting database restore from $BACKUP_FILE...$NC"

# Parse remote database config and setup port forwarding
parse_remote_db_env $REMOTE_USER_HOST
setup_port_forward $REMOTE_USER_HOST

# Get local connection string
LOCAL_DB_URL=$(get_local_db_url)

# Set environment variable for alembic to use forwarded connection
export ALEMBIC_DATABASE_URL="$LOCAL_DB_URL"

echo "$YELLOW📦 Installing backend dependencies...$NC"
cd "$PROJECT_ROOT/backend" && poetry lock && poetry install --no-root && cd "$PROJECT_ROOT"

echo "$YELLOW🗃️ Running alembic upgrade head...$NC"
cd "$PROJECT_ROOT/backend" && poetry run alembic upgrade head && cd "$PROJECT_ROOT"

echo "$YELLOW📥 Parsing backup file...$NC"

# Create temporary directory for SQL files
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Option 1: Complete schema reset (cleaner approach)
echo "$YELLOW🧹 Resetting database schema...$NC"
psql "$LOCAL_DB_URL" -c "
-- Drop all tables (this will cascade and remove all data)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Restore standard grants
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Ensure the database user exists and has the correct password
DO \$\$
BEGIN
    -- Create user if it doesn't exist, or alter password if it does
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$DB_USER') THEN
        CREATE USER \"$DB_USER\" WITH PASSWORD '$DB_PASS';
    ELSE
        ALTER USER \"$DB_USER\" WITH PASSWORD '$DB_PASS';
    END IF;
END
\$\$;

-- Grant permissions to the application database user
GRANT USAGE ON SCHEMA public TO \"$DB_USER\";
GRANT CREATE ON SCHEMA public TO \"$DB_USER\";
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO \"$DB_USER\";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO \"$DB_USER\";

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO \"$DB_USER\";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO \"$DB_USER\";
"

# Re-run migrations to recreate clean schema
echo "$YELLOW🔧 Recreating database schema...$NC"
cd "$PROJECT_ROOT/backend" && poetry run alembic upgrade head && cd "$PROJECT_ROOT"

# Grant permissions on newly created tables and sequences
echo "$YELLOW🔐 Restoring database permissions...$NC"
psql "$LOCAL_DB_URL" -c "
-- Grant permissions on all existing tables and sequences
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO \"$DB_USER\";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO \"$DB_USER\";
"

# Restore tables in dependency order (removed alembic_version)
for table in users documents custom_dictionaries; do
    echo "$YELLOW📥 Restoring $table table...$NC"

    # Extract JSON array for table and check if it exists and is not null
    table_data=$(jq -r ".tables.$table" "$BACKUP_FILE")

    if [ "$table_data" != "null" ] && [ "$table_data" != "[]" ] && [ -n "$table_data" ]; then
        # Convert JSON array to individual JSON objects
        echo "$table_data" | jq -c '.[]' > "$TEMP_DIR/$table.json"

        # Check if we have actual data
        if [ -s "$TEMP_DIR/$table.json" ]; then
            # Convert each JSON object to INSERT statement
            > "$TEMP_DIR/$table.sql"  # Clear file

            while IFS= read -r row; do
                if [ -n "$row" ] && [ "$row" != "null" ]; then
                    # Escape single quotes in JSON for SQL
                    escaped_row=$(echo "$row" | sed "s/'/''/g")
                    echo "INSERT INTO $table SELECT * FROM json_populate_record(NULL::$table, '$escaped_row');" >> "$TEMP_DIR/$table.sql"
                fi
            done < "$TEMP_DIR/$table.json"

            # Execute SQL file if it has content
            if [ -s "$TEMP_DIR/$table.sql" ]; then
                psql "$LOCAL_DB_URL" -f "$TEMP_DIR/$table.sql"
                echo "$GREEN✅ Restored $table table$NC"
            else
                echo "$YELLOW⚠️ No valid data to restore for $table table$NC"
            fi
        else
            echo "$YELLOW⚠️ No data found for $table table in backup$NC"
        fi
    else
        echo "$YELLOW⚠️ Table $table is empty or null in backup$NC"
    fi
done

# Update sequences to prevent ID conflicts
echo "$YELLOW🔄 Updating sequences...$NC"
psql "$LOCAL_DB_URL" -c "
-- Reset all sequences based on actual data
SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE(MAX(id), 1)) FROM users;
SELECT setval(pg_get_serial_sequence('documents', 'id'), COALESCE(MAX(id), 1)) FROM documents;
SELECT setval(pg_get_serial_sequence('custom_dictionaries', 'id'), COALESCE(MAX(id), 1)) FROM custom_dictionaries;
SELECT setval(pg_get_serial_sequence('categories', 'id'), COALESCE(MAX(id), 1)) FROM categories;
"

echo "$GREEN✅ Database restore complete$NC"

# Show restore summary (fixed duplicate query)
echo "$YELLOW📊 Restore Summary:$NC"
psql "$LOCAL_DB_URL" -c "
SELECT
    'users' as table_name, COUNT(*) as records
FROM users
UNION ALL
SELECT
    'documents' as table_name, COUNT(*) as records
FROM documents
UNION ALL
SELECT
    'custom_dictionaries' as table_name, COUNT(*) as records
FROM custom_dictionaries
UNION ALL
SELECT
    'categories' as table_name, COUNT(*) as records
FROM categories;
"
