import React, { useState } from "react";
import { Modal, Button, Alert, Spinner, Form } from "react-bootstrap";
import gitHubApi from "../../api/gitHubApi";
import { useNotification } from "../NotificationProvider";

export default function GitHubPullModal({
  show,
  onHide,
  document,
  conflictData = null,
  onPullSuccess,
  onConflictDetected
}) {
  const [pulling, setPulling] = useState(false);
  const [forceOverwrite, setForceOverwrite] = useState(false);
  const { showSuccess, showError } = useNotification();

  const handlePull = async () => {
    setPulling(true);
    try {
      const result = await gitHubApi.pullChanges(document.id, {
        force_overwrite: forceOverwrite
      });

      if (result.success) {
        showSuccess(result.message);
        onPullSuccess?.(result);
        onHide();
      } else if (result.had_conflicts) {
        // Handle conflicts
        onConflictDetected?.(result.conflict_data);
      }
    } catch (error) {
      console.error("Failed to pull changes:", error);
      showError("Failed to pull changes from GitHub");
    } finally {
      setPulling(false);
    }
  };

  if (!document) return null;

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Pull Updates from GitHub</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Alert variant="info">
          <div className="d-flex align-items-center">
            <i className="bi bi-cloud-download me-2"></i>
            <div>
              <strong>Pull remote changes for:</strong> "{document.name}"<br />
              <small>
                Repository: {document.github_repository?.full_name}<br />
                Branch: {document.github_branch}
              </small>
            </div>
          </div>
        </Alert>

        {conflictData && (
          <Alert variant="warning">
            <h6><i className="bi bi-exclamation-triangle me-2"></i>Conflicts Detected</h6>
            <p>
              Both local and remote versions have changes. You can:
            </p>
            <ul>
              <li>Cancel and manually resolve conflicts</li>
              <li>Force overwrite local changes (creates backup)</li>
              <li>Let the system attempt to merge automatically</li>
            </ul>
          </Alert>
        )}

        {document.github_sync_status === "local_changes" && (
          <Form.Group className="mb-3">
            <Form.Check
              type="checkbox"
              id="force-overwrite"
              label="Force overwrite local changes (backup will be created)"
              checked={forceOverwrite}
              onChange={(e) => setForceOverwrite(e.target.checked)}
            />
            <Form.Text className="text-muted">
              Warning: This will replace your local changes with the remote version.
              A backup copy will be created in your documents.
            </Form.Text>
          </Form.Group>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={pulling}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handlePull}
          disabled={pulling}
        >
          {pulling ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              Pulling Changes...
            </>
          ) : (
            <>
              <i className="bi bi-cloud-download me-2"></i>
              Pull Changes
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
