/**
 * Dictionary Manager - Phase 2 Implementation
 * Created: October 22, 2025 by AI Agent
 * Purpose: Dynamic dictionary loading and management with npm package integration
 * Features: Runtime loading, version management, fallback handling, caching
 */

const nspell = require('nspell');
const path = require('path');
const fs = require('fs');

class DictionaryManager {
  constructor() {
    this.dictionaries = new Map(); // language -> nspell instance
    this.dictionaryData = new Map(); // language -> {aff, dic} buffers
    this.loadPromises = new Map(); // language -> loading promise
    this.supportedLanguages = new Map([
      ['en-US', { package: 'dictionary-en-us', name: 'English (US)', fallback: true }],
      ['en-GB', { package: 'dictionary-en-gb', name: 'English (UK)' }],
      ['es-ES', { package: 'dictionary-es', name: 'Spanish' }],
      ['fr-FR', { package: 'dictionary-fr', name: 'French' }],
      ['de-DE', { package: 'dictionary-de', name: 'German' }]
    ]);
    this.isInitialized = false;
    this.initializationPromise = null;
  }

  /**
   * Initialize the dictionary manager
   */
  async init() {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._performInit();
    return this.initializationPromise;
  }

  async _performInit() {
    try {
      console.log('[DictionaryManager] Initializing dictionary manager...');
      
      // Load primary language (en-US) first
      await this.loadDictionary('en-US');
      
      // Load other languages in parallel (non-blocking)
      const otherLanguages = Array.from(this.supportedLanguages.keys())
        .filter(lang => lang !== 'en-US');
      
      // Start loading other languages but don't wait for them
      Promise.all(otherLanguages.map(lang => this.loadDictionary(lang)))
        .catch(error => {
          console.warn('[DictionaryManager] Some secondary dictionaries failed to load:', error.message);
        });

      this.isInitialized = true;
      console.log('[DictionaryManager] Primary dictionary loaded, service ready');
      
    } catch (error) {
      console.error('[DictionaryManager] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Load a specific dictionary dynamically
   * @param {string} language - Language code (e.g., 'en-US')
   * @returns {Promise<Object>} nspell instance
   */
  async loadDictionary(language) {
    // Return cached dictionary if available
    if (this.dictionaries.has(language)) {
      return this.dictionaries.get(language);
    }

    // Return existing loading promise if in progress
    if (this.loadPromises.has(language)) {
      return this.loadPromises.get(language);
    }

    // Start loading the dictionary
    const loadPromise = this._loadDictionaryFromPackage(language);
    this.loadPromises.set(language, loadPromise);

    try {
      const speller = await loadPromise;
      this.dictionaries.set(language, speller);
      this.loadPromises.delete(language);
      return speller;
    } catch (error) {
      this.loadPromises.delete(language);
      throw error;
    }
  }

  /**
   * Load dictionary from npm package with fallback handling
   * @private
   */
  async _loadDictionaryFromPackage(language) {
    const langConfig = this.supportedLanguages.get(language);
    if (!langConfig) {
      throw new Error(`Unsupported language: ${language}`);
    }

    console.log(`[DictionaryManager] Loading ${langConfig.name} dictionary...`);

    try {
      // Try dynamic import first (handles ESM packages)
      const dictData = await this._loadViaImport(langConfig.package);
      const speller = nspell(dictData.aff, dictData.dic);
      
      // Cache the data for potential reuse
      this.dictionaryData.set(language, dictData);
      
      console.log(`[DictionaryManager] ✓ ${langConfig.name} loaded via import`);
      return speller;

    } catch (importError) {
      console.warn(`[DictionaryManager] Import failed for ${language}:`, importError.message);
      
      try {
        // Try require as fallback
        const dictData = await this._loadViaRequire(langConfig.package);
        const speller = nspell(dictData.aff, dictData.dic);
        
        this.dictionaryData.set(language, dictData);
        console.log(`[DictionaryManager] ✓ ${langConfig.name} loaded via require`);
        return speller;

      } catch (requireError) {
        console.warn(`[DictionaryManager] Require failed for ${language}:`, requireError.message);
        
        // Try loading from static files as last resort
        try {
          const dictData = await this._loadFromStaticFiles(language);
          const speller = nspell(dictData.aff, dictData.dic);
          
          console.log(`[DictionaryManager] ✓ ${langConfig.name} loaded from static files`);
          return speller;

        } catch (staticError) {
          if (langConfig.fallback) {
            // For primary language, this is a critical error
            throw new Error(`Failed to load primary dictionary ${language}: ${staticError.message}`);
          } else {
            // For secondary languages, log warning and continue
            console.warn(`[DictionaryManager] Failed to load ${language}, using en-US fallback`);
            return await this.getDictionary('en-US');
          }
        }
      }
    }
  }

  /**
   * Load dictionary via dynamic import (for ESM packages)
   * @private
   */
  async _loadViaImport(packageName) {
    const dictionaryModule = await import(packageName);
    
    const affBuffer = await new Promise((resolve, reject) => {
      const handler = dictionaryModule.default?.aff || dictionaryModule.aff;
      if (typeof handler !== 'function') {
        reject(new Error('No aff function found'));
        return;
      }
      handler((err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    const dicBuffer = await new Promise((resolve, reject) => {
      const handler = dictionaryModule.default?.dic || dictionaryModule.dic;
      if (typeof handler !== 'function') {
        reject(new Error('No dic function found'));
        return;
      }
      handler((err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    return { aff: affBuffer, dic: dicBuffer };
  }

  /**
   * Load dictionary via require (for CommonJS packages)
   * @private
   */
  async _loadViaRequire(packageName) {
    const dictionaryModule = require(packageName);
    
    const affBuffer = await new Promise((resolve, reject) => {
      dictionaryModule.aff((err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    const dicBuffer = await new Promise((resolve, reject) => {
      dictionaryModule.dic((err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    return { aff: affBuffer, dic: dicBuffer };
  }

  /**
   * Load dictionary from static files (fallback)
   * @private
   */
  async _loadFromStaticFiles(language) {
    const dictPath = path.join(__dirname, '../dictionaries', language);
    
    const affPath = path.join(dictPath, 'index.aff');
    const dicPath = path.join(dictPath, 'index.dic');
    
    if (!fs.existsSync(affPath) || !fs.existsSync(dicPath)) {
      throw new Error(`Static dictionary files not found for ${language}`);
    }

    const affBuffer = fs.readFileSync(affPath);
    const dicBuffer = fs.readFileSync(dicPath);
    
    return { aff: affBuffer, dic: dicBuffer };
  }

  /**
   * Get a dictionary for a specific language
   * @param {string} language - Language code
   * @returns {Promise<Object>} nspell instance
   */
  async getDictionary(language) {
    if (!this.isInitialized) {
      await this.init();
    }

    // Return cached dictionary if available
    if (this.dictionaries.has(language)) {
      return this.dictionaries.get(language);
    }

    // Try to load the dictionary
    try {
      return await this.loadDictionary(language);
    } catch (error) {
      console.warn(`[DictionaryManager] Failed to load ${language}, falling back to en-US`);
      return this.dictionaries.get('en-US');
    }
  }

  /**
   * Get list of available languages
   * @returns {Array} Array of language objects
   */
  getAvailableLanguages() {
    return Array.from(this.supportedLanguages.entries()).map(([code, config]) => ({
      code,
      name: config.name,
      loaded: this.dictionaries.has(code),
      loading: this.loadPromises.has(code)
    }));
  }

  /**
   * Check if a language is supported
   * @param {string} language - Language code
   * @returns {boolean} True if supported
   */
  isLanguageSupported(language) {
    return this.supportedLanguages.has(language);
  }

  /**
   * Preload all supported dictionaries
   * @returns {Promise<void>}
   */
  async preloadAllDictionaries() {
    const languages = Array.from(this.supportedLanguages.keys());
    const results = await Promise.allSettled(
      languages.map(lang => this.loadDictionary(lang))
    );

    const loaded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`[DictionaryManager] Preload complete: ${loaded} loaded, ${failed} failed`);
  }

  /**
   * Reload a specific dictionary (for updates)
   * @param {string} language - Language code
   * @returns {Promise<Object>} New nspell instance
   */
  async reloadDictionary(language) {
    // Clear cached data
    this.dictionaries.delete(language);
    this.dictionaryData.delete(language);
    this.loadPromises.delete(language);

    // Reload the dictionary
    return await this.loadDictionary(language);
  }

  /**
   * Get memory usage statistics
   * @returns {Object} Memory usage info
   */
  getMemoryUsage() {
    const stats = {
      loadedDictionaries: this.dictionaries.size,
      totalLanguages: this.supportedLanguages.size,
      cachedData: this.dictionaryData.size,
      estimatedMemoryMB: 0
    };

    // Rough estimate of memory usage
    for (const [lang, data] of this.dictionaryData) {
      stats.estimatedMemoryMB += (data.aff.length + data.dic.length) / (1024 * 1024);
    }

    stats.estimatedMemoryMB = Math.round(stats.estimatedMemoryMB * 100) / 100;
    return stats;
  }

  /**
   * Add a custom language configuration
   * @param {string} code - Language code
   * @param {Object} config - Language configuration
   */
  addLanguageSupport(code, config) {
    this.supportedLanguages.set(code, config);
  }

  /**
   * Remove a language from memory (for memory management)
   * @param {string} language - Language code
   */
  unloadDictionary(language) {
    if (language === 'en-US') {
      console.warn('[DictionaryManager] Cannot unload primary language en-US');
      return;
    }

    this.dictionaries.delete(language);
    this.dictionaryData.delete(language);
    this.loadPromises.delete(language);
    
    console.log(`[DictionaryManager] Unloaded dictionary: ${language}`);
  }
}

module.exports = DictionaryManager;