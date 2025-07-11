import React, { useEffect, useState } from "react";
import { Dropdown, ButtonGroup } from "react-bootstrap";
import ConfirmModal from "../modals/ConfirmModal";
import { documentManager } from "../../js/DocumentManager";
import { useConfirmModal } from "../../hooks/useConfirmModal";
import {
  fetchCategories,
  deleteCategory,
  addCategory,
} from "../../js/api/categoriesApi";

function FileDropdown({ setDocumentTitle }) {
  const { show, modalConfig, openModal, handleConfirm, handleCancel } =
    useConfirmModal();

  const handleNew = () => {
    if (documentManager.hasUnsavedChanges()) {
      openModal(
        async () => {
          const document = documentManager.createNewDocument();
          setDocumentTitle(document.name);
        },
        {
          title: "Unsaved Changes",
          message:
            "You have unsaved changes. Do you want to continue without saving?",
          confirmText: "Continue Without Saving",
          cancelText: "Cancel",
          confirmVariant: "danger",
          cancelVariant: "secondary",
          icon: (
            <i className="bi bi-exclamation-triangle-fill text-warning me-2"></i>
          ),
        },
      );
      return;
    }

    console.log("here");
    async function doCreateDocument() {
      const document = await documentManager.createNewDocument();
      setDocumentTitle(document.name);
    }
    doCreateDocument();
  };

  const handleOpen = () => {
    console.log("File opened");
  };

  const handleSave = () => {
    console.log("File saved");
  };

  const handleImport = () => {
    console.log("File imported");
  };

  const handleExportMarkdown = () => {
    console.log("Exported as Markdown");
  };

  const handleExportPDF = () => {
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
        </Dropdown.Menu>
      </Dropdown>
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
