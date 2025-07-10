import React, { useEffect, useState } from 'react';
import editor from '../js/editor';
import { Dropdown, ButtonGroup } from 'react-bootstrap';
import { useTheme } from '../context/ThemeContext';
import { documentManager } from '../js/DocumentManager';
import ConfirmModal from './ConfirmModal';
import { fetchCategories, deleteCategory, addCategory } from '../js/api/categories';


function Toolbar() {
    const { theme, setTheme } = useTheme();
    const [showConfirm, setShowConfirm] = useState(false);
    const [pendingAction, setPendingAction] = useState(null);
    const [modalConfig, setModalConfig] = useState({
        title: "Confirm Alert",
        message: "",
        confirmText: "Confirm",
        cancelText: "Cancel",
        confirmVariant: "primary",
        cancelVariant: "secondary",
        icon: <i className="bi bi-exclamation-triangle-fill text-warning me-2"></i>
    });
    const [documentTitle, setDocumentTitle] = useState("Untitled Document");

    // Categories
    const [categories, setCategories] = useState(["General"]);
    const [currentCategory, setCurrentCategory] = useState("General");
    const [newCategory, setNewCategory] = useState("");
    const [loadingCategories, setLoadingCategories] = useState(true);

    const handleDeleteCategory = (category) => {
      setPendingAction(() => async() => {
        await deleteCategory(category);
        setCurrentCategory("General");
        try {
          const fetchedCategories = await fetchCategories();
          let cats = fetchedCategories.filter(cat => cat.trim().toLowerCase() !== "general");
          setCategories(["General", ...cats]);
        } catch (e) {
          setCategories(["General"]);
        }
      });
      setModalConfig({
        title: `Delete Category: ${category}`,
        message: `Are you sure you want to delete this category ${category}? All document in this category will be moved to General`,
        confirmText: "Delete",
        cancelText: "Cancel",
        confirmVariant: "danger",
        cancelVariant: "secondary",
        icon: <i className="bi bi-exclamation-triangle-fill text-danger me-2"></i>
      });
      setShowConfirm(true);
    }

    const handleAddCategory = async (category) => {
      if (!category) return;

      try {
        await addCategory(category);
        setCategories(prev => [...prev, category]);
        setCurrentCategory(category);
        setNewCategory("");
      } catch (e) {
        console.error("Failed to add category:", e);
      }
    }

    useEffect(() => {
        // Fetch categories from API
        async function loadCategories() {
            try {
                const fetchedCategories = await fetchCategories();
                let cats = fetchedCategories.filter(cat => cat.trim().toLowerCase() !== "general");
                setCategories(["General", ...cats]);
            } catch (e){
              setCategories(["General"]);
            } finally {
              setLoadingCategories(false);
            }
          }
          loadCategories();
    }, []);

    // File Menu Events
    const handleNew = () => {
      if (documentManager.hasUnsavedChanges()) {
        const document = documentManager.createNewDocument();
        setDocumentTitle(document.name);
        return;
      }
      setPendingAction(() => async () =>{
        const document = await documentManager.createNewDocument();
        setDocumentTitle(document.name)
      });
      setModalConfig({
        title: "Unsaved Changes",
        message: "You have unsaved changes. Do you want to continue without saving?",
        confirmText: "Continue Without Saving",
        cancelText: "Cancel",
        confirmVariant: "danger",
        cancelVariant: "secondary",
        icon: <i className="bi bi-exclamation-triangle-fill text-warning me-2"></i>
      });
      setShowConfirm(true);
      return;
    }

    const handleOpen = () => {
      console.log("File opened");
    }

    const handleSave = () => {
      console.log("File saved");
    }

    const handleImport = () => {
      console.log("File imported");
    }

    const handleExportMarkdown = () => {
      console.log("Exported as Markdown");
    }

    const handleExportPDF = () => {
      console.log("Exported as PDF");
    }

    const handleConfirm = async () => {
      if (pendingAction) await pendingAction();
      setShowConfirm(false);
      setPendingAction(null);
    };

    const handleCancel = () => {
      setShowConfirm(false);
      setPendingAction(null);
    };

    useEffect(() => {
      // Update theme icons for both guest and user menus
      const themeIcon = document.getElementById("themeIcon");
      const themeText = document.getElementById("themeText");
      const themeIconUser = document.getElementById("themeIconUser");
      const themeTextUser = document.getElementById("themeTextUser");

      const iconClass =
        theme === "dark" ? "bi bi-moon-fill me-2" : "bi bi-sun-fill me-2";
      const textContent = theme === "dark" ? "Dark Theme" : "Light Theme";

      if (themeIcon && themeText) {
        themeIcon.className = iconClass;
        themeText.textContent = textContent;
      }

      if (themeIconUser && themeTextUser) {
        themeIconUser.className = iconClass;
        themeTextUser.textContent = textContent;
      }
    });

    const handleThemeToggle = (e) => {
        e.preventDefault();
        const newTheme = theme === "light" ? "dark" : "light";
        setTheme(newTheme);
    }
  return (
    <nav id="toolbar" className="navbar navbar-expand-lg bg-body-tertiary px-3">
      <div className="d-flex align-items-center justify-content-between w-100">
        {/* Left side: File Menu & Document Title */}
        <div className="d-flex align-items-center gap-3">
          {/* File Dropdown */}
          <Dropdown as={ButtonGroup}>
            <Dropdown.Toggle
              id="fileMenuDropdown"
              size="sm"
              variant="secondary"
              className="dropdownToggle"
            >
              <i className="bi bi-folder me-1"></i>File
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item onClick={handleNew}>
                <i className="bi bi-file-plus me-2"></i>New
              </Dropdown.Item>
              <Dropdown.Item onClick={handleOpen}>
                <i className="bi bi-folder2-open me-2"></i>Open
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item onClick={handleSave}>
                <i className="bi bi-save me-2"></i>Save
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item onClick={handleImport}>
                <i className="bi bi-file-earmark-arrow-up me-2"></i>Import
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item onClick={handleExportMarkdown}>
                <i className="bi bi-filetype-md me-2"></i>Export Markdown
              </Dropdown.Item>
              <Dropdown.Item onClick={handleExportPDF}>
                <i className="bi bi-filetype-pdf me-2"></i>Export PDF
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
          <div className="vr opacity-50"></div>
          <div className="d-flex align-items-center">
            <i className="bi bi-file-earmark-text me-2 text-muted"></i>
              {/* Category dropdown (display only, no change logic yet) */}
              <Dropdown as="span" className="me-1">
                <Dropdown.Toggle
                  size="sm"
                  variant='secondary'
                  id="categoryDropdown"
                  className="dropdown-toggle d-flex align-items-center"
                >
                  {currentCategory}
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  {loadingCategories ? (
                    <Dropdown.Item disabled>
                      <i className="bi bi-hourglass-split me-2"></i>Loading categories...
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
                        { category !== "General" && (
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
                      onSubmit={e => {
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
                          onChange={e => setNewCategory(e.target.value)}
                        />
                        <button
                          className="btn btn-primary"
                          type="submit"
                        >
                          <i className="bi bi-plus"></i>
                        </button>
                      </div>
                    </form>
                  </div>
                </Dropdown.Menu>
              </Dropdown>
            <span className="mx-1 text-muted">/</span>
            <span id="documentTitle" className="text-muted cursor-pointer" title="Click to edit">
              {documentTitle || "Untitled Document"}
            </span>
          </div>
        </div>
        {/* Right side: Utility Controls */}
        <div className="d-flex align-items-center gap-2" id="utilityControls">
          <button
            id="searchBtn"
            className="btn btn-sm btn-outline-secondary"
            data-bs-toggle="tooltip"
            data-bs-placement="bottom"
            title="Search (Coming Soon)"
            disabled
          >
            <i className="bi bi-search"></i>
          </button>
          <button
            id="fullScreenBtn"
            className="btn btn-sm btn-outline-secondary"
            data-bs-toggle="tooltip"
            data-bs-placement="bottom"
            title="Open preview in fullscreen"
          >
            <i className="bi bi-fullscreen"></i>
          </button>
          {/* User Profile Dropdown (simplified for now) */}
          <div className="dropdown" id="userDropdown">
            <button
              className="btn btn-outline-secondary btn-sm dropdown-toggle d-flex align-items-center gap-2"
              type="button"
              id="userMenuDropdown"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              <i className="bi bi-person-circle"></i>
              <span id="userDisplayName">Guest</span>
            </button>
            <ul className="dropdown-menu dropdown-menu-end" aria-labelledby="userMenuDropdown">
              <li>
                <a className="dropdown-item" href="#" id="loginBtn">
                  <i className="bi bi-box-arrow-in-right me-2"></i>Login
                </a>
              </li>
              <li>
                <a className="dropdown-item" href="#" id="registerBtn">
                  <i className="bi bi-person-plus me-2"></i>Sign Up
                </a>
              </li>
              <li><hr className="dropdown-divider" /></li>
              <li>
                <a className="dropdown-item" href="#" id="themeToggleBtn" onClick={handleThemeToggle}>
                  <i id="themeIcon" className="bi bi-sun-fill me-2"></i>
                  <span id="themeText">Light Theme</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <ConfirmModal
        show={showConfirm}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        {...modalConfig}
      />
    </nav>
  );
}

export default Toolbar;
