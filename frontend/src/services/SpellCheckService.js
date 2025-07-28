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
  /**
   * Extracts text content from Markdown and builds a mapping from cleaned text offsets to original text offsets.
   * @param {string} text
   * @returns {{ cleanText: string, offsetMap: number[] }}
   */
  extractMarkdownTextContentWithMap(text) {
    let cleanText = '';
    const offsetMap = [];
    let i = 0;
    const len = text.length;
    while (i < len) {
      // Fenced code block
      if (text.startsWith('```', i)) {
        const end = text.indexOf('```', i + 3);
        i = end !== -1 ? end + 3 : len;
        continue;
      }
      // Inline code
      if (text[i] === '`') {
        const end = text.indexOf('`', i + 1);
        i = end !== -1 ? end + 1 : len;
        continue;
      }
      // HTML tag
      if (text[i] === '<') {
        const end = text.indexOf('>', i + 1);
        i = end !== -1 ? end + 1 : len;
        continue;
      }
      // URL
      if (/https?:\/\//.test(text.slice(i, i + 8))) {
        const match = text.slice(i).match(/^https?:\/\/[\S]+/);
        if (match) {
          i += match[0].length;
          continue;
        }
      }
      // Markdown link [text](url)
      if (text[i] === '[') {
        const closeBracket = text.indexOf(']', i);
        const openParen = text.indexOf('(', closeBracket);
        const closeParen = text.indexOf(')', openParen);
        if (closeBracket !== -1 && openParen === closeBracket + 1 && closeParen !== -1) {
          // Keep the link text only
          for (let j = i + 1; j < closeBracket; j++) {
            cleanText += text[j];
            offsetMap.push(j);
          }
          i = closeParen + 1;
          continue;
        }
      }
      // Image ![alt](url)
      if (text.startsWith('![', i)) {
        const closeBracket = text.indexOf(']', i + 2);
        const openParen = text.indexOf('(', closeBracket);
        const closeParen = text.indexOf(')', openParen);
        if (closeBracket !== -1 && openParen === closeBracket + 1 && closeParen !== -1) {
          i = closeParen + 1;
          continue;
        }
      }
      // Markdown header
      if (text[i] === '#' && (i === 0 || text[i - 1] === '\n')) {
        let j = i;
        while (text[j] === '#') j++;
        if (text[j] === ' ') {
          i = j + 1;
          continue;
        }
      }
      // List marker
      if ((/^\s*[-*+]\s/.test(text.slice(i, i + 4)) || /^\s*\d+\.\s/.test(text.slice(i, i + 6))) && (i === 0 || text[i - 1] === '\n')) {
        // Skip marker
        let j = i;
        while (text[j] && !/\S/.test(text[j])) j++;
        if (['-', '*', '+'].includes(text[j])) {
          j++;
          if (text[j] === ' ') j++;
          i = j;
          continue;
        }
        // Numbered list
        let numMatch = text.slice(j).match(/^(\d+)\. /);
        if (numMatch) {
          i = j + numMatch[0].length;
          continue;
        }
      }
      // Blockquote
      if (text[i] === '>' && (i === 0 || text[i - 1] === '\n')) {
        let j = i + 1;
        if (text[j] === ' ') j++;
        i = j;
        continue;
      }
      // Emphasis markers
      if ((text[i] === '*' || text[i] === '_') && text[i + 1] === text[i]) {
        // bold
        let j = i + 2;
        while (j < len && !(text[j] === text[i] && text[j + 1] === text[i])) j++;
        if (j < len) {
          for (let k = i + 2; k < j; k++) {
            cleanText += text[k];
            offsetMap.push(k);
          }
          i = j + 2;
          continue;
        }
      }
      if (text[i] === '*' || text[i] === '_') {
        // italic
        let j = i + 1;
        while (j < len && text[j] !== text[i]) j++;
        if (j < len) {
          for (let k = i + 1; k < j; k++) {
            cleanText += text[k];
            offsetMap.push(k);
          }
          i = j + 1;
          continue;
        }
      }
      // Default: keep character
      cleanText += text[i];
      offsetMap.push(i);
      i++;
    }
    return { cleanText, offsetMap };
  }

  check(text) {
    if (!this.speller) return [];

    // For large documents, recommend progressive checking
    if (PerformanceOptimizer.isLargeDocument(text)) {
      console.warn('Large document detected. Consider using checkProgressive() for better performance.');
    }

    // Extract only text content from Markdown and build offset map
    const { cleanText, offsetMap } = this.extractMarkdownTextContentWithMap(text);

    const results = [];
    const regex = /\b[A-Za-z']+\b/g;
    let match;
    const customWords = this.getCustomWords();

    while ((match = regex.exec(cleanText)) !== null) {
      const word = match[0];
      if (!this.speller.correct(word) && !this.isCustomWord(word)) {
        let suggestions = this.speller.suggest(word);
        const closeCustomWords = customWords.filter(customWord => {
          if (customWord === word) return false;
          return getEditDistance(word.toLowerCase(), customWord.toLowerCase()) <= 2;
        });
        suggestions = Array.from(new Set([...suggestions, ...closeCustomWords]));
        const cleanOffset = match.index;
        // Map cleanText offset to original text offset
        const origOffset = offsetMap[cleanOffset] !== undefined ? offsetMap[cleanOffset] : null;
        if (origOffset !== null) {
          // Compute line/column in original text
          const upTo = text.slice(0, origOffset);
          const lines = upTo.split('\n');
          const lineNumber = lines.length;
          const column = lines[lines.length - 1].length + 1;
          results.push({
            word,
            suggestions,
            lineNumber,
            column,
            offset: origOffset
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
  // findWordPositionInOriginalText is no longer needed with offsetMap
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
