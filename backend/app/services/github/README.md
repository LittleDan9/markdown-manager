# GitHub Services Modular Organization

This directory contains the reorganized GitHub services, structured for better maintainability and separation of concerns, similar to the icons folder organization.

## Structure

```
github/
├── __init__.py          # Main unified GitHubService class
├── base.py              # Base class for all GitHub services
├── auth.py              # OAuth authentication operations
├── api.py               # Direct GitHub API operations
├── cache.py             # Caching and rate limiting
├── sync.py              # Bidirectional synchronization
├── importer.py          # Repository import and folder structure
├── background.py        # Background sync operations
└── pull_requests.py     # Pull request operations
```

## Service Domains

### 1. Authentication (`auth.py`)
- OAuth URL generation
- Token exchange
- Token validation
- Account switching support

### 2. API Operations (`api.py`)
- Direct GitHub API calls
- File content operations
- Repository management
- Branch operations
- Content hash generation

### 3. Caching (`cache.py`)
- In-memory cache management
- Rate limit tracking
- Cache invalidation
- Statistics collection

### 4. Synchronization (`sync.py`)
- Pull remote changes
- Conflict detection and resolution
- Three-way merge operations
- Backup creation

### 5. Import Service (`importer.py`)
- Repository file import
- Folder structure maintenance
- Batch operations
- Structure synchronization

### 6. Background Operations (`background.py`)
- Automated sync scheduling
- Background task management
- Service status monitoring

### 7. Pull Requests (`pull_requests.py`)
- PR creation and management
- Repository contributors
- Collaboration features

## Usage

The main `GitHubService` class in `__init__.py` provides a unified interface that delegates to the specialized services:

```python
from app.services.github import GitHubService

# Create service instance
github_service = GitHubService(db_session)

# Use authentication
auth_url = github_service.get_authorization_url(state)

# Use API operations
repos = await github_service.get_user_repositories(token)

# Use sync operations
result = await github_service.pull_remote_changes(document, user_id)
```

## Backward Compatibility

All original import paths are maintained through compatibility shims:

- `github_service.py` → `github.GitHubService`
- `github_cache_service.py` → `github.cache.GitHubCacheService`
- `github_sync_service.py` → `github.sync.GitHubSyncService`
- `github_import_service.py` → `github.importer.GitHubImportService`
- `github_background_sync.py` → `github.background.GitHubBackgroundService`
- `github_pr_service.py` → `github.pull_requests.GitHubPRService`

## Benefits

1. **Separation of Concerns**: Each service handles a specific domain
2. **Maintainability**: Easier to locate and modify specific functionality
3. **Testing**: Each service can be tested independently
4. **Reusability**: Services can be composed as needed
5. **Scalability**: Easy to add new services or extend existing ones

## Dependencies

Services use lazy imports and TYPE_CHECKING to avoid circular dependencies and reduce startup time. Heavy dependencies like SQLAlchemy are only imported when actually needed.
