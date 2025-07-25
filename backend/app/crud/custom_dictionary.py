"""CRUD operations for custom dictionary."""
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.custom_dictionary import CustomDictionary
from app.schemas.custom_dictionary import CustomDictionaryCreate, CustomDictionaryUpdate


async def get_user_dictionary_words(
    db: AsyncSession, user_id: int
) -> list[CustomDictionary]:
    """Get all custom dictionary words for a user."""
    result = await db.execute(
        select(CustomDictionary).where(CustomDictionary.user_id == user_id)
    )
    return list(result.scalars().all())


async def get_user_dictionary_word_list(db: AsyncSession, user_id: int) -> list[str]:
    """Get list of custom words for a user (words only)."""
    result = await db.execute(
        select(CustomDictionary.word).where(CustomDictionary.user_id == user_id)
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
    db: AsyncSession, word: str, user_id: int
) -> Optional[CustomDictionary]:
    """Get a custom dictionary word by word text and user."""
    result = await db.execute(
        select(CustomDictionary).where(
            CustomDictionary.word == word.lower(),
            CustomDictionary.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def create_dictionary_word(
    db: AsyncSession, word_data: CustomDictionaryCreate, user_id: int
) -> CustomDictionary:
    """Create a new custom dictionary word."""
    # Normalize word to lowercase
    normalized_word = word_data.word.lower().strip()

    db_word = CustomDictionary(
        user_id=user_id,
        word=normalized_word,
        notes=word_data.notes,
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
    db: AsyncSession, word: str, user_id: int
) -> bool:
    """Delete a custom dictionary word by word text."""
    result = await db.execute(
        select(CustomDictionary).where(
            CustomDictionary.word == word.lower(),
            CustomDictionary.user_id == user_id,
        )
    )
    db_word = result.scalar_one_or_none()
    if not db_word:
        return False

    await db.delete(db_word)
    await db.commit()
    return True


async def bulk_create_dictionary_words(
    db: AsyncSession, words: list[str], user_id: int
) -> list[CustomDictionary]:
    """Bulk create custom dictionary words."""
    # Normalize words and filter out duplicates
    normalized_words = list(set(word.lower().strip() for word in words if word.strip()))

    # Check for existing words
    result = await db.execute(
        select(CustomDictionary.word).where(
            CustomDictionary.user_id == user_id,
            CustomDictionary.word.in_(normalized_words),
        )
    )
    existing_words = set(result.scalars().all())

    # Create only new words
    new_words = [word for word in normalized_words if word not in existing_words]

    if not new_words:
        return []

    db_words = [CustomDictionary(user_id=user_id, word=word) for word in new_words]
    db.add_all(db_words)
    await db.commit()

    # Refresh all objects
    for db_word in db_words:
        await db.refresh(db_word)

    return db_words
