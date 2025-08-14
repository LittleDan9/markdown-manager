import React, { useState, useEffect } from "react";
import { Card, Form, Button, Alert, ListGroup, Badge, Modal, Spinner } from "react-bootstrap";
import { useAuth } from "@/context/AuthContext";
import customDictionaryApi from "@/api/customDictionaryApi";
import categoriesApi from "@/api/categoriesApi";
import DictionaryService from "@/services/DictionaryService";
import SpellCheckService from "@/services/SpellCheckService";

function DictionaryTab() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(''); // Empty string for user-level
  const [localWordCount, setLocalWordCount] = useState(0);
  const [newWord, setNewWord] = useState("");
  const [newWordNotes, setNewWordNotes] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);

  // Check if user is truly authenticated (has token)
  const isAuthenticated = !!localStorage.getItem("authToken");

  // Update local word count
  const updateLocalWordCount = async () => {
    // Get words based on selected category
    let customWords;
    if (selectedCategory) {
      // Category-specific words only (not combined with user words)
      customWords = DictionaryService.getCategoryWords(selectedCategory);
    } else {
      // Just user-level words
      customWords = DictionaryService.getCustomWords();
    }
    console.log('updateLocalWordCount: words found:', customWords.length, customWords);
    console.log('updateLocalWordCount: selectedCategory:', selectedCategory);
    setLocalWordCount(customWords.length);
  };

  // Load categories on mount and when authentication changes
  useEffect(() => {
    if (isAuthenticated) {
      loadCategories();
    } else {
      // For demo purposes, show some mock categories when not authenticated
      // to demonstrate the UI - in production this would be empty
      setCategories([
        { id: 'demo-1', name: 'General' },
        { id: 'demo-2', name: 'Technical' },
        { id: 'demo-3', name: 'Personal' }
      ]);
    }
  }, [isAuthenticated]);

  // Handle authentication state changes for syncing
  useEffect(() => {
    if (isAuthenticated) {
      // When user logs in, trigger sync and reload everything
      handleLoginSync();
    } else {
      // When user logs out, reset to demo categories
      setSelectedCategory('');
      setEntries([]);
    }
  }, [isAuthenticated]);

  const handleLoginSync = async () => {
    try {
      setSyncing(true);
      setLoading(true);
      console.log('User logged in, syncing dictionaries...');

      // First load real categories
      await loadCategories();

      // Then sync dictionaries (this will handle demo category migration)
      await DictionaryService.syncAfterLogin();

      // Reset category selection to default
      setSelectedCategory('');

      // Reload entries
      await loadEntries();

      setSuccess('Dictionary synced successfully with server! Any words you added locally have been uploaded.');
    } catch (error) {
      console.error('Failed to sync after login:', error);
      setError('Failed to sync dictionary with server');
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      console.log('Loading categories...');
      const categoriesData = await categoriesApi.getCategories();
      console.log('Categories loaded:', categoriesData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Failed to load categories:', error);
      // Don't show error to user - categories are optional
    }
  };

  // Load dictionary entries on mount and when user changes
  useEffect(() => {
    // console.log('DictionaryTab mounted, localStorage contents:', localStorage.getItem('customDictionary'));
    // console.log('Current user state:', user);
    // console.log('Has auth token:', !!localStorage.getItem("authToken"));
    // console.log('Is authenticated:', isAuthenticated);
    updateLocalWordCount();
    loadEntries();
  }, [user, isAuthenticated, selectedCategory]);

  // Update local word count when component becomes visible or dictionary changes
  useEffect(() => {
    const handler = async () => {
      await loadEntries();
    }

    // Listen for all dictionary events
    window.addEventListener('dictionary:wordAdded', handler);
    window.addEventListener('dictionary:wordRemoved', handler);
    window.addEventListener('dictionary:updated', handler);
    window.addEventListener('dictionary:categoryWordAdded', handler);
    window.addEventListener('dictionary:categoryWordRemoved', handler);
    window.addEventListener('dictionary:categoryUpdated', handler);

    return () => {
      window.removeEventListener('dictionary:wordAdded', handler);
      window.removeEventListener('dictionary:wordRemoved', handler);
      window.removeEventListener('dictionary:updated', handler);
      window.removeEventListener('dictionary:categoryWordAdded', handler);
      window.removeEventListener('dictionary:categoryWordRemoved', handler);
      window.removeEventListener('dictionary:categoryUpdated', handler);
    };
  }, []);

  const loadEntries = async () => {
    // Update local word count first
    await updateLocalWordCount();

    // If user is not authenticated, use local storage data
    if (!isAuthenticated) {
      // For unauthenticated users, we need to simulate entries from local storage
      if (selectedCategory) {
        // When a category is selected, show category-specific words from local storage
        const categoryWords = DictionaryService.getCategoryWords(selectedCategory);
        const categoryEntries = categoryWords.map((word, index) => ({
          id: `local-category-${selectedCategory}-${index}`,
          word,
          notes: null,
          category_id: selectedCategory,
          created_at: new Date().toISOString()
        }));
        setEntries(categoryEntries);
      } else {
        // When no category is selected, show user-level words from local storage
        const userWords = DictionaryService.getCustomWords();
        const userEntries = userWords.map((word, index) => ({
          id: `local-user-${index}`,
          word,
          notes: null,
          category_id: null,
          created_at: new Date().toISOString()
        }));
        setEntries(userEntries);
      }
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // Update local word count after any changes
      await updateLocalWordCount();

      // Only load entries from backend if user is authenticated
      const token = localStorage.getItem("authToken");
      if (token) {
        // Load entries based on selected category
        const categoryId = selectedCategory || null;
        const data = await customDictionaryApi.getEntries(categoryId);

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
      const categoryId = selectedCategory || null;
      await DictionaryService.addWord(newWord.trim(), newWordNotes.trim() || null, categoryId);

      // Update local word count
      await updateLocalWordCount();

      // Reload entries to show the new word
      await loadEntries();

      setNewWord("");
      setNewWordNotes("");

      const categoryText = selectedCategory ? ` to ${categories.find(c => c.id === selectedCategory)?.name || 'category'}` : '';
      setSuccess(`Added "${newWord.trim()}" to your dictionary${categoryText}`);
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
      const categoryId = selectedCategory || null;
      await DictionaryService.deleteWord(wordToDelete, categoryId);

      // Update local word count
      await updateLocalWordCount();

      // Reload entries to update the list
      await loadEntries();

      const categoryText = selectedCategory ? ` from ${categories.find(c => c.id === selectedCategory)?.name || 'category'}` : '';
      setSuccess(`Deleted "${wordToDelete}" from your dictionary${categoryText}`);
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
    setSyncing(true);
    setLoading(true);
    try {
      await DictionaryService.syncAfterLogin();
      await loadEntries(); // Reload entries to show any new words
      setSuccess("Dictionary synced with server. All categories updated.");
    } catch (err) {
      setError(err.message || "Failed to sync dictionary");
    } finally {
      setSyncing(false);
      setLoading(false);
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

        {/* Category selection - show when categories are available */}
        {categories.length > 0 && (
          <div className="mb-3">
            <Form.Group>
              <Form.Label>Dictionary Scope</Form.Label>
              <Form.Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
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
        )}

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
          // Show local words for non-authenticated users with proper category filtering
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
                        onClick={async () => {
                          // Handle local word deletion based on category
                          if (selectedCategory) {
                            DictionaryService.removeCategoryWord(selectedCategory, entry.word);
                          } else {
                            DictionaryService.removeCustomWord(entry.word);
                          }
                          await updateLocalWordCount();
                          await loadEntries(); // Refresh the list
                          const scopeText = selectedCategory
                            ? ` from ${categories.find(c => c.id === selectedCategory)?.name || 'category'} dictionary`
                            : ' from personal dictionary';
                          setSuccess(`Removed "${entry.word}"${scopeText}`);
                        }}
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
        ) : !Array.isArray(entries) || entries.length === 0 ? (
          <Alert variant="info">
            {selectedCategory
              ? `No custom words in the ${categories.find(c => c.id === selectedCategory)?.name || 'selected'} category dictionary yet. Add words above or use "Add to Dictionary" in the editor when working with documents in this category.`
              : "No custom words in your personal dictionary yet. Add words above or use \"Add to Dictionary\" in the editor."
            }
          </Alert>
        ) : (
          <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '0.375rem' }}>
            <ListGroup variant="flush">
              {entries.map((entry) => (
                <ListGroup.Item key={entry.id} className="d-flex justify-content-between align-items-start">
                  <div className="flex-grow-1">
                    <div className="fw-bold">{entry.word}</div>
                    {entry.notes && (
                      <small className="text-muted">{entry.notes}</small>
                    )}
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
          </div>
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
