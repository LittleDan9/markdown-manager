import React, { useEffect } from "react";
import { Dropdown, ButtonGroup } from "react-bootstrap";
import FileOpenModal from "@/components/file/FileOpenModal";
import FileImportModal from "@/components/file/FileImportModal";
import FileSaveAsModal from "@/components/file/FileSaveAsModal";
import FileOverwriteModal from "@/components/file/FileOverwriteModal";
import ConfirmModal from "@/components/modals/ConfirmModal";
import ShareModal from "@/components/modals/ShareModal";
import { useDocumentContext } from "@/providers/DocumentContextProvider.jsx";
import { useConfirmModal } from "@/hooks/useConfirmModal.jsx";
import { useNotification } from "@/components/NotificationProvider";
import { useFileOperations } from "@/hooks/useFileOperations";
import { useTheme } from "@/providers/ThemeProvider.jsx";
import { useAuth } from "@/providers/AuthProvider";
import { DocumentService } from "@/services/core";

function FileDropdown({ setDocumentTitle }) {
  const { autosaveEnabled, setAutosaveEnabled, syncPreviewScrollEnabled, setSyncPreviewScrollEnabled, isAuthenticated } = useAuth();
  const { theme } = useTheme();
  const { show, modalConfig, openModal, handleAction } = useConfirmModal();
  const { createDocument, saveDocument, currentDocument, documents, exportAsMarkdown, exportAsPDF, categories, loadDocument, deleteDocument, isDefaultDoc, hasUnsavedChanges, content, previewHTML } = useDocumentContext();
  const { showSuccess, showError } = useNotification();
  // Share modal state
  const [showShareModal, setShowShareModal] = React.useState(false);
  useEffect(() => {}, [previewHTML]);
  const fileOps = useFileOperations({ setDocumentTitle, setContent: undefined, renderedHTML: previewHTML, theme });
  const handleNew = () => { if (typeof fileOps.openSaveAs === 'function') { fileOps.openSaveAs('', 'Untitled Document'); } };
  const handleClose = () => { window.location.reload(); };
  const handleDelete = () => { if (window.confirm('Are you sure you want to delete this document?')) { deleteDocument(currentDocument?.id); } };
  const handleShare = () => setShowShareModal(true);
  const handleImportWithUnsavedCheck = () => { if (typeof fileOps.handleImport === 'function') { fileOps.handleImport(); } };
  const handleExportPDF = () => { if (typeof fileOps.handleExportPDF === 'function') { fileOps.handleExportPDF(); } };
  const handleEnableSharing = () => {};
  const handleDisableSharing = () => {};
  const openController = fileOps;
  const saveAsController = fileOps;
  const importController = fileOps;
  const overwriteController = fileOps;
  const exportController = fileOps;
  return (
    <>
      <Dropdown as={ButtonGroup}>
        <Dropdown.Toggle id="fileMenuDropdown" size="sm" variant="secondary" className="dropdownToggle position-relative">
          <i className="bi bi-folder me-1"></i>File
        </Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Item onClick={handleNew}><i className="bi bi-file-plus me-2"></i>New</Dropdown.Item>
          <Dropdown.Item onClick={openController.openOpenModal}><i className="bi bi-folder2-open me-2"></i>Open</Dropdown.Item>
          <Dropdown.Item onClick={handleClose} disabled={isDefaultDoc && !hasUnsavedChanges}><i className="bi bi-x-circle me-2"></i>Close</Dropdown.Item>
          <Dropdown.Divider />
          <Dropdown.Item onClick={saveAsController.handleSaveAsConfirm}><i className="bi bi-save me-2"></i>Save</Dropdown.Item>
          <Dropdown.Item onClick={handleDelete} disabled={isDefaultDoc}><i className="bi bi-trash me-2"></i>Delete</Dropdown.Item>
          {isAuthenticated && (<Dropdown.Item onClick={handleShare} disabled={isDefaultDoc}><i className="bi bi-share me-2"></i>Share</Dropdown.Item>)}
          <Dropdown.Divider />
          <Dropdown.Item onClick={handleImportWithUnsavedCheck}><i className="bi bi-file-earmark-arrow-up me-2"></i>Import</Dropdown.Item>
          <Dropdown.Divider />
          <Dropdown.Item onClick={exportController.handleExportMarkdown}><i className="bi bi-filetype-md me-2"></i>Export Markdown</Dropdown.Item>
          <Dropdown.Item onClick={handleExportPDF} disabled={!previewHTML || previewHTML === ""}><i className="bi bi-filetype-pdf me-2"></i>Export PDF</Dropdown.Item>
          <Dropdown.Divider />
          <Dropdown.Item onClick={() => setAutosaveEnabled((prev) => !prev)} aria-checked={autosaveEnabled} role="menuitemcheckbox">
            {autosaveEnabled ? (<i className="bi bi-toggle-on text-success me-2"></i>) : (<i className="bi bi-toggle-off text-secondary me-2"></i>)}
            Autosave {autosaveEnabled ? "On" : "Off"}
          </Dropdown.Item>
          <Dropdown.Item onClick={() => setSyncPreviewScrollEnabled((prev) => !prev)} aria-checked={syncPreviewScrollEnabled} role="menuitemcheckbox">
            {syncPreviewScrollEnabled ? (<i className="bi bi-toggle-on text-success me-2"></i>) : (<i className="bi bi-toggle-off text-secondary me-2"></i>)}
            Sync Preview Scroll {syncPreviewScrollEnabled ? "On" : "Off"}
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
      <input type="file" accept=".md" style={{ display: "none" }} ref={importController.fileInputRef} onChange={importController.handleFileChange} />
      <FileOpenModal show={openController.showOpenModal} onHide={() => openController.setShowOpenModal(false)} categories={categories} documents={documents} onOpen={(doc) => { if (doc && typeof setCurrentCategory === "function") { setCurrentCategory(doc.category); } openController.handleOpenFile(doc); }} deleteDocument={deleteDocument} />
      <FileSaveAsModal show={saveAsController.showSaveAsModal} onHide={() => { saveAsController.setShowSaveAsModal(false); saveAsController.setImportedFileData(null); }} defaultName={saveAsController.importedFileData ? saveAsController.importedFileData.name : ""} onConfirm={saveAsController.handleSaveAsConfirm} icon={<i className="bi bi-exclamation-triangle-fill text-warning me-2"></i>} />
      <FileImportModal show={importController.showImportModal} onHide={() => { importController.setShowImportModal(false); importController.setImportedFileData(null); }} defaultName={importController.importedFileData ? importController.importedFileData.name : ""} onConfirm={importController.handleImportConfirm} icon={<i className="bi bi-file-earmark-arrow-up text-primary me-2"></i>} />
      <FileOverwriteModal show={overwriteController.showOverwriteModal} title="Document Exists" message={<><div className="mb-2">A document with this name and category already exists.</div><div>Do you want to overwrite it?</div></>} icon={<i className="bi bi-exclamation-triangle-fill text-danger me-2"></i>} buttons={[{ key: "overwrite", action: "overwrite", text: "Overwrite", variant: "danger", autoFocus: true },{ key: "cancel", action: "cancel", text: "Cancel", variant: "secondary" }]} onAction={async (actionKey) => { if (actionKey === "overwrite") { await overwriteController.handleOverwriteConfirm(); } else if (actionKey === "cancel") { overwriteController.handleOverwriteCancel(); } }} onHide={() => { overwriteController.setShowOverwriteModal(false); overwriteController.setPendingImport(null); if (importController.importedFileData) { importController.setShowImportModal(true); } }} />
      {show && modalConfig && (<ConfirmModal show={show} title={modalConfig.title} message={modalConfig.message} icon={modalConfig.icon} buttons={modalConfig.buttons} onAction={handleAction} onHide={() => handleAction("cancel")} />)}
      <ShareModal show={showShareModal} onHide={() => setShowShareModal(false)} document={currentDocument} onShare={handleEnableSharing} onUnshare={handleDisableSharing} />
    </>
  );
}

export default FileDropdown;
