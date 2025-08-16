/**
 * Icon Pack Manager - Centralized service for managing all available icon packs
 * Simplified, DRY, and with correct Iconify prefixes + normalized icon data.
 */
import { logger } from '../context/LoggerProvider.jsx';
import AwsIconLoader from './AwsIconLoader.js';

const serviceLogger = logger.createServiceLogger('IconPackManager');

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
    description: 'Development tools and technology icons',
    category: 'development',
    badgeColor: 'success'
  },
  {
    loadModule: () => import(/* webpackChunkName: "iconify-flat-color" */ '@iconify-json/flat-color-icons'),
    packId: 'flat-color-icons',
    displayName: 'Flat Color Icons',
    description: 'Colorful flat design icons for UI elements',
    category: 'ui',
    badgeColor: 'warning'
  }
];

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

class IconPackManager {
  constructor() {
    this.iconPacks = new Map();
    this.loadedPacks = new Set();
    this.loadingPacks = new Set();
    this.loaded = false;
    this.loading = false;
  }

  async loadAllIconPacks() {
    if (this.loaded || this.loading) {
      while (this.loading) await new Promise(r => setTimeout(r, 50));
      return;
    }

    try {
      this.loading = true;
      serviceLogger.info('Loading icon packs...');

      // Iconify packs
      await this.loadIconifyPacks();
      serviceLogger.info(`After Iconify packs: ${this.iconPacks.size} packs loaded`);

      // AWS SVG packs
      await this.loadAwsSvgIconPacks();
      serviceLogger.info(`After AWS packs: ${this.iconPacks.size} packs loaded`);

      this.loaded = true;
      serviceLogger.info(`Successfully loaded ${this.iconPacks.size} total packs with ${this.getTotalIconCount()} icons`);
      
      // Debug: Log pack details
      for (const [name, pack] of this.iconPacks) {
        serviceLogger.debug(`Pack "${name}": ${pack.iconCount} icons, category: ${pack.category}`);
      }
    } catch (e) {
      serviceLogger.error('Failed to load icon packs', e);
      throw e; // Re-throw to ensure error handling in IconBrowser
    } finally {
      this.loading = false;
    }
  }

