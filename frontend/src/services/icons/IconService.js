/**
 * Main Icon Service
 * Orchestrates all icon-related functionality with separation of concerns
 */

import IconPackService from './IconPackService.js';
import IconSearchService from './IconSearchService.js';
import IconCacheService from './IconCacheService.js';
import IconUsageService from './IconUsageService.js';
import IconManagementService from './IconManagementService.js';

class IconService {
  constructor() {
    this.packService = new IconPackService();
    this.searchService = new IconSearchService();
    this.cacheService = new IconCacheService();
    this.usageService = new IconUsageService();
    this.managementService = new IconManagementService();
  }

  // ============ Icon Pack Methods ============

  /**
   * Get icon packs metadata without loading all icons
   */
  async getIconPacks() {
    return this.packService.getIconPacks();
  }

  /**
   * Initialize the service by loading icon packs metadata
   */
  async loadAllIconPacks() {
    return this.packService.loadAllIconPacks();
  }

  /**
   * Check if the service is loaded
   */
  isLoaded() {
    return this.packService.isLoaded();
  }

  /**
   * Get available icon packs for dropdown
   */
  getAvailableIconPacks() {
    return this.packService.getAvailableIconPacks();
  }

  /**
   * Get available categories for dropdown
   */
  getAvailableCategories() {
    return this.packService.getAvailableCategories();
  }

  /**
   * Get available categories filtered by selected pack
   */
  getAvailableCategoriesForPack(packName) {
    return this.packService.getAvailableCategoriesForPack(packName);
  }

  /**
   * Get total icon count
   */
  getTotalIconCount() {
    return this.packService.getTotalIconCount();
  }

  /**
   * Get badge information for icon packs
   */
  getBadgeInfo() {
    return this.packService.getBadgeInfo();
  }

  /**
   * Get badge color for icon pack
   */
  getPackBadgeColor(packName) {
    return this.packService.getPackBadgeColor(packName);
  }

  /**
   * Get pack display name
   */
  getPackDisplayName(packName) {
    return this.packService.getPackDisplayName(packName);
  }

  // ============ Search Methods ============

  /**
   * Search icons with caching
   */
  async searchIcons(searchTerm = '', category = 'all', pack = 'all', page = 0, size = 100) {
    // Check cache first
    const cached = this.cacheService.get(searchTerm, category, pack, page, size);
    if (cached) {
      return cached;
    }

    try {
      const result = await this.searchService.searchIcons(searchTerm, category, pack, page, size);

      // Cache the result
      this.cacheService.set(searchTerm, category, pack, page, size, result);

      return result;
    } catch (error) {
      console.error('IconService: Search failed:', error);
      throw error;
    }
  }

  /**
   * Get SVG content for an icon
   */
  async getIconSVG(pack, key) {
    return this.searchService.getIconSVG(pack, key);
  }

  /**
   * Get raw SVG URL for direct browser rendering
   */
  getRawIconUrl(pack, key) {
    return this.searchService.getRawIconUrl(pack, key);
  }

  /**
   * Get raw SVG content directly
   */
  async getRawIconSVG(pack, key) {
    return this.searchService.getRawIconSVG(pack, key);
  }

  /**
   * Batch get icons by full keys
   */
  async batchGetIcons(iconKeys) {
    return this.searchService.batchGetIcons(iconKeys);
  }

  // ============ Usage Methods ============

  /**
   * Generate usage example for Mermaid diagrams
   */
  generateUsageExample(prefix, key, diagramType) {
    return this.usageService.generateUsageExample(prefix, key, diagramType);
  }

  /**
   * Track icon usage (optional analytics)
   */
  async trackUsage(pack, key, userId = null) {
    return this.usageService.trackUsage(pack, key, userId);
  }

  /**
   * Generate formatted icon reference
   */
  generateIconReference(pack, key) {
    return this.usageService.generateIconReference(pack, key);
  }

  /**
   * Parse icon reference back to components
   */
  parseIconReference(iconRef) {
    return this.usageService.parseIconReference(iconRef);
  }

  /**
   * Validate icon reference format
   */
  isValidIconReference(iconRef) {
    return this.usageService.isValidIconReference(iconRef);
  }

  // ============ Management Methods ============

  /**
   * Install new icon pack (admin function)
   */
  async installIconPack(packData, mappingConfig, packageType = 'json') {
    try {
      const result = await this.managementService.installIconPack(packData, mappingConfig, packageType);

      // Reload packs after installation
      await this.loadAllIconPacks();

      return result;
    } catch (error) {
      console.error('Failed to install icon pack:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics (for debugging)
   */
  async getCacheStats() {
    const serverStats = await this.managementService.getCacheStats();
    const clientStats = this.cacheService.getStats();

    return {
      server: serverStats,
      client: clientStats
    };
  }

  /**
   * Clear cache (both client and server)
   */
  async clearCache() {
    // Clear client cache
    this.cacheService.clear();

    // Clear server cache
    try {
      await this.managementService.clearServerCache();
    } catch (error) {
      console.warn('Failed to clear server cache:', error);
    }
  }

  /**
   * Remove icon pack (admin function)
   */
  async removeIconPack(packName) {
    const result = await this.managementService.removeIconPack(packName);

    // Reload packs after removal
    await this.loadAllIconPacks();

    return result;
  }

  /**
   * Update icon pack metadata (admin function)
   */
  async updateIconPack(packName, updateData) {
    const result = await this.managementService.updateIconPack(packName, updateData);

    // Reload packs after update
    await this.loadAllIconPacks();

    return result;
  }

  // ============ Utility Methods ============

  /**
   * Clean expired cache entries
   */
  cleanExpiredCache() {
    this.cacheService.cleanExpired();
  }

  /**
   * Get service status
   */
  getServiceStatus() {
    return {
      loaded: this.packService.isLoaded(),
      totalPacks: this.packService.getAllIconPacks().length,
      totalIcons: this.packService.getTotalIconCount(),
      cacheSize: this.cacheService.getStats().size,
      categories: this.packService.getAvailableCategories().length
    };
  }
}

// Create singleton instance
const iconService = new IconService();

export { iconService as IconService };
export default iconService;
