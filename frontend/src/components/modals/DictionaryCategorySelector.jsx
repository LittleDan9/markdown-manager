import React from 'react';
import { Form } from 'react-bootstrap';

/**
 * Category selector component for dictionary scope selection
 */
export function DictionaryCategorySelector({ 
  categories, 
  selectedCategory, 
  onCategoryChange, 
  loading 
}) {
  if (categories.length === 0) return null;

  return (
    <div className="mb-3">
      <Form.Group>
        <Form.Label>Dictionary Scope</Form.Label>
        <Form.Select
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
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
          {selectedCategory 
            ? `Words added here will only apply to ${categories.find(c => c.id === selectedCategory)?.name || 'this'} category documents.`
            : 'Words added here will apply to all documents regardless of category.'
          }
        </Form.Text>
      </Form.Group>
    </div>
  );
}
