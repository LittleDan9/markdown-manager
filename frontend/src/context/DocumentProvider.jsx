import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthProvider.jsx";
import config from "../js/config";
import { saveAs } from "file-saver";

const DEFAULT_CATEGORY = "General";
const DOCUMENTS_KEY = "savedDocuments";
const CURRENT_DOC_KEY = "currentDocument";
const CATEGORIES_KEY = "documentCategories";

const DocumentContext = createContext();

export function DocumentProvider({ children }) {
  const { token, user, isAuthenticated } = useAuth();
  // State
  const [currentDocument, setCurrentDocument] = useState({
    id: null,
    name: "Untitled Document",
    category: DEFAULT_CATEGORY,
    content: "",
  });
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([DEFAULT_CATEGORY]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load documents/categories on mount or auth change
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");
      try {
        if (isAuthenticated) {
          // Fetch from backend
          const docsRes = await fetch(`${config.apiBaseUrl}/documents/`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const docs = docsRes.ok ? (await docsRes.json()).documents || [] : [];
          setDocuments(docs);
          // Fetch categories
          const catsRes = await fetch(`${config.apiBaseUrl}/documents/categories/`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const cats = catsRes.ok ? await catsRes.json() : [DEFAULT_CATEGORY];
          setCategories(Array.isArray(cats) && cats.length ? cats : [DEFAULT_CATEGORY]);
        } else {
          // LocalStorage fallback
          const docs = localStorage.getItem(DOCUMENTS_KEY);
          setDocuments(docs ? Object.values(JSON.parse(docs)) : []);
          const cats = localStorage.getItem(CATEGORIES_KEY);
          setCategories(cats ? JSON.parse(cats) : [DEFAULT_CATEGORY]);
          const current = localStorage.getItem(CURRENT_DOC_KEY);
          setCurrentDocument(current ? JSON.parse(current) : {
            id: null,
            name: "Untitled Document",
            category: DEFAULT_CATEGORY,
            content: "",
          });
        }
      } catch (e) {
        setError("Failed to load documents or categories.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [isAuthenticated, token]);

  // Save current document to backend or localStorage
  const saveDocument = useCallback(async (doc) => {
    setLoading(true);
    setError("");
    try {
      // Always save Untitled Document to localStorage only
      if (doc.name === "Untitled Document") {
        const docs = localStorage.getItem(DOCUMENTS_KEY);
        const docsObj = docs ? JSON.parse(docs) : {};
        const id = doc.id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        // Ensure we save the latest content from the editor
        const document = {
          ...doc,
          id,
          content: doc.content, // Always save content
          lastModified: new Date().toISOString(),
          created: docsObj[id]?.created || new Date().toISOString(),
        };
        docsObj[id] = document;
        localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(docsObj));
        setDocuments(Object.values(docsObj));
        setCurrentDocument(document);
        localStorage.setItem(CURRENT_DOC_KEY, JSON.stringify(document));
        localStorage.setItem("lastDocumentId", id);
        if (doc.name === "Untitled Document") {
          setError("This document is only saved locally until you provide a title.");
        }
        setLoading(false);
        return;
      }
      if (isAuthenticated) {
        // Save to backend
        const method = doc.id ? "PUT" : "POST";
        const url = doc.id
          ? `${config.apiBaseUrl}/documents/${doc.id}`
          : `${config.apiBaseUrl}/documents/`;
        const res = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: doc.name,
            content: doc.content,
            category: doc.category,
          }),
        });
        if (!res.ok) throw new Error("Failed to save document");
        const saved = await res.json();
        setCurrentDocument(saved);
        localStorage.setItem("lastDocumentId", saved.id);
        // Refresh documents list
        const docsRes = await fetch(`${config.apiBaseUrl}/documents/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const docs = docsRes.ok ? (await docsRes.json()).documents || [] : [];
        setDocuments(docs);
      } else {
        // Save to localStorage
        const docs = localStorage.getItem(DOCUMENTS_KEY);
        const docsObj = docs ? JSON.parse(docs) : {};
        const id = doc.id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        // Ensure we save the latest content from the editor
        const document = {
          ...doc,
          id,
          content: doc.content, // Always save content
          lastModified: new Date().toISOString(),
          created: docsObj[id]?.created || new Date().toISOString(),
        };
        docsObj[id] = document;
        localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(docsObj));
        setDocuments(Object.values(docsObj));
        setCurrentDocument(document);
        localStorage.setItem(CURRENT_DOC_KEY, JSON.stringify(document));
        localStorage.setItem("lastDocumentId", id);
      }
    } catch (e) {
      setError("Failed to save document.");
    } finally {
      setLoading(false);
    }
  }, []);

  // On mount, load last active document if available
  useEffect(() => {
    const lastId = localStorage.getItem("lastDocumentId");
    if (lastId) {
      const docs = localStorage.getItem(DOCUMENTS_KEY);
      const docsObj = docs ? JSON.parse(docs) : {};
      if (docsObj[lastId]) {
        setCurrentDocument(docsObj[lastId]);
      }
    }
  }, []);

  // Create new document
  const createDocument = useCallback((name = "Untitled Document", category = DEFAULT_CATEGORY) => {
    setCurrentDocument({ id: null, name, category, content: "" });
  }, []);

  // Load document by ID
  const loadDocument = useCallback(async (id) => {
    setLoading(true);
    setError("");
    try {
      if (isAuthenticated) {
        const DocumentsApi = (await import("../js/api/documentsApi.js")).default;
        const doc = await DocumentsApi.getDocument(id);
        setCurrentDocument(doc);
      } else {
        const docs = localStorage.getItem(DOCUMENTS_KEY);
        const docsObj = docs ? JSON.parse(docs) : {};
        const doc = docsObj[id];
        if (!doc) throw new Error("Document not found");
        setCurrentDocument(doc);
        localStorage.setItem(CURRENT_DOC_KEY, JSON.stringify(doc));
      }
    } catch (e) {
      setError("Failed to load document.");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Delete document
  const deleteDocument = useCallback(async (id) => {
    setLoading(true);
    setError("");
    try {
      if (isAuthenticated) {
        const DocumentsApi = (await import("../js/api/documentsApi.js")).default;
        await DocumentsApi.deleteDocument(id);
        const docs = await DocumentsApi.getAllDocuments();
        setDocuments(docs);
        setCurrentDocument({ id: null, name: "Untitled Document", category: DEFAULT_CATEGORY, content: "" });
      } else {
        const docs = localStorage.getItem(DOCUMENTS_KEY);
        const docsObj = docs ? JSON.parse(docs) : {};
        delete docsObj[id];
        localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(docsObj));
        setDocuments(Object.values(docsObj));
        setCurrentDocument({ id: null, name: "Untitled Document", category: DEFAULT_CATEGORY, content: "" });
        localStorage.setItem(CURRENT_DOC_KEY, JSON.stringify({ id: null, name: "Untitled Document", category: DEFAULT_CATEGORY, content: "" }));
      }
    } catch (e) {
      setError("Failed to delete document.");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Rename document
  const renameDocument = useCallback(async (id, newName, newCategory = null) => {
    setLoading(true);
    setError("");
    try {
      if (isAuthenticated) {
        const DocumentsApi = (await import("../js/api/documentsApi.js")).default;
        // Find the document to get its content
        const doc = documents.find((d) => d.id === id);
        if (!doc) throw new Error("Document not found");
        const updated = await DocumentsApi.updateDocument(id, {
          name: newName,
          content: doc.content,
          category: newCategory || doc.category,
        });
        setCurrentDocument(updated);
        // Refresh documents list from backend
        const docsRes = await DocumentsApi.getAllDocuments();
        setDocuments(docsRes);
      } else {
        const docs = localStorage.getItem(DOCUMENTS_KEY);
        const docsObj = docs ? JSON.parse(docs) : {};
        if (docsObj[id]) {
          docsObj[id].name = newName;
          if (newCategory !== null) docsObj[id].category = newCategory;
          docsObj[id].lastModified = new Date().toISOString();
          localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(docsObj));
          setDocuments(Object.values(docsObj));
          setCurrentDocument(docsObj[id]);
          localStorage.setItem(CURRENT_DOC_KEY, JSON.stringify(docsObj[id]));
        }
      }
    } catch (e) {
      setError("Failed to rename document.");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, documents]);

  // Export as Markdown
  const exportAsMarkdown = useCallback((content, filename = null) => {
    const name = filename || currentDocument.name || "document";
    const fileName = name.endsWith(".md") ? name : `${name}.md`;
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    saveAs(blob, fileName);
  }, [currentDocument]);

  // Export as PDF (calls backend)
  const exportAsPDF = useCallback(async (htmlContent, filename = null) => {
    try {
      const documentName = filename || currentDocument.name || "Untitled Document";
      const isDarkMode = document.documentElement.classList.contains("dark-theme");
      const requestData = {
        html_content: htmlContent,
        document_name: documentName,
        is_dark_mode: isDarkMode,
      };
      const response = await fetch(`${config.apiBaseUrl}/pdf/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      });
      if (!response.ok) throw new Error("PDF export failed");
      const pdfBlob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = documentName.endsWith(".pdf") ? documentName : `${documentName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      setError("PDF export failed.");
    }
  }, [currentDocument]);

  const value = {
    currentDocument,
    setCurrentDocument,
    documents,
    setDocuments,
    categories,
    setCategories,
    loading,
    error,
    saveDocument,
    createDocument,
    loadDocument,
    deleteDocument,
    renameDocument,
    addCategory,
    deleteCategory,
    exportAsMarkdown,
    exportAsPDF,
    importMarkdownFile,
    getDocumentStats,
    searchDocuments,
    hasUnsavedChanges,
    renameCategory,
    user,
    token,
    isAuthenticated,
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
