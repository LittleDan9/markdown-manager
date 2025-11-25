/**
 * DictionaryService - Main composed service
 * Combines all dictionary functionality into a unified interface
 */

import { UserDictionaryService } from './UserDictionaryService.js';
import { CategoryDictionaryService } from './CategoryDictionaryService.js';
import { FolderDictionaryService } from './FolderDictionaryService.js';
import { DictionarySyncService } from './DictionarySyncService.js';
import { DictionaryEntryFormatter } from './DictionaryEntryFormatter.js';
import { DictionaryScopeUtils } from './DictionaryScopeUtils.js';

class DictionaryService {
  constructor() {
    // Initialize individual services
    this.userService = new UserDictionaryService();
    this.categoryService = new CategoryDictionaryService();
    this.folderService = new FolderDictionaryService();
    
    // Initialize composed services that depend on others
    this.syncService = new DictionarySyncService(
      this.userService,
      this.categoryService,
      this.folderService
    );
    
    this.entryFormatter = new DictionaryEntryFormatter(
      this.userService,
      this.categoryService,
      this.folderService
    );
  }

  // ===================
  // SCOPE UTILITIES
  // ===================

  /**
   * Get dictionary scope for the current context
   * @param {Object} currentDocument - Current document object with folder_path and source info
   * @returns {Object} - Dictionary scope information
   */
  getDictionaryScope(currentDocument = null) {
    return DictionaryScopeUtils.getDictionaryScope(currentDocument);
  }

  /**
   * Get available dictionary scopes for the user
   * @param {Array} documents - User's documents
   * @returns {Array} - Available dictionary scopes
   */
  getAvailableScopes(documents = []) {
    return DictionaryScopeUtils.getAvailableScopes(documents);
  }

  // ===================
  // SYNC METHODS
  // ===================

  /**
   * Sync dictionary with backend after login
   */
  async syncAfterLogin() {
    return this.syncService.syncAfterLogin();
  }

  /**
   * Add word to both local storage and backend
   */
  async addWord(word, notes = null, folderPath = null, categoryId = null) {
    return this.syncService.addWord(word, notes, folderPath, categoryId);
  }

  /**
   * Remove word from both local storage and backend
   */
  async removeWord(word, folderPath = null, categoryId = null) {
    return this.syncService.removeWord(word, folderPath, categoryId);
  }

  /**
   * Alias for removeWord to match expected API
   */
  async deleteWord(word, folderPath = null, categoryId = null) {
    return this.syncService.removeWord(word, folderPath, categoryId);
  }

  /**
   * Update word notes
   */
  async updateWordNotes(entryId, notes) {
    return this.syncService.updateWordNotes(entryId, notes);
  }

  /**
   * Get available categories
   */
  async getCategories() {
    return this.syncService.getCategories();
  }

  // ===================
  // USER-LEVEL METHODS
  // ===================

  addCustomWord(word) {
    return this.userService.addCustomWord(word);
  }

  removeCustomWord(word) {
    return this.userService.removeCustomWord(word);
  }

  isCustomWord(word) {
    return this.userService.isCustomWord(word);
  }

  getCustomWords() {
    return this.userService.getCustomWords();
  }

  setCustomWords(words) {
    return this.userService.setCustomWords(words);
  }

  syncWithBackend(backendWords) {
    return this.userService.syncWithBackend(backendWords);
  }

  // ===================
  // FOLDER-LEVEL METHODS
  // ===================

  addFolderWord(folderPath, word) {
    return this.folderService.addFolderWord(folderPath, word);
  }

  removeFolderWord(folderPath, word) {
    return this.folderService.removeFolderWord(folderPath, word);
  }

  getFolderWords(folderPath) {
    return this.folderService.getFolderWords(folderPath);
  }

  isFolderWord(folderPath, word) {
    return this.folderService.isFolderWord(folderPath, word);
  }

  setFolderWords(folderWordsMap) {
    return this.folderService.setFolderWords(folderWordsMap);
  }

