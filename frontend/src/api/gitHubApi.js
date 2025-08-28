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
  async getRepositories(accountId = null) {
    const params = accountId ? `?account_id=${accountId}` : '';
    const response = await this.apiCall(`/github/repositories${params}`, 'GET');
    return response.data;
  }

  async syncRepositories(accountId) {
    const response = await this.apiCall(`/github/repositories/sync?account_id=${accountId}`, 'POST');
    return response.data;
  }

  // Branch operations
  async getBranches(repositoryId) {
    const response = await this.apiCall(`/github/repositories/${repositoryId}/branches`, 'GET');
    return response.data;
  }

  // File browsing - updated for Phase 1
  async getRepositoryContents(repositoryId, path = '', branch = 'main') {
    const params = new URLSearchParams();
    if (path) params.append('path', path);
    if (branch) params.append('branch', branch);

    const queryString = params.toString();
    const url = `/github/repositories/${repositoryId}/contents${queryString ? '?' + queryString : ''}`;

    const response = await this.apiCall(url, 'GET');
    return response.data;
  }

  async getRepositoryFiles(repoId, path = '') {
    const params = path ? `?path=${encodeURIComponent(path)}` : '';
    const response = await this.apiCall(`/github/repositories/${repoId}/files${params}`, 'GET');
    return response.data;
  }

  // File import - updated for Phase 1
  async importFile(importData) {
    const response = await this.apiCall('/github/import', 'POST', importData);
    return response.data;
  }

  // Phase 2: Commit Operations
  async commitDocument(documentId, commitData) {
    const response = await this.apiCall(`/github/documents/${documentId}/commit`, 'POST', commitData);
    return response.data;
  }

  async getDocumentStatus(documentId) {
    const response = await this.apiCall(`/github/documents/${documentId}/status`, 'GET');
    return response.data;
  }

  async getDocumentSyncHistory(documentId, limit = 10) {
    const response = await this.apiCall(`/github/documents/${documentId}/sync-history?limit=${limit}`, 'GET');
    return response.data;
  }

  // Branch operations
  async getRepositoryBranches(repoId) {
    const response = await this.apiCall(`/github/repositories/${repoId}/branches`, 'GET');
    return response.data;
  }

  // Phase 3: Advanced Sync Operations
  async pullChanges(documentId, pullData) {
    const response = await this.apiCall(`/github/documents/${documentId}/pull`, 'POST', pullData);
    return response.data;
  }

  async resolveConflicts(documentId, resolutionData) {
    const response = await this.apiCall(`/github/documents/${documentId}/resolve-conflicts`, 'POST', resolutionData);
    return response.data;
  }

  // Pull Request Operations
  async createPullRequest(repositoryId, prData) {
    const response = await this.apiCall(`/github/repositories/${repositoryId}/pull-requests`, 'POST', prData);
    return response.data;
  }

  async getPullRequests(repositoryId, state = 'open') {
    const response = await this.apiCall(`/github/repositories/${repositoryId}/pull-requests?state=${state}`, 'GET');
    return response.data;
  }

  async getRepositoryContributors(repositoryId) {
    const response = await this.apiCall(`/github/repositories/${repositoryId}/contributors`, 'GET');
    return response.data;
  }
}

export default new GitHubAPI();
