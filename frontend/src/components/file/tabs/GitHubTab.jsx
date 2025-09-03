import React, { useState, useEffect } from "react";
import GitHubAccountList from "../../shared/GitHubAccountList";
import UnifiedFileBrowser from "../../shared/FileBrowser/UnifiedFileBrowser";
import GitHubBrowserHeader from "../../github/browser/GitHubBrowserHeader";
import { GitHubProvider } from "../../../services/FileBrowserProviders";
import { useNotification } from "../../NotificationProvider";
import useFileModal from "../../../hooks/ui/useFileModal";
import gitHubApi from "../../../api/gitHubApi";

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
  const { showError } = useNotification();
  const { returnCallback, closeFileModal } = useFileModal();

  // Auto-select repository if provided via global state
  useEffect(() => {
    if (selectedRepository) {
      handleGitHubRepositorySelect(selectedRepository);
    }
  }, [selectedRepository]);

  const handleGitHubRepositorySelect = async (repository) => {
    console.log('Selected GitHub repository:', repository);
    setSelectedGitHubRepo(repository);
    await loadBranches(repository);
  };

  const loadBranches = async (repository) => {
    try {
      setLoading(true);
      const branchData = await gitHubApi.getRepositoryBranches(repository.id);
      setBranches(branchData);
      
      // Set default branch
      const defaultBranch = branchData.find(b => b.name === repository.default_branch) || branchData[0];
      const branch = defaultBranch ? defaultBranch.name : 'main';
      setSelectedBranch(branch);
      
      // Create provider with the selected branch
      const provider = new GitHubProvider(repository, branch);
      setGitHubProvider(provider);
    } catch (err) {
      showError('Failed to load repository branches');
      console.error('Error loading branches:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBranchChange = (newBranch) => {
    setSelectedBranch(newBranch);
    if (selectedGitHubRepo) {
      const provider = new GitHubProvider(selectedGitHubRepo, newBranch);
      setGitHubProvider(provider);
    }
  };

  const handleGitHubFileOpen = async (file) => {
    console.log('Opening GitHub file:', file);
    // GitHub files need to be imported first
    if (!file.isImported) {
      showError('File must be imported before opening. Use the import action.');
      return;
    }
    
    // If the file has been imported, it should have a documentId
    if (file.documentId) {
      const doc = documents?.find((d) => d.id === file.documentId);
      if (doc) {
        onFileOpen(doc);
        onModalHide();
      } else {
        showError('Imported document not found in local documents.');
      }
    } else {
      showError('GitHub file not properly imported.');
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      {!selectedGitHubRepo ? (
        <GitHubAccountList
          onBrowseRepository={handleGitHubRepositorySelect}
          compact={true}
        />
      ) : (
        <div style={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          flex: 1,
          minHeight: 0
        }}>
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
                setSelectedGitHubRepo(null);
                setGitHubProvider(null);
                setBranches([]);
                setSelectedBranch('main');
              }
            }}
            loading={loading}
            showReturnButton={!!returnCallback}
          />
          
          {/* File browser */}
          {gitHubProvider && !loading && (
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column',
              minHeight: 0,
              marginTop: '1rem'
            }}>
              <UnifiedFileBrowser
                dataProvider={gitHubProvider}
                onFileOpen={handleGitHubFileOpen}
                showPreview={true}
                breadcrumbType="github"
                breadcrumbData={{ repository: selectedGitHubRepo }}
                config={{
                  showActions: false,
                  showBreadcrumb: true,
                  showTreeBreadcrumb: false
                }}
              />
            </div>
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
