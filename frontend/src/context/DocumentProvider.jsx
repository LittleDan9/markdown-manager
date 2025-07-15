import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthProvider.jsx";

import config from "../js/config";
import { saveAs } from "file-saver";
import DocumentStorage from "../storage/DocumentStorage";

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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load documents/categories on mount or auth change
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");
      try {
        if (isAuthenticated) {
          const DocumentsApi = (await import("../js/api/documentsApi.js")).default;
          const docs = await DocumentsApi.getAllDocuments();
          setDocuments(docs);
          const cats = await DocumentsApi.getCategories();
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

  // Save current document using DocumentStorage abstraction
  const saveDocument = useCallback(async (doc) => {
    setLoading(true);
    setError("");
    try {
      const saved = await DocumentStorage.saveDocument(doc, isAuthenticated, token);
      setCurrentDocument(saved);
      setDocuments(DocumentStorage.getAllDocuments());
      setHasUnsavedChanges(false);
    } catch (e) {
      setError("Failed to save document.");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token]);

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

  // Load document by ID using DocumentStorage
  const loadDocument = useCallback(async (id) => {
    setLoading(true);
    setError("");
    try {
      const doc = DocumentStorage.getDocument(id);
      if (!doc) throw new Error("Document not found");
      setCurrentDocument(doc);
    } catch (e) {
      setError("Failed to load document.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Delete document using DocumentStorage
  const deleteDocument = useCallback(async (id) => {
    setLoading(true);
    setError("");
    try {
      await DocumentStorage.deleteDocument(id, isAuthenticated, token);
      setDocuments(DocumentStorage.getAllDocuments());
      setCurrentDocument(DocumentStorage.getCurrentDocument() || { id: null, name: "Untitled Document", category: DEFAULT_CATEGORY, content: "" });
    } catch (e) {
      setError("Failed to delete document.");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token]);

  // Rename document using saveDocument (update name/category)
  const renameDocument = useCallback(async (id, newName, newCategory = null) => {
    setLoading(true);
    setError("");
    try {
      const doc = DocumentStorage.getDocument(id) || { id, name: newName, category: newCategory || DEFAULT_CATEGORY, content: "" };
      doc.name = newName;
      if (newCategory !== null) doc.category = newCategory;
      await saveDocument(doc);
    } catch (e) {
      setError("Failed to rename document.");
    } finally {
      setLoading(false);
    }
  }, [saveDocument]);

  // Export as Markdown
  const exportAsMarkdown = useCallback((content, filename = null) => {
    const name = filename || currentDocument.name || "document";
    const fileName = name.endsWith(".md") ? name : `${name}.md`;
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    saveAs(blob, fileName);
  }, [currentDocument]);

  // Export as PDF (calls backend)
  const exportAsPDF = useCallback(async (htmlContent, filename = null) => {
    // No DocumentsApi method for PDF export; keeping fetch here.
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
  // Track unsaved changes when the editor changes
  useEffect(() => {
    // Only set true if the document is actually different from saved
    if (!currentDocument || !currentDocument.id) {
      // For new/untitled documents, check if content or name is not default
      setHasUnsavedChanges(
        currentDocument.name !== "Untitled Document" ||
        currentDocument.content !== "" ||
        currentDocument.category !== DEFAULT_CATEGORY
      );
      return;
    }
    const savedDoc = documents.find(doc => doc.id === currentDocument.id);
    if (!savedDoc) {
      setHasUnsavedChanges(false);
      return;
    }
    setHasUnsavedChanges(
      currentDocument.name !== savedDoc.name ||
      currentDocument.content !== savedDoc.content ||
      currentDocument.category !== savedDoc.category
    );
  }, [currentDocument, documents]);

  // Add category using DocumentStorage
  const addCategory = useCallback(async (category) => {
    setLoading(true);
    setError("");
    try {
      const updatedCategories = await DocumentStorage.addCategory(category, isAuthenticated, token);
      setCategories(updatedCategories);
    } catch (e) {
      setError("Failed to add category.");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token]);

  // Delete category using DocumentStorage
  const deleteCategory = useCallback(async (name, options = {}) => {
    setLoading(true);
    setError("");
    try {
      const updatedCategories = await DocumentStorage.deleteCategory(name, options, isAuthenticated, token);
      setCategories(updatedCategories);
      setDocuments(DocumentStorage.getAllDocuments());
    } catch (e) {
      setError("Failed to delete category.");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token]);

  // Rename category using DocumentStorage
  const renameCategory = useCallback(async (oldName, newName) => {
    setLoading(true);
    setError("");
    try {
      const updatedCategories = await DocumentStorage.renameCategory(oldName, newName, isAuthenticated, token);
      setCategories(updatedCategories);
      setDocuments(DocumentStorage.getAllDocuments());
    } catch (e) {
      setError("Failed to rename category.");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token]);

  const importMarkdownFile = useCallback(async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({ content: e.target.result, name: file.name.replace(/\.md$/, "") });
      };
      reader.onerror = (e) => {
        reject(new Error("Failed to read file"));
      };
      reader.readAsText(file);
    });
  }, []);

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
