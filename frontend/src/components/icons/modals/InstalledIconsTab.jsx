import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Form, Button, Card, Badge, Spinner, Alert, Modal } from 'react-bootstrap';
import iconsApi from '../../../api/iconsApi';
import { adminIconsApi } from '../../../api/admin';
import { useNotification } from '../../NotificationProvider';
import IconViewModal from './IconViewModal';
import { cleanSvgBodyForBrowser } from '../../../utils/svgUtils';

export default function InstalledIconsTab({ iconPacks, onReloadData, packsLoading = false }) {
  const [selectedPack, setSelectedPack] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [icons, setIcons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedIcon, setSelectedIcon] = useState(null);
  const [selectedIcons, setSelectedIcons] = useState(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditMode, setShowEditMode] = useState(false);
  const [operationLoading, setOperationLoading] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Use ref to track current page to avoid dependency issues
  const currentPageRef = useRef(0);

  const { showSuccess, showError } = useNotification();

  const loadIcons = useCallback(async (reset = false) => {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const currentPage = reset ? 0 : currentPageRef.current;
      const response = await iconsApi.searchIcons({
        q: searchTerm,
        pack: selectedPack,
        page: currentPage,
        size: 50
      });

      if (reset) {
        setIcons(response.icons || []);
        currentPageRef.current = 1; // Set to 1 since we'll be loading the next page
        setPage(1);
      } else {
        setIcons(prev => [...prev, ...(response.icons || [])]);
        currentPageRef.current = currentPageRef.current + 1;
        setPage(prev => prev + 1);
      }

      setHasMore((response.icons || []).length === 50);
    } catch (err) {
      console.error('Failed to load icons:', err);
      setError('Failed to load icons. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedPack, searchTerm]);

  // Load icons when pack selection or search changes
  useEffect(() => {
    currentPageRef.current = 0;
    loadIcons(true);
  }, [selectedPack, searchTerm, loadIcons]);

  const loadMoreIcons = useCallback(() => {
    if (!loading && hasMore) {
      loadIcons(false);
    }
  }, [hasMore, loadIcons]);

  // Infinite scroll handler
  const handleScroll = useCallback((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const threshold = 100; // pixels from bottom to trigger load

    if (scrollHeight - scrollTop - clientHeight < threshold && hasMore && !loading) {
      loadMoreIcons();
    }
  }, [hasMore, loadMoreIcons]);

  const handleIconSaved = useCallback((updatedIcon) => {
    // Update the icon in the current list
    setIcons(prev => prev.map(icon =>
      icon.id === updatedIcon.id ? updatedIcon : icon
    ));

    // Close the modal
    setShowViewModal(false);
    setSelectedIcon(null);
    setShowEditMode(false);

    showSuccess(`Icon "${updatedIcon.key}" updated successfully!`);
  }, [showSuccess]);

  const handleEditIcon = (icon) => {
    setSelectedIcon(icon);
    setShowEditMode(true);
    setShowViewModal(true);
  };

  const handleDeleteIcon = (icon) => {
    setSelectedIcon(icon);
    setShowDeleteModal(true);
  };

  const handleViewIcon = (icon) => {
    setSelectedIcon(icon);
    setShowEditMode(false);
    setShowViewModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedIcon) return;

    setOperationLoading(true);
    try {
      await adminIconsApi.deleteIcon(selectedIcon.id);

      showSuccess(`Icon "${selectedIcon.key}" deleted successfully!`);
      setShowDeleteModal(false);
      setSelectedIcon(null);
      currentPageRef.current = 0;
      loadIcons(true); // Reload icons

      if (onReloadData) {
        onReloadData();
      }
    } catch (error) {
      console.error('Failed to delete icon:', error);
      showError(`Failed to delete icon: ${error.message}`);
    } finally {
      setOperationLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIcons.size === 0) return;

    setOperationLoading(true);
    try {
      const iconIds = Array.from(selectedIcons);
      const promises = iconIds.map(iconId => adminIconsApi.deleteIcon(iconId));
      await Promise.all(promises);

      showSuccess(`Successfully deleted ${selectedIcons.size} icons!`);
      setShowBulkDeleteModal(false);
      setSelectedIcons(new Set());
      setIsSelectionMode(false);
      currentPageRef.current = 0;
      loadIcons(true); // Reload icons

      if (onReloadData) {
        onReloadData();
      }
    } catch (error) {
      console.error('Failed to delete icons:', error);
      showError(`Failed to delete icons: ${error.message}`);
    } finally {
      setOperationLoading(false);
    }
  };

  const toggleIconSelection = (iconId) => {
    setSelectedIcons(prev => {
      const newSet = new Set(prev);
      if (newSet.has(iconId)) {
        newSet.delete(iconId);
      } else {
        newSet.add(iconId);
      }
      return newSet;
    });
  };

  const selectAllVisibleIcons = () => {
    const allIds = new Set(icons.map(icon => icon.id));
    setSelectedIcons(allIds);
  };

  const clearSelection = () => {
    setSelectedIcons(new Set());
    setIsSelectionMode(false);
  };

  const renderIcon = (icon) => {
    if (!icon.icon_data || !icon.icon_data.body) {
      return <div className="text-muted">No icon data</div>;
    }

    const { body, width = 24, height = 24, viewBox } = icon.icon_data;

    // Clean the body content to remove namespaces for browser compatibility
    const cleanedBody = cleanSvgBodyForBrowser(body);

    return (
      <svg
        width="32"
        height="32"
        viewBox={viewBox || `0 0 ${width} ${height}`}
        fill="currentColor"
        className="icon-svg"
      >
        <g dangerouslySetInnerHTML={{ __html: cleanedBody }} />
      </svg>
    );
  };

  const getPackStats = () => {
    const total = iconPacks.reduce((sum, pack) => sum + pack.icon_count, 0);
    const selectedPackData = iconPacks.find(pack => pack.name === selectedPack);

    if (selectedPack === 'all') {
      return {
        total,
        packs: iconPacks.length,
        current: icons.length
      };
    } else if (selectedPackData) {
      return {
        total: selectedPackData.icon_count,
        packs: 1,
        current: icons.length
      };
    }
    return { total: 0, packs: 0, current: 0 };
  };

  const stats = getPackStats();

  return (
    <div className="installed-icons-tab">
      {/* Header with Search and Controls */}
      <div className="icons-header">
        <div className="search-and-controls">
          <div className="search-container">
            <Form.Control
              type="text"
              placeholder="Search by icon name or keywords..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="pack-filter-container">
            <Form.Select
              value={selectedPack}
              onChange={(e) => setSelectedPack(e.target.value)}
              disabled={packsLoading}
            >
              <option value="all">
                {packsLoading ? 'Loading packs...' : 'All Packs'}
              </option>
              {iconPacks.map(pack => (
                <option key={pack.id} value={pack.name}>
                  {pack.display_name} ({pack.icon_count} icons)
                </option>
              ))}
            </Form.Select>
          </div>

          <div className="actions-container">
            {isSelectionMode ? (
              <>
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={selectAllVisibleIcons}
                  disabled={icons.length === 0}
                >
                  Select All
                </Button>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={clearSelection}
                >
                  Clear ({selectedIcons.size})
                </Button>
                {selectedIcons.size > 0 && (
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => setShowBulkDeleteModal(true)}
                  >
                    <i className="bi bi-trash me-1"></i>
                    Delete Selected
                  </Button>
                )}
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => setIsSelectionMode(false)}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setIsSelectionMode(true)}
                disabled={icons.length === 0}
              >
                <i className="bi bi-check-square me-1"></i>
                Bulk Actions
              </Button>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="stats-row">
          <div className="pack-stats">
            <div className="stat-item">
              <i className="bi bi-collection"></i>
              <span>{stats.packs} pack{stats.packs !== 1 ? 's' : ''}</span>
            </div>
            <div className="stat-item">
              <i className="bi bi-images"></i>
              <span>{stats.total} total icon{stats.total !== 1 ? 's' : ''}</span>
            </div>
            <div className="stat-item">
              <i className="bi bi-eye"></i>
              <span>Showing {stats.current}</span>
            </div>
          </div>
          {isSelectionMode && (
            <div className="selection-info">
              <Badge bg="primary">{selectedIcons.size} selected</Badge>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError(null)} className="mt-2">
            {error}
          </Alert>
        )}
      </div>

      {/* Scrollable Icons Grid */}
      <div className="icons-grid-container" onScroll={handleScroll}>
        {icons.length === 0 && !loading ? (
          <div className="empty-state">
            <i className="bi bi-collection empty-icon"></i>
            <h6>No Icons Found</h6>
            <p>
              {searchTerm || selectedPack !== 'all'
                ? 'No icons found matching your criteria. Try adjusting your search or filter.'
                : 'No icons installed yet. Use the other tabs to browse and install icon packs.'}
            </p>
          </div>
        ) : (
          <div className="icons-grid">
            {icons.map((icon) => (
              <Card
                key={icon.id}
                className={`icon-card ${
                  selectedIcons.has(icon.id) ? 'selected' : ''
                }`}
                onClick={(e) => {
                  // Handle selection mode
                  if (isSelectionMode) {
                    toggleIconSelection(icon.id);
                    return;
                  }

                  // Don't trigger if clicking on buttons
                  if (!e.target.closest('button')) {
                    handleViewIcon(icon);
                  }
                }}
              >
                <Card.Body>
                  {/* Icon Header */}
                  <div className="icon-header">
                    <div className="icon-preview">
                      {renderIcon(icon)}
                    </div>
                    <div className="icon-info">
                      <h6 className="icon-name">{icon.key}</h6>
                      <p className="icon-full-key">{icon.full_key}</p>
                    </div>
                    {isSelectionMode && (
                      <Form.Check
                        type="checkbox"
                        checked={selectedIcons.has(icon.id)}
                        onChange={() => toggleIconSelection(icon.id)}
                      />
                    )}
                  </div>

                  {/* Badges */}
                  <div className="icon-badges">
                    <Badge bg="secondary">
                      {icon.pack ? icon.pack.display_name : 'Unknown Pack'}
                    </Badge>
                    {icon.pack?.category && (
                      <Badge bg="outline-primary">
                        {icon.pack.category}
                      </Badge>
                    )}
                  </div>

                  {/* Details */}
                  <div className="icon-details">
                    {icon.search_terms && (
                      <p className="search-terms">
                        <strong>Keywords:</strong> {icon.search_terms}
                      </p>
                    )}
                    <p className="usage-stats">
                      <i className="bi bi-graph-up"></i>
                      <span>Used {icon.access_count || 0} times</span>
                    </p>
                  </div>

                  {/* Actions */}
                  {!isSelectionMode && (
                    <div className="icon-actions">
                      <Button
                        size="sm"
                        variant="outline-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditIcon(icon);
                        }}
                      >
                        <i className="bi bi-pencil me-1"></i>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteIcon(icon);
                        }}
                      >
                        <i className="bi bi-trash me-1"></i>
                        Delete
                      </Button>
                    </div>
                  )}
                </Card.Body>
              </Card>
            ))}
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="loading-state">
            <Spinner animation="border" size="sm" />
            <div className="mt-2">Loading more icons...</div>
          </div>
        )}
      </div>

      {/* Single Icon Delete Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="text-danger">
            <i className="bi bi-exclamation-triangle me-2"></i>
            Delete Icon
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedIcon && (
            <div>
              <p>
                Are you sure you want to delete the icon <strong>&quot;{selectedIcon.key}&quot;</strong>?
              </p>
              <Card className="mb-3">
                <Card.Body>
                  <div className="d-flex align-items-center">
                    <div className="me-3">
                      {renderIcon(selectedIcon)}
                    </div>
                    <div>
                      <h6 className="mb-1">{selectedIcon.key}</h6>
                      <small className="text-muted">{selectedIcon.full_key}</small>
                      <div className="mt-1">
                        <Badge bg="secondary" className="me-1">
                          {selectedIcon.pack?.display_name || 'Unknown Pack'}
                        </Badge>
                        <small className="text-muted">
                          Used {selectedIcon.access_count || 0} times
                        </small>
                      </div>
                    </div>
                  </div>
                </Card.Body>
              </Card>
              <Alert variant="danger" className="mb-0">
                <i className="bi bi-exclamation-triangle me-2"></i>
                <strong>This action cannot be undone!</strong>
              </Alert>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowDeleteModal(false)}
            disabled={operationLoading}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirmDelete}
            disabled={operationLoading}
          >
            {operationLoading ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Deleting...
              </>
            ) : (
              <>
                <i className="bi bi-trash me-2"></i>
                Delete Icon
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Bulk Delete Modal */}
      <Modal show={showBulkDeleteModal} onHide={() => setShowBulkDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="text-danger">
            <i className="bi bi-exclamation-triangle me-2"></i>
            Delete Multiple Icons
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div>
            <p>
              Are you sure you want to delete <strong>{selectedIcons.size} selected icons</strong>?
            </p>
            <Alert variant="danger">
              <i className="bi bi-exclamation-triangle me-2"></i>
              <strong>This action cannot be undone!</strong>
              <br />
              All {selectedIcons.size} selected icons will be permanently deleted.
            </Alert>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowBulkDeleteModal(false)}
            disabled={operationLoading}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleBulkDelete}
            disabled={operationLoading}
          >
            {operationLoading ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Deleting...
              </>
            ) : (
              <>
                <i className="bi bi-trash me-2"></i>
                Delete {selectedIcons.size} Icons
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Icon View Modal */}
      <IconViewModal
        key={`${selectedIcon?.id}-${selectedIcon?.key}`} // Force re-mount when icon changes
        icon={selectedIcon}
        show={showViewModal}
        initialEditMode={showEditMode}
        onSave={handleIconSaved}
        onHide={() => {
          setShowViewModal(false);
          setSelectedIcon(null);
          setShowEditMode(false);
        }}
      />
    </div>
  );
}