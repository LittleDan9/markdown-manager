/**
 * AWS Icon Loader - Dynamically imports AWS architectural icons from the aws-icons package
 * This creates a bridge between the official AWS SVG files and Mermaid's icon system
 */

class AwsIconLoader {
  constructor() {
    this.iconCache = new Map();
    this.iconPacks = {
      'architecture-service': null,
      'architecture-group': null,
      'category': null,
      'resource': null
    };
  }

  /**
   * Process SVG content to extract the body for Mermaid
   * @param {string} svgContent - Raw SVG content
   * @returns {Object} - Icon data in Mermaid format
   */
  processSvgIcon(svgContent) {
    try {
      // Parse the SVG content
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
      const svgElement = svgDoc.documentElement;

      // Check for parsing errors
      const errorNode = svgDoc.querySelector('parsererror');
      if (errorNode) {
        console.warn('SVG parsing error:', errorNode.textContent);
        return null;
      }

      // Extract attributes
      const viewBox = svgElement.getAttribute('viewBox') || '0 0 64 64';
      const width = parseInt(svgElement.getAttribute('width')) || 64;
      const height = parseInt(svgElement.getAttribute('height')) || 64;

      // Get the inner content (everything inside the <svg> tag)
      const body = svgElement.innerHTML;

      return {
        body: body,
        width: width,
        height: height,
        viewBox: viewBox
      };
    } catch (error) {
      console.error('Error processing SVG:', error);
      return null;
    }
  }

