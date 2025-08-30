/**
 * Backend-based I      // console.log('IconService: Starting to load icon packs...');
      const data = await iconApi.getIconPacks();
      // console.log('IconService: Received data:', data); Service
 * Replaces the local package-based IconPackManager with API calls to the backend icon service
 */

import { iconsApi } from '@/api/iconsApi.js';

class IconService {
  constructor() {
    this.loaded = false;
    this.iconPacks = [];
    this.categories = new Set(['all']);
    this.totalIconCount = 0;
    this.cache = new Map(); // Simple client-side cache for search results
    this.cacheTimeout = 60000; // 1 minute cache timeout
  }

  /**
   * Initialize the service by loading icon packs metadata
   */
  async loadAllIconPacks() {
    try {
      // console.log('IconService: Starting to load icon packs...');
      const data = await iconsApi.getIconPacks();
      // console.log('IconService: Received data:', data);

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
      // console.log('IconService: Successfully loaded', this.iconPacks.length, 'icon packs');
    } catch (error) {
      console.error('IconService: Failed to load icon packs:', error);
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
   * Search icons with caching
   */
  async searchIcons(searchTerm = '', category = 'all', pack = 'all', page = 0, size = 100) {
    // console.log('IconService.searchIcons called with:', { searchTerm, category, pack, page, size });

    const cacheKey = `${searchTerm}-${category}-${pack}-${page}-${size}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      // console.log('IconService: Returning cached result');
      return cached.data;
    }

    try {
      // console.log('IconService: Making API call...');
      const data = await iconsApi.searchIcons({
        q: searchTerm,
        pack: pack,
        category: category,
        page: page,
        size: size
      });

      // console.log('IconService: API returned:', data);

      // Transform backend response to match frontend expectations
      const transformedIcons = data.icons.map(icon => {
        // Extract width/height from viewBox to ensure consistency
        let width = 24;
        let height = 24;
        let viewBox = icon.icon_data?.viewBox || '0 0 24 24';

        // Parse viewBox to get correct dimensions
        const viewBoxMatch = viewBox.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/);
        if (viewBoxMatch) {
          width = parseFloat(viewBoxMatch[3]);
          height = parseFloat(viewBoxMatch[4]);
        } else {
          // Fallback to provided width/height if viewBox parsing fails
          width = icon.icon_data?.width || 24;
          height = icon.icon_data?.height || 24;
        }

        return {
          key: icon.key,
          prefix: icon.pack.name,
          pack: icon.pack.name,
          packDisplayName: icon.pack.display_name,
          category: icon.pack.category,
          fullName: `${icon.pack.name}:${icon.key}`,
          iconData: {
            body: icon.icon_data?.body || icon.icon_data,
            viewBox: viewBox,
            width: width,
            height: height
          }
        };
      });

      // console.log('IconService: Transformed icons:', transformedIcons.length);

      // Cache the result
      this.cache.set(cacheKey, {
        data: transformedIcons,
        timestamp: Date.now()
      });

      return transformedIcons;
    } catch (error) {
      console.error('IconService: Search failed:', error);
      throw error;
    }
  }

  /**
   * Get pack display name
   */
  getPackDisplayName(packName) {
    const pack = this.iconPacks.find(p => p.name === packName);
    return pack?.display_name || packName;
  }

  /**
   * Generate usage example for Mermaid diagrams
   */
  generateUsageExample(prefix, key, diagramType) {
    const iconRef = `${prefix}:${key}`;

    if (diagramType === 'architecture') {
      // Determine if it's a group or service based on prefix
      if (prefix.includes('grp') || prefix.includes('group')) {
        return `group mygroup(${iconRef})[My Group]`;
      } else {
        return `service myservice(${iconRef})[My Service]`;
      }
    } else if (diagramType === 'flowchart') {
      return `A@{ icon: "${iconRef}", form: "square", label: "Node" }`;
    }

    return iconRef;
  }

  /**
   * Get SVG content for an icon
   */
  async getIconSVG(pack, key) {
    try {
      const data = await iconsApi.getIconSVG(pack, key);
      return data.content;
    } catch (error) {
      console.error('Failed to get SVG:', error);
      throw error;
    }
  }

  /**
   * Batch get icons by full keys
   */
  async batchGetIcons(iconKeys) {
    try {
      const data = await iconsApi.batchGetIcons(iconKeys);
      return {
        found: data.icons,
        notFound: data.not_found
      };
    } catch (error) {
      console.error('Batch get failed:', error);
      throw error;
    }
  }

  /**
   * Track icon usage (optional analytics)
   */
  async trackUsage(pack, key, userId = null) {
    await iconsApi.trackUsage(pack, key, userId);
  }

  /**
   * Get cache statistics (for debugging)
   */
  async getCacheStats() {
    try {
      return await iconsApi.getCacheStats();
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      throw error;
    }
  }

  /**
   * Clear cache (both client and server)
   */
  async clearCache() {
    // Clear client cache
    this.cache.clear();

    // Clear server cache
    try {
      await iconsApi.clearCache();
    } catch (error) {
      console.warn('Failed to clear server cache:', error);
    }
  }

  /**
   * Install new icon pack (admin function)
   */
  async installIconPack(packData, mappingConfig, packageType = 'json') {
    try {
      const result = await iconsApi.installIconPack(packData, mappingConfig, packageType);

      // Reload packs after installation
      await this.loadAllIconPacks();

      return result;
    } catch (error) {
      console.error('Failed to install icon pack:', error);
      throw error;
    }
  }
}

// Create singleton instance
const iconService = new IconService();

export { iconService as IconService };
export default iconService;
