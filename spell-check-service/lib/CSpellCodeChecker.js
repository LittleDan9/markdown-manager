/**
 * CSpell Code Checker - Refactored Main Orchestrator
 * Integrates modular components for intelligent code fence spell checking
 * Maintains the same public API while delegating to specialized modules
 */

const path = require('path');
const fs = require('fs').promises;
const MarkdownCodeFenceParser = require('./MarkdownCodeFenceParser');
const LanguageConfig = require('./cspell/LanguageConfig');
const ContentExtractor = require('./cspell/ContentExtractor');
const SpellEngine = require('./cspell/SpellEngine');
const IssueTransformer = require('./cspell/IssueTransformer');
const CacheManager = require('./cspell/CacheManager');

// Try to import cspell, fallback to null if not available
let cspell = null;

// Use dynamic import for ES modules
async function initializeCSpell() {
  try {
    cspell = await import('cspell');
    return cspell;
  } catch (error) {
    console.warn('[CSpellCodeChecker] cspell package not available, code spell checking will use fallback');
    return null;
  }
}

class CSpellCodeChecker {
  constructor() {
    // Initialize modular components
    this.languageConfig = new LanguageConfig();
    this.contentExtractor = new ContentExtractor(this.languageConfig);
    this.spellEngine = new SpellEngine();
    this.issueTransformer = new IssueTransformer(this.languageConfig);
    this.cacheManager = new CacheManager(100);
    
    // Core dependencies
    this.codeFenceParser = new MarkdownCodeFenceParser();
    this.initialized = false;
    this.cspellLoaded = false;
    this.cspellConfig = null;
  }

