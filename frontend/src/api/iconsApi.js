/**
 * Icons API Client
 * Handles all icon-related API operations following the project's API patterns
 */

import { Api } from './api.js';

export class IconsApi extends Api {
  constructor() {
    super();
  }

  /**
   * Get all icon packs
   */
  async getIconPacks() {
    const response = await this.apiCall('/icons/packs/', 'GET', null, {}, { noAuth: true });
    return response.data;
  }

  /**
   * Search icons with pagination and filtering
   */
  async searchIcons(params = {}) {
    const {
      q = '',
      pack = 'all',
      category = 'all',
      page = 0,
      size = 1000
    } = params;

    const queryParams = new URLSearchParams({
      q,
      pack,
      category,
      page: page.toString(),
      size: size.toString()
    });

    const response = await this.apiCall(
      `/icons/search?${queryParams}`,
      'GET',
      null,
      {},
      { noAuth: true }
    );
    return response.data;
  }

  /**
   * Get specific icon metadata
   */
  async getIconMetadata(packName, key) {
    const response = await this.apiCall(
      `/icons/${encodeURIComponent(packName)}/${encodeURIComponent(key)}`,
      'GET',
      null,
      {},
      { noAuth: true }
    );
    return response.data;
  }

  /**
   * Get SVG content for an icon
   */
  async getIconSVG(packName, key) {
    const response = await this.apiCall(
      `/icons/${encodeURIComponent(packName)}/${encodeURIComponent(key)}/svg`,
      'GET',
      null,
      {},
      { noAuth: true }
    );
    return response.data;
  }

  /**
   * Batch get icons by full keys
   */
  async batchGetIcons(iconKeys) {
    const response = await this.apiCall(
      '/icons/batch',
      'POST',
      { icon_keys: iconKeys },
      {},
      { noAuth: true }
    );
    return response.data;
  }

  /**
   * Track icon usage (optional analytics)
   */
  async trackUsage(pack, key, userId = null) {
    try {
      await this.apiCall(
        '/icons/track-usage',
        'POST',
        { pack, key, user_id: userId },
        {},
        { noAuth: true }
      );
    } catch (error) {
      // Don't throw on tracking errors - it's non-critical
      console.warn('Failed to track icon usage:', error);
    }
  }

  /**
   * Get cache statistics (for debugging)
   */
  async getCacheStats() {
    const response = await this.apiCall('/icons/cache-stats', 'GET', null, {}, { noAuth: true });
    return response.data;
  }

  /**
   * Clear cache
   */
  async clearCache() {
    const response = await this.apiCall('/icons/cache-clear', 'POST', null, {}, { noAuth: true });
    return response.data;
  }

  /**
   * Warm cache with popular icons
   */
  async warmCache() {
    const response = await this.apiCall('/icons/cache-warm', 'POST', null, {}, { noAuth: true });
    return response.data;
  }

  /**
   * Install new icon pack (admin function)
   */
  async installIconPack(packData, mappingConfig, packageType = 'json') {
    const response = await this.apiCall(
      '/icons/packs/',
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
      `/icons/packs/${encodeURIComponent(packName)}`,
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
   * Delete icon pack
   */
  async deleteIconPack(packName) {
    const response = await this.apiCall(
      `/icons/packs/${encodeURIComponent(packName)}`,
      'DELETE'
    );
    return response.data;
  }

  /**
   * Get icon pack statistics
   */
  async getIconStatistics() {
    const response = await this.apiCall('/icons/statistics', 'GET', null, {}, { noAuth: true });
    return response.data;
  }

  /**
   * Get example mapping configurations
   */
  async getMappingExamples() {
    const response = await this.apiCall('/icons/mapping-examples', 'GET', null, {}, { noAuth: true });
    return response.data;
  }
}

// Create singleton instance
export const iconsApi = new IconsApi();
export default iconsApi;
