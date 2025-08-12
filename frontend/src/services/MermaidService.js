import mermaid from "mermaid";
import { logger } from "../context/LoggerProvider.jsx";
import AwsIconLoader from "./AwsIconLoader.js";

// Create service-specific logger
const serviceLogger = logger.createServiceLogger('MermaidService');

class MermaidService {
  constructor() {
    this.theme = null;
    this.diagramCache = new Map();
    this.iconsRegistered = false;
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
      // Register icon packs if not already done
      if (!this.iconsRegistered) {
        await this.registerIconPacks();
        this.iconsRegistered = true;
      }

      await mermaid.initialize({
        startOnLoad: false,
        theme: theme === 'dark' ? 'dark' : 'default',
        flowchart: {
          htmlLabels: false,
          curve: "linear",
        },
        suppressErrorRendering: false, // Let Mermaid show its own errors
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
   * Register icon packs for architecture diagrams
   */
  async registerIconPacks() {
    try {
      const iconPacks = [];

      // Register Iconify Logos pack (basic AWS logos)
      try {
        iconPacks.push({
          name: 'logos',
          loader: () => import('@iconify-json/logos').then((module) => module.icons),
        });
        serviceLogger.info('Iconify logos pack registered');
      } catch (error) {
        serviceLogger.warn('Iconify logos pack not available:', error.message);
      }

      // Register comprehensive AWS icons pack (Mermaid-specific)
      try {
        const awsCodivaIcons = await import('@codiva/aws-icons');
        if (awsCodivaIcons) {
          iconPacks.push({
            name: 'aws',
            icons: awsCodivaIcons.default || awsCodivaIcons,
          });
          serviceLogger.info('Codiva AWS icons loaded successfully');
        }
      } catch (error) {
        serviceLogger.warn('Codiva AWS icons not available:', error.message);
      }

      // Register AWS SVG icons from aws-icons package (dynamically loads all icons)
      try {
        serviceLogger.debug('Attempting to load AWS SVG icons dynamically...');
        const awsSvgIcons = await AwsIconLoader.getAllAwsServiceIcons();
        serviceLogger.debug('AWS SVG icons result:', awsSvgIcons);
        
        if (awsSvgIcons && awsSvgIcons.icons && Object.keys(awsSvgIcons.icons).length > 0) {
          // Push the icon pack in the same format as codiva icons
          iconPacks.push({
            name: 'awssvg',
            icons: awsSvgIcons // The whole structure with prefix and icons
          });
          serviceLogger.info(`AWS SVG icons loaded successfully: ${Object.keys(awsSvgIcons.icons).length} icons available`);
          serviceLogger.debug('Sample AWS SVG icons (first 10):', Object.keys(awsSvgIcons.icons).slice(0, 10).join(', '));
        } else {
          serviceLogger.warn('AWS SVG icons returned empty or invalid data:', awsSvgIcons);
        }
        
        // Also try to load AWS group icons
        const awsGroupIcons = await AwsIconLoader.getAwsGroupIcons();
        if (awsGroupIcons && awsGroupIcons.icons && Object.keys(awsGroupIcons.icons).length > 0) {
          iconPacks.push({
            name: 'awsgrp',
            icons: awsGroupIcons
          });
          serviceLogger.info(`AWS Group icons loaded: ${Object.keys(awsGroupIcons.icons).length} icons available`);
        }
        
      } catch (error) {
        serviceLogger.error('AWS SVG icons failed to load:', error);
        serviceLogger.error('Error stack:', error.stack);
      }

      // Register all available icon packs
      if (iconPacks.length > 0) {
        serviceLogger.info(`About to register ${iconPacks.length} icon packs:`);
        iconPacks.forEach((pack, index) => {
          serviceLogger.info(`Pack ${index + 1}: name="${pack.name}", prefix="${pack.prefix || 'none'}", icon count=${pack.icons ? Object.keys(pack.icons).length : 'unknown'}`);
        });
        
        mermaid.registerIconPacks(iconPacks);
        serviceLogger.info(`Icon packs registered successfully: ${iconPacks.map(p => p.name || p.prefix).join(', ')}`);
      } else {
        serviceLogger.warn('No icon packs available - only default Mermaid icons will work');
      }
    } catch (error) {
      serviceLogger.warn('Failed to register icon packs:', error);
      // Continue without icon packs - basic architecture diagrams will still work
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

    this.debug("SVG content analysis:");
    this.debug("- Nodes:", nodes ? nodes.children.length : 0);
    this.debug("- Edges:", edges ? edges.children.length : 0);
    this.debug("- Architecture groups:", archGroups.length);
    this.debug("- Architecture services:", archServices.length);
    this.debug("- Architecture elements:", archElements.length);

    const hasFlowchartContent = (nodes && nodes.children.length) || (edges && edges.children.length);
    const hasArchContent = archGroups.length > 0 || archServices.length > 0 || archElements.length > 0;

    const isEmpty = !hasFlowchartContent && !hasArchContent;
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

  async render(htmlString, theme = null) {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlString;
    if (theme && theme !== this.theme) {
      await this.updateTheme(theme);
    }

    const mermaidBlocks = tempDiv.querySelectorAll(".mermaid[data-mermaid-source][data-processed='false']");
    if (mermaidBlocks.length === 0) return tempDiv.innerHTML;

    for (const block of mermaidBlocks) {
      const encodedSource = block.dataset.mermaidSource?.trim() || "";
      const diagramSource = decodeURIComponent(encodedSource);

      this.debug("Processing Mermaid block:");
      this.debug("- Encoded source:", encodedSource);
      this.debug("- Decoded source:", diagramSource);

      if (!diagramSource) continue;

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

        if (this.isEmptyMermaidSVG(svg)) {
          this.debug("SVG detected as empty by isEmptyMermaidSVG check");
          this.showError(block, "Diagram rendered but appears empty or invalid.");
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
        // Mermaid should handle most errors with suppressErrorRendering: false
        // This is just a fallback for any unexpected errors
        this.logError("Mermaid render error:", error, "\nDiagram source:", diagramSource);
        this.showError(block, error.message || "Failed to render diagram.");
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
