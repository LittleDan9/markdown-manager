import React, { useState, useEffect } from "react";
import { Dropdown, Form, Button } from "react-bootstrap";
import ConfirmModal from "./ConfirmModal";
import { useDocument } from "../../context/DocumentProvider";

function ImportConfirmModal({ show, onHide, categories, defaultName, onConfirm }) {
  const { addCategory, categories: contextCategories } = useDocument();
  const [selectedCategory, setSelectedCategory] = useState(contextCategories[0] || "General");
  const [filename, setFilename] = useState(defaultName || "");
  const [newCategory, setNewCategory] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    setSelectedCategory(contextCategories[0] || "General");
  }, [contextCategories, show]);
  useEffect(() => {
    setFilename(defaultName || "");
  }, [defaultName]);

  const handleAddCategory = async (e) => {
    e.preventDefault();
    const cat = newCategory.trim();
    if (!cat) return;
    if (contextCategories.includes(cat)) {
      setCategoryError("Category already exists.");
      return;
    }
    try {
      await addCategory(cat);
      setSelectedCategory(cat);
      setNewCategory("");
      setCategoryError("");
    } catch (err) {
      setCategoryError("Failed to add category");
    }
  };

  return (
    <ConfirmModal
      show={show}
      title="Import Markdown File"
      message={
        <>
          <div className="mb-2">Select category for imported document:</div>
          <Dropdown show={dropdownOpen} onToggle={setDropdownOpen} className="mb-2 w-100">
            <Dropdown.Toggle variant="outline-secondary">
              {selectedCategory}
            </Dropdown.Toggle>
            <Dropdown.Menu className="w-100">
              {contextCategories.map(cat => (
                <Dropdown.Item
                  key={cat}
                  active={cat === selectedCategory}
                  onClick={() => { setSelectedCategory(cat); setDropdownOpen(false); }}
                >
                  {cat}
                </Dropdown.Item>
              ))}
              <Dropdown.Divider />
              <div className="px-3 py-2">
                <form className="d-flex" onSubmit={handleAddCategory} autoComplete="off">
                  <Form.Control
                    size="sm"
                    type="text"
                    placeholder="Add category"
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    className="me-2"
                  />
                  <Button variant="primary" size="sm" type="submit">
                    <i className="bi bi-plus"></i>
                  </Button>
                </form>
                {categoryError && <div className="text-danger small mt-1">{categoryError}</div>}
              </div>
            </Dropdown.Menu>
          </Dropdown>
          <div className="mb-2">Filename:</div>
          <Form.Control value={filename} onChange={e => setFilename(e.target.value)} />
        </>
      }
      confirmText="Import"
      cancelText="Cancel"
      confirmVariant="primary"
      cancelVariant="secondary"
      icon={<i className="bi bi-file-earmark-arrow-up text-primary me-2"></i>}
      onConfirm={() => onConfirm(selectedCategory, filename)}
      onCancel={onHide}
    />
  );
}

export default ImportConfirmModal;
