# Phase 6: Frontend UI Integration

## Objective

Replace the old FileOpenModal with the new UnifiedFileBrowser, update the DocumentContext to work with folder-based operations, and integrate all the new folder functionality into the main application UI.

## Duration

2-3 days

## Risk Level

Low - Primarily UI integration with well-tested backend components.

## Current Frontend Issues

### Problems to Solve

1. **Inconsistent UI**: FileOpenModal uses basic dropdown vs rich GitHub browser
2. **Category Dependency**: DocumentContext still operates on category-based logic
3. **Limited Navigation**: No folder tree navigation for local documents
4. **Missing Features**: No breadcrumbs, search, or folder management for local docs

### Integration Points

- Replace FileOpenModal with UnifiedFileBrowser
- Update DocumentContext for folder operations
- Add folder management UI components
- Integrate dictionary management with folder context

## DocumentContext Updates

### Enhanced Document Context

**File**: `frontend/src/contexts/DocumentContext.js`

```jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { documentsAPI } from '../api/documents';
import { dictionaryAPI } from '../api/dictionaries';
import { useNotification } from './NotificationContext';
import { useAuth } from './AuthContext';

const DocumentContext = createContext();

export function useDocumentContext() {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error('useDocumentContext must be used within a DocumentProvider');
  }
  return context;
}

export function DocumentProvider({ children }) {
  // State
  const [documents, setDocuments] = useState([]);
  const [folderStructure, setFolderStructure] = useState({});
  const [currentDocument, setCurrentDocument] = useState(null);
  const [currentFolderPath, setCurrentFolderPath] = useState('/');
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]); // Keep for backward compatibility during transition

  const { showSuccess, showError } = useNotification();
  const { isAuthenticated } = useAuth();

  // Load initial data
  useEffect(() => {
    if (isAuthenticated) {
      loadFolderStructure();
      loadDocuments();
      loadCategories(); // Legacy support
    }
  }, [isAuthenticated]);

  // API Methods
  const loadFolderStructure = async () => {
    try {
      const response = await documentsAPI.getFolderStructure();
      setFolderStructure(response.tree);
    } catch (error) {
      console.error('Failed to load folder structure:', error);
    }
  };

  const loadDocuments = async (folderPath = null) => {
    try {
      setLoading(true);
      const response = await documentsAPI.getDocuments(folderPath);
      setDocuments(response);
    } catch (error) {
      showError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const loadDocumentsInFolder = async (folderPath, includeSubfolders = false) => {
    try {
      setLoading(true);
      const response = await documentsAPI.getDocumentsInFolder(folderPath, includeSubfolders);
      return response;
    } catch (error) {
      showError('Failed to load folder documents');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const createDocument = async (name, content = '', folderPath = '/General') => {
    try {
      const response = await documentsAPI.createDocument({
        name,
        content,
        folder_path: folderPath
      });

      // Update local state
      setDocuments(prev => [...prev, response]);
      await loadFolderStructure(); // Refresh folder structure

      showSuccess(`Document "${name}" created successfully`);
      return response;
    } catch (error) {
      showError('Failed to create document');
      throw error;
    }
  };

  const updateDocument = async (documentId, updates) => {
    try {
      const response = await documentsAPI.updateDocument(documentId, updates);

      // Update local state
      setDocuments(prev =>
        prev.map(doc => doc.id === documentId ? response : doc)
      );

      if (currentDocument?.id === documentId) {
        setCurrentDocument(response);
      }

      return response;
    } catch (error) {
      showError('Failed to update document');
      throw error;
    }
  };

  const moveDocument = async (documentId, newFolderPath) => {
    try {
      const response = await documentsAPI.moveDocument(documentId, newFolderPath);

      // Update local state
      setDocuments(prev =>
        prev.map(doc => doc.id === documentId ? response : doc)
      );

      if (currentDocument?.id === documentId) {
        setCurrentDocument(response);
      }

      await loadFolderStructure(); // Refresh folder structure
      showSuccess(`Document moved to ${newFolderPath}`);
      return response;
    } catch (error) {
      showError('Failed to move document');
      throw error;
    }
  };

  const deleteDocument = async (documentId) => {
    try {
      await documentsAPI.deleteDocument(documentId);

      // Update local state
      setDocuments(prev => prev.filter(doc => doc.id !== documentId));

      if (currentDocument?.id === documentId) {
        setCurrentDocument(null);
      }

      await loadFolderStructure(); // Refresh folder structure
      showSuccess('Document deleted successfully');
    } catch (error) {
      showError('Failed to delete document');
      throw error;
    }
  };

  const searchDocuments = async (query, folderPath = null) => {
    try {
      const response = await documentsAPI.searchDocuments(query, folderPath);
      return response;
    } catch (error) {
      showError('Search failed');
      return [];
    }
  };

  // Folder operations
  const createFolder = async (folderPath) => {
    try {
      await documentsAPI.createFolder(folderPath);
      await loadFolderStructure();
      showSuccess(`Folder created: ${folderPath}`);
    } catch (error) {
      showError('Failed to create folder');
      throw error;
    }
  };

  const getFolderBreadcrumbs = (folderPath) => {
    if (!folderPath || folderPath === '/') return [];
    return folderPath.split('/').filter(part => part);
  };

  const navigateToFolder = (folderPath) => {
    setCurrentFolderPath(folderPath);
    loadDocuments(folderPath);
  };

  // Legacy category support (for transition period)
  const loadCategories = async () => {
    try {
      const response = await documentsAPI.getCategories();
      setCategories(response);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  // Computed values
  const getCurrentFolderDocuments = () => {
    return documents.filter(doc => doc.folder_path === currentFolderPath);
  };

  const getDocumentsByFolder = (folderPath) => {
    return documents.filter(doc => doc.folder_path === folderPath);
  };

  const getRootFolders = () => {
    const folders = new Set();
    documents.forEach(doc => {
      const rootFolder = doc.folder_path.split('/')[1];
      if (rootFolder) folders.add(rootFolder);
    });
    return Array.from(folders);
  };

  const value = {
    // State
    documents,
    folderStructure,
    currentDocument,
    currentFolderPath,
    loading,
    categories, // Legacy

    // Navigation
    setCurrentDocument,
    navigateToFolder,
    getFolderBreadcrumbs,

    // Document operations
    createDocument,
    updateDocument,
    moveDocument,
    deleteDocument,
    searchDocuments,

    // Folder operations
    createFolder,
    loadDocumentsInFolder,
    loadFolderStructure,

    // Computed values
    getCurrentFolderDocuments,
    getDocumentsByFolder,
    getRootFolders,

    // Utilities
    loadDocuments
  };

  return (
    <DocumentContext.Provider value={value}>
      {children}
    </DocumentContext.Provider>
  );
}
```

