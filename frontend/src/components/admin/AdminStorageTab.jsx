import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Alert, Spinner } from 'react-bootstrap';
import StorageTab from '../storage/StorageTab';
import { useNotification } from '../NotificationProvider';
import adminGitHubApi from '../../api/admin/githubApi';

function AdminStorageTab() {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { showError } = useNotification();

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

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

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