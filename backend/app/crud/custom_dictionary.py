"""CRUD operations for custom dictionary."""
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.custom_dictionary import CustomDictionary
from app.schemas.custom_dictionary import CustomDictionaryCreate, CustomDictionaryUpdate


async def get_user_dictionary_words(
    db: AsyncSession, user_id: int, category_id: Optional[int] = None
) -> list[CustomDictionary]:
    """Get custom dictionary words for a user, optionally filtered by category."""
    query = select(CustomDictionary).where(CustomDictionary.user_id == user_id)

    if category_id is not None:
        # Get words for specific category
        query = query.where(CustomDictionary.category_id == category_id)

    result = await db.execute(query.order_by(CustomDictionary.word))
    return list(result.scalars().all())


async def get_user_dictionary_word_list(
    db: AsyncSession, user_id: int, category_id: Optional[int] = None
) -> list[str]:
    """Get list of custom words for a user (words only), optionally filtered by category."""
    query = select(CustomDictionary.word).where(CustomDictionary.user_id == user_id)

    if category_id is not None:
        # Get words for specific category
        query = query.where(CustomDictionary.category_id == category_id)

    result = await db.execute(query.order_by(CustomDictionary.word))
    return list(result.scalars().all())


async def get_all_user_dictionary_words(db: AsyncSession, user_id: int) -> list[str]:
    """Get all custom words for a user (both user-level and category-level)."""
    result = await db.execute(
        select(CustomDictionary.word)
        .where(CustomDictionary.user_id == user_id)
        .order_by(CustomDictionary.word)
    )
    return list(result.scalars().all())


async def get_category_dictionary_words(
    db: AsyncSession, user_id: int, category_id: int
) -> list[str]:
    """Get custom words for a specific category."""
    result = await db.execute(
        select(CustomDictionary.word)
        .where(
            CustomDictionary.user_id == user_id,
            CustomDictionary.category_id == category_id,
        )
        .order_by(CustomDictionary.word)
    )
    return list(result.scalars().all())


async def get_user_level_dictionary_words(db: AsyncSession, user_id: int) -> list[str]:
    """Get user-level custom words (not category-specific or folder-specific)."""
    result = await db.execute(
        select(CustomDictionary.word)
        .where(
            CustomDictionary.user_id == user_id,
            CustomDictionary.category_id.is_(None),
            CustomDictionary.folder_path.is_(None),
        )
        .order_by(CustomDictionary.word)
    )
    return list(result.scalars().all())


async def get_folder_dictionary_words(
    db: AsyncSession, user_id: int, folder_path: str
) -> list[str]:
    """Get custom words for a specific folder path."""
    result = await db.execute(
        select(CustomDictionary.word)
        .where(
            CustomDictionary.user_id == user_id,
            CustomDictionary.folder_path == folder_path,
        )
        .order_by(CustomDictionary.word)
    )
    return list(result.scalars().all())


async def get_dictionary_word_by_id(
    db: AsyncSession, word_id: int, user_id: int
) -> Optional[CustomDictionary]:
    """Get a specific custom dictionary word by ID and user."""
    result = await db.execute(
        select(CustomDictionary).where(
            CustomDictionary.id == word_id, CustomDictionary.user_id == user_id
        )
    )
    return result.scalar_one_or_none()


async def get_dictionary_word_by_word(
    db: AsyncSession, word: str, user_id: int, category_id: Optional[int] = None, folder_path: Optional[str] = None
) -> Optional[CustomDictionary]:
    """Get a custom dictionary word by word text, user, and optional category or folder path."""
    query = select(CustomDictionary).where(
        CustomDictionary.word == word.lower(),
        CustomDictionary.user_id == user_id,
    )

    if folder_path is not None:
        query = query.where(CustomDictionary.folder_path == folder_path)
    elif category_id is not None:
        query = query.where(CustomDictionary.category_id == category_id)
    else:
        # User-level dictionary (no category or folder)
        query = query.where(
            CustomDictionary.category_id.is_(None),
            CustomDictionary.folder_path.is_(None)
        )

    result = await db.execute(query)
    return result.scalar_one_or_none()


