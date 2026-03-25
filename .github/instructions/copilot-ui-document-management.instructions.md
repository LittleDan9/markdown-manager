---
description: "Use when working on document management, file browser, file operations (open/save/import/export), categories, folders, document context, or file browser providers."
applyTo: "services/ui/src/components/document/**,services/ui/src/components/file/**,services/ui/src/components/shared/FileBrowser/**,services/ui/src/hooks/document/**,services/ui/src/hooks/fileBrowser/**,services/ui/src/services/fileBrowser/**,services/ui/src/services/core/Document*,services/ui/src/styles/fileBrowser/**,services/ui/src/api/categoriesApi*,services/ui/src/api/documentsApi*,services/ui/src/providers/DocumentContextProvider*"
---
# Document Management UI

## DocumentContextProvider
Central state hub composing auth, notifications, UI state, and document hooks into one context boundary. All document-related operations flow through this provider.

## Document Hooks (`hooks/document/`)
- `useDocumentState` → Current document, content, dirty state
- `useDocumentAutoSave` → Timer-based auto-save with conflict detection
- `useSaveDocument` → Save orchestration (local + GitHub sync)
- `useChangeTracker` → Tracks unsaved changes across documents
- `useFileOperations` → Create, delete, rename, move operations
- `useGitStatus` → Git status per document (local + GitHub)
- `useSiblingDocs` → Navigation between documents in same category

## Document Services
- `DocumentService` → Orchestration layer (auth state, retry tracking, notification integration)
- `DocumentStorageService` → Pure local persistence, category/document key management, duplicate detection

## File Operations Components
- `FileDropdown` → File menu (new, open, save, import, export)
- `FileOpenModal` → Open document browser
- `FileSaveAsModal` → Save-as with category selection
- `FileImportModal` → Import markdown files
- `FileOverwriteModal` → Overwrite confirmation
- `RecentFilesDropdown` → Recently opened documents
- `UnsavedDocumentsDropdown` → Documents with pending changes

## Document Modals
- `DocumentForm` → Category selection + document name input, validates uniqueness
- `DeleteCategoryModal` → Category deletion with document count warning
- `PromoteDraftModal` → First explicit save from Drafts, delegates to DocumentForm

## File Browser Architecture

### Three-Panel Layout (`UnifiedFileBrowser`)
```
FileTree (left) | FileList (center) | FilePreview (right)
BreadcrumbBar (top) | FileBrowserActions (bottom)
```
Driven by `useUnifiedFileBrowser` hook and pluggable `dataProvider` contract.

### Provider Hierarchy
All providers extend `BaseFileBrowserProvider`:
- `getTreeStructure()` → Hierarchical tree data
- `getFilesInPath(path)` → Files in specific directory
- `getFileContent(file)` → File content retrieval
- Optional: `createFile()`, `searchFiles()`, `getStats()`

**Concrete Providers**:
- `RootFileBrowserProvider` → Top-level aggregator, merges local + GitHub trees
- `LocalDocumentsProvider` → Adapts category/document data to tree nodes, partitions local vs github_repo docs
- `GitHubProvider` → Repository browsing with branch-aware root path, tree endpoint with contents fallback
- `GitHubFolderProvider` → Folder-structure from flat tree data, markdown filtering
- `UnifiedFileBrowserProvider` → ID-centric abstraction, translates UI paths to GitHub paths, deduplicates by SHA
- `GitHubProviderUtils` → Conversion/search/import utility layer

### File Browser Tabs
- `UnifiedFileBrowserTab` → Main browse tab, memoizes provider construction, preserves selection
- `UnifiedGitHubTab` → GitHub-specific tab using unified open service
- `DocumentListView` → Flat list view of documents

## API Clients
- `categoriesApi` → Category CRUD, reordering
- `documentsApi` → Document CRUD, content, version history, git operations, sharing
