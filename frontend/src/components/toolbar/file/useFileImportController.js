import { useState, useRef } from "react";
import { useDocument } from "../../../context/DocumentProvider.jsx";
import { useNotification } from "../../NotificationProvider";

export function useFileImportController({ setDocumentTitle, setContent }) {
  const { saveDocument, currentDocument, importMarkdownFile, loadDocument, createDocument, documents } = useDocument();
  const { showSuccess, showError } = useNotification();
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedFileData, setImportedFileData] = useState(null);
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);
  const fileInputRef = useRef();

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
      if (!/^#|^\*|^\-|^\d+\.|```|\n#|\n\*|\n\-|\n\d+\.|\n```/m.test(content)) {
        alert("File does not appear to be valid Markdown.");
        return;
      }
      setImportedFileData({ content, name });
      setShowImportModal(true);
    } catch (err) {
      console.error(err);
      showError("Failed to import Markdown file.");
    }
  };

  const handleImportConfirm = async (selectedCategory, filename, actionKey = "confirm") => {
    if (!importedFileData) return;
    const safeName = (filename && filename !== "__category_placeholder__") ? filename : "Untitled Document";
    const safeCategory = (selectedCategory && selectedCategory !== "__category_placeholder__") ? selectedCategory : "General";
    // Ensure category is saved to backend if authenticated and not present
    let categories = [];
    try {
      categories = await DocumentStorage.getCategories();
    } catch (e) {
      categories = ["General"];
    }
    if (!categories.includes(safeCategory)) {
      try {
        await DocumentStorage.addCategory(safeCategory, currentDocument && currentDocument.id !== null, null);
      } catch (e) {
        // Ignore category add errors
      }
    }
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
    if (actionKey === "save") {
      try {
        const savedDoc = await saveDocument(docToSave);
        if (savedDoc && savedDoc.id) {
          await loadDocument(savedDoc.id);
          setDocumentTitle(savedDoc.name);
          if (setContent) setContent(savedDoc.content);
          showSuccess(`Document saved as: ${savedDoc.name}`);
          setShowImportModal(false);
          setImportedFileData(null);
        } else {
          showError("Failed to save document: No document ID returned.");
        }
      } catch (err) {
        if (err.message && err.message.includes("already exists")) {
          setPendingImport(docToSave);
          setShowImportModal(false);
          setShowOverwriteModal(true);
        } else {
          showError("Failed to save document.");
          console.error(err);
          setShowImportModal(false);
        }
      }
      return;
    }
    if (actionKey === "confirm") {
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
        showError("Failed to save imported document: No document ID returned.");
      }
    } catch (err) {
      if (err.message && err.message.includes("already exists")) {
        setPendingImport(docToSave);
        setShowImportModal(false);
        setShowOverwriteModal(true);
      } else {
        showError("Failed to save imported document.");
        console.error(err);
        setShowImportModal(false);
      }
    }
  };

  const handleOverwriteConfirm = async () => {
    if (!pendingImport) return;
    try {
      const existingDoc = documents.find(
        d => d.name === pendingImport.name && d.category === pendingImport.category
      );
      if (existingDoc) {
        await deleteDocument(existingDoc.id);
      }
      const savedDoc = await saveDocument(pendingImport);
      if (savedDoc && savedDoc.id) {
        await loadDocument(savedDoc.id);
        setDocumentTitle(savedDoc.name);
        if (setContent) setContent(savedDoc.content);
        showSuccess(`Imported and overwritten document: ${savedDoc.name}`);
      } else {
        showError("Failed to overwrite imported document: No document ID returned.");
      }
    } catch (err) {
      showError("Failed to overwrite imported document.");
      console.error(err);
    } finally {
      setShowOverwriteModal(false);
      setPendingImport(null);
      setImportedFileData(null);
    }
  };

  const handleOverwriteCancel = () => {
    setShowOverwriteModal(false);
    setPendingImport(null);
    if (importedFileData) {
      setShowImportModal(true);
    }
  };

  return {
    showImportModal,
    setShowImportModal,
    importedFileData,
    setImportedFileData,
    showOverwriteModal,
    setShowOverwriteModal,
    pendingImport,
    setPendingImport,
    fileInputRef,
    handleImport,
    handleFileChange,
    handleImportConfirm,
    handleOverwriteConfirm,
    handleOverwriteCancel,
  };
}
