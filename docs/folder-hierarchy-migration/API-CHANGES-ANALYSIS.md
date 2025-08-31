# API Changes Analysis for Folder Hierarchy Migration

## Overview

This document provides a detailed analysis of the specific API endpoint changes and frontend API file updates required for each phase of the folder hierarchy migration. The analysis correlates backend router modifications with frontend API client updates.

---

## Phase 1: Extract Unified Browser

### Backend Changes Required

#### `/app/routers/documents/router.py`

- **GET `/documents`** - Add `folder_path` query parameter alongside existing `category` parameter
- **POST `/documents`** - Add `folder_path` field to request body (optional, defaults to root)
- Update document filtering logic to support both category and folder_path filtering

#### `/app/routers/github/repositories.py`

- **GET `/repositories/{repo_id}/contents`** - Already supports path-based browsing (✅ No changes needed)
- **GET `/repositories/{repo_id}/branches`** - Already functional (✅ No changes needed)

### Frontend API Changes Required

#### `frontend/src/api/documentsApi.js`

- **`getAllDocuments()`** - Add optional `folderPath` parameter
- **`createDocument()`** - Add optional `folderPath` parameter
- Update method signatures to support folder-based filtering

#### `frontend/src/api/gitHubApi.js`

- **`getRepositoryContents()`** - Already supports path parameter (✅ No changes needed)
- **`getRepositoryFiles()`** - Already supports path parameter (✅ No changes needed)

### New API Files Needed

- `frontend/src/api/browserApi.js` - Unified data provider interface

---

## Phase 2: Database Migration

### Backend Changes Required

#### Database Schema (No API changes, but affects all endpoints)
- Documents table: Add `folder_path` column
- Categories table: Preparation for eventual deprecation

#### `/app/routers/documents/router.py`
- **GET `/documents`** - Update to use `folder_path` filtering as primary method
- **POST `/documents`** - Make `folder_path` the primary organization field
- **PUT `/documents/{id}`** - Support `folder_path` updates

#### `/app/routers/documents/crud.py`
- **GET `/documents/{id}`** - Return `folder_path` in response
- **PUT `/documents/{id}`** - Accept `folder_path` in updates
- No structural endpoint changes, but response schemas change

### Frontend API Changes Required

#### `frontend/src/api/documentsApi.js`
- **`getAllDocuments()`** - Primary parameter becomes `folderPath`, `category` becomes secondary
- **`createDocument()`** - Primary parameter becomes `folderPath`
- **`updateDocument()`** - Add `folderPath` update support
- **`getDocument()`** - Response includes `folder_path` field

---

## Phase 3: Backend API Integration

### Backend Changes Required

#### `/app/routers/documents/router.py`
- **GET `/documents`** - Remove category-based filtering, use folder_path exclusively
- **POST `/documents`** - Remove `category_id` field, use `folder_path` exclusively
- **GET `/documents/folders`** - NEW ENDPOINT: Get folder hierarchy tree
- **POST `/documents/folders`** - NEW ENDPOINT: Create folder structure

#### `/app/routers/github/sync.py`
- **POST `/github/documents/import`** - Update to use folder-based categorization instead of artificial categories
- **GET `/documents/{id}/status`** - Update GitHub sync to work with folder structure

#### `/app/routers/documents/categories.py` (Phase out)
- Mark all endpoints as deprecated
- Add warning headers to responses

### Frontend API Changes Required

#### `frontend/src/api/documentsApi.js`
- **Remove**: `getCategories()`, `addCategory()`, `deleteCategory()` methods
- **Add**: `getFolders()`, `createFolder()`, `deleteFolder()` methods
- **Update**: All document methods to use folder paths exclusively

#### `frontend/src/api/gitHubApi.js`
- **`importDocument()`** - Update to use folder-based organization
- **`getDocumentStatus()`** - Support folder-based sync status

### New API Files Needed
- `frontend/src/api/foldersApi.js` - Dedicated folder management

---

## Phase 4: GitHub Integration

### Backend Changes Required

#### `/app/routers/github/repositories.py`
- **GET `/repositories/{repo_id}/contents`** - Enhanced response with folder metadata
- **GET `/repositories/tree`** - NEW ENDPOINT: Get full repository tree structure
- **POST `/repositories/cache/refresh`** - Enhanced caching for folder structures

