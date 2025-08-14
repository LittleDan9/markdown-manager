import { useState, useCallback } from "react";

export function useFileOpenController({ saveDocument, currentDocument, loadDocument, setDocumentTitle, setContent, showSuccess, content }) {
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [pendingOpenId, setPendingOpenId] = useState(null);

  const openOpenModal = useCallback(() => {
    setShowOpenModal(true);
  }, []);

  const handleOpenFile = useCallback(async (doc) => {
    // Save current document before opening new one if there are unsaved changes
    if (currentDocument && currentDocument.id && content !== undefined) {
      const currentContent = content || '';
      const savedContent = currentDocument.content || '';
      
      if (currentContent !== savedContent && currentContent.trim() !== '') {
        console.log('Saving current document before opening new one:', currentDocument.name);
        try {
          await saveDocument({ ...currentDocument, content: currentContent }, false);
          console.log('Successfully saved current document before opening new one');
        } catch (error) {
          console.error('Failed to save current document before opening new one:', error);
          // Continue with opening - user explicitly requested to open
        }
      }
    }

    setPendingOpenId(doc.id);
    await loadDocument(doc.id);
    setShowOpenModal(false);
  }, [loadDocument, saveDocument, currentDocument, content]);

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
