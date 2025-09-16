import React, { useState } from "react";
import { Modal, Button, Form, Dropdown } from "react-bootstrap";

function DeleteCategoryModal({
  show,
  onHide,
  category,
  categories,
  documentsInCategory,
  onDelete,
  loading,
}) {
  const [migrateTo, setMigrateTo] = useState(categories.find(c => c !== category) || "General");
  const [deleteDocs, setDeleteDocs] = useState(false);

  const handleDelete = () => {
    onDelete({ migrateTo: deleteDocs ? null : migrateTo, deleteDocs });
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Delete Category: {category}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {documentsInCategory.length > 0 ? (
          <>
            <div className="mb-3">
              <Form.Check
                type="checkbox"
                id="deleteDocsCheckbox"
                label="Delete all documents in this category"
                checked={deleteDocs}
                onChange={e => setDeleteDocs(e.target.checked)}
              />
            </div>
            <div className="mb-3">
              <Form.Label>Move documents to:</Form.Label>
              <Form.Select
                disabled={deleteDocs}
                value={migrateTo}
                onChange={e => setMigrateTo(e.target.value)}
              >
                {categories.filter(c => c !== category).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </Form.Select>
            </div>
            <div className="text-muted small mb-2">
              {deleteDocs
                ? "All documents in this category will be permanently deleted."
                : "Documents will be moved to the selected category."}
            </div>
          </>
        ) : (
          <div className="text-muted">No documents in this category. It will be deleted immediately.</div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={loading}>
          Cancel
        </Button>
        <Button variant="danger" onClick={handleDelete} disabled={loading}>
          Delete Category
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default DeleteCategoryModal;
