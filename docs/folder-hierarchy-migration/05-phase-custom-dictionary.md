# Phase 5: Custom Dictionary Migration

## Objective

Migrate the custom dictionary system from category-based to folder-based scoping, implementing the simplified two-level approach (user-level + root folder level) discussed in our planning.

## Duration

2-3 days

## Risk Level

Low - Dictionary migration is relatively straightforward and doesn't affect core functionality.

## Dictionary System Overview

### Current System Problems

1. **Category Dependency**: Custom dictionaries are tied to category IDs which we're phasing out
2. **Limited Scope**: Only user-level and category-level, no flexibility for different organizational schemes
3. **GitHub Gap**: No dictionary support for GitHub repositories

### New Simplified Approach

**Two Levels Only**:
1. **User-Level**: Personal dictionary that applies to all documents
2. **Root Folder Level**: Context-specific dictionary for root folders like `/Work`, `/Personal`, `/GitHub/repo-name`

This maps cleanly to user needs:
- Personal terms that apply everywhere (names, acronyms, etc.)
- Context-specific terms (project names, technical terms for specific work areas)

## Database Migration

### Update Custom Dictionary Model

**File**: `backend/app/models/custom_dictionary.py`

```python
from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseModel

if TYPE_CHECKING:
    from .category import Category
    from .user import User


class CustomDictionary(BaseModel):
    """Custom dictionary model for user-specific or root folder-specific spell checking words."""

    __tablename__ = "custom_dictionaries"
    __table_args__ = (
        # Ensure user_id is always provided
        CheckConstraint("user_id IS NOT NULL", name="ck_custom_dictionaries_user"),
        # Ensure either root_folder_path is provided OR it's NULL (user-global)
        CheckConstraint(
            "root_folder_path IS NULL OR LENGTH(root_folder_path) > 0",
            name="ck_custom_dictionaries_folder_path"
        ),
        # Unique words per user+root_folder combination
        UniqueConstraint(
            "user_id", "root_folder_path", "word",
            name="uq_user_folder_dictionary_word"
        ),
        # Keep old constraint during transition period
        UniqueConstraint("category_id", "word", name="uq_category_dictionary_word"),
    )

    # Foreign key to user (always required)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Root folder path for folder-specific dictionaries (NULL = user-global)
    root_folder_path: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True,
        comment="Root folder path (e.g., '/Work', '/GitHub/repo-name') or NULL for user-global"
    )

    # Legacy category support (for transition period only)
    category_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("categories.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # The custom word to add to dictionary
    word: Mapped[str] = mapped_column(String(100), nullable=False)

    # Optional notes about the word
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="custom_dictionary_words")
    category: Mapped["Category | None"] = relationship("Category", back_populates="custom_dictionary_words")

    @property
    def scope_type(self) -> str:
        """Get the type of dictionary scope."""
        if self.root_folder_path is None:
            return "user_global"
        elif self.root_folder_path.startswith("/GitHub/"):
            return "github_repository"
        else:
            return "local_folder"

    @property
    def scope_display_name(self) -> str:
        """Get user-friendly display name for dictionary scope."""
        if self.root_folder_path is None:
            return "Personal Dictionary"
        elif self.root_folder_path.startswith("/GitHub/"):
            # Extract repo name from GitHub path
            parts = self.root_folder_path.split('/')
            if len(parts) >= 3:
                return f"GitHub: {parts[2]} Dictionary"
            return "GitHub Dictionary"
        else:
            # Local folder
            folder_name = self.root_folder_path.strip('/').split('/')[0]
            return f"{folder_name} Dictionary"

    @classmethod
    def extract_root_folder(cls, folder_path: str) -> str:
        """Extract root folder from a full folder path."""
        if not folder_path or folder_path == '/':
            return '/'

        parts = [p for p in folder_path.split('/') if p]
        if not parts:
            return '/'

        # For GitHub paths, include repository name
        if parts[0] == 'GitHub' and len(parts) >= 2:
            return f"/GitHub/{parts[1]}"

        # For other paths, just the first level
        return f"/{parts[0]}"

    def __repr__(self) -> str:
        scope = self.root_folder_path or "global"
        return f"<CustomDictionary(user_id={self.user_id}, scope='{scope}', word='{self.word}')>"
```

