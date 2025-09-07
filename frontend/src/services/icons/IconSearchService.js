/**
 * Icon Search Service
 * Handles searching and filtering icons with data transformation
 */

import { iconsApi } from '@/api/iconsApi.js';

class IconSearchService {
  /**
   * Search icons with transformation
   */
  async searchIcons(searchTerm = '', category = 'all', pack = 'all', page = 0, size = 100) {
    try {
      const data = await iconsApi.searchIcons({
        q: searchTerm,
        pack: pack,
        category: category,
        page: page,
        size: Math.min(size, 100) // Backend caps at 100
      });

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
}

export default IconSearchService;
