import mermaid from "mermaid";
// import MarkdownIt from "markdown-it";

class MermaidService {
  constructor() {
    this.theme = null;
    this.diagramCache = new Map();
  }

  async init(theme) {
    try {
      await mermaid.initialize({
        startOnLoad: false,
        theme: theme,
        flowchart: {
          htmlLabels: false,
          curve: "linear",
        },
        suppressErrorRendering: true,
        logLevel: "fatal",
        htmlLabels: false,
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
      this.diagramCache.clear();
      this.theme = theme;
      console.log(`Mermaid theme updated to: ${theme}`);
      await this.init(theme);
    }
  }

  isEmptyMermaidSVG(svgHtml) {
    const parser = new DOMParser();
    const svgElement = parser.parseFromString(svgHtml, "image/svg+xml").documentElement;
    // Look for .nodes or .edgePaths with children
    const nodes = svgElement.querySelector('.nodes');
    const edges = svgElement.querySelector('.edgePaths');
    return (
      (!nodes || !nodes.children.length) &&
      (!edges || !edges.children.length)
    );
  }

  async render(previewElement, theme = null) {
    if (theme && theme !== this.theme) {
      await this.updateTheme(theme);
    }

    const mermaidBlocks = previewElement.querySelectorAll(".mermaid[data-mermaid-source][data-processed='false']");
    if (mermaidBlocks.length === 0) return;

    for (const block of mermaidBlocks) {
      const diagramSource = block.dataset.mermaidSource?.trim() || "";
      if (!diagramSource) continue;

      // Check cache
      if (this.diagramCache.has(diagramSource)) {
        block.innerHTML = this.diagramCache.get(diagramSource);
        block.setAttribute("data-processed", "true");
        continue;
      }

      try {
        const { svg } = await mermaid.render(
          `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          diagramSource,
        );

        if (this.isEmptyMermaidSVG(svg)) {
          this.showError(block, "Diagram is empty or invalid.");
          return;
        }

        block.innerHTML = `<div class="d-flex justify-content-center">${svg}</div>`;
        const svgElement = block.querySelector("svg");
        if (svgElement) {
          svgElement.setAttribute("width", "100%");
          svgElement.removeAttribute("height");
          svgElement.style.maxWidth = "86%";
          svgElement.style.height = "auto";
        }
        block.setAttribute("data-processed", "true");
        this.diagramCache.set(diagramSource, svgElement.parentNode.outerHTML);
      } catch (error) {
        this.showError(block, error.message || "Failed to render diagram");
      }
    }
  }

  /**
   * Show error message in the Mermaid block
   * @param {HTMLElement} mermaidElement - The Mermaid block element
   * @param {string} errorMessage - The error message to display
   */
  showError(mermaidElement, errorMessage) {
    const textContent = mermaidElement.querySelector(".language-mermaid")
    textContent.innerHTML = `<code class="text-warning">${errorMessage}</code>`;
    this.diagramCache.set(mermaidElement.dataset.mermaidSource, mermaidElement.outerHTML);
  }
}

export default new MermaidService();
