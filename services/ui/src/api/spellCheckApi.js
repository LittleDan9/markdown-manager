/**
 * Spell Check API - Frontend interface for backend spell check service
 *
 * Provides:
 * - Text spell checking with custom dictionary integration
 * - Language detection and multi-language support
 * - Style guide enforcement and readability analysis
 * - Service health monitoring
 * - Phase 4 frontend migration from worker-based to backend-based checking
 *
 * Created: October 22, 2025 by AI Agent
 * Phase: 4 - Frontend Migration
 */

import { Api } from './api';

class SpellCheckApi extends Api {
  /**
   * Check text for spelling, grammar, and style issues
   * @param {string} text - Text content to analyze
   * @param {Array<string>} customWords - Additional custom words to ignore
   * @param {Object} options - Additional options for analysis
   * @returns {Promise<Object>} Analysis results with issues and metadata
   */
  async checkText(text, customWords = [], options = {}) {
    try {
      const requestPayload = {
        text: text,
        customWords: customWords,
        options: {
          ...options,
          // Phase 5: Advanced settings support
          analysisTypes: options.analysisTypes || {
            spelling: true,
            grammar: true,
            style: true,
            readability: true
          },
          styleGuide: options.styleGuide || 'none',
          language: options.language || 'en-US'
        }
      };

      // Phase 6: Code fence spell checking support
      if (options.enableCodeSpellCheck) {
        requestPayload.options.enableCodeSpellCheck = options.enableCodeSpellCheck;
      }

      if (options.codeSpellSettings) {
        requestPayload.options.codeSpellSettings = options.codeSpellSettings;
      }

      const response = await this.apiCall('/spell-check/check', 'POST', requestPayload);
      return response.data;
    } catch (error) {
      console.error('Spell check failed:', error);
      // For Phase 4 migration, provide graceful fallback
      throw new Error(`Spell check service unavailable: ${error.message}`);
    }
  }

