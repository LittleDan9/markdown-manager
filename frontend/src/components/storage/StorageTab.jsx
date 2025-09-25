import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Spinner, Row, Col, Badge, Table, Nav } from 'react-bootstrap';
import { useNotification } from '../NotificationProvider';
import ConfirmModal from '../shared/modals/ConfirmModal';

function StorageTab({ userId = null, isAdmin = false }) {
  const [storageStats, setStorageStats] = useState(null);
  const [orphanedDocs, setOrphanedDocs] = useState([]);
  const [orphanedRepos, setOrphanedRepos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [repoCleanupLoading, setRepoCleanupLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeCleanupTab, setActiveCleanupTab] = useState('documents');
  const [showRepoConfirm, setShowRepoConfirm] = useState(false);
  const [showDocConfirm, setShowDocConfirm] = useState(false);
  const { showSuccess, showError } = useNotification();

  const getAuthHeaders = () => {
    const token = localStorage.getItem('authToken');
    const tokenType = localStorage.getItem('tokenType') || 'Bearer';
    return {
      'Authorization': `${tokenType} ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const loadStorageStats = async () => {
    setLoading(true);
    setError('');
    try {
      const baseUrl = isAdmin && userId
        ? `/api/github/admin/users/${userId}/storage-stats`
        : '/api/github/admin/user/storage-stats';

      const response = await fetch(baseUrl, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to load storage stats: ${response.statusText}`);
      }

      const stats = await response.json();
      setStorageStats(stats);
    } catch (err) {
      setError(err.message);
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadOrphanedDocs = async () => {
    setError('');
    try {
      const baseUrl = isAdmin && userId
        ? `/api/github/admin/users/${userId}/orphaned-documents`
        : '/api/github/admin/orphaned-documents';

      const response = await fetch(baseUrl, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to load orphaned documents: ${response.statusText}`);
      }

      const docs = await response.json();
      setOrphanedDocs(docs);
    } catch (err) {
      setError(err.message);
      showError(err.message);
    }
  };

  const loadOrphanedRepos = async () => {
    setError('');
    try {
      const baseUrl = isAdmin && userId
        ? `/api/github/admin/users/${userId}/orphaned-repositories`
        : '/api/github/admin/orphaned-repositories';

      const response = await fetch(baseUrl, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to load orphaned repositories: ${response.statusText}`);
      }

      const repos = await response.json();
      setOrphanedRepos(repos);
    } catch (err) {
      setError(err.message);
      showError(err.message);
    }
  };

  const handleRepoCleanup = async () => {
    setShowRepoConfirm(true);
  };

  const confirmRepoCleanup = async () => {
    setShowRepoConfirm(false);
    setRepoCleanupLoading(true);
    setError('');
    try {
      const baseUrl = isAdmin && userId
        ? `/api/github/admin/users/${userId}/orphaned-repositories`
        : '/api/github/admin/orphaned-repositories';

      const response = await fetch(baseUrl, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to cleanup orphaned repositories: ${response.statusText}`);
      }

      const result = await response.json();
      showSuccess(`Repository cleanup completed: ${result.deleted_repositories} repositories removed, ${result.cleaned_directories} directories cleaned`);

      // Reload data
      await loadStorageStats();
      await loadOrphanedDocs();
      await loadOrphanedRepos();
    } catch (err) {
      setError(err.message);
      showError(err.message);
    } finally {
      setRepoCleanupLoading(false);
    }
  };

  const handleCleanup = async () => {
    setShowDocConfirm(true);
  };

  const confirmDocCleanup = async () => {
    setShowDocConfirm(false);
    setCleanupLoading(true);
    setError('');
    try {
      const baseUrl = isAdmin && userId
        ? `/api/github/admin/users/${userId}/orphaned-documents`
        : '/api/github/admin/user/orphaned-documents';

      const response = await fetch(baseUrl, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to cleanup orphaned documents: ${response.statusText}`);
      }

      const result = await response.json();
      showSuccess(`Cleanup completed: ${result.deleted_count} documents removed, ${result.cleaned_directories} directories cleaned, ${result.cleaned_repositories} repositories cleaned`);

      // Reload data
      await loadStorageStats();
      await loadOrphanedDocs();
      await loadOrphanedRepos();
    } catch (err) {
      setError(err.message);
      showError(err.message);
    } finally {
      setCleanupLoading(false);
    }
  };

  useEffect(() => {
    loadStorageStats();
    loadOrphanedDocs();
    loadOrphanedRepos();
  }, [userId, isAdmin]);

  if (loading && !storageStats) {
    return (
      <div className="text-center p-4">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading storage stats...</span>
        </Spinner>
      </div>
    );
  }

  return (
    <div className="storage-tab">
      {error && <Alert variant="danger">{error}</Alert>}

      {/* Storage Statistics */}
      {storageStats && (
        <Card className="mb-4">
          <Card.Header>
            <h5 className="mb-0">
              <i className="bi bi-pie-chart me-2"></i>
              Storage Statistics {isAdmin && userId && `(User ID: ${userId})`}
            </h5>
          </Card.Header>
          <Card.Body>
            <Row className="storage-stats-grid">
              <Col md={4}>
                <Card className="stat-card border-0 mb-3">
                  <Card.Body className="text-center">
                    <h3 className="stat-value text-primary">{storageStats.total_documents}</h3>
                    <p className="stat-label">Total Documents</p>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={4}>
                <Card className="stat-card border-0 mb-3">
                  <Card.Body className="text-center">
                    <h3 className="stat-value text-info">{formatBytes(storageStats.storage_size_bytes)}</h3>
                    <p className="stat-label">Storage Used</p>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={4}>
                <Card className="stat-card border-0 mb-3">
                  <Card.Body className="text-center">
                    <h3 className="stat-value text-success">{storageStats.repositories_count}</h3>
                    <p className="stat-label">Repositories</p>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            <Row className="storage-badges-row">
              <Col md={3}>
                <div className="badge-container text-center">
                  <Badge bg="primary" className="me-2">{storageStats.local_documents}</Badge>
                  <div className="badge-label">Local Documents</div>
                </div>
              </Col>
              <Col md={3}>
                <div className="badge-container text-center">
                  <Badge bg="info" className="me-2">{storageStats.github_documents}</Badge>
                  <div className="badge-label">GitHub Documents</div>
                </div>
              </Col>
              <Col md={3}>
                <div className="badge-container text-center">
                  <Badge bg="success" className="me-2">{storageStats.documents_with_files}</Badge>
                  <div className="badge-label">With Files</div>
                </div>
              </Col>
              <Col md={3}>
                <div className="badge-container text-center">
                  <Badge bg={storageStats.orphaned_documents > 0 ? "warning" : "secondary"} className="me-2">
                    {storageStats.orphaned_documents}
                  </Badge>
                  <div className="badge-label">Orphaned</div>
                </div>
              </Col>
            </Row>

            {(storageStats.local_repositories || storageStats.github_repositories) && (
              <Row className="mt-3">
                <Col md={6}>
                  <div className="badge-container text-center">
                    <Badge bg="outline-primary" className="me-2">{storageStats.local_repositories || 0}</Badge>
                    <div className="badge-label">Local Repositories</div>
                  </div>
                </Col>
                <Col md={6}>
                  <div className="badge-container text-center">
                    <Badge bg="outline-info" className="me-2">{storageStats.github_repositories || 0}</Badge>
                    <div className="badge-label">GitHub Repositories</div>
                  </div>
                </Col>
              </Row>
            )}
          </Card.Body>
        </Card>
      )}

      {/* Orphaned Items Section */}
      <Card className="orphaned-docs-section">
        <Card.Header className="section-header">
          <Nav variant="tabs" className="mb-0">
            <Nav.Item>
              <Nav.Link
                active={activeCleanupTab === 'documents'}
                onClick={() => setActiveCleanupTab('documents')}
              >
                <i className="bi bi-file-text me-2"></i>
                Orphaned Documents ({orphanedDocs.length})
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link
                active={activeCleanupTab === 'repositories'}
                onClick={() => setActiveCleanupTab('repositories')}
              >
                <i className="bi bi-folder me-2"></i>
                Orphaned Repositories ({orphanedRepos.length})
              </Nav.Link>
            </Nav.Item>
          </Nav>
        </Card.Header>
        <Card.Body>
          {activeCleanupTab === 'documents' && (
            <>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="mb-0">Documents without files</h6>
                {orphanedDocs.length > 0 && (
                  <Button
                    variant="danger"
                    size="sm"
                    className="cleanup-button"
                    onClick={handleCleanup}
                    disabled={cleanupLoading}
                  >
                    {cleanupLoading ? (
                      <>
                        <Spinner size="sm" className="me-2" />
                        Cleaning...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-trash me-2"></i>
                        Clean Up Documents
                      </>
                    )}
                  </Button>
                )}
              </div>

              {orphanedDocs.length === 0 ? (
                <Alert variant="success" className="no-orphans-alert">
                  <i className="bi bi-check-circle me-2"></i>
                  No orphaned documents found. Your document records are clean!
                </Alert>
              ) : (
                <Table striped hover responsive className="orphaned-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>File Path</th>
                      <th>Reason</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orphanedDocs.map((doc) => (
                      <tr key={doc.id}>
                        <td>{doc.name}</td>
                        <td>
                          <Badge bg={doc.repository_type === 'github' ? 'info' : 'primary'}>
                            {doc.repository_type}
                          </Badge>
                        </td>
                        <td><code>{doc.file_path}</code></td>
                        <td><small className="text-muted">{doc.reason}</small></td>
                        <td><small>{new Date(doc.created_at).toLocaleDateString()}</small></td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </>
          )}

          {activeCleanupTab === 'repositories' && (
            <>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="mb-0">Repositories without documents</h6>
                {orphanedRepos.length > 0 && (
                  <Button
                    variant="warning"
                    size="sm"
                    className="cleanup-button"
                    onClick={handleRepoCleanup}
                    disabled={repoCleanupLoading}
                  >
                    {repoCleanupLoading ? (
                      <>
                        <Spinner size="sm" className="me-2" />
                        Cleaning...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-folder-x me-2"></i>
                        Clean Up Repositories
                      </>
                    )}
                  </Button>
                )}
              </div>

              {orphanedRepos.length === 0 ? (
                <Alert variant="success" className="no-orphans-alert">
                  <i className="bi bi-check-circle me-2"></i>
                  No orphaned repositories found. Your filesystem is clean!
                </Alert>
              ) : (
                <Table striped hover responsive className="orphaned-table">
                  <thead>
                    <tr>
                      <th>Repository ID</th>
                      <th>Type</th>
                      <th>Path</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orphanedRepos.map((repo, index) => (
                      <tr key={index}>
                        <td><code>{repo.repository_id}</code></td>
                        <td>
                          <Badge bg={repo.repository_type === 'github' ? 'info' : 'primary'}>
                            {repo.repository_type}
                          </Badge>
                        </td>
                        <td><code>{repo.repository_path}</code></td>
                        <td><small className="text-muted">{repo.reason}</small></td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </>
          )}
        </Card.Body>
      </Card>

      <div className="refresh-section text-center">
        <Button
          variant="outline-primary"
          onClick={() => { loadStorageStats(); loadOrphanedDocs(); loadOrphanedRepos(); }}
          disabled={loading}
        >
          <i className="bi bi-arrow-clockwise me-2"></i>
          Refresh
        </Button>
      </div>

      {/* Repository Cleanup Confirmation Modal */}
      <ConfirmModal
        show={showRepoConfirm}
        onHide={() => setShowRepoConfirm(false)}
        onAction={(action) => {
          if (action === 'confirm') {
            confirmRepoCleanup();
          } else {
            setShowRepoConfirm(false);
          }
        }}
        title="Confirm Repository Cleanup"
        message="Are you sure you want to clean up orphaned repositories? This will permanently delete repository files and cannot be undone."
        icon={<i className="bi bi-trash-fill text-danger me-2"></i>}
        buttons={[
          { text: 'Cancel', variant: 'secondary', action: 'cancel' },
          { text: 'Delete Repositories', variant: 'danger', action: 'confirm', icon: 'bi bi-trash' }
        ]}
      />

      {/* Document Cleanup Confirmation Modal */}
      <ConfirmModal
        show={showDocConfirm}
        onHide={() => setShowDocConfirm(false)}
        onAction={(action) => {
          if (action === 'confirm') {
            confirmDocCleanup();
          } else {
            setShowDocConfirm(false);
          }
        }}
        title="Confirm Document Cleanup"
        message="Are you sure you want to clean up orphaned documents? This action cannot be undone."
        icon={<i className="bi bi-file-earmark-x-fill text-warning me-2"></i>}
        buttons={[
          { text: 'Cancel', variant: 'secondary', action: 'cancel' },
          { text: 'Delete Documents', variant: 'danger', action: 'confirm', icon: 'bi bi-trash' }
        ]}
      />
    </div>
  );
}

export default StorageTab;