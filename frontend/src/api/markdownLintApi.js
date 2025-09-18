import { Api } from './api';

/**
 * API client for markdown linting rules
 * Handles communication with backend for rule persistence
 */
export class MarkdownLintApi extends Api {

  /**
   * Get category-specific rules
   * @param {number} categoryId - Category ID
   * @returns {Promise<Object>} Category rules configuration
   */
  async getCategoryRules(categoryId) {
    const response = await this.apiCall(`/markdown-lint/categories/${categoryId}/rules`);
    return response.data;
  }

  /**
   * Update category-specific rules
   * @param {number} categoryId - Category ID
   * @param {Object} rules - Rule configuration object
   * @returns {Promise<Object>} Updated rule configuration
   */
  async updateCategoryRules(categoryId, rules) {
    const response = await this.apiCall(`/markdown-lint/categories/${categoryId}/rules`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rules })
    });
    return response.data;
  }

  /**
   * Get folder-specific rules
   * @param {string} folderPath - Folder path
   * @returns {Promise<Object>} Folder rules configuration
   */
  async getFolderRules(folderPath) {
    const encodedPath = encodeURIComponent(folderPath);
    const response = await this.apiCall(`/markdown-lint/folders/${encodedPath}/rules`);
    return response.data;
  }

  /**
   * Update folder-specific rules
   * @param {string} folderPath - Folder path
   * @param {Object} rules - Rule configuration object
   * @returns {Promise<Object>} Updated rule configuration
   */
  async updateFolderRules(folderPath, rules) {
    const encodedPath = encodeURIComponent(folderPath);
    const response = await this.apiCall(`/markdown-lint/folders/${encodedPath}/rules`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rules })
    });
    return response.data;
  }

  /**
   * Get user default rules
   * @returns {Promise<Object>} User default rules configuration
   */
  async getUserDefaultRules() {
    const response = await this.apiCall('/markdown-lint/user/defaults');
    return response.data;
  }

  /**
   * Get rules for a specific context (used by MarkdownLintRulesService)
   * @param {Object} context - Rule context with scope, userId, etc.
   * @returns {Promise<Object|null>} Rules object or null
   */
  async getRules(context) {
    const { scope, userId, categoryId, folderPath } = context;

    try {
      switch (scope) {
        case 'user':
          return await this.getUserDefaultRules();

        case 'category':
          if (!categoryId) {
            throw new Error('Category ID required for category scope');
          }
          return await this.getCategoryRules(categoryId);

        case 'folder':
          if (!folderPath) {
            throw new Error('Folder path required for folder scope');
          }
          return await this.getFolderRules(folderPath);

        default:
          throw new Error(`Unknown scope: ${scope}`);
      }
    } catch (error) {
      // Re-throw to let the service handle 404s appropriately
      throw error;
    }
  }

  /**
   * Update user default rules
   * @param {Object} rules - Rule configuration object
   * @returns {Promise<Object>} Updated rule configuration
   */
  async updateUserDefaultRules(rules) {
    const response = await this.apiCall('/markdown-lint/user/defaults', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rules })
    });
    return response.data;
  }

  /**
   * Get all rule definitions and descriptions
   * @returns {Promise<Object>} Rule definitions with metadata
   */
  async getRuleDefinitions() {
    const response = await this.apiCall('/markdown-lint/rules/definitions');
    return response.data;
  }

  /**
   * Delete category-specific rules
   * @param {number} categoryId - Category ID
   * @returns {Promise<void>}
   */
  async deleteCategoryRules(categoryId) {
    await this.apiCall(`/markdown-lint/categories/${categoryId}/rules`, {
      method: 'DELETE'
    });
  }

  /**
   * Delete folder-specific rules
   * @param {string} folderPath - Folder path
   * @returns {Promise<void>}
   */
  async deleteFolderRules(folderPath) {
    const encodedPath = encodeURIComponent(folderPath);
    await this.apiCall(`/markdown-lint/folders/${encodedPath}/rules`, {
      method: 'DELETE'
    });
  }

  /**
   * Delete user default rules
   * @returns {Promise<void>}
   */
  async deleteUserDefaultRules() {
    await this.apiCall('/markdown-lint/user/defaults', {
      method: 'DELETE'
    });
  }

  /**
   * Create or update rules for a specific context (used by hook)
   * @param {Object} context - Rule context with scope, userId, rules, etc.
   * @returns {Promise<Object>} Updated rule configuration
   */
  async createOrUpdateRules(context) {
    const { scope, userId, categoryId, folderPath, rules } = context;

    switch (scope) {
      case 'user':
        return await this.updateUserDefaultRules(rules);

      case 'category':
        if (!categoryId) {
          throw new Error('Category ID required for category scope');
        }
        return await this.updateCategoryRules(categoryId, rules);

      case 'folder':
        if (!folderPath) {
          throw new Error('Folder path required for folder scope');
        }
        return await this.updateFolderRules(folderPath, rules);

      default:
        throw new Error(`Unknown scope: ${scope}`);
    }
  }

  /**
   * Delete rules for a specific context (used by hook)
   * @param {Object} context - Rule context with scope, userId, etc.
   * @returns {Promise<void>}
   */
  async deleteRules(context) {
    const { scope, userId, categoryId, folderPath } = context;

    switch (scope) {
      case 'user':
        return await this.deleteUserDefaultRules();

      case 'category':
        if (!categoryId) {
          throw new Error('Category ID required for category scope');
        }
        return await this.deleteCategoryRules(categoryId);

      case 'folder':
        if (!folderPath) {
          throw new Error('Folder path required for folder scope');
        }
        return await this.deleteFolderRules(folderPath);

      default:
        throw new Error(`Unknown scope: ${scope}`);
    }
  }
}

export default new MarkdownLintApi();