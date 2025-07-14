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
        const res = await fetch(`${config.apiBaseUrl}/documents/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load document");
        const doc = await res.json();
        setCurrentDocument(doc);
      } else {
        const docs = localStorage.getItem(DOCUMENTS_KEY);
        const docsObj = docs ? JSON.parse(docs) : {};
        const doc = docsObj[id];
        if (!doc) throw new Error("Document not found");
        setCurrentDocument(doc);
        // Persist loaded document as current in localStorage
        localStorage.setItem(CURRENT_DOC_KEY, JSON.stringify(doc));
      }
    } catch (e) {
      setError("Failed to load document.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Delete document
  const deleteDocument = useCallback(async (id) => {
    setLoading(true);
    setError("");
    try {
      if (isAuthenticated) {
        const res = await fetch(`${config.apiBaseUrl}/documents/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to delete document");
        // Refresh documents list
        const docsRes = await fetch(`${config.apiBaseUrl}/documents/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const docs = docsRes.ok ? (await docsRes.json()).documents || [] : [];
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
  }, []);

  // Rename document
  const renameDocument = useCallback(async (id, newName, newCategory = null) => {
    setLoading(true);
    setError("");
    try {
      if (isAuthenticated) {
        const res = await fetch(`${config.apiBaseUrl}/documents/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: newName, category: newCategory }),
        });
        if (!res.ok) throw new Error("Failed to rename document");
        const doc = await res.json();
        setCurrentDocument(doc);
        // Refresh documents list
        const docsRes = await fetch(`${config.apiBaseUrl}/documents/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const docs = docsRes.ok ? (await docsRes.json()).documents || [] : [];
        setDocuments(docs);
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
  }, []);

  // Add category
  const addCategory = useCallback(async (categoryName) => {
    const trimmedName = categoryName.trim();
    if (!trimmedName || categories.includes(trimmedName)) return;
    setCategories((prev) => {
      const next = [...prev, trimmedName];
      localStorage.setItem(CATEGORIES_KEY, JSON.stringify(next));
      return next;
    });
    // Optionally, call backend to add category if authenticated
    if (isAuthenticated) {
      await fetch(`${config.apiBaseUrl}/documents/categories/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: trimmedName }),
      });
    }
  }, [categories]);

  // Delete category
  const deleteCategory = useCallback(async (category) => {
    if (!category || category.trim().toLowerCase() === DEFAULT_CATEGORY.toLowerCase()) return;
    setCategories((prev) => {
      const next = prev.filter((cat) => cat !== category);
      localStorage.setItem(CATEGORIES_KEY, JSON.stringify(next));
      return next;
    });
    // Optionally, call backend to delete category if authenticated
    if (isAuthenticated) {
      await fetch(`${config.apiBaseUrl}/documents/categories/${encodeURIComponent(category)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    // Reassign docs to General
    setDocuments((prev) => prev.map((doc) => doc.category === category ? { ...doc, category: DEFAULT_CATEGORY } : doc));
  }, []);

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

  // Import Markdown file
  const importMarkdownFile = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target.result;
          const name = file.name.replace(/\.md$/, "");
          resolve({ content, name });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  }, []);

  // Document statistics
  const getDocumentStats = useCallback((content) => {
    const lines = content.split("\n").length;
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    const characters = content.length;
    const charactersNoSpaces = content.replace(/\s/g, "").length;
    return { lines, words, characters, charactersNoSpaces };
  }, []);

  // Search documents
  const searchDocuments = useCallback((query) => {
    const searchTerm = query.toLowerCase();
    return documents.filter(
      (doc) =>
        doc.name.toLowerCase().includes(searchTerm) ||
        doc.content.toLowerCase().includes(searchTerm)
    );
  }, [documents]);

  // Check for unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    if (!currentDocument.id) {
      return currentDocument.content.trim() !== "";
    }
    const savedDoc = documents.find((doc) => doc.id === currentDocument.id);
    if (!savedDoc) return true;
    return currentDocument.content !== savedDoc.content || currentDocument.name !== savedDoc.name || currentDocument.category !== savedDoc.category;
  }, [currentDocument, documents]);

  // Rename category
  const renameCategory = useCallback(async (oldName, newName) => {
    const trimmedNew = newName.trim();
    if (!trimmedNew || categories.includes(trimmedNew)) {
      setError("Category name already exists or is invalid.");
      return false;
    }
    setCategories((prev) => {
      const next = prev.map((cat) => (cat === oldName ? trimmedNew : cat));
      localStorage.setItem(CATEGORIES_KEY, JSON.stringify(next));
      return next;
    });
    // Optionally, call backend to rename category if authenticated
    if (isAuthenticated) {
      await fetch(`${config.apiBaseUrl}/documents/categories/${encodeURIComponent(oldName)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: trimmedNew }),
      });
    }
    // Update documents to new category name
    setDocuments((prev) => prev.map((doc) => doc.category === oldName ? { ...doc, category: trimmedNew } : doc));
    return true;
  }, [categories]);

  // Context value
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
