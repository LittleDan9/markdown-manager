/**
 * Icon Pack Service
 * Handles icon pack metadata and categories
 */

import { iconsApi } from '@/api/iconsApi.js';

class IconPackService {
  constructor() {
    this.loaded = false;
    this.iconPacks = [];
    this.categories = new Set(['all']);
    this.totalIconCount = 0;
  }

  /**
   * Get icon packs metadata without loading all icons
   */
  async getIconPacks() {
    try {
      const data = await iconsApi.getIconPacks();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Failed to load icon packs:', error);
      throw error;
    }
  }

  /**
   * Initialize the service by loading icon packs metadata
   */
  async loadAllIconPacks() {
    try {
      const data = await iconsApi.getIconPacks();

      // API returns an array directly, not wrapped in a 'packs' property
      this.iconPacks = Array.isArray(data) ? data : [];
      this.totalIconCount = this.iconPacks.reduce((sum, pack) => sum + pack.icon_count, 0);

      // Extract categories from packs
      this.categories = new Set(['all']);
      this.iconPacks.forEach(pack => {
        if (pack.categories) {
          pack.categories.forEach(cat => this.categories.add(cat));
        }
        // Also add the pack category
        if (pack.category) {
          this.categories.add(pack.category);
        }
      });

      this.loaded = true;
    } catch (error) {
      console.error('IconPackService: Failed to load icon packs:', error);
      throw error;
    }
  }

  /**
   * Check if the service is loaded
   */
  isLoaded() {
    return this.loaded;
  }

  /**
   * Get available icon packs for dropdown
   */
  getAvailableIconPacks() {
    const packs = [
      { name: 'all', displayName: 'All Packs' },
      ...this.iconPacks.map(pack => ({
        name: pack.name,
        displayName: pack.display_name || pack.name
      }))
    ];
    return packs;
  }

  /**
   * Get available categories for dropdown
   */
  getAvailableCategories() {
    return Array.from(this.categories).sort();
  }

  /**
   * Get available categories filtered by selected pack
   */
  getAvailableCategoriesForPack(packName) {
    if (packName === 'all') {
      return this.getAvailableCategories();
    }

    const pack = this.iconPacks.find(p => p.name === packName);
    if (!pack) {
      return ['all'];
    }

    const categories = new Set(['all']);

    // Add the pack's main category
    if (pack.category) {
      categories.add(pack.category);
    }

    // Add any additional categories from the pack
    if (pack.categories) {
      pack.categories.forEach(cat => categories.add(cat));
    }

    return Array.from(categories).sort();
  }

  /**
   * Get total icon count
   */
  getTotalIconCount() {
    return this.totalIconCount;
  }

  /**
   * Get badge information for icon packs
   */
  getBadgeInfo() {
    return this.iconPacks.map(pack => ({
      name: pack.name,
      displayName: pack.display_name || pack.name,
      iconCount: pack.icon_count,
      badgeColor: this.getPackBadgeColor(pack.name)
    }));
  }

  /**
   * Get badge color for icon pack
   */
  getPackBadgeColor(packName) {
    const colorMap = {
      'aws-icons': 'warning',
      'aws-groups': 'info',
      'logos': 'success',
      'material-design-icons': 'primary',
      'heroicons': 'secondary',
      'feather': 'dark'
    };
    return colorMap[packName] || 'secondary';
  }

  /**
   * Get pack display name
   */
  getPackDisplayName(packName) {
    const pack = this.iconPacks.find(p => p.name === packName);
    return pack?.display_name || packName;
  }

  /**
   * Get all loaded icon packs
   */
  getAllIconPacks() {
    return this.iconPacks;
  }
}

export default IconPackService;
