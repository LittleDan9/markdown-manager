import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Offcanvas } from 'react-bootstrap';

/**
 * MobileToolbarMenu - Offcanvas hamburger menu for mobile toolbar actions.
 * Includes editable document info and utility actions.
 * User/account menu is handled by MobileUserMenu (separate offcanvas).
 */
function MobileToolbarMenu({
  show,
  onHide,
  onSearch,
  onShare,
  onIconBrowser,
  onChat,
  onFullscreen,
  onThemeToggle,
  onDocumentInfo,
  onRenameDocument,
  onChangeCategory,
  fullscreenPreview,
  theme,
  currentDocument,
  categories,
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const handleAction = (action) => {
    action();
    onHide();
  };

  const handleTitleClick = useCallback(() => {
    if (currentDocument?.repository_type === 'github') return;
    setTitleInput(currentDocument?.name || 'Untitled Document');
    setEditingTitle(true);
  }, [currentDocument]);

  const handleTitleSave = useCallback(() => {
    setEditingTitle(false);
    const newTitle = titleInput.trim();
    if (newTitle && newTitle !== currentDocument?.name && onRenameDocument) {
      onRenameDocument(newTitle);
    }
  }, [titleInput, currentDocument?.name, onRenameDocument]);

  const handleTitleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setEditingTitle(false);
    }
  }, [handleTitleSave]);

  const handleCategorySelect = useCallback((category) => {
    if (onChangeCategory) {
      onChangeCategory(category);
    }
    setShowCategoryPicker(false);
  }, [onChangeCategory]);

  const isGitHubFile = currentDocument?.repository_type === 'github';

  return (
    <Offcanvas show={show} onHide={onHide} placement="end" className="mobile-toolbar-menu">
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>Menu</Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>
        <nav className="mobile-menu-nav">
          {/* Document info — editable name and category */}
          {currentDocument && (
            <>
              <div className="mobile-menu-doc-info">
                <div className="doc-info-name text-truncate">
                  <i className={`bi bi-${isGitHubFile ? 'github' : 'file-earmark-text'} me-2`} />
                  {editingTitle ? (
                    <input
                      type="text"
                      className="form-control form-control-sm doc-name-input"
                      value={titleInput}
                      onChange={(e) => setTitleInput(e.target.value)}
                      onBlur={handleTitleSave}
                      onKeyDown={handleTitleKeyDown}
                      autoFocus
                    />
                  ) : (
                    <span
                      className="doc-name-label text-truncate"
                      onClick={handleTitleClick}
                      title={isGitHubFile ? currentDocument.name : 'Tap to rename'}
                    >
                      {currentDocument.name || 'Untitled Document'}
                    </span>
                  )}
                </div>
                <div className="doc-info-meta">
                  {isGitHubFile ? (
                    <span className="badge bg-info text-dark">
                      {currentDocument.github_repository?.name || 'GitHub'}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="doc-category-btn"
                      onClick={() => setShowCategoryPicker(!showCategoryPicker)}
                      title="Tap to change category"
                    >
                      <span className="badge bg-secondary">
                        {currentDocument.category || 'General'}
                        <i className="bi bi-pencil-fill ms-1" style={{ fontSize: '0.6em' }} />
                      </span>
                    </button>
                  )}
                </div>

                {/* Category picker */}
                {showCategoryPicker && !isGitHubFile && categories && (
                  <ul className="mobile-category-list">
                    {categories.map((cat) => (
                      <li
                        key={cat}
                        className={cat === currentDocument.category ? 'active' : ''}
                        onClick={() => handleCategorySelect(cat)}
                      >
                        <i className={`bi bi-${cat === currentDocument.category ? 'check-circle-fill' : 'circle'}`} />
                        {cat}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {onDocumentInfo && (
                <button
                  type="button"
                  className="mobile-menu-item"
                  onClick={() => handleAction(onDocumentInfo)}
                  disabled={!currentDocument?.id}
                >
                  <i className="bi bi-info-circle" />
                  <span>Document Info</span>
                </button>
              )}
              <hr className="mobile-menu-divider" />
            </>
          )}

          {onSearch && (
            <button
              type="button"
              className="mobile-menu-item"
              onClick={() => handleAction(onSearch)}
            >
              <i className="bi bi-search" />
              <span>Search Documents</span>
            </button>
          )}
          {onShare && (
            <button
              type="button"
              className="mobile-menu-item"
              onClick={() => handleAction(onShare)}
            >
              <i className="bi bi-share" />
              <span>Share</span>
            </button>
          )}
          {onIconBrowser && (
            <button
              type="button"
              className="mobile-menu-item"
              onClick={() => handleAction(onIconBrowser)}
            >
              <i className="bi bi-grid-3x3-gap" />
              <span>Icon Browser</span>
            </button>
          )}
          {onChat && (
            <button
              type="button"
              className="mobile-menu-item"
              onClick={() => handleAction(onChat)}
            >
              <i className="bi bi-chat-dots" />
              <span>AI Chat</span>
            </button>
          )}

          <hr className="mobile-menu-divider" />

          <button
            type="button"
            className="mobile-menu-item"
            onClick={() => handleAction(onFullscreen)}
          >
            <i className={`bi bi-${fullscreenPreview ? 'fullscreen-exit' : 'fullscreen'}`} />
            <span>{fullscreenPreview ? 'Exit Fullscreen' : 'Fullscreen Preview'}</span>
          </button>
          <button
            type="button"
            className="mobile-menu-item"
            onClick={() => handleAction(onThemeToggle)}
          >
            <i className={`bi bi-${theme === 'light' ? 'moon-stars' : 'sun'}`} />
            <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
          </button>
        </nav>
      </Offcanvas.Body>
    </Offcanvas>
  );
}

MobileToolbarMenu.propTypes = {
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  onSearch: PropTypes.func,
  onShare: PropTypes.func,
  onIconBrowser: PropTypes.func,
  onChat: PropTypes.func,
  onFullscreen: PropTypes.func.isRequired,
  onThemeToggle: PropTypes.func.isRequired,
  onDocumentInfo: PropTypes.func,
  onRenameDocument: PropTypes.func,
  onChangeCategory: PropTypes.func,
  fullscreenPreview: PropTypes.bool.isRequired,
  theme: PropTypes.string.isRequired,
  currentDocument: PropTypes.object,
  categories: PropTypes.arrayOf(PropTypes.string),
};

export default MobileToolbarMenu;
