import React, { useState } from "react";
import { Form } from "react-bootstrap";
import ConfirmModal from "@/components/shared/modals/ConfirmModal";
import DocumentForm from "@/components/document/modals/DocumentForm";

export default function FileImportModal({ show, onHide, onConfirm, defaultName = "", icon, selectedFile }) {
  const [selectedCategory, setSelectedCategory] = useState("General");
  const [mode, setMode] = useState("import");
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
  const isValid = mode === "append" ? true : (!isDefaultFilename && !categoryError);

  const handleAction = (action) => {
    try {
      if (action === "confirm") {
        if (isValid) onConfirm(selectedCategory, filename, mode);
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
          <div className="mb-3">
            <Form.Group>
              <Form.Label>How would you like to import this file?</Form.Label>
              <div>
                <Form.Check
                  type="radio"
                  label="Create a new document"
                  name="importMode"
                  value="import"
                  checked={mode === "import"}
                  onChange={(e) => setMode(e.target.value)}
                  className="mb-2"
                />
                <Form.Check
                  type="radio"
                  label="Append to current document"
                  name="importMode"
                  value="append"
                  checked={mode === "append"}
                  onChange={(e) => setMode(e.target.value)}
                />
              </div>
            </Form.Group>
          </div>
          {mode === "import" && (
            <>
              <div className="mb-2">Select category and filename for the new document.</div>
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
          )}
          {mode === "append" && (
            <div className="mb-2">The content will be appended to the bottom of the current document.</div>
          )}
        </>
      }
      icon={icon}
      buttons={[
        {
          text: mode === "import" ? "Import as New" : "Append to Current",
          icon: "bi bi-upload",
          action: "confirm",
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
