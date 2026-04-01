import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import ConfirmModal from "@/components/shared/modals/ConfirmModal";
import DocumentForm from "./DocumentForm";

function SaveAsDocumentModal({ show, onHide, defaultName, defaultCategory, onConfirm }) {
  const [selectedCategory, setSelectedCategory] = useState(defaultCategory || "General");
  const [filename, setFilename] = useState(defaultName || "");
  const [newCategory, setNewCategory] = useState("");
  const [categoryError, setCategoryError] = useState("");

  // Reset form when modal opens with new defaults
  useEffect(() => {
    if (show) {
      setSelectedCategory(defaultCategory || "General");
      setFilename(defaultName || "");
      setNewCategory("");
      setCategoryError("");
    }
  }, [show, defaultName, defaultCategory]);

  const isValid = filename.trim() !== "";

  const handleAction = (action) => {
    if (action === "save" && isValid) {
      onConfirm(selectedCategory, filename.trim());
    } else {
      onHide();
    }
  };

  return (
    <ConfirmModal
      show={show}
      onHide={onHide}
      title="Save As"
      icon={<i className="bi bi-files text-primary me-2"></i>}
      message={
        <>
          <div className="mb-3">
            Save a copy of this document with a new name or category.
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
            onSubmit={() => isValid && handleAction('save')}
          />
        </>
      }
      buttons={[
        {
          text: "Save As",
          icon: "bi bi-files",
          action: "save",
          variant: "primary",
          autoFocus: true,
          disabled: !isValid,
        },
        {
          text: "Cancel",
          icon: "bi bi-x-lg",
          action: "cancel",
          variant: "secondary",
        },
      ]}
      onAction={handleAction}
    />
  );
}

SaveAsDocumentModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  defaultName: PropTypes.string,
  defaultCategory: PropTypes.string,
  onConfirm: PropTypes.func.isRequired,
};

export default SaveAsDocumentModal;
