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
      .replace(/\.svg$/i, '')
      .replace(/^(Amazon|AWS)/, '')
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  createIconAliases(originalKey, filename) {
    const base = filename.replace(/\.svg$/i, '');
    const variants = new Set([
      originalKey,
      base.toLowerCase(),
      originalKey.replace(/-/g, ''),
      originalKey.replace(/-/g, '_'),
      base.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase(),
      base.toLowerCase().replace(/[^a-z0-9]/g, '')
    ]);
    return Array.from(variants);
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
        const aliases = this.createIconAliases(key, filename);
        aliases.forEach(a => { icons[a] = icon; });
      } catch (e) {
        // swallow individual icon errors
        console.warn('Failed to load icon:', iconPath, e);
      }
    });
    return { prefix, icons };
  }

  async getAwsServiceIcons() {
    if (this.iconPacks['architecture-service']) return this.iconPacks['architecture-service'];
    try {
      const ctx = require.context('../../node_modules/aws-icons/icons/architecture-service', false, /\.svg$/);
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
      const ctx = require.context('../../node_modules/aws-icons/icons/architecture-group', false, /\.svg$/);
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
      const ctx = require.context('../../node_modules/aws-icons/icons/category', false, /\.svg$/);
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
      const ctx = require.context('../../node_modules/aws-icons/icons/resource', false, /\.svg$/);
      const pack = await this.buildPack('awsres', ctx);
      this.iconPacks['resource'] = pack;
      return pack;
    } catch {
      return { prefix: 'awsres', icons: {} };
    }
  }

  async getAllIconPacks() {
    const packs = await Promise.all([
      this.getAwsServiceIcons(),
      this.getAwsGroupIcons(),
      this.getAwsCategoryIcons(),
      this.getAwsResourceIcons()
    ]);
    return packs.filter(p => p && Object.keys(p.icons).length > 0);
  }
}

export default new AwsIconLoader();
