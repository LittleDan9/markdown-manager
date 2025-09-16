import React from 'react';
import { Card, Badge, Button, Row, Col } from 'react-bootstrap';
import { useNotification } from '../../NotificationProvider';
import useFileModal from '../../../hooks/ui/useFileModal';

export default function GitHubRepositoryList({ repositories, accountId, onRepositoryBrowse }) {
  const { showSuccess, showError } = useNotification();
  const { openGitHubTab } = useFileModal();

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

  if (repositories.length === 0) {
    return (
      <div className="text-center py-4">
        <i className="bi bi-folder-x fs-1 text-muted"></i>
        <h5 className="mt-3 text-muted">No repositories found</h5>
        <p className="text-muted">
          This GitHub account doesn't have any accessible repositories,
          or they haven't been loaded yet.
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
                  <div>
                    <Badge bg={repo.private ? 'warning' : 'success'} className="ms-2">
                      {repo.private ? 'Private' : 'Public'}
                    </Badge>
                  </div>
                </div>

                <div className="flex-grow-1">
                  {repo.description && (
                    <p className="card-text small text-muted mb-2">
                      {repo.description}
                    </p>
                  )}

                  <div className="small text-muted mb-3">
                    <div className="d-flex justify-content-between">
                      <span>
                        <i className="bi bi-git me-1"></i>
                        {repo.default_branch}
                      </span>
                      <span>
                        <i className="bi bi-clock me-1"></i>
                        Updated recently
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
                    onClick={() => handleSyncRepository(repo)}
                  >
                    <i className="bi bi-arrow-clockwise"></i>
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
