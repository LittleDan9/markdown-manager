import React from "react";
import { Card, Alert, Button, Badge, Modal, Spinner } from "react-bootstrap";
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
              : 'Manage your personal custom dictionary. These words won\'t be flagged as misspelled in any document.'
            : selectedCategory
              ? `Add words to your local ${categories.find(c => c.id === selectedCategory)?.name || 'category'} dictionary. These words won't be flagged as misspelled while working offline.`
              : 'Add words to your local personal dictionary. These words won\'t be flagged as misspelled while working offline.'
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
              variant="outline-primary"
              onClick={handleSyncWithBackend}
              disabled={isLoading}
              className="w-100"
            >
              {syncing ? (
                <>
                  <Spinner size="sm" className="me-2" />
                  Syncing...
                </>
              ) : (
                <>
                  <i className="bi bi-arrow-repeat me-2"></i>
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
          onSaveEdit={saveEdit}
          onUpdateEditNotes={updateEditNotes}
          onDeleteWord={confirmDelete}
          loading={isLoading}
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
      </Card.Body>
    </Card>
  );
}

export default DictionaryTab;