## Updated FileOpenModal

### Replace with UnifiedFileBrowser Integration

**File**: `frontend/src/components/file/FileOpenModal.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { Modal } from 'react-bootstrap';
import UnifiedFileBrowser from '../shared/FileBrowser/UnifiedFileBrowser';
import { LocalDocumentsProvider, GitHubProvider } from '../../services/FileBrowserProviders';
import { useDocumentContext } from '../../contexts/DocumentContext';
import { useAuth } from '../../contexts/AuthContext';
import { useFileModal } from '../../contexts/FileModalContext';
import { useNotification } from '../../contexts/NotificationContext';

export default function FileOpenModal({ show, onHide, onOpen, setContent, deleteDocument }) {
  const { documents, folderStructure, loadDocuments } = useDocumentContext();
  const { isAuthenticated } = useAuth();
  const { activeTab, selectedRepository, closeFileModal } = useFileModal();
  const { showSuccess, showError } = useNotification();

  const [dataProvider, setDataProvider] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);

  // Initialize data provider based on active tab
  useEffect(() => {
    if (!show) return;

    if (activeTab === 'local' || !activeTab) {
      // Local documents provider
      const localProvider = new LocalDocumentsProvider({
        documents,
        folderStructure,
        loadDocuments
      });
      setDataProvider(localProvider);
    } else if (activeTab === 'github' && selectedRepository) {
      // GitHub provider
      const githubProvider = new GitHubProvider(
        githubService, // Assume this is available from context or import
        selectedRepository,
        'main' // Could be made configurable
      );
      setDataProvider(githubProvider);
    }
  }, [show, activeTab, selectedRepository, documents, folderStructure]);

  const handleFileSelect = (files) => {
    setSelectedFiles(files);
  };

  const handleFileOpen = async (fileNode) => {
    try {
      if (fileNode.source === 'local') {
        // Open local document
        const document = documents.find(doc => doc.id === fileNode.documentId);
        if (document) {
          onOpen(document);
          handleHide();
        }
      } else if (fileNode.source === 'github') {
        // Import and open GitHub file
        const content = await dataProvider.getFileContent(fileNode);
        const importedDocument = {
          name: fileNode.name,
          content: content,
          folder_path: fileNode.path.replace(`/GitHub/${selectedRepository.owner}-${selectedRepository.name}/main`, ''),
          source: 'github',
          github_data: {
            repository_id: selectedRepository.id,
            file_path: fileNode.githubPath,
            branch: 'main',
            sha: fileNode.sha
          }
        };

        onOpen(importedDocument);
        handleHide();
        showSuccess(`Imported: ${fileNode.name}`);
      }
    } catch (error) {
      showError('Failed to open file');
      console.error('File open error:', error);
    }
  };

  const handleMultiSelect = (files) => {
    setSelectedFiles(files);
  };

  const handleHide = () => {
    setSelectedFiles([]);
    closeFileModal();
    onHide();
  };

  const fileBrowserConfig = {
    allowMultiSelect: activeTab === 'github',
    showPreview: true,
    showActions: true,
    defaultView: 'tree',
    filters: {
      fileTypes: ['.md', '.markdown'],
      sources: activeTab ? [activeTab] : ['local', 'github']
    }
  };

  return (
    <Modal
      show={show}
      onHide={handleHide}
      size="xl"
      className="file-browser-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title>
          {activeTab === 'github' ? 'Browse GitHub Repository' : 'Open Document'}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="p-0" style={{ height: '70vh' }}>
        {dataProvider ? (
          <UnifiedFileBrowser
            dataProvider={dataProvider}
            config={fileBrowserConfig}
            onFileSelect={handleFileSelect}
            onFileOpen={handleFileOpen}
            onMultiSelect={handleMultiSelect}
            selectedFiles={selectedFiles}
            showTabSelector={true}
            currentTab={activeTab}
            onTabChange={(tab) => {
              // Handle tab change if needed
              // This would update the FileModalContext
            }}
          />
        ) : (
          <div className="d-flex justify-content-center align-items-center h-100">
            <div>Loading...</div>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
}
```

