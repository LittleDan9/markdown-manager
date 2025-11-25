#!/usr/bin/env python3
"""
Filesystem Consistency Migration Script

This script fixes inconsistencies between the database records and filesystem locations
that may have occurred before the document update fix was implemented.

It uses the database as the source of truth and ensures the filesystem matches by:
1. Finding documents where file_path doesn't match current name/category
2. Moving/renaming files to match the database state
3. Updating file_path to reflect the correct location

Usage:
    python scripts/migrate_filesystem_consistency.py [--dry-run] [--user-id=123] [--limit=100]
"""

import asyncio
import argparse
import logging
from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any
import sys
import os

# Add the app directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import AsyncSessionLocal
from app.models.document import Document
from app.models.category import Category
from app.services.storage import UserStorage

logger = logging.getLogger(__name__)


class FilesystemConsistencyMigrator:
    """Migrates filesystem to match database records."""

    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.storage_service = UserStorage()
        self.stats = {
            'total_documents': 0,
            'inconsistent_documents': 0,
            'local_moves': 0,
            'github_renames': 0,
            'db_records_created': 0,
            'errors': 0,
            'skipped': 0
        }

    async def migrate_all_documents(self, user_id: Optional[int] = None, limit: Optional[int] = None, dry_run: bool = False) -> Dict[str, Any]:
        """Migrate all documents to fix filesystem consistency."""
        if dry_run:
            self.dry_run = dry_run

        async with AsyncSessionLocal() as session:
            try:
                # Build query
                query = select(Document).options(
                    selectinload(Document.category_ref)
                )

                if user_id:
                    query = query.filter(Document.user_id == user_id)
                    logger.info(f"Processing documents for user_id: {user_id}")

                if limit:
                    query = query.limit(limit)
                    logger.info(f"Limiting to {limit} documents")

                # Execute query
                result = await session.execute(query)
                documents = result.scalars().all()

                logger.info(f"Found {len(documents)} documents to process")
                self.stats['total_documents'] = len(documents)

                # Process each document
                for doc in documents:
                    await self._process_document(session, doc)

                # Commit all changes
                if not self.dry_run:
                    await session.commit()
                    logger.info("Database changes committed")

                self._print_stats()

                return {
                    'stats': self.stats,
                    'dry_run': self.dry_run
                }

            except Exception as e:
                logger.error(f"Error during migration: {e}")
                if not self.dry_run:
                    await session.rollback()
                raise
            finally:
                await session.close()

    async def _process_document(self, session: AsyncSession, document: Document):
        """Process a single document for filesystem consistency."""
        try:
            logger.debug(f"Processing document {document.id}: {document.name}")

            # Skip documents without file_path (legacy database-only documents)
            if not document.file_path:
                logger.debug(f"Skipping document {document.id} - no file_path")
                self.stats['skipped'] += 1
                return

            # Check if document is consistent
            expected_file_path = await self._calculate_expected_file_path(document)
            if document.file_path == expected_file_path:
                logger.debug(f"Document {document.id} is already consistent")
                return

            logger.info(f"Document {document.id} is inconsistent:")
            logger.info(f"  Current file_path: {document.file_path}")
            logger.info(f"  Expected file_path: {expected_file_path}")

            self.stats['inconsistent_documents'] += 1

            # Attempt to fix the inconsistency
            await self._fix_document_consistency(session, document, expected_file_path)

        except Exception as e:
            logger.error(f"Error processing document {document.id}: {e}")
            self.stats['errors'] += 1

    async def _calculate_expected_file_path(self, document: Document) -> str:
        """Calculate what the file_path should be based on current database state."""
        if document.repository_type == 'local':
            # Local documents: local/{category_name}/{document_name}.md
            category_name = 'General'  # Default
            if document.category_ref:
                category_name = document.category_ref.name

            # Handle document names that may or may not have .md extension
            doc_name = document.name
            if not doc_name.endswith('.md'):
                doc_name = f"{doc_name}.md"

            return f"local/{category_name}/{doc_name}"

        elif document.repository_type == 'github':
            # GitHub documents: github/{account_id}/{repo_name}/{github_file_path}
            if document.file_path and document.file_path.startswith('github/'):
                # Extract the account_id and repo_name from current path
                path_parts = document.file_path.split('/')
                if len(path_parts) >= 3:
                    account_id = path_parts[1]
                    repo_name = path_parts[2]

                    # Calculate expected github_file_path based on document name
                    if document.github_file_path:
                        # Use existing github_file_path but update filename if needed
                        github_path_parts = document.github_file_path.split('/')
                        original_filename = github_path_parts[-1]

                        # Handle document names that may or may not have .md extension
                        doc_name = document.name
                        if not doc_name.endswith('.md'):
                            doc_name = f"{doc_name}.md"

                        # Only change if the filename is different
                        if original_filename != doc_name:
                            github_path_parts[-1] = doc_name
                            new_github_file_path = '/'.join(github_path_parts)
                        else:
                            new_github_file_path = document.github_file_path
                    else:
                        # No github_file_path, use document name as filename
                        doc_name = document.name
                        if not doc_name.endswith('.md'):
                            doc_name = f"{doc_name}.md"
                        new_github_file_path = doc_name

                    return f"github/{account_id}/{repo_name}/{new_github_file_path}"

            # Fallback: keep current path for GitHub documents we can't parse
            return document.file_path or ""
        else:
            # Unknown repository type, keep current path
            return document.file_path or ""

    async def _fix_document_consistency(
        self,
        session: AsyncSession,
        document: Document,
        expected_file_path: str
    ):
        """Fix filesystem consistency for a single document."""
        current_file_path = document.file_path

        # Skip if no current file_path
        if not current_file_path:
            logger.debug(f"  Skipping document {document.id} - no current file_path")
            return

        if self.dry_run:
            logger.info(f"  DRY RUN: Would move {current_file_path} -> {expected_file_path}")
            return

        try:
            # Check if source file exists
            if not await self._file_exists(document.user_id, current_file_path):
                logger.warning(f"  Source file doesn't exist: {current_file_path}")
                # Update database to reflect reality (file doesn't exist)
                document.file_path = expected_file_path
                session.add(document)
                return

            # Check if target location already has a file
            if await self._file_exists(document.user_id, expected_file_path):
                if current_file_path != expected_file_path:
                    if self.dry_run:
                        logger.info(f"  DRY RUN: Target file already exists: {expected_file_path}")
                        logger.info(f"  DRY RUN: Would create database record for existing file")
                        return
                    else:
                        logger.info(f"  Target file already exists: {expected_file_path}")
                        # Create a database record for the existing file so user can manage both versions
                        await self._create_record_for_existing_file(session, document, expected_file_path)
                        logger.info(f"  Created database record for existing file at {expected_file_path}")
                        self.stats['db_records_created'] += 1
                        return

            # Perform the filesystem move
            success = await self.storage_service.move_document(
                user_id=document.user_id,
                old_path=current_file_path,
                new_path=expected_file_path,
                commit_message=f"Migration: fix filesystem consistency for {document.name}",
                auto_commit=True
            )

            if success:
                logger.info(f"  Successfully moved file: {current_file_path} -> {expected_file_path}")

                # Update database
                document.file_path = expected_file_path

                # Update github_file_path if it's a GitHub document
                if document.repository_type == 'github' and expected_file_path.startswith('github/'):
                    path_parts = expected_file_path.split('/')
                    if len(path_parts) >= 4:
                        new_github_file_path = '/'.join(path_parts[3:])
                        document.github_file_path = new_github_file_path

                session.add(document)

                if document.repository_type == 'local':
                    self.stats['local_moves'] += 1
                elif document.repository_type == 'github':
                    self.stats['github_renames'] += 1

            else:
                logger.error(f"  Failed to move file: {current_file_path} -> {expected_file_path}")
                self.stats['errors'] += 1

        except Exception as e:
            logger.error(f"  Error fixing document {document.id}: {e}")
            self.stats['errors'] += 1

    async def _file_exists(self, user_id: int, file_path: str) -> bool:
        """Check if a file exists in the user's storage."""
        try:
            content = await self.storage_service.read_document(user_id, file_path)
            return content is not None
        except Exception:
            return False

    async def _create_record_for_existing_file(
        self,
        session: AsyncSession,
        original_document: Document,
        existing_file_path: str
    ):
        """Create a database record for an existing file that conflicts with migration."""
        try:
            # Read content from the existing file
            content = await self.storage_service.read_document(
                original_document.user_id,
                existing_file_path
            )
            if content is None:
                logger.warning(f"Could not read content from {existing_file_path}")
                return

            # Extract document name from file path
            filename = existing_file_path.split('/')[-1]
            document_name = filename.replace('.md', '') if filename.endswith('.md') else filename

            # Determine category from file path
            category_id = None
            folder_path = None
            if existing_file_path.startswith('local/'):
                path_parts = existing_file_path.split('/')
                if len(path_parts) >= 2:
                    category_name = path_parts[1]
                    folder_path = f"/{category_name}"

                    # Find the category by name for this user
                    category_result = await session.execute(
                        select(Category).filter(
                            Category.name == category_name,
                            Category.user_id == original_document.user_id
                        )
                    )
                    category = category_result.scalar_one_or_none()
                    if category:
                        category_id = category.id

            # Check if a record already exists with this combination
            existing_check = await session.execute(
                select(Document).filter(
                    Document.user_id == original_document.user_id,
                    Document.folder_path == folder_path,
                    Document.name == document_name
                )
            )
            existing_doc = existing_check.scalar_one_or_none()

            if existing_doc:
                logger.info(f"Database record already exists for {document_name} in {folder_path} - skipping")
                return

            # Create new document record
            new_document = Document(
                name=document_name,
                user_id=original_document.user_id,
                category_id=category_id,
                file_path=existing_file_path,
                repository_type=original_document.repository_type or 'local',
                folder_path=folder_path,
            )

            session.add(new_document)

            logger.info(f"Created database record for existing file: {document_name} at {existing_file_path}")

        except Exception as e:
            logger.error(f"Failed to create database record for {existing_file_path}: {e}")
            self.stats['errors'] += 1

    def _print_stats(self):
        """Print migration statistics."""
        logger.info("\n" + "="*60)
        logger.info("MIGRATION STATISTICS")
        logger.info("="*60)
        logger.info(f"Total documents checked: {self.stats['total_documents']}")
        logger.info(f"Inconsistent documents: {self.stats['inconsistent_documents']}")
        logger.info(f"Local documents moved: {self.stats['local_moves']}")
        logger.info(f"GitHub documents renamed: {self.stats['github_renames']}")
        logger.info(f"Database records created for existing files: {self.stats['db_records_created']}")
        logger.info(f"Documents skipped: {self.stats['skipped']}")
        logger.info(f"Errors encountered: {self.stats['errors']}")

        if self.dry_run:
            logger.info("\n⚠️  This was a DRY RUN - no actual changes were made")
        else:
            logger.info(f"\n✅ Migration completed with {self.stats['errors']} errors")


async def main():
    """Main migration script entry point."""
    parser = argparse.ArgumentParser(description="Migrate filesystem consistency")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes"
    )
    parser.add_argument(
        "--user-id",
        type=int,
        help="Only process documents for specific user ID"
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Limit number of documents to process"
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Set logging level"
    )

    args = parser.parse_args()

    # Setup logging
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Run migration
    migrator = FilesystemConsistencyMigrator(dry_run=args.dry_run)
    await migrator.migrate_all_documents(user_id=args.user_id, limit=args.limit)


if __name__ == "__main__":
    asyncio.run(main())