import React from "react";
import { Alert, Button, Badge, Modal, Spinner, Form, Accordion } from "react-bootstrap";
import { SpellCheckService } from "@/services/editor";
import { useDictionaryState, useDictionaryOperations, useDictionaryUI } from "@/hooks";
import { DictionaryScopeSelector } from "./DictionaryScopeSelector";
import { DictionaryAddWordForm } from "./DictionaryAddWordForm";
import { DictionaryWordList } from "./DictionaryWordList";
import { ActionButton, FormField } from "@/components/shared";

function DictionaryTab() {
  // State management hooks
  const {
    entries,
    availableScopes,
    selectedScope,
    currentScope,
    localWordCount,
    loading,
    syncing,
    isAuthenticated,
    setSelectedScope,
    loadEntries,
    syncWithBackend,
    updateLocalWordCount
  } = useDictionaryState();

  // UI state management
  const {
    newWord,
    setNewWord,
    newWordNotes,
    setNewWordNotes,
    deleteConfirm,
    editingEntry,
    error,
    success,
    clearNotifications,
    showSuccess,
    showError,
    handleFormSubmit,
    startEdit,
    cancelEdit,
    saveEdit,
    updateEditNotes,
    confirmDelete,
    cancelDelete,
    executeDelete
  } = useDictionaryUI();

  // Operations hook
  const {
    operationLoading,
    addWord,
    deleteWord,
    updateWordNotes
  } = useDictionaryOperations({
    selectedScope,
    onSuccess: showSuccess,
    onError: showError,
    onEntriesChange: async () => {
      await updateLocalWordCount();
      await loadEntries();
    }
  });

  // Combined loading state
  const isLoading = loading || operationLoading;

  // Handler functions
  const handleAddWord = (word, notes) => addWord(word, notes);
  const handleDeleteWord = (word) => deleteWord(word);
  const handleUpdateNotes = (entry, notes) => updateWordNotes(entry, notes);
  const handleSyncWithBackend = () => syncWithBackend();

  // Handle save edit - combine UI action with operation
  const handleSaveEdit = (entry, notes) => {
    const result = saveEdit(entry, notes);
    if (result) {
      handleUpdateNotes(result.entry, result.notes);
    }
  };

  // Handle local word deletion for unauthenticated users
  const handleLocalWordDelete = async (entry) => {
    try {
      const { DictionaryService } = await import('@/services/utilities');
      const scope = selectedScope || currentScope;

      if (scope?.folderPath) {
        DictionaryService.removeFolderWord(scope.folderPath, entry.word);
      } else if (scope?.categoryId) {
        // Backward compatibility
        DictionaryService.removeCategoryWord(scope.categoryId, entry.word);
      } else {
        DictionaryService.removeCustomWord(entry.word);
      }

      await updateLocalWordCount();
      await loadEntries();

      const scopeText = scope?.displayName || 'personal dictionary';
      showSuccess(`Removed "${entry.word}" from ${scopeText}`);
    } catch (error) {
      console.error('Error deleting local word:', error);
      showError('Failed to remove word from local dictionary');
    }
  };

  // Get display information for current scope
  const getDisplayInfo = () => {
    const scope = selectedScope || currentScope;
    const count = entries.length || localWordCount;

    return {
      scope,
      count,
      title: scope?.displayName || 'Personal Dictionary',
      description: scope?.type === 'folder'
        ? `Manage custom words for documents in the "${scope.folder}" folder. These words won't be flagged as misspelled in documents within this folder.`
        : scope?.type === 'github'
        ? `Manage custom words for the "${scope.repository}" repository. These words won't be flagged as misspelled in documents from this repository.`
        : "Manage your personal spell check dictionary. Words added here will not be flagged as misspelled in any document."
    };
  };

  const displayInfo = getDisplayInfo();

  return (
    <div className="dictionary-tab">
      {/* Clean Header */}
      <div className="dictionary-header">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <h5 className="mt-2 mb-0 d-flex align-items-center">
            <i className="bi bi-journal-plus text-secondary me-2"></i>
            Custom Words
          </h5>
          {isAuthenticated && (
            <Button
              variant="link"
              size="sm"
              onClick={handleSyncWithBackend}
              disabled={isLoading}
              className="text-muted p-0"
              title="Sync with server"
            >
              {syncing ? (
                <Spinner size="sm" />
              ) : (
                <i className="bi bi-arrow-clockwise"></i>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="danger" className="py-2 d-flex justify-content-between align-items-center">
          <span>{error}</span>
          <Button
            variant="link"
            size="sm"
            onClick={clearNotifications}
            className="text-danger p-0 ms-2"
            style={{ fontSize: '1.2rem', lineHeight: 1, textDecoration: 'none' }}
            title="Dismiss"
          >
            ×
          </Button>
        </Alert>
      )}
      {success && (
        <Alert variant="success" className="py-2 d-flex justify-content-between align-items-center">
          <span>{success}</span>
          <Button
            variant="link"
            size="sm"
            onClick={clearNotifications}
            className="text-success p-0 ms-2"
            style={{ fontSize: '1.2rem', lineHeight: 1, textDecoration: 'none' }}
            title="Dismiss"
          >
            ×
          </Button>
        </Alert>
      )}
      {syncing && (
        <Alert variant="info" className="py-2">
          <Spinner size="sm" className="me-2" />
          Syncing with server...
        </Alert>
      )}

      {/* Scope Selector - More Compact */}
      <div className="mb-3">
        <DictionaryScopeSelector
          availableScopes={availableScopes}
          selectedScope={selectedScope}
          currentScope={currentScope}
          onScopeChange={setSelectedScope}
          loading={isLoading}
          isAuthenticated={isAuthenticated}
          wordCount={displayInfo.count}
          localWordCount={localWordCount}
        />
      </div>

      {/* Add Word - Inline Form */}
      <div className="add-word-section mb-4">
        <div className="d-flex gap-2">
          <div className="flex-grow-1">
            <Form.Control
              type="text"
              placeholder="Add a new word..."
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const form = { preventDefault: () => {}, target: { word: { value: newWord }, notes: { value: newWordNotes } } };
                  handleFormSubmit(form, handleAddWord);
                }
              }}
              disabled={isLoading}
            />
          </div>
          <Button
            variant="primary"
            onClick={() => {
              const form = { preventDefault: () => {}, target: { word: { value: newWord }, notes: { value: newWordNotes } } };
              handleFormSubmit(form, handleAddWord);
            }}
            disabled={isLoading || !newWord.trim()}
            className="px-3"
          >
            {isLoading ? <Spinner size="sm" /> : <i className="bi bi-plus-lg"></i>}
          </Button>
        </div>

        {/* Optional notes field - only show when typing */}
        {newWord.trim() && (
          <div className="mt-2">
            <Form.Control
              type="text"
              placeholder="Optional notes..."
              value={newWordNotes}
              onChange={(e) => setNewWordNotes(e.target.value)}
              size="sm"
              disabled={isLoading}
            />
          </div>
        )}
      </div>

      {/* Word List - Clean Design */}
      <div className="word-list-section">
        <div className="word-list-container">
          {(!entries || entries.length === 0) && !isLoading ? (
            <div className="empty-state">
              <div className="text-center py-5">
                <i className="bi bi-journal-text text-muted display-6 mb-3"></i>
                <p className="text-muted mb-0">No custom words yet</p>
                <small className="text-muted">Add words above to build your dictionary</small>
              </div>
            </div>
          ) : (
            <DictionaryWordList
              entries={entries}
              editingEntry={editingEntry}
              onStartEdit={startEdit}
              onCancelEdit={cancelEdit}
              onSaveEdit={handleSaveEdit}
              onUpdateEditNotes={updateEditNotes}
              onDeleteWord={confirmDelete}
              loading={isLoading}
              isAuthenticated={isAuthenticated}
              selectedScope={selectedScope || currentScope}
              localWordCount={localWordCount}
              onLocalWordDelete={handleLocalWordDelete}
            />
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal show={!!deleteConfirm} onHide={cancelDelete}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to remove "{deleteConfirm}" from your dictionary?
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={cancelDelete}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => executeDelete(handleDeleteWord)}
            disabled={isLoading}
          >
            Delete
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Edit Notes Modal */}
      <Modal show={editingEntry !== null} onHide={cancelEdit}>
        <Modal.Header closeButton>
          <Modal.Title>Edit Notes for "{editingEntry?.word}"</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              handleUpdateNotes(editingEntry, formData.get('notes'));
            }}
          >
            <Form.Group>
              <Form.Label>Notes</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="notes"
                defaultValue={editingEntry?.notes || ""}
                placeholder="Optional notes about this word"
              />
            </Form.Group>
            <div className="mt-3">
              <ActionButton type="submit" loading={isLoading} className="me-2">
                Save
              </ActionButton>
              <ActionButton variant="secondary" onClick={cancelEdit}>
                Cancel
              </ActionButton>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
}

export default DictionaryTab;
