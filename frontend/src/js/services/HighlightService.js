/**
 * Syntax highlighting service that uses the backend API for comprehensive language support
 */
import HighlightingApi from "../api/highlightingApi";

class HighlightService {
  constructor() {
    this.cache = new Map(); // Cache highlighted code to avoid redundant API calls
    this.supportedLanguages = new Set(); // Cache of supported languages
  }

   /**
   * Check if highlighted code is in cache
   * @param {string} code
   * @param {string} language
   * @returns {string|null} - Highlighted HTML or null if not cached
   */
  getFromCache(code, language) {
    if (!code || !language) return null;
    const cacheKey = `${language}:${this.hashCode(code)}`;
    return this.cache.has(cacheKey) ? this.cache.get(cacheKey) : null;
  }

  /**
   * Highlight code using the backend API
   * @param {string} previewElement - The source code to highlight
   * @param {string} language - The programming language
   * @returns {Promise<string>} - HTML with syntax highlighting
   */
  async highlight(previewElement) {
    const codeBlocksToProcess = previewElement.querySelectorAll("[data-processed='false'][data-syntax-placeholder]")
    if (codeBlocksToProcess.length === 0) {
      return; // Nothing to highlight
    }

    const highlightPromises = Array.from(codeBlocksToProcess).map(async (block) => {
      const language = block.dataset.lang || "";
      if (!language) return;
      const code = decodeURIComponent(block.dataset.code || "");
      if (!code) return;

      const cached = this.getFromCache(code, language);
      let highlighted;
      if (cached) {
        highlighted = cached;
      } else {
        try {
          highlighted = await HighlightingApi.highlightSyntax(code, language);
          const cacheKey = `${language}:${this.hashCode(code)}`;
          this.cache.set(cacheKey, highlighted);
          this.supportedLanguages.add(language.toLowerCase());
        } catch (error) {
          console.warn(`Failed to highlight code for language '${language}':`, error);
          highlighted = this.escapeHtml(code);
        }
      }
      // Inject the highlighted code into the DOM
      const codeElement = block.querySelector("code");
      if (codeElement) {
        codeElement.innerHTML = highlighted;
        block.setAttribute("data-processed", "true");
      }
    });
    await Promise.all(highlightPromises);
  }

  async isLanguageSupported(language) {
    return HighlightingApi.isLanguageSupported(language);
  }


  /**
   * Clear the highlighting cache
   */
  clearCache() {
    this.cache.clear();
    this.supportedLanguages.clear();
  }

  /**
   * Escape HTML characters
   * @param {string} text - Text to escape
   * @returns {string} - Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Simple hash function for cache keys
   * @param {string} str - String to hash
   * @returns {number} - Hash value
   */
  hashCode(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i); // hash * 33 + c
    }
    return hash >>> 0; // Ensure unsigned 32-bit integer
  }
}

// Export singleton instance
export default new HighlightService();


/*
// Debounce timer for syntax highlighting
let syntaxHighlightingTimer = null;
const SYNTAX_HIGHLIGHT_DELAY = 200; // ms

// Track recently highlighted blocks to preserve them during typing
const recentlyHighlighted = new Map();
const HIGHLIGHT_PRESERVE_TIME = 2000; // ms

  const parser = new DOMParser();
  const newPreviewDoc = parser.parseFromString(newPreview, "text/html");

  if (syntaxHighlightingTimer) {
    clearTimeout(syntaxHighlightingTimer);
  }
  if (isInitialRender) {
    await performSyntaxHighlighting(newPreviewDoc);
  } else {
    syntaxHighlightingTimer = setTimeout(async () => {
      await performSyntaxHighlighting(newPreviewDoc);
    }, SYNTAX_HIGHLIGHT_DELAY);
  }

  return newPreviewDoc.body.innerHTML;

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