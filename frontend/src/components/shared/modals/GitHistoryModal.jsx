import React, { useState, useEffect, useCallback } from "react";
import { Modal, Button, Spinner, Badge, Alert } from "react-bootstrap";
import documentsApi from "@/api/documentsApi";

function GitHistoryModal({ show, onHide, documentId, repositoryType, currentBranch }) {
  const [commits, setCommits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadCommitHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Call the backend API through documentsApi
      const data = await documentsApi.getDocumentGitHistory(documentId, 20);

      // Transform the backend response to match our expected format
      const transformedCommits = data.commits.map((commit, index) => ({
        hash: commit.hash,
        shortHash: commit.short_hash,
        message: commit.message,
        author: commit.author_name,
        email: commit.author_email,
        date: commit.date,
        relativeDate: commit.relative_date,
        isCurrent: index === 0 // Mark the first (latest) commit as current
      }));

      setCommits(transformedCommits);
    } catch (err) {
      setError(`Failed to load commit history: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (show && documentId) {
      loadCommitHistory();
    }
  }, [show, documentId, loadCommitHistory]);

  const handleClose = () => {
    setCommits([]);
    setError(null);
    onHide();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    try {
      return new Date(dateString).toLocaleString();
    } catch (error) {
      return dateString; // Return original if parsing fails
    }
  };

  const formatRelativeTime = (relativeString, dateString) => {
    // If we have a relative time from git, use that
    if (relativeString && relativeString !== dateString) {
      return relativeString;
    }

    // Otherwise calculate relative time from date
    if (!dateString) return 'Unknown time';

    try {
      const now = new Date();
      const date = new Date(dateString);
      const diffMs = now - date;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor(diffMs / (1000 * 60));

      if (diffDays > 0) return `${diffDays} days ago`;
      if (diffHours > 0) return `${diffHours} hours ago`;
      if (diffMinutes > 0) return `${diffMinutes} minutes ago`;
      return 'Just now';
    } catch (error) {
      return 'Unknown time';
    }
  };

  return (
    <Modal
      show={show}
      onHide={handleClose}
      size="lg"
      centered
      backdrop={true}
      keyboard={true}
    >
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-clock-history me-2"></i>
          Git History
          {currentBranch && (
            <Badge bg="primary" className="ms-2">
              {currentBranch}
            </Badge>
          )}
          {repositoryType && (
            <Badge bg="secondary" className="ms-2">
              {repositoryType}
            </Badge>
          )}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        {loading && (
          <div className="text-center py-4">
            <Spinner animation="border" role="status" className="me-2" />
            <span>Loading commit history...</span>
          </div>
        )}

        {error && (
          <Alert variant="danger">
            <i className="bi bi-exclamation-triangle me-2"></i>
            {error}
          </Alert>
        )}

        {!loading && !error && commits.length === 0 && (
          <Alert variant="info">
            <i className="bi bi-info-circle me-2"></i>
            No commit history available for this document.
          </Alert>
        )}

        {!loading && !error && commits.length > 0 && (
          <div>
            <div className="mb-3 text-muted small">
              <i className="bi bi-info-circle me-1"></i>
              Showing {commits.length} recent commits
            </div>

            <div className="git-history-timeline">
              {commits.map((commit, _index) => (
                <div key={commit.hash} className="commit-item border-start border-2 border-primary ps-3 pb-3 position-relative">
                  {/* Timeline dot */}
                  <div
                    className={`position-absolute bg-${commit.isCurrent ? 'success' : 'primary'} rounded-circle`}
                    style={{
                      width: '12px',
                      height: '12px',
                      left: '-7px',
                      top: '8px'
                    }}
                  ></div>

                  <div className="commit-header d-flex align-items-center justify-content-between mb-2">
                    <div className="d-flex align-items-center">
                      <code className="me-2 text-primary">{commit.shortHash}</code>
                      {commit.isCurrent && (
                        <Badge bg="success" className="me-2">
                          <i className="bi bi-check-circle me-1"></i>
                          Current
                        </Badge>
                      )}
                    </div>
                    <small className="text-muted">
                      {formatRelativeTime(commit.relativeDate, commit.date)}
                    </small>
                  </div>

                  <div className="commit-message mb-2">
                    <strong>{commit.message}</strong>
                  </div>

                  <div className="commit-meta small text-muted d-flex align-items-center">
                    <i className="bi bi-person me-1"></i>
                    <span className="me-3">{commit.author}</span>
                    <i className="bi bi-calendar3 me-1"></i>
                    <span>{formatDate(commit.date)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <div className="d-flex justify-content-between w-100">
          <div className="small text-muted">
            <i className="bi bi-info-circle me-1"></i>
            Full git log integration coming soon
          </div>
          <div>
            {!loading && !error && commits.length > 0 && (
              <Button variant="outline-primary" onClick={loadCommitHistory} className="me-2">
                <i className="bi bi-arrow-clockwise me-1"></i>
                Refresh
              </Button>
            )}
            <Button variant="secondary" onClick={handleClose}>
              Close
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
}

export default GitHistoryModal;