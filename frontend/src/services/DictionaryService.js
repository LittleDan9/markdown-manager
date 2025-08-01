import customDictionaryApi from '../api/customDictionaryApi';

// DictionaryService.js
// Manages custom dictionary words, localStorage, and backend sync for spell checking

class DictionaryService {
  constructor() {
    this.CUSTOM_WORDS_KEY = 'customDictionary';
    this.customWords = new Set();
    window.addEventListener('auth:logout-complete', () => {
      this.clearLocal();
    });
    window.addEventListener('auth:login-complete', () => {
      this.syncAfterLogin();
    });
    this.loadCustomWordsFromStorage();
  }
  /**
   * Sync dictionary with backend after login
   * Loads words from backend and merges with local storage
   */
  async syncAfterLogin() {
    try {
      console.log('Syncing custom dictionary after login...');

      // Check if user has auth token before making API calls
      const token = localStorage.getItem("authToken");
      if (!token) {
        console.log('No auth token found, skipping backend sync');
        return this.getCustomWords();
      }

      // Get words from backend
      const response = await customDictionaryApi.getWords();
      console.log('Backend response:', response);

      // Extract words array from response
      const backendWords = response.words || [];
      console.log('Backend words:', backendWords);

      // Get local words
      const localWords = this.getCustomWords();
      console.log('Local words:', localWords);

      // Merge and update local storage
      const mergedWords = this.syncWithBackend(backendWords);

      // If there are local words not on backend, upload them
      const wordsToUpload = localWords.filter(word =>
        !backendWords.includes(word.toLowerCase())
      );

      if (wordsToUpload.length > 0) {
        console.log(`Uploading ${wordsToUpload.length} local words to backend...`);
        await customDictionaryApi.bulkAddWords(wordsToUpload);
      }

      console.log(`Dictionary sync complete. Total words: ${mergedWords.length}`);
      return mergedWords;
    } catch (error) {
      console.error('Failed to sync custom dictionary:', error);
      // Don't throw error - allow app to continue working with local words
      return this.getCustomWords();
    }
  }

  /**
   * Add word to both local storage and backend
   * @param {string} word - Word to add
   * @param {string} [notes] - Optional notes
   */
  async addWord(word, notes = null) {
    this.addCustomWord(word);
    const token = localStorage.getItem("authToken");
    if (!token) {
      console.log('No auth token, word added to local storage only');
      return;
    }
    try {
      await customDictionaryApi.addWord(word, notes);
    } catch (error) {
      console.error('Failed to add word to backend:', error);
      throw error;
    }
  }

  /**
   * Remove word from both local storage and backend
   * @param {string} word - Word to remove
   */
  async removeWord(word) {
    this.removeCustomWord(word);
    const token = localStorage.getItem("authToken");
    if (!token) {
      console.log('No auth token, word removed from local storage only');
      return;
    }
    try {
      await customDictionaryApi.deleteWordByText(word);
    } catch (error) {
      console.error('Failed to remove word from backend:', error);
      throw error;
    }
  }

  /**
   * Alias for removeWord to match expected API
   * @param {string} word - Word to delete
   */
  async deleteWord(word) {
    return this.removeWord(word);
  }

  /**
   * Clear local dictionary (for logout)
   */
  clearLocal() {
    this.setCustomWords([]);
    console.log('Local custom dictionary cleared');
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
    const safeBackendWords = Array.isArray(backendWords) ? backendWords : [];
    const backendWordsSet = new Set(safeBackendWords.map(word => word.toLowerCase()));
    const mergedWords = new Set([...currentWords, ...backendWordsSet]);
    this.customWords = mergedWords;
    this.saveCustomWordsToStorage();
    return Array.from(mergedWords);
  }
}

export default new DictionaryService();