async def create_dictionary_word(
    db: AsyncSession, word_data: CustomDictionaryCreate, user_id: int
) -> CustomDictionary:
    """Create a new custom dictionary word."""
    # Word is already normalized by the schema validator

    db_word = CustomDictionary(
        user_id=user_id,
        word=word_data.word,  # Already normalized by validator
        notes=word_data.notes,
        category_id=word_data.category_id,
        folder_path=word_data.folder_path,
    )
    db.add(db_word)
    await db.commit()
    await db.refresh(db_word)
    return db_word


async def update_dictionary_word(
    db: AsyncSession,
    word_id: int,
    user_id: int,
    word_data: CustomDictionaryUpdate,
) -> Optional[CustomDictionary]:
    """Update a custom dictionary word."""
    result = await db.execute(
        select(CustomDictionary).where(
            CustomDictionary.id == word_id, CustomDictionary.user_id == user_id
        )
    )
    db_word = result.scalar_one_or_none()
    if not db_word:
        return None

    # Update only the notes field
    if word_data.notes is not None:
        db_word.notes = word_data.notes

    await db.commit()
    await db.refresh(db_word)
    return db_word


async def delete_dictionary_word(db: AsyncSession, word_id: int, user_id: int) -> bool:
    """Delete a custom dictionary word."""
    result = await db.execute(
        select(CustomDictionary).where(
            CustomDictionary.id == word_id, CustomDictionary.user_id == user_id
        )
    )
    db_word = result.scalar_one_or_none()
    if not db_word:
        return False

    await db.delete(db_word)
    await db.commit()
    return True


async def delete_dictionary_word_by_word(
    db: AsyncSession, word: str, user_id: int, category_id: Optional[int] = None, folder_path: Optional[str] = None
) -> bool:
    """Delete a custom dictionary word by word text, user, and optional category or folder path."""
    query = select(CustomDictionary).where(
        CustomDictionary.word == word.lower(),
        CustomDictionary.user_id == user_id,
    )

    if folder_path is not None:
        query = query.where(CustomDictionary.folder_path == folder_path)
    elif category_id is not None:
        query = query.where(CustomDictionary.category_id == category_id)
    else:
        # User-level dictionary (no category or folder)
        query = query.where(
            CustomDictionary.category_id.is_(None),
            CustomDictionary.folder_path.is_(None)
        )

    result = await db.execute(query)
    db_word = result.scalar_one_or_none()
    if not db_word:
        return False

    await db.delete(db_word)
    await db.commit()
    return True


async def bulk_create_dictionary_words(
    db: AsyncSession, words: list[str], user_id: int, category_id: Optional[int] = None, folder_path: Optional[str] = None
) -> list[CustomDictionary]:
    """Bulk create custom dictionary words."""
    # Normalize words and filter out duplicates
    normalized_words = list(set(word.lower().strip() for word in words if word.strip()))

    # Check for existing words in the same scope (user-level, category-level, or folder-level)
    query = select(CustomDictionary.word).where(
        CustomDictionary.user_id == user_id,
        CustomDictionary.word.in_(normalized_words),
    )

    if folder_path is not None:
        query = query.where(CustomDictionary.folder_path == folder_path)
    elif category_id is not None:
        query = query.where(CustomDictionary.category_id == category_id)
    else:
        # User-level dictionary (no category or folder)
        query = query.where(
            CustomDictionary.category_id.is_(None),
            CustomDictionary.folder_path.is_(None)
        )

    result = await db.execute(query)
    existing_words = set(result.scalars().all())

    # Create only new words
    new_words = [word for word in normalized_words if word not in existing_words]

    if not new_words:
        return []

    db_words = [
        CustomDictionary(user_id=user_id, word=word, category_id=category_id, folder_path=folder_path)
        for word in new_words
    ]
    db.add_all(db_words)
    await db.commit()

    # Refresh all objects
    for db_word in db_words:
        await db.refresh(db_word)

    return db_words
