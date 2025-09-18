/**
 * MarkdownLintRulesService - Rule management and configuration service
 * 
 * Handles rule persistence, retrieval, and management for markdown linting.
 * Communicates with backend API endpoints for rule storage.
 */

import { Api } from '../../api/api';

export class MarkdownLintRulesService extends Api {
  constructor() {
    super();
    this.serviceUrl = '/markdown-lint';
    this._ruleDefinitions = null;
    this._cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this._cache = new Map();
  }

  /**
   * Get rule definitions from backend or cache
   * @returns {Promise<Object>} Rule definitions object
   */
  async getRuleDefinitions() {
    const cacheKey = 'rule_definitions';
    const cached = this._getCacheEntry(cacheKey);
    
    if (cached) {
      return cached.data;
    }

    try {
      const response = await this.apiCall(`${this.serviceUrl}/rules/definitions`);
      const rules = response.data.rules || {};
      
      this._setCacheEntry(cacheKey, rules);
      return rules;
    } catch (error) {
      console.error('MarkdownLintRulesService: Failed to get rule definitions:', error);
      
      // Return fallback rule definitions if backend fails
      return this._getFallbackRuleDefinitions();
    }
  }

  /**
   * Get user's default rule configuration
   * @returns {Promise<Object>} User default rules
   */
  async getUserDefaults() {
    const cacheKey = 'user_defaults';
    const cached = this._getCacheEntry(cacheKey);
    
    if (cached) {
      return cached.data;
    }

    try {
      const response = await this.apiCall(`${this.serviceUrl}/user/defaults`);
      const rules = response.data.rules || {};
      
      this._setCacheEntry(cacheKey, rules);
      return rules;
    } catch (error) {
      console.debug('MarkdownLintRulesService: User defaults endpoint not available, using system defaults');
      
      // Return sensible defaults if backend fails
      return this._getSystemDefaults();
    }
  }

  /**
   * Save user's default rule configuration
   * @param {Object} rules - Rule configuration object
   * @returns {Promise<void>}
   */
  async saveUserDefaults(rules) {
    try {
      await this.apiCall(`${this.serviceUrl}/user/defaults`, 'PUT', { rules });
      
      // Update cache
      this._setCacheEntry('user_defaults', rules);
      
      console.log('MarkdownLintRulesService: User defaults saved successfully');
    } catch (error) {
      console.error('MarkdownLintRulesService: Failed to save user defaults:', error);
      throw error;
    }
  }

  /**
   * Get category-specific rule configuration
   * @param {number} categoryId - Category ID
   * @returns {Promise<Object>} Category rules
   */
  async getCategoryRules(categoryId) {
    const cacheKey = `category_${categoryId}`;
    const cached = this._getCacheEntry(cacheKey);
    
    if (cached) {
      return cached.data;
    }

    try {
      const response = await this.apiCall(`${this.serviceUrl}/categories/${categoryId}/rules`);
      const rules = response.data.rules || {};
      
      this._setCacheEntry(cacheKey, rules);
      return rules;
    } catch (error) {
      if (error.status === 404) {
        // No category-specific rules configured, this is normal
        console.debug(`MarkdownLintRulesService: No rules configured for category ${categoryId}`);
        return {};
      }
      
      console.error('MarkdownLintRulesService: Failed to get category rules:', error);
      return {};
    }
  }

  /**
   * Save category-specific rule configuration
   * @param {number} categoryId - Category ID
   * @param {Object} rules - Rule configuration object
   * @returns {Promise<void>}
   */
  async saveCategoryRules(categoryId, rules) {
    try {
      await this.apiCall(`${this.serviceUrl}/categories/${categoryId}/rules`, 'PUT', { rules });
      
      // Update cache
      this._setCacheEntry(`category_${categoryId}`, rules);
      
      console.log(`MarkdownLintRulesService: Category ${categoryId} rules saved successfully`);
    } catch (error) {
      console.error('MarkdownLintRulesService: Failed to save category rules:', error);
      throw error;
    }
  }

  /**
   * Get folder-specific rule configuration
   * @param {string} folderPath - Folder path
   * @returns {Promise<Object>} Folder rules
   */
  async getFolderRules(folderPath) {
    const cacheKey = `folder_${folderPath}`;
    const cached = this._getCacheEntry(cacheKey);
    
    if (cached) {
      return cached.data;
    }

    try {
      // Encode folder path for URL
      const encodedPath = encodeURIComponent(folderPath);
      const response = await this.apiCall(`${this.serviceUrl}/folders/${encodedPath}/rules`);
      const rules = response.data.rules || {};
      
      this._setCacheEntry(cacheKey, rules);
      return rules;
    } catch (error) {
      if (error.status === 404) {
        // No folder-specific rules configured, this is normal
        console.debug(`MarkdownLintRulesService: No rules configured for folder ${folderPath}`);
        return {};
      }
      
      console.error('MarkdownLintRulesService: Failed to get folder rules:', error);
      return {};
    }
  }

