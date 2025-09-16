/**
 * CategoryDictionaryService.js
 * Manages category-level custom dictionary words for backward compatibility
 */

export class CategoryDictionaryService {
  constructor() {
    this.CATEGORY_WORDS_KEY = 'categoryCustomDictionary';
    this.categoryWords = new Map(); // Map<categoryId, Set<word>>
    this.loadCategoryWordsFromStorage();
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
   * Clear category dictionary data
   */
  clear() {
    this.categoryWords.clear();
    localStorage.removeItem(this.CATEGORY_WORDS_KEY);
  }

  /**
   * Get word count for a specific category
   * @param {string} categoryId - The category ID
   * @returns {number} - Number of words
   */
  getWordCount(categoryId) {
    return this.getCategoryWords(categoryId).length;
  }

  /**
   * Get all category IDs with words
   * @returns {string[]} - Array of category IDs
   */
  getAllCategoryIds() {
    return Array.from(this.categoryWords.keys());
  }
}
