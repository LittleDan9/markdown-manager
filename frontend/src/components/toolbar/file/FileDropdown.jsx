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

export default function FileDropdown({ setDocumentTitle, autosaveEnabled, setAutosaveEnabled, setContent, editorValue, renderedHTML }) {
  const { theme } = useTheme();
  const { show, modalConfig, openModal, handleAction } = useConfirmModal();
  const { createDocument, saveDocument, currentDocument, documents, exportAsMarkdown, exportAsPDF, categories, loadDocument, deleteDocument, isDefaultDoc } = useDocument();
  const { showSuccess, showError } = useNotification();

  // Import modal controller
  const importController = useFileImportController({ setDocumentTitle, setContent });

  // Import logic with unsaved changes handling
  const handleImportWithUnsavedCheck = async () => {
    let hasUnsavedChanges = false;
    if (isDefaultDoc) {
      hasUnsavedChanges =
        currentDocument && (
          currentDocument.name !== "Untitled Document" ||
          editorValue !== "" ||
          currentDocument.category !== "General"
        );
    } else if (currentDocument && currentDocument.id) {
      const savedDoc = documents.find(doc => doc.id === currentDocument.id);
      if (savedDoc) {
        hasUnsavedChanges =
          currentDocument.name !== savedDoc.name ||
          editorValue !== savedDoc.content ||
          currentDocument.category !== savedDoc.category;
      } else {
        hasUnsavedChanges = true;
      }
    }
    if (isDefaultDoc && hasUnsavedChanges) {
      saveAsController.openSaveAs(editorValue, currentDocument.name);
      return;
    }
    if (!isDefaultDoc && !autosaveEnabled && hasUnsavedChanges) {
      try{
      openModal(
        async (actionKey) => {
          if (actionKey === "save") {
            await saveDocument({ ...currentDocument, content: editorValue });
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
    }catch (error) {
      console.error("Error handling import with unsaved check:", error);
    }
      return;
    }
    if (!isDefaultDoc && autosaveEnabled && hasUnsavedChanges) {
      await saveDocument({ ...currentDocument, content: editorValue });
      showSuccess(`Previous document "${currentDocument.name}" saved.`);
      importController.handleImport();
      return;
    }
    importController.handleImport();
  };
  // Save As modal controller
  const saveAsController = useFileSaveAsController({ setDocumentTitle, setContent });
  // Overwrite modal controller
  const overwriteController = useFileOverwriteController({ importController });
  // Open modal controller
  const openController = useFileOpenController({
    saveDocument,
    currentDocument,
    loadDocument,
    setDocumentTitle,
    setContent,
    showSuccess,
  });
  // Save controller
  const saveController = useFileSaveController({ saveDocument, currentDocument, editorValue, setDocumentTitle });
  // Export controller
  const exportController = useFileExportController({ exportAsMarkdown, exportAsPDF, currentDocument, renderedHTML, theme });
  // Log before export actions
  const handleExportPDF = () => {
    exportController.handleExportPDF();
  };

  const handleNew = async () => {
    let hasUnsavedChanges = false;
    if (isDefaultDoc) {
      hasUnsavedChanges =
        currentDocument && (
          currentDocument.name !== "Untitled Document" ||
          editorValue !== "" ||
          currentDocument.category !== "General"
        );
      console.log("hasUnsavedChanges (default):", hasUnsavedChanges);
    } else if (currentDocument && currentDocument.id) {
      const savedDoc = documents.find(doc => doc.id === currentDocument.id);
      if (savedDoc) {
        hasUnsavedChanges =
          currentDocument.name !== savedDoc.name ||
          editorValue !== savedDoc.content ||
          currentDocument.category !== savedDoc.category;
      } else {
        hasUnsavedChanges = true;
      }
      console.log("hasUnsavedChanges (existing):", hasUnsavedChanges);
    }
    if (isDefaultDoc && hasUnsavedChanges) {
      console.log("Triggering SaveAs modal");
      saveAsController.openSaveAs(editorValue, currentDocument.name);
      return;
    }
    if (!isDefaultDoc) {
      if (autosaveEnabled && hasUnsavedChanges) {
        console.log("Autosave enabled, saving and creating new doc");
        await saveDocument({ ...currentDocument, content: editorValue });
        showSuccess(`Previous document "${currentDocument.name}" saved.`);
        createDocument();
        setDocumentTitle("Untitled Document");
        return;
      } else if (!autosaveEnabled && hasUnsavedChanges) {
        console.log("Unsaved changes, showing confirm modal");
        openModal(
          async (actionKey) => {
            if (actionKey === "save") {
              await saveDocument({ ...currentDocument, content: editorValue });
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
    console.log("No unsaved changes, creating new doc");
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
          className="dropdownToggle"
        >
          <i className="bi bi-folder me-1"></i>File
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
            disabled={!renderedHTML || renderedHTML === ""}
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
        setContent={typeof setContent === "function" ? setContent : undefined}
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
