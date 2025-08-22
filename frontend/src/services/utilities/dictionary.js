import customDictionaryApi from '@/api/customDictionaryApi';
import categoriesApi from '@/api/categoriesApi';
import AuthService from '../core/AuthService';

// DictionaryService.js
// Manages custom dictionary words, localStorage, and backend sync for spell checking
// Supports both user-level and category-level dictionaries

class DictionaryService {
  constructor() {
    this.CUSTOM_WORDS_KEY = 'customDictionary';
    this.CATEGORY_WORDS_KEY = 'categoryCustomDictionary';
    this.customWords = new Set();
    this.categoryWords = new Map(); // Map<categoryId, Set<word>>
    this.loadCustomWordsFromStorage();
    this.loadCategoryWordsFromStorage();
  }

  /**
   * Clear local dictionary data (called during logout)
   */
  clearLocal() {
    this.customWords.clear();
    this.categoryWords.clear();
    localStorage.removeItem(this.CUSTOM_WORDS_KEY);
    localStorage.removeItem(this.CATEGORY_WORDS_KEY);
  }

  /**
   * Load category words from localStorage
   */
  loadCategoryWordsFromStorage() {
    try {
      const stored = localStorage.getItem(this.CATEGORY_WORDS_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.categoryWords = new Map();
        for (const [categoryId, words] of Object.entries(data)) {
          this.categoryWords.set(categoryId, new Set(words));
        }
      }
    } catch (err) {
      console.error('Error loading category words from storage:', err);
    }
  }

  /**
   * Save category words to localStorage
   */
  saveCategoryWordsToStorage() {
    try {
      const data = {};
      for (const [categoryId, wordsSet] of this.categoryWords.entries()) {
        data[categoryId] = Array.from(wordsSet);
      }
      localStorage.setItem(this.CATEGORY_WORDS_KEY, JSON.stringify(data));
    } catch (err) {
      console.error('Error saving category words to storage:', err);
    }
  }

  /**
   * Sync dictionary with backend after login
   * Loads words from backend and merges with local storage
   * Now supports both user-level and category-level dictionaries
   */
  async syncAfterLogin() {
    try {
      console.log('Syncing custom dictionary after login...');

      // Check if user has auth token before making API calls
      const { token, isAuthenticated } = AuthService.getAuthState();
      if (!isAuthenticated || !token) {
        console.log('No auth token found, skipping backend sync');
        return this.getCustomWords();
      }

      // Get user-level words from backend
      const userResponse = await customDictionaryApi.getWords();
      console.log('Backend user words response:', userResponse);

      // Extract words array from response
      const backendUserWords = userResponse.words || [];
      console.log('Backend user words:', backendUserWords);

      // Get local user words
      const localUserWords = this.getCustomWords();
      console.log('Local user words:', localUserWords);

      // Merge user-level words and update local storage
      const mergedUserWords = this.syncWithBackend(backendUserWords);

      // If there are local user words not on backend, upload them
      const userWordsToUpload = localUserWords.filter(word =>
        !backendUserWords.includes(word.toLowerCase())
      );

      if (userWordsToUpload.length > 0) {
        console.log(`Uploading ${userWordsToUpload.length} local user words to backend...`);
        await customDictionaryApi.bulkAddWords(userWordsToUpload);
      }

      // Sync category-level dictionaries
      await this.syncCategoryWords();

      console.log(`Dictionary sync complete. Total user words: ${mergedUserWords.length}`);
      return mergedUserWords;
    } catch (error) {
      console.error('Failed to sync custom dictionary:', error);
      // Don't throw error - allow app to continue working with local words
      return this.getCustomWords();
    }
  }

