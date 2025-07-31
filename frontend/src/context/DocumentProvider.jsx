import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "./AuthProvider.jsx";
import { useNotification } from "../components/NotificationProvider.jsx";
import DocumentManager from "../storage/DocumentManager";
import useSyncDocuments from "../hooks/useSyncDocuments";
import useExportDocuments from "../hooks/useExportDocuments";
import useChangeTracker from "../hooks/useChangeTracker";

const DocumentContext = createContext();

export function DocumentProvider({ children }) {
  const { token, user, isAuthenticated } = useAuth();
  const notification = useNotification();

  // Document state
  const DEFAULT_CATEGORY = 'General';
  const DRAFTS_CATEGORY = 'Drafts';
  const [currentDocument, setCurrentDocument] = useState({
    id: null,
    name: 'Untitled Document',
    category: DEFAULT_CATEGORY,
    content: ''
  });
  const [content, setContent] = useState(currentDocument?.content || "");
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([DRAFTS_CATEGORY, DEFAULT_CATEGORY]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [highlightedBlocks, setHighlightedBlocks] = useState({});

  // Document operations
  function createDocument() {
    const untitledBase = 'Untitled Document';
    const allDocs = DocumentManager.getAllDocuments();
    const regex = new RegExp(`^${untitledBase}(?: (\\d+))?$`);
    const counts = allDocs
      .map(d => {
        const m = d.name.match(regex);
        return m ? (m[1] ? parseInt(m[1], 10) : 1) : null;
      })
      .filter(n => n !== null);
    const max = counts.length > 0 ? Math.max(...counts) : 0;
    const newName = max === 0 ? untitledBase : `${untitledBase} ${max + 1}`;
    const newDoc = {
      id: null,
      name: newName,
      category: DEFAULT_CATEGORY,
      content: ''
    };
    setCurrentDocument(newDoc);
  }

  useEffect(() => {
    const doc = DocumentManager.getCurrentDocument();
    if (doc) {
      loadDocument(doc.id);
    }
  }, [isAuthenticated]);

  function loadDocument(id) {
    const doc = DocumentManager.getDocument(id);
    if (doc) {
      // Show loading state for large documents
      if (doc.content && doc.content.length > 100000) { // 100KB
        setLoading(true);
        // Use setTimeout to allow UI to update before processing large document
        setTimeout(() => {
          setCurrentDocument(doc);
          DocumentManager.setCurrentDocument(doc); // Ensure localStorage is updated
          localStorage.setItem('lastDocumentId', id);
          setLoading(false);
        }, 100);
      } else {
        setCurrentDocument(doc);
        DocumentManager.setCurrentDocument(doc); // Ensure localStorage is updated
        localStorage.setItem('lastDocumentId', id);
      }
    }
  }

  async function saveDocument(doc) {
    setLoading(true);
    setError('');
    try {
      const saved = await DocumentManager.saveDocument(doc);
      setCurrentDocument(saved);
      const docs = DocumentManager.getAllDocuments();
      setDocuments(docs);
      if (saved.id) {
        localStorage.setItem('lastDocumentId', saved.id);
      }
      return saved;
    } catch (err) {
      setError('Save failed');
      return null;
    } finally {
      setLoading(false);
    }
  }

  function deleteDocument(id) {
    DocumentManager.deleteDocument(id);
    const all = DocumentManager.getAllDocuments();
    setDocuments(all);
    const newDoc = all[0] || {
      id: null,
      name: 'Untitled Document',
      category: DEFAULT_CATEGORY,
      content: ''
    };
    setCurrentDocument(newDoc);
  }

  function renameDocument(id, newName, newCategory = DEFAULT_CATEGORY) {
    const doc = DocumentManager.getDocument(id);
    if (!doc) return;
    doc.name = newName;
    doc.category = newCategory;
    DocumentManager.saveDocument(doc);
    const docs = DocumentManager.getAllDocuments();
    setDocuments(docs);
    setCurrentDocument(doc);
  }

  // Category operations
  async function addCategory(category) {
    const name = (category || '').trim();
    if (!name || name === DEFAULT_CATEGORY || name === DRAFTS_CATEGORY) {
      return categories;
    }
    const updated = await DocumentManager.addCategory(name);
    const cats = Array.from(new Set([DRAFTS_CATEGORY, DEFAULT_CATEGORY, ...updated]));
    setCategories(cats);
    return updated;
  }

  async function deleteCategory(name, options = {}) {
    if (name === DEFAULT_CATEGORY || name === DRAFTS_CATEGORY) {
      return categories;
    }
    const updated = await DocumentManager.deleteCategory(name, options);
    const cats = Array.from(new Set([DRAFTS_CATEGORY, DEFAULT_CATEGORY, ...updated]));
    setCategories(cats);
    const docs = DocumentManager.getAllDocuments();
    setDocuments(docs); // Refresh documents after category change
    return updated;
  }

  async function renameCategory(oldName, newName) {
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
    const updated = await DocumentManager.renameCategory(oldName, name);
    const cats = Array.from(new Set([DRAFTS_CATEGORY, DEFAULT_CATEGORY, ...updated]));
    setCategories(cats);
    const docs = DocumentManager.getAllDocuments();
    setDocuments(docs); // Refresh documents after category change
    return updated;
  }
  // Sync documents (keeps the valuable sync logic)
  useSyncDocuments({
    isAuthenticated,
    token,
    notification,
    setDocuments,
    setCategories: (cats) => setCategories(Array.from(new Set([DRAFTS_CATEGORY, DEFAULT_CATEGORY, ...cats]))),
    setLoading,
    setError
  });

  // Export functionality
  const { exportAsMarkdown, exportAsPDF, importMarkdownFile } = useExportDocuments(
    currentDocument,
    setLoading,
    setError
  );

  // Change tracking
  const hasUnsavedChanges = useChangeTracker(currentDocument, documents, content);

  const value = {
    user,
    token,
    isAuthenticated,
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
  };
  return (
    <DocumentContext.Provider value={value}>
      {children}
    </DocumentContext.Provider>
  );
}

export function useDocument() {
  return useContext(DocumentContext);
}
