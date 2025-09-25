# AI Agent FileBrowser Guidelines - HISTORICAL PRE-UNIFICATION

applyTo: "frontend/src/components/shared/FileBrowser/**/*", "frontend/src/components/file/**/*", "frontend/src/services/providers/**/*"

**⚠️ IMPORTANT**: This document describes the **pre-unification architecture** that is being replaced.

**FOR CURRENT IMPLEMENTATION**: See `#file:copilot-unification.instructions.md` for the unified architecture being implemented.

**See also**: `.github/copilot-development.instructions.md` for development environment setup (Docker, HMR, database access)

---

## Historical Context: Pre-Unification FileBrowser Architecture

This document preserves the original FileBrowser architecture design for historical reference and to understand the complexity that the unified architecture is solving.

The FileBrowser system provides **unified file browsing across multiple data sources** (local documents, GitHub repositories) with consistent UI patterns. Critical architectural patterns:

### 🏗️ Provider-Based Data Architecture

**Provider Pattern**: Data sources implement `BaseFileBrowserProvider` interface with standardized methods:

```javascript
// All providers must implement these core methods
async getTreeStructure()      // Hierarchical tree data
async getFilesInPath(path)    // Files in specific path
async getFileContent(file)    // File content retrieval
```

**Provider Types**:
- `LocalDocumentsProvider` → Adapts existing document/category system to tree structure
- `GitHubProvider` → Repository browsing with branch awareness via GitHub API
- `BaseFileBrowserProvider` → Abstract interface with filtering logic

**Provider Configuration**:
```javascript
const provider = new GitHubProvider(repository, branch, {
  filters: { fileTypes: [] }  // File type filtering
});
```

### 🧩 Component Hierarchy & Data Flow

**Three-Panel Layout** in `UnifiedFileBrowser.jsx`:

```jsx
<UnifiedFileBrowser
  dataProvider={provider}           // Core: Provider injection
  onFileOpen={handleFileOpen}       // File action callback
  breadcrumbType="github|local"     // Breadcrumb styling
  config={{
    showActions: true,              // Bottom action bar
    showBreadcrumb: true,           // Top navigation bar
    showPreview: true,              // Right preview panel
    allowMultiSelect: false         // Multi-selection mode
  }}
/>
```

**Component Structure**:
- `FileTree.jsx` → Left panel: hierarchical navigation with expand/collapse
- `FileList.jsx` → Center panel: current folder contents
- `FilePreview.jsx` → Right panel: file content preview
- `BreadcrumbBar.jsx` → Top: path navigation with source-specific styling
- `FileBrowserActions.jsx` → Bottom: action buttons

### 🔄 State Management & Navigation

**Critical State Synchronization**:
```javascript
const [currentPath, setCurrentPath] = useState('/');
const [expandedFolders, setExpandedFolders] = useState(new Set(['/']));
const [selectedFile, setSelectedFile] = useState(null);
```

**Path Navigation Pattern**: Path changes trigger multiple updates:
1. `handlePathChange()` → Updates currentPath
2. Auto-expands parent folders in tree
3. Loads files via `dataProvider.getFilesInPath()`
4. Scrolls tree to target folder via `scrollToFolder()`

**Tree Expansion Logic**:
```javascript
// Ensure all parent paths are expanded
const pathParts = newPath.split('/').filter(p => p);
let buildPath = '';
pathParts.forEach(part => {
  buildPath += '/' + part;
  newExpanded.add(buildPath);
});
```

### 📁 Local Documents Integration

**Document-Category Mapping**:
```javascript
// LocalDocumentsProvider creates virtual file structure
/Documents/{category}/{document.name}

// Example structure
/Documents/General/Meeting Notes.md
/Documents/Projects/API Documentation.md
```

**Critical Integration Points**:
- Uses existing `documents` and `categories` from `DocumentContextProvider`
- Maps document IDs to `documentId` property for file opening
- Preserves document metadata (updated_at, content.length)

### 🐙 GitHub Repository Integration

**Repository Context Flow**:
```javascript
// Repository selection in GitHubTab
handleGitHubRepositorySelect(repository)
  → loadBranches(repository)
  → new GitHubProvider(repository, branch)
  → UnifiedFileBrowser rendering
```

**Branch Management**:
- Dynamic branch loading via `gitHubApi.getRepositoryBranches()`
- Branch switching creates new provider instance
- Fallback to default branch on API failures

