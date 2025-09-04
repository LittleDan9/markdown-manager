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
  const { showError, showSuccess } = useNotification();
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
    
    try {
      setLoading(true);
      
      // Check if file is already imported and has a documentId
      if (file.isImported && file.documentId) {
        const doc = documents?.find((d) => d.id === file.documentId);
        if (doc) {
          onFileOpen(doc);
          onModalHide();
          return;
        }
      }
      
      // File needs to be imported first - do it automatically
      console.log('Importing GitHub file automatically...');
      
      const importResponse = await gitHubApi.importDocument({
        repository_id: selectedGitHubRepo.id,
        file_path: file.githubPath || file.path,
        branch: selectedBranch,
        category: 'GitHub Import'
      });
      
      console.log('Import response:', importResponse);
      
      // Handle different possible response formats
      let importedDoc = null;
      if (importResponse.document) {
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
      {!selectedGitHubRepo ? (
        <GitHubAccountList
          onBrowseRepository={handleGitHubRepositorySelect}
          compact={true}
        />
      ) : (
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
