import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Alert, Spinner, Row, Col, Badge, Table, Nav, Tab } from 'react-bootstrap';
import { useNotification } from '../NotificationProvider';
import ConfirmModal from '../shared/modals/ConfirmModal';
import adminGitHubApi from '../../api/admin/githubApi';

function StorageTab({ userId = null, isAdmin = false }) {
  const [storageStats, setStorageStats] = useState(null);
  const [orphanedDocs, setOrphanedDocs] = useState([]);
  const [orphanedRepos, setOrphanedRepos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [repoCleanupLoading, setRepoCleanupLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('stats');
  const [activeCleanupTab, setActiveCleanupTab] = useState('documents');
  const [showRepoConfirm, setShowRepoConfirm] = useState(false);
  const [showDocConfirm, setShowDocConfirm] = useState(false);
  const { showSuccess, showError } = useNotification();

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const loadStorageStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let stats;
      if (isAdmin && userId) {
        stats = await adminGitHubApi.getUserStorageStats(userId);
      } else {
        stats = await adminGitHubApi.getMyStorageStats();
      }
      setStorageStats(stats);
    } catch (err) {
      setError(err.message);
      showError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, userId, showError]);

  const loadOrphanedDocs = useCallback(async () => {
    setError('');
    try {
      let docs;
      if (isAdmin && userId) {
        docs = await adminGitHubApi.getUserOrphanedDocuments(userId);
      } else {
        docs = await adminGitHubApi.getMyOrphanedDocuments();
      }
      setOrphanedDocs(docs);
    } catch (err) {
      setError(err.message);
      showError(err.message);
    }
  }, [isAdmin, userId, showError]);

  const loadOrphanedRepos = useCallback(async () => {
    setError('');
    try {
      let repos;
      if (isAdmin && userId) {
        repos = await adminGitHubApi.getUserOrphanedRepositories(userId);
      } else {
        repos = await adminGitHubApi.getMyOrphanedRepositories();
      }
      setOrphanedRepos(repos);
    } catch (err) {
      setError(err.message);
      showError(err.message);
    }
  }, [isAdmin, userId, showError]);

  const handleRepoCleanup = async () => {
    setShowRepoConfirm(true);
  };

  const confirmRepoCleanup = async () => {
    setShowRepoConfirm(false);
    setRepoCleanupLoading(true);
    setError('');
    try {
      let result;
      if (isAdmin && userId) {
        result = await adminGitHubApi.cleanupUserOrphanedRepositories(userId);
      } else {
        result = await adminGitHubApi.cleanupMyOrphanedRepositories();
      }
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
      let result;
      if (isAdmin && userId) {
        result = await adminGitHubApi.cleanupUserOrphanedDocuments(userId);
      } else {
        result = await adminGitHubApi.cleanupMyOrphanedDocuments();
      }
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
  }, [userId, isAdmin, loadStorageStats, loadOrphanedDocs, loadOrphanedRepos]);

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

      <Tab.Container activeKey={activeTab} onSelect={setActiveTab}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <Nav variant="tabs">
            <Nav.Item>
              <Nav.Link eventKey="stats">
                <i className="bi bi-pie-chart me-2"></i>
                Document Stats
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="orphans">
                <i className="bi bi-exclamation-triangle me-2"></i>
                Orphans ({orphanedDocs.length + orphanedRepos.length})
              </Nav.Link>
            </Nav.Item>
          </Nav>

          <Button
            variant="outline-primary"
            size="sm"
            onClick={() => { loadStorageStats(); loadOrphanedDocs(); loadOrphanedRepos(); }}
            disabled={loading}
            className="ms-3"
          >
            <i className="bi bi-arrow-clockwise me-1"></i>
            Refresh
          </Button>
        </div>

        <Tab.Content>
          <Tab.Pane eventKey="stats">
            {loading && !storageStats ? (
              <div className="text-center p-4">
                <Spinner animation="border" role="status">
                  <span className="visually-hidden">Loading storage stats...</span>
                </Spinner>
              </div>
            ) : (
              storageStats && (
                <div className="storage-stats-grid">
                  {isAdmin && userId && (
                    <div className="text-muted small mb-3">User ID: {userId}</div>
                  )}
                  <Row className="g-3 mb-3">
                    <Col sm={4}>
                      <div className="stat-card">
                        <div className="stat-icon text-primary"><i className="bi bi-file-earmark-text"></i></div>
                        <div className="stat-info">
                          <div className="stat-value">{storageStats.total_documents}</div>
                          <div className="stat-label">Total Documents</div>
                        </div>
                      </div>
                    </Col>
                    <Col sm={4}>
                      <div className="stat-card">
                        <div className="stat-icon text-info"><i className="bi bi-hdd"></i></div>
                        <div className="stat-info">
                          <div className="stat-value">{formatBytes(storageStats.storage_size_bytes)}</div>
                          <div className="stat-label">Storage Used</div>
                        </div>
                      </div>
                    </Col>
                    <Col sm={4}>
                      <div className="stat-card">
                        <div className="stat-icon text-success"><i className="bi bi-folder2-open"></i></div>
                        <div className="stat-info">
                          <div className="stat-value">{storageStats.repositories_count}</div>
                          <div className="stat-label">Repositories</div>
                        </div>
                      </div>
                    </Col>
                  </Row>

                  <div className="stat-breakdown">
                    <h6 className="breakdown-title">Documents</h6>
                    <div className="breakdown-grid">
                      <div className="breakdown-item">
                        <span className="breakdown-value text-primary">{storageStats.local_documents}</span>
                        <span className="breakdown-label">Local</span>
                      </div>
                      <div className="breakdown-item">
                        <span className="breakdown-value text-info">{storageStats.github_documents}</span>
                        <span className="breakdown-label">GitHub</span>
                      </div>
                      <div className="breakdown-item">
                        <span className="breakdown-value text-success">{storageStats.documents_with_files}</span>
                        <span className="breakdown-label">With Files</span>
                      </div>
                      <div className="breakdown-item">
                        <span className={`breakdown-value ${storageStats.orphaned_documents > 0 ? 'text-warning' : 'text-muted'}`}>
                          {storageStats.orphaned_documents}
                        </span>
                        <span className="breakdown-label">Orphaned</span>
                      </div>
                    </div>
                  </div>

                  {(storageStats.local_repositories > 0 || storageStats.github_repositories > 0) && (
                    <div className="stat-breakdown">
                      <h6 className="breakdown-title">Repositories</h6>
                      <div className="breakdown-grid">
                        <div className="breakdown-item">
                          <span className="breakdown-value text-primary">{storageStats.local_repositories || 0}</span>
                          <span className="breakdown-label">Local</span>
                        </div>
                        <div className="breakdown-item">
                          <span className="breakdown-value text-info">{storageStats.github_repositories || 0}</span>
                          <span className="breakdown-label">GitHub</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            )}
          </Tab.Pane>

          <Tab.Pane eventKey="orphans">
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
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>

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