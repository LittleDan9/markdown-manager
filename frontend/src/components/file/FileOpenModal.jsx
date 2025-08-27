import React, { useState, useEffect } from "react";
import { Modal, Button, Form, Tabs, Tab } from "react-bootstrap";
import ConfirmModal from "@/components/modals/ConfirmModal";
import { useNotification } from "@/components/NotificationProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useFileModal } from "@/hooks/ui";
import GitHubFileBrowser from "./GitHubFileBrowser";
import GitHubAccountList from "../shared/GitHubAccountList";

export default function FileOpenModal({ show, onHide, categories, documents, onOpen, setContent, deleteDocument }) {
  // Always ensure 'General' is present
  const safeCategories = categories?.includes("General") ? categories : ["General", ...(categories?.filter(c => c !== "General") || [])];
  const [selectedCategory, setSelectedCategory] = useState(safeCategories[0] || "General");
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showGitHubBrowser, setShowGitHubBrowser] = useState(false);
  const { showSuccess, showError } = useNotification();
  const { isAuthenticated } = useAuth();
  const { activeTab, selectedRepository, closeFileModal } = useFileModal();

  // Sync the activeTab from the global state
  const [localActiveTab, setLocalActiveTab] = useState(activeTab || "local");
  const [autoOpenRepository, setAutoOpenRepository] = useState(selectedRepository);

  useEffect(() => {
    if (activeTab) {
      setLocalActiveTab(activeTab);
    }
    if (selectedRepository) {
      setAutoOpenRepository(selectedRepository);
      setShowGitHubBrowser(true); // Automatically open the browser with the selected repo
    }
  }, [activeTab, selectedRepository]);

  // Override onHide to also close the global modal state
  const handleHide = () => {
    closeFileModal();
    onHide();
  };

  // Filter documents by selected category
  const filteredDocs = documents?.filter(
    (doc) => doc.category === selectedCategory
  ) || [];

  // Helper to get last saved date
  function getLastSaved(doc) {
    return doc.updated_at || doc.created_at || null;
  }

  const handleGitHubImport = (importedDocument) => {
    setShowGitHubBrowser(false);
    onOpen(importedDocument);
    if (setContent) setContent(importedDocument.content);
    handleHide();
  };

  const handleDelete = async () => {
    if (!docToDelete || isDeleting) {
      return;
    }

    setIsDeleting(true);

    try {
      await deleteDocument(docToDelete.id);
      setShowConfirm(false);
      setDocToDelete(null);
      setSelectedDocId(null);
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
      <Modal show={show && !showConfirm && !showGitHubBrowser} onHide={handleHide} centered dialogClassName="open-file-modal-scroll">
        <Modal.Header closeButton>
          <Modal.Title>Open Document</Modal.Title>
        </Modal.Header>
        <Modal.Body>
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
              <Form.Group className="mb-3">
                <Form.Label>Category</Form.Label>
                <Form.Select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setSelectedDocId(null);
                  }}
                >
                  {safeCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              <div className="list-group" style={{ maxHeight: "50vh", overflowY: "auto" }}>
                {filteredDocs.length === 0 && (
                  <div className="text-muted">No documents in this category.</div>
                )}
                {filteredDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="list-group-item d-flex align-items-center justify-content-between mb-2 border rounded shadow-sm"
                    style={{ padding: "1rem" }}
                  >
                    <div className="flex-grow-1">
                      <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>{doc.name}</div>
                      <div className="text-muted" style={{ fontSize: "0.9rem" }}>
                        Last saved: {getLastSaved(doc) ? new Date(getLastSaved(doc)).toLocaleString() : "Unknown"}
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2 ms-3">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedCategory(doc.category); // Sync category to opened doc
                          onOpen(doc);
                          if (setContent) setContent(doc.content);
                        }}
                      >
                        <i className="bi bi-folder2-open me-1"></i>Open
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setDocToDelete(doc);
                          setShowConfirm(true);
                        }}
                      >
                        <i className="bi bi-trash me-1"></i>Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Tab>

            {isAuthenticated && (
              <Tab eventKey="github" title={
                <span>
                  <i className="bi bi-github me-2"></i>
                  GitHub
                </span>
              }>
                <GitHubAccountList
                  onBrowseRepository={(repo) => {
                    setAutoOpenRepository(repo);
                    setShowGitHubBrowser(true);
                  }}
                  compact={true}
                />
              </Tab>
            )}
          </Tabs>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleHide}>
            Cancel
          </Button>
          {localActiveTab === "local" && (
            <Button
              variant="primary"
              onClick={() => {
                const doc = documents?.find((d) => d.id === selectedDocId);
                if (doc) {
                  onOpen(doc);
                  if (setContent) setContent(doc.content);
                }
              }}
              disabled={!selectedDocId}
            >
              Open
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      {/* GitHub File Browser Modal */}
      <GitHubFileBrowser
        show={showGitHubBrowser}
        onHide={() => {
          setShowGitHubBrowser(false);
          setAutoOpenRepository(null); // Clear the auto-open repository
        }}
        onFileImported={handleGitHubImport}
        initialRepository={autoOpenRepository}
      />

      <ConfirmModal
        show={showConfirm}
        title="Delete Document"
        message={`Are you sure you want to delete '${docToDelete?.name}'? This cannot be undone.`}
        icon={<i className="bi bi-trash text-danger me-2"></i>}
        buttons={[
          { text: "Delete", variant: "danger", action: "delete", autoFocus: true, disabled: isDeleting },
          { text: "Cancel", variant: "secondary", action: "cancel", disabled: isDeleting },
        ]}
        onAction={async (actionKey) => {
          if (actionKey === "delete") {
            await handleDelete();
          } else if (actionKey === "cancel") {
            setShowConfirm(false);
            setDocToDelete(null);
          }
        }}
        onHide={() => {
          if (!isDeleting) {
            setShowConfirm(false);
            setDocToDelete(null);
          }
        }}
      />
    </>
  );
}
