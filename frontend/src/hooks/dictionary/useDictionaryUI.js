import { useState, useCallback } from 'react';

/**
 * Custom hook for managing UI state in DictionaryTab
 * Handles form inputs, modals, notifications, and edit states
 */
export function useDictionaryUI() {
  // Form state
  const [newWord, setNewWord] = useState('');
  const [newWordNotes, setNewWordNotes] = useState('');

  // Modal and edit state
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);

  // Notification state
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Clear form
  const clearForm = useCallback(() => {
    setNewWord('');
    setNewWordNotes('');
  }, []);

  // Clear notifications
  const clearNotifications = useCallback(() => {
    setError('');
    setSuccess('');
  }, []);

  // Show success message
  const showSuccess = useCallback((message) => {
    setSuccess(message);
    setError('');
  }, []);

  // Show error message
  const showError = useCallback((message) => {
    setError(message);
    setSuccess('');
  }, []);

  // Handle form submission
  const handleFormSubmit = useCallback((e, onSubmit) => {
    e.preventDefault();
    clearNotifications();

    if (onSubmit) {
      onSubmit(newWord, newWordNotes)
        .then((result) => {
          if (result) {
            setNewWord(result.word || '');
            setNewWordNotes(result.notes || '');
          }
        })
        .catch(() => {
          // Error handling is done in the operation hook
        });
    }
  }, [newWord, newWordNotes, clearNotifications]);

  // Handle edit entry
  const startEdit = useCallback((entry) => {
    setEditingEntry({ ...entry, tempNotes: entry.notes || '' });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingEntry(null);
  }, []);

  const saveEdit = useCallback((entry, notes) => {
    setEditingEntry(null);
    // Return the values to be used by the parent component
    return { entry, notes };
  }, []);

  const updateEditNotes = useCallback((notes) => {
    if (editingEntry) {
      setEditingEntry({ ...editingEntry, tempNotes: notes });
    }
  }, [editingEntry]);

  // Handle delete confirmation
  const confirmDelete = useCallback((word) => {
    setDeleteConfirm(word);
  }, []);

  const cancelDelete = useCallback(() => {
    setDeleteConfirm(null);
  }, []);

  const executeDelete = useCallback(async (onDelete) => {
    if (!deleteConfirm || !onDelete) return;

    try {
      await onDelete(deleteConfirm);
      setDeleteConfirm(null);
    } catch (err) {
      // Error handling is done in the operation hook
    }
  }, [deleteConfirm]);

  return {
    // Form state
    newWord,
    setNewWord,
    newWordNotes,
    setNewWordNotes,
    clearForm,

    // Modal state
    deleteConfirm,
    editingEntry,

    // Notification state
    error,
    success,
    showSuccess,
    showError,
    clearNotifications,

    // Form handlers
    handleFormSubmit,

    // Edit handlers
    startEdit,
    cancelEdit,
    saveEdit,
    updateEditNotes,

    // Delete handlers
    confirmDelete,
    cancelDelete,
    executeDelete
  };
}
