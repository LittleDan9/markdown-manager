import React from 'react';
import { ListGroup, Button, Form, Badge, Alert, Spinner } from 'react-bootstrap';

/**
 * Word list entry component with inline editing
 */
function DictionaryWordEntry({
  entry,
  isEditing,
  tempNotes,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onUpdateNotes,
  onDelete,
  loading,
  categories,
  isAuthenticated
}) {
  return (
    <ListGroup.Item className="d-flex justify-content-between align-items-start">
      <div className="flex-grow-1">
        <div className="fw-bold">{entry.word}</div>

        {isAuthenticated && entry.notes && !isEditing && (
          <small className="text-muted">{entry.notes}</small>
        )}

        {isAuthenticated && (
          <small className="text-muted d-block">
            Added: {new Date(entry.created_at).toLocaleDateString()}
            {entry.category_id && (
              <span className="ms-2">
                • Category: {categories.find(c => c.id === entry.category_id)?.name || 'Unknown'}
              </span>
            )}
            {!entry.category_id && (
              <span className="ms-2">• Personal Dictionary</span>
            )}
          </small>
        )}

        {isEditing && (
          <div className="mt-2">
            <Form.Control
              as="textarea"
              rows={2}
              value={tempNotes}
              onChange={(e) => onUpdateNotes(e.target.value)}
              placeholder="Add notes about this word..."
              disabled={loading}
            />
            <div className="mt-2 d-flex gap-2">
              <Button
                variant="success"
                size="sm"
                onClick={() => onSaveEdit(entry, tempNotes)}
                disabled={loading}
              >
                {loading ? <Spinner size="sm" /> : "Save"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={onCancelEdit}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="btn-group btn-group-sm">
        {isAuthenticated && (
          <Button
            variant="outline-primary"
            size="sm"
            onClick={() => onStartEdit(entry)}
            title="Edit notes"
            disabled={loading || isEditing}
          >
            <i className="bi bi-pencil"></i>
          </Button>
        )}
        <Button
          variant="outline-danger"
          size="sm"
          onClick={() => onDelete(entry.word)}
          title="Remove word"
          disabled={loading || isEditing}
        >
          <i className="bi bi-trash"></i>
        </Button>
      </div>
    </ListGroup.Item>
  );
}

/**
 * Dictionary word list component with comprehensive authentication and category handling
 */
export function DictionaryWordList({
  entries,
  editingEntry,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onUpdateEditNotes,
  onDeleteWord,
  loading,
  isAuthenticated,
  categories,
  selectedCategory,
  localWordCount,
  onLocalWordDelete
}) {
  // Show loading spinner when loading and no entries
  if (loading && entries.length === 0) {
    return (
      <div className="text-center">
        <Spinner />
        <div className="mt-2">Loading dictionary...</div>
      </div>
    );
  }

  // Handle unauthenticated users with local storage
  if (!isAuthenticated) {
    return (
      <div>
        <Alert variant="info">
          <i className="bi bi-info-circle me-2"></i>
          You're using a local dictionary. Log in to sync your words across devices.
          {selectedCategory && (
            <div className="mt-2">
              <strong>Category:</strong> {categories.find(c => c.id === selectedCategory)?.name || 'Selected Category'}
            </div>
          )}
        </Alert>
        {entries.length === 0 ? (
          <Alert variant="secondary">
            {selectedCategory
              ? `No custom words in the ${categories.find(c => c.id === selectedCategory)?.name || 'selected'} category yet.`
              : "No custom words yet."
            } Add words above or use "Add to Dictionary" in the editor.
          </Alert>
        ) : (
          <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '0.375rem' }}>
            <ListGroup variant="flush">
              {entries.map((entry) => (
                <ListGroup.Item key={entry.id} className="d-flex justify-content-between align-items-center">
                  <div className="fw-bold">{entry.word}</div>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => onLocalWordDelete && onLocalWordDelete(entry, selectedCategory)}
                    title="Remove word"
                  >
                    <i className="bi bi-trash"></i>
                  </Button>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </div>
        )}
      </div>
    );
  }

  // Handle authenticated users
  if (!Array.isArray(entries) || entries.length === 0) {
    return (
      <Alert variant="info">
        {selectedCategory
          ? `No custom words in the ${categories.find(c => c.id === selectedCategory)?.name || 'selected'} category dictionary yet. Add words above or use "Add to Dictionary" in the editor when working with documents in this category.`
          : "No custom words in your personal dictionary yet. Add words above or use \"Add to Dictionary\" in the editor."
        }
      </Alert>
    );
  }

  return (
    <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '0.375rem' }}>
      <ListGroup variant="flush">
        {entries.map((entry) => (
          <DictionaryWordEntry
            key={entry.id}
            entry={entry}
            isEditing={editingEntry?.id === entry.id}
            tempNotes={editingEntry?.tempNotes || ''}
            onStartEdit={onStartEdit}
            onCancelEdit={onCancelEdit}
            onSaveEdit={onSaveEdit}
            onUpdateNotes={onUpdateEditNotes}
            onDelete={onDeleteWord}
            loading={loading}
            categories={categories}
            isAuthenticated={isAuthenticated}
          />
        ))}
      </ListGroup>
    </div>
  );
}
