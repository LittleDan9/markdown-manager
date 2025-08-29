import React, { useState, useEffect } from 'react';
import { Card, Button, ListGroup, Alert, Badge, Spinner, Accordion, Form } from 'react-bootstrap';
import gitHubApi from '../../api/gitHubApi';
import ConfirmModal from '../modals/ConfirmModal';

const GitHubAccountList = ({
  accounts: passedAccounts,
  onBrowseRepository,
  onDeleteAccount,
  compact = false
}) => {
  const [accounts, setAccounts] = useState(passedAccounts || []);
  const [accountRepositories, setAccountRepositories] = useState({}); // Store repos by account ID
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState(null);

  // Load GitHub accounts on component mount if not passed as props
  useEffect(() => {
    if (!passedAccounts) {
      loadAccounts();
    }
  }, [passedAccounts]);

  // Update accounts when passed as props
  useEffect(() => {
    if (passedAccounts) {
      setAccounts(passedAccounts);
    }
  }, [passedAccounts]);

  // Auto-load repositories for first account when accounts are loaded
  useEffect(() => {
    if (accounts.length > 0 && Object.keys(accountRepositories).length === 0) {
      const firstAccount = accounts[0];
      toggleAccountExpansion(firstAccount.id);
    }
  }, [accounts]);

  const loadAccounts = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await gitHubApi.getAccounts();
      setAccounts(response || []);
    } catch (error) {
      console.error('Failed to load GitHub accounts:', error);
      setError('Failed to load GitHub accounts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const connectGitHub = async () => {
    if (onConnectGitHub) {
      onConnectGitHub();
    } else {
      try {
        const authData = await gitHubApi.getAuthUrl();
        if (authData?.auth_url) {
          window.open(authData.auth_url, '_blank', 'width=600,height=700');
        }
      } catch (error) {
        console.error('Failed to get GitHub auth URL:', error);
        setError('Failed to initiate GitHub connection. Please try again.');
      }
    }
  };

  const toggleAccountExpansion = async (accountId) => {
    if (accountRepositories[accountId]) {
      // Collapse
      const newRepos = { ...accountRepositories };
      delete newRepos[accountId];
      setAccountRepositories(newRepos);
    } else {
      // Expand - load repositories
      await loadRepositories(accountId);
    }
  };

  const loadRepositories = async (accountId) => {
    try {
      setLoading(true);
      const repos = await gitHubApi.getRepositories(accountId);
      setAccountRepositories(prev => ({
        ...prev,
        [accountId]: repos
      }));
    } catch (error) {
      console.error('Failed to load repositories:', error);
      setError('Failed to load repositories. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (accountId, accountName) => {
    setAccountToDelete({ id: accountId, name: accountName });
    setShowConfirmModal(true);
  };

  const handleDeleteAccount = async () => {
    if (!accountToDelete) return;

    try {
      await gitHubApi.disconnectAccount(accountToDelete.id);
      
      // Update local state
      setAccounts(accounts.filter(acc => acc.id !== accountToDelete.id));
      
      // Remove repositories for this account
      const newRepos = { ...accountRepositories };
      delete newRepos[accountToDelete.id];
      setAccountRepositories(newRepos);
      
      // Call parent callback if provided
      if (onDeleteAccount) {
        onDeleteAccount(accountToDelete.id);
      }
    } catch (error) {
      console.error('Failed to delete account:', error);
      setError('Failed to disconnect account. Please try again.');
    } finally {
      setShowConfirmModal(false);
      setAccountToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setShowConfirmModal(false);
    setAccountToDelete(null);
  };  const formatLastSync = (lastSync) => {
    if (!lastSync) return 'Never';
    const date = new Date(lastSync);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  };

  const filterRepositories = (repositories) => {
    let filteredRepos = repositories;

    if (searchTerm.trim()) {
      filteredRepos = repositories.filter(repo =>
        repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (repo.description && repo.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Sort alphabetically by repository name
    return filteredRepos.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  };

  if (loading && accounts.length === 0) {
    return (
      <div className="text-center py-4">
        <Spinner animation="border" />
        <div className="mt-2">Loading GitHub accounts...</div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <Card className={compact ? "" : "h-100"}>
        <Card.Body className="text-center py-5">
          <i className="bi bi-github display-4 text-muted mb-3"></i>
          <h5>No GitHub Account Connected</h5>
          <p className="text-muted mb-4">
            Connect your GitHub account to import and sync markdown files with your repositories.
          </p>
          <Button variant="primary" onClick={connectGitHub}>
            <i className="bi bi-github me-2"></i>
            Connect GitHub Account
          </Button>
        </Card.Body>
      </Card>
    );
  }

  return (
    <div className={compact ? "" : "h-100"}>
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {accounts.length > 0 && (
        <Form.Group className="mb-3">
          <Form.Control
            type="text"
            placeholder="Search repositories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="sm"
          />
        </Form.Group>
      )}

      <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        <Accordion defaultActiveKey={accounts[0]?.id?.toString()}>
          {accounts.map((account) => (
            <Accordion.Item key={account.id} eventKey={account.id.toString()}>
              <Accordion.Header
                onClick={() => toggleAccountExpansion(account.id)}
                className="d-flex align-items-center"
              >
                <div className="d-flex align-items-center flex-grow-1">
                  <img
                    src={account.avatar_url}
                    alt={`${account.username} avatar`}
                    className="rounded-circle me-3"
                    width="32"
                    height="32"
                  />
                  <div>
                    <div className="fw-semibold">{account.display_name || account.username}</div>
                    <small className="text-muted">@{account.username}</small>
                  </div>
                  <div className="ms-auto me-2">
                    <Badge bg="success" className="me-2">Connected</Badge>
                    {accountRepositories[account.id] && (
                      <Badge bg="secondary">
                        {(() => {
                          const totalRepos = accountRepositories[account.id].length;
                          const filteredRepos = filterRepositories(accountRepositories[account.id]).length;

                          if (searchTerm.trim() && filteredRepos !== totalRepos) {
                            return `${filteredRepos}/${totalRepos} repos`;
                          }
                          return `${totalRepos} repos`;
                        })()}
                      </Badge>
                    )}
                  </div>
                </div>
              </Accordion.Header>
              <Accordion.Body>
                {accountRepositories[account.id] ? (
                  <ListGroup variant="flush">
                    {(() => {
                      const filteredRepos = filterRepositories(accountRepositories[account.id]);

                      if (accountRepositories[account.id].length === 0) {
                        return (
                          <div className="text-center py-3 text-muted">
                            <i className="bi bi-inbox"></i>
                            <div className="mt-2">No repositories found</div>
                          </div>
                        );
                      }

                      if (filteredRepos.length === 0) {
                        return (
                          <div className="text-center py-3 text-muted">
                            <i className="bi bi-search"></i>
                            <div className="mt-2">No repositories match "{searchTerm}"</div>
                            <small>Try a different search term</small>
                          </div>
                        );
                      }

                      return filteredRepos.map((repo) => (
                        <ListGroup.Item
                          key={repo.id}
                          action={onBrowseRepository}
                          onClick={() => onBrowseRepository?.(repo)}
                          style={{ cursor: onBrowseRepository ? 'pointer' : 'default' }}
                        >
                          <div className="d-flex align-items-center justify-content-between">
                            <div className="fw-semibold">{repo.name}</div>
                            <Badge
                              bg={repo.private ? 'warning' : 'success'}
                              text={repo.private ? 'dark' : 'white'}
                            >
                              {repo.private ? 'Private' : 'Public'}
                            </Badge>
                          </div>
                          <div className="text-muted small mt-1">
                            {repo.description || '\u00A0'}
                          </div>
                        </ListGroup.Item>
                      ));
                    })()}
                  </ListGroup>
                ) : (
                  <div className="text-center py-3">
                    <Spinner animation="border" size="sm" />
                    <div className="mt-2 small">Loading repositories...</div>
                  </div>
                )}
              </Accordion.Body>
            </Accordion.Item>
          ))}
        </Accordion>
      </div>

      {!compact && (
        <div className="mt-3 text-center">
          <Button variant="outline-secondary" size="sm" onClick={connectGitHub}>
            <i className="bi bi-plus-circle me-1"></i>
            Connect Another Account
          </Button>
        </div>
      )}

      <ConfirmModal
        show={showConfirmModal}
        onHide={handleCancelDelete}
        onAction={(action) => {
          if (action === 'confirm') {
            handleDeleteAccount();
          } else {
            handleCancelDelete();
          }
        }}
        title="Disconnect GitHub Account"
        message={`Are you sure you want to disconnect ${accountToDelete?.name}? This will remove all synced repositories and cannot be undone.`}
        icon={<i className="bi bi-exclamation-triangle-fill text-warning me-2"></i>}
        buttons={[
          {
            text: 'Cancel',
            variant: 'secondary',
            action: 'cancel'
          },
          {
            text: 'Disconnect',
            variant: 'danger',
            action: 'confirm',
            icon: 'bi-trash'
          }
        ]}
      />
    </div>
  );
};

export default GitHubAccountList;
