"""CRUD operations for documents."""
from typing import Any, List, Optional

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.document import Document


class DocumentCRUD:
    async def add_category_for_user(
        self, db: AsyncSession, user_id: int, category: str
    ) -> bool:
        """Add a category for a user by creating a dummy document if none exists."""
        # If category already exists, do nothing
        result = await db.execute(
            select(Document.category).filter(
                Document.user_id == user_id, Document.category == category
            )
        )
        if result.scalar_one_or_none():
            return False
        # Create a dummy document to register the category
        dummy = Document(
            name="__category_placeholder__",
            content="",
            category=category,
            user_id=user_id,
        )
        db.add(dummy)
        await db.commit()
        await db.refresh(dummy)
        return True

    async def delete_category_for_user(
        self,
        db: AsyncSession,
        user_id: int,
        category: str,
        delete_docs: bool = False,
        migrate_to: Optional[str] = None,
    ) -> int:
        """
        Delete or migrate a category for a user.
        If delete_docs=True, deletes all documents in this category.
        Otherwise, moves docs to migrate_to (or 'General').
        Also removes placeholder docs for this category.
        Returns number of affected documents.
        """
        from sqlalchemy import delete, update

        # Prevent deletion of default
        if category.strip().lower() == "general":
            return 0

        # Prepare statement (Delete or Update)
        stmt: Any  # Prepare statement (Delete or Update)
        if delete_docs:
            # Remove all docs in this category
            stmt = delete(Document).where(
                Document.user_id == user_id,
                Document.category == category,
            )
        else:
            # Migrate docs to target category or default General
            target = migrate_to or "General"
            stmt = (
                update(Document)
                .where(Document.user_id == user_id, Document.category == category)
                .values(category=target)
            )
        result: Any = await db.execute(stmt)
        # Delete any placeholder docs for this category
        placeholder_del = delete(Document).where(
            Document.user_id == user_id,
            Document.category == category,
            Document.name == "__category_placeholder__",
        )
        await db.execute(placeholder_del)
        await db.commit()
        # Cast rowcount to int for correct return type
        return int(result.rowcount)

    async def update_category_name_for_user(
        self, db: AsyncSession, user_id: int, old_name: str, new_name: str
    ) -> int:
        """Rename a category for a user by updating all documents. Returns number of updated documents."""
        from sqlalchemy import select, update

        # Check if new_name already exists for user
        exists_stmt = select(Document).where(
            Document.user_id == user_id, Document.category == new_name
        )
        exists_result: Any = await db.execute(exists_stmt)
        if exists_result.scalar_one_or_none():
            return 0  # Do not rename if new_name already exists

        # Update all documents with old_name to new_name
        update_stmt = (
            update(Document)
            .where(Document.user_id == user_id, Document.category == old_name)
            .values(category=new_name)
        )
        exec_result: Any = await db.execute(update_stmt)
        await db.commit()
        # Cast rowcount to int for correct return type
        return int(exec_result.rowcount)

    async def get(self, db: AsyncSession, id: int) -> Optional[Document]:
        """Get a document by ID with category name and GitHub repository information."""
        from app.models.category import Category

        result = await db.execute(
            select(Document, Category.name.label('category_name'))
            .outerjoin(Category, Document.category_id == Category.id)
            .options(selectinload(Document.github_repository))
            .filter(Document.id == id)
        )
        row = result.first()
        if row:
            document = row.Document
            # Add category name to the document object (or None if no category)
            document.category = row.category_name
            return document
        return None

    async def get_by_user(
        self, db: AsyncSession, user_id: int, skip: int = 0, limit: int = 100
    ) -> List[Document]:
        """Get all documents for a user with category names and GitHub repository information."""
        from app.models.category import Category

        result = await db.execute(
            select(Document, Category.name.label('category_name'))
            .outerjoin(Category, Document.category_id == Category.id)  # Use LEFT JOIN to include docs with null category_id
            .options(selectinload(Document.github_repository))
            .filter(Document.user_id == user_id)
            .order_by(Document.updated_at.desc())
            .offset(skip)
            .limit(limit)
        )

        documents = []
        for row in result:
            document = row.Document
            # Add category name to the document object
            document.category = row.category_name
            documents.append(document)
        return documents

    async def get_by_user_and_category(
        self,
        db: AsyncSession,
        user_id: int,
        category: str,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Document]:
        """Get documents for a user filtered by category name."""
        from app.models.category import Category

        result = await db.execute(
            select(Document, Category.name.label('category_name'))
            .join(Category, Document.category_id == Category.id)
            .filter(Document.user_id == user_id, Category.name == category)
            .order_by(Document.updated_at.desc())
            .offset(skip)
            .limit(limit)
        )

        documents = []
        for row in result:
            document = row.Document
            # Add category name to the document object
            document.category = row.category_name
            documents.append(document)
        return documents

    async def create(
        self,
        db: AsyncSession,
        user_id: int,
        name: str,
        category_id: int,
        content: Optional[str] = None,
        file_path: Optional[str] = None,
        repository_type: str = "local",
        folder_path: str = "/",
    ) -> Document:
        """Create a new document with filesystem support."""
        # Validate that the category exists and belongs to the user
        from app.models.category import Category

        result = await db.execute(
            select(Category).filter(
                Category.id == category_id,
                Category.user_id == user_id
            )
        )
        category_obj = result.scalar_one_or_none()
        if not category_obj:
            raise ValueError(f"Category with ID {category_id} not found for user")

        document = Document(
            name=name,
            category_id=category_id,
            user_id=user_id,
            file_path=file_path,
            repository_type=repository_type,
            folder_path=folder_path,
        )
        db.add(document)
        await db.commit()
        await db.refresh(document)

        # If content is provided, write it to filesystem
        if content is not None and file_path is not None:
            from app.services.storage.user import UserStorage
            user_storage_service = UserStorage()
            await user_storage_service.write_document(user_id, file_path, content)

        return document

    async def update(
        self,
        db: AsyncSession,
        document_id: int,
        user_id: int,
        name: Optional[str] = None,
        content: Optional[str] = None,
        category_id: Optional[int] = None,
    ) -> Optional[Document]:
        """Update a document if it belongs to the user. Sets updated_at to current UTC time."""
        from datetime import datetime, timezone

        result = await db.execute(
            select(Document).filter(
                Document.id == document_id, Document.user_id == user_id
            )
        )
        document = result.scalar_one_or_none()
        if not document:
            return None

        if name is not None:
            document.name = name
        if content is not None:
            document.content = content
        if category_id is not None:
            # Validate that the category exists and belongs to the user
            from app.models.category import Category
            result = await db.execute(
                select(Category).filter(
                    Category.id == category_id,
                    Category.user_id == user_id
                )
            )
            category_obj = result.scalar_one_or_none()
            if not category_obj:
                raise ValueError(f"Category with ID {category_id} not found for user")

            document.category_id = category_id

        # Always set updated_at to current UTC time
        document.updated_at = datetime.now(timezone.utc)

        await db.commit()
        await db.refresh(document)
        return document

    async def delete(self, db: AsyncSession, document_id: int, user_id: int) -> bool:
        """Delete a document if it belongs to the user."""
        result = await db.execute(
            select(Document).filter(
                Document.id == document_id, Document.user_id == user_id
            )
        )
        document = result.scalar_one_or_none()
        if not document:
            return False

        await db.delete(document)
        await db.commit()
        return True

    async def get_categories_by_user(self, db: AsyncSession, user_id: int) -> List[str]:
        """Get all categories used by a user's documents."""
        from app.crud.category import get_user_categories

        # Get categories from the categories table for this user
        categories = await get_user_categories(db, user_id)
        return [cat.name for cat in categories]

    async def delete_documents_in_category_for_user(
        self, db: AsyncSession, user_id: int, category: str
    ) -> None:
        """Delete all documents in a category for a user."""
        await db.execute(
            delete(Document).where(
                Document.user_id == user_id, Document.category == category
            )
        )
        await db.commit()

    async def migrate_documents_to_category_for_user(
        self, db: AsyncSession, user_id: int, old_category: str, new_category: str
    ) -> None:
        """Move all documents in old_category to new_category for a user."""
        await db.execute(
            update(Document)
            .where(Document.user_id == user_id, Document.category == old_category)
            .values(category=new_category)
        )
        await db.commit()

    async def enable_sharing(
        self, db: AsyncSession, document_id: int, user_id: int
    ) -> Optional[str]:
        """Enable sharing for a document and return the share token."""
        import secrets

        result = await db.execute(
            select(Document).filter(
                Document.id == document_id, Document.user_id == user_id
            )
        )
        document = result.scalar_one_or_none()
        if not document:
            return None

        # Generate a secure random token if not already present
        if not document.share_token:
            document.share_token = secrets.token_urlsafe(32)

        document.is_shared = True
        await db.commit()
        await db.refresh(document)
        return document.share_token

    async def disable_sharing(
        self, db: AsyncSession, document_id: int, user_id: int
    ) -> bool:
        """Disable sharing for a document."""
        result = await db.execute(
            select(Document).filter(
                Document.id == document_id, Document.user_id == user_id
            )
        )
        document = result.scalar_one_or_none()
        if not document:
            return False

        document.is_shared = False
        await db.commit()
        return True

    async def get_by_share_token(
        self, db: AsyncSession, share_token: str
    ) -> Optional[Document]:
        """Get a document by its share token if sharing is enabled."""
        from app.models.category import Category

        result = await db.execute(
            select(Document, Category.name.label('category_name'))
            .join(Category, Document.category_id == Category.id)
            .options(selectinload(Document.owner))
            .filter(Document.share_token == share_token, Document.is_shared.is_(True))
        )
        row = result.first()
        if row:
            document = row.Document
            # Add category name to the document object
            document.category = row.category_name
            return document
        return None

    async def get_by_github_metadata(
        self,
        db: AsyncSession,
        user_id: int,
        repository_id: int,
        file_path: str,
        branch: str
    ) -> Optional[Document]:
        """Get a document by its GitHub metadata (repository, file path, and branch)."""
        result = await db.execute(
            select(Document)
            .filter(
                Document.user_id == user_id,
                Document.github_repository_id == repository_id,
                Document.github_file_path == file_path,
                Document.github_branch == branch
            )
        )
        return result.scalar_one_or_none()

    async def get_documents_by_folder_path(
        self,
        db: AsyncSession,
        user_id: int,
        folder_path: str,
        include_subfolders: bool = False
    ) -> List[Document]:
        """Get documents in a specific folder path."""
        query = select(Document).where(Document.user_id == user_id)

        if include_subfolders:
            # Get all documents in folder and subfolders
            search_pattern = f"{folder_path.rstrip('/')}/%"
            query = query.where(Document.folder_path.like(search_pattern))
        else:
            # Get documents only in exact folder
            query = query.where(Document.folder_path == folder_path)

        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_folder_structure(self, db: AsyncSession, user_id: int) -> dict:
        """Build folder tree structure for UI."""
        # Get all unique folder paths for user
        query = select(Document.folder_path).where(
            Document.user_id == user_id
        ).distinct()

        result = await db.execute(query)
        paths = result.scalars().all()

        # Build hierarchical structure
        tree = {}
        for path in paths:
            parts = [p for p in path.split('/') if p]
            current = tree
            for part in parts:
                if part not in current:
                    current[part] = {}
                current = current[part]

        return tree

    async def search_documents(
        self,
        db: AsyncSession,
        user_id: int,
        query: str,
        folder_path: Optional[str] = None
    ) -> List[Document]:
        """Search documents by content/name with optional folder filtering."""
        search_query = select(Document).where(Document.user_id == user_id)

        # Add text search (only by name since content is not stored in DB)
        search_query = search_query.where(
            Document.name.ilike(f"%{query}%")
        )

        # Add folder filtering if specified
        if folder_path:
            search_query = search_query.where(
                Document.folder_path.like(f"{folder_path.rstrip('/')}%")
            )

        result = await db.execute(search_query)
        return list(result.scalars().all())

    async def get_folder_stats(self, db: AsyncSession, user_id: int) -> dict:
        """Get statistics about folder usage."""
        from sqlalchemy import func

        # Get document count per folder
        query = select(
            Document.folder_path,
            func.count(Document.id).label('document_count')
        ).where(
            Document.user_id == user_id
        ).group_by(Document.folder_path)

        result = await db.execute(query)
        rows = result.all()

        # Convert to dict properly
        folder_stats = {row.folder_path: row.document_count for row in rows}

        return {
            "folder_counts": folder_stats,
            "total_folders": len(folder_stats),
            "total_documents": sum(folder_stats.values())
        }

    async def create_document_in_folder(
        self,
        db: AsyncSession,
        user_id: int,
        name: str,
        content: str,
        folder_path: str,
        github_data: Optional[dict] = None
    ) -> Document:
        """Create a new document in specified folder."""
        # Normalize folder path
        folder_path = Document.normalize_folder_path(folder_path)

        # Check for duplicate names in folder
        existing = await db.execute(
            select(Document).where(
                Document.user_id == user_id,
                Document.folder_path == folder_path,
                Document.name == name
            )
        )

        if existing.scalar_one_or_none():
            raise ValueError(f"Document '{name}' already exists in folder '{folder_path}'")

        # Create document (without content field)
        document = Document(
            name=name,
            folder_path=folder_path,
            user_id=user_id
        )

        # Add GitHub data if provided
        if github_data:
            document.github_repository_id = github_data.get('repository_id')
            document.github_file_path = github_data.get('file_path')
            document.github_branch = github_data.get('branch')
            document.github_sha = github_data.get('sha')
            document.repository_type = "github"
            # Set file_path for filesystem storage - relative to user directory
            repo_name = github_data.get('repo_name', 'unknown')
            account_id = github_data.get('account_id', 1)
            document.file_path = f"github/{account_id}/{repo_name}/{github_data.get('file_path', '')}"

        db.add(document)
        await db.commit()
        await db.refresh(document)

        # Write content to filesystem if provided
        if content and document.file_path:
            from app.services.storage.user import UserStorage
            user_storage_service = UserStorage()
            await user_storage_service.write_document(user_id, document.file_path, content)

        return document

    async def move_document_to_folder(
        self,
        db: AsyncSession,
        document_id: int,
        new_folder_path: str,
        user_id: int
    ) -> Optional[Document]:
        """Move document to a different folder."""
        # Normalize the folder path
        new_folder_path = Document.normalize_folder_path(new_folder_path)

        # Get and update document
        query = select(Document).where(
            Document.id == document_id,
            Document.user_id == user_id
        )
        result = await db.execute(query)
        document = result.scalar_one_or_none()

        if not document:
            return None

        document.folder_path = new_folder_path
        await db.commit()
        await db.refresh(document)

        return document

    async def get_github_document(
        self,
        db: AsyncSession,
        user_id: int,
        repository_id: int,
        file_path: str,
        branch: str
    ) -> Optional[Document]:
        """Get a specific GitHub document by repository metadata."""
        query = select(Document).where(
            Document.user_id == user_id,
            Document.github_repository_id == repository_id,
            Document.github_file_path == file_path,
            Document.github_branch == branch
        )

        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def get_github_documents_by_repo_branch(
        self,
        db: AsyncSession,
        user_id: int,
        repository_id: int,
        branch: str
    ) -> List[Document]:
        """Get all documents for a specific repository/branch."""
        query = select(Document).where(
            Document.user_id == user_id,
            Document.github_repository_id == repository_id,
            Document.github_branch == branch
        )

        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_github_folders_for_user(self, db: AsyncSession, user_id: int) -> List[str]:
        """Get all GitHub folder paths for a user."""
        query = select(Document.folder_path).where(
            Document.user_id == user_id,
            Document.github_repository_id.isnot(None),
            Document.folder_path.like('/GitHub/%')
        ).distinct()

        result = await db.execute(query)
        return list(result.scalars().all())

    async def cleanup_orphaned_github_documents(
        self,
        db: AsyncSession,
        user_id: int,
        repository_id: int,
        branch: str,
        current_file_paths: List[str]
    ) -> int:
        """Remove documents that no longer exist in the GitHub repository."""
        stmt = delete(Document).where(
            Document.user_id == user_id,
            Document.github_repository_id == repository_id,
            Document.github_branch == branch,
            Document.github_file_path.notin_(current_file_paths)
        )

        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount

    async def get_recent_documents(
        self,
        db: AsyncSession,
        user_id: int,
        limit: int = 6,
        source: Optional[str] = None
    ) -> List[Document]:
        """Get recently opened documents for a user."""
        query = select(Document).options(
            selectinload(Document.category_ref),
            selectinload(Document.github_repository)
        ).filter(
            Document.user_id == user_id,
            Document.last_opened_at.isnot(None)
        )

        # Filter by source if specified
        if source == "local":
            query = query.filter(Document.github_repository_id.is_(None))
        elif source == "github":
            query = query.filter(Document.github_repository_id.isnot(None))

        query = query.order_by(Document.last_opened_at.desc()).limit(limit)

        result = await db.execute(query)
        return list(result.scalars().all())

    async def mark_document_opened(
        self,
        db: AsyncSession,
        document_id: int,
        user_id: int
    ) -> Optional[Document]:
        """Mark a document as recently opened."""
        # Find and verify ownership
        query = select(Document).filter(
            Document.id == document_id,
            Document.user_id == user_id
        )

        result = await db.execute(query)
        document = result.scalar_one_or_none()

        if not document:
            return None

        # Update last_opened_at
        from datetime import datetime
        document.last_opened_at = datetime.utcnow()

        await db.commit()
        await db.refresh(document)
        return document


# Create a singleton instance
document = DocumentCRUD()
