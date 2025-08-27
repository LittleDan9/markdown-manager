import { Api } from './api.js';

class GitHubAPI extends Api {
  constructor() {
    super();
  }

  // OAuth methods
  async getAuthUrl() {
    const response = await this.apiCall('/github/auth/url', 'GET');
    return response.data;
  }

  async processOAuthCallback(code, state) {
    const response = await this.apiCall('/github/auth/process', 'POST', {
      code,
      state
    });
    return response.data;
  }

  // Account management
  async getAccounts() {
    const response = await this.apiCall('/github/accounts', 'GET');
    return response.data;
  }

  async disconnectAccount(accountId) {
    const response = await this.apiCall(`/github/accounts/${accountId}`, 'DELETE');
    return response.data;
  }

  // Repository management
  async getRepositories(accountId) {
    const response = await this.apiCall(`/github/repositories?account_id=${accountId}`, 'GET');
    return response.data;
  }

  async syncRepositories(accountId) {
    const response = await this.apiCall(`/github/repositories/sync?account_id=${accountId}`, 'POST');
    return response.data;
  }

  // File browsing
  async getRepositoryFiles(repoId, path = '') {
    const params = path ? `?path=${encodeURIComponent(path)}` : '';
    const response = await this.apiCall(`/github/repositories/${repoId}/files${params}`, 'GET');
    return response.data;
  }

  // File import
  async importFile(repositoryId, filePath, categoryId, documentName = null) {
    const response = await this.apiCall('/github/import', 'POST', {
      repository_id: repositoryId,
      file_path: filePath,
      category_id: categoryId,
      document_name: documentName
    });
    return response.data;
  }
}

export default new GitHubAPI();
