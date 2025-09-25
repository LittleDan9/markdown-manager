/**
 * EXAMPLE: Updated GitHubTab using Unified File Opening
 *
 * This demonstrates how the GitHub tab would be simplified
 * by removing the branching logic and using unified document access.
 */

import React, { useState, useEffect } from 'react';
import { createGitHubProvider } from '../../../services/providers/UnifiedFileBrowserProvider';
import { useUnifiedFileOpening } from '../../../services/core/UnifiedFileOpeningService';
import UnifiedFileBrowser from '../../shared/FileBrowser/UnifiedFileBrowser';
import GitHubAccountList from '../../shared/GitHubAccountList';

export default function UnifiedGitHubTab({
  initialRepository = null,
  initialBranch = null,
  onFileOpen,
  onModalHide,
  documents = []
}) {
  const [selectedRepository, setSelectedRepository] = useState(initialRepository);
  const [selectedBranch, setSelectedBranch] = useState(initialBranch);
  const [gitHubProvider, setGitHubProvider] = useState(null);
  const [currentView, setCurrentView] = useState('accounts'); // 'accounts' or 'browser'

  // Use unified file opening hook
  const { openFromFileNode, isOpening, lastError } = useUnifiedFileOpening();

  // Auto-select repository if provided
  useEffect(() => {
    if (initialRepository) {
      setSelectedRepository(initialRepository);
      setCurrentView('browser');
    }
  }, [initialRepository]);

  // Create provider when repository/branch changes
  useEffect(() => {
    if (selectedRepository && selectedBranch) {
      const provider = createGitHubProvider(
        selectedRepository.id,
        selectedRepository.repo_name || selectedRepository.name,
        selectedBranch
      );
      setGitHubProvider(provider);
    }
  }, [selectedRepository, selectedBranch]);

  // Repository selection from account list  
  const handleGitHubRepositorySelect = (repository, account) => {
    console.log('UnifiedGitHubTab: Repository selected', repository);
    setSelectedRepository(repository);
    setSelectedBranch(repository.default_branch || 'main');
    setCurrentView('browser');
  };

  // SIMPLIFIED: Single file opening handler for all cases
  const handleFileOpen = async (fileNode) => {
    console.log('Opening file:', fileNode);

    try {
      // Single unified call - no more branching logic!
      const document = await openFromFileNode(fileNode);

      // Success - same callback for all document types
      onFileOpen(document);
      onModalHide();

    } catch (error) {
      console.error('Failed to open file:', error);
      alert(`Failed to open ${fileNode.name}: ${error.message}`);
    }
  };

  const handleBackToAccounts = () => {
    setCurrentView('accounts');
    setSelectedRepository(null);
    setGitHubProvider(null);
  };

  return (
    <div className="github-tab">
      {/* Repository/Branch Selection */}
      <div className="mb-3">
        <select
          value={selectedRepository?.id || ''}
          onChange={(e) => {
            const repo = repositories.find(r => r.id == e.target.value);
            setSelectedRepository(repo);
          }}
          className="form-select mb-2"
        >
          <option value="">Select Repository...</option>
          {repositories.map(repo => (
            <option key={repo.id} value={repo.id}>
              {repo.repo_owner}/{repo.repo_name}
            </option>
          ))}
        </select>

        {selectedRepository && (
          <select
            value={selectedBranch || ''}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="form-select"
          >
            <option value="">Select Branch...</option>
            {/* Branches would be loaded dynamically */}
            <option value="main">main</option>
            <option value="develop">develop</option>
          </select>
        )}
      </div>

      {/* File Browser - Same Component, Different Provider */}
      {gitHubProvider && (
        <UnifiedFileBrowser
          dataProvider={gitHubProvider}
          onFileOpen={handleFileOpen} // Same handler as local!
          breadcrumbType="github"
          config={{
            showActions: true,
            showPreview: true,
            showBreadcrumb: true,
            allowMultiSelect: false
          }}
        />
      )}

      {/* Loading indicator */}
      {isOpening && (
        <div className="text-center p-3">
          <div className="spinner-border spinner-border-sm me-2" />
          Opening document...
        </div>
      )}

      {/* Error display */}
      {lastError && (
        <div className="alert alert-danger">
          Error: {lastError.message}
        </div>
      )}
    </div>
  );
}

/*
KEY IMPROVEMENTS:

1. ✅ SINGLE FILE OPENING HANDLER
   - No more branching between local/GitHub logic
   - Same `handleFileOpen` function for all document types
   - Backend determines source type and handles accordingly

2. ✅ UNIFIED FILE BROWSER COMPONENT
   - Same UnifiedFileBrowser component for GitHub and local
   - Only provider changes, UI stays identical
   - Branch dropdown integrates naturally into existing layout

3. ✅ SIMPLIFIED ERROR HANDLING
   - Single error path for all document types
   - Consistent user feedback patterns
   - Easy to add loading states and notifications

4. ✅ EXTENSIBLE ARCHITECTURE
   - Easy to add new source types (Dropbox, etc.)
   - Provider pattern handles source-specific logic
   - UI components remain unchanged

MIGRATION PATH:
- Keep existing GitHubTab.jsx as GitHubTab_Legacy.jsx
- Gradually migrate to UnifiedGitHubTab
- Test both side-by-side before switching
- Remove legacy after confidence is high
*/