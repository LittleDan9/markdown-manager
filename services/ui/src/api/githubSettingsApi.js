import { Api } from './api';

/**
 * GitHub Settings API Client
 * Handles CRUD operations for GitHub integration settings
 */
class GitHubSettingsApi extends Api {
  /**
   * Get GitHub settings for the current user
   * @param {number|null} githubAccountId - Optional GitHub account ID for account-specific settings
   * @returns {Promise<Object>} Settings object or defaults
   */
  async getSettings(githubAccountId = null) {
    const params = githubAccountId ? { github_account_id: githubAccountId } : {};
    const response = await this.apiCall('/github/settings/', 'GET', null, {}, { params });
    return response.data;
  }

  /**
   * Create GitHub settings for the current user
   * @param {Object} settings - Settings to create
   * @returns {Promise<Object>} Created settings
   */
  async createSettings(settings) {
    const response = await this.apiCall('/github/settings/', 'POST', settings);
    return response.data;
  }

  /**
   * Update GitHub settings for the current user
   * @param {Object} settings - Settings to update (partial)
   * @param {number|null} githubAccountId - Optional GitHub account ID for account-specific settings
   * @returns {Promise<Object>} Updated settings
   */
  async updateSettings(settings, githubAccountId = null) {
    const params = githubAccountId ? { github_account_id: githubAccountId } : {};
    const response = await this.apiCall('/github/settings/', 'PUT', settings, {}, { params });
    return response.data;
  }

  /**
   * Get existing settings or create with defaults
   * @param {number|null} githubAccountId - Optional GitHub account ID for account-specific settings
   * @returns {Promise<Object>} Settings object
   */
  async getOrCreateSettings(githubAccountId = null) {
    const params = githubAccountId ? { github_account_id: githubAccountId } : {};
    const response = await this.apiCall('/github/settings/', 'PATCH', null, {}, { params });
    return response.data;
  }

  /**
   * Delete GitHub settings for the current user
   * @param {number|null} githubAccountId - Optional GitHub account ID for account-specific settings
   * @returns {Promise<Object>} Success message
   */
  async deleteSettings(githubAccountId = null) {
    const params = githubAccountId ? { github_account_id: githubAccountId } : {};
    const response = await this.apiCall('/github/settings/', 'DELETE', null, {}, { params });
    return response.data;
  }
}

// Factory function to create API instance
export function createGitHubSettingsApi() {
  return new GitHubSettingsApi();
}

// Singleton instance for general use
export default new GitHubSettingsApi();