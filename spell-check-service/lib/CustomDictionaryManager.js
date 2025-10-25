/**
 * Custom Dictionary Manager - Phase 3 Implementation
 * Created: October 22, 2025 by AI Agent
 * Purpose: Simple custom words handling for spell-check service
 * Features: Local cache management for custom words passed from backend
 * Integration: Backend provides custom words, spell-check service uses them
 */

const config = require('../config/default-settings.json');

class CustomDictionaryManager {
  constructor() {
    this.cache = new Map(); // Cache for performance: "scope:key" -> Set(words)
    this.cacheExpiry = new Map(); // Cache expiry times
    this.defaultCacheTTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Initialize custom dictionary manager
   */
  async init() {
    console.log('[CustomDictionaryManager] Initializing custom dictionary manager...');
    console.log('[CustomDictionaryManager] Custom dictionary manager ready (backend-integrated mode)');
  }

  /**
   * Get cache key for scope
   * @param {string} scope - 'user', 'category', or 'folder'
   * @param {string|number} identifier - Category ID or folder path
   * @returns {string} Cache key
   */
  _getCacheKey(scope, identifier = null) {
    if (scope === 'user') {
      return 'user:global';
    } else if (scope === 'category') {
      return `category:${identifier}`;
    } else if (scope === 'folder') {
      return `folder:${identifier}`;
    }
    throw new Error(`Invalid scope: ${scope}`);
  }

  /**
   * Check if cache is valid for key
   * @param {string} cacheKey - Cache key
   * @returns {boolean} True if cache is valid
   */
  _isCacheValid(cacheKey) {
    const expiry = this.cacheExpiry.get(cacheKey);
    return expiry && Date.now() < expiry;
  }

  /**
   * Set cache entry
   * @param {string} cacheKey - Cache key
   * @param {Set<string>} words - Words to cache
   */
  _setCache(cacheKey, words) {
    this.cache.set(cacheKey, new Set(words));
    this.cacheExpiry.set(cacheKey, Date.now() + this.defaultCacheTTL);
  }

  /**
   * Process custom words provided by backend
   * This method handles custom words that are passed in from the backend
   * @param {string[]} customWords - Array of custom words from backend
   * @param {Object} options - Scope options for caching
   * @returns {string[]} Processed custom words
   */
  processCustomWords(customWords = [], options = {}) {
    if (!Array.isArray(customWords)) {
      console.warn('[CustomDictionaryManager] Invalid custom words format, expected array');
      return [];
    }

    // Normalize words (lowercase, trim)
    const processedWords = customWords
      .filter(word => word && typeof word === 'string')
      .map(word => word.toLowerCase().trim())
      .filter(word => word.length > 0);

    // Cache the words if scope is provided
    const { categoryId, folderPath } = options;
    if (categoryId || folderPath) {
      const scope = folderPath ? 'folder' : 'category';
      const identifier = folderPath || categoryId;
      const cacheKey = this._getCacheKey(scope, identifier);
      this._setCache(cacheKey, processedWords);
    }

    return processedWords;
  }

  /**
   * Get cached custom words for scope (if available)
   * @param {Object} options - Scope options
   * @returns {string[]} Cached custom words or empty array
   */
  getCachedWords(options = {}) {
    const { categoryId, folderPath } = options;
    
    if (!categoryId && !folderPath) {
      return [];
    }

    const scope = folderPath ? 'folder' : 'category';
    const identifier = folderPath || categoryId;
    const cacheKey = this._getCacheKey(scope, identifier);

    if (this._isCacheValid(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      return cached ? Array.from(cached) : [];
    }

    return [];
  }

  /**
   * Validate custom words format
   * @param {any} customWords - Words to validate
   * @returns {boolean} True if valid format
   */
  validateCustomWords(customWords) {
    if (!customWords) return true; // null/undefined is acceptable
    if (!Array.isArray(customWords)) return false;
    
    return customWords.every(word => 
      typeof word === 'string' && 
      word.trim().length > 0 &&
      word.length <= 100 // Reasonable word length limit
    );
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.cache.clear();
    this.cacheExpiry.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      cacheEntries: this.cache.size,
      cacheKeys: Array.from(this.cache.keys()),
      mode: 'backend-integrated'
    };
  }
}

module.exports = CustomDictionaryManager;