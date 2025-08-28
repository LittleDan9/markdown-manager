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
        """Get a document by ID with category name."""
        from app.models.category import Category

        result = await db.execute(
            select(Document, Category.name.label('category_name'))
            .join(Category, Document.category_id == Category.id)
            .filter(Document.id == id)
        )
        row = result.first()
        if row:
            document = row.Document
            # Add category name to the document object
            document.category = row.category_name
            return document
        return None

    async def get_by_user(
        self, db: AsyncSession, user_id: int, skip: int = 0, limit: int = 100
    ) -> List[Document]:
        """Get all documents for a user with category names."""
        from app.models.category import Category

        result = await db.execute(
            select(Document, Category.name.label('category_name'))
            .join(Category, Document.category_id == Category.id)
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
        content: str,
        category_id: int,
    ) -> Document:
        """Create a new document with a category_id."""
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
            content=content,
            category_id=category_id,
            user_id=user_id
        )
        db.add(document)
        await db.commit()
        await db.refresh(document)
        return document
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


# Create a singleton instance
document = DocumentCRUD()
