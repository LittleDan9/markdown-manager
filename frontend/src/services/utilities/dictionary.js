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
    this.FOLDER_WORDS_KEY = 'folderCustomDictionary';
    this.customWords = new Set();
    this.categoryWords = new Map(); // Map<categoryId, Set<word>>
    this.folderWords = new Map(); // Map<folderPath, Set<word>>
    this.loadCustomWordsFromStorage();
    this.loadCategoryWordsFromStorage();
    this.loadFolderWordsFromStorage();
  }

  /**
   * Get dictionary scope for the current context
   * @param {Object} currentDocument - Current document object with folder_path and source info
   * @returns {Object} - Dictionary scope information
   */
  getDictionaryScope(currentDocument = null) {
    if (!currentDocument) {
      return { type: 'user', folderPath: null, displayName: 'Personal Dictionary' };
    }

    // Check if document is from GitHub
    if (currentDocument.source === 'github' || currentDocument.repository_id) {
      const repoName = currentDocument.repository_name || 'Unknown Repository';
      const folderPath = `/github/${repoName}`;
      return {
        type: 'github',
        folderPath,
        displayName: `${repoName} Repository Dictionary`,
        repository: currentDocument.repository_name
      };
    }

    // For local documents, check folder depth
    const folderPath = currentDocument.folder_path || '/';
    const pathParts = folderPath.split('/').filter(part => part.length > 0);

    if (pathParts.length === 0) {
      // Root level documents
      return { type: 'user', folderPath: null, displayName: 'Personal Dictionary' };
    } else if (pathParts.length === 1) {
      // One level deep - use root folder dictionary
      const rootFolder = pathParts[0];
      return {
        type: 'folder',
        folderPath: `/${rootFolder}`,
        displayName: `${rootFolder} Folder Dictionary`,
        folder: rootFolder
      };
    } else {
      // Multiple levels deep - use the root folder dictionary
      const rootFolder = pathParts[0];
      return {
        type: 'folder',
        folderPath: `/${rootFolder}`,
        displayName: `${rootFolder} Folder Dictionary`,
        folder: rootFolder
      };
    }
  }

  /**
   * Get available dictionary scopes for the user
   * @param {Array} documents - User's documents
   * @returns {Array} - Available dictionary scopes
   */
  getAvailableScopes(documents = []) {
    const scopes = [
      { type: 'user', folderPath: null, displayName: 'Personal Dictionary (All Documents)' }
    ];

    const uniqueFolders = new Set();
    const uniqueRepos = new Set();

    documents.forEach(doc => {
      if (doc.source === 'github' || doc.repository_id) {
        const repoName = doc.repository_name || 'Unknown Repository';
        if (!uniqueRepos.has(repoName)) {
          uniqueRepos.add(repoName);
          scopes.push({
            type: 'github',
            folderPath: `/github/${repoName}`,
            displayName: `${repoName} Repository Dictionary`,
            repository: repoName
          });
        }
      } else {
        const folderPath = doc.folder_path || '/';
        const pathParts = folderPath.split('/').filter(part => part.length > 0);
        
        if (pathParts.length > 0) {
          const rootFolder = pathParts[0];
          if (!uniqueFolders.has(rootFolder)) {
            uniqueFolders.add(rootFolder);
            scopes.push({
              type: 'folder',
              folderPath: `/${rootFolder}`,
              displayName: `${rootFolder} Folder Dictionary`,
              folder: rootFolder
            });
          }
        }
      }
    });

    return scopes;
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
   * @param {string} [folderPath] - Optional folder path for folder-level dictionary
   * @param {string} [categoryId] - Optional category ID for backward compatibility
   */
  async addWord(word, notes = null, folderPath = null, categoryId = null) {
    // Handle local storage first
    if (folderPath) {
      this.addFolderWord(folderPath, word);
    } else if (categoryId) {
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
      await customDictionaryApi.addWord(word, notes, folderPath, categoryId);
    } catch (error) {
      console.error('Failed to add word to backend:', error);
      throw error;
    }
  }

  /**
   * Remove word from both local storage and backend
   * @param {string} word - Word to remove
   * @param {string} [folderPath] - Optional folder path for folder-level dictionary
   * @param {string} [categoryId] - Optional category ID for backward compatibility
   */
  async removeWord(word, folderPath = null, categoryId = null) {
    // Handle local storage first
    if (folderPath) {
      this.removeFolderWord(folderPath, word);
    } else if (categoryId) {
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
      await customDictionaryApi.deleteWordByText(word, folderPath, categoryId);
    } catch (error) {
      console.error('Failed to remove word from backend:', error);
      throw error;
    }
  }

  /**
   * Alias for removeWord to match expected API
   * @param {string} word - Word to delete
   * @param {string} [folderPath] - Optional folder path
   * @param {string} [categoryId] - Optional category ID for backward compatibility
   */
  async deleteWord(word, folderPath = null, categoryId = null) {
    return this.removeWord(word, folderPath, categoryId);
  }

    /**
   * Clear local dictionary data (called during logout)
   */
  clearLocal() {
    this.customWords.clear();
    this.categoryWords.clear();
    this.folderWords.clear();
    localStorage.removeItem(this.CUSTOM_WORDS_KEY);
    localStorage.removeItem(this.CATEGORY_WORDS_KEY);
    localStorage.removeItem(this.FOLDER_WORDS_KEY);
  }

  // ===================
  // FOLDER-BASED METHODS
  // ===================

  /**
   * Add a word to the folder-specific custom dictionary
   * @param {string} folderPath - The folder path (e.g., '/Work' or '/github/my-repo')
   * @param {string} word - The word to add
   */
  addFolderWord(folderPath, word) {
    const normalizedWord = word.toLowerCase().trim();
    const normalizedPath = this.normalizeFolderPath(folderPath);
    
    if (normalizedWord && normalizedPath) {
      if (!this.folderWords.has(normalizedPath)) {
        this.folderWords.set(normalizedPath, new Set());
      }
      this.folderWords.get(normalizedPath).add(normalizedWord);
      this.saveFolderWordsToStorage();
      window.dispatchEvent(new CustomEvent('dictionary:folderWordAdded', {
        detail: { folderPath: normalizedPath, word: normalizedWord }
      }));
    }
  }

  /**
   * Remove a word from the folder-specific custom dictionary
   * @param {string} folderPath - The folder path
   * @param {string} word - The word to remove
   */
  removeFolderWord(folderPath, word) {
    const normalizedWord = word.toLowerCase().trim();
    const normalizedPath = this.normalizeFolderPath(folderPath);
    
    if (this.folderWords.has(normalizedPath)) {
      this.folderWords.get(normalizedPath).delete(normalizedWord);
      if (this.folderWords.get(normalizedPath).size === 0) {
        this.folderWords.delete(normalizedPath);
      }
      this.saveFolderWordsToStorage();
      window.dispatchEvent(new CustomEvent('dictionary:folderWordRemoved', {
        detail: { folderPath: normalizedPath, word: normalizedWord }
      }));
    }
  }

  /**
   * Get words for a specific folder path
   * @param {string} folderPath - The folder path
   * @returns {string[]}
   */
  getFolderWords(folderPath) {
    const normalizedPath = this.normalizeFolderPath(folderPath);
    if (!this.folderWords.has(normalizedPath)) {
      return [];
    }
    return Array.from(this.folderWords.get(normalizedPath));
  }

  /**
   * Check if a word is in a folder's custom dictionary
   * @param {string} folderPath - The folder path
   * @param {string} word - The word to check
   * @returns {boolean}
   */
  isFolderWord(folderPath, word) {
    const normalizedPath = this.normalizeFolderPath(folderPath);
    if (!this.folderWords.has(normalizedPath)) {
      return false;
    }
    return this.folderWords.get(normalizedPath).has(word.toLowerCase());
  }

  /**
   * Normalize folder path to ensure consistency
   * @param {string} folderPath - The folder path to normalize
   * @returns {string} - Normalized folder path
   */
  normalizeFolderPath(folderPath) {
    if (!folderPath || folderPath === '/') {
      return null; // User-level dictionary
    }
    // Ensure it starts with / and doesn't end with / (unless it's just /)
    let normalized = folderPath.startsWith('/') ? folderPath : `/${folderPath}`;
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }

  /**
   * Load folder words from localStorage
   */
  loadFolderWordsFromStorage() {
    try {
      const stored = localStorage.getItem(this.FOLDER_WORDS_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.folderWords = new Map();
        for (const [folderPath, words] of Object.entries(data)) {
          this.folderWords.set(folderPath, new Set(words));
        }
      }
    } catch (err) {
      console.error('Error loading folder words from storage:', err);
    }
  }

  /**
   * Save folder words to localStorage
   */
  saveFolderWordsToStorage() {
    try {
      const data = {};
      for (const [folderPath, wordsSet] of this.folderWords.entries()) {
        data[folderPath] = Array.from(wordsSet);
      }
      localStorage.setItem(this.FOLDER_WORDS_KEY, JSON.stringify(data));
    } catch (err) {
      console.error('Error saving folder words to storage:', err);
    }
  }

  /**
   * Set folder words (used when loading from backend)
   * @param {Map<string, string[]>} folderWordsMap - Map of folder path to words array
   */
  setFolderWords(folderWordsMap) {
    this.folderWords = new Map();
    for (const [folderPath, words] of folderWordsMap.entries()) {
      this.folderWords.set(folderPath, new Set(words.map(word => word.toLowerCase())));
    }
    this.saveFolderWordsToStorage();
    window.dispatchEvent(new CustomEvent('dictionary:folderUpdated', {
      detail: { folderWords: this.folderWords }
    }));
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
   * Combines user-level words with folder-specific words or category-specific words
   * @param {string} [folderPath] - Current document's folder path
   * @param {string} [categoryId] - Current document's category ID (for backward compatibility)
   * @returns {string[]}
   */
  getAllApplicableWords(folderPath = null, categoryId = null) {
    const userWords = this.getCustomWords();
    
    if (folderPath) {
      const normalizedPath = this.normalizeFolderPath(folderPath);
      const folderWords = this.getFolderWords(normalizedPath);
      // Combine and deduplicate
      return [...new Set([...userWords, ...folderWords])];
    } else if (categoryId) {
      // Backward compatibility with category-based dictionaries
      const categoryWords = this.getCategoryWords(categoryId);
      // Combine and deduplicate
      return [...new Set([...userWords, ...categoryWords])];
    }
    
    return userWords;
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
   * @param {string|null} folderPath - Folder path or null for user-level words
   * @param {string|null} categoryId - Category ID for backward compatibility
   * @returns {Promise<Array>} - Array of formatted entries with id, word, notes, etc.
   */
  async getEntries(folderPath = null, categoryId = null) {
    const { isAuthenticated, token } = AuthService.getAuthState();
    
    if (!isAuthenticated || !token) {
      // Return local entries for guest users
      return this.getLocalEntries(folderPath, categoryId);
    }

    try {
      const data = await customDictionaryApi.getEntries(folderPath, categoryId);
      let filteredEntries = Array.isArray(data) ? data : [];
      
      // Additional frontend filtering as fallback
      if (folderPath) {
        const normalizedPath = this.normalizeFolderPath(folderPath);
        filteredEntries = filteredEntries.filter(entry => 
          entry.folder_path === normalizedPath
        );
      } else if (categoryId) {
        // Backward compatibility
        filteredEntries = filteredEntries.filter(entry => 
          entry.category_id === parseInt(categoryId)
        );
      } else {
        // User-level entries
        filteredEntries = filteredEntries.filter(entry => 
          entry.category_id === null && entry.folder_path === null
        );
      }
      
      return filteredEntries;
    } catch (error) {
      console.error('Failed to load dictionary entries:', error);
      if (error.message?.includes("Not authenticated")) {
        return this.getLocalEntries(folderPath, categoryId);
      }
      throw error;
    }
  }

  /**
   * Get local entries for guest users or fallback
   * @param {string|null} folderPath - Folder path or null for user-level words
   * @param {string|null} categoryId - Category ID for backward compatibility
   * @returns {Array} - Array of local entries
   */
  getLocalEntries(folderPath = null, categoryId = null) {
    if (folderPath) {
      const normalizedPath = this.normalizeFolderPath(folderPath);
      const words = this.getFolderWords(normalizedPath);
      return words.map((word, index) => ({
        id: `local-folder-${normalizedPath}-${index}`,
        word,
        notes: null,
        folder_path: normalizedPath,
        category_id: null,
        isLocal: true
      }));
    } else if (categoryId) {
      // Backward compatibility
      const words = this.getCategoryWords(categoryId);
      return words.map((word, index) => ({
        id: `local-${categoryId}-${index}`,
        word,
        notes: null,
        category_id: categoryId,
        folder_path: null,
        isLocal: true
      }));
    } else {
      // User-level words
      const words = this.getCustomWords();
      return words.map((word, index) => ({
        id: `local-user-${index}`,
        word,
        notes: null,
        category_id: null,
        folder_path: null,
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
   * @param {string|null} folderPath - Folder path or null for user-level words
   * @param {string|null} categoryId - Category ID for backward compatibility
   * @returns {number} - Number of words
   */
  getWordCount(folderPath = null, categoryId = null) {
    if (folderPath) {
      const normalizedPath = this.normalizeFolderPath(folderPath);
      return this.getFolderWords(normalizedPath).length;
    } else if (categoryId) {
      // Backward compatibility
      return this.getCategoryWords(categoryId).length;
    } else {
      // User-level words
      return this.getCustomWords().length;
    }
  }
}

export default new DictionaryService();