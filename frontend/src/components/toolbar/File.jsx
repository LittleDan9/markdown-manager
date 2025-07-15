import React, { useEffect, useState, useRef } from "react";
import { Dropdown, ButtonGroup } from "react-bootstrap";
import ConfirmModal from "../modals/ConfirmModal";
import OpenFileModal from "../modals/OpenFileModal";
import { useDocument } from "../../context/DocumentProvider";
import { useConfirmModal } from "../../hooks/useConfirmModal";
import { useNotification } from "../NotificationProvider";

function FileDropdown({ setDocumentTitle, autosaveEnabled, setAutosaveEnabled, setContent, editorValue }) {
  const { show, modalConfig, openModal, handleConfirm, handleCancel } = useConfirmModal();
  const { createDocument, saveDocument, currentDocument, documents, exportAsMarkdown, exportAsPDF, categories, loadDocument, importMarkdownFile, deleteDocument } = useDocument();
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [pendingOpenId, setPendingOpenId] = useState(null);
  const { showSuccess, showError, showWarning } = useNotification();

  const fileInputRef = useRef();

  const handleNew = () => {
    // If you want to check for unsaved changes, add logic here using currentDocument/content
    openModal(
      async () => {
        createDocument();
        setDocumentTitle("Untitled Document");
      },
      {
        title: "Unsaved Changes",
        message: "You have unsaved changes. Do you want to continue without saving?",
        confirmText: "Continue Without Saving",
        cancelText: "Cancel",
        confirmVariant: "danger",
        cancelVariant: "secondary",
        icon: <i className="bi bi-exclamation-triangle-fill text-warning me-2"></i>,
      },
    );
  };

  const handleOpen = () => {
    setShowOpenModal(true);
  };

  const handleOpenFile = (doc) => {
    saveDocument(currentDocument);
    setPendingOpenId(doc.id);
    loadDocument(doc.id);
    setDocumentTitle(doc.name);
    if (setContent) setContent(doc.content);
    showSuccess(`Opened document: ${doc.name}`);
    setShowOpenModal(false);
  };

  useEffect(() => {
    if (pendingOpenId && currentDocument && currentDocument.id === pendingOpenId) {
      if (setContent) setContent(currentDocument.content);
      setPendingOpenId(null);
    }
  }, [pendingOpenId, currentDocument, setContent]);

  // Save using the latest editor value
  const handleSave = () => {
    if (!currentDocument) return;
    // Save a copy of currentDocument with updated content
    saveDocument({ ...currentDocument, content: editorValue });
    setDocumentTitle(currentDocument.name);
  };

  const handleImport = () => {
    // Trigger file input dialog for .md files only
    if (fileInputRef.current) fileInputRef.current.value = "";
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith(".md")) {
      showError("Only .md files are supported.");
      return;
    }
    try {
      // Save current document before importing new one
      saveDocument(currentDocument);
      const { content, name } = await importMarkdownFile(file);
      // Basic markdown validation: check for at least one heading, list, or code block
      if (!/^#|^\*|^\-|^\d+\.|```|\n#|\n\*|\n\-|\n\d+\.|\n```/m.test(content)) {
        alert("File does not appear to be valid Markdown.");
        return;
      }
      createDocument(name);
      setDocumentTitle(name);
      if (setContent) setContent(content);
    } catch (err) {
      console.error(err);
      showError("Failed to import Markdown file.");
    }
  };

  const handleExportMarkdown = () => {
    exportAsMarkdown(currentDocument.content, currentDocument.name);
    console.log("Exported as Markdown");
  };

  const handleExportPDF = () => {
    exportAsPDF(currentDocument.content, currentDocument.name);
    console.log("Exported as PDF");
  };

  return (
    <>
      {/* File Dropdown */}
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
          <Dropdown.Item onClick={handleOpen}>
            <i className="bi bi-folder2-open me-2"></i>Open
          </Dropdown.Item>
          <Dropdown.Divider />
          <Dropdown.Item onClick={handleSave}>
            <i className="bi bi-save me-2"></i>Save
          </Dropdown.Item>
          <Dropdown.Divider />
          <Dropdown.Item onClick={handleImport}>
            <i className="bi bi-file-earmark-arrow-up me-2"></i>Import
          </Dropdown.Item>
          <Dropdown.Divider />
          <Dropdown.Item onClick={handleExportMarkdown}>
            <i className="bi bi-filetype-md me-2"></i>Export Markdown
          </Dropdown.Item>
          <Dropdown.Item onClick={handleExportPDF}>
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
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      <OpenFileModal
        show={showOpenModal}
        onHide={() => setShowOpenModal(false)}
        categories={categories}
        documents={documents}
        onOpen={handleOpenFile}
        setContent={typeof setContent === "function" ? setContent : undefined}
        deleteDocument={deleteDocument}
      />
      <ConfirmModal
        show={show}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        {...modalConfig}
      />
    </>
  );
}

export default FileDropdown;

/*
Usage in parent component:
const [editorValue, setEditorValue] = useState("");
const [autosaveEnabled, setAutosaveEnabled] = useState(true);
<FileDropdown
  autosaveEnabled={autosaveEnabled}
  setAutosaveEnabled={setAutosaveEnabled}
  setContent={setEditorValue}
  editorValue={editorValue}
  ...otherProps
/>
<Editor
  value={editorValue}
  onChange={setEditorValue}
  autosaveEnabled={autosaveEnabled}
  ...otherProps
/>
*/
