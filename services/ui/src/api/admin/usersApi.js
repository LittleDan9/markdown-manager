/**
 * Admin Users API Client
 * Handles all admin-specific user operations following the new /admin/users/ structure
 */

import { Api } from '../api.js';

export class AdminUsersApi extends Api {
  constructor() {
    super();
  }

  // ============================================================================
  // USER STATISTICS
  // ============================================================================

  /**
   * Get user statistics for admin dashboard
   */
  async getUserStats() {
    const response = await this.apiCall('/admin/users/stats', 'GET');
    return response.data;
  }

  // ============================================================================
  // USER MANAGEMENT
  // ============================================================================

  /**
   * Get all users with admin information
   */
  async getAllUsers(params = {}) {
    const {
      skip = 0,
      limit = 100,
      active_only = null,
      search = null
    } = params;

    const queryParams = new URLSearchParams({
      skip: skip.toString(),
      limit: limit.toString()
    });

    if (active_only !== null) {
      queryParams.append('active_only', active_only.toString());
    }

    if (search) {
      queryParams.append('search', search);
    }

    const response = await this.apiCall(`/admin/users?${queryParams}`, 'GET');
    return response.data;
  }

  /**
   * Get specific user details by ID
   */
  async getUserById(userId) {
    const response = await this.apiCall(`/admin/users/${userId}`, 'GET');
    return response.data;
  }

  /**
   * Update user details as admin
   */
  async updateUser(userId, userUpdate) {
    const response = await this.apiCall(`/admin/users/${userId}`, 'PUT', userUpdate);
    return response.data;
  }

  /**
   * Reset user's MFA settings
   */
  async resetUserMFA(userId, reason = null) {
    const response = await this.apiCall(
      `/admin/users/${userId}/reset-mfa`,
      'POST',
      { reason }
    );
    return response.data;
  }

  /**
   * Delete user account as admin (only if inactive)
   */
  async deleteUser(userId) {
    const response = await this.apiCall(`/admin/users/${userId}`, 'DELETE');
    return response.data;
  }
}

// Create singleton instance
export default new AdminUsersApi();