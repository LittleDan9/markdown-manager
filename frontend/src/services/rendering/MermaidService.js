import mermaid from "mermaid";
import { logger } from "@/providers/LoggerProvider.jsx";
import { IconService } from "../utilities";

// Create service-specific logger
const serviceLogger = logger.createServiceLogger('MermaidService');

class MermaidService {
  constructor() {
    this.theme = null;
    this.diagramCache = new Map();
  }

  /**
   * Debug logging that can be suppressed in production
   * @param {string} message - Debug message
   * @param {...any} args - Additional arguments to log
   */
  debug(message, ...args) {
    serviceLogger.debug(message, ...args);
  }

  /**
   * Error logging (always enabled)
   * @param {string} message - Error message
   * @param {...any} args - Additional arguments to log
   */
  logError(message, ...args) {
    serviceLogger.error(message, ...args);
  }

  async init(theme) {
    try {
      await mermaid.initialize({
        startOnLoad: false,
        theme: theme === 'dark' ? 'dark' : 'default',
        flowchart: {
          htmlLabels: false,
          curve: "linear",
        },
        suppressErrorRendering: true, // Prevent Mermaid from injecting error DOM
        logLevel: "error", // Show error logs for debugging
        htmlLabels: false,
        secure: ["secure", "securityLevel", "startOnLoad", "maxTextSize"],
        securityLevel: "loose",
      });
      this.theme = theme;
      this.debug(`Mermaid initialized with theme: ${theme}`);
    } catch (error) {
      this.logError("Failed to initialize Mermaid:", error);
    }
  }

