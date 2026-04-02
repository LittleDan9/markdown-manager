import React, { useState, useEffect, useCallback } from 'react';
import { Form, Button, Alert, Card, Spinner, ListGroup, Badge } from 'react-bootstrap';
import { useNotification } from '../../NotificationProvider';
import { iconsApi } from '../../../api/iconsApi';
import PackCategorySelector from '../common/PackCategorySelector';

export default function IconifyPackTab({
  categories,
  onAddCategory,
  onReloadData
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Collection browsing state
  const [collections, setCollections] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPrefix, setSelectedPrefix] = useState('');
  const [collectionIcons, setCollectionIcons] = useState([]);
  const [selectedIcons, setSelectedIcons] = useState([]);
  const [browsing, setBrowsing] = useState(false);
  const [loadingIcons, setLoadingIcons] = useState(false);

  // Install form state
  const [installForm, setInstallForm] = useState({
    packName: '',
    category: categories.length > 0 ? categories[0] : '',
    description: ''
  });

  const { showSuccess, showError } = useNotification();

  // Load collections from backend proxy on mount
  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = useCallback(async (query = '') => {
    setBrowsing(true);
    try {
      const result = await iconsApi.getThirdPartyCollections('iconify', query);
      setCollections(result?.data?.collections || result?.collections || {});
    } catch (err) {
      setError('Failed to load Iconify collections');
    } finally {
      setBrowsing(false);
    }
  }, []);

  const handleSearch = useCallback(() => {
    loadCollections(searchQuery);
  }, [searchQuery, loadCollections]);

  const selectCollection = useCallback(async (prefix) => {
    setSelectedPrefix(prefix);
    setSelectedIcons([]);
    setLoadingIcons(true);
    setInstallForm(prev => ({
      ...prev,
      packName: prefix,
      description: collections[prefix]?.name || ''
    }));

    try {
      const result = await iconsApi.getThirdPartyIcons('iconify', prefix, 0, '');
      setCollectionIcons(result?.data?.icons || result?.icons || []);
    } catch (err) {
      setError(`Failed to load icons for ${prefix}`);
    } finally {
      setLoadingIcons(false);
    }
  }, [collections]);

  const toggleIconSelection = useCallback((iconName) => {
    setSelectedIcons(prev =>
      prev.includes(iconName)
        ? prev.filter(n => n !== iconName)
        : [...prev, iconName]
    );
  }, []);

  const selectAllIcons = useCallback(() => {
    setSelectedIcons(collectionIcons.map(i => i.name));
  }, [collectionIcons]);

  const handleFormChange = (field, value) => {
    setInstallForm(prev => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const installSelectedIcons = async () => {
    if (!selectedPrefix) return;
    if (!installForm.packName.trim()) {
      setError('Pack name is required.');
      return;
    }
    if (!installForm.category) {
      setError('Category is required.');
      return;
    }

    const nameRegex = /^[a-z0-9-]+$/;
    if (!nameRegex.test(installForm.packName)) {
      setError('Pack name must contain only lowercase letters, numbers, and hyphens.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      let result;
      if (selectedIcons.length > 0) {
        result = await iconsApi.installThirdPartyIcons(
          'iconify',
          selectedPrefix,
          selectedIcons,
          installForm.packName,
          installForm.category,
          installForm.description
        );
      } else {
        // Install entire collection
        result = await iconsApi.installEntireThirdPartyCollection(
          'iconify',
          selectedPrefix,
          installForm.packName,
          installForm.category,
          installForm.description
        );
      }

      const count = selectedIcons.length || 'all';
      setSuccess(`Installed ${count} icons from "${selectedPrefix}" as "${installForm.packName}"`);
      showSuccess(`Iconify pack "${installForm.packName}" installed!`);
      setSelectedPrefix('');
      setCollectionIcons([]);
      setSelectedIcons([]);
      onReloadData();
    } catch (err) {
      const msg = err.message || 'Failed to install Iconify pack';
      setError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Quick-fill presets — these just select a collection from the backend
  const quickFill = (prefix, name) => {
    setSearchQuery('');
    selectCollection(prefix);
    setInstallForm(prev => ({ ...prev, packName: prefix, description: `${name} icon collection` }));
  };

  const filteredCollections = Object.entries(collections).slice(0, 50);

  return (
    <div className="icon-pack-tab">
      <Card>
        <Card.Header>
          <h5 className="mb-0">Install from Iconify</h5>
        </Card.Header>
        <Card.Body>
          {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
          {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

          {/* Quick-Fill */}
          <div className="mb-3">
            <small className="text-muted d-block mb-2">Quick-fill popular collections:</small>
            <Button variant="outline-primary" size="sm" className="me-2 mb-2" onClick={() => quickFill('mdi', 'Material Design Icons')}>Material Design Icons</Button>
            <Button variant="outline-primary" size="sm" className="me-2 mb-2" onClick={() => quickFill('fa6-solid', 'Font Awesome Solid')}>Font Awesome Solid</Button>
            <Button variant="outline-primary" size="sm" className="me-2 mb-2" onClick={() => quickFill('heroicons', 'Heroicons')}>Heroicons</Button>
            <Button variant="outline-primary" size="sm" className="me-2 mb-2" onClick={() => quickFill('lucide', 'Lucide')}>Lucide</Button>
          </div>

          {/* Search */}
          <div className="d-flex mb-3 gap-2">
            <Form.Control
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search Iconify collections…"
            />
            <Button variant="outline-secondary" onClick={handleSearch} disabled={browsing}>
              {browsing ? <Spinner animation="border" size="sm" /> : <i className="bi bi-search" />}
            </Button>
          </div>

          {/* Collection list */}
          {!selectedPrefix && filteredCollections.length > 0 && (
            <ListGroup className="mb-3 iconify-collection-list">
              {filteredCollections.map(([prefix, meta]) => (
                <ListGroup.Item
                  key={prefix}
                  action
                  onClick={() => selectCollection(prefix)}
                  className="d-flex justify-content-between align-items-center"
                >
                  <div>
                    <strong>{meta.name || prefix}</strong>
                    <small className="text-muted ms-2">{prefix}</small>
                  </div>
                  <Badge bg="secondary">{meta.total || '?'} icons</Badge>
                </ListGroup.Item>
              ))}
            </ListGroup>
          )}

          {/* Selected collection — icons + install form */}
          {selectedPrefix && (
            <>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <strong>{collections[selectedPrefix]?.name || selectedPrefix}</strong>
                  <Badge bg="info" className="ms-2">{selectedPrefix}</Badge>
                </div>
                <Button variant="outline-secondary" size="sm" onClick={() => { setSelectedPrefix(''); setCollectionIcons([]); setSelectedIcons([]); }}>
                  ← Back
                </Button>
              </div>

              {loadingIcons ? (
                <div className="text-center py-4"><Spinner animation="border" /></div>
              ) : (
                <>
                  <div className="d-flex justify-content-between mb-2">
                    <small className="text-muted">{collectionIcons.length} icons loaded — {selectedIcons.length} selected</small>
                    <div>
                      <Button variant="link" size="sm" onClick={selectAllIcons}>Select All</Button>
                      <Button variant="link" size="sm" onClick={() => setSelectedIcons([])}>Clear</Button>
                    </div>
                  </div>

                  <div className="d-flex flex-wrap gap-2 mb-3 iconify-icon-preview-grid">
                    {collectionIcons.map(icon => (
                      <Button
                        key={icon.name}
                        variant={selectedIcons.includes(icon.name) ? 'primary' : 'outline-secondary'}
                        size="sm"
                        onClick={() => toggleIconSelection(icon.name)}
                        title={icon.name}
                      >
                        {icon.svg ? (
                          <span dangerouslySetInnerHTML={{ __html: icon.svg }} className="iconify-icon-sprite" />
                        ) : (
                          icon.name.slice(0, 12)
                        )}
                      </Button>
                    ))}
                  </div>
                </>
              )}

              {/* Install form */}
              <div className="row">
                <div className="col-md-4">
                  <Form.Group className="mb-3">
                    <Form.Label>Pack Name *</Form.Label>
                    <Form.Control
                      type="text"
                      value={installForm.packName}
                      onChange={e => handleFormChange('packName', e.target.value)}
                      placeholder="e.g., material-icons"
                      disabled={loading}
                    />
                  </Form.Group>
                </div>
                <div className="col-md-4">
                  <PackCategorySelector
                    showPackName={false}
                    category={installForm.category}
                    onCategoryChange={v => handleFormChange('category', v)}
                    categories={categories}
                    onAddCategory={onAddCategory}
                    categoryLabel="Category"
                    loading={loading}
                    disabled={loading}
                  />
                </div>
                <div className="col-md-4">
                  <Form.Group className="mb-3">
                    <Form.Label>Description</Form.Label>
                    <Form.Control
                      type="text"
                      value={installForm.description}
                      onChange={e => handleFormChange('description', e.target.value)}
                      placeholder="Optional"
                      disabled={loading}
                    />
                  </Form.Group>
                </div>
              </div>

              <div className="d-flex justify-content-end gap-2">
                <Button
                  variant="primary"
                  onClick={installSelectedIcons}
                  disabled={loading || !installForm.packName}
                >
                  {loading ? (
                    <><Spinner animation="border" size="sm" className="me-2" />Installing…</>
                  ) : selectedIcons.length > 0 ? (
                    `Install ${selectedIcons.length} Selected Icons`
                  ) : (
                    'Install Entire Collection'
                  )}
                </Button>
              </div>
            </>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
