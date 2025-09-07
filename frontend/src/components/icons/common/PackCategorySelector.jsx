import React, { useState } from 'react';
import { Form, Button, Dropdown, Badge } from 'react-bootstrap';

/**
 * Reusable component for pack name and category selection
 * Used across icon management modals for consistent UX
 */
export default function PackCategorySelector({
  // Pack Name Props
  packName,
  onPackNameChange,
  packNames = [],
  dropdownPackNames = [],
  onAddPackName,
  packNameLabel = "Pack Name",
  packNamePlaceholder = "Select or create a pack",
  packNameRequired = true,
  showPackNameDropdown = true,
  showPackName = true, // New prop to control pack name visibility
  
  // Category Props
  category,
  onCategoryChange,
  categories = [],
  onAddCategory,
  categoryLabel = "Category",
  categoryPlaceholder = "Select a category",
  categoryRequired = true,
  
  // Common Props
  loading = false,
  disabled = false,
  className = ""
}) {
  const [newCategory, setNewCategory] = useState('');
  const [newPackName, setNewPackName] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [packNameError, setPackNameError] = useState('');

  const handleAddCategory = (categoryToAdd) => {
    if (!categoryToAdd || !categoryToAdd.trim()) return;

    const trimmedCategory = categoryToAdd.trim().toLowerCase();

    // Check if category already exists
    if (categories.includes(trimmedCategory)) {
      setCategoryError('Category already exists');
      return;
    }

    // Add category via parent handler
    if (onAddCategory) {
      onAddCategory(trimmedCategory);
    }

    // Select the new category
    onCategoryChange(trimmedCategory);

    // Clear form
    setNewCategory('');
    setCategoryError('');
  };

  const handleAddPackName = (packNameToAdd) => {
    if (!packNameToAdd || !packNameToAdd.trim()) return;

    const trimmedPackName = packNameToAdd.trim().toLowerCase();

    // Check if pack name already exists in dropdown
    if (dropdownPackNames.includes(trimmedPackName)) {
      setPackNameError('Pack name already exists');
      return;
    }

    // Add pack name via parent handler
    if (onAddPackName) {
      onAddPackName(trimmedPackName);
    }

    // Select the new pack name
    onPackNameChange(trimmedPackName);

    // Clear form
    setNewPackName('');
    setPackNameError('');
  };

  return (
    <div className={`pack-category-selector ${className}`}>
      {/* Pack Name Field */}
      {showPackName && (
        <Form.Group className="mb-3">
          <Form.Label>
            {packNameLabel}
            {packNameRequired && ' *'}
          </Form.Label>
          
          {showPackNameDropdown && dropdownPackNames.length > 0 ? (
            <Dropdown>
              <Dropdown.Toggle
                as="div"
                id="packNameDropdown"
                className="form-control d-flex justify-content-between align-items-center"
                style={{
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                disabled={loading || disabled}
              >
                {dropdownPackNames.length === 0
                  ? 'No pack names available'
                  : packName
                    ? packName
                    : packNamePlaceholder
                }
              </Dropdown.Toggle>
              <Dropdown.Menu className="w-100">
                {dropdownPackNames.length === 0 ? (
                  <Dropdown.Item disabled>
                    Backend unavailable - no pack names loaded
                  </Dropdown.Item>
                ) : (
                  <>
                    {dropdownPackNames.map((pName) => (
                      <Dropdown.Item
                        key={pName}
                        active={pName === packName}
                        onClick={() => onPackNameChange(pName)}
                        className={pName === packName ? "text-bg-secondary" : ""}
                      >
                        {pName}
                        {!packNames.includes(pName) && (
                          <Badge bg="info" className="ms-2">New</Badge>
                        )}
                      </Dropdown.Item>
                    ))}
                    {onAddPackName && (
                      <>
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
                                disabled={loading || disabled}
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
                                disabled={loading || disabled}
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
                  </>
                )}
              </Dropdown.Menu>
            </Dropdown>
          ) : (
            <Form.Control
              type="text"
              value={packName}
              onChange={(e) => onPackNameChange(e.target.value)}
              placeholder={packNamePlaceholder}
              disabled={loading || disabled}
              required={packNameRequired}
            />
          )}
          
          {showPackNameDropdown && (
            <Form.Text className="text-muted">
              Select existing pack or create new one
            </Form.Text>
          )}
        </Form.Group>
      )}

      {/* Category Field */}
      <Form.Group className="mb-3">
        <Form.Label>
          {categoryLabel}
          {categoryRequired && ' *'}
        </Form.Label>
        
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
            disabled={loading || disabled || categories.length === 0}
          >
            {categories.length === 0
              ? 'No categories available'
              : category
                ? category.charAt(0).toUpperCase() + category.slice(1)
                : categoryPlaceholder
            }
          </Dropdown.Toggle>
          <Dropdown.Menu className="w-100">
            {categories.length === 0 ? (
              <Dropdown.Item disabled>
                Backend unavailable - no categories loaded
              </Dropdown.Item>
            ) : (
              <>
                {categories.map((cat) => (
                  <Dropdown.Item
                    key={cat}
                    active={cat === category}
                    onClick={() => onCategoryChange(cat)}
                    className={cat === category ? "text-bg-secondary" : ""}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Dropdown.Item>
                ))}
                {onAddCategory && (
                  <>
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
                            disabled={loading || disabled}
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
                            disabled={loading || disabled}
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
              </>
            )}
          </Dropdown.Menu>
        </Dropdown>
      </Form.Group>
    </div>
  );
}
