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
import PackCategorySelector from './common/PackCategorySelector';
import iconsApi from '../../api/iconsApi';

export default function ThirdPartyIconBrowser({
  categories = [],
  packNames = [],
  dropdownPackNames = [],
  onAddCategory,
  onAddPackName,
  onReloadData
}) {
  const [sources, setSources] = useState([]);
  const [selectedSource, setSelectedSource] = useState('iconify'); // Default to iconify for backward compatibility
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [icons, setIcons] = useState([]);
  const [selectedIcons, setSelectedIcons] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [iconsLoading, setIconsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [iconSearch, setIconSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [entirePackModalOpen, setEntirePackModalOpen] = useState(false);
  const [installConfig, setInstallConfig] = useState({
    packName: '',
    category: categories.length > 0 ? categories[0] : '',
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

  // Fetch available sources
  const fetchSources = useCallback(async () => {
    try {
      const data = await iconsApi.getThirdPartySources();

      if (data.success) {
        setSources(data.data.sources);
      } else {
        throw new Error(data.message || 'Failed to fetch sources');
      }
    } catch (error) {
      showError(`Failed to load sources: ${error.message}`);
      // Fallback to Iconify only
      setSources([{
        id: 'iconify',
        name: 'Iconify',
        description: 'Comprehensive icon framework',
        type: 'icons'
      }]);
    }
  }, [showError]);

  // Fetch collections
  const fetchCollections = useCallback(async (query = '', category = '') => {
    setLoading(true);
    try {
      const data = await iconsApi.getThirdPartyCollections(selectedSource, query, category);

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
  }, [selectedSource, showError]);

  // Fetch categories
  // Note: Categories are now passed as props from IconManagementModal
  // const fetchCategories = useCallback(async () => {
  //   try {
  //     const response = await fetch(`/api/third-party/sources/${selectedSource}/categories`);
  //     const data = await response.json();

  //     if (data.success) {
  //       setCategories(data.data.categories);
  //     }
  //   } catch (error) {
  //     console.warn('Failed to load categories:', error);
  //   }
  // }, [selectedSource]);

  // Fetch icons from selected collection
  const fetchIcons = useCallback(async (prefix, page = 0, search = '', reset = false) => {
    if (!prefix) return;

    setIconsLoading(true);
    try {
      const data = await iconsApi.getThirdPartyIcons(selectedSource, prefix, page, search);

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
  }, [selectedSource, showError]);

  // Install selected icons
  const installIcons = async () => {
    if (!selectedCollection || selectedIcons.size === 0) return;

    try {
      const iconNames = Array.from(selectedIcons);
      const packName = installConfig.packName || selectedCollection.prefix;

      const data = await iconsApi.installThirdPartyIcons(
        selectedSource,
        selectedCollection.prefix,
        iconNames,
        packName,
        installConfig.category,
        installConfig.description
      );

      if (data.success) {
        showSuccess(data.message);
        setInstallModalOpen(false);
        setSelectedIcons(new Set());
        setInstallConfig({
          packName: '',
          category: selectedSource,
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

      const data = await iconsApi.installEntireThirdPartyCollection(
        selectedSource,
        selectedCollection.prefix,
        packName,
        installConfig.category,
        installConfig.description
      );

      if (data.success) {
        showSuccess(data.message);
        setEntirePackModalOpen(false);
        setInstallConfig({
          packName: '',
          category: selectedSource,
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
    fetchSources();
  }, [fetchSources]);

  // Load collections when source changes
  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

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
      category: selectedSource,
      description: `Icons from ${selectedCollection?.name || 'collection'}`
    });
    setInstallModalOpen(true);
  };

  const openEntirePackModal = () => {
    setInstallConfig({
      packName: selectedCollection?.prefix || '',
      category: selectedSource,
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
      <div className="third-party-icon-browser">
        <div className="browser-layout">
          {/* Collections Panel */}
          <div className="collections-panel">
            <div className="collections-panel-header">
              <h6>Third-Party Icon Sources</h6>

              {/* Source Selector */}
              <Form.Select
                value={selectedSource}
                onChange={(e) => {
                  setSelectedSource(e.target.value);
                  setSelectedCollection(null);
                  setIcons([]);
                  setSelectedIcons(new Set());
                  setSearchQuery('');
                  setCategoryFilter('');
                  setIconSearch('');
                }}
              >
                {sources.map(source => (
                  <option key={source.id} value={source.id}>
                    {source.name} - {source.description}
                  </option>
                ))}
              </Form.Select>

              {/* Search and Filter */}
              <Form.Control
                type="text"
                placeholder="Search collections..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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

            {/* Scrollable Collections List */}
            <div className="collections-scroll-area">
              {loading ? (
                <div className="loading-state">
                  <Spinner animation="border" size="sm" />
                  <div className="mt-2">Loading collections...</div>
                </div>
              ) : (
                collections.map(collection => (
                  <Card
                    key={collection.prefix}
                    className={`collection-item ${
                      selectedCollection?.prefix === collection.prefix ? 'selected' : ''
                    }`}
                    onClick={() => selectCollection(collection)}
                  >
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <h6 className="mb-1 fs-6">{collection.name}</h6>
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

          {/* Icons Panel */}
          <div className="icons-panel">
            {selectedCollection ? (
              <>
                {/* Icons Header */}
                <div className="icons-panel-header">
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
                <div className="icons-panel-controls">
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

                {/* Scrollable Icons Grid */}
                <div className="icons-scroll-area" onScroll={handleIconsScroll}>
                  <div className="icons-grid">
                    {icons.map(icon => (
                      <OverlayTrigger
                        key={icon.name}
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
                          className={`icon-item ${
                            selectedIcons.has(icon.name) ? 'selected' : ''
                          }`}
                          onClick={() => toggleIconSelection(icon.name)}
                        >
                          <Card.Body>
                            <div
                              className="icon-display"
                              dangerouslySetInnerHTML={{ __html: icon.svg }}
                            />
                            <small className="icon-name text-muted">
                              {icon.name}
                            </small>
                          </Card.Body>
                        </Card>
                      </OverlayTrigger>
                    ))}
                  </div>

                  {/* Loading indicator */}
                  {iconsLoading && (
                    <div className="loading-state">
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
                            No icons found for &quot;{iconSearch}&quot;. Try a different search term.
                          </p>
                        </>
                      )}
                    </Alert>
                  )}
                </div>
              </>
            ) : (
              <div className="empty-state-panel">
                <div>
                  <h6>Select a Collection</h6>
                  <p className="text-muted">
                    Choose an icon collection from the left to browse and install icons
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    {/* Install Modal */}
    <Modal show={installModalOpen} onHide={() => setInstallModalOpen(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Install Icon Pack</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <PackCategorySelector
              packName={installConfig.packName}
              onPackNameChange={(value) => setInstallConfig(prev => ({
                ...prev,
                packName: value
              }))}
              packNames={packNames}
              dropdownPackNames={dropdownPackNames}
              onAddPackName={onAddPackName}
              packNameLabel="Pack Name"
              packNamePlaceholder="Enter pack name"
              packNameRequired={true}
              showPackNameDropdown={dropdownPackNames.length > 0}

              category={installConfig.category}
              onCategoryChange={(value) => setInstallConfig(prev => ({
                ...prev,
                category: value
              }))}
              categories={categories}
              onAddCategory={onAddCategory}
              categoryLabel="Category"
              categoryPlaceholder={selectedSource}
              categoryRequired={true}

              loading={loading}
              disabled={loading}
            />

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
            <PackCategorySelector
              packName={installConfig.packName}
              onPackNameChange={(value) => setInstallConfig(prev => ({
                ...prev,
                packName: value
              }))}
              packNames={packNames}
              dropdownPackNames={dropdownPackNames}
              onAddPackName={onAddPackName}
              packNameLabel="Pack Name"
              packNamePlaceholder="Enter pack name"
              packNameRequired={true}
              showPackNameDropdown={dropdownPackNames.length > 0}

              category={installConfig.category}
              onCategoryChange={(value) => setInstallConfig(prev => ({
                ...prev,
                category: value
              }))}
              categories={categories}
              onAddCategory={onAddCategory}
              categoryLabel="Category"
              categoryPlaceholder={selectedSource}
              categoryRequired={true}

              loading={loading}
              disabled={loading}
            />

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
