#!/usr/bin/env bash
set -e

REMOTE_USER_HOST=${1:-dlittle@10.0.1.51}
KEY=~/.ssh/id_danbian

source ./scripts/colors.sh

echo "$BLUE📋 Remote host: $REMOTE_USER_HOST$NC"

# Check if remote host is accessible
echo "$YELLOW🔍 Checking remote host connectivity...$NC"
if ! ssh -q -T -i "$KEY" "$REMOTE_USER_HOST" "echo 'Connection successful'"; then
    echo "$RED❌ Cannot connect to remote host$NC"
    exit 1
else
    echo "$GREEN✅ Remote host accessible$NC"
fi

echo "$YELLOW🧹 Cleaning up nginx backup files on remote server...$NC"

ssh -q -T -i $KEY $REMOTE_USER_HOST 'bash -s' << 'EOH'
  set -e

  cd /etc/nginx/sites-available/

  # Count current backup files
  BACKUP_COUNT=$(ls -1t littledan.com.conf.backup.* 2>/dev/null | wc -l || echo "0")
  echo "📊 Found $BACKUP_COUNT backup files"

  if [ "$BACKUP_COUNT" -gt 3 ]; then
    echo "🗑️  Removing $((BACKUP_COUNT - 3)) old backup files..."
    
    # List files that will be removed
    echo "Files to be removed:"
    ls -1t littledan.com.conf.backup.* | tail -n +4
    
    # Remove old backups (keep 3 most recent)
    ls -1t littledan.com.conf.backup.* | tail -n +4 | sudo xargs rm -f
    
    NEW_COUNT=$(ls -1t littledan.com.conf.backup.* 2>/dev/null | wc -l || echo "0")
    echo "✅ Cleanup complete. Removed $((BACKUP_COUNT - NEW_COUNT)) files, $NEW_COUNT backups remaining"
    
    echo "📋 Remaining backup files:"
    ls -la littledan.com.conf.backup.* 2>/dev/null || echo "No backup files found"
  else
    echo "✅ No cleanup needed. Only $BACKUP_COUNT backup files found (keeping up to 3)"
    if [ "$BACKUP_COUNT" -gt 0 ]; then
      echo "📋 Current backup files:"
      ls -la littledan.com.conf.backup.* 2>/dev/null
    fi
  fi
EOH

echo "$GREEN✅ Nginx backup cleanup complete$NC"
