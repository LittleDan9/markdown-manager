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
      `/icons/search/?${queryParams}`,
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
   * Get icon metadata by ID
   */
  async getIconById(iconId) {
    const response = await this.apiCall(
      `/icons/${iconId}`,
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
   * Update only icon pack metadata (name, display_name, category, description)
   * without affecting the icons themselves
   */
  async updateIconPackMetadata(packName, metadata) {
    const response = await this.apiCall(
      `/icons/packs/${encodeURIComponent(packName)}`,
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

    const response = await this.apiCall(
      '/icons/upload/icon',
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

  /**
   * Get unique categories from existing icon packs
   */
  async getIconCategories() {
    try {
      const response = await this.apiCall('/icons/packs/categories', 'GET', null, {}, { noAuth: true });
      return response.data.categories;
    } catch (error) {
      console.error('Failed to load icon categories:', error);
      // If backend is down, throw the error - don't fallback to hardcoded values
      throw error;
    }
  }

  /**
   * Get unique pack names from existing icon packs
   */
  async getIconPackNames() {
    try {
      const response = await this.apiCall('/icons/packs/names', 'GET', null, {}, { noAuth: true });
      return response.data.pack_names;
    } catch (error) {
      console.error('Failed to load icon pack names:', error);
      // If backend is down, throw the error - don't fallback to hardcoded values
      throw error;
    }
  }

  /**
   * Update metadata for a specific icon
   */
  async updateIconMetadata(iconId, metadata) {
    const response = await this.apiCall(
      `/icons/search/${iconId}`,
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
      `/icons/search/${iconId}`,
      'DELETE'
    );
    return response.data;
  }
}

// Create singleton instance
export const iconsApi = new IconsApi();
export default iconsApi;