  async loadIconifyPacks() {
    serviceLogger.info('Starting Iconify pack loading...');
    const results = await Promise.allSettled(
      ICONIFY_PACK_CONFIG.map(cfg => this.loadIconifyPack(cfg))
    );
    
    let successCount = 0;
    let failureCount = 0;
    
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        serviceLogger.warn(`${ICONIFY_PACK_CONFIG[i].displayName} failed to load: ${r.reason}`);
        failureCount++;
      } else {
        successCount++;
      }
    });
    
    serviceLogger.info(`Iconify packs loading complete: ${successCount} successful, ${failureCount} failed`);
    
    // If no Iconify packs loaded, log a warning but don't fail completely
    if (successCount === 0) {
      serviceLogger.warn('No Iconify packs loaded successfully - only AWS icons will be available');
    }
  }

  async loadIconifyPack(config) {
    try {
      serviceLogger.debug(`Loading Iconify pack: ${config.displayName}`);
      const mod = await config.loadModule();
      const data = mod.default || mod;

      if (!data) {
        serviceLogger.warn(`${config.displayName}: No data found in module`);
        return;
      }

      // Debug: Log the actual data structure
      serviceLogger.debug(`${config.displayName}: Raw data structure`, {
        hasIcons: !!data.icons,
        iconKeys: data.icons ? Object.keys(data.icons).slice(0, 5) : 'none',
        iconCount: data.icons ? Object.keys(data.icons).length : 0,
        sampleIcon: data.icons ? data.icons[Object.keys(data.icons)[0]] : 'none',
        prefix: data.prefix,
        dataKeys: Object.keys(data)
      });

      // Correct prefix from package data, not packId.
      const actualPrefix = data?.prefix || config.packId;

      // For Iconify packages, the actual icons are in data.icons.icons
      const iconsData = data.icons?.icons || data.icons;
      
      if (!iconsData || !Object.keys(iconsData).length) {
        serviceLogger.warn(`${config.displayName}: No icons found in icons data`);
        return;
      }

      serviceLogger.debug(`${config.displayName}: Found ${Object.keys(iconsData).length} icons to process`);

      const normalizedIcons = {};
      let successCount = 0;
      let errorCount = 0;

      Object.entries(iconsData).forEach(([key, iconObj]) => {
        try {
          const norm = normalizeIconData(iconObj);
          if (norm) {
            normalizedIcons[key] = norm;
            successCount++;
          } else {
            errorCount++;
          }
        } catch (e) {
          serviceLogger.warn(`Failed to normalize icon ${key} in ${config.displayName}:`, e);
          errorCount++;
        }
      });

      serviceLogger.info(`${config.displayName}: ${successCount} icons normalized, ${errorCount} failed`);

      if (successCount === 0) {
        serviceLogger.warn(`${config.displayName}: No icons successfully normalized - skipping pack`);
        return;
      }

      const packMetadata = {
        name: actualPrefix,              // canonical name == actual iconify prefix
        displayName: config.displayName,
        prefix: actualPrefix,
        description: config.description,
        category: config.category,
        badgeColor: config.badgeColor,
        icons: { prefix: actualPrefix, icons: normalizedIcons },
        iconCount: Object.keys(normalizedIcons).length
      };

      this.iconPacks.set(actualPrefix, packMetadata);
      this.loadedPacks.add(actualPrefix);
      serviceLogger.info(`Loaded ${packMetadata.displayName} (${packMetadata.iconCount} icons)`);
    } catch (e) {
      serviceLogger.error(`Failed to load ${config.displayName}:`, e);
      // Don't re-throw, continue loading other packs
    }
  }

  async loadIconPackOnDemand(packName) {
    if (this.loadedPacks.has(packName)) return this.iconPacks.get(packName);
    if (this.loadingPacks.has(packName)) {
      while (this.loadingPacks.has(packName)) await new Promise(r => setTimeout(r, 50));
      return this.iconPacks.get(packName);
    }
    const config = ICONIFY_PACK_CONFIG.find(c => c.packId === packName);
    if (!config) return null;

    this.loadingPacks.add(packName);
    try {
      await this.loadIconifyPack(config);
      return this.iconPacks.get(packName);
    } finally {
      this.loadingPacks.delete(packName);
    }
  }

  async loadAwsSvgIconPacks() {
    const [
      awsSvgIcons, awsGroupIcons, awsCategoryIcons, awsResourceIcons
    ] = await Promise.all([
      AwsIconLoader.getAwsServiceIcons(),
      AwsIconLoader.getAwsGroupIcons(),
      AwsIconLoader.getAwsCategoryIcons(),
      AwsIconLoader.getAwsResourceIcons()
    ]);

    const register = (name, displayName, badgeColor, pack) => {
      if (pack?.icons && Object.keys(pack.icons).length) {
        this.iconPacks.set(name, {
          name,
          displayName,
          prefix: name,
          description: displayName,
          category: 'aws',
          badgeColor,
          icons: pack,
          iconCount: Object.keys(pack.icons).length
        });
        this.loadedPacks.add(name);
      }
    };

    register('awssvg', 'AWS Services (SVG)', 'danger', awsSvgIcons);
    register('awsgrp', 'AWS Groups', 'dark', awsGroupIcons);
    register('awscat', 'AWS Categories', 'primary', awsCategoryIcons);
    register('awsres', 'AWS Resources', 'light', awsResourceIcons);
  }

  getIconPacks() {
    return this.iconPacks;
  }

  getTotalIconCount() {
    let total = 0;
    for (const [, meta] of this.iconPacks) {
      total += meta.iconCount || 0;
    }
    return total;
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

  // Unified, fast search
  searchIcons(searchTerm = '', category = 'all', packFilter = 'all') {
    const term = (searchTerm || '').toLowerCase().trim();
    const results = [];
    const packs = packFilter === 'all'
      ? Array.from(this.iconPacks.values())
      : [this.iconPacks.get(packFilter)].filter(Boolean);

    serviceLogger.debug(`Searching icons: term="${term}", category="${category}", pack="${packFilter}"`);
    serviceLogger.debug(`Available packs for search: ${packs.length}`);

    for (const meta of packs) {
      if (category !== 'all' && meta.category !== category) continue;
      const { icons, prefix, displayName, name } = meta;
      const keys = Object.keys(icons?.icons || {});
      
      serviceLogger.debug(`Pack "${name}": ${keys.length} icons available`);
      
      for (const key of keys) {
        if (term) {
          const matches =
            key.toLowerCase().includes(term) ||
            `${prefix}:${key}`.toLowerCase().includes(term) ||
            displayName.toLowerCase().includes(term) ||
            name.toLowerCase().includes(term);
          if (!matches) continue;
        }
        results.push({
          key,
          prefix,
          fullName: `${prefix}:${key}`,
          pack: name,
          packDisplayName: displayName,
          category: meta.category,
          iconData: icons.icons[key] // already normalized
        });
      }
    }
    
    serviceLogger.debug(`Search results: ${results.length} icons found`);
    return results;
  }

  getAvailableCategories() {
    const s = new Set(['all']);
    for (const [, meta] of this.iconPacks) s.add(meta.category);
    return Array.from(s);
  }

  getAvailableIconPacks() {
    return [{ name: 'all', displayName: 'All Icon Packs' }].concat(
      Array.from(this.iconPacks.values()).map(m => ({
        name: m.name,
        displayName: m.displayName,
        iconCount: m.iconCount,
        badgeColor: m.badgeColor || 'secondary'
      }))
    );
  }

  getBadgeInfo() {
    return Array.from(this.iconPacks.values())
      .map(m => ({
        name: m.name,
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

  isLoaded() { return this.loaded; }
  isLoading() { return this.loading; }
}

export default new IconPackManager();
