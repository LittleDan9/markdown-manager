import React, { useState } from "react";
import { Modal, Button, Dropdown, Form } from "react-bootstrap";
import ConfirmModal from "./ConfirmModal";
import { useNotification } from "../NotificationProvider";

function OpenFileModal({ show, onHide, categories, documents, onOpen, setContent, deleteDocument }) {
  const [selectedCategory, setSelectedCategory] = useState(categories[0] || "");
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);
  const { showSuccess, showError } = useNotification();

  // Filter documents by selected category
  const filteredDocs = documents.filter(
    (doc) => doc.category === selectedCategory
  );

  const handleDelete = async () => {
    if (!docToDelete) return;
    try {
      await deleteDocument(docToDelete.id);
      showSuccess(`Document '${docToDelete.name}' deleted.`);
      setShowConfirm(false);
      setDocToDelete(null);
      setSelectedDocId(null);
    } catch (err) {
      showError(`Failed to delete document '${docToDelete.name}'.`);
      setShowConfirm(false);
      setDocToDelete(null);
    }
  };

  return (
    <>
      <Modal show={show} onHide={onHide} centered>
        <Modal.Header closeButton>
          <Modal.Title>Open Document</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Category</Form.Label>
            <Form.Select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setSelectedDocId(null);
              }}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <div className="list-group">
            {filteredDocs.length === 0 && (
              <div className="text-muted">No documents in this category.</div>
            )}
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className="list-group-item d-flex align-items-center justify-content-between mb-2 border rounded shadow-sm"
                style={{ padding: "1rem" }}
              >
                <div className="flex-grow-1">
                  <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>{doc.name}</div>
                  <div className="text-muted" style={{ fontSize: "0.9rem" }}>
                    Last saved: {doc.lastModified ? new Date(doc.lastModified).toLocaleString() : "Unknown"}
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2 ms-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      onOpen(doc);
                      if (setContent) setContent(doc.content);
                    }}
                  >
                    <i className="bi bi-folder2-open me-1"></i>Open
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setDocToDelete(doc);
                      setShowConfirm(true);
                    }}
                  >
                    <i className="bi bi-trash me-1"></i>Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              const doc = documents.find((d) => d.id === selectedDocId);
              if (doc) {
                onOpen(doc);
                if (setContent) setContent(doc.content);
              }
            }}
            disabled={!selectedDocId}
          >
            Open
          </Button>
        </Modal.Footer>
      </Modal>
      <ConfirmModal
        show={showConfirm}
        onCancel={() => { setShowConfirm(false); setDocToDelete(null); }}
        onConfirm={handleDelete}
        title="Delete Document"
        message={`Are you sure you want to delete '${docToDelete?.name}'? This cannot be undone.`}
        confirmText="Delete"
        confirmVariant="danger"
        cancelText="Cancel"
        cancelVariant="secondary"
        icon={<i className="bi bi-trash text-danger me-2"></i>}
      />
    </>
  );
}

export default OpenFileModal;
