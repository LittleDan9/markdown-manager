import exportServiceApi from '@/api/exportServiceApi';

export class MermaidExportService {
  /**
   * Export diagram to image format using the export service for high-quality rendering
   * @param {HTMLElement} diagramElement - The rendered Mermaid diagram element
   * @param {string} format - 'svg' or 'png'
   * @param {Object} options - Export options (width, height, isDarkMode)
   * @returns {Promise<string|Blob>} - SVG string or PNG blob
   */
  static async exportDiagram(diagramElement, format = 'svg', options = {}) {
    try {
      // Validate inputs
      if (!diagramElement) {
        throw new Error('Diagram element is required');
      }

      if (!['svg', 'png'].includes(format)) {
        throw new Error('Format must be "svg" or "png"');
      }

      const diagramHTML = this.prepareDiagramHTML(diagramElement, options);

      if (format === 'svg') {
        return await this.exportToSVG(diagramHTML, options);
      } else {
        return await this.exportToPNG(diagramHTML, options);
      }

    } catch (error) {
      console.error(`Failed to export diagram as ${format}:`, error);
      throw new Error(`Export failed: ${error.message}`);
    }
  }

  /**
   * Export diagram as SVG
   * @param {HTMLElement} diagramElement - The rendered Mermaid diagram element
   * @param {Object} options - Export options
   * @returns {Promise<string>} - SVG content as string
   */
  static async exportAsSVG(diagramElement, options = {}) {
    return await this.exportDiagram(diagramElement, 'svg', options);
  }

  /**
   * Export diagram as PNG
   * @param {HTMLElement} diagramElement - The rendered Mermaid diagram element
   * @param {Object} options - Export options
   * @returns {Promise<Blob>} - PNG blob
   */
  static async exportAsPNG(diagramElement, options = {}) {
    return await this.exportDiagram(diagramElement, 'png', options);
  }

  /**
   * Legacy method for backwards compatibility
   * @deprecated Use exportDiagram instead
   */
  static async exportDiagramToImage(diagramElement, format = 'svg', options = {}) {
    return await this.exportDiagram(diagramElement, format, options);
  }

  /**
   * Prepare diagram HTML for export service rendering
   * @param {HTMLElement} diagramElement - The diagram element
   * @param {Object} options - Export options
   * @returns {string} - HTML content ready for export
   */
  static prepareDiagramHTML(diagramElement, options = {}) {
    // Extract the SVG content from the rendered Mermaid diagram
    const svgElement = diagramElement.querySelector('svg');
    if (!svgElement) {
      throw new Error('No SVG found in diagram element');
    }

    // Clone the SVG to avoid modifying the original
    const clonedSVG = svgElement.cloneNode(true);

    // Remove any controls or overlays that shouldn't be in the export
    const controlSelectors = ['.diagram-controls', '.mermaid-controls', '.export-controls'];
    controlSelectors.forEach(selector => {
      const controls = clonedSVG.querySelectorAll(selector);
      controls.forEach(control => control.remove());
    });

    // Create wrapper with proper sizing
    const wrapper = document.createElement('div');
    wrapper.className = 'mermaid-export-container';
    wrapper.style.width = `${options.width || 1200}px`;
    wrapper.style.height = `${options.height || 800}px`;
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    wrapper.style.background = options.isDarkMode ? '#1a1a1a' : '#ffffff';

    wrapper.appendChild(clonedSVG);

    return wrapper.outerHTML;
  }

  /**
   * Export diagram as SVG using export service
   * @param {string} diagramHTML - Prepared diagram HTML
   * @param {Object} options - Export options
   * @returns {Promise<string>} - SVG content
   */
  static async exportToSVG(diagramHTML, options = {}) {
    try {
      return await exportServiceApi.exportDiagramAsSVG(diagramHTML, options);
    } catch (error) {
      console.error('Failed to export diagram as SVG:', error);
      throw new Error(`SVG export failed: ${error.message}`);
    }
  }

  /**
   * Export diagram as PNG using export service
   * @param {string} diagramHTML - Prepared diagram HTML
   * @param {Object} options - Export options
   * @returns {Promise<Blob>} - PNG blob
   */
  static async exportToPNG(diagramHTML, options = {}) {
    try {
      return await exportServiceApi.exportDiagramAsPNG(diagramHTML, options);
    } catch (error) {
      console.error('Failed to export diagram as PNG:', error);
      throw new Error(`PNG export failed: ${error.message}`);
    }
  }

