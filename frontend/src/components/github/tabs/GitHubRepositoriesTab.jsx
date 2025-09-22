import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Badge, Row, Col, Form, InputGroup } from 'react-bootstrap';
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
  const { showSuccess, showError } = useNotification();
  const { openGitHubTab } = useFileModal();

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
    } catch (err) {
      setError('Failed to load selected repositories');
      console.error('Error loading selected repositories:', err);
    } finally {
      setLoading(false);
    }
  };

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
                <Form.Label>Search Selected Repositories</Form.Label>
                <InputGroup>
                  <InputGroup.Text>
                    <i className="bi bi-search"></i>
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Search selected repositories by name or description..."
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
              Please select a GitHub account to view your selected repositories.
            </Alert>
          )}

          {accounts.length === 0 && (
            <Alert variant="warning">
              <i className="bi bi-exclamation-triangle me-2"></i>
              No GitHub accounts connected. Please connect an account first in the Accounts tab.
            </Alert>
          )}

          {selectedAccount && (
            <Card>
              <Card.Header className="d-flex align-items-center justify-content-between">
                <div>
                  <i className="bi bi-folder-check me-2"></i>
                  Selected Repositories
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
                      <span className="visually-hidden">Loading selected repositories...</span>
                    </div>
                  </div>
                ) : filteredRepositories.length === 0 ? (
                  <Alert variant="info" className="text-center">
                    <i className="bi bi-info-circle me-2"></i>
                    <strong>No repositories selected yet.</strong>
                    <p className="mb-2 mt-2">
                      Use the "Add Repositories" button above to select repositories from your GitHub account.
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleAddRepositories}
                      disabled={!selectedAccount}
                    >
                      <i className="bi bi-plus-circle me-1"></i>
                      Select Repositories
                    </Button>
                  </Alert>
                ) : (
                  <GitHubRepositoryList
                    repositories={filteredRepositories}
                    accountId={selectedAccount}
                    onRepositoryBrowse={onRepositoryBrowse}
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
