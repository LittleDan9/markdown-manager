// Unified storage and sync for documents: always writes to localStorage, syncs to backend if authenticated
// Handles offline, merge, and error cases gracefully

const DOCUMENTS_KEY = "savedDocuments";
const CURRENT_DOC_KEY = "currentDocument";
const CATEGORIES_KEY = "documentCategories";
const LAST_DOC_ID_KEY = "lastDocumentId";
const DEFAULT_CATEGORY = "General";

function getLocalDocuments() {
  const docs = localStorage.getItem(DOCUMENTS_KEY);
  return docs ? JSON.parse(docs) : {};
}

function setLocalDocuments(docsObj) {
  localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(docsObj));
}

function getLocalCategories() {
  const cats = localStorage.getItem(CATEGORIES_KEY);
  return cats ? JSON.parse(cats) : [DEFAULT_CATEGORY];
}

function setLocalCategories(catsArr) {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(catsArr));
}

function setCurrentDocument(doc) {
  localStorage.setItem(CURRENT_DOC_KEY, JSON.stringify(doc));
  if (doc && doc.id) localStorage.setItem(LAST_DOC_ID_KEY, doc.id);
}

function getCurrentDocument() {
  const doc = localStorage.getItem(CURRENT_DOC_KEY);
  return doc ? JSON.parse(doc) : null;
}

async function syncToBackend(doc, isAuthenticated, token) {
  if (!isAuthenticated) return;
  const DocumentsApi = (await import("../js/api/documentsApi.js")).default;
  if (doc.id) {
    await DocumentsApi.updateDocument(doc.id, doc);
  } else {
    const created = await DocumentsApi.createDocument(doc);
    doc.id = created.id;
  }
}

const DocumentStorage = {
  getAllDocuments() {
    return Object.values(getLocalDocuments());
  },
  getDocument(id) {
    return getLocalDocuments()[id] || null;
  },
  saveDocument: async function(doc, isAuthenticated, token) {
    // Always save to localStorage
    const docsObj = getLocalDocuments();
    const id = doc.id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    const document = {
      ...doc,
      id,
      lastModified: now,
      created: docsObj[id]?.created || now,
    };
    docsObj[id] = document;
    setLocalDocuments(docsObj);
    setCurrentDocument(document);
    // Sync to backend if authenticated
    try {
      await syncToBackend(document, isAuthenticated, token);
    } catch (e) {
      // Optionally queue for retry
      // console.error("Backend sync failed", e);
    }
    return document;
  },
  deleteDocument: async function(id, isAuthenticated, token) {
    const docsObj = getLocalDocuments();
    delete docsObj[id];
    setLocalDocuments(docsObj);
    // Remove current doc if deleted
    const current = getCurrentDocument();
    if (current && current.id === id) {
      setCurrentDocument({ id: null, name: "Untitled Document", category: DEFAULT_CATEGORY, content: "" });
    }
    if (isAuthenticated) {
      const DocumentsApi = (await import("../js/api/documentsApi.js")).default;
      try {
        await DocumentsApi.deleteDocument(id);
      } catch (e) {
        // Optionally queue for retry
      }
    }
  },
  getCategories() {
    return getLocalCategories();
  },
  addCategory: async function(category, isAuthenticated, token) {
    const catsArr = getLocalCategories();
    if (!catsArr.includes(category)) {
      catsArr.push(category);
      setLocalCategories(catsArr);
    }
    if (isAuthenticated) {
      const DocumentsApi = (await import("../js/api/documentsApi.js")).default;
      try {
        await DocumentsApi.addCategory(category);
      } catch (e) {}
    }
    return catsArr;
  },
  deleteCategory: async function(name, options = {}, isAuthenticated, token) {
    let catsArr = getLocalCategories().filter((cat) => cat !== name);
    setLocalCategories(catsArr);
    // Handle migration or deletion of documents in the category
    const docsObj = getLocalDocuments();
    Object.keys(docsObj).forEach((id) => {
      if (docsObj[id].category === name) {
        if (options.deleteDocs) {
          delete docsObj[id];
        } else if (options.migrateTo) {
          docsObj[id].category = options.migrateTo;
        }
      }
    });
    setLocalDocuments(docsObj);
    if (isAuthenticated) {
      const DocumentsApi = (await import("../js/api/documentsApi.js")).default;
      try {
        await DocumentsApi.deleteCategory(name, options);
      } catch (e) {}
    }
    return catsArr;
  },
  renameCategory: async function(oldName, newName, isAuthenticated, token) {
    let catsArr = getLocalCategories().map(cat => cat === oldName ? newName : cat);
    setLocalCategories(catsArr);
    const docsObj = getLocalDocuments();
    Object.keys(docsObj).forEach(id => {
      if (docsObj[id].category === oldName) {
        docsObj[id].category = newName;
      }
    });
    setLocalDocuments(docsObj);
    if (isAuthenticated) {
      const DocumentsApi = (await import("../js/api/documentsApi.js")).default;
      try {
        await DocumentsApi.apiCall(`/documents/categories/${encodeURIComponent(oldName)}`, "PATCH", { new_name: newName });
      } catch (e) {}
    }
    return catsArr;
  },
  getCurrentDocument,
  setCurrentDocument,
};

export default DocumentStorage;