**File Import Workflow**:
```javascript
handleGitHubFileOpen(file) {
  if (file.isImported && file.documentId) {
    // Open existing imported document
    documentsApi.openGitHubDocument(file.documentId)
  } else {
    // Auto-import then open
    gitHubApi.importDocument(importData)
  }
}
```

### ⚛️ Senior React Development Patterns

**Component Architecture**:
```javascript
// Follow functional component with hooks pattern
function FileBrowserComponent({ dataProvider, onFileSelect }) {
  // Custom hooks for domain logic
  const { files, loading, error } = useFileBrowser(dataProvider);
  const { selectedFiles, handleSelect } = useFileSelection();

  // useEffect with proper dependencies
  useEffect(() => {
    if (dataProvider) {
      loadFiles();
    }
  }, [dataProvider]); // Always specify dependencies

  // Early returns for loading/error states
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div className="file-browser">
      {/* Component JSX */}
    </div>
  );
}

// PropTypes validation required
FileBrowserComponent.propTypes = {
  dataProvider: PropTypes.object.isRequired,
  onFileSelect: PropTypes.func
};
```

**Custom Hooks Pattern**:
```javascript
// Domain-specific hooks in src/hooks/fileBrowser/
export function useFileBrowser(provider) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadFiles = useCallback(async (path) => {
    setLoading(true);
    try {
      const result = await provider.getFilesInPath(path);
      setFiles(result);
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setLoading(false);
    }
  }, [provider]);

  return { files, loading, loadFiles };
}
```

**Service Layer Separation**:
```javascript
// Keep services pure, no React dependencies
// src/services/fileBrowser/FileBrowserService.js
export class FileBrowserService {
  static async validateFile(file) {
    // Pure business logic
  }

  static formatFileSize(bytes) {
    // Utility functions
  }
}
```

### 🎨 SCSS Styling Guidelines

**CRITICAL - No Inline Styles**:
```javascript
// ❌ NEVER do this
<div style={{ marginTop: '20px', color: 'blue' }}>

// ✅ ALWAYS use SCSS classes
<div className="file-browser-header">
```

**SCSS Organization Pattern**:
```scss
// src/styles/fileBrowser/_component.scss
@use '../variables';
@use '../mixins';

.file-browser-component {
  // Use variables for consistency
  padding: variables.$spacing-base;
  border: 1px solid variables.$color-border;

  // Nested selectors for component scope
  &__header {
    background: variables.$color-bg-light;
  }

  &__item {
    @include mixins.hover-state;
  }

  // Theme support
  [data-theme="dark"] & {
    border-color: variables.$color-border-dark;
  }
}
```

**Existing SCSS Structure Usage**:
```javascript
// Import component styles in src/styles/fileBrowser/index.scss
@use 'container';    // Main layout
@use 'breadcrumbs';  // Navigation
@use 'tree';         // Tree component
@use 'list';         // File list
@use 'preview';      // Preview pane
@use 'actions';      // Action buttons
@use 'modal';        // Modal overrides
@use 'utils';        // Utilities
```

### 🗂️ File Organization & Separation of Concerns

**Directory Structure**:
```
src/components/shared/FileBrowser/
├── index.js                 # Barrel exports
├── UnifiedFileBrowser.jsx   # Main container (<300 lines)
├── FileTree.jsx            # Tree navigation (<300 lines)
├── FileList.jsx            # File listing (<300 lines)
├── FilePreview.jsx         # Preview panel (<300 lines)
├── BreadcrumbBar.jsx       # Navigation (<300 lines)
└── FileBrowserActions.jsx  # Actions (<300 lines)

src/hooks/fileBrowser/
├── index.js               # Barrel exports
├── useFileBrowser.js      # Core file operations
├── useFileSelection.js    # Selection state
├── useTreeNavigation.js   # Tree state management
└── useFilePreview.js      # Preview logic

src/services/fileBrowser/
├── index.js               # Barrel exports
├── FileBrowserService.js  # Core business logic
├── FileIconService.js     # Icon utilities
└── PathUtils.js           # Path operations
```

**Barrel Exports Pattern**:
```javascript
// src/components/shared/FileBrowser/index.js
export { default as UnifiedFileBrowser } from './UnifiedFileBrowser';
export { default as FileTree } from './FileTree';
export { default as FileList } from './FileList';
export { default as FilePreview } from './FilePreview';
export { default as BreadcrumbBar } from './BreadcrumbBar';
export { default as FileBrowserActions } from './FileBrowserActions';

// Usage in other files
import { UnifiedFileBrowser, FileTree } from '@/components/shared/FileBrowser';
```

