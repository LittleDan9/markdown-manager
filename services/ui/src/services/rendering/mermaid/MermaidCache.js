/**
 * Mermaid diagram caching service
 * Handles caching of rendered diagrams for performance optimization
 */
class MermaidCache {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Get cached diagram
   * @param {string} diagramSource - The diagram source code
   * @returns {string|null} - Cached SVG HTML or null if not found
   */
  get(diagramSource) {
    return this.cache.get(diagramSource) || null;
  }

  /**
   * Set cached diagram
   * @param {string} diagramSource - The diagram source code
   * @param {string} svgHtml - The rendered SVG HTML
   */
  set(diagramSource, svgHtml) {
    this.cache.set(diagramSource, svgHtml);
  }

  /**
   * Check if diagram is cached
   * @param {string} diagramSource - The diagram source code
   * @returns {boolean} - True if cached
   */
  has(diagramSource) {
    return this.cache.has(diagramSource);
  }

  /**
   * Clear all cached diagrams
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache size
   * @returns {number} - Number of cached diagrams
   */
  size() {
    return this.cache.size;
  }

  /**
   * Remove specific diagram from cache
   * @param {string} diagramSource - The diagram source code
   */
  delete(diagramSource) {
    this.cache.delete(diagramSource);
  }
}

export default MermaidCache;
