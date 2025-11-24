/**
 * Unified GitHub Tab - Simplified using unified document architecture
 *
 * This demonstrates the unified approach:
 * - Single file opening method for all document types
 * - Document ID-centric access
 * - Maintains existing 3-tier layout (accounts -> repositories -> files)
 * - All enhanced features preserved
 */

import React, { useState, useEffect } from 'react';
import { createGitHubProvider } from '../../../services/providers/UnifiedFileBrowserProvider';
import { useUnifiedFileOpening } from '../../../services/core/UnifiedFileOpeningService';
import UnifiedFileBrowser from '../../shared/FileBrowser/UnifiedFileBrowser';
import GitHubAccountList from '../../shared/GitHubAccountList';
import GitHubRepositorySettings from '../../github/settings/GitHubRepositorySettings';
import config from '../../../config';

export default function UnifiedGitHubTab({
  initialRepository = null,
  onFileOpen,
  onModalHide,
  documents = [],
  setContent = null, // Add setContent prop for direct content setting
  setDocumentTitle = null, // Add title setting
  showSuccess = null // Add success notification
}) {
  const [selectedRepository, setSelectedRepository] = useState(initialRepository);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [gitHubProvider, setGitHubProvider] = useState(null);
  const [currentView, setCurrentView] = useState('accounts'); // 'accounts', 'settings', or 'browser'

  // Use unified file opening hook
  const { openFromFileNode, isOpening, lastError } = useUnifiedFileOpening();

  // Auto-select repository if provided
  useEffect(() => {
    if (initialRepository) {
      setSelectedRepository(initialRepository);
      setSelectedBranch(initialRepository.default_branch || 'main');
      setCurrentView('browser');
    }
  }, [initialRepository]);

  // Create provider when repository/branch changes
  useEffect(() => {
    if (selectedRepository && selectedBranch) {
      console.log('🔧 Creating GitHub provider for:', {
        repositoryId: selectedRepository.id,
        repositoryName: selectedRepository.repo_name || selectedRepository.name,
        branch: selectedBranch
      });

      const provider = createGitHubProvider(
        selectedRepository.id,
        selectedRepository.repo_name || selectedRepository.name || selectedRepository.full_name,
        selectedBranch
      );

      console.log('✅ GitHub provider created:', provider);
      setGitHubProvider(provider);
    }
  }, [selectedRepository, selectedBranch]);

  // Repository selection from account list
  const _handleGitHubRepositorySelect = (repository, account) => {
    console.log('UnifiedGitHubTab: Repository selected', repository);
    setSelectedRepository(repository);
    setSelectedBranch(repository.default_branch || 'main');
    setSelectedAccount(account);
    setCurrentView('browser');
  };

  // Repository browsing from account list (unified approach)
  const handleBrowseRepository = (repository) => {
    console.log('🚀 UnifiedGitHubTab: Browse repository', repository);
    console.log('📊 Repository data:', {
      id: repository.id,
      name: repository.name,
      full_name: repository.full_name,
      default_branch: repository.default_branch,
      owner: repository.owner
    });

    setSelectedRepository(repository);
    setSelectedBranch(repository.default_branch || 'main');
    // Account will be set from the repository owner info if available
    setSelectedAccount({
      id: repository.account_id || repository.github_account_id,
      username: repository.owner?.login || repository.repo_owner
    });
    setCurrentView('browser');
  };

  // Navigate to repository settings
  const handleRepositorySettings = (account) => {
    console.log('UnifiedGitHubTab: Opening repository settings', account);
    setSelectedAccount(account);
    setCurrentView('settings');
  };

  // Repository selected from settings (unified approach)
  const _handleRepositorySelectedFromSettings = (repository, account) => {
    console.log('UnifiedGitHubTab: Repository selected from settings', repository);
    setSelectedRepository(repository);
    setSelectedBranch(repository.default_branch || 'main');
    setSelectedAccount(account);
    setCurrentView('browser');
  };

  // PREVIEW HANDLER: Single-click shows content in preview panel (3rd tier)
  const handleFileSelect = async (fileNode) => {
    console.log('📖 Preview file (single-click):', fileNode);

    // Don't preview folders
    if (fileNode.type === 'folder' || fileNode.type === 'dir') {
      console.log('Skipping folder preview:', fileNode.name);
      return;
    }

    // File selection for preview is handled by UnifiedFileBrowser internally
    // The preview panel will show the content automatically
  };

  // EDITOR HANDLER: Double-click or "Open File" button opens in editor
  const handleFileOpen = async (fileNode) => {
    console.log('🚀 Opening file in editor (double-click/button):', fileNode);

    // Don't try to open folders
    if (fileNode.type === 'folder' || fileNode.type === 'dir') {
      console.log('Skipping folder:', fileNode.name);
      return;
    }

    try {
      // Single unified call - pass provider for GitHub files
      const document = await openFromFileNode(fileNode, gitHubProvider);

      // For GitHub files, handle completely within unified system
      if (document._isDirectGitHubFile) {
        console.log('🎯 GitHub file opened directly - setting content immediately');

        // Set content directly without going through legacy document loading
        if (setContent) {
          setContent(document.content);
        }
        if (setDocumentTitle) {
          setDocumentTitle(document.name);
        }
        if (showSuccess) {
          showSuccess(`Opened GitHub file: ${document.name}`);
        }
      } else {
        // Regular documents - use normal flow
        onFileOpen(document);
      }

      onModalHide();

    } catch (error) {
      console.error('Failed to open file:', error);
      // Errors are handled by the useUnifiedFileOpening hook
    }
  };

  const handleBackToAccounts = () => {
    setCurrentView('accounts');
    setSelectedRepository(null);
    setSelectedAccount(null);
    setGitHubProvider(null);
  };

  const handleBackFromSettings = () => {
    setCurrentView('accounts');
    setSelectedAccount(null);
  };

  return (
    <div className="github-tab" style={{ height: '70vh', display: 'flex', flexDirection: 'column' }}>
      {currentView === 'accounts' && (
        <GitHubAccountList
          onBrowseRepository={handleBrowseRepository}
          onRepositorySettings={handleRepositorySettings}
          documents={documents}
        />
      )}

      {currentView === 'settings' && selectedAccount && (
        <div>
          <div className="d-flex align-items-center mb-3">
            {config.features.unifiedArchitecture && (
              <div className="alert alert-info alert-sm mb-3 w-100">
                <i className="bi bi-info-circle me-2"></i>
                <strong>Unified Architecture Note:</strong> Repository settings now integrate directly with
                document management. Selected repositories will be available through the unified file browser.
              </div>
            )}
          </div>

          <GitHubRepositorySettings
            account={selectedAccount}
            onBack={handleBackFromSettings}
          />
        </div>
      )}

      {currentView === 'browser' && selectedRepository && gitHubProvider && (
        <div>
          {/* Header with back button and repository info */}
          <div className="d-flex align-items-center mb-3 border-bottom pb-2">
            <button
              className="btn btn-link text-decoration-none p-0 me-3"
              onClick={handleBackToAccounts}
              title="Back to Accounts"
            >
              <i className="bi bi-arrow-left"></i>
            </button>
            <div className="flex-grow-1">
              <strong>{selectedRepository.repo_owner}/{selectedRepository.repo_name}</strong>
              <small className="text-muted ms-2">({selectedBranch})</small>
              <small className="badge bg-success ms-2">Unified</small>
            </div>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => handleRepositorySettings(selectedAccount)}
              title="Repository Settings"
            >
              <i className="bi bi-gear me-1"></i>
              Settings
            </button>
          </div>

          {/* UNIFIED FILE BROWSER - Correct prop mapping for 3-tier behavior */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <UnifiedFileBrowser
              dataProvider={gitHubProvider}
              onFileSelect={handleFileSelect}  // Single-click: Preview in 3rd tier
              onFileOpen={handleFileOpen}      // Double-click/button: Open in editor
              showRoot={false}
              className="github-browser"
              style={{ height: '100%' }}
            />
          </div>
        </div>
      )}

      {/* Loading/Error States handled by unified hook */}
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