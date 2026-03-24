import React, { useEffect, useState, useCallback } from "react";
import FileDropdown from "@/components/file/FileDropdown";
import DocumentToolbar from "@/components/toolbar/Document";
import UserToolbar from "@/components/toolbar/User";
import ShareButton from "@/components/shared/ShareButton";
import DocumentInfoModal from "@/components/shared/modals/DocumentInfoModal";
import MobileToolbarMenu from "@/components/toolbar/MobileToolbarMenu";
import MobileUserMenu from "@/components/toolbar/MobileUserMenu";
import { ActionButton } from "@/components/shared";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useDocumentContext } from "@/providers/DocumentContextProvider.jsx";
import { useNotification } from "@/components/NotificationProvider";
import { useViewport } from "@/hooks";
import SemanticSearch from "@/components/toolbar/SemanticSearch";

function Toolbar({
  fullscreenPreview,
  setFullscreenPreview,
  setContent,
  editorValue: _editorValue,
  setShowIconBrowser
}) {
  const { theme, setTheme } = useTheme();
  const { currentDocument, error: _error, isSharedView, sharedDocument, sharedLoading, sharedError: _sharedError, previewHTML: _previewHTML, setShowChatDrawer, categories, saveDocument, renameDocument, content, mobileViewMode, setMobileViewMode } = useDocumentContext();
  const { showWarning: _showWarning } = useNotification();
  const { user } = useAuth();
  const { isMobile } = useViewport();
  const [documentTitle, setDocumentTitleState] = useState(
    currentDocument?.name || "Untitled Document"
  );
  const [_importMarkdownFile, setImportMarkdownFile] = useState(null);
  const [showDocumentInfoModal, setShowDocumentInfoModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMobileUserMenu, setShowMobileUserMenu] = useState(false);

  // Memoize setDocumentTitle to prevent infinite re-renders
  const setDocumentTitle = useCallback((title) => {
    setDocumentTitleState(title);
  }, []);

  // Memoize setImportMarkdownFile to prevent infinite re-renders
  const _memoizedSetImportMarkdownFile = useCallback((file) => {
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

  const handleMobileRename = useCallback(async (newTitle) => {
    if (!currentDocument) return;
    if (currentDocument.id) {
      await renameDocument(currentDocument.id, newTitle, currentDocument.category);
    } else {
      await saveDocument({ ...currentDocument, name: newTitle, content });
    }
    setDocumentTitleState(newTitle);
  }, [currentDocument, renameDocument, saveDocument, content]);

  const handleMobileCategoryChange = useCallback(async (category) => {
    if (!currentDocument || currentDocument.repository_type === 'github') return;
    await saveDocument({ ...currentDocument, category });
  }, [currentDocument, saveDocument]);

  return (
    <nav id="toolbar" className="navbar bg-body px-3">
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
              {!isMobile && (
                <>
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
            </>
          )}
        </div>

        {/* Center: Edit/Preview toggle (mobile only) */}
        {isMobile && !isSharedView && !fullscreenPreview && (
          <div className="mobile-view-toggle-inline">
            <button
              type="button"
              className={`toggle-seg${mobileViewMode === 'editor' ? ' active' : ''}`}
              onClick={() => setMobileViewMode('editor')}
            >
              <i className="bi bi-pencil-square" />
              Edit
            </button>
            <button
              type="button"
              className={`toggle-seg${mobileViewMode === 'preview' ? ' active' : ''}`}
              onClick={() => setMobileViewMode('preview')}
            >
              <i className="bi bi-eye" />
              Preview
            </button>
          </div>
        )}

        {/* Right side: Utility Controls */}
        {isMobile ? (
          /* Mobile: profile icon + hamburger icon */
          <div className="d-flex align-items-center gap-1">
            <button
              type="button"
              className="mobile-hamburger-btn"
              onClick={() => setShowMobileUserMenu(true)}
              aria-label="User menu"
            >
              <i className={`bi ${user?.is_active ? 'bi-person-circle' : 'bi-person'}`} />
            </button>
            {!isSharedView && (
              <button
                type="button"
                className="mobile-hamburger-btn"
                onClick={() => setShowMobileMenu(true)}
                aria-label="Open menu"
              >
                <i className="bi bi-three-dots-vertical" />
              </button>
            )}
          </div>
        ) : (
        <div className="d-flex align-items-center gap-2" id="utilityControls">
          {!isSharedView && (
            <SemanticSearch />
          )}
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
              id="chatBtn"
              variant="outline-secondary"
              size="sm"
              title="Ask your documents (AI Q&A)"
              onClick={(e) => {
                e.preventDefault();
                setShowChatDrawer(prev => !prev);
              }}
              icon="bi bi-chat-dots"
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
        )}
      </div>

      {/* Mobile user menu */}
      {isMobile && (
        <MobileUserMenu
          show={showMobileUserMenu}
          onHide={() => setShowMobileUserMenu(false)}
        />
      )}

      {/* Mobile offcanvas menu */}
      {isMobile && !isSharedView && (
        <MobileToolbarMenu
          show={showMobileMenu}
          onHide={() => setShowMobileMenu(false)}
          onSearch={() => {}}
          onShare={null}
          onIconBrowser={() => setShowIconBrowser(true)}
          onChat={() => setShowChatDrawer(prev => !prev)}
          onFullscreen={() => setFullscreenPreview(prev => !prev)}
          onThemeToggle={handleThemeToggle}
          onDocumentInfo={handleShowDocumentInfo}
          onRenameDocument={handleMobileRename}
          onChangeCategory={handleMobileCategoryChange}
          fullscreenPreview={fullscreenPreview}
          theme={theme}
          currentDocument={currentDocument}
          categories={categories}
        />
      )}

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
