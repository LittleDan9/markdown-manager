import React, { useState, useEffect } from "react";
import { Modal, Button, Alert, Tabs, Tab, Form, Spinner } from "react-bootstrap";
import gitHubApi from "../../api/gitHubApi";
import { useNotification } from "../NotificationProvider";

export default function GitHubConflictModal({
  show,
  onHide,
  document,
  conflictData,
  onResolutionSuccess
}) {
  const [activeTab, setActiveTab] = useState("merged");
  const [resolvedContent, setResolvedContent] = useState("");
  const [resolving, setResolving] = useState(false);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    if (conflictData?.merged_content_with_markers) {
      setResolvedContent(conflictData.merged_content_with_markers);
    }
  }, [conflictData]);

  const handleResolve = async () => {
    if (!resolvedContent.trim()) {
      showError("Please provide resolved content");
      return;
    }

    setResolving(true);
    try {
      const result = await gitHubApi.resolveConflicts(document.id, {
        resolved_content: resolvedContent
      });

      if (result.success) {
        showSuccess("Conflicts resolved successfully");
        onResolutionSuccess?.(result);
        onHide();
      }
    } catch (error) {
      console.error("Failed to resolve conflicts:", error);
      showError("Failed to resolve conflicts");
    } finally {
      setResolving(false);
    }
  };

  const useVersion = (content) => {
    setResolvedContent(content);
    setActiveTab("merged");
  };

  if (!conflictData) return null;

  return (
    <Modal show={show} onHide={onHide} size="xl">
      <Modal.Header closeButton>
        <Modal.Title>Resolve Merge Conflicts</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Alert variant="warning">
          <h6><i className="bi bi-exclamation-triangle me-2"></i>Merge Conflicts Detected</h6>
          <p>
            Both local and remote versions have changes to the same content areas.
            Please resolve the conflicts by editing the merged version or choosing a complete version.
          </p>
        </Alert>

        <Tabs activeKey={activeTab} onSelect={setActiveTab} className="mb-3">
          <Tab eventKey="merged" title="Merged (Resolve Here)">
            <div className="mb-3">
              <p className="text-muted">
                Edit this content to resolve conflicts. Look for conflict markers:
                <code> &lt;&lt;&lt;&lt;&lt;&lt;&lt; LOCAL</code>,
                <code> =======</code>, and
                <code> &gt;&gt;&gt;&gt;&gt;&gt;&gt; REMOTE</code>
              </p>
              <Form.Control
                as="textarea"
                rows={20}
                value={resolvedContent}
                onChange={(e) => setResolvedContent(e.target.value)}
                className="font-monospace"
                style={{ fontSize: "0.9rem" }}
              />
            </div>
          </Tab>

          <Tab eventKey="local" title="Local Version">
            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <p className="text-muted mb-0">Your local changes:</p>
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => useVersion(conflictData.local_content)}
                >
                  Use This Version
                </Button>
              </div>
              <Form.Control
                as="textarea"
                rows={18}
                value={conflictData.local_content}
                readOnly
                className="font-monospace bg-light"
                style={{ fontSize: "0.9rem" }}
              />
            </div>
          </Tab>

          <Tab eventKey="remote" title="Remote Version">
            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <p className="text-muted mb-0">Remote changes from GitHub:</p>
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => useVersion(conflictData.remote_content)}
                >
                  Use This Version
                </Button>
              </div>
              <Form.Control
                as="textarea"
                rows={18}
                value={conflictData.remote_content}
                readOnly
                className="font-monospace bg-light"
                style={{ fontSize: "0.9rem" }}
              />
            </div>
          </Tab>

          {conflictData.original_content && (
            <Tab eventKey="original" title="Original Version">
              <div className="mb-3">
                <p className="text-muted">Original version before changes:</p>
                <Form.Control
                  as="textarea"
                  rows={18}
                  value={conflictData.original_content}
                  readOnly
                  className="font-monospace bg-light"
                  style={{ fontSize: "0.9rem" }}
                />
              </div>
            </Tab>
          )}
        </Tabs>

        <Alert variant="info" className="small">
          <strong>Tips for resolving conflicts:</strong>
          <ul className="mb-0 mt-2">
            <li>Remove conflict markers (&lt;&lt;&lt;&lt;&lt;&lt;&lt;, =======, &gt;&gt;&gt;&gt;&gt;&gt;&gt;)</li>
            <li>Keep the changes you want from both versions</li>
            <li>Test your content after resolving</li>
            <li>You can switch tabs to compare different versions</li>
          </ul>
        </Alert>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={resolving}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleResolve}
          disabled={resolving || !resolvedContent.trim()}
        >
          {resolving ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              Resolving...
            </>
          ) : (
            <>
              <i className="bi bi-check-circle me-2"></i>
              Resolve Conflicts
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
