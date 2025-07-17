import React, { useState } from "react";
import ConfirmModal from "../../modals/ConfirmModal";
import DocumentForm from "../../modals/DocumentForm";

export default function FileSaveAsModal({ show, onHide, onConfirm, defaultName = "", icon }) {
  const [selectedCategory, setSelectedCategory] = useState("General");
  const [filename, setFilename] = useState(defaultName || "");
  const [newCategory, setNewCategory] = useState("");
  const [categoryError, setCategoryError] = useState("");

  // Default document values
  const isDefaultCategory = selectedCategory === "General";
  const isDefaultFilename = filename === "Untitled Document" || filename.trim() === "";
  const isValid = !isDefaultCategory && !isDefaultFilename && !categoryError;

  // Handle modal actions via action key
  const handleAction = (action) => {
    if (action === "save") {
      if (isValid) onConfirm(selectedCategory, filename, "save");
    } else if (action === "discard") {
      onConfirm(null, null, "discard");
      if (onHide) onHide();
    } else if (action === "cancel") {
      if (onHide) onHide();
    }
  };

  return (
    <ConfirmModal
      show={show}
      title="Unsaved Changes"
      message={
        <>
          <div className="mb-2">
            The current document has unsaved changes.<br />
            If you would like to retain this document, select a category and provide a Filename.
          </div>
          <DocumentForm
            defaultName={defaultName}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            filename={filename}
            onFilenameChange={setFilename}
            newCategory={newCategory}
            setNewCategory={setNewCategory}
            categoryError={categoryError}
            setCategoryError={setCategoryError}
            dropdownClassName="w-100 d-flex justify-content-between"
          />
        </>
      }
      icon={icon}
      buttons={[
        {
          text: "Save",
          icon: "bi bi-floppy",
          action: "save",
          variant: "primary",
          autoFocus: true,
          disabled: !isValid,
        },
        {
          text: "Discard",
          icon: "bi bi-trash",
          action: "discard",
          variant: "danger",
        },
        {
          text: "Cancel",
          icon: "bi bi-arrow-return-right",
          action: "cancel",
          variant: "secondary",
        },
      ]}
      onAction={handleAction}
    />
  );
}