  /**
   * Get service health status
   * @returns {Promise<Object>} Health information
   */
  async checkHealth() {
    try {
      const response = await this.apiCall('/spell-check/health');
      return response.data;
    } catch (error) {
      console.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        error: error.message,
        backend_integration: 'error'
      };
    }
  }

  /**
   * Phase 6: Check code fences for spelling errors
   * @param {string} text - Text containing code fences to analyze
   * @param {Object} codeSpellSettings - Code spell checking settings
   * @param {Array<string>} customWords - Additional custom words to ignore
   * @returns {Promise<Object>} Analysis results with code spelling issues
   */
  async checkCodeSpelling(text, codeSpellSettings = {}, customWords = []) {
    try {
      const response = await this.checkText(text, customWords, {
        enableCodeSpellCheck: true,
        codeSpellSettings: {
          codeLanguages: codeSpellSettings.codeLanguages || ['javascript', 'python', 'typescript'],
          checkComments: codeSpellSettings.checkComments ?? true,
          checkStrings: codeSpellSettings.checkStrings ?? true,
          checkIdentifiers: codeSpellSettings.checkIdentifiers ?? false,
          ...codeSpellSettings
        }
      });

      return {
        codeSpelling: response.results?.codeSpelling || [],
        statistics: response.statistics || {},
        metadata: response.metadata || {}
      };
    } catch (error) {
      console.error('Code spell check failed:', error);
      throw new Error(`Code spell check service unavailable: ${error.message}`);
    }
  }

  /**
   * Get supported programming languages for code spell checking
   * @returns {Promise<Array>} List of supported programming languages
   */
  async getSupportedCodeLanguages() {
    // For now, return hardcoded list - could be extended to fetch from backend
    return [
      'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp',
      'php', 'ruby', 'go', 'rust', 'kotlin', 'swift', 'sql', 'html', 'css'
    ];
  }

  /**
   * Get service information and capabilities
   * @returns {Promise<Object>} Service info including features and version
   */
  async getServiceInfo() {
    try {
      const response = await this.apiCall('/spell-check/info');
      return response.data;
    } catch (error) {
      console.error('Service info request failed:', error);
      // Return basic info for fallback
      return {
        service: 'spell-check-service',
        integration: {
          custom_dictionary: false,
          phase: '4-migration',
          features: ['spelling']
        }
      };
    }
  }

  /**
   * Batch check multiple texts (for future use)
   * @param {Array<Object>} texts - Array of text objects with text and metadata
   * @param {Array<string>} customWords - Global custom words
   * @param {Object} options - Batch processing options
   * @returns {Promise<Array>} Array of analysis results
   */
  async checkBatch(texts, customWords = [], options = {}) {
    try {
      const response = await this.apiCall('/spell-check/check-batch', 'POST', {
        texts: texts,
        customWords: customWords,
        options: options
      });
      return response.data;
    } catch (error) {
      console.error('Batch spell check failed:', error);
      throw new Error(`Batch spell check service unavailable: ${error.message}`);
    }
  }

  /**
   * Detect language of text
   * @param {string} text - Text to analyze for language
   * @returns {Promise<Object>} Language detection results
   */
  async detectLanguage(text) {
    try {
      const response = await this.apiCall('/spell-check/detect-language', 'POST', {
        text: text
      });
      return response.data;
    } catch (error) {
      console.error('Language detection failed:', error);
      // Return default language for fallback
      return {
        language: 'en-US',
        confidence: 0.5,
        alternatives: []
      };
    }
  }

  /**
   * Get available languages
   * @returns {Promise<Array>} List of supported languages
   */
  async getAvailableLanguages() {
    try {
      const response = await this.apiCall('/spell-check/languages');
      return response.data.languages || [];
    } catch (error) {
      console.error('Failed to get available languages:', error);
      // Return basic English support for fallback
      return ['en-US'];
    }
  }

  /**
   * Check if spell check service is available and responding
   * @returns {Promise<boolean>} True if service is healthy
   */
  async isServiceAvailable() {
    try {
      const health = await this.checkHealth();
      return health.status === 'healthy';
    } catch (error) {
      return false;
    }
  }

  /**
   * Process text with chunking support (for large documents)
   * @param {string} text - Large text to process
   * @param {Array<string>} customWords - Custom words to ignore
   * @param {Function} onProgress - Progress callback
   * @param {number} chunkSize - Size of each chunk
   * @returns {Promise<Array>} Combined results from all chunks
   */
  async processLargeText(text, customWords = [], onProgress = () => {}, chunkSize = 1000) {
    try {
      // For Phase 4, we'll handle chunking on the backend
      // This method ensures compatibility with the existing frontend interface
      const result = await this.checkText(text, customWords, {
        chunking: true,
        chunkSize: chunkSize
      });

      // Call progress callback to match existing interface
      if (onProgress) {
        onProgress(100, result.results?.spelling || []);
      }

      return result.results?.spelling || [];
    } catch (error) {
      console.error('Large text processing failed:', error);
      throw error;
    }
  }

  /**
   * Legacy compatibility method for existing SpellCheckService interface
   * @param {string} text - Text to check
   * @param {Function} onProgress - Progress callback
   * @param {string} categoryId - Category ID for custom words
   * @param {string} folderPath - Folder path for custom words
   * @param {Object} settings - Phase 5: Advanced analysis settings
   * @returns {Promise<Array>} All analysis issues (spelling, grammar, style)
   */
  async scan(text, onProgress = () => {}, categoryId = null, folderPath = null, settings = {}) {
    try {
      // For Phase 5, apply analysis type filters
      const options = {
        categoryId: categoryId,
        folderPath: folderPath,
        analysisTypes: {
          spelling: settings.spelling ?? true,
          grammar: settings.grammar ?? true,
          style: settings.style ?? true,
          readability: settings.readability ?? true
        },
        styleGuide: settings.styleGuide || 'none',
        language: settings.language || 'en-US'
      };

      // Phase 6: Code spell checking support
      if (settings.enableCodeSpellCheck) {
        options.enableCodeSpellCheck = settings.enableCodeSpellCheck;
        options.codeSpellSettings = settings.codeSpellSettings || {
          codeLanguages: ['javascript', 'python', 'typescript'],
          checkComments: true,
          checkStrings: true,
          checkIdentifiers: false
        };
      }

      const result = await this.checkText(text, [], options);

      // Backend already filtered results based on settings, so combine all returned issues
      const allIssues = [];

      // Add all issue types returned by backend (already filtered)
      if (result.results?.spelling) {
        allIssues.push(...result.results.spelling);
      }

      if (result.results?.grammar) {
        allIssues.push(...result.results.grammar);
      }

      if (result.results?.style) {
        allIssues.push(...result.results.style);
      }

      // Phase 6: Include code spelling issues (already filtered by backend)
      if (result.results?.codeSpelling) {
        allIssues.push(...result.results.codeSpelling);
      }

      // Call progress callback to maintain compatibility
      if (onProgress) {
        onProgress(100, allIssues, {
          readability: settings.readability !== false ? result.analysis?.readability : null,
          statistics: result.statistics,
          language: result.analysis?.language,
          // Phase 6: Include code spell statistics
          codeSpellStatistics: result.statistics ? {
            codeBlocksChecked: result.statistics.code_blocks_checked || 0,
            codeLanguagesDetected: result.statistics.code_languages_detected || []
          } : null
        });
      }

      return allIssues;
    } catch (error) {
      console.error('Spell check scan failed:', error);
      // For Phase 4 migration, return empty array to prevent UI breakage
      return [];
    }
  }

  /**
   * Initialize service (compatibility with existing interface)
   * @returns {Promise<void>}
   */
  async init() {
    try {
      // Check if backend service is available
      const isAvailable = await this.isServiceAvailable();
      if (!isAvailable) {
        console.warn('Spell check service not available, operating in degraded mode');
      }
      // Always return true for successful initialization
      return true;
    } catch (error) {
      console.error('Spell check service initialization failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export default new SpellCheckApi();