  /**
   * Initialize CSpell with configuration
   */
  async init() {
    try {
      console.log('[CSpellCodeChecker] Initializing cspell engine...');
      
      // Try to load cspell with dynamic import
      const cspellModule = await initializeCSpell();
      if (cspellModule) {
        this.cspellLoaded = true;
        console.log('[CSpellCodeChecker] cspell loaded successfully');
        
        // Initialize spell engine with cspell
        await this.spellEngine.initializeCSpell();
      }
      
      // Load configuration
      await this.loadCSpellConfig();
      
      this.initialized = true;
      console.log('[CSpellCodeChecker] Initialization complete');
      
      return this.initialized;
    } catch (error) {
      console.error('[CSpellCodeChecker] Initialization failed:', error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Load CSpell configuration
   */
  async loadCSpellConfig() {
    try {
      const configPath = path.join(__dirname, '../config/cspell-config.json');
      const configData = await fs.readFile(configPath, 'utf8');
      this.cspellConfig = JSON.parse(configData);
      console.log('[CSpellCodeChecker] Configuration loaded');
    } catch (error) {
      console.warn('[CSpellCodeChecker] Could not load cspell config, using defaults:', error.message);
      this.cspellConfig = {
        language: 'en',
        words: [],
        ignoreWords: []
      };
    }
  }

  /**
   * Check spelling in code fences within markdown text
   * @param {string} text - Markdown text containing code fences
   * @param {Object} options - Configuration options
   * @returns {Promise<Object>} Results object with codeSpelling array and statistics
   */
  async checkCodeFences(text, options = {}) {
    console.log(`[CSpellCodeChecker] checkCodeFences called - initialized: ${this.initialized}`);
    
    // Can work without cspell now using fallback approach
    if (!this.initialized) {
      console.warn('[CSpellCodeChecker] Not initialized, returning empty results');
      return {
        codeSpelling: [],
        codeSpellStatistics: {
          codeBlocks: 0,
          languagesDetected: [],
          issuesFound: 0
        }
      };
    }

    const {
      enableCodeSpellCheck = true,
      codeSpellSettings = {}
    } = options;

    if (!enableCodeSpellCheck) {
      return {
        codeSpelling: [],
        codeSpellStatistics: {
          codeBlocks: 0,
          languagesDetected: [],
          issuesFound: 0
        }
      };
    }

    // Extract default settings
    const {
      checkComments = true,
      checkStrings = false,
      checkIdentifiers = true,
      severity = 'info',
      customWords = []
    } = codeSpellSettings;

    // Parse code fences from markdown
    const codeFences = this.codeFenceParser.getSupportedCodeFences(text);
    
    console.log(`[CSpellCodeChecker] Found ${codeFences.length} supported code fences`);
    if (codeFences.length > 0) {
      console.log(`[CSpellCodeChecker] Languages detected: ${codeFences.map(f => f.language).join(', ')}`);
    }
    
    if (codeFences.length === 0) {
      return {
        codeSpelling: [],
        codeSpellStatistics: {
          codeBlocks: 0,
          languagesDetected: [],
          issuesFound: 0
        }
      };
    }

    console.log(`[CSpellCodeChecker] Processing ${codeFences.length} code fences`);

    const allIssues = [];
    const languagesDetected = new Set();

    // Process each code fence
    for (const fence of codeFences) {
      try {
        const fenceIssues = await this.checkCodeFence(fence, {
          ...codeSpellSettings,
          customWords
        });
        
        allIssues.push(...fenceIssues);
        languagesDetected.add(fence.language);
      } catch (error) {
        console.warn(`[CSpellCodeChecker] Failed to check code fence (${fence.language}):`, error.message);
      }
    }

    // Create statistics and format response
    const statistics = this.issueTransformer.createStatistics(codeFences, allIssues);
    
    return {
      codeSpelling: allIssues,
      codeSpellStatistics: statistics
    };
  }

  /**
   * Check spelling in a single code fence
   * @param {Object} fence - Code fence object from parser
   * @param {Object} settings - Code spell check settings
   * @returns {Promise<Array>} Array of spelling issues
   */
  async checkCodeFence(fence, settings = {}) {
    const {
      checkComments = true,
      checkStrings = false,
      checkIdentifiers = true,
      severity = 'info',
      customWords = []
    } = settings;

    // Check cache first
    const cacheKey = this.cacheManager.generateCacheKey(fence.code, fence.language, settings);
    const cachedResult = this.cacheManager.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const issues = [];
    const langConfig = this.languageConfig.getLanguageConfig(fence.language);
    
    if (!langConfig) {
      console.warn(`[CSpellCodeChecker] Unsupported language: ${fence.language}`);
      return issues;
    }

    // Extract spellcheckable content based on settings
    const extractedContent = this.contentExtractor.extractSpellcheckableContent(fence.code, langConfig, {
      checkComments,
      checkStrings,
      checkIdentifiers: checkIdentifiers && langConfig.checkIdentifiers
    });

    // Check each extracted piece
    for (const content of extractedContent) {
      const spellIssues = await this.spellEngine.checkContent(
        content.text,
        fence.language,
        customWords
      );

      // Transform and position results
      for (const issue of spellIssues) {
        const transformedIssue = this.issueTransformer.transformCSpellIssue(
          issue,
          content,
          fence,
          severity
        );
        issues.push(transformedIssue);
      }
    }

    // Cache results
    this.cacheManager.set(cacheKey, issues);

    return issues;
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return this.cacheManager.getStats();
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cacheManager.clear();
  }

  /**
   * Get supported languages
   * @returns {Array} Array of supported language identifiers
   */
  getSupportedLanguages() {
    return this.languageConfig.getSupportedLanguages();
  }

  /**
   * Get language configuration
   * @param {string} language - Language identifier
   * @returns {Object|null} Language configuration
   */
  getLanguageConfig(language) {
    return this.languageConfig.getLanguageConfig(language);
  }

  /**
   * Add support for a new language
   * @param {string} language - Language identifier
   * @param {Object} config - Language configuration
   */
  addLanguageSupport(language, config) {
    this.languageConfig.supportedLanguages[language] = config;
    this.codeFenceParser.addLanguageSupport(language);
  }

  /**
   * Add custom words to spell engine
   * @param {Array} words - Array of words to add
   */
  addCustomWords(words) {
    this.spellEngine.addCustomWords(words);
  }

  /**
   * Add custom misspelling patterns
   * @param {Object} patterns - Object with misspelling -> [suggestions] mapping
   */
  addMisspellingPatterns(patterns) {
    this.spellEngine.addMisspellingPatterns(patterns);
  }

  /**
   * Get comprehensive statistics
   * @returns {Object} Statistics from all modules
   */
  getStatistics() {
    return {
      initialized: this.initialized,
      cspellLoaded: this.cspellLoaded,
      supportedLanguages: this.languageConfig.getLanguageCount(),
      cacheStats: this.cacheManager.getStats(),
      spellEngineStats: this.spellEngine.getStatistics(),
      memoryUsage: this.cacheManager.getMemoryUsage()
    };
  }

  /**
   * Get module health status
   * @returns {Object} Health status of all modules
   */
  getHealthStatus() {
    return {
      languageConfig: {
        loaded: true,
        supportedLanguages: this.languageConfig.getLanguageCount()
      },
      contentExtractor: {
        loaded: true
      },
      spellEngine: {
        loaded: true,
        engineType: this.spellEngine.getStatistics().engineType,
        dictionarySize: this.spellEngine.getStatistics().technicalDictionarySize
      },
      issueTransformer: {
        loaded: true
      },
      cacheManager: {
        loaded: true,
        cacheSize: this.cacheManager.getStats().size,
        hitRate: this.cacheManager.getStats().hitRate
      },
      codeFenceParser: {
        loaded: true
      }
    };
  }

  /**
   * Performance optimization: warm up cache with common patterns
   * @param {Array} commonTexts - Array of common code texts to pre-cache
   */
  async warmUpCache(commonTexts = []) {
    console.log('[CSpellCodeChecker] Warming up cache...');
    
    for (const text of commonTexts) {
      try {
        await this.checkCodeFences(text, { enableCodeSpellCheck: true });
      } catch (error) {
        console.warn('[CSpellCodeChecker] Cache warmup failed for text:', error.message);
      }
    }
    
    console.log(`[CSpellCodeChecker] Cache warmup complete. Size: ${this.cacheManager.getStats().size}`);
  }
}

module.exports = CSpellCodeChecker;