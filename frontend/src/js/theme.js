import { setPrismTheme } from "./prismTheme";
import * as monaco from "monaco-editor";
import { initMermaid, render } from "./renderer";

// Note: Prism.js syntax highlighting has been moved to the backend
// for comprehensive language support and reduced bundle size
// Theming for code blocks is handled via CSS in _code.scss

export async function toggleTheme(theme) {
  localStorage.setItem("theme", theme);
  document.documentElement.setAttribute("data-bs-theme", theme);
  setPrismTheme(theme);
  initMermaid(theme);
  updateThemeIcon(theme);
}

function updateThemeIcon(theme) {
  // Update theme icons for both guest and user menus
  const themeIcon = document.getElementById("themeIcon");
  const themeText = document.getElementById("themeText");
  const themeIconUser = document.getElementById("themeIconUser");
  const themeTextUser = document.getElementById("themeTextUser");

  const iconClass =
    theme === "dark" ? "bi bi-moon-fill me-2" : "bi bi-sun-fill me-2";
  const textContent = theme === "dark" ? "Dark Theme" : "Light Theme";

  if (themeIcon && themeText) {
    themeIcon.className = iconClass;
    themeText.textContent = textContent;
  }

  if (themeIconUser && themeTextUser) {
    themeIconUser.className = iconClass;
    themeTextUser.textContent = textContent;
  }
}

export async function initTheme() {
  let theme = localStorage.getItem("theme");
  if (theme !== "light" && theme !== "dark") {
    const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    theme = sysDark ? "dark" : "light";
  }
  document.documentElement.setAttribute("data-bs-theme", theme);
  setPrismTheme(theme);
  initMermaid(theme);
  updateThemeIcon(theme);
  return theme;
}

export async function applyEditorTheme(theme, editor) {
  if (!editor) {
    console.log("Editor was null");
    return;
  }
  console.log(theme);

  monaco.editor.setTheme("vs-" + theme);
  // Force re-render to update Mermaid diagrams with new theme
  render(editor, { forceRender: true });
}
