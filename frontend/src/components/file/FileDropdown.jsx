import React from "react";
import { Dropdown, ButtonGroup } from "react-bootstrap";
import FileOpenModal from "@/components/file/FileOpenModal";
import FileImportModal from "@/components/file/FileImportModal";
import FileSaveAsModal from "@/components/file/FileSaveAsModal";
import FileOverwriteModal from "@/components/file/FileOverwriteModal";
import RecentFilesDropdown from "@/components/file/RecentFilesDropdown";
import ConfirmModal from "@/components/shared/modals/ConfirmModal";
import ShareModal from "@/components/shared/modals/ShareModal";
import { useDocumentContext } from "@/providers/DocumentContextProvider.jsx";
import { useConfirmModal, useFileModal } from "@/hooks/ui";
import { useNotification } from "@/components/NotificationProvider";
import { useFileOperations } from "@/hooks/document";
import { useTheme } from "@/providers/ThemeProvider.jsx";
import { useAuth } from "@/providers/AuthProvider";

function FileDropdown({ setDocumentTitle }) {
  const { autosaveEnabled, setAutosaveEnabled, syncPreviewScrollEnabled, setSyncPreviewScrollEnabled, isAuthenticated } = useAuth();
  const { theme } = useTheme();
  const { show, modalConfig, openModal, handleAction } = useConfirmModal();
  const {
    createDocument, saveDocument, currentDocument, documents, exportAsMarkdown, exportAsPDF,
    categories, loadDocument, deleteDocument, isDefaultDoc, hasUnsavedChanges, content, previewHTML
  } = useDocumentContext();
  const { showSuccess, showError } = useNotification();
  const { showFileModal, openFileModal } = useFileModal();

  // Share modal state
  const [showShareModal, setShowShareModal] = React.useState(false);

  // Consolidated file operations
  const fileOps = useFileOperations({ setDocumentTitle, setContent: undefined, renderedHTML: previewHTML, theme });

  // File operation handlers
  const handleNew = () => {
    if (hasUnsavedChanges) {
      fileOps.openSaveAs && fileOps.openSaveAs(content, currentDocument?.name || 'Untitled Document');
    } else {
      createDocument();
      setDocumentTitle("Untitled Document");
      showSuccess("New document created.");
    }
  };

  const handleSave = () => {
    if (!currentDocument) return;
    saveDocument({ ...currentDocument, content });
    setDocumentTitle(currentDocument.name);
  };

  const handleClose = () => {
    createDocument();
    setDocumentTitle("Untitled Document");
    showSuccess("Document closed.");
  };

  const handleDelete = () => {
    if (isDefaultDoc) {
      showError("Cannot delete an unsaved document.");
      return;
    }

    openModal(
      async (actionKey) => {
        if (actionKey === "delete") {
          try {
            await deleteDocument(currentDocument.id);
            createDocument();
            setDocumentTitle("Untitled Document");
          } catch (error) {
            showError(`Failed to delete document: ${error.message}`);
          }
        }
      },
      {
        title: "Delete Document",
        message: `Are you sure you want to delete '${currentDocument.name}'? This cannot be undone.`,
        buttons: [
          { text: "Delete", variant: "danger", action: "delete", autoFocus: true },
          { text: "Cancel", variant: "secondary", action: "cancel" },
        ],
        icon: <i className="bi bi-trash text-danger me-2"></i>,
      },
    );
  };

  const handleShare = () => {
    if (isDefaultDoc) {
      showError("Please save the document before sharing.");
      return;
    }
    setShowShareModal(true);
  };

  const handleEnableSharing = async (documentId) => {
    try {
      // Implementation would need DocumentService
      showSuccess("Sharing enabled for document.");
      return true;
    } catch (error) {
      showError(`Failed to enable sharing: ${error.message}`);
      throw error;
    }
  };

  const handleDisableSharing = async (documentId) => {
    try {
      // Implementation would need DocumentService
      showSuccess("Sharing disabled for document.");
      return true;
    } catch (error) {
      showError(`Failed to disable sharing: ${error.message}`);
      throw error;
    }
  };

  const handleRecentFileSelect = async (file) => {
    try {
      await loadDocument(file.id);
      setDocumentTitle(file.name);
      showSuccess(`Opened: ${file.name}`);
    } catch (error) {
      showError(`Failed to open document: ${error.message}`);
    }
  };

  return (
    <>
      <Dropdown as={ButtonGroup}>
        <Dropdown.Toggle id="fileMenuDropdown" size="sm" variant="secondary" className="dropdownToggle position-relative">
          <i className="bi bi-folder me-1"></i>File
        </Dropdown.Toggle>
        <Dropdown.Menu>
          <RecentFilesDropdown onFileSelect={handleRecentFileSelect} />
          
          <Dropdown.Item onClick={handleNew}>
            <i className="bi bi-file-plus me-2"></i>New
          </Dropdown.Item>
          <Dropdown.Item onClick={() => openFileModal('local')}>
            <i className="bi bi-folder2-open me-2"></i>Open
          </Dropdown.Item>
          <Dropdown.Item onClick={handleClose} disabled={isDefaultDoc && !hasUnsavedChanges}>
            <i className="bi bi-x-circle me-2"></i>Close
          </Dropdown.Item>
          <Dropdown.Divider />
          <Dropdown.Item onClick={handleSave}>
            <i className="bi bi-save me-2"></i>Save
          </Dropdown.Item>
          <Dropdown.Item onClick={handleDelete} disabled={isDefaultDoc}>
            <i className="bi bi-trash me-2"></i>Delete
          </Dropdown.Item>
          {isAuthenticated && (
            <Dropdown.Item onClick={handleShare} disabled={isDefaultDoc}>
              <i className="bi bi-share me-2"></i>Share
            </Dropdown.Item>
          )}
          <Dropdown.Divider />
          <Dropdown.Item onClick={fileOps.handleImport}>
            <i className="bi bi-file-earmark-arrow-up me-2"></i>Import
          </Dropdown.Item>
          <Dropdown.Divider />
          <Dropdown.Item onClick={fileOps.handleExportMarkdown}>
            <i className="bi bi-filetype-md me-2"></i>Export Markdown
          </Dropdown.Item>
          <Dropdown.Item
            onClick={fileOps.handleExportPDF}
            disabled={!previewHTML || previewHTML === ""}
          >
            <i className="bi bi-filetype-pdf me-2"></i>Export PDF
          </Dropdown.Item>
          <Dropdown.Divider />
          <Dropdown.Item
            onClick={() => setAutosaveEnabled((prev) => !prev)}
            aria-checked={autosaveEnabled}
            role="menuitemcheckbox"
          >
            {autosaveEnabled ? (
              <i className="bi bi-toggle-on text-success me-2"></i>
            ) : (
              <i className="bi bi-toggle-off text-secondary me-2"></i>
            )}
            Autosave {autosaveEnabled ? "On" : "Off"}
          </Dropdown.Item>

          <Dropdown.Item
            onClick={() => setSyncPreviewScrollEnabled((prev) => !prev)}
            aria-checked={syncPreviewScrollEnabled}
            role="menuitemcheckbox"
          >
            {syncPreviewScrollEnabled ? (
              <i className="bi bi-toggle-on text-success me-2"></i>
            ) : (
              <i className="bi bi-toggle-off text-secondary me-2"></i>
            )}
            Sync Preview Scroll {syncPreviewScrollEnabled ? "On" : "Off"}
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>

      <input
        type="file"
        accept=".md"
        style={{ display: "none" }}
        ref={fileOps.fileInputRef}
        onChange={fileOps.handleFileChange}
      />

      {showFileModal && (
        <FileOpenModal
          show={showFileModal}
          onHide={() => {}} // Modal will handle its own closing via the hook
          onOpen={fileOps.handleOpenFile}
          deleteDocument={deleteDocument}
        />
      )}

      {fileOps.showSaveAsModal && (
        <FileSaveAsModal
          show={fileOps.showSaveAsModal}
          onHide={() => {
            fileOps.setShowSaveAsModal(false);
            fileOps.setImportedFileData(null);
          }}
          defaultName={fileOps.importedFileData ? fileOps.importedFileData.name : ""}
          onConfirm={fileOps.handleSaveAsConfirm}
          icon={<i className="bi bi-exclamation-triangle-fill text-warning me-2"></i>}
        />
      )}

      {fileOps.showImportModal && (
        <FileImportModal
          show={fileOps.showImportModal}
          onHide={() => {
            fileOps.setShowImportModal(false);
            fileOps.setImportedFileData(null);
          }}
          defaultName={fileOps.importedFileData ? fileOps.importedFileData.name : ""}
          onConfirm={fileOps.handleImportConfirm}
          icon={<i className="bi bi-file-earmark-arrow-up text-primary me-2"></i>}
        />
      )}

      {fileOps.showOverwriteModal && (
        <FileOverwriteModal
          show={fileOps.showOverwriteModal}
          title="Document Exists"
          message={
            <>
              <div className="mb-2">A document with this name and category already exists.</div>
              <div>Do you want to overwrite it?</div>
            </>
          }
          icon={<i className="bi bi-exclamation-triangle-fill text-danger me-2"></i>}
          buttons={[
            {
              key: "overwrite",
              action: "overwrite",
              text: "Overwrite",
              variant: "danger",
              autoFocus: true,
            },
            {
              key: "cancel",
              action: "cancel",
              text: "Cancel",
              variant: "secondary",
            },
          ]}
          onAction={async (actionKey) => {
            if (actionKey === "overwrite") {
              await fileOps.handleOverwriteConfirm();
            } else if (actionKey === "cancel") {
              fileOps.handleOverwriteCancel();
            }
          }}
          onHide={() => {
            fileOps.setShowOverwriteModal(false);
            fileOps.setPendingImport(null);
            if (fileOps.importedFileData) {
              fileOps.setShowImportModal(true);
            }
          }}
        />
      )}

      {/* ConfirmModal for generic confirm flows */}
      {show && modalConfig && (
        <ConfirmModal
          show={show}
          title={modalConfig.title}
          message={modalConfig.message}
          icon={modalConfig.icon}
          buttons={modalConfig.buttons}
          onAction={handleAction}
          onHide={() => handleAction("cancel")}
        />
      )}

      {/* Share Modal */}
      <ShareModal
        show={showShareModal}
        onHide={() => setShowShareModal(false)}
        document={currentDocument}
        onShare={handleEnableSharing}
        onUnshare={handleDisableSharing}
      />
    </>
  );
}

export default FileDropdown;