## Enhanced UnifiedFileBrowser

### Add Tab Support and Improved UI

**File**: `frontend/src/components/shared/FileBrowser/UnifiedFileBrowser.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Tabs, Tab, Button, Form, InputGroup } from 'react-bootstrap';
import FileTree from './FileTree';
import FileList from './FileList';
import FilePreview from './FilePreview';
import FileBrowserHeader from './FileBrowserHeader';
import FileBrowserActions from './FileBrowserActions';
import './FileBrowser.css';

export default function UnifiedFileBrowser({
  dataProvider,
  config = {},
  onFileSelect,
  onFileOpen,
  onMultiSelect,
  selectedFiles = [],
  initialPath = '/',
  showTabSelector = false,
  currentTab = 'local',
  onTabChange
}) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [treeData, setTreeData] = useState([]);
  const [currentFiles, setCurrentFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState(config.defaultView || 'tree');

  // Load data when provider changes
  useEffect(() => {
    if (dataProvider) {
      loadTreeData();
    }
  }, [dataProvider]);

  useEffect(() => {
    if (dataProvider) {
      loadCurrentPathFiles();
    }
  }, [currentPath, dataProvider]);

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
    if (!currentPath) return;

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

  const handlePathChange = (newPath) => {
    setCurrentPath(newPath);
    setSelectedFile(null);
  };

  const handleFileClick = (file) => {
    setSelectedFile(file);
    if (onFileSelect) {
      onFileSelect([file]);
    }
  };

  const handleFileDoubleClick = (file) => {
    if (onFileOpen) {
      onFileOpen(file);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadCurrentPathFiles();
      return;
    }

    // If provider supports search, use it
    if (dataProvider.searchFiles) {
      try {
        const results = await dataProvider.searchFiles(searchQuery, currentPath);
        setCurrentFiles(results);
      } catch (error) {
        console.error('Search failed:', error);
      }
    } else {
      // Basic client-side filtering
      const filtered = currentFiles.filter(file =>
        file.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setCurrentFiles(filtered);
    }
  };

  const getBreadcrumbs = () => {
    if (!currentPath || currentPath === '/') return [];
    return currentPath.split('/').filter(part => part);
  };

  return (
    <div className="unified-file-browser h-100">
      {showTabSelector && (
        <Tabs activeKey={currentTab} onSelect={onTabChange} className="mb-3">
          <Tab eventKey="local" title="Local Documents" />
          <Tab eventKey="github" title="GitHub Repository" />
        </Tabs>
      )}

      <FileBrowserHeader
        currentPath={currentPath}
        breadcrumbs={getBreadcrumbs()}
        onPathChange={handlePathChange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <div className="search-bar mb-3">
        <InputGroup>
          <Form.Control
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button variant="outline-secondary" onClick={handleSearch}>
            Search
          </Button>
          {searchQuery && (
            <Button
              variant="outline-secondary"
              onClick={() => {
                setSearchQuery('');
                loadCurrentPathFiles();
              }}
            >
              Clear
            </Button>
          )}
        </InputGroup>
      </div>

      <Row className="flex-grow-1">
        {(viewMode === 'tree' || viewMode === 'split') && (
          <Col md={viewMode === 'split' ? 4 : 6} className="border-end">
            <FileTree
              treeData={treeData}
              currentPath={currentPath}
              onPathChange={handlePathChange}
              loading={loading}
            />
          </Col>
        )}

        <Col md={viewMode === 'tree' ? 6 : viewMode === 'split' ? 4 : 12}>
          <FileList
            files={currentFiles}
            selectedFiles={selectedFiles}
            onFileClick={handleFileClick}
            onFileDoubleClick={handleFileDoubleClick}
            loading={loading}
            allowMultiSelect={config.allowMultiSelect}
          />
        </Col>

        {config.showPreview && selectedFile && viewMode === 'split' && (
          <Col md={4} className="border-start">
            <FilePreview
              file={selectedFile}
              dataProvider={dataProvider}
            />
          </Col>
        )}
      </Row>

      {config.showActions && (
        <FileBrowserActions
          selectedFiles={selectedFiles}
          onImport={() => {
            if (selectedFiles.length > 0 && onFileOpen) {
              selectedFiles.forEach(file => onFileOpen(file));
            }
          }}
          onCancel={() => {
            // Clear selection or close modal
          }}
        />
      )}
    </div>
  );
}
```

