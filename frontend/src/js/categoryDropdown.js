// Category dropdown logic for the navigation bar
// Handles category selection, UI update, and document save logic
import { documentManager } from "./DocumentManager";
import NotificationManager from "./notifications";

export function initCategoryDropdown(documentUI) {
  function updateCategoryUI(newCategory) {
    const currentCategory = document.getElementById("currentCategory");
    if (currentCategory) currentCategory.textContent = newCategory;
  }

  function showNotification(msg, type) {
    if (documentUI && typeof documentUI.showNotification === "function") {
      documentUI.showNotification(msg, type);
    } else if (
      NotificationManager &&
      typeof NotificationManager.showNotification === "function"
    ) {
      NotificationManager.showNotification(msg, type);
    }
  }

  // Move DOM lookups inside the function to avoid temporal dead zone
  async function renderCategoryItems() {
    console.debug("[CategoryDropdown] renderCategoryItems called");
    const categoryDropdownMenu = document.getElementById(
      "categoryDropdownMenu",
    );
    // Remove all existing category items
    Array.from(categoryDropdownMenu.querySelectorAll(".category-item")).forEach(
      (item) => {
        item.parentElement.remove();
      },
    );
    // Get categories from localStorage directly to ensure all are shown
    let categories = [];
    try {
      const raw = localStorage.getItem("documentCategories");
      categories = raw ? JSON.parse(raw) : [];
      console.debug(
        "[CategoryDropdown] Loaded categories from localStorage:",
        categories,
      );
    } catch (e) {
      categories = [];
      console.error(
        "[CategoryDropdown] Error parsing categories from localStorage:",
        e,
      );
    }
    // Always ensure 'General' is present
    if (!categories.includes("General")) {
      categories.unshift("General");
      console.debug('[CategoryDropdown] Added missing "General" category');
    }
    // Sort A-Z, General always first (case-insensitive)
    const generalIndex = categories.findIndex(
      (c) => c.trim().toLowerCase() === "general",
    );
    let general = null;
    if (generalIndex !== -1) {
      general = categories.splice(generalIndex, 1)[0];
      console.debug(
        '[CategoryDropdown] Spliced out "General" for sorting:',
        general,
      );
    }
    categories.sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
    if (general) categories.unshift(general);
    console.debug(
      "[CategoryDropdown] Final categories for dropdown:",
      categories,
    );
    // Find the divider <li> (declare once at top of function)
    const dividerLi = Array.from(categoryDropdownMenu.children).find(
      (li) => li.querySelector && li.querySelector("hr.dropdown-divider"),
    );
    // Insert each category before the divider
    categories.forEach((category) => {
      const li = document.createElement("li");
      li.className = "d-flex align-items-center justify-content-between px-2";
      const a = document.createElement("a");
      a.className = "dropdown-item category-item flex-grow-1";
      a.href = "#";
      a.setAttribute("data-category", category);
      a.textContent = category;
      li.appendChild(a);

      // Add delete button except for General
      if (category.trim().toLowerCase() !== "general") {
        const delBtn = document.createElement("button");
        delBtn.className =
          "btn btn-link btn-sm text-danger p-0 ms-2 delete-category-btn";
        delBtn.setAttribute("data-category", category);
        delBtn.setAttribute("type", "button");
        delBtn.setAttribute("tabindex", "-1");
        delBtn.setAttribute("aria-label", `Delete category ${category}`);
        delBtn.innerHTML = '<i class="bi bi-x fs-5"></i>';
        li.appendChild(delBtn);
      }

      categoryDropdownMenu.insertBefore(li, dividerLi);
      // Add click event
      a.addEventListener("click", function (e) {
        e.preventDefault();
        if (!documentManager || !documentManager.currentDocument) return;
        const doc = documentManager.currentDocument;
        const docName = doc.name || "";
        if (!docName.trim() || docName === "Untitled Document") {
          doc.category = category;
          updateCategoryUI(category);
          showNotification(
            "Please enter a valid document name before saving.",
            "warning",
          );
          return;
        }
        if (doc.category !== category) {
          doc.category = category;
          updateCategoryUI(category);
          if (doc.id) {
            if (documentManager.saveDocument) {
              documentManager.saveDocument(
                window.editor ? window.editor.getValue() : "",
                doc.name,
                doc.id,
                category,
              );
              showNotification("Category updated and saved.", "success");
            }
          } else {
            if (documentManager.saveCurrentDocument) {
              documentManager.saveCurrentDocument();
              showNotification("Category updated.", "info");
            }
          }
          if (
            documentUI &&
            typeof documentUI.updateDocumentTitle === "function"
          ) {
            documentUI.updateDocumentTitle();
          }
        }
      });
    });
    // Delete category event (event delegation)
    let categoryToDelete = null;
    document.addEventListener("click", function (e) {
      const btn = e.target.closest(".delete-category-btn");
      if (!btn) return;
      const category = btn.getAttribute("data-category");
      if (!category || category.trim().toLowerCase() === "general") return;
      categoryToDelete = category;
      // Set modal message
      const msg = document.getElementById("deleteCategoryModalMsg");
      if (msg) {
        msg.innerHTML = `Are you sure you want to delete <strong>${category}</strong>? All documents in this category will be reassigned to <strong>General</strong>.`;
      }
      // Show modal
      const modal = new window.bootstrap.Modal(
        document.getElementById("deleteCategoryModal"),
      );
      modal.show();
    });

    // Handle modal confirm
    document
      .getElementById("confirmDeleteCategoryBtn")
      ?.addEventListener("click", async function () {
        if (!categoryToDelete) return;
        const btn = document.querySelector(
          `.delete-category-btn[data-category="${categoryToDelete}"]`,
        );
        if (btn) btn.disabled = true;
        const ok = await documentManager.deleteCategory(categoryToDelete);
        if (btn) btn.disabled = false;
        // Hide modal
        const modalEl = document.getElementById("deleteCategoryModal");
        if (modalEl) {
          const modal = window.bootstrap.Modal.getInstance(modalEl);
          if (modal) modal.hide();
        }
        if (ok) {
          showNotification(
            `Category '${categoryToDelete}' deleted.`,
            "success",
          );
          await renderCategoryItems();
        } else {
          showNotification(
            `Failed to delete category '${categoryToDelete}'.`,
            "error",
          );
        }
        categoryToDelete = null;
      });
  }

  // Initial render (after DOM is ready and menu exists)
  document.addEventListener("DOMContentLoaded", () => {
    console.debug(
      "[CategoryDropdown] DOMContentLoaded event, calling renderCategoryItems",
    );
    renderCategoryItems();
  });
  // Also call immediately in case DOM is already loaded
  if (
    document.readyState === "interactive" ||
    document.readyState === "complete"
  ) {
    console.debug(
      "[CategoryDropdown] Document already loaded, calling renderCategoryItems immediately",
    );
    renderCategoryItems();
  }

  // Add Category functionality
  const addCategoryForm = document.getElementById("addCategoryForm");
  const addCategoryInput = document.getElementById("addCategoryInput");
  const addCategoryBtn = document.getElementById("addCategoryBtn");
  const categoryDropdownMenu = document.getElementById("categoryDropdownMenu");

  if (
    addCategoryForm &&
    addCategoryInput &&
    addCategoryBtn &&
    categoryDropdownMenu
  ) {
    // Enable input and button
    addCategoryInput.disabled = false;
    addCategoryBtn.disabled = false;

    // Handle form submit
    addCategoryForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const newCategory = addCategoryInput.value.trim();
      if (!newCategory) {
        showNotification("Category name cannot be empty.", "warning");
        return;
      }
      // Validate: no duplicates (case-insensitive) using all categories (not just dropdown)
      let allCategories = [];
      if (typeof documentManager.getAllCategories === "function") {
        try {
          allCategories = await documentManager.getAllCategories();
        } catch (e) {
          allCategories = [...documentManager.categories];
        }
      } else {
        allCategories = [...documentManager.categories];
      }
      const exists = allCategories.some(
        (cat) => cat.trim().toLowerCase() === newCategory.toLowerCase(),
      );
      if (exists) {
        showNotification("Category already exists.", "warning");
        return;
      }
      // Validate: no special chars (allow letters, numbers, spaces, dashes, underscores)
      if (!/^[\w\s-]+$/.test(newCategory)) {
        showNotification("Invalid category name.", "warning");
        return;
      }
      // Add to documentManager
      const added = documentManager.addCategory(newCategory);
      if (!added) {
        // Check if it's a duplicate error
        let allCats = [];
        if (typeof documentManager.getAllCategories === "function") {
          try {
            allCats = await documentManager.getAllCategories();
          } catch (e) {
            allCats = [...documentManager.categories];
          }
        } else {
          allCats = [...documentManager.categories];
        }
        if (
          allCats.some(
            (cat) => cat.trim().toLowerCase() === newCategory.toLowerCase(),
          )
        ) {
          showNotification("Category already exists.", "warning");
        } else {
          showNotification("Failed to add category.", "error");
        }
        return;
      }
      // Re-render all category items to keep sorted
      await renderCategoryItems();
      addCategoryInput.value = "";
      showNotification("Category added.", "success");
    });
  }
}