**Domain Separation Rules**:
- **Components**: Pure UI logic, no business rules
- **Hooks**: State management and side effects
- **Services**: Business logic and utilities
- **Providers**: Data access layer only
- **Types**: Shared interfaces and constants

### 🌐 Backend API Integration

**API Client Pattern**:
```javascript
// Extend base Api class for FileBrowser endpoints
import { Api } from '@/api/api';

class FileBrowserApi extends Api {
  async getFileTree(repositoryId, branch) {
    const response = await this.apiCall(`/github/repositories/${repositoryId}/tree?branch=${branch}`);
    return response.data;
  }

  async getFileContent(repositoryId, filePath, branch) {
    const response = await this.apiCall(`/github/repositories/${repositoryId}/contents/${filePath}?branch=${branch}`);
    return response.data;
  }
}
```

**Existing API Services Usage**:
- `documentsApi.js` → Document CRUD operations (`getAllDocuments`, `getDocument`, `createDocument`)
- `gitHubApi.js` → Repository management (`getRepositories`, `getRepositoryContents`, `importDocument`)
- `categoriesApi.js` → Category operations for local documents
- `iconsApi.js` → Icon metadata for file representations

**Authentication Integration**:
```javascript
// Base Api class handles JWT tokens automatically
const response = await this.apiCall('/documents', 'POST', documentData);
// Token from localStorage.getItem("authToken") added automatically
// No manual Authorization header needed
```

### 🎨 Theming & UI Consistency

**Theme Integration Requirements**:
```javascript
// All FileBrowser components must support theme switching
function FileBrowserComponent() {
  return (
    <div className="file-browser" data-theme-aware>
      {/* Theme variables automatically applied via SCSS */}
    </div>
  );
}
```

**SCSS Theme Variables Usage**:
```scss
.file-browser-item {
  background: variables.$color-bg-light;
  color: variables.$color-text-light;
  border: 1px solid variables.$color-border;

  // Dark theme support (automatic via data-theme attribute)
  [data-theme="dark"] & {
    background: variables.$color-bg-dark;
    color: variables.$color-text-dark;
    border-color: variables.$color-border-dark;
  }
}
```

**Bootstrap Component Theming**:
- Use Bootstrap 5.3 components with theme-aware classes
- Bootstrap Icons for consistent iconography
- React Bootstrap components inherit theme automatically
- Custom SCSS extends Bootstrap theme variables

**Theme-Aware Component Pattern**:
```javascript
// Components automatically inherit theme from ThemeProvider
import { Button, Card } from 'react-bootstrap';

function FileBrowserActions() {
  return (
    <Card className="file-browser-actions">
      <Button variant="primary" className="theme-aware-button">
        Open File
      </Button>
    </Card>
  );
}
```

### 🔧 Code Quality Guidelines

**Component Size Limits**:
- **Maximum 300 lines per file**
- **Single responsibility principle**
- **Extract custom hooks for complex logic**
- **Create sub-components for repeated patterns**

**useEffect Best Practices**:
```javascript
// ✅ Proper dependency arrays
useEffect(() => {
  loadFiles(currentPath);
}, [currentPath, dataProvider]); // All dependencies listed

// ✅ Cleanup functions
useEffect(() => {
  const subscription = dataProvider.subscribe(handleUpdate);
  return () => subscription.unsubscribe();
}, [dataProvider]);

// ✅ Early returns for conditional effects
useEffect(() => {
  if (!selectedFile) return;

  loadFilePreview(selectedFile);
}, [selectedFile]);
```

**Error Boundaries & Loading States**:
```javascript
// Always handle loading and error states
if (loading) return <div className="file-browser-loading">Loading...</div>;
if (error) return <div className="file-browser-error">Error: {error.message}</div>;
if (!files.length) return <div className="file-browser-empty">No files found</div>;
```

### 🔧 Development Patterns

**Provider Testing**:
```javascript
// Test provider methods independently
const provider = new LocalDocumentsProvider({documents, categories});
const tree = await provider.getTreeStructure();
const files = await provider.getFilesInPath('/Documents/General');
```

**Error Handling**:
- Graceful fallbacks for API failures (GitHub branches, tree loading)
- Console logging for debugging provider interactions
- User notifications via `useNotification()` hook

