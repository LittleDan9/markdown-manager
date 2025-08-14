import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import DocumentService from '../services/DocumentService.js';
import DocumentStorageService from '../services/DocumentStorageService.js';
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
  const [migrationStatus, setMigrationStatus] = useState('idle'); // 'idle', 'checking', 'migrating', 'complete'
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

            // This is automatically resolved, no conflict needed
            console.log(`Successfully auto-resolved ${localDoc.name}: ${localDoc.id} -> ${backendConflict.id}`);
          } else {
            // Content differs - this is a real conflict that needs user intervention
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
          console.log('Error details:', {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
          });

          // Check if this is a name conflict error
          const isNameConflict = error.response?.status === 400 &&
            (error.response?.data?.detail?.includes?.('already exists') ||
             error.response?.data?.detail?.detail?.includes?.('already exists') ||
             error.response?.data?.detail?.conflict_type === 'name_conflict' ||
             error.message?.includes('already exists'));

          if (isNameConflict) {
            console.log(`Name conflict detected for document: ${doc.name}`);

            // Check if the error response includes the conflicting document
            let conflictingDoc = null;
            if (error.response?.data?.detail?.existing_document) {
              conflictingDoc = error.response.data.detail.existing_document;
              console.log('Conflicting document from API:', conflictingDoc);
            } else {
              // Fallback: find the conflicting backend document manually
              conflictingDoc = backendDocs.find(backendDoc =>
                backendDoc.name === doc.name && backendDoc.category === doc.category
              );
            }

            if (conflictingDoc) {
              // Compare content to see if this is a real conflict
              const localContent = (doc.content || '').trim();
              const backendContent = (conflictingDoc.content || '').trim();

              if (localContent === backendContent) {
                // Auto-resolve identical content even after save failure
                console.log(`Auto-resolving post-save identical content for: ${doc.name}`);
                DocumentStorageService.deleteDocument(doc.id);
                DocumentStorageService.saveDocument(conflictingDoc);

                const currentDoc = DocumentStorageService.getCurrentDocument();
                if (currentDoc && currentDoc.id === doc.id) {
                  DocumentStorageService.setCurrentDocument(conflictingDoc);
                }
                // Don't add to conflicts - this is resolved
                continue;
              }
            }

            // Real content conflict or couldn't find conflicting doc
            conflicts.push({
              id: `name_conflict_${doc.id}_${Date.now()}`,
              document_id: conflictingDoc?.id || null,
              name: doc.name,
              category: doc.category,
              content: doc.content,
              collision: true,
              backend_content: conflictingDoc?.content || '',
              local_id: doc.id,
              conflict_type: 'name_conflict'
            });
          } else {
            console.log(`General migration error for document: ${doc.name}`);
            // Other migration error
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
      }

      // Show success message for completed migration
      if (conflicts.length > 0) {
        console.log(`Found ${conflicts.length} conflicts that need user resolution`);
        // For now, we'll log these conflicts but won't show a recovery modal
        // In the future, we could implement inline conflict resolution
        conflicts.forEach(conflict => {
          console.warn(`Content conflict for document "${conflict.name}":`, {
            localContent: conflict.content.substring(0, 100) + '...',
            backendContent: conflict.backend_content.substring(0, 100) + '...'
          });
        });
        notification.showWarning(`Migration completed with ${conflicts.length} content conflicts. Local versions will be used.`);
      } else {
        notification.showSuccess(`Successfully migrated ${toMigrate.length} documents to your account.`);
      }

      setMigrationStatus('complete');
    } catch (error) {
      console.error('Migration failed:', error);
      setError('Failed to migrate local documents. Please try again.');
      setMigrationStatus('complete');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token, notification]);

  // Initialize documents on mount and when auth changes
  useEffect(() => {
    // Don't load documents until auth is initialized
    if (!authInitialized) return;

    // If user just became authenticated, run migration first
    if (isAuthenticated && token && migrationStatus === 'idle') {
      migrateLocalDocuments();
      return;
    }

    // Don't load documents if migration is in progress
    if (migrationStatus === 'checking' || migrationStatus === 'migrating') {
      return;
    }

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
        // Track current document in localStorage
        DocumentStorageService.setCurrentDocument(newDoc);
        return;
      }
    }

    const loadCurrentDocument = async () => {
      // If authenticated, sync with backend first to get latest documents
      if (isAuthenticated && token) {
        try {
          console.log('Syncing with backend on mount...');
          await DocumentService.syncWithBackend();
        } catch (error) {
          console.warn('Failed to sync with backend on mount:', error.message);
          // Continue with local documents if sync fails
        }
      }

      const docs = DocumentService.getAllDocuments();
      setDocuments(docs);

      if (docs.length === 0) {
        const newDoc = DocumentService.createNewDocument();
        setCurrentDocument(newDoc);
        setContent('');
        // Track current document in localStorage
        DocumentStorageService.setCurrentDocument(newDoc);
        return;
      }

      let currentDoc = null;

      // If authenticated, try to get current document from backend
      if (isAuthenticated && token) {
        try {
          const { documentsApi } = await import('../api/documentsApi.js');
          const currentDocId = await documentsApi.getCurrentDocumentId();

          if (currentDocId) {
            // Find the document with this ID
            currentDoc = docs.find(doc => doc.id === currentDocId);
            console.log('Loaded current document from backend:', currentDocId, currentDoc ? 'found' : 'not found');
          }
        } catch (error) {
          console.log('Failed to fetch current document from backend:', error.message);
        }
      }

      // If backend didn't provide a valid current doc, check localStorage
      if (!currentDoc) {
        const storedCurrentDoc = DocumentStorageService.getCurrentDocument();
        if (storedCurrentDoc && storedCurrentDoc.id) {
          currentDoc = docs.find(doc => doc.id === storedCurrentDoc.id);
          console.log('Loaded current document from localStorage:', storedCurrentDoc.id, currentDoc ? 'found' : 'not found');
        }
      }

      // Fall back to most recently updated document
      if (!currentDoc) {
        currentDoc = docs[0]; // Most recently updated
        console.log('Falling back to most recent document:', currentDoc.id);
      }

      setCurrentDocument(currentDoc);
      setContent(currentDoc.content || '');
      // Track current document in localStorage
      DocumentStorageService.setCurrentDocument(currentDoc);
    };

    loadCurrentDocument();
  }, [isAuthenticated, token, authInitialized, migrationStatus]);

  // Update categories whenever documents change
  useEffect(() => {
    const newCategories = DocumentService.getCategories();
    setCategories(newCategories);
  }, [documents]);

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
          // Track current document in localStorage
          DocumentStorageService.setCurrentDocument(newDoc);
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

    // Track current document in localStorage
    DocumentStorageService.setCurrentDocument(newDoc);
  }, []);

  const loadDocument = useCallback(async (id) => {
    setLoading(true);
    try {
      const doc = DocumentService.loadDocument(id);
      if (doc) {
        setCurrentDocument(doc);
        setContent(doc.content || '');

        // Track current document in localStorage
        DocumentStorageService.setCurrentDocument(doc);

        // Update current document ID on backend for authenticated users
        await DocumentService.setCurrentDocumentId(doc.id);
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

      // Track current document in localStorage
      DocumentStorageService.setCurrentDocument(saved);

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
          // Track current document in localStorage
          DocumentStorageService.setCurrentDocument(newCurrent);
        } else {
          const newDoc = DocumentService.createNewDocument();
          setCurrentDocument(newDoc);
          setContent('');
          // Track current document in localStorage
          DocumentStorageService.setCurrentDocument(newDoc);
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

      // Save to backend and localStorage
      const saved = await DocumentService.saveDocument(updatedDoc, false);

      // Refresh state
      const docs = DocumentService.getAllDocuments();
      setDocuments(docs);

      if (currentDocument.id === id) {
        setCurrentDocument(saved || updatedDoc);
        // Track current document in localStorage
        DocumentStorageService.setCurrentDocument(saved || updatedDoc);
      }
    } catch (error) {
      console.error('Rename failed:', error);
      notification.showError('Rename failed: ' + error.message);
    }
  }, [currentDocument, notification]);

  // Simple category operations - categories are derived from documents
  const addCategory = useCallback(async (category) => {
    if (!category || !category.trim()) {
      return DocumentService.getCategories();
    }

    // To add a category, update the current document to use it
    // This creates the category automatically since categories are derived from documents
    const updatedDoc = {
      ...currentDocument,
      category: category.trim()
    };

    // Save the current document with the new category (this will sync to backend if authenticated)
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
        // Save each document (this will sync to backend if authenticated)
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
        // Save each document (this will sync to backend if authenticated)
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
    user, token, isAuthenticated, authInitialized, migrationStatus, currentDocument, documents, categories, loading, error,
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
