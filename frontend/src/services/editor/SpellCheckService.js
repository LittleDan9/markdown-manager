// spellCheckService.js
// Phase 4: Backend API Integration
// Migrated from worker-based to backend API-based spell checking
// Maintains compatibility with existing frontend interface

import spellCheckApi from '@/api/spellCheckApi';
import DictionaryService from '../dictionary';
import MarkdownParser from './MarkdownParser';

export class SpellCheckService {
  constructor(chunkSize = 1000) {
    this.speller = null;
    this.chunkSize = chunkSize;
    this.serviceAvailable = false;
    this.fallbackToLocal = false;

    // Keep track of initialization state
    this.initPromise = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return true;

    // Prevent multiple simultaneous initialization attempts
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._doInit();
    return this.initPromise;
  }

  async _doInit() {
    try {
      // Check if backend spell check service is available
      this.serviceAvailable = await spellCheckApi.isServiceAvailable();

      if (this.serviceAvailable) {
        console.log('Spell check service: Backend API available');
        this.speller = true;
        this.initialized = true;
        return true;
      } else {
        console.warn('Spell check service: Backend unavailable, falling back to local dictionary');
        this.fallbackToLocal = true;
        this.initialized = true;
        return false;
      }
    } catch (err) {
      console.error('SpellCheckService init error', err);
      this.fallbackToLocal = true;
      this.initialized = true;
      return false;
    }
  }

  async scan(text, onProgress = () => {}, categoryId = null, folderPath = null, settings = {}) {
    await this.init();

    try {
      if (this.serviceAvailable && !this.fallbackToLocal) {
        // Use backend API for spell checking with advanced settings
        const issues = await spellCheckApi.scan(text, onProgress, categoryId, folderPath, settings);
        return issues;
      } else {
        // Fallback: Use local dictionary service for basic checking
        console.warn('Using fallback local spell checking (limited functionality)');
        return await this._fallbackScan(text, onProgress, categoryId, folderPath);
      }
    } catch (error) {
      console.error('Backend spell check failed, falling back to local:', error);
      this.fallbackToLocal = true;
      return await this._fallbackScan(text, onProgress, categoryId, folderPath);
    }
  }

  async _fallbackScan(text, onProgress = () => {}, categoryId = null, folderPath = null) {
    // Simplified fallback - basic word validation without full spell checking
    // This provides graceful degradation when backend is unavailable
    try {
      const customWords = DictionaryService.getAllApplicableWords(folderPath, categoryId);
      const words = text.split(/\s+/);
      const issues = [];

      // Very basic fallback - only flag obviously malformed words
      words.forEach((word, index) => {
        const cleanWord = word.replace(/[^\w']/g, '');
        if (cleanWord.length > 2 &&
            !customWords.includes(cleanWord.toLowerCase()) &&
            /[0-9]{3,}/.test(cleanWord)) { // Flag words with 3+ consecutive numbers
          issues.push({
            word: cleanWord,
            suggestions: [],
            position: { start: index * 10, end: index * 10 + cleanWord.length },
            type: 'spelling',
            severity: 'warning',
            fallback: true
          });
        }
      });

      if (onProgress) {
        onProgress(100, issues);
      }

      return issues;
    } catch (error) {
      console.error('Fallback scan failed:', error);
      return [];
    }
  }

  /**
   * Get custom words for backward compatibility
   * @param {string} [categoryId] - Optional category ID
   * @param {string} [folderPath] - Optional folder path
   * @returns {string[]} Array of custom words
   */
  getCustomWords(categoryId = null, folderPath = null) {
    // In Phase 4, custom words are managed by the backend
    // This method provides compatibility for existing code
    return DictionaryService.getAllApplicableWords(folderPath, categoryId);
  }

  /**
   * Add a custom word - delegates to DictionaryService for local cache
   * @param {string} word - Word to add
   * @param {string} [categoryId] - Optional category ID
   * @param {string} [folderPath] - Optional folder path
   */
  addCustomWord(word, categoryId = null, folderPath = null) {
    // For Phase 4, we maintain local dictionary service for immediate feedback
    // Backend will handle persistent storage through custom dictionary API
    if (folderPath) {
      DictionaryService.addFolderWord(folderPath, word);
    } else if (categoryId) {
      DictionaryService.addCategoryWord(categoryId, word);
    } else {
      DictionaryService.addCustomWord(word);
    }
  }

  /**
   * Remove a custom word - delegates to DictionaryService
   * @param {string} word - Word to remove
   * @param {string} [categoryId] - Optional category ID
   * @param {string} [folderPath] - Optional folder path
   */
  removeCustomWord(word, categoryId = null, folderPath = null) {
    if (folderPath) {
      DictionaryService.removeFolderWord(folderPath, word);
    } else if (categoryId) {
      DictionaryService.removeCategoryWord(categoryId, word);
    } else {
      DictionaryService.removeCustomWord(word);
    }
  }

  /**
   * Check if backend service is available
   * @returns {boolean} True if backend service is responding
   */
  isBackendAvailable() {
    return this.serviceAvailable && !this.fallbackToLocal;
  }

  /**
   * Get service information
   * @returns {Promise<Object>} Service capabilities and status
   */
  async getServiceInfo() {
    try {
      if (this.isBackendAvailable()) {
        return await spellCheckApi.getServiceInfo();
      }
    } catch (error) {
      console.error('Failed to get service info:', error);
    }

    return {
      service: 'local-fallback',
      integration: {
        custom_dictionary: true,
        phase: '4-migration-fallback',
        features: ['basic-validation']
      }
    };
  }

  /**
   * Force refresh of backend service availability
   * @returns {Promise<boolean>} True if service becomes available
   */
  async refreshServiceStatus() {
    try {
      this.serviceAvailable = await spellCheckApi.isServiceAvailable();
      this.fallbackToLocal = !this.serviceAvailable;
      return this.serviceAvailable;
    } catch (error) {
      console.error('Failed to refresh service status:', error);
      this.fallbackToLocal = true;
      return false;
    }
  }
}

export default new SpellCheckService();