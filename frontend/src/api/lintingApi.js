/**
 * Linting API - Clean interface for all markdown linting operations
 *
 * Provides:
 * - User rule configuration management
 * - Document linting processing
 * - Rule definitions and defaults
 * - Category/folder-specific rules
 */

import { Api } from './api';

class LintingApi extends Api {
  /**
   * Get user's linting configuration
   * Returns null if user has no settings (should use defaults)
   * Returns {} if user explicitly disabled all rules
   * Returns rule object if user has custom configuration
   */
  async getUserConfig() {
    try {
      const response = await this.apiCall('/markdown-lint/user/defaults');
      return response.data;
    } catch (error) {
      if (error.status === 404) {
        return null; // User has no configuration, should use defaults
      }
      throw error;
    }
  }

  /**
   * Save user's linting configuration
   * @param {Object} rules - Rule configuration object
   * @param {string} description - Optional description
   * @param {boolean} enabled - Whether linting is globally enabled
   */
  async saveUserConfig(rules, description = null, enabled = true) {
    const response = await this.apiCall('/markdown-lint/user/defaults', 'PUT', {
      rules,
      description,
      enabled
    });
    return response.data;
  }

  /**
   * Delete user's linting configuration (reset to defaults)
   */
  async deleteUserConfig() {
    await this.apiCall('/markdown-lint/user/defaults', 'DELETE');
  }

  /**
   * Get recommended default rules from the system
   */
  async getRecommendedDefaults() {
    const response = await this.apiCall('/markdown-lint/rules/recommended-defaults');
    return response.data.rules;
  }

  /**
   * Get rule definitions (descriptions, configuration options)
   */
  async getRuleDefinitions() {
    const response = await this.apiCall('/markdown-lint/rules/definitions');
    return response.data.rules;
  }

  /**
   * Get effective rules for linting (with proper fallback logic)
   * This is what the editor should use for actual linting
   */
  async getEffectiveRules() {
    try {
      // Check if user has a token (simple authentication check)
      const token = this.getToken();

      if (!token) {
        // User not authenticated, use recommended defaults
        console.log('User not authenticated, using recommended defaults for markdown lint');
        return await this.getRecommendedDefaults();
      }

      // User is authenticated, try to get their configuration
      const userConfig = await this.getUserConfig();

      if (userConfig === null) {
        // User has no configuration, use recommended defaults
        return await this.getRecommendedDefaults();
      }

      if (userConfig.enabled === false) {
        // User has globally disabled linting
        return {};
      }

      // User has custom rules (including {} for all rules disabled)
      return userConfig.rules || {};

    } catch (error) {
      // On any error (including 403), fall back to public defaults
      console.warn('Failed to get effective rules, falling back to defaults:', error);
      try {
        return await this.getRecommendedDefaults();
      } catch (defaultsError) {
        console.error('Failed to get defaults, using empty rules:', defaultsError);
        return {};
      }
    }
  }

  /**
   * Process markdown text for linting issues
   * @param {string} text - Markdown content to lint
   * @param {Object} rules - Rules to apply (optional, will use effective rules if not provided)
   * @param {number} chunkOffset - Offset for chunked processing
   */
  async processText(text, options = {}) {
    const response = await this.apiCall('/markdown-lint/process', 'POST', {
      text: text,
      rules: options.rules || {},
      chunk_offset: options.chunk_offset || 0
    });
    return response.data;
  }

  /**
   * Get category-specific rules
   * @param {number} categoryId - Category ID
   */
  async getCategoryRules(categoryId) {
    try {
      const response = await this.apiCall(`/markdown-lint/categories/${categoryId}/rules`);
      return response.data;
    } catch (error) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Save category-specific rules
   * @param {number} categoryId - Category ID
   * @param {Object} rules - Rule configuration
   * @param {string} description - Optional description
   */
  async saveCategoryRules(categoryId, rules, description = null) {
    const response = await this.apiCall(`/markdown-lint/categories/${categoryId}/rules`, 'PUT', {
      rules,
      description
    });
    return response.data;
  }

  /**
   * Delete category-specific rules
   * @param {number} categoryId - Category ID
   */
  async deleteCategoryRules(categoryId) {
    await this.apiCall(`/markdown-lint/categories/${categoryId}/rules`, 'DELETE');
  }

  /**
   * Get folder-specific rules
   * @param {string} folderPath - Folder path
   */
  async getFolderRules(folderPath) {
    try {
      const encodedPath = encodeURIComponent(folderPath);
      const response = await this.apiCall(`/markdown-lint/folders/${encodedPath}/rules`);
      return response.data;
    } catch (error) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Save folder-specific rules
   * @param {string} folderPath - Folder path
   * @param {Object} rules - Rule configuration
   * @param {string} description - Optional description
   */
  async saveFolderRules(folderPath, rules, description = null) {
    const encodedPath = encodeURIComponent(folderPath);
    const response = await this.apiCall(`/markdown-lint/folders/${encodedPath}/rules`, 'PUT', {
      rules,
      description
    });
    return response.data;
  }

  /**
   * Delete folder-specific rules
   * @param {string} folderPath - Folder path
   */
  async deleteFolderRules(folderPath) {
    const encodedPath = encodeURIComponent(folderPath);
    await this.apiCall(`/markdown-lint/folders/${encodedPath}/rules`, 'DELETE');
  }

  /**
   * Check lint service health
   */
  async checkHealth() {
    const response = await this.apiCall('/markdown-lint/health');
    return response.data;
  }
}

// Export singleton instance
export default new LintingApi();