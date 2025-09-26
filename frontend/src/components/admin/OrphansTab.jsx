import React, { useState, useEffect, useRef } from "react";
import { Card, Button, Alert, Spinner, Badge, ListGroup } from "react-bootstrap";
import PropTypes from "prop-types";
import { adminGitHubApi } from "../../api/admin";

function OrphansTab() {
  const [orphanedDocs, setOrphanedDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [hasChecked, setHasChecked] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const successTimeoutRef = useRef(null);
  const closeTimeoutRef = useRef(null);

  // Auto-dismiss success alert after 3 seconds
  useEffect(() => {
    if (success && !showSuccess) {
      setShowSuccess(true);
      setIsClosing(false);

      // Clear any existing timeouts
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }

      // Set auto-dismiss timer
      successTimeoutRef.current = setTimeout(() => {
        handleCloseSuccess();
      }, 3000);
    }

    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, [success]);

  const handleCloseSuccess = () => {
    setIsClosing(true);

    // Clear auto-dismiss timer
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
    }

    // Wait for animation to complete, then hide
    closeTimeoutRef.current = setTimeout(() => {
      setSuccess("");
      setShowSuccess(false);
      setIsClosing(false);
    }, 300); // Match CSS transition duration
  };

  const clearAllAlerts = () => {
    setError("");
    setSuccess("");
    setShowSuccess(false);
    setIsClosing(false);

    // Clear any pending timeouts
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
    }
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
  };

  const checkOrphanedDocuments = async () => {
    setLoading(true);
    clearAllAlerts();

    try {
      const data = await adminGitHubApi.getMyOrphanedDocuments();
      setOrphanedDocs(data);
      setHasChecked(true);

      if (data.length === 0) {
        setSuccess("No orphaned GitHub documents found.");
      } else {
        setSuccess(`Found ${data.length} orphaned GitHub documents.`);
      }
    } catch (err) {
      setError(err.message || "Failed to check for orphaned documents.");
    } finally {
      setLoading(false);
    }
  };

  const cleanupOrphanedDocuments = async () => {
    if (orphanedDocs.length === 0) {
      setError("No orphaned documents to clean up.");
      return;
    }

    setLoading(true);
    clearAllAlerts();

    try {
      const data = await adminGitHubApi.cleanupMyOrphanedDocuments();
      setSuccess(data.message);
      setOrphanedDocs([]);
      setHasChecked(false);
    } catch (err) {
      setError(err.message || "Failed to cleanup orphaned documents.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3">
      <Card>
        <Card.Header>
          <h5 className="mb-0">
            <i className="bi bi-shield-fill-check text-danger me-2"></i>
            Orphaned GitHub Documents
          </h5>
        </Card.Header>
        <Card.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          {success && showSuccess && (
            <Alert
              variant="success"
              dismissible
              onClose={handleCloseSuccess}
              className={`alert-auto-dismiss ${isClosing ? 'alert-closing' : ''}`}
              style={{
                transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
                opacity: isClosing ? 0 : 1,
                transform: isClosing ? 'translateY(-10px)' : 'translateY(0)'
              }}
            >
              {success}
            </Alert>
          )}

          <div className="mb-4">
            <p className="text-muted small">
              Find and clean up documents that remain after GitHub accounts have been disconnected.
              These documents may cause import conflicts and should be removed.
            </p>

            <div className="d-flex gap-2 mb-3">
              <Button
                variant="outline-primary"
                size="sm"
                onClick={checkOrphanedDocuments}
                disabled={loading}
              >
                {loading && !hasChecked ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-1" />
                    Checking...
                  </>
                ) : (
                  <>
                    <i className="bi bi-search me-1"></i>
                    Check for Orphaned Documents
                  </>
                )}
              </Button>

              {orphanedDocs.length > 0 && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={cleanupOrphanedDocuments}
                  disabled={loading}
                >
                  {loading && hasChecked ? (
                    <>
                      <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-1" />
                      Cleaning...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-trash me-1"></i>
                      Clean Up ({orphanedDocs.length})
                    </>
                  )}
                </Button>
              )}
            </div>

            {hasChecked && orphanedDocs.length > 0 && (
              <Card className="border-warning">
                <Card.Header className="bg-warning text-dark">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  Found {orphanedDocs.length} Orphaned Document{orphanedDocs.length !== 1 ? 's' : ''}
                </Card.Header>
                <Card.Body>
                  <ListGroup variant="flush">
                    {orphanedDocs.map((doc, index) => (
                      <ListGroup.Item key={doc.id} className="px-0">
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <strong>{doc.name}</strong>
                            <br />
                            <small className="text-muted">
                              <i className="bi bi-folder me-1"></i>
                              {doc.folder_path}
                            </small>
                            {doc.file_path && (
                              <>
                                <br />
                                <small className="text-muted">
                                  <i className="bi bi-file-earmark me-1"></i>
                                  {doc.file_path}
                                </small>
                              </>
                            )}
                            {doc.repo_name && (
                              <>
                                <br />
                                <small className="text-muted">
                                  <i className="bi bi-github me-1"></i>
                                  {doc.repo_owner}/{doc.repo_name}
                                  {doc.github_branch && ` (${doc.github_branch})`}
                                </small>
                              </>
                            )}
                            {doc.orphan_reason && (
                              <>
                                <br />
                                <small className="text-warning">
                                  <i className="bi bi-exclamation-triangle me-1"></i>
                                  {doc.orphan_reason}
                                </small>
                              </>
                            )}
                          </div>
                          <div className="text-end">
                            <Badge bg={doc.orphan_type === 'filesystem_missing' ? 'warning' : 'danger'}>
                              {doc.orphan_type === 'filesystem_missing' ? 'File Missing' : 'GitHub Orphaned'}
                            </Badge>
                            {doc.account_username && (
                              <>
                                <br />
                                <small className="text-muted">
                                  Was: {doc.account_username}
                                </small>
                              </>
                            )}
                          </div>
                        </div>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                  <Alert variant="warning" className="mt-3 mb-0">
                    <small>
                      <i className="bi bi-info-circle me-1"></i>
                      These documents are linked to GitHub repositories from disconnected accounts.
                      Cleaning them up will permanently remove them from your document list.
                    </small>
                  </Alert>
                </Card.Body>
              </Card>
            )}
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}

OrphansTab.propTypes = {};

export default OrphansTab;