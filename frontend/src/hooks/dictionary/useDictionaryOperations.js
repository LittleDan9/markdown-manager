import { useState, useCallback } from 'react';
import { DictionaryService } from '@/services/utilities';

/**
 * Custom hook for dictionary CRUD operations
 * Handles adding, updating, and deleting dictionary words
 */
export function useDictionaryOperations({ selectedCategory, categories, onSuccess, onError, onEntriesChange }) {
  const [operationLoading, setOperationLoading] = useState(false);

  // Add a new word
  const addWord = useCallback(async (word, notes = '') => {
    if (!word?.trim()) {
      throw new Error('Please enter a word');
    }

    setOperationLoading(true);

    try {
      const categoryId = selectedCategory || null;
      await DictionaryService.addWord(word.trim(), notes.trim() || null, categoryId);

      // Notify parent to refresh
      if (onEntriesChange) {
        await onEntriesChange();
      }

      const categoryText = selectedCategory 
        ? ` to ${categories.find(c => c.id === selectedCategory)?.name || 'category'}` 
        : '';
      
      const successMessage = `Added "${word.trim()}" to your dictionary${categoryText}`;
      if (onSuccess) onSuccess(successMessage);
      
      return { word: '', notes: '' }; // Return cleared form values
    } catch (err) {
      const errorMessage = err.message?.includes("already exists") 
        ? "This word is already in your dictionary"
        : err.message || "Failed to add word";
      
      if (onError) onError(errorMessage);
      throw err;
    } finally {
      setOperationLoading(false);
    }
  }, [selectedCategory, categories, onSuccess, onError, onEntriesChange]);

  // Delete a word
  const deleteWord = useCallback(async (wordToDelete) => {
    setOperationLoading(true);

    try {
      const categoryId = selectedCategory || null;
      await DictionaryService.deleteWord(wordToDelete, categoryId);

      // Notify parent to refresh
      if (onEntriesChange) {
        await onEntriesChange();
      }

      const categoryText = selectedCategory 
        ? ` from ${categories.find(c => c.id === selectedCategory)?.name || 'category'}` 
        : '';
      
      const successMessage = `Deleted "${wordToDelete}" from your dictionary${categoryText}`;
      if (onSuccess) onSuccess(successMessage);
    } catch (err) {
      console.error("Error deleting word:", err);
      const errorMessage = err.message || "Failed to delete word";
      if (onError) onError(errorMessage);
      throw err;
    } finally {
      setOperationLoading(false);
    }
  }, [selectedCategory, categories, onSuccess, onError, onEntriesChange]);

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
