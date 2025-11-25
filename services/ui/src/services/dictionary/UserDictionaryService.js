/**
 * UserDictionaryService.js
 * Manages user-level custom dictionary words and localStorage
 */

export class UserDictionaryService {
  constructor() {
    this.CUSTOM_WORDS_KEY = 'customDictionary';
    this.customWords = new Set();
    this.loadCustomWordsFromStorage();
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
      window.dispatchEvent(new CustomEvent('dictionary:wordAdded', { detail: { word: normalizedWord } }));
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
    window.dispatchEvent(new CustomEvent('dictionary:wordRemoved', { detail: { word: normalizedWord } }));
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
    window.dispatchEvent(new CustomEvent('dictionary:updated', { detail: { words: Array.from(this.customWords) } }));
  }

  /**
   * Sync custom words with backend (add any new words from backend)
   * @param {string[]} backendWords - Words from backend
   */
  syncWithBackend(backendWords) {
    const currentWords = this.getCustomWords();
    const safeBackendWords = Array.isArray(backendWords) ? backendWords : [];
    const backendWordsSet = new Set(safeBackendWords.map(word => word.toLowerCase()));
    const mergedWords = new Set([...currentWords, ...backendWordsSet]);
    this.customWords = mergedWords;
    this.saveCustomWordsToStorage();
    window.dispatchEvent(new CustomEvent('dictionary:synced', { detail: { words: Array.from(this.customWords) } }));
    return Array.from(mergedWords);
  }

  /**
   * Clear user dictionary data
   */
  clear() {
    this.customWords.clear();
    localStorage.removeItem(this.CUSTOM_WORDS_KEY);
  }

  /**
   * Get word count
   * @returns {number} - Number of words
   */
  getWordCount() {
    return this.customWords.size;
  }
}
