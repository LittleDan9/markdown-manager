"""Custom dictionary API routes."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.crud import custom_dictionary as crud_dictionary
from app.database import get_db
from app.models.user import User
from app.schemas.custom_dictionary import (
    CustomDictionaryCreate,
    CustomDictionaryResponse,
    CustomDictionaryUpdate,
    CustomDictionaryWordsResponse,
)

router = APIRouter()


@router.get("/words", response_model=CustomDictionaryWordsResponse)
async def get_custom_dictionary_words(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get all custom dictionary words for the current user."""
    words = await crud_dictionary.get_user_dictionary_word_list(
        db, int(current_user.id)
    )
    return CustomDictionaryWordsResponse(words=words, count=len(words))


@router.get("/", response_model=list[CustomDictionaryResponse])
async def get_custom_dictionary_entries(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get all custom dictionary entries with details for the current user."""
    entries = await crud_dictionary.get_user_dictionary_words(db, int(current_user.id))
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
    # Check if word already exists
    existing_word = await crud_dictionary.get_dictionary_word_by_word(
        db, word_data.word, int(current_user.id)
    )
    if existing_word:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Word already exists in your custom dictionary",
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
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Delete a word from the custom dictionary by word text."""
    success = await crud_dictionary.delete_dictionary_word_by_word(
        db, word, int(current_user.id)
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Word not found in your custom dictionary",
        )
    return {"message": "Word deleted successfully"}


@router.post("/bulk", response_model=list[CustomDictionaryResponse])
async def bulk_add_custom_dictionary_words(
    words: list[str],
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
        db, words, int(current_user.id)
    )
    return new_words
