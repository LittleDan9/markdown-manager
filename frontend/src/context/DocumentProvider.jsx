import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import DocumentService from '../services/DocumentService.js';
import DocumentStorageService from '../services/DocumentStorageService.js';
import documentsApi from '../api/documentsApi.js';
import { useAuth } from './AuthContext';
import { useSharedView } from './SharedViewProvider';
import { useNotification } from '../components/NotificationProvider.jsx';
import useChangeTracker from '../hooks/useChangeTracker';

const DocumentContext = createContext();

export function DocumentProvider({ children }) {
  const { token, user, isAuthenticated, isInitializing } = useAuth();
  const { isSharedView } = useSharedView();
  const notification = useNotification();

  // Create stable refs for notification functions to avoid dependency issues
  const notificationRef = useRef();
  notificationRef.current = notification;

  const showWarning = useCallback((msg) => notificationRef.current.showWarning(msg), []);
  const showSuccess = useCallback((msg) => notificationRef.current.showSuccess(msg), []);
  const showError = useCallback((msg) => notificationRef.current.showError(msg), []);

  // Document state
  const DEFAULT_CATEGORY = 'General';
  const DRAFTS_CATEGORY = 'Drafts';
  const [migrationStatus, setMigrationStatus] = useState('idle'); // 'idle', 'checking', 'migrating', 'complete'
  const [hasSyncedOnMount, setHasSyncedOnMount] = useState(false); // Track if we've synced on mount
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

  // Migration function to handle local documents when user logs in
  const migrateLocalDocuments = useCallback(async () => {
    if (!isAuthenticated || !token) return;

    setMigrationStatus('checking');
    setLoading(true);

    try {
      // Get all local documents
      const localDocs = DocumentStorageService.getAllDocuments();

      // Find documents with local IDs that need migration
      const localIdDocs = localDocs.filter(doc =>
        doc.id && String(doc.id).startsWith('doc_') &&
        doc.content && doc.content.trim() !== '' &&
        doc.name !== 'Untitled Document'
      );

      if (localIdDocs.length === 0) {
        setMigrationStatus('complete');
        setLoading(false);
        return;
      }

      console.log(`Found ${localIdDocs.length} local documents to migrate:`, localIdDocs.map(d => d.name));
      setMigrationStatus('migrating');

      // Get backend documents to check for conflicts
      const backendDocs = await DocumentService.getAllBackendDocuments();
      const conflicts = [];
      const toMigrate = [];

      // Check each local document for conflicts
      for (const localDoc of localIdDocs) {
        const backendConflict = backendDocs.find(backendDoc =>
          backendDoc.name === localDoc.name && backendDoc.category === localDoc.category
        );

        if (backendConflict) {
          // Found a name/category conflict - now check if content differs
          const localContent = (localDoc.content || '').trim();
          const backendContent = (backendConflict.content || '').trim();

          if (localContent === backendContent) {
            // Content is identical - auto-resolve by updating local document with backend ID
            console.log(`Auto-resolving identical content for: ${localDoc.name}`);

            // Update local storage to use backend document
            const updatedDoc = {
              ...backendConflict,
              content: localDoc.content, // Preserve any formatting differences
            };

            // Remove old document and save updated one
            DocumentStorageService.deleteDocument(localDoc.id);
            DocumentStorageService.saveDocument(updatedDoc);

            // Update current document reference if it matches
            const currentDoc = DocumentStorageService.getCurrentDocument();
            if (currentDoc && currentDoc.id === localDoc.id) {
              DocumentStorageService.setCurrentDocument(updatedDoc);
            }

            console.log(`Successfully auto-resolved ${localDoc.name}: ${localDoc.id} -> ${backendConflict.id}`);
          } else {
            // Content differs - add to conflicts
            conflicts.push({
              id: `conflict_${localDoc.id}_${Date.now()}`,
              document_id: backendConflict.id,
              name: localDoc.name,
              category: localDoc.category,
              content: localDoc.content,
              collision: true,
              backend_content: backendConflict.content,
              local_id: localDoc.id,
              conflict_type: 'content_conflict'
            });
          }
        } else {
          // No name conflict - safe to migrate
          toMigrate.push(localDoc);
        }
      }

      // Migrate non-conflicting documents automatically
      for (const doc of toMigrate) {
        try {
          console.log(`Migrating document: ${doc.name}`);
          const savedDoc = await DocumentService.saveDocument({
            ...doc,
            content: doc.content || '',
            category: doc.category || DEFAULT_CATEGORY
          }, false); // Don't show notifications during migration

          if (savedDoc) {
            console.log(`Successfully migrated ${doc.name}: ${doc.id} -> ${savedDoc.id}`);

            // Update current document reference if it matches the migrated document
            const currentDoc = DocumentStorageService.getCurrentDocument();
            if (currentDoc && currentDoc.id === doc.id) {
              DocumentStorageService.setCurrentDocument(savedDoc);
            }
          }
        } catch (error) {
          console.error(`Failed to migrate document ${doc.name}:`, error);
          // Add to conflicts for manual resolution
          conflicts.push({
            id: `migration_error_${doc.id}_${Date.now()}`,
            document_id: null,
            name: doc.name,
            category: doc.category,
            content: doc.content,
            collision: false,
            error: `Migration failed: ${error.message}`,
            local_id: doc.id,
            conflict_type: 'migration_error'
          });
        }
      }

      // Show results
      if (conflicts.length > 0) {
        console.log(`Found ${conflicts.length} conflicts that need user resolution`);
        showWarning(`Migration completed with ${conflicts.length} content conflicts. Local versions will be used.`);
      } else if (toMigrate.length > 0) {
        showSuccess(`Successfully migrated ${toMigrate.length} documents to your account.`);
      }

      setMigrationStatus('complete');
    } catch (error) {
      console.error('Migration failed:', error);
      setError('Failed to migrate local documents. Please try again.');
      setMigrationStatus('complete');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token]); // Remove showWarning, showSuccess since they're now stable

  // Initialize documents on mount and when auth changes
  useEffect(() => {
    // Don't load documents until auth is fully initialized
    if (isInitializing) {
      console.log('DocumentProvider: Waiting for auth initialization');
      return;
    }

    console.log('DocumentProvider: Auth initialization complete', { isAuthenticated, hasToken: !!token });

    // If user just became authenticated, run migration first
    if (isAuthenticated && token && migrationStatus === 'idle') {
      setHasSyncedOnMount(false); // Reset sync flag for fresh login
      migrateLocalDocuments();
      return;
    }

    // Don't load documents if migration is in progress
    if (migrationStatus === 'checking' || migrationStatus === 'migrating') {
      return;
    }

    // SECURITY: If we're not authenticated, check for and clear any private documents
    if (!isAuthenticated && !token) {
      console.log('DocumentProvider: Not authenticated, checking for private documents');
      const existingDocs = DocumentStorageService.getAllDocuments();
      const hasPrivateDocuments = existingDocs.some(doc =>
        doc.id && !String(doc.id).startsWith('doc_') && doc.content && doc.content.trim() !== ''
      );

      if (hasPrivateDocuments) {
        console.log('DocumentProvider: Found private documents without auth, clearing all data');
        DocumentService.clearDocumentState();
        setDocuments([]);
        const newDoc = DocumentService.createNewDocument();
        setCurrentDocument(newDoc);
        setContent('');
        DocumentStorageService.setCurrentDocument(newDoc);
        showWarning('Session expired. For security, all data has been cleared.');
        return;
      }
    }

    const loadCurrentDocument = async () => {
      // If authenticated, sync with backend first to get latest documents (only once on mount)
      if (isAuthenticated && token && !hasSyncedOnMount) {
        try {
          console.log('DocumentProvider: Syncing with backend on mount...');
          const result = await DocumentService.syncWithBackend();
          setHasSyncedOnMount(true);

          if (result.syncedCount > 0) {
            showSuccess(`Documents synchronized successfully. ${result.syncedCount} documents synced.`);
          }
        } catch (error) {
          console.warn('DocumentProvider: Failed to sync with backend on mount:', error.message);
          showError(`Sync failed: ${error.message}`);
          // Continue with local documents if sync fails, but still mark as synced to prevent retries
          setHasSyncedOnMount(true);
        }
      }

      console.log('DocumentProvider: Loading current document. isAuthenticated:', isAuthenticated, 'token:', !!token, 'isInitializing:', isInitializing);
      const docs = DocumentService.getAllDocuments();
      console.log('DocumentProvider: Found', docs.length, 'documents:', docs.map(d => `${d.id}: ${d.name}`));
      setDocuments(docs);

      if (docs.length === 0) {
        const newDoc = DocumentService.createNewDocument();
        setCurrentDocument(newDoc);
        setContent('');
        DocumentStorageService.setCurrentDocument(newDoc);
        return;
      }

      let currentDoc = null;

      // If authenticated, try to get current document from backend
      if (isAuthenticated && token) {
        try {
          const currentDocId = await documentsApi.getCurrentDocumentId();

          if (currentDocId) {
            currentDoc = docs.find(doc => doc.id === currentDocId);
            console.log('DocumentProvider: Loaded current document from backend:', currentDocId, currentDoc ? 'found' : 'not found');
          }
        } catch (error) {
          console.log('DocumentProvider: Failed to fetch current document from backend:', error.message);
        }
      }

      // If backend didn't provide a valid current doc, check localStorage (only for safe documents)
      if (!currentDoc) {
        const storedCurrentDoc = DocumentStorageService.getCurrentDocument();
        if (storedCurrentDoc && storedCurrentDoc.id) {
          // SECURITY: Only load from localStorage if we're authenticated OR it's a local document
          const isLocalDoc = String(storedCurrentDoc.id).startsWith('doc_');
          if (isAuthenticated || isLocalDoc) {
            currentDoc = docs.find(doc => doc.id === storedCurrentDoc.id);
            console.log('DocumentProvider: Loaded current document from localStorage:', storedCurrentDoc.id, currentDoc ? 'found' : 'not found');
          } else {
            console.log('DocumentProvider: Skipping private document from localStorage - not authenticated');
          }
        }
      }

      // Fall back to most recently updated document (only if authenticated OR it's a local document)
      // Skip fallback if we're in shared document view - shared documents should load explicitly

      if (!currentDoc && !isSharedView) {
        console.log('DocumentProvider: No current document found, falling back. isAuthenticated:', isAuthenticated);
        if (isAuthenticated) {
          currentDoc = docs[0]; // Most recently updated
          console.log('DocumentProvider: Falling back to most recent document for authenticated user:', currentDoc?.id, currentDoc?.name);
        } else {
          // For unauthenticated users, only show local documents
          const localDocs = docs.filter(doc => String(doc.id).startsWith('doc_'));
          currentDoc = localDocs[0] || DocumentService.createNewDocument();
          console.log('DocumentProvider: Falling back to local document for guest:', currentDoc?.id, currentDoc?.name);
        }
      } else if (!currentDoc && isSharedView) {
        console.log('DocumentProvider: In shared view, skipping fallback. App component will handle shared document loading.');
        // Don't set any document in shared view - App component handles it
        return;
      }

      setCurrentDocument(currentDoc);
      setContent(currentDoc.content || '');
      DocumentStorageService.setCurrentDocument(currentDoc);
    };

    console.log('DocumentProvider: loadCurrentDocument effect triggered. Auth state changed?');
    loadCurrentDocument();
  }, [isAuthenticated, token, isInitializing, migrationStatus, isSharedView]); // Add isSharedView dependency

  // Update categories whenever documents change
  useEffect(() => {
    const newCategories = DocumentService.getCategories();
    setCategories(newCategories);
  }, [documents]);

  // Keep content in sync with current document
  useEffect(() => {
    if (currentDocument && currentDocument.content !== content) {
      setContent(currentDocument.content || '');
    }
  }, [currentDocument.id]);

  // Handle logout scenarios - clear document state when user is logged out
  useEffect(() => {
    if (!isAuthenticated && !token && !isInitializing) {
      // Check if this is a logout scenario vs initial load
      const lastKnownAuth = localStorage.getItem('lastKnownAuthState');
      if (lastKnownAuth === 'authenticated') {
        // User was authenticated but now isn't - this is a logout
        // Clear document state to prevent showing private documents
        console.log('DocumentProvider: Logout detected, clearing document state');
        DocumentService.clearDocumentState();
        setDocuments([]);
        const newDoc = DocumentService.createNewDocument();
        setCurrentDocument(newDoc);
        setContent('');
        setHasSyncedOnMount(false); // Reset sync flag for next login

        // Update last known auth state
        localStorage.setItem('lastKnownAuthState', 'unauthenticated');
      }
    } else if (isAuthenticated && token) {
      // User is authenticated, update state but don't reset sync flag here
      localStorage.setItem('lastKnownAuthState', 'authenticated');
    }
  }, [isAuthenticated, token, isInitializing]);

  // Document operations
  const updateCurrentDocument = useCallback(async (document) => {
    if (!document) return;

    console.log('DocumentProvider: Updating current document tracking for:', document.name, document.id);

    // Always update localStorage
    DocumentStorageService.setCurrentDocument(document);

    // Update current document ID on backend for authenticated users
    try {
      await DocumentService.setCurrentDocumentId(document.id);
      console.log('DocumentProvider: Successfully updated backend current document ID:', document.id);
    } catch (error) {
      console.warn('DocumentProvider: Failed to update backend current document ID:', error);
    }
  }, []);

  const createDocument = useCallback(() => {
    const newDoc = DocumentService.createNewDocument();
    setCurrentDocument(newDoc);
    setContent('');

    // Track current document in localStorage
    DocumentStorageService.setCurrentDocument(newDoc);
  }, []);

  const loadDocument = useCallback(async (id) => {
    console.log('DocumentProvider: loadDocument called with id:', id);
    setLoading(true);
    try {
      const doc = DocumentService.loadDocument(id);
      console.log('DocumentProvider: DocumentService.loadDocument returned:', doc);
      if (doc) {
        setCurrentDocument(doc);
        setContent(doc.content || '');

        // Update current document tracking (localStorage + backend)
        await updateCurrentDocument(doc);
        console.log('DocumentProvider: Document loaded successfully:', doc.id, doc.name);
      } else {
        console.error('DocumentProvider: Document not found with id:', id);
        showError('Document not found');
      }
    } catch (error) {
      console.error('DocumentProvider: Failed to load document:', error);
      showError('Failed to load document');
    } finally {
      setLoading(false);
    }
  }, [updateCurrentDocument, showSuccess, showError]); // Add updateCurrentDocument to dependencies

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

      // Update current document tracking (localStorage + backend)
      await updateCurrentDocument(saved);

      // Refresh documents list
      const docs = DocumentService.getAllDocuments();
      setDocuments(docs);

      return saved;
    } catch (err) {
      console.error('Save failed:', err);
      setError('Save failed: ' + err.message);
      if (showNotification) {
        showError('Save failed: ' + err.message);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [content, currentDocument, updateCurrentDocument]); // Add updateCurrentDocument to dependencies

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
          // Update current document tracking (localStorage + backend)
          await updateCurrentDocument(newCurrent);
        } else {
          const newDoc = DocumentService.createNewDocument();
          setCurrentDocument(newDoc);
          setContent('');
          // Track current document in localStorage (new doc has no backend ID yet)
          DocumentStorageService.setCurrentDocument(newDoc);
        }
      }
    } catch (error) {
      console.error('Delete failed:', error);
      if (showNotification) {
        showError('Delete failed: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  }, [currentDocument, updateCurrentDocument]); // Add updateCurrentDocument to dependencies

  const renameDocument = useCallback(async (id, newName, newCategory = DEFAULT_CATEGORY) => {
    try {
      const doc = DocumentService.loadDocument(id);
      if (!doc) return;

      const updatedDoc = {
        ...doc,
        name: newName,
        category: newCategory
      };

      // Save to backend and localStorage
      const saved = await DocumentService.saveDocument(updatedDoc, false);

      // Refresh state
      const docs = DocumentService.getAllDocuments();
      setDocuments(docs);

      if (currentDocument.id === id) {
        setCurrentDocument(saved || updatedDoc);
        // Update current document tracking (localStorage + backend)
        await updateCurrentDocument(saved || updatedDoc);
      }
    } catch (error) {
      console.error('Rename failed:', error);
      showError('Rename failed: ' + error.message);
    }
  }, [currentDocument, updateCurrentDocument]); // Add updateCurrentDocument to dependencies

  // Category operations
  const addCategory = useCallback(async (category) => {
    if (!category || !category.trim()) {
      return DocumentService.getCategories();
    }

    // To add a category, update the current document to use it
    const updatedDoc = {
      ...currentDocument,
      category: category.trim()
    };

    // Save the current document with the new category
    const saved = await saveDocument(updatedDoc, false);

    // Update current document tracking
    if (saved) {
      DocumentStorageService.setCurrentDocument(saved);
    }

    return DocumentService.getCategories();
  }, [currentDocument, saveDocument]);

  const deleteCategory = useCallback(async (name, options = {}) => {
    if (name === DEFAULT_CATEGORY || name === DRAFTS_CATEGORY) {
      return DocumentService.getCategories();
    }

    // Handle documents in the deleted category
    const docs = DocumentService.getAllDocuments();
    const promises = docs
      .filter(doc => doc.category === name)
      .map(async doc => {
        const updatedDoc = {
          ...doc,
          category: options.migrateTo || DEFAULT_CATEGORY
        };
        return await DocumentService.saveDocument(updatedDoc, false);
      });

    await Promise.all(promises);

    // If current document was affected, update tracking
    if (currentDocument.category === name) {
      const updatedCurrentDoc = {
        ...currentDocument,
        category: options.migrateTo || DEFAULT_CATEGORY
      };
      setCurrentDocument(updatedCurrentDoc);
      DocumentStorageService.setCurrentDocument(updatedCurrentDoc);
    }

    // Refresh documents and categories will be updated automatically
    const refreshedDocs = DocumentService.getAllDocuments();
    setDocuments(refreshedDocs);

    return DocumentService.getCategories();
  }, [currentDocument]);

  const renameCategory = useCallback(async (oldName, newName) => {
    const name = (newName || '').trim();
    if (
      oldName === DEFAULT_CATEGORY ||
      oldName === DRAFTS_CATEGORY ||
      !name ||
      name === DEFAULT_CATEGORY ||
      name === DRAFTS_CATEGORY
    ) {
      return DocumentService.getCategories();
    }

    // Update documents in the renamed category
    const docs = DocumentService.getAllDocuments();
    const promises = docs
      .filter(doc => doc.category === oldName)
      .map(async doc => {
        const updatedDoc = {
          ...doc,
          category: name
        };
        return await DocumentService.saveDocument(updatedDoc, false);
      });

    await Promise.all(promises);

    // If current document was affected, update tracking
    if (currentDocument.category === oldName) {
      const updatedCurrentDoc = {
        ...currentDocument,
        category: name
      };
      setCurrentDocument(updatedCurrentDoc);
      DocumentStorageService.setCurrentDocument(updatedCurrentDoc);
    }

    // Refresh documents and categories will be updated automatically
    const refreshedDocs = DocumentService.getAllDocuments();
    setDocuments(refreshedDocs);

    return DocumentService.getCategories();
  }, [currentDocument]);

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
    isInitializing,
    migrationStatus,
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
    user, token, isAuthenticated, isInitializing, migrationStatus, currentDocument, documents, categories, loading, error,
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
