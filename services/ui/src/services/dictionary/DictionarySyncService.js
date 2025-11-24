/**
 * DictionarySyncService.js
 * Handles synchronization with the backend API for all dictionary types
 */

import customDictionaryApi from '@/api/customDictionaryApi';
import categoriesApi from '@/api/categoriesApi';
import AuthService from '../core/AuthService';

export class DictionarySyncService {
  constructor(userService, categoryService, folderService) {
    this.userService = userService;
    this.categoryService = categoryService;
    this.folderService = folderService;
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
        return this.userService.getCustomWords();
      }

      // Get user-level words from backend
      const userResponse = await customDictionaryApi.getWords();
      console.log('Backend user words response:', userResponse);

      // Extract words array from response
      const backendUserWords = userResponse.words || [];
      console.log('Backend user words:', backendUserWords);

      // Get local user words
      const localUserWords = this.userService.getCustomWords();
      console.log('Local user words:', localUserWords);

      // Merge user-level words and update local storage
      const mergedUserWords = this.userService.syncWithBackend(backendUserWords);

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
      return this.userService.getCustomWords();
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
      const demoToRealCategoryMap = this.categoryService.createCategoryMapping(categories);

      // Sync real categories
      for (const category of categories) {
        try {
          // Get category words from backend using the correct endpoint
          const categoryResponse = await customDictionaryApi.getCategoryWords(category.id);
          const backendCategoryWords = categoryResponse.words || [];

          // Sync backend category words to local storage
          // This replaces any local category words with what's actually in the backend
          this.categoryService.syncCategoryWithBackend(category.id, backendCategoryWords);

          // Handle demo word migration only if there are demo words for this specific category
          const demoWords = this.categoryService.getMappedDemoWords(category, demoToRealCategoryMap);
          if (demoWords.length > 0) {
            console.log(`Migrating ${demoWords.length} demo words to category ${category.name}...`);
            try {
              await customDictionaryApi.bulkAddWords(demoWords, category.id);
              // Add the migrated words to local storage
              for (const word of demoWords) {
                this.categoryService.addCategoryWord(category.id, word);
              }
              this.categoryService.migrateDemoWordsToRealCategory(category, demoWords);
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
      this.categoryService.cleanupDemoCategories();

    } catch (error) {
      console.error('Failed to sync category dictionaries:', error);
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
      this.folderService.addFolderWord(folderPath, word);
    } else if (categoryId) {
      this.categoryService.addCategoryWord(categoryId, word);
    } else {
      this.userService.addCustomWord(word);
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
      this.folderService.removeFolderWord(folderPath, word);
    } else if (categoryId) {
      this.categoryService.removeCategoryWord(categoryId, word);
    } else {
      this.userService.removeCustomWord(word);
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
}
