import { useState, useEffect, useCallback } from 'react';
import DocumentStorage from '../storage/DocumentStorage';

const DOCUMENTS_KEY = 'savedDocuments';
const CURRENT_DOC_KEY = 'currentDocument';
const DEFAULT_CATEGORY = 'Drafts'; // new drafts category

export default function useLocalDocuments() {
  const [currentDocument, setCurrentDocument] = useState({ id: null, name: 'Untitled Document', category: DEFAULT_CATEGORY, content: '' });
  const [documents, setDocuments] = useState([]);

  // Initialize from localStorage
  useEffect(() => {
    const raw = localStorage.getItem(DOCUMENTS_KEY) || '{}';
    const store = JSON.parse(raw);
    const docs = Object.values(store).filter(d => d?.name?.trim());
    if (!docs.length) {
      const empty = { id: null, name: 'Untitled Document', category: DEFAULT_CATEGORY, content: '' };
      setDocuments([empty]);
      localStorage.setItem(DOCUMENTS_KEY, JSON.stringify({ untitled: empty }));
      setCurrentDocument(empty);
    } else {
      setDocuments(docs);
      const lastId = localStorage.getItem('lastDocumentId');
      const picked = store[lastId] || JSON.parse(localStorage.getItem(CURRENT_DOC_KEY) || 'null');
      setCurrentDocument(picked || docs[0]);
    }
  }, []);

  const createDocument = useCallback(() => {
    // Generate a unique untitled name: 'Untitled Document', 'Untitled Document 2', etc.
    const untitledBase = 'Untitled Document';
    const allDocs = DocumentStorage.getAllDocuments();
    const regex = new RegExp(`^${untitledBase}(?: (\\d+))?$`);
    const counts = allDocs
      .map(d => {
        const m = d.name.match(regex);
        return m ? (m[1] ? parseInt(m[1], 10) : 1) : null;
      })
      .filter(n => n !== null);
    const max = counts.length > 0 ? Math.max(...counts) : 0;
    const newName = max === 0 ? untitledBase : `${untitledBase} ${max + 1}`;
    setCurrentDocument({ id: null, name: newName, category: DEFAULT_CATEGORY, content: '' });
  }, []);

  const loadDocument = useCallback((id) => {
    const doc = DocumentStorage.getDocument(id);
    setCurrentDocument(doc || { id: null, name: 'Untitled Document', category: DEFAULT_CATEGORY, content: '' });
  }, []);

  const deleteDocument = useCallback((id) => {
    DocumentStorage.deleteDocument(id);
    const all = DocumentStorage.getAllDocuments();
    setDocuments(all);
    setCurrentDocument(all[0] || { id: null, name: 'Untitled Document', category: DEFAULT_CATEGORY, content: '' });
  }, []);

  const renameDocument = useCallback((id, newName, newCategory = DEFAULT_CATEGORY) => {
    const doc = DocumentStorage.getDocument(id);
    if (!doc) return;
    doc.name = newName;
    doc.category = newCategory;
    DocumentStorage.saveDocument(doc);
    setDocuments(DocumentStorage.getAllDocuments());
    setCurrentDocument(doc);
  }, []);

  return { currentDocument, setCurrentDocument, documents, setDocuments, createDocument, loadDocument, deleteDocument, renameDocument };
}
