import React, { useState, useEffect, useCallback } from "react";
import { Modal } from "react-bootstrap";
import ConfirmModal from "@/components/shared/modals/ConfirmModal";
import { useNotification } from "@/components/NotificationProvider";
import { useDocumentContext } from "@/providers/DocumentContextProvider.jsx";
import { useFileModal } from "@/hooks/ui";
// Import the unified tab component
import UnifiedFileBrowserTab from "./tabs/UnifiedFileBrowserTab";
import GitHubModal from "../github/modals/GitHubModal";

export default function FileOpenModal({ show, onHide, onOpen, setContent, deleteDocument, setDocumentTitle }) {
  const { documents, categories } = useDocumentContext();
  const [showConfirm, setShowConfirm] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { showSuccess, showError } = useNotification();
  const { activeTab, selectedRepository, closeFileModal } = useFileModal();
  const [showGitHubModal, setShowGitHubModal] = useState(false);

  // Sync the activeTab from the global state
  useEffect(() => {
    // localActiveTab was here but not used
  }, [activeTab, selectedRepository]);

  // Override onHide to also close the global modal state
  const handleHide = () => {
    closeFileModal();
    onHide();
  };

  const handleFileOpen = (doc) => {
    onOpen(doc);
    if (setContent) setContent(doc.content);
  };

  const handleDocumentDelete = (doc) => {
    setDocToDelete(doc);
    setShowConfirm(true);
  };

  const handleDelete = async () => {
    if (!docToDelete || isDeleting) {
      return;
    }

    setIsDeleting(true);

    try {
      await deleteDocument(docToDelete.id);
      showSuccess(`"${docToDelete.name}" has been deleted.`);
      setShowConfirm(false);
      setDocToDelete(null);
    } catch (err) {
      showError(`Failed to delete document '${docToDelete.name}'.`);
      setShowConfirm(false);
      setDocToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Memoize modal hide handler to prevent unnecessary re-renders
  const handleGitHubModalHide = useCallback(() => setShowGitHubModal(false), []);

  return (
    <>
      <Modal
        show={show && !showConfirm}
        onHide={handleHide}
        centered
        size="xl"
        dialogClassName="open-file-modal-scroll"
        style={{ '--bs-modal-width': '90vw' }}
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-folder2-open me-2"></i>
            Open Document
            <button
              className="btn btn-outline-primary btn-sm ms-3"
              onClick={() => setShowGitHubModal(true)}
              title="Manage GitHub repositories"
            >
              <i className="bi bi-github me-1"></i>
              GitHub Management
            </button>
          </Modal.Title>
        </Modal.Header>

                <Modal.Body style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0
        }}>
          <div className="file-open-modal-container">
            {console.log('🔍 FileOpenModal - selectedRepository:', selectedRepository)}
            {/* UNIFIED FILE BROWSER - Local documents including synced GitHub repos */}
            <UnifiedFileBrowserTab
              // Local document props
              documents={documents}
              categories={categories}
              onFileOpen={handleFileOpen}
              onDocumentDelete={handleDocumentDelete}
              onModalHide={handleHide}
              // Pass selected repository for navigation
              selectedRepository={selectedRepository}
            />
          </div>
        </Modal.Body>

        {/* <Modal.Footer>
          <Button variant="secondary" onClick={handleHide}>
            Cancel
          </Button>
        </Modal.Footer> */}
      </Modal>

      <ConfirmModal
        show={showConfirm}
        title="Delete Document"
        message={`Are you sure you want to delete '${docToDelete?.name}'? This cannot be undone.`}
        icon={<i className="bi bi-trash text-danger me-2"></i>}
        buttons={[
          {
            variant: "secondary",
            text: "Cancel",
            onClick: () => {
              setShowConfirm(false);
              setDocToDelete(null);
            }
          },
          {
            variant: "danger",
            text: isDeleting ? "Deleting..." : "Delete",
            onClick: handleDelete,
            disabled: isDeleting
          }
        ]}
      />

      <GitHubModal
        show={showGitHubModal}
        onHide={handleGitHubModalHide}
      />
    </>
  );
}
