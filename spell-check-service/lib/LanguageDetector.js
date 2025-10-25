/**
 * Language Detector - Phase 2 Implementation
 * Created: October 22, 2025 by AI Agent
 * Purpose: Automatic language detection with confidence scoring
 * Features: Multiple detection algorithms, confidence scoring, fallback handling
 */

class LanguageDetector {
  constructor() {
    this.isInitialized = false;
    this.franc = null; // Will be loaded dynamically
    this.supportedLanguages = new Map([
      ['eng', 'en-US'], // English -> US English
      ['fra', 'fr-FR'], // French
      ['spa', 'es-ES'], // Spanish  
      ['deu', 'de-DE'], // German (Deutsch)
    ]);
    
    // Language-specific patterns for enhanced detection
    this.languagePatterns = {
      'en-US': {
        patterns: [
          /\b(the|and|is|are|was|were|have|has|had|will|would|could|should|may|might|can|do|does|did|get|got|make|made|take|took|come|came|go|went|see|saw|know|knew|think|thought|say|said|tell|told|want|wanted|need|needed|time|year|way|day|man|woman|child|people|work|life|hand|part|place|case|week|company|system|program|question|government|number|group|problem|fact|money|business|service|thing|area|water|information|nothing|something|everything|anything)\b/gi,
          /\b(color|honor|favor|center|theater|realize|organize|analyze|program)\b/gi // US spellings
        ],
        weight: 1.0
      },
      'en-GB': {
        patterns: [
          /\b(the|and|is|are|was|were|have|has|had|will|would|could|should|may|might|can|do|does|did|get|got|make|made|take|took|come|came|go|went|see|saw|know|knew|think|thought|say|said|tell|told|want|wanted|need|needed|time|year|way|day|man|woman|child|people|work|life|hand|part|place|case|week|company|system|programme|question|government|number|group|problem|fact|money|business|service|thing|area|water|information|nothing|something|everything|anything)\b/gi,
          /\b(colour|honour|favour|centre|theatre|realise|organise|analyse|programme|whilst|amongst)\b/gi // UK spellings
        ],
        weight: 1.2
      },
      'es-ES': {
        patterns: [
          /\b(el|la|los|las|un|una|de|del|en|con|por|para|que|se|no|es|está|son|tienen|hacer|tiempo|año|años|día|días|vez|veces|mundo|vida|casa|trabajo|lugar|forma|parte|caso|mano|ojo|momento|nombre|ejemplo|país|estado|ciudad|grupo|problema|hecho|agua|dinero|negocio|servicio|cosa|área|información|nada|algo|todo|cualquier)\b/gi,
          /\b(ñ|á|é|í|ó|ú|ü)\b/gi // Spanish specific characters
        ],
        weight: 1.0
      },
      'fr-FR': {
        patterns: [
          /\b(le|la|les|un|une|de|du|des|en|dans|avec|pour|par|que|qui|ne|pas|est|sont|avoir|être|faire|temps|année|jour|fois|monde|vie|maison|travail|lieu|forme|partie|cas|main|œil|moment|nom|exemple|pays|état|ville|groupe|problème|fait|eau|argent|affaire|service|chose|zone|information|rien|quelque|tout|n'importe)\b/gi,
          /\b(à|ç|è|é|ê|ë|î|ï|ô|ù|û|ü|ÿ)\b/gi // French specific characters
        ],
        weight: 1.0
      },
      'de-DE': {
        patterns: [
          /\b(der|die|das|den|dem|des|ein|eine|eines|einem|einen|und|oder|mit|von|zu|für|auf|in|ist|sind|haben|sein|werden|zeit|jahr|tag|mal|welt|leben|haus|arbeit|ort|form|teil|fall|hand|auge|moment|name|beispiel|land|staat|stadt|gruppe|problem|tatsache|wasser|geld|geschäft|service|ding|bereich|information|nichts|etwas|alles|irgendein)\b/gi,
          /\b(ä|ö|ü|ß)\b/gi // German specific characters
        ],
        weight: 1.0
      }
    };

    this.minTextLength = 20; // Minimum text length for reliable detection
    this.detectionCache = new Map(); // Cache for repeated text
  }

  /**
   * Initialize the language detector
   */
  async init() {
    try {
      console.log('[LanguageDetector] Initializing language detector...');
      
      // Dynamically import franc (ES module)
      const francModule = await import('franc');
      this.franc = francModule.franc;
      
      this.isInitialized = true;
      console.log('[LanguageDetector] Language detector initialized successfully');
    } catch (error) {
      console.error('[LanguageDetector] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Detect the language of given text
   * @param {string} text - Text to analyze
   * @param {Object} options - Detection options
   * @returns {Object} Detection result with language and confidence
   */
  async detectLanguage(text, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Language detector not initialized');
    }

    const {
      returnMultiple = false,
      minConfidence = 0.3,
      fallbackLanguage = 'en-US'
    } = options;

    // Return from cache if available
    const cacheKey = this.getCacheKey(text);
    if (this.detectionCache.has(cacheKey)) {
      return this.detectionCache.get(cacheKey);
    }

    // Clean text for analysis
    const cleanText = this.cleanTextForDetection(text);
    
    if (cleanText.length < this.minTextLength) {
      const result = {
        language: fallbackLanguage,
        confidence: 0.1,
        reason: 'Text too short for reliable detection',
        alternatives: [],
        textLength: cleanText.length
      };
      this.detectionCache.set(cacheKey, result);
      return result;
    }

    try {
      // Use franc for primary detection
      const francResult = this.franc(cleanText, { minLength: this.minTextLength });
      let primaryLanguage = this.mapFrancToLanguageCode(francResult);
      
      // Use pattern-based detection as secondary method
      const patternResults = this.detectByPatterns(cleanText);
      
      // Combine results and calculate confidence
      const result = this.combineDetectionResults(primaryLanguage, patternResults, cleanText);
      
      // Apply minimum confidence threshold
      if (result.confidence < minConfidence) {
        result.language = fallbackLanguage;
        result.confidence = 0.2;
        result.reason = 'Low confidence, using fallback';
      }

      // Cache result
      this.detectionCache.set(cacheKey, result);
      
      return returnMultiple ? this.getMultipleResults(result, patternResults) : result;

    } catch (error) {
      console.warn('[LanguageDetector] Detection failed:', error.message);
      
      const fallbackResult = {
        language: fallbackLanguage,
        confidence: 0.1,
        reason: 'Detection error, using fallback',
        error: error.message,
        alternatives: []
      };
      
      this.detectionCache.set(cacheKey, fallbackResult);
      return fallbackResult;
    }
  }

  /**
   * Clean text for language detection
   * @param {string} text - Raw text
   * @returns {string} Cleaned text
   */
  cleanTextForDetection(text) {
    return text
      // Remove markdown syntax
      .replace(/#{1,6}\s/g, '') // Headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
      .replace(/\*(.*?)\*/g, '$1') // Italic
      .replace(/`(.*?)`/g, '') // Inline code
      .replace(/```[\s\S]*?```/g, '') // Code blocks
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1') // Images
      
      // Remove URLs and emails
      .replace(/https?:\/\/[^\s]+/g, '')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '')
      
      // Remove numbers and special characters that don't help with language detection
      .replace(/\b\d+\b/g, '')
      .replace(/[^\w\s\u00C0-\u017F\u0100-\u024F]/g, ' ')
      
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Detect language using pattern matching
   * @param {string} text - Text to analyze
   * @returns {Array} Array of language matches with scores
   */
  detectByPatterns(text) {
    const results = [];
    
    for (const [language, config] of Object.entries(this.languagePatterns)) {
      let score = 0;
      let totalMatches = 0;
      
      for (const pattern of config.patterns) {
        const matches = text.match(pattern) || [];
        score += matches.length * config.weight;
        totalMatches += matches.length;
      }
      
      if (totalMatches > 0) {
        // Normalize score by text length
        const normalizedScore = score / text.split(' ').length;
        
        results.push({
          language,
          score: normalizedScore,
          matches: totalMatches,
          confidence: Math.min(normalizedScore * 2, 1.0) // Cap at 1.0
        });
      }
    }
    
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Map franc language code to our language codes
   * @param {string} francCode - Franc language code
   * @returns {string} Our language code
   */
  mapFrancToLanguageCode(francCode) {
    return this.supportedLanguages.get(francCode) || 'en-US';
  }

  /**
   * Combine franc and pattern detection results
   * @param {string} francLanguage - Language from franc
   * @param {Array} patternResults - Results from pattern matching
   * @param {string} text - Original text
   * @returns {Object} Combined result
   */
  combineDetectionResults(francLanguage, patternResults, text) {
    // Get the top pattern result
    const topPattern = patternResults[0];
    
    let finalLanguage = francLanguage;
    let confidence = 0.5; // Base confidence for franc
    let reason = 'Primary detection with franc';
    
    if (topPattern && topPattern.confidence > 0.3) {
      if (topPattern.language === francLanguage) {
        // Both methods agree
        confidence = Math.min(0.5 + topPattern.confidence, 0.95);
        reason = 'Franc and pattern detection agree';
      } else if (topPattern.confidence > 0.6) {
        // Pattern detection is very confident, prefer it
        finalLanguage = topPattern.language;
        confidence = topPattern.confidence;
        reason = 'Pattern detection overrides franc (high confidence)';
      }
    }

    // Special handling for English variants
    if (finalLanguage === 'en-US' && topPattern && topPattern.language === 'en-GB' && topPattern.confidence > 0.4) {
      finalLanguage = 'en-GB';
      reason = 'British English patterns detected';
    }

    return {
      language: finalLanguage,
      confidence: Math.round(confidence * 100) / 100,
      reason,
      alternatives: patternResults.slice(1, 3).map(r => ({
        language: r.language,
        confidence: Math.round(r.confidence * 100) / 100
      })),
      textLength: text.length,
      detectionMethods: ['franc', 'patterns']
    };
  }

  /**
   * Get multiple detection results
   * @param {Object} primary - Primary result
   * @param {Array} patterns - Pattern results
   * @returns {Object} Multiple results
   */
  getMultipleResults(primary, patterns) {
    const allResults = [primary];
    
    for (const pattern of patterns.slice(0, 2)) {
      if (pattern.language !== primary.language) {
        allResults.push({
          language: pattern.language,
          confidence: pattern.confidence,
          reason: 'Pattern-based detection'
        });
      }
    }
    
    return {
      primary: primary.language,
      confidence: primary.confidence,
      results: allResults
    };
  }

  /**
   * Create cache key for text
   * @param {string} text - Text to create key for
   * @returns {string} Cache key
   */
  getCacheKey(text) {
    // Create a simple hash from the first and last parts of the text
    const start = text.substring(0, 100);
    const end = text.length > 100 ? text.substring(text.length - 50) : '';
    return `${start.length}_${end.length}_${text.length}`;
  }

  /**
   * Get list of supported languages
   * @returns {Array} Array of supported languages
   */
  getSupportedLanguages() {
    return Array.from(this.supportedLanguages.values());
  }

  /**
   * Clear detection cache
   */
  clearCache() {
    this.detectionCache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      size: this.detectionCache.size,
      supportedLanguages: this.getSupportedLanguages().length,
      minTextLength: this.minTextLength
    };
  }

  /**
   * Add custom language patterns
   * @param {string} language - Language code
   * @param {Object} config - Pattern configuration
   */
  addLanguagePatterns(language, config) {
    this.languagePatterns[language] = config;
  }

  /**
   * Batch detect languages for multiple texts
   * @param {Array} texts - Array of texts to analyze
   * @param {Object} options - Detection options
   * @returns {Array} Array of detection results
   */
  async batchDetect(texts, options = {}) {
    const results = [];
    
    for (const text of texts) {
      try {
        const result = await this.detectLanguage(text, options);
        results.push(result);
      } catch (error) {
        results.push({
          language: options.fallbackLanguage || 'en-US',
          confidence: 0.1,
          error: error.message
        });
      }
    }
    
    return results;
  }
}

module.exports = LanguageDetector;