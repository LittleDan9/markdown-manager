import { Api } from "./api";

class ExportServiceApi extends Api {
  constructor() {
    super();
    // Use standard base URL - nginx routes /api/export/ to export service
  }

  /**
   * Export diagram as SVG using the export service
   * @param {string} htmlContent - HTML content containing the rendered diagram
   * @param {Object} options - Export options
   * @param {number} options.width - Export width (default: 1200)
   * @param {number} options.height - Export height (default: 800)
   * @param {boolean} options.isDarkMode - Dark mode styling (default: false)
   * @param {boolean} options.returnFullResponse - Return full ConversionResponse instead of just content
   * @returns {Promise<string|Object>} - SVG content as string or full response object
   */
  async exportDiagramAsSVG(htmlContent, options = {}) {
    const requestData = {
      html_content: htmlContent,
      format: 'svg',
      width: options.width || 1200,
      height: options.height || 800,
      is_dark_mode: options.isDarkMode || false
    };

    const res = await this.apiCall('/export/diagram/svg', 'POST', requestData);

    if (options.returnFullResponse) {
      return res.data; // Return full ConversionResponse
    }

    // Decode base64 SVG content for backward compatibility
    if (res.data.file_data) {
      return atob(res.data.file_data);
    }

    // Fallback for legacy response format
    return res.data.svg_content || res.data.file_data;
  }

