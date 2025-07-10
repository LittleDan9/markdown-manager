import React, { useEffect, useState } from "react";
import ConfirmModal from "../ConfirmModal";
import { useConfirmModal } from "../../hooks/useConfirmModal";
import { Dropdown } from "react-bootstrap";
import {
  addCategory,
  fetchCategories,
  deleteCategory,
} from "../../js/api/categories";

function DocumentToolbar({ documentTitle, setDocumentTitle }) {
  const { show, modalConfig, openModal, handleConfirm, handleCancel } =
    useConfirmModal();

  // Categories
  const [categories, setCategories] = useState(["General"]);
  const [currentCategory, setCurrentCategory] = useState("General");
  const [newCategory, setNewCategory] = useState("");
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(
    documentTitle || "Untitled Document",
  );

  const handleTitleClick = () => async () => {
    setDocumentTitle(documentTitle || "Untitled Document");
    setEditingTitle(true);
  };

  const handleTitleChange = (e) => setTitleInput(e.target.value);
  const handleTitleBlur = () => {
    setEditingTitle(false);
    if (titleInput.trim() && titleInput !== documentTitle) {
      setDocumentTitle(titleInput.trim());
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
        try {
          const fetchedCategories = await fetchCategories();
          let cats = fetchedCategories.filter(
            (cat) => cat.trim().toLowerCase() !== "general",
          );
          setCategories(["General", ...cats]);
        } catch (e) {
          setCategories(["General"]);
        }
      },
      {
        title: `Delete Category: ${category}`,
        message: `Are you sure you want to delete the category ${category}? All documents in this category will be moved to General`,
        confirmText: "Delete",
        cancelText: "Cancel",
        confirmVariant: "danger",
        cancelVariant: "secondary",
        icon: (
          <i className="bi bi-exclamation-triangle-fill text-danger me-2"></i>
        ),
      },
    );
    return;
  };

  const handleAddCategory = async (category) => {
    if (!category) return;

    try {
      await addCategory(category);
      setCategories((prev) => [...prev, category]);
      setCurrentCategory(category);
      setNewCategory("");
    } catch (e) {
      console.error("Failed to add category:", e);
    }
  };

  useEffect(() => {
    // Fetch categories from API
    async function loadCategories() {
      try {
        const fetchedCategories = await fetchCategories();
        let cats = fetchedCategories.filter(
          (cat) => cat.trim().toLowerCase() !== "general",
        );
        setCategories(["General", ...cats]);
      } catch (e) {
        setCategories(["General"]);
      } finally {
        setLoadingCategories(false);
      }
    }
    loadCategories();
  }, []);
  return (
    <>
      {/* Category dropdown (display only, no change logic yet) */}
      <Dropdown as="span" className="me-1">
        <Dropdown.Toggle
          size="sm"
          variant="secondary"
          id="categoryDropdown"
          className="dropdown-toggle d-flex align-items-center"
        >
          {currentCategory}
        </Dropdown.Toggle>
        <Dropdown.Menu>
          {loadingCategories ? (
            <Dropdown.Item disabled>
              <i className="bi bi-hourglass-split me-2"></i>Loading
              categories...
            </Dropdown.Item>
          ) : (
            categories.map((category) => (
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
            ))
          )}
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
          {documentTitle || "Untitled Document"}
        </span>
      )}
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
