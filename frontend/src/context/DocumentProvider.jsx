import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import DocumentService from '../services/DocumentService.js';
import { useAuth } from './AuthContext';
import { useNotification } from '../components/NotificationProvider.jsx';
import useChangeTracker from '../hooks/useChangeTracker';

const DocumentContext = createContext();

export function DocumentProvider({ children }) {
  const { token, user, isAuthenticated } = useAuth();
  const notification = useNotification();

  // Document state
  const DEFAULT_CATEGORY = 'General';
  const DRAFTS_CATEGORY = 'Drafts';
  const [authInitialized, setAuthInitialized] = useState(false);
  const [currentDocument, setCurrentDocument] = useState({
    id: null,
    name: 'Untitled Document',
    category: DEFAULT_CATEGORY,
    content: ''
  });
  const [content, setContent] = useState('');
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([DRAFTS_CATEGORY, DEFAULT_CATEGORY]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [highlightedBlocks, setHighlightedBlocks] = useState({});

  // Track authentication initialization state
  useEffect(() => {
    // Add a small delay to allow AuthService to initialize
    const timer = setTimeout(() => {
      setAuthInitialized(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Initialize documents on mount and when auth changes
  useEffect(() => {
    // Don't load documents until auth is initialized
    if (!authInitialized) return;

    // If we're not authenticated and there's no valid token, clear document state
    if (!isAuthenticated && !token) {
      // Check if we previously had authentication but lost it
      const lastKnownAuth = localStorage.getItem('lastKnownAuthState');
      if (lastKnownAuth === 'authenticated') {
        // This means we lost authentication, clear document state
        console.log('Authentication lost, clearing document state');
        DocumentService.clearDocumentState();
        setDocuments([]);
        const newDoc = DocumentService.createNewDocument();
        setCurrentDocument(newDoc);
        setContent('');
        return;
      }
    }

    const docs = DocumentService.getAllDocuments();

    // Filter out any private documents if not authenticated
    let filteredDocs = docs;
    if (!isAuthenticated) {
      filteredDocs = docs.filter(doc =>
        !doc.id ||
        String(doc.id).startsWith('doc_') ||
        !doc.content ||
        doc.content.trim() === ''
      );
    }

    setDocuments(filteredDocs);

    // Load current document or create new one
    if (filteredDocs.length > 0) {
      const lastDoc = filteredDocs[0]; // Most recently updated
      setCurrentDocument(lastDoc);
      setContent(lastDoc.content || '');
    } else {
      const newDoc = DocumentService.createNewDocument();
      setCurrentDocument(newDoc);
      setContent('');
    }
  }, [isAuthenticated, token, authInitialized]); // Add authInitialized dependency

  // Additional safety check: if we have documents but no valid auth, clear them
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isAuthenticated && !token && documents.length > 0) {
        // Check if these documents should be accessible to a guest user
        const hasPrivateContent = documents.some(doc =>
          doc.id && !String(doc.id).startsWith('doc_') && doc.content && doc.content.trim() !== ''
        );

        if (hasPrivateContent) {
          console.log('Found private documents without authentication, clearing state');
          DocumentService.clearDocumentState();
          setDocuments([]);
          const newDoc = DocumentService.createNewDocument();
          setCurrentDocument(newDoc);
          setContent('');
        }
      }
    }, 2000); // Give auth initialization time to complete

    return () => clearTimeout(timer);
  }, [documents, isAuthenticated, token]);

  // Keep content in sync with current document
  useEffect(() => {
    if (currentDocument && currentDocument.content !== content) {
      setContent(currentDocument.content || '');
    }
  }, [currentDocument.id]);

  // Document operations
  const createDocument = useCallback(() => {
    const newDoc = DocumentService.createNewDocument();
    setCurrentDocument(newDoc);
    setContent('');
  }, []);

  const loadDocument = useCallback((id) => {
    setLoading(true);
    try {
      const doc = DocumentService.loadDocument(id);
      if (doc) {
        setCurrentDocument(doc);
        setContent(doc.content || '');
      } else {
        notification.showError('Document not found');
      }
    } catch (error) {
      console.error('Failed to load document:', error);
      notification.showError('Failed to load document');
    } finally {
      setLoading(false);
    }
  }, [notification]);

  const saveDocument = useCallback(async (doc, showNotification = true) => {
    if (!doc) return null;

    // Create document to save with current content
    const docToSave = {
      ...doc,
      content: doc.id === currentDocument.id ? content : doc.content
    };

    setLoading(true);
    setError('');

    try {
      const saved = await DocumentService.saveDocument(docToSave, showNotification);

      // Update state with saved document
      setCurrentDocument(saved);
      if (saved.id === currentDocument.id) {
        setContent(saved.content);
      }

      // Refresh documents list
      const docs = DocumentService.getAllDocuments();
      setDocuments(docs);

      return saved;
    } catch (err) {
      console.error('Save failed:', err);
      setError('Save failed: ' + err.message);
      if (showNotification) {
        notification.showError('Save failed: ' + err.message);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [content, currentDocument, notification]);

  const deleteDocument = useCallback(async (id, showNotification = true) => {
    setLoading(true);
    try {
      await DocumentService.deleteDocument(id, showNotification);

      // Refresh documents list
      const docs = DocumentService.getAllDocuments();
      setDocuments(docs);

      // If deleted document was current, switch to another or create new
      if (currentDocument.id === id) {
        if (docs.length > 0) {
          const newCurrent = docs[0];
          setCurrentDocument(newCurrent);
          setContent(newCurrent.content || '');
        } else {
          const newDoc = DocumentService.createNewDocument();
          setCurrentDocument(newDoc);
          setContent('');
        }
      }
    } catch (error) {
      console.error('Delete failed:', error);
      if (showNotification) {
        notification.showError('Delete failed: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  }, [currentDocument, notification]);

  const renameDocument = useCallback(async (id, newName, newCategory = DEFAULT_CATEGORY) => {
    try {
      const doc = DocumentService.loadDocument(id);
      if (!doc) return;

      const updatedDoc = {
        ...doc,
        name: newName,
        category: newCategory
      };

      await DocumentService.saveDocument(updatedDoc, false);

      // Refresh state
      const docs = DocumentService.getAllDocuments();
      setDocuments(docs);

      if (currentDocument.id === id) {
        setCurrentDocument(updatedDoc);
      }
    } catch (error) {
      console.error('Rename failed:', error);
      notification.showError('Rename failed: ' + error.message);
    }
  }, [currentDocument, notification]);

  // Category operations (simplified - manage locally for now)
  const addCategory = useCallback(async (category) => {
    const name = (category || '').trim();
    if (!name || name === DEFAULT_CATEGORY || name === DRAFTS_CATEGORY) {
      return categories;
    }

    if (!categories.includes(name)) {
      const updated = [...categories, name];
      setCategories(updated);
      return updated;
    }
    return categories;
  }, [categories]);

  const deleteCategory = useCallback(async (name, options = {}) => {
    if (name === DEFAULT_CATEGORY || name === DRAFTS_CATEGORY) {
      return categories;
    }

    const updated = categories.filter(cat => cat !== name);
    setCategories(updated);

    // Handle documents in the deleted category
    const docs = DocumentService.getAllDocuments();
    const promises = docs
      .filter(doc => doc.category === name)
      .map(doc => {
        const updatedDoc = {
          ...doc,
          category: options.migrateTo || DEFAULT_CATEGORY
        };
        return DocumentService.saveDocument(updatedDoc, false);
      });

    await Promise.all(promises);

    // Refresh documents
    const refreshedDocs = DocumentService.getAllDocuments();
    setDocuments(refreshedDocs);

    return updated;
  }, [categories]);

  const renameCategory = useCallback(async (oldName, newName) => {
    const name = (newName || '').trim();
    if (
      oldName === DEFAULT_CATEGORY ||
      oldName === DRAFTS_CATEGORY ||
      !name ||
      name === DEFAULT_CATEGORY ||
      name === DRAFTS_CATEGORY
    ) {
      return categories;
    }

    const updated = categories.map(cat => cat === oldName ? name : cat);
    setCategories(updated);

    // Update documents in the renamed category
    const docs = DocumentService.getAllDocuments();
    const promises = docs
      .filter(doc => doc.category === oldName)
      .map(doc => {
        const updatedDoc = {
          ...doc,
          category: name
        };
        return DocumentService.saveDocument(updatedDoc, false);
      });

    await Promise.all(promises);

    // Refresh documents
    const refreshedDocs = DocumentService.getAllDocuments();
    setDocuments(refreshedDocs);

    return updated;
  }, [categories]);

  // Sync with backend
  const syncWithBackend = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    try {
      await DocumentService.syncWithBackend();

      // Refresh local state after sync
      const docs = DocumentService.getAllDocuments();
      setDocuments(docs);

      // Update current document if it exists in the refreshed list
      if (currentDocument.id) {
        const updatedCurrent = docs.find(doc => doc.id === currentDocument.id);
        if (updatedCurrent) {
          setCurrentDocument(updatedCurrent);
          setContent(updatedCurrent.content || '');
        }
      }
    } catch (error) {
      console.error('Sync failed:', error);
      setError('Sync failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, currentDocument]);

  // Auto-sync on authentication changes
  useEffect(() => {
    if (isAuthenticated && token) {
      // Small delay to ensure auth is fully established
      const timer = setTimeout(() => {
        syncWithBackend();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, token]);

  // Handle logout scenarios - clear document state when user is logged out
  useEffect(() => {
    if (!isAuthenticated && !token) {
      // Check if this is a logout scenario vs initial load
      const lastKnownAuth = localStorage.getItem('lastKnownAuthState');
      if (lastKnownAuth === 'authenticated') {
        // User was authenticated but now isn't - this is a logout
        // Clear document state to prevent showing private documents
        console.log('Logout detected, clearing document state');
        DocumentService.clearDocumentState();
        setDocuments([]);
        const newDoc = DocumentService.createNewDocument();
        setCurrentDocument(newDoc);
        setContent('');

        // Update last known auth state
        localStorage.setItem('lastKnownAuthState', 'unauthenticated');
      }
    } else if (isAuthenticated && token) {
      // User is authenticated, update state
      localStorage.setItem('lastKnownAuthState', 'authenticated');
    }
  }, [isAuthenticated, token]);

  // Export functionality using DocumentService directly
  const exportAsMarkdown = useCallback((content, filename) => {
    return DocumentService.exportAsMarkdown(content, filename || currentDocument?.name);
  }, [currentDocument]);

  const exportAsPDF = useCallback(async (htmlContent, filename = null, theme = 'light') => {
    setLoading(true);
    setError('');
    try {
      await DocumentService.exportAsPDF(htmlContent, filename || currentDocument?.name, theme);
    } catch (error) {
      console.error('PDF export failed:', error);
      setError('PDF export failed');
    } finally {
      setLoading(false);
    }
  }, [currentDocument, setLoading, setError]);

  const importMarkdownFile = useCallback(async (file) => {
    return DocumentService.importMarkdownFile(file);
  }, []);

  // Change tracking
  const hasUnsavedChanges = useChangeTracker(currentDocument, documents, content);

  const value = useMemo(() => ({
    user,
    token,
    isAuthenticated,
    authInitialized,
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
    saveDocument,
    content,
    setContent,
    syncWithBackend,
  }), [
    user, token, isAuthenticated, authInitialized, currentDocument, documents, categories, loading, error,
    hasUnsavedChanges, highlightedBlocks, content, createDocument, loadDocument,
    deleteDocument, renameDocument, addCategory, deleteCategory, renameCategory,
    exportAsMarkdown, exportAsPDF, importMarkdownFile, saveDocument, syncWithBackend
  ]);

  return (
    <DocumentContext.Provider value={value}>
      {children}
    </DocumentContext.Provider>
  );
}

export function useDocument() {
  return useContext(DocumentContext);
}