  /**
   * Sync category-level words with backend
   * Handles mapping from demo categories to real categories during login
   */
  async syncCategoryWords() {
    try {
      // Get all categories from backend to sync their dictionaries
      const categories = await categoriesApi.getCategories();
      console.log('Syncing categories:', categories);

      // Create a mapping from demo categories to real categories by name
      const demoToRealCategoryMap = this.createCategoryMapping(categories);

      // Sync real categories
      for (const category of categories) {
        try {
          // Get category words from backend using the correct endpoint
          const categoryResponse = await customDictionaryApi.getCategoryWords(category.id);
          const backendCategoryWords = categoryResponse.words || [];

          // Sync backend category words to local storage
          // This replaces any local category words with what's actually in the backend
          this.syncCategoryWithBackend(category.id, backendCategoryWords);

          // Handle demo word migration only if there are demo words for this specific category
          const demoWords = this.getMappedDemoWords(category, demoToRealCategoryMap);
          if (demoWords.length > 0) {
            console.log(`Migrating ${demoWords.length} demo words to category ${category.name}...`);
            try {
              await customDictionaryApi.bulkAddWords(demoWords, category.id);
              // Add the migrated words to local storage
              for (const word of demoWords) {
                this.addCategoryWord(category.id, word);
              }
              this.migrateDemoWordsToRealCategory(category, demoWords);
            } catch (error) {
              console.error(`Failed to migrate demo words for category ${category.name}:`, error);
            }
          }
        } catch (error) {
          console.error(`Failed to sync category ${category.name}:`, error);
          // Continue with other categories
        }
      }

      // Clean up any remaining demo category data
      this.cleanupDemoCategories();

    } catch (error) {
      console.error('Failed to sync category dictionaries:', error);
    }
  }

  /**
   * Create mapping from demo categories to real categories by name
   * @param {Array} realCategories - Real categories from backend
   * @returns {Map} Mapping from demo category name to real category
   */
  createCategoryMapping(realCategories) {
    const demoCategories = [
      { id: 'demo-1', name: 'General' },
      { id: 'demo-2', name: 'Technical' },
      { id: 'demo-3', name: 'Personal' }
    ];

    const mapping = new Map();

    for (const demoCategory of demoCategories) {
      const realCategory = realCategories.find(cat =>
        cat.name.toLowerCase() === demoCategory.name.toLowerCase()
      );
      if (realCategory) {
        mapping.set(demoCategory.id, realCategory);
      }
    }

    return mapping;
  }

  /**
   * Get words stored under demo category IDs that should be mapped to a real category
   * @param {Object} realCategory - Real category from backend
   * @param {Map} mapping - Demo to real category mapping
   * @returns {Array} Words to migrate
   */
  getMappedDemoWords(realCategory, mapping) {
    const words = [];

    for (const [demoId, mappedCategory] of mapping.entries()) {
      if (mappedCategory.id === realCategory.id) {
        const demoWords = this.getCategoryWords(demoId);
        words.push(...demoWords);
      }
    }

    return words;
  }

  /**
   * Migrate words from demo category to real category in local storage
   * @param {Object} realCategory - Real category from backend
   * @param {Array} wordsToMigrate - Words to migrate
   */
  migrateDemoWordsToRealCategory(realCategory, wordsToMigrate) {
    if (wordsToMigrate.length === 0) return;

    // Add words to real category
    for (const word of wordsToMigrate) {
      this.addCategoryWord(realCategory.id, word);
    }
  }

  /**
   * Clean up demo category data from local storage
   */
  cleanupDemoCategories() {
    const demoIds = ['demo-1', 'demo-2', 'demo-3'];
    let cleaned = false;

    for (const demoId of demoIds) {
      if (this.categoryWords.has(demoId)) {
        this.categoryWords.delete(demoId);
        cleaned = true;
      }
    }

    if (cleaned) {
      this.saveCategoryWordsToStorage();
      console.log('Cleaned up demo category data');
    }
  }

  /**
   * Add word to both local storage and backend
   * @param {string} word - Word to add
   * @param {string} [notes] - Optional notes
   * @param {string} [categoryId] - Optional category ID for category-level dictionary
   */
  async addWord(word, notes = null, categoryId = null) {
    if (categoryId) {
      this.addCategoryWord(categoryId, word);
    } else {
      this.addCustomWord(word);
    }

    const { token, isAuthenticated } = AuthService.getAuthState();
    if (!isAuthenticated || !token) {
      console.log('No auth token, word added to local storage only');
      return;
    }

    try {
      await customDictionaryApi.addWord(word, notes, categoryId);
    } catch (error) {
      console.error('Failed to add word to backend:', error);
      throw error;
    }
  }

