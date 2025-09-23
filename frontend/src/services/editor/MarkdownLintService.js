/**
 * MarkdownLintService - API-based markdown linting service
 *
 * Replaces worker-based implementation with HTTP API calls to backend.
 * Uses lintingApi for all backend communication.
 */

import lintingApi from '../../api/lintingApi';

export class MarkdownLintService {
  constructor(chunkSize = 1000000) { // 1MB - align with PerformanceOptimizer thresholds
    this.chunkSize = chunkSize;
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
      const result = await lintingApi.processText(text, {
        rules,
        chunk_offset: offset
      });

      return result.issues || [];
    } catch (error) {
      console.error('MarkdownLintService: Chunk processing failed:', error);
      throw error;
    }
  }

  /**
   * Get context-specific rules for markdown linting
   * @param {number|null} categoryId - Category ID (ignored in simplified system)
   * @param {string|null} folderPath - Folder path (ignored in simplified system)
   * @returns {Promise<Object>} Rules configuration object
   */
  async getRulesForContext(categoryId, folderPath) {
    try {
      // Use the new lintingApi to get effective rules
      return await lintingApi.getEffectiveRules();
    } catch (error) {
      console.warn('MarkdownLintService: Failed to get rules for context:', error);
      // Return recommended defaults to prevent blocking
      return await this.getRecommendedDefaults();
    }
  }

  /**
   * Get recommended default rules from the markdown-lint-service
   * @returns {Promise<Object>} Recommended default rules
   */
  async getRecommendedDefaults() {
    try {
      return await lintingApi.getRecommendedDefaults();
    } catch (error) {
      console.warn('MarkdownLintService: Failed to get recommended defaults, using fallback');
      // Fallback to a minimal set of recommended rules
      return {
        "MD001": true,  // Heading levels should only increment by one level at a time
        "MD003": { "style": "atx" }, // Heading style
        "MD004": { "style": "dash" }, // Unordered list style
        "MD005": true,  // Inconsistent indentation for list items
        "MD007": { "indent": 2 }, // Unordered list indentation
        "MD009": true,  // Trailing spaces
        "MD010": true,  // Hard tabs
        "MD011": true,  // Reversed link syntax
        "MD012": true,  // Multiple consecutive blank lines
        "MD013": false, // Line length (disabled by default)
        "MD014": true,  // Dollar signs used before commands
        "MD018": true,  // No space after hash on atx style heading
        "MD019": true,  // Multiple spaces after hash on atx style heading
        "MD020": true,  // No space inside hashes on closed atx style heading
        "MD021": true,  // Multiple spaces inside hashes on closed atx style heading
        "MD022": true,  // Headings should be surrounded by blank lines
        "MD023": true,  // Headings must start at the beginning of the line
        "MD024": true,  // Multiple headings with the same content
        "MD025": true,  // Multiple top level headings in the same document
        "MD026": true,  // Trailing punctuation in heading
        "MD027": true,  // Multiple spaces after blockquote symbol
        "MD028": true,  // Blank line inside blockquote
        "MD029": { "style": "ordered" }, // Ordered list item prefix
        "MD030": true,  // Spaces after list markers
        "MD031": true,  // Fenced code blocks should be surrounded by blank lines
        "MD032": true,  // Lists should be surrounded by blank lines
        "MD033": false, // Inline HTML (disabled by default)
        "MD034": true,  // Bare URL used
        "MD035": true,  // Horizontal rule style
        "MD036": true,  // Emphasis used instead of a heading
        "MD037": true,  // Spaces inside emphasis markers
        "MD038": true,  // Spaces inside code span elements
        "MD039": true,  // Spaces inside link text
        "MD040": true,  // Fenced code blocks should have a language specified
        "MD041": true,  // First line in file should be a top level heading
        "MD042": true,  // No empty links
        "MD043": false, // Required heading structure (disabled by default)
        "MD044": true,  // Proper names should have the correct capitalization
        "MD045": true,  // Images should have alternate text (alt text)
        "MD046": { "style": "fenced" }, // Code block style
        "MD047": true,  // Files should end with a single newline character
        "MD048": { "style": "backtick" }, // Code fence style
        "MD049": { "style": "underscore" }, // Emphasis style
        "MD050": { "style": "asterisk" }, // Strong style
        "MD051": true,  // Link fragments should be valid
        "MD052": true,  // Reference links and images should use a label that is defined
        "MD053": true,  // Link and image reference definitions should be needed
        "MD054": true,  // Link and image style
        "MD055": true,  // Table pipe style
        "MD056": true,  // Table column count
        "MD058": true   // Table row count
      };
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
      return await lintingApi.getRuleDefinitions();
    } catch (error) {
      console.error('MarkdownLintService: Failed to get rule definitions:', error);
      // Return empty object as fallback
      return {};
    }
  }

  /**
   * Check backend service health
   * @returns {Promise<boolean>} True if service is healthy
   */
  async checkHealth() {
    try {
      await lintingApi.checkHealth();
      return true;
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