**Performance Considerations**:
- Tree content lazy loading on folder expansion
- Provider instance caching in state
- Folder contents caching via Map structures

### 🚀 Common Tasks & Patterns

**Adding New Provider**:
1. Extend `BaseFileBrowserProvider`
2. Implement required methods with data source logic
3. Export from `FileBrowserProviders.js`
4. Create tab component following `LocalDocumentsTab` pattern

**Debugging Provider Issues**:
```bash
# Check provider data flow
console.log('Provider getTreeStructure:', await provider.getTreeStructure());
console.log('Files in path:', await provider.getFilesInPath('/Documents'));
```

**Custom File Actions**:
- Extend `FileBrowserActions.jsx` for provider-specific actions
- Use `config.showActions` to control visibility
- Access selected files via props for bulk operations

### 🗂️ Backend Filesystem Architecture - Critical Knowledge

**CRITICAL DESIGN ISSUE**: The system has a **disjointed dual filesystem architecture** that creates complexity:

**Local Category Storage**:
```bash
/storage/{user_id}/local/{category}/          # Each category is its own git repository
/storage/{user_id}/local/General/document.md  # Files directly in category git repo
/storage/{user_id}/local/Drafts/draft.md      # Separate git repo per category
```

**GitHub Repository Storage**:
```bash
/storage/{user_id}/github/{account_id}/{repo_name}/  # Cloned GitHub repositories
/storage/{user_id}/github/1/my-docs/README.md       # Full repo clone structure
```

**Database File Path Mapping**:
- Local documents: `file_path = "local/{category}/{filename}"`
- GitHub documents: `file_path = "github/{account_id}/{repo_name}/{relative_path}"`
- Both use `app.services.storage.filesystem.Filesystem` service for file operations

**The Interface Problem**:
1. **Local categories** = individual git repositories (each category gets `.git`)
2. **GitHub repos** = cloned repositories with original structure
3. **Frontend providers** abstract this complexity but create inconsistent navigation patterns
4. **File operations** must handle two completely different storage paradigms

### 🔧 Backend Service Integration

**Filesystem Service Usage**:
```python
# Core filesystem operations (app/services/storage/filesystem.py)
filesystem = Filesystem()
await filesystem.write_document(user_id, file_path, content)
await filesystem.read_document(user_id, file_path)

# GitHub-specific operations (app/services/github/filesystem.py)
github_fs = GitHubFilesystemService()
await github_fs.clone_repository(repo_url, target_path, branch)
await github_fs.get_repository_status(repo_path)
```

**Document CRUD Pattern**:
```python
# Document creation with dual storage paths (app/crud/document.py)
if github_data:
    document.file_path = f"github/{account_id}/{repo_name}/{github_data.get('file_path')}"
    document.repository_type = "github"
else:
    document.file_path = f"local/{category}/{filename}"
    document.repository_type = "local"
```

**Git Operations Support**:
- Local categories: Basic git operations for version control
- GitHub repos: Full git sync, branch management, commit operations
- Both accessible via document router `/documents/{id}/git/status`

### 🚨 Critical Filesystem Issues to Understand

**Orphaned File Detection**:
- Files can exist on filesystem without database entries
- Use `backend/scripts/scan_filesystem.py` to identify orphaned files
- Database-first approach: only files with DB entries should exist

**Path Normalization Problems**:
- Local paths: `local/General/document.md`
- GitHub paths: `github/1/repo-name/folder/document.md`
- Frontend must handle both patterns in FileBrowserProviders

**Storage Optimization**:
- GitHub repos get auto-pruned for storage limits
- Non-markdown files removed from cloned repos
- Category git repos grow unboundedly (no cleanup mechanism)

---

**AI Agents**: This document describes the **HISTORICAL** pre-unification architecture with complex provider patterns and dual filesystem abstraction.

**⚠️ FOR NEW DEVELOPMENT**: Use `#file:copilot-unification.instructions.md` which implements a simplified unified approach that eliminates the complexity described in this document while preserving the excellent 3-tier file browser UI.

**Key Historical Issues This Document Shows**:
- Multiple API endpoints for same operations (`getDocument` vs `openGitHubDocument`)
- Complex provider pattern abstracting dual filesystem architecture
- Frontend branching logic based on document source type
- Virtual path translation layers creating unnecessary complexity

The unified architecture solves these issues with Document ID-centric access and single API patterns.