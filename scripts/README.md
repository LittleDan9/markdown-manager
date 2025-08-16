# Database Migration Scripts

This directory contains scripts to backup and restore production data when migrating between databases or database schemas.

## Files

- `backup_production_data.py` - Extracts all data from a database to JSON files
- `restore_production_data.py` - Restores data from JSON backup files to a database  
- `migrate_database.py` - Wrapper script for common migration workflows

## Prerequisites

These scripts require the backend Python environment with asyncpg and SQLAlchemy installed:

```bash
cd backend
poetry install
```

## Usage

### 1. Backup Production Data

Extract all data from your production database:

```bash
cd scripts
poetry run python backup_production_data.py \
  --db-url "postgresql+asyncpg://user:password@host:5432/database" \
  --output-dir ./backup
```

This creates:
- `production_backup_YYYYMMDD_HHMMSS.json` - Complete backup file
- `tables_YYYYMMDD_HHMMSS/` - Individual table files
- `backup_summary_YYYYMMDD_HHMMSS.json` - Summary report

### 2. Restore Data to New Database

**Important**: Run database migrations FIRST to create the schema:

```bash
# 1. Create schema with migrations
cd backend
alembic upgrade head

# 2. Then restore data
cd ../scripts
poetry run python restore_production_data.py \
  --db-url "postgresql+asyncpg://user:password@newhost:5432/database" \
  --backup-file ./backup/production_backup_20250812_120000.json
```

### 3. Full Migration (Backup + Restore)

```bash
cd scripts
poetry run python migrate_database.py migrate \
  --prod-url "postgresql+asyncpg://user:pass@oldhost:5432/olddb" \
  --target-url "postgresql+asyncpg://user:pass@newhost:5432/newdb" \
  --backup-dir ./backup
```

## Migration Workflow

When migrating to a new database system:

1. **Setup new database with schema**:
   ```bash
   cd backend
   alembic upgrade head  # Creates all tables
   ```

2. **Backup production data**:
   ```bash
   cd scripts
   poetry run python backup_production_data.py --db-url <PROD_URL> --output-dir ./backup
   ```

3. **Restore to new database**:
   ```bash
   poetry run python restore_production_data.py --db-url <NEW_URL> --backup-file <BACKUP_FILE>
   ```

4. **Verify data integrity**:
   - Check row counts match
   - Verify critical data is present
   - Test application functionality

## Safety Features

- **Dependency-aware restore**: Tables are restored in correct order (users first, then dependent tables)
- **Foreign key handling**: Temporarily disables FK constraints during restore
- **Empty database check**: Warns if target database contains data
- **Detailed logging**: Shows progress and any errors during backup/restore
- **Summary reports**: Creates detailed reports of what was backed up/restored

## Example Commands

### Backup from Docker Compose PostgreSQL
```bash
poetry run python backup_production_data.py \
  --db-url "postgresql+asyncpg://postgres:postgres@localhost:5432/markdown_manager" \
  --output-dir ./production_backup
```

### Restore to Local Development
```bash
# After running: alembic upgrade head
poetry run python restore_production_data.py \
  --db-url "postgresql+asyncpg://postgres:postgres@localhost:5432/markdown_manager" \
  --backup-file ./production_backup/production_backup_20250812_143022.json \
  --clear
```

## Troubleshooting

### Connection Issues
- Ensure database is accessible from your machine
- Check firewall rules and network connectivity
- Verify credentials and database name

### Permission Issues  
- Ensure database user has SELECT permissions for backup
- Ensure database user has INSERT/DELETE permissions for restore
- May need SUPERUSER for disabling foreign key constraints

### Schema Mismatches
- Always run `alembic upgrade head` before restoring
- Check that backup was created from compatible schema version
- Review alembic_version table in backup to verify compatibility

## Data Format

Backup files are JSON with this structure:
```json
{
  "backup_timestamp": "2025-08-12T14:30:22.123456",
  "database_url": "host:5432/database", 
  "tables": {
    "users": [
      {"id": 1, "email": "user@example.com", "created_at": "2025-01-01T00:00:00"},
      ...
    ],
    "documents": [...],
    ...
  }
}
```

Individual table files contain just the array of records for that table.
