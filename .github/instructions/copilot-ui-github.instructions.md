---
description: "Use when working on GitHub integration UI: accounts, repositories, OAuth, sync, cache, pull requests, conflicts, settings, git management, diff viewer."
applyTo: "services/ui/src/components/github/**,services/ui/src/components/git/**,services/ui/src/hooks/github/**,services/ui/src/api/gitHub*,services/ui/src/api/githubSettings*,services/ui/src/providers/GitHubSettingsProvider*,services/ui/src/styles/github/**"
---
# GitHub Integration UI

## Architecture

### Modal-Tab Composition
Central entry point is `GitHubModal` composing tab-level feature modules:
- **GitHubAccountsTab** → Account connection/disconnection via OAuth popup flow
- **GitHubRepositoriesTab** → Repository selection, sync toggle, branch management
- **GitHubSettingsTab** → Diagram export settings, auto-sync, commit preferences
- **GitHubCacheSyncTab** → Cache stats, background sync controls, force-sync

Repositories and Performance tabs render only when at least one account exists.

### Component Hierarchy
```
GitHubModal
├── GitHubAccountsTab
│   ├── GitHubAccountConnection (OAuth popup flow)
│   └── GitHubAccountList
├── GitHubRepositoriesTab
│   ├── GitHubRepositorySettings / UnifiedGitHubRepositorySettings
│   └── gitHubRepositorySelectionApi (search, bulk-add, toggle sync)
├── GitHubSettingsTab (diagram export, auto-push)
└── GitHubCacheSyncTab
    ├── GitHubCachePanel
    └── GitHubSyncPanel
```

Additional modals: `GitHubPRModal` (create PR), `GitHubPullModal` (pull changes), `GitHubConflictModal` (resolve conflicts).

## Git Management (Local + GitHub)
- `GitManagementModal` → Multi-tab operational dashboard (overview, branches, logs, settings). Uses `documentsApi` git endpoints, not `gitHubApi`.
- `DiffViewerModal` → Monaco side-by-side diff for commit comparison via `documentsApi.getDocumentAtCommit`.

## Hooks
- `useGitHubAccounts` → State: accounts, loading, error, success. Commands: loadAccounts, connectAccount (popup flow), disconnectAccount, clearMessages.
- `useGitHubOAuth` → OAuth URL generation and callback handling.
- `useGitHubRepositories` → Repository listing, branch retrieval, sync management.

## Provider: GitHubSettingsProvider
Context shape exposed by `useGitHubSettings()`:
- `settings` (auto_convert_diagrams, diagram_format, fallback_to_standard, auto_sync_enabled, default_commit_message, auto_push_enabled)
- `loading`, `error`, `isAuthenticated`, `isInitializing`
- `loadSettings(accountId?)`, `updateSettings(settings, accountId?)`, `getOrCreateSettings(accountId?)`, `resetToDefaults()`

## API Clients
- **gitHubApi** → OAuth, accounts, repositories, files, import, sync, commits, PRs, cache, save, git operations, stash, branches.
- **gitHubRepositorySelectionApi** → Search, select, bulk-add, toggle sync, statistics, organizations.
- **githubSettingsApi** → CRUD for per-account diagram export and sync settings.

## Patterns
- Container/presenter split: tabs handle async state, sub-components render UI.
- OAuth uses popup window + polling for popup close detection.
- Transitional architecture: legacy repo-selection patterns coexist with unified document-centric patterns (UnifiedGitHubRepositorySettings, UnifiedGitHubTab).
