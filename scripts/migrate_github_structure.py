#!/usr/bin/env python3
"""Migration script for GitHub folder structure - Phase 4."""

import asyncio
import os
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent / "backend"
sys.path.append(str(backend_dir))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, text

from app.models.document import Document
from app.models.github_models import GitHubRepository


async def migrate_github_documents():
    """Migrate existing GitHub documents to new folder structure."""
    
    # Database URL from environment or default
    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:postgres@localhost:5432/markdown_manager"
    )
    
    print(f"Connecting to database: {database_url}")
    
    engine = create_async_engine(database_url)
    async_session = sessionmaker(engine, class_=AsyncSession)

    async with async_session() as session:
        try:
            # Get all GitHub documents
            github_docs_query = select(Document).where(
                Document.github_repository_id.isnot(None)
            )
            result = await session.execute(github_docs_query)
            documents = result.scalars().all()

            print(f"Found {len(documents)} GitHub documents to migrate")

            updated_count = 0
            error_count = 0
            
            for doc in documents:
                try:
                    # Get the repository information
                    repo_query = select(GitHubRepository).where(
                        GitHubRepository.id == doc.github_repository_id
                    )
                    repo_result = await session.execute(repo_query)
                    repository = repo_result.scalar_one_or_none()
                    
                    if not repository:
                        print(f"Warning: Repository not found for document {doc.id}")
                        error_count += 1
                        continue
                    
                    if doc.github_file_path:
                        # Generate new folder path using repository method
                        new_folder_path = repository.get_file_folder_path(
                            doc.github_file_path,
                            doc.github_branch or 'main'
                        )

                        if doc.folder_path != new_folder_path:
                            old_path = doc.folder_path
                            doc.folder_path = new_folder_path
                            updated_count += 1

                            print(f"Updated document {doc.id} ({doc.name}): {old_path} → {new_folder_path}")
                        else:
                            print(f"Document {doc.id} ({doc.name}) already has correct folder path: {doc.folder_path}")
                    else:
                        print(f"Warning: Document {doc.id} ({doc.name}) has no github_file_path")
                        error_count += 1

                except Exception as e:
                    print(f"Error processing document {doc.id}: {e}")
                    error_count += 1

            # Commit all changes
            await session.commit()
            print("\nMigration complete:")
            print(f"  - {updated_count} documents updated")
            print(f"  - {error_count} errors encountered")
            print(f"  - {len(documents) - updated_count - error_count} documents already correct")
            
            # Verify migration by checking for double slashes
            print("\nCleaning up any double slashes...")
            cleanup_query = text("""
                UPDATE documents
                SET folder_path = REPLACE(folder_path, '//', '/')
                WHERE github_repository_id IS NOT NULL
                AND folder_path LIKE '%//%'
            """)
            cleanup_result = await session.execute(cleanup_query)
            await session.commit()
            
            if cleanup_result.rowcount > 0:
                print(f"Cleaned up {cleanup_result.rowcount} documents with double slashes")
            else:
                print("No double slashes found")

        except Exception as e:
            print(f"Migration failed: {e}")
            await session.rollback()
            raise
        finally:
            await engine.dispose()


async def verify_migration():
    """Verify that the migration was successful."""
    
    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:postgres@localhost:5432/markdown_manager"
    )
    
    engine = create_async_engine(database_url)
    async_session = sessionmaker(engine, class_=AsyncSession)

    async with async_session() as session:
        try:
            # Count GitHub documents by folder pattern
            github_count_query = text("""
                SELECT COUNT(*) as total,
                       COUNT(CASE WHEN folder_path LIKE '/GitHub/%' THEN 1 END) as github_folders,
                       COUNT(CASE WHEN folder_path LIKE '%//%' THEN 1 END) as double_slashes
                FROM documents
                WHERE github_repository_id IS NOT NULL
            """)
            
            result = await session.execute(github_count_query)
            row = result.fetchone()
            
            print("\nMigration verification:")
            print(f"  - Total GitHub documents: {row.total}")
            print(f"  - Documents in /GitHub/ folders: {row.github_folders}")
            print(f"  - Documents with double slashes: {row.double_slashes}")
            
            if row.github_folders == row.total and row.double_slashes == 0:
                print("✅ Migration verification successful!")
            else:
                print("⚠️  Migration may need attention")
                
            # Show sample folder paths
            sample_query = text("""
                SELECT DISTINCT folder_path
                FROM documents
                WHERE github_repository_id IS NOT NULL
                ORDER BY folder_path
                LIMIT 10
            """)
            
            sample_result = await session.execute(sample_query)
            paths = sample_result.fetchall()
            
            if paths:
                print("\nSample GitHub folder paths:")
                for path in paths:
                    print(f"  - {path.folder_path}")
            
        except Exception as e:
            print(f"Verification failed: {e}")
        finally:
            await engine.dispose()


async def main():
    """Main migration function."""
    print("GitHub Folder Structure Migration - Phase 4")
    print("=" * 50)
    
    if len(sys.argv) > 1 and sys.argv[1] == "--verify":
        await verify_migration()
    else:
        await migrate_github_documents()
        print("\nRunning verification...")
        await verify_migration()


if __name__ == "__main__":
    asyncio.run(main())
