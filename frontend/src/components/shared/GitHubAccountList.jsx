import React, { useState, useEffect } from 'react';
import { Card, Button, ListGroup, Alert, Badge, Spinner, Accordion, Form } from 'react-bootstrap';
import gitHubApi from '../../api/gitHubApi';
import ConfirmModal from '../shared/modals/ConfirmModal';
import githubOAuthListener from '../../utils/GitHubOAuthListener';

const GitHubAccountList = ({
  accounts: passedAccounts,
  onBrowseRepository,
  onDeleteAccount,
  onConnectGitHub,
  compact = false,
  maxHeight = 'auto' // Allow custom max height override
}) => {
  const [accounts, setAccounts] = useState(passedAccounts || []);
  const [accountRepositories, setAccountRepositories] = useState({}); // Store repos by account ID
  const [loadingAccounts, setLoadingAccounts] = useState(false); // Loading accounts list
  const [syncingAccounts, setSyncingAccounts] = useState({}); // Syncing repos per account ID
  const [syncPollingInterval, setSyncPollingInterval] = useState(null);
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

  // Set up global OAuth listener
  useEffect(() => {
    console.log('GitHubAccountList: Setting up global OAuth listener');
    const cleanup = githubOAuthListener.addListener(async (event) => {
      console.log('GitHubAccountList: Received OAuth result', event);
      if (event.data.type === 'GITHUB_AUTH_SUCCESS') {
        console.log('GitHubAccountList: Processing OAuth success - refreshing accounts');
        // Reload accounts when OAuth succeeds
        if (!passedAccounts) {
          try {
            // Store current account IDs before loading
            const previousAccountIds = accounts.map(acc => acc.id);

            // Load updated accounts
            await loadAccounts();

            // Wait a bit for state to update, then start sync polling for new accounts
            setTimeout(async () => {
              // Get current accounts after the state update
              const response = await gitHubApi.getAccounts();
              const currentAccounts = response || [];

              // Find new accounts
              const newAccounts = currentAccounts.filter(account =>
                !previousAccountIds.includes(account.id)
              );

              console.log('GitHubAccountList: Found new accounts after OAuth:', newAccounts.map(a => a.id));

              if (newAccounts.length > 0) {
                // Start sync polling for new accounts - this will handle everything
                const newAccountIds = newAccounts.map(a => a.id);
                startSyncPolling(newAccountIds);

                console.log('GitHubAccountList: Started sync polling for new accounts:', newAccountIds);
              }
            }, 100);

          } catch (error) {
            console.error('GitHubAccountList: Error handling OAuth success:', error);
          }
        }
        // If accounts are passed as props, the parent should handle refresh
      }
    });

    return cleanup;
  }, [passedAccounts, accounts]);

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (syncPollingInterval) {
        clearInterval(syncPollingInterval);
      }
    };
  }, [syncPollingInterval]);

  // Update accounts when passed as props
  useEffect(() => {
    if (passedAccounts) {
      setAccounts(passedAccounts);
    }
  }, [passedAccounts]);

  // Auto-load repositories for existing accounts (not currently syncing)
  useEffect(() => {
    if (accounts.length > 0) {
      // Find accounts that don't have repositories loaded yet and aren't syncing
      const accountsNeedingRepos = accounts.filter(account =>
        !accountRepositories[account.id] &&
        !syncingAccounts[account.id]
      );

      if (accountsNeedingRepos.length > 0) {
        console.log('GitHubAccountList: Auto-loading repositories for existing accounts:', accountsNeedingRepos.map(a => a.id));
        // Load repositories for the first account that needs them
        const firstAccount = accountsNeedingRepos[0];
        loadRepositories(firstAccount.id);
      }
    }
  }, [accounts, accountRepositories, syncingAccounts]);

  const loadAccounts = async () => {
    setLoadingAccounts(true);
    setError('');
    try {
      const response = await gitHubApi.getAccounts();
      setAccounts(response || []);
    } catch (error) {
      console.error('Failed to load GitHub accounts:', error);
      setError('Failed to load GitHub accounts. Please try again.');
    } finally {
      setLoadingAccounts(false);
    }
  };

  const connectGitHub = async () => {
    if (onConnectGitHub) {
      onConnectGitHub();
    } else {
      try {
        const authData = await gitHubApi.getAuthUrl();
        if (authData?.authorization_url) {
          window.open(authData.authorization_url, '_blank', 'width=600,height=700');
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
      console.log('GitHubAccountList: Loading repositories for account:', accountId);
      const repos = await gitHubApi.getRepositories(accountId);
      setAccountRepositories(prev => ({
        ...prev,
        [accountId]: repos
      }));
      console.log('GitHubAccountList: Loaded', repos.length, 'repositories for account:', accountId);
    } catch (error) {
      console.error('Failed to load repositories:', error);
      setError('Failed to load repositories. Please try again.');
    }
  };

  const startSyncPolling = (newAccountIds) => {
    console.log('GitHubAccountList: Starting sync polling for accounts:', newAccountIds);

    // Mark these accounts as syncing
    setSyncingAccounts(prev => {
      const newSyncing = { ...prev };
      newAccountIds.forEach(id => {
        newSyncing[id] = true;
      });
      return newSyncing;
    });

    // Clear any existing polling interval
    if (syncPollingInterval) {
      clearInterval(syncPollingInterval);
    }

    let pollCount = 0;
    const maxPolls = 30; // 1 minute maximum (30 * 2 seconds)
    let lastRepositoryCount = {};

    // Initialize repository count tracking
    newAccountIds.forEach(id => {
      lastRepositoryCount[id] = 0;
    });

    // Start polling for repository updates
    const interval = setInterval(async () => {
      pollCount++;

      try {
        console.log(`GitHubAccountList: Repository check ${pollCount} for accounts:`, newAccountIds);

        let allAccountsStable = true;

        // Check each account for repository updates
        for (const accountId of newAccountIds) {
          try {
            const repos = await gitHubApi.getRepositories(accountId);
            const currentCount = repos.length;
            const previousCount = lastRepositoryCount[accountId];

            console.log(`Account ${accountId}: ${currentCount} repos (was ${previousCount})`);

            // Update repository list if count changed
            if (currentCount !== previousCount) {
              setAccountRepositories(prev => ({
                ...prev,
                [accountId]: repos
              }));
              lastRepositoryCount[accountId] = currentCount;
              allAccountsStable = false;
            }

            // If no repositories yet, keep checking
            if (currentCount === 0) {
              allAccountsStable = false;
            }
          } catch (error) {
            console.error(`Error checking repositories for account ${accountId}:`, error);
            allAccountsStable = false;
          }
        }

        // If all accounts have been stable for 3+ checks (6+ seconds), consider sync complete
        if (allAccountsStable && pollCount >= 3) {
          console.log('GitHubAccountList: All accounts stable, sync completed');

          // Clear syncing state
          setSyncingAccounts(prev => {
            const newState = { ...prev };
            newAccountIds.forEach(id => {
              delete newState[id];
            });
            return newState;
          });

          // Stop polling
          clearInterval(interval);
          setSyncPollingInterval(null);
          return;
        }

        // Auto-stop after max polls to prevent infinite polling
        if (pollCount >= maxPolls) {
          console.log('GitHubAccountList: Sync polling timeout, stopping');
          setSyncingAccounts(prev => {
            const newState = { ...prev };
            newAccountIds.forEach(id => {
              delete newState[id];
            });
            return newState;
          });
          clearInterval(interval);
          setSyncPollingInterval(null);
        }
      } catch (error) {
        console.error('GitHubAccountList: Error during repository polling:', error);
        // On repeated errors, stop polling
        if (pollCount >= 10) {
          setSyncingAccounts(prev => {
            const newState = { ...prev };
            newAccountIds.forEach(id => {
              delete newState[id];
            });
            return newState;
          });
          clearInterval(interval);
          setSyncPollingInterval(null);
        }
      }
    }, 2000); // Check every 2 seconds

    setSyncPollingInterval(interval);
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

  if (loadingAccounts && accounts.length === 0) {
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
                  {syncingAccounts[account.id] && (
                    <Badge bg="warning" className="ms-1">
                      <Spinner animation="border" size="sm" className="me-1" style={{ width: '12px', height: '12px' }} />
                      Syncing
                    </Badge>
                  )}
                </div>
              </div>
            </Accordion.Header>
            <Accordion.Body style={{
              maxHeight: maxHeight === 'auto' ? '60vh' : maxHeight,
              overflowY: 'auto'
            }}>
              {syncingAccounts[account.id] ? (
                // Show syncing state first if account is syncing
                <div>
                  <div className="alert alert-info py-2 mb-3" role="alert">
                    <div className="d-flex align-items-center">
                      <Spinner animation="border" size="sm" className="text-info me-2" />
                      <div>
                        <strong>Syncing repositories...</strong>
                        <br />
                        <small>Importing markdown files. Repository count may increase as sync progresses.</small>
                      </div>
                    </div>
                  </div>

                  {accountRepositories[account.id] && accountRepositories[account.id].length > 0 ? (
                    <ListGroup variant="flush">
                      {(() => {
                        const filteredRepos = filterRepositories(accountRepositories[account.id]);

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
                    <div className="text-center py-3 text-muted">
                      <div className="mt-2">Discovering repositories...</div>
                    </div>
                  )}
                </div>
              ) : accountRepositories[account.id] ? (
                // Show normal repository list when not syncing
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
              ) : syncingAccounts[account.id] ? (
                // Show syncing state when no repositories loaded yet but sync is active
                <div className="text-center py-4">
                  <Spinner animation="border" size="sm" className="text-success" />
                  <div className="mt-2 text-muted">
                    <strong>Syncing repositories...</strong>
                  </div>
                  <div className="mt-1">
                    <small className="text-muted">
                      Importing markdown files from your repositories
                    </small>
                  </div>
                </div>
                ) : (
                  // No repositories loaded yet (different from loading state)
                  <div className="text-center py-3 text-muted">
                    <i className="bi bi-inbox"></i>
                    <div className="mt-2">No repositories loaded</div>
                  </div>
                )}
              </Accordion.Body>
            </Accordion.Item>
          ))}
        </Accordion>

      {!compact && (
        <div className="mt-2 text-center">
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
