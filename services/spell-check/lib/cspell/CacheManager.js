/**
 * Cache Management Module
 * Handles LRU caching for spell checking results to improve performance
 */

class CacheManager {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0
    };
  }

  /**
   * Generate cache key for caching results
   * @param {string} code - Code content
   * @param {string} language - Programming language
   * @param {Object} settings - Settings object
   * @returns {string} Cache key
   */
  generateCacheKey(code, language, settings) {
    const settingsStr = JSON.stringify({
      checkComments: settings.checkComments,
      checkStrings: settings.checkStrings,
      checkIdentifiers: settings.checkIdentifiers,
      customWords: settings.customWords?.sort()
    });

    // Use first 100 chars of code + language + settings hash for efficient key
    const codeHash = code.substring(0, 100);
    return `${language}-${codeHash}-${settingsStr}`;
  }

  /**
   * Get cached result
   * @param {string} key - Cache key
   * @returns {*} Cached result or null if not found
   */
  get(key) {
    if (this.cache.has(key)) {
      this.stats.hits++;

      // Move to end for LRU (re-insert)
      const value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value);

      return value;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Set cached result with LRU eviction
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   */
  set(key, value) {
    // If already exists, delete to re-insert at end
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Implement LRU eviction
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, value);
    this.stats.size = this.cache.size;
  }

  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Delete specific cache entry
   * @param {string} key - Cache key to delete
   * @returns {boolean} True if entry was deleted
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.size = this.cache.size;
    }
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0
    };
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: totalRequests > 0
        ? (this.stats.hits / totalRequests * 100).toFixed(2) + '%'
        : '0%',
      missRate: totalRequests > 0
        ? (this.stats.misses / totalRequests * 100).toFixed(2) + '%'
        : '0%',
      totalRequests
    };
  }

  /**
   * Get cache size information
   * @returns {Object} Size information
   */
  getSizeInfo() {
    return {
      currentSize: this.cache.size,
      maxSize: this.maxSize,
      usagePercentage: (this.cache.size / this.maxSize * 100).toFixed(1) + '%',
      availableSlots: this.maxSize - this.cache.size
    };
  }

  /**
   * Get all cache keys (for debugging)
   * @returns {Array} Array of cache keys
   */
  getKeys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache entries count by pattern
   * @param {string} pattern - Pattern to match (language, settings, etc.)
   * @returns {number} Number of matching entries
   */
  getEntriesCountByPattern(pattern) {
    return this.getKeys().filter(key => key.includes(pattern)).length;
  }

  /**
   * Prune cache entries based on pattern
   * @param {string} pattern - Pattern to match for deletion
   * @returns {number} Number of entries deleted
   */
  pruneByPattern(pattern) {
    const keysToDelete = this.getKeys().filter(key => key.includes(pattern));

    keysToDelete.forEach(key => {
      this.cache.delete(key);
    });

    this.stats.size = this.cache.size;
    return keysToDelete.length;
  }

  /**
   * Set maximum cache size and prune if necessary
   * @param {number} newMaxSize - New maximum size
   */
  setMaxSize(newMaxSize) {
    this.maxSize = newMaxSize;

    // Prune oldest entries if current size exceeds new max
    while (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.stats.size = this.cache.size;
  }

  /**
   * Get the most recently used entries
   * @param {number} count - Number of entries to return
   * @returns {Array} Array of [key, value] pairs
   */
  getMostRecentEntries(count = 5) {
    const entries = Array.from(this.cache.entries());
    return entries.slice(-count);
  }

  /**
   * Get the least recently used entries
   * @param {number} count - Number of entries to return
   * @returns {Array} Array of [key, value] pairs
   */
  getLeastRecentEntries(count = 5) {
    const entries = Array.from(this.cache.entries());
    return entries.slice(0, count);
  }

  /**
   * Get cache memory usage estimation
   * @returns {Object} Memory usage information
   */
  getMemoryUsage() {
    let totalMemory = 0;

    for (const [key, value] of this.cache) {
      // Rough estimation: key length + JSON string length of value
      totalMemory += key.length * 2; // Assuming 2 bytes per char for UTF-16
      totalMemory += JSON.stringify(value).length * 2;
    }

    return {
      estimatedBytes: totalMemory,
      estimatedKB: (totalMemory / 1024).toFixed(2),
      estimatedMB: (totalMemory / (1024 * 1024)).toFixed(3),
      entriesCount: this.cache.size,
      avgBytesPerEntry: this.cache.size > 0 ? (totalMemory / this.cache.size).toFixed(0) : 0
    };
  }

  /**
   * Export cache state for debugging or persistence
   * @returns {Object} Cache state
   */
  exportState() {
    return {
      entries: Array.from(this.cache.entries()),
      stats: this.getStats(),
      config: {
        maxSize: this.maxSize
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Import cache state (useful for testing or persistence)
   * @param {Object} state - Cache state to import
   */
  importState(state) {
    this.clear();
    this.maxSize = state.config?.maxSize || this.maxSize;

    if (state.entries) {
      for (const [key, value] of state.entries) {
        this.set(key, value);
      }
    }
  }

  /**
   * Performance monitoring: Get average cache access time
   * This would require instrumentation in real usage
   * @returns {Object} Performance metrics
   */
  getPerformanceMetrics() {
    return {
      hitRate: this.getStats().hitRate,
      cacheEfficiency: this.cache.size > 0 ? 'Good' : 'Empty',
      recommendedAction: this.stats.hits > this.stats.misses * 2 ?
        'Cache is effective' :
        'Consider increasing cache size or reviewing cache keys'
    };
  }
}

module.exports = CacheManager;