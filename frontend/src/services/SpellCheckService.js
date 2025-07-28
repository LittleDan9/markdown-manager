import nspell from 'nspell';
import PerformanceOptimizer from './PerformanceOptimizer';

class SpellCheckService {
  constructor() {
    this.speller = null;
    this.customWords = new Set(); // Local custom words storage
    this.CUSTOM_WORDS_KEY = 'customDictionary';
    this.progressiveCheckState = {
      isRunning: false,
      currentChunk: 0,
      totalChunks: 0,
      results: [],
      onProgress: null,
      onComplete: null
    };
  }

  async init() {
    if (this.speller) return;
    try {
      const [affResponse, dicResponse] = await Promise.all([
        fetch('/dictionary/index.aff'),
        fetch('/dictionary/index.dic')
      ]);
      const aff = await affResponse.text();
      const dic = await dicResponse.text();
      this.speller = nspell(aff, dic);

      // Load custom words from localStorage
      this.loadCustomWordsFromStorage();
    } catch (err) {
      console.error('SpellCheckService init error', err);
    }
  }

  /**
   * Load custom words from localStorage
   */
  loadCustomWordsFromStorage() {
    try {
      const stored = localStorage.getItem(this.CUSTOM_WORDS_KEY);
      if (stored) {
        const words = JSON.parse(stored);
        this.customWords = new Set(words);
      }
    } catch (err) {
      console.error('Error loading custom words from storage:', err);
    }
  }

  /**
   * Save custom words to localStorage
   */
  saveCustomWordsToStorage() {
    try {
      const words = Array.from(this.customWords);
      localStorage.setItem(this.CUSTOM_WORDS_KEY, JSON.stringify(words));
    } catch (err) {
      console.error('Error saving custom words to storage:', err);
    }
  }

  /**
   * Add a word to the custom dictionary
   * @param {string} word - The word to add
   */
  addCustomWord(word) {
    const normalizedWord = word.toLowerCase().trim();
    if (normalizedWord) {
      this.customWords.add(normalizedWord);
      this.saveCustomWordsToStorage();
    }
  }

  /**
   * Remove a word from the custom dictionary
   * @param {string} word - The word to remove
   */
  removeCustomWord(word) {
    const normalizedWord = word.toLowerCase().trim();
    this.customWords.delete(normalizedWord);
    this.saveCustomWordsToStorage();
  }

  /**
   * Check if a word is in the custom dictionary
   * @param {string} word - The word to check
   * @returns {boolean}
   */
  isCustomWord(word) {
    return this.customWords.has(word.toLowerCase());
  }

  /**
   * Get all custom words
   * @returns {string[]}
   */
  getCustomWords() {
    return Array.from(this.customWords);
  }

  /**
   * Set custom words (used when loading from backend)
   * @param {string[]} words - Array of words to set
   */
  setCustomWords(words) {
    this.customWords = new Set(words.map(word => word.toLowerCase()));
    this.saveCustomWordsToStorage();
  }

  /**
   * Sync custom words with backend (add any new words from backend)
   * @param {string[]} backendWords - Words from backend
   */
  syncWithBackend(backendWords) {
    const currentWords = this.getCustomWords();

    // Handle undefined or null backendWords
    const safeBackendWords = Array.isArray(backendWords) ? backendWords : [];
    const backendWordsSet = new Set(safeBackendWords.map(word => word.toLowerCase()));

    // Merge backend words with local words
    const mergedWords = new Set([...currentWords, ...backendWordsSet]);
    this.customWords = mergedWords;
    this.saveCustomWordsToStorage();

    return Array.from(mergedWords);
  }

