import { logger } from "@/providers/LoggerProvider.jsx";
import { IconService } from "../../utilities";

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

    const iconPacks = [];
    const packGroups = {};

    // Group icons by pack
    iconReferences.forEach(ref => {
      if (!packGroups[ref.pack]) {
        packGroups[ref.pack] = [];
      }
      packGroups[ref.pack].push(ref.icon);
    });

    // Load icons for each pack
    for (const [packName, iconNames] of Object.entries(packGroups)) {
      try {
        const iconMap = {};

        // Load each icon individually
        for (const iconName of iconNames) {
          try {
            // First try to search for exact match in the specific pack
            let icons = await IconService.searchIcons(iconName, 'all', packName, 0, 10);
            
            // Filter for exact key match first
            let exactMatch = icons.find(icon => icon.key === iconName);
            
            if (!exactMatch && icons.length > 0) {
              // If no exact match, fall back to first result
              exactMatch = icons[0];
              serviceLogger.warn(`No exact match for ${packName}:${iconName}, using ${exactMatch.key} instead`);
            }
            
            if (exactMatch) {
              const icon = exactMatch;
              if (icon.iconData && icon.iconData.body && icon.key) {
                // Extract width/height from viewBox to ensure consistency
                let width = 24;
                let height = 24;
                let viewBox = icon.iconData.viewBox || '0 0 24 24';

                // Parse viewBox to get correct dimensions
                const viewBoxMatch = viewBox.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/);
                if (viewBoxMatch) {
                  width = parseFloat(viewBoxMatch[3]);
                  height = parseFloat(viewBoxMatch[4]);
                } else {
                  // Fallback to provided width/height if viewBox parsing fails
                  width = icon.iconData.width || 24;
                  height = icon.iconData.height || 24;
                }

                iconMap[icon.key] = {
                  body: icon.iconData.body,
                  width: width,
                  height: height,
                  viewBox: viewBox
                };
              } else {
                serviceLogger.warn(`Icon ${packName}:${iconName} missing required data (body: ${!!icon.iconData?.body}, key: ${!!icon.key})`);
              }
            } else {
              serviceLogger.warn(`Icon not found: ${packName}:${iconName}`);
            }
          } catch (error) {
            serviceLogger.warn(`Failed to load icon ${packName}:${iconName}:`, error);
          }
        }

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
