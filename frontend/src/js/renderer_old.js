import MarkdownIt from "markdown-it";
import syntaxHighlightingService from "./syntaxHighlighting.js";
import mermaidManager from "./MermaidManager";

// Suppress Mermaid console errors by overriding console methods temporarily
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Override console methods to filter out Mermaid errors
console.error = (...args) => {
  const message = args.join(" ").toLowerCase();
  if (!message.includes("mermaid") && !message.includes("parse error")) {
    originalConsoleError.apply(console, args);
  }
};

console.warn = (...args) => {
  const message = args.join(" ").toLowerCase();
  if (!message.includes("mermaid")) {
    originalConsoleWarn.apply(console, args);
  }
};

// Debounce timer for syntax highlighting
let syntaxHighlightingTimer = null;
const SYNTAX_HIGHLIGHT_DELAY = 500; // ms

// Track recently highlighted blocks to preserve them during typing
const recentlyHighlighted = new Map();
const HIGHLIGHT_PRESERVE_TIME = 2000; // ms

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: async (str, lang) => {
    if (lang) {
      try {
        // Use backend syntax highlighting service
        const highlightedCode = await syntaxHighlightingService.highlightCode(
          str,
          lang,
        );
        return `<pre class="language-${lang}"><code>${highlightedCode}</code></pre>`;
      } catch (__) {
        // Fallback to escaped HTML
      }
    }
    // fallback for unknown languages
    return `<pre class="hljs"><code>${MarkdownIt().utils.escapeHtml(str)}</code></pre>`;
  },
});

