/**
 * Enhanced Icon Pack Manager with Lazy Loading
 * Optimized version that loads icon packs on demand
 */
import { logger } from '@/providers/LoggerProvider.jsx';

const serviceLogger = logger.createServiceLogger('OptimizedIconPackManager');

class OptimizedIconPackManager {
  constructor() {
    this.iconPacks = new Map();
    this.loadedPacks = new Set();
    this.loadingPacks = new Set();
    this.loaded = false;
    this.loading = false;
  }

  /**
   * Load only essential icon packs initially
   */
  async loadEssentialPacks() {
    if (this.loading || this.loaded) return;
    
    this.loading = true;
    serviceLogger.info('Loading essential icon packs...');

    try {
      // Load only the most commonly used pack initially
      await this.loadIconifyPack({
        loadModule: () => import(/* webpackChunkName: "iconify-logos" */ '@iconify-json/logos'),
        packId: 'logos',
        displayName: 'Iconify Logos',
        category: 'logos',
        badgeColor: 'secondary'
      });

      this.loaded = true;
      serviceLogger.info('Essential icon packs loaded successfully');
    } catch (error) {
      serviceLogger.error('Failed to load essential icon packs:', error);
    } finally {
      this.loading = false;
    }
  }

  /**
   * Load additional icon packs on demand
   */
  async loadAdditionalPacks() {
    const additionalPacks = [
      {
        loadModule: () => import(/* webpackChunkName: "iconify-material" */ '@iconify-json/material-icon-theme'),
        packId: 'material-icon-theme',
        displayName: 'Material Icons',
        category: 'material',
        badgeColor: 'info'
      },
      {
        loadModule: () => import(/* webpackChunkName: "iconify-devicon" */ '@iconify-json/devicon'),
        packId: 'devicon',
        displayName: 'Devicon',
        category: 'devicon',
        badgeColor: 'success'
      },
      {
        loadModule: () => import(/* webpackChunkName: "iconify-flat-color" */ '@iconify-json/flat-color-icons'),
        packId: 'flat-color-icons',
        displayName: 'Flat Color Icons',
        category: 'flat-color',
        badgeColor: 'warning'
      }
    ];

    const results = await Promise.allSettled(
      additionalPacks.map(cfg => this.loadIconifyPack(cfg))
    );

    let successCount = 0;
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successCount++;
      } else {
        serviceLogger.warn(`Failed to load ${additionalPacks[index].displayName}:`, result.reason);
      }
    });

    serviceLogger.info(`Additional packs loaded: ${successCount}/${additionalPacks.length}`);
  }

  /**
   * Load a specific icon pack on demand
   */
  async loadIconifyPack(config) {
    const { packId, loadModule, displayName } = config;

    if (this.loadedPacks.has(packId)) {
      return this.iconPacks.get(packId);
    }

    if (this.loadingPacks.has(packId)) {
      // Wait for existing load to complete
      while (this.loadingPacks.has(packId)) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.iconPacks.get(packId);
    }

    this.loadingPacks.add(packId);

    try {
      serviceLogger.debug(`Loading icon pack: ${displayName}`);
      const module = await loadModule();
      const iconData = module.icons || {};
      
      const pack = {
        prefix: packId,
        icons: iconData,
        iconCount: Object.keys(iconData).length,
        displayName,
        category: config.category,
        badgeColor: config.badgeColor
      };

      this.iconPacks.set(packId, pack);
      this.loadedPacks.add(packId);
      
      serviceLogger.debug(`Successfully loaded ${pack.iconCount} icons from ${displayName}`);
      return pack;
    } catch (error) {
      serviceLogger.error(`Failed to load icon pack ${displayName}:`, error);
      throw error;
    } finally {
      this.loadingPacks.delete(packId);
    }
  }

  /**
   * Search icons across loaded packs with lazy loading fallback
   */
  async searchIcons(query, maxResults = 50) {
    // Ensure essential packs are loaded
    if (!this.loaded) {
      await this.loadEssentialPacks();
    }

    let results = [];
    
    // Search in already loaded packs
    for (const [packId, pack] of this.iconPacks) {
      const packResults = this.searchInPack(pack, query, maxResults - results.length);
      results.push(...packResults);
      
      if (results.length >= maxResults) break;
    }

    // If we don't have enough results and haven't loaded additional packs yet
    if (results.length < maxResults && this.loadedPacks.size === 1) {
      try {
        await this.loadAdditionalPacks();
        
        // Search in newly loaded packs
        for (const [packId, pack] of this.iconPacks) {
          if (!this.loadedPacks.has(packId)) continue;
          
          const packResults = this.searchInPack(pack, query, maxResults - results.length);
          results.push(...packResults);
          
          if (results.length >= maxResults) break;
        }
      } catch (error) {
        serviceLogger.warn('Failed to load additional packs for search:', error);
      }
    }

    return results.slice(0, maxResults);
  }

  /**
   * Search within a specific pack
   */
  searchInPack(pack, query, maxResults) {
    if (!pack || !pack.icons) return [];

    const lowerQuery = query.toLowerCase();
    const results = [];

    for (const [iconName, iconData] of Object.entries(pack.icons)) {
      if (iconName.toLowerCase().includes(lowerQuery)) {
        results.push({
          name: iconName,
          pack: pack.prefix,
          packDisplayName: pack.displayName,
          category: pack.category,
          badgeColor: pack.badgeColor,
          data: iconData
        });

        if (results.length >= maxResults) break;
      }
    }

    return results;
  }

  /**
   * Get all loaded packs
   */
  getLoadedPacks() {
    return Array.from(this.iconPacks.values());
  }

  /**
   * Get loading status
   */
  getLoadingStatus() {
    return {
      loaded: this.loaded,
      loading: this.loading,
      loadedPacks: Array.from(this.loadedPacks),
      loadingPacks: Array.from(this.loadingPacks),
      totalPacks: this.iconPacks.size
    };
  }

  /**
   * Clear cache
   */
  clear() {
    this.iconPacks.clear();
    this.loadedPacks.clear();
    this.loadingPacks.clear();
    this.loaded = false;
    this.loading = false;
  }
}

// Export singleton instance
export default new OptimizedIconPackManager();
