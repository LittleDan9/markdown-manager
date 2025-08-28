import { useState, useCallback, useRef } from 'react';
import { DocumentService } from '@/services/core';
import { DocumentStorageService } from '@/services/core';

import { useEffect } from 'react';
import documentsApi from '@/api/documentsApi.js';
import useChangeTracker from './useChangeTracker';

export default function useDocumentState(notification, auth, setPreviewHTML) {
  const { isAuthenticated, token, user, isInitializing } = auth;
  const DEFAULT_CATEGORY = 'General';
  const DRAFTS_CATEGORY = 'Drafts';
  const [migrationStatus, setMigrationStatus] = useState('idle');
  const [hasSyncedOnMount, setHasSyncedOnMount] = useState(false);
  const [currentDocument, setCurrentDocument] = useState({ id: null, name: 'Untitled Document', category: DEFAULT_CATEGORY, content: '' });
  const [content, setContent] = useState('');
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([DRAFTS_CATEGORY, DEFAULT_CATEGORY]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [highlightedBlocks, setHighlightedBlocks] = useState({});

  // Notification helpers
  const notificationRef = useRef();
  notificationRef.current = notification;
  const showWarning = useCallback((msg) => notificationRef.current.showWarning(msg), []);
  const showSuccess = useCallback((msg) => notificationRef.current.showSuccess(msg), []);
  const showError = useCallback((msg) => notificationRef.current.showError(msg), []);

  // --- MIGRATION LOGIC ---
  const migrateLocalDocuments = useCallback(async () => {
    if (!isAuthenticated || !token) return;
    setMigrationStatus('checking');
    setLoading(true);
    try {
      const localDocs = DocumentStorageService.getAllDocuments();
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
      setMigrationStatus('migrating');
      const backendDocs = await DocumentService.getAllBackendDocuments();
      const conflicts = [];
      const toMigrate = [];
      for (const localDoc of localIdDocs) {
        const backendConflict = backendDocs.find(backendDoc =>
          backendDoc.name === localDoc.name && backendDoc.category === localDoc.category
        );
        if (backendConflict) {
          const localContent = (localDoc.content || '').trim();
          const backendContent = (backendConflict.content || '').trim();
          if (localContent === backendContent) {
            const updatedDoc = { ...backendConflict, content: localDoc.content };
            DocumentStorageService.deleteDocument(localDoc.id);
            DocumentStorageService.saveDocument(updatedDoc);
            const currentDoc = DocumentStorageService.getCurrentDocument();
            if (currentDoc && currentDoc.id === localDoc.id) {
              DocumentStorageService.setCurrentDocument(updatedDoc);
            }
          } else {
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
          toMigrate.push(localDoc);
        }
      }
      for (const doc of toMigrate) {
        try {
          const savedDoc = await DocumentService.saveDocument({ ...doc, content: doc.content || '', category: doc.category || DEFAULT_CATEGORY }, false);
          if (savedDoc) {
            const currentDoc = DocumentStorageService.getCurrentDocument();
            if (currentDoc && currentDoc.id === doc.id) {
              DocumentStorageService.setCurrentDocument(savedDoc);
            }
          }
        } catch (error) {
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
      if (conflicts.length > 0) {
        showWarning(`Migration completed with ${conflicts.length} content conflicts. Local versions will be used.`);
      } else if (toMigrate.length > 0) {
        showSuccess(`Successfully migrated ${toMigrate.length} documents to your account.`);
      }
      setMigrationStatus('complete');
    } catch (error) {
      setError('Failed to migrate local documents. Please try again.');
      setMigrationStatus('complete');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token]);

  // --- EFFECTS ---
  useEffect(() => {
    if (isInitializing) return;
    if (isAuthenticated && token && migrationStatus === 'idle') {
      setHasSyncedOnMount(false);
      migrateLocalDocuments();
      return;
    }
    if (migrationStatus === 'checking' || migrationStatus === 'migrating') return;
    if (!isAuthenticated && !token) {
      const existingDocs = DocumentStorageService.getAllDocuments();
      const hasPrivateDocuments = existingDocs.some(doc =>
        doc.id && !String(doc.id).startsWith('doc_') && doc.content && doc.content.trim() !== ''
      );
      if (hasPrivateDocuments) {
        DocumentService.clearDocumentState();
        setDocuments([]);
        const newDoc = DocumentService.createNewDocument();
        setCurrentDocument(newDoc);
        setContent('');
        // Clear preview HTML and highlighted blocks when clearing state
        if (setPreviewHTML) {
          setPreviewHTML('');
        }
        setHighlightedBlocks({});
        DocumentStorageService.setCurrentDocument(newDoc);
        showWarning('Session expired. For security, all data has been cleared.');
        return;
      }
    }
    const loadCurrentDocument = async () => {
      if (isAuthenticated && token && !hasSyncedOnMount) {
        try {
          const result = await DocumentService.syncWithBackend();
          setHasSyncedOnMount(true);
          if (result.syncedCount > 0) {
            showSuccess(`Documents synchronized successfully. ${result.syncedCount} documents synced.`);
          }
        } catch (error) {
          showError(`Sync failed: ${error.message}`);
          setHasSyncedOnMount(true);
        }
      }
      const docs = DocumentService.getAllDocuments();
      setDocuments(docs);
      if (docs.length === 0) {
        const newDoc = DocumentService.createNewDocument();
        setCurrentDocument(newDoc);
        setContent('');
        // Clear preview HTML and highlighted blocks for new document
        if (setPreviewHTML) {
          setPreviewHTML('');
        }
        setHighlightedBlocks({});
        DocumentStorageService.setCurrentDocument(newDoc);
        return;
      }
      let currentDoc = null;
      if (isAuthenticated && token) {
        try {
          const currentDocId = await documentsApi.getCurrentDocumentId();
          if (currentDocId) {
            currentDoc = docs.find(doc => doc.id === currentDocId);
          }
        } catch (error) {}
      }
      if (!currentDoc) {
        const storedCurrentDoc = DocumentStorageService.getCurrentDocument();
        if (storedCurrentDoc && storedCurrentDoc.id) {
          const isLocalDoc = String(storedCurrentDoc.id).startsWith('doc_');
          if (isAuthenticated || isLocalDoc) {
            currentDoc = docs.find(doc => doc.id === storedCurrentDoc.id);
          }
        }
      }
      if (!currentDoc) {
        const localDocs = docs.filter(doc => String(doc.id).startsWith('doc_'));
        currentDoc = isAuthenticated ? docs[0] : (localDocs[0] || DocumentService.createNewDocument());
      }
      setCurrentDocument(currentDoc);
      setContent(currentDoc.content || '');
      // Clear preview HTML and highlighted blocks when loading initial document
      if (setPreviewHTML) {
        setPreviewHTML('');
      }
      setHighlightedBlocks({});
      DocumentStorageService.setCurrentDocument(currentDoc);
    };
    loadCurrentDocument();
  }, [isAuthenticated, token, isInitializing, migrationStatus]);

  useEffect(() => {
    const newCategories = DocumentService.getCategories();
    setCategories(newCategories);
  }, [documents]);

  useEffect(() => {
    if (currentDocument && currentDocument.content !== content) {
      setContent(currentDocument.content || '');
    }
  }, [currentDocument.id]);

  useEffect(() => {
    if (!isAuthenticated && !token && !isInitializing) {
      const lastKnownAuth = localStorage.getItem('lastKnownAuthState');
      if (lastKnownAuth === 'authenticated') {
        DocumentService.clearDocumentState();
        setDocuments([]);
        const newDoc = DocumentService.createNewDocument();
        setCurrentDocument(newDoc);
        setContent('');
        setHasSyncedOnMount(false);
        localStorage.setItem('lastKnownAuthState', 'unauthenticated');
      }
    } else if (isAuthenticated && token) {
      localStorage.setItem('lastKnownAuthState', 'authenticated');
    }
  }, [isAuthenticated, token, isInitializing]);

  // --- DOCUMENT OPERATIONS ---
  const updateCurrentDocument = useCallback(async (document) => {
    if (!document) return;
    DocumentStorageService.setCurrentDocument(document);
    try {
      await DocumentService.setCurrentDocumentId(document.id);
    } catch (error) {}
  }, []);

  const createDocument = useCallback(() => {
    const newDoc = DocumentService.createNewDocument();
    setCurrentDocument(newDoc);
    setContent('');
    // Clear the preview HTML when creating a new document
    if (setPreviewHTML) {
      setPreviewHTML('');
    }
    // Clear syntax highlighting cache for new document
    setHighlightedBlocks({});
    DocumentStorageService.setCurrentDocument(newDoc);

    // Clear current document on backend if authenticated
    if (isAuthenticated && token) {
      documentsApi.setCurrentDocumentId(null).catch(err => {
        console.warn('Failed to clear current document on backend:', err);
      });
    }
  }, [setPreviewHTML, isAuthenticated, token]);

  const loadDocument = useCallback(async (id) => {
    setLoading(true);
    try {
      const doc = DocumentService.loadDocument(id);
      if (doc) {
        setCurrentDocument(doc);
        setContent(doc.content || '');
        // Clear preview HTML and highlighted blocks when loading a different document
        if (setPreviewHTML) {
          setPreviewHTML('');
        }
        setHighlightedBlocks({});
        await updateCurrentDocument(doc);
      } else {
        showError('Document not found');
      }
    } catch (error) {
      showError('Failed to load document');
    } finally {
      setLoading(false);
    }
  }, [updateCurrentDocument, setPreviewHTML]);

  const saveDocument = useCallback(async (doc, showNotification = true) => {
    if (!doc) return null;
    const docToSave = { ...doc, content: doc.id === currentDocument.id ? content : doc.content };
    setLoading(true);
    setError('');
    try {
      const saved = await DocumentService.saveDocument(docToSave, showNotification);
      setCurrentDocument(saved);
      if (saved.id === currentDocument.id && saved.content !== content) {
        setContent(saved.content);
      }
      await updateCurrentDocument(saved);
      const docs = DocumentService.getAllDocuments();
      setDocuments(docs);
      return saved;
    } catch (err) {
      setError('Save failed: ' + err.message);
      if (showNotification) {
        showError('Save failed: ' + err.message);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [content, currentDocument, updateCurrentDocument]);

  const deleteDocument = useCallback(async (id, showNotification = true) => {
    setLoading(true);
    try {
      await DocumentService.deleteDocument(id, showNotification);
      const docs = DocumentService.getAllDocuments();
      setDocuments(docs);

      // If we deleted the current document, clear the current state
      // but don't automatically switch to another document - let the caller decide
      if (currentDocument.id === id) {
        // Clear current document state
        setCurrentDocument({ id: null, name: 'Untitled Document', category: 'General', content: '' });
        setContent('');
        // Clear preview HTML and highlighted blocks when deleting current document
        if (setPreviewHTML) {
          setPreviewHTML('');
        }
        setHighlightedBlocks({});

        // Clear current document from storage and backend
        DocumentStorageService.setCurrentDocument({ id: null, name: 'Untitled Document', category: 'General', content: '' });
        if (isAuthenticated && token) {
          documentsApi.setCurrentDocumentId(null).catch(err => {
            console.warn('Failed to clear current document on backend:', err);
          });
        }
      }
    } catch (error) {
      if (showNotification) {
        showError('Delete failed: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  }, [currentDocument, updateCurrentDocument, setPreviewHTML, isAuthenticated, token]);

  const renameDocument = useCallback(async (id, newName, newCategory = DEFAULT_CATEGORY) => {
    try {
      const doc = DocumentService.loadDocument(id);
      if (!doc) return;
      const updatedDoc = { ...doc, name: newName, category: newCategory };
      const saved = await DocumentService.saveDocument(updatedDoc, false);
      const docs = DocumentService.getAllDocuments();
      setDocuments(docs);
      if (currentDocument.id === id) {
        setCurrentDocument(saved || updatedDoc);
        await updateCurrentDocument(saved || updatedDoc);
      }
    } catch (error) {
      showError('Rename failed: ' + error.message);
    }
  }, [currentDocument, updateCurrentDocument]);

  // --- CATEGORY OPERATIONS ---
  const addCategory = useCallback(async (category) => {
    if (!category || !category.trim()) {
      return DocumentService.getCategories();
    }

    // First, create the category on the backend if authenticated
    if (isAuthenticated && token) {
      try {
        const documentsApi = (await import('@/api/documentsApi')).default;
        await documentsApi.addCategory(category.trim());
      } catch (error) {
        console.error('Failed to create category on backend:', error);
        // Still continue to update the document locally
      }
    }

    // Update the current document to use the new category
    const updatedDoc = { ...currentDocument, category: category.trim() };
    const saved = await saveDocument(updatedDoc, false);
    if (saved) {
      DocumentStorageService.setCurrentDocument(saved);
    }
    return DocumentService.getCategories();
  }, [currentDocument, saveDocument, isAuthenticated, token]);

  const deleteCategory = useCallback(async (name, options = {}) => {
    if (name === DEFAULT_CATEGORY || name === DRAFTS_CATEGORY) {
      return DocumentService.getCategories();
    }
    const docs = DocumentService.getAllDocuments();
    const promises = docs.filter(doc => doc.category === name).map(async doc => {
      const updatedDoc = { ...doc, category: options.migrateTo || DEFAULT_CATEGORY };
      return await DocumentService.saveDocument(updatedDoc, false);
    });
    await Promise.all(promises);
    if (currentDocument.category === name) {
      const updatedCurrentDoc = { ...currentDocument, category: options.migrateTo || DEFAULT_CATEGORY };
      setCurrentDocument(updatedCurrentDoc);
      DocumentStorageService.setCurrentDocument(updatedCurrentDoc);
    }
    const refreshedDocs = DocumentService.getAllDocuments();
    setDocuments(refreshedDocs);
    return DocumentService.getCategories();
  }, [currentDocument]);

  const renameCategory = useCallback(async (oldName, newName) => {
    const name = (newName || '').trim();
    if (oldName === DEFAULT_CATEGORY || oldName === DRAFTS_CATEGORY || !name || name === DEFAULT_CATEGORY || name === DRAFTS_CATEGORY) {
      return DocumentService.getCategories();
    }
    const docs = DocumentService.getAllDocuments();
    const promises = docs.filter(doc => doc.category === oldName).map(async doc => {
      const updatedDoc = { ...doc, category: name };
      return await DocumentService.saveDocument(updatedDoc, false);
    });
    await Promise.all(promises);
    if (currentDocument.category === oldName) {
      const updatedCurrentDoc = { ...currentDocument, category: name };
      setCurrentDocument(updatedCurrentDoc);
      DocumentStorageService.setCurrentDocument(updatedCurrentDoc);
    }
    const refreshedDocs = DocumentService.getAllDocuments();
    setDocuments(refreshedDocs);
    return DocumentService.getCategories();
  }, [currentDocument]);

  // --- SYNC ---
  const syncWithBackend = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      await DocumentService.syncWithBackend();
      const docs = DocumentService.getAllDocuments();
      setDocuments(docs);
      if (currentDocument.id) {
        const updatedCurrent = docs.find(doc => doc.id === currentDocument.id);
        if (updatedCurrent) {
          setCurrentDocument(updatedCurrent);
          setContent(updatedCurrent.content || '');
        }
      }
    } catch (error) {
      setError('Sync failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, currentDocument]);

  // --- EXPORT/IMPORT ---
  const exportAsMarkdown = useCallback((content, filename) => {
    return DocumentService.exportAsMarkdown(content, filename || currentDocument?.name);
  }, [currentDocument]);

  const exportAsPDF = useCallback(async (htmlContent, filename = null, theme = 'light') => {
    setLoading(true);
    setError('');
    try {
      await DocumentService.exportAsPDF(htmlContent, filename || currentDocument?.name, theme);
    } catch (error) {
      setError('PDF export failed');
    } finally {
      setLoading(false);
    }
  }, [currentDocument, setLoading, setError]);

  const importMarkdownFile = useCallback(async (file) => {
    return DocumentService.importMarkdownFile(file);
  }, []);

  /**
   * Add a document to the local state and storage
   * Useful for adding documents that were created externally (e.g., GitHub imports)
   */
  const addDocumentToState = useCallback(async (document) => {
    try {
      // Add to local documents state (avoid duplicates)
      setDocuments(prevDocs => {
        const exists = prevDocs.some(doc => doc.id === document.id);
        if (exists) {
          return prevDocs;
        }
        return [...prevDocs, document];
      });

      // Also save to localStorage so DocumentService can find it
      DocumentStorageService.saveDocument(document);

      return document;
    } catch (error) {
      console.error('Failed to add document to state:', error);
      throw error;
    }
  }, [setDocuments]);

  // --- CHANGE TRACKING ---
  const hasUnsavedChanges = useChangeTracker(currentDocument, documents, content);

  return {
    migrationStatus, setMigrationStatus, hasSyncedOnMount, setHasSyncedOnMount,
    currentDocument, setCurrentDocument, content, setContent, documents, setDocuments,
    categories, setCategories, loading, setLoading, error, setError, highlightedBlocks, setHighlightedBlocks,
    showWarning, showSuccess, showError,
    createDocument, loadDocument, saveDocument, deleteDocument, renameDocument,
    addCategory, deleteCategory, renameCategory, syncWithBackend, addDocumentToState,
    exportAsMarkdown, exportAsPDF, importMarkdownFile, hasUnsavedChanges
  };
}
