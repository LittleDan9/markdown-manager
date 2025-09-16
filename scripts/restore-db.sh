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
export DATABASE_URL="$LOCAL_DB_URL"

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

# Restore tables in dependency order
echo "$YELLOW📥 Parsing backup file to get available tables...$NC"

# Get all tables from backup file
BACKUP_TABLES=$(jq -r '.tables | keys[]' "$BACKUP_FILE" 2>/dev/null || echo "")

if [ -z "$BACKUP_TABLES" ]; then
    echo "$RED❌ No tables found in backup file or invalid JSON format$NC"
    exit 1
fi

echo "$YELLOW📊 Found tables in backup: $(echo $BACKUP_TABLES | tr '\n' ' ')$NC"

# Define table restore order based on foreign key dependencies
# Tables with no dependencies first, then dependent tables
RESTORE_ORDER=(
    "users"                 # No dependencies (but has self-reference to documents)
    "icon_packs"           # No dependencies
    "categories"           # Depends on users
    "github_accounts"      # Depends on users  
    "github_repositories"  # Depends on github_accounts
    "documents"            # Depends on users, categories, github_repositories
    "custom_dictionaries"  # Depends on users, categories
    "github_sync_history"  # Depends on documents, github_repositories
    "icon_metadata"        # Depends on icon_packs
)

# Get tables that exist in backup but not in our predefined order
BACKUP_ARRAY=($BACKUP_TABLES)
EXTRA_TABLES=()
for table in "${BACKUP_ARRAY[@]}"; do
    found=false
    for ordered_table in "${RESTORE_ORDER[@]}"; do
        if [ "$table" = "$ordered_table" ]; then
            found=true
            break
        fi
    done
    if [ "$found" = false ]; then
        EXTRA_TABLES+=("$table")
    fi
done

# Add any extra tables at the end
if [ ${#EXTRA_TABLES[@]} -gt 0 ]; then
    echo "$YELLOW⚠️ Found additional tables not in predefined order: ${EXTRA_TABLES[*]}$NC"
    echo "$YELLOW⚠️ These will be restored last and may fail if dependencies aren't met$NC"
    RESTORE_ORDER+=("${EXTRA_TABLES[@]}")
fi

# Special handling for users table due to self-reference to documents
echo "$YELLOW🔧 Temporarily disabling foreign key constraints for users table...$NC"
psql "$LOCAL_DB_URL" -c "ALTER TABLE users DROP CONSTRAINT IF EXISTS users_current_doc_id_fkey;"

# Restore tables in dependency order
for table in "${RESTORE_ORDER[@]}"; do
    # Check if table exists in backup
    table_data=$(jq -r ".tables.$table" "$BACKUP_FILE" 2>/dev/null || echo "null")
    
    if [ "$table_data" != "null" ] && [ "$table_data" != "[]" ] && [ -n "$table_data" ]; then
        echo "$YELLOW📥 Restoring $table table...$NC"
        
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
                    echo "INSERT INTO \"$table\" SELECT * FROM json_populate_record(NULL::\"$table\", '$escaped_row');" >> "$TEMP_DIR/$table.sql"
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
        echo "$YELLOW⚠️ Table $table is empty, null, or missing in backup$NC"
    fi
done

# Restore users table foreign key constraint
echo "$YELLOW� Restoring foreign key constraints...$NC"
psql "$LOCAL_DB_URL" -c "
    ALTER TABLE users 
    ADD CONSTRAINT users_current_doc_id_fkey 
    FOREIGN KEY (current_doc_id) REFERENCES documents(id);
" 2>/dev/null || echo "$YELLOW⚠️ Could not restore users_current_doc_id_fkey constraint (this is normal if no documents exist)$NC"

# Update sequences to prevent ID conflicts - dynamically discover sequences
echo "$YELLOW🔄 Updating sequences...$NC"
SEQUENCES=$(psql "$LOCAL_DB_URL" -t -c "
    SELECT sequence_name
    FROM information_schema.sequences 
    WHERE sequence_schema = 'public';
" | tr -d ' ' | grep -v '^$' | tr '\n' ' ')

if [ -n "$SEQUENCES" ]; then
    IFS=' ' read -ra SEQUENCE_ARRAY <<< "$SEQUENCES"
    for seq in "${SEQUENCE_ARRAY[@]}"; do
        if [ -n "$seq" ]; then
            # Get table and column name from sequence name (assuming standard naming)
            table_name=$(echo "$seq" | sed 's/_id_seq$//')
            if [ "$table_name" != "$seq" ]; then
                echo "$YELLOW🔄 Updating sequence: $seq for table: $table_name$NC"
                psql "$LOCAL_DB_URL" -c "
                    SELECT setval('$seq', COALESCE(MAX(id), 1)) FROM \"$table_name\";
                " 2>/dev/null || echo "$YELLOW⚠️ Could not update sequence $seq$NC"
            fi
        fi
    done
else
    echo "$YELLOW⚠️ No sequences found to update$NC"
fi

echo "$GREEN✅ Database restore complete$NC"

# Show restore summary
echo "$YELLOW📊 Restore Summary:$NC"

# Get all tables that actually exist in the database now
EXISTING_TABLES=$(psql "$LOCAL_DB_URL" -t -c "
    SELECT table_name
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name != 'alembic_version'
    ORDER BY table_name;
" | tr -d ' ' | grep -v '^$' | tr '\n' ' ')

if [ -n "$EXISTING_TABLES" ]; then
    IFS=' ' read -ra TABLE_ARRAY <<< "$EXISTING_TABLES"
    
    # Build dynamic query to show counts for all tables
    UNION_QUERIES=()
    for table in "${TABLE_ARRAY[@]}"; do
        if [ -n "$table" ]; then
            UNION_QUERIES+=("SELECT '$table' as table_name, COUNT(*) as records FROM \"$table\"")
        fi
    done
    
    if [ ${#UNION_QUERIES[@]} -gt 0 ]; then
        # Join queries with UNION ALL
        FULL_QUERY=$(printf " UNION ALL %s" "${UNION_QUERIES[@]}")
        FULL_QUERY=${FULL_QUERY# UNION ALL }  # Remove leading "UNION ALL"
        FULL_QUERY="$FULL_QUERY ORDER BY table_name;"
        
        psql "$LOCAL_DB_URL" -c "$FULL_QUERY"
    else
        echo "$YELLOW⚠️ No tables found to summarize$NC"
    fi
else
    echo "$YELLOW⚠️ No tables found in database$NC"
fi