  /**
   * Download diagram as file
   * @param {HTMLElement} diagramElement - The diagram element
   * @param {string} format - 'svg' or 'png'
   * @param {string} filename - Desired filename (without extension)
   * @param {Object} options - Export options
   */
  static async downloadDiagram(diagramElement, format = 'svg', filename = null, options = {}) {
    try {
      const content = await this.exportDiagram(diagramElement, format, options);

      // Generate filename if not provided
      if (!filename) {
        filename = this.generateFilename(diagramElement, 'diagram');
      }

      // Ensure filename has proper extension
      if (!filename.endsWith(`.${format}`)) {
        filename = `${filename}.${format}`;
      }

      // Create download
      const blob = format === 'svg'
        ? new Blob([content], { type: 'image/svg+xml' })
        : content; // PNG is already a blob

      this.triggerDownload(blob, filename);

    } catch (error) {
      console.error('Download failed:', error);
      throw error;
    }
  }

  /**
   * Convert data URI to blob
   * @param {string} dataURI - Data URI string
   * @returns {Blob} - Blob object
   */
  static dataURItoBlob(dataURI) {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);

    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }

    return new Blob([ab], { type: mimeString });
  }

  /**
   * Trigger file download
   * @param {Blob} blob - File blob
   * @param {string} filename - Filename
   */
  static triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Check if a Mermaid diagram uses advanced features (architecture-beta, custom icons)
   * @param {string} diagramSource - Mermaid diagram source code
   * @returns {boolean} - True if diagram uses advanced features
   */
  static hasAdvancedFeatures(diagramSource) {
    if (!diagramSource) return false;

    const advancedPatterns = [
      /architecture-beta/i,          // Architecture diagrams
      /group\s+[\w-]+\s+in\s+[\w-]+/i, // Architecture groups
      /service\s+[\w-]+\s+in\s+[\w-]+/i, // Architecture services
      /awssvg:/i,                    // AWS SVG icons
      /awsgrp:/i,                    // AWS group icons
      /logos:/i,                     // Logo icons
      /devicon:/i,                   // Devicon icons
      /<svg[^>]*>/i,                 // Inline SVG
      /xlink:href/i,                 // SVG references
      /icon:/i                       // Generic icon references
    ];

    return advancedPatterns.some(pattern => pattern.test(diagramSource));
  }

  /**
   * Extract diagram metadata for GitHub conversion
   * @param {HTMLElement} diagramElement - The diagram element
   * @returns {Object} - Diagram metadata
   */
  static extractDiagramMetadata(diagramElement) {
    try {
      // Look for data attributes or classes that indicate diagram type
      const classList = Array.from(diagramElement.classList || []);
      const dataType = diagramElement.getAttribute('data-type');

      // Try to find the original mermaid source if it's stored
      const sourceElement = diagramElement.querySelector('[data-mermaid-source]');
      const source = sourceElement?.getAttribute('data-mermaid-source') || '';

      // Detect advanced features that need conversion for GitHub
      const hasArchitectureBeta = source.includes('architecture-beta') || classList.includes('architecture-beta');
      const hasCustomIcons = source.includes('icon:') || source.includes('fa:');
      const needsConversion = hasArchitectureBeta || hasCustomIcons;

      return {
        type: dataType || 'mermaid',
        source: source,
        hasAdvancedFeatures: needsConversion,
        hasArchitectureBeta,
        hasCustomIcons,
        classList: classList
      };

    } catch (error) {
      console.warn('Failed to extract diagram metadata:', error);
      return {
        type: 'mermaid',
        source: '',
        hasAdvancedFeatures: false,
        hasArchitectureBeta: false,
        hasCustomIcons: false,
        classList: []
      };
    }
  }

  /**
   * Check if a diagram needs GitHub-compatible conversion
   * @param {HTMLElement} diagramElement - The diagram element
   * @returns {boolean} - True if conversion is needed
   */
  static needsGitHubConversion(diagramElement) {
    const metadata = this.extractDiagramMetadata(diagramElement);
    return metadata.hasAdvancedFeatures;
  }

  /**
   * Get appropriate filename for diagram export
   * @param {HTMLElement} diagramElement - The diagram element
   * @param {string} baseFilename - Base filename to use
   * @returns {string} - Generated filename
   */
  static generateFilename(diagramElement, baseFilename = 'diagram') {
    const metadata = this.extractDiagramMetadata(diagramElement);

    // Create a descriptive filename based on diagram type
    let filename = baseFilename;

    if (metadata.type && metadata.type !== 'mermaid') {
      filename += `-${metadata.type}`;
    }

    if (metadata.hasArchitectureBeta) {
      filename += '-architecture';
    }

    // Add timestamp to ensure uniqueness
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    filename += `-${timestamp}`;

    return filename;
  }

  /**
   * Get export options for GitHub compatibility
   * @param {boolean} isDarkMode - Dark mode flag
   * @returns {Object} - Export options optimized for GitHub
   */
  static getGitHubExportOptions(isDarkMode = false) {
    return {
      width: 1200,
      height: 800,
      isDarkMode: isDarkMode,
      // Additional options for GitHub compatibility
      backgroundColor: isDarkMode ? '#0d1117' : '#ffffff',
      quality: 95 // High quality for clear text rendering
    };
  }
}

export default MermaidExportService;