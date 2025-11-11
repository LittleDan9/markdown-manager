import React, { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Card, Badge, Button, Row, Col, Spinner } from 'react-bootstrap';
import { useNotification } from '../../NotificationProvider';
import useFileModal from '../../../hooks/ui/useFileModal';
import gitHubApi from '../../../api/gitHubApi';

const GitHubRepositoryList = forwardRef(({
  repositories,
  accountId,
  onRepositoryBrowse,
  onRepositoryUpdate,
  onStatusUpdate
}, ref) => {
  const { showSuccess, showError } = useNotification();
  const { openGitHubTab } = useFileModal();
  const [repositoryStatuses, setRepositoryStatuses] = useState({});
  const [loadingStatuses, setLoadingStatuses] = useState(new Set());

  // Expose refresh method to parent component
  useImperativeHandle(ref, () => ({
    refreshStatuses: () => loadRepositoryStatuses()
  }));

  // Load git status for all repositories when component mounts or repositories change
  useEffect(() => {
    if (repositories.length > 0) {
      loadRepositoryStatuses();
    }
  }, [repositories, loadRepositoryStatuses]);

  const loadRepositoryStatuses = useCallback(async () => {
    const statusPromises = repositories.map(async (repo) => {
      // Only try to get status for repositories that have an internal repo ID
      if (!repo.internal_repo_id && !repo.id) return null;

      const repoId = repo.internal_repo_id || repo.id;
      console.log(`Loading status for repo ${repo.name}:`, {
        github_repo_id: repo.github_repo_id,
        internal_repo_id: repo.internal_repo_id,
        id: repo.id,
        using_repo_id: repoId
      });
      setLoadingStatuses(prev => new Set(prev).add(repoId));

      try {
        const status = await gitHubApi.getRepositoryStatus(repoId);
        console.log(`Status for repo ${repo.name}:`, status);
        return { repoId, status };
      } catch (error) {
        // Status check is optional - don't show errors for this
        console.warn(`Failed to get status for repository ${repo.name}:`, error.message);
        return { repoId, status: null };
      } finally {
        setLoadingStatuses(prev => {
          const newSet = new Set(prev);
          newSet.delete(repoId);
          return newSet;
        });
      }
    });

    const results = await Promise.all(statusPromises);
    const statusMap = {};

    results.forEach(result => {
      if (result) {
        statusMap[result.repoId] = result.status;
      }
    });

    setRepositoryStatuses(statusMap);

    // Call the status update callback to update parent component's overview
    if (onStatusUpdate) {
      onStatusUpdate(statusMap);
    }
  }, [repositories, onStatusUpdate]);

  const getLanguageColor = (language) => {
    if (!language) return 'secondary';

    const colors = {
      JavaScript: 'warning',
      TypeScript: 'info',
      Python: 'success',
      Java: 'danger',
      'C#': 'primary',
      Go: 'secondary',
      HTML: 'danger',
      CSS: 'info',
      SCSS: 'info',
      PHP: 'primary',
      Ruby: 'danger',
      Swift: 'warning',
      Kotlin: 'primary',
      Rust: 'dark',
      'C++': 'primary',
      C: 'secondary',
      Shell: 'secondary',
      PowerShell: 'info',
      Vue: 'success',
      React: 'info',
      Svelte: 'warning',
      Dart: 'info',
      Elixir: 'primary',
      Clojure: 'success',
      Haskell: 'primary',
      Lua: 'primary',
      Perl: 'info',
      R: 'info',
      Scala: 'danger',
      MATLAB: 'warning',
      Julia: 'primary',
      'Objective-C': 'info',
      'Objective-C++': 'primary',
      Assembly: 'warning',
      HCL: 'info',
      PLpgSQL: 'primary'
    };
    return colors[language] || 'secondary';
  };

  const handleBrowseRepository = (repo) => {
    // Check if there's a callback to open FileOpen Modal instead
    if (onRepositoryBrowse) {
      onRepositoryBrowse(repo);
      return;
    }

    // Open the repository in the file modal
    openGitHubTab(repo);
  };

  const handleSyncRepository = async (repo) => {
    try {
      console.log('Sync repository:', repo);
      showSuccess(`Syncing ${repo.name} with remote...`);
    } catch (error) {
      showError(`Failed to sync ${repo.name}`);
    }
  };

  const handleRetryClone = async (repo) => {
    try {
      // We can call the add repository selection API again, which should attempt to re-clone
      const gitHubRepositorySelectionApi = (await import('../../../api/gitHubRepositorySelectionApi')).default;
      const result = await gitHubRepositorySelectionApi.addRepositorySelection(accountId, repo.github_repo_id);

      if (result.clone_success) {
        showSuccess(`${repo.name} cloned successfully`);
        // Refresh repository data to get updated internal_repo_id and then refresh status
        if (onRepositoryUpdate) {
          await onRepositoryUpdate();
          // Small delay to ensure repository data is updated before checking status
          setTimeout(() => {
            loadRepositoryStatuses();
          }, 500);
        } else {
          // Fallback: just refresh status
          loadRepositoryStatuses();
        }
      } else {
        showError(`Clone retry failed: ${result.clone_message || 'Unknown error'}`);
      }
    } catch (error) {
      showError(`Failed to retry clone for ${repo.name}`);
    }
  };

  const renderGitStatus = (repo) => {
    const repoId = repo.internal_repo_id || repo.id;
    const isLoading = loadingStatuses.has(repoId);
    const status = repositoryStatuses[repoId];

    if (isLoading) {
      return (
        <div className="git-status-indicator loading">
          <Spinner size="sm" className="me-1" />
          <small className="text-muted">Loading status...</small>
        </div>
      );
    }

    if (!status) {
      return (
        <div className="git-status-indicator offline">
          <Badge bg="secondary" className="me-1 d-flex align-items-center">
            <i className="bi bi-question-circle me-1"></i>
            Status Unknown
          </Badge>
        </div>
      );
    }

    return (
      <div className="git-status-indicator">
        <div className="d-flex align-items-center gap-2 mb-1">
          {/* Only show branch if it's actually available */}
          {status.branch && status.branch !== 'unknown' && (
            <Badge bg="info" className="d-flex align-items-center">
              <i className="bi bi-git me-1"></i>
              {status.branch}
            </Badge>
          )}

          {status.has_changes && (
            <Badge bg="warning" className="d-flex align-items-center">
              <i className="bi bi-exclamation-circle me-1"></i>
              Changes
            </Badge>
          )}

          {!status.has_changes && status.branch && status.branch !== 'unknown' && (
            <Badge bg="success" className="d-flex align-items-center">
              <i className="bi bi-check-circle me-1"></i>
              Clean
            </Badge>
          )}

          {/* Show error/unavailable status if git status failed */}
          {status.branch === 'unknown' && (
            <Badge bg="warning" className="d-flex align-items-center">
              <i className="bi bi-exclamation-triangle me-1"></i>
              Clone Failed
            </Badge>
          )}
        </div>
        {status.has_changes && (
          <div className="small text-muted">
            {status.modified_files.length > 0 && (
              <span className="me-2">
                <i className="bi bi-pencil me-1"></i>
                {status.modified_files.length} modified
              </span>
            )}
            {status.staged_files.length > 0 && (
              <span className="me-2">
                <i className="bi bi-plus-circle me-1"></i>
                {status.staged_files.length} staged
              </span>
            )}
            {status.untracked_files.length > 0 && (
              <span>
                <i className="bi bi-question-circle me-1"></i>
                {status.untracked_files.length} untracked
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  if (repositories.length === 0) {
    return (
      <div className="text-center py-4">
        <i className="bi bi-folder-check fs-1 text-muted"></i>
        <h5 className="mt-3 text-muted">No repositories in workspace</h5>
        <p className="text-muted">
          You haven&apos;t added any repositories to your workspace yet.
          Use the &quot;Manage Repository Selection&quot; button to add repositories.
        </p>
      </div>
    );
  }

  return (
    <>
      <Row>
        {repositories.map((repo) => (
          <Col md={6} lg={4} key={repo.id} className="mb-3">
            <Card className="h-100 github-repo-card">
              <Card.Body className="d-flex flex-column">
                {/* Repository Header - Title and Badges */}
                <div className="repo-header">
                  {/* Repository Title Row */}
                  <div className="repo-title-row">
                    <h6 className="card-title">
                      <i className={`bi ${repo.private ? 'bi-lock' : 'bi-folder'} me-2`}></i>
                      {repo.name}
                    </h6>
                  </div>

                  {/* Badges Row */}
                  <div className="repo-badges-row">
                    <Badge bg={repo.private ? 'warning' : 'success'} className="badge-status">
                      {repo.private ? 'Private' : 'Public'}
                    </Badge>
                    {repo.language && (
                      <Badge bg={getLanguageColor(repo.language)} className="badge-language">
                        {repo.language}
                      </Badge>
                    )}
                    <Badge bg="primary" className="badge-selected d-flex align-items-center">
                      <i className="bi bi-check-circle me-1" style={{ fontSize: '0.75em' }}></i>
                      In Workspace
                    </Badge>
                  </div>
                </div>

                {/* Repository Content */}
                <div className="repo-content flex-grow-1">
                  {repo.description && (
                    <p className="card-text small text-muted mb-2">
                      {repo.description}
                    </p>
                  )}

                  {/* Git Status Section */}
                  <div className="mb-3">
                    {renderGitStatus(repo)}
                  </div>

                  <div className="small text-muted mb-3">
                    <div className="d-flex justify-content-between">
                      <span>
                        <i className="bi bi-code-slash me-1"></i>
                        Default: {repo.default_branch}
                      </span>
                      <span>
                        {repo.sync_enabled ? (
                          <span className="text-success">
                            <i className="bi bi-arrow-clockwise me-1"></i>
                            Sync Enabled
                          </span>
                        ) : (
                          <span className="text-warning">
                            <i className="bi bi-pause-circle me-1"></i>
                            Sync Disabled
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Repository Actions */}
                <div className="repo-actions d-flex gap-2 mt-auto">
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => handleBrowseRepository(repo)}
                    className="flex-grow-1"
                    disabled={repositoryStatuses[repo.internal_repo_id || repo.id]?.branch === 'unknown'}
                  >
                    <i className="bi bi-folder-open me-1"></i>
                    Browse
                  </Button>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => loadRepositoryStatuses()}
                    title="Refresh Status"
                  >
                    <i className="bi bi-arrow-clockwise"></i>
                  </Button>
                  {/* Show different action based on repository status */}
                  {repositoryStatuses[repo.internal_repo_id || repo.id]?.branch === 'unknown' ? (
                    <Button
                      variant="outline-warning"
                      size="sm"
                      onClick={() => handleRetryClone(repo)}
                      title="Retry Clone"
                    >
                      <i className="bi bi-arrow-clockwise"></i>
                      Retry
                    </Button>
                  ) : (
                    <Button
                      variant="outline-success"
                      size="sm"
                      onClick={() => handleSyncRepository(repo)}
                      title="Sync with Remote"
                    >
                      <i className="bi bi-cloud-download"></i>
                    </Button>
                  )}
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

    </>
  );
});

GitHubRepositoryList.displayName = 'GitHubRepositoryList';

export default GitHubRepositoryList;
