/**
 * Icon Search Service
 * Handles searching and filtering icons with data transformation
 */

import { iconsApi } from '@/api/iconsApi.js';

class IconSearchService {
  /**
   * Search icons with transformation
   */
  async searchIcons(searchTerm = '', category = 'all', pack = 'all', page = 0, size = 100, packs = null) {
    try {
      const params = {
        q: searchTerm,
        category: category,
        page: page,
        size: Math.min(size, 100) // Backend caps at 100
      };

      // Multi-pack takes priority
      if (packs && packs.length > 0) {
        params.packs = packs;
      } else {
        params.pack = pack;
      }

      const data = await iconsApi.searchIcons(params);

      // Transform backend response to match frontend expectations
      const transformedIcons = data.icons.map(icon => {
        // Extract width/height from viewBox to ensure consistency
        let width = 24;
        let height = 24;
        const viewBox = icon.icon_data?.viewBox || '0 0 24 24';

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
          id: icon.id,
          key: icon.key,
          displayName: icon.display_name || this._humanizeKey(icon.key),
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

      return {
        icons: transformedIcons,
        total: data.total,
        page: data.page,
        size: data.size,
        pages: data.pages,
        has_next: data.has_next,
        has_prev: data.has_prev
      };
    } catch (error) {
      console.error('IconSearchService: Search failed:', error);
      throw error;
    }
  }

  /**
   * Get frequently used icons, transformed for the frontend.
   */
  async getFrequentlyUsed(limit = 12) {
    try {
      const icons = await iconsApi.getFrequentlyUsed(limit);
      return icons.map(icon => ({
        id: icon.id,
        key: icon.key,
        displayName: icon.display_name || this._humanizeKey(icon.key),
        prefix: icon.pack.name,
        pack: icon.pack.name,
        packDisplayName: icon.pack.display_name,
        category: icon.pack.category,
        fullName: `${icon.pack.name}:${icon.key}`,
        accessCount: icon.access_count,
        iconData: {
          body: icon.icon_data?.body || icon.icon_data,
          viewBox: icon.icon_data?.viewBox || '0 0 24 24',
          width: icon.icon_data?.width || 24,
          height: icon.icon_data?.height || 24,
        },
      }));
    } catch (error) {
      console.warn('IconSearchService: Failed to load frequently used icons:', error);
      return [];
    }
  }

  /**
   * Semantic search using natural language query.
   * Falls back to keyword search on error.
   */
  async semanticSearch(query, packs = null, limit = 20) {
    try {
      const icons = await iconsApi.semanticSearch(query, packs, limit);
      return icons.map(icon => this._transformIcon(icon));
    } catch (error) {
      console.warn('IconSearchService: Semantic search failed, falling back to keyword:', error);
      const result = await this.searchIcons(query, 'all', 'all', 0, limit, packs);
      return result.icons;
    }
  }

  /**
   * Determine if a query is natural language (>2 words, not a technical identifier).
   */
  isNaturalLanguageQuery(query) {
    if (!query || query.length < 5) return false;
    const words = query.trim().split(/\s+/);
    return words.length >= 2 && !/^[a-z0-9_-]+$/i.test(query.trim());
  }

  /**
   * Transform a backend icon response to frontend format.
   */
  _transformIcon(icon) {
    let width = 24, height = 24;
    const viewBox = icon.icon_data?.viewBox || '0 0 24 24';
    const viewBoxMatch = viewBox.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/);
    if (viewBoxMatch) {
      width = parseFloat(viewBoxMatch[3]);
      height = parseFloat(viewBoxMatch[4]);
    } else {
      width = icon.icon_data?.width || 24;
      height = icon.icon_data?.height || 24;
    }
    return {
      id: icon.id,
      key: icon.key,
      displayName: icon.display_name || this._humanizeKey(icon.key),
      prefix: icon.pack.name,
      pack: icon.pack.name,
      packDisplayName: icon.pack.display_name,
      category: icon.pack.category,
      fullName: `${icon.pack.name}:${icon.key}`,
      iconData: { body: icon.icon_data?.body || icon.icon_data, viewBox, width, height },
    };
  }

  /**
   * Client-side fallback: humanize an icon key into a readable name.
   * Mirrors backend logic in services/icons/naming.py.
   */
  _humanizeKey(key) {
    let name = key;

    // Strip trailing size suffixes
    name = name.replace(/_(?:16|24|32|48|64|128)$/, '');

    // Strip common vendor prefixes (longest first)
    const prefixes = [
      'Arch_Amazon-', 'Arch_AWS-', 'Arch_',
      'Res_Amazon-', 'Res_AWS-', 'Res_',
      'AmazonAWS', 'Amazon_', 'Amazon',
      'AWS_', 'AWS-', 'AWS',
    ];
    for (const prefix of prefixes) {
      if (name.startsWith(prefix) && name.length > prefix.length) {
        name = name.slice(prefix.length);
        break;
      }
    }

    // Replace hyphens and underscores with spaces
    name = name.replace(/[-_]/g, ' ');

    // Split PascalCase/camelCase
    name = name.replace(/([a-z])([A-Z])/g, '$1 $2');
    name = name.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');

    // Normalize whitespace and title-case
    const acronyms = new Set([
      'ec2', 'vpc', 'rds', 'ecs', 'eks', 'iam', 'sqs', 'sns', 'api',
      's3', 'cdn', 'dns', 'io', 'ai', 'ml', 'nlb', 'alb', 'elb',
      'nat', 'acm', 'kms', 'waf', 'sql', 'ssh', 'ssl', 'tls',
    ]);
    return name.trim().split(/\s+/).map(w => {
      if (acronyms.has(w.toLowerCase())) return w.toUpperCase();
      if (w === w.toUpperCase() && w.length <= 4) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(' ') || key;
  }

  /**
   * Get SVG content for an icon
   */
  async getIconSVG(pack, key) {
    try {
      const data = await iconsApi.getIconSVG(pack, key);
      return data.svg; // Updated to use new response structure
    } catch (error) {
      console.error('Failed to get SVG:', error);
      throw error;
    }
  }

  /**
   * Get raw SVG URL for direct browser rendering
   */
  getRawIconUrl(pack, key) {
    return iconsApi.getRawIconUrl(pack, key);
  }

  /**
   * Get raw SVG content directly
   */
  async getRawIconSVG(pack, key) {
    try {
      return await iconsApi.getRawIconSVG(pack, key);
    } catch (error) {
      console.error('Failed to get raw SVG:', error);
      throw error;
    }
  }

  /**
   * Batch get icons by full keys
   * @param {Array} iconKeys - Array of full icon keys (pack:icon)
   * @returns {Object} - { found: [...], notFound: [...] }
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
}

export default IconSearchService;