  /**
   * Export diagram as PNG using the export service
   * @param {string} htmlContent - HTML content containing the rendered diagram
   * @param {Object} options - Export options
   * @param {number} options.width - Export width (default: 1200)
   * @param {number} options.height - Export height (default: 800)
   * @param {boolean} options.isDarkMode - Dark mode styling (default: false)
   * @param {boolean} options.returnFullResponse - Return full ConversionResponse instead of just blob
   * @returns {Promise<Blob|Object>} - PNG blob or full response object
   */
  async exportDiagramAsPNG(htmlContent, options = {}) {
    // For PNG, we need to extract the SVG from the rendered HTML first
    // Then send that SVG content to the PNG endpoint
    const svgContent = this.extractSVGFromHTML(htmlContent);

    const requestData = {
      svg_content: svgContent,
      transparent_background: options.transparentBackground !== false
    };

    // Only include width/height if explicitly provided (not when using natural dimensions)
    if (options.width && !options.useNaturalDimensions) {
      requestData.width = options.width;
    }
    if (options.height && !options.useNaturalDimensions) {
      requestData.height = options.height;
    }

    const res = await this.apiCall('/export/diagram/png', 'POST', requestData);

    if (options.returnFullResponse) {
      return res.data; // Return full ConversionResponse
    }

    // Convert base64 response to blob from new response format
    const imageData = res.data.file_data || res.data.image_data; // Support both new and legacy formats
    const binaryString = atob(imageData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return new Blob([bytes], { type: 'image/png' });
  }

  /**
   * Extract SVG content from rendered HTML
   * @param {string} htmlContent - HTML content containing SVG
   * @returns {string} - SVG content
   */
  extractSVGFromHTML(htmlContent) {
    // Create a temporary DOM element to parse the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    // Find the SVG element
    const svgElement = tempDiv.querySelector('svg');
    if (!svgElement) {
      throw new Error('No SVG found in provided HTML content');
    }

    // Ensure proper SVG attributes
    svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgElement.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

    return svgElement.outerHTML;
  }

  /**
   * Generate quality message for user display based on Draw.io conversion score
   * @param {number} score - Quality score (0-100)
   * @param {string} format - Export format
   * @returns {Object} - Message object with type and text
   */
  generateQualityMessage(score, format = 'Draw.io') {
    if (score >= 90) {
      return {
        type: 'success',
        icon: '✅',
        text: `${format} export completed (Excellent quality - ${score.toFixed(1)}%)`
      };
    } else if (score >= 75) {
      return {
        type: 'warning',
        icon: '⚠️',
        text: `${format} export completed (Good quality - ${score.toFixed(1)}%) - Minor adjustments may be needed`
      };
    } else if (score >= 60) {
      return {
        type: 'warning',
        icon: '⚠️',
        text: `${format} export completed (Fair quality - ${score.toFixed(1)}%) - Review recommended`
      };
    } else {
      return {
        type: 'error',
        icon: '❌',
        text: `${format} export completed (Poor quality - ${score.toFixed(1)}%) - Consider SVG export for better results`
      };
    }
  }

  /**
   * Export document as PDF using the export service
   * @param {string} htmlContent - HTML content to export as PDF
   * @param {string} documentName - Document name for the PDF
   * @param {boolean} isDarkMode - Dark mode styling (default: false)
   * @param {string} responseFormat - 'stream' (default) or 'json'
   * @returns {Promise<Blob|Object>} - PDF binary data as blob or ConversionResponse object
   */
  async exportAsPDF(htmlContent, documentName, isDarkMode = false, responseFormat = 'stream') {
    const requestData = {
      html_content: htmlContent,
      document_name: documentName,
      is_dark_mode: isDarkMode,
    };

    if (responseFormat === 'json') {
      // Use JSON response format with ConversionResponse
      const res = await this.apiCall('/export/document/pdf?response_format=json', 'POST', requestData);
      return res.data; // ConversionResponse object
    } else {
      // Use streaming response format (legacy behavior)
      const res = await this.apiCall('/export/document/pdf', 'POST', requestData, {}, { responseType: 'blob' });
      return res.data; // PDF binary or blob
    }
  }

  /**
   * Export diagram as Draw.io XML format using the export service
   * @param {string} mermaidSource - Original Mermaid source code
   * @param {string} svgContent - Rendered SVG content from Mermaid
   * @param {Object} options - Export options
   * @param {string} options.iconServiceUrl - Icon service URL override
   * @param {number} options.width - Canvas width (default: 1000)
   * @param {number} options.height - Canvas height (default: 600)
   * @param {boolean} options.isDarkMode - Dark mode styling (default: false)
   * @returns {Promise<Object>} - DrawioExportResponse with quality assessment
   */
  async exportDiagramAsDrawioXML(mermaidSource, svgContent, options = {}) {
    const requestData = {
      mermaid_source: mermaidSource,
      svg_content: svgContent,
      width: options.width || 1000,
      height: options.height || 600,
      is_dark_mode: options.isDarkMode || false
    };

    if (options.iconServiceUrl) {
      requestData.icon_service_url = options.iconServiceUrl;
    }

    const res = await this.apiCall('/export/diagram/drawio/xml', 'POST', requestData);
    return res.data; // Full DrawioExportResponse with quality assessment
  }

  /**
   * Export diagram as Draw.io PNG format with embedded XML metadata
   * @param {string} mermaidSource - Original Mermaid source code
   * @param {string} svgContent - Rendered SVG content from Mermaid
   * @param {Object} options - Export options
   * @param {string} options.iconServiceUrl - Icon service URL override
   * @param {number} options.width - Image width
   * @param {number} options.height - Image height
   * @param {boolean} options.transparentBackground - Transparent background (default: true)
   * @param {boolean} options.isDarkMode - Dark mode styling (default: false)
   * @returns {Promise<Object>} - DrawioExportResponse with PNG data and quality assessment
   */
  async exportDiagramAsDrawioPNG(mermaidSource, svgContent, options = {}) {
    const requestData = {
      mermaid_source: mermaidSource,
      svg_content: svgContent,
      transparent_background: options.transparentBackground !== false,
      is_dark_mode: options.isDarkMode || false
    };

    if (options.width) {
      requestData.width = options.width;
    }
    if (options.height) {
      requestData.height = options.height;
    }
    if (options.iconServiceUrl) {
      requestData.icon_service_url = options.iconServiceUrl;
    }

    const res = await this.apiCall('/export/diagram/drawio/png', 'POST', requestData);
    return res.data; // Full DrawioExportResponse with PNG data and quality assessment
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use exportDiagramAsDrawioXML instead
   */
  async exportDiagramAsDiagramsNet(svgContent, options = {}) {
    // For backward compatibility, we need to convert old API to new format
    // This requires both Mermaid source and SVG content, but we only have SVG
    // We'll extract what we can and use fallbacks
    console.warn('exportDiagramAsDiagramsNet is deprecated. Use exportDiagramAsDrawioXML instead.');

    // Try to extract Mermaid source from SVG comments or use empty fallback
    const mermaidSource = this.extractMermaidSourceFromSVG(svgContent) || 'graph TD\n    A[Node] --> B[Node]';

    return await this.exportDiagramAsDrawioXML(mermaidSource, svgContent, options);
  }

  /**
   * Get supported Draw.io export formats
   * @returns {Promise<Object>} - Supported formats and service information
   */
  async getDrawioFormats() {
    const res = await this.apiCall('/export/diagram/drawio/formats', 'GET');
    return res.data;
  }

  /**
   * Check Draw.io conversion service health
   * @returns {Promise<Object>} - Draw.io service health status
   */
  async checkDrawioHealth() {
    const res = await this.apiCall('/export/diagram/drawio/health', 'GET');
    return res.data;
  }

  /**
   * Legacy methods for backward compatibility
   * @deprecated Use getDrawioFormats instead
   */
  async getDiagramsNetFormats() {
    console.warn('getDiagramsNetFormats is deprecated. Use getDrawioFormats instead.');
    return await this.getDrawioFormats();
  }

  /**
   * @deprecated Use checkDrawioHealth instead
   */
  async checkDiagramsNetHealth() {
    console.warn('checkDiagramsNetHealth is deprecated. Use checkDrawioHealth instead.');
    return await this.checkDrawioHealth();
  }

  /**
   * Health check for export service
   * @returns {Promise<Object>} - Service health status
   */
  async checkHealth() {
    const res = await this.apiCall('/export/health', 'GET');
    return res.data;
  }

  /**
   * Render diagram to SVG (alias for exportDiagramAsSVG for backwards compatibility)
   * @param {Object} diagramData - Diagram data object
   * @returns {Promise<Object>} - ConversionResponse with SVG content
   */
  async renderDiagramToSVG(diagramData) {
    const res = await this.apiCall('/export/diagram/svg', 'POST', diagramData);
    return res.data; // Returns ConversionResponse
  }

  /**
   * Render diagram to PNG image (alias for exportDiagramAsPNG for backwards compatibility)
   * @param {Object} diagramData - Diagram data object
   * @returns {Promise<Object>} - ConversionResponse with image data
   */
  async renderDiagramToImage(diagramData) {
    const res = await this.apiCall('/export/diagram/png', 'POST', diagramData);
    return res.data; // Returns ConversionResponse
  }

  /**
   * Helper method to download file from DrawioExportResponse
   * @param {Object} exportResponse - Response from Draw.io export service
   * @param {string} filename - Optional custom filename
   */
  downloadFromConversionResponse(exportResponse, filename = null) {
    if (!exportResponse.success || !exportResponse.file_data) {
      throw new Error('Invalid export response or no file data');
    }

    // Use provided filename or the one from response
    const downloadFilename = filename || exportResponse.filename;

    // Convert base64 to blob
    const binaryString = atob(exportResponse.file_data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: exportResponse.content_type });

    // Trigger download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = downloadFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Helper method to extract Mermaid source from SVG comments (fallback for legacy support)
   * @param {string} svgContent - SVG content that might contain Mermaid source in comments
   * @returns {string|null} - Extracted Mermaid source or null
   */
  extractMermaidSourceFromSVG(svgContent) {
    try {
      // Look for Mermaid source in SVG comments
      const sourceMatch = svgContent.match(/<!--\s*mermaid-source:\s*([^-]+)\s*-->/i);
      if (sourceMatch && sourceMatch[1]) {
        return decodeURIComponent(sourceMatch[1].trim());
      }

      // Look for data attributes that might contain source
      const dataMatch = svgContent.match(/data-mermaid-source="([^"]+)"/i);
      if (dataMatch && dataMatch[1]) {
        return decodeURIComponent(dataMatch[1]);
      }

      return null;
    } catch (error) {
      console.warn('Failed to extract Mermaid source from SVG:', error);
      return null;
    }
  }
}

export default new ExportServiceApi();