### Migration Script

**File**: `backend/migrations/versions/migrate_custom_dictionaries.py`

```python
"""Migrate custom dictionaries to folder-based system

Revision ID: 004_custom_dictionary_folders
Revises: 003_github_folder_migration
Create Date: 2025-08-30 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text

revision = '004_custom_dictionary_folders'
down_revision = '003_github_folder_migration'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Migrate custom dictionaries to folder-based system."""

    # Step 1: Add root_folder_path column
    op.add_column('custom_dictionaries',
        sa.Column('root_folder_path', sa.String(255), nullable=True, index=True)
    )

    # Step 2: Migrate existing category-based dictionaries to root folder paths
    op.execute(text("""
        UPDATE custom_dictionaries
        SET root_folder_path = '/' || categories.name
        FROM categories
        WHERE custom_dictionaries.category_id = categories.id
        AND custom_dictionaries.category_id IS NOT NULL
    """))

    # Step 3: Add new unique constraint
    op.create_unique_constraint(
        'uq_user_folder_dictionary_word',
        'custom_dictionaries',
        ['user_id', 'root_folder_path', 'word']
    )

    # Step 4: Add check constraints
    op.create_check_constraint(
        'ck_custom_dictionaries_user',
        'custom_dictionaries',
        'user_id IS NOT NULL'
    )

    op.create_check_constraint(
        'ck_custom_dictionaries_folder_path',
        'custom_dictionaries',
        'root_folder_path IS NULL OR LENGTH(root_folder_path) > 0'
    )

    # Step 5: Make category_id nullable (transition period)
    op.alter_column('custom_dictionaries', 'category_id', nullable=True)


def downgrade() -> None:
    """Revert custom dictionary migration."""

    # Remove new constraints
    op.drop_constraint('uq_user_folder_dictionary_word', 'custom_dictionaries', type_='unique')
    op.drop_constraint('ck_custom_dictionaries_user', 'custom_dictionaries', type_='check')
    op.drop_constraint('ck_custom_dictionaries_folder_path', 'custom_dictionaries', type_='check')

    # Make category_id required again
    op.alter_column('custom_dictionaries', 'category_id', nullable=False)

    # Remove root_folder_path column
    op.drop_column('custom_dictionaries', 'root_folder_path')
```

## Spell Check Service Updates

### Enhanced Dictionary Resolution

**File**: `backend/app/services/spell_check_service.py`

```python
from typing import List, Set
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.custom_dictionary import CustomDictionary
from app.models.document import Document

class SpellCheckService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_applicable_dictionaries(
        self,
        user_id: int,
        document_folder_path: str
    ) -> List[CustomDictionary]:
        """Get all applicable custom dictionaries for a document."""

        # Extract root folder from document path
        root_folder = CustomDictionary.extract_root_folder(document_folder_path)

        # Query for user-global AND root folder dictionaries
        query = select(CustomDictionary).where(
            CustomDictionary.user_id == user_id,
            or_(
                CustomDictionary.root_folder_path.is_(None),  # User global
                CustomDictionary.root_folder_path == root_folder  # Root folder specific
            )
        )

        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_custom_words_for_document(
        self,
        user_id: int,
        document_folder_path: str
    ) -> Set[str]:
        """Get all applicable custom words for spell checking a document."""

        dictionaries = await self.get_applicable_dictionaries(user_id, document_folder_path)

        # Combine all words from applicable dictionaries
        custom_words = set()
        for dictionary in dictionaries:
            custom_words.add(dictionary.word.lower())

        return custom_words

    async def add_word_to_dictionary(
        self,
        user_id: int,
        word: str,
        root_folder_path: str = None,
        notes: str = None
    ) -> CustomDictionary:
        """Add a word to user's dictionary (global or folder-specific)."""

        # Check if word already exists in this scope
        existing_query = select(CustomDictionary).where(
            CustomDictionary.user_id == user_id,
            CustomDictionary.word == word,
            CustomDictionary.root_folder_path == root_folder_path
        )

        result = await self.session.execute(existing_query)
        existing = result.scalar_one_or_none()

        if existing:
            # Update notes if provided
            if notes:
                existing.notes = notes
                await self.session.commit()
            return existing

        # Create new dictionary entry
        dictionary_entry = CustomDictionary(
            user_id=user_id,
            word=word,
            root_folder_path=root_folder_path,
            notes=notes
        )

        self.session.add(dictionary_entry)
        await self.session.commit()
        await self.session.refresh(dictionary_entry)

        return dictionary_entry

    async def remove_word_from_dictionary(
        self,
        user_id: int,
        word: str,
        root_folder_path: str = None
    ) -> bool:
        """Remove a word from user's dictionary."""

        query = select(CustomDictionary).where(
            CustomDictionary.user_id == user_id,
            CustomDictionary.word == word,
            CustomDictionary.root_folder_path == root_folder_path
        )

        result = await self.session.execute(query)
        dictionary_entry = result.scalar_one_or_none()

        if dictionary_entry:
            await self.session.delete(dictionary_entry)
            await self.session.commit()
            return True

        return False

    async def get_dictionary_stats(self, user_id: int) -> dict:
        """Get statistics about user's custom dictionaries."""

        query = select(
            CustomDictionary.root_folder_path,
            func.count(CustomDictionary.id).label('word_count')
        ).where(
            CustomDictionary.user_id == user_id
        ).group_by(CustomDictionary.root_folder_path)

        result = await self.session.execute(query)
        stats = result.all()

        folder_stats = {}
        total_words = 0

        for folder_path, count in stats:
            if folder_path is None:
                folder_stats['user_global'] = count
            else:
                folder_stats[folder_path] = count
            total_words += count

        return {
            'total_words': total_words,
            'folder_stats': folder_stats,
            'dictionary_count': len(folder_stats)
        }
```

