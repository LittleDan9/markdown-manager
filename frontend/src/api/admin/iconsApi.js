/**
 * Admin Icons API Client
 * Handles all admin-specific icon operations following the new /admin/icons/ structure
 */

import { Api } from '../api.js';

export class AdminIconsApi extends Api {
  constructor() {
    super();
  }

  // ============================================================================
  // PACK MANAGEMENT
  // ============================================================================

  /**
   * Install new icon pack (admin function)
   */
  async installIconPack(packData, mappingConfig, packageType = 'json') {
    const response = await this.apiCall(
      '/admin/icons/packs',
      'POST',
      {
        pack_data: packData,
        mapping_config: mappingConfig,
        package_type: packageType
      }
    );
    return response.data;
  }

  /**
   * Update existing icon pack
   */
  async updateIconPack(packName, packData, mappingConfig, packageType = 'json') {
    const response = await this.apiCall(
      `/admin/icons/packs/${encodeURIComponent(packName)}`,
      'PUT',
      {
        pack_data: packData,
        mapping_config: mappingConfig,
        package_type: packageType
      }
    );
    return response.data;
  }

  /**
   * Update only icon pack metadata (name, display_name, category, description)
   * without affecting the icons themselves
   */
  async updateIconPackMetadata(packName, metadata) {
    const response = await this.apiCall(
      `/admin/icons/packs/${encodeURIComponent(packName)}`,
      'PATCH',
      metadata
    );
    return response.data;
  }

  /**
   * Delete icon pack
   */
  async deleteIconPack(packName) {
    const response = await this.apiCall(
      `/admin/icons/packs/${encodeURIComponent(packName)}`,
      'DELETE'
    );
    return response.data;
  }

  // ============================================================================
  // ICON MANAGEMENT
  // ============================================================================

  /**
   * Update metadata for a specific icon
   */
  async updateIconMetadata(iconId, metadata) {
    const response = await this.apiCall(
      `/admin/icons/${iconId}`,
      'PATCH',
      metadata
    );
    return response.data;
  }

  /**
   * Delete a specific icon
   */
  async deleteIcon(iconId) {
    const response = await this.apiCall(
      `/admin/icons/${iconId}`,
      'DELETE'
    );
    return response.data;
  }

  // ============================================================================
  // ICON UPLOAD
  // ============================================================================

  /**
   * Upload a single icon to a pack
   */
  async uploadSingleIcon(iconData) {
    const formData = new FormData();
    formData.append('svg_file', iconData.svgFile);
    formData.append('icon_name', iconData.iconName);
    formData.append('pack_name', iconData.packName);
    formData.append('category', iconData.category);
    if (iconData.description) {
      formData.append('description', iconData.description);
    }
    if (iconData.searchTerms) {
      formData.append('search_terms', iconData.searchTerms);
    }

    const response = await this.apiCall(
      '/admin/icons/upload/icon',
      'POST',
      formData,
      {},
      {
        isFormData: true,
        timeout: 30000 // 30 second timeout for file uploads
      }
    );
    return response.data;
  }

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  /**
   * Get cache statistics (for debugging)
   */
  async getCacheStats() {
    const response = await this.apiCall('/admin/icons/cache/stats', 'GET');
    return response.data;
  }

  /**
   * Clear cache
   */
  async clearCache() {
    const response = await this.apiCall('/admin/icons/cache/clear', 'DELETE');
    return response.data;
  }

  /**
   * Warm cache with popular icons
   */
  async warmCache() {
    const response = await this.apiCall('/admin/icons/cache/warm', 'POST');
    return response.data;
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  /**
   * Get comprehensive icon statistics
   */
  async getIconStatistics() {
    const response = await this.apiCall('/admin/icons/statistics', 'GET');
    return response.data;
  }

  /**
   * Get popular icons statistics
   */
  async getPopularIcons(limit = 50) {
    const response = await this.apiCall(`/admin/icons/statistics/popular?limit=${limit}`, 'GET');
    return response.data;
  }

  /**
   * Get pack-level statistics
   */
  async getPackStatistics() {
    const response = await this.apiCall('/admin/icons/statistics/packs', 'GET');
    return response.data;
  }
}

// Create singleton instance
export default new AdminIconsApi();