  // ===================
  // CATEGORY-LEVEL METHODS (Backward Compatibility)
  // ===================

  addCategoryWord(categoryId, word) {
    return this.categoryService.addCategoryWord(categoryId, word);
  }

  removeCategoryWord(categoryId, word) {
    return this.categoryService.removeCategoryWord(categoryId, word);
  }

  getCategoryWords(categoryId) {
    return this.categoryService.getCategoryWords(categoryId);
  }

  isCategoryWord(categoryId, word) {
    return this.categoryService.isCategoryWord(categoryId, word);
  }

  setCategoryWords(categoryWordsMap) {
    return this.categoryService.setCategoryWords(categoryWordsMap);
  }

  syncCategoryWithBackend(categoryId, backendWords) {
    return this.categoryService.syncCategoryWithBackend(categoryId, backendWords);
  }

  // ===================
  // COMBINED UTILITY METHODS
  // ===================

  /**
   * Get all applicable custom words for spell checking
   * Combines user-level words with folder-specific words or category-specific words
   * @param {string} [folderPath] - Current document's folder path
   * @param {string} [categoryId] - Current document's category ID (for backward compatibility)
   * @returns {string[]}
   */
  getAllApplicableWords(folderPath = null, categoryId = null) {
    const userWords = this.userService.getCustomWords();
    
    if (folderPath) {
      const folderWords = this.folderService.getFolderWords(folderPath);
      // Combine and deduplicate
      return [...new Set([...userWords, ...folderWords])];
    } else if (categoryId) {
      // Backward compatibility with category-based dictionaries
      const categoryWords = this.categoryService.getCategoryWords(categoryId);
      // Combine and deduplicate
      return [...new Set([...userWords, ...categoryWords])];
    }
    
    return userWords;
  }

  /**
   * Get word count for a specific context
   * @param {string|null} folderPath - Folder path or null for user-level words
   * @param {string|null} categoryId - Category ID for backward compatibility
   * @returns {number} - Number of words
   */
  getWordCount(folderPath = null, categoryId = null) {
    if (folderPath) {
      return this.folderService.getWordCount(folderPath);
    } else if (categoryId) {
      // Backward compatibility
      return this.categoryService.getWordCount(categoryId);
    } else {
      // User-level words
      return this.userService.getWordCount();
    }
  }

  /**
   * Clear local dictionary data (called during logout)
   */
  clearLocal() {
    this.userService.clear();
    this.categoryService.clear();
    this.folderService.clear();
  }

  // ===================
  // ENTRY FORMATTING METHODS
  // ===================

  /**
   * Get formatted dictionary entries for UI display
   */
  async getEntries(folderPath = null, categoryId = null) {
    return this.entryFormatter.getEntries(folderPath, categoryId);
  }

  /**
   * Get local entries for guest users or fallback
   */
  getLocalEntries(folderPath = null, categoryId = null) {
    return this.entryFormatter.getLocalEntries(folderPath, categoryId);
  }

  // ===================
  // DEPRECATED METHODS (for backward compatibility)
  // ===================

  /**
   * @deprecated Use loadCustomWordsFromStorage on individual services
   */
  loadCustomWordsFromStorage() {
    this.userService.loadCustomWordsFromStorage();
  }

  /**
   * @deprecated Use loadCategoryWordsFromStorage on individual services
   */
  loadCategoryWordsFromStorage() {
    this.categoryService.loadCategoryWordsFromStorage();
  }

  /**
   * @deprecated Use loadFolderWordsFromStorage on individual services
   */
  loadFolderWordsFromStorage() {
    this.folderService.loadFolderWordsFromStorage();
  }

  /**
   * @deprecated Use normalizeFolderPath from DictionaryScopeUtils
   */
  normalizeFolderPath(folderPath) {
    return DictionaryScopeUtils.normalizeFolderPath(folderPath);
  }
}

export default new DictionaryService();
