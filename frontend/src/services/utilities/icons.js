/**
 * Icon Management Utilities
 * Consolidated AWS Icon Loader and Icon Pack Manager
 */

import { logger } from '@/providers/LoggerProvider.jsx';

const serviceLogger = logger.createServiceLogger('IconUtilities');

/**
 * AWS Icon Loader - simplified and consistent normalizer
 * Returns { prefix, icons: { [key]: { body, width, height, viewBox } } }
 */
class AwsIconLoader {
  constructor() {
    this.iconPacks = {
      'architecture-service': null,
      'architecture-group': null,
      'category': null,
      'resource': null
    };
  }

  processSvgIcon(svgContent) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgContent, 'image/svg+xml');
      const err = doc.querySelector('parsererror');
      if (err) return null;
      const svg = doc.documentElement;
      const viewBox = svg.getAttribute('viewBox') || '0 0 64 64';
      const width = parseInt(svg.getAttribute('width'), 10) || 64;
      const height = parseInt(svg.getAttribute('height'), 10) || 64;
      return { body: svg.innerHTML, width, height, viewBox };
    } catch {
      return null;
    }
  }

  normalizeIconKey(filename) {
    return filename
      .replace(/\.svg$/, '')
      .replace(/[\s_-]+/g, '-')
      .toLowerCase()
      .replace(/^arch-/, '')
      .replace(/^aws-/, '');
  }

  async loadPack(packId) {
    if (this.iconPacks[packId]) return this.iconPacks[packId];

    try {
      const response = await fetch(`/aws-icons/${packId}/icons.json`);
      if (!response.ok) throw new Error(`Failed to load pack: ${packId}`);

      const iconsData = await response.json();
      const normalizedPack = {
        prefix: `aws-${packId}`,
        icons: {}
      };

      for (const [filename, svgContent] of Object.entries(iconsData)) {
        const iconData = this.processSvgIcon(svgContent);
        if (iconData) {
          const key = this.normalizeIconKey(filename);
          normalizedPack.icons[key] = iconData;
        }
      }

      this.iconPacks[packId] = normalizedPack;
      return normalizedPack;
    } catch (error) {
      console.error(`AwsIconLoader: Failed to load pack ${packId}:`, error);
      return null;
    }
  }

  async getAllPacks() {
    const results = {};
    const packPromises = Object.keys(this.iconPacks).map(async (packId) => {
      const pack = await this.loadPack(packId);
      if (pack) results[packId] = pack;
    });

    await Promise.all(packPromises);
    return results;
  }

  async searchIcons(query, maxResults = 50) {
    const allPacks = await this.getAllPacks();
    const results = [];
    const searchTerm = query.toLowerCase();

    for (const [packId, pack] of Object.entries(allPacks)) {
      if (!pack) continue;

      for (const [iconKey, iconData] of Object.entries(pack.icons)) {
        if (iconKey.includes(searchTerm) && results.length < maxResults) {
          results.push({
            key: iconKey,
            pack: packId,
            prefix: pack.prefix,
            ...iconData
          });
        }
      }
    }

    return results;
  }
}

// Configuration for Iconify packs to load dynamically
const ICONIFY_PACK_CONFIG = [
  {
    loadModule: () => import(/* webpackChunkName: "iconify-logos" */ '@iconify-json/logos'),
    packId: 'logos',
    displayName: 'Iconify Logos',
    description: 'Brand and technology logos from Iconify',
    category: 'logos',
    badgeColor: 'secondary'
  },
  {
    loadModule: () => import(/* webpackChunkName: "iconify-material" */ '@iconify-json/material-icon-theme'),
    packId: 'material-icon-theme',
    displayName: 'Material Icons',
    description: 'Material design icons for various file types and folders',
    category: 'material',
    badgeColor: 'info'
  },
  {
    loadModule: () => import(/* webpackChunkName: "iconify-devicon" */ '@iconify-json/devicon'),
    packId: 'devicon',
    displayName: 'Devicon',
    description: 'Development and programming icons',
    category: 'development',
    badgeColor: 'warning'
  },
  {
    loadModule: () => import(/* webpackChunkName: "iconify-flat-color" */ '@iconify-json/flat-color-icons'),
    packId: 'flat-color-icons',
    displayName: 'Flat Color Icons',
    description: 'Colorful flat icons for various categories',
    category: 'general',
    badgeColor: 'success'
  }
];

