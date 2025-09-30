import { Api } from "./api";

class ExportServiceApi extends Api {
  constructor() {
    super();
    // Override base URL for export service (port 8001)
    this.baseURL = process.env.NODE_ENV === 'production'
      ? 'https://littledan.com/export'
      : 'http://localhost:8001';
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

    const res = await this.apiCall('/export-diagram-svg', 'POST', requestData);
    return res.data.svg_content;
  }

  /**
   * Export diagram as PNG using the export service
   * @param {string} htmlContent - HTML content containing the rendered diagram
   * @param {Object} options - Export options
   * @param {number} options.width - Export width (default: 1200)
   * @param {number} options.height - Export height (default: 800)
   * @param {boolean} options.isDarkMode - Dark mode styling (default: false)
   * @returns {Promise<string>} - PNG as base64 data URI
   */
  async exportDiagramAsPNG(htmlContent, options = {}) {
    const requestData = {
      html_content: htmlContent,
      format: 'png',
      width: options.width || 1200,
      height: options.height || 800,
      is_dark_mode: options.isDarkMode || false
    };

    const res = await this.apiCall('/export-diagram-png', 'POST', requestData);
    return res.data.png_data_uri;
  }

  /**
   * Export document as PDF (legacy endpoint - now proxied through export service)
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

    const res = await this.apiCall('/pdf/export', 'POST', requestData, {}, { responseType: 'blob' });
    return res.data; // PDF binary or blob
  }

  /**
   * Health check for export service
   * @returns {Promise<Object>} - Service health status
   */
  async checkHealth() {
    const res = await this.apiCall('/health', 'GET');
    return res.data;
  }
}

export default new ExportServiceApi();