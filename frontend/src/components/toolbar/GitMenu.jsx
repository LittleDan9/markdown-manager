import React, { useState, useEffect } from 'react';
import { Dropdown, Badge, Spinner } from 'react-bootstrap';
import { useDocumentContext } from '@/providers/DocumentContextProvider';
import { useNotification } from '@/components/NotificationProvider';
import gitHubApi from '@/api/gitHubApi';

export default function GitMenu() {
  const { currentDocument } = useDocumentContext();
  const { showSuccess, showError, showInfo } = useNotification();
  const [gitStatus, setGitStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load git status when document changes
  useEffect(() => {
    if (currentDocument?.id) {
      loadGitStatus(currentDocument.id);
    } else {
      setGitStatus(null);
    }
  }, [currentDocument]);

  const loadGitStatus = async (documentId) => {
    if (!documentId) return;
    
    setLoading(true);
    try {
      const status = await gitHubApi.getDocumentGitStatus(documentId);
      setGitStatus(status);
    } catch (error) {
      console.warn('Failed to load git status:', error.message);
      setGitStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!currentDocument?.id) return;

    const commitMessage = prompt('Enter commit message:');
    if (!commitMessage) return;

    setLoading(true);
    try {
      const result = await gitHubApi.commitDocumentChanges(currentDocument.id, commitMessage);
      
      showSuccess(`Successfully committed changes: ${result.commit_hash?.substring(0, 7) || 'success'}`);
      
      // Reload status after commit
      await loadGitStatus(currentDocument.id);
    } catch (error) {
      showError(`Failed to commit changes: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshStatus = () => {
    if (currentDocument?.id) {
      loadGitStatus(currentDocument.id);
    }
  };

  const handleViewFiles = () => {
    // Navigate to file browser for the current document's repository
    if (gitStatus?.repository_type === 'github') {
      showInfo('GitHub file browser: Navigate to GitHub → Repositories to browse repository files');
    } else {
      showInfo('Local file browser: Use the document list sidebar to browse local files by category');
    }
  };

  const handleViewHistory = async () => {
    if (!currentDocument?.id) return;
    
    setLoading(true);
    try {
      // For now, we'll show a simplified history in the console
      // In the future, this could open a dedicated history modal
      showInfo('Git history: Check browser console for commit history (full history viewer coming soon)');
      
      // Try to get basic git log info
      const repoInfo = {
        documentId: currentDocument.id,
        repositoryType: gitStatus?.repository_type || 'local',
        branch: gitStatus?.current_branch || 'main'
      };
      
      console.log('Git Repository Info:', repoInfo);
      console.log('Current Git Status:', gitStatus);
      
    } catch (error) {
      showError(`Failed to get repository info: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncRemote = () => {
    if (gitStatus?.repository_type === 'github') {
      showInfo('GitHub sync: Use GitHub → Save to GitHub to push changes to remote repository');
    } else {
      showInfo('Local repositories do not have remote sync. Use GitHub → Save to GitHub to create a remote repository.');
    }
  };

  const handleCreateBranch = () => {
    showInfo('Branch management: Full branch creation and switching functionality coming soon');
  };

  const handleStash = () => {
    showInfo('Stash management: Stash save, apply, and management functionality coming soon');
  };

  const handleShowDocumentInfo = () => {
    const info = {
      name: currentDocument?.name,
      id: currentDocument?.id,
      filePath: currentDocument?.file_path,
      repositoryType: currentDocument?.repository_type,
      githubRepositoryId: currentDocument?.github_repository_id,
      category: currentDocument?.category,
      folderPath: currentDocument?.folder_path
    };
    
    console.log('Current Document Info:', info);
    showInfo('Document information logged to console - useful for debugging git operations');
  };

  const renderStatusBadge = () => {
    if (loading) {
      return (
        <Spinner size="sm" className="me-1" />
      );
    }

    if (!gitStatus) {
      return (
        <Badge bg="secondary" className="ms-1">
          <i className="bi bi-question-circle me-1"></i>
          Unknown
        </Badge>
      );
    }

    if (gitStatus.has_uncommitted_changes || gitStatus.has_staged_changes || gitStatus.has_untracked_files) {
      return (
        <Badge bg="warning" text="dark" className="ms-1">
          <i className="bi bi-exclamation-circle me-1"></i>
          Changes
        </Badge>
      );
    }

    return (
      <Badge bg="success" className="ms-1">
        <i className="bi bi-check-circle me-1"></i>
        Clean
      </Badge>
    );
  };

  // Show git menu for any document since all are in git repositories
  if (!currentDocument) {
    return null;
  }

  return (
    <Dropdown>
      <Dropdown.Toggle 
        variant="outline-secondary" 
        size="sm" 
        className="d-flex align-items-center"
        disabled={loading}
      >
        <i className="bi bi-git me-1"></i>
        {gitStatus?.current_branch && !loading && (
          <span className="me-1">{gitStatus.current_branch}</span>
        )}
        {renderStatusBadge()}
      </Dropdown.Toggle>

      <Dropdown.Menu>
        <Dropdown.Header className="d-flex align-items-center justify-content-between">
          <div>
            <i className="bi bi-git me-2"></i>
            Repository: {gitStatus?.repository_type || 'local'}
          </div>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={handleRefreshStatus}
            disabled={loading}
            title="Refresh git status"
          >
            <i className="bi bi-arrow-clockwise"></i>
          </button>
        </Dropdown.Header>
        
        {gitStatus && (
          <>
            <Dropdown.Item disabled>
              <div className="small">
                <div><strong>Branch:</strong> {gitStatus.current_branch}</div>
                {(gitStatus.has_uncommitted_changes || gitStatus.has_staged_changes || gitStatus.has_untracked_files) && (
                  <div className="text-warning mt-1">
                    <i className="bi bi-exclamation-triangle me-1"></i>
                    <strong>Uncommitted changes detected</strong>
                    {gitStatus.modified_files?.length > 0 && <div>• {gitStatus.modified_files.length} modified files</div>}
                    {gitStatus.staged_files?.length > 0 && <div>• {gitStatus.staged_files.length} staged files</div>}
                    {gitStatus.untracked_files?.length > 0 && <div>• {gitStatus.untracked_files.length} untracked files</div>}
                  </div>
                )}
                {!gitStatus.has_uncommitted_changes && !gitStatus.has_staged_changes && !gitStatus.has_untracked_files && (
                  <div className="text-success mt-1">
                    <i className="bi bi-check-circle me-1"></i>
                    Working directory clean
                  </div>
                )}
              </div>
            </Dropdown.Item>
            
            <Dropdown.Divider />
          </>
        )}

        <Dropdown.Item 
          onClick={handleCommit} 
          disabled={loading || (!gitStatus?.has_uncommitted_changes && !gitStatus?.has_staged_changes && !gitStatus?.has_untracked_files)}
        >
          <i className="bi bi-check-square me-2"></i>
          Commit Changes
          {(!gitStatus?.has_uncommitted_changes && !gitStatus?.has_staged_changes && !gitStatus?.has_untracked_files) && (
            <small className="text-muted ms-2">(no changes)</small>
          )}
        </Dropdown.Item>
        
        <Dropdown.Divider />
        
        <Dropdown.Item onClick={handleCreateBranch} disabled={loading}>
          <i className="bi bi-diagram-3 me-2"></i>
          Create Branch
          <small className="text-muted ms-2">(coming soon)</small>
        </Dropdown.Item>
        
        <Dropdown.Item onClick={handleStash} disabled={loading}>
          <i className="bi bi-archive me-2"></i>
          Stash Changes
          <small className="text-muted ms-2">(coming soon)</small>
        </Dropdown.Item>
        
        <Dropdown.Divider />
        
        {gitStatus?.repository_type === 'github' && (
          <>
            <Dropdown.Item onClick={handleSyncRemote} disabled={loading}>
              <i className="bi bi-cloud-arrow-up-down me-2"></i>
              Sync with GitHub
            </Dropdown.Item>
            <Dropdown.Divider />
          </>
        )}
        
        <Dropdown.Item onClick={handleViewFiles} disabled={loading}>
          <i className="bi bi-folder me-2"></i>
          Browse Repository Files
        </Dropdown.Item>
        
        <Dropdown.Item onClick={handleViewHistory} disabled={loading}>
          <i className="bi bi-clock-history me-2"></i>
          View Commit History
        </Dropdown.Item>
        
        <Dropdown.Divider />
        
        <Dropdown.Item onClick={handleShowDocumentInfo} disabled={loading}>
          <i className="bi bi-info-circle me-2"></i>
          Document Info
          <small className="text-muted ms-2">(console)</small>
        </Dropdown.Item>
        
        <Dropdown.Item onClick={handleRefreshStatus} disabled={loading}>
          <i className="bi bi-arrow-clockwise me-2"></i>
          Refresh Status
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );
}