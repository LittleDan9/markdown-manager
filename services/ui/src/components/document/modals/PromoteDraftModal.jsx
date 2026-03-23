import React, { useState } from "react";
import PropTypes from "prop-types";
import ConfirmModal from "@/components/shared/modals/ConfirmModal";
import DocumentForm from "./DocumentForm";

/**
 * PromoteDraftModal - Shown on first explicit save of a document in the Drafts category.
 * Lets user set a name and category to "promote" the draft, or keep it in Drafts.
 */
function PromoteDraftModal({ show, onHide, defaultName, onConfirm }) {
  const [selectedCategory, setSelectedCategory] = useState("Drafts");
  const [filename, setFilename] = useState(defaultName || "");
  const [newCategory, setNewCategory] = useState("");
  const [categoryError, setCategoryError] = useState("");

  const isValid = filename.trim() !== "";

  const handleAction = (action) => {
    if (action === "save") {
      if (isValid) {
        onConfirm(selectedCategory, filename.trim());
      }
    } else if (action === "keep") {
      // Save in Drafts with current name, mark as acknowledged
      onConfirm("Drafts", filename.trim() || defaultName);
    } else if (action === "cancel") {
      onHide();
    }
  };

  return (
    <ConfirmModal
      show={show}
      onHide={onHide}
      title="Save Document"
      icon={<i className="bi bi-file-earmark-arrow-up text-primary me-2"></i>}
      message={
        <>
          <div className="mb-3">
            This document is in <strong>Drafts</strong>. Would you like to
            move it to a category?
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
          />
        </>
      }
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
          text: "Keep in Drafts",
          icon: "bi bi-journal",
          action: "keep",
          variant: "outline-secondary",
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

PromoteDraftModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  defaultName: PropTypes.string,
  onConfirm: PropTypes.func.isRequired,
};

export default PromoteDraftModal;
