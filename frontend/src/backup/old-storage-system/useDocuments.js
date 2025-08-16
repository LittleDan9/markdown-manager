import { useState } from 'react';
import useLocalDocuments from './useLocalDocuments';
import useSyncDocuments from './useSyncDocuments';
import useCategoryManagement from './useCategoryManagement';
import useExportDocuments from './useExportDocuments';
import useChangeTracker from './useChangeTracker';

import DocumentManager from '../storage/DocumentManager';
import { useCallback } from 'react';
export default function useDocuments(opts) {
  // Local storage & CRUD for docs
  const {
    currentDocument,
    setCurrentDocument,
    documents,
    setDocuments,
    createDocument,
    loadDocument,
    deleteDocument,
    renameDocument
  } = useLocalDocuments();
  // Category state and operations
  const {
    categories,
    setCategories,
    addCategory,
    deleteCategory,
    renameCategory
  } = useCategoryManagement(opts);
  // Loading & error state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Sync remote/local and recovery polling
  useSyncDocuments({
    ...opts,
    setDocuments,
    setCategories,
    setLoading,
    setError
  });
  // Export and import helpers
  const { exportAsMarkdown, exportAsPDF, importMarkdownFile } =
    useExportDocuments(currentDocument, setLoading, setError);
  // Save document helper (used by autosave)
  const saveDocument = useCallback(async doc => {
    setLoading(true);
    setError('');
    try {
      const saved = await DocumentManager.saveDocument(doc);
      setCurrentDocument(saved);
      setDocuments(DocumentManager.getAllDocuments());
      return saved;
    } catch {
      setError('Save failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, [setCurrentDocument, setDocuments]);
  // Unsaved changes tracker
  const hasUnsavedChanges = useChangeTracker(currentDocument, documents);
  // Highlighted blocks
  const [highlightedBlocks, setHighlightedBlocks] = useState({});

  return {
    currentDocument,
    setCurrentDocument,
    documents,
    createDocument,
    loadDocument,
    deleteDocument,
    renameDocument,
    categories,
    setCategories,
    addCategory,
    deleteCategory,
    renameCategory,
    loading,
    error,
    hasUnsavedChanges,
    highlightedBlocks,
    setHighlightedBlocks,
    exportAsMarkdown,
    exportAsPDF,
    importMarkdownFile,
    // expose saveDocument for auto-save
    saveDocument,
  };
}
