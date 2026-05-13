import CategoryManagementModal from "@/components/document/modals/CategoryManagementModal";
import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import ConfirmModal from "@/components/shared/modals/ConfirmModal";
import { useConfirmModal } from "@/hooks/ui";
import { Dropdown, OverlayTrigger, Popover } from "react-bootstrap";
import { useDocumentContext } from "@/providers/DocumentContextProvider.jsx";
import { useAuth } from "@/providers/AuthProvider";
import { useNotification } from "@/components/NotificationProvider";
import { formatDistanceToNow } from "date-fns";

const CATEGORY_FILTER_THRESHOLD = 10;

function DocumentToolbar({ documentTitle: _documentTitle, setDocumentTitle }) {
  const { show, modalConfig, openModal, handleConfirm, handleCancel } = useConfirmModal();
  const { showError, showSuccess } = useNotification();
  const { categories: rawCategories, addCategory, deleteCategory, renameCategory, setCategories, currentDocument, saveDocument, hasUnsavedChanges, content, renameDocument, refreshSiblings, openCategory, openRecents, clearSiblingOverride, siblingOverrideMode } = useDocumentContext();
  const { user } = useAuth();
  const isCollabDocument = currentDocument && user && currentDocument.user_id && currentDocument.user_id !== user.id;
  // Ref to always access the latest currentDocument (avoids stale closures)
  const currentDocumentRef = useRef(currentDocument);
  useEffect(() => { currentDocumentRef.current = currentDocument; }, [currentDocument]);
  // Always ensure 'Drafts' and 'General' are present at top
  // Always show Drafts and General first, then custom categories sorted alphabetically
  const categories = useMemo(() => {
    const customCats = rawCategories
      .filter(c => c !== "Drafts" && c !== "General")
      .sort((a, b) => a.localeCompare(b));
    return ["Drafts", "General", ...customCats];
  }, [rawCategories]);
  // Derive currentCategory directly from document state — no local useState drift
  const currentCategory = currentDocument?.category || "General";
  const [newCategory, setNewCategory] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(currentDocument.name || "Untitled Document");
  const [editingCategory, setEditingCategory] = useState(false);
  const [categoryInput, setCategoryInput] = useState(currentCategory);
  const [categoryError, setCategoryError] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showManageModal, setShowManageModal] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
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

  // Move document AND navigate to the target category
  const handleMoveAndNavigate = async (category) => {
    if (category === currentCategory) return;
    try {
      const updatedDoc = { ...currentDocumentRef.current, category };
      const saved = await saveDocument(updatedDoc);
      if (saved) {
        refreshSiblings();
        showSuccess(`Moved to ${category}`);
        handleCategorySelect(category);
      } else {
        showError("Failed to move document to category.");
      }
    } catch (err) {
      showError("Failed to move document to category.");
    }
  };

  // Filtered categories for search
  const filteredCategories = useMemo(() => {
    if (!categoryFilter.trim()) return categories;
    const lower = categoryFilter.toLowerCase();
    return categories.filter(c => c.toLowerCase().includes(lower));
  }, [categories, categoryFilter]);

  // Reset highlight when filter changes
  useEffect(() => { setHighlightedIndex(-1); }, [categoryFilter]);

  // Keyboard navigation for category filter
  const handleFilterKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(i => Math.min(i + 1, filteredCategories.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      const cat = filteredCategories[highlightedIndex];
      if (cat && cat !== currentCategory) {
        handleMoveAndNavigate(cat);
      }
    }
  };

  const handleTitleClick = () => () => {
    setTitleInput(currentDocument.name || "Untitled Document");
    setEditingTitle(true);
  };

  const handleTitleChange = (e) => setTitleInput(e.target.value);
  const handleTitleBlur = async () => {
    setEditingTitle(false);
    const newTitle = titleInput.trim();
    // Use ref for fresh document state to avoid stale closure after category change
    const doc = currentDocumentRef.current;
    if (newTitle && newTitle !== doc.name) {
      try {
        // Update document name in context and backend/localStorage
        if (doc.id) {
          // Existing document - use rename function
          await renameDocument(doc.id, newTitle, doc.category);
        } else {
          // New document - save to get an ID and update title
          const updatedDoc = { ...doc, name: newTitle, content };
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
          if (!success) {
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
        /* Category breadcrumb dropdown — unified single list */
        <Dropdown as="span" className="me-1 category-breadcrumb" onToggle={(open) => { if (!open) setCategoryFilter(""); }}>
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
          <Dropdown.Menu className="category-dropdown-menu">
            {/* Header with manage gear icon */}
            <div className="d-flex justify-content-between align-items-center px-3 py-1">
              <span className="text-uppercase small fw-bold text-muted">Categories</span>
              <button
                type="button"
                className="btn btn-link btn-sm p-0 text-muted"
                title="Manage categories"
                onClick={(e) => { e.stopPropagation(); setShowManageModal(true); }}
              >
                <i className="bi bi-gear"></i>
              </button>
            </div>
            {/* Conditional filter input */}
            {categories.length > CATEGORY_FILTER_THRESHOLD && (
              <div className="px-3 py-1 category-dropdown-filter">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Filter categories..."
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  onKeyDown={handleFilterKeyDown}
                  onClick={e => e.stopPropagation()}
                  autoFocus
                />
              </div>
            )}
            {/* Scrollable category list */}
            <div className="category-dropdown-scroll">
              {/* Recents — navigate only */}
              <Dropdown.Item
                key="__recents__"
                active={siblingOverrideMode === 'recents'}
                onClick={() => openRecents()}
                className="d-flex align-items-center"
              >
                <i className="bi bi-clock-history me-2"></i>
                <span className="text-truncate">Recent</span>
              </Dropdown.Item>
              <Dropdown.Divider className="my-1" />
              {/* Category rows */}
              {filteredCategories.map((category, idx) => (
                <Dropdown.Item
                  key={category}
                  active={category === currentCategory || idx === highlightedIndex}
                  onClick={() => handleMoveAndNavigate(category)}
                  disabled={category === currentCategory}
                  className="d-flex justify-content-between align-items-center"
                >
                  <span className="text-truncate">
                    {category === currentCategory && (
                      <i className="bi bi-check-lg me-1"></i>
                    )}
                    {category}
                  </span>
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 text-muted category-open-btn"
                    title={`Open ${category}`}
                    tabIndex={-1}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCategorySelect(category);
                    }}
                    aria-label={`Open ${category}`}
                  >
                    <i className="bi bi-folder2-open"></i>
                  </button>
                </Dropdown.Item>
              ))}
            </div>
            <Dropdown.Divider className="my-1" />
            {/* Add new category — pinned at bottom */}
            <div className="px-3 py-2">
              <form
                className="d-flex"
                autoComplete="off"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newCategory) return;
                  handleAddCategory(newCategory);
                }}
              >
                <input
                  type="text"
                  className="form-control form-control-sm me-2"
                  placeholder="New category"
                  aria-label="New category"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                />
                <button className="btn btn-primary btn-sm" type="submit">
                  <i className="bi bi-plus"></i>
                </button>
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
      <CategoryManagementModal
        show={showManageModal}
        onHide={() => setShowManageModal(false)}
        categories={categories}
        onDeleteCategory={deleteCategory}
        onRenameCategory={renameCategory}
        onAddCategory={handleAddCategory}
      />
    </>
  );
}

export default DocumentToolbar;
