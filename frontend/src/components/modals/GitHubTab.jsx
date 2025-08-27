import React, { useState, useEffect } from 'react';
import { Card, Button, ListGroup, Alert, Badge, Spinner, Accordion } from 'react-bootstrap';
import gitHubApi from '../../api/gitHubApi';
import ConfirmModal from './ConfirmModal';

function GitHubTab() {
  const [accounts, setAccounts] = useState([]);
  const [accountRepositories, setAccountRepositories] = useState({}); // Store repos by account ID
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState(null);

  // Load GitHub accounts on component mount
  useEffect(() => {
    loadAccounts();
  }, []);

  // Auto-load repositories for first account when accounts are loaded
  useEffect(() => {
    if (accounts.length > 0) {
      const accountWithRepos = accounts.find(account => account.repository_count > 0);
      if (accountWithRepos && !accountRepositories[accountWithRepos.id]) {
        loadRepositories(accountWithRepos.id);
      }
    }
  }, [accounts]);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      setError('');
      const accounts = await gitHubApi.getAccounts();
      setAccounts(accounts);
    } catch (err) {
      setError('Failed to load GitHub accounts');
      console.error('Failed to load GitHub accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const connectGitHub = async () => {
    try {
      setLoading(true);
      setError('');
      const { authorization_url } = await gitHubApi.getAuthUrl();

      // Open GitHub OAuth in a new window
      const popup = window.open(
        authorization_url,
        'github-oauth',
        'width=600,height=600,scrollbars=yes,resizable=yes'
      );

      // Check when popup closes
      const checkClosed = setInterval(async () => {
        if (popup.closed) {
          clearInterval(checkClosed);

          // Give a moment for the backend to process, then refresh accounts
          setTimeout(async () => {
            try {
              await loadAccounts();
              setSuccess('GitHub account connected successfully!');
            } catch (err) {
              setError('Failed to verify GitHub connection. Please try again.');
              console.error('Failed to load accounts after OAuth:', err);
            }
            setLoading(false);
          }, 1000);
        }
      }, 1000);

      // Cleanup if the popup is closed manually
      const cleanupTimer = setTimeout(() => {
        clearInterval(checkClosed);
        setLoading(false);
      }, 300000); // 5 minutes timeout

    } catch (err) {
      setError('Failed to connect to GitHub');
      console.error('Failed to initiate GitHub OAuth:', err);
      setLoading(false);
    }
  };

  const connectDifferentAccount = () => {
    const authUrl = `${window.location.origin}/github-connect`;

    // Show instructions modal
    const instructionText = `To connect a different GitHub account:

1. Copy this URL: ${authUrl}
2. Open a new incognito/private window (Ctrl+Shift+N / Cmd+Shift+N)
3. Paste the URL in the incognito window
4. Log into your app and connect the GitHub account

This ensures a clean session without cached GitHub authentication.`;

    // For now, show in alert - could be enhanced with a proper modal
    if (window.confirm(instructionText + '\n\nClick OK to copy the URL to clipboard.')) {
      navigator.clipboard.writeText(authUrl).catch(() => {
        // Fallback if clipboard API fails
        console.log('URL:', authUrl);
      });
    }
  };

  const handleDeleteClick = (account) => {
    setAccountToDelete(account);
    setShowDeleteConfirm(true);
  };

  const disconnectAccount = async (accountId) => {
    try {
      setLoading(true);
      setError('');
      await gitHubApi.disconnectAccount(accountId);
      setSuccess('GitHub account disconnected');
      setAccountRepositories(prev => {
        const updated = { ...prev };
        delete updated[accountId];
        return updated;
      });
      loadAccounts();
    } catch (err) {
      setError('Failed to disconnect GitHub account');
      console.error('Failed to disconnect GitHub account:', err);
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
      setAccountToDelete(null);
    }
  };

  const handleConfirmAction = (action) => {
    if (action === 'delete' && accountToDelete) {
      disconnectAccount(accountToDelete.id);
    } else {
      setShowDeleteConfirm(false);
      setAccountToDelete(null);
    }
  };

  const toggleAccountExpansion = async (accountId) => {
    // Load repositories if not already loaded
    if (!accountRepositories[accountId]) {
      await loadRepositories(accountId);
    }
  };

  const loadRepositories = async (accountId) => {
    try {
      setLoading(true);
      setError('');
      const repositories = await gitHubApi.getRepositories(accountId);
      setAccountRepositories(prev => ({
        ...prev,
        [accountId]: repositories
      }));
    } catch (err) {
      setError('Failed to load repositories');
      console.error('Failed to load repositories:', err);
    } finally {
      setLoading(false);
    }
  };

  const syncRepositories = async (accountId) => {
    try {
      setLoading(true);
      setError('');
      await gitHubApi.syncRepositories(accountId);
      setSuccess('Repositories synced successfully');
      // Refresh both accounts (for last_sync timestamp) and repositories
      await Promise.all([
        loadAccounts(),
        loadRepositories(accountId)
      ]);
    } catch (err) {
      setError('Failed to sync repositories');
      console.error('Failed to sync repositories:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatLastSync = (lastSync) => {
    if (!lastSync) return 'Never synced';

    const now = new Date();
    const syncDate = new Date(lastSync);
    const diffMs = now - syncDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  return (
    <div className="mt-3 github-tab-container">
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Card className="mb-3">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <span>
            <i className="bi bi-github me-2"></i>
            Connected Accounts
          </span>
          <div className="d-flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={connectGitHub}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Connecting...
                </>
              ) : (
                <>
                  <i className="bi bi-plus-circle me-2"></i>
                  Connect GitHub
                </>
              )}
            </Button>
            {accounts.length > 0 && (
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => window.open('https://github.com/logout', '_blank')}
                title="Log out of GitHub to connect a different account"
              >
                <i className="bi bi-box-arrow-right me-1"></i>
                Switch Account
              </Button>
            )}
          </div>
        </Card.Header>
        <Card.Body>
          {accounts.length === 0 ? (
            <div className="text-center text-muted py-4">
              <i className="bi bi-github fs-1 d-block mb-3"></i>
              <p className="mb-2">No GitHub accounts connected.</p>
              <p className="small mb-3">Connect your GitHub accounts to import and sync markdown files from your repositories.</p>
              <Alert variant="light" className="small text-start">
                <strong>Multiple Accounts:</strong> You can connect multiple GitHub accounts.
                Each time you click "Connect GitHub", you'll be prompted to authorize the account
                you're currently logged into on GitHub.
              </Alert>
            </div>
          ) : (
            <Accordion className="github-account-accordion">
              {accounts.map((account, index) => (
                <Accordion.Item eventKey={account.id.toString()} key={account.id}>
                  <Accordion.Header>
                    <div className="d-flex align-items-center w-100">
                      {account.avatar_url ? (
                        <img
                          src={account.avatar_url}
                          alt={account.username}
                          width="32"
                          height="32"
                          className="rounded-circle me-3"
                        />
                      ) : (
                        <i className="bi bi-github fs-5 me-3"></i>
                      )}
                      <div className="flex-grow-1">
                        <div className="d-flex justify-content-between align-items-center w-100">
                          <div>
                            <strong>{account.display_name || account.username}</strong>
                            <div className="small text-muted">
                              @{account.username}
                              {account.email && ` • ${account.email}`}
                            </div>
                            {account.repository_count > 0 && (
                              <div className="small text-muted github-sync-status">
                                <i className="bi bi-folder me-1"></i>
                                {account.repository_count} repositories •
                                <i className="bi bi-clock me-1"></i>
                                Last sync: {formatLastSync(account.last_sync)}
                              </div>
                            )}
                          </div>
                          <div className="me-3">
                            <Badge
                              bg={account.is_active ? 'success' : 'danger'}
                              className="me-2"
                            >
                              {account.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                            <span
                              className="btn btn-outline-danger btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(account);
                              }}
                              style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
                              title="Disconnect GitHub account"
                            >
                              <i className="bi bi-trash"></i>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Accordion.Header>
                  <Accordion.Body onEntering={() => toggleAccountExpansion(account.id)}>
                    {accountRepositories[account.id] && accountRepositories[account.id].length > 0 ? (
                      <div>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <h6 className="mb-0">
                            <i className="bi bi-folder me-2"></i>
                            Repositories ({account.repository_count})
                          </h6>
                          <div className="d-flex align-items-center">
                            {account.repository_count > 6 && (
                              <small className="text-muted me-2">
                                <i className="bi bi-arrows-vertical me-1"></i>
                                Scroll to see all
                              </small>
                            )}
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => syncRepositories(account.id)}
                              disabled={loading}
                            >
                              {loading ? (
                                <>
                                  <Spinner animation="border" size="sm" className="me-1" />
                                  Syncing...
                                </>
                              ) : (
                                <>
                                  <i className="bi bi-arrow-clockwise me-1"></i>
                                  Sync Repos
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                        <div className="github-repositories-scroll">
                          <ListGroup variant="flush">
                            {accountRepositories[account.id].map((repo, repoIndex) => (
                              <ListGroup.Item
                                key={repo.id}
                                className={`github-repo-item d-flex justify-content-between align-items-center py-2 ${
                                  repoIndex === accountRepositories[account.id].length - 1 ? 'border-bottom-0' : ''
                                }`}
                              >
                                <div>
                                  <div className="fw-semibold">{repo.repo_name}</div>
                                  <div className="small text-muted">
                                    {repo.description || 'No description available'}
                                  </div>
                                </div>
                                <div className="d-flex align-items-center">
                                  {repo.is_private && (
                                    <Badge bg="warning" text="dark" className="me-2">
                                      <i className="bi bi-lock me-1"></i>
                                      Private
                                    </Badge>
                                  )}
                                  <Badge bg="secondary" className="me-2">
                                    <i className="bi bi-git me-1"></i>
                                    {repo.default_branch}
                                  </Badge>
                                  <Button variant="outline-primary" size="sm">
                                    <i className="bi bi-folder-open me-1"></i>
                                    Browse
                                  </Button>
                                </div>
                              </ListGroup.Item>
                            ))}
                          </ListGroup>
                        </div>
                      </div>
                    ) : loading ? (
                      <div className="text-center py-4">
                        <Spinner animation="border" className="me-2" />
                        Loading repositories...
                      </div>
                    ) : (
                      <div className="text-center text-muted py-4">
                        <i className="bi bi-folder-x fs-1 d-block mb-2 opacity-50"></i>
                        <p className="mb-1">No repositories found</p>
                        <p className="small">This account doesn't have any accessible repositories.</p>
                      </div>
                    )}
                  </Accordion.Body>
                </Accordion.Item>
              ))}
            </Accordion>
          )}
        </Card.Body>
      </Card>

      <div className="mt-3">
        <small className="text-muted">
          <i className="bi bi-info-circle me-1"></i>
          GitHub integration allows you to import markdown files from your repositories and sync changes back to GitHub.
        </small>
        {accounts.length > 0 && (
          <div className="mt-2">
            <Alert variant="warning" className="small py-2 mb-1">
              <div className="d-flex align-items-start">
                <i className="bi bi-exclamation-triangle me-2 mt-1"></i>
                <div className="flex-grow-1">
                  <strong>Multiple Account Setup:</strong><br/>
                  GitHub OAuth uses your current browser session. To connect a different account:
                  <ol className="mt-1 mb-1 ps-3">
                    <li>
                      <a href="https://github.com/logout" target="_blank" rel="noopener noreferrer">
                        Log out of GitHub ↗
                      </a>
                    </li>
                    <li>Log into the GitHub account you want to connect</li>
                    <li>Return here and click "Connect GitHub"</li>
                  </ol>
                  <small className="text-muted">
                    If the wrong account appears, GitHub is still using cached session data.
                  </small>
                </div>
              </div>
            </Alert>
          </div>
        )}
      </div>

      <ConfirmModal
        show={showDeleteConfirm}
        onHide={() => {
          setShowDeleteConfirm(false);
          setAccountToDelete(null);
        }}
        onAction={handleConfirmAction}
        title="Disconnect GitHub Account"
        icon={<i className="bi bi-github text-danger me-2"></i>}
        buttons={[
          {
            text: "Cancel",
            variant: "secondary",
            action: "cancel"
          },
          {
            text: "Disconnect",
            variant: "danger",
            action: "delete",
            icon: "bi bi-trash"
          }
        ]}
      >
        <div className="mb-3">
          <p className="mb-2">
            Are you sure you want to disconnect the GitHub account
            <strong className="mx-1">{accountToDelete?.username}</strong>?
          </p>
          <div className="alert alert-warning mb-0">
            <i className="bi bi-exclamation-triangle me-2"></i>
            <small>
              This will remove access to repositories and may affect any documents
              that were imported from this GitHub account.
            </small>
          </div>
        </div>
      </ConfirmModal>
    </div>
  );
}

export default GitHubTab;
