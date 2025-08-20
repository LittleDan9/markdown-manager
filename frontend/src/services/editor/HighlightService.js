/**
 * Syntax highlighting service that uses the backend API for comprehensive language support
 */
import HighlightingApi from "@/api/highlightingApi";

class HighlightService {
  // Cache for recently highlighted blocks for fallback
  recentlyHighlighted = [];
  RECENT_HIGHLIGHT_MAX_AGE = 3000; // ms
  RECENT_HIGHLIGHT_MAX_ENTRIES = 20;

  /**
   * Store a recently highlighted block for fallback
   */
  storeRecentHighlight(language, code, html) {
    const now = Date.now();
    this.recentlyHighlighted.push({ language, code, html, timestamp: now });
    // Remove old entries
    this.recentlyHighlighted = this.recentlyHighlighted.filter(h => now - h.timestamp < this.RECENT_HIGHLIGHT_MAX_AGE);
    // Limit cache size
    if (this.recentlyHighlighted.length > this.RECENT_HIGHLIGHT_MAX_ENTRIES) {
      this.recentlyHighlighted.shift();
    }
  }

  /**
   * Find a similar highlight for fallback
   */
  findSimilarHighlight(language, code) {
    // Only compare blocks with the same language
    for (let i = this.recentlyHighlighted.length - 1; i >= 0; i--) {
      const h = this.recentlyHighlighted[i];
      if (h.language !== language) continue;
      // Heuristic: startsWith, endsWith, or length diff < 20%
      if (
        code.startsWith(h.code) ||
        h.code.startsWith(code) ||
        code.endsWith(h.code) ||
        h.code.endsWith(code) ||
        Math.abs(code.length - h.code.length) / Math.max(code.length, h.code.length) < 0.2
      ) {
        return h.html;
      }
    }
    return null;
  }
  /**
   * Stable hash function for placeholderId
   */
  hashCode(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return hash >>> 0;
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
    return this.cache.has(cacheKey) ? this.cache.get(cacheKey) : null;
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
          this.supportedLanguages.add(language.toLowerCase());
          this.storeRecentHighlight(language, code, highlighted);
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

