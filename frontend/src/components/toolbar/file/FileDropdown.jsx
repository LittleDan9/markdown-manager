import React from "react";
import { Dropdown, ButtonGroup } from "react-bootstrap";
import FileOpenModal from "./FileOpenModal";
import FileImportModal from "./FileImportModal";
import FileSaveAsModal from "./FileSaveAsModal";
import FileOverwriteModal from "./FileOverwriteModal";
import ConfirmModal from "../../modals/ConfirmModal";
import { useDocument } from "../../../context/DocumentProvider";
import { useConfirmModal } from "../../../hooks/useConfirmModal.jsx";
import { useNotification } from "../../NotificationProvider";
import { useFileImportController } from "./useFileImportController";
import { useFileSaveAsController } from "./useFileSaveAsController";
import { useFileOverwriteController } from "./useFileOverwriteController";
import { useFileOpenController } from "./useFileOpenController";
import { useFileSaveController } from "./useFileSaveController";
import { useFileExportController } from "./useFileExportController";
import { useTheme } from "../../../context/ThemeContext.jsx";
import { usePreviewHTML } from "../../../context/PreviewHTMLContext";

export default function FileDropdown({ setDocumentTitle, autosaveEnabled, setAutosaveEnabled, syncPreviewScrollEnabled, setSyncPreviewScrollEnabled }) {
  const { theme } = useTheme();
  const { show, modalConfig, openModal, handleAction } = useConfirmModal();
  const { createDocument, saveDocument, currentDocument, documents, exportAsMarkdown, exportAsPDF, categories, loadDocument, deleteDocument, isDefaultDoc, hasUnsavedChanges } = useDocument();
  const { showSuccess, showError } = useNotification();
  const { previewHTML } = usePreviewHTML();

  // Import modal controller
  const importController = useFileImportController({ setDocumentTitle });

  // Import logic with unsaved changes handling
  const handleImportWithUnsavedCheck = async () => {
    if (isDefaultDoc && hasUnsavedChanges) {
      saveAsController.openSaveAs(currentDocument.content, currentDocument.name);
      return;
    }
    if (!isDefaultDoc && !autosaveEnabled && hasUnsavedChanges) {
      try {
        openModal(
          async (actionKey) => {
            if (actionKey === "save") {
              await saveDocument({ ...currentDocument, content: currentDocument.content });
              showSuccess(`Previous document "${currentDocument.name}" saved.`);
            }
            if (actionKey === "save" || actionKey === "confirm") {
              importController.handleImport();
            }
          },
          {
            title: "Unsaved Changes",
            message: "You have unsaved changes. What would you like to do before importing?",
            buttons: [
              { icon: "bi bi-save", text: "Save", variant: "primary", action: "save", autoFocus: true },
              { icon: "bi bi-trash", text: "Discard", variant: "danger", action: "confirm" },
              { icon: "bi bi-arrow-return-right", text: "Cancel", variant: "secondary", action: "cancel" },
            ],
            icon: <i className="bi bi-exclamation-triangle-fill text-warning me-2"></i>,
          },
        );
      } catch (error) {
        // Removed debug statement
      }
      return;
    }
    if (!isDefaultDoc && autosaveEnabled && hasUnsavedChanges) {
      await saveDocument({ ...currentDocument, content: currentDocument.content });
      showSuccess(`Previous document "${currentDocument.name}" saved.`);
      importController.handleImport();
      return;
    }
    importController.handleImport();
  };
  // Save As modal controller
  const saveAsController = useFileSaveAsController({ setDocumentTitle });
  // Overwrite modal controller
  const overwriteController = useFileOverwriteController({ importController });
  // Open modal controller
  const openController = useFileOpenController({
    saveDocument,
    currentDocument,
    loadDocument,
    setDocumentTitle,
    showSuccess,
  });
  // Save controller
  const saveController = useFileSaveController({ saveDocument, currentDocument, setDocumentTitle });
  // Export controller
  const exportController = useFileExportController({ exportAsMarkdown, exportAsPDF, currentDocument, previewHTML, theme });
  // Log before export actions
  const handleExportPDF = () => {
    exportController.handleExportPDF();
  };

  const handleNew = async () => {
    if (isDefaultDoc && hasUnsavedChanges) {
      saveAsController.openSaveAs(currentDocument.content, currentDocument.name);
      return;
    }
    if (!isDefaultDoc) {
      if (autosaveEnabled && hasUnsavedChanges) {
        await saveDocument({ ...currentDocument, content: currentDocument.content });
        showSuccess(`Previous document "${currentDocument.name}" saved.`);
        createDocument();
        setDocumentTitle("Untitled Document");
        return;
      } else if (!autosaveEnabled && hasUnsavedChanges) {
        openModal(
          async (actionKey) => {
            if (actionKey === "save") {
              await saveDocument({ ...currentDocument, content: currentDocument.content });
              showSuccess(`Previous document "${currentDocument.name}" saved.`);
            }
            if (actionKey === "save" || actionKey === "confirm") {
              createDocument();
              setDocumentTitle("Untitled Document");
            }
          },
          {
            title: "Unsaved Changes",
            message: "You have unsaved changes. What would you like to do?",
            buttons: [
              { text: "Save", variant: "primary", action: "save", autoFocus: true },
              { text: "Continue Without Saving", variant: "danger", action: "confirm" },
              { text: "Cancel", variant: "secondary", action: "cancel" },
            ],
            icon: <i className="bi bi-exclamation-triangle-fill text-warning me-2"></i>,
          },
        );
        return;
      }
    }
    createDocument();
    setDocumentTitle("Untitled Document");
    showSuccess("Previous document did not need saving. New document created.");
  };

  // Accept setCurrentCategory as a prop
  return (
    <>
      <Dropdown as={ButtonGroup}>
        <Dropdown.Toggle
          id="fileMenuDropdown"
          size="sm"
          variant="secondary"
          className="dropdownToggle position-relative"
        >
          <i className="bi bi-folder me-1"></i>File
          {hasUnsavedChanges && (
            <span
              style={{
                position: "absolute",
                top: 6,
                right: 8,
                width: 10,
                height: 10,
                background: "#dc3545",
                borderRadius: "50%",
                display: "inline-block",
                border: "2px solid white",
                zIndex: 2,
              }}
              title="You have unsaved changes"
            />
          )}
        </Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Item onClick={handleNew}>
            <i className="bi bi-file-plus me-2"></i>New
          </Dropdown.Item>
          <Dropdown.Item onClick={openController.openOpenModal}>
            <i className="bi bi-folder2-open me-2"></i>Open
          </Dropdown.Item>
          <Dropdown.Divider />
          <Dropdown.Item onClick={saveController.handleSave}>
            <i className="bi bi-save me-2"></i>Save
          </Dropdown.Item>
          <Dropdown.Divider />
          <Dropdown.Item onClick={handleImportWithUnsavedCheck}>
            <i className="bi bi-file-earmark-arrow-up me-2"></i>Import
          </Dropdown.Item>
          <Dropdown.Divider />
          <Dropdown.Item onClick={exportController.handleExportMarkdown}>
            <i className="bi bi-filetype-md me-2"></i>Export Markdown
          </Dropdown.Item>
          <Dropdown.Item
            onClick={handleExportPDF}
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
        ref={importController.fileInputRef}
        onChange={importController.handleFileChange}
      />
      <FileOpenModal
        show={openController.showOpenModal}
        onHide={() => openController.setShowOpenModal(false)}
        categories={categories}
        documents={documents}
        onOpen={(doc) => {
          if (doc && typeof setCurrentCategory === "function") {
            setCurrentCategory(doc.category);
          }
          openController.handleOpenFile(doc);
        }}
        // setContent prop removed
        deleteDocument={deleteDocument}
      />
      <FileSaveAsModal
        show={saveAsController.showSaveAsModal}
        onHide={() => {
          saveAsController.setShowSaveAsModal(false);
          saveAsController.setImportedFileData(null);
        }}
        defaultName={saveAsController.importedFileData ? saveAsController.importedFileData.name : ""}
        onConfirm={saveAsController.handleSaveAsConfirm}
        icon={<i className="bi bi-exclamation-triangle-fill text-warning me-2"></i>}
      />
      <FileImportModal
        show={importController.showImportModal}
        onHide={() => {
          importController.setShowImportModal(false);
          importController.setImportedFileData(null);
        }}
        defaultName={importController.importedFileData ? importController.importedFileData.name : ""}
        onConfirm={importController.handleImportConfirm}
        icon={<i className="bi bi-file-earmark-arrow-up text-primary me-2"></i>}
      />
      <FileOverwriteModal
        show={overwriteController.showOverwriteModal}
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
            await overwriteController.handleOverwriteConfirm();
          } else if (actionKey === "cancel") {
            overwriteController.handleOverwriteCancel();
          }
        }}
        onHide={() => {
          overwriteController.setShowOverwriteModal(false);
          overwriteController.setPendingImport(null);
          if (importController.importedFileData) {
            importController.setShowImportModal(true);
          }
        }}
      />
      {/* ConfirmModal for generic confirm flows */}
      {/* ConfirmModal for unsaved changes and other confirmations */}
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
    </>
  );
}
