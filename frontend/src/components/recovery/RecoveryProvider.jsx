import React, { createContext, useContext, useState, useCallback } from "react";
import { useNotification } from "../NotificationProvider.jsx";

const RecoveryContext = createContext();

export function RecoveryProvider({ children }) {
  const [showModal, setShowModal] = useState(false);
  const [activeDoc, setActiveDoc] = useState(null);
  const { showSuccess, showError, showWarning, showInfo } = useNotification();

  // Listen for event to show recovery modal
  React.useEffect(() => {
    function handleShowRecoveryModal(e) {
      if (e.detail && Array.isArray(e.detail) && e.detail.length > 0) {
        setRecoveredDocs(e.detail);
        setShowModal(true);
        showWarning("You have unsaved documents recovered from a previous session. Please review and resolve them.");
      }
    }
    window.addEventListener("showRecoveryModal", handleShowRecoveryModal);
    return () => window.removeEventListener("showRecoveryModal", handleShowRecoveryModal);
  }, []);

  // Show modal if recoveredDocs is set
  React.useEffect(() => {
    if (recoveredDocs.length > 0) {
      setShowModal(true);
    }
    if (error) {
      showError(error);
    }
  }, [recoveredDocs, error]);

  function handleReview(doc) {
    setActiveDoc(doc);
    setShowModal(true);
  }

  function handleCloseModal() {
    setShowModal(false);
    setActiveDoc(null);
  }

  async function handleSave(doc, token) {
    // Save recovered doc to backend (create new or update)
    try {
      const DocumentsApi = (await import("../../js/api/documentsApi.js")).default;
      if (!doc.document_id || String(doc.document_id).startsWith("doc_")) {
        // New document, create
        await DocumentsApi.createDocument({
          name: doc.name,
          content: doc.content,
          category: doc.category,
        });
      } else {
        // Existing document, update
        await DocumentsApi.updateDocument(doc.document_id, {
          name: doc.name,
          content: doc.content,
          category: doc.category,
        });
      }
      showSuccess(`Document '${doc.name}' has been restored and saved to your account.`);
    } catch (e) {
      showError(`Failed to save document '${doc.name}'. Please try again.`);
    }
    await resolveDoc(doc.id, token);
    setActiveDoc(null);
    if (recoveredDocs.length === 1) setShowModal(false);
  }

  async function handleOverwrite(doc, token) {
    // Overwrite backend doc with recovered content
    try {
      const DocumentsApi = (await import("../../js/api/documentsApi.js")).default;
      await DocumentsApi.updateDocument(doc.document_id, {
        name: doc.name,
        content: doc.content,
        category: doc.category,
      });
      showSuccess(`Document '${doc.name}' has been overwritten and saved.`);
    } catch (e) {
      showError(`Failed to overwrite document '${doc.name}'. Please try again.`);
    }
    await resolveDoc(doc.id, token);
    setActiveDoc(null);
    if (recoveredDocs.length === 1) setShowModal(false);
  }

  function handleDiscard(doc, token) {
    resolveDoc(doc.id, token);
    showWarning(`Document '${doc.name}' was discarded and will not be restored.`);
    setActiveDoc(null);
    if (recoveredDocs.length === 1) setShowModal(false);
  }

  function handleDiscardAll() {
    discardAll();
    showWarning("All recovered documents have been discarded.");
    setShowModal(false);
    setActiveDoc(null);
  }
  // Recovery state: list of recovered docs, loading, error
  const [recoveredDocs, setRecoveredDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");


  // Actions: fetch, resolve, discard
  const fetchRecoveredDocs = useCallback(async (userId, token) => {
    setLoading(true);
    setError("");
    try {
      const RecoveryApi = (await import("../../js/api/recoveryApi.js")).default;
      const docs = await RecoveryApi.fetchRecoveredDocs(userId, token);
      setRecoveredDocs(docs);
    } catch (e) {
      setError("Failed to fetch recovery documents.");
    } finally {
      setLoading(false);
    }
  }, []);

  const resolveDoc = useCallback(async (docId, token) => {
    setLoading(true);
    setError("");
    try {
      const RecoveryApi = (await import("../../js/api/recoveryApi.js")).default;
      await RecoveryApi.resolveRecoveryDoc(docId, token);
      setRecoveredDocs(prev => prev.filter(doc => doc.id !== docId));
    } catch (e) {
      setError("Failed to resolve document.");
    } finally {
      setLoading(false);
    }
  }, []);

  const discardAll = useCallback(() => {
    setRecoveredDocs([]);
  }, []);

  return (
    <RecoveryContext.Provider value={{ recoveredDocs, loading, error, fetchRecoveredDocs, resolveDoc, discardAll, showModal, setShowModal, activeDoc, handleReview, handleCloseModal, handleSave, handleOverwrite, handleDiscard, handleDiscardAll }}>
      {children}
      {/* Recovery Modal UI */}
      {showModal && (
        <React.Suspense fallback={null}>
          {activeDoc ? (
            <RecoveryModal
              show={showModal}
              doc={activeDoc}
              onSave={() => handleSave(activeDoc)}
              onOverwrite={() => handleOverwrite(activeDoc)}
              onDiscard={() => handleDiscard(activeDoc)}
              onHide={handleCloseModal}
            />
          ) : (
            <RecoveryList
              docs={recoveredDocs}
              onReview={handleReview}
              onDiscardAll={handleDiscardAll}
            />
          )}
        </React.Suspense>
      )}
    </RecoveryContext.Provider>
  );
}

export function useRecovery() {
  return useContext(RecoveryContext);
}
