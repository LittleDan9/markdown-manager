import DeleteCategoryModal from "@/components/modals/DeleteCategoryModal";
import React, { useEffect, useState } from "react";
import ConfirmModal from "@/components/modals/ConfirmModal";
import { useConfirmModal } from "@/hooks/ui";
import { Dropdown } from "react-bootstrap";
import { useDocumentContext } from "@/providers/DocumentContextProvider.jsx";
import { useNotification } from "@/components/NotificationProvider";
import { DocumentService } from "@/services/core";
import { formatDistanceToNow } from "date-fns";

function DocumentToolbar({ documentTitle, setDocumentTitle }) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetCategory, setDeleteTargetCategory] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteDocsInCategory, setDeleteDocsInCategory] = useState([]);
  const { show, modalConfig, openModal, handleConfirm, handleCancel } = useConfirmModal();
  const { showError } = useNotification();
  const { categories: rawCategories, addCategory, deleteCategory, renameCategory, setCategories, setDocuments, loadDocument, createDocument, currentDocument, documents, saveDocument, hasUnsavedChanges, content, renameDocument } = useDocumentContext();
  // Always ensure 'Drafts' and 'General' are present at top
  // Always show Drafts and General first, then custom categories sorted alphabetically
  const customCats = rawCategories
    .filter(c => c !== "Drafts" && c !== "General")
    .sort((a, b) => a.localeCompare(b));
  const categories = ["Drafts", "General", ...customCats];
  const [currentCategory, setCurrentCategory] = useState(categories[0] || "General");
  const [newCategory, setNewCategory] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(currentDocument.name || "Untitled Document");
  const [editingCategory, setEditingCategory] = useState(false);
  const [categoryInput, setCategoryInput] = useState(currentCategory);
  const [categoryError, setCategoryError] = useState("");
  // renameDocument is now included above from useDocumentContext
  const [ lastSavedText, setLastSavedText ] = useState("");

  useEffect(() => {
    setTimeout(() => {
      setLastSavedText(getLastSavedText());
    }, 1000);
  }, []);

  // Save document immediately when changing category
  const handleCategorySelect = async (category) => {
    setCurrentCategory(category);
    try {
      const updatedDoc = { ...currentDocument, category };
      const saved = await saveDocument(updatedDoc);
      // The saveDocument in DocumentProvider will handle current document tracking
    } catch (err) {
      showError("Failed to update document category.");
    }
  };

  // Keep parent component title in sync
  useEffect(() => {
    setDocumentTitle(currentDocument.name || "Untitled Document");
  }, [currentDocument.name, currentDocument.id, setDocumentTitle]);

  // Keep titleInput in sync with currentDocument.name when not editing
  useEffect(() => {
    if (!editingTitle) {
      setTitleInput(currentDocument.name || "Untitled Document");
    }
  }, [currentDocument.name, currentDocument.id, editingTitle]);

  // Ensure Last Saved indicator parses UTC and displays in local time
  const getLastSavedText = () => {
    let ts = currentDocument.updated_at || currentDocument.created_at;
    if (!ts) return "Never";
    // If timestamp lacks timezone, treat as UTC by appending 'Z'
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(ts) && !ts.endsWith('Z')) {
      ts += 'Z';
    }
    const utcDate = new Date(ts);
    const now = new Date();
    if (utcDate > now) return "Just now";
    return formatDistanceToNow(utcDate, { addSuffix: true });
  };

  // Sync category with currentDocument.category whenever document changes
  useEffect(() => {
    if (currentDocument && currentDocument.category) {
      // If currentDocument.category is missing from categories, fallback to 'General'
      if (!categories.includes(currentDocument.category)) {
        setCurrentCategory("General");
      } else if (currentDocument.category !== currentCategory) {
        setCurrentCategory(currentDocument.category);
      }
    }
  }, [currentDocument?.category, currentDocument?.updated_at, categories]);

  const handleTitleClick = () => () => {
    setTitleInput(currentDocument.name || "Untitled Document");
    setEditingTitle(true);
  };

  const handleTitleChange = (e) => setTitleInput(e.target.value);
  const handleTitleBlur = async () => {
    setEditingTitle(false);
    const newTitle = titleInput.trim();
    if (newTitle && newTitle !== currentDocument.name) {
      try {
        // Update document name in context and backend/localStorage
        if (currentDocument.id) {
          // Existing document - use rename function
          await renameDocument(currentDocument.id, newTitle, currentDocument.category);
        } else {
          // New document - save to get an ID and update title
          const updatedDoc = { ...currentDocument, name: newTitle, content };
          await saveDocument(updatedDoc);
        }
        // Update the toolbar title display
        setDocumentTitle(newTitle);
      } catch (error) {
        console.error('Failed to update document title:', error);
        showError('Failed to update document title');
        // Reset title input to original value on error
        setTitleInput(currentDocument.name || "Untitled Document");
      }
    }
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleTitleBlur();
    } else if (e.key === "Escape") {
      setEditingTitle(false);
      setTitleInput(currentDocument.name || "Untitled Document");
    }
  };

  const handleDeleteCategory = (category) => {
    // Find documents in this category
    const docsInCat = documents.filter(doc => doc.category === category);
    if (docsInCat.length > 0) {
      setDeleteTargetCategory(category);
      setDeleteDocsInCategory(docsInCat);
      setShowDeleteModal(true);
    } else {
      // No docs, delete immediately
      deleteCategory(category);
      setCurrentCategory("General");
    }
  };

  const handleAddCategory = async (category) => {
    if (!category) return;

    // Call addCategory which will update the current document with the new category
    const updatedCats = await addCategory(category);
    setCategories(updatedCats);

    // The current document has been updated with the new category, so sync the UI
    setCurrentCategory(category);
    setNewCategory("");
  };

  // Category rename handlers
  const handleCategoryLabelClick = () => {
    setEditingCategory(true);
    setCategoryInput(currentCategory);
    setCategoryError("");
  };

  const handleCategoryInputChange = (e) => {
    setCategoryInput(e.target.value);
    setCategoryError("");
  };

  const handleCategoryInputBlur = () => {
    setEditingCategory(false);
    if (categoryInput.trim() && categoryInput !== currentCategory) {
      openModal(
        async () => {
          const success = await renameCategory(currentCategory, categoryInput.trim());
          if (success) {
            setCurrentCategory(categoryInput.trim());
            setCategoryError("");
          } else {
            setCategoryError(error || "Category name already exists or is invalid.");
            setEditingCategory(true);
          }
        },
        {
          title: `Rename Category: ${currentCategory}`,
          message: `Change category name to '${categoryInput.trim()}'?`,
          confirmText: "Rename",
          cancelText: "Cancel",
          confirmVariant: "primary",
          cancelVariant: "secondary",
          icon: <i className="bi bi-pencil-square text-primary me-2"></i>,
        },
      );
    }
  };

  const handleCategoryInputKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCategoryInputBlur();
    } else if (e.key === "Escape") {
      setEditingCategory(false);
      setCategoryInput(currentCategory);
      setCategoryError("");
    }
  };

  // Categories are now managed by context
  return (
    <>
      {/* Category dropdown with inline rename */}
      <Dropdown as="span" className="me-1">
        <Dropdown.Toggle
          size="sm"
          variant="secondary"
          id="categoryDropdown"
          className="dropdown-toggle d-flex align-items-center"
        >
          {editingCategory ? (
            <input
              type="text"
              className="form-control form-control-sm d-inline w-auto"
              style={{ maxWidth: 160 }}
              value={categoryInput}
              onChange={handleCategoryInputChange}
              onBlur={handleCategoryInputBlur}
              onKeyDown={handleCategoryInputKeyDown}
              autoFocus
            />
          ) : (
            <span
              className="cursor-pointer"
              title="Click to rename category"
              onClick={handleCategoryLabelClick}
              style={{ minWidth: 60, display: "inline-block" }}
            >
              {currentCategory}
            </span>
          )}
        </Dropdown.Toggle>
        <Dropdown.Menu>
          {categories.map((category) => (
            <Dropdown.Item
              key={category}
              active={category === currentCategory}
              onClick={() => handleCategorySelect(category)}
              className={`d-flex justify-content-between align-items-center
                  ${category === currentCategory ? "text-bg-secondary" : ""}`}
            >
              <span className="text-truncate">{category}</span>
              {category !== "General" && category !== "Drafts" && (
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 ms-2 text-danger"
                  title={`Delete ${category}`}
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCategory(category);
                  }}
                  aria-label={`Delete ${category}`}
                >
                  <i className="bi bi-trash fw-bold"></i>
                </button>
              )}
            </Dropdown.Item>
          ))}
          <Dropdown.Divider />
          <div className="px-1 py-2">
            <form
              className="px-1 py-2"
              autoComplete="off"
              style={{ minWidth: "200px" }}
              onSubmit={(e) => {
                e.preventDefault();
                if (!newCategory) return;
                handleAddCategory(newCategory);
              }}
            >
              <div className="input-group input-group-sm">
                <input
                  type="text"
                  className="form-control"
                  placeholder="New category"
                  aria-label="New category"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                />
                <button className="btn btn-primary" type="submit">
                  <i className="bi bi-plus"></i>
                </button>
              </div>
            </form>
            {categoryError && (
              <div className="text-danger small mt-1">{categoryError}</div>
            )}
          </div>
        </Dropdown.Menu>
      </Dropdown>
      <span className="mx-1 text-muted">/</span>
      {editingTitle ? (
        <input
          type="text"
          className="form-control form-control-sm d-inline w-auto"
          style={{ maxWidth: 220 }}
          value={titleInput}
          onChange={handleTitleChange}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          autoFocus
        />
      ) : (
        <span
          id="documentTitle"
          className="text-muted cursor-pointer"
          title="Click to edit"
          onClick={handleTitleClick()}
          style={{ minWidth: 60, display: "inline-block" }}
        >
          {currentDocument.name || "Untitled Document"}
        </span>
      )}
      <span className="vr opacity-50 mx-2"></span>
      {/^Untitled Document( \d+)?$/.test(currentDocument.name) ? (
        <span
          className="me-2"
          title="This document will remain your current document but will not be saved until you provide a title."
          style={{ cursor: "pointer" }}
        >
          <i className="bi bi-exclamation-diamond text-danger"></i>
        </span>
      ) : hasUnsavedChanges ? (
        <span
          className="me-2"
          title="You have unsaved changes in this document. Don't forget to save!"
          style={{ cursor: "pointer" }}
        >
          <i className="bi bi-exclamation-circle text-warning"></i>
        </span>
      ) : null}
      <span className="text-muted small">
        Last saved: {getLastSavedText()}
      </span>
      <ConfirmModal
        show={show}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        {...modalConfig}
      />
      <DeleteCategoryModal
        show={showDeleteModal}
        onHide={() => setShowDeleteModal(false)}
        category={deleteTargetCategory}
        categories={categories}
        documentsInCategory={deleteDocsInCategory}
        loading={deleteLoading}
      onDelete={async ({ migrateTo, deleteDocs }) => {
          if (!deleteTargetCategory) {
            showError("No category selected to delete.");
            setShowDeleteModal(false);
            return;
          }
          setDeleteLoading(true);
          try {
            // Delete or migrate category and get updated list
            const updatedCats = await deleteCategory(deleteTargetCategory, { deleteDocs, migrateTo });
            setCategories(updatedCats);
            setCurrentCategory("General");
            setDocuments(DocumentService.getAllDocuments());
            createDocument();
            setShowDeleteModal(false);
          } catch (err) {
            showError("Failed to delete category");
          } finally {
            setDeleteLoading(false);
          }
        }}
      />
    </>
  );
}

export default DocumentToolbar;
