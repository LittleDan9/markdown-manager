#!/usr/bin/env python3
"""
Filesystem Consistency Analysis Script

This script analyzes the database and filesystem to identify inconsistencies
between document records and their physical file locations.

Usage:
    python scripts/analyze_filesystem_consistency.py [--user-id=123] [--limit=100]
"""

import asyncio
import argparse
import logging
from typing import Optional, Dict, Any
import sys
import os
import json
from datetime import datetime

# Add the app directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import AsyncSessionLocal
from app.models.document import Document
from app.services.storage import UserStorage

logger = logging.getLogger(__name__)


class FilesystemConsistencyAnalyzer:
    """Analyzes filesystem consistency without making changes."""

    def __init__(self):
        self.storage_service = UserStorage()
        self.inconsistencies = []
        self.stats = {
            'total_documents': 0,
            'consistent_documents': 0,
            'inconsistent_documents': 0,
            'missing_files': 0,
            'no_file_path': 0,
            'local_documents': 0,
            'github_documents': 0,
        }

    async def analyze_all_documents(self, user_id: Optional[int] = None, limit: Optional[int] = None) -> Dict[str, Any]:
        """Analyze all documents for filesystem consistency."""
        async with AsyncSessionLocal() as session:
            try:
                # Build query
                query = select(Document).options(
                    selectinload(Document.category_ref)
                )

                if user_id:
                    query = query.filter(Document.user_id == user_id)
                    logger.info(f"Filtering to user_id: {user_id}")

                if limit:
                    query = query.limit(limit)
                    logger.info(f"Limiting to {limit} documents")

                # Execute query
                result = await session.execute(query)
                documents = result.scalars().all()

                logger.info(f"Found {len(documents)} documents to analyze")
                self.stats['total_documents'] = len(documents)

                # Analyze each document
                for doc in documents:
                    await self._analyze_document(doc)

            except Exception as e:
                logger.error(f"Error during analysis: {e}")
                raise
            finally:
                await session.close()

        self._print_report()

        return {
            'stats': self.stats,
            'inconsistencies': self.inconsistencies
        }

    async def _analyze_document(self, document: Document):
        """Analyze a single document for consistency."""
        logger.debug(f"Analyzing document {document.id}: {document.name}")

        # Track document type
        if document.repository_type == 'local':
            self.stats['local_documents'] += 1
        elif document.repository_type == 'github':
            self.stats['github_documents'] += 1

        # Skip documents without file_path
        if not document.file_path:
            logger.debug(f"Document {document.id} has no file_path")
            self.stats['no_file_path'] += 1
            return

        # Calculate expected file path
        expected_file_path = self._calculate_expected_file_path(document)
        current_file_path = document.file_path

        # Check if file exists
        file_exists = await self._file_exists(document.user_id, current_file_path)
        if not file_exists:
            logger.warning(f"File missing for document {document.id}: {current_file_path}")
            self.stats['missing_files'] += 1

        # Check consistency
        is_consistent = (current_file_path == expected_file_path)

        if is_consistent and file_exists:
            self.stats['consistent_documents'] += 1
        else:
            self.stats['inconsistent_documents'] += 1

            inconsistency = {
                'document_id': document.id,
                'user_id': document.user_id,
                'name': document.name,
                'repository_type': document.repository_type,
                'category': document.category_ref.name if document.category_ref else None,
                'current_file_path': current_file_path,
                'expected_file_path': expected_file_path,
                'file_exists': file_exists,
                'issues': []
            }

            if not file_exists:
                inconsistency['issues'].append('FILE_MISSING')

            if current_file_path != expected_file_path:
                inconsistency['issues'].append('PATH_MISMATCH')

            self.inconsistencies.append(inconsistency)

            logger.info("Inconsistency found:")
            logger.info(f"  Document: {document.name} (ID: {document.id})")
            logger.info(f"  Current:  {current_file_path}")
            logger.info(f"  Expected: {expected_file_path}")
            logger.info(f"  File exists: {file_exists}")
            logger.info(f"  Issues: {', '.join(inconsistency['issues'])}")

    def _calculate_expected_file_path(self, document: Document) -> str:
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
            return document.file_path
        else:
            # Unknown repository type, keep current path
            return document.file_path

    async def _file_exists(self, user_id: int, file_path: str) -> bool:
        """Check if a file exists in the user's storage."""
        try:
            content = await self.storage_service.read_document(user_id, file_path)
            return content is not None
        except Exception:
            return False

    def _print_report(self):
        """Print analysis report."""
        print("\n" + "=" * 80)
        print("FILESYSTEM CONSISTENCY ANALYSIS REPORT")
        print("=" * 80)
        print(f"Analysis Date: {datetime.now().isoformat()}")
        print("\nDOCUMENT STATISTICS:")
        print(f"  Total documents: {self.stats['total_documents']}")
        print(f"  Local documents: {self.stats['local_documents']}")
        print(f"  GitHub documents: {self.stats['github_documents']}")
        print(f"  Documents without file_path: {self.stats['no_file_path']}")

        print("\nCONSISTENCY RESULTS:")
        print(f"  Consistent documents: {self.stats['consistent_documents']}")
        print(f"  Inconsistent documents: {self.stats['inconsistent_documents']}")
        print(f"  Missing files: {self.stats['missing_files']}")

        if self.inconsistencies:
            print(f"\nINCONSISTENCY BREAKDOWN:")

            # Group by issue type
            path_mismatches = [i for i in self.inconsistencies if 'PATH_MISMATCH' in i['issues']]
            missing_files = [i for i in self.inconsistencies if 'FILE_MISSING' in i['issues']]

            print(f"  Path mismatches: {len(path_mismatches)}")
            print(f"  Missing files: {len(missing_files)}")

            # Group by repository type
            local_issues = [i for i in self.inconsistencies if i['repository_type'] == 'local']
            github_issues = [i for i in self.inconsistencies if i['repository_type'] == 'github']

            print(f"  Local document issues: {len(local_issues)}")
            print(f"  GitHub document issues: {len(github_issues)}")

            print(f"\nSAMPLE INCONSISTENCIES (first 10):")
            for inconsistency in self.inconsistencies[:10]:
                print(f"\n  Document: {inconsistency['name']} (ID: {inconsistency['document_id']})")
                print(f"    Category: {inconsistency['category']}")
                print(f"    Type: {inconsistency['repository_type']}")
                print(f"    Current:  {inconsistency['current_file_path']}")
                print(f"    Expected: {inconsistency['expected_file_path']}")
                print(f"    Issues: {', '.join(inconsistency['issues'])}")

        print("\n" + "=" * 80)

        # Save detailed report to file in /documents directory
        report_data = {
            'analysis_date': datetime.now().isoformat(),
            'stats': self.stats,
            'inconsistencies': self.inconsistencies
        }

        report_file = f"/documents/filesystem_consistency_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        try:
            with open(report_file, 'w') as f:
                json.dump(report_data, f, indent=2)
            print(f"Detailed report saved to: {report_file}")
        except Exception as e:
            print(f"Warning: Could not save report file: {e}")
            # Just print the report data instead
            print("\nDetailed Report JSON:")
            print(json.dumps(report_data, indent=2))


async def main():
    """Main analysis script entry point."""
    parser = argparse.ArgumentParser(description="Analyze filesystem consistency")
    parser.add_argument(
        "--user-id",
        type=int,
        help="Only analyze documents for specific user ID"
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Limit number of documents to analyze"
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

    # Run analysis
    analyzer = FilesystemConsistencyAnalyzer()
    await analyzer.analyze_all_documents(user_id=args.user_id, limit=args.limit)


if __name__ == "__main__":
    asyncio.run(main())