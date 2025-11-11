import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Form,
  Alert,
  Spinner,
  Button,
  Badge,
  Modal,
  Row,
  Col,
  Table,
  InputGroup,
  ButtonGroup
} from 'react-bootstrap';
import { useNotification } from '../NotificationProvider';
import adminUsersApi from '../../api/admin/usersApi';

function UserManagementTab() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // all, active, inactive
  const [stats, setStats] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const { showError, showSuccess, showWarning: _showWarning } = useNotification();

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (activeFilter !== 'all') {
        params.active_only = activeFilter === 'active';
      }

      const userData = await adminUsersApi.getAllUsers(params);
      setUsers(userData);
    } catch (err) {
      setError(err.message);
      showError(err.message);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, activeFilter, showError]);

  const loadUserStats = useCallback(async () => {
    try {
      const statsData = await adminUsersApi.getUserStats();
      setStats(statsData);
    } catch (err) {
      console.warn('Failed to load user stats:', err);
    }
  }, []);

  const loadUserDetails = async (user) => {
    if (!user || !user.id) {
      setSelectedUser(null);
      return;
    }

    setDetailsLoading(true);
    try {
      const userDetails = await adminUsersApi.getUserById(user.id);
      setSelectedUser(userDetails);
    } catch (err) {
      showError(err.message);
      setSelectedUser(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const updateUser = async (userId, updates) => {
    try {
      const updatedUser = await adminUsersApi.updateUser(userId, updates);
      setSelectedUser(updatedUser);

      // Update user in list and refresh selected user if it's the same
      setUsers(prevUsers =>
        prevUsers.map(user =>
          user.id === userId ? { ...user, ...updates } : user
        )
      );

      // If this was the selected user, refresh the details
      if (selectedUser && selectedUser.id === userId) {
        await loadUserDetails({ id: userId });
      }

      showSuccess('User updated successfully');
    } catch (err) {
      showError(err.message);
    }
  };

  const resetMFA = async (userId) => {
    try {
      await adminUsersApi.resetUserMFA(userId, 'Admin reset via user management panel');

      // Refresh user details
      if (selectedUser && selectedUser.id === userId) {
        await loadUserDetails({ id: userId });
      }
      showSuccess('MFA reset successfully');
    } catch (err) {
      showError(err.message);
    }
  };

  const deleteUser = async (userId) => {
    try {
      await adminUsersApi.deleteUser(userId);

      // Remove user from list and clear selection if it was selected
      setUsers(prevUsers => prevUsers.filter(user => user.id !== userId));
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser(null);
      }

      showSuccess('User deleted successfully');
    } catch (err) {
      showError(err.message);
    }
  };

  const handleConfirmAction = (action, user) => {
    setConfirmAction({ action, user });
    setShowConfirmModal(true);
  };

  const executeConfirmAction = async () => {
    if (!confirmAction) return;

    const { action, user } = confirmAction;
    setShowConfirmModal(false);

    switch (action) {
      case 'toggleActive':
        await updateUser(user.id, { is_active: !user.is_active });
        break;
      case 'toggleAdmin':
        await updateUser(user.id, { is_admin: !user.is_admin });
        break;
      case 'resetMFA':
        await resetMFA(user.id);
        break;
      case 'deleteUser':
        await deleteUser(user.id);
        break;
      default:
        break;
    }

    setConfirmAction(null);
  };

  const getStatusBadge = (user) => {
    if (!user.is_active) return <Badge bg="danger">Inactive</Badge>;
    if (user.is_admin) return <Badge bg="success">Admin</Badge>;
    return <Badge bg="primary">Active</Badge>;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  useEffect(() => {
    loadUsers();
    loadUserStats();
  }, [searchTerm, activeFilter, loadUsers, loadUserStats]);

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
    <div className="user-management-tab h-100 d-flex flex-column" style={{ minHeight: 0, overflow: 'hidden' }}>
      {error && (
        <Alert variant="danger" className="mb-3">
          {error}
        </Alert>
      )}

      {/* User Statistics */}
      {stats && (
        <Row className="mb-3 flex-shrink-0">
          <Col xs={6} md={3}>
            <Card className="stat-card text-center">
              <Card.Body className="py-2">
                <h6 className="text-primary mb-0">{stats.total_users}</h6>
                <small className="text-muted">Total</small>
              </Card.Body>
            </Card>
          </Col>
          <Col xs={6} md={3}>
            <Card className="stat-card text-center">
              <Card.Body className="py-2">
                <h6 className="text-success mb-0">{stats.active_users}</h6>
                <small className="text-muted">Active</small>
              </Card.Body>
            </Card>
          </Col>
          <Col xs={6} md={3}>
            <Card className="stat-card text-center">
              <Card.Body className="py-2">
                <h6 className="text-warning mb-0">{stats.admin_users}</h6>
                <small className="text-muted">Admins</small>
              </Card.Body>
            </Card>
          </Col>
          <Col xs={6} md={3}>
            <Card className="stat-card text-center">
              <Card.Body className="py-2">
                <h6 className="text-info mb-0">{stats.mfa_enabled_users}</h6>
                <small className="text-muted">MFA</small>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Search and Filters */}
      <Card className="mb-3 flex-shrink-0">
        <Card.Body className="py-2">
          <Row className="align-items-center">
            <Col md={8}>
              <InputGroup size="sm">
                <Form.Control
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Button
                  variant="outline-secondary"
                  onClick={() => setSearchTerm('')}
                  disabled={!searchTerm}
                >
                  <i className="bi bi-x"></i>
                </Button>
              </InputGroup>
            </Col>
            <Col md={4}>
              <ButtonGroup size="sm" className="w-100">
                <Button
                  variant={activeFilter === 'all' ? 'primary' : 'outline-primary'}
                  onClick={() => setActiveFilter('all')}
                >
                  All
                </Button>
                <Button
                  variant={activeFilter === 'active' ? 'success' : 'outline-success'}
                  onClick={() => setActiveFilter('active')}
                >
                  Active
                </Button>
                <Button
                  variant={activeFilter === 'inactive' ? 'danger' : 'outline-danger'}
                  onClick={() => setActiveFilter('inactive')}
                >
                  Inactive
                </Button>
              </ButtonGroup>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Main Content Row - This will expand to fill remaining space */}
      <Row className="flex-fill" style={{ minHeight: 0, overflow: 'hidden' }}>
        {/* User List */}
        <Col lg={6} className="d-flex flex-column" style={{ height: '100%', minHeight: 0 }}>
          <Card className="h-100 d-flex flex-column">
            <Card.Header>
              <h5 className="mb-0">
                <i className="bi bi-people me-2"></i>
                Users ({users.length})
              </h5>
            </Card.Header>
            <Card.Body className="p-0 flex-fill d-flex flex-column" style={{ minHeight: 0 }}>
              <div className="flex-fill scrollable-list" style={{ minHeight: 0 }}>
                <Table hover className="mb-0">
                  <tbody>
                    {users.map(user => (
                      <tr
                        key={user.id}
                        className={selectedUser?.id === user.id ? 'table-active' : ''}
                        style={{ cursor: 'pointer' }}
                        onClick={() => loadUserDetails(user)}
                      >
                        <td className="py-3">
                          <div className="d-flex align-items-start">
                            <div className="flex-grow-1">
                              <div className="fw-bold mb-1">
                                {user.display_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email}
                              </div>
                              <div className="text-muted mb-2" style={{ fontSize: '0.9em' }}>
                                {user.email}
                              </div>
                              <div className="text-muted" style={{ fontSize: '0.85em' }}>
                                <i className="bi bi-file-text me-1"></i>
                                {user.document_count} documents
                                {user.github_account_count > 0 && (
                                  <>
                                    <span className="mx-2">•</span>
                                    <i className="bi bi-github me-1"></i>
                                    {user.github_account_count} GitHub account{user.github_account_count > 1 ? 's' : ''}
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="ms-3">
                              <div className="d-flex flex-column align-items-end gap-1">
                                {getStatusBadge(user)}
                                {user.mfa_enabled && (
                                  <Badge bg="info" size="sm">
                                    <i className="bi bi-shield-check me-1"></i>
                                    MFA
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* User Details */}
        <Col lg={6} className="d-flex flex-column" style={{ height: '100%', minHeight: 0 }}>
          {!selectedUser && (
            <Alert variant="info" className="text-center">
              <i className="bi bi-info-circle me-2"></i>
              Select a user from the list to view details and manage their account.
            </Alert>
          )}

          {detailsLoading && (
            <div className="text-center p-4">
              <Spinner animation="border" size="sm" role="status">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
            </div>
          )}

          {selectedUser && (
            <Card className="h-100 d-flex flex-column">
              <Card.Header>
                <Row className="align-items-center">
                  <Col>
                    <h5 className="mb-0">User Details</h5>
                  </Col>
                  <Col xs="auto">
                    {getStatusBadge(selectedUser)}
                  </Col>
                </Row>
              </Card.Header>
              <Card.Body className="flex-fill scrollable-list" style={{ minHeight: 0 }}>
                {/* User Information */}
                <div className="mb-4">
                  <h6 className="text-muted mb-3">Profile Information</h6>
                  <Row className="mb-2">
                    <Col sm={4}><strong>Full Name:</strong></Col>
                    <Col sm={8}>{selectedUser.full_name}</Col>
                  </Row>
                  <Row className="mb-2">
                    <Col sm={4}><strong>Email:</strong></Col>
                    <Col sm={8}>{selectedUser.email}</Col>
                  </Row>
                  <Row className="mb-2">
                    <Col sm={4}><strong>User ID:</strong></Col>
                    <Col sm={8}>{selectedUser.id}</Col>
                  </Row>
                  <Row className="mb-2">
                    <Col sm={4}><strong>Created:</strong></Col>
                    <Col sm={8}>{formatDate(selectedUser.created_at)}</Col>
                  </Row>
                  <Row className="mb-2">
                    <Col sm={4}><strong>Last Updated:</strong></Col>
                    <Col sm={8}>{formatDate(selectedUser.updated_at)}</Col>
                  </Row>
                </div>

                {/* Account Statistics */}
                <div className="mb-4">
                  <h6 className="text-muted mb-3">Account Statistics</h6>
                  <Row className="mb-2">
                    <Col sm={4}><strong>Documents:</strong></Col>
                    <Col sm={8}>{selectedUser.document_count}</Col>
                  </Row>
                  <Row className="mb-2">
                    <Col sm={4}><strong>GitHub Accounts:</strong></Col>
                    <Col sm={8}>{selectedUser.github_account_count}</Col>
                  </Row>
                </div>

                {/* Status Flags */}
                <div className="mb-4">
                  <h6 className="text-muted mb-3">Status & Permissions</h6>
                  <div className="d-flex flex-wrap gap-2 mb-3">
                    <Badge bg={selectedUser.is_active ? 'success' : 'danger'} className="px-3 py-2">
                      <i className={`bi bi-${selectedUser.is_active ? 'check-circle' : 'x-circle'} me-2`}></i>
                      {selectedUser.is_active ? 'Active Account' : 'Inactive Account'}
                    </Badge>
                    <Badge bg={selectedUser.is_admin ? 'primary' : 'secondary'} className="px-3 py-2">
                      <i className={`bi bi-${selectedUser.is_admin ? 'shield-check' : 'person'} me-2`}></i>
                      {selectedUser.is_admin ? 'Administrator' : 'Regular User'}
                    </Badge>
                    <Badge bg={selectedUser.mfa_enabled ? 'info' : 'warning'} className="px-3 py-2">
                      <i className={`bi bi-${selectedUser.mfa_enabled ? 'shield-lock' : 'shield'} me-2`}></i>
                      {selectedUser.mfa_enabled ? 'MFA Enabled' : 'MFA Disabled'}
                    </Badge>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mb-3">
                  <h6 className="text-muted mb-3">Account Actions</h6>
                  <div className="d-flex flex-wrap gap-2">
                    <Button
                      variant={selectedUser.is_active ? 'outline-danger' : 'outline-success'}
                      onClick={() => handleConfirmAction('toggleActive', selectedUser)}
                    >
                      <i className={`bi bi-${selectedUser.is_active ? 'pause-circle' : 'play-circle'} me-2`}></i>
                      {selectedUser.is_active ? 'Deactivate Account' : 'Activate Account'}
                    </Button>

                    <Button
                      variant={selectedUser.is_admin ? 'outline-warning' : 'outline-primary'}
                      onClick={() => handleConfirmAction('toggleAdmin', selectedUser)}
                    >
                      <i className={`bi bi-${selectedUser.is_admin ? 'shield-slash' : 'shield-check'} me-2`}></i>
                      {selectedUser.is_admin ? 'Remove Admin Rights' : 'Grant Admin Rights'}
                    </Button>

                    {selectedUser.mfa_enabled && (
                      <Button
                        variant="outline-warning"
                        onClick={() => handleConfirmAction('resetMFA', selectedUser)}
                      >
                        <i className="bi bi-shield-x me-2"></i>
                        Reset MFA
                      </Button>
                    )}

                    {!selectedUser.is_active && (
                      <Button
                        variant="outline-danger"
                        onClick={() => handleConfirmAction('deleteUser', selectedUser)}
                      >
                        <i className="bi bi-trash me-2"></i>
                        Delete Account
                      </Button>
                    )}
                  </div>
                </div>

                {selectedUser.reset_token_expires && (
                  <Alert variant="info" className="mt-3">
                    <i className="bi bi-info-circle me-2"></i>
                    Password reset token expires: {formatDate(selectedUser.reset_token_expires)}
                  </Alert>
                )}
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>

      {/* Confirmation Modal */}
      <Modal show={showConfirmModal} onHide={() => setShowConfirmModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Action</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {confirmAction && (
            <div>
              <p>Are you sure you want to perform this action?</p>
              <div className="bg-light p-3 rounded">
                <strong>User:</strong> {confirmAction.user?.full_name} ({confirmAction.user?.email})<br />
                <strong>Action:</strong> {
                  confirmAction.action === 'toggleActive'
                    ? (confirmAction.user?.is_active ? 'Disable user account' : 'Enable user account')
                    : confirmAction.action === 'toggleAdmin'
                    ? (confirmAction.user?.is_admin ? 'Remove admin privileges' : 'Grant admin privileges')
                    : confirmAction.action === 'resetMFA'
                    ? 'Reset MFA settings (disable MFA and remove backup codes)'
                    : confirmAction.action === 'deleteUser'
                    ? 'Permanently delete user account and all associated data'
                    : confirmAction.action
                }
              </div>
              {confirmAction.action === 'deleteUser' && (
                <Alert variant="danger" className="mt-3 mb-0">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  <strong>Warning:</strong> This action cannot be undone. All user data will be permanently deleted.
                </Alert>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>
            Cancel
          </Button>
          <Button
            variant={confirmAction?.action === 'deleteUser' ? 'danger' : 'primary'}
            onClick={executeConfirmAction}
          >
            Confirm
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default UserManagementTab;