import React, { useState } from "react";
import ConfirmModal from "../../modals/ConfirmModal";
import DocumentForm from "../../modals/DocumentForm";

export default function FileImportModal({ show, onHide, onConfirm, defaultName = "", icon }) {
  const [selectedCategory, setSelectedCategory] = useState("General");
  const [filename, setFilename] = useState(defaultName || "");
  const [newCategory, setNewCategory] = useState("");
  const [categoryError, setCategoryError] = useState("");

  const handleConfirm = () => {
    onConfirm(selectedCategory, filename, "confirm");
  };

  return (
    <ConfirmModal
      show={show}
      title="Import Markdown File"
      message={
        <>
          <div className="mb-2">Select category and filename for imported document.</div>
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
          />
        </>
      }
      icon={icon}
      footer={
        <>
          <button className="btn btn-primary me-2" autoFocus onClick={handleConfirm}>Import</button>
          <button className="btn btn-secondary" onClick={onHide}>Cancel</button>
        </>
      }
    />
  );
}
