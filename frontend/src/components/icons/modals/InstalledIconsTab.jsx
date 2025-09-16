import React, { useState, useEffect, useCallback } from 'react';
import { Row, Col, Form, Button, Card, Badge, Spinner, Alert, Modal } from 'react-bootstrap';
import iconsApi from '../../../api/iconsApi';
import { useNotification } from '../../NotificationProvider';
import IconViewModal from './IconViewModal';

export default function InstalledIconsTab({ iconPacks, onReloadData, packsLoading = false }) {
  const [selectedPack, setSelectedPack] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [icons, setIcons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedIcon, setSelectedIcon] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditMode, setShowEditMode] = useState(false);
  const [operationLoading, setOperationLoading] = useState(false);
  
  const { showSuccess, showError } = useNotification();

  // Load icons when pack selection or search changes
  useEffect(() => {
    loadIcons(true);
  }, [selectedPack, searchTerm]);

  const loadIcons = useCallback(async (reset = false) => {
    if (loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const currentPage = reset ? 0 : page;
      const response = await iconsApi.searchIcons({
        q: searchTerm,
        pack: selectedPack,
        page: currentPage,
        size: 50
      });
      
      if (reset) {
        setIcons(response.icons || []);
        setPage(1); // Set to 1 since we'll be loading the next page
      } else {
        setIcons(prev => [...prev, ...(response.icons || [])]);
        setPage(prev => prev + 1);
      }
      
      setHasMore((response.icons || []).length === 50);
    } catch (err) {
      console.error('Failed to load icons:', err);
      setError('Failed to load icons. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedPack, searchTerm, page, loading]);

  const loadMoreIcons = useCallback(() => {
    if (!loading && hasMore) {
      loadIcons(false);
    }
  }, [loading, hasMore, loadIcons]);

  // Infinite scroll handler
  const handleScroll = useCallback((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const threshold = 100; // pixels from bottom to trigger load
    
    if (scrollHeight - scrollTop - clientHeight < threshold && hasMore && !loading) {
      loadMoreIcons();
    }
  }, [hasMore, loading, loadMoreIcons]);

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
      await iconsApi.deleteIcon(selectedIcon.id);
      
      showSuccess(`Icon "${selectedIcon.key}" deleted successfully!`);
      setShowDeleteModal(false);
      setSelectedIcon(null);
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

  const renderIcon = (icon) => {
    if (!icon.icon_data || !icon.icon_data.body) {
      return <div className="text-muted">No icon data</div>;
    }

    const { body, width = 24, height = 24, viewBox } = icon.icon_data;
    
    return (
      <svg
        width="32"
        height="32"
        viewBox={viewBox || `0 0 ${width} ${height}`}
        fill="currentColor"
        className="icon-svg"
      >
        <g dangerouslySetInnerHTML={{ __html: body }} />
      </svg>
    );
  };

  return (
    <div>
      {/* Search and Filter Controls */}
      <Row className="mb-3">
        <Col md={6}>
          <Form.Group>
            <Form.Label>Search Icons</Form.Label>
            <Form.Control
              type="text"
              placeholder="Search by icon name or keywords..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group>
            <Form.Label>Filter by Pack</Form.Label>
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
          </Form.Group>
        </Col>
      </Row>

      {/* Error Display */}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Icons Grid */}
      <div 
        style={{ 
          maxHeight: '400px', 
          overflowY: 'auto',
          border: '1px solid var(--bs-border-color)',
          borderRadius: '0.375rem',
          padding: '1rem'
        }}
        onScroll={handleScroll}
      >
        {icons.length === 0 && !loading ? (
          <Alert variant="info">
            {searchTerm || selectedPack !== 'all' 
              ? 'No icons found matching your criteria.' 
              : 'No icons installed yet.'}
          </Alert>
        ) : (
          <Row>
            {icons.map((icon, index) => (
              <Col key={`${icon.id}-${index}`} md={6} lg={4} xl={3} className="mb-3">
                <Card 
                  className="h-100 icon-card" 
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    // Don't trigger if clicking on buttons
                    if (!e.target.closest('button')) {
                      handleViewIcon(icon);
                    }
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '';
                  }}
                >
                  <Card.Body className="d-flex flex-column">
                    <div className="d-flex align-items-center mb-2">
                      <div className="me-3 icon-container">
                        {renderIcon(icon)}
                      </div>
                      <div className="flex-grow-1 text-truncate">
                        <strong className="d-block text-truncate">{icon.key}</strong>
                        <small className="text-muted">{icon.full_key}</small>
                      </div>
                    </div>
                    
                    <div className="mb-2">
                      <Badge bg="secondary" className="me-1">
                        {icon.pack ? icon.pack.display_name : 'Unknown Pack'}
                      </Badge>
                    </div>
                    
                    {icon.search_terms && (
                      <small className="text-muted mb-2 text-truncate">
                        Keywords: {icon.search_terms}
                      </small>
                    )}
                    
                    <div className="mt-auto">
                      <small className="text-muted d-block">
                        Used: {icon.access_count || 0} times
                      </small>
                      <div className="mt-2">
                        <Button
                          size="sm"
                          variant="outline-primary"
                          className="me-2"
                          onClick={() => handleEditIcon(icon)}
                        >
                          <i className="bi bi-pencil"></i> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-danger"
                          onClick={() => handleDeleteIcon(icon)}
                        >
                          <i className="bi bi-trash"></i> Delete
                        </Button>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="text-center mt-3">
            <Spinner animation="border" size="sm" />
            <span className="ms-2">Loading more icons...</span>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Delete Icon</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to delete the icon <strong>{selectedIcon?.key}</strong>?</p>
          <p className="text-muted">This action cannot be undone.</p>
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
            {operationLoading ? 'Deleting...' : 'Delete Icon'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Icon View Modal */}
      <IconViewModal
        icon={selectedIcon}
        show={showViewModal}
        initialEditMode={showEditMode}
        onHide={() => {
          setShowViewModal(false);
          setSelectedIcon(null);
          setShowEditMode(false);
        }}
      />

      <style jsx>{`
        .icon-card {
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .icon-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        
        .icon-container {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
        }
        
        .icon-svg {
          max-width: 32px;
          max-height: 32px;
          color: var(--bs-primary);
        }
      `}</style>
    </div>
  );
}
