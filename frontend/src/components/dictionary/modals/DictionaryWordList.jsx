import React from 'react';
import { ListGroup, Button, Form, Badge, Alert, Spinner } from 'react-bootstrap';

/**
 * Word list entry component with inline editing
 * Updated to support folder-path based dictionaries
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
  selectedScope,
  isAuthenticated
}) {
  const getScopeDisplay = () => {
    if (entry.folder_path) {
      const parts = entry.folder_path.split('/').filter(p => p);
      if (entry.folder_path.startsWith('/github/')) {
        return `🐙 ${parts[1] || 'GitHub'}`;
      } else {
        return `📁 ${parts[0] || 'Folder'}`;
      }
    } else if (entry.category_id) {
      // Backward compatibility
      return `📂 Category ${entry.category_id}`;
    } else {
      return '👤 Personal Dictionary';
    }
  };

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
            <span className="ms-2">• {getScopeDisplay()}</span>
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
            variant="link"
            size="sm"
            onClick={() => onStartEdit(entry)}
            title="Edit notes"
            disabled={loading || isEditing}
            className="text-muted p-1 word-edit-btn"
            style={{ fontSize: '0.875rem' }}
          >
            <i className="bi bi-pencil"></i>
          </Button>
        )}
        <Button
          variant="link"
          size="sm"
          onClick={() => onDelete(entry.word)}
          title="Remove word"
          disabled={loading || isEditing}
          className="text-muted p-1 word-delete-btn"
          style={{ fontSize: '0.875rem' }}
        >
          <i className="bi bi-trash"></i>
        </Button>
      </div>
    </ListGroup.Item>
  );
}

/**
 * Dictionary word list component with comprehensive authentication and scope handling
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
  selectedScope,
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

  const getScopeDisplayText = () => {
    if (!selectedScope) return 'personal dictionary';

    switch (selectedScope.type) {
      case 'user':
        return 'personal dictionary';
      case 'folder':
        const folderName = selectedScope.folder_path?.split('/').filter(p => p)[0] || 'folder';
        return `${folderName} folder dictionary`;
      case 'repository':
        const repoName = selectedScope.folder_path?.split('/').filter(p => p)[1] || 'repository';
        return `${repoName} repository dictionary`;
      default:
        return 'dictionary';
    }
  };

  // Handle unauthenticated users with local storage
  if (!isAuthenticated) {
    return (
      <div>
        <Alert variant="info">
          <i className="bi bi-info-circle me-2"></i>
          You're using a local dictionary. Log in to sync your words across devices.
          {selectedScope && (
            <div className="mt-2">
              <strong>Scope:</strong> {getScopeDisplayText()}
            </div>
          )}
        </Alert>
        {entries.length === 0 ? (
          <Alert variant="secondary">
            {selectedScope
              ? `No custom words in the ${getScopeDisplayText()} yet.`
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
                    variant="link"
                    size="sm"
                    onClick={() => onLocalWordDelete && onLocalWordDelete(entry, selectedScope)}
                    title="Remove word"
                    className="text-muted p-1 word-delete-btn"
                    style={{ fontSize: '0.875rem' }}
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
        {selectedScope
          ? `No custom words in your ${getScopeDisplayText()} yet. Add words above or use "Add to Dictionary" in the editor when working with documents in this scope.`
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
            selectedScope={selectedScope}
            isAuthenticated={isAuthenticated}
          />
        ))}
      </ListGroup>
    </div>
  );
}
