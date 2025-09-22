/**
 * GitHub repository selection API client.
 */
import { Api } from './api';

export class GitHubRepositorySelectionApi extends Api {
  constructor() {
    super();
    this.baseUrl = '/github/repository-selection';
  }

  /**
   * Search available repositories for a GitHub account
   */
  async searchRepositories(accountId, params = {}) {
    const queryParams = new URLSearchParams({
      page: params.page || 1,
      per_page: params.per_page || 20,
      include_private: params.include_private ?? true,
      sort_by: params.sort_by || 'updated',
      ...params
    });

    const response = await this.apiCall(
      `${this.baseUrl}/accounts/${accountId}/repositories/search?${queryParams}`
    );
    return response.data;
  }

  /**
   * Get selected repositories for an account
   */
  async getSelectedRepositories(accountId) {
    const response = await this.apiCall(
      `${this.baseUrl}/accounts/${accountId}/repositories/selected`
    );
    return response.data;
  }

  /**
   * Add a repository to selections
   */
  async addRepositorySelection(accountId, githubRepoId) {
    const response = await this.apiCall(
      `${this.baseUrl}/accounts/${accountId}/repositories/selected`,
      'POST',
      { github_repo_id: githubRepoId }
    );
    return response.data;
  }

  /**
   * Add multiple repositories to selections
   */
  async bulkAddRepositorySelections(accountId, githubRepoIds) {
    const response = await this.apiCall(
      `${this.baseUrl}/accounts/${accountId}/repositories/selected/bulk`,
      'POST',
      { github_repo_ids: githubRepoIds }
    );
    return response.data;
  }

  /**
   * Remove a repository from selections
   */
  async removeRepositorySelection(accountId, githubRepoId) {
    const response = await this.apiCall(
      `${this.baseUrl}/accounts/${accountId}/repositories/selected/${githubRepoId}`,
      'DELETE'
    );
    return response.data;
  }

  /**
   * Toggle sync status for a repository
   */
  async toggleRepositorySync(accountId, githubRepoId, syncEnabled) {
    const response = await this.apiCall(
      `${this.baseUrl}/accounts/${accountId}/repositories/selected/${githubRepoId}/sync`,
      'PATCH',
      { sync_enabled: syncEnabled }
    );
    return response.data;
  }

  /**
   * Get repository statistics
   */
  async getRepositoryStatistics(accountId) {
    const response = await this.apiCall(
      `${this.baseUrl}/accounts/${accountId}/repositories/statistics`
    );
    return response.data;
  }

  /**
   * Get available organizations for an account
   */
  async getOrganizations(accountId) {
    const response = await this.apiCall(
      `${this.baseUrl}/accounts/${accountId}/organizations`
    );
    return response.data;
  }
}

export default new GitHubRepositorySelectionApi();