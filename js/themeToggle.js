import { initMermaid } from './initMermaid.js';
import { renderPreviewOnChange } from './preview.js';

// Now accepts the editor instance so we can re-render directly
export function setupThemeToggle(editor) {
  const toggle = document.getElementById('themeToggle');
  toggle.addEventListener('change', (e) => {
    const isDark = e.target.checked;

    // Switch Bootstrap CSS
    const link = document.getElementById('bootstrapCSS');
    if (isDark) {
      link.href = 'https://cdn.jsdelivr.net/npm/bootswatch@5/dist/darkly/bootstrap.min.css';
      document.getElementById('editorContainer').style.backgroundColor = '#343a40';
      document.getElementById('editorContainer').style.color = '#f8f9fa';
      document.getElementById('previewContainer').style.backgroundColor = '#212529';
    } else {
      link.href = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css';
      document.getElementById('editorContainer').style.backgroundColor = '#f8f9fa';
      document.getElementById('editorContainer').style.color = '#212529';
      document.getElementById('previewContainer').style.backgroundColor = '#ffffff';
    }

    // Switch Monaco theme
    if (window.monaco && editor) {
      monaco.editor.setTheme(isDark ? 'vs-dark' : 'vs');
    }

    // Switch Mermaid theme and re-render preview
    const newTheme = isDark ? 'dark' : 'default';
    initMermaid(newTheme);
    renderPreviewOnChange(editor);
  });
}
