"""CRUD operations for categories."""
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.custom_dictionary import CustomDictionary
from app.models.document import Document
from app.schemas.category import CategoryCreate, CategoryUpdate


async def get_user_categories(db: AsyncSession, user_id: int) -> list[Category]:
    """Get all categories for a user."""
    result = await db.execute(
        select(Category).where(Category.user_id == user_id).order_by(Category.name)
    )
    return list(result.scalars().all())


async def get_user_categories_with_stats(db: AsyncSession, user_id: int) -> list[dict]:
    """Get all categories for a user with document and dictionary counts."""
    result = await db.execute(
        select(
            Category,
            func.count(Document.id.distinct()).label("document_count"),
            func.count(CustomDictionary.id.distinct()).label("dictionary_word_count"),
        )
        .outerjoin(Document, Category.id == Document.category_id)
        .outerjoin(CustomDictionary, Category.id == CustomDictionary.category_id)
        .where(Category.user_id == user_id)
        .group_by(Category.id)
        .order_by(Category.name)
    )

    categories_with_stats = []
    for row in result:
        category, doc_count, dict_count = row
        category_dict = {
            "id": category.id,
            "user_id": category.user_id,
            "name": category.name,
            "created_at": category.created_at,
            "updated_at": category.updated_at,
            "document_count": doc_count or 0,
            "dictionary_word_count": dict_count or 0,
        }
        categories_with_stats.append(category_dict)

    return categories_with_stats


async def get_category_by_id(
    db: AsyncSession, category_id: int, user_id: int
) -> Optional[Category]:
    """Get a specific category by ID and user."""
    result = await db.execute(
        select(Category).where(Category.id == category_id, Category.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def get_category_by_name(
    db: AsyncSession, name: str, user_id: int
) -> Optional[Category]:
    """Get a category by name and user."""
    result = await db.execute(
        select(Category).where(
            Category.name == name.strip(), Category.user_id == user_id
        )
    )
    return result.scalar_one_or_none()


async def create_category(
    db: AsyncSession, category_data: CategoryCreate, user_id: int
) -> Category:
    """Create a new category."""
    db_category = Category(
        user_id=user_id,
        name=category_data.name.strip(),
    )
    db.add(db_category)
    await db.commit()
    await db.refresh(db_category)
    return db_category


async def update_category(
    db: AsyncSession,
    category_id: int,
    user_id: int,
    category_data: CategoryUpdate,
) -> Optional[Category]:
    """Update a category."""
    result = await db.execute(
        select(Category).where(Category.id == category_id, Category.user_id == user_id)
    )
    db_category = result.scalar_one_or_none()
    if not db_category:
        return None

    if category_data.name is not None:
        db_category.name = category_data.name.strip()

    await db.commit()
    await db.refresh(db_category)
    return db_category


async def delete_category(db: AsyncSession, category_id: int, user_id: int) -> bool:
    """Delete a category."""
    result = await db.execute(
        select(Category).where(Category.id == category_id, Category.user_id == user_id)
    )
    db_category = result.scalar_one_or_none()
    if not db_category:
        return False

    await db.delete(db_category)
    await db.commit()
    return True
