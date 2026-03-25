---
description: "Use when working on document CRUD, categories, folders, sharing, recents, document content serving, filesystem storage, git operations, image storage, or unified document service."
applyTo: "services/backend/app/routers/documents/**,services/backend/app/services/storage/**,services/backend/app/services/unified_document*,services/backend/app/crud/document*,services/backend/app/crud/category*,services/backend/app/models/document*,services/backend/app/models/category*,services/backend/app/schemas/document*,services/backend/app/schemas/category*,services/backend/app/routers/categories*,services/backend/app/routers/images*"
---
# Backend Documents & Storage

## Document Router (`routers/documents/`)
Large orchestrator router with explicit ordering constraints:

```
/documents/current     → Current document state
/documents/recents     → Recently accessed documents
/documents/categories  → Category management within documents context
/documents/folders     → Folder operations
/documents/sharing     → Document sharing (public links)
/documents/{id}/github → GitHub-specific document operations
/documents/{id}        → MUST BE LAST (dynamic path prevents shadowing)
```

### Key Files
- `router.py` → Route composition with ordering comments
- `crud.py` → Core CRUD endpoints (get, create, update, delete)
- `current.py` → Current/active document management
- `recents.py` → Recently opened document tracking
- `github_open.py` → Opening GitHub-sourced documents
- `categories.py` → Category CRUD within documents context
- `folders.py` → Folder structure operations
- `sharing.py` → Public/shared document access
- `helpers.py` → Shared utility functions
- `response_utils.py` → Response formatting helpers

## Unified Document Service (`services/unified_document.py`)
Single interface for all document types (local + GitHub):
- `get_document_with_content(document_id)` → Handles source detection automatically
- `update_document_content(document_id, content)` → Unified content updates
- Automatic GitHub repo cloning and sync handling
- Legacy database content fallback during migration

## Storage Layer (`services/storage/`)
Capability-oriented package:

### Core Storage
- `filesystem_service.py` / `filesystem.py` → File system operations
- `user_storage_service.py` / `user_storage.py` → Per-user storage management
- `image_storage_service.py` → Authenticated image storage and serving

### Git Operations (`services/storage/git/`)
Unified across local and GitHub repositories:
- `operations.py` → Commit, push, pull, branch operations
- `history.py` → Commit history retrieval
- `maintenance.py` → Repository cleanup, gc, consistency checks

### User Storage (`services/storage/user/`)
- `storage.py` → User storage root management
- `document.py` → Document file operations
- `repository.py` → Git repository initialization and management
- `directory.py` → Directory structure operations
- `version.py` → Document version tracking

## Storage Paths
```
/storage/{user_id}/local/{category}/     → Local category git repositories
/storage/{user_id}/github/{account_id}/  → Cloned GitHub repositories
```

## Data Layer
- **Models**: `document.py` (Document with content, metadata, source tracking), `category.py` (Category with ordering)
- **Schemas**: `document.py`, `category.py`
- **CRUD**: `document.py` (document operations), `category.py` (category CRUD)

## Image Handling
- `routers/images.py` → Image upload/serve endpoints
- `services/storage/image_storage_service.py` → Authenticated image storage, per-user image directories