  async updateTheme(theme) {
    if (theme !== this.theme) {
      this.diagramCache.clear();
      this.theme = theme;
      serviceLogger.info(`Mermaid theme updated to: ${theme}`);
      await this.init(theme);
    }
  }

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
      /icon\s*:\s*([^:\s\]]+)\s*:\s*([^)\s,\]]+)/gi,  // icon:pack:iconname (in brackets like [icon:pack:name])
      /icon\s*\(\s*([^:\s]+)\s*:\s*([^)\s,]+)\s*\)/gi,  // icon(pack:iconname)
      /service\s+\w+\s*\(\s*([^:\s]+)\s*:\s*([^)\s,]+)\s*\)/gi, // service name(pack:iconname) for architecture diagrams
      /\(\s*([^:\s]+)\s*:\s*([^)\s,]+)\s*\)/g, // Generic (pack:iconname) pattern
    ];

    iconPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(diagramSource)) !== null) {
        const pack = match[1].trim();
        const icon = match[2].trim();

        // Skip if it doesn't look like an icon pack reference
        if (pack.length === 0 || icon.length === 0) continue;

        // Avoid duplicates
        if (!iconReferences.some(ref => ref.pack === pack && ref.icon === icon)) {
          iconReferences.push({ pack, icon });
        }
      }
    });

    this.debug(`Extracted ${iconReferences.length} icon references:`, iconReferences);
    return iconReferences;
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
            // Search for the specific icon in the specific pack
            const icons = await IconService.searchIcons(iconName, 'all', packName, 0, 1);

            if (icons.length > 0) {
              const icon = icons[0];
              if (icon.iconData && icon.iconData.body && icon.key) {
                iconMap[icon.key] = {
                  body: icon.iconData.body,
                  width: icon.iconData.width || 24,
                  height: icon.iconData.height || 24,
                  viewBox: icon.iconData.viewBox || '0 0 24 24'
                };
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
          serviceLogger.debug(`Loaded ${Object.keys(iconMap).length} icons for pack: ${packName}`);
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
   */
  async registerSpecificIconPacks(iconPacks) {
    try {
      if (iconPacks.length > 0) {
        const totalIcons = iconPacks.reduce((sum, pack) => sum + Object.keys(pack.icons.icons).length, 0);
        serviceLogger.info(`Registering ${iconPacks.length} icon packs with ${totalIcons} specific icons: ${iconPacks.map(p => p.name).join(', ')}`);
        mermaid.registerIconPacks(iconPacks);
      } else {
        serviceLogger.debug('No specific icons to register - using default Mermaid icons only');
      }
    } catch (error) {
      serviceLogger.warn('Failed to register specific icon packs:', error);
    }
  }

  getTheme() {
    return this.theme;
  }

  isEmptyMermaidSVG(svgHtml) {
    const parser = new DOMParser();
    const svgElement = parser.parseFromString(svgHtml, "image/svg+xml").documentElement;

    // Look for .nodes or .edgePaths with children (flowcharts)
    const nodes = svgElement.querySelector('.nodes');
    const edges = svgElement.querySelector('.edgePaths');

    // Look for architecture-specific elements
    const archGroups = svgElement.querySelectorAll('.architecture-group');
    const archServices = svgElement.querySelectorAll('.architecture-service');
    const archElements = svgElement.querySelectorAll('[data-id]'); // Generic architecture elements

    // Look for generic diagram elements
    const allPaths = svgElement.querySelectorAll('path');
    const allRects = svgElement.querySelectorAll('rect');
    const allTexts = svgElement.querySelectorAll('text');
    const allGroups = svgElement.querySelectorAll('g');

    // Check for SVG dimensions - if very small, might be empty
    const svgWidth = svgElement.getAttribute('width') || svgElement.style.width || '';
    const svgHeight = svgElement.getAttribute('height') || svgElement.style.height || '';

    this.debug("SVG content analysis:");
    this.debug("- Nodes:", nodes ? nodes.children.length : 0);
    this.debug("- Edges:", edges ? edges.children.length : 0);
    this.debug("- Architecture groups:", archGroups.length);
    this.debug("- Architecture services:", archServices.length);
    this.debug("- Architecture elements:", archElements.length);
    this.debug("- All paths:", allPaths.length);
    this.debug("- All rects:", allRects.length);
    this.debug("- All texts:", allTexts.length);
    this.debug("- All groups:", allGroups.length);
    this.debug("- SVG dimensions:", svgWidth, "x", svgHeight);

    const hasFlowchartContent = (nodes && nodes.children.length) || (edges && edges.children.length);
    const hasArchContent = archGroups.length > 0 || archServices.length > 0 || archElements.length > 0;
    const hasGenericContent = allPaths.length > 1 || allRects.length > 0 || allTexts.length > 0; // paths > 1 because empty SVGs often have one background path

    // Only consider it empty if it has NO meaningful content AND is very small
    const isEmpty = !hasFlowchartContent && !hasArchContent && !hasGenericContent && (svgHtml.length < 500 || allTexts.length === 0);

    this.debug("- Has flowchart content:", hasFlowchartContent);
    this.debug("- Has architecture content:", hasArchContent);
    this.debug("- Has generic content:", hasGenericContent);
    this.debug("- SVG length:", svgHtml.length);
    this.debug("- Is empty:", isEmpty);

    return isEmpty;
  }

  /**
   * Validate the Mermaid diagram source
   * @param {string} diagramSource - The Mermaid diagram source code
   * @returns {string|null} - Returns an error message if invalid, otherwise null
   */
  validateDiagramSource(diagramSource) {
    if (!diagramSource.trim()) {
      return "Diagram source is empty.";
    }
    // Let Mermaid handle the rest of the validation
    return null;
  }

  /**
   * Check if the SVG contains Mermaid error indicators
   * @param {string} svgHtml - The SVG HTML string
   * @returns {boolean} - True if the SVG contains error indicators
   */
  containsMermaidError(svgHtml) {
    // Only check for very specific error patterns that Mermaid actually outputs for errors
    const errorPatterns = [
      /Parse error on line \d+/i,
      /<text[^>]*>[\s]*Parse error on line/i,
      /<text[^>]*>[\s]*Syntax error/i,
      /class="error-icon"/i,
      /id="mermaid-error"/i
    ];

    // Check for error patterns
    const hasErrorPattern = errorPatterns.some(pattern => pattern.test(svgHtml));

    this.debug("Error detection results:");
    this.debug("- Has specific error pattern:", hasErrorPattern);
    if (hasErrorPattern) {
      errorPatterns.forEach((pattern, index) => {
        if (pattern.test(svgHtml)) {
          this.debug(`- Matched error pattern ${index + 1}:`, pattern.toString());
        }
      });
    }

    return hasErrorPattern;
  }

  async render(htmlString, theme = null) {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlString;
    if (theme && theme !== this.theme) {
      await this.updateTheme(theme);
    }

    const mermaidBlocks = tempDiv.querySelectorAll(".mermaid[data-mermaid-source][data-processed='false']");
    if (mermaidBlocks.length === 0) return tempDiv.innerHTML;

    // STEP 1: Extract ALL icon references from ALL diagrams first
    const allIconReferences = [];
    const diagramSources = [];
    
    for (const block of mermaidBlocks) {
      const encodedSource = block.dataset.mermaidSource?.trim() || "";
      const diagramSource = decodeURIComponent(encodedSource);
      
      if (!diagramSource) continue;
      
      diagramSources.push({ block, diagramSource });
      
      // Extract icon references from this diagram
      const iconReferences = this.extractIconReferences(diagramSource);
      allIconReferences.push(...iconReferences);
    }

    // STEP 2: Load ALL unique icons ONCE before any rendering
    if (allIconReferences.length > 0) {
      // Remove duplicates
      const uniqueIconReferences = allIconReferences.filter((ref, index, self) => 
        index === self.findIndex(r => r.pack === ref.pack && r.icon === ref.icon)
      );
      
      this.debug(`Loading ${uniqueIconReferences.length} unique icons for all diagrams`);
      const specificIconPacks = await this.loadSpecificIcons(uniqueIconReferences);
      await this.registerSpecificIconPacks(specificIconPacks);
    }

    // STEP 3: Now render all diagrams (icons are already loaded)
    for (const { block, diagramSource } of diagramSources) {
      const validationError = this.validateDiagramSource(diagramSource);
      if (validationError) {
        this.showError(block, validationError);
        continue;
      }

      // Check cache
      if (this.diagramCache.has(diagramSource)) {
        block.innerHTML = this.diagramCache.get(diagramSource);
        block.setAttribute("data-processed", "true");
        continue;
      }

      try {
        const { svg } = await mermaid.render(
          `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          diagramSource,
        );

        this.debug("Mermaid render result:");
        this.debug("- SVG length:", svg.length);
        this.debug("- SVG preview:", svg.substring(0, 200) + "...");

        // Check if Mermaid returned an error in the SVG
        if (this.containsMermaidError(svg)) {
          this.debug("SVG contains Mermaid error indicators");
          this.showError(block, "Diagram rendering failed: Mermaid detected syntax errors in the diagram source.");
          continue;
        }

        if (this.isEmptyMermaidSVG(svg)) {
          this.debug("SVG detected as empty by isEmptyMermaidSVG check");
          this.showError(block, "Diagram rendered but appears empty. This could indicate a syntax error or unsupported diagram type.");
          continue;
        }

        block.innerHTML = `<div class="d-flex justify-content-center">${svg}</div>`;
        const svgElement = block.querySelector("svg");
        if (svgElement) {
          svgElement.setAttribute("width", "100%");
          svgElement.removeAttribute("height");
          svgElement.style.maxWidth = "86%";
          svgElement.style.height = "auto";
        }
        block.setAttribute("data-processed", "true");
        this.diagramCache.set(diagramSource, svgElement.parentNode.outerHTML);
      } catch (error) {
        // Catch any render errors and show clean error message
        this.logError("Mermaid render error:", error, "\nDiagram source:", diagramSource);
        this.showError(block, "Failed to render diagram due to syntax errors.");
      }
    }

    return tempDiv.innerHTML;
  }

  /**
   * Show error message in the Mermaid block
   * @param {HTMLElement} mermaidElement - The Mermaid block element
   * @param {string} errorMessage - The error message to display
   */
  showError(mermaidElement, errorMessage) {
    // Decode the encoded source before displaying
    const encodedSource = mermaidElement.dataset.mermaidSource?.trim() || "";
    const diagramSource = decodeURIComponent(encodedSource);

    const textContent = mermaidElement.querySelector(".language-mermaid");
    if (textContent) {
      textContent.innerHTML = `<div class="text-danger mb-2">
        <strong>Mermaid Error:</strong> ${errorMessage}
      </div>
      <div class="mt-2">
        <details>
          <summary class="text-muted" style="cursor: pointer;">Show diagram source</summary>
          <pre class="text-muted small mt-2">${this.escapeHtml(diagramSource)}</pre>
        </details>
      </div>`;
    } else {
      // Fallback if .language-mermaid doesn't exist
      mermaidElement.innerHTML = `<div class="alert alert-danger" role="alert">
        <strong>Mermaid Error:</strong> ${errorMessage}
        <div class="mt-2">
          <details>
            <summary class="text-muted" style="cursor: pointer;">Show diagram source</summary>
            <pre class="text-muted small mt-2">${this.escapeHtml(diagramSource)}</pre>
          </details>
        </div>
      </div>`;
    }

    this.diagramCache.set(diagramSource, mermaidElement.outerHTML);
  }

  /**
   * Escape HTML characters to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} - Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

export default new MermaidService();
