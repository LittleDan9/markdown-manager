import React, { useState } from 'react';
import { Form, Button, Alert, Card, Badge, Spinner, Dropdown } from 'react-bootstrap';
import { useNotification } from '../../NotificationProvider';
import iconsApi from '../../../api/iconsApi';

export default function UploadIconTab({ 
  categories, 
  packNames, 
  dropdownPackNames, 
  onAddCategory, 
  onAddPackName, 
  onReloadData 
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newPackName, setNewPackName] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [packNameError, setPackNameError] = useState('');

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    iconName: '',
    packName: dropdownPackNames.length > 0 ? dropdownPackNames[0] : '',
    category: categories.length > 0 ? categories[0] : '',
    description: '',
    svgFile: null
  });

  const [svgPreview, setSvgPreview] = useState('');

  const { showSuccess, showError } = useNotification();

  const handleFormChange = (field, value) => {
    setUploadForm(prev => {
      const newState = {
        ...prev,
        [field]: value
      };
      
      // If pack name changed to an existing pack, clear description
      if (field === 'packName' && packNames.includes(value)) {
        newState.description = '';
      }
      
      return newState;
    });
    
    // Clear errors when user types
    if (error) setError('');
    if (categoryError) setCategoryError('');
    if (packNameError) setPackNameError('');
  };

  const handleAddCategory = (category) => {
    if (!category || !category.trim()) return;

    const trimmedCategory = category.trim().toLowerCase();

    // Check if category already exists
    if (categories.includes(trimmedCategory)) {
      setCategoryError('Category already exists');
      return;
    }

    // Add category via parent handler
    onAddCategory(trimmedCategory);

    // Select the new category
    handleFormChange('category', trimmedCategory);

    // Clear form
    setNewCategory('');
    setCategoryError('');
  };

  const handleAddPackName = (packName) => {
    if (!packName || !packName.trim()) return;

    const trimmedPackName = packName.trim().toLowerCase();

    // Check if pack name already exists in dropdown
    if (dropdownPackNames.includes(trimmedPackName)) {
      setPackNameError('Pack name already exists');
      return;
    }

    // Add pack name via parent handler
    onAddPackName(trimmedPackName);

    // Select the new pack name
    handleFormChange('packName', trimmedPackName);

    // Clear form
    setNewPackName('');
    setPackNameError('');
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type !== 'image/svg+xml' && !file.name.endsWith('.svg')) {
        setError('Please select a valid SVG file.');
        setSvgPreview('');
        return;
      }
      if (file.size > 1024 * 1024) { // 1MB limit
        setError('SVG file must be smaller than 1MB.');
        setSvgPreview('');
        return;
      }
      
      // Read the SVG file content for preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setSvgPreview(e.target.result);
      };
      reader.readAsText(file);
      
      handleFormChange('svgFile', file);

      // Auto-populate icon name from filename if empty
      if (!uploadForm.iconName) {
        const name = file.name
          .replace('.svg', '')
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        handleFormChange('iconName', name);
      }
    } else {
      setSvgPreview('');
    }
  };

  const validateForm = () => {
    if (!uploadForm.iconName.trim()) {
      setError('Icon name is required.');
      return false;
    }
    if (!uploadForm.packName.trim()) {
      setError('Pack name is required.');
      return false;
    }
    if (!uploadForm.category) {
      setError('Category is required.');
      return false;
    }
    if (!uploadForm.svgFile) {
      setError('SVG file is required.');
      return false;
    }

    // Validate icon name format
    const nameRegex = /^[a-z0-9-]+$/;
    if (!nameRegex.test(uploadForm.iconName)) {
      setError('Icon name must contain only lowercase letters, numbers, and hyphens.');
      return false;
    }

    return true;
  };

  const uploadIcon = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Use the new single icon upload API
      const result = await iconsApi.uploadSingleIcon({
        svgFile: uploadForm.svgFile,
        iconName: uploadForm.iconName,
        packName: uploadForm.packName,
        category: uploadForm.category,
        description: uploadForm.description
      });

      setSuccess(`Successfully created pack "${result.name}" with icon "${uploadForm.iconName}"`);
      showSuccess(`Icon pack "${result.display_name}" created successfully!`);

      // Reset form
      setUploadForm({
        iconName: '',
        packName: dropdownPackNames.length > 0 ? dropdownPackNames[0] : '',
        category: categories.length > 0 ? categories[0] : '',
        description: '',
        svgFile: null
      });

      // Clear file input and preview
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';
      setSvgPreview('');

      // Clear category form
      setNewCategory('');
      setCategoryError('');
      setNewPackName('');
      setPackNameError('');

      // Reload data via parent
      onReloadData();

    } catch (err) {
      const errorMessage = err.message || 'Failed to upload icon';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <Card.Header>
        <h5 className="mb-0">Upload New Icon</h5>
      </Card.Header>
      <Card.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        <Form>
          <div className="row">
            <div className="col-md-6">
              <Form.Group className="mb-3">
                <Form.Label>Icon Name *</Form.Label>
                <Form.Control
                  type="text"
                  value={uploadForm.iconName}
                  onChange={(e) => handleFormChange('iconName', e.target.value)}
                  placeholder="e.g., arista-switch"
                  disabled={loading}
                />
                <Form.Text className="text-muted">
                  Lowercase letters, numbers, and hyphens only
                </Form.Text>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Pack Name *</Form.Label>
                <Dropdown>
                  <Dropdown.Toggle
                    as="div"
                    id="packNameDropdown"
                    className="form-control d-flex justify-content-between align-items-center"
                    style={{
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                    disabled={loading}
                  >
                    {dropdownPackNames.length === 0
                      ? 'No pack names available'
                      : uploadForm.packName
                        ? uploadForm.packName
                        : 'Select or create a pack'
                    }
                  </Dropdown.Toggle>
                  <Dropdown.Menu className="w-100">
                    {dropdownPackNames.length === 0 ? (
                      <Dropdown.Item disabled>
                        Backend unavailable - no pack names loaded
                      </Dropdown.Item>
                    ) : (
                      <>
                        {dropdownPackNames.map((packName) => (
                          <Dropdown.Item
                            key={packName}
                            active={packName === uploadForm.packName}
                            onClick={() => handleFormChange('packName', packName)}
                            className={packName === uploadForm.packName ? "text-bg-secondary" : ""}
                          >
                            {packName}
                            {!packNames.includes(packName) && (
                              <Badge bg="info" className="ms-2">New</Badge>
                            )}
                          </Dropdown.Item>
                        ))}
                        <Dropdown.Divider />
                        <div className="px-1 py-2">
                          <div
                            className="px-1 py-2"
                            autoComplete="off"
                            style={{ minWidth: "200px" }}
                          >
                            <div className="input-group input-group-sm">
                              <Form.Control
                                type="text"
                                placeholder="New pack name"
                                aria-label="New pack name"
                                value={newPackName}
                                onChange={(e) => setNewPackName(e.target.value)}
                                disabled={loading}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (!newPackName) return;
                                    handleAddPackName(newPackName);
                                  }
                                }}
                              />
                              <Button 
                                variant="primary" 
                                onClick={() => {
                                  if (!newPackName) return;
                                  handleAddPackName(newPackName);
                                }}
                                disabled={loading}
                              >
                                <i className="bi bi-plus"></i>
                              </Button>
                            </div>
                          </div>
                          {packNameError && (
                            <div className="text-danger small mt-1">{packNameError}</div>
                          )}
                        </div>
                      </>
                    )}
                  </Dropdown.Menu>
                </Dropdown>
                <Form.Text className="text-muted">
                  Select existing pack or create new one
                </Form.Text>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Category *</Form.Label>
                <Dropdown
                style={{
                  border: 'var(--bs-border-width) solid var(--bs-border-color)',
                  borderRadius: 'var(--bs-border-radius)'
                }}
                >
                  <Dropdown.Toggle
                    as="div"
                    id="categoryDropdown"
                    className="form-control d-flex justify-content-between align-items-center"
                    style={{
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                    disabled={loading || categories.length === 0}
                  >
                    {categories.length === 0
                      ? 'No categories available'
                      : uploadForm.category
                        ? uploadForm.category.charAt(0).toUpperCase() + uploadForm.category.slice(1)
                        : 'Select a category'
                    }
                  </Dropdown.Toggle>
                  <Dropdown.Menu className="w-100">
                    {categories.length === 0 ? (
                      <Dropdown.Item disabled>
                        Backend unavailable - no categories loaded
                      </Dropdown.Item>
                    ) : (
                      <>
                        {categories.map((category) => (
                          <Dropdown.Item
                            key={category}
                            active={category === uploadForm.category}
                            onClick={() => handleFormChange('category', category)}
                            className={category === uploadForm.category ? "text-bg-secondary" : ""}
                          >
                            {category.charAt(0).toUpperCase() + category.slice(1)}
                          </Dropdown.Item>
                        ))}
                        <Dropdown.Divider />
                        <div className="px-1 py-2">
                          <div
                            className="px-1 py-2"
                            autoComplete="off"
                            style={{ minWidth: "200px" }}
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (!newCategory) return;
                              handleAddCategory(newCategory);
                            }}
                          >
                            <div className="input-group input-group-sm">
                              <Form.Control
                                type="text"
                                placeholder="New category"
                                aria-label="New category"
                                value={newCategory}
                                onChange={(e) => setNewCategory(e.target.value)}
                                disabled={loading}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (!newCategory) return;
                                    handleAddCategory(newCategory);
                                  }
                                }}
                              />
                              <Button
                                variant="primary"
                                onClick={() => {
                                  if (!newCategory) return;
                                  handleAddCategory(newCategory);
                                }}
                                disabled={loading}
                              >
                                <i className="bi bi-plus"></i>
                              </Button>
                            </div>
                          </div>
                          {categoryError && (
                            <div className="text-danger small mt-1">{categoryError}</div>
                          )}
                        </div>
                      </>
                    )}
                  </Dropdown.Menu>
                </Dropdown>
              </Form.Group>
            </div>

            <div className="col-md-6">
              <Form.Group className="mb-3">
                <Form.Label>SVG File *</Form.Label>
                <Form.Control
                  type="file"
                  accept=".svg,image/svg+xml"
                  onChange={handleFileSelect}
                  disabled={loading}
                />
                <Form.Text className="text-muted">
                  Maximum file size: 1MB
                </Form.Text>
              </Form.Group>

              {/* Show description field when creating a new pack */}
              {(() => {
                const isNewPack = uploadForm.packName && !packNames.includes(uploadForm.packName);
                return isNewPack;
              })() && (
                <Form.Group className="mb-3">
                  <Form.Label>
                    Pack Description 
                    <Badge bg="info" className="ms-2">New Pack</Badge>
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={uploadForm.description}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                    placeholder="Description for the new icon pack"
                    disabled={loading}
                  />
                  <Form.Text className="text-muted">
                    Creating new pack "{uploadForm.packName}" in category "{uploadForm.category}"
                  </Form.Text>
                </Form.Group>
              )}
              
              {/* Show info when adding to existing pack */}
              {uploadForm.packName && packNames.includes(uploadForm.packName) && (
                <div className="mb-3">
                  <small className="text-muted">
                    <i className="bi bi-info-circle me-1"></i>
                    Adding icon to existing pack "{uploadForm.packName}"
                  </small>
                </div>
              )}
            </div>
          </div>

          {uploadForm.svgFile && (
            <Card className="mb-3">
              <Card.Header>
                <h6 className="mb-0">Icon Preview</h6>
              </Card.Header>
              <Card.Body>
                <div className="row">
                  <div className="col-md-3">
                    <div className="d-flex justify-content-center align-items-center p-3" style={{ minHeight: '120px', border: '1px solid #dee2e6', borderRadius: '0.375rem' }}>
                      {svgPreview ? (
                        <div 
                          dangerouslySetInnerHTML={{ __html: svgPreview }}
                          style={{ width: '64px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        />
                      ) : (
                        <div className="text-muted">
                          <i className="bi bi-image display-4"></i>
                          <div className="small">Loading preview...</div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="col-md-9">
                    <div className="d-flex align-items-center">
                      <i className="bi bi-file-earmark-text me-2"></i>
                      <div>
                        <div><strong>{uploadForm.svgFile.name}</strong></div>
                        <small className="text-muted">
                          Size: {(uploadForm.svgFile.size / 1024).toFixed(1)} KB
                        </small>
                        {uploadForm.iconName && (
                          <div className="mt-1">
                            <Badge bg="secondary">Icon: {uploadForm.iconName}</Badge>
                          </div>
                        )}
                      </div>
                    </div>
                    {svgPreview && (
                      <div className="mt-2">
                        <small className="text-muted">
                          Preview shows how the icon will appear in the system
                        </small>
                      </div>
                    )}
                  </div>
                </div>
              </Card.Body>
            </Card>
          )}

          <div className="d-flex justify-content-end">
            <Button
              variant="primary"
              onClick={uploadIcon}
              disabled={loading || !uploadForm.svgFile}
            >
              {loading ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Uploading...
                </>
              ) : (
                <>
                  <i className="bi bi-upload me-2"></i>
                  Upload Icon
                </>
              )}
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
}
