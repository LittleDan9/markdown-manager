import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Alert, Spinner, Button, InputGroup, Row, Col } from 'react-bootstrap';
import StorageTab from '../storage/StorageTab';
import { useNotification } from '../NotificationProvider';
import adminGitHubApi from '../../api/admin/githubApi';
import adminSystemApi from '../../api/admin/systemApi';

function AdminStorageTab() {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { showError, showSuccess } = useNotification();

  // Attachment quota state
  const [quotaBytes, setQuotaBytes] = useState(500);
  const [quotaUnit, setQuotaUnit] = useState('MB');
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [quotaSaving, setQuotaSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Use the admin GitHub API
      const userData = await adminGitHubApi.getAllUsersForAdmin();
      setUsers(userData);

      // Auto-select first user if available
      if (userData.length > 0 && !selectedUserId) {
        setSelectedUserId(userData[0].id.toString());
      }
    } catch (err) {
      setError(err.message);
      showError(err.message);
      // Fallback - create a mock user list for testing
      const mockUsers = [
        { id: 7, email: 'dan@littledan.co', display_name: 'Dan Little' },
        { id: 1, email: 'test@example.com', display_name: 'Test User' }
      ];
      setUsers(mockUsers);
      if (mockUsers.length > 0 && !selectedUserId) {
        setSelectedUserId(mockUsers[0].id.toString());
      }
    } finally {
      setLoading(false);
    }
  }, [selectedUserId, showError]);

  const unitToBytes = { MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };

  const loadQuota = useCallback(async () => {
    setQuotaLoading(true);
    try {
      const data = await adminSystemApi.getAttachmentQuota();
      const bytes = data.quota_bytes;
      if (bytes >= 1024 * 1024 * 1024 && bytes % (1024 * 1024 * 1024) === 0) {
        setQuotaBytes(bytes / (1024 * 1024 * 1024));
        setQuotaUnit('GB');
      } else {
        setQuotaBytes(Math.round(bytes / (1024 * 1024)));
        setQuotaUnit('MB');
      }
    } catch {
      // Keep defaults
    } finally {
      setQuotaLoading(false);
    }
  }, []);

  const handleSaveQuota = async () => {
    setQuotaSaving(true);
    try {
      const bytes = quotaBytes * unitToBytes[quotaUnit];
      await adminSystemApi.updateAttachmentQuota(bytes);
      showSuccess('Attachment quota updated');
    } catch (err) {
      showError(err.message);
    } finally {
      setQuotaSaving(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    loadQuota();
  }, [loadQuota]);

  if (loading && users.length === 0) {
    return (
      <div className="text-center p-4">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading users...</span>
        </Spinner>
      </div>
    );
  }

  return (
    <div className="admin-storage-tab">
      {error && (
        <Alert variant="warning" className="mb-3">
          {error} (Using fallback user list)
        </Alert>
      )}

      {/* Attachment Quota Configuration */}
      <Card className="mb-4">
        <Card.Header>
          <h5 className="mb-0">
            <i className="bi bi-hdd me-2"></i>
            Attachment Storage Quota
          </h5>
        </Card.Header>
        <Card.Body>
          <Form.Text className="text-muted d-block mb-3">
            Set the default per-user attachment storage quota. Individual users can have overrides set in User Management.
          </Form.Text>
          {quotaLoading ? (
            <Spinner animation="border" size="sm" />
          ) : (
            <Row className="align-items-end">
              <Col xs={6} sm={4} md={3}>
                <Form.Group>
                  <Form.Label>Default Quota</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type="number"
                      min={1}
                      value={quotaBytes}
                      onChange={(e) => setQuotaBytes(parseInt(e.target.value) || 0)}
                    />
                    <Form.Select
                      value={quotaUnit}
                      onChange={(e) => setQuotaUnit(e.target.value)}
                      style={{ maxWidth: '80px' }}
                    >
                      <option value="MB">MB</option>
                      <option value="GB">GB</option>
                    </Form.Select>
                  </InputGroup>
                </Form.Group>
              </Col>
              <Col xs="auto">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveQuota}
                  disabled={quotaSaving}
                >
                  {quotaSaving ? (
                    <Spinner animation="border" size="sm" className="me-1" />
                  ) : (
                    <i className="bi bi-check-lg me-1"></i>
                  )}
                  Save
                </Button>
              </Col>
            </Row>
          )}
        </Card.Body>
      </Card>

      {/* User Selection */}
      <Card className="user-selection-card mb-4">
        <Card.Header>
          <h5 className="mb-0">
            <i className="bi bi-people me-2"></i>
            User Selection
          </h5>
        </Card.Header>
        <Card.Body>
          <Form.Group className="user-select">
            <Form.Label>Select User to Manage:</Form.Label>
            <Form.Select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">Choose a user...</option>
              {users.map(user => (
                <option key={user.id} value={user.id.toString()}>
                  {user.display_name || user.first_name + ' ' + user.last_name || user.email}
                  ({user.email}) - ID: {user.id}
                </option>
              ))}
            </Form.Select>
            {selectedUserId && (
              <Form.Text className="text-muted">
                Managing storage for User ID: {selectedUserId}
              </Form.Text>
            )}
          </Form.Group>
        </Card.Body>
      </Card>

      {/* Storage Management for Selected User */}
      {selectedUserId && (
        <StorageTab
          userId={parseInt(selectedUserId)}
          isAdmin={true}
        />
      )}

      {!selectedUserId && (
        <Alert variant="info" className="admin-info-alert">
          <i className="bi bi-info-circle me-2"></i>
          Please select a user to view and manage their storage.
        </Alert>
      )}
    </div>
  );
}

export default AdminStorageTab;