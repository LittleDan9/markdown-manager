"""Custom dictionary API routes."""
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.crud import custom_dictionary as crud_dictionary
from app.database import get_db
from app.models.user import User
from app.schemas.custom_dictionary import (
    CategoryDictionaryWordsResponse,
    CustomDictionaryCreate,
    CustomDictionaryResponse,
    CustomDictionaryUpdate,
    CustomDictionaryWordsResponse,
)

router = APIRouter()


@router.get("/words", response_model=CustomDictionaryWordsResponse)
async def get_custom_dictionary_words(
    category_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get custom dictionary words for the current user, optionally filtered by category."""
    if category_id is not None:
        words = await crud_dictionary.get_category_dictionary_words(
            db, int(current_user.id), category_id
        )
        return CustomDictionaryWordsResponse(words=words, count=len(words))
    else:
        words = await crud_dictionary.get_user_level_dictionary_words(
            db, int(current_user.id)
        )
        return CustomDictionaryWordsResponse(words=words, count=len(words))


@router.get("/words/all", response_model=CustomDictionaryWordsResponse)
async def get_all_custom_dictionary_words(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get all custom dictionary words for the current user (both user-level and category-level)."""
    words = await crud_dictionary.get_all_user_dictionary_words(
        db, int(current_user.id)
    )
    return CustomDictionaryWordsResponse(words=words, count=len(words))


@router.get(
    "/category/{category_id}/words", response_model=CategoryDictionaryWordsResponse
)
async def get_category_dictionary_words(
    category_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get custom dictionary words for a specific category."""
    words = await crud_dictionary.get_category_dictionary_words(
        db, int(current_user.id), category_id
    )
    return CategoryDictionaryWordsResponse(
        category_id=category_id, words=words, count=len(words)
    )


@router.get("/", response_model=list[CustomDictionaryResponse])
async def get_custom_dictionary_entries(
    category_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get custom dictionary entries with details for the current user, optionally filtered by category."""
    entries = await crud_dictionary.get_user_dictionary_words(
        db, int(current_user.id), category_id
    )
    return entries


@router.post(
    "/", response_model=CustomDictionaryResponse, status_code=status.HTTP_201_CREATED
)
async def add_custom_dictionary_word(
    word_data: CustomDictionaryCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Add a new word to the custom dictionary."""
    # Check if word already exists in the same scope (user-level or category-level)
    existing_word = await crud_dictionary.get_dictionary_word_by_word(
        db, word_data.word, int(current_user.id), word_data.category_id
    )
    if existing_word:
        scope = "category" if word_data.category_id else "user"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Word already exists in your {scope}-level custom dictionary",
        )

    new_word = await crud_dictionary.create_dictionary_word(
        db, word_data, int(current_user.id)
    )
    return new_word


@router.put("/{word_id}", response_model=CustomDictionaryResponse)
async def update_custom_dictionary_word(
    word_id: int,
    word_data: CustomDictionaryUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Update a custom dictionary word (notes only)."""
    updated_word = await crud_dictionary.update_dictionary_word(
        db, word_id, int(current_user.id), word_data
    )
    if not updated_word:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Word not found in your custom dictionary",
        )
    return updated_word


@router.delete("/{word_id}")
async def delete_custom_dictionary_word(
    word_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Delete a word from the custom dictionary."""
    success = await crud_dictionary.delete_dictionary_word(
        db, word_id, int(current_user.id)
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Word not found in your custom dictionary",
        )
    return {"message": "Word deleted successfully"}


@router.delete("/word/{word}")
async def delete_custom_dictionary_word_by_text(
    word: str,
    category_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Delete a word from the custom dictionary by word text and optional category."""
    success = await crud_dictionary.delete_dictionary_word_by_word(
        db, word, int(current_user.id), category_id
    )
    if not success:
        scope = "category" if category_id else "user"
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Word not found in your {scope}-level custom dictionary",
        )
    return {"message": "Word deleted successfully"}


@router.post("/bulk", response_model=list[CustomDictionaryResponse])
async def bulk_add_custom_dictionary_words(
    words: list[str],
    category_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Bulk add words to the custom dictionary."""
    if not words:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No words provided",
        )

    new_words = await crud_dictionary.bulk_create_dictionary_words(
        db, words, int(current_user.id), category_id
    )
    return new_words
