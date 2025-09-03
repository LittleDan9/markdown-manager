import React from "react";
import { Card, Alert, Button, Badge, Modal, Spinner, Form } from "react-bootstrap";
import { SpellCheckService } from "@/services/editor";
import { useDictionaryState, useDictionaryOperations, useDictionaryUI } from "@/hooks";
import { DictionaryScopeSelector } from "./DictionaryScopeSelector";
import { DictionaryAddWordForm } from "./DictionaryAddWordForm";
import { DictionaryWordList } from "./DictionaryWordList";

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
    <Card className="mt-3">
      <Card.Body>
        <Card.Title>
          <i className="bi bi-book me-2"></i>Custom Dictionary
          <Badge bg="secondary" className="ms-2">
            {isAuthenticated
              ? `${displayInfo.count} words`
              : `${localWordCount} words`
            }
          </Badge>
          {displayInfo.scope && displayInfo.scope.type !== 'user' && (
            <Badge bg="info" className="ms-2">
              {displayInfo.scope.type === 'folder' ? '📁' : '🐙'} {displayInfo.scope.folder || displayInfo.scope.repository}
            </Badge>
          )}
        </Card.Title>

        <Card.Text className="text-muted">
          {isAuthenticated
            ? displayInfo.description
            : "Your custom words are stored locally. Log in to sync them across devices."
          }
        </Card.Text>

        {error && <Alert variant="danger">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}
        {syncing && (
          <Alert variant="info">
            <Spinner size="sm" className="me-2" />
            Syncing your local dictionary with the server...
          </Alert>
        )}

        <DictionaryScopeSelector
          availableScopes={availableScopes}
          selectedScope={selectedScope}
          currentScope={currentScope}
          onScopeChange={setSelectedScope}
          loading={isLoading}
          isAuthenticated={isAuthenticated}
        />

        <DictionaryAddWordForm
          newWord={newWord}
          setNewWord={setNewWord}
          newWordNotes={newWordNotes}
          setNewWordNotes={setNewWordNotes}
          onSubmit={(e) => handleFormSubmit(e, handleAddWord)}
          loading={isLoading}
        />

        {isAuthenticated && (
          <div className="mb-3">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={handleSyncWithBackend}
              disabled={isLoading}
            >
              {syncing ? (
                <>
                  <Spinner size="sm" className="me-1" />
                  Syncing...
                </>
              ) : (
                <>
                  <i className="bi bi-arrow-clockwise me-1"></i>
                  Sync with Server
                </>
              )}
            </Button>
          </div>
        )}

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
                <Button type="submit" variant="primary" disabled={isLoading} className="me-2">
                  {isLoading ? <Spinner size="sm" /> : "Save"}
                </Button>
                <Button variant="secondary" onClick={cancelEdit}>
                  Cancel
                </Button>
              </div>
            </Form>
          </Modal.Body>
        </Modal>
      </Card.Body>
    </Card>
  );
}

export default DictionaryTab;
