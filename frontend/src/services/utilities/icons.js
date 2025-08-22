/**
 * Icon Management Utilities
 * Consolidated AWS Icon Loader and Icon Pack Manager
 */

import { logger } from '@/providers/LoggerProvider.jsx';

const serviceLogger = logger.createServiceLogger('IconUtilities');

// Normalize any supported icon object into a uniform shape for the UI renderer.
function normalizeIconData(iconObj) {
  if (!iconObj) {
    return null;
  }

  // Skip non-object values (numbers, strings that aren't SVG) - these might be metadata
  if (typeof iconObj !== 'object') {
    return null;
  }

  // Iconify icon object (standard): { body, width?, height?, left?, top?, ... }
  if (typeof iconObj.body === 'string') {
    const width = iconObj.width || 24;
    const height = iconObj.height || 24;
    const left = iconObj.left ?? 0;
    const top = iconObj.top ?? 0;
    const vbW = iconObj.width || 24;
    const vbH = iconObj.height || 24;
    const viewBox = iconObj.viewBox || `${left} ${top} ${vbW} ${vbH}`;
    return { body: iconObj.body, width, height, viewBox };
  }

  // Our AWS loader already returns { body, width, height, viewBox }
  if (iconObj.body && iconObj.viewBox) {
    return iconObj;
  }

  // If no body property found, this isn't an icon
  return null;
}

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
      // For AWS icons loaded via require.context, svgContent is the direct SVG string
      if (typeof svgContent === 'string') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgContent, 'image/svg+xml');
        const err = doc.querySelector('parsererror');
        if (err) return null;
        const svg = doc.documentElement;
        const viewBox = svg.getAttribute('viewBox') || '0 0 64 64';
        const width = parseInt(svg.getAttribute('width'), 10) || 64;
        const height = parseInt(svg.getAttribute('height'), 10) || 64;
        return { body: svg.innerHTML, width, height, viewBox };
      }

      // Handle legacy nested AWS icon structure: data.icon.icon contains the actual SVG
      let actualSvgContent = svgContent;

      // If svgContent is an object with nested icon data
      if (typeof svgContent === 'object' && svgContent !== null) {
        if (svgContent.icon && svgContent.icon.icon) {
          // AWS nested structure: data.icon.icon
          actualSvgContent = svgContent.icon.icon;
        } else if (svgContent.icon && typeof svgContent.icon === 'string') {
          // AWS single level: data.icon
          actualSvgContent = svgContent.icon;
        } else if (typeof svgContent.body === 'string') {
          // Already processed Iconify format
          return {
            body: svgContent.body,
            width: svgContent.width || 24,
            height: svgContent.height || 24,
            viewBox: svgContent.viewBox || '0 0 24 24'
          };
        }
      }

      // If we still don't have a string, return null
      if (typeof actualSvgContent !== 'string') {
        return null;
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(actualSvgContent, 'image/svg+xml');
      const err = doc.querySelector('parsererror');
      if (err) return null;
      const svg = doc.documentElement;
      const viewBox = svg.getAttribute('viewBox') || '0 0 64 64';
      const width = parseInt(svg.getAttribute('width'), 10) || 64;
      const height = parseInt(svg.getAttribute('height'), 10) || 64;
      return { body: svg.innerHTML, width, height, viewBox };
    } catch (error) {
      console.warn('processSvgIcon failed:', error);
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

  async getAwsServiceIcons() {
    if (this.iconPacks['architecture-service']) return this.iconPacks['architecture-service'];
    try {
      const ctx = require.context('../../../node_modules/aws-icons/icons/architecture-service', false, /\.svg$/);
      const pack = await this.buildPack('awssvg', ctx);
      this.iconPacks['architecture-service'] = pack;
      return pack;
    } catch {
      return { prefix: 'awssvg', icons: {} };
    }
  }

  async getAwsGroupIcons() {
    if (this.iconPacks['architecture-group']) return this.iconPacks['architecture-group'];
    try {
      const ctx = require.context('../../../node_modules/aws-icons/icons/architecture-group', false, /\.svg$/);
      const pack = await this.buildPack('awsgrp', ctx);
      this.iconPacks['architecture-group'] = pack;
      return pack;
    } catch {
      return { prefix: 'awsgrp', icons: {} };
    }
  }

  async getAwsCategoryIcons() {
    if (this.iconPacks['category']) return this.iconPacks['category'];
    try {
      const ctx = require.context('../../../node_modules/aws-icons/icons/category', false, /\.svg$/);
      const pack = await this.buildPack('awscat', ctx);
      this.iconPacks['category'] = pack;
      return pack;
    } catch {
      return { prefix: 'awscat', icons: {} };
    }
  }

  async getAwsResourceIcons() {
    if (this.iconPacks['resource']) return this.iconPacks['resource'];
    try {
      const ctx = require.context('../../../node_modules/aws-icons/icons/resource', false, /\.svg$/);
      const pack = await this.buildPack('awsres', ctx);
      this.iconPacks['resource'] = pack;
      return pack;
    } catch {
      return { prefix: 'awsres', icons: {} };
    }
  }

  // Helper to build a pack with a given loader
  async buildPack(prefix, reqCtx) {
    const icons = {};
    reqCtx.keys().forEach(iconPath => {
      try {
        const svgContent = reqCtx(iconPath);
        const filename = iconPath.replace('./', '');
        const icon = this.processSvgIcon(svgContent);
        if (!icon) return;
        const key = this.normalizeIconKey(filename);
        icons[key] = icon;
      } catch (e) {
        console.warn('Failed to load AWS icon:', iconPath, e);
      }
    });
    return { prefix, icons };
  }

  async loadPack(packId) {
    switch (packId) {
      case 'architecture-service':
        return this.getAwsServiceIcons();
      case 'architecture-group':
        return this.getAwsGroupIcons();
      case 'category':
        return this.getAwsCategoryIcons();
      case 'resource':
        return this.getAwsResourceIcons();
      default:
        throw new Error(`Unknown AWS pack: ${packId}`);
    }
  }

  async getAllPacks() {
    const packs = await Promise.all([
      this.getAwsServiceIcons(),
      this.getAwsGroupIcons(),
      this.getAwsCategoryIcons(),
      this.getAwsResourceIcons()
    ]);

    const results = {};
    packs.forEach((pack, index) => {
      const packIds = ['architecture-service', 'architecture-group', 'category', 'resource'];
      if (pack && Object.keys(pack.icons).length > 0) {
        results[packIds[index]] = pack;
      }
    });

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
    this.loaded = false;
    this.loading = false;
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

      // Normalize Iconify icons to ensure consistent structure
      const normalizedIcons = {};
      let successCount = 0;
      let errorCount = 0;

      Object.entries(iconSet.icons).forEach(([key, iconObj]) => {
        try {
          const normalized = normalizeIconData(iconObj);
          if (normalized) {
            normalizedIcons[key] = normalized;
            successCount++;
          } else {
            errorCount++;
          }
        } catch (e) {
          serviceLogger.warn(`Failed to normalize icon ${key} in ${displayName}:`, e);
          errorCount++;
        }
      });

      serviceLogger.info(`${displayName}: ${successCount} icons normalized, ${errorCount} failed`);

      if (successCount === 0) {
        serviceLogger.warn(`${displayName}: No icons successfully normalized - skipping pack`);
        return null;
      }

      const pack = {
        packId,
        displayName,
        description,
        category,
        badgeColor,
        prefix: iconSet.prefix || packId,
        iconCount: successCount,
        icons: normalizedIcons,
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

  // Methods needed for compatibility with existing IconBrowser
  async loadAllIconPacks() {
    if (this.loaded || this.loading) {
      while (this.loading) await new Promise(r => setTimeout(r, 50));
      return;
    }

    try {
      this.loading = true;
      serviceLogger.info('Loading icon packs...');

      // Load all configured Iconify packs
      const packPromises = ICONIFY_PACK_CONFIG.map(config => this.loadIconifyPack(config));
      await Promise.all(packPromises);

      // Load AWS packs
      const awsPacks = await this.awsIconLoader.getAllPacks();
      for (const [packId, awsPack] of Object.entries(awsPacks)) {
        if (awsPack) {
          const name = `aws-${packId}`;
          this.iconPacks.set(name, {
            packId: name,
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

      this.loaded = true;
      serviceLogger.info(`Successfully loaded ${this.iconPacks.size} total packs`);
    } catch (e) {
      serviceLogger.error('Failed to load icon packs', e);
      throw e;
    } finally {
      this.loading = false;
    }
  }

  getAvailableCategories() {
    const s = new Set(['all']);
    for (const [, meta] of this.iconPacks) s.add(meta.category);
    return Array.from(s);
  }

  getAvailableIconPacks() {
    return [{ name: 'all', displayName: 'All Icon Packs' }].concat(
      Array.from(this.iconPacks.values()).map(m => ({
        name: m.packId || m.name,
        displayName: m.displayName,
        iconCount: m.iconCount,
        badgeColor: m.badgeColor || 'secondary'
      }))
    );
  }

  getTotalIconCount() {
    let total = 0;
    for (const [, meta] of this.iconPacks) {
      total += meta.iconCount || 0;
    }
    return total;
  }

  searchIcons(searchTerm = '', category = 'all', packFilter = 'all') {
    const term = (searchTerm || '').toLowerCase().trim();
    const results = [];
    const packs = packFilter === 'all'
      ? Array.from(this.iconPacks.values())
      : [this.iconPacks.get(packFilter)].filter(Boolean);

    for (const meta of packs) {
      if (category !== 'all' && meta.category !== category) continue;
      const { icons, prefix, displayName, packId } = meta;
      const keys = Object.keys(icons || {});

      for (const key of keys) {
        if (term) {
          const matches =
            key.toLowerCase().includes(term) ||
            `${prefix}:${key}`.toLowerCase().includes(term) ||
            displayName.toLowerCase().includes(term) ||
            packId.toLowerCase().includes(term);
          if (!matches) continue;
        }
        results.push({
          key,
          prefix,
          fullName: `${prefix}:${key}`,
          pack: packId,
          packDisplayName: displayName,
          category: meta.category,
          // Flatten iconData to root level for IconBrowser compatibility
          ...icons[key]
        });
      }
    }

    return results;
  }

  isLoaded() {
    return this.loaded;
  }

  isLoading() {
    return this.loading;
  }

  getBadgeInfo() {
    return Array.from(this.iconPacks.values())
      .map(m => ({
        name: m.packId || m.name,
        displayName: m.displayName,
        iconCount: m.iconCount,
        badgeColor: m.badgeColor || 'secondary',
        category: m.category
      }))
      .sort((a, b) => a.category === b.category
        ? a.displayName.localeCompare(b.displayName)
        : a.category.localeCompare(b.category)
      );
  }

  getPackBadgeColor(packName) {
    return this.iconPacks.get(packName)?.badgeColor || 'secondary';
  }

  generateUsageExample(prefix, key, diagramType = 'architecture') {
    const fullName = `${prefix}:${key}`;
    if (diagramType === 'flowchart') {
      return `A@{ icon: "${fullName}", form: "square", label: "Service" }`;
    }
    if (prefix.includes('grp')) return `group mygroup(${fullName})[My Group]`;
    if (prefix.includes('cat')) return `service mycategory(${fullName})[My Category]`;
    if (prefix.includes('res')) return `service myresource(${fullName})[My Resource]`;
    return `service myservice(${fullName})[My Service]`;
  }
}

// Create singleton instances
const iconPackManager = new IconPackManager();
const awsIconLoader = new AwsIconLoader();

// Export both classes and singleton instances
export { IconPackManager, AwsIconLoader };
export default iconPackManager;
export { awsIconLoader };
