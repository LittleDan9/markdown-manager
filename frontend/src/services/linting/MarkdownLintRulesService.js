/**
 * MarkdownLintRulesService - Core service for markdown lint rules management
 * Handles rule hierarchy, localStorage caching, and validation logic
 */

const STORAGE_KEY = 'markdownLintRules';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export class MarkdownLintRulesService {
  /**
   * Get effective rules for a document by building hierarchy
   * @param {number} userId - User ID
   * @param {number|null} categoryId - Category ID (optional)
   * @param {string|null} folderPath - Folder path (optional)
   * @returns {Promise<Object>} Merged rules object
   */
  static async getEffectiveRules(userId, categoryId = null, folderPath = null) {
    try {
      const cachedRules = this.getCachedRules(userId, categoryId, folderPath);
      if (cachedRules) {
        return cachedRules;
      }

      // Build hierarchy from most general to most specific
      const hierarchy = this.buildRuleHierarchy(userId, categoryId, folderPath);
      const effectiveRules = await this.mergeRuleHierarchy(hierarchy);

      // Cache the result
      this.setCachedRules(userId, categoryId, folderPath, effectiveRules);

      return effectiveRules;
    } catch (error) {
      console.error('Error getting effective rules:', error);
      return this.getDefaultRules();
    }
  }

  /**
   * Build rule hierarchy array from general to specific
   * @param {number} userId - User ID
   * @param {number|null} categoryId - Category ID
   * @param {string|null} folderPath - Folder path
   * @returns {Array} Hierarchy of rule contexts
   */
  static buildRuleHierarchy(userId, categoryId, folderPath) {
    const hierarchy = [
      { scope: 'user', userId }
    ];

    if (categoryId) {
      hierarchy.push({ scope: 'category', userId, categoryId });
    }

    if (folderPath && folderPath !== '/') {
      // Add folder hierarchy (parent folders first)
      const folders = this.getFolderHierarchy(folderPath);
      folders.forEach(folder => {
        hierarchy.push({
          scope: 'folder',
          userId,
          categoryId,
          folderPath: folder
        });
      });
    }

    return hierarchy;
  }

  /**
   * Get folder hierarchy from root to target folder
   * @param {string} folderPath - Target folder path
   * @returns {Array<string>} Array of folder paths from root to target
   */
  static getFolderHierarchy(folderPath) {
    if (!folderPath || folderPath === '/') {
      return [];
    }

    const parts = folderPath.split('/').filter(part => part.length > 0);
    const hierarchy = [];

    for (let i = 0; i < parts.length; i++) {
      const path = '/' + parts.slice(0, i + 1).join('/');
      hierarchy.push(path);
    }

    return hierarchy;
  }

  /**
   * Merge rule hierarchy to get effective rules
   * @param {Array} hierarchy - Rule hierarchy contexts
   * @returns {Promise<Object>} Merged rules object
   */
  static async mergeRuleHierarchy(hierarchy) {
    let effectiveRules = this.getDefaultRules();

    for (const context of hierarchy) {
      try {
        const rules = await this.getRulesForContext(context);
        if (rules && rules.rules) {
          effectiveRules = this.mergeRules(effectiveRules, rules.rules);
        }
      } catch (error) {
        console.warn('Failed to get rules for context:', context, error);
      }
    }

    return effectiveRules;
  }

  /**
   * Get rules for a specific context from API
   * @param {Object} context - Rule context (scope, userId, etc.)
   * @returns {Promise<Object|null>} Rules object or null
   */
  static async getRulesForContext(context) {
    // This will be injected by the hook to avoid circular dependencies
    if (!this._apiClient) {
      throw new Error('API client not configured');
    }

    try {
      return await this._apiClient.getRules(context);
    } catch (error) {
      if (error.response?.status === 404) {
        return null; // No rules found for this context
      }
      throw error;
    }
  }

  /**
   * Set API client instance (dependency injection)
   * @param {Object} apiClient - MarkdownLintApi instance
   */
  static setApiClient(apiClient) {
    this._apiClient = apiClient;
  }

  /**
   * Merge two rule objects (specific overrides general)
   * @param {Object} generalRules - General rules object
   * @param {Object} specificRules - Specific rules object
   * @returns {Object} Merged rules object
   */
  static mergeRules(generalRules, specificRules) {
    return {
      ...generalRules,
      ...specificRules
    };
  }

  /**
   * Get default markdown-lint rules
   * @returns {Object} Default rules configuration
   */
  static getDefaultRules() {
    return {
      'MD001': true,  // Heading levels should only increment by one level at a time
      'MD003': { style: 'atx' }, // Heading style
      'MD004': { style: 'dash' }, // Unordered list style
      'MD005': true,  // Inconsistent indentation for list items at the same level
      'MD007': { indent: 2 }, // Unordered list indentation
      'MD009': true,  // Trailing spaces
      'MD010': true,  // Hard tabs
      'MD011': true,  // Reversed link syntax
      'MD012': { maximum: 1 }, // Multiple consecutive blank lines
      'MD013': { line_length: 80 }, // Line length
      'MD014': true,  // Dollar signs used before commands without showing output
      'MD018': true,  // No space after hash on atx style heading
      'MD019': true,  // Multiple spaces after hash on atx style heading
      'MD020': true,  // No space inside hashes on closed atx style heading
      'MD021': true,  // Multiple spaces inside hashes on closed atx style heading
      'MD022': true,  // Headings should be surrounded by blank lines
      'MD023': true,  // Headings must start at the beginning of the line
      'MD024': true,  // Multiple headings with the same content
      'MD025': true,  // Multiple top level headings in the same document
      'MD026': true,  // Trailing punctuation in heading
      'MD027': true,  // Multiple spaces after blockquote symbol
      'MD028': true,  // Blank line inside blockquote
      'MD029': { style: 'ordered' }, // Ordered list item prefix
      'MD030': true,  // Spaces after list markers
      'MD031': true,  // Fenced code blocks should be surrounded by blank lines
      'MD032': true,  // Lists should be surrounded by blank lines
      'MD033': true,  // Inline HTML
      'MD034': true,  // Bare URL used
      'MD035': true,  // Horizontal rule style
      'MD036': true,  // Emphasis used instead of a heading
      'MD037': true,  // Spaces inside emphasis markers
      'MD038': true,  // Spaces inside code span elements
      'MD039': true,  // Spaces inside link text
      'MD040': true,  // Fenced code blocks should have a language specified
      'MD041': true,  // First line in file should be a top level heading
      'MD042': true,  // No empty links
      'MD043': false, // Required heading structure (disabled by default)
      'MD044': true,  // Proper names should have the correct capitalization
      'MD045': true,  // Images should have alternate text (alt text)
      'MD046': { style: 'fenced' }, // Code block style
      'MD047': true,  // Files should end with a single newline character
      'MD048': { style: 'backtick' }, // Code fence style
      'MD049': { style: 'underscore' }, // Emphasis style
      'MD050': { style: 'asterisk' }, // Strong style
      'MD051': true,  // Link fragments should be valid
      'MD052': true,  // Reference links and images should use a label that is defined
      'MD053': true   // Link and image reference definitions should be needed
    };
  }

  /**
   * Validate rules object structure
   * @param {Object} rules - Rules object to validate
   * @returns {boolean} True if valid
   */
  static validateRules(rules) {
    if (!rules || typeof rules !== 'object') {
      return false;
    }

    // Check if all keys are valid rule names (MD### format)
    const validRulePattern = /^MD\d{3}$/;
    return Object.keys(rules).every(key => validRulePattern.test(key));
  }

  /**
   * Get cache key for rule context
   * @param {number} userId - User ID
   * @param {number|null} categoryId - Category ID
   * @param {string|null} folderPath - Folder path
   * @returns {string} Cache key
   */
  static getCacheKey(userId, categoryId, folderPath) {
    const parts = [userId];
    if (categoryId) parts.push(`cat:${categoryId}`);
    if (folderPath) parts.push(`folder:${folderPath}`);
    return parts.join('|');
  }

  /**
   * Get cached rules if valid and not expired
   * @param {number} userId - User ID
   * @param {number|null} categoryId - Category ID
   * @param {string|null} folderPath - Folder path
   * @returns {Object|null} Cached rules or null
   */
  static getCachedRules(userId, categoryId, folderPath) {
    try {
      const cacheKey = this.getCacheKey(userId, categoryId, folderPath);
      const cached = localStorage.getItem(`${STORAGE_KEY}:${cacheKey}`);

      if (!cached) {
        return null;
      }

      const data = JSON.parse(cached);
      const now = Date.now();

      if (now - data.timestamp > CACHE_EXPIRY_MS) {
        // Expired, remove from cache
        localStorage.removeItem(`${STORAGE_KEY}:${cacheKey}`);
        return null;
      }

      return data.rules;
    } catch (error) {
      console.warn('Error reading cached rules:', error);
      return null;
    }
  }

  /**
   * Cache rules with timestamp
   * @param {number} userId - User ID
   * @param {number|null} categoryId - Category ID
   * @param {string|null} folderPath - Folder path
   * @param {Object} rules - Rules to cache
   */
  static setCachedRules(userId, categoryId, folderPath, rules) {
    try {
      const cacheKey = this.getCacheKey(userId, categoryId, folderPath);
      const data = {
        rules,
        timestamp: Date.now()
      };

      localStorage.setItem(`${STORAGE_KEY}:${cacheKey}`, JSON.stringify(data));
    } catch (error) {
      console.warn('Error caching rules:', error);
    }
  }

  /**
   * Clear cached rules for specific context
   * @param {number} userId - User ID
   * @param {number|null} categoryId - Category ID
   * @param {string|null} folderPath - Folder path
   */
  static clearCachedRules(userId, categoryId, folderPath) {
    try {
      const cacheKey = this.getCacheKey(userId, categoryId, folderPath);
      localStorage.removeItem(`${STORAGE_KEY}:${cacheKey}`);
    } catch (error) {
      console.warn('Error clearing cached rules:', error);
    }
  }

  /**
   * Clear all cached rules for a user
   * @param {number} userId - User ID
   */
  static clearAllCachedRules(userId) {
    try {
      const keys = Object.keys(localStorage);
      const prefix = `${STORAGE_KEY}:${userId}`;

      keys.forEach(key => {
        if (key.startsWith(prefix)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Error clearing all cached rules:', error);
    }
  }

  /**
   * Get cache statistics
   * @param {number} userId - User ID
   * @returns {Object} Cache statistics
   */
  static getCacheStats(userId) {
    try {
      const keys = Object.keys(localStorage);
      const prefix = `${STORAGE_KEY}:${userId}`;
      const userCacheKeys = keys.filter(key => key.startsWith(prefix));

      let totalSize = 0;
      let expiredCount = 0;
      const now = Date.now();

      userCacheKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
          totalSize += value.length;

          try {
            const data = JSON.parse(value);
            if (now - data.timestamp > CACHE_EXPIRY_MS) {
              expiredCount++;
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }
      });

      return {
        totalEntries: userCacheKeys.length,
        totalSize,
        expiredEntries: expiredCount,
        cacheExpiry: CACHE_EXPIRY_MS
      };
    } catch (error) {
      console.warn('Error getting cache stats:', error);
      return {
        totalEntries: 0,
        totalSize: 0,
        expiredEntries: 0,
        cacheExpiry: CACHE_EXPIRY_MS
      };
    }
  }
}

export default MarkdownLintRulesService;