  /**
   * Parse Markdown and extract only text content (skip code blocks, inline code, etc.)
   */
  extractMarkdownTextContent(text) {
    let cleanText = text;

    // Remove fenced code blocks (```...```)
    cleanText = cleanText.replace(/```[\s\S]*?```/g, '');

    // Remove inline code (`...`)
    cleanText = cleanText.replace(/`[^`\n]*`/g, '');

    // Remove HTML tags
    cleanText = cleanText.replace(/<[^>]*>/g, '');

    // Remove URLs
    cleanText = cleanText.replace(/https?:\/\/[^\s]+/g, '');

    // Remove Markdown links [text](url)
    cleanText = cleanText.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

    // Remove image references ![alt](url)
    cleanText = cleanText.replace(/!\[[^\]]*\]\([^)]*\)/g, '');

    // Remove Markdown headers (keep the text)
    cleanText = cleanText.replace(/^#{1,6}\s+/gm, '');

    // Remove list markers
    cleanText = cleanText.replace(/^\s*[-*+]\s+/gm, '');
    cleanText = cleanText.replace(/^\s*\d+\.\s+/gm, '');

    // Remove blockquotes
    cleanText = cleanText.replace(/^\s*>\s+/gm, '');

    // Remove emphasis markers but keep text
    cleanText = cleanText.replace(/\*\*([^*]+)\*\*/g, '$1'); // bold
    cleanText = cleanText.replace(/\*([^*]+)\*/g, '$1'); // italic
    cleanText = cleanText.replace(/__([^_]+)__/g, '$1'); // bold
    cleanText = cleanText.replace(/_([^_]+)_/g, '$1'); // italic

    return cleanText;
  }

  check(text) {
    if (!this.speller) return [];

    // For large documents, recommend progressive checking
    if (PerformanceOptimizer.isLargeDocument(text)) {
      console.warn('Large document detected. Consider using checkProgressive() for better performance.');
    }

    // Extract only text content from Markdown
    const textContent = this.extractMarkdownTextContent(text);

    const results = [];
    const regex = /\b[A-Za-z']+\b/g;
    let match;
    const customWords = this.getCustomWords();

    while ((match = regex.exec(textContent)) !== null) {
      const word = match[0];
      // Check both the standard speller and custom dictionary
      if (!this.speller.correct(word) && !this.isCustomWord(word)) {
        // Use nspell's suggest, but include custom words as candidates for close matches only
        let suggestions = this.speller.suggest(word);
        // Add custom words that are close matches (edit distance <= 2)
        const closeCustomWords = customWords.filter(customWord => {
          if (customWord === word) return false;
          // Simple edit distance check
          return getEditDistance(word.toLowerCase(), customWord.toLowerCase()) <= 2;
        });
        suggestions = Array.from(new Set([...suggestions, ...closeCustomWords]));
        const offset = match.index;

        // Find the position in the original text
        const position = this.findWordPositionInOriginalText(word, offset, text, textContent);
        if (position) {
          results.push({
            word,
            suggestions,
            lineNumber: position.lineNumber,
            column: position.column,
            offset // <--- always include offset for region mapping
          });
        }
      }
    }
    return results;
/**
 * Calculate the edit distance between two strings (Levenshtein distance)
 */
function getEditDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix = [];
  // increment along the first column of each row
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  // increment each column in the first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}
  }

  /**
   * Find the actual position of a word in the original text
   * This is needed because we're spell checking cleaned text but need original positions
   */
  findWordPositionInOriginalText(word, cleanOffset, originalText, cleanText) {
    // This is a simplified approach - for better accuracy, we'd need to track
    // the mapping between clean and original text positions
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    const matches = [...originalText.matchAll(regex)];

    if (matches.length > 0) {
      // Use the first match for simplicity
      const match = matches[0];
      const offset = match.index;
      const upTo = originalText.slice(0, offset);
      const lines = upTo.split('\n');
      const lineNumber = lines.length;
      const column = lines[lines.length - 1].length + 1;

      return { lineNumber, column };
    }

    return null;
  }

  /**
   * Progressive spell check for large documents
   * Processes document in chunks to avoid blocking the UI
   */
  async checkProgressive(text, onProgress = null, onComplete = null) {
    if (!this.speller) return [];

    // Stop any existing progressive check
    this.stopProgressiveCheck();

    const strategy = PerformanceOptimizer.getSpellCheckStrategy(text);
    if (!strategy.enabled) {
      if (onComplete) onComplete([]);
      return [];
    }

    const chunks = PerformanceOptimizer.chunkDocument(text, strategy.chunkSize);

    this.progressiveCheckState = {
      isRunning: true,
      currentChunk: 0,
      totalChunks: chunks.length,
      results: [],
      onProgress,
      onComplete
    };

    // Process chunks with delays to avoid blocking UI
    const processNextChunk = () => {
      if (!this.progressiveCheckState.isRunning ||
          this.progressiveCheckState.currentChunk >= chunks.length) {
        this.progressiveCheckState.isRunning = false;
        if (onComplete) onComplete(this.progressiveCheckState.results);
        return;
      }

      const chunk = chunks[this.progressiveCheckState.currentChunk];
      const chunkResults = this.checkChunk(chunk.text, chunk.startOffset);
      this.progressiveCheckState.results.push(...chunkResults);

      if (onProgress) {
        onProgress({
          progress: (this.progressiveCheckState.currentChunk + 1) / chunks.length,
          currentChunk: this.progressiveCheckState.currentChunk + 1,
          totalChunks: chunks.length,
          newResults: chunkResults.length
        });
      }

      this.progressiveCheckState.currentChunk++;

      // Use requestIdleCallback if available, otherwise setTimeout
      if (window.requestIdleCallback) {
        requestIdleCallback(processNextChunk, { timeout: 100 });
      } else {
        setTimeout(processNextChunk, 50);
      }
    };

    // Start processing
    setTimeout(processNextChunk, strategy.delay || 500);
    return this.progressiveCheckState.results;
  }

  /**
   * Process a single chunk of text
   */
  checkChunk(text, startOffset = 0) {
    if (!this.speller) return [];

    const results = [];
    const regex = /\b[A-Za-z']+\b/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const word = match[0];
      if (!this.speller.correct(word) && !this.isCustomWord(word)) {
        const suggestions = this.speller.suggest(word);
        const offset = startOffset + match.index;

        // compute line and column based on total offset
        const upTo = text.slice(0, match.index);
        const lines = upTo.split('\n');
        const lineNumber = lines.length;
        const column = lines[lines.length - 1].length + 1;

        results.push({ word, suggestions, lineNumber, column, offset });
      }
    }
    return results;
  }

  /**
   * Stop progressive spell checking
   */
  stopProgressiveCheck() {
    this.progressiveCheckState.isRunning = false;
  }

  /**
   * Check if progressive spell check is running
   */
  isProgressiveCheckRunning() {
    return this.progressiveCheckState.isRunning;
  }
}

export default new SpellCheckService();
