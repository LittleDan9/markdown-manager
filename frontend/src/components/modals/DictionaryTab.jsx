import React from "react";
import { Card, Alert, Button, Badge, Modal, Spinner, Form } from "react-bootstrap";
import { SpellCheckService } from "@/services/editor";
import { useDictionaryState, useDictionaryOperations, useDictionaryUI } from "@/hooks";
import { DictionaryCategorySelector } from "./DictionaryCategorySelector";
import { DictionaryAddWordForm } from "./DictionaryAddWordForm";
import { DictionaryWordList } from "./DictionaryWordList";

function DictionaryTab() {
  // State management hooks
  const {
    entries,
    categories,
    selectedCategory,
    localWordCount,
    loading,
    syncing,
    isAuthenticated,
    setSelectedCategory,
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
    selectedCategory,
    categories,
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
  const handleLocalWordDelete = async (entry, categoryId) => {
    try {
      const { DictionaryService } = await import('@/services/utilities');

      if (categoryId) {
        DictionaryService.removeCategoryWord(categoryId, entry.word);
      } else {
        DictionaryService.removeCustomWord(entry.word);
      }

      await updateLocalWordCount();
      await loadEntries();

      const scopeText = categoryId
        ? ` from ${categories.find(c => c.id === categoryId)?.name || 'category'} dictionary`
        : ' from personal dictionary';
      showSuccess(`Removed "${entry.word}"${scopeText}`);
    } catch (error) {
      console.error('Error deleting local word:', error);
      showError('Failed to remove word from local dictionary');
    }
  };

  return (
    <Card className="mt-3">
      <Card.Body>
        <Card.Title>
          <i className="bi bi-book me-2"></i>Custom Dictionary
          <Badge bg="secondary" className="ms-2">
            {isAuthenticated
              ? `${entries.length} words`
              : selectedCategory
                ? `${localWordCount} category words`
                : `${localWordCount} personal words`
            }
          </Badge>
          {selectedCategory && (
            <Badge bg="info" className="ms-2">
              {categories.find(c => c.id === selectedCategory)?.name || 'Category'}
            </Badge>
          )}
        </Card.Title>

        <Card.Text className="text-muted">
          {isAuthenticated
            ? selectedCategory
              ? `Manage custom words for the ${categories.find(c => c.id === selectedCategory)?.name || 'selected'} category. These words won't be flagged as misspelled in documents of this category.`
              : "Manage your personal spell check dictionary. Words added here will not be flagged as misspelled in any document."
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

        <DictionaryCategorySelector
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
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
          categories={categories}
          selectedCategory={selectedCategory}
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