/**
 * Icon Pack Manager - Centralized service for managing all available icon packs
 */
class IconPackManager {
  constructor() {
    this.iconPacks = new Map();
    this.loadStates = new Map();
    this.awsIconLoader = new AwsIconLoader();
  }

  async loadIconifyPack(config) {
    const { packId, loadModule, displayName, description, category, badgeColor } = config;

    if (this.loadStates.get(packId) === 'loading') {
      return new Promise((resolve) => {
        const checkLoaded = () => {
          if (this.iconPacks.has(packId)) {
            resolve(this.iconPacks.get(packId));
          } else {
            setTimeout(checkLoaded, 100);
          }
        };
        checkLoaded();
      });
    }

    if (this.iconPacks.has(packId)) {
      return this.iconPacks.get(packId);
    }

    this.loadStates.set(packId, 'loading');

    try {
      serviceLogger.info(`Loading Iconify pack: ${packId}`);
      const module = await loadModule();
      const iconSet = module?.default || module;

      if (!iconSet?.icons) {
        throw new Error(`Invalid icon set structure for ${packId}`);
      }

      const pack = {
        packId,
        displayName,
        description,
        category,
        badgeColor,
        prefix: iconSet.prefix || packId,
        iconCount: Object.keys(iconSet.icons).length,
        icons: iconSet.icons,
        width: iconSet.width,
        height: iconSet.height
      };

      this.iconPacks.set(packId, pack);
      this.loadStates.set(packId, 'loaded');
      serviceLogger.info(`Successfully loaded ${pack.iconCount} icons from ${displayName}`);

      return pack;
    } catch (error) {
      serviceLogger.error(`Failed to load Iconify pack ${packId}:`, error);
      this.loadStates.set(packId, 'error');
      return null;
    }
  }

  async getAllIconPacks() {
    const packPromises = ICONIFY_PACK_CONFIG.map(config => this.loadIconifyPack(config));
    await Promise.all(packPromises);

    // Also load AWS icon packs
    const awsPacks = await this.awsIconLoader.getAllPacks();

    // Convert AWS packs to same format
    const allPacks = Array.from(this.iconPacks.values());
    
    for (const [packId, awsPack] of Object.entries(awsPacks)) {
      if (awsPack) {
        allPacks.push({
          packId: `aws-${packId}`,
          displayName: `AWS ${packId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
          description: `AWS ${packId} architecture icons`,
          category: 'aws',
          badgeColor: 'primary',
          prefix: awsPack.prefix,
          iconCount: Object.keys(awsPack.icons).length,
          icons: awsPack.icons
        });
      }
    }

    return allPacks;
  }

  async searchIcons(query, category = null, maxResults = 100) {
    const allPacks = await this.getAllIconPacks();
    const results = [];
    const searchTerm = query.toLowerCase();

    for (const pack of allPacks) {
      if (category && pack.category !== category) continue;

      for (const [iconKey, iconData] of Object.entries(pack.icons)) {
        if (iconKey.includes(searchTerm) && results.length < maxResults) {
          results.push({
            key: iconKey,
            pack: pack.packId,
            prefix: pack.prefix,
            category: pack.category,
            displayName: pack.displayName,
            ...iconData
          });
        }
      }
    }

    return results.sort((a, b) => a.key.localeCompare(b.key));
  }

  getPackInfo() {
    return ICONIFY_PACK_CONFIG.map(config => ({
      packId: config.packId,
      displayName: config.displayName,
      description: config.description,
      category: config.category,
      badgeColor: config.badgeColor,
      isLoaded: this.iconPacks.has(config.packId),
      loadState: this.loadStates.get(config.packId) || 'not-loaded'
    }));
  }
}

// Create singleton instances
const iconPackManager = new IconPackManager();
const awsIconLoader = new AwsIconLoader();

// Export both classes and singleton instances
export { IconPackManager, AwsIconLoader };
export default iconPackManager;
export { awsIconLoader };
