/**
 * Syntax highlighting service that uses the backend API for comprehensive language support
 */
import HighlightingApi from "@/api/highlightingApi";

const MAX_CACHE_SIZE = 200;

class HighlightService {
  /**
   * Stable hash function for cache/placeholder keys
   */
  hashCode(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return hash >>> 0;
  }

  /**
   * Build the canonical placeholder ID for a code block
   */
  placeholderId(language, code) {
    return `syntax-highlight-${language}-${this.hashCode(code)}`;
  }

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
    if (!this.cache.has(cacheKey)) return null;
    // Move to end for LRU freshness
    const value = this.cache.get(cacheKey);
    this.cache.delete(cacheKey);
    this.cache.set(cacheKey, value);
    return value;
  }

  /**
   * Highlight multiple code blocks and return a map of placeholderId to highlighted HTML
   * @param {Array<{ code: string, language: string, placeholderId: string }>} blocks
   * @returns {Promise<Object>} - { [placeholderId]: highlightedHTML }
   */
  async highlightBlocks(blocks) {
    const results = {};
    const highlightPromises = blocks.map(async ({ code, language, placeholderId }) => {
      if (!code || !language || !placeholderId) return;
      const cached = this.getFromCache(code, language);
      let highlighted;
      if (cached) {
        highlighted = cached;
      } else {
        try {
          highlighted = await HighlightingApi.highlightSyntax(code, language);
          const cacheKey = `${language}:${this.hashCode(code)}`;
          this.cache.set(cacheKey, highlighted);
          // LRU eviction: remove oldest entries when over limit
          if (this.cache.size > MAX_CACHE_SIZE) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
          }
          this.supportedLanguages.add(language.toLowerCase());
        } catch (error) {
          console.warn(`Failed to highlight code for language '${language}':`, error);
          highlighted = this.escapeHtml(code);
        }
      }
      results[placeholderId] = highlighted;
    });
    await Promise.all(highlightPromises);
    return results;
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
}

// Export singleton instance
export default new HighlightService();