## API Endpoints for Dictionary Management

### New Dictionary Endpoints

**File**: `backend/app/routers/dictionaries.py`

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.dependencies import get_current_user, get_db_session
from app.models.user import User
from app.services.spell_check_service import SpellCheckService
from app.schemas.dictionary import (
    CustomDictionaryResponse,
    AddWordRequest,
    DictionaryStatsResponse
)

router = APIRouter(prefix="/dictionaries", tags=["dictionaries"])

@router.get("/", response_model=List[CustomDictionaryResponse])
async def get_user_dictionaries(
    folder_path: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Get user's custom dictionaries, optionally filtered by folder."""

    spell_service = SpellCheckService(db)

    if folder_path:
        # Get dictionaries applicable to specific folder
        dictionaries = await spell_service.get_applicable_dictionaries(
            current_user.id, folder_path
        )
    else:
        # Get all user dictionaries
        query = select(CustomDictionary).where(
            CustomDictionary.user_id == current_user.id
        )
        result = await db.execute(query)
        dictionaries = result.scalars().all()

    return [CustomDictionaryResponse.from_orm(d) for d in dictionaries]

@router.post("/words", response_model=CustomDictionaryResponse)
async def add_word_to_dictionary(
    word_data: AddWordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Add a word to user's dictionary."""

    spell_service = SpellCheckService(db)

    # Extract root folder if folder_path provided
    root_folder_path = None
    if word_data.folder_path:
        root_folder_path = CustomDictionary.extract_root_folder(word_data.folder_path)

    dictionary_entry = await spell_service.add_word_to_dictionary(
        current_user.id,
        word_data.word,
        root_folder_path,
        word_data.notes
    )

    return CustomDictionaryResponse.from_orm(dictionary_entry)

@router.delete("/words/{word}")
async def remove_word_from_dictionary(
    word: str,
    folder_path: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Remove a word from user's dictionary."""

    spell_service = SpellCheckService(db)

    # Extract root folder if folder_path provided
    root_folder_path = None
    if folder_path:
        root_folder_path = CustomDictionary.extract_root_folder(folder_path)

    success = await spell_service.remove_word_from_dictionary(
        current_user.id,
        word,
        root_folder_path
    )

    if not success:
        raise HTTPException(status_code=404, detail="Word not found in dictionary")

    return {"message": "Word removed successfully"}

@router.get("/stats", response_model=DictionaryStatsResponse)
async def get_dictionary_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Get statistics about user's custom dictionaries."""

    spell_service = SpellCheckService(db)
    stats = await spell_service.get_dictionary_stats(current_user.id)

    return DictionaryStatsResponse(**stats)

@router.get("/words/check")
async def check_words_in_document(
    folder_path: str = Query(...),
    words: List[str] = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Check which words are in user's custom dictionaries for a folder."""

    spell_service = SpellCheckService(db)
    custom_words = await spell_service.get_custom_words_for_document(
        current_user.id, folder_path
    )

    results = {}
    for word in words:
        results[word] = word.lower() in custom_words

    return {
        "folder_path": folder_path,
        "results": results,
        "custom_word_count": len(custom_words)
    }
```

### Request/Response Models

**File**: `backend/app/schemas/dictionary.py`

```python
from pydantic import BaseModel, Field, validator
from typing import Optional, Dict
from datetime import datetime

class AddWordRequest(BaseModel):
    word: str = Field(..., min_length=1, max_length=100)
    folder_path: Optional[str] = None  # If None, adds to user global dictionary
    notes: Optional[str] = None

    @validator('word')
    def validate_word(cls, v):
        # Basic word validation
        if not v.isalpha():
            raise ValueError("Word must contain only alphabetic characters")
        return v.lower()

class CustomDictionaryResponse(BaseModel):
    id: int
    word: str
    root_folder_path: Optional[str]
    notes: Optional[str]
    scope_type: str
    scope_display_name: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

    @classmethod
    def from_orm(cls, dictionary: CustomDictionary):
        return cls(
            id=dictionary.id,
            word=dictionary.word,
            root_folder_path=dictionary.root_folder_path,
            notes=dictionary.notes,
            scope_type=dictionary.scope_type,
            scope_display_name=dictionary.scope_display_name,
            created_at=dictionary.created_at,
            updated_at=dictionary.updated_at
        )

class DictionaryStatsResponse(BaseModel):
    total_words: int
    folder_stats: Dict[str, int]
    dictionary_count: int
```

## Frontend Integration

### SpellCheck Service Updates

**File**: `frontend/src/services/editor/SpellCheckService.js`

Update the SpellCheckService to use folder paths instead of category IDs:

```javascript
export class SpellCheckService {
  constructor(chunkSize = 1000) {
    this.speller = null;
    this.poolSize = Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2));
    this.workerPool = new SpellCheckWorkerPool(this.poolSize);
    this.chunkSize = chunkSize;
    this.progressiveCheckState = {
      isRunning: false,
      currentChunk: 0,
      totalChunks: 0,
      results: [],
      onProgress: null,
      onComplete: null
    };
  }

  async init() {
    if (this.speller) return;
    try {
      const [affResponse, dicResponse] = await Promise.all([
        fetch('/dictionary/index.aff'),
        fetch('/dictionary/index.dic')
      ]);
      const aff = await affResponse.text();
      const dic = await dicResponse.text();

      await this.workerPool.init();
    } catch (err) {
      console.error('SpellCheckService init error', err);
    }
  }

  async scan(text, onProgress = () => {}, folderPath = null){
    await this.init();

    const bucket = chunkTextWithOffsets(text, this.chunkSize);
    const chunks = bucket.map(chunk => ({
      text: chunk.text,
      startOffset: chunk.offset,
    }));

    this.workerPool._chunkOffsets = chunks.map(c => c.offset);

    // Get applicable custom words for this folder path
    const customWords = DictionaryService.getAllApplicableWords(folderPath);

    const issues = await this.workerPool.runSpellCheckOnChunks(
      chunks,
      customWords,
      onProgress
    );

    return issues;
  }

  /**
   * Get custom words for backward compatibility
   * @param {string} [folderPath] - Optional folder path
   * @returns {string[]} Array of custom words
   */
  getCustomWords(folderPath = null) {
    return DictionaryService.getAllApplicableWords(folderPath);
  }

  /**
   * Add a custom word - delegates to DictionaryService
   * @param {string} word - Word to add
   * @param {string} [folderPath] - Optional folder path
   */
  addCustomWord(word, folderPath = null) {
    if (folderPath) {
      DictionaryService.addFolderWord(folderPath, word);
    } else {
      DictionaryService.addCustomWord(word);
    }
  }

  /**
   * Remove a custom word - delegates to DictionaryService
   * @param {string} word - Word to remove
   * @param {string} [folderPath] - Optional folder path
   */
  removeCustomWord(word, folderPath = null) {
    if (folderPath) {
      DictionaryService.removeFolderWord(folderPath, word);
    } else {
      DictionaryService.removeCustomWord(word);
    }
  }
}

export default new SpellCheckService();
```

### Enhanced Dictionary Service

**File**: `frontend/src/services/utilities/dictionary.js`

Add folder-based methods while maintaining backward compatibility:

```javascript
class DictionaryService {
  constructor() {
    this.CUSTOM_WORDS_KEY = 'customDictionary';
    this.FOLDER_WORDS_KEY = 'folderCustomDictionary';  // New key
    this.CATEGORY_WORDS_KEY = 'categoryCustomDictionary';  // Legacy key
    this.customWords = new Set();
    this.folderWords = new Map(); // Map<folderPath, Set<word>>
    this.categoryWords = new Map(); // Legacy - Map<categoryId, Set<word>>
    this.loadCustomWordsFromStorage();
    this.loadFolderWordsFromStorage();
    this.loadCategoryWordsFromStorage(); // Legacy support
  }

  /**
   * Load folder words from localStorage
   */
  loadFolderWordsFromStorage() {
    try {
      const stored = localStorage.getItem(this.FOLDER_WORDS_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.folderWords = new Map();
        for (const [folderPath, words] of Object.entries(data)) {
          this.folderWords.set(folderPath, new Set(words));
        }
      }
    } catch (err) {
      console.error('Error loading folder words from storage:', err);
    }
  }

  /**
   * Save folder words to localStorage
   */
  saveFolderWordsToStorage() {
    try {
      const data = {};
      for (const [folderPath, wordsSet] of this.folderWords.entries()) {
        data[folderPath] = Array.from(wordsSet);
      }
      localStorage.setItem(this.FOLDER_WORDS_KEY, JSON.stringify(data));
    } catch (err) {
      console.error('Error saving folder words to storage:', err);
    }
  }

  /**
   * Extract root folder from full folder path
   * @param {string} folderPath - Full folder path
   * @returns {string} Root folder path
   */
  extractRootFolder(folderPath) {
    if (!folderPath || folderPath === '/') {
      return '/';
    }

    const parts = folderPath.split('/').filter(p => p);
    if (!parts.length) {
      return '/';
    }

    // For GitHub paths, include repository name
    if (parts[0] === 'GitHub' && parts.length >= 2) {
      return `/GitHub/${parts[1]}`;
    }

    // For other paths, just the first level
    return `/${parts[0]}`;
  }

  /**
   * Add a word to the folder-specific custom dictionary
   * @param {string} folderPath - The folder path
   * @param {string} word - The word to add
   */
  addFolderWord(folderPath, word) {
    const rootFolder = this.extractRootFolder(folderPath);
    const normalizedWord = word.toLowerCase().trim();

    if (normalizedWord && rootFolder) {
      if (!this.folderWords.has(rootFolder)) {
        this.folderWords.set(rootFolder, new Set());
      }
      this.folderWords.get(rootFolder).add(normalizedWord);
      this.saveFolderWordsToStorage();
      window.dispatchEvent(new CustomEvent('dictionary:folderWordAdded', {
        detail: { folderPath: rootFolder, word: normalizedWord }
      }));
    }
  }

  /**
   * Remove a word from the folder-specific custom dictionary
   * @param {string} folderPath - The folder path
   * @param {string} word - The word to remove
   */
  removeFolderWord(folderPath, word) {
    const rootFolder = this.extractRootFolder(folderPath);
    const normalizedWord = word.toLowerCase().trim();

    if (this.folderWords.has(rootFolder)) {
      this.folderWords.get(rootFolder).delete(normalizedWord);
      if (this.folderWords.get(rootFolder).size === 0) {
        this.folderWords.delete(rootFolder);
      }
      this.saveFolderWordsToStorage();
      window.dispatchEvent(new CustomEvent('dictionary:folderWordRemoved', {
        detail: { folderPath: rootFolder, word: normalizedWord }
      }));
    }
  }

  /**
   * Get words for a specific folder
   * @param {string} folderPath - The folder path
   * @returns {string[]}
   */
  getFolderWords(folderPath) {
    const rootFolder = this.extractRootFolder(folderPath);
    if (!this.folderWords.has(rootFolder)) {
      return [];
    }
    return Array.from(this.folderWords.get(rootFolder));
  }

  /**
   * Get all applicable custom words for spell checking
   * Combines user-level words with folder-specific words
   * @param {string} [folderPath] - Current document's folder path
   * @returns {string[]}
   */
  getAllApplicableWords(folderPath = null) {
    const userWords = this.getCustomWords();

    if (!folderPath) {
      return userWords;
    }

    const rootFolder = this.extractRootFolder(folderPath);
    const folderWords = this.getFolderWords(rootFolder);

    // Combine and deduplicate
    return [...new Set([...userWords, ...folderWords])];
  }

  /**
   * Migrate from category-based to folder-based system
   * @param {Array} categories - Available categories for mapping
   */
  migrateCategoryWordsToFolders(categories = []) {
    if (!this.categoryWords || this.categoryWords.size === 0) {
      return;
    }

    console.log('Migrating category words to folder system...');

    // Create mapping from category ID to folder path
    const categoryToFolderMap = new Map();
    for (const category of categories) {
      categoryToFolderMap.set(category.id.toString(), `/${category.name}`);
    }

    // Migrate category words to folder words
    for (const [categoryId, words] of this.categoryWords.entries()) {
      const folderPath = categoryToFolderMap.get(categoryId) || `/Category-${categoryId}`;

      if (!this.folderWords.has(folderPath)) {
        this.folderWords.set(folderPath, new Set());
      }

      // Add all category words to folder
      for (const word of words) {
        this.folderWords.get(folderPath).add(word);
      }
    }

    // Save migrated data and cleanup
    this.saveFolderWordsToStorage();
    this.categoryWords.clear();
    localStorage.removeItem(this.CATEGORY_WORDS_KEY);

    console.log(`Migrated category words to ${this.folderWords.size} folders`);
  }

  /**
   * Enhanced sync with backend - now supports folder-based dictionaries
   */
  async syncAfterLogin() {
    try {
      console.log('Syncing custom dictionary after login...');

      const { token, isAuthenticated } = AuthService.getAuthState();
      if (!isAuthenticated || !token) {
        console.log('No auth token found, skipping backend sync');
        return this.getCustomWords();
      }

      // Get user-level words from backend
      const userResponse = await customDictionaryApi.getWords();
      const backendUserWords = userResponse.words || [];
      const mergedUserWords = this.syncWithBackend(backendUserWords);

      // Upload any local user words not on backend
      const localUserWords = this.getCustomWords();
      const userWordsToUpload = localUserWords.filter(word =>
        !backendUserWords.includes(word.toLowerCase())
      );

      if (userWordsToUpload.length > 0) {
        console.log(`Uploading ${userWordsToUpload.length} local user words to backend...`);
        await customDictionaryApi.bulkAddWords(userWordsToUpload);
      }

      // Migrate and sync folder-level dictionaries
      await this.syncFolderWords();

      console.log(`Dictionary sync complete. Total user words: ${mergedUserWords.length}`);
      return mergedUserWords;
    } catch (error) {
      console.error('Failed to sync custom dictionary:', error);
      return this.getCustomWords();
    }
  }

  /**
   * Sync folder-level words with backend
   */
  async syncFolderWords() {
    try {
      // Migrate legacy category words if they exist
      if (this.categoryWords.size > 0) {
        const categories = await categoriesApi.getCategories();
        this.migrateCategoryWordsToFolders(categories);
      }

      // Get all folder dictionaries from backend
      // Implementation will depend on the backend API structure
      console.log('Syncing folder dictionaries with backend...');

      // For now, upload local folder words to backend
      for (const [folderPath, words] of this.folderWords.entries()) {
        if (words.size > 0) {
          try {
            await customDictionaryApi.bulkAddWords(Array.from(words), null, folderPath);
          } catch (error) {
            console.error(`Failed to sync folder ${folderPath}:`, error);
          }
        }
      }

    } catch (error) {
      console.error('Failed to sync folder dictionaries:', error);
    }
  }

  // ... keep existing methods for backward compatibility during transition ...
}

export default new DictionaryService();
```

### Dictionary Management Component

**File**: `frontend/src/components/dictionary/DictionaryManager.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Table, Badge, Alert, Tabs, Tab } from 'react-bootstrap';
import { dictionaryAPI } from '../../api/dictionaries';
import { useNotification } from '../../contexts/NotificationContext';

export default function DictionaryManager({ show, onHide, currentFolderPath = null }) {
  const [dictionaries, setDictionaries] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('global');
  const [newWord, setNewWord] = useState('');
  const [newWordNotes, setNewWordNotes] = useState('');
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    if (show) {
      loadDictionaries();
      loadStats();
    }
  }, [show, currentFolderPath]);

  const loadDictionaries = async () => {
    try {
      setLoading(true);
      const data = await dictionaryAPI.getUserDictionaries(currentFolderPath);
      setDictionaries(data);
    } catch (error) {
      showError('Failed to load dictionaries');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await dictionaryAPI.getDictionaryStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load dictionary stats:', error);
    }
  };

  const handleAddWord = async (isGlobal = true) => {
    if (!newWord.trim()) return;

    try {
      const folderPath = isGlobal ? null : currentFolderPath;
      await dictionaryAPI.addWord(newWord.trim(), folderPath, newWordNotes.trim() || null);

      setNewWord('');
      setNewWordNotes('');
      loadDictionaries();
      loadStats();

      showSuccess(`Word "${newWord}" added to ${isGlobal ? 'personal' : 'folder'} dictionary`);
    } catch (error) {
      showError('Failed to add word to dictionary');
    }
  };

  const handleRemoveWord = async (word, rootFolderPath) => {
    try {
      await dictionaryAPI.removeWord(word, rootFolderPath);
      loadDictionaries();
      loadStats();
      showSuccess(`Word "${word}" removed from dictionary`);
    } catch (error) {
      showError('Failed to remove word from dictionary');
    }
  };

  const globalDictionaries = dictionaries.filter(d => d.root_folder_path === null);
  const folderDictionaries = dictionaries.filter(d => d.root_folder_path !== null);

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Custom Spell Check Dictionaries</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {stats && (
          <Alert variant="info">
            <strong>Dictionary Stats:</strong> {stats.total_words} total words across {stats.dictionary_count} dictionaries
          </Alert>
        )}

        <Tabs activeKey={activeTab} onSelect={setActiveTab} className="mb-3">
          <Tab eventKey="global" title={`Personal Dictionary (${globalDictionaries.length})`}>
            <Form className="mb-3">
              <Form.Group>
                <Form.Label>Add Word to Personal Dictionary</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Enter word..."
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddWord(true)}
                />
                <Form.Text className="text-muted">
                  Personal dictionary words apply to all documents
                </Form.Text>
              </Form.Group>
              <Form.Group className="mt-2">
                <Form.Control
                  type="text"
                  placeholder="Optional notes..."
                  value={newWordNotes}
                  onChange={(e) => setNewWordNotes(e.target.value)}
                />
              </Form.Group>
              <Button
                variant="primary"
                onClick={() => handleAddWord(true)}
                disabled={!newWord.trim()}
                className="mt-2"
              >
                Add to Personal Dictionary
              </Button>
            </Form>

            <Table striped bordered hover>
              <thead>
                <tr>
                  <th>Word</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {globalDictionaries.map(dict => (
                  <tr key={dict.id}>
                    <td>{dict.word}</td>
                    <td>{dict.notes || '-'}</td>
                    <td>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => handleRemoveWord(dict.word, null)}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Tab>

          <Tab eventKey="folder" title={`Folder Dictionaries (${folderDictionaries.length})`}>
            {currentFolderPath && (
              <Form className="mb-3">
                <Form.Group>
                  <Form.Label>Add Word to Current Folder Dictionary</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Enter word..."
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddWord(false)}
                  />
                  <Form.Text className="text-muted">
                    Words will apply to all documents in: {currentFolderPath}
                  </Form.Text>
                </Form.Group>
                <Button
                  variant="primary"
                  onClick={() => handleAddWord(false)}
                  disabled={!newWord.trim()}
                  className="mt-2"
                >
                  Add to Folder Dictionary
                </Button>
              </Form>
            )}

            <Table striped bordered hover>
              <thead>
                <tr>
                  <th>Word</th>
                  <th>Scope</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {folderDictionaries.map(dict => (
                  <tr key={dict.id}>
                    <td>{dict.word}</td>
                    <td>
                      <Badge variant={dict.scope_type === 'github_repository' ? 'info' : 'secondary'}>
                        {dict.scope_display_name}
                      </Badge>
                    </td>
                    <td>{dict.notes || '-'}</td>
                    <td>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => handleRemoveWord(dict.word, dict.root_folder_path)}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Tab>
        </Tabs>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
```

### API Client Updates

**File**: `frontend/src/api/dictionaries.js`

```javascript
import apiClient from './client';

export const dictionaryAPI = {
  async getUserDictionaries(folderPath = null) {
    const params = folderPath ? { folder_path: folderPath } : {};
    const response = await apiClient.get('/dictionaries/', { params });
    return response.data;
  },

  async addWord(word, folderPath = null, notes = null) {
    const response = await apiClient.post('/dictionaries/words', {
      word,
      folder_path: folderPath,
      notes
    });
    return response.data;
  },

  async removeWord(word, folderPath = null) {
    const params = folderPath ? { folder_path: folderPath } : {};
    const response = await apiClient.delete(`/dictionaries/words/${encodeURIComponent(word)}`, { params });
    return response.data;
  },

  async getDictionaryStats() {
    const response = await apiClient.get('/dictionaries/stats');
    return response.data;
  },

  async checkWords(folderPath, words) {
    const response = await apiClient.get('/dictionaries/words/check', {
      params: {
        folder_path: folderPath,
        words: words
      }
    });
    return response.data;
  }
};
```

## Testing

### Dictionary Migration Test

**File**: `backend/tests/test_dictionary_migration.py`

```python
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.custom_dictionary import CustomDictionary
from app.models.category import Category
from app.services.spell_check_service import SpellCheckService

class TestDictionaryMigration:

    async def test_root_folder_extraction(self):
        """Test root folder extraction logic."""
        test_cases = [
            ("/Work/Projects/Client-A", "/Work"),
            ("/GitHub/my-repo/main/docs", "/GitHub/my-repo"),
            ("/Personal", "/Personal"),
            ("/", "/"),
            ("", "/"),
        ]

        for folder_path, expected in test_cases:
            result = CustomDictionary.extract_root_folder(folder_path)
            assert result == expected, f"Failed for {folder_path}: got {result}, expected {expected}"

    async def test_dictionary_scoping(self, db_session: AsyncSession, test_user):
        """Test that dictionaries are properly scoped."""
        spell_service = SpellCheckService(db_session)

        # Add words to different scopes
        await spell_service.add_word_to_dictionary(test_user.id, "globalword")  # User global
        await spell_service.add_word_to_dictionary(test_user.id, "workword", "/Work")  # Work folder
        await spell_service.add_word_to_dictionary(test_user.id, "gitword", "/GitHub/my-repo")  # GitHub repo

        # Test Work folder gets both global and work words
        work_words = await spell_service.get_custom_words_for_document(
            test_user.id, "/Work/Projects/file.md"
        )
        assert "globalword" in work_words
        assert "workword" in work_words
        assert "gitword" not in work_words

        # Test GitHub folder gets both global and GitHub words
        github_words = await spell_service.get_custom_words_for_document(
            test_user.id, "/GitHub/my-repo/main/README.md"
        )
        assert "globalword" in github_words
        assert "gitword" in github_words
        assert "workword" not in github_words
```

## Success Criteria

- [ ] Custom dictionaries migrated from category-based to folder-based system
- [ ] Two-level dictionary scoping works (user-global + root folder)
- [ ] GitHub repositories get their own dictionary scopes
- [ ] Migration preserves existing dictionary words
- [ ] Spell check service correctly resolves applicable dictionaries
- [ ] API endpoints work for dictionary management
- [ ] Frontend dictionary manager supports new system
- [ ] Performance is acceptable for dictionary lookups

## Next Phase

Phase 6 will integrate the new unified file browser into the frontend UI, replacing the old FileOpenModal and updating the DocumentContext to work with folder-based operations.
