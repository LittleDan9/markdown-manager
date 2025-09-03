import React from 'react';
import { Form } from 'react-bootstrap';

/**
 * Category selector component for dictionary scope selection
 * Matches the original functionality from main branch
 */
export function DictionaryCategorySelector({
  categories,
  selectedCategory,
  onCategoryChange,
  loading,
  isAuthenticated
}) {
  // Show when categories are available
  if (!categories || categories.length === 0) {
    return null;
  }

  return (
    <div className="mb-3">
      <Form.Group>
        <Form.Label>Dictionary Scope</Form.Label>
        <Form.Select
          value={selectedCategory}
          onChange={(e) => {
            console.log('Category changed from', selectedCategory, 'to', e.target.value);
            onCategoryChange(e.target.value);
          }}
          disabled={loading}
        >
          <option value="">Personal Dictionary (All Documents)</option>
          {categories.map(category => (
            <option key={category.id} value={category.id}>
              {category.name} Category
            </option>
          ))}
        </Form.Select>
        <Form.Text className="text-muted">
          {isAuthenticated
            ? "Choose whether to manage your personal dictionary or a category-specific dictionary."
            : "Category selection available after login. Currently showing demo categories."
          }
        </Form.Text>
      </Form.Group>
    </div>
  );
}
