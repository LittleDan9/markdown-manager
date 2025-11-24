import exportServiceApi from '@/api/exportServiceApi';

export class MermaidExportService {
  /**
   * Export diagram to various formats using the export service for high-quality rendering
   * @param {HTMLElement} diagramElement - The rendered Mermaid diagram element
   * @param {string} format - 'svg', 'png', or 'drawio'
   * @param {Object} options - Export options (width, height, isDarkMode)
   * @returns {Promise<string|Blob|Object>} - SVG string, PNG blob, or DiagramsNetExportResponse
   */
  static async exportDiagram(diagramElement, format = 'svg', options = {}) {
    try {
      // Validate inputs
      if (!diagramElement) {
        throw new Error('Diagram element is required');
      }

      if (!['svg', 'png', 'diagramsnet', 'drawio', 'drawio-xml', 'drawio-png'].includes(format)) {
        throw new Error('Format must be "svg", "png", "diagramsnet" (legacy), "drawio", "drawio-xml", or "drawio-png"');
      }

      // Handle Draw.io export (new format names)
      if (format === 'drawio' || format === 'drawio-xml') {
        return await this.exportToDrawio(diagramElement, 'xml', null, options);
      }
      if (format === 'drawio-png') {
        return await this.exportToDrawio(diagramElement, 'png', null, options);
      }

      // Handle legacy diagrams.net export for backward compatibility
      if (format === 'diagramsnet') {
        return await this.exportToDrawio(diagramElement, 'xml', null, options);
      }

      // Pass format information to prepareDiagramHTML for proper sizing
      const prepareOptions = { ...options, format };

      // Use the rendered HTML content from the diagram element
      const diagramHTML = this.prepareDiagramHTML(diagramElement, prepareOptions);

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
   * Export diagram as PNG with natural dimensions (no excess background)
   * @param {HTMLElement} diagramElement - The rendered Mermaid diagram element
   * @param {Object} options - Export options
   * @returns {Promise<Blob>} - PNG blob
   */
  static async exportAsPNGNaturalSize(diagramElement, options = {}) {
    const naturalOptions = {
      ...options,
      useNaturalDimensions: true
    };
    return await this.exportDiagram(diagramElement, 'png', naturalOptions);
  }

  /**
   * Export diagram as high-resolution PNG for crisp quality
   * @param {HTMLElement} diagramElement - The rendered Mermaid diagram element
   * @param {Object} options - Export options
   * @returns {Promise<Blob>} - High-resolution PNG blob
   */
  static async exportAsHighResPNG(diagramElement, options = {}) {
    const hiResOptions = {
      ...options,
      useNaturalDimensions: true,
      maxWidth: 3200,  // 4K-ready resolution
      maxHeight: 2400
    };
    return await this.exportDiagram(diagramElement, 'png', hiResOptions);
  }

  /**
   * Legacy method for backwards compatibility
   * @deprecated Use exportDiagram instead
   */
  static async exportDiagramToImage(diagramElement, format = 'svg', options = {}) {
    return await this.exportDiagram(diagramElement, format, options);
  }

  /**
   * Extract original Mermaid source code from diagram element
   * @param {HTMLElement} diagramElement - The diagram element
   * @returns {string|null} - Original Mermaid source or null if not found
   */
  static extractDiagramSource(diagramElement) {
    try {
      // Try multiple methods to find the original source

      // Method 1: Look for data-mermaid-source attribute
      const sourceAttr = diagramElement.getAttribute('data-mermaid-source');
      if (sourceAttr) {
        return decodeURIComponent(sourceAttr);
      }

      // Method 2: Look for source in child elements
      const sourceElement = diagramElement.querySelector('[data-mermaid-source]');
      if (sourceElement) {
        const source = sourceElement.getAttribute('data-mermaid-source');
        if (source) {
          return decodeURIComponent(source);
        }
      }

      // Method 3: Look for the original text content before Mermaid processing
      const textContent = diagramElement.textContent || diagramElement.innerText;
      if (textContent && textContent.trim() && !textContent.includes('<svg')) {
        return textContent.trim();
      }

      return null;

    } catch (error) {
      console.warn('Failed to extract diagram source:', error);
      return null;
    }
  }

  /**
   * Extract diagram metadata for GitHub conversion
   * @param {HTMLElement} diagramElement - The diagram element
   * @returns {Object} - Diagram metadata
   */

  /**
   * Prepare diagram HTML for export service rendering from already-rendered diagram
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

    // Ensure proper SVG attributes for export
    clonedSVG.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clonedSVG.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

    // Clean up SVG styles that interfere with export sizing
    // Remove responsive web styles that constrain the SVG
    clonedSVG.removeAttribute('style');
    clonedSVG.style.cssText = '';

    // For PNG exports with natural dimensions, scale up for high quality
    const useNaturalDimensions = options.format === 'png' || options.useNaturalDimensions;

    if (useNaturalDimensions) {
      // Get the viewBox or natural dimensions for aspect ratio
      const viewBox = clonedSVG.getAttribute('viewBox');
      let baseWidth, baseHeight;

      if (viewBox) {
        // Parse viewBox: "minX minY width height"
        const [_minX, _minY, vbWidth, vbHeight] = viewBox.split(' ').map(Number);
        baseWidth = vbWidth;
        baseHeight = vbHeight;
      } else {
        // Try to get dimensions from attributes or computed values
        const svgRect = svgElement.getBoundingClientRect();
        baseWidth = parseFloat(svgElement.getAttribute('width')) || svgRect.width || 800;
        baseHeight = parseFloat(svgElement.getAttribute('height')) || svgRect.height || 600;
      }

      // Calculate high-resolution dimensions while maintaining aspect ratio
      const maxWidth = options.maxWidth || 2400;  // High resolution for crisp PNG
      const maxHeight = options.maxHeight || 1800;

      const aspectRatio = baseWidth / baseHeight;
      let finalWidth, finalHeight;

      // Scale up to maximum size while maintaining aspect ratio
      if (aspectRatio > maxWidth / maxHeight) {
        // Width is the limiting factor
        finalWidth = Math.min(maxWidth, baseWidth * 2); // At least 2x scale up unless already large
        finalHeight = finalWidth / aspectRatio;
      } else {
        // Height is the limiting factor
        finalHeight = Math.min(maxHeight, baseHeight * 2); // At least 2x scale up unless already large
        finalWidth = finalHeight * aspectRatio;
      }

      // Ensure we don't go below the original size (unless it's already very large)
      if (baseWidth > maxWidth * 0.8 || baseHeight > maxHeight * 0.8) {
        // If original is already quite large, don't scale up much
        finalWidth = Math.min(finalWidth, baseWidth * 1.2);
        finalHeight = Math.min(finalHeight, baseHeight * 1.2);
      } else {
        // For smaller diagrams, ensure we scale up for quality
        const minScaleFactor = 2;
        finalWidth = Math.max(finalWidth, baseWidth * minScaleFactor);
        finalHeight = Math.max(finalHeight, baseHeight * minScaleFactor);
      }

      // Round to avoid sub-pixel issues
      finalWidth = Math.round(finalWidth);
      finalHeight = Math.round(finalHeight);

      clonedSVG.setAttribute('width', finalWidth.toString());
      clonedSVG.setAttribute('height', finalHeight.toString());

      // Create wrapper with proper sizing and styling for natural dimensions
      const wrapper = document.createElement('div');
      wrapper.className = 'mermaid-export-container';
      wrapper.style.cssText = `
        width: ${finalWidth}px;
        height: ${finalHeight}px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${options.isDarkMode ? '#1a1a1a' : '#ffffff'};
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      `;

      wrapper.appendChild(clonedSVG);
      return wrapper.outerHTML;
    }

    // For SVG exports or fixed-size PNG exports, use a container wrapper
    const containerWidth = options.width || 1200;
    const containerHeight = options.height || 800;
    const padding = 20;

    // Create wrapper with proper sizing and styling
    const wrapper = document.createElement('div');
    wrapper.className = 'mermaid-export-container';
    wrapper.style.cssText = `
      width: ${containerWidth}px;
      height: ${containerHeight}px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: ${options.isDarkMode ? '#1a1a1a' : '#ffffff'};
      margin: 0;
      padding: ${padding}px;
      box-sizing: border-box;
    `;

    // For SVG, allow responsive sizing with max constraints
    clonedSVG.removeAttribute('width');
    clonedSVG.removeAttribute('height');
    clonedSVG.style.maxWidth = '100%';
    clonedSVG.style.maxHeight = '100%';
    clonedSVG.style.width = 'auto';
    clonedSVG.style.height = 'auto';

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
   * Export diagram as Draw.io format using the new dual-input export service
   * @param {HTMLElement} diagramElement - The diagram element
   * @param {string} format - Export format ('xml' or 'png')
   * @param {string} filename - Desired filename (without extension)
   * @param {Object} options - Export options
   * @returns {Promise<Object>} - DrawioExportResponse with quality assessment
   */
  static async exportToDrawio(diagramElement, format = 'xml', filename = null, options = {}) {
    try {
      // Extract both Mermaid source and SVG content (dual-input approach)
      const mermaidSource = this.extractDiagramSource(diagramElement);
      const svgContent = this.extractSVGFromElement(diagramElement);

      if (!mermaidSource) {
        throw new Error('Mermaid source code not found. Draw.io export requires original Mermaid source.');
      }

      let response;
      if (format === 'png') {
        // Use PNG export with embedded XML metadata
        response = await exportServiceApi.exportDiagramAsDrawioPNG(mermaidSource, svgContent, {
          width: options.width,
          height: options.height,
          transparentBackground: options.transparentBackground,
          isDarkMode: options.isDarkMode || false,
          iconServiceUrl: options.iconServiceUrl
        });
      } else {
        // Use XML export
        response = await exportServiceApi.exportDiagramAsDrawioXML(mermaidSource, svgContent, {
          width: options.width || 1000,
          height: options.height || 600,
          isDarkMode: options.isDarkMode || false,
          iconServiceUrl: options.iconServiceUrl
        });
      }

      // Generate filename if not provided
      if (!filename) {
        filename = this.generateFilename(diagramElement, 'diagram');
      }

      // Update response with custom filename if provided
      if (filename) {
        const baseFilename = filename.replace(/\.(xml|drawio|png)$/i, '');
        if (format === 'png') {
          response.filename = `${baseFilename}.drawio.png`;
        } else {
          response.filename = `${baseFilename}.drawio.xml`;
        }
      }

      return response;
    } catch (error) {
      console.error('Failed to export diagram as Draw.io:', error);
      throw new Error(`Draw.io export failed: ${error.message}`);
    }
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use exportToDrawio instead
   */
  static async exportToDiagramsNet(diagramElement, format = 'xml', filename = null, options = {}) {
    console.warn('exportToDiagramsNet is deprecated. Use exportToDrawio instead.');
    return await this.exportToDrawio(diagramElement, format, filename, options);
  }

  /**
   * Download diagram as Draw.io file with quality assessment
   * @param {HTMLElement} diagramElement - The diagram element
   * @param {string} format - Export format ('xml' or 'png')
   * @param {string} filename - Desired filename (without extension)
   * @param {Object} options - Export options
   * @returns {Promise<Object>} - Quality assessment information
   */
  static async downloadDrawioDiagram(diagramElement, format = 'xml', filename = null, options = {}) {
    try {
      const response = await this.exportToDrawio(diagramElement, format, filename, options);

      // Download the file using the helper method
      exportServiceApi.downloadFromConversionResponse(response);

      // Return quality information for user feedback
      return {
        success: response.success,
        quality: response.quality,
        filename: response.filename,
        format: response.format
      };
    } catch (error) {
      console.error('Failed to download Draw.io diagram:', error);
      throw error;
    }
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use downloadDrawioDiagram instead
   */
  static async downloadDiagramsNetDiagram(diagramElement, format = 'xml', filename = null, options = {}) {
    console.warn('downloadDiagramsNetDiagram is deprecated. Use downloadDrawioDiagram instead.');
    return await this.downloadDrawioDiagram(diagramElement, format, filename, options);
  }

  /**
   * Extract SVG content from diagram element
   * @param {HTMLElement} diagramElement - The diagram element
   * @returns {string} - Raw SVG content
   */
  static extractSVGFromElement(diagramElement) {
    // Look for SVG element within the diagram container
    let svgElement = diagramElement.querySelector('svg');

    // If the element itself is an SVG
    if (!svgElement && diagramElement.tagName === 'SVG') {
      svgElement = diagramElement;
    }

    if (!svgElement) {
      console.error('No SVG element found in diagram element:', diagramElement);
      throw new Error('No SVG element found in diagram');
    }

    // Ensure proper SVG attributes for export
    svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgElement.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

    const svgContent = svgElement.outerHTML;
    console.log('Extracted SVG content length:', svgContent.length);
    console.log('SVG content preview:', svgContent.substring(0, 200) + '...');

    return svgContent;
  }

  /**
   * Download diagram as file
   * @param {HTMLElement} diagramElement - The diagram element
   * @param {string} format - 'svg', 'png', or 'diagramsnet'
   * @param {string} filename - Desired filename (without extension)
   * @param {Object} options - Export options
   * @returns {Promise<Object|undefined>} - Quality information for diagrams.net exports, undefined for others
   */
  static async downloadDiagram(diagramElement, format = 'svg', filename = null, options = {}) {
    try {
      // Handle Draw.io export with quality feedback (new format names)
      if (format === 'drawio' || format === 'drawio-xml') {
        return await this.downloadDrawioDiagram(diagramElement, 'xml', filename, options);
      }
      if (format === 'drawio-png') {
        return await this.downloadDrawioDiagram(diagramElement, 'png', filename, options);
      }

      // Handle legacy Draw.io export names for backward compatibility
      if (format === 'diagramsnet') {
        console.warn('Format "diagramsnet" is deprecated. Use "drawio" or "drawio-xml" instead.');
        return await this.downloadDrawioDiagram(diagramElement, 'xml', filename, options);
      }
      if (format === 'diagramsnet-png') {
        console.warn('Format "diagramsnet-png" is deprecated. Use "drawio-png" instead.');
        return await this.downloadDrawioDiagram(diagramElement, 'png', filename, options);
      }

      const content = await this.exportDiagram(diagramElement, format, options);

      // Generate filename if not provided
      if (!filename) {
        filename = this.generateFilename(diagramElement, 'diagram');
      }

      // Remove extension if it already exists to avoid double extensions
      const baseFilename = filename.replace(/\.(svg|png|diagramsnet|drawio)$/i, '');

      // Create download
      const blob = format === 'svg'
        ? new Blob([content], { type: 'image/svg+xml' })
        : content; // PNG is already a blob

      this.triggerDownload(blob, `${baseFilename}.${format}`);

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
   * @param {string|HTMLElement} diagramSourceOrElement - Mermaid diagram source code or diagram element
   * @returns {boolean} - True if diagram uses advanced features
   */
  static hasAdvancedFeatures(diagramSourceOrElement) {
    let diagramSource;

    if (typeof diagramSourceOrElement === 'string') {
      diagramSource = diagramSourceOrElement;
    } else if (diagramSourceOrElement && typeof diagramSourceOrElement === 'object') {
      // Try to extract source from element
      diagramSource = this.extractDiagramSource(diagramSourceOrElement);
    }

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
   * @param {string} diagramSource - Optional diagram source code
   * @returns {boolean} - True if conversion is needed
   */
  static needsGitHubConversion(diagramElement, diagramSource = null) {
    // Try using provided source first, then extract from element
    const source = diagramSource || this.extractDiagramSource(diagramElement);
    return this.hasAdvancedFeatures(source || diagramElement);
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
   * @param {string} format - Export format ('svg' or 'png')
   * @returns {Object} - Export options optimized for GitHub
   */
  static getGitHubExportOptions(isDarkMode = false, format = 'svg') {
    const baseOptions = {
      isDarkMode: isDarkMode,
      backgroundColor: isDarkMode ? '#0d1117' : '#ffffff',
      quality: 95 // High quality for clear text rendering
    };

    if (format === 'png') {
      // For PNG, use natural dimensions with high resolution for crisp output
      return {
        ...baseOptions,
        useNaturalDimensions: true,
        maxWidth: 3200,  // High resolution for GitHub display
        maxHeight: 2400,
        transparentBackground: false // Use solid background for GitHub
      };
    } else {
      // For SVG, use standard container dimensions
      return {
        ...baseOptions,
        width: 1200,
        height: 800
      };
    }
  }
}

export default MermaidExportService;