/**
 * Enhanced Spell Checker - Phase 2 Implementation  
 * Created: October 22, 2025 by AI Agent
 * Purpose: Multi-language spell checking with dynamic dictionary management
 * Features: Language auto-detection, multi-language support, performance optimization
 */

const DictionaryManager = require('./DictionaryManager');
const BasicSpellChecker = require('./BasicSpellChecker');

class EnhancedSpellChecker extends BasicSpellChecker {
  constructor() {
    super();
    this.dictionaryManager = new DictionaryManager();
    this.languageCache = new Map(); // text hash -> detected language
    this.defaultLanguage = 'en-US';
    this.multiLanguageMode = false;
  }

  /**
   * Initialize the enhanced spell checker
   */
  async init() {
    try {
      console.log('[EnhancedSpellChecker] Initializing enhanced spell checker...');
      
      // Initialize dictionary manager (loads en-US first, others async)
      await this.dictionaryManager.init();
      
      // Set the primary speller to en-US
      this.speller = await this.dictionaryManager.getDictionary('en-US');
      this.isInitialized = true;
      
      console.log('[EnhancedSpellChecker] Enhanced spell checker initialized');
      
    } catch (error) {
      console.error('[EnhancedSpellChecker] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Check text for spelling errors with multi-language support
   * @param {string} text - Text to check
   * @param {Object} options - Check options
   * @returns {Object} Results with spelling issues
   */
  async checkText(text, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Enhanced spell checker not initialized');
    }

    const {
      customWords = [],
      language = null,
      autoDetectLanguage = true,
      chunkOffset = 0
    } = options;

    // Determine language to use
    let targetLanguage = language || this.defaultLanguage;
    
    if (autoDetectLanguage && !language) {
      targetLanguage = await this.detectLanguage(text);
    }

    // Get appropriate dictionary
    const speller = await this.dictionaryManager.getDictionary(targetLanguage);
    
    // Update custom words for this speller
    this.updateCustomWords(customWords, speller);

    // Extract words with positions
    const wordData = this.extractWordsWithPositions(text);
    const issues = [];

    for (const { word, startPos, endPos, lineNumber, column } of wordData) {
      // Skip if word is in custom dictionary
      if (this.customWords.has(word.toLowerCase())) {
        continue;
      }

      // Check spelling with target language dictionary
      if (!speller.correct(word)) {
        const suggestions = speller.suggest(word);
        
        // If no suggestions in target language and it's not English, try English fallback
        let finalSuggestions = suggestions.slice(0, 5);
        if (finalSuggestions.length === 0 && targetLanguage !== 'en-US') {
          const englishSpeller = await this.dictionaryManager.getDictionary('en-US');
          if (englishSpeller.correct(word)) {
            // Word is correct in English, might be a proper noun or technical term
            continue;
          }
          const englishSuggestions = englishSpeller.suggest(word);
          finalSuggestions = englishSuggestions.slice(0, 3);
        }
        
        issues.push({
          word,
          suggestions: finalSuggestions,
          position: {
            start: startPos + chunkOffset,
            end: endPos + chunkOffset
          },
          lineNumber,
          column,
          type: 'spelling',
          severity: 'error',
          confidence: this.calculateConfidence(word, finalSuggestions),
          language: targetLanguage,
          detectedLanguage: autoDetectLanguage ? targetLanguage : null
        });
      }
    }

    return {
      spelling: issues,
      language: targetLanguage,
      availableLanguages: this.dictionaryManager.getAvailableLanguages()
    };
  }

  /**
   * Detect the language of the text
   * @param {string} text - Text to analyze
   * @returns {string} Detected language code
   */
  async detectLanguage(text) {
    // Simple caching based on text hash
    const textHash = this.hashText(text);
    if (this.languageCache.has(textHash)) {
      return this.languageCache.get(textHash);
    }

    // For now, implement simple heuristics
    // In a future phase, we'll add proper language detection with franc
    let detectedLanguage = this.defaultLanguage;

    // Simple keyword-based detection (basic heuristics)
    const languageIndicators = {
      'es-ES': /\b(el|la|los|las|un|una|de|en|con|por|para|que|se|no|es|está|son|tienen|hacer|tiempo|año|años)\b/gi,
      'fr-FR': /\b(le|la|les|un|une|de|du|des|en|dans|avec|pour|par|que|qui|ne|pas|est|sont|avoir|être|faire|temps|année)\b/gi,
      'de-DE': /\b(der|die|das|den|dem|des|ein|eine|eines|einem|einen|und|oder|mit|von|zu|für|auf|in|ist|sind|haben|sein|werden|zeit|jahr)\b/gi,
      'en-GB': /\b(colour|honour|favour|centre|theatre|realise|organise|analyse|programme)\b/gi
    };

    let maxMatches = 0;
    for (const [lang, pattern] of Object.entries(languageIndicators)) {
      const matches = (text.match(pattern) || []).length;
      if (matches > maxMatches && matches > 2) { // Minimum threshold
        maxMatches = matches;
        detectedLanguage = lang;
      }
    }

    // Cache the result
    this.languageCache.set(textHash, detectedLanguage);
    
    return detectedLanguage;
  }

  /**
   * Update custom words for a specific speller
   * @param {string[]} customWords - Array of custom words
   * @param {Object} speller - nspell instance
   */
  updateCustomWords(customWords, speller) {
    this.customWords.clear();
    
    for (const word of customWords) {
      if (word && typeof word === 'string') {
        this.customWords.add(word.toLowerCase());
        // Add to the specific speller instance
        speller.add(word);
      }
    }
  }

  /**
   * Check text in multiple languages simultaneously
   * @param {string} text - Text to check
   * @param {string[]} languages - Array of language codes
   * @param {Object} options - Check options
   * @returns {Object} Multi-language results
   */
  async checkMultipleLanguages(text, languages, options = {}) {
    const results = {};
    
    for (const language of languages) {
      try {
        const result = await this.checkText(text, {
          ...options,
          language,
          autoDetectLanguage: false
        });
        results[language] = result;
      } catch (error) {
        console.warn(`[EnhancedSpellChecker] Failed to check ${language}:`, error.message);
        results[language] = { error: error.message, spelling: [] };
      }
    }
    
    return results;
  }

  /**
   * Get spell checking statistics across languages
   * @returns {Object} Statistics
   */
  getStatistics() {
    return {
      supportedLanguages: this.dictionaryManager.getAvailableLanguages(),
      memoryUsage: this.dictionaryManager.getMemoryUsage(),
      languageCacheSize: this.languageCache.size,
      customWordsCount: this.customWords.size,
      defaultLanguage: this.defaultLanguage
    };
  }

  /**
   * Set the default language for spell checking
   * @param {string} language - Language code
   */
  setDefaultLanguage(language) {
    if (this.dictionaryManager.isLanguageSupported(language)) {
      this.defaultLanguage = language;
    } else {
      throw new Error(`Unsupported language: ${language}`);
    }
  }

  /**
   * Preload additional dictionaries for faster access
   * @param {string[]} languages - Array of language codes to preload
   */
  async preloadLanguages(languages) {
    const loadPromises = languages.map(lang => 
      this.dictionaryManager.loadDictionary(lang).catch(error => {
        console.warn(`[EnhancedSpellChecker] Failed to preload ${lang}:`, error.message);
      })
    );
    
    await Promise.all(loadPromises);
  }

  /**
   * Clear language detection cache
   */
  clearLanguageCache() {
    this.languageCache.clear();
  }

  /**
   * Create a simple hash of text for caching
   * @param {string} text - Text to hash
   * @returns {string} Text hash
   */
  hashText(text) {
    // Simple hash function for caching (not cryptographic)
    let hash = 0;
    if (text.length === 0) return hash.toString();
    
    for (let i = 0; i < Math.min(text.length, 500); i++) { // Only hash first 500 chars
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString();
  }

  /**
   * Add support for a new language
   * @param {string} languageCode - Language code
   * @param {Object} config - Language configuration
   */
  addLanguageSupport(languageCode, config) {
    this.dictionaryManager.addLanguageSupport(languageCode, config);
  }

  /**
   * Reload dictionaries (useful for updates)
   * @param {string} language - Specific language to reload, or null for all
   */
  async reloadDictionaries(language = null) {
    if (language) {
      await this.dictionaryManager.reloadDictionary(language);
      if (language === this.defaultLanguage) {
        this.speller = await this.dictionaryManager.getDictionary(language);
      }
    } else {
      // Reload all dictionaries
      const languages = this.dictionaryManager.getAvailableLanguages();
      for (const lang of languages) {
        try {
          await this.dictionaryManager.reloadDictionary(lang.code);
        } catch (error) {
          console.warn(`[EnhancedSpellChecker] Failed to reload ${lang.code}:`, error.message);
        }
      }
      this.speller = await this.dictionaryManager.getDictionary(this.defaultLanguage);
    }
    
    // Clear caches
    this.clearLanguageCache();
  }
}

module.exports = EnhancedSpellChecker;