/**
 * Icon Cache Service
 * Handles client-side caching for icon search results and metadata
 */

class IconCacheService {
  constructor(cacheTimeout = 60000) { // 1 minute default
    this.cache = new Map();
    this.cacheTimeout = cacheTimeout;
  }

  /**
   * Generate a cache key from search parameters
   */
  _generateKey(searchTerm = '', category = 'all', pack = 'all', page = 0, size = 100) {
    return `${searchTerm}-${category}-${pack}-${page}-${size}`;
  }

  /**
   * Get cached result if valid
   */
  get(searchTerm, category, pack, page, size) {
    const cacheKey = this._generateKey(searchTerm, category, pack, page, size);
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    return null;
  }

  /**
   * Set cache result
   */
  set(searchTerm, category, pack, page, size, data) {
    const cacheKey = this._generateKey(searchTerm, category, pack, page, size);
    this.cache.set(cacheKey, {
      data: data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear all cached data
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      timeout: this.cacheTimeout
    };
  }

  /**
   * Clean expired entries
   */
  cleanExpired() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp >= this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }
}

export default IconCacheService;
