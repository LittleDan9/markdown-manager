import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Form,
  Button,
  Spinner,
  Alert,
  Badge,
  OverlayTrigger,
  Tooltip,
  Modal
} from 'react-bootstrap';
import { useNotification } from '../NotificationProvider';

export default function IconifyBrowser({ onReloadData }) {
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [icons, setIcons] = useState([]);
  const [selectedIcons, setSelectedIcons] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [iconsLoading, setIconsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const [iconSearch, setIconSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [entirePackModalOpen, setEntirePackModalOpen] = useState(false);
  const [installConfig, setInstallConfig] = useState({
    packName: '',
    category: 'iconify',
    description: ''
  });

  const { showSuccess, showError } = useNotification();

  // Add styles for proper icon scaling
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .icon-svg-container svg {
        max-width: 100% !important;
        max-height: 100% !important;
        width: auto !important;
        height: auto !important;
        display: block !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Fetch collections
  const fetchCollections = useCallback(async (query = '', category = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '100',
        offset: '0'
      });

      if (query) params.append('query', query);
      if (category) params.append('category', category);

      const response = await fetch(`/api/iconify/collections?${params}`);
      const data = await response.json();

      if (data.success) {
        setCollections(Object.entries(data.data.collections).map(([prefix, info]) => ({
          prefix,
          ...info
        })));
      } else {
        throw new Error(data.message || 'Failed to fetch collections');
      }
    } catch (error) {
      showError(`Failed to load collections: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/iconify/categories');
      const data = await response.json();

      if (data.success) {
        setCategories(data.data.categories);
      }
    } catch (error) {
      console.warn('Failed to load categories:', error);
    }
  }, []);

  // Fetch icons from selected collection
  const fetchIcons = useCallback(async (prefix, page = 0, search = '', reset = false) => {
    if (!prefix) return;

    setIconsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: '48'
      });

      if (search.trim()) {
        params.append('search', search);
      }

      const response = await fetch(`/api/iconify/collections/${prefix}/icons?${params}`);
      const data = await response.json();

      if (data.success) {
        const newIcons = data.data.icons;
        setIcons(prev => reset ? newIcons : [...prev, ...newIcons]);
        setHasMore(data.data.has_more);
        setCurrentPage(page);
      } else {
        throw new Error(data.message || 'Failed to fetch icons');
      }
    } catch (error) {
      showError(`Failed to load icons: ${error.message}`);
    } finally {
      setIconsLoading(false);
    }
  }, [showError]);

  // Install selected icons
  const installIcons = async () => {
    if (!selectedCollection || selectedIcons.size === 0) return;

    try {
      const iconNames = Array.from(selectedIcons);
      const packName = installConfig.packName || selectedCollection.prefix;

      const response = await fetch(`/api/iconify/collections/${selectedCollection.prefix}/install`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          icon_names: iconNames,
          pack_name: packName,
          category: installConfig.category,
          description: installConfig.description
        })
      });

      const data = await response.json();

      if (data.success) {
        showSuccess(data.message);
        setInstallModalOpen(false);
        setSelectedIcons(new Set());
        setInstallConfig({
          packName: '',
          category: 'iconify',
          description: ''
        });
        if (onReloadData) onReloadData();
      } else {
        throw new Error(data.message || 'Failed to install icons');
      }
    } catch (error) {
      showError(`Installation failed: ${error.message}`);
    }
  };

  const installEntirePack = async () => {
    if (!selectedCollection) return;

    try {
      const packName = installConfig.packName || selectedCollection.prefix;

      const response = await fetch(`/api/iconify/collections/${selectedCollection.prefix}/install`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          install_all: true,
          pack_name: packName,
          category: installConfig.category,
          description: installConfig.description
        })
      });

      const data = await response.json();

      if (data.success) {
        showSuccess(data.message);
        setEntirePackModalOpen(false);
        setInstallConfig({
          packName: '',
          category: 'iconify',
          description: ''
        });
        if (onReloadData) onReloadData();
      } else {
        throw new Error(data.message || 'Failed to install entire pack');
      }
    } catch (error) {
      showError(`Installation failed: ${error.message}`);
    }
  };

  // Initialize
  useEffect(() => {
    fetchCollections();
    fetchCategories();
  }, [fetchCollections, fetchCategories]);

  // Search collections
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchCollections(searchQuery, categoryFilter);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, categoryFilter, fetchCollections]);

  // Search icons in collection
  useEffect(() => {
    if (selectedCollection) {
      const timeoutId = setTimeout(() => {
        fetchIcons(selectedCollection.prefix, 0, iconSearch, true);
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [iconSearch, selectedCollection, fetchIcons]);

  const selectCollection = (collection) => {
    setSelectedCollection(collection);
    setIcons([]);
    setSelectedIcons(new Set());
    setIconSearch('');
    setCurrentPage(0);
    setHasMore(false);
    fetchIcons(collection.prefix, 0, '', true);
  };

  const toggleIconSelection = (iconName) => {
    setSelectedIcons(prev => {
      const newSet = new Set(prev);
      if (newSet.has(iconName)) {
        newSet.delete(iconName);
      } else {
        newSet.add(iconName);
      }
      return newSet;
    });
  };

  const selectAllVisibleIcons = () => {
    setSelectedIcons(prev => {
      const newSet = new Set(prev);
      icons.forEach(icon => newSet.add(icon.name));
      return newSet;
    });
  };

  const loadMoreIcons = useCallback(() => {
    if (selectedCollection && hasMore && !iconsLoading) {
      fetchIcons(selectedCollection.prefix, currentPage + 1, iconSearch, false);
    }
  }, [selectedCollection, hasMore, iconsLoading, fetchIcons, currentPage, iconSearch]);

  const openInstallModal = () => {
    setInstallConfig({
      packName: selectedCollection?.prefix || '',
      category: 'iconify',
      description: `Icons from ${selectedCollection?.name || 'collection'}`
    });
    setInstallModalOpen(true);
  };

  const openEntirePackModal = () => {
    setInstallConfig({
      packName: selectedCollection?.prefix || '',
      category: 'iconify',
      description: `Complete ${selectedCollection?.name || 'collection'} icon pack`
    });
    setEntirePackModalOpen(true);
  };

  const clearSelection = () => {
    setSelectedIcons(new Set());
  };

  // Infinite scroll handler for icons grid
  const handleIconsScroll = useCallback((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const threshold = 100; // pixels from bottom to trigger load
    
    if (scrollHeight - scrollTop - clientHeight < threshold && hasMore && !iconsLoading && selectedCollection) {
      loadMoreIcons();
    }
  }, [hasMore, iconsLoading, selectedCollection, loadMoreIcons]);

  return (
    <>
      <div className="row g-0">
        {/* Collections Sidebar */}
        <div className="col-md-4" style={{ borderRight: '1px solid var(--bs-border-color)' }}>
          <div className="p-3" style={{ borderBottom: '1px solid var(--bs-border-color)' }}>
            <h6 className="mb-3">Icon Collections</h6>

            {/* Search and Filter */}
            <Form.Control
              type="text"
              placeholder="Search collections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mb-2"
            />

            <Form.Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              size="sm"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </Form.Select>
          </div>

          {/* Collections List */}
          <div style={{ height: '400px', overflowY: 'auto', padding: '1rem' }}>
            {loading ? (
              <div className="text-center py-4">
                <Spinner animation="border" size="sm" />
                <div className="mt-2">Loading collections...</div>
              </div>
            ) : (
              collections.map(collection => (
                <Card
                  key={collection.prefix}
                  className={`mb-2 cursor-pointer ${
                    selectedCollection?.prefix === collection.prefix ? 'border-primary' : ''
                  }`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => selectCollection(collection)}
                >
                  <Card.Body className="p-3">
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <h6 className="mb-1">{collection.name}</h6>
                        <small className="text-muted">{collection.prefix}</small>
                      </div>
                      <Badge bg="secondary">{collection.total}</Badge>
                    </div>
                    {collection.category && (
                      <Badge bg="outline-primary" className="mt-2">
                        {collection.category}
                      </Badge>
                    )}
                    {collection.samples && (
                      <div className="mt-2">
                        <div className="d-flex flex-wrap">
                          {collection.samples.slice(0, 3).map(sample => (
                            <small key={sample} className="text-muted me-2">
                              {sample}
                            </small>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Icons Grid */}
        <div className="col-md-8">
          {selectedCollection ? (
            <>
              {/* Header */}
              <div className="p-3" style={{ borderBottom: '1px solid var(--bs-border-color)' }}>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="mb-0">{selectedCollection.name}</h6>
                    <small className="text-muted">
                      {selectedIcons.size} selected of {icons.length} loaded
                    </small>
                  </div>
                  <div>
                    <Button
                      variant="outline-success"
                      size="sm"
                      className="me-2"
                      onClick={openEntirePackModal}
                    >
                      <i className="bi bi-download me-1"></i>
                      Import Entire Pack
                    </Button>
                    {selectedIcons.size > 0 && (
                      <>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          className="me-2"
                          onClick={clearSelection}
                        >
                          Clear Selection
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={openInstallModal}
                        >
                          Install {selectedIcons.size} Icons
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Search and Controls */}
              <div className="p-3" style={{ borderBottom: '1px solid var(--bs-border-color)' }}>
                <div className="row">
                  <div className="col-md-8">
                    <Form.Control
                      type="text"
                      placeholder="Search icons in collection..."
                      value={iconSearch}
                      onChange={(e) => setIconSearch(e.target.value)}
                    />
                    <div className="mt-2">
                      <small className="text-muted me-3">Try: </small>
                      {['home', 'user', 'heart', 'star', 'search', 'check'].map(term => (
                        <Button
                          key={term}
                          variant="outline-secondary"
                          size="sm"
                          className="me-2 mb-1"
                          onClick={() => setIconSearch(term)}
                        >
                          {term}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="col-md-4 text-end">
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={selectAllVisibleIcons}
                      disabled={icons.length === 0}
                    >
                      Select All Visible
                    </Button>
                  </div>
                </div>
              </div>

              {/* Icons Grid */}
              <div 
                style={{ height: '350px', overflowY: 'auto', padding: '1rem' }}
                onScroll={handleIconsScroll}
              >
                <div className="row g-2">
                  {icons.map(icon => (
                    <div key={icon.name} className="col-2">
                      <OverlayTrigger
                        placement="top"
                        overlay={
                          <Tooltip>
                            {icon.name}
                            <br />
                            {icon.width}x{icon.height}
                          </Tooltip>
                        }
                      >
                        <Card
                          className={`h-100 cursor-pointer ${
                            selectedIcons.has(icon.name) ? 'border-primary bg-light' : ''
                          }`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => toggleIconSelection(icon.name)}
                        >
                          <Card.Body className="p-2 text-center">
                            <div
                              className="mb-1 icon-svg-container"
                              dangerouslySetInnerHTML={{ __html: icon.svg }}
                              style={{
                                height: '32px',
                                width: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto'
                              }}
                            />
                            <small className="text-muted d-block text-truncate">
                              {icon.name}
                            </small>
                          </Card.Body>
                        </Card>
                      </OverlayTrigger>
                    </div>
                  ))}
                </div>

                {/* Loading indicator */}
                {iconsLoading && (
                  <div className="text-center py-4">
                    <Spinner animation="border" size="sm" />
                    <div className="mt-2">Loading more icons...</div>
                  </div>
                )}
                
                {icons.length === 0 && !iconsLoading && (
                  <Alert variant="info" className="mt-3">
                    {!iconSearch.trim() ? (
                      <>
                        <h6>No Icons Available</h6>
                        <p className="mb-0">
                          This collection appears to be empty or failed to load.
                          <br />
                          Try refreshing or selecting a different collection.
                        </p>
                      </>
                    ) : (
                      <>
                        <h6>No Icons Found</h6>
                        <p className="mb-0">
                          No icons found for "{iconSearch}". Try a different search term.
                        </p>
                      </>
                    )}
                  </Alert>
                )}
              </div>
            </>
          ) : (
            <div className="d-flex align-items-center justify-content-center" style={{ height: '500px' }}>
              <div className="text-center">
                <h6>Select a Collection</h6>
                <p className="text-muted">
                  Choose an icon collection from the left to browse and install icons
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Install Modal */}
      <Modal show={installModalOpen} onHide={() => setInstallModalOpen(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Install Icon Pack</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Pack Name</Form.Label>
              <Form.Control
                type="text"
                value={installConfig.packName}
                onChange={(e) => setInstallConfig(prev => ({
                  ...prev,
                  packName: e.target.value
                }))}
                placeholder="Enter pack name"
              />
              <Form.Text className="text-muted">
                Will be used as the identifier for this icon pack
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Category</Form.Label>
              <Form.Control
                type="text"
                value={installConfig.category}
                onChange={(e) => setInstallConfig(prev => ({
                  ...prev,
                  category: e.target.value
                }))}
                placeholder="iconify"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={installConfig.description}
                onChange={(e) => setInstallConfig(prev => ({
                  ...prev,
                  description: e.target.value
                }))}
                placeholder="Optional description for the icon pack"
              />
            </Form.Group>

            <Alert variant="info">
              <strong>Installing {selectedIcons.size} icons</strong> from {selectedCollection?.name}
            </Alert>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setInstallModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={installIcons}
            disabled={!installConfig.packName}
          >
            Install Icons
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Install Entire Pack Modal */}
      <Modal show={entirePackModalOpen} onHide={() => setEntirePackModalOpen(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Install Entire Icon Pack</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Pack Name</Form.Label>
              <Form.Control
                type="text"
                value={installConfig.packName}
                onChange={(e) => setInstallConfig(prev => ({
                  ...prev,
                  packName: e.target.value
                }))}
                placeholder="Enter pack name"
              />
              <Form.Text className="text-muted">
                Will be used as the identifier for this icon pack
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Category</Form.Label>
              <Form.Control
                type="text"
                value={installConfig.category}
                onChange={(e) => setInstallConfig(prev => ({
                  ...prev,
                  category: e.target.value
                }))}
                placeholder="iconify"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={installConfig.description}
                onChange={(e) => setInstallConfig(prev => ({
                  ...prev,
                  description: e.target.value
                }))}
                placeholder="Optional description for the icon pack"
              />
            </Form.Group>

            <Alert variant="warning">
              <strong>Installing entire collection</strong> from {selectedCollection?.name}
              <br />
              <small>This will install all available icons from this collection. This may take some time.</small>
            </Alert>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setEntirePackModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={installEntirePack}
            disabled={!installConfig.packName}
          >
            Install Entire Pack
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
