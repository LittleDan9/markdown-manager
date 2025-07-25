import React, { useState, useEffect } from 'react';
import { Modal, Button, ProgressBar, Spinner, Alert } from 'react-bootstrap';

/**
 * Modal component that shows sync progress during logout
 * Allows user to force logout or wait for sync completion
 */
const LogoutProgressModal = ({ show, onForceLogout, onCanceled }) => {
  const [syncStatus, setSyncStatus] = useState({
    pending: 0,
    isProcessing: false,
    hasItems: false
  });
  const [forcingLogout, setForcingLogout] = useState(false);

  useEffect(() => {
    if (!show) return;

    const handleSyncProgress = (event) => {
      const status = event.detail;
      setSyncStatus(status);

      // Auto-logout when queue is empty and not processing
      if (!status.hasItems && !status.isProcessing && !forcingLogout) {
        console.log('Sync complete, auto-logging out');
        onForceLogout();
      }
    };

    const handleSyncStopped = () => {
      console.log('Sync force stopped, proceeding with logout');
      onForceLogout();
    };

    // Listen for sync progress events
    window.addEventListener('markdown-manager:sync-progress', handleSyncProgress);
    window.addEventListener('markdown-manager:sync-force-stopped', handleSyncStopped);

    return () => {
      window.removeEventListener('markdown-manager:sync-progress', handleSyncProgress);
      window.removeEventListener('markdown-manager:sync-force-stopped', handleSyncStopped);
    };
  }, [show, onForceLogout, forcingLogout]);

  const handleForceLogout = () => {
    setForcingLogout(true);
    // Trigger force stop through the document manager
    window.dispatchEvent(new CustomEvent('markdown-manager:force-logout'));
    onForceLogout();
  };

  const handleCancel = () => {
    // Cancel logout but keep sync running
    onCanceled();
  };

  const getProgressPercentage = () => {
    if (!syncStatus.hasItems && !syncStatus.isProcessing) return 100;
    if (syncStatus.pending === 0) return 100;

    // This is a bit tricky since we don't track "total" items
    // We'll show indeterminate progress while processing
    return syncStatus.isProcessing ? null : 0;
  };

  const progressPercentage = getProgressPercentage();

  return (
    <Modal
      show={show}
      backdrop="static"
      keyboard={false}
      centered
      size="md"
    >
      <Modal.Header>
        <Modal.Title className="d-flex align-items-center">
          <i className="bi bi-box-arrow-right me-2"></i>
          Logging Out...
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <div className="mb-3">
          <p className="mb-2">
            Your documents are still syncing with the server. You can:
          </p>

          <Alert variant="info" className="py-2">
            <small>
              <strong>Pending Operations:</strong> {syncStatus.pending} documents
              {syncStatus.isProcessing && <span> (processing...)</span>}
            </small>
          </Alert>
        </div>

        <div className="mb-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <small className="text-muted">Sync Progress</small>
            {syncStatus.isProcessing && (
              <small className="text-primary d-flex align-items-center">
                <Spinner animation="border" size="sm" className="me-1" />
                Processing...
              </small>
            )}
          </div>

          <ProgressBar
            animated={syncStatus.isProcessing}
            variant={progressPercentage === 100 ? "success" : "primary"}
            now={progressPercentage || 0}
            style={{
              height: '8px',
              ...(progressPercentage === null && {
                background: 'linear-gradient(90deg, #007bff 0%, #007bff 50%, transparent 50%, transparent 100%)',
                backgroundSize: '20px 100%',
                animation: 'indeterminate 1s linear infinite'
              })
            }}
          />
        </div>

        <div className="text-muted">
          <small>
            • <strong>Wait for completion:</strong> All changes will be saved safely
            <br />
            • <strong>Force logout:</strong> Unsaved changes may be lost
          </small>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button
          variant="outline-secondary"
          onClick={handleCancel}
          disabled={forcingLogout}
        >
          Cancel Logout
        </Button>

        <Button
          variant="danger"
          onClick={handleForceLogout}
          disabled={forcingLogout}
          className="d-flex align-items-center"
        >
          {forcingLogout ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              Forcing Logout...
            </>
          ) : (
            <>
              <i className="bi bi-stop-fill me-2"></i>
              Force Logout
            </>
          )}
        </Button>
      </Modal.Footer>

      <style jsx>{`
        @keyframes indeterminate {
          0% {
            background-position: -200px 0;
          }
          100% {
            background-position: calc(200px + 100%) 0;
          }
        }
      `}</style>
    </Modal>
  );
};

export default LogoutProgressModal;