md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const info = token.info.trim();
  const lang = info || "";
  if (info === "mermaid") {
    // Store the original source in a data attribute for comparison
    return `<div class="mermaid" data-mermaid-source="${encodeURIComponent(token.content.trim())}">${token.content}</div>`;
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
            <pre class="language-${lang}" data-syntax-placeholder="${placeholderId}" data-code="${encodeURIComponent(token.content)}" data-lang="${lang}"><code>${MarkdownIt().utils.escapeHtml(token.content)}</code></pre>
            </div>
        `;
};

class Renderer {
  constructor() {
    this.md = md;
    this.recentlyHighlighted = recentlyHighlighted;
    this.syntaxHighlightingTimer = null;
    this.theme = null;
  }

  async initMermaid(theme) {
    await mermaidManager.init(theme);
    this.theme = theme;
  }

  async updateMermaidTheme(theme) {
    await mermaidManager.updateTheme(theme);
    this.theme = theme;
  }

  async render(editor, options = {}) {
    const previewEl = document.querySelector("#preview .preview-scroll");
    const src = editor.getValue();
    const isInitialRender =
      options.isInitialRender || previewEl.innerHTML.trim() === "";
    const forceRender = options.forceRender || false;
    const existingHighlights = new Map();
    const existingCodeBlocks = previewEl.querySelectorAll(
      "[data-syntax-placeholder]",
    );
    existingCodeBlocks.forEach((block) => {
      const code = decodeURIComponent(block.dataset.code);
      const lang = block.dataset.lang;
      const codeElement = block.querySelector("code");
      if (codeElement && code && lang) {
        const key = `${lang}:${code}`;
        existingHighlights.set(key, codeElement.innerHTML);
      }
    });
    const existingMermaidDiagrams = new Map();
    const existingMermaidElements = previewEl.querySelectorAll(
      ".mermaid[data-mermaid-source]",
    );
    existingMermaidElements.forEach((element) => {
      const diagramSource = decodeURIComponent(
        element.dataset.mermaidSource || "",
      );
      if (diagramSource && element.querySelector("svg")) {
        existingMermaidDiagrams.set(diagramSource, element.innerHTML);
      }
    });
    previewEl.innerHTML = this.md.render(src);
    try {
      const newCodeBlocks = previewEl.querySelectorAll(
        "[data-syntax-placeholder]",
      );
      newCodeBlocks.forEach((block) => {
        const code = decodeURIComponent(block.dataset.code);
        const lang = block.dataset.lang;
        const codeElement = block.querySelector("code");
        if (codeElement && code && lang) {
          const key = `${lang}:${code}`;
          if (existingHighlights.has(key)) {
            codeElement.innerHTML = existingHighlights.get(key);
          } else if (this.recentlyHighlighted.has(key)) {
            codeElement.innerHTML = this.recentlyHighlighted.get(key).html;
          } else {
            const similarHighlight = findSimilarHighlight(code, lang);
            if (similarHighlight) {
              codeElement.innerHTML = similarHighlight;
            }
          }
        }
      });
      if (this.syntaxHighlightingTimer) {
        clearTimeout(this.syntaxHighlightingTimer);
      }
      if (isInitialRender) {
        await performSyntaxHighlighting(previewEl);
      } else {
        this.syntaxHighlightingTimer = setTimeout(async () => {
          await performSyntaxHighlighting(previewEl);
        }, SYNTAX_HIGHLIGHT_DELAY);
      }
      await mermaidManager.renderDiagrams(
        previewEl,
        existingMermaidDiagrams,
        isInitialRender,
        forceRender,
      );
    } catch (error) {
      console.error("Rendering failed:", error);
    }
  }
}

const renderer = new Renderer();
export default renderer;

/**
 * Find a similar highlight for blocks being actively edited
 */
function findSimilarHighlight(code, lang) {
  // Look for recently highlighted blocks with the same language
  // that might be similar (for blocks being actively typed)
  for (const [key, data] of recentlyHighlighted.entries()) {
    const [cachedLang, cachedCode] = key.split(":", 2);
    if (cachedLang === lang) {
      // If the new code starts with the cached code (user is adding to it)
      // or cached code starts with new code (user is deleting from it)
      if (code.startsWith(cachedCode) || cachedCode.startsWith(code)) {
        // Only use if the codes are reasonably similar in length
        const lengthDiff = Math.abs(code.length - cachedCode.length);
        const maxLength = Math.max(code.length, cachedCode.length);
        if (lengthDiff / maxLength < 0.3) {
          // Less than 30% difference
          return data.html;
        }
      }
    }
  }
  return null;
}

/**
 * Perform syntax highlighting only for code blocks that need it
 */
async function performSyntaxHighlighting(previewEl) {
  const syntaxPlaceholders = previewEl.querySelectorAll(
    "[data-syntax-placeholder]",
  );
  const blocksToHighlight = [];

  // Only highlight blocks that don't already have highlighting or have changed
  syntaxPlaceholders.forEach((element) => {
    const code = decodeURIComponent(element.dataset.code);
    const language = element.dataset.lang;
    const codeElement = element.querySelector("code");

    if (language && code && codeElement) {
      const key = `${language}:${code}`;

      // Check if this block needs highlighting
      const needsHighlighting =
        // Block has no highlighting (still shows escaped HTML)
        codeElement.innerHTML === MarkdownIt().utils.escapeHtml(code) ||
        // Block is not in our cache (new or changed)
        (!recentlyHighlighted.has(key) &&
          !codeElement.innerHTML.includes("token "));

      if (needsHighlighting) {
        blocksToHighlight.push({ element, code, language, key });
      }
    }
  });

  // Only make API calls for blocks that actually need highlighting
  if (blocksToHighlight.length > 0) {
    console.log(`Highlighting ${blocksToHighlight.length} code blocks`);

    const highlightPromises = blocksToHighlight.map(
      async ({ element, code, language, key }) => {
        try {
          const highlightedCode = await syntaxHighlightingService.highlightCode(
            code,
            language,
          );
          const codeElement = element.querySelector("code");
          if (codeElement) {
            codeElement.innerHTML = highlightedCode;

            // Track this block as recently highlighted
            recentlyHighlighted.set(key, {
              html: highlightedCode,
              timestamp: Date.now(),
            });
          }
        } catch (error) {
          console.warn(
            `Failed to highlight code for language '${language}':`,
            error,
          );
          // Keep the escaped HTML fallback
        }
      },
    );

    // Wait for all highlighting to complete
    await Promise.allSettled(highlightPromises);
  }

  // Clean up old entries from recentlyHighlighted
  cleanupRecentlyHighlighted();
}

/**
 * Clean up old entries from recently highlighted cache
 */
function cleanupRecentlyHighlighted() {
  const now = Date.now();
  for (const [key, data] of recentlyHighlighted.entries()) {
    if (now - data.timestamp > HIGHLIGHT_PRESERVE_TIME) {
      recentlyHighlighted.delete(key);
    }
  }
}
