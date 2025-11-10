import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Tab, Tabs, Alert, Spinner, Table, Badge, Card, Row, Col, Accordion } from 'react-bootstrap';
import { useAuth } from '../../providers/AuthProvider';
import { useNotification } from '../NotificationProvider';
import { ActionButton, StatusBadge } from '@/components/shared';
import documentsApi from '../../api/documentsApi';

export default function GitManagementModal({ show, onHide }) {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);

  // Data states
  const [overview, setOverview] = useState({ repositories: [], total_repositories: 0, total_documents: 0 });
  const [branches, setBranches] = useState({ repositories: [], total_repositories: 0, total_branches: 0 });
  const [stashes, setStashes] = useState({ stashes: [], total: 0, repositories_checked: 0 });
  const [operationLogs, setOperationLogs] = useState({ logs: [], total: 0 });
  const [settings, setSettings] = useState({});

  // Settings form state
  const [settingsForm, setSettingsForm] = useState({});
  const [settingsLoading, setSettingsLoading] = useState(false);

  const loadOverview = async () => {
    try {
      const data = await documentsApi.getGitOverview();
      setOverview(data);
    } catch (error) {
      setOverview({ repositories: [], total_repositories: 0, total_documents: 0, error: error.message });
    }
  };

  const loadBranches = async () => {
    try {
      const data = await documentsApi.getAllGitBranches();
      setBranches(data);
    } catch (error) {
      setBranches({ repositories: [], total_repositories: 0, total_branches: 0, error: error.message });
    }
  };

  const loadStashes = async () => {
    try {
      const data = await documentsApi.getAllGitStashes();
      setStashes(data);
    } catch (error) {
      setStashes({ stashes: [], total: 0, repositories_checked: 0, error: error.message });
    }
  };

  const loadOperationLogs = async () => {
    try {
      const data = await documentsApi.getGitOperationLogs({ limit: 30 });
      setOperationLogs(data);
    } catch (error) {
      setOperationLogs({ logs: [], total: 0, error: error.message });
    }
  };

  const loadSettings = useCallback(async () => {
    try {
      const data = await documentsApi.getGitSettings();
      setSettings(data.settings); // Extract settings from response
      setSettingsForm({ ...data.settings }); // Initialize form with current settings
    } catch (error) {
      setSettings({ error: error.message });
      showError('Failed to load git settings', null, error.message, 'git');
    }
  }, [showError]);

  const handleTabSelect = async (key) => {
    setActiveTab(key);
    // Load data for the new tab immediately
    await loadDataForTab(key);
  };

  const loadDataForTab = useCallback(async (tabKey = activeTab) => {
    setLoading(true);
    try {
      switch (tabKey) {
        case 'overview':
          await loadOverview();
          break;
        case 'branches':
          await loadBranches();
          break;
        case 'stash':
          await loadStashes();
          break;
        case 'history':
          await loadOperationLogs();
          break;
        case 'settings':
          await loadSettings();
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Failed to load git management data:', error);
      showError('Failed to load git management data', null, error.message, 'git');
    } finally {
      setLoading(false);
    }
  }, [activeTab, showError, loadSettings]);

  useEffect(() => {
    if (show) {
      loadDataForTab(activeTab);
    }
  }, [show, activeTab, loadDataForTab]);

  const loadData = async () => {
    await loadDataForTab(activeTab);
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (durationMs) => {
    if (!durationMs) return 'Unknown';
    if (durationMs < 1000) return `${durationMs}ms`;
    return `${(durationMs / 1000).toFixed(2)}s`;
  };

  const handleApplyStash = async (stash, pop = false) => {
    try {
      setLoading(true);
      const result = await documentsApi.applyGitStash({
        repository_path: stash.repository_path,
        stash_id: stash.stash_id,
        pop: pop
      });

      if (result.success) {
        showSuccess(
          `Stash ${pop ? 'popped' : 'applied'} successfully`,
          `${stash.stash_id} from ${stash.repository_name}`,
          result.message
        );
        // Reload stashes to update the list
        await loadStashes();
      } else {
        showError('Failed to apply stash', null, result.error, 'git');
      }
    } catch (error) {
      console.error('Failed to apply stash:', error);
      showError('Failed to apply stash', null, error.message, 'git');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStash = async () => {
    try {
      // Get available repositories first
      const branchData = await documentsApi.getAllGitBranches();

      if (!branchData.repositories || branchData.repositories.length === 0) {
        showError('No repositories found', null, 'No git repositories available to stash changes', 'git');
        return;
      }

      // For now, create stash in the first available repository
      // In a more advanced implementation, you could show a modal to select repository
      const firstRepo = branchData.repositories[0];
      const message = `Stash created from Git Management modal - ${new Date().toLocaleString()}`;

      setLoading(true);
      const result = await documentsApi.createGitStash({
        repository_path: firstRepo.repository_path,
        message: message,
        include_untracked: true
      });

      if (result.success) {
        showSuccess(
          'Stash created successfully',
          `In repository: ${firstRepo.repository_name}`,
          result.message
        );
        // Reload stashes to update the list
        await loadStashes();
      } else {
        showError('Failed to create stash', null, result.error, 'git');
      }
    } catch (error) {
      console.error('Failed to create stash:', error);
      showError('Failed to create stash', null, error.message, 'git');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsLoading(true);
    try {
      const result = await documentsApi.updateGitSettings(settingsForm);
      if (result.success) {
        showSuccess('Settings updated successfully', null, result.message);
        // Reload settings to get the latest values
        await loadSettings();
      } else {
        showError('Failed to update settings', null, result.error || 'Unknown error', 'git');
      }
    } catch (error) {
      console.error('Failed to update settings:', error);
      showError('Failed to update settings', null, error.message, 'git');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleResetSettings = () => {
    // Reset form to original values
    setSettingsForm({ ...settings });
  };

  if (!user) {
    return null;
  }

  return (
    <Modal show={show} onHide={onHide} size="xl" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-git me-2"></i>
          Git Management
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Tabs
          activeKey={activeTab}
          onSelect={handleTabSelect}
          className="mb-3"
        >
          <Tab eventKey="overview" title={
            <span>
              <i className="bi bi-house me-1"></i>
              Overview
            </span>
          }>
            <div className="git-overview">
              <Row className="mb-4">
                <Col md={4}>
                  <Card className="h-100">
                    <Card.Body className="text-center">
                      <i className="bi bi-folder-fill display-4 text-primary"></i>
                      <Card.Title className="mt-2">Repositories</Card.Title>
                      <h3 className="text-primary">{overview.total_repositories}</h3>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="h-100">
                    <Card.Body className="text-center">
                      <i className="bi bi-file-earmark-text-fill display-4 text-success"></i>
                      <Card.Title className="mt-2">Documents</Card.Title>
                      <h3 className="text-success">{overview.total_documents}</h3>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="h-100">
                    <Card.Body className="text-center">
                      <i className="bi bi-activity display-4 text-info"></i>
                      <Card.Title className="mt-2">Status</Card.Title>
                      <StatusBadge status="active" />
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {loading && (
                <div className="text-center p-4">
                  <Spinner animation="border" />
                  <div className="mt-2">Loading repository overview...</div>
                </div>
              )}

              {overview.error && (
                <Alert variant="warning">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  {overview.error}
                </Alert>
              )}

              {!loading && !overview.error && overview.repositories.length > 0 && (
                <Card>
                  <Card.Header>
                    <Card.Title className="mb-0">Repository Details</Card.Title>
                  </Card.Header>
                  <Card.Body>
                    <Table responsive striped>
                      <thead>
                        <tr>
                          <th>Repository</th>
                          <th>Type</th>
                          <th>Documents</th>
                          <th>Last Updated</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.repositories.map((repo, index) => (
                          <tr key={index}>
                            <td>
                              <i className={`bi ${repo.type === 'github' ? 'bi-github' : 'bi-folder'} me-2`}></i>
                              {repo.name}
                            </td>
                            <td>
                              <Badge bg={repo.type === 'github' ? 'primary' : 'secondary'}>
                                {repo.type.toUpperCase()}
                              </Badge>
                            </td>
                            <td>{repo.document_count}</td>
                            <td>{formatDateTime(repo.last_updated)}</td>
                            <td>
                              <StatusBadge status={repo.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>
              )}

              {!loading && !overview.error && overview.repositories.length === 0 && (
                <Alert variant="info">
                  <i className="bi bi-info-circle me-2"></i>
                  No repositories found. Create a document to get started!
                </Alert>
              )}
            </div>
          </Tab>

          <Tab eventKey="branches" title={
            <span>
              <i className="bi bi-diagram-3 me-1"></i>
              Branches
            </span>
          }>
            <div className="branch-management">
              <Row className="mb-3">
                <Col>
                  <h5>
                    <i className="bi bi-diagram-3 me-2"></i>
                    Branch Management Across All Repositories
                  </h5>
                  <p className="text-muted">
                    Total: {branches.total_repositories} repositories, {branches.total_branches} branches
                  </p>
                </Col>
              </Row>

              {loading && (
                <div className="text-center p-4">
                  <Spinner animation="border" />
                  <div className="mt-2">Loading branch information...</div>
                </div>
              )}

              {branches.error && (
                <Alert variant="warning">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  {branches.error}
                </Alert>
              )}

              {!loading && !branches.error && branches.repositories.length > 0 && (
                <Accordion>
                  {branches.repositories.map((repo, index) => (
                    <Accordion.Item eventKey={index.toString()} key={index}>
                      <Accordion.Header>
                        <div className="d-flex justify-content-between align-items-center w-100 me-3">
                          <span>
                            <i className={`bi ${repo.repository_type === 'github' ? 'bi-github' : 'bi-folder'} me-2`}></i>
                            {repo.repository_name}
                          </span>
                          <span>
                            <Badge bg="primary" className="me-2">
                              {repo.total_local} local
                            </Badge>
                            {repo.total_remote > 0 && (
                              <Badge bg="info">
                                {repo.total_remote} remote
                              </Badge>
                            )}
                          </span>
                        </div>
                      </Accordion.Header>
                      <Accordion.Body>
                        {repo.error ? (
                          <Alert variant="warning">
                            <i className="bi bi-exclamation-triangle me-2"></i>
                            {repo.error}
                          </Alert>
                        ) : (
                          <>
                            <div className="mb-3">
                              <strong>Current Branch:</strong>{' '}
                              <Badge bg="success">{repo.current_branch}</Badge>
                            </div>

                            {repo.local_branches.length > 0 && (
                              <div className="mb-3">
                                <strong>Local Branches:</strong>
                                <div className="mt-2">
                                  {repo.local_branches.map((branch, branchIndex) => (
                                    <Badge
                                      key={branchIndex}
                                      bg={branch.is_current ? 'success' : 'secondary'}
                                      className="me-2 mb-1"
                                    >
                                      {branch.is_current && <i className="bi bi-check-circle me-1"></i>}
                                      {branch.name}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {repo.remote_branches.length > 0 && (
                              <div>
                                <strong>Remote Branches:</strong>
                                <div className="mt-2">
                                  {repo.remote_branches.map((branch, branchIndex) => (
                                    <Badge
                                      key={branchIndex}
                                      bg="info"
                                      className="me-2 mb-1"
                                    >
                                      <i className="bi bi-cloud me-1"></i>
                                      {branch.name}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </Accordion.Body>
                    </Accordion.Item>
                  ))}
                </Accordion>
              )}

              {!loading && !branches.error && branches.repositories.length === 0 && (
                <Alert variant="info">
                  <i className="bi bi-info-circle me-2"></i>
                  No git repositories found. Create a document to initialize repositories!
                </Alert>
              )}
            </div>
          </Tab>

          <Tab eventKey="stash" title={
            <span>
              <i className="bi bi-archive me-1"></i>
              Stash
            </span>
          }>
            <div className="stash-management">
              <Row className="mb-3">
                <Col>
                  <h5>
                    <i className="bi bi-archive me-2"></i>
                    Git Stash Management
                  </h5>
                  <p className="text-muted">
                    Found {stashes.total} stashes across {stashes.repositories_checked} repositories
                  </p>
                </Col>
                <Col xs="auto">
                  <ActionButton
                    variant="primary"
                    onClick={handleCreateStash}
                    loading={loading}
                    icon="plus-circle"
                  >
                    Create Stash
                  </ActionButton>
                </Col>
              </Row>

              {loading && (
                <div className="text-center p-4">
                  <Spinner animation="border" />
                  <div className="mt-2">Loading stashes...</div>
                </div>
              )}

              {stashes.error && (
                <Alert variant="warning">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  {stashes.error}
                </Alert>
              )}

              {!loading && !stashes.error && stashes.stashes.length > 0 && (
                <Card>
                  <Card.Body>
                    <Table responsive>
                      <thead>
                        <tr>
                          <th>Repository</th>
                          <th>Stash ID</th>
                          <th>Message</th>
                          <th>Date</th>
                          <th>Commit Hash</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stashes.stashes.map((stash, index) => (
                          <tr key={index}>
                            <td>
                              <i className="bi bi-folder me-2"></i>
                              {stash.repository_name}
                            </td>
                            <td>
                              <code>{stash.stash_id}</code>
                            </td>
                            <td>{stash.message || 'No message'}</td>
                            <td>{new Date(stash.date).toLocaleString()}</td>
                            <td>
                              <code className="small">{stash.commit_hash}</code>
                            </td>
                            <td>
                              <div className="d-flex gap-1">
                                <ActionButton
                                  variant="success"
                                  size="sm"
                                  onClick={() => handleApplyStash(stash, false)}
                                  title="Apply stash (keep stash)"
                                  icon="arrow-down-circle"
                                />
                                <ActionButton
                                  variant="warning"
                                  size="sm"
                                  onClick={() => handleApplyStash(stash, true)}
                                  title="Pop stash (apply and remove)"
                                  icon="arrow-up-circle-fill"
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>
              )}

              {!loading && !stashes.error && stashes.stashes.length === 0 && (
                <Alert variant="info">
                  <i className="bi bi-info-circle me-2"></i>
                  No stashes found. Use &quot;Create Stash&quot; to save uncommitted changes temporarily.
                </Alert>
              )}
            </div>
          </Tab>

          <Tab eventKey="history" title={
            <span>
              <i className="bi bi-clock-history me-1"></i>
              Operation History
            </span>
          }>
            <div className="git-operation-history">
              <Row className="mb-3">
                <Col>
                  <h5>
                    <i className="bi bi-clock-history me-2"></i>
                    Git Operation History
                  </h5>
                  <p className="text-muted">
                    Recent git operations and their results (showing last {operationLogs.total})
                  </p>
                </Col>
              </Row>

              {loading && (
                <div className="text-center p-4">
                  <Spinner animation="border" />
                  <div className="mt-2">Loading operation history...</div>
                </div>
              )}

              {operationLogs.error && (
                <Alert variant="warning">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  {operationLogs.error}
                </Alert>
              )}

              {!loading && !operationLogs.error && operationLogs.logs.length > 0 && (
                <Card>
                  <Card.Body>
                    <Table responsive>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Operation</th>
                          <th>Repository</th>
                          <th>Status</th>
                          <th>Duration</th>
                          <th>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {operationLogs.logs.map((log, index) => (
                          <tr key={index}>
                            <td>{formatDateTime(log.created_at)}</td>
                            <td>
                              <Badge bg={log.success ? 'success' : 'danger'}>
                                {log.operation_type}
                              </Badge>
                            </td>
                            <td>
                              <Badge bg={log.repository_type === 'github' ? 'primary' : 'secondary'}>
                                {log.repository_type}
                              </Badge>
                              {log.repository_path && (
                                <div className="small text-muted">
                                  {log.repository_path.split('/').pop()}
                                </div>
                              )}
                            </td>
                            <td>
                              {log.success ? (
                                <Badge bg="success">
                                  <i className="bi bi-check-circle me-1"></i>
                                  Success
                                </Badge>
                              ) : (
                                <Badge bg="danger">
                                  <i className="bi bi-x-circle me-1"></i>
                                  Failed
                                </Badge>
                              )}
                            </td>
                            <td>
                              <small>{formatDuration(log.duration_ms)}</small>
                            </td>
                            <td>
                              {log.error_message ? (
                                <small className="text-danger">{log.error_message}</small>
                              ) : log.branch_name ? (
                                <small className="text-muted">Branch: {log.branch_name}</small>
                              ) : log.commit_hash ? (
                                <small className="text-muted">
                                  <code>{log.commit_hash.substring(0, 8)}</code>
                                </small>
                              ) : (
                                <small className="text-muted">—</small>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>
              )}

              {!loading && !operationLogs.error && operationLogs.logs.length === 0 && (
                <Alert variant="info">
                  <i className="bi bi-info-circle me-2"></i>
                  No git operations found. Operations will appear here as you use git features.
                </Alert>
              )}
            </div>
          </Tab>

          <Tab eventKey="settings" title={
            <span>
              <i className="bi bi-gear me-1"></i>
              Settings
            </span>
          }>
            <div className="git-settings">
              {loading && (
                <div className="text-center p-4">
                  <Spinner animation="border" />
                  <div className="mt-2">Loading git settings...</div>
                </div>
              )}

              {settings.error && (
                <Alert variant="warning">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  {settings.error}
                </Alert>
              )}

              {!loading && !settings.error && settings && (
                <>
                  <Row className="mb-3">
                    <Col>
                      <h5>
                        <i className="bi bi-gear me-2"></i>
                        Git Configuration & Preferences
                      </h5>
                      <p className="text-muted">
                        Configure global Git settings that apply to all repositories in this system.
                      </p>
                    </Col>
                  </Row>

                  <form onSubmit={handleSaveSettings}>
                    <Row>
                      <Col md={6}>
                        <Card className="mb-3">
                          <Card.Header>
                            <Card.Title className="mb-0">
                              <i className="bi bi-person me-2"></i>
                              User Configuration
                            </Card.Title>
                          </Card.Header>
                          <Card.Body>
                            <div className="mb-3">
                              <label htmlFor="userName" className="form-label">
                                <strong>Git User Name</strong>
                              </label>
                              <input
                                type="text"
                                className="form-control"
                                id="userName"
                                value={settingsForm.user_name || ''}
                                onChange={(e) => setSettingsForm({...settingsForm, user_name: e.target.value})}
                                placeholder="Enter your git username"
                              />
                              <small className="text-muted">
                                This name will appear in git commits
                              </small>
                            </div>

                            <div className="mb-3">
                              <label htmlFor="userEmail" className="form-label">
                                <strong>Git User Email</strong>
                              </label>
                              <input
                                type="email"
                                className="form-control"
                                id="userEmail"
                                value={settingsForm.user_email || ''}
                                onChange={(e) => setSettingsForm({...settingsForm, user_email: e.target.value})}
                                placeholder="Enter your git email"
                              />
                              <small className="text-muted">
                                This email will be associated with git commits
                              </small>
                            </div>
                          </Card.Body>
                        </Card>
                      </Col>

                      <Col md={6}>
                        <Card className="mb-3">
                          <Card.Header>
                            <Card.Title className="mb-0">
                              <i className="bi bi-toggle-on me-2"></i>
                              Automation Settings
                            </Card.Title>
                          </Card.Header>
                          <Card.Body>
                            <div className="mb-3">
                              <div className="form-check form-switch">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  id="autoCommit"
                                  checked={settingsForm.auto_commit_on_save || false}
                                  onChange={(e) => setSettingsForm({...settingsForm, auto_commit_on_save: e.target.checked})}
                                />
                                <label className="form-check-label" htmlFor="autoCommit">
                                  <strong>Auto-commit on Save</strong>
                                </label>
                              </div>
                              <small className="text-muted">
                                Automatically commit changes when documents are saved
                              </small>
                            </div>

                            <div className="mb-3">
                              <div className="form-check form-switch">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  id="autoInit"
                                  checked={settingsForm.auto_init_repos || false}
                                  onChange={(e) => setSettingsForm({...settingsForm, auto_init_repos: e.target.checked})}
                                />
                                <label className="form-check-label" htmlFor="autoInit">
                                  <strong>Auto-initialize Repositories</strong>
                                </label>
                              </div>
                              <small className="text-muted">
                                Automatically initialize git repositories for new documents
                              </small>
                            </div>

                            <div className="mb-3">
                              <div className="form-check form-switch">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  id="operationLogging"
                                  checked={settingsForm.operation_logging || false}
                                  onChange={(e) => setSettingsForm({...settingsForm, operation_logging: e.target.checked})}
                                />
                                <label className="form-check-label" htmlFor="operationLogging">
                                  <strong>Operation Logging</strong>
                                </label>
                              </div>
                              <small className="text-muted">
                                Log all git operations for audit and troubleshooting
                              </small>
                            </div>
                          </Card.Body>
                        </Card>
                      </Col>
                    </Row>

                    <div className="d-flex justify-content-end gap-2 mt-3">
                      <ActionButton
                        type="button"
                        variant="secondary"
                        onClick={handleResetSettings}
                        loading={settingsLoading}
                        icon="arrow-counterclockwise"
                      >
                        Reset
                      </ActionButton>
                      <ActionButton
                        type="submit"
                        variant="primary"
                        loading={settingsLoading}
                        icon="check-lg"
                      >
                        Save Settings
                      </ActionButton>
                    </div>
                  </form>

                  <Alert variant="info" className="mt-4">
                    <Alert.Heading>
                      <i className="bi bi-info-circle me-2"></i>
                      Configuration Notes
                    </Alert.Heading>
                    <p>
                      These settings apply globally to all repositories managed by the system.
                      Individual repositories may have their own local configuration that can override these settings.
                    </p>
                    <p className="mb-0">
                      Changes take effect immediately and will be used for all future git operations.
                    </p>
                  </Alert>
                </>
              )}
            </div>
          </Tab>
        </Tabs>
      </Modal.Body>
      <Modal.Footer>
        <ActionButton variant="secondary" onClick={onHide}>
          Close
        </ActionButton>
        <ActionButton
          variant="primary"
          onClick={loadData}
          loading={loading}
          icon="arrow-clockwise"
        >
          Refresh
        </ActionButton>
      </Modal.Footer>
    </Modal>
  );
}