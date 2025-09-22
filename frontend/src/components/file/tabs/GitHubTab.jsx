import React, { useState, useEffect } from "react";
import GitHubAccountList from "../../shared/GitHubAccountList";
import UnifiedFileBrowser from "../../shared/FileBrowser/UnifiedFileBrowser";
import GitHubBrowserHeader from "../../github/browser/GitHubBrowserHeader";
import GitHubRepositorySettings from "../../github/settings/GitHubRepositorySettings";
import { GitHubProvider } from "../../../services/FileBrowserProviders";
import { useNotification } from "../../NotificationProvider";
import useFileModal from "../../../hooks/ui/useFileModal";
import gitHubApi from "../../../api/gitHubApi";
import githubOAuthListener from "../../../utils/GitHubOAuthListener";

export default function GitHubTab({
  isAuthenticated,
  documents,
  onFileOpen,
  onModalHide,
  selectedRepository = null
}) {
  const [selectedGitHubRepo, setSelectedGitHubRepo] = useState(null);
  const [gitHubProvider, setGitHubProvider] = useState(null);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [loading, setLoading] = useState(false);
  const [currentView, setCurrentView] = useState('accounts'); // 'accounts', 'browser', 'settings'
  const [selectedAccount, setSelectedAccount] = useState(null);
  const { showError, showSuccess } = useNotification();
  const { returnCallback, closeFileModal } = useFileModal();

  // Set up global OAuth listener for this tab
  useEffect(() => {
    console.log('GitHubTab: Setting up global OAuth listener');
    const cleanup = githubOAuthListener.addListener((event) => {
      console.log('GitHubTab: Received OAuth result', event);
      if (event.data.type === 'GITHUB_AUTH_SUCCESS') {
        console.log('GitHubTab: Processing OAuth success - refreshing account list');
        // The GitHubAccountList component should handle its own refresh
      } else if (event.data.type === 'GITHUB_AUTH_ERROR') {
        console.log('GitHubTab: Processing OAuth error');
        showError('GitHub authentication failed');
      }
    });

    return cleanup;
  }, []);

  // Auto-select repository if provided via global state
  useEffect(() => {
    if (selectedRepository) {
      handleGitHubRepositorySelect(selectedRepository);
    }
  }, [selectedRepository]);

  const handleGitHubRepositorySelect = async (repository) => {
    console.log('Selected GitHub repository:', repository);
    setSelectedGitHubRepo(repository);
    setCurrentView('browser');
    await loadBranches(repository);
  };

  const handleRepositorySettings = (account) => {
    setSelectedAccount(account);
    setCurrentView('settings');
  };

  const handleBackToAccounts = () => {
    setCurrentView('accounts');
    setSelectedGitHubRepo(null);
    setSelectedAccount(null);
    setGitHubProvider(null);
    setBranches([]);
    setSelectedBranch('main');
  };

  const loadBranches = async (repository) => {
    try {
      setLoading(true);

      // Check if repository has an internal repo ID (required for branches API)
      if (!repository.internal_repo_id) {
        // For repositories without internal IDs, we'll create a minimal branch list
        // using the default branch from the repository selection data
        const defaultBranch = repository.default_branch || 'main';
        setBranches([{ name: defaultBranch }]);
        setSelectedBranch(defaultBranch);

        // Create provider with the default branch
        const provider = new GitHubProvider(repository, defaultBranch, { filters: { fileTypes: [] } });
        setGitHubProvider(provider);
        return;
      }

      // Use the internal repo ID for the branches API
      const branchData = await gitHubApi.getRepositoryBranches(repository.internal_repo_id);
      setBranches(branchData);

      // Set default branch
      const defaultBranch = branchData.find(b => b.name === repository.default_branch) || branchData[0];
      const branch = defaultBranch ? defaultBranch.name : 'main';
      setSelectedBranch(branch);

      // Create provider with the selected branch
      const provider = new GitHubProvider(repository, branch, { filters: { fileTypes: [] } });
      setGitHubProvider(provider);
    } catch (err) {
      // Fallback to default branch if branches API fails
      console.warn('Failed to load branches, using default branch:', err);
      const defaultBranch = repository.default_branch || 'main';
      setBranches([{ name: defaultBranch }]);
      setSelectedBranch(defaultBranch);

      // Create provider with the default branch
      const provider = new GitHubProvider(repository, defaultBranch, { filters: { fileTypes: [] } });
      setGitHubProvider(provider);

      showError('Failed to load repository branches, using default branch');
    } finally {
      setLoading(false);
    }
  };

  const handleBranchChange = (newBranch) => {
    setSelectedBranch(newBranch);
    if (selectedGitHubRepo) {
      const provider = new GitHubProvider(selectedGitHubRepo, newBranch, { filters: { fileTypes: [] } });
      setGitHubProvider(provider);
    }
  };

  const handleGitHubFileOpen = async (file) => {
    console.log('Opening GitHub file:', file);

    try {
      setLoading(true);

      // Check if file is already imported and has a documentId
      if (file.isImported && file.documentId) {
        const doc = documents?.find((d) => d.id === file.documentId);
        if (doc) {
          onFileOpen(doc);
          onModalHide();
          return;
        } else {
          // Document was marked as imported but not found in local documents list
          // Since user is authenticated, fetch the document from backend
          console.log(`Document ID ${file.documentId} not found locally, fetching from backend...`);
          try {
            // Create a minimal document object with the known ID
            // The handleOpenFile/loadDocument logic will fetch the full document
            const documentToOpen = {
              id: file.documentId,
              name: file.name || 'Unknown Document'
            };
            onFileOpen(documentToOpen);
            onModalHide();
            return;
          } catch (err) {
            console.warn(`Failed to open document ID ${file.documentId}, falling back to re-import:`, err);
            // If opening fails, fall through to re-import logic
          }
        }
      }

      // File needs to be imported first - do it automatically
      console.log('Importing GitHub file automatically...');

      const importResponse = await gitHubApi.importDocument({
        repository_id: selectedGitHubRepo.id,
        file_path: file.githubPath || file.path,
        branch: selectedBranch || selectedGitHubRepo.default_branch || 'main',
        category: 'GitHub Import'
      });

      console.log('Import response:', importResponse);

      // Handle the new enhanced import response format
      let importedDoc = null;

      // Check if we got the new format with results.imported array
      if (importResponse.results?.imported?.length > 0) {
        const importResult = importResponse.results.imported[0];
        // Create a minimal document object that handleOpenFile can use
        importedDoc = {
          id: importResult.document_id,
          name: importResult.name
        };
      }
      // Fallback to old formats for backward compatibility
      else if (importResponse.document) {
        importedDoc = importResponse.document;
      } else if (importResponse.data?.document) {
        importedDoc = importResponse.data.document;
      } else if (importResponse.id) {
        importedDoc = importResponse;
      }

      if (importedDoc) {
        console.log('Successfully imported document:', importedDoc);
        onFileOpen(importedDoc);
        onModalHide();
      } else if (importResponse.results?.errors?.length > 0) {
        // Show specific error from the import results
        const errorMsg = importResponse.results.errors[0].error || 'Import failed';
        showError(`Failed to import file: ${errorMsg}`);
      } else {
        showError('Failed to import file. Invalid response format.');
      }

    } catch (err) {
      console.error('Import and open failed:', err);
      showError('Failed to import and open file. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      {currentView === 'accounts' && (
        <GitHubAccountList
          onBrowseRepository={handleGitHubRepositorySelect}
          onRepositorySettings={handleRepositorySettings}
          compact={true}
          maxHeight="70vh"
        />
      )}

      {currentView === 'settings' && selectedAccount && (
        <GitHubRepositorySettings
          account={selectedAccount}
          onBack={handleBackToAccounts}
        />
      )}

      {currentView === 'browser' && selectedGitHubRepo && (
        <div className="file-browser-container">
          {/* Repository header with integrated back button and branch selection */}
          <GitHubBrowserHeader
            repository={selectedGitHubRepo}
            branches={branches}
            selectedBranch={selectedBranch}
            onBranchChange={handleBranchChange}
            onBack={() => {
              // Check if there's a return callback (came from GitHub System Modal)
              if (returnCallback) {
                closeFileModal(); // This will trigger the callback
              } else {
                // Regular back to repository selection
                handleBackToAccounts();
              }
            }}
            loading={loading}
            showReturnButton={!!returnCallback}
          />

          {/* File browser */}
          {gitHubProvider && !loading && (
            <UnifiedFileBrowser
              dataProvider={gitHubProvider}
              onFileOpen={handleGitHubFileOpen}
              showPreview={true}
              breadcrumbType="github"
              breadcrumbData={{ repository: selectedGitHubRepo }}
              config={{
                showActions: true,
                showBreadcrumb: true,
                showTreeBreadcrumb: false
              }}
            />
          )}

          {/* Loading indicator */}
          {loading && (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading branches...</span>
              </div>
              <div className="mt-2">Loading repository branches...</div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
