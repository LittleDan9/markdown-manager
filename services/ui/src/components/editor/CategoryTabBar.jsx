import React, { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Nav, Dropdown } from 'react-bootstrap';

/**
 * CategoryTabBar - Displays sibling documents as switchable tabs.
 * Supports horizontal scroll with overflow dropdown, inline rename, and new doc creation.
 */
function CategoryTabBar({
  siblings,
  activeDocId,
  categoryName,
  position = 'above',
  onTabClick,
  onRename,
  onDelete,
  onAddDocument,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [showLeftChevron, setShowLeftChevron] = useState(false);
  const [showRightChevron, setShowRightChevron] = useState(false);
  const [filterText, setFilterText] = useState('');
  const scrollRef = useRef(null);
  const editInputRef = useRef(null);
  const activeTabRef = useRef(null);
  const leftSentinelRef = useRef(null);
  const rightSentinelRef = useRef(null);

  // Overflow detection via IntersectionObserver on sentinel elements
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.target === leftSentinelRef.current) {
            setShowLeftChevron(!entry.isIntersecting);
          }
          if (entry.target === rightSentinelRef.current) {
            setShowRightChevron(!entry.isIntersecting);
          }
        });
      },
      { root: container, threshold: 0.9 }
    );

    if (leftSentinelRef.current) observer.observe(leftSentinelRef.current);
    if (rightSentinelRef.current) observer.observe(rightSentinelRef.current);

    return () => observer.disconnect();
  }, [siblings]);

  // Auto-scroll active tab into view
  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [activeDocId]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const scrollLeft = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  }, []);

  const scrollRight = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  }, []);

  const startRename = useCallback((id, name) => {
    setEditingId(id);
    setEditValue(name);
  }, []);

  const commitRename = useCallback(() => {
    if (editingId && editValue.trim() && onRename) {
      onRename(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue('');
  }, [editingId, editValue, onRename]);

  const cancelRename = useCallback(() => {
    setEditingId(null);
    setEditValue('');
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      commitRename();
    } else if (e.key === 'Escape') {
      cancelRename();
    }
  }, [commitRename, cancelRename]);

  const handleAddClick = useCallback(() => {
    if (onAddDocument) {
      onAddDocument((newDocId, newDocName) => {
        // After new doc is created, enter rename mode on it
        if (newDocId) {
          startRename(newDocId, newDocName || 'Untitled');
        }
      });
    }
  }, [onAddDocument, startRename]);

  const showOverflowDropdown = siblings.length > 10;
  const filteredDropdownItems = filterText
    ? siblings.filter(s => s.name.toLowerCase().includes(filterText.toLowerCase()))
    : siblings;

  if (!siblings || siblings.length === 0) return null;

  return (
    <div className={`category-tab-bar${position === 'below' ? ' category-tab-bar--below' : ''}`}>
      {categoryName && (
        <span className="category-tab-bar__label" title={categoryName}>
          {categoryName}
        </span>
      )}

      {showLeftChevron && (
        <button
          className="category-tab-bar__chevron category-tab-bar__chevron--left"
          onClick={scrollLeft}
          aria-label="Scroll tabs left"
        >
          <i className="bi bi-chevron-left" />
        </button>
      )}

      <Nav
        variant="tabs"
        className="category-tab-bar__nav"
        ref={scrollRef}
      >
        <span ref={leftSentinelRef} className="category-tab-bar__sentinel" />

        {siblings.map(doc => (
          <Nav.Item key={doc.id} className="category-tab-bar__item">
            <Nav.Link
              ref={doc.id === activeDocId ? activeTabRef : undefined}
              active={doc.id === activeDocId}
              onClick={() => {
                if (editingId !== doc.id) onTabClick(doc.id);
              }}
              onDoubleClick={() => startRename(doc.id, doc.name)}
              className="category-tab-bar__link"
              title={doc.name}
            >
              {editingId === doc.id ? (
                <input
                  ref={editInputRef}
                  className="category-tab-bar__rename-input"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={handleKeyDown}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <>
                  <span className="category-tab-bar__name">{doc.name}</span>
                  {onDelete && (
                    <button
                      className="category-tab-bar__close-btn"
                      onClick={e => { e.stopPropagation(); onDelete(doc.id, doc.name); }}
                      title={`Delete ${doc.name}`}
                      aria-label={`Delete ${doc.name}`}
                    >
                      <i className="bi bi-x" />
                    </button>
                  )}
                </>
              )}
            </Nav.Link>
          </Nav.Item>
        ))}

        <span ref={rightSentinelRef} className="category-tab-bar__sentinel" />
      </Nav>

      {showRightChevron && (
        <button
          className="category-tab-bar__chevron category-tab-bar__chevron--right"
          onClick={scrollRight}
          aria-label="Scroll tabs right"
        >
          <i className="bi bi-chevron-right" />
        </button>
      )}

      {showOverflowDropdown && (
        <Dropdown align="end" className="category-tab-bar__overflow">
          <Dropdown.Toggle variant="link" size="sm" className="category-tab-bar__overflow-btn">
            <i className="bi bi-three-dots" />
          </Dropdown.Toggle>
          <Dropdown.Menu className="category-tab-bar__overflow-menu">
            {siblings.length > 20 && (
              <div className="category-tab-bar__overflow-search">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Filter tabs..."
                  value={filterText}
                  onChange={e => setFilterText(e.target.value)}
                  onClick={e => e.stopPropagation()}
                />
              </div>
            )}
            {filteredDropdownItems.map(doc => (
              <Dropdown.Item
                key={doc.id}
                active={doc.id === activeDocId}
                onClick={() => onTabClick(doc.id)}
              >
                {doc.id === activeDocId && <i className="bi bi-check me-1" />}
                {doc.name}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown>
      )}

      <button
        className="category-tab-bar__add-btn"
        onClick={handleAddClick}
        title="New document in this category"
        aria-label="Add new document"
      >
        <i className="bi bi-plus" />
      </button>
    </div>
  );
}

CategoryTabBar.propTypes = {
  siblings: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    name: PropTypes.string.isRequired,
  })).isRequired,
  activeDocId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  categoryName: PropTypes.string,
  position: PropTypes.oneOf(['above', 'below']),
  onTabClick: PropTypes.func.isRequired,
  onRename: PropTypes.func,
  onDelete: PropTypes.func,
  onAddDocument: PropTypes.func,
};

export default CategoryTabBar;
