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
  async importDocument(importData) {
    const { repository_id, file_path, branch = "main", ...rest } = importData;
    const res = await this.apiCall(`/github/repositories/${repository_id}/import`, "POST", {
      branch: branch,
      file_paths: [file_path],
      overwrite_existing: false,
      ...rest
    });
    return res.data;
  }

  async commitDocument(documentId, commitData) {
    const res = await this.apiCall(`/github/commits/documents/${documentId}`, "POST", commitData);
    return res.data;
  }

  async pullDocument(documentId, pullData = {}) {
    const res = await this.apiCall(`/github/sync/documents/${documentId}/pull`, "POST", pullData);
    return res.data;
  }

  async getDocumentStatus(documentId, params = {}) {
    const queryParams = new URLSearchParams(params);
    const queryString = queryParams.toString();
    const endpoint = `/github/sync/documents/${documentId}/status${queryString ? `?${queryString}` : ''}`;
    const res = await this.apiCall(endpoint, "GET");
    return res.data;
  }

  async getDocumentSyncHistory(documentId) {
    const res = await this.apiCall(`/github/sync/documents/${documentId}/sync-history`, "GET");
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

  // Enhanced folder structure methods (Phase 4)
  async importRepositoryFiles(repositoryId, importData) {
    const res = await this.apiCall(`/github/repositories/${repositoryId}/import`, "POST", importData);
    return res.data;
  }

  async syncRepositoryStructure(repositoryId, syncData) {
    const res = await this.apiCall(`/github/repositories/${repositoryId}/sync`, "POST", syncData);
    return res.data;
  }

  async getGitHubFolders() {
    const res = await this.apiCall("/github/folders", "GET");
    return res.data;
  }

  async getRepositoryTree(repositoryId, branch = 'main') {
    const params = new URLSearchParams({ branch });
    const res = await this.apiCall(`/github/repositories/${repositoryId}/tree?${params}`, "GET");
    return res.data;
  }

  // Convenience methods for folder-based operations
  async importRepositoryFile(repositoryId, filePath, branch = 'main') {
    return this.importRepositoryFiles(repositoryId, {
      branch,
      file_paths: [filePath],
      overwrite_existing: false
    });
  }

  async importEntireRepository(repositoryId, branch = 'main', overwriteExisting = false) {
    return this.importRepositoryFiles(repositoryId, {
      branch,
      file_paths: null, // Import all files
      overwrite_existing: overwriteExisting
    });
  }

  async syncRepository(repositoryId, branch = 'main', cleanupOrphaned = true) {
    return this.syncRepositoryStructure(repositoryId, {
      branch,
      cleanup_orphaned: cleanupOrphaned
    });
  }

  // File content retrieval for GitHub provider
  async getFileContent(repositoryId, filePath, branch = 'main') {
    const params = new URLSearchParams({
      path: filePath,
      branch
    });
    const res = await this.apiCall(`/github/repositories/${repositoryId}/contents?${params}`, "GET");

    // Handle both array response (when backend returns list) and single object response
    console.log('GitHub API getFileContent response:', res.data);

    let fileData = res.data;

    // Handle array response (backend returns array)
    if (Array.isArray(res.data)) {
      if (res.data.length === 0) {
        throw new Error(`No file found for ${filePath}`);
      }
      // Take the first item (should be the requested file)
      fileData = res.data[0];
      console.log('Extracted file data from array:', fileData);
    }

    // Validate that we have file data
    if (!fileData) {
      throw new Error(`No file data returned for ${filePath}`);
    }

    // If no content field, this might be a directory or error
    if (!fileData.content) {
      throw new Error(`File content not available for ${filePath}. This might be a directory.`);
    }

    // If this is a file response with content, return decoded content
    if (fileData.content && fileData.encoding === 'base64') {
      return {
        content: atob(fileData.content), // Decode base64 content
        sha: fileData.sha,
        size: fileData.size,
        name: fileData.name,
        path: fileData.path
      };
    }

    return res.data;
  }

  async createPullRequest(repositoryId, prData) {
    const res = await this.apiCall(`/github/repositories/${repositoryId}/pull-requests`, "POST", prData);
    return res.data;
  }

  // GitHub Save Operations
  async getUserRepositoriesForSave() {
    const res = await this.apiCall("/github/save/user-repositories", "GET");
    return res.data;
  }

  async getRepositoryBranchesForSave(repositoryId) {
    const res = await this.apiCall(`/github/save/repositories/${repositoryId}/branches`, "GET");
    return res.data;
  }

  async getRepositoryStatus(repositoryId) {
    const res = await this.apiCall(`/github/save/repositories/${repositoryId}/status`, "GET");
    return res.data;
  }

  async saveDocumentToGitHub(documentId, saveData) {
    const res = await this.apiCall(`/github/save/documents/${documentId}/save`, "POST", saveData);
    return res.data;
  }

  // Git Operations
  async commitChanges(repositoryId, commitData) {
    const res = await this.apiCall(`/github/git/repositories/${repositoryId}/commit`, "POST", commitData);
    return res.data;
  }

  async stashChanges(repositoryId, stashData = {}) {
    const res = await this.apiCall(`/github/git/repositories/${repositoryId}/stash`, "POST", stashData);
    return res.data;
  }

  async createBranch(repositoryId, branchData) {
    const res = await this.apiCall(`/github/git/repositories/${repositoryId}/branches`, "POST", branchData);
    return res.data;
  }

  async getGitHistory(repositoryId, limit = 50) {
    const res = await this.apiCall(`/github/git/repositories/${repositoryId}/history?limit=${limit}`, "GET");
    return res.data;
  }

  // Document-based Git Operations (unified for all documents)
  async getDocumentGitStatus(documentId) {
    const res = await this.apiCall(`/documents/${documentId}/git/status`, "GET");
    return res.data;
  }

  async commitDocumentChanges(documentId, commitMessage) {
    const res = await this.apiCall(`/documents/${documentId}/git/commit`, "POST", {
      commit_message: commitMessage
    });
    return res.data;
  }

  async getDocumentGitHistory(documentId, limit = 20) {
    const res = await this.apiCall(`/documents/${documentId}/git/history?limit=${limit}`, "GET");
    return res.data;
  }

  // Admin methods have been moved to api/admin/githubApi.js
  // Use adminGitHubApi for admin operations like orphaned document management
}

// Export singleton instance
const gitHubApi = new GitHubAPI();
export default gitHubApi;
