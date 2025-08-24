import { useDocumentContext } from "@/providers/DocumentContextProvider.jsx";
import { useNotification } from "@/components/NotificationProvider";
import { DocumentService } from "@/services/core";

// ...existing code...

import React, { useState } from "react";
import ConfirmModal from "@/components/modals/ConfirmModal";
import DocumentForm from "@/components/modals/DocumentForm";

export default function FileImportModal({ show, onHide, onConfirm, defaultName = "", icon, selectedFile }) {
  const [selectedCategory, setSelectedCategory] = useState("General");
  const initialFilename = React.useMemo(() => {
    if (selectedFile && typeof selectedFile.name === "string") {
      return selectedFile.name.replace(/\.md$/i, "");
    }
    return defaultName || "";
  }, [selectedFile, defaultName]);
  const [filename, setFilename] = useState(initialFilename);

  // Sync filename with selectedFile changes
  React.useEffect(() => {
    setFilename(initialFilename);
  }, [initialFilename]);
  const [newCategory, setNewCategory] = useState("");
  const [categoryError, setCategoryError] = useState("");

  // Default document values
  const isDefaultFilename = filename === "Untitled Document" || filename.trim() === "";
  const isValid = !isDefaultFilename && !categoryError;

  const handleAction = (action) => {
    try {
      if (action === "import") {
        if (isValid) onConfirm(selectedCategory, filename, "import");
      } else if (action === "cancel") {
        if (onHide) onHide();
      }
    } catch (error) {
      setFilename("");
    }
  }

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
      buttons={[
        {
          text: "Import",
          icon: "bi bi-upload",
          action: "import",
          variant: "primary",
          autoFocus: true,
          disabled: !isValid,
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
