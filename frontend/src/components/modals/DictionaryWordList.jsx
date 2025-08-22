import React from 'react';
import { ListGroup, Button, Form, Badge } from 'react-bootstrap';

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
  loading 
}) {
  return (
    <ListGroup.Item className="d-flex justify-content-between align-items-start">
      <div className="flex-grow-1">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="fw-bold">{entry.word}</div>
          <div className="d-flex gap-2">
            {entry.notes && !isEditing && (
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => onStartEdit(entry)}
                title="Edit notes"
                disabled={loading}
              >
                <i className="bi bi-pencil"></i>
              </Button>
            )}
            <Button
              variant="outline-danger"
              size="sm"
              onClick={() => onDelete(entry.word)}
              title="Remove word"
              disabled={loading}
            >
              <i className="bi bi-trash"></i>
            </Button>
          </div>
        </div>
        
        {entry.isLocal && (
          <Badge bg="info" className="mb-2">Local Only</Badge>
        )}
        
        {isEditing ? (
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
                Save
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
        ) : entry.notes && (
          <div className="text-muted small mt-2">
            <strong>Notes:</strong> {entry.notes}
          </div>
        )}
      </div>
    </ListGroup.Item>
  );
}

/**
 * Dictionary word list component
 */
export function DictionaryWordList({ 
  entries, 
  editingEntry, 
  onStartEdit, 
  onCancelEdit, 
  onSaveEdit, 
  onUpdateEditNotes, 
  onDeleteWord,
  loading 
}) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return (
      <div className="text-center text-muted py-4">
        <i className="bi bi-book me-2"></i>
        No words in your dictionary yet. Add some words above to get started!
      </div>
    );
  }

  return (
    <div>
      <h6 className="mb-3">
        Dictionary Words ({entries.length})
      </h6>
      <ListGroup className="mb-3" style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {entries.map(entry => (
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
          />
        ))}
      </ListGroup>
    </div>
  );
}
