/**
 * Contextual Analyzer - Phase 3 Implementation
 * Created: October 22, 2025 by AI Agent  
 * Purpose: AI-enhanced word suggestions using context analysis
 * Features: Context-aware suggestions, 30% accuracy improvement target
 * Dependencies: compromise.js for NLP, custom context analysis
 */

const compromise = require('compromise');

class ContextualAnalyzer {
  constructor() {
    this.contextWindow = 50; // Words to analyze around target word
    this.suggestionCache = new Map(); // Cache contextual suggestions
    this.cacheSize = 1000; // Maximum cache entries
    this.isInitialized = false;
  }

  /**
   * Initialize contextual analyzer
   */
  async init() {
    try {
      console.log('[ContextualAnalyzer] Initializing contextual analyzer...');
      
      // Test compromise functionality
      const testDoc = compromise('This is a test sentence for NLP analysis.');
      if (!testDoc || typeof testDoc.match !== 'function') {
        throw new Error('Compromise.js not functioning correctly');
      }
      
      this.isInitialized = true;
      console.log('[ContextualAnalyzer] Contextual analyzer initialized');
      
    } catch (error) {
      console.error('[ContextualAnalyzer] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Get contextual suggestions for a misspelled word
   * @param {string} word - The misspelled word
   * @param {string} context - The full text context
   * @param {number} position - Position of word in context
   * @param {string[]} basicSuggestions - Basic spelling suggestions
   * @param {Object} options - Analysis options
   * @returns {Object} Enhanced suggestions with context analysis
   */
  async getContextualSuggestions(word, context, position, basicSuggestions = [], options = {}) {
    if (!this.isInitialized) {
      throw new Error('Contextual analyzer not initialized');
    }

    try {
      // Create cache key
      const cacheKey = this._createCacheKey(word, context, position);
      
      // Check cache first
      if (this.suggestionCache.has(cacheKey)) {
        return this.suggestionCache.get(cacheKey);
      }

      // Extract context around the word
      const contextInfo = this._extractContext(context, position, word);
      
      // Analyze context using compromise.js
      const contextAnalysis = await this._analyzeContext(contextInfo);
      
      // Enhance basic suggestions with context
      const enhancedSuggestions = await this._enhanceSuggestions(
        word,
        basicSuggestions,
        contextAnalysis,
        options
      );

      // Cache the result
      this._cacheResult(cacheKey, enhancedSuggestions);

      return enhancedSuggestions;

    } catch (error) {
      console.error('[ContextualAnalyzer] Error in contextual analysis:', error);
      // Fallback to basic suggestions with confidence scoring
      return {
        suggestions: basicSuggestions.slice(0, 5).map(suggestion => ({
          word: suggestion,
          confidence: 0.7, // Lower confidence for non-contextual
          reason: 'spelling',
          contextMatch: false
        })),
        contextAnalysis: {
          partOfSpeech: 'unknown',
          semanticContext: 'unknown',
          confidence: 0.5
        }
      };
    }
  }

  /**
   * Extract context around the target word
   * @param {string} text - Full text
   * @param {number} position - Word position
   * @param {string} word - Target word
   * @returns {Object} Context information
   * @private
   */
  _extractContext(text, position, word) {
    // Find word boundaries around position
    const words = text.split(/\s+/);
    let wordIndex = -1;
    let charCount = 0;

    // Find which word index corresponds to the position
    for (let i = 0; i < words.length; i++) {
      const wordStart = charCount;
      const wordEnd = charCount + words[i].length;
      
      if (position >= wordStart && position <= wordEnd) {
        wordIndex = i;
        break;
      }
      
      charCount += words[i].length + 1; // +1 for space
    }

    if (wordIndex === -1) {
      // Fallback: create context around position
      const start = Math.max(0, position - this.contextWindow * 5);
      const end = Math.min(text.length, position + this.contextWindow * 5);
      return {
        before: text.substring(start, position).trim(),
        word: word,
        after: text.substring(position + word.length, end).trim(),
        fullContext: text.substring(start, end),
        wordIndex: -1
      };
    }

    // Extract context window around the word
    const contextStart = Math.max(0, wordIndex - this.contextWindow);
    const contextEnd = Math.min(words.length, wordIndex + this.contextWindow);
    
    const beforeWords = words.slice(contextStart, wordIndex);
    const afterWords = words.slice(wordIndex + 1, contextEnd);
    
    return {
      before: beforeWords.join(' '),
      word: word,
      after: afterWords.join(' '),
      fullContext: words.slice(contextStart, contextEnd).join(' '),
      wordIndex: wordIndex,
      sentence: this._extractSentence(text, position)
    };
  }

  /**
   * Extract the sentence containing the word
   * @param {string} text - Full text
   * @param {number} position - Word position
   * @returns {string} Sentence containing the word
   * @private
   */
  _extractSentence(text, position) {
    // Find sentence boundaries
    const sentencePattern = /[.!?]+\s+/g;
    let sentenceStart = 0;
    let sentenceEnd = text.length;
    
    // Find sentence start (look backwards)
    const beforePosition = text.substring(0, position);
    const lastSentenceEnd = beforePosition.lastIndexOf('.');
    if (lastSentenceEnd > 0) {
      sentenceStart = lastSentenceEnd + 1;
    }
    
    // Find sentence end (look forwards)
    const afterPosition = text.substring(position);
    const nextSentenceEnd = afterPosition.search(/[.!?]/);
    if (nextSentenceEnd > 0) {
      sentenceEnd = position + nextSentenceEnd + 1;
    }
    
    return text.substring(sentenceStart, sentenceEnd).trim();
  }

  /**
   * Analyze context using compromise.js NLP
   * @param {Object} contextInfo - Context information
   * @returns {Object} Context analysis
   * @private
   */
  async _analyzeContext(contextInfo) {
    try {
      const doc = compromise(contextInfo.fullContext);
      
      // Analyze part of speech patterns
      const nouns = doc.nouns().out('array');
      const verbs = doc.verbs().out('array');
      const adjectives = doc.adjectives().out('array');
      const adverbs = doc.adverbs().out('array');
      
      // Analyze semantic context
      const topics = this._extractTopics(doc);
      const sentiment = this._analyzeSentiment(doc);
      
      // Determine expected part of speech for missing word
      const expectedPos = this._inferPartOfSpeech(contextInfo, doc);
      
      return {
        partOfSpeech: expectedPos,
        semanticContext: topics,
        sentiment: sentiment,
        contextWords: {
          nouns: nouns.slice(0, 5),
          verbs: verbs.slice(0, 5),
          adjectives: adjectives.slice(0, 3),
          adverbs: adverbs.slice(0, 3)
        },
        confidence: this._calculateContextConfidence(contextInfo, doc)
      };
      
    } catch (error) {
      console.error('[ContextualAnalyzer] Error analyzing context:', error);
      return {
        partOfSpeech: 'unknown',
        semanticContext: ['general'],
        sentiment: 'neutral',
        contextWords: { nouns: [], verbs: [], adjectives: [], adverbs: [] },
        confidence: 0.3
      };
    }
  }

  /**
   * Extract topic/domain information from context
   * @param {Object} doc - Compromise document
   * @returns {string[]} Topic tags
   * @private
   */
  _extractTopics(doc) {
    const topics = [];
    
    // Look for technical terms
    const technicalTerms = doc.match('#Technology').out('array');
    if (technicalTerms.length > 0) topics.push('technical');
    
    // Look for business terms
    const businessTerms = doc.match('#Business').out('array');
    if (businessTerms.length > 0) topics.push('business');
    
    // Look for academic terms
    const academicPatterns = ['research', 'study', 'analysis', 'methodology', 'hypothesis'];
    const text = doc.out('text').toLowerCase();
    if (academicPatterns.some(term => text.includes(term))) {
      topics.push('academic');
    }
    
    // Look for medical terms
    const medicalPatterns = ['patient', 'treatment', 'diagnosis', 'symptoms', 'therapy'];
    if (medicalPatterns.some(term => text.includes(term))) {
      topics.push('medical');
    }
    
    // Default to general if no specific domain detected
    if (topics.length === 0) {
      topics.push('general');
    }
    
    return topics;
  }

  /**
   * Analyze sentiment of context
   * @param {Object} doc - Compromise document
   * @returns {string} Sentiment
   * @private
   */
  _analyzeSentiment(doc) {
    // Simple sentiment analysis based on word patterns
    const text = doc.out('text').toLowerCase();
    
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'poor', 'disappointing'];
    
    const positiveCount = positiveWords.reduce((count, word) => 
      count + (text.split(word).length - 1), 0);
    const negativeCount = negativeWords.reduce((count, word) => 
      count + (text.split(word).length - 1), 0);
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  /**
   * Infer expected part of speech from context
   * @param {Object} contextInfo - Context information
   * @param {Object} doc - Compromise document
   * @returns {string} Expected part of speech
   * @private
   */
  _inferPartOfSpeech(contextInfo, doc) {
    const beforeText = contextInfo.before.toLowerCase();
    const afterText = contextInfo.after.toLowerCase();
    
    // Check for determiners before (suggests noun)
    if (/\b(the|a|an|this|that|these|those)\s*$/.test(beforeText)) {
      return 'noun';
    }
    
    // Check for prepositions before (suggests noun)
    if (/\b(in|on|at|by|for|with|to|of|from)\s*$/.test(beforeText)) {
      return 'noun';
    }
    
    // Check for auxiliary verbs before (suggests verb)
    if (/\b(will|would|can|could|should|must|may|might|is|are|was|were)\s*$/.test(beforeText)) {
      return 'verb';
    }
    
    // Check for adverb patterns (very, quite, etc.)
    if (/\b(very|quite|rather|extremely|incredibly)\s*$/.test(beforeText)) {
      return 'adjective';
    }
    
    // Check for verb patterns before (suggests adverb)
    const beforeDoc = compromise(beforeText);
    const lastVerb = beforeDoc.verbs().last().out('text');
    if (lastVerb && beforeText.endsWith(lastVerb)) {
      return 'adverb';
    }
    
    return 'unknown';
  }

  /**
   * Calculate confidence in context analysis
   * @param {Object} contextInfo - Context information
   * @param {Object} doc - Compromise document
   * @returns {number} Confidence score (0-1)
   * @private
   */
  _calculateContextConfidence(contextInfo, doc) {
    let confidence = 0.5; // Base confidence
    
    // More context = higher confidence
    const wordCount = contextInfo.fullContext.split(/\s+/).length;
    if (wordCount > 20) confidence += 0.2;
    if (wordCount > 50) confidence += 0.1;
    
    // Clear sentence structure = higher confidence
    if (contextInfo.sentence && contextInfo.sentence.length > 10) {
      confidence += 0.1;
    }
    
    // Rich part-of-speech context = higher confidence
    const posCount = doc.nouns().length + doc.verbs().length + doc.adjectives().length;
    if (posCount > 5) confidence += 0.1;
    
    return Math.min(1.0, confidence);
  }

  /**
   * Enhance basic suggestions with contextual analysis
   * @param {string} word - Original word
   * @param {string[]} basicSuggestions - Basic spelling suggestions
   * @param {Object} contextAnalysis - Context analysis
   * @param {Object} options - Enhancement options
   * @returns {Object} Enhanced suggestions
   * @private
   */
  async _enhanceSuggestions(word, basicSuggestions, contextAnalysis, options) {
    const enhancedSuggestions = [];
    const maxSuggestions = options.maxSuggestions || 5;
    
    // Score and enhance each basic suggestion
    for (const suggestion of basicSuggestions.slice(0, 10)) {
      try {
        const enhancement = await this._analyzeSuggestion(suggestion, contextAnalysis, word);
        enhancedSuggestions.push({
          word: suggestion,
          confidence: enhancement.confidence,
          reason: enhancement.reason,
          contextMatch: enhancement.contextMatch,
          partOfSpeech: enhancement.partOfSpeech
        });
      } catch (error) {
        // Fallback for suggestions that can't be analyzed
        enhancedSuggestions.push({
          word: suggestion,
          confidence: 0.7,
          reason: 'spelling',
          contextMatch: false,
          partOfSpeech: 'unknown'
        });
      }
    }
    
    // Sort by confidence and context match
    enhancedSuggestions.sort((a, b) => {
      if (a.contextMatch && !b.contextMatch) return -1;
      if (!a.contextMatch && b.contextMatch) return 1;
      return b.confidence - a.confidence;
    });
    
    return {
      suggestions: enhancedSuggestions.slice(0, maxSuggestions),
      contextAnalysis: {
        partOfSpeech: contextAnalysis.partOfSpeech,
        semanticContext: contextAnalysis.semanticContext,
        confidence: contextAnalysis.confidence
      }
    };
  }

  /**
   * Analyze a suggestion for contextual fit
   * @param {string} suggestion - Suggested word
   * @param {Object} contextAnalysis - Context analysis
   * @param {string} originalWord - Original misspelled word
   * @returns {Object} Enhancement analysis
   * @private
   */
  async _analyzeSuggestion(suggestion, contextAnalysis, originalWord) {
    try {
      // Analyze the suggestion's part of speech
      const suggestionDoc = compromise(suggestion);
      const suggestionPos = this._getPrimaryPartOfSpeech(suggestionDoc);
      
      // Check if part of speech matches context expectation
      const posMatch = suggestionPos === contextAnalysis.partOfSpeech || 
                      contextAnalysis.partOfSpeech === 'unknown';
      
      // Calculate edit distance for spelling confidence
      const editDistance = this._calculateEditDistance(originalWord, suggestion);
      const maxLength = Math.max(originalWord.length, suggestion.length);
      const spellingConfidence = 1 - (editDistance / maxLength);
      
      // Base confidence from spelling
      let confidence = spellingConfidence * 0.7;
      
      // Boost confidence for part-of-speech match
      if (posMatch) {
        confidence += 0.2;
      }
      
      // Boost confidence for semantic context match
      if (this._checkSemanticMatch(suggestion, contextAnalysis.semanticContext)) {
        confidence += 0.1;
      }
      
      // Determine reason
      let reason = 'spelling';
      if (posMatch && confidence > 0.8) {
        reason = 'contextual-spelling';
      }
      
      return {
        confidence: Math.min(1.0, confidence),
        reason: reason,
        contextMatch: posMatch,
        partOfSpeech: suggestionPos
      };
      
    } catch (error) {
      return {
        confidence: 0.6,
        reason: 'spelling',
        contextMatch: false,
        partOfSpeech: 'unknown'
      };
    }
  }

  /**
   * Get primary part of speech for a word
   * @param {Object} doc - Compromise document
   * @returns {string} Part of speech
   * @private
   */
  _getPrimaryPartOfSpeech(doc) {
    if (doc.nouns().length > 0) return 'noun';
    if (doc.verbs().length > 0) return 'verb';
    if (doc.adjectives().length > 0) return 'adjective';
    if (doc.adverbs().length > 0) return 'adverb';
    return 'unknown';
  }

  /**
   * Check if suggestion matches semantic context
   * @param {string} suggestion - Suggested word
   * @param {string[]} semanticContext - Context topics
   * @returns {boolean} True if matches
   * @private
   */
  _checkSemanticMatch(suggestion, semanticContext) {
    // Simple semantic matching - could be enhanced with word embeddings
    const word = suggestion.toLowerCase();
    
    for (const context of semanticContext) {
      switch (context) {
        case 'technical':
          if (/^(system|data|process|method|algorithm|function|code|software|hardware|network)/.test(word)) {
            return true;
          }
          break;
        case 'business':
          if (/^(market|customer|revenue|profit|strategy|management|business|sales|marketing)/.test(word)) {
            return true;
          }
          break;
        case 'academic':
          if (/^(research|study|analysis|theory|hypothesis|methodology|conclusion|evidence)/.test(word)) {
            return true;
          }
          break;
        case 'medical':
          if (/^(patient|treatment|diagnosis|symptom|therapy|medicine|clinical|health)/.test(word)) {
            return true;
          }
          break;
      }
    }
    
    return false;
  }

  /**
   * Calculate edit distance between two words
   * @param {string} word1 - First word
   * @param {string} word2 - Second word
   * @returns {number} Edit distance
   * @private
   */
  _calculateEditDistance(word1, word2) {
    const matrix = [];
    const n = word1.length;
    const m = word2.length;

    // Initialize matrix
    for (let i = 0; i <= n; i++) {
      matrix[i] = [];
      matrix[i][0] = i;
    }
    for (let j = 0; j <= m; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        if (word1[i - 1] === word2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,     // deletion
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j - 1] + 1  // substitution
          );
        }
      }
    }

    return matrix[n][m];
  }

  /**
   * Create cache key for contextual analysis
   * @param {string} word - Word
   * @param {string} context - Context
   * @param {number} position - Position
   * @returns {string} Cache key
   * @private
   */
  _createCacheKey(word, context, position) {
    // Create a hash of the context around the word
    const contextStart = Math.max(0, position - 100);
    const contextEnd = Math.min(context.length, position + 100);
    const localContext = context.substring(contextStart, contextEnd);
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < localContext.length; i++) {
      const char = localContext.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `${word}:${hash}`;
  }

  /**
   * Cache analysis result
   * @param {string} cacheKey - Cache key
   * @param {Object} result - Analysis result
   * @private
   */
  _cacheResult(cacheKey, result) {
    // Implement LRU cache
    if (this.suggestionCache.size >= this.cacheSize) {
      const firstKey = this.suggestionCache.keys().next().value;
      this.suggestionCache.delete(firstKey);
    }
    
    this.suggestionCache.set(cacheKey, result);
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      cacheSize: this.suggestionCache.size,
      maxCacheSize: this.cacheSize,
      hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0
    };
  }

  /**
   * Clear suggestion cache
   */
  clearCache() {
    this.suggestionCache.clear();
  }
}

module.exports = ContextualAnalyzer;