  /**
   * Remove word from both local storage and backend
   * @param {string} word - Word to remove
   * @param {string} [categoryId] - Optional category ID for category-level dictionary
   */
  async removeWord(word, categoryId = null) {
    if (categoryId) {
      this.removeCategoryWord(categoryId, word);
    } else {
      this.removeCustomWord(word);
    }

    const { token, isAuthenticated } = AuthService.getAuthState();
    if (!isAuthenticated || !token) {
      console.log('No auth token, word removed from local storage only');
      return;
    }

    try {
      await customDictionaryApi.deleteWordByText(word, categoryId);
    } catch (error) {
      console.error('Failed to remove word from backend:', error);
      throw error;
    }
  }

  /**
   * Alias for removeWord to match expected API
   * @param {string} word - Word to delete
   * @param {string} [categoryId] - Optional category ID
   */
  async deleteWord(word, categoryId = null) {
    return this.removeWord(word, categoryId);
  }

  /**
   * Clear local dictionary (for logout)
   */
  clearLocal() {
    this.setCustomWords([]);
    this.setCategoryWords(new Map());
    console.log('Local custom dictionary cleared');
  }

  /**
   * Add a word to the category-specific custom dictionary
   * @param {string} categoryId - The category ID
   * @param {string} word - The word to add
   */
  addCategoryWord(categoryId, word) {
    const normalizedWord = word.toLowerCase().trim();
    if (normalizedWord && categoryId) {
      if (!this.categoryWords.has(categoryId)) {
        this.categoryWords.set(categoryId, new Set());
      }
      this.categoryWords.get(categoryId).add(normalizedWord);
      this.saveCategoryWordsToStorage();
      window.dispatchEvent(new CustomEvent('dictionary:categoryWordAdded', {
        detail: { categoryId, word: normalizedWord }
      }));
    }
  }

  /**
   * Remove a word from the category-specific custom dictionary
   * @param {string} categoryId - The category ID
   * @param {string} word - The word to remove
   */
  removeCategoryWord(categoryId, word) {
    const normalizedWord = word.toLowerCase().trim();
    if (this.categoryWords.has(categoryId)) {
      this.categoryWords.get(categoryId).delete(normalizedWord);
      if (this.categoryWords.get(categoryId).size === 0) {
        this.categoryWords.delete(categoryId);
      }
      this.saveCategoryWordsToStorage();
      window.dispatchEvent(new CustomEvent('dictionary:categoryWordRemoved', {
        detail: { categoryId, word: normalizedWord }
      }));
    }
  }

  /**
   * Get words for a specific category
   * @param {string} categoryId - The category ID
   * @returns {string[]}
   */
  getCategoryWords(categoryId) {
    if (!this.categoryWords.has(categoryId)) {
      return [];
    }
    return Array.from(this.categoryWords.get(categoryId));
  }

  /**
   * Check if a word is in a category's custom dictionary
   * @param {string} categoryId - The category ID
   * @param {string} word - The word to check
   * @returns {boolean}
   */
  isCategoryWord(categoryId, word) {
    if (!this.categoryWords.has(categoryId)) {
      return false;
    }
    return this.categoryWords.get(categoryId).has(word.toLowerCase());
  }

