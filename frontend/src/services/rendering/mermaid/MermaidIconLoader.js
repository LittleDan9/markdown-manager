import { logger } from "@/providers/LoggerProvider.jsx";
import { IconService } from "../../icons";
import { cleanSvgBodyForBrowser } from "../../../utils/svgUtils";

// Create service-specific logger
const serviceLogger = logger.createServiceLogger('MermaidIconLoader');

/**
 * Mermaid icon loading and management service
 * Handles extraction, loading, and registration of icons for Mermaid diagrams
 */
class MermaidIconLoader {
  /**
   * Extract icon references from Mermaid diagram source
   * @param {string} diagramSource - The Mermaid diagram source code
   * @returns {Array} - Array of icon references like [{ pack: 'aws-icons', icon: 'EC2' }]
   */
  extractIconReferences(diagramSource) {
    const iconReferences = [];

    // Pattern to match icon references in architecture diagrams
    // Examples: icon:aws-icons:EC2, icon(aws-icons:S3), service(aws-icons:RDS), etc.
    const iconPatterns = [
      /icon\s*:\s*"([^:"]+):([^"]+)"/gi,  // icon: "pack:iconname" (quoted - for flowchart syntax)
      /icon\s*:\s*([^:\s\]]+)\s*:\s*([^)\s,\]]+)/gi,  // icon:pack:iconname (in brackets like [icon:pack:name])
      /icon\s*\(\s*([^:\s]+)\s*:\s*([^)\s,]+)\s*\)/gi,  // icon(pack:iconname)
      /service\s+\w+\s*\(\s*([^:\s]+)\s*:\s*([^)\s,]+)\s*\)/gi, // service name(pack:iconname) for architecture diagrams
      /group\s+\w+\s*\(\s*([^:\s]+)\s*:\s*([^)\s,]+)\s*\)/gi, // group name(pack:iconname) for architecture diagrams
      /\(\s*([^:\s"]+)\s*:\s*([^)\s,"]+)\s*\)/g, // Generic (pack:iconname) pattern (excluding quoted patterns)
    ];

    iconPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(diagramSource)) !== null) {
        let pack = match[1].trim();
        let icon = match[2].trim();

        // Clean up any surrounding quotes
        pack = pack.replace(/^["']|["']$/g, '');
        icon = icon.replace(/^["']|["']$/g, '');

        // Skip if it doesn't look like an icon pack reference
        if (pack.length === 0 || icon.length === 0) continue;

        // Avoid duplicates
        if (!iconReferences.some(ref => ref.pack === pack && ref.icon === icon)) {
          iconReferences.push({ pack, icon });
        }
      }
    });

    return iconReferences;
  }

  /**
   * Extract icon references from multiple diagram sources
   * @param {Array} diagramSources - Array of diagram source strings
   * @returns {Array} - Array of unique icon references
   */
  extractAllIconReferences(diagramSources) {
    const allIconReferences = [];

    diagramSources.forEach(source => {
      const iconReferences = this.extractIconReferences(source);
      allIconReferences.push(...iconReferences);
    });

    // Remove duplicates
    const uniqueIconReferences = allIconReferences.filter((ref, index, self) =>
      index === self.findIndex(r => r.pack === ref.pack && r.icon === ref.icon)
    );

    return uniqueIconReferences;
  }

  /**
   * Load specific icons needed for a diagram
   * @param {Array} iconReferences - Array of icon references
   * @returns {Array} - Array of icon pack data formatted for Mermaid
   */
  async loadSpecificIcons(iconReferences) {
    if (iconReferences.length === 0) {
      return [];
    }

    // Try batch loading first for maximum efficiency
    try {
      const iconKeys = iconReferences.map(ref => `${ref.pack}:${ref.icon}`);
      const batchResult = await IconService.batchGetIcons(iconKeys);

      if (batchResult && batchResult.found && batchResult.found.length > 0) {
        serviceLogger.info(`✅ Batch loaded ${batchResult.found.length} icons via /api/icons/batch endpoint`);
        return this.processBatchIcons(batchResult.found, batchResult.notFound || []);
      } else {
        serviceLogger.info('No icons found via batch endpoint, falling back to individual loading');
        return await this.loadIconsIndividually(iconReferences);
      }
    } catch (error) {
      serviceLogger.warn(`Batch loading failed: ${error.message}, falling back to individual loading`);
      return await this.loadIconsIndividually(iconReferences);
    }
  }

  /**
   * Process batch-loaded icons into Mermaid format
   * @param {Array} foundIcons - Icons returned from batch endpoint
   * @param {Array} notFoundKeys - Keys that weren't found
   * @returns {Array} - Array of icon pack data formatted for Mermaid
   */
  processBatchIcons(foundIcons, notFoundKeys) {
    const iconPacks = [];
    const packGroups = {};

    // Group found icons by pack
    foundIcons.forEach(icon => {
      const packName = icon.pack?.name || 'unknown';
      if (!packGroups[packName]) {
        packGroups[packName] = {};
      }

      if (icon.icon_data && icon.icon_data.body && icon.key) {
        // Extract width/height from viewBox to ensure consistency
        let width = 24;
        let height = 24;
        let viewBox = icon.icon_data.viewBox || '0 0 24 24';

        // Parse viewBox to get correct dimensions
        const viewBoxMatch = viewBox.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/);
        if (viewBoxMatch) {
          width = parseFloat(viewBoxMatch[3]);
          height = parseFloat(viewBoxMatch[4]);
        } else {
          // Fallback to provided width/height if viewBox parsing fails
          width = icon.icon_data.width || 24;
          height = icon.icon_data.height || 24;
        }

        packGroups[packName][icon.key] = {
          body: cleanSvgBodyForBrowser(icon.icon_data.body),
          width: width,
          height: height,
          viewBox: viewBox
        };
      } else {
        serviceLogger.warn(`Icon ${icon.full_key || 'unknown'} missing required data`);
      }
    });

    // Log any icons that couldn't be found
    if (notFoundKeys.length > 0) {
      serviceLogger.warn(`Icons not found: ${notFoundKeys.join(', ')}`);
    }

    // Convert to Mermaid pack format
    Object.entries(packGroups).forEach(([packName, icons]) => {
      if (Object.keys(icons).length > 0) {
        iconPacks.push({
          name: packName,
          icons: {
            prefix: packName,
            icons: icons
          }
        });
      }
    });

    return iconPacks;
  }

  /**
   * Fallback method to load icons individually when batch fails
   * @param {Array} iconReferences - Array of icon references
   * @returns {Array} - Array of icon pack data formatted for Mermaid
   */
  async loadIconsIndividually(iconReferences) {
    const iconPacks = [];
    const packGroups = {};

    // Group icons by pack
    iconReferences.forEach(ref => {
      if (!packGroups[ref.pack]) {
        packGroups[ref.pack] = [];
      }
      packGroups[ref.pack].push(ref.icon);
    });

    // Load icons for each pack using direct SVG endpoints
    for (const [packName, iconNames] of Object.entries(packGroups)) {
      try {
        const iconMap = {};

        // Load icons individually using direct SVG endpoint
        await this.loadIconsIndividuallyByPack(packName, iconNames, iconMap);

        if (Object.keys(iconMap).length > 0) {
          const packData = {
            name: packName,
            icons: {
              prefix: packName,
              icons: iconMap
            }
          };

          iconPacks.push(packData);
        }
      } catch (error) {
        serviceLogger.warn(`Failed to load icons for pack ${packName}:`, error);
      }
    }

    return iconPacks;
  }

  /**
   * Load icons individually using direct SVG endpoint for a specific pack
   * @param {string} packName - Name of the icon pack
   * @param {Array} iconNames - Array of icon names to load
   * @param {Object} iconMap - Map to store loaded icons
   */
  async loadIconsIndividuallyByPack(packName, iconNames, iconMap) {
    for (const iconName of iconNames) {
      try {
        // Try direct SVG endpoint first
        const svgData = await IconService.getIconSVG(packName, iconName);

        if (svgData && svgData.svg) {
          // Parse the SVG to extract viewBox and dimensions
          const parser = new DOMParser();
          const svgDoc = parser.parseFromString(svgData.svg, 'image/svg+xml');
          const svgElement = svgDoc.querySelector('svg');

          let width = 24;
          let height = 24;
          let viewBox = '0 0 24 24';
          let body = svgData.svg;

          if (svgElement) {
            // Extract viewBox
            const svgViewBox = svgElement.getAttribute('viewBox');
            if (svgViewBox) {
              viewBox = svgViewBox;

              // Parse viewBox to get correct dimensions
              const viewBoxMatch = viewBox.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/);
              if (viewBoxMatch) {
                width = parseFloat(viewBoxMatch[3]);
                height = parseFloat(viewBoxMatch[4]);
              }
            }

            // Extract the inner content (body) without the svg wrapper
            body = svgElement.innerHTML;
          }

          iconMap[iconName] = {
            body: cleanSvgBodyForBrowser(body),
            width: width,
            height: height,
            viewBox: viewBox
          };
        } else {
          // Fallback to search endpoint for backwards compatibility
          await this.loadIconViaSearch(packName, iconName, iconMap);
        }
      } catch (error) {
        serviceLogger.warn(`Direct loading failed for ${packName}:${iconName}, trying search fallback:`, error);
        // Final fallback to search endpoint
        await this.loadIconViaSearch(packName, iconName, iconMap);
      }
    }
  }

  /**
   * Load icon via search endpoint as final fallback
   * @param {string} packName - Name of the icon pack
   * @param {string} iconName - Name of the icon
   * @param {Object} iconMap - Map to store loaded icons
   */
  async loadIconViaSearch(packName, iconName, iconMap) {
    try {
      const response = await IconService.searchIcons(iconName, 'all', packName, 0, 10);
      const icons = response.icons || [];

      // Filter for exact key match first
      let exactMatch = icons.find(icon => icon.key === iconName);

      if (!exactMatch && icons.length > 0) {
        // If no exact match, fall back to first result
        exactMatch = icons[0];
        serviceLogger.warn(`No exact match for ${packName}:${iconName}, using ${exactMatch.key} instead`);
      }

      if (exactMatch && exactMatch.iconData && exactMatch.iconData.body && exactMatch.key) {
        // Extract width/height from viewBox to ensure consistency
        let width = 24;
        let height = 24;
        let viewBox = exactMatch.iconData.viewBox || '0 0 24 24';

        // Parse viewBox to get correct dimensions
        const viewBoxMatch = viewBox.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/);
        if (viewBoxMatch) {
          width = parseFloat(viewBoxMatch[3]);
          height = parseFloat(viewBoxMatch[4]);
        } else {
          // Fallback to provided width/height if viewBox parsing fails
          width = exactMatch.iconData.width || 24;
          height = exactMatch.iconData.height || 24;
        }

        iconMap[exactMatch.key] = {
          body: cleanSvgBodyForBrowser(exactMatch.iconData.body),
          width: width,
          height: height,
          viewBox: viewBox
        };
      } else {
        serviceLogger.warn(`Icon not found via search: ${packName}:${iconName}`);
      }
    } catch (error) {
      serviceLogger.warn(`Search fallback failed for ${packName}:${iconName}:`, error);
    }
  }

  /**
   * Register specific icon packs with Mermaid (only the icons that are needed)
   * @param {Array} iconPacks - Array of icon pack data
   * @param {Function} mermaidRegisterFunction - Mermaid's registerIconPacks function
   */
  async registerSpecificIconPacks(iconPacks, mermaidRegisterFunction) {
    try {
      if (iconPacks.length > 0) {
        const totalIcons = iconPacks.reduce((sum, pack) => sum + Object.keys(pack.icons.icons).length, 0);
        serviceLogger.info(`Registering ${iconPacks.length} icon packs with ${totalIcons} specific icons: ${iconPacks.map(p => p.name).join(', ')}`);

        if (typeof mermaidRegisterFunction === 'function') {
          // Try the standard format first
          mermaidRegisterFunction(iconPacks);
          serviceLogger.info('✅ Icon packs registered with standard format');

        } else {
          serviceLogger.error('❌ mermaidRegisterFunction is not a function or not available');
        }
      } else {
        serviceLogger.info('No specific icons to register - using default Mermaid icons only');
      }
    } catch (error) {
      serviceLogger.error('Failed to register specific icon packs:', error);
    }
  }

  /**
   * Load and register icons for multiple diagrams
   * @param {Array} diagramSources - Array of diagram source strings
   * @param {Function} mermaidRegisterFunction - Mermaid's registerIconPacks function
   * @returns {Array} - Array of loaded icon packs
   */
  async loadAndRegisterIcons(diagramSources, mermaidRegisterFunction) {
    const allIconReferences = this.extractAllIconReferences(diagramSources);

    if (allIconReferences.length === 0) {
      return [];
    }

    const specificIconPacks = await this.loadSpecificIcons(allIconReferences);
    await this.registerSpecificIconPacks(specificIconPacks, mermaidRegisterFunction);

    return specificIconPacks;
  }
}

export default MermaidIconLoader;
