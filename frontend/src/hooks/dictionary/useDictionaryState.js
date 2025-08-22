import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useDocumentContext } from '@/providers/DocumentContextProvider.jsx';
import { DictionaryService } from '@/services/utilities';

/**
 * Custom hook for managing dictionary state and operations
 * Handles entries, categories, word counts, and category selection
 */
export function useDictionaryState() {
  const { user, isAuthenticated } = useAuth();
  const { categories: documentCategories } = useDocumentContext();
  
  // Core state
  const [entries, setEntries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [localWordCount, setLocalWordCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Update local word count
  const updateLocalWordCount = useCallback(async () => {
    console.log('updateLocalWordCount called with selectedCategory:', selectedCategory);
    const wordCount = DictionaryService.getWordCount(selectedCategory || null);
    console.log('updateLocalWordCount: words found:', wordCount);
    setLocalWordCount(wordCount);
  }, [selectedCategory]);

  // Load categories
  const loadCategories = useCallback(async () => {
    try {
      console.log('Loading categories...');
      const categoriesData = await DictionaryService.getCategories();
      console.log('Categories loaded:', categoriesData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Failed to load categories:', error);
      // Don't throw - categories are optional
    }
  }, []);

  // Load dictionary entries
  const loadEntries = useCallback(async () => {
    console.log('loadEntries called with selectedCategory:', selectedCategory);
    
    // Update local word count first
    await updateLocalWordCount();

    setLoading(true);

    try {
      const categoryId = selectedCategory || null;
      const entries = await DictionaryService.getEntries(categoryId);
      setEntries(entries);
    } catch (err) {
      console.error('Failed to load dictionary entries:', err);
      if (err.message?.includes("Not authenticated")) {
        setEntries([]);
        throw new Error("Please log in to manage your custom dictionary on the server");
      } else {
        setEntries([]);
        throw new Error(err.message || "Failed to load dictionary entries");
      }
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, updateLocalWordCount]);

  // Sync with backend
  const syncWithBackend = useCallback(async () => {
    setSyncing(true);
    setLoading(true);
    try {
      await DictionaryService.syncAfterLogin();
      await loadEntries(); // Reload entries to show any new words
      return "Dictionary synced with server. All categories updated.";
    } catch (err) {
      throw new Error(err.message || "Failed to sync dictionary");
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  }, [loadEntries]);

  // Handle category selection change
  const handleCategoryChange = useCallback((categoryId) => {
    console.log('Category changed from', selectedCategory, 'to', categoryId);
    setSelectedCategory(categoryId);
  }, [selectedCategory]);

  // Load categories on mount and when authentication changes
  useEffect(() => {
    if (isAuthenticated) {
      loadCategories();
    } else {
      // For unauthenticated users, use the actual document categories
      const formattedCategories = documentCategories
        .map(categoryName => ({
          id: categoryName,
          name: categoryName
        }));
      console.log('Using document categories for dictionary:', formattedCategories);
      setCategories(formattedCategories);
    }
  }, [isAuthenticated, documentCategories, loadCategories]);

  // Handle authentication state changes for syncing
  useEffect(() => {
    if (isAuthenticated) {
      // Auto-sync when user logs in
      syncWithBackend().catch(console.error);
    }
  }, [isAuthenticated, syncWithBackend]);

  // Load entries when component mounts or category changes
  useEffect(() => {
    updateLocalWordCount();
    loadEntries().catch(console.error);
  }, [user, isAuthenticated, selectedCategory, updateLocalWordCount, loadEntries]);

  // Listen for dictionary update events
  useEffect(() => {
    const handler = async () => {
      await updateLocalWordCount();
      await loadEntries().catch(console.error);
    }

    window.addEventListener('dictionary:updated', handler);
    window.addEventListener('dictionary:categoryUpdated', handler);
    window.addEventListener('dictionary:wordUpdated', handler);

    return () => {
      window.removeEventListener('dictionary:updated', handler);
      window.removeEventListener('dictionary:categoryUpdated', handler);
      window.removeEventListener('dictionary:wordUpdated', handler);
    };
  }, [updateLocalWordCount, loadEntries]);

  return {
    // State
    entries,
    categories,
    selectedCategory,
    localWordCount,
    loading,
    syncing,
    isAuthenticated,
    
    // Actions
    setSelectedCategory: handleCategoryChange,
    loadEntries,
    syncWithBackend,
    updateLocalWordCount
  };
}
