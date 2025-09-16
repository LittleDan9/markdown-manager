import React, { useState } from "react";
import { Form, Button } from "react-bootstrap";

export default function DocumentListView({
  documents,
  categories,
  onFileOpen,
  onDocumentDelete,
  onModalHide
}) {
  // Always ensure 'General' is present
  const safeCategories = categories?.includes("General") 
    ? categories 
    : ["General", ...(categories?.filter(c => c !== "General") || [])];
  
  const [selectedCategory, setSelectedCategory] = useState(safeCategories[0] || "General");

  // Helper to get last saved date
  function getLastSaved(doc) {
    return doc.updated_at || doc.created_at || null;
  }

  // Filter documents by selected category
  const filteredDocs = documents?.filter(
    (doc) => doc.category === selectedCategory
  ) || [];

  return (
    <>
      <Form.Group className="mb-3">
        <Form.Label>Category</Form.Label>
        <Form.Select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          {safeCategories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </Form.Select>
      </Form.Group>

      <div style={{ maxHeight: "400px", overflowY: "auto" }}>
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
                Last saved: {getLastSaved(doc) ? new Date(getLastSaved(doc)).toLocaleString() : "Unknown"}
              </div>
            </div>
            <div className="d-flex align-items-center gap-2 ms-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSelectedCategory(doc.category); // Sync category to opened doc
                  onFileOpen(doc);
                  onModalHide();
                }}
              >
                <i className="bi bi-folder2-open me-1"></i>Open
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => onDocumentDelete(doc)}
              >
                <i className="bi bi-trash me-1"></i>Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
