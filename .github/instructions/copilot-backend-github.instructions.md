---
description: "Use when working on GitHub backend integration: OAuth, accounts, repositories, file sync, import, commits, pull requests, save-to-GitHub, git operations, cache, or GitHub settings."
applyTo: "services/backend/app/routers/github/**,services/backend/app/services/github/**,services/backend/app/crud/github*,services/backend/app/models/github*,services/backend/app/schemas/github*,services/backend/app/routers/github_settings*"
---
# Backend GitHub Integration

## Router Architecture (`routers/github/`)
Router-of-routers pattern aggregated in `router.py`:
```
/github/auth         → OAuth flow (URL generation, callback, token exchange)
/github/accounts     → Account CRUD, connection management
/github/repositories → Repository listing, branch management, sync toggle
/github/repository-selection → Search, select, bulk-add, statistics, organizations
/github/files        → File content retrieval, repository tree browsing
/github/sync         → Repository sync (structure, content, background)
/github/commits      → Commit history, document status
/github/pull-requests → PR creation and management
/github/cache        → Cache stats, clear, invalidation
/github/save         → Save-to-GitHub sub-package (see below)
/github/git          → Git operations (commit, stash, branch, history)
```

### Save Sub-Package (`routers/github/save/`)
Dedicated package for save-to-GitHub workflow:
- `router.py` → Route composition
- `documents.py` → Document save endpoints
- `repositories.py` → Repository listing for save target selection
- `validators.py` → Input validation for save operations
- `schemas.py` → Request/response schemas specific to save flow

## Service Layer (`services/github/`)
Unified facade `GitHubService` delegates to specialized services:
- `auth.py` → OAuth token management, account validation
- `api.py` → GitHub API client (REST calls to github.com)
- `cache.py` → Repository/file cache management
- `sync.py` → Content synchronization logic
- `importer.py` → Repository import with markdown filtering
- `background.py` → Background sync tasks (creates fresh DB session factory for async jobs)
- `filesystem.py` → Local clone management
- `pull_requests.py` → PR creation and management
- `conversion.py` → Data format conversion utilities
- `repository_selector.py` → Repository search and selection logic
- `base.py` → Base service class with optional AsyncSession

## Data Layer
- **Models**: `github_models.py` (GitHubAccount, GitHubRepository), `github_settings.py` (GitHubSettings with per-account preferences)
- **Schemas**: `github.py`, `github_save.py`, `github_settings.py`
- **CRUD**: `github_crud.py` (account/repository operations), `github_settings.py` (settings CRUD)

## Key Patterns
- Background sync creates fresh DB session factory to avoid request-lifecycle coupling
- Route-order matters: dynamic `/{id}` paths must come after static paths
- GitHub settings are per-account with defaults for diagram export, auto-sync, commit preferences
- OAuth uses state validation for CSRF protection
- Repository imports support selective file import with markdown filtering
