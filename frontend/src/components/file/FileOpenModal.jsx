import React, { useState, useEffect } from "react";
import { Modal, Button, Tabs, Tab } from "react-bootstrap";
import ConfirmModal from "@/components/shared/modals/ConfirmModal";
import { useNotification } from "@/components/NotificationProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useDocumentContext } from "@/providers/DocumentContextProvider.jsx";
import { useFileModal } from "@/hooks/ui";
// Import the new tab components
import LocalDocumentsTab from "./tabs/LocalDocumentsTab";
import GitHubTab from "./tabs/GitHubTab";

export default function FileOpenModal({ show, onHide, onOpen, setContent, deleteDocument }) {
  const { documents, categories } = useDocumentContext();
  const [showConfirm, setShowConfirm] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { showSuccess, showError } = useNotification();
  const { isAuthenticated } = useAuth();
  const { activeTab, selectedRepository, closeFileModal } = useFileModal();

  // Sync the activeTab from the global state
  const [localActiveTab, setLocalActiveTab] = useState(activeTab || "local");

  useEffect(() => {
    if (activeTab) {
      setLocalActiveTab(activeTab);
    }
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
          </Modal.Title>
        </Modal.Header>

        <Modal.Body style={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          flex: 1,
          minHeight: 0
        }}>
          <Tabs
            activeKey={localActiveTab}
            onSelect={(k) => setLocalActiveTab(k)}
            className="mb-3"
            id="open-document-tabs"
          >
            <Tab eventKey="local" title={
              <span>
                <i className="bi bi-folder me-2"></i>
                My Documents
              </span>
            }>
              <LocalDocumentsTab
                documents={documents}
                categories={categories}
                onFileOpen={handleFileOpen}
                onDocumentDelete={handleDocumentDelete}
                onModalHide={handleHide}
              />
            </Tab>

            {isAuthenticated && (
              <Tab eventKey="github" title={
                <span>
                  <i className="bi bi-github me-2"></i>
                  GitHub
                </span>
              }>
                <GitHubTab
                  isAuthenticated={isAuthenticated}
                  documents={documents}
                  onFileOpen={handleFileOpen}
                  onModalHide={handleHide}
                  selectedRepository={selectedRepository}
                />
              </Tab>
            )}
          </Tabs>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={handleHide}>
            Cancel
          </Button>
        </Modal.Footer>
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
    </>
  );
}
