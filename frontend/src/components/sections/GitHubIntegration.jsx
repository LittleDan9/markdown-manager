import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  ListGroup,
  Badge,
  Row,
  Col,
  Image,
  Spinner,
  Alert
} from 'react-bootstrap';
import { useNotification } from '../NotificationProvider';
import { api } from '../../services/api';

const GitHubIntegration = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [repositories, setRepositories] = useState([]);

  const { showSuccess, showError } = useNotification();

  // Load GitHub accounts on component mount
  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/github/accounts');
      setAccounts(response.data);
    } catch (error) {
      console.error('Failed to load GitHub accounts:', error);
      showError('Failed to load GitHub accounts');
    } finally {
      setLoading(false);
    }
  };

  const connectGitHub = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/github/auth/url');
      const { authorization_url } = response.data;

      // Open GitHub OAuth in a new window
      const popup = window.open(
        authorization_url,
        'github-oauth',
        'width=600,height=600,scrollbars=yes,resizable=yes'
      );

      // Listen for the OAuth callback
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setLoading(false);
          // Refresh accounts after OAuth
          loadAccounts();
          showSuccess('GitHub account connected successfully!');
        }
      }, 1000);

    } catch (error) {
      console.error('Failed to initiate GitHub OAuth:', error);
      showError('Failed to connect to GitHub');
      setLoading(false);
    }
  };

  const disconnectAccount = async (accountId) => {
    try {
      await api.delete(`/api/github/accounts/${accountId}`);
      showSuccess('GitHub account disconnected');
      loadAccounts();
    } catch (error) {
      console.error('Failed to disconnect GitHub account:', error);
      showError('Failed to disconnect GitHub account');
    }
  };

  const loadRepositories = async (accountId) => {
    try {
      setLoading(true);
      const response = await api.get(`/api/github/repositories?account_id=${accountId}`);
      setRepositories(response.data);
    } catch (error) {
      console.error('Failed to load repositories:', error);
      showError('Failed to load repositories');
    } finally {
      setLoading(false);
    }
  };

  const syncRepositories = async (accountId) => {
    try {
      setLoading(true);
      await api.post(`/api/github/repositories/sync?account_id=${accountId}`);
      showSuccess('Repositories synced successfully');
      loadRepositories(accountId);
    } catch (error) {
      console.error('Failed to sync repositories:', error);
      showError('Failed to sync repositories');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="mb-4">
        <i className="bi bi-github me-2"></i>
        GitHub Integration
      </h2>

      <Card className="mb-4">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <Card.Title className="mb-0">Connected Accounts</Card.Title>
          <Button
            variant="primary"
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
                <i className="bi bi-link-45deg me-2"></i>
                Connect GitHub Account
              </>
            )}
          </Button>
        </Card.Header>
        <Card.Body>
          {accounts.length === 0 ? (
            <Alert variant="info">
              <Alert.Heading>No GitHub accounts connected</Alert.Heading>
              <p>Click "Connect GitHub Account" to get started with GitHub integration.</p>
            </Alert>
          ) : (
            <ListGroup variant="flush">
              {accounts.map((account) => (
                <ListGroup.Item key={account.id}>
                  <Row className="align-items-center">
                    <Col xs="auto">
                      {account.avatar_url ? (
                        <Image
                          src={account.avatar_url}
                          alt={account.username}
                          width={40}
                          height={40}
                          roundedCircle
                        />
                      ) : (
                        <i className="bi bi-github" style={{ fontSize: '24px' }}></i>
                      )}
                    </Col>
                    <Col>
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <strong>{account.display_name || account.username}</strong>
                        <Badge bg="primary">@{account.username}</Badge>
                        <Badge bg={account.is_active ? 'success' : 'danger'}>
                          {account.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <small className="text-muted">{account.email}</small>
                    </Col>
                    <Col xs="auto">
                      <div className="d-flex gap-2">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => loadRepositories(account.id)}
                        >
                          View Repositories
                        </Button>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => syncRepositories(account.id)}
                        >
                          Sync Repos
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => disconnectAccount(account.id)}
                        >
                          <i className="bi bi-x-circle me-1"></i>
                          Disconnect
                        </Button>
                      </div>
                    </Col>
                  </Row>
                </ListGroup.Item>
              ))}
            </ListGroup>
          )}
        </Card.Body>
      </Card>

      {repositories.length > 0 && (
        <Card>
          <Card.Header>
            <Card.Title className="mb-0">Repositories</Card.Title>
          </Card.Header>
          <Card.Body>
            <ListGroup variant="flush">
              {repositories.map((repo) => (
                <ListGroup.Item key={repo.id}>
                  <Row className="align-items-center">
                    <Col>
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <strong>{repo.repo_name}</strong>
                        {repo.is_private && <Badge bg="warning">Private</Badge>}
                        <Badge bg="info">{repo.default_branch}</Badge>
                      </div>
                      <small className="text-muted">
                        {repo.description || 'No description'}
                      </small>
                    </Col>
                    <Col xs="auto">
                      <div className="d-flex gap-2">
                        <Button variant="outline-primary" size="sm">
                          Browse Files
                        </Button>
                        <Button variant="primary" size="sm">
                          Import Files
                        </Button>
                      </div>
                    </Col>
                  </Row>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default GitHubIntegration;
