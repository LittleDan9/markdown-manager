import mermaid from "mermaid";
import MarkdownIt from "markdown-it";

class MermaidManager {
  constructor() {
    this.theme = null;
  }

  async init(theme) {
    try {
      await mermaid.initialize({
        startOnLoad: false,
        theme: theme,
        flowchart: {
          htmlLabels: true,
          curve: "linear",
        },
        suppressErrorRendering: true,
        logLevel: "fatal",
        htmlLabels: true,
        secure: ["secure", "securityLevel", "startOnLoad", "maxTextSize"],
        securityLevel: "loose",
      });
      this.theme = theme;
      console.log(`Mermaid initialized with theme: ${theme}`);
    } catch (error) {
      console.error("Failed to initialize Mermaid:", error);
    }
  }

  async updateTheme(theme) {
    if (theme !== this.theme) {
      await this.init(theme);
    }
  }

  async renderDiagrams(
    previewEl,
    theme,
    existingMermaidDiagrams = new Map(),
    isInitialRender = false,
    forceRender = false,
  ) {
    await this.updateTheme(theme);
    const mermaidElements = previewEl.querySelectorAll(
      ".mermaid[data-mermaid-source]",
    );
    if (mermaidElements.length === 0) return;
    const diagramsToRender = [];
    mermaidElements.forEach((element) => {
      const diagramSource = decodeURIComponent(
        element.dataset.mermaidSource || "",
      );
      if (
        diagramSource &&
        (forceRender || !existingMermaidDiagrams.has(diagramSource))
      ) {
        diagramsToRender.push(element);
      } else if (diagramSource && existingMermaidDiagrams.has(diagramSource)) {
        element.innerHTML = existingMermaidDiagrams.get(diagramSource);
      }
    });
    if (diagramsToRender.length === 0 && !isInitialRender && !forceRender)
      return;
    const attachedDiagrams = diagramsToRender.filter(
      (el) =>
        previewEl.contains(el) &&
        !el.hasAttribute("data-processed") &&
        el.textContent.trim().length > 0,
    );
    attachedDiagrams.forEach((el) => {
      el.style.visibility = "visible";
      const existingError = el.parentElement?.querySelector(
        ".mermaid-error-indicator",
      );
      if (existingError) existingError.remove();
    });
    try {
      if (attachedDiagrams.length > 0) {
        await mermaid.run({
          querySelector: ".mermaid:not([data-processed='false'])",
          suppressErrors: false,
        }, previewEl);
      }
      attachedDiagrams.forEach((el) => {
        const svg = el.querySelector("svg");
        if (svg) {
          svg.setAttribute("width", "100%");
          svg.removeAttribute("height");
          svg.style.maxWidth = "100%";
          svg.style.height = "auto";
        }
      });
    } catch (mermaidError) {
      attachedDiagrams.forEach((el) => {
        el.removeAttribute("data-processed");
        if (!el.querySelector("svg")) {
          this.showError(
            el,
            mermaidError.message || "Failed to render diagram",
          );
        }
      });
    }
  }

  showError(mermaidElement, errorMessage) {
    const errorIndicator = document.createElement("div");
    errorIndicator.className = "mermaid-error-indicator";
    errorIndicator.innerHTML = `
        <div class="alert alert-warning alert-dismissible fade show" role="alert" style="
            position: relative;
            margin-bottom: 0.5rem;
            font-size: 0.875rem;
            padding: 0.5rem 0.75rem;
            border-left: 4px solid #f0ad4e;
        ">
            <i class="bi bi-exclamation-triangle me-2"></i>
            <strong>Diagram Error:</strong> ${errorMessage}
        </div>
    `;
    mermaidElement.parentElement?.insertBefore(errorIndicator, mermaidElement);
    if (!mermaidElement || !mermaidElement.dataset) return;
    const originalSource = decodeURIComponent(
      mermaidElement.dataset.mermaidSource || mermaidElement.textContent,
    );
    mermaidElement.innerHTML = `
        <div class="code-block">
            <div class="code-block-header">
                <span class="code-block-lang">MERMAID</span>
                <button class="code-block-copy-btn" data-prismjs-copy>
                    <i class="bi bi-clipboard" aria-label="Copy"></i>
                </button>
            </div>
            <pre class="language-mermaid" style="margin: 0;"><code>${MarkdownIt().utils.escapeHtml(originalSource)}</code></pre>
        </div>
    `;
    mermaidElement.classList.remove("mermaid");
    mermaidElement.removeAttribute("data-mermaid-source");
  }
}

const mermaidManager = new MermaidManager();
export default mermaidManager;
