#!/usr/bin/env python3
"""
Production Database Backup Script

This script extracts all data from the production database and saves it
as JSON files that can be imported into a fresh database.

Usage:
    python backup_production_data.py --db-url <database_url> --output-dir <backup_dir>
    
Example:
    python backup_production_data.py --db-url "postgresql+asyncpg://user:pass@host:5432/db" --output-dir ./backup
"""

import argparse
import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

import asyncpg
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine


class ProductionBackup:
    """Handles backup of production database data."""
    
    def __init__(self, database_url: str, output_dir: str):
        self.database_url = database_url
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Create engine
        self.engine = create_async_engine(database_url, echo=False)
        
        # Tables to backup in dependency order (users first, then dependent tables)
        self.tables = [
            "users",
            "documents", 
            "custom_dictionaries",
            "document_recovery",
            "alembic_version"  # Include migration version
        ]
    
    async def backup_all_data(self) -> Dict[str, Any]:
        """Backup all data from all tables."""
        backup_data = {
            "backup_timestamp": datetime.now(timezone.utc).isoformat(),
            "database_url": self.database_url.split("@")[1] if "@" in self.database_url else "hidden",
            "tables": {}
        }
        
        async with AsyncSession(self.engine) as session:
            for table_name in self.tables:
                print(f"Backing up table: {table_name}")
                try:
                    table_data = await self._backup_table(session, table_name)
                    backup_data["tables"][table_name] = table_data
                    print(f"  ✓ Backed up {len(table_data)} rows from {table_name}")
                except Exception as e:
                    print(f"  ✗ Error backing up {table_name}: {e}")
                    backup_data["tables"][table_name] = {"error": str(e), "data": []}
        
        return backup_data
    
    async def _backup_table(self, session: AsyncSession, table_name: str) -> List[Dict[str, Any]]:
        """Backup data from a single table."""
        # Get table structure first
        structure_query = text(f"""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = '{table_name}'
            ORDER BY ordinal_position
        """)
        
        result = await session.execute(structure_query)
        columns_info = result.fetchall()
        
        if not columns_info:
            return []
        
        # Get all data from table
        # Special handling for alembic_version which doesn't have an id column
        if table_name == "alembic_version":
            data_query = text(f"SELECT * FROM {table_name}")
        else:
            data_query = text(f"SELECT * FROM {table_name} ORDER BY id")
        result = await session.execute(data_query)
        rows = result.fetchall()
        
        # Convert rows to dictionaries
        table_data = []
        for row in rows:
            row_dict = {}
            for i, (column_name, data_type, is_nullable, column_default) in enumerate(columns_info):
                value = row[i]
                # Convert datetime objects to ISO strings
                if value is not None and hasattr(value, 'isoformat'):
                    value = value.isoformat()
                row_dict[column_name] = value
            table_data.append(row_dict)
        
        return table_data
    
    async def save_backup(self, backup_data: Dict[str, Any]) -> str:
        """Save backup data to files."""
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        
        # Save complete backup as single JSON file
        backup_file = self.output_dir / f"production_backup_{timestamp}.json"
        with open(backup_file, 'w', encoding='utf-8') as f:
            json.dump(backup_data, f, indent=2, ensure_ascii=False)
        
        # Also save each table separately for easier inspection
        tables_dir = self.output_dir / f"tables_{timestamp}"
        tables_dir.mkdir(exist_ok=True)
        
        for table_name, table_info in backup_data["tables"].items():
            table_file = tables_dir / f"{table_name}.json"
            with open(table_file, 'w', encoding='utf-8') as f:
                json.dump(table_info, f, indent=2, ensure_ascii=False)
        
        # Create a summary file
        summary = {
            "backup_timestamp": backup_data["backup_timestamp"],
            "database_url": backup_data["database_url"],
            "total_tables": len(backup_data["tables"]),
            "table_summary": {}
        }
        
        for table_name, table_info in backup_data["tables"].items():
            if "error" in table_info:
                summary["table_summary"][table_name] = {"status": "error", "error": table_info["error"]}
            else:
                summary["table_summary"][table_name] = {"status": "success", "row_count": len(table_info)}
        
        summary_file = self.output_dir / f"backup_summary_{timestamp}.json"
        with open(summary_file, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)
        
        print("\n✅ Backup completed!")
        print(f"📁 Main backup file: {backup_file}")
        print(f"📁 Individual tables: {tables_dir}")
        print(f"📁 Summary: {summary_file}")
        
        return str(backup_file)
    
    async def close(self):
        """Close database connections."""
        await self.engine.dispose()


async def main():
    parser = argparse.ArgumentParser(description="Backup production database data")
    parser.add_argument("--db-url", required=True, help="Database URL (e.g., postgresql+asyncpg://user:pass@host:5432/db)")
    parser.add_argument("--output-dir", default="./backup", help="Output directory for backup files")
    
    args = parser.parse_args()
    
    backup = ProductionBackup(args.db_url, args.output_dir)
    
    try:
        print("🔄 Starting production database backup...")
        backup_data = await backup.backup_all_data()
        await backup.save_backup(backup_data)
    except Exception as e:
        print(f"❌ Backup failed: {e}")
        raise
    finally:
        await backup.close()


if __name__ == "__main__":
    asyncio.run(main())
