import { logger } from "@/providers/LoggerProvider.jsx";

// Create service-specific logger
const serviceLogger = logger.createServiceLogger('MermaidThemeManager');

/**
 * Mermaid theme management service
 * Handles theme configuration and updates for Mermaid diagrams
 */
class MermaidThemeManager {
  constructor() {
    this.currentTheme = null;
  }

  /**
   * Get current theme
   * @returns {string|null} - Current theme name
   */
  getCurrentTheme() {
    return this.currentTheme;
  }

  /**
   * Set current theme
   * @param {string} theme - Theme name ('dark' or 'light')
   */
  setCurrentTheme(theme) {
    this.currentTheme = theme;
    serviceLogger.debug(`Theme set to: ${theme}`);
  }

  /**
   * Check if theme has changed
   * @param {string} newTheme - New theme to compare
   * @returns {boolean} - True if theme has changed
   */
  hasThemeChanged(newTheme) {
    return newTheme !== this.currentTheme;
  }

  /**
   * Get Mermaid theme configuration
   * @param {string} theme - Theme name ('dark' or 'light')
   * @returns {object} - Mermaid configuration object
   */
  getMermaidConfig(theme) {
    return {
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
    };
  }

  /**
   * Log theme update
   * @param {string} oldTheme - Previous theme
   * @param {string} newTheme - New theme
   */
  logThemeUpdate(oldTheme, newTheme) {
    serviceLogger.info(`Mermaid theme updated from '${oldTheme}' to '${newTheme}'`);
  }
}

export default MermaidThemeManager;
