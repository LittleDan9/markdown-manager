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
  searchDocuments(query) {
    // Simple search by name/content/category
    const docs = Object.values(getLocalDocuments());
    if (!query) return docs;
    const q = query.toLowerCase();
    return docs.filter(doc =>
      (doc.name && doc.name.toLowerCase().includes(q)) ||
      (doc.content && doc.content.toLowerCase().includes(q)) ||
      (doc.category && doc.category.toLowerCase().includes(q))
    );
  },

  /**
 * Sync local documents with backend and merge results.
 * - Local docs not in backend are saved to backend.
 * - If both exist, newer doc (by lastModified) overwrites older.
 * - Returns merged, up-to-date docs and updates localStorage.
 */
  async syncAndMergeDocuments(isAuthenticated, token) {
    if (!isAuthenticated) {
      // Not authenticated, just return local docs
      return Object.values(getLocalDocuments());
    }
    const DocumentsApi = (await import("../js/api/documentsApi.js")).default;
    // Get backend docs
    const backendDocs = await DocumentsApi.getAllDocuments();
    const localDocsObj = getLocalDocuments();
    const mergedDocsObj = { ...localDocsObj };
    // Index backend docs by id
    const backendDocsById = {};
    backendDocs.forEach(doc => {
      backendDocsById[doc.id] = doc;
    });
    // 1. Sync local docs to backend if not present
    for (const [id, localDoc] of Object.entries(localDocsObj)) {
      if (!localDoc.id || !backendDocsById[localDoc.id]) {
        // Save to backend, get new id
        const created = await DocumentsApi.createDocument({
          name: localDoc.name,
          content: localDoc.content,
          category: localDoc.category,
        });
        localDoc.id = created.id;
        localDoc.lastModified = created.lastModified || localDoc.lastModified;
        mergedDocsObj[localDoc.id] = localDoc;
        delete mergedDocsObj[id];
      }
    }
    // 2. For docs present in both, keep the most recent
    for (const backendDoc of backendDocs) {
      const localDoc = mergedDocsObj[backendDoc.id];
      if (localDoc) {
        const localTime = new Date(localDoc.lastModified || 0).getTime();
        const backendTime = new Date(backendDoc.lastModified || 0).getTime();
        if (localTime > backendTime) {
          // Local is newer, update backend
          await DocumentsApi.updateDocument(backendDoc.id, {
            name: localDoc.name,
            content: localDoc.content,
            category: localDoc.category,
          });
          mergedDocsObj[backendDoc.id] = localDoc;
        } else {
          // Backend is newer, update local
          mergedDocsObj[backendDoc.id] = backendDoc;
        }
      } else {
        // Only in backend, add to local
        mergedDocsObj[backendDoc.id] = backendDoc;
      }
    }
    // 3. Update localStorage to match merged
    setLocalDocuments(mergedDocsObj);
    return Object.values(mergedDocsObj);
  },

  getDocumentStats() {
    const docs = Object.values(getLocalDocuments());
    return {
      total: docs.length,
      byCategory: docs.reduce((acc, doc) => {
        acc[doc.category] = (acc[doc.category] || 0) + 1;
        return acc;
      }, {}),
      lastModified: docs.reduce((latest, doc) => {
        if (doc.lastModified && (!latest || new Date(doc.lastModified) > new Date(latest))) {
          return doc.lastModified;
        }
        return latest;
      }, null),
    };
  },
  getAllDocuments() {
    return Object.values(getLocalDocuments());
  },
  getDocument(id) {
    return getLocalDocuments()[id] || null;
  },

  saveDocument: async function(doc, isAuthenticated, token) {
    // Always save to localStorage
    const docsObj = getLocalDocuments();
    // Enforce uniqueness of (name, category)
    const duplicate = Object.values(docsObj).find(
      d => d.name === doc.name && d.category === doc.category && d.id !== doc.id
    );
    if (duplicate) {
      throw new Error("A document with this name and category already exists.");
    }
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
  searchDocuments(query) {
    // Simple search by name/content/category
    const docs = Object.values(getLocalDocuments());
    if (!query) return docs;
    const q = query.toLowerCase();
    return docs.filter(doc =>
      (doc.name && doc.name.toLowerCase().includes(q)) ||
      (doc.content && doc.content.toLowerCase().includes(q)) ||
      (doc.category && doc.category.toLowerCase().includes(q))
    );
  },
  getDocumentStats() {
    const docs = Object.values(getLocalDocuments());
    return {
      total: docs.length,
      byCategory: docs.reduce((acc, doc) => {
        acc[doc.category] = (acc[doc.category] || 0) + 1;
        return acc;
      }, {}),
      lastModified: docs.reduce((latest, doc) => {
        if (doc.lastModified && (!latest || new Date(doc.lastModified) > new Date(latest))) {
          return doc.lastModified;
        }
        return latest;
      }, null),
    };
  },
};

export default DocumentStorage;
