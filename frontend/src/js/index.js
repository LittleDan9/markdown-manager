import { initCategoryDropdown } from "./categoryDropdown";
import { EDITOR_KEY } from "./constants";
import editor from "./editor";
import { initTheme, toggleTheme } from "./theme";
import renderer from "./renderer";
import { documentManager } from "./DocumentManager";
import { initDocumentUI } from "./documentUI";
import NotificationManager from "./notifications"; // Only for local use, not global
import AuthUI from "./auth/AuthUI.js";

// Import Bootstrap CSS and JS (CSS will be extracted by webpack)
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import * as bootstrap from "bootstrap";

import "../styles/main.scss";
import "prism-themes/themes/prism-one-dark.css";
import "prism-themes/themes/prism-one-light.css";

// Make Bootstrap available globally for other modules and inline scripts
window.bootstrap = bootstrap;

function debounce(fn, wait) {
  let t;
  return () => {
    clearTimeout(t);
    t = setTimeout(fn, wait);
  };
}

window.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 DOM Content Loaded");

  let theme = await initTheme();

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (event) => {
      theme = event.matches ? "dark" : "light";
    });

  const editorInstance = await editor.setup(theme);

  // Initialize document management
  const documentUI = initDocumentUI(editorInstance);
  // Ensure dropdown is rendered after DOM and before any document loads
  try {
    await new Promise((resolve) => setTimeout(resolve, 0)); // Yield to ensure DOM is ready
    const result = await initCategoryDropdown(documentUI);
    console.debug("[Index] initCategoryDropdown completed:", result);
  } catch (e) {
    console.error("[Index] initCategoryDropdown failed:", e);
  }

  // Load current document or restore from legacy storage
  const currentDoc = documentManager.currentDocument;
  let contentRestored = false;
  if (currentDoc.id) {
    try {
      const doc = documentManager.documents[currentDoc.id];
      if (doc) {
        editorInstance.setValue(doc.content);
        contentRestored = true;
      }
    } catch (error) {
      console.error("Error loading current document:", error);
    }
  } else {
    // Check for legacy editor content
    const legacyContent = localStorage.getItem(EDITOR_KEY);
    if (legacyContent) {
      editorInstance.setValue(legacyContent);
      contentRestored = true;
      // Remove legacy storage
      localStorage.removeItem(EDITOR_KEY);
    }
  }

  // Update document title
  documentUI.updateDocumentTitle();

  // Render the preview if content was restored
  if (contentRestored) {
    await renderer.render(editorInstance, { isInitialRender: true });
  }

  // Setup auto-save
  documentUI.setupAutoSave();

  // Fullscreen preview management
  let isFullscreenMode = false;

  const toggleFullscreenPreview = () => {
    const mainContainer = document.getElementById("main");
    const fullScreenBtn = document.getElementById("fullScreenBtn");

    console.log("Toggling fullscreen mode. Current mode:", isFullscreenMode);

    if (!isFullscreenMode) {
      // Enter fullscreen mode: add CSS class to trigger fullscreen layout
      mainContainer.classList.add("fullscreen-mode");
      fullScreenBtn.innerHTML = '<i class="bi bi-fullscreen-exit"></i>';
      fullScreenBtn.title = "Exit fullscreen preview";
      isFullscreenMode = true;
      console.log("Entered fullscreen mode. Classes:", mainContainer.className);
    } else {
      // Exit fullscreen mode: remove CSS class to restore normal layout
      mainContainer.classList.remove("fullscreen-mode");
      fullScreenBtn.innerHTML = '<i class="bi bi-fullscreen"></i>';
      fullScreenBtn.title = "Open preview in fullscreen";
      isFullscreenMode = false;
      console.log("Exited fullscreen mode. Classes:", mainContainer.className);
    }
  };
  // Add fullscreen button event listener
  const fullscreenBtn = document.getElementById("fullScreenBtn");
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener("click", toggleFullscreenPreview);
  }

  // Initialize Bootstrap tooltips
  const tooltipTriggerList = [].slice.call(
    document.querySelectorAll('[data-bs-toggle="tooltip"]'),
  );
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });
  console.log("Bootstrap tooltips initialized");

  // Handle window resize to re-render preview
  const debouncedResize = debounce(() => {
    console.log("🔄 Window resized, updating layout...");

    // Force Monaco editor to recalculate its layout
    editorInstance.layout();
    console.log("📐 Editor layout updated");

    // Clear any existing Mermaid diagrams first to avoid conflicts
    const mermaidElements = document.querySelectorAll(".mermaid");
    mermaidElements.forEach((el) => {
      // Remove any existing SVG content to force re-render
      const svg = el.querySelector("svg");
      if (svg) {
        svg.remove();
      }
      // Reset the mermaid element state
      el.removeAttribute("data-processed");
    });

    // Re-render the entire preview
    renderer.render(editorInstance);
    console.log("🎨 Preview re-rendered");

    console.log("✅ Resize handling complete");
  }, 250); // Slightly longer debounce for resize events

  window.addEventListener("resize", debouncedResize);

  // Copy functionality for code blocks
  function setupCopyButtons() {
    document.addEventListener("click", async (e) => {
      if (e.target.closest(".code-block-copy-btn")) {
        e.preventDefault();
        const button = e.target.closest(".code-block-copy-btn");
        const codeBlock = button.closest(".code-block");
        const preElement = codeBlock.querySelector("pre");
        const codeElement = preElement.querySelector("code") || preElement;

        try {
          // Get the text content, preserving line breaks
          const textToCopy = codeElement.textContent || codeElement.innerText;

          // Try modern clipboard API first, with fallback for HTTP development
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(textToCopy);
          } else {
            // Fallback for HTTP development or older browsers
            const textArea = document.createElement("textarea");
            textArea.value = textToCopy;
            textArea.style.position = "fixed";
            textArea.style.left = "-999999px";
            textArea.style.top = "-999999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
          }

          // Show success toast
          NotificationManager.showSuccess("Copied to clipboard!");

          // Optional: Add visual feedback to the button
          const originalIcon = button.querySelector("i");
          originalIcon.className = "bi bi-check";
          setTimeout(() => {
            originalIcon.className = "bi bi-clipboard";
          }, 1000);
        } catch (err) {
          console.error("Failed to copy:", err);
          NotificationManager.showWarning("Failed to copy to clipboard");
        }
      }
    });
  }

  // Initialize copy functionality
  setupCopyButtons();
});
