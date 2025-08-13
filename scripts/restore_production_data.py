#!/usr/bin/env python3
"""
Production Database Restore Script

This script restores data from backup JSON files into a fresh database.
The target database should already have the correct schema (run migrations first).

Usage:
    python restore_production_data.py --db-url <database_url> --backup-file <backup.json>
    
Example:
    python restore_production_data.py --db-url "postgresql+asyncpg://user:pass@host:5432/db" --backup-file ./backup/production_backup_20250812_120000.json
"""

import argparse
import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine


class ProductionRestore:
    """Handles restore of production database data."""
    
    def __init__(self, database_url: str, backup_file: str):
        self.database_url = database_url
        self.backup_file = Path(backup_file)
        
        if not self.backup_file.exists():
            raise FileNotFoundError(f"Backup file not found: {backup_file}")
        
        # Create engine
        self.engine = create_async_engine(database_url, echo=False)
        
        # Load backup data
        with open(self.backup_file, 'r', encoding='utf-8') as f:
            self.backup_data = json.load(f)
        
        # Tables to restore in dependency order (users first, then dependent tables)
        self.restore_order = [
            "users",
            "documents",
            "custom_dictionaries", 
            "document_recovery"
            # Skip alembic_version as it should already be set
        ]
    
    async def verify_database_empty(self) -> bool:
        """Verify that the target database is empty (or only has schema)."""
        async with AsyncSession(self.engine) as session:
            for table_name in self.restore_order:
                count_query = text(f"SELECT COUNT(*) FROM {table_name}")
                result = await session.execute(count_query)
                count = result.scalar()
                if count > 0:
                    print(f"⚠️  Warning: Table '{table_name}' already contains {count} rows")
                    return False
        return True
    
    async def clear_all_tables(self) -> None:
        """Clear all data from tables (in reverse dependency order)."""
        print("🗑️  Clearing existing data...")
        
        async with AsyncSession(self.engine) as session:
            # Clear in reverse order to handle foreign key constraints
            for table_name in reversed(self.restore_order):
                try:
                    # Disable foreign key checks temporarily
                    await session.execute(text("SET session_replication_role = replica"))
                    
                    delete_query = text(f"DELETE FROM {table_name}")
                    result = await session.execute(delete_query)
                    print(f"  ✓ Cleared {result.rowcount} rows from {table_name}")
                    
                    # Reset sequences to start from 1
                    sequence_query = text(f"SELECT setval(pg_get_serial_sequence('{table_name}', 'id'), 1, false)")
                    await session.execute(sequence_query)
                    
                except Exception as e:
                    print(f"  ⚠️  Warning clearing {table_name}: {e}")
            
            # Re-enable foreign key checks
            await session.execute(text("SET session_replication_role = DEFAULT"))
            await session.commit()
    
    async def restore_all_data(self, clear_existing: bool = False) -> Dict[str, Any]:
        """Restore all data from backup."""
        if clear_existing:
            await self.clear_all_tables()
        else:
            is_empty = await self.verify_database_empty()
            if not is_empty:
                response = input("Database contains data. Clear it? (y/N): ")
                if response.lower() == 'y':
                    await self.clear_all_tables()
                else:
                    print("❌ Restore cancelled. Database must be empty.")
                    return {"status": "cancelled"}
        
        restore_summary = {
            "restore_timestamp": datetime.utcnow().isoformat(),
            "backup_file": str(self.backup_file),
            "backup_timestamp": self.backup_data.get("backup_timestamp"),
            "tables_restored": {}
        }
        
        async with AsyncSession(self.engine) as session:
            # Temporarily disable foreign key constraints
            await session.execute(text("SET session_replication_role = replica"))
            
            try:
                for table_name in self.restore_order:
                    if table_name not in self.backup_data["tables"]:
                        print(f"⚠️  Table {table_name} not found in backup, skipping")
                        continue
                    
                    table_data = self.backup_data["tables"][table_name]
                    if "error" in table_data:
                        print(f"⚠️  Table {table_name} had backup error, skipping: {table_data['error']}")
                        continue
                    
                    if not table_data:  # Empty list
                        print(f"📝 Table {table_name} is empty, skipping")
                        restore_summary["tables_restored"][table_name] = {"status": "empty", "rows": 0}
                        continue
                    
                    print(f"📥 Restoring table: {table_name}")
                    rows_restored = await self._restore_table(session, table_name, table_data)
                    restore_summary["tables_restored"][table_name] = {"status": "success", "rows": rows_restored}
                    print(f"  ✓ Restored {rows_restored} rows to {table_name}")
                
                # Re-enable foreign key constraints
                await session.execute(text("SET session_replication_role = DEFAULT"))
                await session.commit()
                
            except Exception as e:
                await session.rollback()
                await session.execute(text("SET session_replication_role = DEFAULT"))
                raise e
        
        return restore_summary
    
    async def _restore_table(self, session: AsyncSession, table_name: str, table_data: List[Dict[str, Any]]) -> int:
        """Restore data to a single table."""
        if not table_data:
            return 0
        
        # Get column names from the first row
        columns = list(table_data[0].keys())
        columns_str = ", ".join(columns)
        
        # Create placeholders for values
        placeholders = ", ".join(f":{col}" for col in columns)
        
        # Prepare insert query
        insert_query = text(f"INSERT INTO {table_name} ({columns_str}) VALUES ({placeholders})")
        
        # Insert data in batches
        batch_size = 100
        total_rows = 0
        
        for i in range(0, len(table_data), batch_size):
            batch = table_data[i:i + batch_size]
            
            # Convert datetime strings back to datetime objects if needed
            processed_batch = []
            for row in batch:
                processed_row = {}
                for key, value in row.items():
                    # Try to parse ISO datetime strings
                    if isinstance(value, str) and 'T' in value and value.endswith('Z'):
                        try:
                            from datetime import datetime
                            processed_row[key] = datetime.fromisoformat(value.replace('Z', '+00:00'))
                        except ValueError:
                            processed_row[key] = value
                    else:
                        processed_row[key] = value
                processed_batch.append(processed_row)
            
            await session.execute(insert_query, processed_batch)
            total_rows += len(batch)
        
        return total_rows
    
    async def save_restore_summary(self, restore_summary: Dict[str, Any]) -> str:
        """Save restore summary to file."""
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        summary_file = self.backup_file.parent / f"restore_summary_{timestamp}.json"
        
        with open(summary_file, 'w', encoding='utf-8') as f:
            json.dump(restore_summary, f, indent=2, ensure_ascii=False)
        
        print(f"\n✅ Restore completed!")
        print(f"📁 Restore summary: {summary_file}")
        
        # Print summary
        total_rows = sum(
            info["rows"] for info in restore_summary["tables_restored"].values()
            if info["status"] == "success"
        )
        print(f"📊 Total rows restored: {total_rows}")
        
        return str(summary_file)
    
    async def close(self):
        """Close database connections."""
        await self.engine.dispose()


async def main():
    parser = argparse.ArgumentParser(description="Restore production database data")
    parser.add_argument("--db-url", required=True, help="Target database URL")
    parser.add_argument("--backup-file", required=True, help="Backup JSON file to restore")
    parser.add_argument("--clear", action="store_true", help="Clear existing data without prompting")
    
    args = parser.parse_args()
    
    restore = ProductionRestore(args.db_url, args.backup_file)
    
    try:
        print("🔄 Starting production database restore...")
        restore_summary = await restore.restore_all_data(clear_existing=args.clear)
        
        if restore_summary.get("status") != "cancelled":
            await restore.save_restore_summary(restore_summary)
    except Exception as e:
        print(f"❌ Restore failed: {e}")
        raise
    finally:
        await restore.close()


if __name__ == "__main__":
    asyncio.run(main())
