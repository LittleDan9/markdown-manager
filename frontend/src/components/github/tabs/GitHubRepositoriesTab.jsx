import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Badge, Row, Col, Form, InputGroup } from 'react-bootstrap';
import { useNotification } from '../../NotificationProvider';
import { GitHubRepositoryList } from '../index';
import gitHubApi from '../../../api/gitHubApi';
import { sortRepositories } from '../../../utils/githubUtils';

export default function GitHubRepositoriesTab() {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  const { showSuccess, showError } = useNotification();

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
      const reposData = await gitHubApi.getRepositories(selectedAccount);
      setRepositories(reposData);
      setError(null);
    } catch (err) {
      setError('Failed to load repositories');
      console.error('Error loading repositories:', err);
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

  return (
    <div className="github-repositories-tab">
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
            <Form.Label>Search Repositories</Form.Label>
            <InputGroup>
              <InputGroup.Text>
                <i className="bi bi-search"></i>
              </InputGroup.Text>
              <Form.Control
                type="text"
                placeholder="Search by name or description..."
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
          Please select a GitHub account to view repositories.
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
              <i className="bi bi-folder-open me-2"></i>
              Repositories
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
                  <span className="visually-hidden">Loading repositories...</span>
                </div>
              </div>
            ) : (
              <GitHubRepositoryList 
                repositories={filteredRepositories}
                accountId={selectedAccount}
              />
            )}
          </Card.Body>
        </Card>
      )}
    </div>
  );
}