  /**
   * Convert filename to icon key
   * @param {string} filename - Original filename
   * @returns {string} - Normalized icon key
   */
  normalizeIconKey(filename) {
    return filename
      .replace(/\.svg$/, '') // Remove .svg extension
      .replace(/^(Amazon|AWS)/, '') // Remove Amazon/AWS prefix
      .replace(/([a-z])([A-Z])/g, '$1-$2') // Convert camelCase to kebab-case
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Create multiple aliases for an icon
   * @param {string} originalKey - Original icon key
   * @param {string} filename - Original filename
   * @returns {Array} - Array of possible keys
   */
  createIconAliases(originalKey, filename) {
    const aliases = [originalKey];

    // Add original filename without extension
    const baseFilename = filename.replace(/\.svg$/, '');
    if (baseFilename !== originalKey) {
      aliases.push(baseFilename.toLowerCase());
    }

    // Add common variations
    const variations = [
      originalKey.replace(/-/g, ''), // Remove all hyphens
      originalKey.replace(/-/g, '_'), // Underscores instead of hyphens
      baseFilename.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase(), // camelCase to kebab-case
      baseFilename.toLowerCase().replace(/[^a-z0-9]/g, ''), // Alphanumeric only
    ];

    variations.forEach(variation => {
      if (variation && !aliases.includes(variation)) {
        aliases.push(variation);
      }
    });

    return aliases;
  }

  /**
   * Dynamically load all AWS service icons
   * @returns {Object} - Icon pack for Mermaid with all AWS architectural icons
   */
  async getAwsServiceIcons() {
    if (this.iconPacks['architecture-service']) {
      return this.iconPacks['architecture-service'];
    }

    try {
      // Use webpack's require.context to dynamically import all service icons
      const serviceIconsContext = require.context(
        '../../node_modules/aws-icons/icons/architecture-service',
        false,
        /\.svg$/
      );

      const icons = {};
      const loadedIcons = [];

      // Process each icon file
      serviceIconsContext.keys().forEach(iconPath => {
        try {
          const svgContent = serviceIconsContext(iconPath);
          const filename = iconPath.replace('./', '');
          const iconData = this.processSvgIcon(svgContent);

          if (iconData) {
            const normalizedKey = this.normalizeIconKey(filename);
            const aliases = this.createIconAliases(normalizedKey, filename);

            // Add icon under all aliases
            aliases.forEach(alias => {
              icons[alias] = iconData;
            });

            loadedIcons.push({
              filename,
              normalizedKey,
              aliases: aliases.slice(0, 3) // Show first 3 aliases for logging
            });
          }
        } catch (error) {
          console.warn(`Failed to load icon ${iconPath}:`, error);
        }
      });

      console.log(`Loaded ${loadedIcons.length} AWS service icons:`, loadedIcons);

      const iconPack = {
        prefix: 'awssvg',
        icons: icons
      };

      this.iconPacks['architecture-service'] = iconPack;
      return iconPack;

    } catch (error) {
      console.error('Failed to load AWS service icons dynamically:', error);
      return { prefix: 'awssvg', icons: {} };
    }
  }

  /**
   * Load AWS group icons (groups of services)
   * @returns {Object} - Icon pack for AWS groups
   */
  async getAwsGroupIcons() {
    if (this.iconPacks['architecture-group']) {
      return this.iconPacks['architecture-group'];
    }

    try {
      const groupIconsContext = require.context(
        '../../node_modules/aws-icons/icons/architecture-group',
        false,
        /\.svg$/
      );

      const icons = {};
      groupIconsContext.keys().forEach(iconPath => {
        try {
          const svgContent = groupIconsContext(iconPath);
          const filename = iconPath.replace('./', '');
          const iconData = this.processSvgIcon(svgContent);

          if (iconData) {
            const normalizedKey = this.normalizeIconKey(filename);
            const aliases = this.createIconAliases(normalizedKey, filename);

            aliases.forEach(alias => {
              icons[alias] = iconData;
            });
          }
        } catch (error) {
          console.warn(`Failed to load group icon ${iconPath}:`, error);
        }
      });

      const iconPack = {
        prefix: 'awsgrp',
        icons: icons
      };

      this.iconPacks['architecture-group'] = iconPack;
      return iconPack;

    } catch (error) {
      console.error('Failed to load AWS group icons:', error);
      return { prefix: 'awsgrp', icons: {} };
    }
  }

  /**
   * Load AWS category icons
   * @returns {Object} - Icon pack for AWS categories
   */
  async getAwsCategoryIcons() {
    if (this.iconPacks['category']) {
      return this.iconPacks['category'];
    }

    try {
      const categoryIconsContext = require.context(
        '../../node_modules/aws-icons/icons/category',
        false,
        /\.svg$/
      );

      const icons = {};
      categoryIconsContext.keys().forEach(iconPath => {
        try {
          const svgContent = categoryIconsContext(iconPath);
          const filename = iconPath.replace('./', '');
          const iconData = this.processSvgIcon(svgContent);

          if (iconData) {
            const normalizedKey = this.normalizeIconKey(filename);
            const aliases = this.createIconAliases(normalizedKey, filename);

            aliases.forEach(alias => {
              icons[alias] = iconData;
            });
          }
        } catch (error) {
          console.warn(`Failed to load category icon ${iconPath}:`, error);
        }
      });

      const iconPack = {
        prefix: 'awscat',
        icons: icons
      };

      this.iconPacks['category'] = iconPack;
      return iconPack;

    } catch (error) {
      console.error('Failed to load AWS category icons:', error);
      return { prefix: 'awscat', icons: {} };
    }
  }

  /**
   * Load AWS resource icons
   * @returns {Object} - Icon pack for AWS resources
   */
  async getAwsResourceIcons() {
    if (this.iconPacks['resource']) {
      return this.iconPacks['resource'];
    }

    try {
      const resourceIconsContext = require.context(
        '../../node_modules/aws-icons/icons/resource',
        false,
        /\.svg$/
      );

      const icons = {};
      resourceIconsContext.keys().forEach(iconPath => {
        try {
          const svgContent = resourceIconsContext(iconPath);
          const filename = iconPath.replace('./', '');
          const iconData = this.processSvgIcon(svgContent);

          if (iconData) {
            const normalizedKey = this.normalizeIconKey(filename);
            const aliases = this.createIconAliases(normalizedKey, filename);

            aliases.forEach(alias => {
              icons[alias] = iconData;
            });
          }
        } catch (error) {
          console.warn(`Failed to load resource icon ${iconPath}:`, error);
        }
      });

      const iconPack = {
        prefix: 'awsres',
        icons: icons
      };

      this.iconPacks['resource'] = iconPack;
      return iconPack;

    } catch (error) {
      console.error('Failed to load AWS resource icons:', error);
      return { prefix: 'awsres', icons: {} };
    }
  }

  /**
   * Get all AWS networking and architectural icons
   * @returns {Object} - Complete icon pack for Mermaid
   */
  async getAllAwsServiceIcons() {
    return await this.getAwsServiceIcons();
  }

  /**
   * Get all available icon packs
   * @returns {Array} - Array of all available icon packs
   */
  async getAllIconPacks() {
    const packs = await Promise.all([
      this.getAwsServiceIcons(),
      this.getAwsGroupIcons(),
      this.getAwsCategoryIcons(),
      this.getAwsResourceIcons()
    ]);

    return packs.filter(pack => pack && Object.keys(pack.icons).length > 0);
  }

  /**
   * Get detailed information about all loaded icons for documentation/browsing
   * @returns {Array} - Array of icon metadata
   */
  async getIconMetadata() {
    const servicePack = await this.getAwsServiceIcons();
    const groupPack = await this.getAwsGroupIcons();
    const categoryPack = await this.getAwsCategoryIcons();
    const resourcePack = await this.getAwsResourceIcons();

    const metadata = [];

    // Process service icons
    if (servicePack && servicePack.icons) {
      Object.entries(servicePack.icons).forEach(([key, iconData]) => {
        metadata.push({
          key,
          prefix: 'awssvg',
          fullName: `awssvg:${key}`,
          category: 'service',
          iconData,
          usage: `service myservice(awssvg:${key})[My Service]`
        });
      });
    }

    // Process group icons
    if (groupPack && groupPack.icons) {
      Object.entries(groupPack.icons).forEach(([key, iconData]) => {
        metadata.push({
          key,
          prefix: 'awsgrp',
          fullName: `awsgrp:${key}`,
          category: 'group',
          iconData,
          usage: `group mygroup(awsgrp:${key})[My Group]`
        });
      });
    }

    // Process category icons
    if (categoryPack && categoryPack.icons) {
      Object.entries(categoryPack.icons).forEach(([key, iconData]) => {
        metadata.push({
          key,
          prefix: 'awscat',
          fullName: `awscat:${key}`,
          category: 'category',
          iconData,
          usage: `service mycategory(awscat:${key})[My Category]`
        });
      });
    }

    // Process resource icons
    if (resourcePack && resourcePack.icons) {
      Object.entries(resourcePack.icons).forEach(([key, iconData]) => {
        metadata.push({
          key,
          prefix: 'awsres',
          fullName: `awsres:${key}`,
          category: 'resource',
          iconData,
          usage: `service myresource(awsres:${key})[My Resource]`
        });
      });
    }

    return metadata;
  }
}

export default new AwsIconLoader();
