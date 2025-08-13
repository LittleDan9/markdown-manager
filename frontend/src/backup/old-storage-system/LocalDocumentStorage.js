// Pure localStorage operations for documents
// No backend logic - just local CRUD operations

const DOCUMENTS_KEY = "savedDocuments";
const CURRENT_DOC_KEY = "currentDocument";
const CATEGORIES_KEY = "documentCategories";
const LAST_DOC_ID_KEY = "lastDocumentId";
const DEFAULT_CATEGORY = "General";

class LocalDocumentStorage {
  constructor() {
    // Constructor now clean - no event listeners
  }

  // Document operations
  getAllDocuments() {
    const docs = this._getStoredDocuments();
    return Object.values(docs).filter(doc => doc.name !== "__category_placeholder__");
  }

  getDocument(id) {
    const docs = this._getStoredDocuments();
    return docs[id] || null;
  }

  saveDocument(doc) {
    const docs = this._getStoredDocuments();

    // Check for duplicates (name + category combination)
    const duplicate = Object.values(docs).find(
      d => d.name === doc.name && d.category === doc.category && d.id !== doc.id
    );
    if (duplicate) {
      throw new Error("A document with this name and category already exists.");
    }

    // Generate ID if needed
    let document = { ...doc };
    if (!document.id) {
      document.id = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Set timestamps
    const now = new Date().toISOString();
    document.updated_at = now;
    if (!document.created_at) {
      document.created_at = now;
    }

    // Save to localStorage
    docs[document.id] = document;
    this._setStoredDocuments(docs);

    // Dispatch storage event for sync
    this._dispatchStorageEvent('document:saved', { document });

    return document;
  }

  deleteDocument(id) {
    const docs = this._getStoredDocuments();
    const deletedDoc = docs[id];

    if (deletedDoc) {
      delete docs[id];
      this._setStoredDocuments(docs);

      // Clear current document if it was deleted
      const current = this.getCurrentDocument();
      if (current && current.id === id) {
        this.clearCurrentDocument();
      }

      // Dispatch storage event for sync
      this._dispatchStorageEvent('document:deleted', { id, document: deletedDoc });
    }

    return deletedDoc;
  }

  // Current document operations
  getCurrentDocument() {
    const doc = localStorage.getItem(CURRENT_DOC_KEY);
    return doc ? JSON.parse(doc) : null;
  }

  setCurrentDocument(doc) {
    if (doc) {
      localStorage.setItem(CURRENT_DOC_KEY, JSON.stringify(doc));
      if (doc.id) {
        localStorage.setItem(LAST_DOC_ID_KEY, doc.id);
      }

      // Only dispatch sync event for non-default documents
      const isDefaultDoc = this._isDefaultDocument(doc);
      if (!isDefaultDoc) {
        this._dispatchStorageEvent('current-document:changed', { document: doc });
      }
    }
  }

  clearCurrentDocument() {
    localStorage.removeItem(CURRENT_DOC_KEY);
    this._dispatchStorageEvent('current-document:cleared', {});
  }

  getLastDocumentId() {
    return localStorage.getItem(LAST_DOC_ID_KEY);
  }

  // Category operations
  getCategories() {
    const cats = localStorage.getItem(CATEGORIES_KEY);
    return cats ? JSON.parse(cats) : [DEFAULT_CATEGORY];
  }

  addCategory(category) {
    const categories = this.getCategories();
    if (!categories.includes(category)) {
      categories.push(category);
      localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
      this._dispatchStorageEvent('category:added', { category });
    }
    return categories;
  }

  deleteCategory(name, options = {}) {
    let categories = this.getCategories().filter(cat => cat !== name);
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));

    // Handle documents in the deleted category
    const docs = this._getStoredDocuments();
    const affectedDocs = [];

    Object.keys(docs).forEach(id => {
      if (docs[id].category === name) {
        if (options.deleteDocs) {
          affectedDocs.push({ action: 'deleted', document: docs[id] });
          delete docs[id];
        } else {
          const newCategory = options.migrateTo || DEFAULT_CATEGORY;
          docs[id].category = newCategory;
          docs[id].updated_at = new Date().toISOString();
          affectedDocs.push({ action: 'migrated', document: docs[id], fromCategory: name });
        }
      }
    });

    // Remove placeholder documents
    Object.keys(docs).forEach(id => {
      if (docs[id].name === "__category_placeholder__") {
        delete docs[id];
      }
    });

    this._setStoredDocuments(docs);
    this._dispatchStorageEvent('category:deleted', {
      category: name,
      options,
      affectedDocuments: affectedDocs
    });

    return categories;
  }

  renameCategory(oldName, newName) {
    const categories = this.getCategories().map(cat => cat === oldName ? newName : cat);
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));

    // Update documents in the renamed category
    const docs = this._getStoredDocuments();
    const affectedDocs = [];

    Object.keys(docs).forEach(id => {
      if (docs[id].category === oldName) {
        docs[id].category = newName;
        docs[id].updated_at = new Date().toISOString();
        affectedDocs.push(docs[id]);
      }
    });

    this._setStoredDocuments(docs);
    this._dispatchStorageEvent('category:renamed', {
      oldName,
      newName,
      affectedDocuments: affectedDocs
    });

    return categories;
  }

  // Search and stats
  searchDocuments(query) {
    const docs = this.getAllDocuments();
    if (!query) return docs;

    const q = query.toLowerCase();
    return docs.filter(doc =>
      (doc.name && doc.name.toLowerCase().includes(q)) ||
      (doc.content && doc.content.toLowerCase().includes(q)) ||
      (doc.category && doc.category.toLowerCase().includes(q))
    );
  }

  getDocumentStats() {
    const docs = this.getAllDocuments();
    return {
      total: docs.length,
      byCategory: docs.reduce((acc, doc) => {
        acc[doc.category] = (acc[doc.category] || 0) + 1;
        return acc;
      }, {}),
      lastSaved: docs.reduce((latest, doc) => {
        const ts = doc.updated_at || doc.created_at;
        if (ts && (!latest || new Date(ts) > new Date(latest))) {
          return ts;
        }
        return latest;
      }, null),
    };
  }

  // Bulk operations for sync
  bulkUpdateDocuments(documents) {
    const docs = this._getStoredDocuments();
    documents.forEach(doc => {
      docs[doc.id] = doc;
    });
    this._setStoredDocuments(docs);
  }

  setCategories(categories) {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  }

  // Clear all data (for logout)
  clearAllData() {
    localStorage.removeItem(DOCUMENTS_KEY);
    localStorage.removeItem(CURRENT_DOC_KEY);
    localStorage.removeItem(CATEGORIES_KEY);
    localStorage.removeItem(LAST_DOC_ID_KEY);
    this._dispatchStorageEvent('storage:cleared', {});
  }

  // Private methods
  _getStoredDocuments() {
    const docs = localStorage.getItem(DOCUMENTS_KEY);
    return docs ? JSON.parse(docs) : {};
  }

  _setStoredDocuments(docs) {
    localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(docs));
  }

  _isDefaultDocument(doc) {
    return (!doc.id || String(doc.id).startsWith("doc_")) &&
           doc.name === "Untitled Document" &&
           doc.category === DEFAULT_CATEGORY &&
           doc.content === "";
  }

  _dispatchStorageEvent(eventType, data) {
    // Custom event for internal sync coordination
    window.dispatchEvent(new CustomEvent('markdown-manager:storage', {
      detail: { type: eventType, data }
    }));
  }
}

export default new LocalDocumentStorage();


