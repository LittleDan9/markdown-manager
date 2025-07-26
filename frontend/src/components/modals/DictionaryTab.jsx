import React, { useState, useEffect } from "react";
import { Card, Form, Button, Alert, ListGroup, Badge, Modal, Spinner } from "react-bootstrap";
import { useAuth } from "../../context/AuthProvider";
import customDictionaryApi from "../../api/customDictionaryApi";
import CustomDictionarySyncService from "../../services/CustomDictionarySyncService";
import SpellCheckService from "../../services/SpellCheckService";

function DictionaryTab() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [localWordCount, setLocalWordCount] = useState(0);
  const [newWord, setNewWord] = useState("");
  const [newWordNotes, setNewWordNotes] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);

  // Check if user is truly authenticated (has token)
  const isAuthenticated = !!localStorage.getItem("authToken");

  // Update local word count
  const updateLocalWordCount = async () => {
    // Ensure SpellCheckService is initialized before getting words
    await SpellCheckService.init();
    const customWords = SpellCheckService.getCustomWords();
    console.log('updateLocalWordCount: words found:', customWords.length, customWords);
    console.log('updateLocalWordCount: localStorage raw:', localStorage.getItem('customDictionary'));
    setLocalWordCount(customWords.length);
  };

  // Load dictionary entries on mount and when user changes
  useEffect(() => {
    // console.log('DictionaryTab mounted, localStorage contents:', localStorage.getItem('customDictionary'));
    // console.log('Current user state:', user);
    // console.log('Has auth token:', !!localStorage.getItem("authToken"));
    // console.log('Is authenticated:', isAuthenticated);
    updateLocalWordCount();
    loadEntries();
  }, [user, isAuthenticated]);

  // Update local word count when component becomes visible
  useEffect(() => {
    updateLocalWordCount();
  }, []);

  const loadEntries = async () => {
    // Update local word count first
    await updateLocalWordCount();

    // If user is not authenticated, just update local count and return
    if (!isAuthenticated) {
      setEntries([]);
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // First sync local and backend dictionaries
      const syncResult = await CustomDictionarySyncService.syncAfterLogin();

      // Update local word count after sync
      await updateLocalWordCount();

      // Only load entries from backend if user is authenticated
      const token = localStorage.getItem("authToken");
      if (token) {
        // Then load the entries from backend for display
        const data = await customDictionaryApi.getEntries();

        // Ensure data is an array
        setEntries(Array.isArray(data) ? data : []);
      } else {
        setEntries([]);
      }
    } catch (err) {
      console.error('Failed to load dictionary entries:', err);
      if (err.message?.includes("Not authenticated")) {
        // Handle authentication error gracefully
        setEntries([]);
        setError("Please log in to manage your custom dictionary on the server");
      } else {
        setError(err.message || "Failed to load dictionary entries");
        setEntries([]); // Set to empty array on error
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddWord = async (e) => {
    e.preventDefault();
    if (!newWord.trim()) {
      setError("Please enter a word");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      // Use the sync service to add word to both local and backend
      await CustomDictionarySyncService.addWord(newWord.trim(), newWordNotes.trim() || null);

      // Update local word count
      await updateLocalWordCount();

      // Reload entries to show the new word
      await loadEntries();

      setNewWord("");
      setNewWordNotes("");
      setSuccess(`Added "${newWord.trim()}" to your dictionary`);
    } catch (err) {
      if (err.message?.includes("already exists")) {
        setError("This word is already in your dictionary");
      } else {
        setError(err.message || "Failed to add word");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWord = async (wordToDelete) => {
    try {
      // Use the sync service to delete from both local and backend
      await CustomDictionarySyncService.deleteWord(wordToDelete);

      // Update local word count
      await updateLocalWordCount();

      // Reload entries to update the list
      await loadEntries();

      setSuccess(`Deleted "${wordToDelete}" from your dictionary`);
    } catch (err) {
      console.error("Error deleting word:", err);
      setError(err.message || "Failed to delete word");
    }
  };

  const handleUpdateNotes = async (entry, newNotes) => {
    setLoading(true);
    try {
      const updatedEntry = await customDictionaryApi.updateWord(entry.id, newNotes);
      setEntries(prev => prev.map(e => e.id === entry.id ? updatedEntry : e));
      setEditingEntry(null);
      setSuccess(`Updated notes for "${entry.word}"`);
    } catch (err) {
      setError(err.message || "Failed to update notes");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncWithBackend = async () => {
    setLoading(true);
    try {
      await CustomDictionarySyncService.syncAfterLogin();
      await loadEntries(); // Reload entries to show any new words
      setSuccess("Dictionary synced with server");
    } catch (err) {
      setError(err.message || "Failed to sync dictionary");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mt-3">
      <Card.Body>
        <Card.Title>
          <i className="bi bi-book me-2"></i>Custom Dictionary
          <Badge bg="secondary" className="ms-2">
            {isAuthenticated ? `${entries.length} words` : `${localWordCount} local words`}
          </Badge>
        </Card.Title>
        <Card.Text className="text-muted">
          {isAuthenticated
            ? "Manage your personal spell check dictionary. Words added here will not be flagged as misspelled in the editor."
            : "Your custom words are stored locally. Log in to sync them across devices."
          }
        </Card.Text>

        {error && <Alert variant="danger">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        {/* Add new word form */}
        <Form onSubmit={handleAddWord} className="mb-4">
          <div className="row">
            <div className="col-md-4">
              <Form.Group className="mb-2">
                <Form.Label>New Word</Form.Label>
                <Form.Control
                  type="text"
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  placeholder="Enter word to add"
                  disabled={loading}
                />
              </Form.Group>
            </div>
            <div className="col-md-6">
              <Form.Group className="mb-2">
                <Form.Label>Notes (Optional)</Form.Label>
                <Form.Control
                  type="text"
                  value={newWordNotes}
                  onChange={(e) => setNewWordNotes(e.target.value)}
                  placeholder="Optional notes about this word"
                  disabled={loading}
                />
              </Form.Group>
            </div>
            <div className="col-md-2">
              <Form.Group className="mb-2">
                <Form.Label>&nbsp;</Form.Label>
                <div>
                  <Button type="submit" variant="primary" disabled={loading || !newWord.trim()}>
                    {loading ? <Spinner size="sm" /> : "Add"}
                  </Button>
                </div>
              </Form.Group>
            </div>
          </div>
        </Form>

        {/* Sync button - only show for authenticated users */}
        {isAuthenticated && (
          <div className="mb-3">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={handleSyncWithBackend}
              disabled={loading}
            >
              <i className="bi bi-arrow-clockwise me-1"></i>
              Sync with Server
            </Button>
          </div>
        )}

        {/* Dictionary entries list */}
        {loading && entries.length === 0 ? (
          <div className="text-center">
            <Spinner />
            <div className="mt-2">Loading dictionary...</div>
          </div>
        ) : !isAuthenticated ? (
          // Show local words for non-authenticated users
          <div>
            {console.log('Rendering local words section, localWordCount:', localWordCount, 'customWords:', SpellCheckService.getCustomWords())}
            <Alert variant="info">
              <i className="bi bi-info-circle me-2"></i>
              You're using a local dictionary. Log in to sync your words across devices.
            </Alert>
            {localWordCount === 0 ? (
              <Alert variant="secondary">
                No custom words yet. Add words above or use "Add to Dictionary" in the editor.
              </Alert>
            ) : (
              <ListGroup>
                {SpellCheckService.getCustomWords().map((word, index) => (
                  <ListGroup.Item key={index} className="d-flex justify-content-between align-items-center">
                    <div className="fw-bold">{word}</div>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={async () => {
                        SpellCheckService.removeCustomWord(word);
                        await updateLocalWordCount();
                        setSuccess(`Removed "${word}" from local dictionary`);
                      }}
                      title="Remove word"
                    >
                      <i className="bi bi-trash"></i>
                    </Button>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
          </div>
        ) : !Array.isArray(entries) || entries.length === 0 ? (
          <Alert variant="info">
            No custom words in your dictionary yet. Add words above or use "Add to Dictionary" in the editor.
          </Alert>
        ) : (
          <ListGroup>
            {entries.map((entry) => (
              <ListGroup.Item key={entry.id} className="d-flex justify-content-between align-items-start">
                <div className="flex-grow-1">
                  <div className="fw-bold">{entry.word}</div>
                  {entry.notes && (
                    <small className="text-muted">{entry.notes}</small>
                  )}
                  <small className="text-muted d-block">
                    Added: {new Date(entry.created_at).toLocaleDateString()}
                  </small>
                </div>
                <div className="btn-group btn-group-sm">
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => setEditingEntry(entry)}
                    title="Edit notes"
                  >
                    <i className="bi bi-pencil"></i>
                  </Button>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => setDeleteConfirm(entry)}
                    title="Delete word"
                  >
                    <i className="bi bi-trash"></i>
                  </Button>
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}

        {/* Delete confirmation modal */}
        <Modal show={deleteConfirm !== null} onHide={() => setDeleteConfirm(null)}>
          <Modal.Header closeButton>
            <Modal.Title>Delete Word</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            Are you sure you want to delete "{deleteConfirm?.word}" from your dictionary?
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                const word = deleteConfirm?.word;
                setDeleteConfirm(null);
                if (word) await handleDeleteWord(word);
              }}
              disabled={loading}
            >
              {loading ? <Spinner size="sm" /> : "Delete"}
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Edit notes modal */}
        <Modal show={editingEntry !== null} onHide={() => setEditingEntry(null)}>
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
                <Button type="submit" variant="primary" disabled={loading} className="me-2">
                  {loading ? <Spinner size="sm" /> : "Save"}
                </Button>
                <Button variant="secondary" onClick={() => setEditingEntry(null)}>
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
