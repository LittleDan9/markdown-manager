import MarkdownIt from "markdown-it"
import HighlightService from "./services/HighlightService";
import MermaidService from "./services/MermaidService";

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
});

md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const info = token.info.trim();
  const lang = info || "";
  if (info.toLowerCase() === "mermaid") {
    const diagramSource = decodeURIComponent(token.content.trim());
    const mermaidDiagram = MermaidService.diagramCache.get(diagramSource);
    if (mermaidDiagram) {
      return `<div
        class="mermaid"
        data-processed="true"
        data-mermaid-source="${diagramSource}"
      >
        ${mermaidDiagram}
      </div>`;
    }
    return `<div
      class="mermaid"
      data-processed="false"
      data-mermaid-source="${diagramSource}"
    >
      <div class="code-block">
        <div class="code-block-header">
          <span class="code-block-lang">${lang.toUpperCase()}</span>
          <button class="code-block-copy-btn" data-prismjs-copy>
            <i class="bi bi-clipboard" aria-label="Copy"></i>
          </button>
        </div>
        <pre class="language-mermaid d-flex align-items-center justify-content-center" style="min-height: 4rem; padding: 1rem;">
          <code class="text-warning">Diagram is empty of invalid. Please check the source.</code>
        </pre>
      </div>
    </div>`;
  }

  // Check cache
  const highlightedCode = HighlightService.getFromCache(token.content, lang);
  let codeBlock;
  if (highlightedCode){
    codeBlock = `<pre class="language-${lang}" data-processed="true" data-syntax-placeholder="${placeholderId}" data-code="${encodeURIComponent(token.content)}" data-lang="${lang}"><code>${highlightedCode}</code></pre>`
  } else {
    codeBlock = `<pre class="language-${lang}" data-processed="false" data-syntax-placeholder="${placeholderId}" data-code="${encodeURIComponent(token.content)}" data-lang="${lang}"><code>${MarkdownIt().utils.escapeHtml(token.content)}</code></pre>`
  }


  // For syntax highlighting, we'll use a placeholder that gets replaced later
  const placeholderId = `syntax-highlight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return `
    <div class="code-block">
    <div class="code-block-header">
      <span class="code-block-lang">${lang.toUpperCase()}</span>
      <button class="code-block-copy-btn" data-prismjs-copy>
        <i class="bi bi-clipboard" aria-label="Copy"></i>
      </button>
    </div>
    ${codeBlock}
    </div>
  `;
};

export function render(content) {
  return md.render(content)
}

export { md }