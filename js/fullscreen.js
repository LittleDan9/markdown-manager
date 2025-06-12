/**
 * js/fullscreen.js
 *
 * setupFullscreen(editor)
 *   - Hooks the “Fullscreen Diagram” button (#fullScreenBtn).
 *   - When clicked, grab the current Mermaid code, check the light/dark toggle,
 *     and open a new window containing a minimal HTML page that
 *     runs mermaid.initialize(...) + mermaid.init(...) via CDN.
 */
export function setupFullscreen(editor) {
  const fullScreenBtn = document.getElementById('fullScreenBtn');

  fullScreenBtn.addEventListener('click', () => {
    // 1) Get the raw Mermaid text, escaping backticks so it survives inside a template literal:
    let code = editor.getValue().replace(/`/g, '\\`');

    // 2) Check whether we’re currently in dark mode or not:
    const isDark = document.getElementById('themeToggle').checked;

    // 3) Build the entire HTML string for the new window, using CDN for mermaid.min.js:
    const fullHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Fullscreen Mermaid Diagram</title>
  <!-- Use Bootstrap (CDN) so we can toggle light/dark inside this new window too -->
  <link
    id="bootstrapCSSFull"
    href="${isDark
      ? 'https://cdn.jsdelivr.net/npm/bootswatch@5/dist/darkly/bootstrap.min.css'
      : 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css'}"
    rel="stylesheet"
  />
  <style>
    html, body {
      height: 100%;
      margin: 0;
      background-color: ${isDark ? '#212529' : '#ffffff'};
      color: ${isDark ? '#f8f9fa' : '#212529'};
    }
    #toolbarFull {
      flex: 0 0 auto;
    }
    #previewFullContainer {
      display: flex;
      justify-content: center;
      align-items: center;
      height: calc(100% - 56px); /* navbar height */
      overflow: hidden;
    }
    #previewFullContainer .mermaid svg {
      max-width: 100%;
      max-height: 100%;
      height: auto;
      width: auto;
    }
  </style>
  <!-- Load Mermaid from a public CDN -->
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
</head>
<body>
  <!-- Fullscreen navbar with its own light/dark toggle -->
  <nav id="toolbarFull" class="navbar navbar-expand-lg bg-body-tertiary px-3">
    <span class="navbar-brand mb-0 h1">Fullscreen Diagram</span>
    <div class="ms-auto form-check form-switch">
      <input
        class="form-check-input"
        type="checkbox"
        id="themeToggleFull"
        ${isDark ? 'checked' : ''}
      />
      <label class="form-check-label mb-0" for="themeToggleFull">
        Dark Mode
      </label>
    </div>
  </nav>

  <!-- Container for the rendered Mermaid diagram -->
  <div id="previewFullContainer">
    <div id="previewFull"></div>
  </div>

  <script>
    // 1) Initialize Mermaid in this new window
    function initMermaidFull(theme) {
      mermaid.initialize({
        startOnLoad: false,
        theme: theme
      });
    }

    // 2) Render the diagram inside #previewFull
    function renderFullDiagram() {
      const container = document.getElementById('previewFull');
      container.innerHTML = '';
      // Create a <div class="mermaid"> with the saved code
      const graphDiv = document.createElement('div');
      graphDiv.className = 'mermaid';
      graphDiv.textContent = \`${code}\`;
      container.appendChild(graphDiv);
      try {
        mermaid.init(undefined, graphDiv);
      } catch (err) {
        console.error('Mermaid parse error in fullscreen:', err);
      }
    }

    // 3) Toggle full-screen light/dark
    function switchBootstrapThemeFull(isDark) {
      const link = document.getElementById('bootstrapCSSFull');
      if (isDark) {
        link.href = 'https://cdn.jsdelivr.net/npm/bootswatch@5/dist/darkly/bootstrap.min.css';
        document.body.style.backgroundColor = '#212529';
        document.body.style.color = '#f8f9fa';
      } else {
        link.href = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css';
        document.body.style.backgroundColor = '#ffffff';
        document.body.style.color = '#212529';
      }
      initMermaidFull(isDark ? 'dark' : 'default');
      renderFullDiagram();
    }

    // 4) Once DOM is ready, do the first render & wire up the toggle
    document.addEventListener('DOMContentLoaded', () => {
      const initialTheme = ${isDark ? `'dark'` : `'default'`};
      initMermaidFull(initialTheme);
      renderFullDiagram();

      const toggleFull = document.getElementById('themeToggleFull');
      toggleFull.addEventListener('change', (e) => {
        switchBootstrapThemeFull(e.target.checked);
      });
    });
  </script>
</body>
</html>
    `;

    // 5) Finally, open a blank window and write the HTML into it:
    const win = window.open();
    win.document.write(fullHtml);
    win.document.close();
  });
}
