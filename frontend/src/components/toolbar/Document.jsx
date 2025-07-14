import React, { useEffect, useState } from "react";
import ConfirmModal from "../modals/ConfirmModal";
import { useConfirmModal } from "../../hooks/useConfirmModal";
import { Dropdown } from "react-bootstrap";
import { useDocument } from "../../context/DocumentProvider";
import { formatDistanceToNow } from "date-fns";

function DocumentToolbar({ documentTitle, setDocumentTitle }) {
  const { show, modalConfig, openModal, handleConfirm, handleCancel } = useConfirmModal();
  const { categories, addCategory, deleteCategory, renameCategory, error, setCategories, currentDocument } = useDocument();
  const [currentCategory, setCurrentCategory] = useState(categories[0] || "General");
  const [newCategory, setNewCategory] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(currentDocument.name || "Untitled Document");
  const [editingCategory, setEditingCategory] = useState(false);
  const [categoryInput, setCategoryInput] = useState(currentCategory);
  const [categoryError, setCategoryError] = useState("");

  // Keep titleInput in sync with currentDocument.name
  useEffect(() => {
    setTitleInput(currentDocument.name || "Untitled Document");
  }, [currentDocument.name]);

  const handleTitleClick = () => () => {
    setTitleInput(currentDocument.name || "Untitled Document");
    setEditingTitle(true);
  };

  const handleTitleChange = (e) => setTitleInput(e.target.value);
  const { renameDocument } = useDocument();
  const handleTitleBlur = async () => {
    setEditingTitle(false);
    const newTitle = titleInput.trim();
    if (newTitle && newTitle !== currentDocument.name) {
      // Update document name in context and backend/localStorage
      if (currentDocument.id) {
        await renameDocument(currentDocument.id, newTitle, currentDocument.category);
      } else {
        setDocumentTitle(newTitle);
      }
    }
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleTitleBlur();
    } else if (e.key === "Escape") {
      setEditingTitle(false);
      setTitleInput(documentTitle || "Untitled Document");
    }
  };

  const handleDeleteCategory = (category) => {
    openModal(
      async () => {
        await deleteCategory(category);
        setCurrentCategory("General");
      },
      {
        title: `Delete Category: ${category}`,
        message: `Are you sure you want to delete the category ${category}? All documents in this category will be moved to General`,
        confirmText: "Delete",
        cancelText: "Cancel",
        confirmVariant: "danger",
        cancelVariant: "secondary",
        icon: <i className="bi bi-exclamation-triangle-fill text-danger me-2"></i>,
      },
    );
    return;
  };

  const handleAddCategory = async (category) => {
    if (!category) return;
    await addCategory(category);
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
              onClick={() => setCurrentCategory(category)}
              className={`d-flex justify-content-between align-items-center
                  ${category === currentCategory ? "text-bg-secondary" : ""}`}
            >
              <span className="text-truncate">{category}</span>
              {category !== "General" && (
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
      {currentDocument.name === "Untitled Document" && (
        <span
          className="me-2"
          title="This document is only saved locally until you provide a title."
          style={{ cursor: "pointer" }}
        >
          <i className="bi bi-exclamation-diamond text-danger"></i>
        </span>
      )}
      <span className="text-muted small">
        Last saved: {currentDocument.lastModified ? formatDistanceToNow(new Date(currentDocument.lastModified), { addSuffix: true }) : "Never"}
      </span>
      <ConfirmModal
        show={show}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        {...modalConfig}
      />
    </>
  );
}

export default DocumentToolbar;
