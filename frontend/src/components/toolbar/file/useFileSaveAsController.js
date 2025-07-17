import { useState } from "react";
import { useDocument } from "../../../context/DocumentProvider.jsx";
import { useNotification } from "../../NotificationProvider";

export function useFileSaveAsController({ setDocumentTitle, setContent }) {
  const { saveDocument, loadDocument, createDocument, documents } = useDocument();
  const { showSuccess, showError } = useNotification();
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [importedFileData, setImportedFileData] = useState(null);

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
      console.error(err);
      setShowSaveAsModal(false);
      setImportedFileData(null);
    }
  };

  return {
    showSaveAsModal,
    setShowSaveAsModal,
    importedFileData,
    setImportedFileData,
    openSaveAs,
    handleSaveAsConfirm,
  };
}
