import DeleteCategoryModal from "@/components/document/modals/DeleteCategoryModal";
import React, { useEffect, useState, useMemo, useCallback } from "react";
import ConfirmModal from "@/components/shared/modals/ConfirmModal";
import { useConfirmModal } from "@/hooks/ui";
import { Dropdown, OverlayTrigger, Popover } from "react-bootstrap";
import { useDocumentContext } from "@/providers/DocumentContextProvider.jsx";
import { useAuth } from "@/providers/AuthProvider";
import { useNotification } from "@/components/NotificationProvider";
import { serviceFactory } from "@/services/injectors";
import { formatDistanceToNow } from "date-fns";

function DocumentToolbar({ documentTitle: _documentTitle, setDocumentTitle }) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetCategory, setDeleteTargetCategory] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteDocsInCategory, setDeleteDocsInCategory] = useState([]);
  const { show, modalConfig, openModal, handleConfirm, handleCancel } = useConfirmModal();
  const { showError } = useNotification();
  const documentService = serviceFactory.createDocumentService();
  const { categories: rawCategories, addCategory, deleteCategory, renameCategory, setCategories, setDocuments, loadDocument: _loadDocument, createDocument, currentDocument, documents, saveDocument, hasUnsavedChanges, content, renameDocument, refreshSiblings, openCategory, openRecents, clearSiblingOverride, siblingOverrideMode } = useDocumentContext();
  const { user } = useAuth();
  const isCollabDocument = currentDocument && user && currentDocument.user_id && currentDocument.user_id !== user.id;
  // Always ensure 'Drafts' and 'General' are present at top
  // Always show Drafts and General first, then custom categories sorted alphabetically
  const categories = useMemo(() => {
    const customCats = rawCategories
      .filter(c => c !== "Drafts" && c !== "General")
      .sort((a, b) => a.localeCompare(b));
    return ["Drafts", "General", ...customCats];
  }, [rawCategories]);
  const [currentCategory, setCurrentCategory] = useState(categories[0] || "General");
  const [newCategory, setNewCategory] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(currentDocument.name || "Untitled Document");
  const [editingCategory, setEditingCategory] = useState(false);
  const [categoryInput, setCategoryInput] = useState(currentCategory);
  const [categoryError, setCategoryError] = useState("");
  // renameDocument is now included above from useDocumentContext
  const [ _lastSavedText, setLastSavedText ] = useState("");

  // Ensure Last Saved indicator parses UTC and displays in local time
  const getLastSavedText = useCallback(() => {
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
  }, [currentDocument.updated_at, currentDocument.created_at]);

  useEffect(() => {
    setTimeout(() => {
      setLastSavedText(getLastSavedText());
    }, 1000);
  }, [getLastSavedText]);

  // Navigate to a category (open first document in that category)
  const handleCategorySelect = (category) => {
    clearSiblingOverride();
    openCategory(category);
  };

  // Move current document to a different category (save-based reassignment)
  const handleMoveToCategory = async (category) => {
    if (currentDocument?.repository_type === 'github') return;
    if (category === currentCategory) return;

    setCurrentCategory(category);
    try {
      const updatedDoc = { ...currentDocument, category };
      await saveDocument(updatedDoc);
      refreshSiblings();
    } catch (err) {
      setCurrentCategory(currentDocument?.category || 'General');
      showError("Failed to move document to category.");
    }
  };

  // Sync currentCategory from document state
  useEffect(() => {
    if (currentDocument?.repository_type === 'github') return;
    if (currentDocument?.category) {
      setCurrentCategory(
        categories.includes(currentDocument.category) ? currentDocument.category : 'General'
      );
    }
  }, [currentDocument?.category, currentDocument?.repository_type, categories]);

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
        // Refresh tab bar to reflect the new name
        refreshSiblings();
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

    // Don't allow adding categories when viewing GitHub files
    if (currentDocument?.repository_type === 'github') {
      showError("Cannot create categories for GitHub files.");
      return;
    }

    // Call addCategory which will update the current document with the new category
    const updatedCats = await addCategory(category);
    setCategories(updatedCats);

    // The current document has been updated with the new category, so sync the UI
    setCurrentCategory(category);
    setNewCategory("");
  };

  // Category rename handlers
  const handleCategoryLabelClick = () => {
    // Don't allow category editing for GitHub files
    if (currentDocument?.repository_type === 'github') {
      return;
    }

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
            setCategoryError("Category name already exists or is invalid.");
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
  const isGitHubFile = currentDocument?.repository_type === 'github';

  return (
    <>
      {/* Show repository info for GitHub files, category dropdown for local files */}
      {isGitHubFile ? (
        <span className="me-1 d-flex align-items-center">
          <span className="text-muted small fw-medium">
            {currentDocument.github_repository?.name ||
             currentDocument.repository_name ||
             currentDocument.github_repository?.full_name ||
             'Unknown Repository'}
          </span>
          {currentDocument.github_branch && currentDocument.github_branch !== 'main' && (
            <>
              <span className="text-muted mx-1">/</span>
              <span className="badge bg-info text-dark" style={{ fontSize: '0.7em' }}>
                {currentDocument.github_branch}
              </span>
            </>
          )}
        </span>
      ) : isCollabDocument ? (
        /* Read-only category for collaborative documents */
        <span className="me-1 text-muted small fw-medium">
          {currentDocument.category || 'General'}
        </span>
      ) : (
        /* Category breadcrumb dropdown — navigation-primary */
        <Dropdown as="span" className="me-1 category-breadcrumb">
          <Dropdown.Toggle
            as="span"
            id="categoryDropdown"
            className="category-breadcrumb-toggle"
            role="button"
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
            {/* Recent — virtual navigation category */}
            <Dropdown.Item
              key="__recents__"
              active={siblingOverrideMode === 'recents'}
              onClick={() => openRecents()}
              className={`d-flex justify-content-between align-items-center
                  ${siblingOverrideMode === 'recents' ? "text-bg-secondary" : ""}`}
            >
              <span className="text-truncate"><i className="bi bi-clock-history me-1"></i>Recent</span>
            </Dropdown.Item>
            <Dropdown.Divider />
            {categories.map((category) => (
              <Dropdown.Item
                key={category}
                active={category === currentCategory}
                onClick={() => handleCategorySelect(category)}
                className={`d-flex justify-content-between align-items-center
                    ${category === currentCategory ? "text-bg-secondary" : ""}`}
              >
                <span className="text-truncate">{category}</span>
                <span className="d-flex align-items-center gap-1 ms-2">
                  {category !== "General" && category !== "Drafts" && (
                    <button
                      type="button"
                      className="btn btn-link btn-sm p-0 text-danger"
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
                </span>
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
      )}
      <span className="mx-1 text-muted breadcrumb-separator">›</span>
      {editingTitle && !isCollabDocument ? (
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
          className={`text-muted${isCollabDocument ? '' : ' cursor-pointer'}`}
          title={isCollabDocument ? currentDocument.name : 'Click to edit'}
          onClick={isCollabDocument ? undefined : handleTitleClick()}
          style={{ minWidth: 60, display: "inline-block" }}
        >
          {currentDocument.name || "Untitled Document"}
        </span>
      )}
      {/* Move to category button — local docs only */}
      {!isGitHubFile && !isCollabDocument && (
        <Dropdown as="span" className="ms-1 move-to-category">
          <Dropdown.Toggle
            as="span"
            id="moveCategoryDropdown"
            className="move-category-toggle"
            role="button"
            title="Move to category"
          >
            <i className="bi bi-folder-symlink"></i>
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Header>Move to category</Dropdown.Header>
            {categories.map((category) => (
              <Dropdown.Item
                key={category}
                active={category === currentCategory}
                onClick={() => handleMoveToCategory(category)}
                disabled={category === currentCategory}
              >
                {category === currentCategory && (
                  <i className="bi bi-check-lg me-1"></i>
                )}
                {category}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown>
      )}
      <span className="vr opacity-50 mx-2"></span>
      {/* Document status popover */}
      <OverlayTrigger
        trigger={["hover", "focus"]}
        placement="bottom"
        overlay={
          <Popover className="doc-status-popover">
            <Popover.Body className="py-2 px-3">
              {currentDocument?.id && String(currentDocument.id).startsWith('doc_') ? (
                <div className="d-flex align-items-center mb-1">
                  <i className="bi bi-exclamation-triangle text-warning me-2"></i>
                  <small>Browser storage only</small>
                </div>
              ) : currentDocument?.id ? (
                <div className="d-flex align-items-center mb-1">
                  <i className="bi bi-cloud-check text-success me-2"></i>
                  <small>Saved to server</small>
                </div>
              ) : null}
              {/^Untitled Document( \d+)?$/.test(currentDocument.name) ? (
                <div className="d-flex align-items-center mb-1">
                  <i className="bi bi-exclamation-diamond text-danger me-2"></i>
                  <small>Needs a title before saving</small>
                </div>
              ) : hasUnsavedChanges ? (
                <div className="d-flex align-items-center mb-1">
                  <i className="bi bi-exclamation-circle text-warning me-2"></i>
                  <small>Unsaved changes</small>
                </div>
              ) : null}
              <div className="d-flex align-items-center">
                <i className="bi bi-clock-history text-muted me-2"></i>
                <small className="text-muted">Last saved: {getLastSavedText()}</small>
              </div>
            </Popover.Body>
          </Popover>
        }
      >
        <span className="doc-status-icon" style={{ cursor: "pointer" }}>
          {/^Untitled Document( \d+)?$/.test(currentDocument.name) ? (
            <i className="bi bi-exclamation-diamond text-danger"></i>
          ) : hasUnsavedChanges ? (
            <i className="bi bi-exclamation-circle text-warning"></i>
          ) : currentDocument?.id && String(currentDocument.id).startsWith('doc_') ? (
            <i className="bi bi-exclamation-triangle text-warning"></i>
          ) : currentDocument?.id ? (
            <i className="bi bi-cloud-check text-success"></i>
          ) : (
            <i className="bi bi-file-earmark text-muted"></i>
          )}
        </span>
      </OverlayTrigger>
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
            setDocuments(documentService.getAllDocuments());
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