  /**
   * Save folder-specific rule configuration
   * @param {string} folderPath - Folder path
   * @param {Object} rules - Rule configuration object
   * @returns {Promise<void>}
   */
  async saveFolderRules(folderPath, rules) {
    try {
      const encodedPath = encodeURIComponent(folderPath);
      await this.apiCall(`${this.serviceUrl}/folders/${encodedPath}/rules`, 'PUT', { rules });
      
      // Update cache
      this._setCacheEntry(`folder_${folderPath}`, rules);
      
      console.log(`MarkdownLintRulesService: Folder ${folderPath} rules saved successfully`);
    } catch (error) {
      console.error('MarkdownLintRulesService: Failed to save folder rules:', error);
      throw error;
    }
  }

  /**
   * Delete category-specific rule configuration
   * @param {number} categoryId - Category ID
   * @returns {Promise<void>}
   */
  async deleteCategoryRules(categoryId) {
    try {
      await this.apiCall(`${this.serviceUrl}/categories/${categoryId}/rules`, 'DELETE');
      
      // Clear cache
      this._clearCacheEntry(`category_${categoryId}`);
      
      console.log(`MarkdownLintRulesService: Category ${categoryId} rules deleted successfully`);
    } catch (error) {
      console.error('MarkdownLintRulesService: Failed to delete category rules:', error);
      throw error;
    }
  }

  /**
   * Delete folder-specific rule configuration
   * @param {string} folderPath - Folder path
   * @returns {Promise<void>}
   */
  async deleteFolderRules(folderPath) {
    try {
      const encodedPath = encodeURIComponent(folderPath);
      await this.apiCall(`${this.serviceUrl}/folders/${encodedPath}/rules`, 'DELETE');
      
      // Clear cache
      this._clearCacheEntry(`folder_${folderPath}`);
      
      console.log(`MarkdownLintRulesService: Folder ${folderPath} rules deleted successfully`);
    } catch (error) {
      console.error('MarkdownLintRulesService: Failed to delete folder rules:', error);
      throw error;
    }
  }

  /**
   * Clear all cached rule configurations
   */
  clearCache() {
    this._cache.clear();
    console.log('MarkdownLintRulesService: Cache cleared');
  }

  /**
   * Get cache entry if not expired
   * @param {string} key - Cache key
   * @returns {Object|null} Cached data or null
   * @private
   */
  _getCacheEntry(key) {
    const entry = this._cache.get(key);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > this._cacheTimeout) {
      this._cache.delete(key);
      return null;
    }

    return entry;
  }

  /**
   * Set cache entry with timestamp
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @private
   */
  _setCacheEntry(key, data) {
    this._cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear specific cache entry
   * @param {string} key - Cache key
   * @private
   */
  _clearCacheEntry(key) {
    this._cache.delete(key);
  }

  /**
   * Get system default rules configuration
   * @returns {Object} Default rules
   * @private
   */
  _getSystemDefaults() {
    return {
      // Enable common useful rules by default
      'MD001': true,  // Heading levels should only increment by one level at a time
      'MD003': true,  // Heading style should be consistent
      'MD009': true,  // Trailing spaces
      'MD010': true,  // Hard tabs
      'MD012': true,  // Multiple consecutive blank lines
      'MD018': true,  // No space after hash on atx style heading
      'MD019': true,  // Multiple spaces after hash on atx style heading
      'MD023': true,  // Headings must start at the beginning of the line
      'MD025': true,  // Multiple top level headings in the same document
      'MD041': true,  // First line in file should be a top level heading
      'MD047': true,  // File should end with a single newline character
    };
  }

  /**
   * Get fallback rule definitions when backend is unavailable
   * @returns {Object} Fallback rule definitions
   * @private
   */
  _getFallbackRuleDefinitions() {
    return {
      'MD001': {
        name: 'heading-increment',
        description: 'Heading levels should only increment by one level at a time',
        category: 'headers',
        fixable: false
      },
      'MD003': {
        name: 'heading-style',
        description: 'Heading style should be consistent',
        category: 'headers',
        fixable: true
      },
      'MD009': {
        name: 'no-trailing-spaces',
        description: 'Trailing spaces',
        category: 'whitespace',
        fixable: true
      },
      'MD010': {
        name: 'no-hard-tabs',
        description: 'Hard tabs',
        category: 'whitespace',
        fixable: true
      },
      'MD012': {
        name: 'no-multiple-blanks',
        description: 'Multiple consecutive blank lines',
        category: 'whitespace',
        fixable: true
      },
      'MD018': {
        name: 'no-missing-space-atx',
        description: 'No space after hash on atx style heading',
        category: 'headers',
        fixable: true
      },
      'MD019': {
        name: 'no-multiple-space-atx',
        description: 'Multiple spaces after hash on atx style heading',
        category: 'headers',
        fixable: true
      },
      'MD023': {
        name: 'heading-start-left',
        description: 'Headings must start at the beginning of the line',
        category: 'headers',
        fixable: true
      },
      'MD025': {
        name: 'single-title',
        description: 'Multiple top level headings in the same document',
        category: 'headers',
        fixable: false
      },
      'MD041': {
        name: 'first-line-heading',
        description: 'First line in file should be a top level heading',
        category: 'headers',
        fixable: false
      },
      'MD047': {
        name: 'single-trailing-newline',
        description: 'File should end with a single newline character',
        category: 'whitespace',
        fixable: true
      }
    };
  }
}

// Export singleton instance
export default new MarkdownLintRulesService();