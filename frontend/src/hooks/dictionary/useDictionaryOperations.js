import { useState, useCallback } from 'react';
import DictionaryService from '@/services/dictionary';

/**
 * Custom hook for dictionary CRUD operations
 * Updated to support folder-path based dictionaries
 */
export function useDictionaryOperations({ selectedScope, onSuccess, onError, onEntriesChange }) {
  const [operationLoading, setOperationLoading] = useState(false);

  // Add a new word
  const addWord = useCallback(async (word, notes = '') => {
    if (!word?.trim()) {
      throw new Error('Please enter a word');
    }

    setOperationLoading(true);

    try {
      const scope = selectedScope;
      if (scope?.folderPath) {
        await DictionaryService.addWord(word.trim(), notes.trim() || null, scope.folderPath);
      } else if (scope?.categoryId) {
        // Backward compatibility
        await DictionaryService.addWord(word.trim(), notes.trim() || null, null, scope.categoryId);
      } else {
        // User-level dictionary
        await DictionaryService.addWord(word.trim(), notes.trim() || null);
      }

      // Notify parent to refresh
      if (onEntriesChange) {
        await onEntriesChange();
      }

      const scopeText = scope?.displayName || 'personal dictionary';
      const successMessage = `Added "${word.trim()}" to ${scopeText}`;
      if (onSuccess) onSuccess(successMessage);

      return { word: '', notes: '' }; // Return cleared form values
    } catch (err) {
      // Use the detailed error message from the API
      const errorMessage = err.message || "Failed to add word";

      if (onError) onError(errorMessage);
      throw err;
    } finally {
      setOperationLoading(false);
    }
  }, [selectedScope, onSuccess, onError, onEntriesChange]);

  // Delete a word
  const deleteWord = useCallback(async (wordToDelete) => {
    setOperationLoading(true);

    try {
      const scope = selectedScope;
      if (scope?.folderPath) {
        await DictionaryService.deleteWord(wordToDelete, scope.folderPath);
      } else if (scope?.categoryId) {
        // Backward compatibility
        await DictionaryService.deleteWord(wordToDelete, null, scope.categoryId);
      } else {
        // User-level dictionary
        await DictionaryService.deleteWord(wordToDelete);
      }

      // Notify parent to refresh
      if (onEntriesChange) {
        await onEntriesChange();
      }

      const scopeText = scope?.displayName || 'personal dictionary';
      const successMessage = `Deleted "${wordToDelete}" from ${scopeText}`;
      if (onSuccess) onSuccess(successMessage);
    } catch (err) {
      console.error("Error deleting word:", err);
      const errorMessage = err.message || "Failed to delete word";
      if (onError) onError(errorMessage);
      throw err;
    } finally {
      setOperationLoading(false);
    }
  }, [selectedScope, onSuccess, onError, onEntriesChange]);

  // Update word notes
  const updateWordNotes = useCallback(async (entry, newNotes) => {
    setOperationLoading(true);

    try {
      const updatedEntry = await DictionaryService.updateWordNotes(entry.id, newNotes);

      const successMessage = `Updated notes for "${entry.word}"`;
      if (onSuccess) onSuccess(successMessage);

      return updatedEntry;
    } catch (err) {
      const errorMessage = err.message || "Failed to update notes";
      if (onError) onError(errorMessage);
      throw err;
    } finally {
      setOperationLoading(false);
    }
  }, [onSuccess, onError]);

  return {
    operationLoading,
    addWord,
    deleteWord,
    updateWordNotes
  };
}