## Dictionary Component Updates

### Rename and Update DictionaryCategorySelector

**File**: `frontend/src/components/modals/DictionaryFolderSelector.jsx` (renamed from DictionaryCategorySelector.jsx)

```jsx
import React from 'react';
import { Form } from 'react-bootstrap';

/**
 * Folder selector component for dictionary scope selection
 * Supports hierarchical folder structure for custom dictionaries
 */
export function DictionaryFolderSelector({
  folders,
  selectedFolder,
  onFolderChange,
  loading,
  isAuthenticated,
  currentDocumentPath = null
}) {
  // Show when folders are available or when there's a current document
  if ((!folders || folders.length === 0) && !currentDocumentPath) {
    return null;
  }

  // Extract root folder from current document path
  const getCurrentRootFolder = () => {
    if (!currentDocumentPath || currentDocumentPath === '/') return null;
    const parts = currentDocumentPath.split('/').filter(p => p);
    return parts.length > 0 ? `/${parts[0]}` : null;
  };

  const currentRootFolder = getCurrentRootFolder();

  return (
    <div className="mb-3">
      <Form.Group>
        <Form.Label>Dictionary Scope</Form.Label>
        <Form.Select
          value={selectedFolder || ''}
          onChange={(e) => {
            console.log('Folder changed from', selectedFolder, 'to', e.target.value);
            onFolderChange(e.target.value || null);
          }}
          disabled={loading}
        >
          <option value="">Personal Dictionary (All Documents)</option>

          {currentRootFolder && (
            <option value={currentRootFolder}>
              Current Folder Dictionary ({currentRootFolder})
            </option>
          )}

          {folders && folders.map(folder => (
            <option key={folder.path} value={folder.path}>
              {folder.name} Folder Dictionary
            </option>
          ))}
        </Form.Select>

        <Form.Text className="text-muted">
          {isAuthenticated
            ? "Choose whether to manage your personal dictionary or a folder-specific dictionary."
            : "Folder selection available after login. Currently showing local folders."
          }
        </Form.Text>
      </Form.Group>
    </div>
  );
}
```

### Update DictionaryTab Component

**File**: `frontend/src/components/modals/DictionaryTab.jsx`

