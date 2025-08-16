#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# scripts/backup-restore-cycle.sh - Full backup and restore cycle
# ────────────────────────────────────────────────────────────────────────────

set -e

source ./scripts/colors.sh

REMOTE_USER_HOST=$1

if [ -z "$REMOTE_USER_HOST" ]; then
    echo "$RED❌ Missing required argument: REMOTE_USER_HOST$NC"
    exit 1
fi

echo "$YELLOW🔄 Starting backup-restore cycle...$NC"

# Generate timestamped backup filename
BACKUP_FILE="backups/cycle_backup_$(date +%Y%m%d_%H%M%S).json"

# Step 1: Create backup
echo "$YELLOW📦 Step 1: Creating backup...$NC"
./scripts/backup-db.sh $REMOTE_USER_HOST $BACKUP_FILE

# Step 2: Restore from the backup we just created
echo "$YELLOW🔄 Step 2: Restoring from backup...$NC"
./scripts/restore-db.sh $REMOTE_USER_HOST $BACKUP_FILE

echo "$GREEN✅ Backup-restore cycle complete$NC"
echo "$YELLOW📁 Backup file: $BACKUP_FILE$NC"
