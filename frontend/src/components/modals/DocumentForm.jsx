import React, { useState } from "react";
import { Dropdown, Form, Button } from "react-bootstrap";
import { useDocumentContext } from "../../providers/DocumentContextProvider.jsx";

function DocumentForm({
  defaultName = "",
  onCategoryChange,
  onFilenameChange,
  selectedCategory,
  filename,
  newCategory,
  setNewCategory,
  categoryError,
  setCategoryError,
}) {
  const { addCategory, categories: contextCategories } = useDocumentContext();
  const [dropdownOpen, setDropdownOpen] = useState(false);

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
      onCategoryChange(cat);
      setNewCategory("");
      setCategoryError("");
    } catch (err) {
      setCategoryError("Failed to add category");
    }
  };

  return (
    <>
      <Dropdown show={dropdownOpen} onToggle={setDropdownOpen} className="mb-2 w-100">
        <Dropdown.Toggle variant="outline-secondary" className="w-100 d-flex justify-content-between align-items-center">
          <span>{selectedCategory}</span>
        </Dropdown.Toggle>
        <Dropdown.Menu className="w-100">
          {contextCategories.map(cat => (
            <Dropdown.Item
              key={cat}
              active={cat === selectedCategory}
              onClick={() => { onCategoryChange(cat); setDropdownOpen(false); }}
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
      <Form.Control value={filename} onChange={e => onFilenameChange(e.target.value)} />
      {/* Action buttons (Save, Discard, Cancel) should be rendered by the parent modal, not here */}
    </>
  );
}

export default DocumentForm;
