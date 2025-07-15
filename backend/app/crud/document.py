"""CRUD operations for documents."""
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
        self, db: AsyncSession, user_id: int, category: str
    ) -> int:
        """Delete a category for a user by moving all documents to 'General' and removing category placeholder docs."""
        from sqlalchemy import delete, update

        if category.strip().lower() == "general":
            return 0
        # Move all documents to 'General'
        stmt = (
            update(Document)
            .where(Document.user_id == user_id, Document.category == category)
            .values(category="General")
        )
        result = await db.execute(stmt)
        # Delete any placeholder docs for this category
        del_stmt = delete(Document).where(
            Document.user_id == user_id,
            Document.category == category,
            Document.name == "__category_placeholder__",
        )
        await db.execute(del_stmt)
        await db.commit()
        return result.rowcount

    """CRUD operations for documents."""

    async def get(self, db: AsyncSession, id: int) -> Optional[Document]:
        """Get a document by ID."""
        result = await db.execute(select(Document).filter(Document.id == id))
        return result.scalar_one_or_none()

    async def get_by_user(
        self, db: AsyncSession, user_id: int, skip: int = 0, limit: int = 100
    ) -> List[Document]:
        """Get all documents for a user."""
        result = await db.execute(
            select(Document)
            .filter(Document.user_id == user_id)
            .order_by(Document.updated_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_by_user_and_category(
        self,
        db: AsyncSession,
        user_id: int,
        category: str,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Document]:
        """Get documents for a user filtered by category."""
        result = await db.execute(
            select(Document)
            .filter(Document.user_id == user_id, Document.category == category)
            .order_by(Document.updated_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def create(
        self,
        db: AsyncSession,
        user_id: int,
        name: str,
        content: str,
        category: str = "General",
    ) -> Document:
        """Create a new document."""
        document = Document(
            name=name, content=content, category=category, user_id=user_id
        )
        db.add(document)
        await db.commit()
        await db.refresh(document)
        return document

    async def update(
        self,
        db: AsyncSession,
        document_id: int,
        user_id: int,
        name: Optional[str] = None,
        content: Optional[str] = None,
        category: Optional[str] = None,
    ) -> Optional[Document]:
        """Update a document if it belongs to the user."""
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
        if category is not None:
            document.category = category

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
        result = await db.execute(
            select(Document.category).filter(Document.user_id == user_id).distinct()
        )
        categories = result.scalars().all()
        return list(categories)


# Create a singleton instance
document = DocumentCRUD()
