/**
 * Custom Dictionary Manager - Phase 5 Implementation
 * Created: October 22, 2025 by AI Agent (Updated for Phase 5)
 * Purpose: Local database-driven custom words handling for spell-check service
 * Features: Direct database queries, user identity validation, local caching
 * Integration: Self-contained dictionary management with event emission
 */

const spellDatabase = require('./database/models');
const { v4: uuidv4 } = require('uuid');

class CustomDictionaryManager {
  constructor() {
    this.cache = new Map(); // Cache for performance: "tenant:user" -> {words, expiry}
    this.defaultCacheTTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Initialize custom dictionary manager
   */
  async init() {
    console.log('[CustomDictionaryManager] Initializing custom dictionary manager...');
    console.log('[CustomDictionaryManager] Custom dictionary manager ready (local database mode)');
  }

  /**
   * Get cache key for user
   * @param {string} tenantId - Tenant UUID
   * @param {string} userId - User UUID
   * @returns {string} Cache key
   */
  _getCacheKey(tenantId, userId) {
    return `${tenantId}:${userId}`;
  }

  /**
   * Check if cache is valid for key
   * @param {string} cacheKey - Cache key
   * @returns {boolean} True if cache is valid
   */
  _isCacheValid(cacheKey) {
    const cached = this.cache.get(cacheKey);
    return cached && Date.now() < cached.expiry;
  }

  /**
   * Set cache entry
   * @param {string} cacheKey - Cache key
   * @param {string[]} words - Words to cache
   * @param {number} version - Dictionary version
   */
  _setCache(cacheKey, words, version) {
    this.cache.set(cacheKey, {
      words: new Set(words),
      version,
      expiry: Date.now() + this.defaultCacheTTL
    });
  }

  /**
   * Parse tenant and user IDs from various input formats
   * @param {Object} options - Options containing user identification
   * @returns {Object} Parsed tenant and user IDs
   */
  _parseUserIds(options) {
    const { authToken, userId, tenantId } = options;

    // For Phase 5, we'll use a simple mapping
    // In production, you'd decode the authToken to get tenant/user info
    if (tenantId && userId) {
      return { tenantId, userId };
    }

    // Default tenant for backward compatibility
    const defaultTenantId = process.env.DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000000';

    if (userId) {
      return { tenantId: defaultTenantId, userId };
    }

    // Try to extract from authToken (simplified)
    if (authToken && userId) {
      return { tenantId: defaultTenantId, userId };
    }

    throw new Error('Unable to determine tenant and user IDs from provided options');
  }

  /**
   * Get custom words for user (replaces backend API call)
   * @param {Object} options - User identification and scope
   * @returns {Promise<string[]>} Array of custom words
   */
  async getCustomWords(options = {}) {
    try {
      const { tenantId, userId } = this._parseUserIds(options);
      const cacheKey = this._getCacheKey(tenantId, userId);

      // Check cache first
      if (this._isCacheValid(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        console.log(`[CustomDictionaryManager] Retrieved ${cached.words.size} words from cache for user ${userId}`);
        return Array.from(cached.words);
      }

      // Verify user is active
      const identity = await spellDatabase.getIdentityProjection(tenantId, userId);
      if (!identity || identity.status !== 'active') {
        console.warn(`[CustomDictionaryManager] User ${userId} not found or inactive`);
        return [];
      }

      // Get dictionary from database
      const dictionary = await spellDatabase.getUserDictionary(tenantId, userId);
      if (!dictionary) {
        console.log(`[CustomDictionaryManager] No dictionary found for user ${userId}, initializing empty dictionary`);
        await spellDatabase.upsertUserDictionary(tenantId, userId, []);
        return [];
      }

      const words = dictionary.words || [];

      // Cache the results
      this._setCache(cacheKey, words, dictionary.version);

      console.log(`[CustomDictionaryManager] Retrieved ${words.length} words from database for user ${userId}`);
      return words;
    } catch (error) {
      console.error('[CustomDictionaryManager] Failed to get custom words:', error);
      return [];
    }
  }

  /**
   * Add words to user dictionary
   * @param {Object} options - User identification and words to add
   * @returns {Promise<boolean>} Success status
   */
  async addCustomWords(options = {}) {
    try {
      const { tenantId, userId } = this._parseUserIds(options);
      const { words } = options;

      if (!Array.isArray(words) || words.length === 0) {
        throw new Error('Words array is required');
      }

      // Verify user is active
      const identity = await spellDatabase.getIdentityProjection(tenantId, userId);
      if (!identity || identity.status !== 'active') {
        throw new Error(`User ${userId} not found or inactive`);
      }

      // Add words to database
      const updated = await spellDatabase.addWordsToUserDictionary(tenantId, userId, words);

      // Clear cache to force refresh
      const cacheKey = this._getCacheKey(tenantId, userId);
      this.cache.delete(cacheKey);

      // Emit dictionary updated event
      await this._emitDictionaryUpdatedEvent(tenantId, userId, updated.words, updated.version);

      console.log(`[CustomDictionaryManager] Added ${words.length} words for user ${userId}`);
      return true;
    } catch (error) {
      console.error('[CustomDictionaryManager] Failed to add custom words:', error);
      throw error;
    }
  }

  /**
   * Remove words from user dictionary
   * @param {Object} options - User identification and words to remove
   * @returns {Promise<boolean>} Success status
   */
  async removeCustomWords(options = {}) {
    try {
      const { tenantId, userId } = this._parseUserIds(options);
      const { words } = options;

      if (!Array.isArray(words) || words.length === 0) {
        throw new Error('Words array is required');
      }

      // Verify user is active
      const identity = await spellDatabase.getIdentityProjection(tenantId, userId);
      if (!identity || identity.status !== 'active') {
        throw new Error(`User ${userId} not found or inactive`);
      }

      // Remove words from database
      const updated = await spellDatabase.removeWordsFromUserDictionary(tenantId, userId, words);

      // Clear cache to force refresh
      const cacheKey = this._getCacheKey(tenantId, userId);
      this.cache.delete(cacheKey);

      // Emit dictionary updated event
      await this._emitDictionaryUpdatedEvent(tenantId, userId, updated.words, updated.version);

      console.log(`[CustomDictionaryManager] Removed ${words.length} words for user ${userId}`);
      return true;
    } catch (error) {
      console.error('[CustomDictionaryManager] Failed to remove custom words:', error);
      throw error;
    }
  }

  /**
   * Update entire user dictionary
   * @param {Object} options - User identification and new words
   * @returns {Promise<boolean>} Success status
   */
  async updateUserDictionary(options = {}) {
    try {
      const { tenantId, userId } = this._parseUserIds(options);
      const { words, version } = options;

      if (!Array.isArray(words)) {
        throw new Error('Words array is required');
      }

      // Verify user is active
      const identity = await spellDatabase.getIdentityProjection(tenantId, userId);
      if (!identity || identity.status !== 'active') {
        throw new Error(`User ${userId} not found or inactive`);
      }

      // Update dictionary in database
      const updated = await spellDatabase.upsertUserDictionary(tenantId, userId, words, version);

      // Clear cache to force refresh
      const cacheKey = this._getCacheKey(tenantId, userId);
      this.cache.delete(cacheKey);

      // Emit dictionary updated event
      await this._emitDictionaryUpdatedEvent(tenantId, userId, updated.words, updated.version);

      console.log(`[CustomDictionaryManager] Updated dictionary for user ${userId} with ${words.length} words`);
      return true;
    } catch (error) {
      console.error('[CustomDictionaryManager] Failed to update user dictionary:', error);
      throw error;
    }
  }

  /**
   * Emit dictionary updated event to outbox
   * @private
   */
  async _emitDictionaryUpdatedEvent(tenantId, userId, words, version) {
    try {
      const payload = {
        user_id: userId,
        words: words || [],
        version: version
      };

      await spellDatabase.addToOutbox('DictUpdated', tenantId, userId, payload);
      console.log(`[CustomDictionaryManager] Emitted DictUpdated event for user ${userId}`);
    } catch (error) {
      console.error('[CustomDictionaryManager] Failed to emit dictionary updated event:', error);
      // Don't throw - this is non-critical
    }
  }

  /**
   * Search user dictionary (for autocomplete)
   * @param {Object} options - User identification and search term
   * @returns {Promise<string[]>} Matching words
   */
  async searchUserDictionary(options = {}) {
    try {
      const { tenantId, userId } = this._parseUserIds(options);
      const { searchTerm, limit = 20 } = options;

      if (!searchTerm || typeof searchTerm !== 'string') {
        return [];
      }

      const results = await spellDatabase.searchUserDictionary(tenantId, userId, searchTerm, limit);
      return results;
    } catch (error) {
      console.error('[CustomDictionaryManager] Failed to search user dictionary:', error);
      return [];
    }
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
    console.log('[CustomDictionaryManager] Cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    const stats = {
      cacheEntries: this.cache.size,
      cacheKeys: Array.from(this.cache.keys()),
      mode: 'local-database'
    };

    // Add cache hit information
    const cacheInfo = [];
    for (const [key, data] of this.cache.entries()) {
      cacheInfo.push({
        key,
        wordCount: data.words ? data.words.size : 0,
        version: data.version,
        expiresIn: Math.max(0, data.expiry - Date.now())
      });
    }
    stats.cacheDetails = cacheInfo;

    return stats;
  }
}

module.exports = CustomDictionaryManager;