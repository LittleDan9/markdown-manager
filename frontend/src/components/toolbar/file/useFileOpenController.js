import { useState, useCallback } from "react";

export function useFileOpenController({ saveDocument, currentDocument, loadDocument, setDocumentTitle, setContent, showSuccess }) {
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [pendingOpenId, setPendingOpenId] = useState(null);

  const openOpenModal = useCallback(() => {
    setShowOpenModal(true);
  }, []);

  const handleOpenFile = useCallback(async (doc) => {
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

  return {
    showOpenModal,
    setShowOpenModal,
    openOpenModal,
    handleOpenFile,
    handleOpenEffect,
  };
}