#### `/app/routers/github/files.py`
- **GET `/repositories/{repo_id}/browse`** - Update to return folder-aware file info
- **GET `/repositories/{repo_id}/file-tree`** - NEW ENDPOINT: Get file tree for folder browser

#### `/app/routers/github/sync.py`
- **POST `/github/documents/import`** - Support folder-based GitHub imports
- **GET `/github/documents/{id}/status`** - Folder-aware sync status

### Frontend API Changes Required

#### `frontend/src/api/gitHubApi.js`
- **`getRepositoryContents()`** - Enhanced response handling for folder metadata
- **Add**: `getRepositoryTree()` method for full tree structures
- **`importDocument()`** - Support folder-path-based imports
- **Add**: `getFileTree()` method for folder browser

#### New API Integration
- Update `frontend/src/api/browserApi.js` to use enhanced GitHub endpoints

---

## Phase 5: Custom Dictionary System

### Backend Changes Required

#### `/app/routers/custom_dictionary.py`
- **GET `/dictionary/words`** - Add `folder_path` parameter support
- **POST `/dictionary/`** - Add `folder_path` field (replaces `category_id`)
- **GET `/dictionary/words/all`** - Update to aggregate user-level + folder-level words
- **GET `/dictionary/folder/{folder_path}/words`** - NEW ENDPOINT: Get folder-specific words

### Frontend API Changes Required

#### `frontend/src/api/customDictionaryApi.js`
- **`getWords()`** - Replace `categoryId` parameter with `folderPath`
- **`getCategoryWords()`** - Replace with `getFolderWords(folderPath)`
- **`addWord()`** - Replace `categoryId` parameter with `folderPath`
- **`deleteWordByText()`** - Replace `categoryId` parameter with `folderPath`
- **`bulkAddWords()`** - Replace `categoryId` parameter with `folderPath`

---

## Phase 6: Frontend Integration

### Backend Changes Required

#### Complete Category Removal
- **DELETE**: `/app/routers/documents/categories.py` router entirely
- **DELETE**: `/app/routers/categories.py` router entirely
- **Update**: `/app/routers/documents/router.py` - Remove all category references

### Frontend API Changes Required

#### `frontend/src/api/documentsApi.js`
- **Complete rewrite** to be folder-only
- **Remove**: All category-related method calls to other APIs
- **Add**: Full folder hierarchy methods

#### `frontend/src/api/categoriesApi.js`
- **DELETE**: Entire file - no longer needed

#### New Primary APIs
- `frontend/src/api/foldersApi.js` - Primary folder management
- `frontend/src/api/browserApi.js` - Unified browser interface

---

## Phase 7: Testing & Migration

### Backend Changes Required

#### Migration and Cleanup Endpoints
- **GET `/migration/status`** - NEW ENDPOINT: Check migration status
- **POST `/migration/validate`** - NEW ENDPOINT: Validate data integrity
- **POST `/migration/cleanup`** - NEW ENDPOINT: Remove deprecated tables

### Frontend API Changes Required

#### `frontend/src/api/migrationApi.js` - NEW FILE
- `getMigrationStatus()` method
- `validateMigration()` method
- `cleanupMigration()` method

---

## Critical Implementation Notes

### Backwards Compatibility Strategy
1. **Phases 1-2**: Dual parameter support (`category` and `folder_path`)
2. **Phase 3**: Category deprecation warnings
3. **Phase 6**: Complete category removal

### API Versioning Considerations
- Consider adding `/v2/` prefix for folder-based endpoints during transition
- Maintain `/v1/` category-based endpoints until Phase 6

### Error Handling Updates
- Update error messages to reference folders instead of categories
- Add migration-specific error codes

### Response Schema Changes
Every document response will change from:
```json
{
  "id": 1,
  "name": "Document",
  "category_id": 5,
  "category": "Work"
}
```

To:
```json
{
  "id": 1,
  "name": "Document",
  "folder_path": "/Work/Projects",
  "folder_name": "Projects"
}
```

### Frontend API Client Architecture
- Implement adapter pattern in API clients for backward compatibility
- Use feature flags to toggle between category and folder modes
- Centralize folder path validation and normalization

---

## Summary

This migration requires coordinated updates across:
- **12 backend router files**
- **4 primary frontend API files**
- **2 new frontend API files**
- **1 deprecated frontend API file**

The complexity is highest in Phases 3-4 where both category and folder systems coexist, requiring careful state management and data consistency.
