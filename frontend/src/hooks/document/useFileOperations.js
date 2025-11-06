import { useState, useRef, useCallback } from "react";
import { useDocumentContext } from "@/providers/DocumentContextProvider.jsx";
import { useNotification } from "@/components/NotificationProvider.jsx";

// Consolidated file operations hook
export function useFileOperations({ setDocumentTitle, setContent, renderedHTML, theme }) {
  // Document context and notifications
  const {
    saveDocument, currentDocument, loadDocument, createDocument, documents,
    exportAsMarkdown, exportAsPDF, importMarkdownFile
  } = useDocumentContext();
  const { showSuccess, showError } = useNotification();

  // State for modals and file data
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);
  const [pendingOpenId, setPendingOpenId] = useState(null);
  const [importedFileData, setImportedFileData] = useState(null);
  const [pendingImport, setPendingImport] = useState(null);
  const fileInputRef = useRef();

  // --- File Open Logic ---
  const openOpenModal = useCallback(() => setShowOpenModal(true), []);
  const handleOpenFile = useCallback(async (doc) => {
    // Note: Document context already handles unsaved changes via other mechanisms
    // No need to manually check and save here since we don't have reliable access to current editor content
    setPendingOpenId(doc.id);
    await loadDocument(doc.id);
    setShowOpenModal(false);
  }, [loadDocument]);
  const handleOpenEffect = useCallback(() => {
    if (pendingOpenId && currentDocument && currentDocument.id === pendingOpenId) {
      if (setContent) setContent(currentDocument.content);
      if (setDocumentTitle) setDocumentTitle(currentDocument.name);
      if (showSuccess) showSuccess(`Opened document: ${currentDocument.name}`);
      setPendingOpenId(null);
    }
  }, [pendingOpenId, currentDocument, setContent, setDocumentTitle, showSuccess]);

  // --- File Save/Save As Logic ---
  const openSaveAs = (content, name) => {
    setImportedFileData({ content, name });
    setShowSaveAsModal(true);
  };
  const handleSaveAsConfirm = async (selectedCategory, filename, actionKey = "save") => {
    if (actionKey === "discard") {
      setShowSaveAsModal(false);
      setImportedFileData(null);
      createDocument();
      setDocumentTitle("Untitled Document");
      if (setContent) setContent("");
      showSuccess("Started new document.");
      return;
    }
    if (!importedFileData) return;
    const safeName = (filename && filename !== "__category_placeholder__") ? filename : "Untitled Document";
    const safeCategory = (selectedCategory && selectedCategory !== "__category_placeholder__") ? selectedCategory : "General";
    const docToSave = {
      name: safeName,
      category: safeCategory,
      content: importedFileData.content,
    };
    if (actionKey === "cancel") {
      setShowSaveAsModal(false);
      setImportedFileData(null);
      return;
    }
    try {
      const savedDoc = await saveDocument(docToSave);
      if (savedDoc && savedDoc.id) {
        await loadDocument(savedDoc.id);
        setDocumentTitle(savedDoc.name);
        if (setContent) setContent(savedDoc.content);
        showSuccess(`Document saved as: ${savedDoc.name}`);
        setShowSaveAsModal(false);
        setImportedFileData(null);
        createDocument();
        setDocumentTitle("Untitled Document");
      } else {
        showError("Failed to save document: No document ID returned.");
      }
    } catch (err) {
      showError("Failed to save document.");
      setShowSaveAsModal(false);
      setImportedFileData(null);
    }
  };

  // --- File Import Logic ---
  const handleImport = () => {
    setImportedFileData(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    fileInputRef.current.click();
  };
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith(".md")) {
      showError("Only .md files are supported.");
      return;
    }
    try {
      await saveDocument(currentDocument);
      const { content, name } = await importMarkdownFile(file);
      setImportedFileData({ content, name });
      setShowImportModal(true);
    } catch (err) {
      showError("Failed to import Markdown file.");
    }
  };
  const handleImportConfirm = async (selectedCategory, filename, actionKey = "confirm") => {
    if (!importedFileData) return;
    const safeName = (filename && filename !== "__category_placeholder__") ? filename : "Untitled Document";
    const safeCategory = (selectedCategory && selectedCategory !== "__category_placeholder__") ? selectedCategory : "General";
    const docToSave = {
      name: safeName,
      category: safeCategory,
      content: importedFileData.content,
    };
    if (actionKey === "cancel") {
      setShowImportModal(false);
      setImportedFileData(null);
      return;
    }
    try {
      const savedDoc = await saveDocument(docToSave);
      if (savedDoc && savedDoc.id) {
        await loadDocument(savedDoc.id);
        setDocumentTitle(savedDoc.name);
        if (setContent) setContent(savedDoc.content);
        showSuccess(`Imported document: ${savedDoc.name}`);
        setShowImportModal(false);
        setImportedFileData(null);
      } else {
        showError("Failed to import document: No document ID returned.");
      }
    } catch (err) {
      showError("Failed to import document.");
      setShowImportModal(false);
      setImportedFileData(null);
    }
  };

  // --- File Export Logic ---
  const handleExportMarkdown = useCallback(() => {
    if (!currentDocument) return;
    exportAsMarkdown(currentDocument.content, currentDocument.name);
  }, [exportAsMarkdown, currentDocument]);
  const handleExportPDF = useCallback(() => {
    if (!currentDocument) {
      showError && showError("No document selected for export.");
      return;
    }

    if (!renderedHTML || renderedHTML.trim() === "") {
      showError && showError("Document content is still being processed. Please wait a moment and try again.");
      return;
    }

    exportAsPDF(renderedHTML, currentDocument.name, theme);
  }, [exportAsPDF, currentDocument, renderedHTML, showError, theme]);

  // --- File Overwrite Logic ---
  const openOverwriteModal = useCallback((importData) => {
    setPendingImport(importData);
    setShowOverwriteModal(true);
  }, []);
  const handleOverwriteConfirm = useCallback(async () => {
    // Implement as needed for your app
    setShowOverwriteModal(false);
    setPendingImport(null);
  }, []);
  const handleOverwriteCancel = useCallback(() => {
    setShowOverwriteModal(false);
    setPendingImport(null);
  }, []);

  return {
    // Modal state
    showOpenModal, setShowOpenModal,
    showImportModal, setShowImportModal,
    showSaveAsModal, setShowSaveAsModal,
    showOverwriteModal, setShowOverwriteModal,
    // File data
    importedFileData, setImportedFileData,
    pendingOpenId, setPendingOpenId,
    pendingImport, setPendingImport,
    fileInputRef,
    // File operation handlers
    openOpenModal, handleOpenFile, handleOpenEffect,
    openSaveAs, handleSaveAsConfirm,
    handleImport, handleFileChange, handleImportConfirm,
    handleExportMarkdown, handleExportPDF,
    openOverwriteModal, handleOverwriteConfirm, handleOverwriteCancel,
  };
}
