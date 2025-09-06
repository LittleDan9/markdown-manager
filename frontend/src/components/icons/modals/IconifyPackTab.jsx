import React, { useState } from 'react';
import { Form, Button, Alert, Card, Spinner, Dropdown } from 'react-bootstrap';
import { useNotification } from '../../NotificationProvider';
import iconsApi from '../../../api/iconsApi';

export default function IconifyPackTab({ 
  categories, 
  onAddCategory,
  onReloadData 
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [categoryError, setCategoryError] = useState('');

  // Iconify pack form state
  const [iconifyForm, setIconifyForm] = useState({
    packUrl: '',
    packName: '',
    category: categories.length > 0 ? categories[0] : '',
    description: ''
  });

  const { showSuccess, showError } = useNotification();

  const handleIconifyFormChange = (field, value) => {
    setIconifyForm(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear errors when user types
    if (error) setError('');
    if (categoryError) setCategoryError('');
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
    handleIconifyFormChange('category', trimmedCategory);

    // Clear form
    setNewCategory('');
    setCategoryError('');
  };

  const validateIconifyForm = () => {
    if (!iconifyForm.packUrl.trim()) {
      setError('Iconify pack URL is required.');
      return false;
    }
    if (!iconifyForm.packName.trim()) {
      setError('Pack name is required.');
      return false;
    }
    if (!iconifyForm.category) {
      setError('Category is required.');
      return false;
    }

    // Validate URL format
    try {
      new URL(iconifyForm.packUrl);
    } catch {
      setError('Please enter a valid URL.');
      return false;
    }

    // Validate pack name format
    const nameRegex = /^[a-z0-9-]+$/;
    if (!nameRegex.test(iconifyForm.packName)) {
      setError('Pack name must contain only lowercase letters, numbers, and hyphens.');
      return false;
    }

    return true;
  };

  const installIconifyPack = async () => {
    if (!validateIconifyForm()) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      let packData;
      
      // Check if it's a direct JSON URL or needs to be converted to collection API
      if (iconifyForm.packUrl.includes('.json')) {
        // It's a direct JSON URL, try to fetch it first
        try {
          const response = await fetch(iconifyForm.packUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch pack: ${response.statusText}`);
          }
          packData = await response.json();
        } catch (err) {
          // If direct JSON fails, try to convert to collection API format
          const urlParts = iconifyForm.packUrl.split('/');
          const filename = urlParts[urlParts.length - 1];
          const prefix = filename.replace('.json', '');
          
          const collectionUrl = `https://api.iconify.design/collection?prefix=${prefix}&info=1`;
          const response = await fetch(collectionUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch collection: ${response.statusText}. Original error: ${err.message}`);
          }
          packData = await response.json();
        }
      } else {
        // Assume it's already a collection API URL
        const response = await fetch(iconifyForm.packUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch pack: ${response.statusText}`);
        }
        packData = await response.json();
      }
      
      // Handle different response formats
      let icons, info;
      
      if (packData.icons && packData.info) {
        // Direct icon data format
        icons = packData.icons;
        info = packData.info;
      } else if (packData.prefix && packData.info) {
        // Collection API format - we need to fetch the actual icon data
        const iconDataUrl = `https://api.iconify.design/${packData.prefix}.json?icons=${Object.keys(packData.uncategorized || []).concat(
          Object.values(packData.categories || {}).flat()
        ).slice(0, 50).join(',')}`; // Limit to first 50 icons for now
        
        const iconResponse = await fetch(iconDataUrl);
        if (!iconResponse.ok) {
          throw new Error(`Failed to fetch icon data: ${iconResponse.statusText}`);
        }
        const iconData = await iconResponse.json();
        
        icons = iconData.icons;
        info = packData.info;
      } else {
        throw new Error('Invalid Iconify pack format. Expected either icon data with "icons" and "info" fields, or collection metadata with "prefix" and "info" fields.');
      }

      // Create the pack data in the expected format
      const customPackData = {
        icons,
        info: {
          ...info,
          name: iconifyForm.packName,
          displayName: iconifyForm.packName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          category: iconifyForm.category,
          description: iconifyForm.description || info.description || `${iconifyForm.packName} icons`
        }
      };

      // Install the pack using the existing API
      const result = await iconsApi.installIconPack(customPackData, null, 'json');

      setSuccess(`Successfully installed Iconify pack "${result.display_name}" with ${Object.keys(icons).length} icons`);
      showSuccess(`Iconify pack "${result.display_name}" installed successfully!`);

      // Reset form
      setIconifyForm({
        packUrl: '',
        packName: '',
        category: categories.length > 0 ? categories[0] : '',
        description: ''
      });

      // Reload data via parent
      onReloadData();

    } catch (err) {
      const errorMessage = err.message || 'Failed to install Iconify pack';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <Card.Header>
        <h5 className="mb-0">Install Iconify Pack</h5>
      </Card.Header>
      <Card.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        <Form>
          <div className="row">
            <div className="col-md-6">
              <Form.Group className="mb-3">
                <Form.Label>Iconify Pack URL *</Form.Label>
                <Form.Control
                  type="url"
                  value={iconifyForm.packUrl}
                  onChange={(e) => handleIconifyFormChange('packUrl', e.target.value)}
                  placeholder="https://api.iconify.design/collection?prefix=fa6-solid&info=1"
                  disabled={loading}
                />
                <Form.Text className="text-muted">
                  Enter URL to an Iconify collection. Examples:<br/>
                  • Collection API: https://api.iconify.design/collection?prefix=fa6-solid&info=1<br/>
                  • Direct JSON: https://api.iconify.design/mdi.json (fallback)
                </Form.Text>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Pack Name *</Form.Label>
                <Form.Control
                  type="text"
                  value={iconifyForm.packName}
                  onChange={(e) => handleIconifyFormChange('packName', e.target.value)}
                  placeholder="e.g., material-icons"
                  disabled={loading}
                />
                <Form.Text className="text-muted">
                  Lowercase letters, numbers, and hyphens only
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
                    id="iconifyCategory"
                    className="form-control d-flex justify-content-between align-items-center"
                    style={{
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                    disabled={loading || categories.length === 0}
                  >
                    {categories.length === 0
                      ? 'No categories available'
                      : iconifyForm.category
                        ? iconifyForm.category.charAt(0).toUpperCase() + iconifyForm.category.slice(1)
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
                            active={category === iconifyForm.category}
                            onClick={() => handleIconifyFormChange('category', category)}
                            className={category === iconifyForm.category ? "text-bg-secondary" : ""}
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
                <Form.Label>Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={iconifyForm.description}
                  onChange={(e) => handleIconifyFormChange('description', e.target.value)}
                  placeholder="Optional description for the icon pack"
                  disabled={loading}
                />
                <Form.Text className="text-muted">
                  If empty, will use description from Iconify pack
                </Form.Text>
              </Form.Group>

              <Card className="mb-3">
                <Card.Header>
                  <h6 className="mb-0">Popular Iconify Collections</h6>
                </Card.Header>
                <Card.Body>
                  <div className="row">
                    <div className="col-12">
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="me-2 mb-2"
                        onClick={() => {
                          handleIconifyFormChange('packUrl', 'https://api.iconify.design/collection?prefix=mdi&info=1');
                          handleIconifyFormChange('packName', 'material-design-icons');
                        }}
                      >
                        Material Design Icons
                      </Button>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="me-2 mb-2"
                        onClick={() => {
                          handleIconifyFormChange('packUrl', 'https://api.iconify.design/collection?prefix=fa6-solid&info=1');
                          handleIconifyFormChange('packName', 'font-awesome-solid');
                        }}
                      >
                        Font Awesome Solid
                      </Button>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="me-2 mb-2"
                        onClick={() => {
                          handleIconifyFormChange('packUrl', 'https://api.iconify.design/collection?prefix=heroicons&info=1');
                          handleIconifyFormChange('packName', 'heroicons');
                        }}
                      >
                        Heroicons
                      </Button>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="me-2 mb-2"
                        onClick={() => {
                          handleIconifyFormChange('packUrl', 'https://api.iconify.design/collection?prefix=lucide&info=1');
                          handleIconifyFormChange('packName', 'lucide');
                        }}
                      >
                        Lucide
                      </Button>
                    </div>
                  </div>
                  <small className="text-muted">
                    Click to auto-fill URL and pack name
                  </small>
                </Card.Body>
              </Card>
            </div>
          </div>

          <div className="d-flex justify-content-end">
            <Button
              variant="primary"
              onClick={installIconifyPack}
              disabled={loading || !iconifyForm.packUrl || !iconifyForm.packName}
            >
              {loading ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Installing...
                </>
              ) : (
                <>
                  <svg 
                    className="me-2" 
                    width="20" 
                    height="20" 
                    viewBox="0 0 48 48" 
                    fill="none"
                    style={{ verticalAlign: 'text-top' }}
                  >
                    <path stroke="currentColor" strokeLinecap="round" strokeWidth="4" d="M14 6v6"/>
                    <path stroke="currentColor" strokeLinecap="round" strokeWidth="4" d="M10 16v22"/>
                    <path stroke="currentColor" strokeLinecap="round" strokeWidth="4" d="M38 16v22M38 38H10"/>
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="m24 6 17 11"/>
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M24 6 7 17"/>
                    <path stroke="currentColor" strokeLinecap="round" strokeWidth="4" d="M24 25v16"/>
                    <circle cx="24" cy="23" r="4" fill="currentColor"/>
                  </svg>
                  Install Iconify Pack
                </>
              )}
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
}
