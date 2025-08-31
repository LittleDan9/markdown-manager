# SpellCheck Service Migration Analysis

## Overview

This document analyzes the SpellCheck system components that need to be updated for the folder hierarchy migration. The analysis covers the complete dictionary management system, from backend models to frontend UI components.

---

## Current Architecture

### Backend Components

#### Models
- **`custom_dictionary.py`** - SQLAlchemy model linking words to users and categories
- Uses `category_id` foreign key for category-specific dictionaries
- Supports both user-level (category_id=null) and category-level dictionaries

#### API Router
- **`custom_dictionary.py`** - API endpoints for dictionary CRUD operations
- All endpoints use `category_id` parameter for scope selection
- Supports bulk operations and word filtering by category

### Frontend Components

#### Core Services
- **`SpellCheckService.js`** - Main spell check orchestration service
- **`SpellCheckWorkerPool.js`** - Web worker pool for parallel spell checking
- **`dictionary.js`** - Dictionary management service with localStorage sync

#### UI Components
- **`DictionaryTab.jsx`** - Main dictionary management interface
- **`DictionaryCategorySelector.jsx`** - Category scope selector
- **`DictionaryAddWordForm.jsx`** - Word addition form

#### Hooks
- **`useDictionaryState.js`** - State management for dictionary entries and categories
- **`useDictionaryOperations.js`** - CRUD operations for dictionary words

---

## Migration Requirements

### Phase 1: Extract Unified Browser
**Impact**: None - dictionary system is independent of browser interface

### Phase 2: Database Migration

#### Backend Model Changes
**File**: `backend/app/models/custom_dictionary.py`

**Current Schema**:
```python
# Foreign key to category (for category-level dictionaries)
category_id: Mapped[int | None] = mapped_column(
    Integer,
    ForeignKey("categories.id", ondelete="CASCADE"),
    nullable=True,
    index=True,
)
```

**Required Changes**:
```python
# Add folder_path field for folder-based dictionaries
folder_path: Mapped[str | None] = mapped_column(
    String(500),  # Support deep folder paths
    nullable=True,
    index=True,
)

# Keep category_id during transition period
category_id: Mapped[int | None] = mapped_column(
    Integer,
    ForeignKey("categories.id", ondelete="CASCADE"),
    nullable=True,
    index=True,
)
```

**Migration Strategy**:
1. Add `folder_path` column with nullable constraint
2. Migrate existing category-based words to folder paths
3. Update constraints to allow either `category_id` OR `folder_path`
4. Eventually remove `category_id` in Phase 6

### Phase 3: Backend API Integration

#### API Router Updates
**File**: `backend/app/routers/custom_dictionary.py`

**Current Endpoints**:
- `GET /dictionary/words?category_id={id}`
- `POST /dictionary/` with `category_id` in body
- `GET /dictionary/category/{category_id}/words`

**Required Changes**:
- `GET /dictionary/words?folder_path={path}` (replace category_id)
- `POST /dictionary/` with `folder_path` in body
- `GET /dictionary/folder/{folder_path}/words` (replace category endpoint)
- `GET /dictionary/words/all` (aggregate user + folder words)

**New Endpoints Needed**:
```python
@router.get("/folder/{folder_path:path}/words")
async def get_folder_dictionary_words(
    folder_path: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get custom dictionary words for a specific folder."""
    # Implementation details...
```

### Phase 4: GitHub Integration
**Impact**: Minimal - GitHub documents will inherit folder-based dictionary scoping

### Phase 5: Custom Dictionary System

#### Frontend Service Updates
**File**: `frontend/src/services/utilities/dictionary.js`

**Current Methods**:
```javascript
addCategoryWord(categoryId, word)
removeCategoryWord(categoryId, word)
getCategoryWords(categoryId)
getAllApplicableWords(categoryId)
```

**Required Changes**:
```javascript
// Replace category methods with folder methods
addFolderWord(folderPath, word)
removeFolderWord(folderPath, word)
getFolderWords(folderPath)
getAllApplicableWords(folderPath)

// Update localStorage keys
this.FOLDER_WORDS_KEY = 'folderCustomDictionary';
this.folderWords = new Map(); // Map<folderPath, Set<word>>
```

**Migration Strategy**:
1. Add folder methods alongside category methods
2. Update localStorage structure to support folder paths
3. Migrate category data to folder structure during sync
4. Remove category methods in Phase 6

#### SpellCheck Service Updates
**File**: `frontend/src/services/editor/SpellCheckService.js`

**Current Interface**:
```javascript
async scan(text, onProgress = () => {}, categoryId = null)
getCustomWords(categoryId = null)
addCustomWord(word, categoryId = null)
removeCustomWord(word, categoryId = null)
```

**Required Changes**:
```javascript
// Replace categoryId with folderPath
async scan(text, onProgress = () => {}, folderPath = null)
getCustomWords(folderPath = null)
addCustomWord(word, folderPath = null)
removeCustomWord(word, folderPath = null)
```