  /**
   * Get all applicable custom words for spell checking
   * Combines user-level words with category-specific words
   * @param {string} [categoryId] - Current document's category ID
   * @returns {string[]}
   */
  getAllApplicableWords(categoryId = null) {
    const userWords = this.getCustomWords();
    if (!categoryId) {
      return userWords;
    }

    const categoryWords = this.getCategoryWords(categoryId);
    // Combine and deduplicate
    return [...new Set([...userWords, ...categoryWords])];
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
   * Set category words (used when loading from backend)
   * @param {Map<string, string[]>} categoryWordsMap - Map of category ID to words array
   */
  setCategoryWords(categoryWordsMap) {
    this.categoryWords = new Map();
    for (const [categoryId, words] of categoryWordsMap.entries()) {
      this.categoryWords.set(categoryId, new Set(words.map(word => word.toLowerCase())));
    }
    this.saveCategoryWordsToStorage();
    window.dispatchEvent(new CustomEvent('dictionary:categoryUpdated', {
      detail: { categoryWords: this.categoryWords }
    }));
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
   * Sync category words with backend
   * @param {string} categoryId - Category ID
   * @param {string[]} backendWords - Words from backend for this category
   */
  syncCategoryWithBackend(categoryId, backendWords) {
    const safeBackendWords = Array.isArray(backendWords) ? backendWords : [];
    const backendWordsSet = new Set(safeBackendWords.map(word => word.toLowerCase()));

    // Replace local category words with backend words (backend is source of truth)
    if (backendWordsSet.size > 0) {
      this.categoryWords.set(categoryId, backendWordsSet);
    } else {
      this.categoryWords.delete(categoryId);
    }

    this.saveCategoryWordsToStorage();
    window.dispatchEvent(new CustomEvent('dictionary:categorySynced', {
      detail: { categoryId, words: Array.from(backendWordsSet) }
    }));
    return Array.from(backendWordsSet);
  }

  /**
   * Get formatted dictionary entries for UI display
   * @param {string|null} categoryId - Category ID or null for user-level words
   * @returns {Promise<Array>} - Array of formatted entries with id, word, notes, etc.
   */
  async getEntries(categoryId = null) {
    const { isAuthenticated, token } = AuthService.getAuthState();
    
    if (!isAuthenticated || !token) {
      // Return local entries for guest users
      return this.getLocalEntries(categoryId);
    }

    try {
      const data = await customDictionaryApi.getEntries(categoryId);
      let filteredEntries = Array.isArray(data) ? data : [];
      
      // Additional frontend filtering as fallback
      if (categoryId) {
        filteredEntries = filteredEntries.filter(entry => 
          entry.category_id === parseInt(categoryId)
        );
      } else {
        filteredEntries = filteredEntries.filter(entry => 
          entry.category_id === null
        );
      }
      
      return filteredEntries;
    } catch (error) {
      console.error('Failed to load dictionary entries:', error);
      if (error.message?.includes("Not authenticated")) {
        return this.getLocalEntries(categoryId);
      }
      throw error;
    }
  }

  /**
   * Get local entries for guest users or fallback
   * @param {string|null} categoryId - Category ID or null for user-level words
   * @returns {Array} - Array of local entries
   */
  getLocalEntries(categoryId = null) {
    if (categoryId) {
      const words = this.getCategoryWords(categoryId);
      return words.map((word, index) => ({
        id: `local-${categoryId}-${index}`,
        word,
        notes: null,
        category_id: categoryId,
        isLocal: true
      }));
    } else {
      const words = this.getCustomWords();
      return words.map((word, index) => ({
        id: `local-user-${index}`,
        word,
        notes: null,
        category_id: null,
        isLocal: true
      }));
    }
  }

  /**
   * Update word notes
   * @param {string} entryId - Entry ID
   * @param {string} notes - New notes
   * @returns {Promise<Object>} - Updated entry
   */
  async updateWordNotes(entryId, notes) {
    const { isAuthenticated, token } = AuthService.getAuthState();
    
    if (!isAuthenticated || !token) {
      throw new Error("Authentication required to update word notes");
    }

    try {
      const updatedEntry = await customDictionaryApi.updateWord(entryId, notes);
      window.dispatchEvent(new CustomEvent('dictionary:wordUpdated', { 
        detail: { entry: updatedEntry } 
      }));
      return updatedEntry;
    } catch (error) {
      console.error('Failed to update word notes:', error);
      throw error;
    }
  }

  /**
   * Get available categories
   * @returns {Promise<Array>} - Array of categories
   */
  async getCategories() {
    try {
      const categories = await categoriesApi.getCategories();
      return categories;
    } catch (error) {
      console.error('Failed to load categories:', error);
      return []; // Return empty array on error
    }
  }

  /**
   * Get word count for a specific context
   * @param {string|null} categoryId - Category ID or null for user-level words
   * @returns {number} - Number of words
   */
  getWordCount(categoryId = null) {
    if (categoryId) {
      return this.getCategoryWords(categoryId).length;
    } else {
      return this.getCustomWords().length;
    }
  }
}

export default new DictionaryService();