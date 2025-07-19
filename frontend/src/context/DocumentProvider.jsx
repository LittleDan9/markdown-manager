import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthProvider.jsx";

import config from "../js/config";
import { saveAs } from "file-saver";
import DocumentStorage from "../storage/DocumentStorage";
import DocumentsApi from "../js/api/documentsApi.js";

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
    if (!isAuthenticated) {
      // Clear localStorage on logout
      localStorage.removeItem(DOCUMENTS_KEY);
      localStorage.removeItem(CURRENT_DOC_KEY);
      localStorage.removeItem("lastDocumentId");
      localStorage.removeItem(CATEGORIES_KEY);
      setDocuments([]);
      setCategories([DEFAULT_CATEGORY]);
      setCurrentDocument({ id: null, name: "Untitled Document", category: DEFAULT_CATEGORY, content: "" });
      return;
    }
    // On initial load, filter out invalid docs from savedDocuments
    const localDocs = localStorage.getItem(DOCUMENTS_KEY);
    let validDocs = localDocs ? Object.values(JSON.parse(localDocs)).filter(doc => doc && typeof doc.name === "string" && doc.name !== "__category_placeholder__" && doc.name.trim() && typeof doc.category === "string" && doc.category !== "__category_placeholder__" && doc.category.trim()) : [];
    if (!validDocs || validDocs.length === 0) {
      validDocs = [{ id: null, name: "Untitled Document", category: DEFAULT_CATEGORY, content: "" }];
      localStorage.setItem(DOCUMENTS_KEY, JSON.stringify({ [validDocs[0].id || "untitled"]: validDocs[0] }));
    }
    async function loadData() {
      setLoading(true);
      setError("");
      try {
        let docs = [];
        let cats = [];
        // ...existing code...
        // (rest of the logic unchanged)
      } catch (e) {
        console.error("Failed to load documents or categories:", e);
        setError("Failed to load documents or categories.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [isAuthenticated, token]);

  // Save current document using DocumentStorage abstraction
  const saveDocument = useCallback(async (doc) => {
    // Prevent saving the default Untitled Document
    if (
      doc.id === null &&
      doc.name === "Untitled Document" &&
      doc.category === DEFAULT_CATEGORY &&
      doc.content === ""
    ) {
      return null;
    }
    setLoading(true);
    setError("");
    try {
      const saved = await DocumentStorage.saveDocument(doc, isAuthenticated, token);
      setCurrentDocument(saved);
      setDocuments(DocumentStorage.getAllDocuments());
      setHasUnsavedChanges(false);
      // Sync current_doc_id to backend if authenticated
      if (isAuthenticated && saved && saved.id) {
        await DocumentStorage.updateCurrentDocumentId(saved.id, isAuthenticated, token);
      }
      return saved;
    } catch (e) {
      console.error(e);
      throw (e)
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token]);

  // On mount, load last active document if available, with robust fallback
  useEffect(() => {
    const lastId = localStorage.getItem("lastDocumentId");
    const docs = localStorage.getItem(DOCUMENTS_KEY);
    const docsObj = docs ? JSON.parse(docs) : {};
    let doc = null;
    if (lastId && docsObj[lastId]) {
      doc = docsObj[lastId];
    } else if (localStorage.getItem(CURRENT_DOC_KEY)) {
      try {
        doc = JSON.parse(localStorage.getItem(CURRENT_DOC_KEY));
      } catch (e) {
        doc = null;
      }
    }
    // Validate doc name/category
    if (!doc || typeof doc.name !== "string" || doc.name === "__category_placeholder__" || !doc.name.trim()) {
      doc = {
        id: null,
        name: "Untitled Document",
        category: DEFAULT_CATEGORY,
        content: "",
      };
    } else {
      // Also validate category
      if (!doc.category || doc.category === "__category_placeholder__") {
        doc.category = DEFAULT_CATEGORY;
      }
      if (typeof doc.content !== "string") {
        doc.content = "";
      }
    }
    setCurrentDocument(doc);
    DocumentStorage.setCurrentDocument(doc);
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
      DocumentStorage.setCurrentDocument(doc); // Ensure localStorage is updated
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
      const allDocs = DocumentStorage.getAllDocuments();
      setDocuments(allDocs);
      // If there are other documents, set to the first one, else set to default
      if (allDocs.length > 0) {
        setCurrentDocument(allDocs[0]);
      } else {
        setCurrentDocument({ id: null, name: "Untitled Document", category: DEFAULT_CATEGORY, content: "" });
      }
      // Prevent auto-save or update for deleted document by resetting hasUnsavedChanges
      setHasUnsavedChanges(false);
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

  // Export as PDF using DocumentsApi
  const exportAsPDF = useCallback(async (htmlContent, filename = null, theme = "light") => {
    try {
      const documentName = filename || currentDocument.name || "Untitled Document";
      // Use ThemeContext to determine dark mode
      let isDarkMode = theme === "dark";
      const pdfBlob = await DocumentsApi.exportAsPDF(htmlContent, documentName, isDarkMode);
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

  const isDefaultDoc = currentDocument &&
    currentDocument.id === null &&
    currentDocument.name === "Untitled Document" &&
    currentDocument.category === DEFAULT_CATEGORY;

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
  isDefaultDoc,
  openDocument: (doc) => {
    if (!doc) return;
    setCurrentDocument(doc);
  },
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
