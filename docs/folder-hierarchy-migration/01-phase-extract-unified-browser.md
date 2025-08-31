# Phase 1: Extract Unified File Browser

## Objective

Extract the GitHub file browser components into a reusable, unified file browser that can handle both local documents and GitHub repositories with a consistent interface.

## Duration

2-3 days

## Risk Level

Low - This is primarily a refactoring exercise with no database changes.

## Current State Analysis

### Existing GitHub Browser Components

- `frontend/src/components/github/browser/GitHubRepositoryBrowser.jsx` - Main container
- `frontend/src/components/github/browser/GitHubFileTree.jsx` - Tree navigation
- `frontend/src/components/github/browser/GitHubFileList.jsx` - File listing
- `frontend/src/components/github/browser/GitHubFilePreview.jsx` - File preview pane
- `frontend/src/components/github/browser/GitHubBrowserHeader.jsx` - Header with breadcrumbs
- `frontend/src/components/github/browser/GitHubBrowserActions.jsx` - Action buttons

### Current FileOpenModal

- `frontend/src/components/file/FileOpenModal.jsx` - Simple dropdown + list interface
- Uses basic category filtering
- No tree navigation or preview capabilities
- Limited to local documents only

## Implementation Plan

### Step 1: Create Abstract Data Interface

Create a standardized data interface that both local and GitHub documents can implement.

**File**: `frontend/src/types/FileBrowserTypes.js`

```javascript
// File tree node interface
export interface FileTreeNode {
  id: string | number;
  name: string;
  type: 'file' | 'folder';
  path: string;
  source: 'local' | 'github';
  children?: FileTreeNode[];

  // Optional metadata
  size?: number;
  lastModified?: Date;
  description?: string;

  // GitHub specific
  sha?: string;
  url?: string;

  // Local specific
  category?: string;
  documentId?: number;
}

// File browser configuration
export interface FileBrowserConfig {
  allowMultiSelect: boolean;
  showPreview: boolean;
  showActions: boolean;
  defaultView: 'tree' | 'list';
  filters?: {
    fileTypes?: string[];
    sources?: ('local' | 'github')[];
  };
}
```

### Step 2: Create Unified Browser Components

**Base Directory**: `frontend/src/components/shared/FileBrowser/`

#### Core Components to Create:

1. **UnifiedFileBrowser.jsx** - Main container component
2. **FileTree.jsx** - Abstracted tree navigation
3. **FileList.jsx** - Abstracted file listing
4. **FilePreview.jsx** - Abstracted preview pane
5. **FileBrowserHeader.jsx** - Abstracted header with breadcrumbs
6. **FileBrowserActions.jsx** - Abstracted action buttons

#### UnifiedFileBrowser.jsx Structure:

```jsx
import React, { useState, useEffect } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import FileTree from './FileTree';
import FileList from './FileList';
import FilePreview from './FilePreview';
import FileBrowserHeader from './FileBrowserHeader';
import FileBrowserActions from './FileBrowserActions';

export default function UnifiedFileBrowser({
  dataProvider,
  config = {},
  onFileSelect,
  onFileOpen,
  onMultiSelect,
  selectedFiles = [],
  initialPath = '/'
}) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [treeData, setTreeData] = useState([]);
  const [currentFiles, setCurrentFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);

  // Data provider interface methods
  useEffect(() => {
    loadTreeData();
  }, [dataProvider]);

  useEffect(() => {
    loadCurrentPathFiles();
  }, [currentPath]);

  const loadTreeData = async () => {
    setLoading(true);
    try {
      const data = await dataProvider.getTreeStructure();
      setTreeData(data);
    } catch (error) {
      console.error('Failed to load tree data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentPathFiles = async () => {
    setLoading(true);
    try {
      const files = await dataProvider.getFilesInPath(currentPath);
      setCurrentFiles(files);
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setLoading(false);
    }
  };

  // ... rest of component logic
}
```

### Step 3: Create Data Provider Abstractions

Create provider classes that implement the unified interface for different data sources.

**File**: `frontend/src/services/FileBrowserProviders.js`

