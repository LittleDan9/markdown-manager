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
      const DocumentsApi = (await import("../../api/documentsApi.js")).default;
      const RecoveryApi = (await import("../../api/recoveryApi.js")).default;

      let documentName = doc.name;

      // If this is a name conflict, auto-generate a unique name
      if (doc.collision || doc.error_type === 'name_conflict') {
        const baseName = doc.name;
        let counter = 1;
        let isUnique = false;

        // Keep trying new names until we find one that doesn't conflict
        while (!isUnique && counter <= 20) { // Safety limit
          documentName = `${baseName} (${counter})`;
          try {
            // Check if this name already exists by trying to fetch it
            const existingDocs = await DocumentsApi.getAllDocuments();
            const nameExists = existingDocs.some(existingDoc =>
              existingDoc.name === documentName && existingDoc.category === doc.category
            );

            if (!nameExists) {
              isUnique = true;
            } else {
              counter++;
            }
          } catch (error) {
            // If we can't check, assume it's unique and let the backend handle it
            isUnique = true;
          }
        }

        if (!isUnique) {
          // Fallback: add timestamp
          documentName = `${baseName} (${new Date().toISOString().slice(0, 19).replace(/:/g, '-')})`;
        }
      }

      if (!doc.document_id || String(doc.document_id).startsWith("doc_")) {
        // New document, create
        await DocumentsApi.createDocument({
          name: documentName,
          content: doc.content,
          category: doc.category,
        });
      } else {
        // Existing document, update
        await DocumentsApi.updateDocument(doc.document_id, {
          name: documentName,
          content: doc.content,
          category: doc.category,
        });
      }

      // Remove from recovery system
      if (doc.id && !doc.id.toString().startsWith('conflict_') && !doc.id.toString().startsWith('orphaned_')) {
        await RecoveryApi.resolveRecoveryDoc(doc.id, token);
      }

      const message = documentName !== doc.name
        ? `Document saved as '${documentName}' to avoid naming conflict.`
        : `Document '${doc.name}' has been restored and saved to your account.`;

      showSuccess(message);
    } catch (e) {
      console.error('Save error:', e);
      showError(`Failed to save document '${doc.name}'. Please try again.`);
    }
    await resolveDoc(doc.id, token);
    setActiveDoc(null);
    if (recoveredDocs.length === 1) {
      setShowModal(false);
      // Trigger document sync after all recovery is complete
      setTimeout(async () => {
        try {
          const DocumentService = (await import("../../services/DocumentService.js")).default;
          await DocumentService.syncWithBackend();
        } catch (error) {
          console.error('Document sync failed after recovery completion:', error);
        }
      }, 500);
    }
  }

  async function handleOverwrite(doc, token) {
    // Overwrite backend doc with recovered content
    try {
      const DocumentsApi = (await import("../../api/documentsApi.js")).default;
      const RecoveryApi = (await import("../../api/recoveryApi.js")).default;

      await DocumentsApi.updateDocument(doc.document_id, {
        name: doc.name,
        content: doc.content,
        category: doc.category,
      });

      // Remove from recovery system
      if (doc.id && !doc.id.toString().startsWith('conflict_') && !doc.id.toString().startsWith('orphaned_')) {
        await RecoveryApi.resolveRecoveryDoc(doc.id, token);
      }

      showSuccess(`Document '${doc.name}' has been overwritten and saved.`);
    } catch (e) {
      console.error('Overwrite error:', e);
      showError(`Failed to overwrite document '${doc.name}'. Please try again.`);
    }
    await resolveDoc(doc.id, token);
    setActiveDoc(null);
    if (recoveredDocs.length === 1) {
      setShowModal(false);
      // Trigger document sync after all recovery is complete
      setTimeout(async () => {
        try {
          const DocumentService = (await import("../../services/DocumentService.js")).default;
          await DocumentService.syncWithBackend();
        } catch (error) {
          console.error('Document sync failed after recovery completion:', error);
        }
      }, 500);
    }
  }

  function handleDiscard(doc, token) {
    const performDiscard = async () => {
      try {
        const RecoveryApi = (await import("../../api/recoveryApi.js")).default;

        // Remove from backend recovery system if it exists there
        if (doc.id && !doc.id.toString().startsWith('conflict_') && !doc.id.toString().startsWith('orphaned_')) {
          await RecoveryApi.resolveRecoveryDoc(doc.id, token);
        }
      } catch (error) {
        console.error('Failed to remove from recovery system:', error);
      }
    };

    performDiscard();
    resolveDoc(doc.id, token);
    showWarning(`Document '${doc.name}' was discarded and will not be restored.`);
    setActiveDoc(null);
    if (recoveredDocs.length === 1) {
      setShowModal(false);
      // Trigger document sync after all recovery is complete
      setTimeout(async () => {
        try {
          const DocumentService = (await import("../../services/DocumentService.js")).default;
          await DocumentService.syncWithBackend();
        } catch (error) {
          console.error('Document sync failed after recovery completion:', error);
        }
      }, 500);
    }
  }

  function handleDiscardAll() {
    discardAll();
    showWarning("All recovered documents have been discarded.");
    setShowModal(false);
    setActiveDoc(null);

    // Trigger document sync after all recovery is complete
    setTimeout(async () => {
      try {
        const DocumentService = (await import("../../services/DocumentService.js")).default;
        await DocumentService.syncWithBackend();
      } catch (error) {
        console.error('Document sync failed after recovery completion:', error);
      }
    }, 500);
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
      const RecoveryApi = (await import("../../api/recoveryApi.js")).default;
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
      const RecoveryApi = (await import("../../api/recoveryApi.js")).default;
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
