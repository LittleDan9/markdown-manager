import nspell from 'nspell';

class SpellCheckService {
  constructor() {
    this.speller = null;
    this.customWords = new Set(); // Local custom words storage
    this.CUSTOM_WORDS_KEY = 'customDictionary';
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

  check(text) {
    if (!this.speller) return [];
    const results = [];
    const regex = /\b[A-Za-z']+\b/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const word = match[0];
      // Check both the standard speller and custom dictionary
      if (!this.speller.correct(word) && !this.isCustomWord(word)) {
        const suggestions = this.speller.suggest(word);
        const offset = match.index;
        // compute line and column based on offset
        const upTo = text.slice(0, offset);
        const lines = upTo.split('\n');
        const lineNumber = lines.length;
        const column = lines[lines.length - 1].length + 1;
        results.push({ word, suggestions, lineNumber, column });
      }
    }
    return results;
  }
}

export default new SpellCheckService();
