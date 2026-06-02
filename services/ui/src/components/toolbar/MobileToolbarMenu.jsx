import React, { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Offcanvas } from 'react-bootstrap';

const CATEGORY_FILTER_THRESHOLD = 10;

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
  onOpenCategory,
  onManageCategories,
  fullscreenPreview,
  theme,
  currentDocument,
  categories,
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");

  const filteredCategories = useMemo(() => {
    if (!categoryFilter.trim() || !categories) return categories || [];
    const lower = categoryFilter.toLowerCase();
    return categories.filter(c => c.toLowerCase().includes(lower));
  }, [categories, categoryFilter]);

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

  const handleCategorySelect = useCallback((category, mode) => {
    if (mode === 'navigate') {
      // Navigate only
      if (onOpenCategory) {
        onOpenCategory(category);
        onHide();
      }
    } else {
      // Default: move + navigate (onChangeCategory now handles both save and navigation)
      if (onChangeCategory && category !== currentDocument?.category) {
        onChangeCategory(category);
        onHide();
      }
    }
    setShowCategoryPicker(false);
    setCategoryFilter("");
  }, [onChangeCategory, onOpenCategory, onHide, currentDocument?.category]);

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
                    <span className="d-flex align-items-center gap-1">
                      <button
                        type="button"
                        className="doc-category-btn"
                        onClick={() => {
                          setShowCategoryPicker(!showCategoryPicker);
                        }}
                        title="Manage category"
                      >
                        <span className="badge bg-secondary">
                          {currentDocument.category || 'General'}
                          <i className="bi bi-chevron-down ms-1" style={{ fontSize: '0.6em' }} />
                        </span>
                      </button>
                      {onManageCategories && (
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0 text-muted"
                          title="Manage categories"
                          onClick={onManageCategories}
                        >
                          <i className="bi bi-gear"></i>
                        </button>
                      )}
                    </span>
                  )}
                </div>

                {/* Category picker — single unified list */}
                {showCategoryPicker && !isGitHubFile && categories && (
                  <>
                    {categories.length > CATEGORY_FILTER_THRESHOLD && (
                      <div className="px-2 mt-2">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Filter categories..."
                          value={categoryFilter}
                          onChange={e => setCategoryFilter(e.target.value)}
                          autoFocus
                        />
                      </div>
                    )}
                    <ul className="mobile-category-list" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                      {filteredCategories.map((cat) => (
                        <li
                          key={cat}
                          className={`d-flex justify-content-between align-items-center ${cat === currentDocument.category ? 'active' : ''}`}
                          onClick={() => cat !== currentDocument.category && handleCategorySelect(cat)}
                          style={cat === currentDocument.category ? { opacity: 0.5 } : {}}
                        >
                          <span>
                            <i className={`bi bi-${cat === currentDocument.category ? 'check-circle-fill' : 'circle'} me-1`} />
                            {cat}
                          </span>
                          <button
                            type="button"
                            className="btn btn-link btn-sm p-0 text-muted"
                            title={`Open ${cat}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCategorySelect(cat, 'navigate');
                            }}
                          >
                            <i className="bi bi-folder2-open"></i>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
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
  onOpenCategory: PropTypes.func,
  onManageCategories: PropTypes.func,
  fullscreenPreview: PropTypes.bool.isRequired,
  theme: PropTypes.string.isRequired,
  currentDocument: PropTypes.object,
  categories: PropTypes.arrayOf(PropTypes.string),
};

export default MobileToolbarMenu;
