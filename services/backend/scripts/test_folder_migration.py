#!/usr/bin/env python3
"""Test script for folder migration."""

import asyncio
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.document import Document
from app.models.category import Category
from app.configs import settings


async def test_migration():
    """Test that folder migration worked correctly."""

    # Create test database connection using sync version of URL
    url = settings.database_config.url.replace("postgresql+asyncpg://", "postgresql://")
    engine = create_engine(url)
    Session = sessionmaker(bind=engine)

    with Session() as session:
        # Test 1: All documents have folder_path
        docs_without_path = session.query(Document).filter(
            Document.folder_path.is_(None)
        ).count()

        if docs_without_path > 0:
            print(f"❌ Found {docs_without_path} documents without folder_path")
            return False

        # Test 2: All folder_paths are valid
        all_docs = session.query(Document).all()
        invalid_paths = []

        for doc in all_docs:
            if not doc.folder_path.startswith('/'):
                invalid_paths.append(f"Doc {doc.id}: '{doc.folder_path}'")

        if invalid_paths:
            print(f"❌ Found invalid folder paths: {invalid_paths}")
            return False

        # Test 3: Mapping from categories preserved
        categories = session.query(Category).all()
        for category in categories:
            expected_path = f"/{category.name}"
            docs_in_category = session.query(Document).filter(
                Document.category_id == category.id
            ).all()

            mismatched = [
                doc for doc in docs_in_category
                if doc.folder_path != expected_path
            ]

            if mismatched:
                print(f"❌ Category '{category.name}' has mismatched folder paths")
                return False

        print("✅ All migration tests passed!")
        print(f"✅ Migrated {len(all_docs)} documents")
        print(f"✅ Mapped {len(categories)} categories to folder paths")

        return True


if __name__ == "__main__":
    success = asyncio.run(test_migration())
    sys.exit(0 if success else 1)
