import React, { useEffect, useState, useCallback } from "react";
import FileDropdown from "@/components/file/FileDropdown";
import DocumentToolbar from "@/components/toolbar/Document";
import UserToolbar from "@/components/toolbar/User";
import { useTheme } from "@/providers/ThemeProvider";
import { useDocumentContext } from "@/providers/DocumentContextProvider.jsx";
import { useNotification } from "@/components/NotificationProvider";

function Toolbar({
  fullscreenPreview,
  setFullscreenPreview,
  setContent,
  editorValue,
  setShowIconBrowser
}) {
  const { theme, setTheme } = useTheme();
  const { currentDocument, error, isSharedView, sharedDocument, sharedLoading, sharedError } = useDocumentContext();
  const { showWarning } = useNotification();
  const [documentTitle, setDocumentTitleState] = useState(
    currentDocument?.name || "Untitled Document"
  );
  const [importMarkdownFile, setImportMarkdownFile] = useState(null);

  // Memoize setDocumentTitle to prevent infinite re-renders
  const setDocumentTitle = useCallback((title) => {
    setDocumentTitleState(title);
  }, []);

  // Memoize setImportMarkdownFile to prevent infinite re-renders
  const memoizedSetImportMarkdownFile = useCallback((file) => {
    setImportMarkdownFile(file);
  }, []);

  useEffect(() => {
    // Update theme icons for both guest and user menus
    const themeIcon = document.getElementById("themeIcon");
    const themeText = document.getElementById("themeText");
    const themeIconUser = document.getElementById("themeIconUser");
    const themeTextUser = document.getElementById("themeTextUser");

    const iconClass =
      theme === "light" ? "bi bi-moon-fill me-2" : "bi bi-sun-fill me-2";
    const textContent = theme === "light" ? "Dark Theme" : "Light Theme";

    if (themeIcon && themeText) {
      themeIcon.className = iconClass;
      themeText.textContent = textContent;
    }

    if (themeIconUser && themeTextUser) {
      themeIconUser.className = iconClass;
      themeTextUser.textContent = textContent;
    }
  });

  useEffect(() => {
    setDocumentTitleState(currentDocument?.name || "Untitled Document");
  }, [currentDocument?.name]);

  const handleThemeToggle = (e) => {
    e.preventDefault();
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
  };

  return (
    <nav id="toolbar" className="navbar navbar-expand-lg bg-body-tertiary px-3">
      <div className="d-flex align-items-center justify-content-between w-100">
        {/* Left side: File Menu & Document Title or Shared Document Info */}
        <div className="d-flex align-items-center gap-3">
          {isSharedView ? (
            // Shared document information
            <div className="d-flex align-items-center">
              {sharedLoading ? (
                <div className="d-flex align-items-center">
                  <div className="spinner-border spinner-border-sm me-2" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <span className="text-muted">Loading shared document...</span>
                </div>
              ) : sharedDocument ? (
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-file-text text-muted"></i>
                  <span className="fw-medium">{sharedDocument.name}</span>
                  <span className="badge bg-secondary">
                    <i className="bi bi-eye me-1"></i>
                    Read-only
                  </span>
                  <small className="text-muted">
                    by {sharedDocument.author_name} •
                    Category: {sharedDocument.category} •
                    Last updated: {new Date(sharedDocument.updated_at).toLocaleDateString()}
                  </small>
                </div>
              ) : (
                <div className="d-flex align-items-center text-danger">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  <span>Shared document not found or access revoked</span>
                </div>
              )}
            </div>
          ) : (
            // Normal document controls
            <>
              <FileDropdown setDocumentTitle={setDocumentTitle} />
              <div className="vr opacity-50"></div>
              <div className="d-flex align-items-center">
                <i className="bi bi-file-earmark-text me-2 text-muted"></i>
                <DocumentToolbar
                  documentTitle={documentTitle}
                  setDocumentTitle={setDocumentTitle}
                />
              </div>
            </>
          )}
        </div>
        {/* Right side: Utility Controls */}
        <div className="d-flex align-items-center gap-2" id="utilityControls">
          {!isSharedView && (
            <button
              id="iconBrowserBtn"
              className="btn btn-sm btn-outline-secondary"
              data-bs-toggle="tooltip"
              data-bs-placement="bottom"
              title="Browse AWS Icons for Mermaid"
              onClick={(e) => {
                e.preventDefault();
                setShowIconBrowser(true);
              }}
            >
              <i className="bi bi-grid-3x3-gap"></i>
            </button>
          )}
          {!isSharedView && (
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
          )}
          <button
            id="fullScreenBtn"
            className="btn btn-sm btn-outline-secondary"
            data-bs-toggle="tooltip"
            data-bs-placement="bottom"
            title={fullscreenPreview ? "Exit fullscreen preview" : "Open preview in fullscreen"}
            onClick={e => {
              e.preventDefault();
              setFullscreenPreview(prev => !prev);
            }}
            style={{ display: isSharedView ? 'none' : 'inline-block' }}
          >
            <i className={fullscreenPreview ? "bi bi-fullscreen-exit" : "bi bi-fullscreen"}></i>
          </button>
          {/* User Profile Dropdown (always show for login access) */}
          <UserToolbar
            handleThemeToggle={handleThemeToggle}
            theme={theme}
            isSharedView={isSharedView}
          />
        </div>
      </div>
    </nav>
  );
}

export default Toolbar;
