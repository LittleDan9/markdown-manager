import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Alert, Badge, Table, Modal } from "react-bootstrap";
import gitHubApi from "../../../api/gitHubApi";
import { useNotification } from "../../NotificationProvider";
import { useGitHubAccounts } from '../../../hooks/github/useGitHubAccounts';

export default function GitHubSyncPanel({ isActive = false }) {
  const [_cacheStats, setCacheStats] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showForceSync, setShowForceSync] = useState(false);
  const { showSuccess, showError } = useNotification();
  const { accounts, loading: accountsLoading } = useGitHubAccounts();

  const loadStats = useCallback(async (currentAccounts = accounts) => {
    if (currentAccounts.length === 0) {
      setSyncStatus(null);
      return; // Don't load stats if no accounts
    }

    try {
      const [cache, sync] = await Promise.all([
        gitHubApi.getCacheStats(),
        gitHubApi.getSyncStatus()
      ]);
      setCacheStats(cache);
      setSyncStatus(sync);
    } catch (error) {
      console.error("Failed to load stats:", error);
      // Don't set error state here to avoid modal issues
      setSyncStatus(null);
    }
  }, [accounts]); // Include accounts in dependencies

  useEffect(() => {
    // Only load stats if user has GitHub accounts and tab is active
    if (!accountsLoading && accounts.length > 0 && isActive) {
      loadStats(accounts);
      const interval = setInterval(() => loadStats(accounts), 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    } else if (!accountsLoading && accounts.length === 0) {
      // Clear sync status if no accounts
      setSyncStatus(null);
    }
  }, [accountsLoading, accounts, isActive, loadStats]); // Include accounts in dependencies

  const _handleClearCache = async () => {
    if (accounts.length === 0) {
      showError("No GitHub accounts connected");
      return;
    }

    setLoading(true);
    try {
      await gitHubApi.clearCache();
      showSuccess("Cache cleared successfully");
      await loadStats(accounts);
    } catch (error) {
      showError("Failed to clear cache");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSync = async () => {
    if (accounts.length === 0) {
      showError("No GitHub accounts connected");
      return;
    }

    setLoading(true);
    try {
      if (syncStatus?.running) {
        await gitHubApi.stopBackgroundSync();
        showSuccess("Background sync stopped");
      } else {
        await gitHubApi.startBackgroundSync();
        showSuccess("Background sync started");
      }
      await loadStats(accounts);
    } catch (error) {
      showError(`Failed to ${syncStatus?.running ? 'stop' : 'start'} sync`);
    } finally {
      setLoading(false);
    }
  };

  const handleForceSync = async () => {
    if (accounts.length === 0) {
      showError("No GitHub accounts connected");
      return;
    }

    setLoading(true);
    try {
      const result = await gitHubApi.forceSyncAll();
      showSuccess(`Force sync completed: ${result.stats?.checked || 0} documents checked`);
      setShowForceSync(false);
      await loadStats(accounts);
    } catch (error) {
      showError("Failed to force sync");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className="mb-3">
        <Card.Header className="d-flex align-items-center">
          <i className="bi bi-github me-2"></i>
          Background Sync
        </Card.Header>
        <Card.Body>
          {syncStatus ? (
            <Table size="sm">
              <tbody>
                <tr>
                  <td>
                    <i className="bi bi-hourglass-split me-2"></i>
                    <strong>Status</strong>
                  </td>
                  <td>
                    <Badge bg={syncStatus.running ? "success" : "secondary"}>
                      {syncStatus.running ? "Running" : "Stopped"}
                    </Badge>
                  </td>
                </tr>
                <tr>
                  <td>
                    <i className="bi bi-arrow-repeat me-2"></i>
                    Last Sync
                  </td>
                  <td>
                    <Badge bg="secondary">
                      {syncStatus.last_sync || 'Never'}
                    </Badge>
                  </td>
                </tr>
                <tr>
                  <td>
                    <i className="bi bi-play-circle me-2"></i>
                    Task Running
                  </td>
                  <td>
                    <Badge bg={syncStatus.task_running ? "primary" : "secondary"}>
                      {syncStatus.task_running ? "Active" : "Idle"}
                    </Badge>
                  </td>
                </tr>
                <tr>
                  <td>
                    <i className="bi bi-clock me-2"></i>
                    Sync Interval
                  </td>
                  <td><Badge bg="info">{syncStatus.sync_interval}s</Badge></td>
                </tr>
                <tr>
                  <td>
                    <i className="bi bi-file-earmark-text me-2"></i>
                    Max Documents
                  </td>
                  <td><Badge bg="info">{syncStatus.max_documents_per_run}</Badge></td>
                </tr>
              </tbody>
            </Table>
          ) : (
            <Alert variant="info">Loading sync status...</Alert>
          )}

          <div className="d-flex gap-2 mt-3">
            <Button
              variant={syncStatus?.running ? "outline-danger" : "outline-success"}
              size="sm"
              onClick={handleToggleSync}
              disabled={loading}
            >
              {syncStatus?.running ? (
                <>
                  <i className="bi bi-stop-fill me-1"></i>
                  Stop Sync
                </>
              ) : (
                <>
                  <i className="bi bi-play-fill me-1"></i>
                  Start Sync
                </>
              )}
            </Button>
            <Button
              variant="outline-warning"
              size="sm"
              onClick={() => setShowForceSync(true)}
              disabled={loading}
            >
              <i className="bi bi-arrow-clockwise me-1"></i>
              Force Sync All
            </Button>
          </div>

          <Alert variant="light" className="mt-3 mb-0">
            <small>
              <strong>Background Sync:</strong> Automatically checks GitHub documents for remote changes at regular intervals.
            </small>
          </Alert>
        </Card.Body>
      </Card>

      {/* Force Sync Confirmation Modal */}
      <Modal show={showForceSync} onHide={() => setShowForceSync(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Force Sync All Documents</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="warning">
            This will immediately check all GitHub documents for remote changes.
            This may take some time and consume GitHub API rate limits.
          </Alert>
          <p>Are you sure you want to proceed?</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowForceSync(false)}>
            Cancel
          </Button>
          <Button variant="warning" onClick={handleForceSync} disabled={loading}>
            Force Sync All
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
