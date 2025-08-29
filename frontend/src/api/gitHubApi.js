import { Api } from './api.js';

class GitHubAPI extends Api {
  
  // OAuth flow
  async getAuthUrl() {
    const res = await this.apiCall("/github/auth/url", "GET");
    return res.data;
  }

  async initiateOAuth() {
    const res = await this.apiCall("/github/auth/url", "GET");
    return res.data;
  }

  async initiateConnection() {
    const res = await this.apiCall("/github/auth/url", "GET");
    return res.data;
  }

  async initiateConnectionWithLogout() {
    const res = await this.apiCall("/github/auth/url-with-logout", "GET");
    return res.data;
  }

  async completeOAuth(code, state) {
    const res = await this.apiCall("/github/auth/callback", "POST", {
      code,
      state
    });
    return res.data;
  }

  // Account management
  async getAccounts() {
    const res = await this.apiCall("/github/accounts", "GET");
    return res.data;
  }

  async disconnectAccount(accountId) {
    const res = await this.apiCall(`/github/accounts/${accountId}`, "DELETE");
    return res.data;
  }

  async refreshRepositories(accountId) {
    const res = await this.apiCall(`/github/accounts/${accountId}/refresh`, "POST");
    return res.data;
  }

  // Repository management
  async getRepositories(accountId) {
    const res = await this.apiCall(`/github/repositories?account_id=${accountId}`, "GET");
    return res.data;
  }

  async syncRepositories(accountId) {
    const res = await this.apiCall(`/github/repositories/sync?account_id=${accountId}`, "POST");
    return res.data;
  }

  async toggleRepository(repoId, enabled) {
    const res = await this.apiCall(`/github/repositories/${repoId}/toggle`, "PATCH", {
      enabled
    });
    return res.data;
  }

  async getRepositoryBranches(repoId) {
    const res = await this.apiCall(`/github/repositories/${repoId}/branches`, "GET");
    return res.data;
  }

  async getRepositoryFiles(repoId, path = "", branch = null) {
    const params = new URLSearchParams();
    if (path) params.append("path", path);
    if (branch) params.append("branch", branch);

    const queryString = params.toString();
    const endpoint = `/github/repositories/${repoId}/files${queryString ? `?${queryString}` : ""}`;
    
    const res = await this.apiCall(endpoint, "GET");
    return res.data;
  }

  async getFileContent(repoId, filePath, branch = null) {
    const params = new URLSearchParams();
    params.append("file_path", filePath);
    if (branch) params.append("branch", branch);

    const res = await this.apiCall(`/github/repositories/${repoId}/file?${params.toString()}`, "GET");
    return res.data;
  }

  // Document operations
  async importDocument(repoId, filePath, branch = null) {
    const res = await this.apiCall("/github/documents/import", "POST", {
      repository_id: repoId,
      file_path: filePath,
      branch: branch
    });
    return res.data;
  }

  async commitDocument(documentId, commitMessage) {
    const res = await this.apiCall(`/github/documents/${documentId}/commit`, "POST", {
      commit_message: commitMessage
    });
    return res.data;
  }

  async pullDocument(documentId) {
    const res = await this.apiCall(`/github/documents/${documentId}/pull`, "POST");
    return res.data;
  }

  async getDocumentStatus(documentId) {
    const res = await this.apiCall(`/github/documents/${documentId}/status`, "GET");
    return res.data;
  }

  async getDocumentSyncHistory(documentId) {
    const res = await this.apiCall(`/github/documents/${documentId}/sync-history`, "GET");
    return res.data;
  }

  // Repository contents (Phase 4 enhanced endpoints)
  async getRepositoryContents(repositoryId, path = '', branch = 'main') {
    const params = new URLSearchParams();
    if (path) params.append("path", path);
    if (branch) params.append("branch", branch);

    const queryString = params.toString();
    const endpoint = `/github/repositories/${repositoryId}/contents${queryString ? `?${queryString}` : ""}`;
    
    const res = await this.apiCall(endpoint, "GET");
    return res.data;
  }

  // Cache management (Phase 4)
  async getCacheStats() {
    const res = await this.apiCall("/github/cache/stats", "GET");
    return res.data;
  }

  async clearCache() {
    const res = await this.apiCall("/github/cache/clear", "POST");
    return res.data;
  }

  async getSyncStatus() {
    const res = await this.apiCall("/github/cache/sync-status", "GET");
    return res.data;
  }

  async startBackgroundSync() {
    const res = await this.apiCall("/github/cache/sync/start", "POST");
    return res.data;
  }

  async stopBackgroundSync() {
    const res = await this.apiCall("/github/cache/sync/stop", "POST");
    return res.data;
  }

  async forceSyncAll() {
    const res = await this.apiCall("/github/cache/sync/force-all", "POST");
    return res.data;
  }
}

// Export singleton instance
const gitHubApi = new GitHubAPI();
export default gitHubApi;
