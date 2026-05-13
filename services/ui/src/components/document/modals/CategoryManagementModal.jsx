import React, { useState, useEffect, useCallback } from "react";
import { Modal, Button, Form } from "react-bootstrap";
import categoriesApi from "@/api/categoriesApi";
import DeleteCategoryModal from "./DeleteCategoryModal";

function CategoryManagementModal({
  show,
  onHide,
  categories,
  onDeleteCategory,
  onRenameCategory,
  onAddCategory,
}) {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await categoriesApi.getCategoriesWithStats();
      setStats(data);
    } catch {
      setStats([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (show) {
      loadStats();
      setError("");
      setEditingId(null);
    }
  }, [show, loadStats]);

  const handleStartEdit = (cat) => {
    setEditingId(cat.id);
    setEditValue(cat.name);
    setError("");
  };

  const handleSaveRename = async (cat) => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === cat.name) {
      setEditingId(null);
      return;
    }
    const success = await onRenameCategory(cat.name, trimmed);
    if (success) {
      setEditingId(null);
      loadStats();
    } else {
      setError("Category name already exists or is invalid.");
    }
  };

  const handleKeyDown = (e, cat) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveRename(cat);
    } else if (e.key === "Escape") {
      setEditingId(null);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      setError("Category already exists.");
      return;
    }
    await onAddCategory(trimmed);
    setNewCategory("");
    setError("");
    loadStats();
  };

  const isProtected = (name) => name === "General" || name === "Drafts";

  const handleDeleteClick = (cat) => {
    setDeleteTarget(cat);
  };

  const handleDeleteConfirm = async ({ migrateTo, deleteDocs }) => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await onDeleteCategory(deleteTarget.name, { migrateTo, deleteDocs });
      setDeleteTarget(null);
      loadStats();
    } catch {
      setError("Failed to delete category.");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-folder-fill me-2"></i>Manage Categories
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border spinner-border-sm text-primary" role="status" />
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="text-center" style={{ width: 100 }}>Documents</th>
                  <th className="text-center" style={{ width: 120 }}>Dict. Words</th>
                  <th className="text-end" style={{ width: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((cat) => (
                  <tr key={cat.id}>
                    <td>
                      {editingId === cat.id ? (
                        <Form.Control
                          size="sm"
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleSaveRename(cat)}
                          onKeyDown={(e) => handleKeyDown(e, cat)}
                          autoFocus
                        />
                      ) : (
                        <span className="d-flex align-items-center">
                          {isProtected(cat.name) && (
                            <i className="bi bi-lock-fill text-muted me-1" title="System category" />
                          )}
                          {cat.name}
                        </span>
                      )}
                    </td>
                    <td className="text-center">
                      <span className="badge bg-secondary">{cat.document_count}</span>
                    </td>
                    <td className="text-center">
                      <span className="badge bg-secondary">{cat.dictionary_word_count}</span>
                    </td>
                    <td className="text-end">
                      {!isProtected(cat.name) && (
                        <span className="d-inline-flex gap-2">
                          <button
                            type="button"
                            className="btn btn-link btn-sm p-0 text-primary"
                            title="Rename"
                            onClick={() => handleStartEdit(cat)}
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button
                            type="button"
                            className="btn btn-link btn-sm p-0 text-danger"
                            title="Delete"
                            onClick={() => handleDeleteClick(cat)}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {error && <div className="text-danger small mt-2">{error}</div>}
        <form className="d-flex mt-3" onSubmit={handleAdd} autoComplete="off">
          <Form.Control
            size="sm"
            type="text"
            placeholder="Add new category"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="me-2"
          />
          <Button variant="primary" size="sm" type="submit">
            <i className="bi bi-plus me-1"></i>Add
          </Button>
        </form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Close</Button>
      </Modal.Footer>
    </Modal>
    <DeleteCategoryModal
      show={!!deleteTarget}
      onHide={() => setDeleteTarget(null)}
      category={deleteTarget?.name}
      categories={categories}
      documentsInCategory={deleteTarget ? Array(deleteTarget.document_count).fill({ category: deleteTarget.name }) : []}
      loading={deleteLoading}
      onDelete={handleDeleteConfirm}
    />
    </>
  );
}

export default CategoryManagementModal;
