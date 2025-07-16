import React, { useEffect, useState, useRef } from "react";
import { Dropdown, ButtonGroup, Form, Button } from "react-bootstrap";
import ConfirmModal from "../modals/ConfirmModal";
import ImportConfirmModal from "../modals/ImportConfirmModal";
import OpenFileModal from "../modals/OpenFileModal";
import { useDocument } from "../../context/DocumentProvider";
import { useConfirmModal } from "../../hooks/useConfirmModal";
import { useNotification } from "../NotificationProvider";

function FileDropdown({ setDocumentTitle, autosaveEnabled, setAutosaveEnabled, setContent, editorValue }) {
  const { show, modalConfig, openModal, handleConfirm, handleCancel } = useConfirmModal();
  const { createDocument, saveDocument, currentDocument, documents, exportAsMarkdown, exportAsPDF, categories, loadDocument, importMarkdownFile, deleteDocument } = useDocument();
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [pendingOpenId, setPendingOpenId] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedFileData, setImportedFileData] = useState(null);
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
      await saveDocument(currentDocument);
      const { content, name } = await importMarkdownFile(file);
      // Basic markdown validation: check for at least one heading, list, or code block
      if (!/^#|^\*|^\-|^\d+\.|```|\n#|\n\*|\n\-|\n\d+\.|\n```/m.test(content)) {
        alert("File does not appear to be valid Markdown.");
        return;
      }
      setImportedFileData({ content, name });
      setShowImportModal(true);
    } catch (err) {
      console.error(err);
      showError("Failed to import Markdown file.");
    }
  };
  // Handle confirm in import modal
  // State for overwrite confirm modal
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);

  const handleImportConfirm = async (selectedCategory, filename) => {
    if (!importedFileData) return;
    // Sanitize filename and category
    const safeName = (filename && filename !== "__category_placeholder__") ? filename : "Untitled Document";
    const safeCategory = (selectedCategory && selectedCategory !== "__category_placeholder__") ? selectedCategory : "General";
    const docToSave = {
      name: safeName,
      category: safeCategory,
      content: importedFileData.content,
    };
    try {
      const savedDoc = await saveDocument(docToSave);
      if (savedDoc && savedDoc.id) {
        await loadDocument(savedDoc.id);
        setDocumentTitle(savedDoc.name);
        if (setContent) setContent(savedDoc.content);
        showSuccess(`Imported document: ${savedDoc.name}`);
        setShowImportModal(false);
        setImportedFileData(null);
      } else {
        showError("Failed to save imported document: No document ID returned.");
      }
    } catch (err) {
      // Check for collision error
      if (err.message && err.message.includes("already exists")) {
        setPendingImport(docToSave);
        setShowImportModal(false);
        setShowOverwriteModal(true);
      } else {
        showError("Failed to save imported document.");
        console.error(err);
        setShowImportModal(false);
      }
    }
  };

  // Overwrite handler
  const handleOverwriteConfirm = async () => {
    if (!pendingImport) return;
    try {
      // Find and delete the existing doc with same name/category
      const existingDoc = documents.find(
        d => d.name === pendingImport.name && d.category === pendingImport.category
      );
      if (existingDoc) {
        await deleteDocument(existingDoc.id);
      }
      const savedDoc = await saveDocument(pendingImport);
      if (savedDoc && savedDoc.id) {
        await loadDocument(savedDoc.id);
        setDocumentTitle(savedDoc.name);
        if (setContent) setContent(savedDoc.content);
        showSuccess(`Imported and overwritten document: ${savedDoc.name}`);
      } else {
        showError("Failed to overwrite imported document: No document ID returned.");
      }
    } catch (err) {
      showError("Failed to overwrite imported document.");
      console.error(err);
    } finally {
      setShowOverwriteModal(false);
      setPendingImport(null);
      setImportedFileData(null);
    }
  };

  const handleOverwriteCancel = () => {
    setShowOverwriteModal(false);
    setPendingImport(null);
    setShowImportModal(true);
  };
  // ...existing code...

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
      <ImportConfirmModal
        show={showImportModal}
        onHide={() => { setShowImportModal(false); setImportedFileData(null); }}
        categories={categories}
        defaultName={importedFileData ? importedFileData.name : ""}
        onConfirm={handleImportConfirm}
      />
      <ConfirmModal
        show={showOverwriteModal}
        title="Document Exists"
        message={
          <>
            <div className="mb-2">A document with this name and category already exists.</div>
            <div>Do you want to overwrite it?</div>
          </>
        }
        confirmText="Overwrite"
        cancelText="Cancel"
        confirmVariant="danger"
        cancelVariant="secondary"
        icon={<i className="bi bi-exclamation-triangle-fill text-danger me-2"></i>}
        onConfirm={handleOverwriteConfirm}
        onCancel={handleOverwriteCancel}
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