```jsx
import React from "react";
import { Card, Alert, Button, Badge, Modal, Spinner, Form } from "react-bootstrap";
import { SpellCheckService } from "@/services/editor";
import { useDictionaryState, useDictionaryOperations, useDictionaryUI } from "@/hooks";
import { DictionaryFolderSelector } from "./DictionaryFolderSelector";  // Updated import
import { DictionaryAddWordForm } from "./DictionaryAddWordForm";
import { DictionaryWordList } from "./DictionaryWordList";
import { useDocumentContext } from "@/providers/DocumentContextProvider.jsx";

function DictionaryTab() {
  const { currentFolderPath, getRootFolders } = useDocumentContext();  // Get folder context

  // State management hooks
  const {
    entries,
    folders,  // Changed from categories to folders
    selectedFolder,  // Changed from selectedCategory to selectedFolder
    localWordCount,
    loading,
    syncing,
    isAuthenticated,
    setSelectedFolder,  // Changed from setSelectedCategory
    loadEntries,
    syncWithBackend,
    updateLocalWordCount
  } = useDictionaryState();

  // UI state management
  const {
    newWord,
    setNewWord,
    newWordNotes,
    setNewWordNotes,
    deleteConfirm,
    editingEntry,
    error,
    success,
    showSuccess,
    showError,
    handleFormSubmit,
    startEdit,
    cancelEdit,
    saveEdit,
    updateEditNotes,
    confirmDelete,
    cancelDelete,
    executeDelete
  } = useDictionaryUI();

  // Operations hook
  const {
    operationLoading,
    addWord,
    deleteWord,
    updateWordNotes
  } = useDictionaryOperations({
    selectedFolder,  // Changed from selectedCategory
    folders,         // Changed from categories
    onSuccess: showSuccess,
    onError: showError,
    onEntriesChange: async () => {
      await updateLocalWordCount();
      await loadEntries();
    }
  });

  // Combined loading state
  const isLoading = loading || operationLoading;

  // Handler functions
  const handleAddWord = (word, notes) => addWord(word, notes);
  const handleDeleteWord = (word) => deleteWord(word);
  const handleUpdateNotes = (entry, notes) => updateWordNotes(entry, notes);
  const handleSyncWithBackend = () => syncWithBackend();

  // Handle save edit - combine UI action with operation
  const handleSaveEdit = (entry, notes) => {
    const result = saveEdit(entry, notes);
    if (result) {
      handleUpdateNotes(result.entry, result.notes);
    }
  };

  // Handle local word deletion for unauthenticated users
  const handleLocalWordDelete = async (entry, folderPath) => {
    try {
      const { DictionaryService } = await import('@/services/utilities');

      if (folderPath) {
        DictionaryService.removeFolderWord(folderPath, entry.word);
      } else {
        DictionaryService.removeCustomWord(entry.word);
      }

      await updateLocalWordCount();
      await loadEntries();

      const scopeText = folderPath
        ? ` from ${folderPath} folder dictionary`
        : ' from personal dictionary';
      showSuccess(`Removed "${entry.word}"${scopeText}`);
    } catch (error) {
      console.error('Error deleting local word:', error);
      showError('Failed to remove word from local dictionary');
    }
  };

  // Extract root folders for folder selector
  const availableFolders = React.useMemo(() => {
    const rootFolders = getRootFolders();
    return rootFolders.map(folderName => ({
      path: `/${folderName}`,
      name: folderName
    }));
  }, [getRootFolders]);

  return (
    <Card className="mt-3">
      <Card.Body>
        <Card.Title>
          <i className="bi bi-book me-2"></i>Custom Dictionary
          <Badge bg="secondary" className="ms-2">
            {isAuthenticated
              ? `${entries.length} words`
              : selectedFolder
                ? `${localWordCount} folder words`
                : `${localWordCount} personal words`
            }
          </Badge>
          {selectedFolder && (
            <Badge bg="info" className="ms-2">
              {selectedFolder} Folder
            </Badge>
          )}
        </Card.Title>

        <Card.Text className="text-muted">
          {isAuthenticated
            ? selectedFolder
              ? `Manage custom words for the ${selectedFolder} folder. These words won't be flagged as misspelled in documents within this folder.`
              : "Manage your personal spell check dictionary. Words added here will not be flagged as misspelled in any document."
            : "Your custom words are stored locally. Log in to sync them across devices."
          }
        </Card.Text>

        {error && <Alert variant="danger">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}
        {syncing && (
          <Alert variant="info">
            <Spinner size="sm" className="me-2" />
            Syncing your local dictionary with the server...
          </Alert>
        )}

        <DictionaryFolderSelector
          folders={availableFolders}
          selectedFolder={selectedFolder}
          onFolderChange={setSelectedFolder}
          loading={isLoading}
          isAuthenticated={isAuthenticated}
          currentDocumentPath={currentFolderPath}
        />

        <DictionaryAddWordForm
          newWord={newWord}
          setNewWord={setNewWord}
          newWordNotes={newWordNotes}
          setNewWordNotes={setNewWordNotes}
          onSubmit={(e) => handleFormSubmit(e, handleAddWord)}
          loading={isLoading}
        />

        {isAuthenticated && (
          <div className="mb-3">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={handleSyncWithBackend}
              disabled={isLoading}
            >
              {syncing ? (
                <>
                  <Spinner size="sm" className="me-1" />
                  Syncing...
                </>
              ) : (
                <>
                  <i className="bi bi-arrow-clockwise me-1"></i>
                  Sync with Server
                </>
              )}
            </Button>
          </div>
        )}

        <DictionaryWordList
          entries={entries}
          editingEntry={editingEntry}
          onStartEdit={startEdit}
          onCancelEdit={cancelEdit}
          onSaveEdit={handleSaveEdit}
          onUpdateEditNotes={updateEditNotes}
          onDeleteWord={confirmDelete}
          loading={isLoading}
          isAuthenticated={isAuthenticated}
          folders={availableFolders}  // Changed from categories
          selectedFolder={selectedFolder}  // Changed from selectedCategory
          localWordCount={localWordCount}
          onLocalWordDelete={handleLocalWordDelete}
        />

        {/* Delete Confirmation Modal */}
        <Modal show={!!deleteConfirm} onHide={cancelDelete}>
          <Modal.Header closeButton>
            <Modal.Title>Confirm Delete</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            Are you sure you want to remove "{deleteConfirm}" from your dictionary?
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={cancelDelete}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => executeDelete(handleDeleteWord)}
              disabled={isLoading}
            >
              Delete
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Edit Notes Modal */}
        <Modal show={editingEntry !== null} onHide={cancelEdit}>
          <Modal.Header closeButton>
            <Modal.Title>Edit Notes for "{editingEntry?.word}"</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                handleUpdateNotes(editingEntry, formData.get('notes'));
              }}
            >
              <Form.Group>
                <Form.Label>Notes</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  name="notes"
                  defaultValue={editingEntry?.notes || ""}
                  placeholder="Optional notes about this word"
                />
              </Form.Group>
              <div className="mt-3">
                <Button type="submit" variant="primary" disabled={isLoading} className="me-2">
                  {isLoading ? <Spinner size="sm" /> : "Save"}
                </Button>
                <Button variant="secondary" onClick={cancelEdit}>
                  Cancel
                </Button>
              </div>
            </Form>
          </Modal.Body>
        </Modal>
      </Card.Body>
    </Card>
  );
}

