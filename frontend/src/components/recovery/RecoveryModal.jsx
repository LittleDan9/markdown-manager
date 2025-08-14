import React, { useState } from "react";
import { Modal, Button, Tabs, Tab } from "react-bootstrap";

export default function RecoveryModal({ show, doc, onSave, onOverwrite, onDiscard, onHide }) {
  const [activeTab, setActiveTab] = useState("local");

  if (!doc) return null;

  const hasBackendContent = doc.backend_content && doc.backend_content.trim() !== '';
  const isContentConflict = doc.conflict_type === 'content_conflict' && hasBackendContent;

  return (
    <Modal show={show} onHide={onHide} size="xl" scrollable>
      <Modal.Header closeButton>
        <Modal.Title>
          Review Document: {doc.name}
          {doc.conflict_type && (
            <small className="text-muted ms-2">
              ({doc.conflict_type === 'content_conflict' ? 'Content Conflict' :
                doc.conflict_type === 'name_conflict' ? 'Name Conflict' :
                'Migration Issue'})
            </small>
          )}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-3">
          <strong>Category:</strong> <span className="text-muted">{doc.category}</span>
        </div>

        {isContentConflict ? (
          <div>
            <p className="text-warning">
              <i className="bi bi-exclamation-triangle"></i>
              This document has different content than the version already saved to your account.
            </p>
            <Tabs activeKey={activeTab} onSelect={setActiveTab} className="mb-3">
              <Tab eventKey="local" title="Your Local Version">
                <div style={{ maxHeight: "400px", overflowY: "auto", border: "1px solid #eee", padding: "1em" }}>
                  <pre style={{ whiteSpace: "pre-wrap" }}>{doc.content}</pre>
                </div>
              </Tab>
              <Tab eventKey="backend" title="Saved Version">
                <div style={{ maxHeight: "400px", overflowY: "auto", border: "1px solid #eee", padding: "1em" }}>
                  <pre style={{ whiteSpace: "pre-wrap" }}>{doc.backend_content}</pre>
                </div>
              </Tab>
            </Tabs>
          </div>
        ) : (
          <div>
            {doc.collision && (
              <p className="text-info">
                <i className="bi bi-info-circle"></i>
                A document with this name and category already exists.
              </p>
            )}
            <div style={{ maxHeight: "400px", overflowY: "auto", border: "1px solid #eee", padding: "1em" }}>
              <pre style={{ whiteSpace: "pre-wrap" }}>{doc.content}</pre>
            </div>
          </div>
        )}

        {doc.error && (
          <div className="alert alert-warning mt-3">
            <strong>Error:</strong> {doc.error}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        {isContentConflict ? (
          <>
            <Button variant="primary" onClick={onSave} title="Keep your local version and save it with a new name">
              <i className="bi bi-file-plus"></i> Save as New
            </Button>
            <Button variant="warning" onClick={onOverwrite} title="Replace the saved version with your local version">
              <i className="bi bi-arrow-repeat"></i> Overwrite Saved
            </Button>
            <Button variant="secondary" onClick={onDiscard} title="Keep the saved version and discard your local changes">
              <i className="bi bi-trash"></i> Discard Local
            </Button>
          </>
        ) : (
          <>
            <Button variant="success" onClick={onSave}>
              <i className="bi bi-check"></i> Save
            </Button>
            {doc.collision && (
              <Button variant="warning" onClick={onOverwrite}>
                <i className="bi bi-arrow-repeat"></i> Overwrite
              </Button>
            )}
            <Button variant="secondary" onClick={onDiscard}>
              <i className="bi bi-trash"></i> Discard
            </Button>
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
}
