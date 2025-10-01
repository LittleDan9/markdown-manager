import mermaid from "mermaid";
import { logger } from "@/providers/LoggerProvider.jsx";

// Import the modular services
import MermaidCache from "./MermaidCache.js";
import MermaidThemeManager from "./MermaidThemeManager.js";
import MermaidValidator from "./MermaidValidator.js";
import MermaidIconLoader from "./MermaidIconLoader.js";

// Create service-specific logger
const serviceLogger = logger.createServiceLogger('MermaidRenderer');

/**
 * Mermaid diagram rendering service
 * Orchestrates all Mermaid rendering functionality using modular services
 */
class MermaidRenderer {
  constructor() {
    this.cache = new MermaidCache();
    this.themeManager = new MermaidThemeManager();
    this.validator = new MermaidValidator();
    this.iconLoader = new MermaidIconLoader();
    this.isInitialized = false;
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

  /**
   * Initialize Mermaid with theme configuration
   * @param {string} theme - Theme name ('dark' or 'light')
   */
  async init(theme) {
    try {
      const config = this.themeManager.getMermaidConfig(theme);
      await mermaid.initialize(config);
      this.themeManager.setCurrentTheme(theme);
      this.isInitialized = true;
      this.debug(`Mermaid initialized with theme: ${theme}`);
    } catch (error) {
      this.logError("Failed to initialize Mermaid:", error);
    }
  }

  /**
   * Update theme if it has changed
   * @param {string} theme - New theme name
   */
  async updateTheme(theme) {
    if (this.themeManager.hasThemeChanged(theme)) {
      const oldTheme = this.themeManager.getCurrentTheme();
      this.cache.clear();
      this.themeManager.logThemeUpdate(oldTheme, theme);
      await this.init(theme);
    }
  }

  /**
   * Get current theme
   * @returns {string|null} - Current theme name
   */
  getTheme() {
    return this.themeManager.getCurrentTheme();
  }

  /**
   * Extract diagram sources from HTML elements
   * @param {NodeList} mermaidBlocks - Mermaid block elements
   * @returns {Array} - Array of { block, diagramSource } objects
   */
  extractDiagramSources(mermaidBlocks) {
    const diagramSources = [];

    for (const block of mermaidBlocks) {
      const encodedSource = block.dataset.mermaidSource?.trim() || "";
      const diagramSource = decodeURIComponent(encodedSource);

      if (diagramSource) {
        diagramSources.push({ block, diagramSource });
      }
    }

    return diagramSources;
  }

  /**
   * Render a single diagram (assumes icons are already loaded and diagram is not cached)
   * @param {HTMLElement} block - The Mermaid block element
   * @param {string} diagramSource - The diagram source code
   * @returns {Promise<boolean>} - True if rendered successfully, false otherwise
   */
  async renderSingleDiagram(block, diagramSource) {
    try {
      const { svg } = await mermaid.render(
        `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        diagramSource,
      );

      this.debug("Mermaid render result:");
      this.debug("- SVG length:", svg.length);
      this.debug("- SVG preview:", svg.substring(0, 200) + "...");

      // Check if Mermaid returned an error in the SVG
      if (this.validator.containsMermaidError(svg)) {
        this.debug("SVG contains Mermaid error indicators");
        const errorHtml = this.validator.showError(block, "Diagram rendering failed: Mermaid detected syntax errors in the diagram source.");
        this.cache.set(diagramSource, errorHtml);
        return false;
      }

      if (this.validator.isEmptyMermaidSVG(svg)) {
        this.debug("SVG detected as empty by isEmptyMermaidSVG check");
        const errorHtml = this.validator.showError(block, "Diagram rendered but appears empty. This could indicate a syntax error or unsupported diagram type.");
        this.cache.set(diagramSource, errorHtml);
        return false;
      }

      // Successfully rendered - format and cache
      const formattedSvg = this.formatSvgForDisplay(svg);
      block.innerHTML = formattedSvg;
      block.setAttribute("data-processed", "true");
      this.cache.set(diagramSource, formattedSvg);
      return true;

    } catch (error) {
      // Catch any render errors and show clean error message
      this.validator.logError("Mermaid render error:", error, diagramSource);
      const errorHtml = this.validator.showError(block, "Failed to render diagram due to syntax errors.");
      this.cache.set(diagramSource, errorHtml);
      return false;
    }
  }

  /**
   * Format SVG for display in the UI
   * @param {string} svg - Raw SVG string from Mermaid
   * @returns {string} - Formatted SVG HTML
   */
  formatSvgForDisplay(svg) {
    const wrapper = document.createElement('div');
    wrapper.className = 'd-flex justify-content-center';
    wrapper.innerHTML = svg;

    const svgElement = wrapper.querySelector("svg");
    if (svgElement) {
      svgElement.setAttribute("width", "100%");
      svgElement.removeAttribute("height");
      svgElement.style.maxWidth = "86%";
      svgElement.style.height = "auto";
    }

    return wrapper.outerHTML;
  }

  /**
   * Render multiple Mermaid diagrams in HTML
   * @param {string} htmlString - HTML string containing Mermaid blocks
   * @param {string} theme - Theme to use for rendering
   * @returns {Promise<string>} - HTML string with rendered diagrams
   */
  async render(htmlString, theme = null) {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlString;

    // Update theme if provided and different
    if (theme && theme !== this.getTheme()) {
      await this.updateTheme(theme);
    }

    // Ensure Mermaid is initialized
    if (!this.isInitialized) {
      await this.init(theme || 'default');
    }

    // Find all unprocessed Mermaid blocks
    const mermaidBlocks = tempDiv.querySelectorAll(".mermaid[data-mermaid-source][data-processed='false']");
    if (mermaidBlocks.length === 0) {
      return tempDiv.innerHTML;
    }

    // Extract diagram sources
    const diagramData = this.extractDiagramSources(mermaidBlocks);
    if (diagramData.length === 0) {
      return tempDiv.innerHTML;
    }

    // STEP 1: Separate cached vs uncached diagrams
    const cachedDiagrams = [];
    const uncachedDiagrams = [];

    for (const { block, diagramSource } of diagramData) {
      // Validate diagram source first
      const validationError = this.validator.validateDiagramSource(diagramSource);
      if (validationError) {
        const errorHtml = this.validator.showError(block, validationError);
        this.cache.set(diagramSource, errorHtml);
        continue;
      }

      if (this.cache.has(diagramSource)) {
        cachedDiagrams.push({ block, diagramSource });
      } else {
        uncachedDiagrams.push({ block, diagramSource });
      }
    }

    // STEP 2: Render cached diagrams immediately (no icon loading needed)
    for (const { block, diagramSource } of cachedDiagrams) {
      block.innerHTML = this.cache.get(diagramSource);
      block.setAttribute("data-processed", "true");
    }

    // STEP 3: Load icons ONLY for uncached diagrams that need to be rendered
    if (uncachedDiagrams.length > 0) {
      const uncachedSources = uncachedDiagrams.map(d => d.diagramSource);
      await this.iconLoader.loadAndRegisterIcons(uncachedSources, mermaid.registerIconPacks.bind(mermaid));

      // STEP 4: Render uncached diagrams (icons are now loaded)
      for (const { block, diagramSource } of uncachedDiagrams) {
        await this.renderSingleDiagram(block, diagramSource);
      }
    }

    return tempDiv.innerHTML;
  }

  /**
   * Clear all cached diagrams
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {object} - Cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size(),
      theme: this.getTheme(),
      isInitialized: this.isInitialized
    };
  }
}

export default MermaidRenderer;