export default DictionaryTab;
```

### Update Dictionary Hooks

**File**: `frontend/src/hooks/dictionary/useDictionaryState.js`

```javascript
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useDocumentContext } from '@/providers/DocumentContextProvider.jsx';
import { DictionaryService } from '@/services/utilities';

/**
 * Custom hook for managing dictionary state and operations
 * Updated to use folder-based organization instead of categories
 */
export function useDictionaryState() {
  const { user, isAuthenticated } = useAuth();
  const { currentFolderPath, getRootFolders } = useDocumentContext();

  // Core state
  const [entries, setEntries] = useState([]);
  const [folders, setFolders] = useState([]);  // Changed from categories
  const [selectedFolder, setSelectedFolder] = useState('');  // Changed from selectedCategory
  const [localWordCount, setLocalWordCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Update local word count
  const updateLocalWordCount = useCallback(async () => {
    console.log('updateLocalWordCount called with selectedFolder:', selectedFolder);
    const wordCount = DictionaryService.getWordCount(selectedFolder || null);
    console.log('updateLocalWordCount: words found:', wordCount);
    setLocalWordCount(wordCount);
  }, [selectedFolder]);

  // Load folders (replaces loadCategories)
  const loadFolders = useCallback(async () => {
    try {
      // Get available root folders from document context
      const rootFolders = getRootFolders();
      const folderList = rootFolders.map(folderName => ({
        id: `/${folderName}`,
        name: folderName,
        path: `/${folderName}`
      }));

      setFolders(folderList);
    } catch (error) {
      console.error('Failed to load folders:', error);
      setFolders([]);
    }
  }, [getRootFolders]);

  // Load dictionary entries
  const loadEntries = useCallback(async () => {
    console.log('loadEntries called with selectedFolder:', selectedFolder);

    // Update local word count first
    await updateLocalWordCount();

    setLoading(true);

    try {
      const folderPath = selectedFolder || null;
      const entries = await DictionaryService.getEntries(folderPath);
      setEntries(entries);
    } catch (err) {
      console.error('Failed to load dictionary entries:', err);
      if (err.message?.includes("Not authenticated")) {
        setEntries([]);
        throw new Error("Please log in to manage your custom dictionary on the server");
      } else {
        setEntries([]);
        throw new Error(err.message || "Failed to load dictionary entries");
      }
    } finally {
      setLoading(false);
    }
  }, [selectedFolder, updateLocalWordCount]);

  // Sync with backend
  const syncWithBackend = useCallback(async () => {
    setSyncing(true);
    setLoading(true);
    try {
      await DictionaryService.syncAfterLogin();
      await loadEntries(); // Reload entries to show any new words
      return "Dictionary synced with server. All folders updated.";
    } catch (err) {
      throw new Error(err.message || "Failed to sync dictionary");
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  }, [loadEntries]);

  // Handle folder selection change
  const handleFolderChange = useCallback((folderPath) => {
    console.log('Folder changed from', selectedFolder, 'to', folderPath);
    setSelectedFolder(folderPath);
  }, [selectedFolder]);

  // Load folders on mount and when authentication changes
  useEffect(() => {
    if (isAuthenticated) {
      loadFolders();
    } else {
      // For unauthenticated users, use document context folders
      loadFolders();
    }
  }, [isAuthenticated, loadFolders]);

  // Handle authentication state changes for syncing
  useEffect(() => {
    if (isAuthenticated) {
      // Auto-sync when user logs in
      syncWithBackend().catch(console.error);
    }
  }, [isAuthenticated]); // Removed syncWithBackend from dependency array

  // Load entries when component mounts or folder changes
  useEffect(() => {
    updateLocalWordCount();
    loadEntries().catch(console.error);
  }, [user, isAuthenticated, selectedFolder]); // Removed updateLocalWordCount, loadEntries from dependency array

  // Listen for dictionary update events
  useEffect(() => {
    const handler = async () => {
      await updateLocalWordCount();
      await loadEntries().catch(console.error);
    }

    window.addEventListener('dictionary:updated', handler);
    window.addEventListener('dictionary:folderUpdated', handler);  // Changed from categoryUpdated
    window.addEventListener('dictionary:wordUpdated', handler);

    return () => {
      window.removeEventListener('dictionary:updated', handler);
      window.removeEventListener('dictionary:folderUpdated', handler);
      window.removeEventListener('dictionary:wordUpdated', handler);
    };
  }, [updateLocalWordCount, loadEntries]);

  return {
    // State
    entries,
    folders,          // Changed from categories
    selectedFolder,   // Changed from selectedCategory
    localWordCount,
    loading,
    syncing,
    isAuthenticated,

    // Actions
    setSelectedFolder: handleFolderChange,  // Changed from setSelectedCategory
    loadEntries,
    syncWithBackend,
    updateLocalWordCount
  };
}
```

## Folder Management Components

### Folder Navigation Component

**File**: `frontend/src/components/shared/FolderNavigation.jsx`

```jsx
import React from 'react';
import { Breadcrumb, Button, Dropdown } from 'react-bootstrap';
import { FaFolder, FaFolderOpen, FaPlus } from 'react-icons/fa';

export default function FolderNavigation({
  currentPath,
  onPathChange,
  onCreateFolder,
  showCreateFolder = false
}) {
  const breadcrumbs = currentPath === '/' ? [] : currentPath.split('/').filter(part => part);

  const handleBreadcrumbClick = (index) => {
    if (index === -1) {
      onPathChange('/');
    } else {
      const newPath = '/' + breadcrumbs.slice(0, index + 1).join('/');
      onPathChange(newPath);
    }
  };

  return (
    <div className="folder-navigation d-flex justify-content-between align-items-center mb-3">
      <Breadcrumb className="mb-0">
        <Breadcrumb.Item
          active={currentPath === '/'}
          onClick={() => handleBreadcrumbClick(-1)}
          style={{ cursor: 'pointer' }}
        >
          <FaFolder /> Root
        </Breadcrumb.Item>

        {breadcrumbs.map((part, index) => (
          <Breadcrumb.Item
            key={index}
            active={index === breadcrumbs.length - 1}
            onClick={() => handleBreadcrumbClick(index)}
            style={{ cursor: 'pointer' }}
          >
            {index === breadcrumbs.length - 1 ? <FaFolderOpen /> : <FaFolder />}
            {part}
          </Breadcrumb.Item>
        ))}
      </Breadcrumb>

      {showCreateFolder && (
        <Button
          variant="outline-primary"
          size="sm"
          onClick={onCreateFolder}
        >
          <FaPlus /> New Folder
        </Button>
      )}
    </div>
  );
}
```

### Folder Management Modal

**File**: `frontend/src/components/shared/FolderManagementModal.jsx`

```jsx
import React, { useState } from 'react';
import { Modal, Form, Button, Alert } from 'react-bootstrap';
import { useDocumentContext } from '../../contexts/DocumentContext';
import { useNotification } from '../../contexts/NotificationContext';

export default function FolderManagementModal({ show, onHide, currentPath = '/' }) {
  const [folderName, setFolderName] = useState('');
  const [creating, setCreating] = useState(false);
  const { createFolder } = useDocumentContext();
  const { showSuccess, showError } = useNotification();

  const handleCreate = async () => {
    if (!folderName.trim()) return;

    try {
      setCreating(true);
      const newFolderPath = currentPath === '/'
        ? `/${folderName}`
        : `${currentPath}/${folderName}`;

      await createFolder(newFolderPath);
      setFolderName('');
      onHide();
    } catch (error) {
      showError('Failed to create folder');
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setFolderName('');
    onHide();
  };

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Create New Folder</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Form>
          <Form.Group>
            <Form.Label>Folder Name</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter folder name..."
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
            />
            <Form.Text className="text-muted">
              Will be created in: {currentPath}
            </Form.Text>
          </Form.Group>
        </Form>

        {currentPath !== '/' && (
          <Alert variant="info">
            <strong>Note:</strong> This will create a subfolder structure.
            For better organization, consider creating root-level folders.
          </Alert>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleCreate}
          disabled={!folderName.trim() || creating}
        >
          {creating ? 'Creating...' : 'Create Folder'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
```

## CSS Styling

### Unified File Browser Styles

**File**: `frontend/src/components/shared/FileBrowser/FileBrowser.css`

```css
.unified-file-browser {
  display: flex;
  flex-direction: column;
}

.file-browser-modal .modal-body {
  padding: 0;
}

.search-bar {
  padding: 0 1rem;
}

.file-tree {
  height: 400px;
  overflow-y: auto;
  border-right: 1px solid #dee2e6;
}

.file-list {
  height: 400px;
  overflow-y: auto;
}

.file-preview {
  height: 400px;
  overflow-y: auto;
  border-left: 1px solid #dee2e6;
  padding: 1rem;
}

.file-tree-node {
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  border-radius: 0.25rem;
  margin: 0.125rem 0;
}

.file-tree-node:hover {
  background-color: #f8f9fa;
}

.file-tree-node.selected {
  background-color: #007bff;
  color: white;
}

.file-tree-node .node-icon {
  margin-right: 0.5rem;
  width: 16px;
  text-align: center;
}

.file-tree-node .node-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-list-item {
  padding: 0.5rem;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.file-list-item:hover {
  background-color: #f8f9fa;
}

.file-list-item.selected {
  background-color: #e3f2fd;
}

.file-list-item .file-icon {
  margin-right: 0.75rem;
  width: 20px;
  text-align: center;
}

.file-list-item .file-info {
  flex: 1;
}

.file-list-item .file-name {
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.file-list-item .file-meta {
  font-size: 0.875rem;
  color: #6c757d;
}

.folder-breadcrumb {
  background-color: #f8f9fa;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid #dee2e6;
}

.view-mode-selector {
  display: flex;
  gap: 0.5rem;
}

.view-mode-selector .btn {
  padding: 0.25rem 0.5rem;
}

.folder-navigation {
  background-color: #f8f9fa;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #dee2e6;
}

.folder-navigation .breadcrumb {
  margin-bottom: 0;
}

.github-badge {
  background-color: #28a745;
  color: white;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  margin-left: 0.5rem;
}

.local-badge {
  background-color: #6c757d;
  color: white;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  margin-left: 0.5rem;
}
```

## Testing

### Component Integration Tests

**File**: `frontend/src/tests/integration/FileOpenModal.test.js`

```javascript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import FileOpenModal from '../../components/file/FileOpenModal';
import { DocumentProvider } from '../../contexts/DocumentContext';
import { AuthProvider } from '../../contexts/AuthContext';
import { NotificationProvider } from '../../contexts/NotificationContext';

// Mock API modules
jest.mock('../../api/documents');
jest.mock('../../services/FileBrowserProviders');

const TestWrapper = ({ children }) => (
  <BrowserRouter>
    <AuthProvider>
      <NotificationProvider>
        <DocumentProvider>
          {children}
        </DocumentProvider>
      </NotificationProvider>
    </AuthProvider>
  </BrowserRouter>
);

describe('FileOpenModal Integration', () => {
  test('displays unified file browser for local documents', async () => {
    const mockOnOpen = jest.fn();
    const mockOnHide = jest.fn();

    render(
      <TestWrapper>
        <FileOpenModal
          show={true}
          onHide={mockOnHide}
          onOpen={mockOnOpen}
        />
      </TestWrapper>
    );

    // Should show the file browser
    expect(screen.getByText('Open Document')).toBeInTheDocument();

    // Should show folder structure
    await waitFor(() => {
      expect(screen.getByText('Root')).toBeInTheDocument();
    });
  });

  test('switches between local and GitHub tabs', async () => {
    render(
      <TestWrapper>
        <FileOpenModal
          show={true}
          onHide={() => {}}
          onOpen={() => {}}
        />
      </TestWrapper>
    );

    // Should have tab selector
    const localTab = screen.getByText('Local Documents');
    const githubTab = screen.getByText('GitHub Repository');

    expect(localTab).toBeInTheDocument();
    expect(githubTab).toBeInTheDocument();

    // Click GitHub tab
    fireEvent.click(githubTab);

    await waitFor(() => {
      expect(screen.getByText('Browse GitHub Repository')).toBeInTheDocument();
    });
  });
});
```

## Documentation Updates

### Update Component Documentation

**File**: `frontend/src/components/shared/FileBrowser/README.md`

```markdown
# Unified File Browser

The UnifiedFileBrowser component provides a consistent interface for browsing both local documents and GitHub repositories.

## Usage

```jsx
import UnifiedFileBrowser from './components/shared/FileBrowser/UnifiedFileBrowser';
import { LocalDocumentsProvider } from './services/FileBrowserProviders';

const provider = new LocalDocumentsProvider(documentContext);

<UnifiedFileBrowser
  dataProvider={provider}
  config={{
    allowMultiSelect: true,
    showPreview: true,
    showActions: true,
    defaultView: 'tree'
  }}
  onFileSelect={(files) => console.log('Selected:', files)}
  onFileOpen={(file) => console.log('Opening:', file)}
/>
```

## Props

- `dataProvider`: Provider implementing the FileBrowserProvider interface
- `config`: Configuration object for browser behavior
- `onFileSelect`: Callback for file selection
- `onFileOpen`: Callback for file opening
- `onMultiSelect`: Callback for multiple file selection
- `selectedFiles`: Array of currently selected files
- `initialPath`: Starting folder path
- `showTabSelector`: Whether to show local/GitHub tabs
- `currentTab`: Active tab ('local' or 'github')
- `onTabChange`: Callback for tab changes

## Data Providers

### LocalDocumentsProvider
Provides access to local documents stored in the database.

### GitHubProvider
Provides access to GitHub repository files.

Both providers implement the `BaseFileBrowserProvider` interface.
```

## Success Criteria

- [ ] FileOpenModal successfully uses UnifiedFileBrowser
- [ ] Local documents display in folder tree structure
- [ ] GitHub repositories display with natural folder hierarchy
- [ ] Tab switching between local and GitHub works correctly
- [ ] Document operations (open, select) work for both sources
- [ ] Folder navigation with breadcrumbs functions properly
- [ ] Search functionality works within folders
- [ ] UI is responsive and matches design expectations
- [ ] Integration tests pass for all major workflows

## Next Phase

Phase 7 will focus on comprehensive testing, creating migration scripts for production deployment, and finalizing the transition by removing legacy category-based code.
