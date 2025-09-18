/**
 * MarkdownLintService - API-based markdown linting service
 *
 * Replaces worker-based implementation with HTTP API calls to backend.
 * Communicates with backend /api/markdown-lint endpoints which proxy
 * to the internal markdown-lint-service.
 */

import { Api } from '../../api/api';

export class MarkdownLintService extends Api {
  constructor(chunkSize = 2000) {
    super();
    this.chunkSize = chunkSize;
    this.serviceUrl = '/markdown-lint'; // Backend proxy endpoints
    this._enabled = true;
    this._initialized = false;
  }

  /**
   * Initialize the service
   * @returns {Promise<void>}
   */
  async init() {
    if (this._initialized) {
      return;
    }

    try {
      // Check backend service health
      const isHealthy = await this.checkHealth();
      if (!isHealthy) {
        console.warn('MarkdownLintService: Backend service not healthy');
      }

      this._initialized = true;
      console.log('MarkdownLintService: Initialized successfully');
    } catch (error) {
      console.error('MarkdownLintService: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Scan markdown text for linting issues
   * @param {string} text - Markdown text to scan
   * @param {Function} onProgress - Progress callback function
   * @param {number|null} categoryId - Category ID for rule lookup
   * @param {string|null} folderPath - Folder path for rule lookup
   * @returns {Promise<Array>} Array of linting issues
   */
  async scan(text, onProgress = () => {}, categoryId = null, folderPath = null) {
    if (!this._enabled) {
      console.log('MarkdownLintService: Scanning disabled');
      return [];
    }

    try {
      await this.init();

      // Get applicable rules for this category/folder
      const rules = await this.getRulesForContext(categoryId, folderPath);

      if (Object.keys(rules).length === 0) {
        console.log('MarkdownLintService: No rules configured');
        return [];
      }

      // Process text in chunks for large documents
      const chunks = this.chunkText(text);
      const allIssues = [];
      let processedLength = 0;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        try {
          // Process chunk via backend API
          const chunkIssues = await this.lintChunk(
            chunk.text,
            rules,
            chunk.offset
          );

          // Update progress
          processedLength += chunk.text.length;
          const progressPercent = Math.round((processedLength / text.length) * 100);
          onProgress({
            progress: progressPercent,
            processedLength,
            totalLength: text.length,
            issuesFound: allIssues.length + chunkIssues.length
          });

          // Collect issues with proper offset adjustment
          allIssues.push(...chunkIssues);

        } catch (error) {
          console.error(`MarkdownLintService: Failed to process chunk ${i + 1}:`, error);
          // Continue processing other chunks even if one fails
        }
      }

      console.log(`MarkdownLintService: Found ${allIssues.length} issues in ${text.length} characters`);
      return allIssues;

    } catch (error) {
      console.error('MarkdownLintService: Scan failed:', error);
      throw error;
    }
  }

  /**
   * Process a single chunk of text
   * @param {string} text - Text chunk to process
   * @param {Object} rules - Linting rules configuration
   * @param {number} offset - Character offset in original document
   * @returns {Promise<Array>} Array of issues for this chunk
   */
  async lintChunk(text, rules, offset = 0) {
    try {
      const response = await this.apiCall(`${this.serviceUrl}/process`, 'POST', {
        text,
        rules,
        chunk_offset: offset
      });

      return response.data.issues || [];
    } catch (error) {
      console.error('MarkdownLintService: Chunk processing failed:', error);
      throw error;
    }
  }

    /**
   * Get context-specific rules for markdown linting
   * @param {number|null} categoryId - Category ID
   * @param {string|null} folderPath - Folder path
   * @returns {Promise<Object>} Rules configuration object
   */
  async getRulesForContext(categoryId, folderPath) {
    try {
      // Import services dynamically to avoid circular dependencies
      const { default: MarkdownLintRulesService } = await import('../linting/MarkdownLintRulesService');
      const markdownLintApi = await import('../../api/markdownLintApi');
      const { default: AuthService } = await import('../core/AuthService');

      // Set up API client if not already configured
      if (!MarkdownLintRulesService._apiClient) {
        MarkdownLintRulesService.setApiClient(markdownLintApi.default);
      }

      // Get current user ID from AuthService
      await AuthService.waitForInitialization();
      const authState = AuthService.getAuthState();
      const userId = authState.user?.id;

      if (!userId || !authState.isAuthenticated) {
        // Return default rules if no user context
        return MarkdownLintRulesService.getDefaultRules();
      }

      // Get effective rules using the new service
      const rules = await MarkdownLintRulesService.getEffectiveRules(userId, categoryId, folderPath);
      return rules;

    } catch (error) {
      console.error('MarkdownLintService: Failed to get rules for context:', error);
      // Return default rules to prevent blocking
      const { default: MarkdownLintRulesService } = await import('../linting/MarkdownLintRulesService');
      return MarkdownLintRulesService.getDefaultRules();
    }
  }

  /**
   * Chunk text into processable segments
   * @param {string} text - Full text to chunk
   * @returns {Array} Array of {text, offset} objects
   */
  chunkText(text) {
    if (text.length <= this.chunkSize) {
      return [{ text, offset: 0 }];
    }

    const chunks = [];
    let offset = 0;

    while (offset < text.length) {
      let chunkEnd = offset + this.chunkSize;

      // Try to break on line boundaries to avoid splitting markdown elements
      if (chunkEnd < text.length) {
        const nextNewline = text.indexOf('\n', chunkEnd);
        if (nextNewline !== -1 && nextNewline < chunkEnd + 200) {
          chunkEnd = nextNewline + 1;
        }
      }

      const chunkText = text.slice(offset, chunkEnd);
      chunks.push({ text: chunkText, offset });

      offset = chunkEnd;
    }

    return chunks;
  }

  /**
   * Get available markdownlint rule definitions
   * @returns {Promise<Object>} Rule definitions object
   */
  async getRuleDefinitions() {
    try {
      const response = await this.apiCall(`${this.serviceUrl}/rules/definitions`);
      return response.data.rules || {};
    } catch (error) {
      console.error('MarkdownLintService: Failed to get rule definitions:', error);
      // Fallback to rules service if backend fails
      const { MarkdownLintRulesService } = await import('../linting/MarkdownLintRulesService');
      return MarkdownLintRulesService.getRuleDefinitions();
    }
  }

  /**
   * Check backend service health
   * @returns {Promise<boolean>} True if service is healthy
   */
  async checkHealth() {
    try {
      const response = await this.apiCall(`${this.serviceUrl}/health`, 'GET', null, {}, { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      console.warn('MarkdownLintService: Health check failed:', error);
      return false;
    }
  }

  /**
   * Enable or disable linting
   * @param {boolean} enabled - Whether to enable linting
   */
  setEnabled(enabled) {
    this._enabled = Boolean(enabled);
    console.log(`MarkdownLintService: ${this._enabled ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * Check if linting is enabled
   * @returns {boolean} True if enabled
   */
  isEnabled() {
    return this._enabled;
  }

  /**
   * Get service status information
   * @returns {Object} Status object with service information
   */
  getStatus() {
    return {
      enabled: this._enabled,
      initialized: this._initialized,
      serviceType: 'api-based',
      chunkSize: this.chunkSize
    };
  }

  /**
   * Cleanup resources (compatibility with worker-based interface)
   */
  cleanup() {
    // No resources to cleanup for API-based service
    this._initialized = false;
    console.log('MarkdownLintService: Cleaned up');
  }
}

// Export singleton instance for backwards compatibility
export default new MarkdownLintService();