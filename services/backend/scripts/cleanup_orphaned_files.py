#!/usr/bin/env python3
"""
Cleanup script to remove orphaned filesystem files.
This implements Database-First approach where only files with database entries should exist.
"""

import asyncio
import logging
from pathlib import Path
from typing import List, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

from app.models.document import Document

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class OrphanedFileCleanup:
    """Service to cleanup orphaned files from filesystem."""
    
    def __init__(self):
        # Use local storage path and database
        self.storage_root = Path("/home/dlittle/code/markdown-manager/storage")
        # Create database engine for localhost
        database_url = "postgresql+asyncpg://postgres:postgres@localhost:5432/markdown_manager"
        self.engine = create_async_engine(database_url)
    
    def get_user_directory(self, user_id: int) -> Path:
        """Get the user's storage directory."""
        return self.storage_root / str(user_id)
    
    async def find_orphaned_files(self, user_id: int) -> Tuple[List[str], List[str]]:
        """
        Find files that exist on filesystem but not in database.
        
        Returns:
            Tuple of (orphaned_files, valid_files)
        """
        async with AsyncSession(self.engine) as db:
            # Get all file_path entries from database for this user
            result = await db.execute(
                select(Document.file_path).where(
                    Document.user_id == user_id,
                    Document.file_path.isnot(None)
                )
            )
            database_file_paths = {row[0] for row in result.fetchall()}
            
            logger.info(f"Found {len(database_file_paths)} file paths in database for user {user_id}")
            
            # Scan filesystem for all .md files
            user_dir = self.get_user_directory(user_id)
            if not user_dir.exists():
                logger.warning(f"User directory {user_dir} does not exist")
                return [], []
            
            filesystem_files = []
            for md_file in user_dir.rglob("*.md"):
                # Get relative path from user directory
                relative_path = str(md_file.relative_to(user_dir))
                filesystem_files.append(relative_path)
            
            logger.info(f"Found {len(filesystem_files)} .md files on filesystem for user {user_id}")
            
            # Find orphaned files (exist on filesystem but not in database)
            orphaned_files = []
            valid_files = []
            
            for file_path in filesystem_files:
                if file_path in database_file_paths:
                    valid_files.append(file_path)
                else:
                    orphaned_files.append(file_path)
            
            logger.info(f"Found {len(orphaned_files)} orphaned files")
            logger.info(f"Found {len(valid_files)} valid files")
            
            if orphaned_files:
                logger.info("Orphaned files:")
                for file_path in orphaned_files:
                    logger.info(f"  - {file_path}")
            
            return orphaned_files, valid_files
    
    async def cleanup_orphaned_files(self, user_id: int, dry_run: bool = True) -> bool:
        """
        Remove orphaned files from filesystem.
        
        Args:
            user_id: User ID to cleanup
            dry_run: If True, only report what would be deleted
            
        Returns:
            True if successful
        """
        try:
            orphaned_files, valid_files = await self.find_orphaned_files(user_id)
            
            if not orphaned_files:
                logger.info("No orphaned files found")
                return True
            
            if dry_run:
                logger.info(f"DRY RUN: Would delete {len(orphaned_files)} orphaned files:")
                for file_path in orphaned_files:
                    logger.info(f"  - {file_path}")
                return True
            
            # Actually delete orphaned files
            user_dir = self.get_user_directory(user_id)
            deleted_count = 0
            
            for file_path in orphaned_files:
                full_path = user_dir / file_path
                try:
                    if full_path.exists():
                        full_path.unlink()
                        deleted_count += 1
                        logger.info(f"Deleted: {file_path}")
                    else:
                        logger.warning(f"File not found: {file_path}")
                except Exception as e:
                    logger.error(f"Failed to delete {file_path}: {e}")
            
            # Clean up empty directories
            await self._cleanup_empty_directories(user_dir)
            
            logger.info(f"Successfully deleted {deleted_count} orphaned files")
            return True
            
        except Exception as e:
            logger.error(f"Failed to cleanup orphaned files for user {user_id}: {e}")
            return False
    
    async def _cleanup_empty_directories(self, base_path: Path):
        """Remove empty directories recursively."""
        try:
            for dir_path in sorted(base_path.rglob("*"), key=lambda p: len(p.parts), reverse=True):
                if dir_path.is_dir() and not any(dir_path.iterdir()):
                    # Don't delete the base user directory or git directories
                    if dir_path != base_path and ".git" not in dir_path.parts:
                        try:
                            dir_path.rmdir()
                            logger.info(f"Removed empty directory: {dir_path.relative_to(base_path)}")
                        except OSError:
                            # Directory not empty, which is fine
                            pass
        except Exception as e:
            logger.error(f"Failed to cleanup empty directories: {e}")
    
    async def find_missing_filesystem_files(self, user_id: int) -> List[str]:
        """
        Find database entries that don't have corresponding filesystem files.
        These indicate data corruption or incomplete operations.
        """
        async with AsyncSession(self.engine) as db:
            # Get all file_path entries from database for this user
            result = await db.execute(
                select(Document.id, Document.file_path, Document.name).where(
                    Document.user_id == user_id,
                    Document.file_path.isnot(None)
                )
            )
            database_entries = result.fetchall()
            
            user_dir = self.get_user_directory(user_id)
            missing_files = []
            
            for doc_id, file_path, name in database_entries:
                full_path = user_dir / file_path
                if not full_path.exists():
                    missing_files.append({
                        'doc_id': doc_id,
                        'file_path': file_path,
                        'name': name
                    })
            
            if missing_files:
                logger.warning(f"Found {len(missing_files)} database entries with missing filesystem files:")
                for entry in missing_files:
                    logger.warning(f"  Doc ID {entry['doc_id']}: {entry['file_path']} ({entry['name']})")
            
            return missing_files


async def main():
    """Main cleanup script."""
    cleanup = OrphanedFileCleanup()
    
    # Check specific user mentioned in issue
    user_id = 7
    
    logger.info(f"Starting orphaned file cleanup for user {user_id}")
    
    # First, run in dry-run mode to see what would be cleaned
    logger.info("=== DRY RUN ===")
    await cleanup.cleanup_orphaned_files(user_id, dry_run=True)
    
    # Check for missing filesystem files
    logger.info("=== CHECKING FOR MISSING FILESYSTEM FILES ===")
    await cleanup.find_missing_filesystem_files(user_id)
    
    # Uncomment the line below to actually perform cleanup
    logger.info("=== ACTUAL CLEANUP ===")
    await cleanup.cleanup_orphaned_files(user_id, dry_run=False)


if __name__ == "__main__":
    asyncio.run(main())