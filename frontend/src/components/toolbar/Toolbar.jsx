import React, { useEffect, useState, useCallback } from "react";
import FileDropdown from "@/components/file/FileDropdown";
import DocumentToolbar from "@/components/toolbar/Document";
import UserToolbar from "@/components/toolbar/User";
import ShareButton from "@/components/shared/ShareButton";
import DocumentInfoModal from "@/components/shared/modals/DocumentInfoModal";
import { ActionButton } from "@/components/shared";
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
  const { currentDocument, error, isSharedView, sharedDocument, sharedLoading, sharedError, previewHTML } = useDocumentContext();
  const { showWarning } = useNotification();
  const [documentTitle, setDocumentTitleState] = useState(
    currentDocument?.name || "Untitled Document"
  );
  const [importMarkdownFile, setImportMarkdownFile] = useState(null);
  const [showDocumentInfoModal, setShowDocumentInfoModal] = useState(false);

  // Memoize setDocumentTitle to prevent infinite re-renders
  const setDocumentTitle = useCallback((title) => {
    setDocumentTitleState(title);
  }, []);

  // Memoize setImportMarkdownFile to prevent infinite re-renders
  const memoizedSetImportMarkdownFile = useCallback((file) => {
    setImportMarkdownFile(file);
  }, []);

  useEffect(() => {
    setDocumentTitleState(currentDocument?.name || "Untitled Document");
  }, [currentDocument?.name]);

  const handleThemeToggle = (e) => {
    e.preventDefault();
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
  };

  const handleShowDocumentInfo = () => {
    if (!currentDocument || !currentDocument.id) return;
    setShowDocumentInfoModal(true);
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
              <FileDropdown setDocumentTitle={setDocumentTitle} setContent={setContent} />
              <div className="vr opacity-50"></div>
              <div className="d-flex align-items-center">
                <ActionButton
                  variant="link"
                  size="sm"
                  className="p-0 me-2 text-muted"
                  onClick={handleShowDocumentInfo}
                  disabled={!currentDocument?.id}
                  title={currentDocument?.id ? "View Document Information" : "No document loaded"}
                  icon={`bi bi-${currentDocument?.repository_type === 'github' ? 'github' : 'file-earmark-text'}`}
                />
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
            <ShareButton />
          )}
          {!isSharedView && (
            <ActionButton
              id="iconBrowserBtn"
              variant="outline-secondary"
              size="sm"
              title="Browse AWS Icons for Mermaid"
              onClick={(e) => {
                e.preventDefault();
                setShowIconBrowser(true);
              }}
              icon="bi bi-grid-3x3-gap"
            />
          )}
          {!isSharedView && (
            <ActionButton
              id="searchBtn"
              variant="outline-secondary"
              size="sm"
              title="Search (Coming Soon)"
              disabled
              icon="bi bi-search"
            />
          )}
          <ActionButton
            id="fullScreenBtn"
            variant="outline-secondary"
            size="sm"
            title={fullscreenPreview ? "Exit fullscreen preview" : "Open preview in fullscreen"}
            onClick={e => {
              e.preventDefault();
              console.log('Fullscreen button clicked - current state:', fullscreenPreview);
              setFullscreenPreview(prev => {
                console.log('Setting fullscreen preview from', prev, 'to', !prev);
                return !prev;
              });
            }}
            icon={fullscreenPreview ? "bi bi-fullscreen-exit" : "bi bi-fullscreen"}
            style={{ display: isSharedView ? 'none' : 'inline-block' }}
          />
          {/* User Profile Dropdown (always show for login access) */}
          <UserToolbar
            handleThemeToggle={handleThemeToggle}
            theme={theme}
            isSharedView={isSharedView}
          />
        </div>
      </div>

      {/* Document Info Modal */}
      <DocumentInfoModal
        show={showDocumentInfoModal}
        onHide={() => setShowDocumentInfoModal(false)}
        document={currentDocument}
        gitStatus={null} // We don't have git status in toolbar, but modal can handle null
      />
    </nav>
  );
}

export default Toolbar;
