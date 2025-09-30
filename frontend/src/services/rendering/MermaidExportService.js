import exportServiceApi from '@/api/exportServiceApi';

export class MermaidExportService {
  /**
   * Export diagram to image format using the export service for high-quality rendering
   * @param {HTMLElement} diagramElement - The rendered Mermaid diagram element
   * @param {string} format - 'svg' or 'png'
   * @param {Object} options - Export options
   * @returns {Promise<string|Blob>} - SVG string or PNG data URI
   */
  static async exportDiagramToImage(diagramElement, format = 'svg', options = {}) {
    const diagramHTML = this.prepareDiagramHTML(diagramElement);

    if (format === 'svg') {
      return await this.exportToSVG(diagramHTML, options);
    } else {
      return await this.exportToPNG(diagramHTML, options);
    }
  }

  /**
   * Prepare diagram HTML for export service rendering
   * @param {HTMLElement} diagramElement - The diagram element
   * @returns {string} - Isolated diagram HTML with rendered SVG
   */
  static prepareDiagramHTML(diagramElement) {
    // Extract the SVG content from the rendered Mermaid diagram
    const svgElement = diagramElement.querySelector('svg');
    if (!svgElement) {
      throw new Error('No SVG found in diagram element');
    }

    // Clone the SVG to avoid modifying the original
    const clonedSVG = svgElement.cloneNode(true);

    // Create minimal HTML wrapper for the diagram
    return `
      <div class="mermaid-export-container">
        ${clonedSVG.outerHTML}
      </div>
      <style>
        .mermaid-export-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 20px;
        }
        .mermaid-export-container svg {
          max-width: 100%;
          height: auto;
        }
      </style>
    `;
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
   * @returns {Promise<string>} - PNG data URI
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
   * @param {string} filename - Optional filename (auto-generated if not provided)
   * @param {Object} options - Export options
   */
  static async downloadDiagram(diagramElement, format = 'svg', filename = null, options = {}) {
    try {
      const content = await this.exportDiagramToImage(diagramElement, format, options);

      if (!filename) {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        filename = `mermaid-diagram-${timestamp}.${format}`;
      }

      if (format === 'svg') {
        // For SVG, create blob and download
        const blob = new Blob([content], { type: 'image/svg+xml' });
        this.triggerDownload(blob, filename);
      } else {
        // For PNG, convert data URI to blob and download
        const blob = this.dataURItoBlob(content);
        this.triggerDownload(blob, filename);
      }
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