import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Badge, Row, Col } from 'react-bootstrap';
import { useNotification } from '../../NotificationProvider';
import { GitHubAccountConnection, GitHubAccountList } from '../index';
import gitHubApi from '../../../api/gitHubApi';

export default function GitHubAccountsTab() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const accountsData = await gitHubApi.getAccounts();
      setAccounts(accountsData);
      setError(null);
    } catch (err) {
      setError('Failed to load GitHub accounts');
      console.error('Error loading accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAccountConnected = () => {
    showSuccess('GitHub account connected successfully!');
    loadAccounts();
  };

  const handleAccountDisconnected = (accountId) => {
    setAccounts(accounts.filter(acc => acc.id !== accountId));
    showSuccess('GitHub account disconnected successfully!');
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center p-4">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="github-accounts-tab">
      <Row>
        <Col md={12}>
          {error && (
            <Alert variant="danger" dismissible onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Card className="mb-3">
            <Card.Header className="d-flex align-items-center justify-content-between">
              <div>
                <i className="bi bi-person-circle me-2"></i>
                Connected GitHub Accounts
              </div>
              <Badge bg="primary" pill>
                {accounts.length}
              </Badge>
            </Card.Header>
            <Card.Body>
              {accounts.length > 0 ? (
                <GitHubAccountList
                  accounts={accounts}
                  loading={loading}
                  onDeleteAccount={handleAccountDisconnected}
                />
              ) : (
                <Alert variant="info" className="mb-0">
                  <i className="bi bi-info-circle me-2"></i>
                  <strong>No GitHub accounts connected.</strong>
                  <br />
                  Connect your first account below to unlock:
                  <ul className="mb-0 mt-2">
                    <li><strong>Repositories</strong> - Browse and manage your GitHub repositories</li>
                    <li><strong>Cache & Synchronization</strong> - Performance monitoring and sync controls</li>
                  </ul>
                </Alert>
              )}
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <i className="bi bi-plus-circle me-2"></i>
              Connect New GitHub Account
            </Card.Header>
            <Card.Body>
              <GitHubAccountConnection onSuccess={handleAccountConnected} />
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
