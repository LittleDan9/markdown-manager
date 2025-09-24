import React, { useState, useEffect } from 'react';
import { Card, Badge, Button, Row, Col, Spinner } from 'react-bootstrap';
import { useNotification } from '../../NotificationProvider';
import useFileModal from '../../../hooks/ui/useFileModal';
import gitHubApi from '../../../api/gitHubApi';

export default function GitHubRepositoryList({ repositories, accountId, onRepositoryBrowse }) {
  const { showSuccess, showError } = useNotification();
  const { openGitHubTab } = useFileModal();
  const [repositoryStatuses, setRepositoryStatuses] = useState({});
  const [loadingStatuses, setLoadingStatuses] = useState(new Set());

  // Load git status for all repositories when component mounts or repositories change
  useEffect(() => {
    if (repositories.length > 0) {
      loadRepositoryStatuses();
    }
  }, [repositories]);

  const loadRepositoryStatuses = async () => {
    const statusPromises = repositories.map(async (repo) => {
      // Only try to get status for repositories that have an internal repo ID
      if (!repo.internal_repo_id && !repo.id) return null;
      
      const repoId = repo.internal_repo_id || repo.id;
      setLoadingStatuses(prev => new Set(prev).add(repoId));
      
      try {
        const status = await gitHubApi.getRepositoryStatus(repoId);
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
  };

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
      showSuccess(`Syncing ${repo.name} repository`);
    } catch (error) {
      showError(`Failed to sync ${repo.name}`);
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
          <Badge bg="secondary" className="me-1">
            <i className="bi bi-cloud-slash me-1"></i>
            Not Cloned
          </Badge>
        </div>
      );
    }

    return (
      <div className="git-status-indicator">
        <div className="d-flex align-items-center gap-2 mb-1">
          <Badge bg="info" className="d-flex align-items-center">
            <i className="bi bi-git me-1"></i>
            {status.branch}
          </Badge>
          {status.has_changes && (
            <Badge bg="warning" className="d-flex align-items-center">
              <i className="bi bi-exclamation-circle me-1"></i>
              Changes
            </Badge>
          )}
          {!status.has_changes && (
            <Badge bg="success" className="d-flex align-items-center">
              <i className="bi bi-check-circle me-1"></i>
              Clean
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
        <h5 className="mt-3 text-muted">No selected repositories</h5>
        <p className="text-muted">
          You haven't selected any repositories yet.
          Use the "Manage Repository Selection" button to choose repositories to sync.
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
                <div className="d-flex align-items-start justify-content-between mb-2">
                  <div className="flex-grow-1">
                    <h6 className="card-title mb-1">
                      <i className={`bi ${repo.private ? 'bi-lock' : 'bi-folder'} me-2`}></i>
                      {repo.name}
                    </h6>
                    <small className="text-muted">{repo.full_name}</small>
                  </div>
                  <div className="d-flex gap-1">
                    <Badge bg={repo.private ? 'warning' : 'success'}>
                      {repo.private ? 'Private' : 'Public'}
                    </Badge>
                    {repo.language && (
                      <Badge bg={getLanguageColor(repo.language)}>
                        {repo.language}
                      </Badge>
                    )}
                    <Badge bg="primary" className="d-flex align-items-center">
                      <i className="bi bi-check-circle me-1" style={{ fontSize: '0.75em' }}></i>
                      Selected
                    </Badge>
                  </div>
                </div>

                <div className="flex-grow-1">
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

                <div className="d-flex gap-2 mt-auto">
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => handleBrowseRepository(repo)}
                    className="flex-grow-1"
                  >
                    <i className="bi bi-folder-open me-1"></i>
                    Browse
                  </Button>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => loadRepositoryStatuses()}
                    title="Refresh Git Status"
                  >
                    <i className="bi bi-arrow-clockwise"></i>
                  </Button>
                  <Button
                    variant="outline-success"
                    size="sm"
                    onClick={() => handleSyncRepository(repo)}
                    title="Sync Repository"
                  >
                    <i className="bi bi-cloud-download"></i>
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

    </>
  );
}
