import React, { useState, useEffect } from "react";
import { Card, Dropdown, ButtonGroup } from "react-bootstrap";
import UnifiedFileBrowser from "../../shared/FileBrowser/UnifiedFileBrowser";
import { LocalDocumentsProvider } from "../../../services/FileBrowserProviders";
import { createFileBrowserProvider } from "../../../services/providers/UnifiedFileBrowserProvider";
import { useUnifiedFileOpening } from "../../../services/core/UnifiedFileOpeningService";
import GitHubAccountList from "../../shared/GitHubAccountList";
import GitHubRepositorySettings from "../../github/settings/GitHubRepositorySettings";
import config from '../../../config';

export default function UnifiedFileBrowserTab({
  documents,
  categories,
  onFileOpen,
  onDocumentDelete,
  onModalHide,
  // GitHub-specific props
  initialRepository = null,
  setContent = null,
  setDocumentTitle = null,
  showSuccess = null,
  showError = null
}) {
  const [currentDataSource, setCurrentDataSource] = useState('local'); // 'local' or 'github'
  const [currentProvider, setCurrentProvider] = useState(null);
  const [initialPath, setInitialPath] = useState('/');

  // GitHub-specific state
  const [selectedRepository, setSelectedRepository] = useState(initialRepository);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [showRepositorySelection, setShowRepositorySelection] = useState(false);
  const [showRepositorySettings, setShowRepositorySettings] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);

  // Unified file opening hook
  const { openFromFileNode, isOpening, lastError } = useUnifiedFileOpening();

  // Auto-select GitHub if initialRepository provided
  useEffect(() => {
    if (initialRepository) {
      setCurrentDataSource('github');
      setSelectedRepository(initialRepository);
      setSelectedBranch(initialRepository.default_branch || 'main');
    }
  }, [initialRepository]);

  // Create provider based on current data source
  useEffect(() => {
    if (currentDataSource === 'local' && documents && categories) {
      console.log('🏠 Creating local documents provider');
      const provider = new LocalDocumentsProvider({ documents, categories }, { filters: { fileTypes: [] } });
      setCurrentProvider(provider);
      setInitialPath(provider.getDefaultPath ? provider.getDefaultPath() : '/');
    } else if (currentDataSource === 'github' && selectedRepository) {
      console.log('🐙 Creating GitHub provider for:', selectedRepository.repo_name);
      const provider = createFileBrowserProvider({
        type: 'github',
        repositoryId: selectedRepository.id,
        repositoryName: selectedRepository.repo_name || selectedRepository.name,
        branch: selectedBranch
      });
      setCurrentProvider(provider);
      setInitialPath('/');
    }
  }, [currentDataSource, documents, categories, selectedRepository, selectedBranch]);

  const handleDataSourceChange = (dataSource) => {
    console.log('📊 Switching data source to:', dataSource);
    setCurrentDataSource(dataSource);

    if (dataSource === 'github' && !selectedRepository) {
      setShowRepositorySelection(true);
    } else {
      setShowRepositorySelection(false);
    }
  };

  const handleRepositorySelect = (repository, account) => {
    console.log('🚀 Repository selected:', repository.repo_name);
    setSelectedRepository(repository);
    setSelectedBranch(repository.default_branch || 'main');
    setShowRepositorySelection(false);
  };

  const handleFileSelect = (file) => {
    console.log('👆 File selected for preview:', file);
    // File selection for preview is handled by UnifiedFileBrowser internally
    // The preview panel will show the content automatically
  };

  const handleRepositorySettings = (account) => {
    console.log('🔧 Opening repository settings for account:', account.username);
    setSelectedAccount(account);
    setShowRepositorySettings(true);
    setShowRepositorySelection(false);
  };

  const handleBackToRepositorySelection = () => {
    setShowRepositorySettings(false);
    setShowRepositorySelection(true);
    setSelectedAccount(null);
  };

  const handleFileOpen = async (file) => {
    console.log('📂 UnifiedFileBrowserTab handleFileOpen:', file);

    if (currentDataSource === 'local') {
      // Handle local documents (existing working logic)
      const doc = documents?.find((d) => d.id === file.documentId);
      if (doc) {
        onFileOpen(doc);
        onModalHide();
      }
    } else if (currentDataSource === 'github') {
      // Handle GitHub files using unified service
      try {
        console.log('🐙 Opening GitHub file:', file);
        console.log('🔍 File structure:', JSON.stringify(file, null, 2));
        console.log('🔧 Current provider:', currentProvider);

        // Use unified file opening service with current provider
        const document = await openFromFileNode(file, currentProvider);

        console.log('📄 Document received:', JSON.stringify(document, null, 2));

        // All files (local and GitHub) now use the same flow - they're real documents
        console.log('� Using unified document flow');
        onFileOpen(document);

        if (showSuccess) {
          const fileType = document.repository_type === 'github' ? 'GitHub' : 'local';
          showSuccess(`Opened ${fileType} file: ${document.name}`);
        }

        onModalHide();
      } catch (error) {
        console.error('❌ Failed to open GitHub file:', error);
        if (showError) {
          showError(`Error opening file: ${error.message}`);
        }
        // Errors are handled by the useUnifiedFileOpening hook
      }
    }
  };

  // Show loading state while provider is being created
  if (!currentProvider && !showRepositorySelection) {
    return (
      <div className="d-flex justify-content-center align-items-center p-4">
        <div className="text-muted">
          <i className="bi bi-folder2 me-2"></i>
          Loading file browser...
        </div>
      </div>
    );
  }

  return (
    <div className="unified-file-browser-container">
      {/* Data Source Selector */}
      <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
        <div className="d-flex align-items-center">
          <span className="me-3 text-muted">Browse:</span>
          <ButtonGroup>
            <button
              className={`btn btn-sm ${currentDataSource === 'local' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => handleDataSourceChange('local')}
            >
              <i className="bi bi-folder me-1"></i>
              Local Documents
            </button>
            <button
              className={`btn btn-sm ${currentDataSource === 'github' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => handleDataSourceChange('github')}
            >
              <i className="bi bi-github me-1"></i>
              GitHub Repositories
            </button>
          </ButtonGroup>
        </div>

        {/* Current source indicator */}
        <div className="text-muted small d-flex align-items-center">
          {currentDataSource === 'local' && (
            <span><i className="bi bi-folder me-1"></i>Local ({documents?.length || 0} documents)</span>
          )}
          {currentDataSource === 'github' && selectedRepository && (
            <div className="d-flex align-items-center">
              <button
                className="btn btn-link btn-sm p-0 me-2 text-primary"
                onClick={() => setShowRepositorySelection(true)}
                title="Back to repository selection"
              >
                <i className="bi bi-arrow-left me-1"></i>
                Back
              </button>
              <span><i className="bi bi-github me-1"></i>{selectedRepository.repo_owner}/{selectedRepository.repo_name} ({selectedBranch})</span>
            </div>
          )}
          {currentDataSource === 'github' && !selectedRepository && (
            <span><i className="bi bi-github me-1"></i>Select a repository</span>
          )}
        </div>
      </div>

      {/* Repository Settings for GitHub */}
      {showRepositorySettings && selectedAccount && (
        <div style={{ height: '500px' }}>
          <GitHubRepositorySettings
            account={selectedAccount}
            onBack={handleBackToRepositorySelection}
          />
        </div>
      )}

      {/* Repository Selection for GitHub */}
      {showRepositorySelection && currentDataSource === 'github' && !showRepositorySettings && (
        <div style={{ height: '400px' }}>
          <GitHubAccountList
            onBrowseRepository={handleRepositorySelect}
            onRepositorySettings={handleRepositorySettings}
            documents={documents}
          />
        </div>
      )}

      {/* Unified File Browser */}
      {currentProvider && !showRepositorySelection && !showRepositorySettings && (
        <div className="file-browser-content">
          <UnifiedFileBrowser
            dataProvider={currentProvider}
            onFileSelect={handleFileSelect}  // Single-click: Preview
            onFileOpen={handleFileOpen}      // Double-click: Open in editor
            initialPath={initialPath}
            breadcrumbType={currentDataSource}
            breadcrumbData={{
              // Local breadcrumb data
              categories: currentDataSource === 'local' ? categories : undefined,
              documents: currentDataSource === 'local' ? documents : undefined,
              // GitHub breadcrumb data
              repository: currentDataSource === 'github' ? selectedRepository : undefined,
              branch: currentDataSource === 'github' ? selectedBranch : undefined
            }}
            config={{
              allowMultiSelect: false,
              showPreview: true,
              showActions: true,
              showBreadcrumb: true
            }}
            className="unified-browser"
            style={{ height: '500px' }}
          />
        </div>
      )}

      {/* Loading/Error States for file operations */}
      {isOpening && (
        <div className="text-center p-3">
          <div className="spinner-border spinner-border-sm me-2" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          Opening file...
        </div>
      )}

      {lastError && (
        <div className="alert alert-danger small mt-2">
          <strong>Error:</strong> {lastError.message}
        </div>
      )}
    </div>
  );
}