### Phase 6: Frontend Integration

#### UI Component Updates

**File**: `frontend/src/components/modals/DictionaryCategorySelector.jsx`
**Rename to**: `frontend/src/components/modals/DictionaryFolderSelector.jsx`

**Current Interface**:
```jsx
<DictionaryCategorySelector
  categories={categories}
  selectedCategory={selectedCategory}
  onCategoryChange={setSelectedCategory}
/>
```

**New Interface**:
```jsx
<DictionaryFolderSelector
  folders={folders}
  selectedFolder={selectedFolder}
  onFolderChange={setSelectedFolder}
/>
```

**File**: `frontend/src/hooks/dictionary/useDictionaryState.js`

**State Changes**:
```javascript
// Replace category state with folder state
const [folders, setFolders] = useState([]);
const [selectedFolder, setSelectedFolder] = useState('');

// Update methods
const loadFolders = useCallback(async () => {
  // Load folder hierarchy instead of categories
});

const handleFolderChange = useCallback((folderPath) => {
  setSelectedFolder(folderPath);
});
```

#### Hook Updates
**File**: `frontend/src/hooks/dictionary/useDictionaryOperations.js`

**Parameter Changes**:
```javascript
// Replace selectedCategory with selectedFolder
const addWord = useCallback(async (word, notes = '') => {
  const folderPath = selectedFolder || null;
  await DictionaryService.addWord(word.trim(), notes.trim() || null, folderPath);
});
```

---

## File Rename Requirements

### Phase 5 (Custom Dictionary System)
No file renames yet - maintain backward compatibility

### Phase 6 (Frontend Integration)

#### Component Renames
- `DictionaryCategorySelector.jsx` → `DictionaryFolderSelector.jsx`
- Update all imports and references

#### Service Method Renames
- All `category` methods in `dictionary.js` → `folder` methods
- Update localStorage keys and data structures

#### API Client Updates
- `customDictionaryApi.js` - Update all endpoints to use folder paths
- Remove category-based method signatures

---

## Migration Considerations

### Data Migration Strategy

#### Category to Folder Mapping
```javascript
// Example mapping strategy
const categoryToFolderMap = {
  'Technical': '/Work/Technical',
  'Personal': '/Personal',
  'General': '/' // Root folder
};
```

#### Backward Compatibility
- Phase 2-5: Support both `category_id` and `folder_path` parameters
- Phase 6: Remove all category support

#### Local Storage Migration
```javascript
// Migrate localStorage data structure
migrateCategoryWordsToFolders() {
  const oldCategoryWords = localStorage.getItem(this.CATEGORY_WORDS_KEY);
  if (oldCategoryWords) {
    const categoryData = JSON.parse(oldCategoryWords);
    const folderData = {};

    for (const [categoryId, words] of Object.entries(categoryData)) {
      const folderPath = this.mapCategoryToFolder(categoryId);
      folderData[folderPath] = words;
    }

    localStorage.setItem(this.FOLDER_WORDS_KEY, JSON.stringify(folderData));
    localStorage.removeItem(this.CATEGORY_WORDS_KEY);
  }
}
```

### UI/UX Considerations

#### Folder Hierarchy Display
- Replace flat category dropdown with hierarchical folder tree
- Support folder path autocompletion
- Show folder breadcrumbs in dictionary scope

#### Dictionary Scope Inheritance
- Folder-specific words apply to all subfolders
- User-level words apply globally
- Clear visual indication of scope hierarchy

#### Migration UX
- Show migration progress during login sync
- Provide clear messaging about category → folder transition
- Allow users to review migrated data

---

## Testing Requirements

### Backend Tests
- Test folder path validation and sanitization
- Test folder hierarchy inheritance logic
- Test migration from category_id to folder_path

### Frontend Tests
- Test folder selection UI components
- Test localStorage migration logic
- Test spell check service with folder paths
- Test dictionary sync after folder migration

### Integration Tests
- Test complete workflow: add word → spell check → folder inheritance
- Test backward compatibility during transition phases
- Test error handling for invalid folder paths

---

## Performance Considerations

### Database Indexing
- Add index on `folder_path` column for fast lookups
- Consider compound index on (`user_id`, `folder_path`)

### Frontend Caching
- Cache folder hierarchy to avoid repeated API calls
- Implement incremental loading for deep folder structures

### Spell Check Optimization
- Pre-compile applicable words for current folder context
- Use folder path normalization to optimize lookups

---

## Summary

The SpellCheck system migration requires updates across:
- **1 backend model** (add folder_path column)
- **1 backend router** (add folder-based endpoints)
- **1 frontend API client** (update endpoint calls)
- **2 core services** (SpellCheckService, DictionaryService)
- **4 UI components** (1 rename required)
- **2 hooks** (update state management)

**Critical Timeline**: Dictionary system must maintain backward compatibility through Phase 5, with complete migration in Phase 6.

**Risk Mitigation**: Implement dual parameter support early to ensure smooth transition and prevent data loss during migration.
