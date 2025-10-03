import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Alert, Badge, Row, Col, Form, InputGroup, ProgressBar } from 'react-bootstrap';
import { useNotification } from '../../NotificationProvider';
import { GitHubRepositoryList } from '../index';
import GitHubRepositorySettings from '../settings/GitHubRepositorySettings';
import gitHubApi from '../../../api/gitHubApi';
import gitHubRepositorySelectionApi from '../../../api/gitHubRepositorySelectionApi';
import { sortRepositories } from '../../../utils/githubUtils';
import useFileModal from '../../../hooks/ui/useFileModal';

export default function GitHubRepositoriesTab({ onRepositoryBrowse }) {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  const [showRepositorySettings, setShowRepositorySettings] = useState(false);
  const [gitStatusOverview, setGitStatusOverview] = useState(null);
  const [loadingGitStatus, setLoadingGitStatus] = useState(false);
  const { showSuccess, showError } = useNotification();
  const { openGitHubTab } = useFileModal();

  const repositoryListRef = useRef(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      loadRepositories();
    }
  }, [selectedAccount]);

  const loadAccounts = async () => {
    try {
      const accountsData = await gitHubApi.getAccounts();
      setAccounts(accountsData);
      if (accountsData.length > 0 && !selectedAccount) {
        setSelectedAccount(accountsData[0].id.toString());
      }
    } catch (err) {
      showError('Failed to load GitHub accounts');
    }
  };

  const loadRepositories = async () => {
    if (!selectedAccount) return;

    try {
      setLoading(true);
      // Use repository selection API to get only user-selected repositories
      const selectedReposData = await gitHubRepositorySelectionApi.getSelectedRepositories(selectedAccount);

      // Transform the selected repositories data to match the expected format
      const transformedRepos = selectedReposData.selections.map(selection => ({
        id: selection.internal_repo_id || selection.github_repo_id, // Use internal repo ID when available
        github_repo_id: selection.github_repo_id,
        internal_repo_id: selection.internal_repo_id,
        name: selection.repo_name,
        full_name: selection.repo_full_name,
        description: selection.description,
        private: selection.is_private,
        language: selection.language,
        default_branch: selection.default_branch,
        sync_enabled: selection.sync_enabled,
        last_synced_at: selection.last_synced_at,
        selected_at: selection.selected_at,
        owner: {
          login: selection.repo_owner
        }
      }));

      setRepositories(transformedRepos);
      setError(null);

      // Git status overview will be updated by repository list component
      // when it fetches individual repository statuses
      if (transformedRepos.length > 0) {
        console.log(`Loaded ${transformedRepos.length} repositories from ${accounts.length} accounts`);
      }
    } catch (err) {
      setError('Failed to load workspace repositories');
      console.error('Error loading workspace repositories:', err);
    } finally {
      setLoading(false);
    }
  };

    // Handle status updates from the repository list
  const handleRepositoryStatusUpdate = (statusMap) => {
    if (!statusMap || Object.keys(statusMap).length === 0) return;

    try {
      const validStatuses = Object.values(statusMap).filter(status => status && !status.error);

      const overview = {
        total: repositories.length,
        cloned: validStatuses.length,
        withChanges: validStatuses.filter(s => s.has_changes).length,
        clean: validStatuses.filter(s => !s.has_changes).length,
        branches: [...new Set(validStatuses.map(s => s.branch))],
        totalModified: validStatuses.reduce((sum, s) => sum + (s.modified_files?.length || 0), 0),
        totalStaged: validStatuses.reduce((sum, s) => sum + (s.staged_files?.length || 0), 0),
        totalUntracked: validStatuses.reduce((sum, s) => sum + (s.untracked_files?.length || 0), 0)
      };

      setGitStatusOverview(overview);
    } catch (error) {
      console.error('Failed to process repository status updates:', error);
    }
  };

  // Handle refresh status button click
  const handleRefreshStatus = () => {
    if (repositoryListRef.current && repositoryListRef.current.refreshStatuses) {
      setLoadingGitStatus(true);
      repositoryListRef.current.refreshStatuses().finally(() => {
        setLoadingGitStatus(false);
      });
    }
  };

  // Remove the old loadGitStatusOverview function that was making duplicate API calls

  const filteredRepositories = sortRepositories(
    repositories.filter(repo =>
      repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      repo.description?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const handleAddRepositories = () => {
    setShowRepositorySettings(true);
  };

  const handleRepositorySettingsClose = () => {
    setShowRepositorySettings(false);
    // Refresh repositories after settings are closed to show any newly added repos
    if (selectedAccount) {
      loadRepositories();
    }
  };

  return (
    <div className="github-repositories-tab">
      {!showRepositorySettings ? (
        <>
          <Row className="mb-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label>GitHub Account</Form.Label>
                <Form.Select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  disabled={accounts.length === 0}
                >
                  <option value="">Select an account...</option>
                  {accounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.username}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Search Workspace Repositories</Form.Label>
                <InputGroup>
                  <InputGroup.Text>
                    <i className="bi bi-search"></i>
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Search workspace repositories by name or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </InputGroup>
              </Form.Group>
            </Col>
          </Row>

          {error && (
            <Alert variant="danger" dismissible onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {!selectedAccount && accounts.length > 0 && (
            <Alert variant="info">
              <i className="bi bi-info-circle me-2"></i>
              Please select a GitHub account to view your workspace repositories.
            </Alert>
          )}

          {accounts.length === 0 && (
            <Alert variant="warning">
              <i className="bi bi-exclamation-triangle me-2"></i>
              No GitHub accounts connected. Please connect an account first in the Accounts tab.
            </Alert>
          )}

          {selectedAccount && gitStatusOverview && (
            <Card className="mb-3">
              <Card.Header className="d-flex align-items-center justify-content-between">
                <div>
                  <i className="bi bi-git me-2"></i>
                  Git Status Overview
                </div>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={handleRefreshStatus}
                  disabled={loadingGitStatus}
                >
                  <i className={`bi ${loadingGitStatus ? 'bi-arrow-clockwise spinning' : 'bi-arrow-clockwise'} me-1`}></i>
                  Refresh Status
                </Button>
              </Card.Header>
              <Card.Body>
                <Row>
                  <Col md={3}>
                    <div className="text-center">
                      <div className="h4 mb-1 text-primary">{gitStatusOverview.cloned}</div>
                      <div className="small text-muted">Cloned Locally</div>
                      <ProgressBar
                        now={(gitStatusOverview.cloned / gitStatusOverview.total) * 100}
                        variant="primary"
                        className="mt-1"
                        style={{ height: '4px' }}
                      />
                    </div>
                  </Col>
                  <Col md={3}>
                    <div className="text-center">
                      <div className="h4 mb-1 text-success">{gitStatusOverview.clean}</div>
                      <div className="small text-muted">Clean</div>
                      <ProgressBar
                        now={gitStatusOverview.cloned > 0 ? (gitStatusOverview.clean / gitStatusOverview.cloned) * 100 : 0}
                        variant="success"
                        className="mt-1"
                        style={{ height: '4px' }}
                      />
                    </div>
                  </Col>
                  <Col md={3}>
                    <div className="text-center">
                      <div className="h4 mb-1 text-warning">{gitStatusOverview.withChanges}</div>
                      <div className="small text-muted">With Changes</div>
                      <ProgressBar
                        now={gitStatusOverview.cloned > 0 ? (gitStatusOverview.withChanges / gitStatusOverview.cloned) * 100 : 0}
                        variant="warning"
                        className="mt-1"
                        style={{ height: '4px' }}
                      />
                    </div>
                  </Col>
                  <Col md={3}>
                    <div className="text-center">
                      <div className="h4 mb-1 text-info">{gitStatusOverview.branches.length}</div>
                      <div className="small text-muted">Active Branches</div>
                      <div className="mt-1 small">
                        {gitStatusOverview.branches.slice(0, 2).map(branch => (
                          <Badge key={branch} bg="info" className="me-1">{branch}</Badge>
                        ))}
                        {gitStatusOverview.branches.length > 2 && (
                          <Badge bg="secondary">+{gitStatusOverview.branches.length - 2}</Badge>
                        )}
                      </div>
                    </div>
                  </Col>
                </Row>
                {(gitStatusOverview.totalModified > 0 || gitStatusOverview.totalStaged > 0 || gitStatusOverview.totalUntracked > 0) && (
                  <Row className="mt-3 pt-3 border-top">
                    <Col>
                      <div className="small text-muted text-center">
                        <span className="me-3">
                          <i className="bi bi-pencil text-warning me-1"></i>
                          {gitStatusOverview.totalModified} modified
                        </span>
                        <span className="me-3">
                          <i className="bi bi-plus-circle text-success me-1"></i>
                          {gitStatusOverview.totalStaged} staged
                        </span>
                        <span>
                          <i className="bi bi-question-circle text-secondary me-1"></i>
                          {gitStatusOverview.totalUntracked} untracked
                        </span>
                      </div>
                    </Col>
                  </Row>
                )}
              </Card.Body>
            </Card>
          )}

          {selectedAccount && (
            <Card>
              <Card.Header className="d-flex align-items-center justify-content-between">
                <div>
                  <i className="bi bi-folder-check me-2"></i>
                  Workspace Repositories
                  {searchTerm && (
                    <small className="text-muted ms-2">
                      (filtered by "{searchTerm}")
                    </small>
                  )}
                </div>
                <div>
                  <Badge bg="primary" pill className="me-2">
                    {filteredRepositories.length}
                  </Badge>
                  <Button
                    variant="success"
                    size="sm"
                    onClick={handleAddRepositories}
                    className="me-2"
                    disabled={!selectedAccount}
                  >
                    <i className="bi bi-plus-circle me-1"></i>
                    Manage Repository Selection
                  </Button>
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={loadRepositories}
                    disabled={loading}
                  >
                    <i className="bi bi-arrow-clockwise me-1"></i>
                    Refresh
                  </Button>
                </div>
              </Card.Header>
              <Card.Body>
                {loading ? (
                  <div className="d-flex justify-content-center p-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading workspace repositories...</span>
                    </div>
                  </div>
                ) : filteredRepositories.length === 0 ? (
                  <Alert variant="info" className="text-center">
                    <i className="bi bi-info-circle me-2"></i>
                    <strong>No repositories in workspace yet.</strong>
                    <p className="mb-2 mt-2">
                      Use the "Manage Repository Selection" button above to add repositories to your workspace.
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleAddRepositories}
                      disabled={!selectedAccount}
                    >
                      <i className="bi bi-plus-circle me-1"></i>
                      Add to Workspace
                    </Button>
                  </Alert>
                ) : (
                  <GitHubRepositoryList
                    ref={repositoryListRef}
                    repositories={filteredRepositories}
                    accountId={selectedAccount}
                    onRepositoryBrowse={onRepositoryBrowse}
                    onRepositoryUpdate={loadRepositories}
                    onStatusUpdate={handleRepositoryStatusUpdate}
                  />
                )}
              </Card.Body>
            </Card>
          )}
        </>
      ) : (
        // Repository Settings View
        <GitHubRepositorySettings
          account={accounts.find(acc => acc.id.toString() === selectedAccount)}
          onBack={handleRepositorySettingsClose}
        />
      )}
    </div>
  );
}
