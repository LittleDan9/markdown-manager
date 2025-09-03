import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useDocumentContext } from '@/providers/DocumentContextProvider.jsx';
import DictionaryService from '@/services/dictionary';

/**
 * Custom hook for managing dictionary state and operations
 * Updated to support folder-path based dictionaries
 */
export function useDictionaryState() {
  const { user, isAuthenticated } = useAuth();
  const { currentDocument, documents } = useDocumentContext();

  // Core state
  const [entries, setEntries] = useState([]);
  const [availableScopes, setAvailableScopes] = useState([]);
  const [selectedScope, setSelectedScope] = useState(null);
  const [localWordCount, setLocalWordCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Get current dictionary scope based on active document
  const getCurrentScope = useCallback(() => {
    return DictionaryService.getDictionaryScope(currentDocument);
  }, [currentDocument]);

  // Update local word count
  const updateLocalWordCount = useCallback(async () => {
    const scope = selectedScope || getCurrentScope();
    console.log('updateLocalWordCount called with scope:', scope);
    
    let wordCount = 0;
    if (scope?.folderPath) {
      wordCount = DictionaryService.getWordCount(scope.folderPath);
    } else if (scope?.categoryId) {
      // Backward compatibility
      wordCount = DictionaryService.getWordCount(null, scope.categoryId);
    } else {
      // User-level dictionary
      wordCount = DictionaryService.getWordCount();
    }
    
    console.log('updateLocalWordCount: words found:', wordCount);
    setLocalWordCount(wordCount);
  }, [selectedScope, currentDocument]);

  // Load available scopes
  const loadAvailableScopes = useCallback(() => {
    const scopes = DictionaryService.getAvailableScopes(documents || []);
    setAvailableScopes(scopes);
    
    // Auto-select current document's scope if not manually selected
    if (!selectedScope) {
      const currentScope = getCurrentScope();
      setSelectedScope(currentScope);
    }
  }, [documents, selectedScope, getCurrentScope]);

  // Load dictionary entries
  const loadEntries = useCallback(async () => {
    const scope = selectedScope || getCurrentScope();
    console.log('loadEntries called with scope:', scope);

    // Update local word count first
    await updateLocalWordCount();

    setLoading(true);

    try {
      let entries;
      if (scope?.folderPath) {
        entries = await DictionaryService.getEntries(scope.folderPath);
      } else if (scope?.categoryId) {
        // Backward compatibility
        entries = await DictionaryService.getEntries(null, scope.categoryId);
      } else {
        // User-level entries
        entries = await DictionaryService.getEntries();
      }
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
  }, [selectedScope, currentDocument, updateLocalWordCount]);

  // Sync with backend
  const syncWithBackend = useCallback(async () => {
    setSyncing(true);
    setLoading(true);
    try {
      await DictionaryService.syncAfterLogin();
      await loadEntries(); // Reload entries to show any new words
      return "Dictionary synced with server. All scopes updated.";
    } catch (err) {
      throw new Error(err.message || "Failed to sync dictionary");
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  }, [loadEntries]);

  // Handle scope selection change
  const handleScopeChange = useCallback((scope) => {
    console.log('Scope changed from', selectedScope, 'to', scope);
    setSelectedScope(scope);
  }, [selectedScope]);

  // Load available scopes when documents change
  useEffect(() => {
    loadAvailableScopes();
  }, [loadAvailableScopes]);

  // Handle authentication state changes for syncing
  useEffect(() => {
    if (isAuthenticated) {
      // Auto-sync when user logs in
      syncWithBackend().catch(console.error);
    }
  }, [isAuthenticated]);

  // Load entries when component mounts or scope changes
  useEffect(() => {
    updateLocalWordCount();
    loadEntries().catch(console.error);
  }, [user, isAuthenticated, selectedScope, currentDocument]);

  // Listen for dictionary update events
  useEffect(() => {
    const handler = async () => {
      await updateLocalWordCount();
      await loadEntries().catch(console.error);
    }

    window.addEventListener('dictionary:updated', handler);
    window.addEventListener('dictionary:categoryUpdated', handler);
    window.addEventListener('dictionary:folderUpdated', handler);
    window.addEventListener('dictionary:wordUpdated', handler);
    window.addEventListener('dictionary:folderWordAdded', handler);
    window.addEventListener('dictionary:folderWordRemoved', handler);

    return () => {
      window.removeEventListener('dictionary:updated', handler);
      window.removeEventListener('dictionary:categoryUpdated', handler);
      window.removeEventListener('dictionary:folderUpdated', handler);
      window.removeEventListener('dictionary:wordUpdated', handler);
      window.removeEventListener('dictionary:folderWordAdded', handler);
      window.removeEventListener('dictionary:folderWordRemoved', handler);
    };
  }, [updateLocalWordCount, loadEntries]);

  return {
    // State
    entries,
    availableScopes,
    selectedScope,
    localWordCount,
    loading,
    syncing,
    isAuthenticated,
    currentScope: getCurrentScope(),

    // Actions
    setSelectedScope: handleScopeChange,
    loadEntries,
    syncWithBackend,
    updateLocalWordCount
  };
}
