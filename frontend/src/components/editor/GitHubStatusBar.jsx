import React, { useState, useEffect } from 'react';
import {
  Button,
  Badge,
  Modal,
  Form,
  Alert,
  Spinner,
  OverlayTrigger,
  Tooltip,
  ButtonGroup
} from 'react-bootstrap';
import { useNotification } from '../NotificationProvider';
import { useAuth } from '../../providers/AuthProvider';
import gitHubApi from '../../api/gitHubApi';

const GitHubStatusBar = ({ documentId, onStatusChange }) => {
  // Always call ALL hooks - never do conditional returns
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [commitModalVisible, setCommitModalVisible] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [syncHistory, setSyncHistory] = useState([]);

  const { showSuccess, showError, showInfo } = useNotification();

  useEffect(() => {
    if (documentId && isAuthenticated) {
      checkStatus();
    }
  }, [documentId, isAuthenticated]);

  const checkStatus = async () => {
    if (!documentId) return;

    try {
      setLoading(true);
      const statusData = await gitHubApi.getDocumentStatus(documentId);
      setStatus(statusData);
      onStatusChange?.(statusData);
    } catch (error) {
      console.error('Failed to check GitHub status:', error);
      showError('Failed to check GitHub status');
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      showError('Commit message is required');
      return;
    }

    try {
      setLoading(true);
      await gitHubApi.commitDocument(documentId, {
        commit_message: commitMessage,
        force_commit: false
      });

      showSuccess('Changes committed successfully to GitHub');
      setCommitModalVisible(false);
      setCommitMessage('');
      await checkStatus(); // Refresh status
    } catch (error) {
      console.error('Failed to commit:', error);

      if (error.response?.status === 409) {
        showError('Conflicts detected. Please resolve conflicts first.');
      } else {
        showError('Failed to commit changes to GitHub');
      }
    } finally {
      setLoading(false);
    }
  };

  const showSyncHistory = async () => {
    try {
      setLoading(true);
      const history = await gitHubApi.getDocumentSyncHistory(documentId);
      setSyncHistory(history);
      setHistoryModalVisible(true);
    } catch (error) {
      console.error('Failed to load sync history:', error);
      showError('Failed to load sync history');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = () => {
    if (!status || !status.is_github_document) {
      return <i className="bi bi-github" style={{ color: '#6c757d' }}></i>;
    }

    const { status_info } = status;

    switch (status_info.type) {
      case 'synced':
        return <span style={{ color: '#198754' }}>🟢</span>;
      case 'draft':
        return <span style={{ color: '#0d6efd' }}>🔵</span>;
      case 'behind':
        return <span style={{ color: '#fd7e14' }}>🟡</span>;
      case 'conflict':
        return <span style={{ color: '#dc3545' }}>🔴</span>;
      default:
        return <span style={{ color: '#6c757d' }}>⚪</span>;
    }
  };

  const getStatusBadge = () => {
    if (!status || !status.is_github_document) {
      return <Badge bg="secondary">Local</Badge>;
    }

    const { status_info } = status;
    const badgeColor = status_info.color === '#52c41a' ? 'success' :
                      status_info.color === '#1890ff' ? 'primary' :
                      status_info.color === '#fa8c16' ? 'warning' :
                      status_info.color === '#ff4d4f' ? 'danger' : 'secondary';

    return (
      <Badge bg={badgeColor}>
        {status_info.message}
      </Badge>
    );
  };

  const canCommit = status?.has_local_changes && status?.sync_status !== 'conflict';
  const canPull = status?.has_remote_changes && status?.sync_status !== 'conflict';
  const hasConflict = status?.sync_status === 'conflict';

  // Simple conditional render - no early returns
  if (!isAuthenticated) {
    return null;
  }

  if (!status) {
    return (
      <div
        className="github-status-bar"
        style={{
          padding: '8px 16px'
        }}
      >
        <div className="d-flex align-items-center gap-2">
          {loading ? (
            <Spinner animation="border" size="sm" />
          ) : (
            <i className="bi bi-github"></i>
          )}
          <span>Checking GitHub status...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="github-status-bar"
        style={{
          padding: '8px 16px'
        }}
      >
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            {getStatusIcon()}
            {getStatusBadge()}
            {status.is_github_document && (
              <small className="text-muted">
                {status.github_repository}/{status.github_branch}
              </small>
            )}
          </div>

          {status.is_github_document && (
            <ButtonGroup size="sm">
              {canCommit && (
                <OverlayTrigger
                  placement="top"
                  overlay={<Tooltip>Commit local changes to GitHub</Tooltip>}
                >
                  <Button
                    variant="primary"
                    onClick={() => setCommitModalVisible(true)}
                    disabled={loading}
                  >
                    <i className="bi bi-cloud-upload me-1"></i>
                    Commit
                  </Button>
                </OverlayTrigger>
              )}

              {canPull && (
                <OverlayTrigger
                  placement="top"
                  overlay={<Tooltip>Pull remote changes from GitHub</Tooltip>}
                >
                  <Button
                    variant="outline-primary"
                    onClick={() => showInfo('Pull functionality coming soon')}
                    disabled={loading}
                  >
                    <i className="bi bi-cloud-download me-1"></i>
                    Pull
                  </Button>
                </OverlayTrigger>
              )}

              {hasConflict && (
                <OverlayTrigger
                  placement="top"
                  overlay={<Tooltip>Resolve conflicts</Tooltip>}
                >
                  <Button
                    variant="danger"
                    onClick={() => showInfo('Conflict resolution coming soon')}
                  >
                    <i className="bi bi-exclamation-triangle me-1"></i>
                    Resolve
                  </Button>
                </OverlayTrigger>
              )}

              <OverlayTrigger
                placement="top"
                overlay={<Tooltip>View sync history</Tooltip>}
              >
                <Button
                  variant="outline-secondary"
                  onClick={showSyncHistory}
                  disabled={loading}
                >
                  <i className="bi bi-clock-history"></i>
                </Button>
              </OverlayTrigger>

              <OverlayTrigger
                placement="top"
                overlay={<Tooltip>Refresh status</Tooltip>}
              >
                <Button
                  variant="outline-secondary"
                  onClick={checkStatus}
                  disabled={loading}
                >
                  {loading ? (
                    <Spinner animation="border" size="sm" />
                  ) : (
                    <i className="bi bi-arrow-clockwise"></i>
                  )}
                </Button>
              </OverlayTrigger>
            </ButtonGroup>
          )}
        </div>
      </div>

      {/* Commit Modal */}
      <Modal
        show={commitModalVisible}
        onHide={() => {
          setCommitModalVisible(false);
          setCommitMessage('');
        }}
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-github me-2"></i>
            Commit to GitHub
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            <strong>Repository:</strong> {status?.github_repository}<br />
            <strong>Branch:</strong> {status?.github_branch}<br />
            <strong>File:</strong> {status?.github_file_path}
          </div>

          <Form.Group>
            <Form.Label>Commit Message</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="Enter commit message..."
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              maxLength={1000}
            />
            <Form.Text className="text-muted">
              {commitMessage.length}/1000 characters
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setCommitModalVisible(false);
              setCommitMessage('');
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCommit}
            disabled={loading || !commitMessage.trim()}
          >
            {loading ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Committing...
              </>
            ) : (
              <>
                <i className="bi bi-cloud-upload me-2"></i>
                Commit
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Sync History Modal */}
      <Modal
        show={historyModalVisible}
        onHide={() => setHistoryModalVisible(false)}
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-clock-history me-2"></i>
            Sync History
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {syncHistory.length === 0 ? (
            <Alert variant="info">
              <Alert.Heading>No sync history found</Alert.Heading>
              <p>This document has no GitHub sync operations recorded.</p>
            </Alert>
          ) : (
            <div>
              {syncHistory.map((entry, index) => (
                <div
                  key={entry.id}
                  className={`p-3 ${index < syncHistory.length - 1 ? 'border-bottom' : ''}`}
                >
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <Badge bg={entry.status === 'success' ? 'success' : 'danger'}>
                      {entry.operation}
                    </Badge>
                    <small className="text-muted">
                      {new Date(entry.created_at).toLocaleString()}
                    </small>
                    <i className="bi bi-git"></i>
                    <span>{entry.branch_name}</span>
                  </div>

                  {entry.message && (
                    <div className="mb-2">
                      <strong>Message:</strong> {entry.message}
                    </div>
                  )}

                  {entry.commit_sha && (
                    <div className="mb-2">
                      <small className="text-muted font-monospace">
                        <strong>Commit:</strong> {entry.commit_sha.substring(0, 8)}
                      </small>
                    </div>
                  )}

                  {entry.error_details && (
                    <Alert variant="danger" className="mt-2">
                      <Alert.Heading as="h6">Error Details</Alert.Heading>
                      <p className="mb-0">{entry.error_details}</p>
                    </Alert>
                  )}
                </div>
              ))}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setHistoryModalVisible(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default GitHubStatusBar;
