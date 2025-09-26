/**
 * Admin GitHub API Client
 * Handles all admin-specific GitHub operations following the new /admin/github/ structure
 */

import { Api } from '../api.js';

export class AdminGitHubApi extends Api {
  constructor() {
    super();
  }

  // ============================================================================
  // USER STORAGE MANAGEMENT
  // ============================================================================

  /**
   * Get all users for user selection (admin endpoint)
   */
  async getAllUsersForAdmin() {
    const response = await this.apiCall('/admin/github/users', 'GET');
    return response.data;
  }

  /**
   * Get storage statistics for any user (admin endpoint)
   */
  async getUserStorageStats(userId) {
    const response = await this.apiCall(`/admin/github/users/${userId}/storage-stats`, 'GET');
    return response.data;
  }

  /**
   * Get orphaned repositories for a specific user (admin endpoint)
   */
  async getUserOrphanedRepositories(userId) {
    const response = await this.apiCall(`/admin/github/users/${userId}/orphaned-repositories`, 'GET');
    return response.data;
  }

  /**
   * Clean up orphaned repositories for a specific user (admin endpoint)
   */
  async cleanupUserOrphanedRepositories(userId) {
    const response = await this.apiCall(`/admin/github/users/${userId}/orphaned-repositories`, 'DELETE');
    return response.data;
  }

  /**
   * Get orphaned documents for any user (admin endpoint)
   */
  async getUserOrphanedDocuments(userId) {
    const response = await this.apiCall(`/admin/github/users/${userId}/orphaned-documents`, 'GET');
    return response.data;
  }

  /**
   * Clean up orphaned documents for any user (admin endpoint)
   */
  async cleanupUserOrphanedDocuments(userId) {
    const response = await this.apiCall(`/admin/github/users/${userId}/orphaned-documents`, 'DELETE');
    return response.data;
  }

  // ============================================================================
  // CURRENT USER STORAGE MANAGEMENT
  // ============================================================================

  /**
   * Get current user's storage statistics
   */
  async getMyStorageStats() {
    const response = await this.apiCall('/admin/github/user/storage-stats', 'GET');
    return response.data;
  }

  /**
   * Get current user's orphaned documents
   */
  async getMyOrphanedDocuments() {
    const response = await this.apiCall('/admin/github/orphaned-documents', 'GET');
    return response.data;
  }

  /**
   * Clean up current user's orphaned documents
   */
  async cleanupMyOrphanedDocuments() {
    const response = await this.apiCall('/admin/github/user/orphaned-documents', 'DELETE');
    return response.data;
  }

  /**
   * Get current user's orphaned repositories
   */
  async getMyOrphanedRepositories() {
    const response = await this.apiCall('/admin/github/orphaned-repositories', 'GET');
    return response.data;
  }

  /**
   * Clean up current user's orphaned repositories
   */
  async cleanupMyOrphanedRepositories() {
    const response = await this.apiCall('/admin/github/orphaned-repositories', 'DELETE');
    return response.data;
  }
}

// Create singleton instance
export default new AdminGitHubApi();