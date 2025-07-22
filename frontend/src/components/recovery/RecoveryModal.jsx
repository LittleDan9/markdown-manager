import React from "react";
import { Modal, Button } from "react-bootstrap";

export default function RecoveryModal({ show, doc, onSave, onOverwrite, onDiscard, onHide }) {
  if (!doc) return null;
  return (
    <Modal show={show} onHide={onHide} size="lg" scrollable>
      <Modal.Header closeButton>
        <Modal.Title>Review Recovered Document</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <h6>{doc.name} <span className="text-muted">({doc.category})</span></h6>
        <div style={{ maxHeight: "400px", overflowY: "auto", border: "1px solid #eee", padding: "1em" }}>
          <pre style={{ whiteSpace: "pre-wrap" }}>{doc.content}</pre>
        </div>
        {doc.collision && <div className="text-danger mt-2">A document with this name and category already exists. Choose to overwrite or discard.</div>}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="success" onClick={onSave}>Save</Button>
        {doc.collision && <Button variant="danger" onClick={onOverwrite}>Overwrite</Button>}
        <Button variant="secondary" onClick={onDiscard}>Discard</Button>
      </Modal.Footer>
    </Modal>
  );
}
