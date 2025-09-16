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
    const response = await this.apiCall('/icons/packs', 'GET', null, {}, { noAuth: true });
    return response.data;
  }

  /**
   * Get specific icon pack and its icons
   */
  async getIconPack(packName, page = 0, size = 50) {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      size: size.toString()
    });

    const response = await this.apiCall(
      `/icons/packs/${encodeURIComponent(packName)}?${queryParams}`,
      'GET',
      null,
      {},
      { noAuth: true }
    );
    return response.data;
  }

  /**
   * Get system overview and statistics
   */
  async getIconsOverview() {
    const response = await this.apiCall('/icons/overview', 'GET', null, {}, { noAuth: true });
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
      `/icons/packs/${encodeURIComponent(packName)}/${encodeURIComponent(key)}`,
      'GET',
      null,
      {},
      { noAuth: true }
    );
    return response.data;
  }

  /**
   * Get SVG content for an icon as JSON
   */
  async getIconSVG(packName, key) {
    const response = await this.apiCall(
      `/icons/packs/${encodeURIComponent(packName)}/${encodeURIComponent(key)}/svg`,
      'GET',
      null,
      {},
      { noAuth: true }
    );
    return response.data;
  }

  /**
   * Get raw SVG URL for direct browser rendering
   * Returns the URL - use this for <img> src attributes
   */
  getRawIconUrl(packName, key) {
    const baseUrl = this.baseURL || window.location.origin;
    return `${baseUrl}/api/icons/packs/${encodeURIComponent(packName)}/${encodeURIComponent(key)}/raw`;
  }

  /**
   * Get raw SVG content directly
   */
  async getRawIconSVG(packName, key) {
    const response = await fetch(this.getRawIconUrl(packName, key));
    if (!response.ok) {
      throw new Error(`Failed to fetch raw SVG: ${response.statusText}`);
    }
    return await response.text();
  }

  /**
   * Get icon metadata by ID (legacy - use getIconMetadata instead)
   * @deprecated Use getIconMetadata(packName, key) instead
   */
  async getIconById(iconId) {
    console.warn('getIconById is deprecated. Use getIconMetadata(packName, key) instead.');
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
    const response = await this.apiCall('/icons/admin/cache/stats', 'GET');
    return response.data;
  }

  /**
   * Clear cache
   */
  async clearCache() {
    const response = await this.apiCall('/icons/admin/cache/clear', 'DELETE');
    return response.data;
  }

  /**
   * Warm cache with popular icons
   */
  async warmCache() {
    const response = await this.apiCall('/icons/admin/cache/warm', 'POST');
    return response.data;
  }

  /**
   * Install new icon pack (admin function)
   */
  async installIconPack(packData, mappingConfig, packageType = 'json') {
    const response = await this.apiCall(
      '/icons/admin/packs',
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
      `/icons/admin/packs/${encodeURIComponent(packName)}`,
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
      `/icons/admin/packs/${encodeURIComponent(packName)}`,
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
      `/icons/admin/packs/${encodeURIComponent(packName)}`,
      'DELETE'
    );
    return response.data;
  }

  /**
   * Get icon pack statistics
   */
  async getIconStatistics() {
    const response = await this.apiCall('/icons/admin/statistics', 'GET');
    return response.data;
  }

  /**
   * Get popular icons statistics
   */
  async getPopularIcons(limit = 50) {
    const response = await this.apiCall(`/icons/admin/statistics/popular?limit=${limit}`, 'GET');
    return response.data;
  }

  /**
   * Get pack-level statistics
   */
  async getPackStatistics() {
    const response = await this.apiCall('/icons/admin/statistics/packs', 'GET');
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
      '/icons/admin/upload/icon',
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
      const response = await this.apiCall('/icons/metadata/packs/categories', 'GET', null, {}, { noAuth: true });
      return response.data.values || response.data.data; // Support both response formats
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
      const response = await this.apiCall('/icons/metadata/packs/names', 'GET', null, {}, { noAuth: true });
      return response.data.values || response.data.data; // Support both response formats
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
      `/icons/admin/icons/${iconId}`,
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
      `/icons/admin/icons/${iconId}`,
      'DELETE'
    );
    return response.data;
  }

  // Third-Party API Methods

  /**
   * Get available third-party sources
   */
  async getThirdPartySources() {
    const response = await this.apiCall('/third-party/sources', 'GET', null, {}, { noAuth: true });
    return response.data;
  }

  /**
   * Get collections from a third-party source
   */
  async getThirdPartyCollections(source, searchQuery = '', categoryFilter = '') {
    const params = new URLSearchParams();
    if (searchQuery) params.append('search', searchQuery);
    if (categoryFilter) params.append('category', categoryFilter);

    const queryString = params.toString();
    const url = `/third-party/sources/${source}/collections${queryString ? `?${queryString}` : ''}`;

    const response = await this.apiCall(url, 'GET', null, {}, { noAuth: true });
    return response.data;
  }

  /**
   * Get categories for a third-party source
   */
  async getThirdPartyCategories(source) {
    const response = await this.apiCall(`/third-party/sources/${source}/categories`, 'GET', null, {}, { noAuth: true });
    return response.data;
  }

  /**
   * Get icons from a third-party collection
   */
  async getThirdPartyIcons(source, prefix, page = 0, search = '') {
    const params = new URLSearchParams({
      page: page.toString()
    });
    if (search) params.append('search', search);

    const response = await this.apiCall(
      `/third-party/sources/${source}/collections/${prefix}/icons?${params}`,
      'GET',
      null,
      {},
      { noAuth: true }
    );
    return response.data;
  }

  /**
   * Install selected icons from a third-party collection
   */
  async installThirdPartyIcons(source, prefix, iconKeys, packName, category, description = '') {
    const response = await this.apiCall(
      `/third-party/sources/${source}/collections/${prefix}/install`,
      'POST',
      {
        icon_keys: iconKeys,
        pack_name: packName,
        category: category,
        description: description
      }
    );
    return response.data;
  }

  /**
   * Install entire third-party collection
   */
  async installEntireThirdPartyCollection(source, prefix, packName, category, description = '') {
    const response = await this.apiCall(
      `/third-party/sources/${source}/collections/${prefix}/install`,
      'POST',
      {
        install_all: true,
        pack_name: packName,
        category: category,
        description: description
      }
    );
    return response.data;
  }
}

// Create singleton instance
export const iconsApi = new IconsApi();
export default iconsApi;
