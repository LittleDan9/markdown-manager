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
   * @returns {Promise<string>} - SVG content as string
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
    return res.data.svg_content;
  }

  /**
   * Export diagram as PNG using the export service
   * @param {string} htmlContent - HTML content containing the rendered diagram
   * @param {Object} options - Export options
   * @param {number} options.width - Export width (default: 1200)
   * @param {number} options.height - Export height (default: 800)
   * @param {boolean} options.isDarkMode - Dark mode styling (default: false)
   * @returns {Promise<Blob>} - PNG blob
   */
  async exportDiagramAsPNG(htmlContent, options = {}) {
    // For PNG, we need to extract the SVG from the rendered HTML first
    // Then send that SVG content to the PNG endpoint
    const svgContent = this.extractSVGFromHTML(htmlContent);

    const requestData = {
      svg_content: svgContent,
      width: options.width || 1200,
      height: options.height || 800,
      transparent_background: options.transparentBackground !== false
    };

    const res = await this.apiCall('/export/diagram/png', 'POST', requestData);

    // Convert base64 response to blob
    const binaryString = atob(res.data.image_data);
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
   * Export document as PDF using the export service
   * @param {string} htmlContent - HTML content to export as PDF
   * @param {string} documentName - Document name for the PDF
   * @param {boolean} isDarkMode - Dark mode styling (default: false)
   * @returns {Promise<Blob>} - PDF binary data as blob
   */
  async exportAsPDF(htmlContent, documentName, isDarkMode = false) {
    const requestData = {
      html_content: htmlContent,
      document_name: documentName,
      is_dark_mode: isDarkMode,
    };

    const res = await this.apiCall('/export/document/pdf', 'POST', requestData, {}, { responseType: 'blob' });
    return res.data; // PDF binary or blob
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
   * @returns {Promise<Object>} - Response with SVG content
   */
  async renderDiagramToSVG(diagramData) {
    const res = await this.apiCall('/export/diagram/svg', 'POST', diagramData);
    return res.data;
  }

  /**
   * Render diagram to PNG image (alias for exportDiagramAsPNG for backwards compatibility)
   * @param {Object} diagramData - Diagram data object
   * @returns {Promise<Object>} - Response with image data
   */
  async renderDiagramToImage(diagramData) {
    const res = await this.apiCall('/export/diagram/png', 'POST', diagramData);
    return res.data;
  }
}

export default new ExportServiceApi();