```javascript
// Base provider interface
export class BaseFileBrowserProvider {
  async getTreeStructure() {
    throw new Error('getTreeStructure must be implemented');
  }

  async getFilesInPath(path) {
    throw new Error('getFilesInPath must be implemented');
  }

  async getFileContent(fileNode) {
    throw new Error('getFileContent must be implemented');
  }

  async createFolder(parentPath, folderName) {
    throw new Error('createFolder must be implemented');
  }
}

// Local documents provider
export class LocalDocumentsProvider extends BaseFileBrowserProvider {
  constructor(documentContext) {
    super();
    this.documentContext = documentContext;
  }

  async getTreeStructure() {
    // Convert documents to tree structure based on categories
    // For now, map categories to root folders
    const { documents, categories } = this.documentContext;

    return categories.map(category => ({
      id: `category-${category}`,
      name: category,
      type: 'folder',
      path: `/${category}`,
      source: 'local',
      children: documents
        .filter(doc => doc.category === category)
        .map(doc => ({
          id: doc.id,
          name: doc.name,
          type: 'file',
          path: `/${category}/${doc.name}`,
          source: 'local',
          documentId: doc.id,
          lastModified: new Date(doc.updated_at)
        }))
    }));
  }

  async getFilesInPath(path) {
    // Return files directly in this path
    const pathParts = path.split('/').filter(p => p);
    if (pathParts.length === 1) {
      // Root folder level - return documents in category
      const category = pathParts[0];
      return this.documentContext.documents
        .filter(doc => doc.category === category)
        .map(doc => ({
          id: doc.id,
          name: doc.name,
          type: 'file',
          path: `/${category}/${doc.name}`,
          source: 'local',
          documentId: doc.id
        }));
    }
    return [];
  }

  async getFileContent(fileNode) {
    const document = this.documentContext.documents.find(
      doc => doc.id === fileNode.documentId
    );
    return document?.content || '';
  }
}

// GitHub provider (adapter for existing GitHub service)
export class GitHubProvider extends BaseFileBrowserProvider {
  constructor(githubService, repository, branch) {
    super();
    this.githubService = githubService;
    this.repository = repository;
    this.branch = branch;
  }

  async getTreeStructure() {
    // Adapt existing GitHub tree API
    const treeData = await this.githubService.getRepositoryTree(
      this.repository,
      this.branch
    );
    return this.convertGitHubTreeToFileNodes(treeData);
  }

  // ... other methods
}
```

### Step 4: Update Existing Components

#### Refactor GitHubRepositoryBrowser

Update `frontend/src/components/github/browser/GitHubRepositoryBrowser.jsx` to use the new UnifiedFileBrowser:

```jsx
import UnifiedFileBrowser from '../../shared/FileBrowser/UnifiedFileBrowser';
import { GitHubProvider } from '../../../services/FileBrowserProviders';

export default function GitHubRepositoryBrowser({ repository, branch, onFileImport }) {
  const [provider, setProvider] = useState(null);

  useEffect(() => {
    const githubProvider = new GitHubProvider(githubService, repository, branch);
    setProvider(githubProvider);
  }, [repository, branch]);

  if (!provider) return <div>Loading...</div>;

  return (
    <UnifiedFileBrowser
      dataProvider={provider}
      config={{
        allowMultiSelect: true,
        showPreview: true,
        showActions: true,
        defaultView: 'tree'
      }}
      onFileSelect={(files) => {
        // Handle file selection for import
      }}
      onFileOpen={onFileImport}
    />
  );
}
```

### Step 5: Create CSS/Styling

**File**: `frontend/src/components/shared/FileBrowser/FileBrowser.css`

Extract and generalize the styling from the GitHub browser components.

### Step 6: Testing

Create unit tests for the new components:

**File**: `frontend/src/tests/components/shared/UnifiedFileBrowser.test.js`

```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import UnifiedFileBrowser from '../../../src/components/shared/FileBrowser/UnifiedFileBrowser';
import { LocalDocumentsProvider } from '../../../src/services/FileBrowserProviders';

// Mock data provider
const mockProvider = {
  getTreeStructure: jest.fn().mockResolvedValue([]),
  getFilesInPath: jest.fn().mockResolvedValue([]),
  getFileContent: jest.fn().mockResolvedValue('')
};

describe('UnifiedFileBrowser', () => {
  test('renders without crashing', () => {
    render(
      <UnifiedFileBrowser
        dataProvider={mockProvider}
        onFileSelect={() => {}}
      />
    );
  });

  test('loads tree structure on mount', async () => {
    render(
      <UnifiedFileBrowser
        dataProvider={mockProvider}
        onFileSelect={() => {}}
      />
    );

    expect(mockProvider.getTreeStructure).toHaveBeenCalled();
  });

  // Additional tests...
});
```

## Files to Create

- `frontend/src/types/FileBrowserTypes.js`
- `frontend/src/components/shared/FileBrowser/UnifiedFileBrowser.jsx`
- `frontend/src/components/shared/FileBrowser/FileTree.jsx`
- `frontend/src/components/shared/FileBrowser/FileList.jsx`
- `frontend/src/components/shared/FileBrowser/FilePreview.jsx`
- `frontend/src/components/shared/FileBrowser/FileBrowserHeader.jsx`
- `frontend/src/components/shared/FileBrowser/FileBrowserActions.jsx`
- `frontend/src/components/shared/FileBrowser/FileBrowser.css`
- `frontend/src/services/FileBrowserProviders.js`
- `frontend/src/tests/components/shared/UnifiedFileBrowser.test.js`

## Files to Modify

- `frontend/src/components/github/browser/GitHubRepositoryBrowser.jsx` - Refactor to use UnifiedFileBrowser
- `frontend/src/components/file/FileOpenModal.jsx` - Prepare for Phase 6 integration (add feature flag)

## Success Criteria

- [ ] UnifiedFileBrowser component renders correctly
- [ ] LocalDocumentsProvider converts categories to folder structure
- [ ] GitHubProvider adapts existing GitHub API
- [ ] Both data sources work with same UI components
- [ ] Existing GitHub browser functionality is preserved
- [ ] Unit tests pass for new components
- [ ] No breaking changes to existing functionality

## Next Phase

Phase 2 will add the database schema changes to support folder paths, preparing the foundation for the local documents to use true folder hierarchies instead of category mappings.
