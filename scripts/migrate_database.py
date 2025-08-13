#!/usr/bin/env python3
"""
Database Migration Helper Script

This script helps with backing up production data and restoring it to a new database.

Usage:
    # Backup production data
    python migrate_database.py backup --prod-url <prod_db_url> --output-dir ./backup

    # Restore to new database (make sure migrations are run first!)
    python migrate_database.py restore --target-url <new_db_url> --backup-file <backup.json>

    # Full migration (backup from prod, restore to new)
    python migrate_database.py migrate --prod-url <prod_db_url> --target-url <new_db_url> --backup-dir ./backup
"""

import argparse
import asyncio
import sys
from pathlib import Path

# Add the scripts directory to Python path so we can import our modules
sys.path.append(str(Path(__file__).parent))

from backup_production_data import ProductionBackup
from restore_production_data import ProductionRestore


async def backup_command(args):
    """Handle backup command."""
    print(f"🔄 Backing up production database...")
    print(f"📍 Source: {args.prod_url.split('@')[1] if '@' in args.prod_url else 'hidden'}")
    print(f"📁 Output: {args.output_dir}")
    
    backup = ProductionBackup(args.prod_url, args.output_dir)
    try:
        backup_data = await backup.backup_all_data()
        backup_file = await backup.save_backup(backup_data)
        print(f"\n✅ Backup completed successfully!")
        print(f"📄 Backup file: {backup_file}")
        return backup_file
    finally:
        await backup.close()


async def restore_command(args):
    """Handle restore command."""
    print(f"🔄 Restoring database from backup...")
    print(f"📄 Source: {args.backup_file}")
    print(f"📍 Target: {args.target_url.split('@')[1] if '@' in args.target_url else 'hidden'}")
    
    restore = ProductionRestore(args.target_url, args.backup_file)
    try:
        restore_summary = await restore.restore_all_data(clear_existing=args.clear)
        if restore_summary.get("status") != "cancelled":
            await restore.save_restore_summary(restore_summary)
            print(f"\n✅ Restore completed successfully!")
    finally:
        await restore.close()


async def migrate_command(args):
    """Handle full migration command."""
    print(f"🔄 Starting full database migration...")
    
    # Step 1: Backup production
    print(f"\n📦 Step 1: Backing up production database...")
    backup = ProductionBackup(args.prod_url, args.backup_dir)
    try:
        backup_data = await backup.backup_all_data()
        backup_file = await backup.save_backup(backup_data)
        print(f"✅ Backup completed: {backup_file}")
    finally:
        await backup.close()
    
    # Step 2: Restore to target
    print(f"\n📥 Step 2: Restoring to target database...")
    restore = ProductionRestore(args.target_url, backup_file)
    try:
        restore_summary = await restore.restore_all_data(clear_existing=True)
        if restore_summary.get("status") != "cancelled":
            await restore.save_restore_summary(restore_summary)
            print(f"✅ Restore completed!")
    finally:
        await restore.close()
    
    print(f"\n🎉 Database migration completed successfully!")
    print(f"📄 Backup file: {backup_file}")


def main():
    parser = argparse.ArgumentParser(description="Database migration helper")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # Backup command
    backup_parser = subparsers.add_parser("backup", help="Backup production database")
    backup_parser.add_argument("--prod-url", required=True, help="Production database URL")
    backup_parser.add_argument("--output-dir", default="./backup", help="Output directory for backup")
    
    # Restore command
    restore_parser = subparsers.add_parser("restore", help="Restore database from backup")
    restore_parser.add_argument("--target-url", required=True, help="Target database URL")
    restore_parser.add_argument("--backup-file", required=True, help="Backup file to restore")
    restore_parser.add_argument("--clear", action="store_true", help="Clear existing data without prompting")
    
    # Full migration command
    migrate_parser = subparsers.add_parser("migrate", help="Full migration (backup + restore)")
    migrate_parser.add_argument("--prod-url", required=True, help="Production database URL")
    migrate_parser.add_argument("--target-url", required=True, help="Target database URL")
    migrate_parser.add_argument("--backup-dir", default="./backup", help="Directory for backup files")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    try:
        if args.command == "backup":
            asyncio.run(backup_command(args))
        elif args.command == "restore":
            asyncio.run(restore_command(args))
        elif args.command == "migrate":
            asyncio.run(migrate_command(args))
    except KeyboardInterrupt:
        print("\n❌ Operation cancelled by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
